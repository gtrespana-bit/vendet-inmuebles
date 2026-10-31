-- ============================================================================
-- Programación del envío de correos con Supabase (pg_cron + pg_net)
--
-- Pensado para proyectos en Vercel Hobby, donde los crons de Vercel sólo
-- pueden ejecutarse una vez al día. pg_cron se ejecuta dentro de Supabase y
-- llama al endpoint cada 5 minutos.
--
-- Requisito: el endpoint necesita que `CRON_SECRET` exista en Vercel y que su
-- valor coincida con el que se escribe aquí abajo.
--
-- En este proyecto ya está programado. Este archivo sirve para recrearlo o
-- para replicarlo en otro entorno.
-- ============================================================================

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- Elimina una programación previa con el mismo nombre (si existe).
do $$
begin
  perform cron.unschedule('notificaciones-email-chat');
exception
  when others then null;
end $$;

select cron.schedule(
  'notificaciones-email-chat',
  '*/5 * * * *',
  $job$select net.http_get(
    url := 'https://venezuela-inmuebles.online/api/cron/notificaciones-email',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer REEMPLAZA_CON_TU_CRON_SECRET'
    )
  )$job$
);

-- Comprobaciones útiles:
--   select jobid, jobname, schedule, active from cron.job;
--   select id, status_code, error_msg from net._http_response order by id desc limit 5;
