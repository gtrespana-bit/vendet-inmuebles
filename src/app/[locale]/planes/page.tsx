import { Metadata } from 'next'
import Link from 'next/link'
import { Check, Star, Building2, Crown } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Planes y Precios | VendeT Inmuebles',
  description: 'Elige el plan que mejor se adapte a tus necesidades. Publica propiedades gratis y destaca tus anuncios.',
}

const planes = [
  {
    nombre: 'Personal',
    precio: 'Gratis',
    periodo: 'durante lanzamiento',
    descripcion: 'Para propietarios que venden o alquilan',
    icon: Building2,
    color: 'gray',
    features: [
      'Hasta 3 publicaciones activas',
      'Fotos ilimitadas por propiedad',
      'Contacto directo con compradores',
      'Estadísticas básicas',
    ],
    cta: 'Registrarse Gratis',
    destacado: false,
  },
  {
    nombre: 'Agente',
    precio: 'Gratis',
    periodo: 'beta de lanzamiento',
    descripcion: 'Para agentes inmobiliarios independientes',
    icon: Star,
    color: 'blue',
    features: [
      'Publicaciones ilimitadas',
      'Perfil verificado con badge',
      'Destacar 2 propiedades al mes',
      'Estadísticas avanzadas',
      'Soporte prioritario',
    ],
    cta: 'Registrarse como Agente',
    destacado: true,
    badge: 'RECOMENDADO',
  },
  {
    nombre: 'Inmobiliaria',
    precio: 'Gratis',
    periodo: 'beta de lanzamiento',
    descripcion: 'Para empresas inmobiliarias',
    icon: Crown,
    color: 'purple',
    features: [
      'Todo lo del plan Agente',
      'Múltiples agentes en una cuenta',
      'Landing page personalizada',
      'API para integración',
      'Gestor de cuenta dedicado',
    ],
    cta: 'Contactar Ventas',
    destacado: false,
  },
]

export default function PlanesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white py-16">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Planes para Todos
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Publica tus propiedades gratis durante nuestro lanzamiento. 
            Sin costos ocultos, sin sorpresas.
          </p>
          <div className="mt-4 inline-block bg-green-100 text-green-800 px-4 py-2 rounded-full text-sm font-medium">
            🎉 Todo gratis durante el lanzamiento
          </div>
        </div>

        {/* Planes Grid */}
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {planes.map((plan) => {
            const Icon = plan.icon
            return (
              <div
                key={plan.nombre}
                className={`relative bg-white rounded-2xl shadow-lg p-8 flex flex-col ${
                  plan.destacado ? 'ring-2 ring-blue-500 scale-105' : ''
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-4 py-1 rounded-full text-sm font-bold">
                    {plan.badge}
                  </div>
                )}

                <div className="mb-6">
                  <Icon className={`w-12 h-12 mb-4 ${
                    plan.color === 'blue' ? 'text-blue-600' : 
                    plan.color === 'purple' ? 'text-purple-600' : 
                    'text-gray-600'
                  }`} />
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    {plan.nombre}
                  </h2>
                  <p className="text-gray-600 text-sm mb-4">
                    {plan.descripcion}
                  </p>
                  <div className="mb-2">
                    <span className="text-4xl font-bold text-gray-900">
                      {plan.precio}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">
                    {plan.periodo}
                  </p>
                </div>

                <ul className="space-y-3 mb-8 flex-grow">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={plan.nombre === 'Inmobiliaria' ? '/contacto' : '/registrarse'}
                  className={`block w-full text-center py-3 rounded-lg font-medium transition-colors ${
                    plan.destacado
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            )
          })}
        </div>

        {/* Sección de servicios adicionales */}
        <div className="mt-20 max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-8">
            Servicios Adicionales (Próximamente)
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow p-6">
              <h3 className="font-bold text-lg mb-2">⭐ Destacar Propiedad</h3>
              <p className="text-gray-600 text-sm mb-3">
                Aparece primero en búsquedas y resultados por 7 días
              </p>
              <p className="text-2xl font-bold text-blue-600">$5-15 USD</p>
              <p className="text-xs text-gray-500 mt-1">Disponible pronto</p>
            </div>
            <div className="bg-white rounded-xl shadow p-6">
              <h3 className="font-bold text-lg mb-2">✅ Verificación Premium</h3>
              <p className="text-gray-600 text-sm mb-3">
                Badge de verificación anual con documentos oficiales
              </p>
              <p className="text-2xl font-bold text-blue-600">$10 USD/año</p>
              <p className="text-xs text-gray-500 mt-1">Disponible pronto</p>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-20 max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-8">
            Preguntas Frecuentes
          </h2>
          <div className="space-y-6">
            <div>
              <h3 className="font-bold text-lg mb-2">¿Cuánto tiempo será gratis?</h3>
              <p className="text-gray-600">
                Durante las primeras semanas o meses de lanzamiento. Te avisaremos con al menos 30 días de anticipación antes de cualquier cambio.
              </p>
            </div>
            <div>
              <h3 className="font-bold text-lg mb-2">¿Qué pasa con mis publicaciones cuando empiecen los pagos?</h3>
              <p className="text-gray-600">
                Tus publicaciones existentes seguirán activas. Solo aplicarían los nuevos planes a publicaciones futuras o renovaciones.
              </p>
            </div>
            <div>
              <h3 className="font-bold text-lg mb-2">¿Puedo cambiar de plan después?</h3>
              <p className="text-gray-600">
                Sí, puedes cambiar entre planes en cualquier momento desde tu dashboard.
              </p>
            </div>
          </div>
        </div>

        {/* CTA Final */}
        <div className="mt-16 text-center">
          <Link
            href="/registrarse"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-lg font-medium text-lg transition-colors"
          >
            Comenzar Gratis Ahora
          </Link>
          <p className="mt-4 text-sm text-gray-500">
            Sin tarjeta de crédito • Sin compromisos • Cancela cuando quieras
          </p>
        </div>
      </div>
    </div>
  )
}