-- ============================================================================
-- 006 · Notificaciones por correo
--
-- 1) Preferencia por usuario para avisos de actividad (chat). Los correos
--    transaccionales (pagos, verificación, moderación) se envían siempre.
-- 2) Cola `notificaciones_email`: permite programar avisos diferidos sin
--    depender del navegador de nadie. El envío real lo hace
--    /api/cron/notificaciones-email (SMTP).
-- 3) Triggers de mensajes:
--      - al recibir un mensaje se programa un aviso para 10 minutos después;
--        si llegan más mensajes en la misma conversación, se agrupan en un
--        único correo y el plazo se reinicia (nunca se envía en el mismo
--        segundo y nunca se envía un correo por cada mensaje);
--      - al leerse los mensajes, el aviso pendiente se cancela.
-- 4) `mensajes.email_notificado_en` evita repetir en un correo mensajes que ya
--    fueron anunciados antes.
-- ============================================================================

-- 1) Preferencias -----------------------------------------------------------
ALTER TABLE public.perfiles
  ADD COLUMN IF NOT EXISTS email_notificaciones boolean NOT NULL DEFAULT true;

-- 4) Control de mensajes ya anunciados --------------------------------------
ALTER TABLE public.mensajes
  ADD COLUMN IF NOT EXISTS email_notificado_en timestamptz;

-- 2) Cola -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notificaciones_email (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  -- Clave de agrupación. Para el chat: 'mensaje:<conversacion_id>'.
  clave text NOT NULL,
  estado text NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'enviado', 'cancelado', 'error')),
  programado_para timestamptz NOT NULL DEFAULT now(),
  enviado_en timestamptz,
  intentos smallint NOT NULL DEFAULT 0 CHECK (intentos >= 0),
  ultimo_error text,
  datos jsonb NOT NULL DEFAULT '{}'::jsonb,
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

-- Sólo puede haber un aviso pendiente por usuario y clave.
CREATE UNIQUE INDEX IF NOT EXISTS ux_notificaciones_email_pendiente
  ON public.notificaciones_email (user_id, clave)
  WHERE estado = 'pendiente';

CREATE INDEX IF NOT EXISTS idx_notificaciones_email_procesables
  ON public.notificaciones_email (estado, programado_para)
  WHERE estado = 'pendiente';

CREATE INDEX IF NOT EXISTS idx_notificaciones_email_historial
  ON public.notificaciones_email (user_id, tipo, enviado_en DESC);

-- Cola interna: nadie excepto service_role puede leerla ni escribirla.
ALTER TABLE public.notificaciones_email ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notificaciones_email FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notificaciones_email TO service_role;

-- 3) Utilidades -------------------------------------------------------------

-- Retardo configurable sin tocar código:
--   ALTER DATABASE postgres SET app.chat_email_delay_minutes = '10';
CREATE OR REPLACE FUNCTION public.chat_email_delay_minutes()
RETURNS interval
LANGUAGE sql
STABLE
SET search_path TO 'pg_catalog', 'public'
AS $$
  SELECT make_interval(mins => GREATEST(
    COALESCE(NULLIF(current_setting('app.chat_email_delay_minutes', true), '')::int, 10),
    1
  ));
$$;

REVOKE ALL ON FUNCTION public.chat_email_delay_minutes() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.chat_email_delay_minutes() TO service_role;

-- Programa (o reprograma) el aviso de mensajes no leídos de una conversación.
CREATE OR REPLACE FUNCTION public.encolar_email_mensaje()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'pg_catalog', 'public'
AS $$
DECLARE
  v_clave text := 'mensaje:' || NEW.conversacion_id::text;
  v_programado timestamptz := clock_timestamp() + public.chat_email_delay_minutes();
BEGIN
  INSERT INTO public.notificaciones_email AS ne (user_id, tipo, clave, programado_para, datos)
  VALUES (
    NEW.destinatario_id,
    'mensaje',
    v_clave,
    v_programado,
    jsonb_build_object(
      'conversacion_id', NEW.conversacion_id,
      'producto_id', NEW.producto_id,
      'ultimo_mensaje_id', NEW.id,
      'ultimo_mensaje_en', NEW.creado_en
    )
  )
  ON CONFLICT (user_id, clave) WHERE estado = 'pendiente'
  DO UPDATE SET
    -- Se reinicia el plazo con cada mensaje nuevo: un correo por ráfaga.
    programado_para = EXCLUDED.programado_para,
    actualizado_en = now(),
    datos = ne.datos || EXCLUDED.datos;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mensajes_encolar_email ON public.mensajes;
CREATE TRIGGER mensajes_encolar_email
  AFTER INSERT ON public.mensajes
  FOR EACH ROW EXECUTE FUNCTION public.encolar_email_mensaje();

-- Si el destinatario lee la conversación antes del envío, se cancela el aviso.
CREATE OR REPLACE FUNCTION public.cancelar_email_mensaje_leido()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'pg_catalog', 'public'
AS $$
BEGIN
  IF NEW.leido AND NOT OLD.leido THEN
    UPDATE public.notificaciones_email
       SET estado = 'cancelado',
           actualizado_en = now(),
           datos = datos || jsonb_build_object('motivo', 'leido')
     WHERE user_id = NEW.destinatario_id
       AND clave = 'mensaje:' || NEW.conversacion_id::text
       AND estado = 'pendiente';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mensajes_cancelar_email ON public.mensajes;
CREATE TRIGGER mensajes_cancelar_email
  AFTER UPDATE OF leido ON public.mensajes
  FOR EACH ROW EXECUTE FUNCTION public.cancelar_email_mensaje_leido();

-- Los mensajes anteriores a esta migración no deben generar correos
-- retroactivos: sólo los mensajes nuevos entran en el circuito de avisos.
UPDATE public.mensajes
   SET email_notificado_en = COALESCE(email_notificado_en, creado_en)
 WHERE email_notificado_en IS NULL;

-- ============================================================================
-- Programación del envío (opcional, recomendado en producción)
--
-- El envío de correos lo ejecuta la ruta /api/cron/notificaciones-email.
-- Programación recomendada cada 5 minutos, por ejemplo con Vercel Cron
-- (ver vercel.json) o con Supabase pg_cron + pg_net (ver SUPABASE_SETUP.md).
-- ============================================================================
