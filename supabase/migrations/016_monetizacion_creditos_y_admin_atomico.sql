-- 016 · Créditos incluidos en el plan, destacado 12h y operaciones admin atómicas (F09, F10, F18)
--
-- 1. `consumir_creditos_usuario`: consume primero los créditos mensuales incluidos
--    en la suscripción efectiva (`creditos_incluidos - creditos_usados_mes`) y solo
--    el resto de `perfiles.credito_balance` (créditos comprados sin caducidad).
--    Si una suscripción vigente supera `proxima_renovacion_creditos` (p. ej. ciclo
--    multimes), renueva el contador mensual automáticamente. Cambiar de plan durante
--    la prueba no regala créditos duplicados porque `creditos_usados_mes` se conserva.
-- 2. `usar_boost` y `usar_destacado`: conectadas a `consumir_creditos_usuario`;
--    `usar_destacado` admite ahora las tres opciones anunciadas (12h=4, 24h=6, 48h=10)
--    y extiende desde `destacado_hasta` si seguía vigente.
-- 3. `admin_agregar_creditos` y `admin_cambiar_plan`: ejecutan el ajuste de saldo +
--    auditoría contable o la transición completa de suscripción en una única
--    transacción con bloqueo de fila (`FOR UPDATE`) e idempotencia opcional.

CREATE OR REPLACE FUNCTION public.consumir_creditos_usuario(
  p_user_id uuid,
  p_cantidad integer
)
RETURNS TABLE (
  ok boolean,
  balance_comprados numeric,
  restantes_plan integer,
  total_disponible numeric,
  usados_plan integer,
  usados_comprados integer,
  error text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_comprados numeric(12,2);
  v_sub public.suscripciones%ROWTYPE;
  v_disp_plan integer := 0;
  v_usar_plan integer := 0;
  v_usar_comprados integer := 0;
  v_ciclos integer;
  v_prox timestamptz;
BEGIN
  IF p_cantidad IS NULL OR p_cantidad < 1 THEN
    RETURN QUERY SELECT false, 0::numeric, 0, 0::numeric, 0, 0, 'Cantidad inválida'::text;
    RETURN;
  END IF;

  SELECT credito_balance INTO v_comprados
    FROM public.perfiles
   WHERE id = p_user_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0::numeric, 0, 0::numeric, 0, 0, 'Usuario no encontrado'::text;
    RETURN;
  END IF;

  SELECT * INTO v_sub
    FROM public.suscripciones s
   WHERE s.user_id = p_user_id
     AND s.estado IN ('activa', 'trial')
     AND s.inicio <= now()
     AND (s.fin IS NULL OR s.fin > now())
     AND (s.estado <> 'trial' OR s.trial_ends_at > now())
   ORDER BY s.created_at DESC, s.id DESC
   LIMIT 1
   FOR UPDATE;

  IF v_sub.id IS NOT NULL THEN
    IF v_sub.proxima_renovacion_creditos IS NOT NULL AND v_sub.proxima_renovacion_creditos <= now() THEN
      v_ciclos := floor(extract(epoch FROM (now() - v_sub.proxima_renovacion_creditos)) / (30 * 86400))::integer + 1;
      v_prox := v_sub.proxima_renovacion_creditos + make_interval(days => greatest(1, v_ciclos) * 30);
      v_sub.creditos_usados_mes := 0;
      UPDATE public.suscripciones
         SET creditos_usados_mes = 0,
             proxima_renovacion_creditos = v_prox,
             updated_at = now()
       WHERE id = v_sub.id;
    END IF;
    v_disp_plan := greatest(0, coalesce(v_sub.creditos_incluidos, 0) - coalesce(v_sub.creditos_usados_mes, 0));
  END IF;

  v_usar_plan := least(p_cantidad, v_disp_plan);
  v_usar_comprados := p_cantidad - v_usar_plan;

  IF coalesce(v_comprados, 0) < v_usar_comprados THEN
    RETURN QUERY SELECT
      false,
      coalesce(v_comprados, 0),
      v_disp_plan,
      coalesce(v_comprados, 0) + v_disp_plan,
      0,
      0,
      'No tienes créditos suficientes'::text;
    RETURN;
  END IF;

  IF v_usar_plan > 0 THEN
    UPDATE public.suscripciones
       SET creditos_usados_mes = coalesce(creditos_usados_mes, 0) + v_usar_plan,
           updated_at = now()
     WHERE id = v_sub.id;
    v_disp_plan := v_disp_plan - v_usar_plan;
  END IF;

  IF v_usar_comprados > 0 THEN
    UPDATE public.perfiles
       SET credito_balance = credito_balance - v_usar_comprados
     WHERE id = p_user_id
     RETURNING credito_balance INTO v_comprados;
  END IF;

  RETURN QUERY SELECT
    true,
    coalesce(v_comprados, 0),
    v_disp_plan,
    coalesce(v_comprados, 0) + v_disp_plan,
    v_usar_plan,
    v_usar_comprados,
    NULL::text;
END;
$$;

REVOKE ALL ON FUNCTION public.consumir_creditos_usuario(uuid, integer) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.usar_boost(
  p_producto_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  v_owner uuid;
  v_res record;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role'
     AND auth.uid() IS DISTINCT FROM p_user_id
     AND NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No autorizado');
  END IF;

  SELECT usuario_id INTO v_owner
    FROM public.inmuebles
   WHERE id = p_producto_id AND activo = true
   FOR UPDATE;
  IF NOT FOUND OR v_owner <> p_user_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Publicación no encontrada o inactiva');
  END IF;

  SELECT * INTO v_res FROM public.consumir_creditos_usuario(p_user_id, 1);
  IF NOT coalesce(v_res.ok, false) THEN
    RETURN jsonb_build_object('ok', false, 'error', coalesce(v_res.error, 'No tienes créditos suficientes'));
  END IF;

  UPDATE public.inmuebles
     SET boosteado_en = now(), actualizado_en = now()
   WHERE id = p_producto_id;

  RETURN jsonb_build_object(
    'ok', true,
    'balance', v_res.balance_comprados,
    'creditos_plan_restantes', v_res.restantes_plan,
    'creditos_disponibles', v_res.total_disponible
  );
END;
$$;

REVOKE ALL ON FUNCTION public.usar_boost(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.usar_boost(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.usar_destacado(
  p_producto_id uuid,
  p_user_id uuid,
  p_horas integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  v_owner uuid;
  v_destacado boolean;
  v_destacado_hasta timestamptz;
  v_creditos integer;
  v_base timestamptz;
  v_fin timestamptz;
  v_res record;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role'
     AND auth.uid() IS DISTINCT FROM p_user_id
     AND NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No autorizado');
  END IF;

  v_creditos := CASE p_horas WHEN 12 THEN 4 WHEN 24 THEN 6 WHEN 48 THEN 10 ELSE 0 END;
  IF v_creditos = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Duración de destacado no válida');
  END IF;

  SELECT usuario_id, destacado, destacado_hasta
    INTO v_owner, v_destacado, v_destacado_hasta
    FROM public.inmuebles
   WHERE id = p_producto_id AND activo = true
   FOR UPDATE;
  IF NOT FOUND OR v_owner <> p_user_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Publicación no encontrada o inactiva');
  END IF;

  SELECT * INTO v_res FROM public.consumir_creditos_usuario(p_user_id, v_creditos);
  IF NOT coalesce(v_res.ok, false) THEN
    RETURN jsonb_build_object('ok', false, 'error', coalesce(v_res.error, 'No tienes créditos suficientes'));
  END IF;

  v_base := CASE
    WHEN v_destacado IS TRUE AND v_destacado_hasta IS NOT NULL AND v_destacado_hasta > now()
      THEN v_destacado_hasta
    ELSE now()
  END;
  v_fin := v_base + make_interval(hours => p_horas);

  UPDATE public.inmuebles
     SET destacado = true,
         destacado_hasta = v_fin,
         actualizado_en = now()
   WHERE id = p_producto_id;

  INSERT INTO public.destacados (producto_id, user_id, inicio, fin, pagado, creditos_usados)
  VALUES (p_producto_id, p_user_id, now(), v_fin, true, v_creditos);

  RETURN jsonb_build_object(
    'ok', true,
    'balance', v_res.balance_comprados,
    'creditos_plan_restantes', v_res.restantes_plan,
    'creditos_disponibles', v_res.total_disponible,
    'destacado_hasta', v_fin
  );
END;
$$;

REVOKE ALL ON FUNCTION public.usar_destacado(uuid, uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.usar_destacado(uuid, uuid, integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_agregar_creditos(
  p_user_id uuid,
  p_admin_id uuid,
  p_cantidad integer,
  p_motivo text DEFAULT 'Manual admin',
  p_referencia text DEFAULT NULL
)
RETURNS TABLE (nuevo_balance numeric, ya_aplicado boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actual numeric(12,2);
  v_nuevo numeric(12,2);
  v_admin uuid;
  v_ref text := nullif(btrim(coalesce(p_referencia, '')), '');
  v_motivo text := left(coalesce(nullif(btrim(coalesce(p_motivo, '')), ''), 'Manual admin'), 500);
BEGIN
  IF p_cantidad IS NULL OR p_cantidad < 1 OR p_cantidad > 10000 THEN
    RAISE EXCEPTION 'Cantidad inválida (debe ser entre 1 y 10.000)' USING ERRCODE = '22023';
  END IF;

  SELECT credito_balance INTO v_actual
    FROM public.perfiles
   WHERE id = p_user_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuario no encontrado' USING ERRCODE = 'P0002';
  END IF;

  IF v_ref IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.transacciones_creditos
     WHERE user_id = p_user_id AND tipo = 'admin_manual' AND referencia = v_ref
  ) THEN
    RETURN QUERY SELECT coalesce(v_actual, 0), true;
    RETURN;
  END IF;

  SELECT id INTO v_admin FROM public.perfiles WHERE id = p_admin_id;

  UPDATE public.perfiles
     SET credito_balance = coalesce(credito_balance, 0) + p_cantidad
   WHERE id = p_user_id
   RETURNING credito_balance INTO v_nuevo;

  INSERT INTO public.transacciones_creditos (
    user_id, tipo, monto, estado, motivo_registro, referencia, aprobado_en, aprobado_por
  ) VALUES (
    p_user_id, 'admin_manual', p_cantidad, 'aprobado', v_motivo, v_ref, now(), v_admin
  );

  RETURN QUERY SELECT v_nuevo, false;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_agregar_creditos(uuid, uuid, integer, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_agregar_creditos(uuid, uuid, integer, text, text) TO service_role;

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
DECLARE
  v_fin timestamptz;
  v_estado text;
  v_incluidos integer;
  v_creada record;
BEGIN
  IF p_plan IS NULL OR p_plan NOT IN ('gratuita', 'profesional', 'agencia') THEN
    RAISE EXCEPTION 'Plan inválido' USING ERRCODE = '22023';
  END IF;
  IF p_modo IS NULL OR p_modo NOT IN ('activa', 'trial', 'cancelar') THEN
    RAISE EXCEPTION 'Modo inválido (usa: activa, trial o cancelar)' USING ERRCODE = '22023';
  END IF;

  PERFORM 1 FROM public.perfiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuario no encontrado' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.suscripciones
     SET estado = 'cancelada',
         updated_at = now()
   WHERE user_id = p_user_id
     AND estado IN ('activa', 'trial');

  IF p_plan = 'gratuita' OR p_modo = 'cancelar' THEN
    UPDATE public.perfiles
       SET tipo_cuenta = 'particular'
     WHERE id = p_user_id;

    RETURN jsonb_build_object('ok', true, 'plan', 'gratuita', 'estado', 'cancelada');
  END IF;

  v_fin := now() + interval '30 days';
  v_estado := CASE WHEN p_modo = 'trial' THEN 'trial' ELSE 'activa' END;
  v_incluidos := CASE p_plan WHEN 'agencia' THEN 20 WHEN 'profesional' THEN 5 ELSE 0 END;

  INSERT INTO public.suscripciones (
    user_id, plan, estado, inicio, fin, trial_ends_at,
    creditos_incluidos, creditos_usados_mes, proxima_renovacion_creditos
  ) VALUES (
    p_user_id,
    p_plan,
    v_estado,
    now(),
    v_fin,
    CASE WHEN v_estado = 'trial' THEN v_fin ELSE NULL END,
    v_incluidos,
    0,
    v_fin
  )
  RETURNING id, plan, estado, fin, trial_ends_at INTO v_creada;

  UPDATE public.perfiles
     SET tipo_cuenta = p_plan
   WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'ok', true,
    'suscripcion', jsonb_build_object(
      'id', v_creada.id,
      'plan', v_creada.plan,
      'estado', v_creada.estado,
      'fin', v_creada.fin,
      'trial_ends_at', v_creada.trial_ends_at
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_cambiar_plan(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_cambiar_plan(uuid, uuid, text, text) TO service_role;
