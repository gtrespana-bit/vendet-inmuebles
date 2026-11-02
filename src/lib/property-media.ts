/**
 * Utilidades puras de validación y resolución de multimedia adicional
 * para anuncios inmobiliarios (Vídeo, Recorrido Virtual 360° y Planos).
 *
 * Compatible con `node --experimental-strip-types` (sin imports `@/`).
 */

import { isPlanName } from './plan-catalog.ts'

const MAX_MEDIA_URL_LENGTH = 500

export type VideoProvider = 'youtube' | 'vimeo' | 'instagram' | 'tiktok' | 'external'
export type TourProvider = 'matterport' | 'kuula' | 'external'

export interface ParsedVideoMedia {
  provider: VideoProvider
  embedUrl: string | null
  externalUrl: string
  isVertical: boolean
}

export interface ParsedTourMedia {
  provider: TourProvider
  embedUrl: string | null
  externalUrl: string
}

export interface ParsedFloorPlanMedia {
  kind: 'image' | 'pdf' | 'external'
  url: string
}

function isPrivateOrLocalHostname(hostname: string): boolean {
  const h = hostname.toLowerCase()
  return (
    h === 'localhost' ||
    h.endsWith('.local') ||
    h.endsWith('.internal') ||
    /^127\./.test(h) ||
    /^10\./.test(h) ||
    /^192\.168\./.test(h) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(h) ||
    h === '0.0.0.0' ||
    h === '[::1]'
  )
}

/**
 * Normaliza y valida una URL externa HTTPS para vídeo, tour 360° o plano.
 * - Devuelve `null` si está vacía o si no es una URL `https://` pública válida.
 */
export function sanitizeExternalMediaUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (!trimmed || trimmed.length > MAX_MEDIA_URL_LENGTH) return null

  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol !== 'https:') return null
    if (!parsed.hostname || !parsed.hostname.includes('.') || isPrivateOrLocalHostname(parsed.hostname)) {
      return null
    }
    if (parsed.username || parsed.password) return null
    return parsed.toString()
  } catch {
    return null
  }
}

/**
 * Determina si un plan efectivo permite añadir enlaces de vídeo, tour 360° y planos.
 * Según `/planes`, está incluido en Profesional y Agencia (incluyendo sus 30 días de prueba
 * y agentes vinculados a una agencia activa).
 */
export function canPlanIncludeRichMedia(effectivePlan: unknown): boolean {
  if (!isPlanName(effectivePlan)) return false
  return (
    effectivePlan === 'profesional' ||
    effectivePlan === 'profesional_plus' ||
    effectivePlan === 'agencia'
  )
}

function extractYoutubeInfo(url: URL): { id: string; isShorts: boolean } | null {
  const host = url.hostname.replace(/^www\./i, '').replace(/^m\./i, '').toLowerCase()
  let candidate = ''
  let isShorts = false

  if (host === 'youtu.be') {
    candidate = url.pathname.split('/').filter(Boolean)[0] || ''
  } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const parts = url.pathname.split('/').filter(Boolean)
    if (parts[0] === 'watch') {
      candidate = url.searchParams.get('v') || ''
    } else if (parts[0] === 'shorts' && parts[1]) {
      candidate = parts[1]
      isShorts = true
    } else if ((parts[0] === 'embed' || parts[0] === 'live') && parts[1]) {
      candidate = parts[1]
    }
  }

  if (!/^[a-zA-Z0-9_-]{6,20}$/.test(candidate)) return null
  return { id: candidate, isShorts }
}

function extractVimeoId(url: URL): string | null {
  const host = url.hostname.replace(/^www\./i, '').toLowerCase()
  const parts = url.pathname.split('/').filter(Boolean)
  if (host === 'vimeo.com' && parts[0] && /^\d{6,14}$/.test(parts[0])) {
    return parts[0]
  }
  if (host === 'player.vimeo.com' && parts[0] === 'video' && parts[1] && /^\d{6,14}$/.test(parts[1])) {
    return parts[1]
  }
  return null
}

/**
 * Analiza la URL de un vídeo y genera un embed seguro sin cookies (`youtube-nocookie`, `vimeo`)
 * o una tarjeta de apertura directa para Instagram Reels / TikTok (evitando scripts pesados de rastreo).
 */
export function parseVideoMedia(raw: unknown): ParsedVideoMedia | null {
  const clean = sanitizeExternalMediaUrl(raw)
  if (!clean) return null

  const url = new URL(clean)
  const yt = extractYoutubeInfo(url)
  if (yt) {
    return {
      provider: 'youtube',
      embedUrl: `https://www.youtube-nocookie.com/embed/${yt.id}?rel=0&modestbranding=1`,
      externalUrl: clean,
      isVertical: yt.isShorts,
    }
  }

  const vimeoId = extractVimeoId(url)
  if (vimeoId) {
    return {
      provider: 'vimeo',
      embedUrl: `https://player.vimeo.com/video/${vimeoId}?dnt=1`,
      externalUrl: clean,
      isVertical: false,
    }
  }

  const host = url.hostname.replace(/^www\./i, '').toLowerCase()
  if (host === 'instagram.com' || host.endsWith('.instagram.com')) {
    return {
      provider: 'instagram',
      embedUrl: null,
      externalUrl: clean,
      isVertical: true,
    }
  }

  if (host === 'tiktok.com' || host.endsWith('.tiktok.com')) {
    return {
      provider: 'tiktok',
      embedUrl: null,
      externalUrl: clean,
      isVertical: true,
    }
  }

  return {
    provider: 'external',
    embedUrl: null,
    externalUrl: clean,
    isVertical: false,
  }
}

/**
 * Analiza la URL de un recorrido virtual 360° (Matterport, Kuula o enlace externo).
 */
export function parseVirtualTourMedia(raw: unknown): ParsedTourMedia | null {
  const clean = sanitizeExternalMediaUrl(raw)
  if (!clean) return null

  const url = new URL(clean)
  const host = url.hostname.replace(/^www\./i, '').toLowerCase()

  if (host === 'my.matterport.com' && url.pathname.startsWith('/show') && url.searchParams.get('m')) {
    const modelId = url.searchParams.get('m') || ''
    if (/^[a-zA-Z0-9_-]{5,30}$/.test(modelId)) {
      return {
        provider: 'matterport',
        embedUrl: `https://my.matterport.com/show/?m=${encodeURIComponent(modelId)}&play=1`,
        externalUrl: clean,
      }
    }
  }

  if ((host === 'kuula.co' || host.endsWith('.kuula.co')) && url.pathname.startsWith('/share/')) {
    return {
      provider: 'kuula',
      embedUrl: clean,
      externalUrl: clean,
    }
  }

  return {
    provider: 'external',
    embedUrl: null,
    externalUrl: clean,
  }
}

/**
 * Analiza la URL de un plano arquitectónico para distinguir imagen directa, PDF o enlace externo.
 */
export function parseFloorPlanMedia(raw: unknown): ParsedFloorPlanMedia | null {
  const clean = sanitizeExternalMediaUrl(raw)
  if (!clean) return null

  const url = new URL(clean)
  const pathLower = url.pathname.toLowerCase()

  if (/\.(png|jpe?g|webp|avif|gif)$/i.test(pathLower)) {
    return { kind: 'image', url: clean }
  }
  if (/\.pdf$/i.test(pathLower)) {
    return { kind: 'pdf', url: clean }
  }
  return { kind: 'external', url: clean }
}
