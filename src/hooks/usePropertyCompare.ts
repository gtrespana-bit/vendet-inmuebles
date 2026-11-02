'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  COMPARE_STORAGE_KEY,
  isValidCompareId,
  MAX_COMPARE_ITEMS,
  toggleCompareItem,
  type ComparePreviewItem,
} from '@/lib/property-compare'

const COMPARE_EVENT = 'vi:compare-updated'

function readStoredItems(): ComparePreviewItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(COMPARE_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((x: any) => x && isValidCompareId(x.id) && typeof x.title === 'string')
      .slice(0, MAX_COMPARE_ITEMS)
  } catch {
    return []
  }
}

function writeStoredItems(items: ComparePreviewItem[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(COMPARE_STORAGE_KEY, JSON.stringify(items.slice(0, MAX_COMPARE_ITEMS)))
  } catch {
    // Ignorar en modo privado estricto
  }
  window.dispatchEvent(new CustomEvent(COMPARE_EVENT, { detail: items }))
}

export function usePropertyCompare() {
  const [items, setItems] = useState<ComparePreviewItem[]>([])
  const [limitNotice, setLimitNotice] = useState(false)

  useEffect(() => {
    setItems(readStoredItems())

    const onCustom = () => setItems(readStoredItems())
    const onStorage = (ev: StorageEvent) => {
      if (ev.key === COMPARE_STORAGE_KEY) setItems(readStoredItems())
    }

    window.addEventListener(COMPARE_EVENT, onCustom)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(COMPARE_EVENT, onCustom)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  const isCompared = useCallback(
    (id: string) => {
      const normalized = id.trim().toLowerCase()
      return items.some((item) => item.id.toLowerCase() === normalized)
    },
    [items],
  )

  const toggle = useCallback((candidate: ComparePreviewItem) => {
    const current = readStoredItems()
    const { next, action } = toggleCompareItem(current, candidate)
    if (action === 'limit_reached') {
      setLimitNotice(true)
      setTimeout(() => setLimitNotice(false), 3200)
      return action
    }
    setLimitNotice(false)
    writeStoredItems(next)
    setItems(next)
    return action
  }, [])

  const remove = useCallback((id: string) => {
    const normalized = id.trim().toLowerCase()
    const next = readStoredItems().filter((item) => item.id.toLowerCase() !== normalized)
    writeStoredItems(next)
    setItems(next)
  }, [])

  const clear = useCallback(() => {
    writeStoredItems([])
    setItems([])
  }, [])

  return {
    items,
    count: items.length,
    max: MAX_COMPARE_ITEMS,
    limitNotice,
    isCompared,
    toggle,
    remove,
    clear,
  }
}
