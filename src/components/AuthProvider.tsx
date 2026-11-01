'use client'

import { createContext, useContext, useState, useEffect } from 'react'
import { observeAuth } from '@/lib/auth-observer'
import type { Session, User } from '@supabase/supabase-js'

type AuthContextType = {
  session: Session | null
  user: User | null
  loading: boolean
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
})

export function AuthProvider({ children, initialUser }: { children: React.ReactNode; initialUser?: User | null }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(initialUser ?? null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let cancelled = false
    let unsubscribe: (() => void) | undefined
    const update = (current: Session | null) => {
      if (cancelled) return
      setSession(current)
      setUser(current?.user ?? null)
      setLoading(false)
    }
    void import('@/lib/supabase').then(({ supabase, isSupabaseConfigured }) => {
      // A Strict Mode cleanup may happen while the module is loading.
      if (cancelled) return
      if (!isSupabaseConfigured()) return update(null)
      unsubscribe = observeAuth(supabase.auth, update)
    }).catch(() => update(null))
    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [])

  return (
    <AuthContext.Provider value={{ session, user, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
