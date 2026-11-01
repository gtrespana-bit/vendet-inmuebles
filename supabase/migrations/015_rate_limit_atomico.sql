CREATE OR REPLACE FUNCTION public.reservar_rate_limit(
  p_key text,
  p_identifier text,
  p_ip text,
  p_max integer,
  p_ventana_segundos integer
)
RETURNS TABLE (permitido boolean, usados integer, restantes integer, reinicia_en integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_desde timestamptz := now() - make_interval(secs => greatest(p_ventana_segundos, 1));
  v_count integer;
BEGIN
  IF p_max IS NULL OR p_max < 1 OR p_identifier IS NULL OR btrim(p_identifier) = '' THEN
    RETURN QUERY SELECT true, 0, 0, 0;
    RETURN;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_key || '|' || p_identifier, 0));

  DELETE FROM public.rate_limit
   WHERE key = p_key AND identifier = p_identifier AND created_at < v_desde;

  SELECT count(*) INTO v_count
    FROM public.rate_limit
   WHERE key = p_key AND identifier = p_identifier AND created_at >= v_desde;

  IF v_count >= p_max THEN
    RETURN QUERY SELECT false, v_count, 0, greatest(p_ventana_segundos, 1);
    RETURN;
  END IF;

  INSERT INTO public.rate_limit (key, identifier, ip) VALUES (p_key, p_identifier, p_ip);

  RETURN QUERY SELECT true, v_count + 1, greatest(0, p_max - v_count - 1), greatest(p_ventana_segundos, 1);
END;
$$;

COMMENT ON FUNCTION public.reservar_rate_limit(text, text, text, integer, integer) IS
  'Reserva atómica de presupuesto por (operación, identificador). Solo para el servidor: sin EXECUTE para anon/authenticated.';
REVOKE ALL ON FUNCTION public.reservar_rate_limit(text, text, text, integer, integer) FROM PUBLIC, anon, authenticated;

CREATE INDEX IF NOT EXISTS idx_rate_limit_key_identifier_created
  ON public.rate_limit (key, identifier, created_at DESC);
