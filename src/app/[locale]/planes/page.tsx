import { Metadata } from 'next'
import Link from 'next/link'
import { Check, Star, Building2, User, Building, HeartHandshake } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Planes y Precios | Venezuela Inmuebles',
  description: 'Elige el plan que mejor se adapte a tus necesidades. Prueba gratuita de 30 días en planes de pago, como iniciativa solidaria para apoyar al sector inmobiliario.',
}

const planes = [
  {
    nombre: 'Gratuita',
    precioMensual: '$0',
    precioAnual: '$0',
    descripcion: 'Para usuarios que buscan vender o alquilar un único inmueble',
    icon: User,
    color: 'gray',
    features: [
      '1 anuncio activo',
      '8 fotos por inmueble',
      'Verificación de identidad gratuita',
    ],
    cta: 'Registrarse Gratis',
    destacado: false,
  },
  {
    nombre: 'Profesional',
    precioMensual: '$9,99/mes',
    precioAnual: '$99/año',
    descripcion: 'Para agentes independientes y vendedores activos',
    icon: Star,
    color: 'brand-accent',
    features: [
      '5 anuncios activos',
      '20 fotos por inmueble',
      '5 créditos incluidos al mes',
      'Escaparate con URL personalizada',
      'Métricas de rendimiento',
      'Enlace a vídeo y recorridos/planos',
      'Soporte prioritario',
      'Verificación de identidad gratuita',
    ],
    cta: 'Probar Gratis por 30 Días',
    destacado: true,
    badge: 'MÁS POPULAR',
  },
  {
    nombre: 'Agencia',
    precioMensual: '$39,99/mes',
    precioAnual: '$399/año',
    descripcion: 'Para equipos y agencias inmobiliarias',
    icon: Building2,
    color: 'brand-primary',
    features: [
      'Anuncios activos sin límite',
      '30 fotos por inmueble',
      '20 créditos al mes (compartidos)',
      'Escaparate de marca y métricas agregadas',
      'Publicación y edición masiva',
      'Enlace a vídeo y recorridos/planos',
      'Soporte con devolución de llamada',
      '5 usuarios incluidos',
      'Mensajería privada por agente',
      'Verificación de identidad gratuita',
    ],
    cta: 'Probar Gratis por 30 Días',
    destacado: false,
  },
]

export default function PlanesPage() {
  return (
    <div className="min-h-screen bg-brand-gray py-16">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-4">
            <span className="inline-flex items-center gap-2 bg-brand-primary/10 text-brand-primary px-4 py-2 rounded-full text-sm font-medium">
              <HeartHandshake className="w-4 h-4" />
              Iniciativa Solidaria: 1 Mes de Prueba Gratis
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-brand-dark mb-4">
            Planes y Precios
          </h1>
          <p className="text-xl text-brand-dark/70 max-w-2xl mx-auto">
            Elige el plan ideal para ti. Disfruta de 30 días de prueba en nuestros planes de pago sin compromiso, sin tarjeta de crédito y sin cobros automáticos.
          </p>
        </div>

        {/* Planes Grid */}
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {planes.map((plan) => {
            const Icon = plan.icon
            return (
              <div
                key={plan.nombre}
                className={`relative bg-white rounded-2xl shadow-lg p-8 flex flex-col ${
                  plan.destacado ? 'ring-2 ring-brand-accent scale-105' : ''
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-brand-accent text-[var(--on-gold)] px-4 py-1 rounded-full text-sm font-bold shadow-sm">
                    {plan.badge}
                  </div>
                )}

                <div className="mb-6">
                  <Icon className={`w-12 h-12 mb-4 ${
                    plan.color === 'brand-accent' ? 'text-[var(--gold-text)]' : 
                    plan.color === 'brand-primary' ? 'text-brand-primary' : 
                    'text-gray-600'
                  }`} />
                  <h2 className="text-2xl font-bold text-brand-dark mb-2">
                    {plan.nombre}
                  </h2>
                  <p className="text-brand-dark/70 text-sm mb-4 min-h-[40px]">
                    {plan.descripcion}
                  </p>
                  <div className="mb-2">
                    <span className="text-4xl font-bold text-brand-dark">
                      {plan.precioMensual}
                    </span>
                    {plan.nombre !== 'Gratuita' && (
                      <span className="text-sm font-normal text-gray-500 ml-1">
                        o {plan.precioAnual}
                      </span>
                    )}
                  </div>
                </div>

                <ul className="space-y-3 mb-8 flex-grow">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-[var(--gold-text)] flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href="/registrarse"
                  className={`block w-full text-center py-3 rounded-lg font-medium transition-colors ${
                    plan.destacado
                      ? 'bg-brand-accent hover:brightness-105 text-[var(--on-gold)]'
                      : plan.nombre === 'Agencia'
                      ? 'bg-brand-primary hover:bg-brand-dark text-white'
                      : 'bg-gray-100 hover:bg-gray-200 text-brand-dark'
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            )
          })}
        </div>

        {/* FAQ */}
        <div className="mt-20 max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-brand-dark mb-8">
            Condiciones de la Prueba Gratis y Preguntas Frecuentes
          </h2>
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm">
              <h3 className="font-bold text-lg mb-2 text-brand-dark">¿Cómo funciona la prueba gratuita de 30 días?</h3>
              <p className="text-gray-600">
                Como iniciativa solidaria para apoyar al sector inmobiliario en estos momentos, ofrecemos 1 mes gratis del plan Profesional o Agencia. Empieza tu prueba sin necesidad de ingresar tarjeta de crédito. Al finalizar los 30 días, te avisaremos para que decidas si deseas suscribirte o volver al plan Gratuito.
              </p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm">
              <h3 className="font-bold text-lg mb-2 text-brand-dark">¿Qué pasa cuando termina la prueba si no deseo pagar?</h3>
              <p className="text-gray-600">
                <strong>No habrá ningún cobro automático</strong> ni perderás tus anuncios. Tu cuenta simplemente volverá al plan Gratuito. Si tenías más de 1 anuncio activo, los anuncios adicionales serán pausados (pero no eliminados). Podrás elegir cuál mantener activo o reactivarlos en cualquier momento suscribiéndote a un plan de pago.
              </p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm">
              <h3 className="font-bold text-lg mb-2 text-brand-dark">¿Qué son los créditos incluidos?</h3>
              <p className="text-gray-600">
                Los créditos incluidos te permiten destacar tus anuncios para obtener mayor visibilidad. El plan Profesional incluye 5 créditos mensuales y el plan Agencia incluye 20 créditos mensuales que puedes compartir entre los agentes de tu equipo.
              </p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm">
              <h3 className="font-bold text-lg mb-2 text-brand-dark">¿Qué significa la verificación de identidad gratuita?</h3>
              <p className="text-gray-600">
                Verificamos tu identidad gratuitamente en todos los planes para generar más confianza en la comunidad. Esto indicará que eres una persona real, aunque ten en cuenta que la insignia de identidad verificada no afirma la titularidad ni certifica el estado legal de los inmuebles publicados.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
