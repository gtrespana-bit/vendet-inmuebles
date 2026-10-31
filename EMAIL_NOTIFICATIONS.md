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
2. Define `CRON_SECRET` en Vercel (Production, Preview y Development).
3. Programar la ruta cada 5 minutos (ver abajo).

El plazo se puede cambiar sin tocar código, a nivel de base de datos:

```sql
ALTER DATABASE postgres SET app.chat_email_delay_minutes = '10';
```

> Nota: los mensajes anteriores a la migración se marcan como ya anunciados, así
> que no se generan correos retroactivos.

### Programación del cron

**Vercel Cron** (incluido en `vercel.json`, cada 5 minutos):

```json
{ "crons": [{ "path": "/api/cron/notificaciones-email", "schedule": "*/5 * * * *" }] }
```

Vercel añade automáticamente `Authorization: Bearer $CRON_SECRET` cuando la
variable existe. Los planes Hobby sólo permiten crons diarios; en ese caso usa
un programador externo o `pg_cron`.

**Supabase pg_cron + pg_net** (alternativa, cada 5 minutos):

```sql
-- Requiere las extensiones pg_cron y pg_net.
select cron.schedule(
  'notificaciones-email',
  '*/5 * * * *',
  $$
    select net.http_get(
      url := 'https://venezuela-inmuebles.online/api/cron/notificaciones-email?secret=TU_CRON_SECRET'
    );
  $$
);
```

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
