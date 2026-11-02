import type { Metadata } from 'next'
import LocalLink from '@/components/LocalLink'
import { createServerClient } from '@/lib/supabase-server'
import { buildPageAlternates, SITE_URL } from '@/lib/seo-metadata'
import AsesoresClient, { type PublicDirectoryAdvisor } from './AsesoresClient'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const isEn = locale === 'en'

  return {
    title: isEn
      ? 'Verified Real Estate Agencies & Advisors in Venezuela'
      : 'Inmobiliarias y Asesores Verificados en Venezuela',
    description: isEn
      ? 'Explore verified real estate agencies and advisors across Venezuela with active portfolios, client ratings, and direct contact.'
      : 'Directorio de agencias inmobiliarias y asesores verificados en Venezuela con cartera activa, reseñas verificadas y contacto directo.',
    alternates: buildPageAlternates(locale, '/asesores'),
  }
}

export default async function AsesoresDirectoryPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const isEn = locale === 'en'

  let items: PublicDirectoryAdvisor[] = []
  try {
    const supabase = createServerClient()
    const { data } = await supabase
      .from('vw_perfiles_publicos')
      .select(
        'id, slug, nombre, empresa_nombre, descripcion_agente, tipo_cuenta, estado, ciudad, foto_perfil_url, verificado, nivel_confianza, miembro_agencia_id, miembro_agencia_nombre, miembro_agencia_owner_id, licencia_corredor, zonas_especialidad, anos_experiencia, propiedades_activas, total_vendidas, num_resenas, promedio_resenas, visitas_atendidas',
      )
      .order('verificado', { ascending: false })
      .order('propiedades_activas', { ascending: false })
      .order('nivel_confianza', { ascending: false })
      .limit(120)

    items = ((data || []) as any[])
      .filter((row) => row.verificado || Number(row.propiedades_activas || 0) > 0)
      .map((row) => ({
        id: String(row.id),
        slug: row.slug || null,
        nombre: row.nombre || null,
        empresa_nombre: row.empresa_nombre || null,
        descripcion_agente: row.descripcion_agente || null,
        tipo_cuenta: row.tipo_cuenta || null,
        estado: row.estado || null,
        ciudad: row.ciudad || null,
        foto_perfil_url: row.foto_perfil_url || null,
        verificado: Boolean(row.verificado),
        nivel_confianza: Number(row.nivel_confianza || 0),
        miembro_agencia_id: row.miembro_agencia_id || null,
        miembro_agencia_nombre: row.miembro_agencia_nombre || null,
        miembro_agencia_owner_id: row.miembro_agencia_owner_id || null,
        licencia_corredor: row.licencia_corredor || null,
        zonas_especialidad: Array.isArray(row.zonas_especialidad) ? row.zonas_especialidad : [],
        anos_experiencia: row.anos_experiencia ?? null,
        propiedades_activas: Number(row.propiedades_activas || 0),
        total_vendidas: Number(row.total_vendidas || 0),
        num_resenas: Number(row.num_resenas || 0),
        promedio_resenas: Number(row.promedio_resenas || 0),
        visitas_atendidas: Number(row.visitas_atendidas || 0),
      }))
  } catch {
    items = []
  }

  const directoryJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: isEn
      ? 'Verified Real Estate Agencies & Advisors in Venezuela'
      : 'Inmobiliarias y Asesores Verificados en Venezuela',
    url: `${SITE_URL}${isEn ? '/en' : ''}/asesores`,
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: items.length,
      itemListElement: items.slice(0, 30).map((item, idx) => ({
        '@type': 'ListItem',
        position: idx + 1,
        item: {
          '@type': 'RealEstateAgent',
          name: item.miembro_agencia_nombre || item.empresa_nombre || item.nombre || 'Asesor',
          url: `${SITE_URL}${isEn ? '/en' : ''}/vendedor/${item.slug || item.id}`,
        },
      })),
    },
  }

  return (
    <div className="min-h-[70vh] bg-[#f7f4ee] py-10 px-4 sm:px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(directoryJsonLd).replace(/</g, '\\u003c'),
        }}
      />

      <div className="max-w-7xl mx-auto">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#8C6526] mb-1">
              {isEn ? 'Professional Directory' : 'Directorio Profesional'}
            </p>
            <h1 className="text-2xl sm:text-4xl font-black text-[#16294B] m-0">
              {isEn
                ? 'Real Estate Agencies & Verified Advisors'
                : 'Inmobiliarias y Asesores Verificados'}
            </h1>
            <p className="text-sm text-[#475569] mt-2 mb-0 max-w-2xl">
              {isEn
                ? 'Connect directly with verified real estate agencies and independent advisors across Venezuela.'
                : 'Conecta directamente con agencias inmobiliarias oficiales y asesores independientes con reputación verificada en toda Venezuela.'}
            </p>
          </div>

          <LocalLink
            href="/planes"
            className="inline-flex items-center gap-2 rounded-xl bg-[#16294B] hover:bg-[#0f1e38] text-white text-xs font-bold px-4 py-2.5 no-underline transition"
          >
            {isEn ? 'Are you an agency? View Pro plans' : '¿Eres agencia o asesor? Ver planes Pro'}
          </LocalLink>
        </div>

        <AsesoresClient initialItems={items} locale={locale} />
      </div>
    </div>
  )
}
