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
import useMeasure from 'react-use-measure'
import type { SessionMode } from '@/lib/curriculum/session-mode'
import type { ActiveSessionState } from '@/components/practice/ActiveSessionBanner'

// ============================================================================
// Types
// ============================================================================

export type BannerSlot = 'content' | 'nav' | 'hidden'

// Re-export for convenience
export type { ActiveSessionState } from '@/components/practice/ActiveSessionBanner'

export interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

interface SessionModeBannerContextValue {
  // Which slot is the "home" for the banner (computed from registered slots)
  activeSlot: BannerSlot

  // Slot registration - pages call these to register their slots
  registerContentSlot: (element: HTMLElement | null) => void
  registerNavSlot: (element: HTMLElement | null) => void

  // Current measured bounds (null if slot not registered)
  contentBounds: Bounds | null
  navBounds: Bounds | null

  // Session mode data (passed through from hook)
  sessionMode: SessionMode | null
  isLoading: boolean

  // Action callback (opens StartPracticeModal)
  onAction: () => void
  setOnAction: (callback: () => void) => void

  // Track if this is initial render (skip animation)
  isInitialRender: boolean

  // Previous slot (for animation direction)
  previousSlot: BannerSlot | null

  // Active session state (if there's an in-progress session)
  activeSession: ActiveSessionState | null

  // Resume session callback
  onResume: () => void
  setOnResume: (callback: () => void) => void

  // Start fresh callback (opens modal while session is still active)
  onStartFresh: () => void
  setOnStartFresh: (callback: () => void) => void
}

// ============================================================================
// Context
// ============================================================================

const SessionModeBannerContext = createContext<SessionModeBannerContextValue | null>(null)

// ============================================================================
// Provider
// ============================================================================

interface SessionModeBannerProviderProps {
  children: ReactNode
  sessionMode: SessionMode | null
  isLoading: boolean
  /** Active session state (if there's an in-progress session) */
  activeSession?: ActiveSessionState | null
}

export function SessionModeBannerProvider({
  children,
  sessionMode,
  isLoading,
  activeSession = null,
}: SessionModeBannerProviderProps) {
  // Track which slots are currently registered
  const [contentSlotRegistered, setContentSlotRegistered] = useState(false)
  const [navSlotRegistered, setNavSlotRegistered] = useState(false)

  // Track initial render
  const [isInitialRender, setIsInitialRender] = useState(true)
  useEffect(() => {
    // After first effect cycle, we're no longer in initial render
    const timer = setTimeout(() => setIsInitialRender(false), 100)
    return () => clearTimeout(timer)
  }, [])

  // Compute active slot based on which slots are registered
  // Priority: content > nav > hidden
  const activeSlot: BannerSlot = contentSlotRegistered
    ? 'content'
    : navSlotRegistered
      ? 'nav'
      : 'hidden'

  // Track previous slot for animation direction
  const previousSlotRef = useRef<BannerSlot | null>(null)
  const [previousSlot, setPreviousSlot] = useState<BannerSlot | null>(null)

  useEffect(() => {
    if (previousSlotRef.current !== null && previousSlotRef.current !== activeSlot) {
      setPreviousSlot(previousSlotRef.current)
    }
    previousSlotRef.current = activeSlot
  }, [activeSlot])

  // Use react-use-measure for content slot
  const [contentRef, contentBounds] = useMeasure({ scroll: true })
  const contentElementRef = useRef<HTMLElement | null>(null)

  // Use react-use-measure for nav slot
  const [navRef, navBounds] = useMeasure({ scroll: true })
  const navElementRef = useRef<HTMLElement | null>(null)

  // Registration callbacks
  const registerContentSlot = useCallback(
    (element: HTMLElement | null) => {
      contentElementRef.current = element
      contentRef(element)
      setContentSlotRegistered(element !== null)
    },
    [contentRef]
  )

  const registerNavSlot = useCallback(
    (element: HTMLElement | null) => {
      navElementRef.current = element
      navRef(element)
      setNavSlotRegistered(element !== null)
    },
    [navRef]
  )

  // Action callback ref (to avoid re-renders when callback changes)
  const onActionRef = useRef<() => void>(() => {})

  const onAction = useCallback(() => {
    onActionRef.current()
  }, [])

  const setOnAction = useCallback((callback: () => void) => {
    onActionRef.current = callback
  }, [])

  // Resume session callback ref
  const onResumeRef = useRef<() => void>(() => {})

  const onResume = useCallback(() => {
    onResumeRef.current()
  }, [])

  const setOnResume = useCallback((callback: () => void) => {
    onResumeRef.current = callback
  }, [])

  // Start fresh callback ref
  const onStartFreshRef = useRef<() => void>(() => {})

  const onStartFresh = useCallback(() => {
    onStartFreshRef.current()
  }, [])

  const setOnStartFresh = useCallback((callback: () => void) => {
    onStartFreshRef.current = callback
  }, [])

  // Convert bounds to our format (null if not registered or zero-sized)
  const processedContentBounds: Bounds | null = useMemo(() => {
    if (!contentBounds || contentBounds.width === 0 || contentBounds.height === 0) {
      return null
    }
    return {
      x: contentBounds.x,
      y: contentBounds.y,
      width: contentBounds.width,
      height: contentBounds.height,
    }
  }, [contentBounds])

  const processedNavBounds: Bounds | null = useMemo(() => {
    if (!navBounds || navBounds.width === 0 || navBounds.height === 0) {
      return null
    }
    return {
      x: navBounds.x,
      y: navBounds.y,
      width: navBounds.width,
      height: navBounds.height,
    }
  }, [navBounds])

  const value = useMemo(
    () => ({
      activeSlot,
      registerContentSlot,
      registerNavSlot,
      contentBounds: processedContentBounds,
      navBounds: processedNavBounds,
      sessionMode,
      isLoading,
      onAction,
      setOnAction,
      isInitialRender,
      previousSlot,
      activeSession,
      onResume,
      setOnResume,
      onStartFresh,
      setOnStartFresh,
    }),
    [
      activeSlot,
      registerContentSlot,
      registerNavSlot,
      processedContentBounds,
      processedNavBounds,
      sessionMode,
      isLoading,
      onAction,
      setOnAction,
      isInitialRender,
      previousSlot,
      activeSession,
      onResume,
      setOnResume,
      onStartFresh,
      setOnStartFresh,
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

// ============================================================================
// Slot Components
// ============================================================================

interface ContentBannerSlotProps {
  className?: string
  /** Minimum height to reserve when banner is not measured yet */
  minHeight?: number
}

/**
 * Placeholder slot for the full banner in content area.
 * Renders an invisible div that the ProjectingBanner will measure and target.
 * When this component mounts, the banner will animate to this slot.
 */
export function ContentBannerSlot({ className, minHeight = 120 }: ContentBannerSlotProps) {
  const { registerContentSlot, activeSlot } = useSessionModeBanner()
  const ref = useRef<HTMLDivElement>(null)

  // Register on mount, unregister on unmount
  useEffect(() => {
    registerContentSlot(ref.current)
    return () => registerContentSlot(null)
  }, [registerContentSlot])

  return (
    <div
      ref={ref}
      data-slot="content-banner"
      data-active={activeSlot === 'content'}
      className={className}
      style={{
        // Reserve space for the banner - the portal will render on top
        minHeight,
      }}
    />
  )
}

interface NavBannerSlotProps {
  className?: string
  /** Minimum height to reserve for compact banner */
  minHeight?: number
}

/**
 * Placeholder slot for the compact banner in nav area.
 * Renders an invisible div that the ProjectingBanner will measure and target.
 * This slot is used when ContentBannerSlot is not mounted.
 *
 * Returns null if used outside SessionModeBannerProvider (graceful degradation).
 */
export function NavBannerSlot({ className, minHeight = 40 }: NavBannerSlotProps) {
  const context = useSessionModeBannerOptional()
  const ref = useRef<HTMLDivElement>(null)

  // Register on mount, unregister on unmount
  useEffect(() => {
    if (context) {
      context.registerNavSlot(ref.current)
      return () => context.registerNavSlot(null)
    }
  }, [context])

  // Don't render if no provider
  if (!context) {
    return null
  }

  return (
    <div
      ref={ref}
      data-slot="nav-banner"
      data-active={context.activeSlot === 'nav'}
      className={className}
      style={{
        // Reserve space for the compact banner
        minHeight,
      }}
    />
  )
}
