/**
 * useUserPreferences Hook
 *
 * Manages user preference settings persisted in localStorage for Know Your World game.
 * Handles auto-speak, accent, auto-hint, and hot/cold audio feedback settings.
 */

'use client'

import { useState, useCallback, useEffect } from 'react'

// ============================================================================
// Types
// ============================================================================

export interface UserPreferences {
  /** Whether hints are automatically spoken when revealed */
  autoSpeak: boolean
  /** Whether to use the target region's accent when speaking hints */
  withAccent: boolean
  /** Whether hints are automatically opened on region advance */
  autoHint: boolean
  /** Whether hot/cold audio feedback is enabled */
  hotColdEnabled: boolean
}

export interface UserPreferencesHandlers {
  /** Toggle auto-speak setting */
  handleAutoSpeakChange: (enabled: boolean) => void
  /** Toggle with-accent setting */
  handleWithAccentChange: (enabled: boolean) => void
  /** Toggle auto-hint setting */
  handleAutoHintChange: (enabled: boolean) => void
  /** Toggle hot/cold audio setting */
  handleHotColdChange: (enabled: boolean) => void
}

export interface UseUserPreferencesOptions {
  /** Current assistance level */
  assistanceLevel?: string
  /** Whether hot/cold is allowed by assistance settings */
  assistanceAllowsHotCold?: boolean
}

export interface UseUserPreferencesReturn extends UserPreferences, UserPreferencesHandlers {}

// ============================================================================
// LocalStorage Keys
// ============================================================================

const STORAGE_KEYS = {
  autoSpeak: 'knowYourWorld.autoSpeakHint',
  withAccent: 'knowYourWorld.withAccent',
  autoHint: 'knowYourWorld.autoHint',
  hotColdAudio: 'knowYourWorld.hotColdAudio',
} as const

// ============================================================================
// Hook
// ============================================================================

/**
 * Custom hook for managing user preferences with localStorage persistence.
 * Auto-enables hot/cold for learning assistance level.
 */
export function useUserPreferences({
  assistanceLevel,
  assistanceAllowsHotCold = false,
}: UseUserPreferencesOptions = {}): UseUserPreferencesReturn {
  // Auto-speak setting persisted in localStorage
  const [autoSpeak, setAutoSpeak] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(STORAGE_KEYS.autoSpeak) === 'true'
  })

  // With accent setting persisted in localStorage (default false - use user's locale for consistent pronunciation)
  const [withAccent, setWithAccent] = useState(() => {
    if (typeof window === 'undefined') return false
    const stored = localStorage.getItem(STORAGE_KEYS.withAccent)
    return stored === null ? false : stored === 'true'
  })

  // Auto-hint setting persisted in localStorage (auto-opens hint on region advance)
  const [autoHint, setAutoHint] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(STORAGE_KEYS.autoHint) === 'true'
  })

  // Hot/cold audio feedback setting persisted in localStorage
  const [hotColdEnabled, setHotColdEnabled] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(STORAGE_KEYS.hotColdAudio) === 'true'
  })

  // Auto-enable hot/cold for learning mode (highest assistance level)
  // This ensures all players in a learning game get hot/cold feedback enabled
  useEffect(() => {
    if (assistanceLevel === 'learning' && assistanceAllowsHotCold && !hotColdEnabled) {
      setHotColdEnabled(true)
      // Also persist to localStorage so it stays enabled if they navigate away
      localStorage.setItem(STORAGE_KEYS.hotColdAudio, 'true')
    }
  }, [assistanceLevel, assistanceAllowsHotCold, hotColdEnabled])

  // Persist auto-speak setting
  const handleAutoSpeakChange = useCallback((enabled: boolean) => {
    setAutoSpeak(enabled)
    localStorage.setItem(STORAGE_KEYS.autoSpeak, String(enabled))
  }, [])

  // Persist with-accent setting
  const handleWithAccentChange = useCallback((enabled: boolean) => {
    setWithAccent(enabled)
    localStorage.setItem(STORAGE_KEYS.withAccent, String(enabled))
  }, [])

  // Persist auto-hint setting
  const handleAutoHintChange = useCallback((enabled: boolean) => {
    setAutoHint(enabled)
    localStorage.setItem(STORAGE_KEYS.autoHint, String(enabled))
  }, [])

  // Persist hot/cold audio setting
  const handleHotColdChange = useCallback((enabled: boolean) => {
    setHotColdEnabled(enabled)
    localStorage.setItem(STORAGE_KEYS.hotColdAudio, String(enabled))
  }, [])

  return {
    autoSpeak,
    withAccent,
    autoHint,
    hotColdEnabled,
    handleAutoSpeakChange,
    handleWithAccentChange,
    handleAutoHintChange,
    handleHotColdChange,
  }
}
