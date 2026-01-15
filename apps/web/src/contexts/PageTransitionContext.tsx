'use client'

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'

// ============================================================================
// Types
// ============================================================================

export interface TransitionState {
  type: 'quicklook-to-dashboard'
  studentId: string
  studentName: string
  studentEmoji: string
  studentColor: string
  originBounds: {
    left: number
    top: number
    width: number
    height: number
  }
  timestamp: number
}

interface PageTransitionContextValue {
  /** Current transition state (null if no transition in progress) */
  transitionState: TransitionState | null
  /** Whether the overlay is currently visible */
  isTransitioning: boolean
  /** Whether we're in the revealing phase (overlay fading out, content fading in) */
  isRevealing: boolean
  /** Start a transition to a student dashboard */
  startTransition: (state: Omit<TransitionState, 'type' | 'timestamp'>) => void
  /** Signal that the destination page is ready to be revealed */
  signalReady: () => void
  /** Clear any pending transition state */
  clearTransition: () => void
}

const PageTransitionContext = createContext<PageTransitionContextValue | null>(null)

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = 'page-transition-state'
const TRANSITION_MAX_AGE_MS = 3000 // Transition state expires after 3 seconds

// ============================================================================
// Provider
// ============================================================================

export function PageTransitionProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [transitionState, setTransitionState] = useState<TransitionState | null>(null)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [phase, setPhase] = useState<'idle' | 'expanding' | 'navigating' | 'revealing'>('idle')

  // Check for pending transition on mount (destination page)
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY)
      if (stored) {
        const state = JSON.parse(stored) as TransitionState
        const age = Date.now() - state.timestamp

        if (age < TRANSITION_MAX_AGE_MS) {
          // Valid transition state - we're on the destination page
          // Start in 'navigating' phase - the overlay is covering, waiting for signalReady()
          console.log('[PageTransitionContext] Found valid transition state, age:', age)
          setTransitionState(state)
          setIsTransitioning(true)
          setPhase('navigating') // Don't reveal until signalReady() is called
        } else {
          // Expired - clean up
          sessionStorage.removeItem(STORAGE_KEY)
        }
      }
    } catch {
      // Ignore storage errors
    }
  }, [])

  const startTransition = useCallback(
    (stateData: Omit<TransitionState, 'type' | 'timestamp'>) => {
      const state: TransitionState = {
        ...stateData,
        type: 'quicklook-to-dashboard',
        timestamp: Date.now(),
      }

      // Store in sessionStorage for the destination page
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state))
      } catch {
        // If storage fails, still do the navigation but without smooth transition
      }

      setTransitionState(state)
      setIsTransitioning(true)
      setPhase('expanding')

      // Prefetch the destination
      router.prefetch(`/practice/${state.studentId}/dashboard`)

      // Start navigation after expansion animation begins (200ms into the animation)
      setTimeout(() => {
        setPhase('navigating')
        router.push(`/practice/${state.studentId}/dashboard`)
      }, 250)
    },
    [router]
  )

  const signalReady = useCallback(() => {
    // Destination page signals it's ready - start reveal
    console.log('[PageTransitionContext] signalReady called, setting phase to revealing')
    setPhase('revealing')

    // After reveal animation completes, clean up
    setTimeout(() => {
      console.log('[PageTransitionContext] Cleanup: setting isTransitioning to false')
      setIsTransitioning(false)
      setTransitionState(null)
      setPhase('idle')
      try {
        sessionStorage.removeItem(STORAGE_KEY)
      } catch {
        // Ignore
      }
    }, 300)
  }, [])

  const clearTransition = useCallback(() => {
    setIsTransitioning(false)
    setTransitionState(null)
    setPhase('idle')
    try {
      sessionStorage.removeItem(STORAGE_KEY)
    } catch {
      // Ignore
    }
  }, [])

  const isRevealing = phase === 'revealing'

  return (
    <PageTransitionContext.Provider
      value={{
        transitionState,
        isTransitioning,
        isRevealing,
        startTransition,
        signalReady,
        clearTransition,
      }}
    >
      {children}
    </PageTransitionContext.Provider>
  )
}

// ============================================================================
// Hook
// ============================================================================

export function usePageTransition() {
  const context = useContext(PageTransitionContext)
  if (!context) {
    throw new Error('usePageTransition must be used within a PageTransitionProvider')
  }
  return context
}

/**
 * Hook for destination pages to check if they were navigated to via transition
 * Returns the transition state if valid, and a signalReady callback
 */
export function useIncomingTransition() {
  const { transitionState, isTransitioning, isRevealing, signalReady, clearTransition } =
    usePageTransition()

  return {
    /** Whether we arrived via a page transition */
    hasTransition: isTransitioning && transitionState !== null,
    /** Whether the overlay is fading out (content should fade in) */
    isRevealing,
    /** The transition state (student info, origin bounds, etc.) */
    transitionState,
    /** Call this when the page is ready to be revealed */
    signalReady,
    /** Call this to abort/clear the transition */
    clearTransition,
  }
}
