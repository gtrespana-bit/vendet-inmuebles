// Tasa USD -> Bs. Híbrida: API automática + fallback manual
// Fuente principal: ve.dolarapi.com (BCV oficial Venezuela)
// Fallback: valor manual configurable en FALLBACK_RATE

const FALLBACK_RATE = 487

interface TasaData {
  tasa: number
  fuente: 'api' | 'fallback'
  ultimaActualizacion: string
}

let cache: TasaData | null = null
let cacheTime = 0
const CACHE_DURATION = 3600 * 1000 // 1 hora

async function fetchFromAPI(): Promise<number | null> {
  try {
    // Fuente principal: ve.dolarapi.com (tasa BCV oficial)
    const resp = await fetch('https://ve.dolarapi.com/v1/dolares', {
      next: { revalidate: 3600 },
    })
    if (!resp.ok) return null

    const data = await resp.json()
    // Buscar la tasa oficial (BCV) en el array
    const oficial = data.find((d: any) => d.fuente === 'oficial')
    if (oficial && oficial.promedio) {
      return parseFloat(oficial.promedio)
    }

    // Si no encuentra "oficial", usar el primer elemento del array
    if (Array.isArray(data) && data.length > 0 && data[0].promedio) {
      return parseFloat(data[0].promedio)
    }

    return null
  } catch {
    return null
  }
}

export async function getTasaBCV(): Promise<TasaData> {
  if (cache && Date.now() - cacheTime < CACHE_DURATION) {
    return cache
  }

  const apiRate = await fetchFromAPI()

  if (apiRate && apiRate > 10) {
    cache = {
      tasa: Math.round(apiRate * 2) / 2, // Redondear a .5 más cercano
      fuente: 'api',
      ultimaActualizacion: new Date().toLocaleString('es-VE'),
    }
  } else {
    cache = {
      tasa: FALLBACK_RATE,
      fuente: 'fallback',
      ultimaActualizacion: 'Tasa manual',
    }
  }

  cacheTime = Date.now()
  return cache
}

// Versión para cliente (usa localStorage cache)
export function getTasaBCVClient(): TasaData {
  if (typeof window === 'undefined') {
    return { tasa: FALLBACK_RATE, fuente: 'fallback', ultimaActualizacion: '' }
  }

  try {
    const cached = localStorage.getItem('tasa_bcv')
    if (cached) {
      const parsed = JSON.parse(cached)
      if (Date.now() - parsed.timestamp < CACHE_DURATION) {
        return parsed.data
      }
    }
  } catch {
    // Cache corrupted, ignora
  }

  return { tasa: FALLBACK_RATE, fuente: 'fallback', ultimaActualizacion: 'Actualizando...' }
}

export async function actualizarTasaClient(): Promise<TasaData> {
  if (typeof window === 'undefined') {
    return getTasaBCVClient()
  }

  try {
    const resp = await fetch('/api/tasa-bcv')
    const data = await resp.json()

    localStorage.setItem('tasa_bcv', JSON.stringify({
      data,
      timestamp: Date.now(),
    }))

    return data
  } catch {
    return getTasaBCVClient()
  }
}
