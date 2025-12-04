/**
 * Game Settings Hook
 *
 * Manages user preferences that are persisted to localStorage:
 * - autoSpeak: Automatically speak hints when they appear
 * - withAccent: Use native pronunciation for region names
 * - autoHint: Automatically show hints when prompt changes
 * - hotColdEnabled: Enable hot/cold audio feedback
 *
 * Also handles:
 * - Auto-enabling hot/cold for learning mode
 * - Computed refs for async-safe access in event handlers
 */

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// ============================================================================
// Types
// ============================================================================

export interface UseGameSettingsOptions {
  /** Assistance level from game config */
  assistanceLevel?: string
  /** Whether the assistance level allows hot/cold feedback */
  assistanceAllowsHotCold: boolean
}

export interface UseGameSettingsReturn {
  // -------------------------------------------------------------------------
  // State Values
  // -------------------------------------------------------------------------
  /** Whether to automatically speak hints */
  autoSpeak: boolean
  /** Whether to use native accent for pronunciation */
  withAccent: boolean
  /** Whether to auto-open hints on prompt change */
  autoHint: boolean
  /** Whether hot/cold audio feedback is enabled */
  hotColdEnabled: boolean
  /** Effective hot/cold (requires both user setting and assistance level) */
  effectiveHotColdEnabled: boolean

  // -------------------------------------------------------------------------
  // Setters (with localStorage persistence)
  // -------------------------------------------------------------------------
  /** Set auto-speak preference */
  setAutoSpeak: (enabled: boolean) => void
  /** Set with-accent preference */
  setWithAccent: (enabled: boolean) => void
  /** Set auto-hint preference */
  setAutoHint: (enabled: boolean) => void
  /** Set hot/cold preference */
  setHotColdEnabled: (enabled: boolean) => void

  // -------------------------------------------------------------------------
  // Toggle Callbacks
  // -------------------------------------------------------------------------
  /** Toggle auto-speak */
  toggleAutoSpeak: () => void
  /** Toggle with-accent */
  toggleWithAccent: () => void
  /** Toggle auto-hint */
  toggleAutoHint: () => void
  /** Toggle hot/cold */
  toggleHotCold: () => void

  // -------------------------------------------------------------------------
  // Refs for Async Access
  // -------------------------------------------------------------------------
  /** Ref to current autoHint value */
  autoHintRef: React.MutableRefObject<boolean>
  /** Ref to current autoSpeak value */
  autoSpeakRef: React.MutableRefObject<boolean>
  /** Ref to current withAccent value */
  withAccentRef: React.MutableRefObject<boolean>
  /** Ref to current effectiveHotColdEnabled value */
  hotColdEnabledRef: React.MutableRefObject<boolean>
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEYS = {
  autoSpeak: 'knowYourWorld.autoSpeakHint',
  withAccent: 'knowYourWorld.withAccent',
  autoHint: 'knowYourWorld.autoHint',
  hotCold: 'knowYourWorld.hotColdAudio',
} as const

// ============================================================================
// Helper Functions
// ============================================================================

function getStoredBoolean(key: string, defaultValue: boolean = false): boolean {
  if (typeof window === 'undefined') return defaultValue
  const stored = localStorage.getItem(key)
  if (stored === null) return defaultValue
  return stored === 'true'
}

function setStoredBoolean(key: string, value: boolean): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(key, String(value))
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Manages game settings with localStorage persistence.
 *
 * @param options - Configuration options
 * @returns Settings state, setters, toggles, and refs
 *
 * @example
 * ```tsx
 * const settings = useGameSettings({
 *   assistanceLevel,
 *   assistanceAllowsHotCold,
 * })
 *
 * // Use state
 * if (settings.autoSpeak) { ... }
 *
 * // Use toggles in UI
 * <button onClick={settings.toggleAutoSpeak}>Auto-Speak</button>
 *
 * // Use refs in async handlers
 * const handleEvent = () => {
 *   if (settings.autoSpeakRef.current) { ... }
 * }
 * ```
 */
export function useGameSettings(options: UseGameSettingsOptions): UseGameSettingsReturn {
  const { assistanceLevel, assistanceAllowsHotCold } = options

  // -------------------------------------------------------------------------
  // State with localStorage initialization
  // -------------------------------------------------------------------------

  const [autoSpeak, setAutoSpeakState] = useState(() =>
    getStoredBoolean(STORAGE_KEYS.autoSpeak, false)
  )

  const [withAccent, setWithAccentState] = useState(() =>
    getStoredBoolean(STORAGE_KEYS.withAccent, false)
  )

  const [autoHint, setAutoHintState] = useState(() =>
    getStoredBoolean(STORAGE_KEYS.autoHint, false)
  )

  const [hotColdEnabled, setHotColdEnabledState] = useState(() =>
    getStoredBoolean(STORAGE_KEYS.hotCold, false)
  )

  // -------------------------------------------------------------------------
  // Computed Values
  // -------------------------------------------------------------------------

  // Hot/cold is only active when both: 1) assistance level allows it, 2) user has it enabled
  const effectiveHotColdEnabled = assistanceAllowsHotCold && hotColdEnabled

  // -------------------------------------------------------------------------
  // Refs for Async Access
  // -------------------------------------------------------------------------

  const autoHintRef = useRef(autoHint)
  const autoSpeakRef = useRef(autoSpeak)
  const withAccentRef = useRef(withAccent)
  const hotColdEnabledRef = useRef(effectiveHotColdEnabled)

  // Keep refs in sync
  autoHintRef.current = autoHint
  autoSpeakRef.current = autoSpeak
  withAccentRef.current = withAccent
  hotColdEnabledRef.current = effectiveHotColdEnabled

  // -------------------------------------------------------------------------
  // Auto-enable hot/cold for learning mode
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (assistanceLevel === 'learning' && assistanceAllowsHotCold && !hotColdEnabled) {
      setHotColdEnabledState(true)
      setStoredBoolean(STORAGE_KEYS.hotCold, true)
    }
  }, [assistanceLevel, assistanceAllowsHotCold, hotColdEnabled])

  // -------------------------------------------------------------------------
  // Setters with localStorage persistence
  // -------------------------------------------------------------------------

  const setAutoSpeak = useCallback((enabled: boolean) => {
    setAutoSpeakState(enabled)
    setStoredBoolean(STORAGE_KEYS.autoSpeak, enabled)
  }, [])

  const setWithAccent = useCallback((enabled: boolean) => {
    setWithAccentState(enabled)
    setStoredBoolean(STORAGE_KEYS.withAccent, enabled)
  }, [])

  const setAutoHint = useCallback((enabled: boolean) => {
    setAutoHintState(enabled)
    setStoredBoolean(STORAGE_KEYS.autoHint, enabled)
  }, [])

  const setHotColdEnabled = useCallback((enabled: boolean) => {
    setHotColdEnabledState(enabled)
    setStoredBoolean(STORAGE_KEYS.hotCold, enabled)
  }, [])

  // -------------------------------------------------------------------------
  // Toggle Callbacks
  // -------------------------------------------------------------------------

  const toggleAutoSpeak = useCallback(() => {
    setAutoSpeak(!autoSpeak)
  }, [autoSpeak, setAutoSpeak])

  const toggleWithAccent = useCallback(() => {
    setWithAccent(!withAccent)
  }, [withAccent, setWithAccent])

  const toggleAutoHint = useCallback(() => {
    setAutoHint(!autoHint)
  }, [autoHint, setAutoHint])

  const toggleHotCold = useCallback(() => {
    setHotColdEnabled(!hotColdEnabled)
  }, [hotColdEnabled, setHotColdEnabled])

  // -------------------------------------------------------------------------
  // Return
  // -------------------------------------------------------------------------

  return {
    // State values
    autoSpeak,
    withAccent,
    autoHint,
    hotColdEnabled,
    effectiveHotColdEnabled,
    // Setters
    setAutoSpeak,
    setWithAccent,
    setAutoHint,
    setHotColdEnabled,
    // Toggles
    toggleAutoSpeak,
    toggleWithAccent,
    toggleAutoHint,
    toggleHotCold,
    // Refs
    autoHintRef,
    autoSpeakRef,
    withAccentRef,
    hotColdEnabledRef,
  }
}
