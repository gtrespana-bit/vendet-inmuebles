import Image from 'next/image'
import type { Metadata } from 'next'
import { getLocale } from 'next-intl/server'
import LocalLink from '@/components/LocalLink'
import LandingNav from '@/components/landing/LandingNav'
import styles from '@/components/landing/landing.module.css'

// Self-hosted typefaces (no external request, no layout shift)
import '@fontsource/playfair-display/400.css'
import '@fontsource/playfair-display/400-italic.css'
import '@fontsource/inter/200.css'
import '@fontsource/inter/300.css'
import '@fontsource/inter/400.css'
import '@fontsource/roboto-mono/300.css'
import '@fontsource/roboto-mono/400.css'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  const isEnglish = locale === 'en'

  return {
    title: isEnglish
      ? 'Venezuela Inmuebles — Tropical Architecture, International Perspective'
      : 'Venezuela Inmuebles — Arquitectura tropical, perspectiva internacional',
    description: isEnglish
      ? 'A private collection of architectural residences in Venezuela. Curated penthouses, villas and estates in Caracas, Lechería and Margarita.'
      : 'Una colección privada de residencias de autor en Venezuela. Penthouses, villas y fincas seleccionadas en Caracas, Lechería y Margarita.',
    alternates: {
      canonical: locale === 'es' ? '/' : `/${locale}`,
    },
    openGraph: {
      title: isEnglish
        ? 'Venezuela Inmuebles — Tropical Architecture, International Perspective'
        : 'Venezuela Inmuebles — Arquitectura tropical, perspectiva internacional',
      description: isEnglish
        ? 'A private collection of architectural residences in Venezuela.'
        : 'Una colección privada de residencias de autor en Venezuela.',
      images: [{ url: '/landing/hero-penthouse.jpg', width: 1600, height: 900 }],
    },
  }
}

const ARCHIVE = [
  { index: '01', name: 'Casa Ávila', place: 'Caracas / Country Club', price: '$2,500,000' },
  { index: '02', name: 'Penthouse Lechería', place: 'Anzoátegui / Lechería', price: '$1,850,000' },
  { index: '03', name: 'Villa El Hatillo', place: 'Caracas / El Hatillo', price: '$3,200,000' },
  { index: '04', name: 'Residencia Cerro Verde', place: 'Nueva Esparta / Margarita', price: '$1,240,000' },
] as const

export default function EditorialLandingPage() {
  return (
    <div className={`editorialLanding ${styles.page}`}>
      {/* Structural blueprint lines */}
      <div className={styles.guides} aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>

      <LandingNav />

      <section className={styles.hero} aria-labelledby="hero-title">
        <div className={styles.watermark} aria-hidden="true">
          01
        </div>

        <p className={styles.kicker}>Índice 01 — Caracas, Venezuela</p>

        <h1 className={styles.headline} id="hero-title">
          <span>Arquitectura</span>
          <span>
            Tropical<i className={styles.dot}>.</i>
          </span>
          <span className={styles.headlineSub}>Perspectiva</span>
          <span className={styles.headlineSub}>
            Internacional<i className={styles.dot}>.</i>
          </span>
        </h1>

        <figure className={styles.figure}>
          <div className={styles.figureFrame}>
            <Image
              src="/landing/hero-penthouse.jpg"
              alt="Penthouse minimalista en concreto y bronce sobre el valle de Caracas, fotografiado al atardecer"
              fill
              priority
              sizes="(max-width: 900px) 100vw, 55vw"
            />
          </div>

          <div className={styles.card}>
            <div className={styles.cardTop}>
              <span className={styles.cardRef}>Ref. 01</span>
              <span className={styles.cardCoords}>10.4846° N, 66.8617° W</span>
            </div>

            <p className={styles.cardData}>
              <span>Caracas</span>
              <span>Country Club</span>
              <span>4 Hab</span>
              <span>650 m²</span>
              <span>$2,500,000</span>
            </p>

            <div className={styles.cardFoot}>
              <span>Solicitar ficha técnica</span>
              <span aria-hidden="true">↗</span>
            </div>
          </div>

          <figcaption className={styles.caption}>
            <span>Fig. 01 — Penthouse, Las Mercedes · Caracas</span>
            <span>Golden hour, 18:42</span>
          </figcaption>
        </figure>

        <aside className={styles.heroNote}>
          <span className={styles.heroNoteIndex}>N° 01 — Archivo</span>
          <p>
            Colección privada de residencias de autor en Venezuela. El acceso se concede únicamente por
            invitación.
          </p>
        </aside>

        <LocalLink href="/contacto" className={styles.heroCta}>
          Solicitar acceso privado
        </LocalLink>

        <div className={styles.rail}>
          <span className={styles.scrollCue}>Deslizar</span>
          <div className={styles.railMeta}>
            <span>
              Colección privada — <strong>MMXXVI</strong>
            </span>
            <span>
              <strong>01</strong> / 04
            </span>
          </div>
        </div>
      </section>

      <section className={styles.manifesto} aria-labelledby="manifesto-title">
        <div className={styles.sectionLabel}>
          <span>Manifiesto — 02</span>
          <span>Agencia de arquitectura y patrimonio</span>
        </div>

        <h2 className={styles.manifestoText} id="manifesto-title">
          No vendemos metros cuadrados. Custodiamos la luz, la proporción y el silencio.
        </h2>

        <div className={styles.manifestoAside}>
          <p>
            Cada residencia del archivo se elige por su arquitectura, no por su inventario. Trabajamos con un
            número limitado de propiedades al año, documentadas con planos, orientación solar y memoria de
            materiales.
          </p>
          <p>Un solo criterio: que la casa siga siendo extraordinaria dentro de veinte años.</p>
        </div>

        <div className={styles.stats}>
          <div className={styles.stat}>
            <strong>24</strong>
            <span>Propiedades en archivo</span>
          </div>
          <div className={styles.stat}>
            <strong>06</strong>
            <span>Ciudades representadas</span>
          </div>
          <div className={styles.stat}>
            <strong>01</strong>
            <span>Criterio de selección</span>
          </div>
        </div>
      </section>

      <section className={styles.indexSection} aria-labelledby="archive-title">
        <div className={styles.indexHead}>
          <h2 id="archive-title">Archivo</h2>
          <span>Selección MMXXVI — 04 residencias</span>
        </div>

        <ul>
          {ARCHIVE.map((item) => (
            <li key={item.index}>
              <LocalLink href="/propiedades" className={styles.row}>
                <span className={styles.rowNum}>{item.index}</span>
                <span className={styles.rowName}>{item.name}</span>
                <span className={styles.rowPlace}>{item.place}</span>
                <span className={styles.rowPrice}>{item.price}</span>
                <span className={styles.rowArrow} aria-hidden="true">
                  ↗
                </span>
              </LocalLink>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.access} aria-labelledby="access-title">
        <h2 className={styles.accessTitle} id="access-title">
          Solicitar acceso
          <em>privado.</em>
        </h2>

        <div className={styles.accessAside}>
          <span>
            Concierge
            <br />
            <a href="tel:+582125550128">+58 212 555 0128</a>
          </span>
          <span>
            Correspondencia
            <br />
            <a href="mailto:acceso@venezuelainmuebles.online">acceso@venezuelainmuebles.online</a>
          </span>
          <span>Visitas únicamente con cita previa</span>
        </div>

        <LocalLink href="/contacto" className={styles.accessLink}>
          <span>Agendar una visita privada</span>
          <em aria-hidden="true">↗</em>
        </LocalLink>
      </section>

      <footer className={styles.colophon}>
        <span>Venezuela Inmuebles — MMXXVI</span>
        <span>Caracas · Lechería · Margarita</span>
        <span>10.4846° N, 66.8617° W</span>
      </footer>
    </div>
  )
}
