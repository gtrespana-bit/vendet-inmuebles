'use client'

import { useCallback, useEffect, useState } from 'react'
import { getSupabaseAuthHeaders } from '@/lib/supabase-auth-headers'

const PAGE_SIZE = 25

const FILTROS = [
  { id: 'pendientes', label: 'Pendientes de revisión' },
  { id: 'provisional', label: 'Provisionales' },
  { id: 'revision', label: 'En revisión' },
  { id: 'bloqueada', label: 'Bloqueadas' },
  { id: 'confirmada', label: 'Confirmadas' },
  { id: 'rechazada', label: 'Rechazadas' },
  { id: 'todas', label: 'Todas' },
] as const

export default function PagosTab() {
  const [orders, setOrders] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [estado, setEstado] = useState<string>('pendientes')
  const [searchInput, setSearchInput] = useState('')
  const [q, setQ] = useState('')
  const [offset, setOffset] = useState(0)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [signingId, setSigningId] = useState('')
  const [notes, setNotes] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setBusy(true)
    setError('')
    try {
      const qs = new URLSearchParams({
        estado,
        limit: String(PAGE_SIZE),
        offset: String(offset),
      })
      if (q) qs.set('q', q)
      const res = await fetch(`/api/admin/pagos?${qs.toString()}`, {
        headers: await getSupabaseAuthHeaders(),
        cache: 'no-store',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error consultando pagos')
      setOrders(data.orders || [])
      setTotal(Number(data.total || 0))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setBusy(false)
    }
  }, [estado, offset, q])

  useEffect(() => {
    void load()
  }, [load])

  async function openSignedReceipt(attemptId: string) {
    setSigningId(attemptId)
    setError('')
    try {
      const res = await fetch(`/api/admin/pagos?firmar=${encodeURIComponent(attemptId)}`, {
        headers: await getSupabaseAuthHeaders(),
        cache: 'no-store',
      })
      const data = await res.json()
      if (!res.ok || !data.url) throw new Error(data.error || 'No se pudo abrir el comprobante')
      window.open(data.url, '_blank', 'noopener,noreferrer')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error abriendo comprobante')
    } finally {
      setSigningId('')
    }
  }

  async function review(id: string, confirmar: boolean) {
    if (!confirm(confirmar
      ? '¿Has comprobado el ingreso real en tu cuenta?'
      : '¿Rechazar el pago y revocar los beneficios concedidos? Los servicios ya consumidos requieren intervención.'
    )) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/admin/pagos', {
        method: 'POST',
        headers: { ...(await getSupabaseAuthHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, confirmar, nota: notes[id] || '' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setBusy(false)
    }
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    setOffset(0)
    setQ(searchInput.trim())
  }

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-bold">Revisión de pagos · planes y créditos</h2>
      <p className="text-sm text-gray-600">
        La lectura automática no confirma el ingreso. Comprueba cada pago en la cuenta receptora antes de confirmarlo definitivamente. Las pendientes se muestran por antigüedad (las más antiguas primero).
      </p>

      <div className="flex flex-wrap gap-2">
        {FILTROS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => { setEstado(f.id); setOffset(0) }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
              estado === f.id ? 'bg-brand-primary text-white border-brand-primary' : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSearchSubmit} className="flex flex-wrap gap-2 items-center">
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Buscar por ID de orden, usuario o referencia…"
          className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-[240px]"
        />
        <button type="submit" disabled={busy} className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm">
          Buscar
        </button>
        {q && (
          <button
            type="button"
            onClick={() => { setSearchInput(''); setQ(''); setOffset(0) }}
            className="text-sm underline text-gray-600"
          >
            Limpiar filtro
          </button>
        )}
        <button type="button" disabled={busy} onClick={load} className="text-sm underline ml-auto">
          Actualizar ({total})
        </button>
      </form>

      {error && <p role="alert" className="text-red-700">{error}</p>}
      {orders.length === 0 && !busy && <p className="text-gray-500">No hay órdenes en esta vista.</p>}

      {orders.map((o) => (
        <article key={o.id} className="bg-white rounded-xl border p-5 space-y-3">
          <div className="flex flex-wrap justify-between gap-2">
            <h3 className="font-bold">
              {o.concepto} {o.creditos || ''} · {o.monto} {o.moneda} · <span className="uppercase">{o.estado}</span>
            </h3>
            <span className="text-xs text-gray-500">
              {o.creada_en ? new Date(o.creada_en).toLocaleString('es-VE') : ''}
            </span>
          </div>
          <p className="text-sm break-all">Orden: {o.id} · Usuario: {o.user_id}</p>
          {(o.motivos || []).length > 0 && <p className="text-sm text-amber-800">{(o.motivos || []).join(' · ')}</p>}
          {o.creditos_no_recuperados > 0 && (
            <p role="alert" className="text-red-700 font-bold">
              Atención: {o.creditos_no_recuperados} créditos ya consumidos no se pudieron recuperar. Revisa los servicios utilizados y la cuenta.
            </p>
          )}
          {o.nota_revision && <p className="text-sm">Revisión: {o.nota_revision}</p>}
          {(o.intentos_pago || [])
            .slice()
            .sort((a: any, b: any) => String(b.creada_en || '').localeCompare(String(a.creada_en || '')))
            .map((a: any) => (
              <details key={a.id} className="border rounded p-3">
                <summary className="cursor-pointer font-medium text-sm">
                  Intento {new Date(a.creada_en).toLocaleString('es-VE')} · confianza OCR {a.confianza}% · ref: {a.referencia || 'No legible'}
                </summary>
                <div className="mt-2 space-y-2 text-sm">
                  <p>{(a.motivos || []).join(' · ')}</p>
                  <button
                    type="button"
                    disabled={signingId === a.id}
                    onClick={() => openSignedReceipt(a.id)}
                    className="underline text-brand-primary font-medium"
                  >
                    {signingId === a.id ? 'Generando enlace…' : 'Abrir comprobante privado (enlace temporal de 5 min)'}
                  </button>
                  <pre className="whitespace-pre-wrap text-xs max-h-64 overflow-auto bg-gray-50 p-2 rounded">{a.texto}</pre>
                </div>
              </details>
            ))}
          {!['confirmada', 'rechazada', 'creada'].includes(o.estado) && (
            <div className="space-y-2">
              <label className="block text-sm">
                Nota de revisión (obligatoria al rechazar)
                <textarea
                  maxLength={1000}
                  value={notes[o.id] || ''}
                  onChange={(e) => setNotes({ ...notes, [o.id]: e.target.value })}
                  className="border rounded block w-full p-2 mt-1"
                />
              </label>
              <div className="flex gap-3">
                <button
                  disabled={busy || o.estado === 'bloqueada'}
                  onClick={() => review(o.id, true)}
                  className="bg-green-800 text-white p-3 rounded disabled:opacity-50"
                >
                  Confirmar ingreso
                </button>
                <button
                  disabled={busy}
                  onClick={() => review(o.id, false)}
                  className="bg-red-800 text-white p-3 rounded disabled:opacity-50"
                >
                  Rechazar y revocar
                </button>
              </div>
            </div>
          )}
        </article>
      ))}

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            disabled={busy || offset === 0}
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            className="px-4 py-2 border rounded-lg text-sm disabled:opacity-50"
          >
            ← Anterior
          </button>
          <span className="text-sm text-gray-600">
            Mostrando {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} de {total}
          </span>
          <button
            type="button"
            disabled={busy || offset + PAGE_SIZE >= total}
            onClick={() => setOffset(offset + PAGE_SIZE)}
            className="px-4 py-2 border rounded-lg text-sm disabled:opacity-50"
          >
            Siguiente →
          </button>
        </div>
      )}
    </section>
  )
}
