-- 009_registro_por_tipo_de_cuenta.sql
--
-- El registro pide primero el tipo de cuenta (particular / profesional / agencia)
-- y después el plan. Esos datos viajan en `auth.signUp({ options: { data } })` y
-- este trigger los convierte en:
--   1) el perfil con los campos que corresponden a cada tipo de cuenta, y
--   2) una suscripción en estado `trial` con 30 días de prueba gratis.
--
-- Sin esto, todo registro nuevo quedaba con `tipo_cuenta = 'particular'` y sin
-- suscripción, así que la prueba de 30 días nunca se activaba.

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  v_meta jsonb := coalesce(NEW.raw_user_meta_data, '{}'::jsonb);
  v_tipo text := nullif(btrim(coalesce(v_meta ->> 'tipo_cuenta', '')), '');
  v_plan text := nullif(btrim(coalesce(v_meta ->> 'plan', '')), '');
  v_trial_dias integer := 30;
  v_fin timestamptz;
BEGIN
  IF v_tipo IS NULL OR v_tipo NOT IN ('particular', 'profesional', 'agencia') THEN
    v_tipo := 'particular';
  END IF;

  IF v_plan IS NULL OR v_plan NOT IN ('gratuita', 'profesional', 'agencia') THEN
    v_plan := CASE v_tipo
      WHEN 'agencia' THEN 'agencia'
      WHEN 'profesional' THEN 'profesional'
      ELSE 'gratuita'
    END;
  END IF;

  v_fin := now() + make_interval(days => v_trial_dias);

  INSERT INTO public.perfiles (
    id, nombre, email, telefono, estado, ciudad, tipo_cuenta, empresa_nombre, licencia_corredor
  )
  VALUES (
    NEW.id,
    coalesce(
      nullif(btrim(coalesce(v_meta ->> 'nombre_completo', '')), ''),
      nullif(btrim(coalesce(v_meta ->> 'nombre', '')), '')
    ),
    NEW.email,
    nullif(btrim(coalesce(v_meta ->> 'telefono', '')), ''),
    nullif(btrim(coalesce(v_meta ->> 'estado', '')), ''),
    nullif(btrim(coalesce(v_meta ->> 'ciudad', '')), ''),
    v_tipo,
    nullif(btrim(coalesce(v_meta ->> 'empresa_nombre', '')), ''),
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

  -- Prueba gratuita de 30 días en el plan elegido: una suscripción por cuenta.
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
    CASE v_plan WHEN 'profesional' THEN 5 WHEN 'agencia' THEN 20 ELSE 0 END,
    0,
    v_fin
  WHERE NOT EXISTS (
    SELECT 1 FROM public.suscripciones s WHERE s.user_id = NEW.id
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM PUBLIC;

-- El trigger ya existe desde 001; se recrea por si el nombre cambió.
DROP TRIGGER IF EXISTS on_auth_user_created_vendet ON auth.users;
CREATE TRIGGER on_auth_user_created_vendet
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();
