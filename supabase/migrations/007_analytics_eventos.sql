-- ============================================================================
-- 007 · Analítica interna del sitio (eventos_web) + RPCs para el panel admin
--
-- Registra eventos de navegación y acciones (pageviews, registros, mensajes,
-- publicaciones, favoritos, búsquedas, compras...) y expone agregaciones
-- SECURITY DEFINER para el panel de administración.
--
-- Aplicar después de 001-006:  supabase db push  (o pegar en el SQL editor)
-- ============================================================================

-- 1) Tabla de eventos ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.eventos_web (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tipo          text NOT NULL CHECK (tipo IN (
                  'pageview','vista_inmueble','registro','login','logout',
                  'publicacion_creada','mensaje_enviado','inicio_chat',
                  'favorito','busqueda','contacto','compra_creditos',
                  'click_contacto','compartir'
                )),
  ruta          text NOT NULL CHECK (ruta LIKE '/%' AND length(ruta) <= 500),
  titulo        text CHECK (titulo IS NULL OR length(titulo) <= 200),
  referrer      text,
  utm_source    text,
  utm_medium    text,
  utm_campaign  text,
  session_id    text,
  user_id       uuid REFERENCES public.perfiles(id) ON DELETE SET NULL,
  pais          text,
  dispositivo   text CHECK (dispositivo IS NULL OR dispositivo IN ('movil','tablet','escritorio','otro')),
  navegador     text,
  ip            text,
  meta          jsonb,
  creado_en     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_eventos_fecha        ON public.eventos_web (creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_eventos_tipo_fecha   ON public.eventos_web (tipo, creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_eventos_ruta_fecha   ON public.eventos_web (ruta, creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_eventos_session      ON public.eventos_web (session_id) WHERE session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_eventos_user_fecha   ON public.eventos_web (user_id, creado_en DESC) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_eventos_utm_source   ON public.eventos_web (utm_source, creado_en DESC) WHERE utm_source IS NOT NULL;

ALTER TABLE public.eventos_web ENABLE ROW LEVEL SECURITY;

-- Cualquiera puede registrar eventos (tracking público)...
DROP POLICY IF EXISTS eventos_web_insert_publico ON public.eventos_web;
CREATE POLICY eventos_web_insert_publico ON public.eventos_web
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    -- ...pero no puede suplantar a otro usuario en el evento
    user_id IS NULL OR auth.uid() = user_id
  );

-- ...pero solo un admin puede leerlos.
DROP POLICY IF EXISTS eventos_web_select_admin ON public.eventos_web;
CREATE POLICY eventos_web_select_admin ON public.eventos_web
  FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS eventos_web_delete_admin ON public.eventos_web;
CREATE POLICY eventos_web_delete_admin ON public.eventos_web
  FOR DELETE TO authenticated
  USING (public.is_admin());

GRANT INSERT ON public.eventos_web TO anon, authenticated;
GRANT SELECT, DELETE ON public.eventos_web TO authenticated, service_role;

-- 2) Helper de autorización: admin por JWT o service role (API routes) --------
CREATE OR REPLACE FUNCTION public._es_admin_o_service()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog', 'auth', 'public'
AS $function$
  SELECT public.is_admin() OR auth.role() = 'service_role';
$function$;

REVOKE ALL ON FUNCTION public._es_admin_o_service() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._es_admin_o_service() TO anon, authenticated, service_role;

-- 3) Contador de visitas por inmueble (llamado desde /api/inmueble/visita) -----
CREATE OR REPLACE FUNCTION public.registrar_visita_inmueble(p_inmueble_id uuid)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  nuevo_valor bigint;
BEGIN
  UPDATE public.inmuebles
     SET visitas = COALESCE(visitas, 0) + 1
   WHERE id = p_inmueble_id
  RETURNING visitas INTO nuevo_valor;
  RETURN COALESCE(nuevo_valor, 0);
END;
$function$;

REVOKE ALL ON FUNCTION public.registrar_visita_inmueble(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_visita_inmueble(uuid) TO anon, authenticated, service_role;

-- 4) RPC: resumen general con KPIs, deltas vs periodo anterior, serie diaria y embudo
CREATE OR REPLACE FUNCTION public.admin_analytics_resumen(p_dias integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_dias        integer := GREATEST(1, LEAST(COALESCE(p_dias, 30), 365));
  v_desde       timestamptz := now() - (v_dias || ' days')::interval;
  v_prev_desde  timestamptz := v_desde - (v_dias || ' days')::interval;
  v_kpis   jsonb;
  v_prev   jsonb;
  v_serie  jsonb;
  v_funnel jsonb;
BEGIN
  IF NOT public._es_admin_o_service() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT jsonb_build_object(
    'pageviews',         (SELECT count(*) FROM public.eventos_web e WHERE e.tipo = 'pageview' AND e.creado_en >= v_desde),
    'sesiones',          (SELECT count(DISTINCT e.session_id) FROM public.eventos_web e WHERE e.creado_en >= v_desde AND e.session_id IS NOT NULL),
    'usuarios_unicos',   (SELECT count(DISTINCT e.user_id) FROM public.eventos_web e WHERE e.creado_en >= v_desde AND e.user_id IS NOT NULL),
    'registros',         (SELECT count(*) FROM public.perfiles p WHERE p.creado_en >= v_desde),
    'publicaciones',     (SELECT count(*) FROM public.inmuebles i WHERE i.creado_en >= v_desde),
    'mensajes',          (SELECT count(*) FROM public.mensajes m WHERE m.creado_en >= v_desde),
    'conversaciones',    (SELECT count(*) FROM public.conversaciones c WHERE c.creado_en >= v_desde),
    'favoritos',         (SELECT count(*) FROM public.favoritos f WHERE f.creado_en >= v_desde),
    'busquedas',         (SELECT count(*) FROM public.eventos_web e WHERE e.tipo = 'busqueda' AND e.creado_en >= v_desde),
    'contactos',         (SELECT count(*) FROM public.eventos_web e WHERE e.tipo = 'contacto' AND e.creado_en >= v_desde),
    'vistas_inmuebles',  (SELECT count(*) FROM public.eventos_web e WHERE e.tipo = 'vista_inmueble' AND e.creado_en >= v_desde),
    'compras',           (SELECT count(*) FROM public.transacciones_creditos t WHERE t.tipo = 'compra' AND t.estado = 'aprobado' AND t.creado_en >= v_desde),
    'ingresos_usd',      (SELECT COALESCE(sum(t.precio_usd), 0) FROM public.transacciones_creditos t WHERE t.tipo = 'compra' AND t.estado = 'aprobado' AND t.creado_en >= v_desde),
    'creditos_vendidos', (SELECT COALESCE(sum(t.monto), 0) FROM public.transacciones_creditos t WHERE t.tipo = 'compra' AND t.estado = 'aprobado' AND t.creado_en >= v_desde)
  ) INTO v_kpis;

  SELECT jsonb_build_object(
    'pageviews',     (SELECT count(*) FROM public.eventos_web e WHERE e.tipo = 'pageview' AND e.creado_en >= v_prev_desde AND e.creado_en < v_desde),
    'sesiones',      (SELECT count(DISTINCT e.session_id) FROM public.eventos_web e WHERE e.creado_en >= v_prev_desde AND e.creado_en < v_desde AND e.session_id IS NOT NULL),
    'registros',     (SELECT count(*) FROM public.perfiles p WHERE p.creado_en >= v_prev_desde AND p.creado_en < v_desde),
    'publicaciones', (SELECT count(*) FROM public.inmuebles i WHERE i.creado_en >= v_prev_desde AND i.creado_en < v_desde),
    'mensajes',      (SELECT count(*) FROM public.mensajes m WHERE m.creado_en >= v_prev_desde AND m.creado_en < v_desde),
    'compras',       (SELECT count(*) FROM public.transacciones_creditos t WHERE t.tipo = 'compra' AND t.estado = 'aprobado' AND t.creado_en >= v_prev_desde AND t.creado_en < v_desde),
    'ingresos_usd',  (SELECT COALESCE(sum(t.precio_usd), 0) FROM public.transacciones_creditos t WHERE t.tipo = 'compra' AND t.estado = 'aprobado' AND t.creado_en >= v_prev_desde AND t.creado_en < v_desde)
  ) INTO v_prev;

  SELECT COALESCE(jsonb_agg(row_to_json(s) ORDER BY s.fecha), '[]'::jsonb)
  INTO v_serie
  FROM (
    SELECT d::date AS fecha,
      (SELECT count(*) FROM public.eventos_web e WHERE e.tipo = 'pageview' AND e.creado_en::date = d::date) AS pageviews,
      (SELECT count(DISTINCT e.session_id) FROM public.eventos_web e WHERE e.creado_en::date = d::date AND e.session_id IS NOT NULL) AS sesiones,
      (SELECT count(*) FROM public.perfiles p WHERE p.creado_en::date = d::date) AS registros,
      (SELECT count(*) FROM public.inmuebles i WHERE i.creado_en::date = d::date) AS publicaciones,
      (SELECT count(*) FROM public.mensajes m WHERE m.creado_en::date = d::date) AS mensajes,
      (SELECT count(*) FROM public.favoritos f WHERE f.creado_en::date = d::date) AS favoritos,
      (SELECT count(*) FROM public.eventos_web e WHERE e.tipo = 'busqueda' AND e.creado_en::date = d::date) AS busquedas,
      (SELECT count(*) FROM public.eventos_web e WHERE e.tipo = 'contacto' AND e.creado_en::date = d::date) AS contactos,
      (SELECT count(*) FROM public.eventos_web e WHERE e.tipo = 'vista_inmueble' AND e.creado_en::date = d::date) AS vistas_inmuebles,
      (SELECT count(*) FROM public.transacciones_creditos t WHERE t.tipo = 'compra' AND t.estado = 'aprobado' AND t.creado_en::date = d::date) AS compras,
      (SELECT COALESCE(sum(t.precio_usd), 0) FROM public.transacciones_creditos t WHERE t.tipo = 'compra' AND t.estado = 'aprobado' AND t.creado_en::date = d::date) AS ingresos
    FROM generate_series(v_desde::date, now()::date, '1 day') AS d
  ) s;

  SELECT jsonb_build_object(
    'pageview_a_registro', CASE WHEN (SELECT count(*) FROM public.eventos_web e WHERE e.tipo='pageview' AND e.creado_en >= v_desde) > 0
      THEN round(100.0 * (SELECT count(*) FROM public.perfiles p WHERE p.creado_en >= v_desde) / (SELECT count(*) FROM public.eventos_web e WHERE e.tipo='pageview' AND e.creado_en >= v_desde), 2) ELSE 0 END,
    'registro_a_publicacion', CASE WHEN (SELECT count(*) FROM public.perfiles p WHERE p.creado_en >= v_desde) > 0
      THEN round(100.0 * (SELECT count(*) FROM public.inmuebles i WHERE i.creado_en >= v_desde) / (SELECT count(*) FROM public.perfiles p WHERE p.creado_en >= v_desde), 2) ELSE 0 END,
    'contacto_a_compra', CASE WHEN (SELECT count(*) FROM public.eventos_web e WHERE e.tipo='contacto' AND e.creado_en >= v_desde) > 0
      THEN round(100.0 * (SELECT count(*) FROM public.transacciones_creditos t WHERE t.tipo='compra' AND t.estado='aprobado' AND t.creado_en >= v_desde) / (SELECT count(*) FROM public.eventos_web e WHERE e.tipo='contacto' AND e.creado_en >= v_desde), 2) ELSE 0 END
  ) INTO v_funnel;

  RETURN jsonb_build_object(
    'dias', v_dias,
    'desde', v_desde,
    'hasta', now(),
    'kpis', v_kpis,
    'prev', v_prev,
    'serie', v_serie,
    'funnel', v_funnel
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_analytics_resumen(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_analytics_resumen(integer) TO anon, authenticated, service_role;

-- 5) RPC: tráfico (top páginas, referrers, UTM, búsquedas, dispositivos, países, horas)
CREATE OR REPLACE FUNCTION public.admin_analytics_trafico(p_dias integer DEFAULT 30, p_limite integer DEFAULT 10)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_dias   integer := GREATEST(1, LEAST(COALESCE(p_dias, 30), 365));
  v_lim    integer := GREATEST(1, LEAST(COALESCE(p_limite, 10), 50));
  v_desde  timestamptz := now() - (v_dias || ' days')::interval;
  resultado jsonb;
BEGIN
  IF NOT public._es_admin_o_service() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT jsonb_build_object(
    'top_rutas', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('ruta', x.ruta, 'views', x.views, 'sesiones', x.sesiones) ORDER BY x.views DESC), '[]'::jsonb)
      FROM (
        SELECT e.ruta, count(*) AS views, count(DISTINCT e.session_id) AS sesiones
        FROM public.eventos_web e
        WHERE e.tipo = 'pageview' AND e.creado_en >= v_desde
        GROUP BY e.ruta
        ORDER BY views DESC
        LIMIT v_lim
      ) x
    ),
    'top_referrers', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('fuente', x.fuente, 'views', x.views) ORDER BY x.views DESC), '[]'::jsonb)
      FROM (
        SELECT COALESCE(NULLIF(split_part(e.referrer, '/', 3), ''), 'directo') AS fuente, count(*) AS views
        FROM public.eventos_web e
        WHERE e.tipo = 'pageview' AND e.creado_en >= v_desde
        GROUP BY 1
        ORDER BY views DESC
        LIMIT v_lim
      ) x
    ),
    'top_utm_sources', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('source', x.source, 'medium', x.medium, 'campaign', x.campaign, 'views', x.views) ORDER BY x.views DESC), '[]'::jsonb)
      FROM (
        SELECT e.utm_source AS source, e.utm_medium AS medium, e.utm_campaign AS campaign, count(*) AS views
        FROM public.eventos_web e
        WHERE e.tipo = 'pageview' AND e.creado_en >= v_desde AND e.utm_source IS NOT NULL
        GROUP BY 1, 2, 3
        ORDER BY views DESC
        LIMIT v_lim
      ) x
    ),
    'top_busquedas', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('q', x.q, 'count', x.n) ORDER BY x.n DESC), '[]'::jsonb)
      FROM (
        SELECT NULLIF(btrim(e.meta ->> 'q'), '') AS q, count(*) AS n
        FROM public.eventos_web e
        WHERE e.tipo = 'busqueda' AND e.creado_en >= v_desde AND e.meta ->> 'q' IS NOT NULL
        GROUP BY 1
        HAVING NULLIF(btrim(e.meta ->> 'q'), '') IS NOT NULL
        ORDER BY n DESC
        LIMIT v_lim
      ) x
    ),
    'dispositivos', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('dispositivo', x.d, 'views', x.n) ORDER BY x.n DESC), '[]'::jsonb)
      FROM (
        SELECT COALESCE(e.dispositivo, 'otro') AS d, count(*) AS n
        FROM public.eventos_web e
        WHERE e.tipo = 'pageview' AND e.creado_en >= v_desde
        GROUP BY 1
      ) x
    ),
    'paises', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('pais', x.p, 'views', x.n) ORDER BY x.n DESC), '[]'::jsonb)
      FROM (
        SELECT COALESCE(e.pais, 'desconocido') AS p, count(*) AS n
        FROM public.eventos_web e
        WHERE e.tipo = 'pageview' AND e.creado_en >= v_desde
        GROUP BY 1
        ORDER BY n DESC
        LIMIT v_lim
      ) x
    ),
    'horas_pico', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('hora', x.h, 'views', x.n) ORDER BY x.h), '[]'::jsonb)
      FROM (
        SELECT extract(hour FROM e.creado_en AT TIME ZONE 'America/Caracas')::int AS h, count(*) AS n
        FROM public.eventos_web e
        WHERE e.tipo = 'pageview' AND e.creado_en >= v_desde
        GROUP BY 1
      ) x
    ),
    'navegadores', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('navegador', x.b, 'views', x.n) ORDER BY x.n DESC), '[]'::jsonb)
      FROM (
        SELECT COALESCE(e.navegador, 'otro') AS b, count(*) AS n
        FROM public.eventos_web e
        WHERE e.tipo = 'pageview' AND e.creado_en >= v_desde
        GROUP BY 1
        ORDER BY n DESC
        LIMIT v_lim
      ) x
    )
  ) INTO resultado;

  RETURN resultado;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_analytics_trafico(integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_analytics_trafico(integer, integer) TO anon, authenticated, service_role;

-- 6) RPC: usuarios (registros/actividad, geografía, planes, verificación)
CREATE OR REPLACE FUNCTION public.admin_analytics_usuarios(p_dias integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_dias   integer := GREATEST(1, LEAST(COALESCE(p_dias, 30), 365));
  v_desde  timestamptz := now() - (v_dias || ' days')::interval;
  resultado jsonb;
BEGIN
  IF NOT public._es_admin_o_service() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT jsonb_build_object(
    'total_usuarios', (SELECT count(*) FROM public.perfiles),
    'nuevos_periodo', (SELECT count(*) FROM public.perfiles p WHERE p.creado_en >= v_desde),
    'activos_periodo', (SELECT count(*) FROM public.perfiles p WHERE p.ultima_actividad >= v_desde),
    'verificados', (SELECT count(*) FROM public.perfiles p WHERE p.verificado),
    'serie', (
      SELECT COALESCE(jsonb_agg(row_to_json(s) ORDER BY s.fecha), '[]'::jsonb)
      FROM (
        SELECT d::date AS fecha,
          (SELECT count(*) FROM public.perfiles p WHERE p.creado_en::date = d::date) AS registros,
          (SELECT count(*) FROM public.eventos_web e WHERE e.tipo = 'login' AND e.creado_en::date = d::date) AS logins,
          (SELECT count(*) FROM public.perfiles p WHERE p.ultima_actividad::date = d::date) AS activos
        FROM generate_series(v_desde::date, now()::date, '1 day') AS d
      ) s
    ),
    'por_tipo_cuenta', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('tipo', COALESCE(x.t, 'sin_tipo'), 'n', x.n) ORDER BY x.n DESC), '[]'::jsonb)
      FROM (SELECT p.tipo_cuenta AS t, count(*) AS n FROM public.perfiles p GROUP BY 1) x
    ),
    'top_estados', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('estado', x.e, 'n', x.n) ORDER BY x.n DESC), '[]'::jsonb)
      FROM (SELECT COALESCE(NULLIF(btrim(p.estado), ''), 'Sin estado') AS e, count(*) AS n FROM public.perfiles p GROUP BY 1 ORDER BY n DESC LIMIT 10) x
    ),
    'top_ciudades', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('ciudad', x.c, 'n', x.n) ORDER BY x.n DESC), '[]'::jsonb)
      FROM (SELECT COALESCE(NULLIF(btrim(p.ciudad), ''), 'Sin ciudad') AS c, count(*) AS n FROM public.perfiles p GROUP BY 1 ORDER BY n DESC LIMIT 10) x
    ),
    'planes_activos', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('plan', x.plan, 'n', x.n) ORDER BY x.n DESC), '[]'::jsonb)
      FROM (SELECT COALESCE(s.plan, 'gratuito') AS plan, count(*) AS n
            FROM public.suscripciones s
            WHERE s.estado = 'activo' AND (s.fin IS NULL OR s.fin > now())
            GROUP BY 1) x
    ),
    'saldo_creditos', jsonb_build_object(
      'total', (SELECT COALESCE(sum(p.credito_balance), 0) FROM public.perfiles p),
      'promedio', (SELECT COALESCE(round(avg(p.credito_balance), 2), 0) FROM public.perfiles p),
      'usuarios_con_creditos', (SELECT count(*) FROM public.perfiles p WHERE p.credito_balance > 0)
    )
  ) INTO resultado;

  RETURN resultado;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_analytics_usuarios(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_analytics_usuarios(integer) TO anon, authenticated, service_role;

-- 7) RPC: contenido y moderación (publicaciones, mensajes, favoritos, top inmuebles)
CREATE OR REPLACE FUNCTION public.admin_analytics_contenido(p_dias integer DEFAULT 30, p_limite integer DEFAULT 10)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_dias   integer := GREATEST(1, LEAST(COALESCE(p_dias, 30), 365));
  v_lim    integer := GREATEST(1, LEAST(COALESCE(p_limite, 10), 50));
  v_desde  timestamptz := now() - (v_dias || ' days')::interval;
  resultado jsonb;
BEGIN
  IF NOT public._es_admin_o_service() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT jsonb_build_object(
    'serie_publicaciones', (
      SELECT COALESCE(jsonb_agg(row_to_json(s) ORDER BY s.fecha), '[]'::jsonb)
      FROM (
        SELECT d::date AS fecha,
          (SELECT count(*) FROM public.inmuebles i WHERE i.creado_en::date = d::date) AS creadas,
          (SELECT count(*) FROM public.inmuebles i WHERE i.creado_en::date = d::date AND i.estado_moderacion = 'aprobado') AS aprobadas,
          (SELECT count(*) FROM public.inmuebles i WHERE i.creado_en::date = d::date AND i.estado_moderacion = 'rechazado') AS rechazadas,
          (SELECT count(*) FROM public.mensajes m WHERE m.creado_en::date = d::date) AS mensajes,
          (SELECT count(*) FROM public.favoritos f WHERE f.creado_en::date = d::date) AS favoritos
        FROM generate_series(v_desde::date, now()::date, '1 day') AS d
      ) s
    ),
    'por_estado', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('estado', x.e, 'total', x.total, 'activas', x.activas) ORDER BY x.total DESC), '[]'::jsonb)
      FROM (
        SELECT COALESCE(NULLIF(btrim(i.estado), ''), 'Sin estado') AS e,
               count(*) AS total,
               count(*) FILTER (WHERE i.activo AND NOT i.vendido) AS activas
        FROM public.inmuebles i
        WHERE i.creado_en >= v_desde
        GROUP BY 1 ORDER BY total DESC LIMIT v_lim
      ) x
    ),
    'por_ciudad', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('ciudad', x.c, 'total', x.total, 'activas', x.activas) ORDER BY x.total DESC), '[]'::jsonb)
      FROM (
        SELECT COALESCE(NULLIF(btrim(i.ciudad), ''), 'Sin ciudad') AS c,
               count(*) AS total,
               count(*) FILTER (WHERE i.activo AND NOT i.vendido) AS activas
        FROM public.inmuebles i
        WHERE i.creado_en >= v_desde
        GROUP BY 1 ORDER BY total DESC LIMIT v_lim
      ) x
    ),
    'por_tipo', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('tipo', x.t, 'n', x.n) ORDER BY x.n DESC), '[]'::jsonb)
      FROM (
        SELECT COALESCE(t.nombre, 'Otro') AS t, count(*) AS n
        FROM public.inmuebles i LEFT JOIN public.tipos_inmueble t ON t.id = i.tipo_id
        WHERE i.creado_en >= v_desde
        GROUP BY 1 ORDER BY n DESC LIMIT v_lim
      ) x
    ),
    'por_operacion', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('operacion', x.o, 'n', x.n) ORDER BY x.n DESC), '[]'::jsonb)
      FROM (
        SELECT COALESCE(o.nombre, 'Otra') AS o, count(*) AS n
        FROM public.inmuebles i LEFT JOIN public.operaciones o ON o.id = i.operacion_id
        WHERE i.creado_en >= v_desde
        GROUP BY 1 ORDER BY n DESC
      ) x
    ),
    'moderacion', jsonb_build_object(
      'pendientes', (SELECT count(*) FROM public.inmuebles i WHERE i.estado_moderacion = 'pendiente'),
      'aprobadas_periodo', (SELECT count(*) FROM public.inmuebles i WHERE i.estado_moderacion = 'aprobado' AND i.creado_en >= v_desde),
      'rechazadas_periodo', (SELECT count(*) FROM public.inmuebles i WHERE i.estado_moderacion = 'rechazado' AND i.creado_en >= v_desde),
      'tiempo_medio_moderacion_min', (
        SELECT COALESCE(round(avg(extract(epoch FROM (i.actualizado_en - i.creado_en)) / 60)::numeric, 1), 0)
        FROM public.inmuebles i
        WHERE i.estado_moderacion <> 'pendiente' AND i.creado_en >= v_desde
      )
    ),
    'top_inmuebles_vistos', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'inmueble_id', ev.inmueble_id::text, 'titulo', COALESCE(i.titulo, '(eliminado)'), 'views', ev.views, 'ruta', ev.ruta
      ) ORDER BY ev.views DESC), '[]'::jsonb)
      FROM (
        SELECT (e.meta ->> 'inmueble_id')::uuid AS inmueble_id,
               MAX(e.ruta) AS ruta,
               count(*) AS views
        FROM public.eventos_web e
        WHERE e.tipo = 'vista_inmueble' AND e.creado_en >= v_desde AND e.meta ->> 'inmueble_id' ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        GROUP BY 1
        ORDER BY views DESC
        LIMIT v_lim
      ) ev
      LEFT JOIN public.inmuebles i ON i.id = ev.inmueble_id
    ),
    'top_vendedores_mensajes', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'user_id', v.user_id::text, 'nombre', COALESCE(p.nombre, 'Sin nombre'),
        'mensajes_recibidos', v.n, 'propiedades', COALESCE(ip.props, 0)
      ) ORDER BY v.n DESC), '[]'::jsonb)
      FROM (
        SELECT m.destinatario_id AS user_id, count(*) AS n
        FROM public.mensajes m
        WHERE m.creado_en >= v_desde
        GROUP BY 1 ORDER BY n DESC LIMIT v_lim
      ) v
      LEFT JOIN public.perfiles p ON p.id = v.user_id
      LEFT JOIN LATERAL (
        SELECT count(*) AS props FROM public.inmuebles i WHERE i.usuario_id = v.user_id
      ) ip ON true
    ),
    'chat', jsonb_build_object(
      'conversaciones_periodo', (SELECT count(*) FROM public.conversaciones c WHERE c.creado_en >= v_desde),
      'mensajes_periodo', (SELECT count(*) FROM public.mensajes m WHERE m.creado_en >= v_desde),
      'mensajes_no_leidos', (SELECT count(*) FROM public.mensajes m WHERE NOT m.leido),
      'tasa_respuesta_pct', (
        SELECT CASE WHEN (SELECT count(*) FROM public.conversaciones) = 0 THEN 0
          ELSE round(100.0 * (SELECT count(*) FROM (
            SELECT m.conversacion_id FROM public.mensajes m GROUP BY m.conversacion_id HAVING count(*) >= 2
          ) r) / (SELECT count(*) FROM public.conversaciones), 1) END
      )
    ),
    'favoritos_periodo', (SELECT count(*) FROM public.favoritos f WHERE f.creado_en >= v_desde),
    'contactos_periodo', (SELECT count(*) FROM public.eventos_web e WHERE e.tipo = 'contacto' AND e.creado_en >= v_desde)
  ) INTO resultado;

  RETURN resultado;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_analytics_contenido(integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_analytics_contenido(integer, integer) TO anon, authenticated, service_role;

-- 8) RPC: actividad reciente unificada (auditoría + eventos de alto valor) ----
CREATE OR REPLACE FUNCTION public.admin_analytics_actividad(p_limite integer DEFAULT 50)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_lim integer := GREATEST(1, LEAST(COALESCE(p_limite, 50), 200));
  resultado jsonb;
BEGIN
  IF NOT public._es_admin_o_service() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(x) ORDER BY x.fecha DESC), '[]'::jsonb)
  INTO resultado
  FROM (
    SELECT a.fecha_registro AS fecha, 'auditoria' AS tipo,
           a.operacion || ' en ' || a.tabla_afectada AS descripcion,
           COALESCE(p.nombre, p.email, a.usuario_id::text) AS usuario
    FROM public.auditoria a
    LEFT JOIN public.perfiles p ON p.id = a.usuario_id
    UNION ALL
    SELECT e.creado_en AS fecha, e.tipo AS tipo,
           CASE e.tipo
             WHEN 'registro' THEN 'Nuevo usuario registrado'
             WHEN 'publicacion_creada' THEN 'Publicación creada: ' || COALESCE(e.titulo, e.ruta)
             WHEN 'compra_creditos' THEN 'Compra de créditos: $' || COALESCE((e.meta ->> 'precio_usd'), '0')
             WHEN 'contacto' THEN 'Mensaje de contacto enviado'
             WHEN 'mensaje_enviado' THEN 'Mensaje enviado en chat'
             ELSE e.tipo
           END AS descripcion,
           e.user_id::text AS usuario
    FROM public.eventos_web e
    WHERE e.tipo IN ('registro', 'publicacion_creada', 'compra_creditos', 'contacto')
    ORDER BY fecha DESC
    LIMIT v_lim
  ) x;

  RETURN resultado;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_analytics_actividad(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_analytics_actividad(integer) TO anon, authenticated, service_role;

-- 9) Retención: limpia eventos de más de 180 días ------------------------------
CREATE OR REPLACE FUNCTION public.limpiar_eventos_antiguos()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  eliminados integer;
BEGIN
  IF NOT public._es_admin_o_service() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  DELETE FROM public.eventos_web WHERE creado_en < now() - interval '180 days';
  GET DIAGNOSTICS eliminados = ROW_COUNT;
  RETURN eliminados;
END;
$function$;

REVOKE ALL ON FUNCTION public.limpiar_eventos_antiguos() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.limpiar_eventos_antiguos() TO authenticated, service_role;
