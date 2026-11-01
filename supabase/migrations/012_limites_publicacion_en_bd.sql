-- Enforce plan quotas for ALL writers (REST, API and dashboard), not just forms.
-- No existing listings/photos are deleted or paused by this migration.
BEGIN;

CREATE OR REPLACE FUNCTION public.plan_efectivo_publicacion(p_user uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT COALESCE((
    SELECT s.plan::text FROM public.suscripciones s
    WHERE s.user_id = p_user AND s.estado::text IN ('activa','trial')
      AND s.inicio <= now() AND (s.fin IS NULL OR s.fin > now())
      AND (s.estado::text <> 'trial' OR s.trial_ends_at > now())
    ORDER BY s.created_at DESC, s.id DESC LIMIT 1
  ), 'gratuita');
$$;
REVOKE ALL ON FUNCTION public.plan_efectivo_publicacion(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.exigir_cupo_inmueble()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_plan text; v_max integer; v_count bigint;
BEGIN
  -- Existing excess inventory after a downgrade may be edited or paused.
  -- Only a NEW active listing, reactivation or ownership transfer consumes a slot.
  IF NEW.activo IS NOT TRUE THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.activo IS TRUE AND OLD.usuario_id IS NOT DISTINCT FROM NEW.usuario_id THEN RETURN NEW; END IF;
  END IF;
  -- Serialize all quota consumers for this account, including concurrent REST writes.
  PERFORM 1 FROM public.perfiles WHERE id = NEW.usuario_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cuenta no encontrada' USING ERRCODE = '23503'; END IF;
  v_plan := public.plan_efectivo_publicacion(NEW.usuario_id);
  v_max := CASE v_plan WHEN 'agencia' THEN 999999 WHEN 'profesional' THEN 10 ELSE 3 END;
  SELECT count(*) INTO v_count FROM public.inmuebles
    WHERE usuario_id = NEW.usuario_id AND activo IS TRUE AND id IS DISTINCT FROM NEW.id;
  IF v_count >= v_max THEN
    RAISE EXCEPTION 'Límite de publicaciones alcanzado para el plan %', v_plan USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.exigir_cupo_inmueble() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS exigir_cupo_inmueble ON public.inmuebles;
CREATE TRIGGER exigir_cupo_inmueble BEFORE INSERT OR UPDATE OF activo, usuario_id
  ON public.inmuebles FOR EACH ROW EXECUTE FUNCTION public.exigir_cupo_inmueble();

CREATE OR REPLACE FUNCTION public.exigir_cupo_imagen()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_user uuid; v_plan text; v_max integer; v_count bigint;
BEGIN
  -- Reordering/changing an existing photo does not consume another slot.
  IF TG_OP = 'UPDATE' THEN
    IF OLD.inmueble_id IS NOT DISTINCT FROM NEW.inmueble_id THEN RETURN NEW; END IF;
  END IF;
  SELECT usuario_id INTO v_user FROM public.inmuebles WHERE id = NEW.inmueble_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Inmueble no encontrado' USING ERRCODE = '23503'; END IF;
  PERFORM 1 FROM public.perfiles WHERE id = v_user FOR UPDATE;
  v_plan := public.plan_efectivo_publicacion(v_user);
  v_max := CASE v_plan WHEN 'agencia' THEN 30 WHEN 'profesional' THEN 20 ELSE 8 END;
  SELECT count(*) INTO v_count FROM public.inmueble_imagenes
    WHERE inmueble_id = NEW.inmueble_id AND id IS DISTINCT FROM NEW.id;
  IF v_count >= v_max THEN
    RAISE EXCEPTION 'Límite de fotos alcanzado para el plan %', v_plan USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.exigir_cupo_imagen() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS exigir_cupo_imagen ON public.inmueble_imagenes;
CREATE TRIGGER exigir_cupo_imagen BEFORE INSERT OR UPDATE OF inmueble_id
  ON public.inmueble_imagenes FOR EACH ROW EXECUTE FUNCTION public.exigir_cupo_imagen();
COMMIT;
