# Correos de autenticación con la marca Venezuela Inmuebles

Plantillas HTML para reemplazar los correos genéricos de Supabase Auth (confirmación de cuenta, recuperación de contraseña, cambio de correo, enlace mágico, invitación, reautenticación y avisos de seguridad).

Usan la identidad visual del sitio:

- Azul marino `#16294B` y dorado `#B08542`.
- Fondo crema `#F4F1E9`, tarjeta blanca y tipografía serif en los títulos.
- Logotipo oficial: `https://venezuela-inmuebles.online/logo-venezuela-inmuebles.png`.
- Pie con el nombre del sitio, el correo de contacto y el enlace a `venezuela-inmuebles.online`.
- Diseño con tablas y estilos inline (~600 px), compatible con Gmail, Outlook, Apple Mail y móvil.

## Archivos

| Plantilla de Supabase | Archivo | Asunto |
| --- | --- | --- |
| `confirmation` | [`confirmation.html`](./confirmation.html) | Confirma tu correo · Venezuela Inmuebles |
| `email_change` | [`email_change.html`](./email_change.html) | Confirma tu nuevo correo · Venezuela Inmuebles |
| `invite` | [`invite.html`](./invite.html) | Te invitaron a Venezuela Inmuebles |
| `magic_link` | [`magic_link.html`](./magic_link.html) | Tu enlace de acceso · Venezuela Inmuebles |
| `reauthentication` | [`reauthentication.html`](./reauthentication.html) | Tu código de verificación: `{{ .Token }}` |
| `recovery` | [`recovery.html`](./recovery.html) | Restablece tu contraseña · Venezuela Inmuebles |
| `password_changed_notification` | [`password_changed_notification.html`](./password_changed_notification.html) | Tu contraseña fue actualizada · Venezuela Inmuebles |
| `email_changed_notification` | [`email_changed_notification.html`](./email_changed_notification.html) | Tu correo fue actualizado · Venezuela Inmuebles |
| `phone_changed_notification` | [`phone_changed_notification.html`](./phone_changed_notification.html) | Tu teléfono fue actualizado · Venezuela Inmuebles |
| `mfa_factor_enrolled_notification` | [`mfa_factor_enrolled_notification.html`](./mfa_factor_enrolled_notification.html) | Se añadió un método de verificación · Venezuela Inmuebles |
| `mfa_factor_unenrolled_notification` | [`mfa_factor_unenrolled_notification.html`](./mfa_factor_unenrolled_notification.html) | Se eliminó un método de verificación · Venezuela Inmuebles |
| `identity_linked_notification` | [`identity_linked_notification.html`](./identity_linked_notification.html) | Se vinculó un nuevo método de acceso · Venezuela Inmuebles |
| `identity_unlinked_notification` | [`identity_unlinked_notification.html`](./identity_unlinked_notification.html) | Se eliminó un método de acceso · Venezuela Inmuebles |

`subjects.json` contiene los asuntos y `preview.html` es una vista previa con datos de ejemplo (no se sube a Supabase).

## Opción A — Aplicarlas con un comando (recomendado)

Supabase no permite editar las plantillas desde la conexión de base de datos; se aplican con la Management API usando un Personal Access Token.

1. Crea un token en <https://supabase.com/dashboard/account/tokens>.
2. Valida los archivos (sin llamar a la API):

   ```bash
   node scripts/apply-auth-email-templates.mjs --dry-run
   ```

3. Aplica plantillas, asuntos, avisos de seguridad y nombre del remitente:

   ```bash
   SUPABASE_ACCESS_TOKEN=sbp_tu_token node scripts/apply-auth-email-templates.mjs
   ```

El script usa por defecto el proyecto `quxbqmqwiacfwbpqioev`. Para otro proyecto:

```bash
SUPABASE_ACCESS_TOKEN=sbp_tu_token SUPABASE_PROJECT_REF=otro_ref node scripts/apply-auth-email-templates.mjs
```

Flags disponibles:

- `--dry-run`: solo valida archivos y tamaños.
- `--templates-only`: no toca las notificaciones de seguridad.
- `--no-sender-name`: no cambia el nombre del remitente.

El token se usa solo en la variable de entorno; no lo guardes en el repositorio. Si lo expones, revócalo en la misma página.

## Opción B — Pegarlas a mano en el Dashboard

1. Entra en **Authentication → Emails → Templates**.
2. Elige cada plantilla de la tabla, pega el contenido completo de su archivo en el campo del mensaje y escribe el asunto correspondiente.
3. Guarda cada cambio.
4. En **Authentication → Emails → Security notifications**, activa los avisos de contraseña, correo, teléfono, MFA e identidades. Sin esos interruptores, esas plantillas no se envían aunque estén guardadas.
5. En **Authentication → Emails → SMTP Settings**, revisa que el remitente sea `Venezuela Inmuebles` y que el correo sea `noreply@venezuela-inmuebles.online`.

> El cuerpo de cada plantilla debe tener **menos de 5000 caracteres**. Las plantillas actuales están entre 3700 y 4120 caracteres; el script lo valida antes de enviarlas.

## Variables de Supabase utilizadas

| Variable | Uso en las plantillas |
| --- | --- |
| `{{ .TokenHash }}` | Verificación first-party en `venezuela-inmuebles.online/confirm` y `/reset-password` (evita enlaces cruzados a `supabase.co` y pre-escaneos de antivirus). |
| `{{ .ConfirmationURL }}` | Confirmación de doble paso en `email_change`. |
| `{{ .Token }}` | Código de 8 dígitos en reautenticación (también en su asunto). |
| `{{ .SiteURL }}` | Dominio propio (`https://venezuela-inmuebles.online`) para todos los enlaces de acción y avisos de seguridad. |
| `{{ .Email }}` | Correo de la cuenta en pies y avisos. |
| `{{ .NewEmail }}` | Nuevo correo en la confirmación de cambio. |
| `{{ .OldEmail }}` | Correo anterior en el aviso de cambio. |
| `{{ .Phone }}` / `{{ .OldPhone }}` | Teléfono nuevo y anterior. |
| `{{ .Provider }}` | Proveedor vinculado o desvinculado. |
| `{{ .FactorType }}` | Método de verificación añadido o eliminado. |

## Regenerar y previsualizar

```bash
node scripts/generate-auth-email-templates.mjs
node scripts/preview-auth-email-templates.mjs
```

Abre `supabase/email-templates/preview.html` en el navegador para ver las 13 plantillas con datos de ejemplo. Después de cambiar textos o colores, vuelve a generar y, si ya las habías aplicado, ejecuta otra vez el script de aplicación.

## Pruebas recomendadas

1. Crea una cuenta nueva con un correo real y comprueba el correo de confirmación en escritorio y móvil.
2. Solicita "Olvidé mi contraseña" desde `/login` y verifica el enlace de recuperación.
3. Cambia el correo de la cuenta y confirma que llegan la confirmación y el aviso de seguridad.
4. Activa la verificación en dos pasos y revisa el aviso de método añadido.
5. Revisa que el logotipo se vea bien en Gmail (las imágenes pueden tardar en cargar) y que el remitente muestre `Venezuela Inmuebles`.

## Notas

- Los correos están en español, el idioma principal del sitio. Supabase no permite plantillas bilingües por idioma sin lógica adicional en el registro.
- El logotipo se carga desde el dominio público; si cambia la URL, actualiza la constante `LOGO` en `scripts/generate-auth-email-templates.mjs` y regenera.
- Los enlaces usan `{{ .ConfirmationURL }}` para conservar el flujo seguro de Supabase; no los sustituyas por enlaces fijos.
