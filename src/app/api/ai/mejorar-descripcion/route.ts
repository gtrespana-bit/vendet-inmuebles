import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/api-auth'
import { checkRateLimit } from '@/lib/rate-limit'

// Mejora la descripción de un inmueble usando Google Gemini (plan gratuito).
// Requiere GEMINI_API_KEY (https://aistudio.google.com — tier gratuito, sin tarjeta).
// Sin clave configurada la ruta devuelve 503 y el botón de IA no funciona.

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash'

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
- 80-140 palabras, párrafos cortos.
- Usa los datos reales que se te dan; no inventes características que no aparezcan.
- Tono profesional y cercano, en español de Venezuela.
- No uses emojis ni caracteres especiales raros.

Datos del inmueble:
${detalles}

Borrador del usuario:
${descripcion.slice(0, 4000)}`

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 600 },
        }),
      }
    )

    if (!response.ok) {
      const errText = await response.text()
      console.error('Gemini API error:', response.status, errText.slice(0, 500))
      return NextResponse.json({ error: 'El servicio de IA no respondió' }, { status: 502 })
    }

    const data = await response.json()
    const texto = data?.candidates?.[0]?.content?.parts?.[0]?.text
    if (!texto || typeof texto !== 'string') {
      return NextResponse.json({ error: 'El servicio de IA no devolvió texto' }, { status: 502 })
    }

    return NextResponse.json({ descripcion: texto.trim().slice(0, 6000) })
  } catch (err: any) {
    console.error('Mejorar descripción error:', err)
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 })
  }
}
