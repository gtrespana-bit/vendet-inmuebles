import { getSupabaseAuthHeaders } from '@/lib/supabase-auth-headers'

async function getJson(path: string): Promise<any> {
  const res = await fetch(path, {
    headers: { ...(await getSupabaseAuthHeaders()) },
    cache: 'no-store',
  })
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) throw new Error('No autorizado')
    throw new Error(`Error ${res.status}`)
  }
  const json = await res.json()
  return json.data
}

export const analyticsApi = {
  resumen: (dias: number) => getJson(`/api/admin/analytics/resumen?dias=${dias}`),
  trafico: (dias: number) => getJson(`/api/admin/analytics/trafico?dias=${dias}&limite=10`),
  usuarios: (dias: number) => getJson(`/api/admin/analytics/usuarios?dias=${dias}`),
  contenido: (dias: number) => getJson(`/api/admin/analytics/contenido?dias=${dias}&limite=10`),
  actividad: () => getJson(`/api/admin/analytics/actividad?limite=60`),
}
