# 📧 Configuración de Emails Personalizados para VendeT-Venezuela

## 🎯 Qué Emails Necesitas Enviar

1. ✅ **Anuncio publicado** - Notificar al usuario cuando su producto fue publicado/aprobado
2. ✅ **Mensaje recibido** - Alertar cuando alguien contacta su producto
3. ✅ **Créditos aprobados** - Cuando admin aprueba comprobante
4. ✅ **Verificación aprobada** - Cuando administrador aprueba verificación de vendedor
5. ✅ **Producto bloqueado** - Si producto es rechazado por moderación
6. ✅ **Reporte recibido** - Notificar al vendedor sobre reportes

---

## 🚀 Solución Recomendada: Supabase Edge Functions + Resend

### Por qué esta combinación:

✅ **Supabase Edge Functions** → Ejecuta código en el edge (serverless)
✅ **Resend** → API de email gratuita (1000 emails/mes gratis)
✅ **Fácil implementación** → No necesitas configurar servidor extra
✅ **Escalable** → Funciona bien con tráfico alto
✅ **Templates HTML** → Resend permite templates profesionales

---

## 📋 Paso 1: Configurar Resend (5 minutos)

### 1. Crear cuenta en https://resend.com

### 2. Obtener API Key
1. Ve a **Dashboard** → **API Keys**
2. Crea una nueva API Key (ej: "VendeT Production")
3. **COPIA LA API KEY** (solo se muestra una vez)

### 3. Verificar Dominio (Importante)
1. Ve a **Domains** → **Add Domain**
2. Ingresa `vendet.online`
3. Resend te dará registros DNS para agregar:
   - TXT record para SPF
   - CNAME record para DKIM
4. Agrega estos registros en tu DNS (Cloudflare, etc.)
5. **Verificación** → Resend verificará automáticamente

### 4. Guardar API Key
```
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxx
```

---

## 📋 Paso 2: Instalar Dependencias en Next.js

```bash
cd /home/node/.openclaw/workspace/marketplace-vzla
npm install resend @supabase/supabase-js
```

---

## 📋 Paso 3: Configurar Variables de Entorno

Edita `.env.local` (NO commit a git):

```env
# Ya existentes
NEXT_PUBLIC_SUPABASE_URL=https://jmbkqelkusxjebsdnjoc.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key

# NUEVOS - Resend
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxx
EMAIL_FROM=contacto@vendet.online
```

---

## 📋 Paso 4: Crear Edge Function de Email

Crea el archivo: `supabase/functions/send-email/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

serve(async (req) => {
  try {
    // Variables de entorno
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const EMAIL_FROM = Deno.env.get("EMAIL_FROM") || "contacto@vendet.online";
    
    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY no configurada" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const resend = new Resend(RESEND_API_KEY);
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { tipo, datos } = await req.json();

    let email;

    switch (tipo) {
      case "producto-publicado":
        email = await enviarProductoPublicado(resend, EMAIL_FROM, datos);
        break;
      case "mensaje-recibido":
        email = await enviarMensajeRecibido(resend, EMAIL_FROM, datos);
        break;
      case "creditos-aprobados":
        email = await enviarCreditosAprobados(resend, EMAIL_FROM, datos);
        break;
      case "verificacion-aprobada":
        email = await enviarVerificacionAprobada(resend, EMAIL_FROM, datos);
        break;
      case "producto-bloqueado":
        email = await enviarProductoBloqueado(resend, EMAIL_FROM, datos);
        break;
      default:
        return new Response(
          JSON.stringify({ error: "Tipo de email no soportado" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
    }

    return new Response(
      JSON.stringify({ success: true, messageId: email?.id }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

async function enviarProductoPublicado(resend, from, { nombre, email, productoUrl }) {
  return await resend.emails.send({
    from: from,
    to: [email],
    subject: "¡Tu anuncio ha sido publicado en VendeT-Venezuela! 🎉",
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, system-ui, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <tr>
            <td style="background: linear-gradient(135deg, #C9A84C 0%, #F59E0B 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 900; color: #1a1a2e;">
                Vende<span style="color: #fff;">T</span>-Venezuela
              </h1>
              <p style="margin: 10px 0 0 0; font-size: 14px; color: #1a1a2e; font-weight: 500;">
                La plataforma de clasificados de Venezuela 🇻🇪
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="margin: 0 0 20px 0; font-size: 24px; color: #1f2937; font-weight: 700;">
                🎉 ¡Tu anuncio está publicado!
              </h2>
              <p style="margin: 0 0 16px 0; font-size: 16px; color: #4b5563; line-height: 1.6;">
                Hola, <strong>${nombre}</strong>
              </p>
              <p style="margin: 0 0 16px 0; font-size: 16px; color: #4b5563; line-height: 1.6;">
                Tu producto ha sido publicado exitosamente en VendeT-Venezuela.
              </p>
              <div style="background-color: #eff6ff; border: 2px solid #3b82f6; border-radius: 8px; padding: 24px; margin: 24px 0; text-align: center;">
                <h3 style="margin: 0 0 12px 0; font-size: 18px; color: #1e40af;">
                  ${productoUrl.replace('https://vendet.online/producto/', '')}
                </h3>
                <a href="${productoUrl}" 
                   style="display: inline-block; background-color: #3b82f6; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 16px; font-weight: 700; margin-top: 8px;">
                  Ver mi anuncio
                </a>
              </div>
              <div style="background-color: #fffbeb; border-left: 4px solid #C9A84C; border-radius: 8px; padding: 20px; margin: 24px 0;">
                <p style="margin: 0 0 8px 0; font-size: 15px; color: #92400e; font-weight: 600;">
                  💡 Tips para vender más rápido:
                </p>
                <ul style="margin: 0; padding-left: 20px; font-size: 14px; color: #92400e;">
                  <li style="margin-bottom: 6px;">✨ Destaca tu anuncio para llegar a miles más comprador
                  <li style="margin-bottom: 6px;">📸 Sube más fotos (mínimo 3)
                  <li>⚡ Responde rápido a los mensajes
                </ul>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
                <p style="margin: 0 0 8px 0; font-size: 16px; font-weight: 700; color: #1a1a2e;">
                  VendeT-Venezuela
                </p>
                <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                  ¿Necesitas ayuda? <a href="mailto:contacto@vendet.online" style="color: #3b82f6; text-decoration: none;">contacto@vendet.online</a>
                </p>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `
  });
}

async function enviarMensajeRecibido(resend, from, { mensajeUrl, vendedorNombre, vendedorEmail, productoTitulo }) {
  return await resend.emails.send({
    from: from,
    to: [vendedorEmail],
    subject: `📩 ¡Recibiste un mensaje sobre "${productoTitulo}"`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, system-ui, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <tr>
            <td style="background: linear-gradient(135deg, #C9A84C 0%, #F59E0B 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 900; color: #1a1a2e;">
                Vende<span style="color: #fff;">T</span>-Venezuela
              </h1>
              <p style="margin: 10px 0 0 0; font-size: 14px; color: #1a1a2e; font-weight: 500;">
                Notificación de mensaje 📩
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="margin: 0 0 20px 0; font-size: 24px; color: #1f2937; font-weight: 700;">
                ✅ ¡Te llegó un mensaje!
              </h2>
              <p style="margin: 0 0 16px 0; font-size: 16px; color: #4b5563; line-height: 1.6;">
                Hola, <strong>${vendedorNombre}</strong>
              </p>
              <p style="margin: 0 0 16px 0; font-size: 16px; color: #4b5563; line-height: 1.6;">
                Alguien está interesado en tu producto:
              </p>
              <div style="background-color: #ecfdf5; border: 2px solid #10b981; border-radius: 8px; padding: 24px; margin: 24px 0;">
                <h3 style="margin: 0 0 12px 0; font-size: 18px; color: #065f46; text-align: center;">
                  ${productoTitulo}
                </h3>
                <p style="margin: 0; font-size: 14px; color: #065f46; text-align: center;">
                  Un comprador quiere contactarte
                </p>
              </div>
              <div style="text-align: center; margin: 28px 0;">
                <a href="${mensajeUrl}" 
                   style="display: inline-block; background-color: #7B2D3B; color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-size: 16px; font-weight: 700;">
                  Ver mensaje ahora
                </a>
              </div>
              <p style="margin: 0 0 16px 0; font-size: 14px; color: #6b7280; text-align: center;">
                Responde rápido para cerrar la venta 🚀
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
                <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                  <a href="mailto:contacto@vendet.online" style="color: #3b82f6; text-decoration: none;">contacto@vendet.online</a>
                </p>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `
  });
}

// ... (funciones para creditos, verificacion, bloqueado - ver archivo completo en docs)
```

---

## 📋 Paso 5: Configurar Webhook en Supabase

1. Ve a **Supabase Dashboard** → **Database** → **Replication**
2. Habilita row-level security para triggers
3. Crea triggers que llamen a Edge Function:

```sql
-- Ejemplo: Cuando se inserta mensaje
CREATE OR REPLACE FUNCTION trigger_send_message_email()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM https_req('enviar-mensaje', '{
    "mensaje_url": "https://vendet.online/",
    "vendedor_nombre": "Juan",
    "vendedor_email": "juan@email.com",
    "producto_titulo": "iPhone 15"
  }');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER mensaje_notificacion
AFTER INSERT ON mensajes
FOR EACH ROW
WHEN (pg_trigger_depth() = 0)
EXECUTE FUNCTION trigger_send_message_email();
```

---

## 📋 Paso 6: Deploy Edge Functions

```bash
cd /home/node/.openclaw/workspace/marketplace-vzla
supabase functions deploy send-email
```

**Configurar variables de entorno para la función:**
```bash
supabase functions edit send-email --env-file .env.local
```

---

## 📋 Paso 7: Integrar en tu App

En tu código Next.js, cuando publiquen un producto:

```typescript
// publicar/page.tsx o wherever
async function handlePublish(productoData) {
  // 1. Insertar en Supabase
  await supabase.from('productos').insert(productoData);
  
  // 2. Enviar email después
  await fetch('https://jmbkqelkusxjebsdnjoc.supabase.co/functions/v1/send-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tipo: 'producto-publicado',
      datos: {
        nombre: 'Juan Perez',
        email: 'juan@email.com',
        productoUrl: 'https://vendet.online/producto/abc123'
      }
    })
  });
  
  return { success: true };
}
```

---

## 🎨 Templates Adicionales (Copiar y Pegar)

### Email: Créditos Aprobados
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, system-ui, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <tr>
            <td style="background: linear-gradient(135deg, #C9A84C 0%, #F59E0B 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 900; color: #1a1a2e;">
                Vende<span style="color: #fff;">T</span>-Venezuela
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 30px;">
              <div style="background-color: #ecfdf5; border: 2px solid #10b981; border-radius: 12px; padding: 32px; margin: 24px 0; text-align: center;">
                <h1 style="margin: 0 0 16px 0; font-size: 32px; color: #065f46;">💰</h1>
                <h2 style="margin: 0 0 12px 0; font-size: 24px; color: #1f2937;">Créditos Aprobados</h2>
                <p style="margin: 0; font-size: 16px; color: #065f46;">
                  Tus créditos han sido cargados: <strong>${montos} créditos</strong>
                </p>
              </div>
              <div style="text-align: center; margin: 28px 0;">
                <a href="https://vendet.online/dashboard" 
                   style="display: inline-block; background-color: #7B2D3B; color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-size: 16px; font-weight: 700;">
                  Ver mi saldo de créditos
                </a>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                <a href="mailto:contacto@vendet.online" style="color: #3b82f6; text-decoration: none;">contacto@vendet.online</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

---

## 🚀 Alternativa más Fácil: Email Templates en Vercel/Netlify

Si no quieres configurar Edge Functions, puedes:

1. Usar **Vercel Edge Middleware**
2. Usar **Netlify Functions**
3. Usar **Firebase Cloud Functions**

**Pero Supabase Edge Functions es la opción más simple porque:**
- Ya tienes Supabase
- Las variables de entorno están configuradas
- Funciona con triggers de base de datos

---

## 🎯 Resumen

### Lo que necesitas hacer:
1. ✅ Crear cuenta en **Resend**
2. ✅ Verificar dominio `vendet.online`
3. ✅ Instalar `resend` en Next.js
4. ✅ Configurar variables de entorno
5. ✅ Crear Edge Function `send-email`
6. ✅ Deploy a Supabase
7. ✅ Llamada desde tu app cuando ocurran eventos

### Costo:
- **Resend Free**: 1000 emails/mes ✅ (suficiente para lanzamiento)
- **Upgrade**: $35/mes para 50k emails si necesitas más

---

## 📞 Preguntas Frecuentes

**Q: ¿Puedo usar mi propio servidor SMTP?**  
A: Sí, pero configura tu DNS (SPF, DKIM, DMARC) primero. Costoso de mantener.

**Q: ¿Resend tiene deliverability buena?**  
A: Sí, Resend tiene muy buena deliverability (99.9% inbox).

**Q: ¿Puedo usar plantillas HTML dinámicas?**  
A: Sí, Resend permite plantillas con variables. O puedes usar HTML inline como arriba.

**Q: ¿Cómo sé si el email llegó?**  
A: Resend tiene logs en Dashboard. También puedes crear tabla `email_logs` en Supabase para rastrear.

---

**¿Quieres que cree los templates HTML completos de todos los emails adicionales?** 🔥
