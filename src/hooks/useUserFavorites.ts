'use client'

import { useCallback, useEffect, useState } from 'react'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'

/**
 * Caché compartida en cliente de IDs de inmuebles guardados en favoritos por el usuario.
 * Evita N+1 consultas a Supabase cuando el catálogo o la portada renderizan decenas de tarjetas.
 */
let cachedUserId: string | null = null
let cachedFavoriteIds = new Set<string>()
let inFlightFetch: Promise<Set<string>> | null = null
const listeners = new Set<() => void>()

function notifyListeners() {
  for (const fn of listeners) {
    try {
      fn()
    } catch {
      // ignore listener errors
    }
  }
}

async function ensureFavoritesLoaded(userId: string): Promise<Set<string>> {
  if (!isSupabaseConfigured()) return cachedFavoriteIds
  if (cachedUserId === userId && !inFlightFetch) {
    return cachedFavoriteIds
  }
  if (cachedUserId !== userId) {
    cachedUserId = userId
    cachedFavoriteIds = new Set<string>()
  }
  if (!inFlightFetch) {
    const targetUser = userId
    inFlightFetch = Promise.resolve(
      supabase
        .from('favoritos')
        .select('producto_id')
        .eq('user_id', targetUser)
    )
      .then(({ data }) => {
        if (cachedUserId === targetUser && Array.isArray(data)) {
          cachedFavoriteIds = new Set(
            data
              .map((row: { producto_id?: unknown }) => (typeof row.producto_id === 'string' ? row.producto_id : ''))
              .filter(Boolean)
          )
          notifyListeners()
        }
        return cachedFavoriteIds
      })
      .catch(() => cachedFavoriteIds)
      .finally(() => {
        inFlightFetch = null
      })
  }
  return inFlightFetch
}

export function setCachedFavoriteState(propertyId: string, saved: boolean) {
  const next = new Set(cachedFavoriteIds)
  if (saved) next.add(propertyId)
  else next.delete(propertyId)
  cachedFavoriteIds = next
  notifyListeners()
}

export function useUserFavoriteStatus(userId: string | null | undefined, propertyId: string) {
  const [, forceRender] = useState(0)

  useEffect(() => {
    const onChange = () => forceRender((n) => n + 1)
    listeners.add(onChange)
    return () => {
      listeners.delete(onChange)
    }
  }, [])

  useEffect(() => {
    if (!userId) {
      if (cachedUserId !== null) {
        cachedUserId = null
        cachedFavoriteIds = new Set<string>()
        notifyListeners()
      }
      return
    }
    void ensureFavoritesLoaded(userId)
  }, [userId])

  const isSaved = Boolean(userId && propertyId && cachedFavoriteIds.has(propertyId))

  const updateSaved = useCallback(
    (saved: boolean) => {
      if (!propertyId) return
      setCachedFavoriteState(propertyId, saved)
    },
    [propertyId]
  )

  return { isSaved, updateSaved }
}
