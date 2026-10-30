"use client"

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import LocalLink from '@/components/LocalLink'
import { Package, X, Pause, Play, Edit, Zap, Star, CheckCircle2, ChevronDown, ArrowLeft, Send } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { getSupabaseAuthHeaders } from '@/lib/supabase-auth-headers'
import Image from 'next/image'

export default function TabProductos({
  productos,
  onBoost,
  onDestacar,
  userId,
}: {
  productos: any[]
  onBoost: (m: { productId: string; titulo: string }) => void
  onDestacar: (m: { productId: string; titulo: string }) => void
  userId: string
}) {
  const t = useTranslations('dashboard')
  const locale = useLocale()
  const [vendidoModal, setVendidoModal] = useState<string | null>(null)
  const [vendidoPaso, setVendidoPaso] = useState<'tipo' | 'comprador' | 'reseña' | 'confirmado'>('tipo')
  const [interesados, setInteresados] = useState<any[]>([])
  const [compradorInfo, setCompradorInfo] = useState<{ id: string; nombre: string } | null>(null)
  const [cargandoVendidos, setCargandoVendidos] = useState(false)
  const [enviandoResena, setEnviandoResena] = useState(false)
  const [rating, setRating] = useState(5)
  const [comentarioResena, setComentarioResena] = useState('')

  // Gestión de menús desplegables
  const [menuGestion, setMenuGestion] = useState<string | null>(null)
  const [menuPromocionar, setMenuPromocionar] = useState<string | null>(null)

  const cerrarMenus = () => { setMenuGestion(null); setMenuPromocionar(null) }

  // Abrir modal de vendido
  const abrirVendido = async (productoId: string) => {
    cerrarMenus()
    setVendidoModal(productoId)
    setVendidoPaso('tipo')
    setCompradorInfo(null)
    setInteresados([])
    setRating(5)
    setComentarioResena('')

    if (!userId) return
    setCargandoVendidos(true)
    try {
      const res = await fetch(`/api/admin/marcar-vendido?productoId=${productoId}&userId=${userId}`, {
        headers: await getSupabaseAuthHeaders(),
      })
      const data = await res.json()
      if (data.ok && data.interesados) setInteresados(data.interesados)
    } catch {
      // fail silently
    }
    setCargandoVendidos(false)
  }

  // Reactivar vendido
  const reactivarVendido = async (productoId: string) => {
    cerrarMenus()
    if (!confirm(t('reactivationConfirm'))) return
    const { error } = await supabase.from('inmuebles').update({ activo: true }).eq('id', productoId)
    if (error) { window.alert(t('propertyUpdateError')); return }
    window.location.reload()
  }

  // Marcar como vendido (simple — sin comprador, sin reseña)
  const marcarVendidoSimple = async (productoId: string, vendidoEn: string) => {
    const res = await fetch('/api/admin/marcar-vendido', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await getSupabaseAuthHeaders()) },
      body: JSON.stringify({ productoId, userId, vendidoEn }),
    })
    if (!res.ok) {
      const d = await res.json()
      alert(`${t('saleUpdateError')} ${d.error || ''}`)
      return
    }
    setVendidoPaso('confirmado')
  }

  // Seleccionar comprador → ir a "¿quieres dejar reseña?"
  const seleccionarComprador = (comprador: { userId: string; nombre: string }) => {
    setCompradorInfo({ id: comprador.userId, nombre: comprador.nombre })
    setVendidoPaso('reseña')
  }

  // Marcar vendido con comprador pero SIN reseña
  const venderSinResena = async () => {
    if (!vendidoModal || !compradorInfo) return
    cerrarMenus()

    const res = await fetch('/api/admin/marcar-vendido', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await getSupabaseAuthHeaders()) },
      body: JSON.stringify({
        productoId: vendidoModal,
        userId,
        vendidoEn: 'plataforma',
        compradorId: compradorInfo.id,
      }),
    })

    if (!res.ok) {
      const d = await res.json()
      alert(`${t('saleUpdateError')} ${d.error || ''}`)
      return
    }

    // Enviar mensaje de chat al comprador notificando e invitando a reseñar
    await enviarMensajeComprador(compradorInfo.id)

    setVendidoPaso('confirmado')
  }

  // Enviar reseña al comprador (primero marca vendido, luego notifica)
  const enviarResena = async () => {
    if (!vendidoModal || !compradorInfo) return
    setEnviandoResena(true)
    cerrarMenus()

    // Primero marcar como vendido con comprador
    const res1 = await fetch('/api/admin/marcar-vendido', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await getSupabaseAuthHeaders()) },
      body: JSON.stringify({
        productoId: vendidoModal,
        userId,
        vendidoEn: 'plataforma',
        compradorId: compradorInfo.id,
      }),
    })

    if (!res1.ok) {
      const d = await res1.json()
      setEnviandoResena(false)
      alert(`${t('reviewSaleUpdateError')} ${d.error || ''}`)
      return
    }

    // Ahora enviar la reseña
    const res2 = await fetch('/api/admin/enviar-resena', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await getSupabaseAuthHeaders()) },
      body: JSON.stringify({
        producto_id: vendidoModal,
        evaluador_id: userId,
        evaluado_id: compradorInfo.id,
        puntuacion: rating,
        comentario: comentarioResena.trim() || null,
      }),
    })

    setEnviandoResena(false)

    const data2 = await res2.json()
    if (!res2.ok) {
      console.warn('Reseña falló:', data2.error)
    }

    // Enviar mensaje de chat al comprador
    await enviarMensajeComprador(compradorInfo.id)

    setVendidoPaso('confirmado')
  }

  // Enviar mensaje directo al comprador del chat de este producto
  const enviarMensajeComprador = async (compradorId: string) => {
    if (!vendidoModal) return
    try {
      // Buscar o crear conversacion
      const u1 = userId < compradorId ? userId : compradorId
      const u2 = userId < compradorId ? compradorId : userId
      const { data: convExist } = await supabase
        .from('conversaciones')
        .select('id')
        .eq('user1_id', u1)
        .eq('user2_id', u2)
        .eq('producto_id', vendidoModal)
        .maybeSingle()

      let convId = convExist?.id
      if (!convId) {
        const { data: convNew } = await supabase
          .from('conversaciones')
          .insert({ user1_id: u1, user2_id: u2, producto_id: vendidoModal })
          .select('id')
          .single()
        convId = convNew?.id
      }

      if (convId) {
        await supabase.from('mensajes').insert({
          conversacion_id: convId,
          remitente_id: userId,
          destinatario_id: compradorId,
          producto_id: vendidoModal,
          contenido: '✅ ¡Tu compra fue exitosa! El vendedor ha confirmado la venta. ¿Cómo fue tu experiencia? Déjale una reseña para ayudar a la comunidad. ⭐',
        })
      }
    } catch {
      // fail silently
    }
  }

  const pausarActivar = async (id: string, activoActual: boolean) => {
    cerrarMenus()
    await supabase.from('inmuebles').update({ activo: !activoActual }).eq('id', id)
    window.location.reload()
  }

  const eliminarProducto = async (id: string) => {
    cerrarMenus()
    if (!confirm(t('deletePropertyConfirm'))) return
    const res = await fetch('/api/admin/eliminar-producto', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await getSupabaseAuthHeaders()) },
      body: JSON.stringify({ productId: id }),
    })
    const result = await res.json()
    if (!res.ok) {
      alert(`${t('propertyDeleteError')} ${result.error || ''}`)
      return
    }
    // Recargar la página
    window.location.reload()
  }

  if (productos.length === 0) {
    return (
      <section className="dashboard-empty-state" aria-labelledby="dashboard-properties-empty-title">
        <Package size={36} className="mx-auto mb-4 text-[#9b8053]" aria-hidden="true" />
        <p className="dashboard-page__eyebrow">{t('tabListings')}</p>
        <h2 id="dashboard-properties-empty-title">{t('emptyPropertiesTitle')}</h2>
        <p>{t('emptyPropertiesDescription')}</p>
        <LocalLink href="/publicar-inmueble">{t('publishPropertyAction')}</LocalLink>
      </section>
    )
  }

  const now = new Date().toISOString()
  const dateLocale = locale === 'en' ? 'en-US' : 'es-VE'
  const numberFormat = (value: number) => new Intl.NumberFormat(dateLocale).format(value)

  return (
    <section className="dashboard-panel" aria-labelledby="dashboard-properties-title">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <p className="dashboard-page__eyebrow">{t('tabListings')}</p>
          <h2 id="dashboard-properties-title" className="m-0 font-heading text-2xl font-normal text-[#302925]">{t('propertiesTitle')}</h2>
        </div>
        <LocalLink href="/publicar-inmueble" className="text-xs font-bold text-[var(--burgundy)] no-underline">
          + {t('publishPropertyAction')}
        </LocalLink>
      </div>
      <div className="dashboard-property-list">
        {productos.map((p) => {
          const isBoosted = p.boosteado_en != null
          const isFeatured = p.destacado && p.destacado_hasta && p.destacado_hasta > now
          const isVendido = p.vendido === true
          const gestionAbierto = menuGestion === p.id
          const promoAbierto = menuPromocionar === p.id
          const amount = Number(p.precio ?? p.price ?? 0)
          const currency = typeof p.moneda === 'string' && /^[A-Z]{3}$/i.test(p.moneda) ? p.moneda.toUpperCase() : 'USD'
          const formattedPrice = amount > 0
            ? new Intl.NumberFormat(dateLocale, { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
            : t('priceOnRequest')
          const propertyLocation = [p.ciudad, p.estado].filter(Boolean).join(', ')

          return (
            <article key={p.id} className={`dashboard-property-row ${isVendido ? 'border-green-200 bg-green-50/40' : ''}`}>
              <LocalLink href={`/inmueble/${p.slug || p.id}`} className="dashboard-property-row__media" aria-label={p.titulo}>
                {p.main_image_url ? (
                  <Image src={p.main_image_url} alt="" fill sizes="100px" unoptimized />
                ) : (
                  <span className="grid h-full place-items-center text-[9px] text-gray-400">{t('noPhoto')}</span>
                )}
                {isVendido && <span className="absolute inset-0 grid place-items-center bg-[#54745c]/75 text-[9px] font-bold text-white">{t('propertySold')}</span>}
              </LocalLink>
              <LocalLink href={`/inmueble/${p.slug || p.id}`} className="dashboard-property-row__content no-underline">
                <h3 className="dashboard-property-row__title">{p.titulo}</h3>
                <p className="dashboard-property-row__price">{formattedPrice}</p>
                <div className="dashboard-property-row__meta">
                  {propertyLocation && <span>{propertyLocation}</span>}
                  {p.operacion_nombre && <span>{p.operacion_nombre}</span>}
                  <span>{numberFormat(p.visitas || 0)} {t('views')}</span>
                  <span>{isVendido ? t('propertySold') : p.activo ? t('propertyActive') : t('propertyPaused')}</span>
                  {isFeatured && <span>{t('featuredUntil')} {new Date(p.destacado_hasta).toLocaleDateString(dateLocale)}</span>}
                </div>
              </LocalLink>

              {/* Menús desplegables */}
              <div className="flex gap-2 flex-shrink-0 relative" onClick={e => e.stopPropagation()}>
                {/* GESTIONAR */}
                <div className="relative">
                  <button
                    onClick={() => { cerrarMenus(); setMenuGestion(gestionAbierto ? null : p.id) }}
                    className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-200 flex items-center gap-1"
                  >
                    {t('manageProperty')} <ChevronDown size={12} />
                  </button>
                  {gestionAbierto && (
                    <div className="absolute right-0 top-full mt-1 bg-white border rounded-lg shadow-lg py-1 w-48 z-20">
                      <LocalLink
                        href={`/inmueble/editar/${p.id}`}
                        onClick={cerrarMenus}
                        className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50"
                      >
                        <Edit size={14} /> {t('editProperty')}
                      </LocalLink>
                      {!isVendido && p.activo && (
                        <button
                          onClick={() => abrirVendido(p.id)}
                          className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 w-full text-left"
                        >
                          <CheckCircle2 size={14} className="text-green-600" /> {t('markSold')}
                        </button>
                      )}
                      {isVendido && (
                        <button
                          onClick={() => reactivarVendido(p.id)}
                          className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 w-full text-left"
                        >
                          <Play size={14} className="text-orange-500" /> {t('reactivateProperty')}
                        </button>
                      )}
                      <button
                        onClick={() => pausarActivar(p.id, p.activo)}
                        disabled={isVendido}
                        className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 w-full text-left disabled:opacity-40"
                      >
                        {p.activo ? <Pause size={14} /> : <Play size={14} />} {p.activo ? t('pauseProperty') : t('activateProperty')}
                      </button>
                      {!isVendido && (
                        <button
                          onClick={() => eliminarProducto(p.id)}
                          className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 w-full text-left"
                        >
                          <X size={14} className="text-red-500" /> {t('deleteProperty')}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* PROMOCIONAR */}
                {!isVendido && p.activo && (
                  <div className="relative">
                    <button
                      onClick={() => { cerrarMenus(); setMenuPromocionar(promoAbierto ? null : p.id) }}
                      className="px-3 py-1.5 bg-brand-accent/20 text-brand-primary rounded-lg text-xs font-bold hover:bg-brand-accent/30 flex items-center gap-1"
                    >
                      {t('promoteProperty')} <ChevronDown size={12} />
                    </button>
                    {promoAbierto && (
                      <div className="absolute right-0 top-full mt-1 bg-white border rounded-lg shadow-lg py-1 w-52 z-20">
                        <button
                          onClick={() => {
                            onBoost({ productId: p.id, titulo: p.titulo })
                            cerrarMenus()
                          }}
                          className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 w-full text-left"
                        >
                          <Zap size={14} className="text-yellow-500" /> {t('boostProperty')}
                        </button>
                        <button
                          onClick={() => {
                            onDestacar({ productId: p.id, titulo: p.titulo })
                            cerrarMenus()
                          }}
                          className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 w-full text-left"
                        >
                          <Star size={14} className="text-brand-primary" /> {t('featureProperty')}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </article>
          )
        })}
      </div>

      {/* MODAL MARCAR COMO VENDIDO */}
      {vendidoModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <section className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 animate-fadeIn" role="dialog" aria-modal="true" aria-label={t('saleDialogTitle')}>
            <div className="flex items-center justify-between mb-4">
              {vendidoPaso !== 'tipo' ? (
                <button onClick={() => setVendidoPaso('tipo')} className="flex items-center gap-1 text-sm text-brand-primary hover:underline">
                  <ArrowLeft size={16} /> {t('back')}
                </button>
              ) : <div />}
              <button onClick={() => setVendidoModal(null)} className="p-1 hover:bg-gray-100 rounded-full">
                <X size={20} />
              </button>
            </div>

            {/* PASO 1: ¿Cómo se vendió? */}
            {vendidoPaso === 'tipo' && (
              <>
                <h3 className="text-lg font-bold mb-2">{t('saleMethodTitle')}</h3>
                <p className="text-sm text-gray-500 mb-6">{t('saleMethodDescription')}</p>
                <div className="space-y-3">
                  <button
                    onClick={() => {
                      if (interesados.length > 0) {
                        setVendidoPaso('comprador')
                      } else {
                        marcarVendidoSimple(vendidoModal, 'plataforma')
                      }
                    }}
                    className="w-full text-left p-4 border-2 border-green-200 bg-green-50 rounded-xl hover:bg-green-100 transition"
                  >
                    <p className="font-bold text-green-800">🤝 {t('soldThroughPlatform')}</p>
                    <p className="text-xs text-green-600 mt-1">
                      {interesados.length > 0 ? t('contactsOnProperty', { count: interesados.length }) : t('noContactsOnProperty')}
                    </p>
                  </button>
                  <button
                    onClick={() => marcarVendidoSimple(vendidoModal, 'otra_pagina')}
                    className="w-full text-left p-4 border-2 border-blue-200 bg-blue-50 rounded-xl hover:bg-blue-100 transition"
                  >
                    <p className="font-bold text-blue-800">🌐 {t('soldElsewhere')}</p>
                    <p className="text-xs text-blue-600 mt-1">{t('soldElsewhereDescription')}</p>
                  </button>
                  <button
                    onClick={() => marcarVendidoSimple(vendidoModal, 'no_especificado')}
                    className="w-full text-left p-4 border-2 border-gray-200 bg-gray-50 rounded-xl hover:bg-gray-100 transition"
                  >
                    <p className="font-bold text-gray-700">🤫 {t('preferNotToSay')}</p>
                    <p className="text-xs text-gray-500 mt-1">{t('markPropertyOnly')}</p>
                  </button>
                </div>
              </>
            )}

            {/* PASO 2: ¿A quién le vendiste? */}
            {vendidoPaso === 'comprador' && (
              <>
                <h3 className="text-lg font-bold mb-2">{t('buyerSelectTitle')}</h3>
                <p className="text-sm text-gray-500 mb-4">{t('buyerSelectDescription')}</p>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {cargandoVendidos ? (
                    <p className="text-center text-gray-400 py-8">{t('loading')}</p>
                  ) : interesados.length === 0 ? (
                    <p className="text-center text-gray-400 py-4">{t('noContactsOnProperty')}</p>
                  ) : (
                    <>
                      {interesados.map((inter) => (
                        <button
                          key={inter.userId}
                          onClick={() => seleccionarComprador(inter)}
                          className="w-full text-left p-3 border rounded-xl hover:bg-green-50 hover:border-green-200 transition"
                        >
                          <p className="font-semibold text-gray-900">{inter.nombre}</p>
                          {inter.ultimoMensaje && (
                            <p className="text-xs text-gray-400 mt-0.5 truncate">"{inter.ultimoMensaje}"</p>
                          )}
                        </button>
                      ))}
                      <button
                        onClick={() => marcarVendidoSimple(vendidoModal, 'plataforma')}
                        className="w-full text-center p-3 text-sm text-gray-500 hover:text-brand-primary hover:underline"
                      >
                        {t('skipBuyer')}
                      </button>
                    </>
                  )}
                </div>
              </>
            )}

            {/* PASO 3: ¿Quieres dejar reseña al comprador? */}
            {vendidoPaso === 'reseña' && (
              <>
                <div className="text-center mb-4">
                  <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <CheckCircle2 size={28} className="text-green-600" />
                  </div>
                  <h3 className="text-lg font-bold">{t('saleRecorded')}</h3>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 mb-4">
                  <p className="text-sm font-semibold text-gray-700 mb-3">
                    {t('reviewBuyerPrompt', { name: compradorInfo?.nombre || t('theBuyer') })}
                  </p>
                  <div className="flex justify-center mb-2">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map(i => (
                        <button key={i} type="button" onClick={() => setRating(i)} className="hover:scale-110 transition" aria-label={t('ratingOf', { count: i })} aria-pressed={i === rating}>
                          <Star size={28} className={i <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'} />
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="text-center text-xs text-gray-400">{[t('ratingVeryPoor'), t('ratingPoor'), t('ratingOkay'), t('ratingGood'), t('ratingExcellent')][rating - 1]}</p>
                </div>
                <textarea
                  value={comentarioResena}
                  onChange={e => setComentarioResena(e.target.value)}
                  rows={2}
                  className="w-full border rounded-lg px-3 py-2 text-sm resize-none"
                  maxLength={300}
                  placeholder={t('reviewCommentPlaceholder')}
                />
                <p className="text-xs text-gray-400 mt-1 text-right">{comentarioResena.length}/300</p>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={venderSinResena}
                    className="flex-1 px-4 py-2.5 border rounded-lg text-sm font-medium hover:bg-gray-50"
                  >
                    {t('skipReview')}
                  </button>
                  <button
                    onClick={enviarResena}
                    disabled={enviandoResena}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-primary text-white rounded-lg text-sm font-bold hover:bg-brand-dark transition disabled:opacity-50"
                  >
                    <Send size={14} /> {enviandoResena ? t('sendingReview') : t('sendReview')}
                  </button>
                </div>
              </>
            )}

            {/* PASO 4: Confirmación */}
            {vendidoPaso === 'confirmado' && (
              <div className="text-center py-6">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 size={32} className="text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-green-800 mb-2">{t('propertyMarkedSold')}</h3>
                <p className="text-gray-500 mb-6">{t('soldConfirmationDescription')}</p>
                <button
                  onClick={() => { setVendidoModal(null); window.location.reload() }}
                  className="bg-brand-primary text-white px-8 py-3 rounded-xl font-bold hover:bg-brand-dark transition"
                >
                  {t('close')}
                </button>
              </div>
            )}
          </section>
        </div>
      )}
    </section>
  )
}
