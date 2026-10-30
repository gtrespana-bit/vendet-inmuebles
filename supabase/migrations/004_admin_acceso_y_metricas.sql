-- ============================================================================
-- 004 · Acceso admin ampliado + RPCs de métricas para el panel de administración
--
-- 1) is_admin(): ahora reconoce ambos correos de administración.
--    IMPORTANTE: mantener sincronizado con src/lib/admin-config.ts
-- 2) admin_metricas(): KPIs del dashboard calculados en BD (1 sola llamada
--    en lugar de N consultas + filas completas descargadas al cliente).
-- 3) admin_top_vendedores(): ranking de vendedores agregado en BD.
-- ============================================================================

-- 1) Ampliar la lista de administradores ------------------------------------

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog', 'auth', 'public'
AS $function$
  SELECT
    lower(coalesce(auth.jwt() ->> 'email', '')) = ANY (ARRAY[
      'gtrespana@gmail.com',
      'jdmimportesp@gmail.com'
    ])
    OR coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin';
$function$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated, service_role;


-- 2) Métricas del dashboard en una sola llamada -----------------------------

CREATE OR REPLACE FUNCTION public.admin_metricas()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  resultado jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT jsonb_build_object(
    'total_usuarios',         (SELECT count(*) FROM public.perfiles),
    'usuarios_nuevos_hoy',    (SELECT count(*) FROM public.perfiles
                                 WHERE creado_en >= date_trunc('day', now())),
    'vendedores_verificados', (SELECT count(*) FROM public.perfiles
                                 WHERE verificado),
    'total_propiedades',      (SELECT count(*) FROM public.inmuebles),
    'propiedades_activas',    (SELECT count(*) FROM public.inmuebles
                                 WHERE activo),
    'propiedades_pendientes', (SELECT count(*) FROM public.inmuebles
                                 WHERE estado_moderacion = 'pendiente'),
    'visitas_totales',        (SELECT COALESCE(sum(visitas), 0)
                                 FROM public.inmuebles),
    'pagos_pendientes',       (SELECT count(*) FROM public.transacciones_creditos
                                 WHERE estado = 'pendiente' AND tipo = 'compra'),
    'creditos_vendidos',      (SELECT COALESCE(sum(monto), 0)
                                 FROM public.transacciones_creditos
                                 WHERE estado = 'aprobado' AND tipo = 'compra'),
    'ingresos_usd',           (SELECT COALESCE(sum(precio_usd), 0)
                                 FROM public.transacciones_creditos
                                 WHERE estado = 'aprobado' AND tipo = 'compra'),
    'compras_hoy',            (SELECT count(*) FROM public.transacciones_creditos
                                 WHERE estado = 'aprobado' AND tipo = 'compra'
                                   AND creado_en >= date_trunc('day', now()))
  ) INTO resultado;

  RETURN resultado;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_metricas() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_metricas() TO anon, authenticated, service_role;


-- 3) Top vendedores agregado en BD ------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_top_vendedores(p_limite integer DEFAULT 10)
RETURNS TABLE (
  user_id            uuid,
  nombre             text,
  total_propiedades  bigint,
  propiedades_activas bigint,
  visitas_totales    bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
  SELECT
    i.usuario_id AS user_id,
    COALESCE(p.nombre, 'Sin nombre') AS nombre,
    count(*)                          AS total_propiedades,
    count(*) FILTER (WHERE i.activo)  AS propiedades_activas,
    COALESCE(sum(i.visitas), 0)       AS visitas_totales
  FROM public.inmuebles i
  LEFT JOIN public.perfiles p ON p.id = i.usuario_id
  GROUP BY i.usuario_id, p.nombre
  ORDER BY visitas_totales DESC, total_propiedades DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limite, 10), 100));
$function$;

REVOKE ALL ON FUNCTION public.admin_top_vendedores(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_top_vendedores(integer) TO anon, authenticated, service_role;
