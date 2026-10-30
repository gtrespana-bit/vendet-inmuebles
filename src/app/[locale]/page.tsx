import Image from 'next/image'
import type { Metadata } from 'next'
import { getLocale, getTranslations } from 'next-intl/server'
import { Playfair_Display, Inter, Roboto_Mono } from 'next/font/google'
import LocalLink from '@/components/LocalLink'

const playfair = Playfair_Display({ subsets: ['latin'], weight: ['400', '600'] })
const inter = Inter({ subsets: ['latin'], weight: ['300', '400', '600'] })
const robotoMono = Roboto_Mono({ subsets: ['latin'], weight: ['400'] })

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  const t = await getTranslations({ locale, namespace: 'home' })
  const isEnglish = locale === 'en'

  return {
    title: isEnglish ? 'Venezuela Inmuebles | Properties & Real Estate' : 'Venezuela Inmuebles | Compra y Venta de Propiedades',
    description: isEnglish
      ? 'Find your next home in Venezuela. Buy, sell or rent houses, apartments, and commercial spaces with ease.'
      : 'Encuentra tu próximo hogar en Venezuela. Compra, vende o alquila casas, apartamentos y locales comerciales de forma fácil y segura.',
    alternates: {
      canonical: locale === 'es' ? '/' : `/${locale}`
    }
  }
}

export default function LuxuryLandingPage() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        .site-header, .site-footer, .bottom-tab-nav, .pwa-install-banner, .push-notification-banner { display: none !important; }
        body { background-color: #121212; color: #FFFFFF; margin: 0; padding: 0; overflow-x: hidden; }
        
        /* Grid guide lines */
        .architectural-guides {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          pointer-events: none;
          z-index: 0;
          display: flex;
          justify-content: space-between;
          padding: 0 5%;
        }
        .architectural-guides::before,
        .architectural-guides::after,
        .guide-line {
          content: '';
          width: 1px;
          height: 100%;
          background-color: rgba(255,255,255,0.05);
        }

        /* Responsive typography */
        .headline-text {
          font-family: ${playfair.style.fontFamily}, serif;
          font-size: clamp(2.5rem, 6vw, 5.5rem);
          line-height: 1.05;
          letter-spacing: -0.02em;
          text-transform: uppercase;
        }

        .giant-watermark {
          position: absolute;
          top: -5vh;
          left: -2vw;
          font-family: ${inter.style.fontFamily}, sans-serif;
          font-size: clamp(20rem, 40vw, 40rem);
          font-weight: 300;
          color: rgba(255,255,255,0.02);
          line-height: 1;
          z-index: 0;
          pointer-events: none;
          letter-spacing: -0.05em;
        }

        .cta-btn {
          position: relative;
          display: inline-block;
          text-decoration: none;
          color: #FFFFFF;
          font-family: ${inter.style.fontFamily}, sans-serif;
          font-size: 0.75rem;
          font-weight: 600;
          letter-spacing: 0.2em;
          padding-bottom: 8px;
        }
        .cta-btn::after {
          content: '';
          position: absolute;
          left: 0;
          bottom: 0;
          width: 100%;
          height: 1px;
          background-color: #C5A880;
          transition: transform 0.3s ease;
          transform-origin: right;
        }
        .cta-btn:hover::after {
          transform: scaleX(0);
          transform-origin: left;
        }

        .nav-link {
          color: #8E8E93;
          font-family: ${inter.style.fontFamily}, sans-serif;
          font-size: 0.65rem;
          letter-spacing: 0.15em;
          text-decoration: none;
          transition: color 0.3s;
        }
        .nav-link:hover {
          color: #FFFFFF;
        }

        .hamburger {
          display: none;
          flex-direction: column;
          gap: 6px;
          cursor: pointer;
        }
        .hamburger-line {
          width: 32px;
          height: 1px;
          background-color: #FFFFFF;
        }

        .mobile-cta-wrapper {
          display: none;
        }

        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          .hamburger { display: flex !important; }
          
          .hero-container {
            flex-direction: column;
            padding-top: 120px;
          }
          
          .headline-container {
            width: 100% !important;
            padding-left: 5% !important;
            margin-bottom: 40px !important;
          }

          .hero-image-wrapper {
            width: 100% !important;
            margin-left: 0;
            aspectRatio: '4/5' !important;
          }

          .hero-card {
            position: relative !important;
            bottom: auto !important;
            left: auto !important;
            width: 100% !important;
            border-left: none !important;
            border-right: none !important;
            padding: 24px 5% !important;
          }

          .mobile-cta-wrapper {
            display: block;
            width: 100%;
            margin-top: 40px;
            padding: 0 5%;
          }

          .mobile-cta-btn {
            display: block;
            width: 100%;
            background-color: #2C3A2E;
            color: #FFFFFF;
            text-align: center;
            padding: 24px 0;
            font-family: ${inter.style.fontFamily}, sans-serif;
            font-size: 0.75rem;
            letter-spacing: 0.2em;
            text-decoration: none;
            border: 1px solid #C5A880;
            border-radius: 0;
          }
        }
      `}} />

      {/* Guide lines */}
      <div className="architectural-guides">
        <div className="guide-line"></div>
        <div className="guide-line"></div>
      </div>

      <div style={{ position: 'relative', minHeight: '100vh', zIndex: 1 }} className={inter.className}>
        <div className="giant-watermark">01</div>

        {/* Header */}
        <header style={{ 
          position: 'absolute', 
          top: 0, 
          width: '100%', 
          padding: '40px 5%', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          zIndex: 10 
        }}>
          <div style={{ width: '40px', height: '40px', border: '1px solid #FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="1" strokeLinecap="square" strokeLinejoin="miter">
              <path d="M3 21h18" />
              <path d="M12 21V3" />
              <path d="M5 21V7" />
              <path d="M19 21V11" />
            </svg>
          </div>
          
          <nav className="desktop-nav" style={{ display: 'flex', gap: '48px' }}>
            <LocalLink href="/coleccion" className="nav-link">COLLECTION</LocalLink>
            <LocalLink href="/archivo" className="nav-link">ARCHIVE</LocalLink>
            <LocalLink href="/concierge" className="nav-link">CONCIERGE</LocalLink>
          </nav>

          <div className="desktop-nav">
            <LocalLink href="/acceso" className="cta-btn">SOLICITAR ACCESO PRIVADO</LocalLink>
          </div>

          <div className="hamburger">
            <div className="hamburger-line"></div>
            <div className="hamburger-line"></div>
          </div>
        </header>

        {/* Hero Section */}
        <main style={{ 
          position: 'relative',
          paddingTop: '18vh',
          display: 'flex',
          flexDirection: 'column'
        }} className="hero-container">
          
          <div className="headline-container" style={{ 
            position: 'relative', 
            zIndex: 3, 
            width: '65%', 
            paddingLeft: '10%',
            marginBottom: '-6vw'
          }}>
            <h1 className="headline-text" style={{ margin: 0, color: '#FFFFFF' }}>
              <span style={{ display: 'block' }}>Arquitectura</span>
              <span style={{ display: 'block' }}>Tropical.</span>
              <span style={{ display: 'block', color: '#8E8E93' }}>Perspectiva</span>
              <span style={{ display: 'block', color: '#8E8E93' }}>Internacional.</span>
            </h1>
          </div>

          <div style={{ position: 'relative', display: 'flex', justifyContent: 'flex-end', width: '100%', paddingRight: '5%' }}>
            <div className="hero-image-wrapper" style={{ 
              position: 'relative', 
              width: '75%', 
              aspectRatio: '16/9', 
              backgroundColor: '#2C3A2E' 
            }}>
              <Image 
                src="https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?ixlib=rb-4.0.3&auto=format&fit=crop&w=2075&q=80"
                alt="Penthouse Architecture"
                fill
                priority
                style={{ objectFit: 'cover', filter: 'brightness(0.85) contrast(1.1)' }}
              />
              
              <div className="hero-card" style={{
                position: 'absolute',
                bottom: '-20px',
                left: '-40px',
                backgroundColor: '#121212',
                border: '1px solid #C5A880',
                padding: '32px 40px',
                zIndex: 4,
                width: '420px',
                borderRadius: '0'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                  <div style={{
                    width: '6px',
                    height: '6px',
                    backgroundColor: '#C5A880'
                  }}></div>
                  <div className={robotoMono.className} style={{
                    color: '#8E8E93',
                    fontSize: '0.55rem',
                    letterSpacing: '0.1em'
                  }}>
                    10.4846° N, 66.8617° W
                  </div>
                </div>
                
                <div className={inter.className} style={{
                  color: '#FFFFFF',
                  fontSize: '0.65rem',
                  fontWeight: 400,
                  letterSpacing: '0.25em',
                  lineHeight: '2'
                }}>
                  CARACAS / COUNTRY CLUB<br/>
                  4 HAB / 650 M² / $2,500,000
                </div>
              </div>
            </div>
          </div>

          <div className="mobile-cta-wrapper">
             <LocalLink href="/acceso" className="mobile-cta-btn">
               SOLICITAR ACCESO PRIVADO
             </LocalLink>
          </div>

        </main>
      </div>
    </>
  )
}
