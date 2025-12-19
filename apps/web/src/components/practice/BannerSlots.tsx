'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, useSpring } from 'framer-motion'
import { useTheme } from '@/contexts/ThemeContext'
import {
  useSessionModeBanner,
  useSessionModeBannerOptional,
  type SlotBounds,
} from '@/contexts/SessionModeBannerContext'
import { SessionModeBanner } from './SessionModeBanner'
import { CompactBanner } from './CompactBanner'
import { ActiveSessionBanner } from './ActiveSessionBanner'
import { Z_INDEX } from '@/constants/zIndex'

// ============================================================================
// Animation Config
// ============================================================================

const springConfig = { stiffness: 300, damping: 30 }
const ANIMATION_DURATION_MS = 400 // Approximate spring duration

// ============================================================================
// Content Banner Slot
// ============================================================================

interface ContentBannerSlotProps {
  className?: string
}

/**
 * ContentBannerSlot - Renders the full banner in document flow.
 * When active, the banner is visible and takes up space in the layout.
 * During transitions, a temporary overlay animates while this slot is hidden.
 */
export function ContentBannerSlot({ className }: ContentBannerSlotProps) {
  const {
    registerContentSlot,
    unregisterContentSlot,
    setContentBounds,
    activeSlot,
    sessionMode,
    isLoading,
    activeSession,
    onAction,
    onResume,
    onStartFresh,
  } = useSessionModeBanner()

  const slotRef = useRef<HTMLDivElement>(null)

  // Register on mount
  useEffect(() => {
    registerContentSlot()
    return () => unregisterContentSlot()
  }, [registerContentSlot, unregisterContentSlot])

  const isActive = activeSlot === 'content'
  const hasContent = sessionMode || activeSession

  // Report bounds to context for animation calculations
  useEffect(() => {
    if (!slotRef.current) return

    const updateBounds = () => {
      if (slotRef.current) {
        const rect = slotRef.current.getBoundingClientRect()
        setContentBounds({
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
        })
      }
    }

    updateBounds()
    window.addEventListener('resize', updateBounds)
    window.addEventListener('scroll', updateBounds)

    return () => {
      window.removeEventListener('resize', updateBounds)
      window.removeEventListener('scroll', updateBounds)
      setContentBounds(null)
    }
  }, [setContentBounds])

  if (!hasContent) {
    return null
  }

  // Render banner content
  const bannerContent = activeSession ? (
    <ActiveSessionBanner
      session={activeSession}
      onResume={onResume}
      onStartFresh={onStartFresh}
      variant="dashboard"
    />
  ) : sessionMode ? (
    <SessionModeBanner
      sessionMode={sessionMode}
      onAction={onAction}
      isLoading={isLoading}
      variant="dashboard"
    />
  ) : null

  return (
    <div ref={slotRef} data-slot="content-banner" data-active={isActive} className={className}>
      {/* Only render content when this slot is active */}
      {isActive && bannerContent}
    </div>
  )
}

// ============================================================================
// Nav Banner Slot
// ============================================================================

interface NavBannerSlotProps {
  className?: string
}

/**
 * NavBannerSlot - Renders the compact banner in document flow.
 */
export function NavBannerSlot({ className }: NavBannerSlotProps) {
  const context = useSessionModeBannerOptional()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const slotRef = useRef<HTMLDivElement>(null)

  // Register on mount
  useEffect(() => {
    if (context) {
      context.registerNavSlot()
      return () => context.unregisterNavSlot()
    }
  }, [context])

  // Report bounds to context
  useEffect(() => {
    if (!slotRef.current || !context) return

    const updateBounds = () => {
      if (slotRef.current) {
        const rect = slotRef.current.getBoundingClientRect()
        context.setNavBounds({
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
        })
      }
    }

    updateBounds()
    window.addEventListener('resize', updateBounds)
    window.addEventListener('scroll', updateBounds)

    return () => {
      window.removeEventListener('resize', updateBounds)
      window.removeEventListener('scroll', updateBounds)
      context.setNavBounds(null)
    }
  }, [context])

  if (!context) {
    return null
  }

  const { activeSlot, sessionMode, isLoading, activeSession, onAction, onResume, onStartFresh } =
    context

  const isActive = activeSlot === 'nav'
  const hasContent = sessionMode || activeSession

  if (!hasContent) {
    return null
  }

  // Render banner content
  const bannerContent = activeSession ? (
    <ActiveSessionBanner
      session={activeSession}
      onResume={onResume}
      onStartFresh={onStartFresh}
      variant="nav"
    />
  ) : sessionMode ? (
    <CompactBanner
      sessionMode={sessionMode}
      onAction={onAction}
      isLoading={isLoading}
      isDark={isDark}
    />
  ) : null

  return (
    <div ref={slotRef} data-slot="nav-banner" data-active={isActive} className={className}>
      {/* Only render content when this slot is active */}
      {isActive && bannerContent}
    </div>
  )
}

// ============================================================================
// Projecting Banner Manager (FLIP Animation Orchestrator)
// ============================================================================

/**
 * ProjectingBanner - Manages the FLIP animation between slots.
 *
 * Normal state: The banner is in document flow in the active slot.
 * During transition: A temporary fixed overlay animates while slots are hidden.
 * After transition: The overlay is removed and the banner is back in document flow.
 */
export function ProjectingBanner() {
  const context = useSessionModeBannerOptional()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const [mounted, setMounted] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const [animationFrom, setAnimationFrom] = useState<SlotBounds | null>(null)
  const [animationTo, setAnimationTo] = useState<SlotBounds | null>(null)
  const [animatingSlot, setAnimatingSlot] = useState<'content' | 'nav'>('content')

  // Track previous slot for detecting transitions
  const previousSlotRef = useRef<'content' | 'nav' | 'hidden'>('hidden')
  const previousContentBoundsRef = useRef<SlotBounds | null>(null)
  const previousNavBoundsRef = useRef<SlotBounds | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Watch for slot changes and trigger animation
  useEffect(() => {
    if (!context || !mounted) return

    const { activeSlot, targetBounds, shouldAnimate } = context
    const prevSlot = previousSlotRef.current

    // Update cached bounds
    if (activeSlot === 'content' && targetBounds) {
      previousContentBoundsRef.current = targetBounds
    } else if (activeSlot === 'nav' && targetBounds) {
      previousNavBoundsRef.current = targetBounds
    }

    // Detect slot change
    if (prevSlot !== activeSlot && activeSlot !== 'hidden' && prevSlot !== 'hidden') {
      // Get the "from" bounds (where we're coming from)
      const fromBounds =
        prevSlot === 'content' ? previousContentBoundsRef.current : previousNavBoundsRef.current

      // Get the "to" bounds (where we're going)
      const toBounds = targetBounds

      if (fromBounds && toBounds && shouldAnimate) {
        // Start animation
        setAnimationFrom(fromBounds)
        setAnimationTo(toBounds)
        setAnimatingSlot(activeSlot as 'content' | 'nav')
        setIsAnimating(true)

        // End animation after spring settles
        setTimeout(() => {
          setIsAnimating(false)
          setAnimationFrom(null)
          setAnimationTo(null)
        }, ANIMATION_DURATION_MS)
      }
    }

    previousSlotRef.current = activeSlot
  }, [context, mounted])

  // Apply CSS to hide slots during animation
  useEffect(() => {
    if (isAnimating) {
      // Hide both slots during animation
      document
        .querySelectorAll('[data-slot="content-banner"], [data-slot="nav-banner"]')
        .forEach((el) => {
          ;(el as HTMLElement).style.visibility = 'hidden'
        })
    } else {
      // Show all slots after animation
      document
        .querySelectorAll('[data-slot="content-banner"], [data-slot="nav-banner"]')
        .forEach((el) => {
          ;(el as HTMLElement).style.visibility = ''
        })
    }
  }, [isAnimating])

  if (!context || !mounted || !isAnimating || !animationFrom || !animationTo) {
    return null
  }

  const { sessionMode, isLoading, activeSession, onAction, onResume, onStartFresh } = context

  // Render the appropriate banner for the destination slot
  const bannerContent =
    animatingSlot === 'content' ? (
      activeSession ? (
        <ActiveSessionBanner
          session={activeSession}
          onResume={onResume}
          onStartFresh={onStartFresh}
          variant="dashboard"
        />
      ) : sessionMode ? (
        <SessionModeBanner
          sessionMode={sessionMode}
          onAction={onAction}
          isLoading={isLoading}
          variant="dashboard"
        />
      ) : null
    ) : activeSession ? (
      <ActiveSessionBanner
        session={activeSession}
        onResume={onResume}
        onStartFresh={onStartFresh}
        variant="nav"
      />
    ) : sessionMode ? (
      <CompactBanner
        sessionMode={sessionMode}
        onAction={onAction}
        isLoading={isLoading}
        isDark={isDark}
      />
    ) : null

  return createPortal(
    <AnimatingOverlay from={animationFrom} to={animationTo}>
      {bannerContent}
    </AnimatingOverlay>,
    document.body
  )
}

// ============================================================================
// Animating Overlay (Temporary Fixed Position During FLIP)
// ============================================================================

interface AnimatingOverlayProps {
  from: SlotBounds
  to: SlotBounds
  children: React.ReactNode
}

function AnimatingOverlay({ from, to, children }: AnimatingOverlayProps) {
  const x = useSpring(from.x, springConfig)
  const y = useSpring(from.y, springConfig)
  const width = useSpring(from.width, springConfig)

  // Trigger animation to target on mount
  useEffect(() => {
    x.set(to.x)
    y.set(to.y)
    width.set(to.width)
  }, [to.x, to.y, to.width, x, y, width])

  return (
    <motion.div
      data-component="animating-overlay"
      style={{
        position: 'fixed',
        left: x,
        top: y,
        width: width,
        zIndex: Z_INDEX.SESSION_MODE_BANNER,
        pointerEvents: 'none', // Don't capture clicks during animation
      }}
    >
      {children}
    </motion.div>
  )
}

// ============================================================================
// Re-exports for backward compatibility
// ============================================================================

export { ContentBannerSlot as ContentSlot }
export { NavBannerSlot as NavSlot }
