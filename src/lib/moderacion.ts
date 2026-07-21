/**
 * Filtro de moderación automatizada
 * - Palabras prohibidas → se rechaza la publicación directamente
 * - Palabras sospechosas → se publica pero se marca "pendiente" y alerta Telegram
 */

// 🚫 RECHAZO: contenido 100% prohibido (ilegal o extremadamente inapropiado)
export const palabrasProhibidas: string[] = [
  // Armas y munición
  'ametralladora', 'bala', 'c4', 'cartucho', 'dinamita', 'escopeta', 'fusil',
  'granada', 'lanzacohetes', 'mina antipersona', 'mortero', 'pistola',
  'polvera', 'pulsora', 'rifl', 'revolver', 'revólver', 'rifle', 'semiautomática',
  'sniper', 'subfusil', 'trabuco', 'armas de fuego', 'armas blancas',
  'fabricación de armas', 'modificación de armas',

  // Drogas y sustancias ilegales
  'basuco', 'cocaína', 'cocaina', 'crack', 'droga sintética', 'droga',
  'extasis', 'éxtasis', 'farmaco', 'fármaco recetado', 'hashish', 'hashís',
  'heroina', 'heroína', 'ketamina', 'lsd', 'marihuana', 'mdma', 'metanfetamina',
  'pastilla', 'piedra base', 'perico', 'polvillo', 'thc', 'tripi', 'tripis',
  'alucinógeno', 'alucinogeno', 'psicotrópico', 'psicotrópico',
  'venta de drogas', 'narco',

  // Ilegalidad general
  'cedula falsa', 'cédula falsa', 'documento falso', 'pasaporte falso',
  'documento adulterado', 'identidad falsa', 'placa falsa', 'titulo falso',
  'título falso', 'diploma falso', 'receta falsa',

  // Explotación y tráfico
  'trafico de personas', 'tráfico de personas', 'trata de personas',
  'explotación sexual', 'explotacion sexual', 'proxenetismo', 'lenocinio',

  // Pornografía y contenido sexual explícito
  'pornografía', 'porno', 'sex server', 'cam show', 'chat erotico',
  'chat erótico', 'striptease', 'servicio sexual', 'prostitución', 'prostitucion',
  'put', 'whore', 'escort servicios', 'escorts', 'servicios acompañante',

  // Órganos humanos
  'riñon en venta', 'riñón en venta', 'organos humanos', 'órganos humanos',
  'compra de organos', 'compra de órganos', 'vientre', 'alquiler vientre',

  // Fraude/estafa directa
  'hackeo', 'hackear', 'robar cuenta', 'robar clave', 'clonar tarjeta',
  'clonar telefono', 'burlar seguridad', 'bypass security', 'keylogger',
  'phishing', 'skimmer',
]

// ⚠️ SOSPECHOSO: se publica pero se marca para revisión
export const palabrasSospechosas: string[] = [
  // Precios sospechosos (solo los muy específicos)
  'solo cripto', 'solo bitcoin', 'transferencia previa',
  'pago por adelantado',

  // Eufemismos comunes de drogas
  'sustancia natural', 'medicamento sin receta',

  // Contacto fuera de plataforma (potencial estafa)
  'escribe a mi email', 'contacta por telegram', 'whatsapp antes',
  'habla por telegram', 'enviame por correo',
]

/**
 * Verifica texto contra la lista de moderación
 * @returns
 *   - { nivel: 'prohibido', palabras: string[] }
 *   - { nivel: 'sospechoso', palabras: string[] }
 *   - { nivel: 'limpio', palabras: [] }
 */
export function verificarContenido(texto: string): {
  nivel: 'prohibido' | 'sospechoso' | 'limpio'
  palabras: string[]
} {
  if (!texto?.trim()) return { nivel: 'limpio', palabras: [] }

  const textoNormalizado = texto.toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quita acentos para matching más amplio

  const encontradasProhibidas: string[] = []
  const encontradasSospechosas: string[] = []

  // Revisa prohibidas
  for (const palabra of palabrasProhibidas) {
    const normalizada = palabra.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    if (textoNormalizado.includes(normalizada)) {
      encontradasProhibidas.push(palabra)
    }
  }

  if (encontradasProhibidas.length > 0) {
    return { nivel: 'prohibido', palabras: encontradasProhibidas }
  }

  // Revisa sospechosas
  for (const palabra of palabrasSospechosas) {
    const normalizada = palabra.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    if (textoNormalizado.includes(normalizada)) {
      encontradasSospechosas.push(palabra)
    }
  }

  if (encontradasSospechosas.length > 0) {
    return { nivel: 'sospechoso', palabras: encontradasSospechosas }
  }

  return { nivel: 'limpio', palabras: [] }
}

/**
 * Genera alerta para Telegram
 */
export function formatearAlertaModeracion(
  nivel: 'prohibido' | 'sospechoso',
  titulo: string,
  palabras: string[],
  userId: string,
  userName: string = 'Desconocido'
): string {
  const icono = nivel === 'prohibido' ? '🚫' : '⚠️'
  const nivelTexto = nivel === 'prohibido' ? 'PROHIBIDO' : 'SOSPECHOSO'

  return `${icono} <b>ALERTA MODERACIÓN — ${nivelTexto}</b>

📝 <b>Título:</b> ${titulo}
👤 <b>Usuario:</b> ${userName}
🔍 <b>Palabras detectadas:</b> ${palabras.join(', ')}

Revisa en el Admin Panel → Moderación`
}
