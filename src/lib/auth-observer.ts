import type { Session } from '@supabase/supabase-js'

type AuthSource = {
  getSession(): Promise<{ data: { session: Session | null }; error: unknown }>
  onAuthStateChange(callback: (event: string, session: Session | null) => void): {
    data: { subscription: { unsubscribe(): void } }
  }
}

/** One subscription per mount; a slow initial read must not overwrite a newer event. */
export function observeAuth(auth: AuthSource, update: (session: Session | null) => void) {
  let disposed = false
  let revision = 0
  const { data } = auth.onAuthStateChange((_event, session) => {
    revision++
    if (!disposed) update(session)
  })
  const initialRevision = revision
  void auth.getSession().then(({ data, error }) => {
    if (!disposed && revision === initialRevision) update(error ? null : data.session)
  }).catch(() => {
    if (!disposed && revision === initialRevision) update(null)
  })
  return () => {
    disposed = true
    data.subscription.unsubscribe()
  }
}
