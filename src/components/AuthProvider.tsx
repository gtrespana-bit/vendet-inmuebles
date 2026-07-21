'use client'

import { createContext, useContext, useState, useEffect, useRef } from 'react'
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
  const initialized = useRef(false)
  const initPromiseRef = useRef<Promise<void> | null>(null)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    let unsub: (() => void) | null = null
    let cancelled = false

    const initAuth = async () => {
      try {
        const { isSupabaseConfigured } = await import('@/lib/supabase')
        if (!isSupabaseConfigured()) {
          if (!cancelled) {
            setSession(null)
            setUser(null)
            setLoading(false)
          }
          return
        }

        const { supabase } = await import('@/lib/supabase')

        // Then check current session FIRST (before listening for changes)
        try {
          const { data: sessionData, error } = await supabase.auth.getSession()
          if (cancelled) return
          if (!error && sessionData.session) {
            setSession(sessionData.session)
            setUser(sessionData.session.user)
          }
        } catch {
          // Ignore errors
        }

        // Listen for auth changes AFTER getting initial session
        const { data } = supabase.auth.onAuthStateChange((_event, s) => {
          if (cancelled) return
          setSession(s)
          setUser(s?.user ?? null)
          setLoading(false)
        })
        unsub = data.subscription.unsubscribe

        // Also check if server passed a user (hydration consistency)
        if (initialUser && !session) {
          setUser(initialUser)
        }

        if (!cancelled) {
          setLoading(false)
        }
      } catch {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    initAuth()

    return () => {
      cancelled = true
      unsub?.()
    }
  }, [initialUser])

  return (
    <AuthContext.Provider value={{ session, user, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
