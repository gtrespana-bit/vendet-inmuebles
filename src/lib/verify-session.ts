import type { User } from '@supabase/supabase-js'

/** Authentication fails closed on timeout, network error and missing configuration. */
export async function verifySession(
  token: string | undefined,
  verify: (token: string, signal: AbortSignal) => Promise<{ data: { user: User | null }; error: unknown }>,
  timeoutMs = 4000,
): Promise<User | null> {
  if (!token) return null
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      Promise.resolve().then(() => verify(token, controller.signal)).then(({ data, error }) => error ? null : data.user),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => { controller.abort(); resolve(null) }, timeoutMs)
      }),
    ])
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}
