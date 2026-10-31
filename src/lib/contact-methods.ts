/**
 * Métodos de contacto por publicación (columna jsonb `inmuebles.metodos_contacto`).
 *
 * El chat interno SIEMPRE está activo. Opcionales: teléfono para llamadas
 * (`telefono`) y teléfono para WhatsApp (`whatsapp`). En la ficha del anuncio
 * se muestran como botones: `tel:` para llamar y `wa.me?text=...` con mensaje
 * pre-escrito para WhatsApp.
 */

/** Normaliza un teléfono: conserva el '+' inicial y los dígitos; exige 7-15 dígitos (E.164). */
export function normalizarTelefono(valor: unknown): string | null {
  if (typeof valor !== 'string') return null
  const limpio = valor.trim()
  if (!limpio) return null
  const prefijo = limpio.startsWith('+') ? '+' : ''
  const digitos = limpio.replace(/[^\d]/g, '')
  if (digitos.length < 7 || digitos.length > 15) return null
  return `${prefijo}${digitos}`
}

/** Enlace `tel:` para abrir la app de llamadas. */
export function telHref(telefono: string): string {
  return `tel:${telefono.replace(/[^\d+]/g, '')}`
}

/** Enlace wa.me con mensaje pre-escrito y listo para enviar (wa.me solo acepta dígitos, sin +). */
export function whatsappHref(telefono: string, mensaje: string): string {
  const digitos = telefono.replace(/\D/g, '')
  return `https://wa.me/${digitos}?text=${encodeURIComponent(mensaje)}`
}

/** Mensaje pre-escrito de WhatsApp al interesarse por un anuncio. */
export function mensajeWhatsappPredeterminado(titulo: string, urlAnuncio?: string | null, isEnglish?: boolean): string {
  const base = isEnglish
    ? `Hello! I saw your listing "${titulo}" on Venezuela Inmuebles and I'm interested. Is it still available?`
    : `Hola, vi tu anuncio "${titulo}" en Venezuela Inmuebles y me interesa. ¿Sigue disponible?`
  return urlAnuncio ? `${base} ${urlAnuncio}` : base
}

export interface MetodosContactoSanitizados {
  telefono?: string
  whatsapp?: string
  email?: string
  messenger?: string
}

/**
 * Sanitiza el objeto `metodos_contacto` recibido del cliente (API route):
 * solo claves conocidas, teléfonos normalizados y válidos, email válido y
 * messenger http(s). Devuelve null si no queda nada válido.
 */
export function sanitizarMetodosContacto(valor: unknown): MetodosContactoSanitizados | null {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return null
  const raw = valor as Record<string, unknown>
  const out: MetodosContactoSanitizados = {}

  const tel = normalizarTelefono(raw.telefono)
  if (tel) out.telefono = tel

  const wa = normalizarTelefono(raw.whatsapp)
  if (wa) out.whatsapp = wa

  if (typeof raw.email === 'string') {
    const email = raw.email.trim().slice(0, 254).toLowerCase()
    if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) out.email = email
  }

  if (typeof raw.messenger === 'string') {
    const m = raw.messenger.trim().slice(0, 500)
    if (/^https?:\/\/\S+$/i.test(m)) out.messenger = m
  }

  return Object.keys(out).length > 0 ? out : null
}

/**
 * Resuelve los métodos de contacto a mostrar en la ficha pública.
 * Si la publicación eligió métodos (metodos_contacto no vacío), se muestran
 * SOLO los elegidos; si no (publicaciones antiguas), se usa el teléfono del
 * perfil como hasta ahora.
 */
export function resolverContactoPublicacion(property: Record<string, any>): {
  telLlamadas: string | null
  telWhatsapp: string | null
  email: string | null
} {
  const raw = property.metodos_contacto
  const tieneMetodos = !!(raw && typeof raw === 'object' && !Array.isArray(raw) && Object.keys(raw).length > 0)
  const metodos = (tieneMetodos ? raw : {}) as Record<string, unknown>
  const telPerfil = normalizarTelefono(property.propietario_telefono)

  const telLlamadas = normalizarTelefono(metodos.telefono) ?? (tieneMetodos ? null : telPerfil)
  const telWhatsapp = normalizarTelefono(metodos.whatsapp) ?? (tieneMetodos ? null : telPerfil)

  let email: string | null = null
  if (typeof metodos.email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(metodos.email)) {
    email = metodos.email
  } else if (!tieneMetodos && typeof property.propietario_email === 'string' && property.propietario_email.includes('@')) {
    email = property.propietario_email
  }

  return { telLlamadas, telWhatsapp, email }
}
