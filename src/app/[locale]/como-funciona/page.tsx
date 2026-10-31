import type { Metadata } from 'next'
import { CheckCircle, Shield, MessageCircle, Eye, Camera } from 'lucide-react'
import LocalLink from '@/components/LocalLink'
import { getTranslations } from 'next-intl/server'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  return {
    title: locale === 'en' ? 'How it works' : 'Cómo funciona',
    description: locale === 'en'
      ? 'Learn how to search for, list and evaluate properties on Venezuela Inmuebles.'
      : 'Descubre cómo buscar, anunciar y evaluar inmuebles en Venezuela Inmuebles.',
  }
}

export default async function ComoFuncionaPage() {
  const t = await getTranslations('howItWorks')

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: t('heroTitle'),
    description: t('heroSubtitle'),
    url: 'https://venezuela-inmuebles.online/como-funciona',
    step: [
      { '@type': 'HowToStep', name: t('step1Title'), text: t('step1Desc') },
      { '@type': 'HowToStep', name: t('step2Title'), text: t('step2Desc') },
      { '@type': 'HowToStep', name: t('step3Title'), text: t('step3Desc') },
      { '@type': 'HowToStep', name: t('step4Title'), text: t('step4Desc') },
    ],
  }

  const pasos = [
    { icon: <Camera className="text-[var(--gold-text)]" size={32} />, titulo: t('step1Title'), desc: t('step1Desc') },
    { icon: <Eye className="text-[var(--gold-text)]" size={32} />, titulo: t('step2Title'), desc: t('step2Desc') },
    { icon: <MessageCircle className="text-[var(--gold-text)]" size={32} />, titulo: t('step3Title'), desc: t('step3Desc') },
    { icon: <Shield className="text-[var(--gold-text)]" size={32} />, titulo: t('step4Title'), desc: t('step4Desc') },
  ]

  const faqs = [
    { pregunta: t('faq1q'), respuesta: t('faq1a') },
    { pregunta: t('faq2q'), respuesta: t('faq2a') },
    { pregunta: t('faq3q'), respuesta: t('faq3a') },
    { pregunta: t('faq4q'), respuesta: t('faq4a') },
    { pregunta: t('faq5q'), respuesta: t('faq5a') },
    { pregunta: t('faq6q'), respuesta: t('faq6a') },
  ]

  const platformItems = ['platform1','platform2','platform3','platform4','platform5'] as const
  const othersItems = ['others1','others2','others3','others4','others5'] as const

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <div className="min-h-screen bg-gray-50">
        <div className="bg-gradient-to-r from-brand-primary to-brand-dark text-white py-16 px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-black mb-4">{t('heroTitle')}</h1>
            <p className="text-xl text-white/80">{t('heroSubtitle')}</p>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {pasos.map((paso, i) => (
              <div key={i} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 flex gap-4">
                <div className="flex-shrink-0">
                  <div className="w-14 h-14 bg-gray-50 rounded-xl flex items-center justify-center">{paso.icon}</div>
                </div>
                <div>
                  <h3 className="font-bold text-lg text-gray-900 mb-1">{paso.titulo}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">{paso.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <section className="bg-[#f7f3ed] border-y border-[#E6E2D6] py-12 px-4">
          <div className="max-w-4xl mx-auto">
            <p className="text-center text-[10px] font-bold uppercase tracking-[0.16em] text-[#8C6526] mb-2">
              {t('journeyEyebrow')}
            </p>
            <h2 className="text-2xl md:text-3xl font-normal text-[#342d28] mb-7 text-center font-serif">
              {t('vsTitle')}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <article className="bg-[#fffdfa] border border-[#E6E2D6] p-6 md:p-7">
                <h3 className="font-bold text-[var(--burgundy)] text-lg mb-4">{t('platformTitle')}</h3>
                <ul className="space-y-3 text-sm text-[#414B59]">
                  {platformItems.map(k => (
                    <li key={k} className="flex items-start gap-2.5">
                      <CheckCircle size={15} className="mt-0.5 shrink-0 text-[#65816a]" aria-hidden="true" />
                      <span>{t(k)}</span>
                    </li>
                  ))}
                </ul>
              </article>
              <article className="bg-[#eee7dc] border border-[#e1d6c5] p-6 md:p-7">
                <h3 className="font-bold text-[#5e503d] text-lg mb-4">{t('othersTitle')}</h3>
                <ul className="space-y-3 text-sm text-[#414B59]">
                  {othersItems.map(k => (
                    <li key={k} className="flex items-start gap-2.5">
                      <Shield size={15} className="mt-0.5 shrink-0 text-[#8C6526]" aria-hidden="true" />
                      <span>{t(k)}</span>
                    </li>
                  ))}
                </ul>
              </article>
            </div>
          </div>
        </section>

        <div className="max-w-3xl mx-auto px-4 py-12">
          <h2 className="text-2xl font-black text-gray-900 mb-8 text-center">{t('faqTitle')}</h2>
          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <details key={i} className="bg-white rounded-xl border border-gray-100 group">
                <summary className="cursor-pointer p-5 font-semibold text-gray-900 flex justify-between items-center list-none">
                  {faq.pregunta}
                  <span className="text-[var(--gold-text)] group-open:rotate-45 transition-transform text-xl">+</span>
                </summary>
                <div className="px-5 pb-5 text-gray-600 leading-relaxed">{faq.respuesta}</div>
              </details>
            ))}
          </div>
        </div>

        <div className="bg-white border-t border-b border-gray-100 py-10 px-4">
          <div className="max-w-2xl mx-auto text-center flex flex-col sm:flex-row gap-4 justify-center">
            <LocalLink href="/publicar-inmueble" className="bg-brand-accent text-[var(--on-gold)] px-8 py-3 rounded-lg font-bold hover:bg-accent/90 transition inline-block">
              {t('ctaPublish')}
            </LocalLink>
            <LocalLink href="/catalogo" className="bg-white border-2 border-brand-primary text-brand-primary px-8 py-3 rounded-lg font-bold hover:bg-brand-primary hover:text-white transition inline-block">
              {t('ctaCatalog')}
            </LocalLink>
          </div>
        </div>

        <div className="h-8" />
      </div>
    </>
  )
}
