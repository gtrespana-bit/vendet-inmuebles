-- =============================================================================
-- Migración 019: Control avanzado de planes y tiempo extra manual desde Admin
-- -----------------------------------------------------------------------------
-- Permite al administrador:
--   1. Extender manualmente el tiempo de prueba o suscripción activa (+N días)
--      a usuarios o nuevas agencias seleccionadas, sumando los días sobre la
--      fecha de vencimiento vigente sin perder días restantes.
--   2. Asignar o cambiar un plan con duración personalizada (1..730 días) y
--      cupo mensual opcional de créditos incluidos.
--   3. Auto-aprovisionar el registro en `public.agencias` y `agencia_miembros`
--      cuando se activa o extiende el Plan Agencia.
--   4. Registrar trazabilidad en `public.auditoria` respetando sus restricciones.
-- =============================================================================

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
SET search_path = pg_catalog, public
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

  -- 1. Cancelación a plan Gratuito
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

  -- Validación de días y cupo de créditos
  IF p_dias IS NULL OR p_dias < 1 OR p_dias > 730 THEN
    RAISE EXCEPTION 'La cantidad de días debe estar entre 1 y 730' USING ERRCODE = '22023';
  END IF;

  IF p_creditos_incluidos IS NOT NULL AND (p_creditos_incluidos < 0 OR p_creditos_incluidos > 1000) THEN
    RAISE EXCEPTION 'Los créditos incluidos deben estar entre 0 y 1000' USING ERRCODE = '22023';
  END IF;

  -- 2. Extensión de tiempo extra (+N días sobre la vigencia actual)
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
      IF v_plan_param NOT IN ('profesional', 'agencia') THEN
        RAISE EXCEPTION 'Plan inválido para extensión' USING ERRCODE = '22023';
      END IF;
      v_plan_final := v_plan_param;
    ELSIF v_actual.id IS NOT NULL AND v_actual.plan IN ('profesional', 'agencia') THEN
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
        CASE v_plan_final WHEN 'agencia' THEN 20 WHEN 'profesional' THEN 5 ELSE 0 END
      );
    ELSE
      v_incluidos := CASE v_plan_final WHEN 'agencia' THEN 20 WHEN 'profesional' THEN 5 ELSE 0 END;
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

      -- Cancelar cualquier duplicada residual si existiera
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

  -- 3. Asignación / cambio de plan con duración personalizada desde hoy
  ELSE
    IF v_plan_param NOT IN ('profesional', 'agencia') THEN
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
      CASE v_plan_final WHEN 'agencia' THEN 20 WHEN 'profesional' THEN 5 ELSE 0 END
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
     SET tipo_cuenta = v_plan_final
   WHERE id = p_user_id;

  -- Auto-aprovisionar agencia si corresponde y aún no pertenece a una agencia activa
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

  -- Registrar auditoría administrativa si existe la tabla
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

REVOKE ALL ON FUNCTION public.admin_gestionar_plan(uuid, uuid, text, text, text, integer, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_gestionar_plan(uuid, uuid, text, text, text, integer, integer, text) TO service_role;

-- Compatibilidad retroactiva con `admin_cambiar_plan(uuid, uuid, text, text)`
CREATE OR REPLACE FUNCTION public.admin_cambiar_plan(
  p_user_id uuid,
  p_admin_id uuid,
  p_plan text,
  p_modo text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF p_plan IS NULL OR p_plan NOT IN ('gratuita', 'profesional', 'agencia') THEN
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

REVOKE ALL ON FUNCTION public.admin_cambiar_plan(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_cambiar_plan(uuid, uuid, text, text) TO service_role;
