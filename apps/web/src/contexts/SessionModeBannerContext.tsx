'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { SessionMode } from '@/lib/curriculum/session-mode'
import type { ActiveSessionState } from '@/components/practice/ActiveSessionBanner'

// ============================================================================
// Types
// ============================================================================

export type BannerSlot = 'content' | 'nav' | 'hidden'

// Re-export for convenience
export type { ActiveSessionState } from '@/components/practice/ActiveSessionBanner'

export interface SlotBounds {
  x: number
  y: number
  width: number
  height: number
}

interface SessionModeBannerContextValue {
  // Which slot is currently active (computed from registered slots)
  activeSlot: BannerSlot

  // Slot registration - components call these to register/unregister
  registerContentSlot: () => void
  unregisterContentSlot: () => void
  registerNavSlot: () => void
  unregisterNavSlot: () => void

  // Bounds reporting - slots report their position
  setContentBounds: (bounds: SlotBounds | null) => void
  setNavBounds: (bounds: SlotBounds | null) => void

  // Current target bounds for the banner (from active slot)
  targetBounds: SlotBounds | null

  // Session mode data
  sessionMode: SessionMode | null
  isLoading: boolean

  // Active session state (if there's an in-progress session)
  activeSession: ActiveSessionState | null

  // Action callbacks
  onAction: () => void
  setOnAction: (callback: () => void) => void
  onResume: () => void
  setOnResume: (callback: () => void) => void
  onStartFresh: () => void
  setOnStartFresh: (callback: () => void) => void

  // Skip animation on rapid navigation
  shouldAnimate: boolean
}

const SessionModeBannerContext = createContext<SessionModeBannerContextValue | null>(null)

// ============================================================================
// Provider
// ============================================================================

interface SessionModeBannerProviderProps {
  children: ReactNode
  sessionMode: SessionMode | null
  isLoading: boolean
  activeSession?: ActiveSessionState | null
}

export function SessionModeBannerProvider({
  children,
  sessionMode,
  isLoading,
  activeSession = null,
}: SessionModeBannerProviderProps) {
  // Track which slots are currently registered
  const [contentSlotCount, setContentSlotCount] = useState(0)
  const [navSlotCount, setNavSlotCount] = useState(0)

  // Track bounds from each slot
  const [contentBounds, setContentBoundsState] = useState<SlotBounds | null>(null)
  const [navBounds, setNavBoundsState] = useState<SlotBounds | null>(null)

  // Track last slot change time for animation skipping
  const lastSlotChangeRef = useRef<number>(0)
  const [shouldAnimate, setShouldAnimate] = useState(true)

  // Compute active slot based on which slots are registered
  // Priority: content > nav > hidden
  const activeSlot: BannerSlot =
    contentSlotCount > 0 ? 'content' : navSlotCount > 0 ? 'nav' : 'hidden'

  // Compute target bounds based on active slot
  const targetBounds =
    activeSlot === 'content' ? contentBounds : activeSlot === 'nav' ? navBounds : null

  // When slot changes, check if we should animate
  const previousSlotRef = useRef<BannerSlot>(activeSlot)
  useEffect(() => {
    if (previousSlotRef.current !== activeSlot) {
      const now = Date.now()
      const timeSinceLastChange = now - lastSlotChangeRef.current

      // Skip animation if navigating rapidly (< 300ms between changes)
      setShouldAnimate(timeSinceLastChange > 300)
      lastSlotChangeRef.current = now
      previousSlotRef.current = activeSlot
    }
  }, [activeSlot])

  // Registration callbacks
  const registerContentSlot = useCallback(() => {
    setContentSlotCount((c) => c + 1)
  }, [])

  const unregisterContentSlot = useCallback(() => {
    setContentSlotCount((c) => Math.max(0, c - 1))
  }, [])

  const registerNavSlot = useCallback(() => {
    setNavSlotCount((c) => c + 1)
  }, [])

  const unregisterNavSlot = useCallback(() => {
    setNavSlotCount((c) => Math.max(0, c - 1))
  }, [])

  // Bounds setters (wrapped for stability)
  const setContentBounds = useCallback((bounds: SlotBounds | null) => {
    setContentBoundsState(bounds)
  }, [])

  const setNavBounds = useCallback((bounds: SlotBounds | null) => {
    setNavBoundsState(bounds)
  }, [])

  // Action callback refs (to avoid re-renders when callbacks change)
  const onActionRef = useRef<() => void>(() => {})
  const onResumeRef = useRef<() => void>(() => {})
  const onStartFreshRef = useRef<() => void>(() => {})

  const onAction = useCallback(() => {
    onActionRef.current()
  }, [])

  const setOnAction = useCallback((callback: () => void) => {
    onActionRef.current = callback
  }, [])

  const onResume = useCallback(() => {
    onResumeRef.current()
  }, [])

  const setOnResume = useCallback((callback: () => void) => {
    onResumeRef.current = callback
  }, [])

  const onStartFresh = useCallback(() => {
    onStartFreshRef.current()
  }, [])

  const setOnStartFresh = useCallback((callback: () => void) => {
    onStartFreshRef.current = callback
  }, [])

  const value = useMemo(
    () => ({
      activeSlot,
      registerContentSlot,
      unregisterContentSlot,
      registerNavSlot,
      unregisterNavSlot,
      setContentBounds,
      setNavBounds,
      targetBounds,
      sessionMode,
      isLoading,
      activeSession,
      onAction,
      setOnAction,
      onResume,
      setOnResume,
      onStartFresh,
      setOnStartFresh,
      shouldAnimate,
    }),
    [
      activeSlot,
      registerContentSlot,
      unregisterContentSlot,
      registerNavSlot,
      unregisterNavSlot,
      setContentBounds,
      setNavBounds,
      targetBounds,
      sessionMode,
      isLoading,
      activeSession,
      onAction,
      setOnAction,
      onResume,
      setOnResume,
      onStartFresh,
      setOnStartFresh,
      shouldAnimate,
    ]
  )

  return (
    <SessionModeBannerContext.Provider value={value}>{children}</SessionModeBannerContext.Provider>
  )
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook to access the session mode banner context.
 * Throws if used outside SessionModeBannerProvider.
 */
export function useSessionModeBanner() {
  const context = useContext(SessionModeBannerContext)
  if (!context) {
    throw new Error('useSessionModeBanner must be used within SessionModeBannerProvider')
  }
  return context
}

/**
 * Optional hook that returns null if used outside SessionModeBannerProvider.
 * Use this in components that need to work both with and without the provider.
 */
export function useSessionModeBannerOptional() {
  return useContext(SessionModeBannerContext)
}
