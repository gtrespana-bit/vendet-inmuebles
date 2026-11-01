/**
 * Métodos de contacto por publicación (columna jsonb `inmuebles.metodos_contacto`).
 *
 * El chat interno SIEMPRE está activo. Opcionales: teléfono para llamadas
 * (`telefono`) y teléfono para WhatsApp (`whatsapp`). En la ficha del anuncio
 * se muestran como botones: `tel:` para llamar y `wa.me?text=...` con mensaje
 * pre-escrito para WhatsApp. También se admiten `email` y `messenger`.
 *
 * Semántica de la columna:
 * - `null` (o columna ausente): publicación antigua sin configurar. La ficha
 *   usa el teléfono del perfil como hasta ahora (compatibilidad).
 * - Objeto `{ ... }`: la publicación eligió sus métodos. Aunque esté vacío
 *   (`{}`) se respeta la elección y solo se muestra el chat interno.
 */

/** Claves admitidas dentro de `metodos_contacto`. */
export const CLAVES_METODOS_CONTACTO = ['telefono', 'whatsapp', 'email', 'messenger'] as const
export type ClaveMetodoContacto = (typeof CLAVES_METODOS_CONTACTO)[number]

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

/** `true` cuando la publicación tiene métodos configurados (aunque el objeto esté vacío). */
export function tieneMetodosConfigurados(valor: unknown): boolean {
  return !!valor && typeof valor === 'object' && !Array.isArray(valor)
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const MESSENGER_RE = /^https?:\/\/\S+$/i

/**
 * Sanitiza el objeto `metodos_contacto` recibido del cliente (API route):
 * solo claves conocidas, teléfonos normalizados y válidos, email válido y
 * messenger http(s).
 *
 * Devuelve `null` si el valor no es un objeto (la publicación no configura
 * métodos) y `{}` si es un objeto sin métodos válidos (elección explícita de
 * dejar solo el chat interno).
 */
export function sanitizarMetodosContacto(valor: unknown): MetodosContactoSanitizados | null {
  if (!tieneMetodosConfigurados(valor)) return null
  const raw = valor as Record<string, unknown>
  const out: MetodosContactoSanitizados = {}

  const tel = normalizarTelefono(raw.telefono)
  if (tel) out.telefono = tel

  const wa = normalizarTelefono(raw.whatsapp)
  if (wa) out.whatsapp = wa

  if (typeof raw.email === 'string') {
    const email = raw.email.trim().slice(0, 254).toLowerCase()
    if (EMAIL_RE.test(email)) out.email = email
  }

  if (typeof raw.messenger === 'string') {
    const m = raw.messenger.trim().slice(0, 500)
    if (MESSENGER_RE.test(m)) out.messenger = m
  }

  return out
}

/**
 * Prepara para el API el objeto del formulario: recorta espacios y descarta
 * campos vacíos. Mantiene el objeto (aunque quede vacío) para que el servidor
 * distinga "solo chat" de "sin configurar".
 */
export function limpiarMetodosContacto(valor: Record<string, unknown> | null | undefined): MetodosContactoSanitizados {
  const out: MetodosContactoSanitizados = {}
  if (!valor) return out
  for (const clave of CLAVES_METODOS_CONTACTO) {
    const v = valor[clave]
    if (typeof v !== 'string') continue
    const limpio = v.trim()
    if (limpio) out[clave] = limpio
  }
  return out
}

/**
 * Valida el formulario antes de enviarlo. Devuelve la primera clave inválida
 * (solo se validan los campos que el usuario haya rellenado).
 */
export function validarMetodosContacto(valor: Record<string, unknown> | null | undefined): ClaveMetodoContacto | null {
  if (!valor) return null
  const texto = (clave: ClaveMetodoContacto) => {
    const v = valor[clave]
    return typeof v === 'string' ? v.trim() : ''
  }

  const telefono = texto('telefono')
  if (telefono && !normalizarTelefono(telefono)) return 'telefono'

  const whatsapp = texto('whatsapp')
  if (whatsapp && !normalizarTelefono(whatsapp)) return 'whatsapp'

  const email = texto('email')
  if (email && !EMAIL_RE.test(email)) return 'email'

  const messenger = texto('messenger')
  if (messenger && !MESSENGER_RE.test(messenger)) return 'messenger'

  return null
}

/**
 * Resuelve los métodos de contacto a mostrar en la ficha pública.
 * Si la publicación eligió métodos (metodos_contacto es un objeto), se muestran
 * SOLO los elegidos; si no (publicaciones antiguas con `null`), se usa el
 * teléfono y el email del perfil como hasta ahora.
 */
export function resolverContactoPublicacion(property: Record<string, any>): {
  telLlamadas: string | null
  telWhatsapp: string | null
  email: string | null
  messenger: string | null
} {
  const raw = property?.metodos_contacto
  const configurado = tieneMetodosConfigurados(raw)
  const metodos = (configurado ? raw : {}) as Record<string, unknown>
  const telPerfil = normalizarTelefono(property?.agente_telefono || property?.propietario_telefono)

  const telLlamadas = normalizarTelefono(metodos.telefono) ?? (configurado ? null : telPerfil)
  const telWhatsapp = normalizarTelefono(metodos.whatsapp) ?? (configurado ? null : telPerfil)

  let email: string | null = null
  if (typeof metodos.email === 'string' && EMAIL_RE.test(metodos.email.trim())) {
    email = metodos.email.trim()
  } else if (
    !configurado &&
    typeof (property?.agente_email || property?.propietario_email) === 'string' &&
    String(property?.agente_email || property?.propietario_email).includes('@')
  ) {
    email = String(property?.agente_email || property?.propietario_email)
  }

  let messenger: string | null = null
  if (typeof metodos.messenger === 'string' && MESSENGER_RE.test(metodos.messenger.trim())) {
    messenger = metodos.messenger.trim()
  }

  return { telLlamadas, telWhatsapp, email, messenger }
}
