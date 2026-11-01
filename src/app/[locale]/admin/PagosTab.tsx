'use client'
import { useCallback, useEffect, useState } from 'react'
import { getSupabaseAuthHeaders } from '@/lib/supabase-auth-headers'
export default function PagosTab() {
  const [orders,setOrders] = useState<any[]>([])
  const [error,setError] = useState('')
  const [busy,setBusy] = useState(false)
  const [notes,setNotes] = useState<Record<string,string>>({})
  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/pagos', { headers: await getSupabaseAuthHeaders(), cache:'no-store' })
      const data = await res.json(); if (!res.ok) throw new Error(data.error)
      setOrders(data.orders)
    } catch(e) { setError(e instanceof Error ? e.message : 'Error') }
  },[])
  useEffect(() => { void load() },[load])
  async function review(id:string,confirmar:boolean) {
    if (!confirm(confirmar ? '¿Has comprobado el ingreso real en tu cuenta?' : '¿Rechazar el pago y revocar los beneficios concedidos? Los servicios ya consumidos requieren intervención.')) return
    setBusy(true); setError('')
    try {
      const res=await fetch('/api/admin/pagos',{method:'POST',headers:{...await getSupabaseAuthHeaders(),'Content-Type':'application/json'},body:JSON.stringify({id,confirmar,nota:notes[id]||''})})
      const data=await res.json(); if(!res.ok) throw new Error(data.error)
      await load()
    } catch(e) { setError(e instanceof Error ? e.message : 'Error') } finally { setBusy(false) }
  }
  return <section className="space-y-4"><h2 className="text-xl font-bold">Revisión de pagos · planes y créditos</h2>
    <p>La lectura automática no confirma el ingreso. Comprueba cada pago en la cuenta receptora antes de confirmarlo definitivamente.</p>
    <button disabled={busy} onClick={load} className="underline">Actualizar y renovar enlaces de comprobantes</button>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {orders.length===0 && <p>No hay órdenes de pago.</p>}
    {orders.map(o=><article key={o.id} className="bg-white rounded-xl border p-5 space-y-3">
      <h3 className="font-bold">{o.concepto} {o.creditos||''} · {o.monto} {o.moneda} · {o.estado}</h3>
      <p className="text-sm break-all">Orden: {o.id} · Usuario: {o.user_id}</p>
      <p>{(o.motivos||[]).join(' · ')}</p>
      {o.creditos_no_recuperados>0 && <p role="alert" className="text-red-700 font-bold">Atención: {o.creditos_no_recuperados} créditos ya consumidos no se pudieron recuperar. Revisa los servicios utilizados y la cuenta.</p>}
      {o.nota_revision && <p>Revisión: {o.nota_revision}</p>}
      {(o.intentos_pago||[]).sort((a:any,b:any)=>b.creada_en.localeCompare(a.creada_en)).map((a:any)=><details key={a.id} className="border rounded p-3">
        <summary>Intento {new Date(a.creada_en).toLocaleString('es')} · confianza OCR {a.confianza}%</summary>
        <p>Referencia: {a.referencia||'No legible'}</p><p>{(a.motivos||[]).join(' · ')}</p>
        {a.url && <a className="underline" href={a.url} target="_blank" rel="noopener noreferrer">Ver comprobante privado (enlace de 5 minutos)</a>}
        <pre className="whitespace-pre-wrap text-xs max-h-64 overflow-auto">{a.texto}</pre>
      </details>)}
      {!['confirmada','rechazada','creada'].includes(o.estado) && <div className="space-y-2">
        <label className="block">Nota de revisión (obligatoria al rechazar)<textarea maxLength={1000} value={notes[o.id]||''} onChange={e=>setNotes({...notes,[o.id]:e.target.value})} className="border rounded block w-full p-2" /></label>
        <div className="flex gap-3"><button disabled={busy||o.estado==='bloqueada'} onClick={()=>review(o.id,true)} className="bg-green-800 text-white p-3 rounded disabled:opacity-50">Confirmar ingreso</button>
        <button disabled={busy} onClick={()=>review(o.id,false)} className="bg-red-800 text-white p-3 rounded disabled:opacity-50">Rechazar y revocar</button></div>
      </div>}
    </article>)}
  </section>
}
