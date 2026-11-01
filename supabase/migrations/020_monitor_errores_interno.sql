-- =============================================================================
-- Migración 020: Monitor interno de errores (sin Sentry, seguro y deduplicado)
-- -----------------------------------------------------------------------------
-- Diseño de seguridad y eficiencia:
--   1. Agrupación atómica por `huella` (SHA-256): si un mismo fallo ocurre
--      1.000 veces solo ocupa 1 fila, incrementando `ocurrencias` y guardando
--      únicamente las últimas 5 muestras (`muestras` JSONB).
--   2. Detección automática de regresiones: si un error `resuelto` vuelve a
--      ocurrir, pasa automáticamente a `reabierto`. Si está `ignorado`, no
--      vuelve a generar ruido en la bandeja activa.
--   3. RLS estricto: ningún acceso directo para `anon` ni `authenticated`.
--      Solo `service_role` escribe/lee a través de rutas validadas.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.errores_sistema (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_ref text NOT NULL,
  huella text NOT NULL UNIQUE,
  origen text NOT NULL CHECK (origen IN ('cliente', 'servidor', 'api', 'red', 'react_boundary')),
  severidad text NOT NULL DEFAULT 'error' CHECK (severidad IN ('critico', 'error', 'aviso')),
  estado text NOT NULL DEFAULT 'nuevo' CHECK (estado IN ('nuevo', 'en_revision', 'resuelto', 'ignorado', 'reabierto')),
  nombre text NOT NULL,
  mensaje text NOT NULL,
  codigo_error text,
  ruta text NOT NULL DEFAULT '/',
  endpoint text,
  accion_previa text,
  stack text,
  ocurrencias integer NOT NULL DEFAULT 1 CHECK (ocurrencias >= 1),
  usuarios_afectados uuid[] NOT NULL DEFAULT '{}',
  ultimo_user_id uuid REFERENCES public.perfiles(id) ON DELETE SET NULL,
  dispositivo text,
  navegador text,
  pais text,
  muestras jsonb NOT NULL DEFAULT '[]'::jsonb,
  nota_admin text,
  primera_vez_en timestamptz NOT NULL DEFAULT now(),
  ultima_vez_en timestamptz NOT NULL DEFAULT now(),
  resuelto_en timestamptz
);

CREATE INDEX IF NOT EXISTS idx_errores_sistema_estado_ultima
  ON public.errores_sistema (estado, ultima_vez_en DESC);

CREATE INDEX IF NOT EXISTS idx_errores_sistema_ultima
  ON public.errores_sistema (ultima_vez_en DESC);

CREATE INDEX IF NOT EXISTS idx_errores_sistema_codigo_ref
  ON public.errores_sistema (codigo_ref);

ALTER TABLE public.errores_sistema ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.errores_sistema FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.errores_sistema TO service_role;

-- Registro atómico y deduplicado por huella
CREATE OR REPLACE FUNCTION public.registrar_error_sistema(
  p_huella text,
  p_codigo_ref text,
  p_origen text,
  p_severidad text,
  p_nombre text,
  p_mensaje text,
  p_codigo_error text DEFAULT NULL,
  p_ruta text DEFAULT '/',
  p_endpoint text DEFAULT NULL,
  p_accion_previa text DEFAULT NULL,
  p_stack text DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_dispositivo text DEFAULT NULL,
  p_navegador text DEFAULT NULL,
  p_pais text DEFAULT NULL,
  p_muestra jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_origen text := lower(btrim(coalesce(p_origen, 'cliente')));
  v_severidad text := lower(btrim(coalesce(p_severidad, 'error')));
  v_huella text := btrim(coalesce(p_huella, ''));
  v_codigo_ref text := btrim(coalesce(p_codigo_ref, 'ERR-000000'));
  v_nombre text := left(coalesce(nullif(btrim(p_nombre), ''), 'Error'), 120);
  v_mensaje text := left(coalesce(nullif(btrim(p_mensaje), ''), 'Error sin mensaje'), 600);
  v_codigo_error text := left(nullif(btrim(coalesce(p_codigo_error, '')), ''), 120);
  v_ruta text := left(coalesce(nullif(btrim(p_ruta), ''), '/'), 300);
  v_endpoint text := left(nullif(btrim(coalesce(p_endpoint, '')), ''), 300);
  v_accion text := left(nullif(btrim(coalesce(p_accion_previa, '')), ''), 240);
  v_stack text := left(nullif(btrim(coalesce(p_stack, '')), ''), 3000);
  v_dispositivo text := left(nullif(btrim(coalesce(p_dispositivo, '')), ''), 40);
  v_navegador text := left(nullif(btrim(coalesce(p_navegador, '')), ''), 60);
  v_pais text := left(nullif(btrim(coalesce(p_pais, '')), ''), 8);
  v_user_valido uuid := NULL;
  v_muestra jsonb;
  v_fila record;
BEGIN
  IF v_huella = '' OR length(v_huella) > 128 THEN
    RAISE EXCEPTION 'Huella de error inválida' USING ERRCODE = '22023';
  END IF;

  IF v_origen NOT IN ('cliente', 'servidor', 'api', 'red', 'react_boundary') THEN
    v_origen := 'cliente';
  END IF;

  IF v_severidad NOT IN ('critico', 'error', 'aviso') THEN
    v_severidad := 'error';
  END IF;

  IF p_user_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.perfiles WHERE id = p_user_id) THEN
      v_user_valido := p_user_id;
    END IF;
  END IF;

  v_muestra := coalesce(
    p_muestra,
    jsonb_build_object(
      'fecha', now(),
      'ruta', v_ruta,
      'endpoint', v_endpoint,
      'accion_previa', v_accion,
      'user_id', v_user_valido,
      'dispositivo', v_dispositivo,
      'navegador', v_navegador,
      'pais', v_pais
    )
  );

  INSERT INTO public.errores_sistema AS e (
    codigo_ref,
    huella,
    origen,
    severidad,
    estado,
    nombre,
    mensaje,
    codigo_error,
    ruta,
    endpoint,
    accion_previa,
    stack,
    ocurrencias,
    usuarios_afectados,
    ultimo_user_id,
    dispositivo,
    navegador,
    pais,
    muestras,
    primera_vez_en,
    ultima_vez_en
  ) VALUES (
    left(v_codigo_ref, 24),
    v_huella,
    v_origen,
    v_severidad,
    'nuevo',
    v_nombre,
    v_mensaje,
    v_codigo_error,
    v_ruta,
    v_endpoint,
    v_accion,
    v_stack,
    1,
    CASE WHEN v_user_valido IS NOT NULL THEN ARRAY[v_user_valido] ELSE '{}'::uuid[] END,
    v_user_valido,
    v_dispositivo,
    v_navegador,
    v_pais,
    jsonb_build_array(v_muestra),
    now(),
    now()
  )
  ON CONFLICT (huella) DO UPDATE
     SET ocurrencias = e.ocurrencias + 1,
         ultima_vez_en = now(),
         estado = CASE
           WHEN e.estado = 'resuelto' THEN 'reabierto'
           ELSE e.estado
         END,
         resuelto_en = CASE
           WHEN e.estado = 'resuelto' THEN NULL
           ELSE e.resuelto_en
         END,
         severidad = CASE
           WHEN EXCLUDED.severidad = 'critico' OR e.severidad = 'critico' THEN 'critico'
           WHEN EXCLUDED.severidad = 'error' OR e.severidad = 'error' THEN 'error'
           ELSE 'aviso'
         END,
         codigo_error = coalesce(EXCLUDED.codigo_error, e.codigo_error),
         ruta = EXCLUDED.ruta,
         endpoint = coalesce(EXCLUDED.endpoint, e.endpoint),
         accion_previa = coalesce(EXCLUDED.accion_previa, e.accion_previa),
         stack = coalesce(EXCLUDED.stack, e.stack),
         ultimo_user_id = coalesce(v_user_valido, e.ultimo_user_id),
         dispositivo = coalesce(EXCLUDED.dispositivo, e.dispositivo),
         navegador = coalesce(EXCLUDED.navegador, e.navegador),
         pais = coalesce(EXCLUDED.pais, e.pais),
         usuarios_afectados = CASE
           WHEN v_user_valido IS NOT NULL
                AND NOT (v_user_valido = ANY(e.usuarios_afectados))
                AND coalesce(array_length(e.usuarios_afectados, 1), 0) < 25
             THEN array_append(e.usuarios_afectados, v_user_valido)
           ELSE e.usuarios_afectados
         END,
         muestras = (
           SELECT coalesce(jsonb_agg(elem), '[]'::jsonb)
           FROM (
             SELECT elem
             FROM jsonb_array_elements(jsonb_build_array(v_muestra) || coalesce(e.muestras, '[]'::jsonb)) WITH ORDINALITY AS t(elem, ord)
             ORDER BY ord
             LIMIT 5
           ) sub
         )
  RETURNING id, codigo_ref, estado, ocurrencias INTO v_fila;

  -- Autopoda ligera (1% de ejecuciones): elimina resueltos/ignorados de > 60 días
  IF random() < 0.01 THEN
    DELETE FROM public.errores_sistema
     WHERE estado IN ('resuelto', 'ignorado')
       AND ultima_vez_en < now() - interval '60 days';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'id', v_fila.id,
    'codigo_ref', v_fila.codigo_ref,
    'estado', v_fila.estado,
    'ocurrencias', v_fila.ocurrencias
  );
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_error_sistema(
  text, text, text, text, text, text, text, text, text, text, text, uuid, text, text, text, jsonb
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_error_sistema(
  text, text, text, text, text, text, text, text, text, text, text, uuid, text, text, text, jsonb
) TO service_role;

-- Limpieza manual o programada de errores resueltos/ignorados antiguos
CREATE OR REPLACE FUNCTION public.limpiar_errores_antiguos(p_dias integer DEFAULT 30)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_dias integer := greatest(1, least(coalesce(p_dias, 30), 365));
  v_eliminados integer := 0;
BEGIN
  WITH borrados AS (
    DELETE FROM public.errores_sistema
     WHERE estado IN ('resuelto', 'ignorado')
       AND ultima_vez_en < now() - make_interval(days => v_dias)
    RETURNING 1
  )
  SELECT count(*) INTO v_eliminados FROM borrados;

  RETURN v_eliminados;
END;
$$;

REVOKE ALL ON FUNCTION public.limpiar_errores_antiguos(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.limpiar_errores_antiguos(integer) TO service_role;
