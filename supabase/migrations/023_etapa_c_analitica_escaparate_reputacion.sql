-- =============================================================================
-- Migración 023 — Etapa C: Embudo Analítico, Escaparate Pro y Reputación Verificada
-- 1. Índices JSONB de alto rendimiento en `eventos_web` para embudo por inmueble/asesor.
-- 2. Campos profesionales de escaparate en `perfiles` (licencia, idiomas, zonas,
--    horario, experiencia y redes sociales).
-- 3. Reseñas inmobiliarias verificadas por tipo de interacción real (`visita_confirmada`,
--    `conversacion`, `cierre_operacion`) + respuesta oficial del asesor/agencia con
--    inmutabilidad criptográfica de calificación/comentario tras su emisión.
-- 4. Motor automático `recalcular_reputacion_perfil` + triggers en tiempo real.
-- 5. Ampliación retrocompatible de `vw_perfiles_publicos` con métricas agregadas
--    para el Escaparate Pro (`/vendedor/[slug]`) y el Directorio (`/asesores`).
-- =============================================================================

-- 1. Índices parciales en `eventos_web` para consultas sub-milisegundo del embudo
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'eventos_web'
  ) THEN
    EXECUTE $idx1$
      CREATE INDEX IF NOT EXISTS idx_eventos_web_inmueble_funnel
        ON public.eventos_web ((meta->>'inmueble_id'), tipo, creado_en DESC)
        WHERE meta ? 'inmueble_id'
    $idx1$;

    EXECUTE $idx2$
      CREATE INDEX IF NOT EXISTS idx_eventos_web_vendedor_funnel
        ON public.eventos_web ((meta->>'vendedor_id'), tipo, creado_en DESC)
        WHERE meta ? 'vendedor_id'
    $idx2$;
  END IF;
END $$;

-- 2. Campos profesionales de Escaparate Pro en `public.perfiles`
ALTER TABLE public.perfiles
  ADD COLUMN IF NOT EXISTS horario_atencion text,
  ADD COLUMN IF NOT EXISTS idiomas text[] NOT NULL DEFAULT ARRAY['es']::text[],
  ADD COLUMN IF NOT EXISTS zonas_especialidad text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS redes_sociales jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS anos_experiencia smallint;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.perfiles'::regclass
      AND conname = 'perfiles_anos_experiencia_check'
  ) THEN
    ALTER TABLE public.perfiles
      ADD CONSTRAINT perfiles_anos_experiencia_check
      CHECK (anos_experiencia IS NULL OR (anos_experiencia >= 0 AND anos_experiencia <= 80));
  END IF;
END $$;

-- 3. Reseñas verificadas por interacción real + respuesta oficial del asesor/agencia
ALTER TABLE public.resenas
  ADD COLUMN IF NOT EXISTS tipo_interaccion text NOT NULL DEFAULT 'conversacion',
  ADD COLUMN IF NOT EXISTS solicitud_visita_id uuid REFERENCES public.solicitudes_visita(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS respuesta_vendedor text,
  ADD COLUMN IF NOT EXISTS respuesta_en timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.resenas'::regclass
      AND conname = 'resenas_tipo_interaccion_check'
  ) THEN
    ALTER TABLE public.resenas
      ADD CONSTRAINT resenas_tipo_interaccion_check
      CHECK (tipo_interaccion IN ('visita_confirmada', 'conversacion', 'cierre_operacion'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_resenas_vendedor_creado
  ON public.resenas (vendedor_id, creado_en DESC);

-- Proteger inmutabilidad de calificación, autor y comentario ante cualquier UPDATE
CREATE OR REPLACE FUNCTION public.resenas_proteger_campos_inmutables()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.producto_id IS DISTINCT FROM OLD.producto_id
     OR NEW.vendedor_id IS DISTINCT FROM OLD.vendedor_id
     OR NEW.comprador_id IS DISTINCT FROM OLD.comprador_id
     OR NEW.puntuacion IS DISTINCT FROM OLD.puntuacion
     OR NEW.comentario IS DISTINCT FROM OLD.comentario
     OR NEW.tipo_interaccion IS DISTINCT FROM OLD.tipo_interaccion
  THEN
    RAISE EXCEPTION 'Solo se permite actualizar la respuesta oficial del asesor en una reseña emitida';
  END IF;

  IF NEW.respuesta_vendedor IS NOT NULL THEN
    NEW.respuesta_vendedor := left(btrim(NEW.respuesta_vendedor), 1000);
    IF NEW.respuesta_vendedor = '' THEN
      NEW.respuesta_vendedor := NULL;
      NEW.respuesta_en := NULL;
    ELSIF NEW.respuesta_vendedor IS DISTINCT FROM OLD.respuesta_vendedor THEN
      NEW.respuesta_en := COALESCE(NEW.respuesta_en, now());
    END IF;
  ELSE
    NEW.respuesta_en := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_resenas_proteger_campos_inmutables ON public.resenas;
CREATE TRIGGER trg_resenas_proteger_campos_inmutables
  BEFORE UPDATE ON public.resenas
  FOR EACH ROW
  EXECUTE FUNCTION public.resenas_proteger_campos_inmutables();

DROP POLICY IF EXISTS "resenas_reply_seller_or_agency_owner" ON public.resenas;
CREATE POLICY "resenas_reply_seller_or_agency_owner"
  ON public.resenas
  FOR UPDATE
  TO authenticated
  USING (
    vendedor_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.agencia_miembros am
      JOIN public.agencias a ON a.id = am.agencia_id
      WHERE am.user_id = resenas.vendedor_id
        AND am.estado = 'activo'
        AND a.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    vendedor_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.agencia_miembros am
      JOIN public.agencias a ON a.id = am.agencia_id
      WHERE am.user_id = resenas.vendedor_id
        AND am.estado = 'activo'
        AND a.owner_id = auth.uid()
    )
  );

-- 4. Motor automático de nivel de confianza e insignias verificables
CREATE OR REPLACE FUNCTION public.recalcular_reputacion_perfil(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_verificado boolean := false;
  v_activas integer := 0;
  v_vendidas integer := 0;
  v_total_pubs integer := 0;
  v_publico_reciente boolean := false;
  v_num_resenas integer := 0;
  v_promedio numeric := 0;
  v_visitas_ok integer := 0;
  v_badges text[] := ARRAY[]::text[];
  v_puntos integer := 0;
  v_nivel smallint := 0;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  SELECT COALESCE(p.verificado, false)
    INTO v_verificado
  FROM public.perfiles p
  WHERE p.id = p_user_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE i.activo AND NOT COALESCE(i.vendido, false) AND COALESCE(i.estado_moderacion, 'aprobado') = 'aprobado'),
    COUNT(*) FILTER (WHERE COALESCE(i.vendido, false)),
    COUNT(*),
    BOOL_OR(i.creado_en >= now() - interval '14 days')
  INTO v_activas, v_vendidas, v_total_pubs, v_publico_reciente
  FROM public.inmuebles i
  WHERE i.usuario_id = p_user_id OR i.agente_asignado_id = p_user_id;

  SELECT COUNT(*), COALESCE(AVG(r.puntuacion), 0)
    INTO v_num_resenas, v_promedio
  FROM public.resenas r
  WHERE r.vendedor_id = p_user_id;

  SELECT COUNT(*)
    INTO v_visitas_ok
  FROM public.solicitudes_visita sv
  WHERE (sv.agente_id = p_user_id OR sv.propietario_id = p_user_id)
    AND sv.estado IN ('confirmada', 'atendida');

  IF COALESCE(v_publico_reciente, false) OR v_activas > 0 THEN
    v_badges := array_append(v_badges, 'vendedor_activo');
  END IF;

  IF v_visitas_ok >= 3 THEN
    v_badges := array_append(v_badges, 'atencion_visitas');
  END IF;

  IF v_vendidas >= 50 THEN
    v_badges := array_append(v_badges, '50_ventas');
  ELSIF v_vendidas >= 20 THEN
    v_badges := array_append(v_badges, '20_ventas');
  ELSIF v_vendidas >= 10 THEN
    v_badges := array_append(v_badges, '10_ventas');
  END IF;

  IF v_total_pubs >= 100 THEN
    v_badges := array_append(v_badges, '100_publicaciones');
  ELSIF v_total_pubs >= 50 THEN
    v_badges := array_append(v_badges, '50_publicaciones');
  ELSIF v_total_pubs >= 20 THEN
    v_badges := array_append(v_badges, '20_publicaciones');
  END IF;

  IF v_num_resenas >= 10 AND v_promedio >= 4.5 THEN
    v_badges := array_append(v_badges, 'top_vendedor');
  ELSIF v_num_resenas >= 3 AND v_promedio >= 4.0 THEN
    v_badges := array_append(v_badges, 'buena_reputacion');
  END IF;

  -- Cálculo determinista de nivel (0..5)
  IF v_verificado THEN v_puntos := v_puntos + 2; END IF;
  IF v_activas >= 1 OR v_vendidas >= 1 THEN v_puntos := v_puntos + 1; END IF;
  IF v_vendidas >= 5 OR v_visitas_ok >= 3 THEN v_puntos := v_puntos + 1; END IF;
  IF v_num_resenas >= 3 AND v_promedio >= 4.0 THEN v_puntos := v_puntos + 1; END IF;
  IF v_num_resenas >= 8 AND v_promedio >= 4.5 THEN v_puntos := v_puntos + 1; END IF;

  v_nivel := LEAST(5, GREATEST(0, v_puntos))::smallint;

  UPDATE public.perfiles
     SET nivel_confianza = v_nivel,
         badges_automaticos = to_jsonb(v_badges)
   WHERE id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_fn_recalcular_reputacion_resenas()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalcular_reputacion_perfil(OLD.vendedor_id);
    RETURN OLD;
  ELSE
    PERFORM public.recalcular_reputacion_perfil(NEW.vendedor_id);
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_resenas_recalcular_reputacion ON public.resenas;
CREATE TRIGGER trg_resenas_recalcular_reputacion
  AFTER INSERT OR DELETE ON public.resenas
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_recalcular_reputacion_resenas();

CREATE OR REPLACE FUNCTION public.trg_fn_recalcular_reputacion_visitas()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.recalcular_reputacion_perfil(COALESCE(NEW.agente_id, NEW.propietario_id));
  IF NEW.agente_id IS NOT NULL AND NEW.propietario_id IS NOT NULL AND NEW.agente_id <> NEW.propietario_id THEN
    PERFORM public.recalcular_reputacion_perfil(NEW.propietario_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_visitas_recalcular_reputacion ON public.solicitudes_visita;
CREATE TRIGGER trg_visitas_recalcular_reputacion
  AFTER INSERT OR UPDATE OF estado ON public.solicitudes_visita
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_recalcular_reputacion_visitas();

-- 5. Ampliar `vw_perfiles_publicos` conservando el orden exacto de las 27 columnas previas
CREATE OR REPLACE VIEW public.vw_perfiles_publicos AS
SELECT
  p.id,
  p.nombre,
  CASE
    WHEN p.id = auth.uid() OR is_admin() OR (
      EXISTS (
        SELECT 1
        FROM public.inmuebles i
        WHERE (i.usuario_id = p.id OR i.agente_asignado_id = p.id)
          AND i.activo
          AND NOT i.vendido
          AND i.estado_moderacion = 'aprobado'::text
          AND telefono_visible_anuncio(i.metodos_contacto)
      )
    ) THEN p.telefono
    ELSE NULL::text
  END AS telefono,
  p.estado,
  p.ciudad,
  p.foto_perfil_url,
  p.email_visible AS email_disponible,
  CASE
    WHEN p.email_visible THEN p.email
    ELSE NULL::text
  END AS email_publico,
  p.telefono IS NOT NULL AND btrim(p.telefono) <> ''::text AND (
    p.id = auth.uid() OR is_admin() OR (
      EXISTS (
        SELECT 1
        FROM public.inmuebles i
        WHERE (i.usuario_id = p.id OR i.agente_asignado_id = p.id)
          AND i.activo
          AND NOT i.vendido
          AND i.estado_moderacion = 'aprobado'::text
          AND telefono_visible_anuncio(i.metodos_contacto)
      )
    )
  ) AS telefono_disponible,
  p.whatsapp_disponible,
  p.verificado,
  p.verificado_desde,
  p.nivel_confianza,
  p.badges_automaticos,
  p.ultima_actividad,
  p.creado_en,
  p.tipo_cuenta,
  p.empresa_nombre,
  p.descripcion_agente,
  p.logo_url,
  (
    SELECT count(*)::integer
    FROM public.inmuebles i
    WHERE (i.usuario_id = p.id OR i.agente_asignado_id = p.id)
      AND i.vendido
  ) AS total_vendidas,
  GREATEST(0::numeric, floor(EXTRACT(epoch FROM now() - p.creado_en) / 86400::numeric))::integer AS antiguedad_dias,
  p.slug,
  ag_ctx.agencia_id AS miembro_agencia_id,
  ag_ctx.agencia_nombre AS miembro_agencia_nombre,
  ag_ctx.agencia_slug AS miembro_agencia_slug,
  ag_ctx.agencia_owner_id AS miembro_agencia_owner_id,
  -- Nuevas columnas Etapa C (añadidas al final para compatibilidad 100%)
  p.licencia_corredor,
  p.horario_atencion,
  p.idiomas,
  p.zonas_especialidad,
  p.redes_sociales,
  p.anos_experiencia,
  (
    SELECT count(*)::integer
    FROM public.inmuebles i
    WHERE (
      i.usuario_id = p.id
      OR i.agente_asignado_id = p.id
      OR (ag_ctx.agencia_id IS NOT NULL AND ag_ctx.agencia_owner_id = p.id AND i.agencia_id = ag_ctx.agencia_id)
    )
      AND i.activo
      AND NOT i.vendido
      AND i.estado_moderacion = 'aprobado'::text
  ) AS propiedades_activas,
  COALESCE(rev_stats.num_resenas, 0)::integer AS num_resenas,
  COALESCE(rev_stats.promedio_resenas, 0)::numeric(3,2) AS promedio_resenas,
  (
    SELECT count(*)::integer
    FROM public.solicitudes_visita sv
    WHERE (
      sv.agente_id = p.id
      OR sv.propietario_id = p.id
      OR (ag_ctx.agencia_id IS NOT NULL AND ag_ctx.agencia_owner_id = p.id AND sv.agencia_id = ag_ctx.agencia_id)
    )
      AND sv.estado IN ('confirmada', 'atendida')
  ) AS visitas_atendidas
FROM public.perfiles p
LEFT JOIN LATERAL (
  SELECT
    a.id AS agencia_id,
    a.nombre AS agencia_nombre,
    po.slug AS agencia_slug,
    a.owner_id AS agencia_owner_id
  FROM public.agencia_miembros am
  JOIN public.agencias a ON a.id = am.agencia_id
  JOIN public.perfiles po ON po.id = a.owner_id
  WHERE am.user_id = p.id
    AND am.estado = 'activo'::text
  LIMIT 1
) ag_ctx ON true
LEFT JOIN LATERAL (
  SELECT
    count(*)::integer AS num_resenas,
    round(avg(r.puntuacion)::numeric, 2) AS promedio_resenas
  FROM public.resenas r
  WHERE r.vendedor_id = p.id
) rev_stats ON true
WHERE p.verificado
   OR ag_ctx.agencia_id IS NOT NULL
   OR (
     EXISTS (
       SELECT 1
       FROM public.inmuebles i
       WHERE (i.usuario_id = p.id OR i.agente_asignado_id = p.id)
         AND i.activo
         AND NOT i.vendido
         AND i.estado_moderacion = 'aprobado'::text
     )
   );

GRANT SELECT ON public.vw_perfiles_publicos TO anon, authenticated;

-- Sincronización inicial de reputación para perfiles con actividad o verificación
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.id
    FROM public.perfiles p
    WHERE p.verificado
       OR EXISTS (SELECT 1 FROM public.inmuebles i WHERE i.usuario_id = p.id OR i.agente_asignado_id = p.id)
       OR EXISTS (SELECT 1 FROM public.resenas re WHERE re.vendedor_id = p.id)
  LOOP
    PERFORM public.recalcular_reputacion_perfil(r.id);
  END LOOP;
END $$;
