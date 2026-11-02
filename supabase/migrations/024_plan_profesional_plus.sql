-- ============================================================================
-- 024_plan_profesional_plus.sql
-- Nuevo Plan «Profesional Plus» ($19,99/mes · 35 anuncios activos · 30 fotos ·
-- 12 créditos mensuales · 1 usuario individual sin multiagente)
--
-- 1. Amplía los CHECK constraints `suscripciones_plan_check` y
--    `ordenes_pago_concepto_check` para admitir `'profesional_plus'`.
-- 2. Define funciones auxiliares inmutables:
--    - `nivel_plan_suscripcion(text)` (`gratuita`=0, `profesional`=1,
--      `profesional_plus`=2, `agencia`=3)
--    - `tipo_cuenta_para_plan(text)` (`profesional_plus` -> `'profesional'`)
--    - `creditos_incluidos_por_plan(text)` (`profesional_plus` -> `12`)
-- 3. Actualiza triggers de cupo (`exigir_cupo_inmueble` = 35,
--    `exigir_cupo_imagen` = 30), registro (`handle_new_auth_user`),
--    cambio durante prueba (`cambiar_plan_prueba`), pagos (`otorgar_orden_pago`,
--    `revisar_orden_pago`) y administración (`admin_cambiar_plan`,
--    `admin_gestionar_plan`), sin auto-provisionar `agencias` en `profesional_plus`.
-- ============================================================================

BEGIN;

-- 1. Ampliar CHECK constraints en `suscripciones` y `ordenes_pago`
ALTER TABLE public.suscripciones
  DROP CONSTRAINT IF EXISTS suscripciones_plan_check;

ALTER TABLE public.suscripciones
  ADD CONSTRAINT suscripciones_plan_check
  CHECK (plan = ANY (ARRAY[
    'personal'::text,
    'agente'::text,
    'inmobiliaria'::text,
    'premium'::text,
    'gratuita'::text,
    'profesional'::text,
    'profesional_plus'::text,
    'agencia'::text
  ]));

DO $$
BEGIN
  IF to_regclass('public.ordenes_pago') IS NOT NULL THEN
    ALTER TABLE public.ordenes_pago
      DROP CONSTRAINT IF EXISTS ordenes_pago_concepto_check;
    ALTER TABLE public.ordenes_pago
      ADD CONSTRAINT ordenes_pago_concepto_check
      CHECK (concepto = ANY (ARRAY[
        'creditos'::text,
        'profesional'::text,
        'profesional_plus'::text,
        'agencia'::text
      ]));
  END IF;
END $$;

-- 2. Funciones auxiliares puras de jerarquía, tipo de cuenta y bolsa de créditos
CREATE OR REPLACE FUNCTION public.nivel_plan_suscripcion(p_plan text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public
AS $$
  SELECT CASE lower(btrim(coalesce(p_plan, '')))
    WHEN 'agencia' THEN 3
    WHEN 'profesional_plus' THEN 2
    WHEN 'profesional' THEN 1
    ELSE 0
  END;
$$;

CREATE OR REPLACE FUNCTION public.tipo_cuenta_para_plan(p_plan text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public
AS $$
  SELECT CASE lower(btrim(coalesce(p_plan, '')))
    WHEN 'agencia' THEN 'agencia'
    WHEN 'profesional_plus' THEN 'profesional'
    WHEN 'profesional' THEN 'profesional'
    ELSE 'particular'
  END;
$$;

CREATE OR REPLACE FUNCTION public.creditos_incluidos_por_plan(p_plan text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public
AS $$
  SELECT CASE lower(btrim(coalesce(p_plan, '')))
    WHEN 'agencia' THEN 20
    WHEN 'profesional_plus' THEN 12
    WHEN 'profesional' THEN 5
    ELSE 0
  END;
$$;

GRANT EXECUTE ON FUNCTION public.nivel_plan_suscripcion(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tipo_cuenta_para_plan(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.creditos_incluidos_por_plan(text) TO anon, authenticated, service_role;

-- 3. Cuota de publicaciones activas (3 / 10 / 35 / ∞) y fotos por inmueble (8 / 20 / 30 / 30)
CREATE OR REPLACE FUNCTION public.exigir_cupo_inmueble()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
  v_plan text;
  v_max integer;
  v_count bigint;
BEGIN
  IF NEW.activo IS NOT TRUE THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.activo IS TRUE AND OLD.usuario_id IS NOT DISTINCT FROM NEW.usuario_id THEN
      RETURN NEW;
    END IF;
  END IF;

  PERFORM 1 FROM public.perfiles WHERE id = NEW.usuario_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cuenta no encontrada' USING ERRCODE = '23503';
  END IF;

  v_plan := public.plan_efectivo_publicacion(NEW.usuario_id);
  v_max := CASE v_plan
    WHEN 'agencia' THEN 999999
    WHEN 'profesional_plus' THEN 35
    WHEN 'profesional' THEN 10
    ELSE 3
  END;

  SELECT count(*) INTO v_count
    FROM public.inmuebles
   WHERE usuario_id = NEW.usuario_id
     AND activo IS TRUE
     AND id IS DISTINCT FROM NEW.id;

  IF v_count >= v_max THEN
    RAISE EXCEPTION 'Límite de publicaciones alcanzado para el plan %', v_plan
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.exigir_cupo_imagen()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
  v_user uuid;
  v_plan text;
  v_max integer;
  v_count bigint;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.inmueble_id IS NOT DISTINCT FROM NEW.inmueble_id THEN
      RETURN NEW;
    END IF;
  END IF;

  SELECT usuario_id INTO v_user
    FROM public.inmuebles
   WHERE id = NEW.inmueble_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inmueble no encontrado' USING ERRCODE = '23503';
  END IF;

  PERFORM 1 FROM public.perfiles WHERE id = v_user FOR UPDATE;
  v_plan := public.plan_efectivo_publicacion(v_user);
  v_max := CASE v_plan
    WHEN 'agencia' THEN 30
    WHEN 'profesional_plus' THEN 30
    WHEN 'profesional' THEN 20
    ELSE 8
  END;

  SELECT count(*) INTO v_count
    FROM public.inmueble_imagenes
   WHERE inmueble_id = NEW.inmueble_id
     AND id IS DISTINCT FROM NEW.id;

  IF v_count >= v_max THEN
    RAISE EXCEPTION 'Límite de fotos alcanzado para el plan %', v_plan
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

-- 4. Cambio gratuito de plan durante los 30 días de prueba
CREATE OR REPLACE FUNCTION public.cambiar_plan_prueba(p_user uuid, p_plan text)
RETURNS timestamp with time zone
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  s public.suscripciones%ROWTYPE;
BEGIN
  IF p_plan IS NULL OR p_plan NOT IN ('gratuita', 'profesional', 'profesional_plus', 'agencia') THEN
    RAISE EXCEPTION 'Plan inválido';
  END IF;

  PERFORM 1 FROM public.perfiles WHERE id = p_user FOR UPDATE;

  SELECT * INTO s
    FROM public.suscripciones
   WHERE user_id = p_user
     AND estado IN ('activa', 'trial')
     AND inicio <= now()
     AND (fin IS NULL OR fin > now())
   ORDER BY created_at DESC
   LIMIT 1
   FOR UPDATE;

  IF s.id IS NULL OR s.estado <> 'trial' OR s.trial_ends_at IS NULL OR s.trial_ends_at <= now() THEN
    RAISE EXCEPTION 'La prueba gratuita ya no está activa. Actualiza la página para ver las opciones disponibles.';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.suscripciones
     WHERE user_id = p_user
       AND estado IN ('activa', 'trial')
       AND inicio > now()
  ) THEN
    RAISE EXCEPTION 'Ya hay un cambio pagado programado. Revisa tus pagos antes de cambiar la prueba.';
  END IF;

  UPDATE public.suscripciones
     SET plan = p_plan,
         cambio_gratuita = false,
         creditos_incluidos = public.creditos_incluidos_por_plan(p_plan)
   WHERE id = s.id;

  UPDATE public.perfiles
     SET tipo_cuenta = public.tipo_cuenta_para_plan(p_plan)
   WHERE id = p_user;

  RETURN s.trial_ends_at;
END;
$$;

-- 5. Otorgamiento y revisión de órdenes de pago (`profesional`, `profesional_plus`, `agencia`)
DO $outer$
BEGIN
  IF to_regclass('public.ordenes_pago') IS NOT NULL THEN
    EXECUTE $fn1$
      CREATE OR REPLACE FUNCTION public.otorgar_orden_pago(p_id uuid)
      RETURNS void
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path TO 'public'
      AS $body$
      DECLARE
        o public.ordenes_pago%ROWTYPE;
        sid uuid;
        n integer;
        current_sub public.suscripciones%ROWTYPE;
        starts timestamptz := now();
      BEGIN
        SELECT * INTO STRICT o FROM ordenes_pago WHERE id = p_id FOR UPDATE;
        PERFORM 1 FROM perfiles WHERE id = o.user_id FOR UPDATE;
        IF o.otorgada_en IS NOT NULL THEN
          RETURN;
        END IF;

        IF o.concepto = 'creditos' THEN
          UPDATE perfiles SET credito_balance = credito_balance + o.creditos WHERE id = o.user_id;
          INSERT INTO transacciones_creditos(user_id, tipo, monto, precio_usd, metodo_pago, estado, motivo_registro)
          VALUES (o.user_id, 'compra', o.creditos, o.precio_usd, o.metodo, 'aprobado', 'Orden provisional ' || o.id);
          UPDATE ordenes_pago SET creditos_otorgados = o.creditos WHERE id = o.id;
        ELSE
          IF EXISTS (
            SELECT 1 FROM suscripciones
             WHERE user_id = o.user_id
               AND estado = 'trial'
               AND inicio <= now()
               AND trial_ends_at > now()
               AND (fin IS NULL OR fin > now())
          ) THEN
            RAISE EXCEPTION 'Tu prueba sigue activa: cambia de plan gratis desde Planes, sin realizar un pago.';
          END IF;

          SELECT * INTO current_sub
            FROM suscripciones
           WHERE user_id = o.user_id
             AND estado IN ('activa', 'trial')
             AND inicio <= now()
             AND (fin IS NULL OR fin > now())
           ORDER BY created_at DESC
           LIMIT 1;

          IF current_sub.id IS NOT NULL
             AND public.nivel_plan_suscripcion(o.concepto) <= public.nivel_plan_suscripcion(current_sub.plan) THEN
            IF current_sub.fin IS NULL THEN
              RAISE EXCEPTION 'El plan actual no tiene fecha de fin: requiere revisión administrativa';
            END IF;
            starts := current_sub.fin;
          END IF;

          IF EXISTS (
            SELECT 1 FROM suscripciones
             WHERE user_id = o.user_id
               AND estado IN ('activa', 'trial')
               AND inicio > now()
          ) THEN
            RAISE EXCEPTION 'Ya tienes un cambio de plan pagado programado';
          END IF;

          IF starts > now() THEN
            UPDATE suscripciones SET cambio_gratuita = false WHERE id = current_sub.id;
          END IF;

          IF starts = now() THEN
            SELECT coalesce(array_agg(id), '{}') INTO o.previas
              FROM suscripciones
             WHERE user_id = o.user_id
               AND estado IN ('activa', 'trial');
            UPDATE suscripciones SET estado = 'cancelada' WHERE id = ANY(o.previas);
          END IF;

          n := public.creditos_incluidos_por_plan(o.concepto);

          INSERT INTO suscripciones(
            user_id, plan, estado, inicio, fin,
            creditos_incluidos, creditos_usados_mes, proxima_renovacion_creditos
          )
          VALUES (
            o.user_id, o.concepto, 'activa', starts, starts + interval '30 days',
            n, 0, starts + interval '30 days'
          )
          RETURNING id INTO sid;

          IF starts = now() THEN
            UPDATE perfiles
               SET tipo_cuenta = public.tipo_cuenta_para_plan(o.concepto)
             WHERE id = o.user_id;
          END IF;

          UPDATE ordenes_pago SET suscripcion_id = sid, previas = o.previas WHERE id = o.id;
        END IF;

        UPDATE ordenes_pago SET otorgada_en = now() WHERE id = o.id;
      END;
      $body$;
    $fn1$;

    EXECUTE $fn2$
      CREATE OR REPLACE FUNCTION public.revisar_orden_pago(
        p_id uuid,
        p_admin uuid,
        p_confirmar boolean,
        p_nota text
      )
      RETURNS text
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path TO 'public'
      AS $body$
      DECLARE
        o public.ordenes_pago%ROWTYPE;
        recovered integer;
        tipo text;
      BEGIN
        SELECT * INTO STRICT o FROM ordenes_pago WHERE id = p_id FOR UPDATE;
        PERFORM 1 FROM perfiles WHERE id = o.user_id FOR UPDATE;
        IF o.estado IN ('confirmada', 'rechazada') THEN
          RETURN o.estado;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM intentos_pago WHERE orden_id = o.id) THEN
          RAISE EXCEPTION 'No hay justificante';
        END IF;

        IF p_confirmar THEN
          IF o.estado = 'bloqueada' THEN
            RAISE EXCEPTION 'Referencia duplicada: solicita un nuevo justificante';
          END IF;
          PERFORM otorgar_orden_pago(o.id);
        ELSE
          IF length(trim(coalesce(p_nota, ''))) < 5 THEN
            RAISE EXCEPTION 'Indica el motivo del rechazo';
          END IF;
          IF o.otorgada_en IS NOT NULL THEN
            IF o.concepto = 'creditos' THEN
              SELECT least(credito_balance, o.creditos_otorgados)::integer INTO recovered
                FROM perfiles WHERE id = o.user_id;
              UPDATE perfiles SET credito_balance = credito_balance - recovered WHERE id = o.user_id;
              UPDATE ordenes_pago SET creditos_no_recuperados = o.creditos_otorgados - recovered WHERE id = o.id;
              UPDATE transacciones_creditos
                 SET estado = 'reembolsado',
                     motivo_registro = 'Revocada orden ' || o.id || ': ' || p_nota
               WHERE motivo_registro = 'Orden provisional ' || o.id;
            ELSE
              UPDATE suscripciones SET estado = 'cancelada' WHERE id = o.suscripcion_id;
              IF NOT EXISTS (
                SELECT 1 FROM suscripciones
                 WHERE user_id = o.user_id
                   AND estado IN ('activa', 'trial')
                   AND id <> o.suscripcion_id
                   AND (fin IS NULL OR fin > now())
              ) THEN
                UPDATE suscripciones
                   SET estado = CASE WHEN trial_ends_at > now() THEN 'trial' ELSE 'activa' END
                 WHERE id = ANY(o.previas)
                   AND fin > now();
                SELECT plan INTO tipo
                  FROM suscripciones
                 WHERE user_id = o.user_id
                   AND estado IN ('activa', 'trial')
                   AND (fin IS NULL OR fin > now())
                 ORDER BY created_at DESC
                 LIMIT 1;
                UPDATE perfiles
                   SET tipo_cuenta = public.tipo_cuenta_para_plan(tipo)
                 WHERE id = o.user_id;
              END IF;
            END IF;
          END IF;
        END IF;

        UPDATE ordenes_pago
           SET estado = CASE WHEN p_confirmar THEN 'confirmada' ELSE 'rechazada' END,
               revisada_en = now(),
               revisada_por = p_admin,
               nota_revision = left(p_nota, 1000)
         WHERE id = o.id;

        RETURN CASE WHEN p_confirmar THEN 'confirmada' ELSE 'rechazada' END;
      END;
      $body$;
    $fn2$;
  END IF;
END $outer$;

-- 6. Gestión manual de planes y tiempo extra desde Administración
CREATE OR REPLACE FUNCTION public.admin_gestionar_plan(
  p_user_id uuid,
  p_admin_id uuid,
  p_operacion text,
  p_plan text DEFAULT NULL,
  p_modo text DEFAULT NULL,
  p_dias integer DEFAULT 30,
  p_creditos_incluidos integer DEFAULT NULL,
  p_motivo text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
  v_perfil record;
  v_perfil_json jsonb;
  v_actual record;
  v_resultado record;
  v_operacion text := lower(btrim(coalesce(p_operacion, '')));
  v_plan_param text := lower(btrim(coalesce(p_plan, '')));
  v_modo_param text := lower(btrim(coalesce(p_modo, '')));
  v_plan_final text;
  v_estado_final text;
  v_incluidos integer;
  v_fin_anterior timestamptz := NULL;
  v_base_fin timestamptz;
  v_fin_nuevo timestamptz;
  v_nombre_agencia text;
  v_agencia_id uuid;
  v_tiene_membresia boolean := false;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario requerido' USING ERRCODE = '22023';
  END IF;

  IF v_operacion NOT IN ('extender', 'asignar', 'cancelar') THEN
    RAISE EXCEPTION 'Operación inválida (usa: extender, asignar o cancelar)' USING ERRCODE = '22023';
  END IF;

  SELECT *
    INTO v_perfil
    FROM public.perfiles
   WHERE id = p_user_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuario no encontrado' USING ERRCODE = 'P0002';
  END IF;

  v_perfil_json := to_jsonb(v_perfil);

  IF v_operacion = 'cancelar' OR v_plan_param = 'gratuita' OR v_modo_param = 'cancelar' THEN
    UPDATE public.suscripciones
       SET estado = 'cancelada',
           fin = now(),
           updated_at = now()
     WHERE user_id = p_user_id
       AND estado IN ('activa', 'trial');

    UPDATE public.perfiles
       SET tipo_cuenta = 'particular'
     WHERE id = p_user_id;

    IF to_regclass('public.auditoria') IS NOT NULL THEN
      EXECUTE
        'INSERT INTO public.auditoria (usuario_id, tabla_afectada, operacion, registro_id, datos_anteriores, datos_nuevos)
         VALUES ($1, $2, $3, $4, $5, $6)'
      USING
        p_admin_id,
        'suscripciones',
        'UPDATE',
        p_user_id,
        jsonb_build_object('tipo_cuenta', v_perfil.tipo_cuenta),
        jsonb_build_object(
          'accion', 'cancelar_plan',
          'user_id', p_user_id,
          'plan', 'gratuita',
          'estado', 'cancelada',
          'motivo', nullif(btrim(coalesce(p_motivo, '')), '')
        );
    END IF;

    RETURN jsonb_build_object(
      'ok', true,
      'operacion', 'cancelar',
      'plan', 'gratuita',
      'estado', 'cancelada'
    );
  END IF;

  IF p_dias IS NULL OR p_dias < 1 OR p_dias > 730 THEN
    RAISE EXCEPTION 'La cantidad de días debe estar entre 1 y 730' USING ERRCODE = '22023';
  END IF;

  IF p_creditos_incluidos IS NOT NULL AND (p_creditos_incluidos < 0 OR p_creditos_incluidos > 1000) THEN
    RAISE EXCEPTION 'Los créditos incluidos deben estar entre 0 y 1000' USING ERRCODE = '22023';
  END IF;

  IF v_operacion = 'extender' THEN
    SELECT *
      INTO v_actual
      FROM public.suscripciones
     WHERE user_id = p_user_id
       AND estado IN ('activa', 'trial')
     ORDER BY (estado = 'activa') DESC, fin DESC NULLS LAST, created_at DESC
     LIMIT 1
     FOR UPDATE;

    IF v_plan_param <> '' THEN
      IF v_plan_param NOT IN ('profesional', 'profesional_plus', 'agencia') THEN
        RAISE EXCEPTION 'Plan inválido para extensión' USING ERRCODE = '22023';
      END IF;
      v_plan_final := v_plan_param;
    ELSIF v_actual.id IS NOT NULL AND v_actual.plan IN ('profesional', 'profesional_plus', 'agencia') THEN
      v_plan_final := v_actual.plan;
    ELSIF v_perfil.tipo_cuenta IN ('profesional', 'agencia') THEN
      v_plan_final := v_perfil.tipo_cuenta;
    ELSE
      v_plan_final := 'agencia';
    END IF;

    IF v_modo_param <> '' THEN
      IF v_modo_param NOT IN ('activa', 'trial') THEN
        RAISE EXCEPTION 'Modo inválido (usa: activa o trial)' USING ERRCODE = '22023';
      END IF;
      v_estado_final := v_modo_param;
    ELSIF v_actual.id IS NOT NULL AND v_actual.estado IN ('activa', 'trial') THEN
      v_estado_final := v_actual.estado;
    ELSE
      v_estado_final := 'trial';
    END IF;

    IF p_creditos_incluidos IS NOT NULL THEN
      v_incluidos := p_creditos_incluidos;
    ELSIF v_actual.id IS NOT NULL AND v_actual.plan = v_plan_final THEN
      v_incluidos := greatest(
        coalesce(v_actual.creditos_incluidos, 0),
        public.creditos_incluidos_por_plan(v_plan_final)
      );
    ELSE
      v_incluidos := public.creditos_incluidos_por_plan(v_plan_final);
    END IF;

    IF v_actual.id IS NOT NULL THEN
      v_fin_anterior := coalesce(v_actual.fin, v_actual.trial_ends_at);
      v_base_fin := greatest(coalesce(v_fin_anterior, now()), now());
      v_fin_nuevo := v_base_fin + make_interval(days => p_dias);

      UPDATE public.suscripciones
         SET plan = v_plan_final,
             estado = v_estado_final,
             fin = v_fin_nuevo,
             trial_ends_at = CASE WHEN v_estado_final = 'trial' THEN v_fin_nuevo ELSE trial_ends_at END,
             creditos_incluidos = v_incluidos,
             proxima_renovacion_creditos = CASE
               WHEN proxima_renovacion_creditos IS NULL OR proxima_renovacion_creditos <= now()
                 THEN least(v_fin_nuevo, now() + interval '30 days')
               ELSE proxima_renovacion_creditos
             END,
             cambio_gratuita = false,
             updated_at = now()
       WHERE id = v_actual.id
      RETURNING id, plan, estado, fin, trial_ends_at, creditos_incluidos INTO v_resultado;

      UPDATE public.suscripciones
         SET estado = 'cancelada',
             fin = now(),
             updated_at = now()
       WHERE user_id = p_user_id
         AND id <> v_actual.id
         AND estado IN ('activa', 'trial');
    ELSE
      v_fin_anterior := NULL;
      v_fin_nuevo := now() + make_interval(days => p_dias);

      INSERT INTO public.suscripciones (
        user_id, plan, estado, inicio, fin, trial_ends_at,
        creditos_incluidos, creditos_usados_mes, proxima_renovacion_creditos
      ) VALUES (
        p_user_id,
        v_plan_final,
        v_estado_final,
        now(),
        v_fin_nuevo,
        CASE WHEN v_estado_final = 'trial' THEN v_fin_nuevo ELSE NULL END,
        v_incluidos,
        0,
        least(v_fin_nuevo, now() + interval '30 days')
      )
      RETURNING id, plan, estado, fin, trial_ends_at, creditos_incluidos INTO v_resultado;
    END IF;
  ELSE
    IF v_plan_param NOT IN ('profesional', 'profesional_plus', 'agencia') THEN
      RAISE EXCEPTION 'Plan inválido' USING ERRCODE = '22023';
    END IF;
    IF v_modo_param NOT IN ('activa', 'trial') THEN
      RAISE EXCEPTION 'Modo inválido' USING ERRCODE = '22023';
    END IF;

    v_plan_final := v_plan_param;
    v_estado_final := v_modo_param;
    v_fin_nuevo := now() + make_interval(days => p_dias);
    v_incluidos := coalesce(
      p_creditos_incluidos,
      public.creditos_incluidos_por_plan(v_plan_final)
    );

    UPDATE public.suscripciones
       SET estado = 'cancelada',
           fin = now(),
           updated_at = now()
     WHERE user_id = p_user_id
       AND estado IN ('activa', 'trial');

    INSERT INTO public.suscripciones (
      user_id, plan, estado, inicio, fin, trial_ends_at,
      creditos_incluidos, creditos_usados_mes, proxima_renovacion_creditos
    ) VALUES (
      p_user_id,
      v_plan_final,
      v_estado_final,
      now(),
      v_fin_nuevo,
      CASE WHEN v_estado_final = 'trial' THEN v_fin_nuevo ELSE NULL END,
      v_incluidos,
      0,
      least(v_fin_nuevo, now() + interval '30 days')
    )
    RETURNING id, plan, estado, fin, trial_ends_at, creditos_incluidos INTO v_resultado;
  END IF;

  UPDATE public.perfiles
     SET tipo_cuenta = public.tipo_cuenta_para_plan(v_plan_final)
   WHERE id = p_user_id;

  -- Solo `agencia` auto-aprovisiona entidad multiagente (`profesional_plus` es 1 usuario individual)
  IF v_plan_final = 'agencia'
     AND to_regclass('public.agencias') IS NOT NULL
     AND to_regclass('public.agencia_miembros') IS NOT NULL THEN
    EXECUTE
      'SELECT EXISTS (
         SELECT 1 FROM public.agencia_miembros
          WHERE user_id = $1 AND estado = ''activo''
       )'
    INTO v_tiene_membresia
    USING p_user_id;

    IF NOT v_tiene_membresia THEN
      v_nombre_agencia := coalesce(
        nullif(btrim(coalesce(v_perfil_json ->> 'empresa_nombre', '')), ''),
        nullif(btrim(coalesce(v_perfil_json ->> 'nombre', '')), ''),
        'Mi Agencia Inmobiliaria'
      );

      EXECUTE
        'INSERT INTO public.agencias (nombre, owner_id)
         VALUES ($1, $2)
         ON CONFLICT (owner_id) DO UPDATE
           SET actualizado_en = now()
         RETURNING id'
      INTO v_agencia_id
      USING v_nombre_agencia, p_user_id;

      IF v_agencia_id IS NOT NULL THEN
        EXECUTE
          'INSERT INTO public.agencia_miembros (agencia_id, user_id, rol, estado)
           VALUES ($1, $2, ''admin'', ''activo'')
           ON CONFLICT (agencia_id, user_id) DO UPDATE
             SET rol = ''admin'', estado = ''activo'''
        USING v_agencia_id, p_user_id;
      END IF;
    END IF;
  END IF;

  IF to_regclass('public.auditoria') IS NOT NULL THEN
    EXECUTE
      'INSERT INTO public.auditoria (usuario_id, tabla_afectada, operacion, registro_id, datos_anteriores, datos_nuevos)
       VALUES ($1, $2, $3, $4, $5, $6)'
    USING
      p_admin_id,
      'suscripciones',
      CASE WHEN v_operacion = 'asignar' THEN 'INSERT' ELSE 'UPDATE' END,
      v_resultado.id,
      jsonb_build_object(
        'user_id', p_user_id,
        'fin_anterior', v_fin_anterior
      ),
      jsonb_build_object(
        'accion', CASE WHEN v_operacion = 'extender' THEN 'extender_tiempo_extra' ELSE 'asignar_plan' END,
        'user_id', p_user_id,
        'plan', v_resultado.plan,
        'estado', v_resultado.estado,
        'dias', p_dias,
        'fin_nuevo', v_resultado.fin,
        'creditos_incluidos', v_resultado.creditos_incluidos,
        'motivo', nullif(btrim(coalesce(p_motivo, '')), '')
      );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'operacion', v_operacion,
    'dias', p_dias,
    'fin_anterior', v_fin_anterior,
    'suscripcion', jsonb_build_object(
      'id', v_resultado.id,
      'plan', v_resultado.plan,
      'estado', v_resultado.estado,
      'fin', v_resultado.fin,
      'trial_ends_at', v_resultado.trial_ends_at,
      'creditos_incluidos', v_resultado.creditos_incluidos
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_cambiar_plan(
  p_user_id uuid,
  p_admin_id uuid,
  p_plan text,
  p_modo text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $$
BEGIN
  IF p_plan IS NULL OR p_plan NOT IN ('gratuita', 'profesional', 'profesional_plus', 'agencia') THEN
    RAISE EXCEPTION 'Plan inválido' USING ERRCODE = '22023';
  END IF;
  IF p_modo IS NULL OR p_modo NOT IN ('activa', 'trial', 'cancelar') THEN
    RAISE EXCEPTION 'Modo inválido' USING ERRCODE = '22023';
  END IF;

  RETURN public.admin_gestionar_plan(
    p_user_id,
    p_admin_id,
    CASE WHEN p_plan = 'gratuita' OR p_modo = 'cancelar' THEN 'cancelar' ELSE 'asignar' END,
    p_plan,
    p_modo,
    30,
    NULL,
    NULL
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_gestionar_plan(uuid, uuid, text, text, text, integer, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_gestionar_plan(uuid, uuid, text, text, text, integer, integer, text) TO service_role;

REVOKE ALL ON FUNCTION public.admin_cambiar_plan(uuid, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_cambiar_plan(uuid, uuid, text, text) TO service_role;

-- 7. Trigger de creación de cuenta (`handle_new_auth_user`)
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_meta jsonb := coalesce(NEW.raw_user_meta_data, '{}'::jsonb);
  v_tipo text := nullif(btrim(coalesce(v_meta ->> 'tipo_cuenta', '')), '');
  v_plan text := nullif(btrim(coalesce(v_meta ->> 'plan', '')), '');
  v_trial_dias integer := 30;
  v_fin timestamptz;
  v_empresa text;
  v_nombre text;
  v_agencia_id uuid;
BEGIN
  IF v_plan IS NULL OR v_plan NOT IN ('gratuita', 'profesional', 'profesional_plus', 'agencia') THEN
    IF v_tipo IN ('particular', 'profesional', 'agencia') THEN
      v_plan := CASE v_tipo
        WHEN 'agencia' THEN 'agencia'
        WHEN 'profesional' THEN 'profesional'
        ELSE 'gratuita'
      END;
    ELSE
      v_plan := 'gratuita';
    END IF;
  END IF;

  IF v_tipo IS NULL OR v_tipo NOT IN ('particular', 'profesional', 'agencia') THEN
    v_tipo := public.tipo_cuenta_para_plan(v_plan);
  END IF;

  v_fin := now() + make_interval(days => v_trial_dias);
  v_nombre := coalesce(
    nullif(btrim(coalesce(v_meta ->> 'nombre_completo', '')), ''),
    nullif(btrim(coalesce(v_meta ->> 'nombre', '')), '')
  );
  v_empresa := nullif(btrim(coalesce(v_meta ->> 'empresa_nombre', '')), '');

  INSERT INTO public.perfiles (
    id, nombre, email, telefono, estado, ciudad, tipo_cuenta, empresa_nombre, licencia_corredor
  )
  VALUES (
    NEW.id,
    v_nombre,
    NEW.email,
    nullif(btrim(coalesce(v_meta ->> 'telefono', '')), ''),
    nullif(btrim(coalesce(v_meta ->> 'estado', '')), ''),
    nullif(btrim(coalesce(v_meta ->> 'ciudad', '')), ''),
    v_tipo,
    v_empresa,
    nullif(btrim(coalesce(v_meta ->> 'licencia_corredor', '')), '')
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        nombre = coalesce(nullif(public.perfiles.nombre, ''), EXCLUDED.nombre),
        telefono = coalesce(public.perfiles.telefono, EXCLUDED.telefono),
        estado = coalesce(public.perfiles.estado, EXCLUDED.estado),
        ciudad = coalesce(public.perfiles.ciudad, EXCLUDED.ciudad),
        tipo_cuenta = EXCLUDED.tipo_cuenta,
        empresa_nombre = coalesce(public.perfiles.empresa_nombre, EXCLUDED.empresa_nombre),
        licencia_corredor = coalesce(public.perfiles.licencia_corredor, EXCLUDED.licencia_corredor);

  INSERT INTO public.suscripciones (
    user_id, plan, estado, inicio, fin, trial_ends_at,
    creditos_incluidos, creditos_usados_mes, proxima_renovacion_creditos
  )
  SELECT
    NEW.id,
    v_plan,
    'trial',
    now(),
    v_fin,
    v_fin,
    public.creditos_incluidos_por_plan(v_plan),
    0,
    v_fin
  WHERE NOT EXISTS (
    SELECT 1 FROM public.suscripciones s WHERE s.user_id = NEW.id
  );

  -- Solo `agencia` auto-aprovisiona entidad multiagente
  IF (v_tipo = 'agencia' OR v_plan = 'agencia')
     AND to_regclass('public.agencias') IS NOT NULL
     AND to_regclass('public.agencia_miembros') IS NOT NULL THEN
    INSERT INTO public.agencias (nombre, owner_id)
    VALUES (coalesce(v_empresa, v_nombre, 'Agencia Inmobiliaria'), NEW.id)
    ON CONFLICT (owner_id) DO UPDATE
      SET actualizado_en = now()
    RETURNING id INTO v_agencia_id;

    IF v_agencia_id IS NOT NULL THEN
      INSERT INTO public.agencia_miembros (agencia_id, user_id, rol, estado)
      VALUES (v_agencia_id, NEW.id, 'admin', 'activo')
      ON CONFLICT (agencia_id, user_id) DO UPDATE
        SET rol = 'admin', estado = 'activo';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM PUBLIC;

COMMIT;
