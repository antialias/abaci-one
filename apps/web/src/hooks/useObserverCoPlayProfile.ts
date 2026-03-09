'use client'

import { useCallback, useMemo, useSyncExternalStore } from 'react'

/**
 * Observer co-play profile for joining practice game breaks as a participant.
 * Stored in localStorage so it persists across page reloads.
 */
export interface ObserverCoPlayProfile {
  name: string
  emoji: string
  color: string
  isReady: boolean
}

const STORAGE_KEY = 'observer-coplay-profile'

// ============================================================================
// External store for cross-component reactivity
// ============================================================================

let listeners: Array<() => void> = []

function subscribe(listener: () => void) {
  listeners = [...listeners, listener]
  return () => {
    listeners = listeners.filter((l) => l !== listener)
  }
}

function emitChange() {
  for (const listener of listeners) {
    listener()
  }
}

function getSnapshot(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(STORAGE_KEY)
}

function getServerSnapshot(): string | null {
  return null
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Manage the observer's co-play profile for game break participation.
 *
 * Profile is stored in localStorage and shared across components
 * via useSyncExternalStore for instant reactivity.
 */
export function useObserverCoPlayProfile() {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const profile = useMemo<ObserverCoPlayProfile | null>(() => {
    if (!raw) return null
    try {
      return JSON.parse(raw) as ObserverCoPlayProfile
    } catch {
      return null
    }
  }, [raw])

  const setProfile = useCallback((update: ObserverCoPlayProfile | null) => {
    if (update) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(update))
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
    emitChange()
  }, [])

  const updateProfile = useCallback(
    (partial: Partial<ObserverCoPlayProfile>) => {
      const current = profile ?? { name: '', emoji: '😊', color: '#6366f1', isReady: false }
      setProfile({ ...current, ...partial })
    },
    [profile, setProfile]
  )

  return {
    profile,
    isReady: profile?.isReady ?? false,
    setProfile,
    updateProfile,
    clearProfile: useCallback(() => setProfile(null), [setProfile]),
  }
}
