# 📧 Instrucciones para Configurar Email en Supabase

## 🚀 Pasos para configurar el template de email personalizado

### Paso 1: Acceso a Supabase Dashboard
1. Ve a https://supabase.com/dashboard/project/jmbkqelkusxjebsdnjoc
2. Inicia sesión con tu cuenta
3. En el sidebar izquierdo, ve a **Authentication**
4. Luego ve a **Email Templates**

---

### Paso 2: Editar Template "Confirmation Mail"

1. Haz clic en el template **Confirmation Mail**
2. En la columna derecha, verás un editor de texto
3. **Borra todo el contenido actual**
4. **Pega el siguiente código HTML** (copia desde el archivo `supabase-email-templates/confirmation-mail-es.md`)

---

### 📋 Template HTML para pegar (COPIAR Y PEGAR ESTO)

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirma tu cuenta en Todo Anuncios</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #C9A84C 0%, #F59E0B 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 900; color: #1a1a2e;">
                Todo<span style="color: #fff;">Anuncios</span>
              </h1>
              <p style="margin: 10px 0 0 0; font-size: 14px; color: #1a1a2e; font-weight: 500;">
                La plataforma de clasificados de Venezuela
              </p>
            </td>
          </tr>
          
          <!-- Contenido principal -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="margin: 0 0 20px 0; font-size: 24px; color: #1f2937; font-weight: 700;">
                👋 ¡Bienvenido a Todo Anuncios, <span style="color: #7B2D3B;">{{ .Email }}</span>!
              </h2>
              
              <p style="margin: 0 0 16px 0; font-size: 16px; color: #4b5563; line-height: 1.6;">
                Gracias por registrarte en la plataforma de compraventa más grande de Venezuela.
              </p>
              
              <p style="margin: 0 0 16px 0; font-size: 16px; color: #4b5563; line-height: 1.6;">
                Próximamente podrás:
              </p>
              
              <ul style="margin: 0 0 24px 0; padding-left: 20px;">
                <li style="color: #4b5563; font-size: 15px; margin-bottom: 8px;">📝 Publicar productos gratis</li>
                <li style="color: #4b5563; font-size: 15px; margin-bottom: 8px;">💬 Contactar directamente con vendedores</li>
                <li style="color: #4b5563; font-size: 15px; margin-bottom: 8px;">🇻🇪 Acceder a miles de anuncios en toda Venezuela</li>
              </ul>
              
              <div style="background-color: #eff6ff; border: 2px solid #3b82f6; border-radius: 8px; padding: 24px; margin: 24px 0;">
                <p style="margin: 0 0 16px 0; font-size: 16px; color: #1e40af; font-weight: 600; text-align: center;">
                  🔐 Confirma tu dirección de correo electrónico
                </p>
                
                <p style="margin: 0 0 20px 0; font-size: 15px; color: #3b82f6; text-align: center;">
                  Para activar tu cuenta y comenzar a usar todas las funcionalidades, haz clic en el botón de abajo:
                </p>
                
                <div style="text-align: center;">
                  <a href="{{ .ConfirmationURL }}" 
                     style="display: inline-block; background-color: #7B2D3B; color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-size: 16px; font-weight: 700; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
                    CONFIRMAR MI CUENTA ➜
                  </a>
                </div>
              </div>
              
              <p style="margin: 0 0 16px 0; font-size: 14px; color: #6b7280; text-align: center;">
                O copia y pega este enlace en tu navegador:
              </p>
              
              <p style="margin: 0 0 24px 0; font-size: 12px; color: #9ca3af; text-align: center; word-break: break-all;">
                {{ .ConfirmationURL }}
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 12px 0; font-size: 14px; color: #6b7280;">
                Si no solicitaste esta cuenta, por favor ignora este email o contáctanos.
              </p>
              
              <p style="margin: 0 0 12px 0; font-size: 14px; color: #6b7280;">
                El enlace expirará en <strong>24 horas</strong>.
              </p>
              
              <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
                <p style="margin: 0 0 8px 0; font-size: 16px; font-weight: 700; color: #1a1a2e;">
                  Todo Anuncios
                </p>
                <p style="margin: 0 0 8px 0; font-size: 13px; color: #6b7280;">
                  El marketplace de Venezuela 🇻🇪
                </p>
                <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                  ¿Necesitas ayuda? Escríbenos a <a href="mailto:gtrespana@gmail.com" style="color: #7B2D3B; text-decoration: none;">gtrespana@gmail.com</a>
                </p>
              </div>
            </td>
          </tr>
        </table>
        
        <p style="margin-top: 20px; font-size: 12px; color: #9ca3af; text-align: center;">
          Todos los derechos reservados © 2026 Todo Anuncios. Todos los derechos reservados.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
```

---

### Paso 3: Guardar cambios

1. Haz clic en el botón **"Save template"** o **"Guardar cambios"**
2. Recibirás confirmación
3. ✅ **Listo!**

---

## ✅ Verificación

### Para probar que funciona:

1. Ve a tu app en Vercel: https://marketplacevzla.vercel.app
2. Haz clic en **"Regístrate gratis"**
3. Crea una cuenta de prueba con un email real
4. **Ve a tu bandeja de entrada** y busca el email

**Deberías ver:**
- ✅ Logo de Todo Anuncios en amarillo
- ✅ El nombre de la persona en el saludo
- ✅ Botón grande azul "CONFIRMAR MI CUENTA"
- ✅ Diseño profesional y responsive
- ✅ Email en español (no inglés)
- ✅ Enlace de confirmación funcional

---

## 🚨 Solución de problemas

### Si el email no se envía:
1. Verifica que **Supabase Email Settings** estén habilitados
2. Revisa que el dominio esté verificado en Supabase
3. Check logs en **Authentication** → **Audit Logs**

### Si el template no se ve:
1. Asegúrate de pegar **HTML completo** (doctype incluido)
2. No elimines ninguna etiqueta HTML/XML
3. Verifica que las variables `{{ .Email }}` y `{{ .ConfirmationURL }}` estén presentes

---

## 📝 Notas adicionales

### Variables de Supabase disponibles:
- `{{ .Email }}` - Correo del usuario
- `{{ .ConfirmationURL }}` - URL completa de confirmación
- `{{ .Token }}` - Token único
- `{{ .RedirectURL }}` - URL de redirección

### El email también se ve como texto plano:
Si el cliente de email del usuario no soporta HTML, Supabase mostrará automáticamente una versión de texto plano que puedes editar en **"Plain Text Template"** en el mismo lugar.

---

**¿Procedo ahora a configurar esto en Supabase?** 🎯

Como no tengo acceso directo al dashboard de Supabase, necesito que tú:

1. **Copies el HTML** del archivo `supabase-email-templates/confirmation-mail-es.md`
2. **Pégaslo en Supabase Dashboard** → Authentication → Email Templates → Confirmation Mail
3. **Guardes los cambios**
4. **Me digas** "ya hecho" o "listo" cuando lo hayas hecho

**Una vez que me confirmes, el flujo de registro funcionará PERFECTAMENTE** 🚀

¿Te parece bien? 👍
