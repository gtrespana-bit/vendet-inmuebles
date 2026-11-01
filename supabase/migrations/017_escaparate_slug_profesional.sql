-- ============================================================
-- 017: Escaparate con URL personalizada (F12)
-- - Añade `perfiles.slug` único (minúsculas, 3–50 caracteres, guiones simples)
-- - Expone `p.slug` al final de `public.vw_perfiles_publicos` conservando
--   íntegramente las reglas de privacidad y el orden exacto de columnas de 013/014
-- ============================================================

ALTER TABLE public.perfiles
  ADD COLUMN IF NOT EXISTS slug text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'perfiles_slug_formato_chk'
       AND conrelid = 'public.perfiles'::regclass
  ) THEN
    ALTER TABLE public.perfiles
      ADD CONSTRAINT perfiles_slug_formato_chk
      CHECK (slug IS NULL OR slug ~ '^[a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])$');
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_perfiles_slug_unique
  ON public.perfiles (lower(slug))
  WHERE slug IS NOT NULL;

CREATE OR REPLACE VIEW public.vw_perfiles_publicos
WITH (security_barrier = true, security_invoker = false) AS
SELECT
  p.id,
  p.nombre,
  CASE
    WHEN p.id = auth.uid() OR public.is_admin() OR (EXISTS (
      SELECT 1
        FROM public.inmuebles i
       WHERE i.usuario_id = p.id
         AND i.activo
         AND NOT i.vendido
         AND i.estado_moderacion = 'aprobado'::text
         AND public.telefono_visible_anuncio(i.metodos_contacto)
    )) THEN p.telefono
    ELSE NULL::text
  END AS telefono,
  p.estado,
  p.ciudad,
  p.foto_perfil_url,
  p.email_visible AS email_disponible,
  CASE
    WHEN p.email_visible THEN p.email
    ELSE NULL::text
  END AS email_publico,
  p.telefono IS NOT NULL AND btrim(p.telefono) <> ''::text AND (
    p.id = auth.uid() OR public.is_admin() OR (EXISTS (
      SELECT 1
        FROM public.inmuebles i
       WHERE i.usuario_id = p.id
         AND i.activo
         AND NOT i.vendido
         AND i.estado_moderacion = 'aprobado'::text
         AND public.telefono_visible_anuncio(i.metodos_contacto)
    ))
  ) AS telefono_disponible,
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
  (
    SELECT count(*)::integer
      FROM public.inmuebles i
     WHERE i.usuario_id = p.id
       AND i.vendido
  ) AS total_vendidas,
  GREATEST(0::numeric, floor(EXTRACT(epoch FROM now() - p.creado_en) / 86400::numeric))::integer AS antiguedad_dias,
  p.slug
FROM public.perfiles p
WHERE p.verificado OR (EXISTS (
  SELECT 1
    FROM public.inmuebles i
   WHERE i.usuario_id = p.id
     AND i.activo
     AND NOT i.vendido
     AND i.estado_moderacion = 'aprobado'::text
));

GRANT SELECT ON public.vw_perfiles_publicos TO anon, authenticated;
