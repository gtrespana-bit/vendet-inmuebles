-- 014 · Corrección de permisos de las vistas de privacidad (F05)
--
-- 013 aplicó las reglas de privacidad, pero la vista `vw_propiedades_publicas`
-- llamaba a `telefono_visible_anuncio` y el rol `anon` recibía
-- «permission denied for function telefono_visible_anuncio» al leer la ficha
-- pública: PostgreSQL comprueba EXECUTE con el rol que ejecuta la consulta, no
-- con el propietario de la vista (security_invoker = false solo afecta al
-- acceso a tablas).
--
-- Correcciones:
--   1. `telefono_visible_anuncio` es una función pura (solo mira el jsonb que
--      recibe, no lee tablas): se concede EXECUTE a anon y authenticated.
--   2. El perfil público deja de usar `perfil_admite_contacto_telefonico`
--      (SECURITY DEFINER sobre inmuebles) y resuelve la condición con un
--      EXISTS dentro de la propia vista. Esa función se elimina para no dejar
--      una RPC interna expuesta ni sin uso.
--
-- Sin cambios de datos y sin cambios en las columnas de las vistas.

BEGIN;

GRANT EXECUTE ON FUNCTION public.telefono_visible_anuncio(jsonb) TO anon, authenticated;

CREATE OR REPLACE VIEW public.vw_perfiles_publicos
WITH (security_barrier = true, security_invoker = false)
AS
SELECT
  p.id,
  p.nombre,
  CASE WHEN p.id = auth.uid() OR public.is_admin() OR EXISTS (
    SELECT 1 FROM public.inmuebles i
    WHERE i.usuario_id = p.id
      AND i.activo AND NOT i.vendido AND i.estado_moderacion = 'aprobado'
      AND public.telefono_visible_anuncio(i.metodos_contacto)
  ) THEN p.telefono END AS telefono,
  p.estado,
  p.ciudad,
  p.foto_perfil_url,
  p.email_visible AS email_disponible,
  CASE WHEN p.email_visible THEN p.email ELSE NULL END AS email_publico,
  (p.telefono IS NOT NULL AND btrim(p.telefono) <> ''
    AND (p.id = auth.uid() OR public.is_admin() OR EXISTS (
      SELECT 1 FROM public.inmuebles i
      WHERE i.usuario_id = p.id
        AND i.activo AND NOT i.vendido AND i.estado_moderacion = 'aprobado'
        AND public.telefono_visible_anuncio(i.metodos_contacto)
    ))) AS telefono_disponible,
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
  (SELECT count(*)::integer FROM public.inmuebles i
    WHERE i.usuario_id = p.id AND i.vendido) AS total_vendidas,
  greatest(0, floor(extract(epoch FROM (now() - p.creado_en)) / 86400))::integer AS antiguedad_dias
FROM public.perfiles p
WHERE p.verificado OR EXISTS (
  SELECT 1 FROM public.inmuebles i
  WHERE i.usuario_id = p.id
    AND i.activo
    AND NOT i.vendido
    AND i.estado_moderacion = 'aprobado'
);

COMMENT ON VIEW public.vw_perfiles_publicos IS
  'Perfil público del vendedor. El teléfono solo se publica si alguna de sus publicaciones permite contacto telefónico.';
GRANT SELECT ON public.vw_perfiles_publicos TO anon, authenticated, service_role;

-- Solo después de reemplazar la vista la función deja de tener dependientes.
DROP FUNCTION IF EXISTS public.perfil_admite_contacto_telefonico(uuid);

COMMIT;
