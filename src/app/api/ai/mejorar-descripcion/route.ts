import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/api-auth'
import { checkRateLimit } from '@/lib/rate-limit'

// Mejora la descripción de un inmueble usando Google Gemini (plan gratuito).
// Requiere GEMINI_API_KEY (https://aistudio.google.com — tier gratuito, sin tarjeta).
// Sin clave configurada la ruta devuelve 503 y el botón de IA no funciona.

// Nota (oct 2026): gemini-2.0-flash fue apagado por Google el 2026-06-01.
// Usamos modelos vigentes del tier gratuito; si el configurado falla con
// 404/400 (retirado), probamos la cadena de respaldo en orden.
const DEFAULT_MODEL = 'gemini-3.6-flash'
const FALLBACK_MODELS = ['gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-2.5-flash']

function modelCandidates(): string[] {
  const configured = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL
  return [configured, ...FALLBACK_MODELS.filter((m) => m !== configured)]
}

async function callGemini(apiKey: string, model: string, prompt: string): Promise<Response> {
  // Gemini 3.x gasta tokens de thinking del presupuesto de salida. Con poco
  // presupuesto la respuesta se truncaba a una línea → 4096 + thinking bajo.
  const isV3 = model.startsWith('gemini-3')
  return fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 4096,
          ...(isV3 ? { thinkingConfig: { thinkingLevel: 'low' } } : {}),
        },
      }),
    }
  )
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'IA no configurada' }, { status: 503 })
    }

    const auth = await requireAuthenticatedUser(request)
    if (!auth.ok) return auth.response

    const rateLimit = await checkRateLimit('ai-descripcion', auth.user.id, {
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
    })
    if (!rateLimit.ok) return NextResponse.json({ error: 'Demasiadas solicitudes de IA, intenta en unos minutos' }, { status: 429 })

    const body = await request.json()
    const {
      descripcion = '',
      titulo = '',
      tipo = '',
      operacion = 'venta',
      ubicacion = '',
      habitaciones,
      banos,
      areaConstruida,
      areaTerreno,
      amueblado,
      amenidades,
    } = body

    if (typeof descripcion !== 'string' || descripcion.trim().length < 10) {
      return NextResponse.json({ error: 'Escribe un borrador primero (mínimo unas palabras)' }, { status: 400 })
    }

    const detalles = [
      titulo && `Título sugerido: ${titulo}`,
      tipo && `Tipo: ${tipo}`,
      operacion && `Operación: ${operacion === 'venta' ? 'venta' : 'alquiler'}`,
      ubicacion && `Ubicación: ${ubicacion}`,
      habitaciones !== undefined && `Habitaciones: ${habitaciones}`,
      banos !== undefined && `Baños: ${banos}`,
      areaConstruida && `Área construcción: ${areaConstruida} m²`,
      areaTerreno && `Área terreno: ${areaTerreno} m²`,
      amueblado && amueblado !== 'no' && `Amueblado: ${amueblado === 'total' ? 'total' : 'parcialmente'}`,
      Array.isArray(amenidades) && amenidades.length > 0 && `Amenidades: ${amenidades.slice(0, 10).join(', ')}`,
    ].filter(Boolean).join('\n')

    const prompt = `Eres redactor profesional de anuncios inmobiliarios en Venezuela.
Reescribe la siguiente descripción de propiedad para que sea atractiva, clara y verosímil.

Reglas:
- Responde SOLO con el texto de la descripción reescrita, sin títulos ni comentarios.
- Extensión: 80-140 palabras en 2-4 párrafos cortos separados por saltos de línea. NUNCA la resumas a una sola línea o frase.
- Si el borrador ya es bueno, púralo y amplíalo con los datos reales; nunca lo acortes.
- Usa los datos reales que se te dan; no inventes características que no aparezcan.
- Tono profesional y cercano, en español de Venezuela.
- No uses emojis ni caracteres especiales raros.

Datos del inmueble:
${detalles}

Borrador del usuario:
${descripcion.slice(0, 4000)}`

    // Probamos el modelo configurado y, si está retirado (404/400), la cadena de respaldo
    const candidates = modelCandidates()
    let response: Response | null = null
    let lastStatus = 0
    let lastBody = ''
    for (const model of candidates) {
      response = await callGemini(apiKey, model, prompt)
      lastStatus = response.status
      if (response.ok) break
      lastBody = await response.text().catch(() => '')
      // 404 = modelo inexistente; 400 con "model" = nombre inválido → probar siguiente
      const modelGone = response.status === 404 ||
        (response.status === 400 && /model|not found|deprecated/i.test(lastBody))
      if (!modelGone) break
      console.error(`Gemini: modelo "${model}" no disponible (${response.status}), probando siguiente…`)
      response = null
    }
    if (!response || !response.ok) {
      console.error('Gemini API error:', lastStatus, lastBody.slice(0, 500))
      if (lastStatus === 429) {
        return NextResponse.json(
          { error: 'La IA está temporalmente saturada, intenta en un minuto' },
          { status: 429 }
        )
      }
      return NextResponse.json({ error: 'El servicio de IA no respondió' }, { status: 502 })
    }

    const data = await response.json()
    // Gemini 3.x puede devolver partes de "pensamiento" antes del texto real:
    // nos quedamos con las partes de texto que no son pensamiento.
    const parts: any[] = data?.candidates?.[0]?.content?.parts || []
    const texto = parts
      .map((p) => (p && p.thought !== true && typeof p.text === 'string' ? p.text : ''))
      .join('')
      .trim()
    // Guardas: si el modelo devolvió basura o truncó, preferimos fallar a
    // arruinarle la descripción al usuario.
    const finishReason: string = data?.candidates?.[0]?.finishReason || ''
    const minPalabras = Math.min(50, Math.max(20, Math.floor(countWords(descripcion) * 0.4)))
    if (!texto) {
      return NextResponse.json({ error: 'El servicio de IA no devolvió texto' }, { status: 502 })
    }
    if (countWords(texto) < minPalabras || finishReason === 'MAX_TOKENS') {
      console.error('Gemini: respuesta demasiado corta o truncada', {
        finishReason, palabras: countWords(texto), minPalabras,
      })
      return NextResponse.json(
        { error: 'La IA devolvió una respuesta incompleta. Inténtalo de nuevo.' },
        { status: 502 }
      )
    }

    return NextResponse.json({ descripcion: texto.slice(0, 6000) })
  } catch (err: any) {
    console.error('Mejorar descripción error:', err)
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 })
  }
}
