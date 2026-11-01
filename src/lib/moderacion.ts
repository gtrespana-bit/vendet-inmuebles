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
  'polvera', 'pulsora', 'revolver', 'revólver', 'rifle', 'semiautomática',
  'sniper', 'subfusil', 'trabuco', 'armas de fuego', 'armas blancas',
  'fabricación de armas', 'modificación de armas',

  // Drogas y sustancias ilegales
  'basuco', 'cocaína', 'cocaina', 'crack', 'droga sintética', 'droga',
  'extasis', 'éxtasis', 'fármaco recetado', 'hashish', 'hashís',
  'heroina', 'heroína', 'ketamina', 'lsd', 'marihuana', 'mdma', 'metanfetamina',
  'piedra base', 'thc', 'tripi', 'tripis',
  'alucinógeno', 'alucinogeno', 'psicotrópico',
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
  'puta', 'whore', 'escort servicios', 'escorts', 'servicios acompañante',

  // Órganos humanos
  'riñon en venta', 'riñón en venta', 'organos humanos', 'órganos humanos',
  'compra de organos', 'compra de órganos', 'alquiler vientre',

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

function normalizarTextoModeracion(valor: string): string {
  return valor
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function contieneTerminoCompleto(textoNormalizado: string, termino: string): boolean {
  const normalizado = normalizarTextoModeracion(termino).trim()
  if (!normalizado) return false
  const escapado = normalizado.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const patron = new RegExp(`(^|[^a-z0-9])${escapado}($|[^a-z0-9])`)
  return patron.test(textoNormalizado)
}

/**
 * Verifica texto contra la lista de moderación usando límites de palabra/frase
 * para no bloquear términos legítimos que contienen subcadenas cortas.
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

  const textoNormalizado = normalizarTextoModeracion(texto)

  const encontradasProhibidas: string[] = []
  const encontradasSospechosas: string[] = []

  // Revisa prohibidas
  for (const palabra of palabrasProhibidas) {
    if (contieneTerminoCompleto(textoNormalizado, palabra)) {
      encontradasProhibidas.push(palabra)
    }
  }

  if (encontradasProhibidas.length > 0) {
    return { nivel: 'prohibido', palabras: encontradasProhibidas }
  }

  // Revisa sospechosas
  for (const palabra of palabrasSospechosas) {
    if (contieneTerminoCompleto(textoNormalizado, palabra)) {
      encontradasSospechosas.push(palabra)
    }
  }

  if (encontradasSospechosas.length > 0) {
    return { nivel: 'sospechoso', palabras: encontradasSospechosas }
  }

  return { nivel: 'limpio', palabras: [] }
}

/**
 * Política única de moderación en el servidor (F19): nunca confía en el estado
 * enviado por el navegador.
 */
export function evaluarModeracionServidor(...partes: Array<string | null | undefined>): {
  permitido: boolean
  estadoModeracion: 'aprobado' | 'pendiente'
  motivoModeracion: string | null
  palabras: string[]
  nivel: 'prohibido' | 'sospechoso' | 'limpio'
} {
  const resultado = verificarContenido(partes.filter(Boolean).join(' '))
  if (resultado.nivel === 'prohibido') {
    return {
      permitido: false,
      estadoModeracion: 'pendiente',
      motivoModeracion: `Contenido no permitido (${resultado.palabras.slice(0, 5).join(', ')})`,
      palabras: resultado.palabras,
      nivel: 'prohibido',
    }
  }
  if (resultado.nivel === 'sospechoso') {
    return {
      permitido: true,
      estadoModeracion: 'pendiente',
      motivoModeracion: `Revisión automática (${resultado.palabras.slice(0, 5).join(', ')})`,
      palabras: resultado.palabras,
      nivel: 'sospechoso',
    }
  }
  return {
    permitido: true,
    estadoModeracion: 'aprobado',
    motivoModeracion: null,
    palabras: [],
    nivel: 'limpio',
  }
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
  const escapeHtml = (value: string) => value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

  return `${icono} <b>ALERTA MODERACIÓN — ${nivelTexto}</b>

📝 <b>Título:</b> ${escapeHtml(titulo)}
👤 <b>Usuario:</b> ${escapeHtml(userName)}
🔍 <b>Palabras detectadas:</b> ${palabras.map(escapeHtml).join(', ')}

Revisa en el Admin Panel → Moderación`
}
