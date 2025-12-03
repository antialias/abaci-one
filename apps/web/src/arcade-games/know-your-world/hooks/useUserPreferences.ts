/**
 * useUserPreferences Hook
 *
 * Manages localStorage-persisted user preferences for Know Your World game.
 * Includes auto-speak, accent, auto-hint, and hot/cold audio settings.
 */

'use client'

import { useCallback, useEffect, useState } from 'react'

// ============================================================================
// Types
// ============================================================================

export interface UseUserPreferencesOptions {
  /** Assistance level - used to auto-enable hot/cold in learning mode */
  assistanceLevel: 'learning' | 'guided' | 'helpful' | 'standard' | 'none'
  /** Whether hot/cold is allowed at current assistance level */
  assistanceAllowsHotCold: boolean
}

export interface UseUserPreferencesReturn {
  // State values
  /** Auto-speak hint when region changes */
  autoSpeak: boolean
  /** Use native accent for pronunciation */
  withAccent: boolean
  /** Auto-open hint on region advance */
  autoHint: boolean
  /** Hot/cold audio feedback enabled */
  hotColdEnabled: boolean

  // Handlers
  /** Update auto-speak setting */
  handleAutoSpeakChange: (enabled: boolean) => void
  /** Update with-accent setting */
  handleWithAccentChange: (enabled: boolean) => void
  /** Update auto-hint setting */
  handleAutoHintChange: (enabled: boolean) => void
  /** Update hot/cold setting */
  handleHotColdChange: (enabled: boolean) => void
}

// ============================================================================
// Constants
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
 * Hook to manage localStorage-persisted user preferences.
 */
export function useUserPreferences({
  assistanceLevel,
  assistanceAllowsHotCold,
}: UseUserPreferencesOptions): UseUserPreferencesReturn {
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
    // State values
    autoSpeak,
    withAccent,
    autoHint,
    hotColdEnabled,

    // Handlers
    handleAutoSpeakChange,
    handleWithAccentChange,
    handleAutoHintChange,
    handleHotColdChange,
  }
}
