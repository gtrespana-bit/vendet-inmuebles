import type { Metadata } from 'next'
import { createServerClient } from '@/lib/supabase-server'
import { buildPageAlternates } from '@/lib/seo-metadata'
import { isUuidIdentifier } from '@/lib/storefront-slug'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}): Promise<Metadata> {
  const { locale, id: rawParam } = await params
  const en = locale === 'en'
  const decoded = decodeURIComponent(rawParam || '').trim()

  try {
    const supabase = createServerClient()
    let query = supabase
      .from('vw_perfiles_publicos')
      .select('id, slug, nombre, empresa_nombre, descripcion_agente, ciudad, estado')

    query = isUuidIdentifier(decoded)
      ? query.eq('id', decoded)
      : query.eq('slug', decoded.toLowerCase())

    const { data: profile } = await query.maybeSingle()

    if (!profile) {
      return {
        title: en ? 'Seller profile' : 'Perfil de anunciante',
        robots: { index: false, follow: true },
      }
    }

    const canonicalSegment = profile.slug || profile.id
    const displayName = profile.empresa_nombre || profile.nombre || (en ? 'Seller' : 'Anunciante')
    const place = [profile.ciudad, profile.estado].filter(Boolean).join(', ')
    const description =
      profile.descripcion_agente ||
      (en
        ? `Active real estate listings by ${displayName}${place ? ` in ${place}` : ''} on Venezuela Inmuebles.`
        : `Propiedades activas publicadas por ${displayName}${place ? ` en ${place}` : ''} en Venezuela Inmuebles.`)

    return {
      title: displayName,
      description,
      alternates: buildPageAlternates(locale, `/vendedor/${canonicalSegment}`),
    }
  } catch {
    return {
      title: en ? 'Seller profile' : 'Perfil de anunciante',
      alternates: buildPageAlternates(locale, `/vendedor/${encodeURIComponent(decoded)}`),
    }
  }
}

export default function VendedorLayout({ children }: { children: React.ReactNode }) {
  return children
}
