# Correos de notificación

## Avisos de mensajes de chat (diferidos)

Cuando alguien envía un mensaje, **no se envía un correo inmediatamente**. El
sistema funciona así:

1. El trigger `mensajes_encolar_email` (migración `006_notificaciones_email.sql`)
   crea un aviso pendiente en `public.notificaciones_email` programado para
   **10 minutos después**.
2. Si llegan más mensajes en la misma conversación, el aviso se **reagrupa** y
   el plazo se reinicia: un solo correo por ráfaga, nunca uno por mensaje.
3. Si el destinatario **abre la conversación y los mensajes se marcan como
   leídos**, el trigger `mensajes_cancelar_email` cancela el aviso pendiente.
4. Al cumplirse el plazo, el cron `/api/cron/notificaciones-email` comprueba que
   sigan existiendo mensajes **sin leer y sin anunciar** y envía un único correo
   profesional con:
   - nombre de quien escribió,
   - título, ubicación, precio e imagen del inmueble,
   - extracto del último mensaje,
   - número de mensajes sin leer,
   - botón **Leer y responder** (abre el chat),
   - enlace de baja en un clic (`List-Unsubscribe`).
5. Nunca se envían dos correos de chat al mismo usuario en menos de **30
   minutos**; si corresponde, el aviso se reprograma 15 minutos.

Los mensajes que ya se anunciaron en un correo se marcan con
`mensajes.email_notificado_en`, así que un correo posterior sólo menciona
mensajes nuevos.

### Puesta en marcha

1. La migración `supabase/migrations/006_notificaciones_email.sql` ya está
   aplicada al proyecto Supabase `quxbqmqwiacfwbpqioev` (2026-10-31). En un
   entorno nuevo, aplícala desde el SQL Editor o con `supabase db push`.
2. Define `CRON_SECRET` en Vercel (Production y, si usas previews, también
   Preview/Development) y vuelve a desplegar.
3. La ruta queda programada cada 5 minutos con Supabase `pg_cron` + `pg_net`
   (ya creado en este proyecto, ver abajo). No hace falta un cron de Vercel.

El plazo se puede cambiar sin tocar código, a nivel de base de datos:

```sql
ALTER DATABASE postgres SET app.chat_email_delay_minutes = '10';
```

> Nota: los mensajes anteriores a la migración se marcan como ya anunciados, así
> que no se generan correos retroactivos.

### Programación del cron

**Supabase pg_cron + pg_net (recomendado, ya activo).** Se ejecuta cada 5
minutos dentro de Supabase y llama al endpoint con la cabecera
`Authorization: Bearer $CRON_SECRET`. Script reproducible:
`supabase/cron/notificaciones_email_pg_cron.sql`.

```sql
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'notificaciones-email-chat',
  '*/5 * * * *',
  $job$select net.http_get(
    url := 'https://venezuela-inmuebles.online/api/cron/notificaciones-email',
    headers := jsonb_build_object('Authorization', 'Bearer TU_CRON_SECRET')
  )$job$
);
```

Comprobación: `select jobid, jobname, schedule, active from cron.job;` y
`select id, status_code, error_message from net._http_response order by id desc limit 5;`
(debe devolver `200` tras desplegar).

**Vercel Cron (respaldo diario).** En `vercel.json` queda una ejecución diaria
a las 09:00 UTC, porque el plan Hobby sólo permite crons diarios. En Vercel Pro
puedes cambiar la expresión a `*/5 * * * *`.

**Cron externo (alternativa).** Cualquier servicio que haga una petición GET
cada 5 minutos con `Authorization: Bearer $CRON_SECRET` sirve (cron-job.org,
EasyCron, etc.). No compartas el secreto en la URL si puedes usar la cabecera.

También puede invocarse manualmente:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://venezuela-inmuebles.online/api/cron/notificaciones-email
```

La respuesta incluye cuántos avisos se procesaron, enviaron, cancelaron,
reprogramaron o fallaron, y cuántos registros antiguos se limpiaron.

Para inspeccionar la cola:

```sql
select id, user_id, tipo, clave, estado, programado_para, enviado_en, intentos, ultimo_error
from public.notificaciones_email
order by creado_en desc
limit 20;
```

### Preferencias del usuario

Cada correo de chat incluye un enlace firmado de baja
(`/api/email/baja?token=…`) y la cabecera `List-Unsubscribe` con baja en un
clic. La preferencia se guarda en `perfiles.email_notificaciones`. Los avisos
**transaccionales** (pagos, verificación, moderación) se envían siempre.
`EMAIL_PREFERENCES_SECRET` es opcional: si no se define se usa
`SUPABASE_SERVICE_ROLE_KEY` para firmar los tokens.

## Correos de autenticación (Supabase Auth)

Los correos que envía Supabase Auth —confirmación de cuenta, recuperación de
contraseña, cambio de correo, enlace mágico, invitación, reautenticación y
avisos de seguridad— usan plantillas propias con la identidad visual del sitio
(azul marino, dorado, logotipo y pie de contacto).

- Fuente y guía de aplicación: [`supabase/email-templates/README.md`](supabase/email-templates/README.md).
- Las 13 plantillas están en `supabase/email-templates/*.html` y los asuntos en
  `subjects.json`.
- Se aplican con `scripts/apply-auth-email-templates.mjs` (Management API) o
  pegándolas en **Authentication → Emails → Templates**.
- Los avisos de seguridad vienen desactivados por defecto en Supabase; hay que
  activarlos en **Authentication → Emails → Security notifications**.
- No salen de `src/lib/server-email.ts`: los envía Supabase Auth por el SMTP de
  Resend configurado en el proyecto.

## Correos transaccionales (eventos importantes)

| Evento | Cuándo se envía | Plantilla |
| --- | --- | --- |
| Anuncio publicado | Inmediatamente al publicar (`/api/publicar`) | `emailProductoPublicado` |
| Anuncio en revisión | Al publicar y quedar pendiente de moderación | `emailPropiedadEnRevision` |
| Anuncio aprobado / rechazado | Al decidir en el panel de administración | `emailPropiedadAprobada` / `emailPropiedadRechazada` |
| Cuenta verificada / revocada | Al aprobar o revocar la verificación | `emailVerificacionAprobada` / `emailVerificacionRevocada` |
| Créditos añadidos | Pago aprobado (panel admin o Telegram) | `emailCreditosAgregados` |
| Compra de créditos rechazada | Pago rechazado desde Telegram | `emailCreditosRechazados` |
| Reseña recibida | Al enviar una reseña entre comprador y vendedor | `emailResenaRecibida` |
| Anuncio destacado / con impulso | Al aplicar destacado o boost desde admin | `emailPropiedadDestacada` / `emailPropiedadBoost` |
| Inmueble marcado como vendido | Al marcarlo el vendedor | `emailPropiedadVendida` |

Todas las plantillas usan el layout común (`src/lib/server-email.ts`), escapan
el contenido escrito por usuarios y no bloquean la acción principal si SMTP
falla.
