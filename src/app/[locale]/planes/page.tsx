import { Metadata } from 'next'
import { PlanActionsProvider, PlanActionButton, PlanTrialBadge } from './PlanActions'
import { Check, Star, Zap, Building2, User, HeartHandshake } from 'lucide-react'
import { buildPageAlternates } from '@/lib/seo-metadata'

interface PageProps {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  const en = locale === 'en'
  return {
    title: en ? 'Plans & Pricing' : 'Planes y Precios',
    description: en
      ? 'Choose the plan that best fits your needs: Free, Professional, Professional Plus, or Agency. 30-day free trial on any plan with no credit card and no automatic charges.'
      : 'Elige el plan que mejor se adapte a tus necesidades: Gratuita, Profesional, Profesional Plus o Agencia. Prueba gratuita de 30 días en cualquiera de los planes, como iniciativa solidaria para apoyar al sector inmobiliario.',
    alternates: buildPageAlternates(locale, '/planes'),
  }
}

const planes = [
  {
    id: 'gratuita' as const,
    nombre: 'Gratuita',
    nombreEn: 'Free',
    precioMensual: '$0',
    precioMensualEn: '$0',
    descripcion: 'Para quien vende o alquila su propio inmueble',
    descripcionEn: 'For owners selling or renting their own property',
    icon: User,
    color: 'gray' as const,
    features: [
      '3 anuncios activos',
      '8 fotos por inmueble',
      'Verificación de identidad gratuita',
    ],
    featuresEn: [
      '3 active listings',
      '8 photos per property',
      'Free identity verification',
    ],
    destacado: false,
    badge: undefined as string | undefined,
    badgeEn: undefined as string | undefined,
    trial: true,
  },
  {
    id: 'profesional' as const,
    nombre: 'Profesional',
    nombreEn: 'Professional',
    precioMensual: '$9,99/mes',
    precioMensualEn: '$9.99/mo',
    descripcion: 'Para agentes y corredores independientes',
    descripcionEn: 'For independent agents and brokers',
    icon: Star,
    color: 'brand-accent' as const,
    features: [
      '10 anuncios activos',
      '20 fotos por inmueble',
      '5 créditos incluidos al mes',
      'Escaparate con URL personalizada',
      'Perfil profesional público y estadísticas',
      'Enlace a vídeo y recorridos/planos',
      'Soporte prioritario',
      'Verificación de identidad gratuita',
    ],
    featuresEn: [
      '10 active listings',
      '20 photos per property',
      '5 monthly credits included',
      'Custom storefront URL',
      'Public professional profile & analytics',
      'Video & virtual tour/floor plan links',
      'Priority support',
      'Free identity verification',
    ],
    destacado: true,
    badge: 'MÁS POPULAR',
    badgeEn: 'MOST POPULAR',
    trial: true,
  },
  {
    id: 'profesional_plus' as const,
    nombre: 'Profesional Plus',
    nombreEn: 'Professional Plus',
    precioMensual: '$19,99/mes',
    precioMensualEn: '$19.99/mo',
    descripcion: 'Alta capacidad para agentes independientes con amplia cartera (1 usuario, sin multiagente)',
    descripcionEn: 'High capacity for top-producing solo agents (1 user, no multi-agent team)',
    icon: Zap,
    color: 'indigo' as const,
    features: [
      '35 anuncios activos (alta capacidad)',
      '30 fotos por inmueble',
      '12 créditos incluidos al mes (mayor bolsa de créditos)',
      '1 usuario individual (sin funciones multiagente)',
      'Escaparate con URL personalizada y estadísticas',
      'Enlace a vídeo y recorridos/planos',
      'Asistencia prioritaria',
      'Solicitud de asistencia por teléfono',
      'Ayuda en la importación masiva de su cartera de inmuebles',
      'Verificación de identidad gratuita',
    ],
    featuresEn: [
      '35 active listings (high capacity)',
      '30 photos per property',
      '12 monthly credits included (expanded credit pool)',
      'Single-user account (no multi-agent features)',
      'Custom storefront URL & full analytics',
      'Video & virtual tour/floor plan links',
      'Priority support',
      'Phone support callback on request',
      'Assisted bulk import of your property portfolio',
      'Free identity verification',
    ],
    destacado: false,
    badge: 'ALTA CAPACIDAD',
    badgeEn: 'HIGH CAPACITY',
    trial: true,
  },
  {
    id: 'agencia' as const,
    nombre: 'Agencia',
    nombreEn: 'Agency',
    precioMensual: '$39,99/mes',
    precioMensualEn: '$39.99/mo',
    descripcion: 'Para inmobiliarias con equipo de asesores y cartera propia',
    descripcionEn: 'For brokerages managing an advisor team and shared portfolio',
    icon: Building2,
    color: 'brand-primary' as const,
    features: [
      'Anuncios activos sin límite',
      '30 fotos por inmueble',
      '20 créditos incluidos al mes',
      'Gestión de equipo de agentes por invitación',
      'Cartera protegida con reasignación de asesores',
      'Asignación controlada de créditos a agentes',
      'Escaparate oficial con equipo y URL personalizada',
      'Enlace a vídeo y recorridos/planos',
      'Asistencia prioritaria',
      'Solicitud de asistencia por teléfono',
      'Ayuda en la importación masiva de su cartera de inmuebles',
      'Verificación de identidad gratuita',
    ],
    featuresEn: [
      'Unlimited active listings',
      '30 photos per property',
      '20 monthly credits included',
      'Agent team management via email or link invite',
      'Protected agency portfolio with advisor reassignment',
      'Controlled credit allocation to agents',
      'Official agency storefront with team & custom URL',
      'Video & virtual tour/floor plan links',
      'Priority support',
      'Phone support callback on request',
      'Assisted bulk import of your property portfolio',
      'Free identity verification',
    ],
    destacado: false,
    badge: undefined as string | undefined,
    badgeEn: undefined as string | undefined,
    trial: true,
  },
]

export default async function PlanesPage({ params }: PageProps) {
  const { locale } = await params
  const en = locale === 'en'

  const faqs = en
    ? [
        {
          q: 'How does the 30-day free trial work?',
          a: 'When you create your account, we activate a 30-day free trial on the plan you select: Free, Professional, Professional Plus, or Agency. You start without a credit card and with zero automatic charges. Switching plans during the trial applies the selected plan’s limits immediately without resetting your original 30-day trial window.',
        },
        {
          q: 'What is the difference between Professional Plus and Agency?',
          a: 'Professional Plus ($19.99/mo) is designed for a single independent agent who manages a large portfolio (up to 35 active listings, 30 photos per listing, and 12 monthly credits, without multi-agent tools). Agency ($39.99/mo) is built for brokerages with multiple advisors: it offers unlimited listings, 20 monthly credits, agent onboarding via email/link, advisor performance analytics, and full portfolio ownership when agents rotate.',
        },
        {
          q: 'What happens when the trial ends if I choose not to pay?',
          a: 'There are no automatic charges and you never lose your listings. Your account returns to the Free plan (up to 3 active listings and 8 photos per new listing). Any active listings and photos already published above that quota remain online and editable; to publish new listings or reactivate paused ones above 3 active listings, simply free up slots down to 3 or activate a paid plan.',
        },
        {
          q: 'How do included monthly credits work?',
          a: 'Included monthly credits let you boost listings to #1 (1 credit) or feature them for 12h (4 credits), 24h (6 credits), or 48h (10 credits). Professional includes 5 credits, Professional Plus includes 12 credits, and Agency includes 20 credits per 30-day period; included credits are consumed before any purchased credit packages.',
        },
        {
          q: 'How do I add and manage my real estate agents on the Agency plan?',
          a: 'From the Team tab in your dashboard, send an invitation by email or generate a direct onboarding link for WhatsApp. Your advisors join with a free account, inherit unlimited listings and 30 photos under your agency, and receive calls, WhatsApp and chat directly on their assigned properties—while your agency retains full ownership of the portfolio and controls credit allocation.',
        },
        {
          q: 'What does free identity verification mean?',
          a: 'We verify your identity free of charge across all plans to build trust in the community. The badge confirms a real verified person or business account, though it does not certify property title or legal ownership.',
        },
      ]
    : [
        {
          q: '¿Cómo funciona la prueba gratuita de 30 días?',
          a: 'Como iniciativa solidaria para apoyar al sector inmobiliario, al crear tu cuenta activamos 30 días de prueba gratis en el plan que elijas: Gratuita, Profesional, Profesional Plus o Agencia. Empiezas sin tarjeta de crédito y sin cobros automáticos. Cambiar de plan durante la prueba aplica el cupo del nuevo plan sin reiniciar el plazo original de 30 días.',
        },
        {
          q: '¿Cuál es la diferencia entre Profesional Plus y Agencia?',
          a: 'Profesional Plus ($19,99/mes) está pensado para un único agente independiente con amplia cartera de captaciones (hasta 35 anuncios activos, 30 fotos por inmueble y 12 créditos mensuales, sin funciones multiagente). Agencia ($39,99/mes) está diseñado para inmobiliarias con equipo de varios asesores: ofrece anuncios ilimitados, 20 créditos mensuales, invitación de agentes, embudo por asesor y protección de cartera si un agente se desvincula.',
        },
        {
          q: '¿Qué pasa cuando termina la prueba si no deseo pagar?',
          a: 'No habrá ningún cobro automático ni perderás tus anuncios publicados. Tu cuenta pasa al plan Gratuito (cupo de 3 anuncios activos y 8 fotos para nuevas subidas). Si ya tenías más anuncios activos o más fotos guardadas, se conservan publicados y editables; para publicar anuncios nuevos o reactivar pausados por encima de 3 activos deberás liberar cupo o activar un plan de pago.',
        },
        {
          q: '¿Qué son los créditos incluidos?',
          a: 'Los créditos incluidos te permiten subir tus anuncios al #1 (1 crédito) o destacarlos por 12h (4 créditos), 24h (6 créditos) o 48h (10 créditos). El plan Profesional incluye 5 créditos, Profesional Plus incluye 12 créditos y Agencia incluye 20 créditos por período de 30 días; se consumen automáticamente antes que tus paquetes de créditos comprados.',
        },
        {
          q: '¿Cómo incorporo y controlo a los agentes de mi inmobiliaria en el plan Agencia?',
          a: 'Desde la pestaña «Equipo» de tu panel puedes enviar invitaciones por correo o generar un enlace directo para WhatsApp. Tus asesores entran con una cuenta gratuita, heredan anuncios sin límite y hasta 30 fotos bajo tu inmobiliaria, y reciben directamente las llamadas, WhatsApp y mensajes de sus captaciones. Toda la cartera permanece protegida a nombre de la agencia (puedes reasignar inmuebles en cualquier momento) y solo el titular controla el reparto de créditos.',
        },
        {
          q: '¿Qué significa la verificación de identidad gratuita?',
          a: 'Verificamos tu identidad gratuitamente en todos los planes para generar más confianza en la comunidad. Esto indicará que eres una persona real, aunque ten en cuenta que la insignia de identidad verificada no afirma la titularidad ni certifica el estado legal de los inmuebles publicados.',
        },
      ]

  return (
    <div className="min-h-screen bg-brand-gray py-16">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-4">
            <span className="inline-flex items-center gap-2 bg-brand-primary/10 text-brand-primary px-4 py-2 rounded-full text-sm font-medium">
              <HeartHandshake className="w-4 h-4" />
              {en ? 'Community Initiative: 30-day free trial' : 'Iniciativa Solidaria: 30 días de prueba gratis'}
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-brand-dark mb-4">
            {en ? 'Plans & Pricing' : 'Planes y Precios'}
          </h1>
          <p className="text-xl text-brand-dark/70 max-w-2xl mx-auto">
            {en
              ? 'Choose the right plan for your properties. New accounts include a 30-day free trial with no card and no automatic charges. Switching plans during the trial does not reset your trial end date.'
              : 'Elige el plan ideal para ti. Al crear tu cuenta tienes una prueba gratuita de 30 días, sin tarjeta y sin cobros automáticos. Cambiar de plan durante la prueba no reinicia ese plazo.'}
          </p>
        </div>

        {/* Planes Grid (4 planes) */}
        <PlanActionsProvider>
          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-6 max-w-7xl mx-auto items-stretch">
            {planes.map((plan) => {
              const Icon = plan.icon
              const badge = en ? plan.badgeEn : plan.badge
              const nombre = en ? plan.nombreEn : plan.nombre
              const descripcion = en ? plan.descripcionEn : plan.descripcion
              const precio = en ? plan.precioMensualEn : plan.precioMensual
              const lista = en ? plan.featuresEn : plan.features
              return (
                <div
                  key={plan.id}
                  className={`relative bg-white rounded-2xl shadow-lg p-7 flex flex-col ${
                    plan.destacado
                      ? 'ring-2 ring-brand-accent xl:scale-[1.02]'
                      : plan.id === 'profesional_plus'
                        ? 'ring-1 ring-indigo-200'
                        : ''
                  }`}
                >
                  {badge && (
                    <div
                      className={`absolute -top-3.5 left-1/2 -translate-x-1/2 px-3.5 py-1 rounded-full text-xs font-bold shadow-sm whitespace-nowrap ${
                        plan.id === 'profesional_plus'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-brand-accent text-[var(--on-gold)]'
                      }`}
                    >
                      {badge}
                    </div>
                  )}

                  <div className="mb-6">
                    <Icon
                      className={`w-11 h-11 mb-4 ${
                        plan.color === 'brand-accent'
                          ? 'text-[var(--gold-text)]'
                          : plan.color === 'indigo'
                            ? 'text-indigo-600'
                            : plan.color === 'brand-primary'
                              ? 'text-brand-primary'
                              : 'text-gray-600'
                      }`}
                    />
                    <h2 className="text-2xl font-bold text-brand-dark mb-2">
                      {nombre}
                    </h2>
                    <p className="text-brand-dark/70 text-sm mb-3 min-h-[44px]">
                      {descripcion}
                    </p>
                    <PlanTrialBadge />
                    <div className="mb-2">
                      <span className="text-3xl lg:text-4xl font-bold text-brand-dark">
                        {precio}
                      </span>
                    </div>
                  </div>

                  <ul className="space-y-2.5 mb-8 flex-grow">
                    {lista.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2.5">
                        <Check className="w-5 h-5 text-[var(--gold-text)] flex-shrink-0 mt-0.5" />
                        <span className="text-gray-700 text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <PlanActionButton
                    plan={plan.id}
                    className={`block w-full text-center py-3 rounded-lg font-medium transition-colors ${
                      plan.destacado
                        ? 'bg-brand-accent hover:brightness-105 text-[var(--on-gold)]'
                        : plan.id === 'profesional_plus'
                          ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                          : plan.id === 'agencia'
                            ? 'bg-brand-primary hover:bg-brand-dark text-white'
                            : 'bg-gray-100 hover:bg-gray-200 text-brand-dark'
                    }`}
                  />
                </div>
              )
            })}
          </div>
        </PlanActionsProvider>

        {/* FAQ */}
        <div className="mt-20 max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-brand-dark mb-8">
            {en ? 'Free Trial Terms & Frequently Asked Questions' : 'Condiciones de la Prueba Gratis y Preguntas Frecuentes'}
          </h2>
          <div className="space-y-6">
            {faqs.map((item) => (
              <div key={item.q} className="bg-white p-6 rounded-xl shadow-sm">
                <h3 className="font-bold text-lg mb-2 text-brand-dark">{item.q}</h3>
                <p className="text-gray-600">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
