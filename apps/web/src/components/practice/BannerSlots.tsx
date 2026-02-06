'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, useSpring } from 'framer-motion'
import useMeasure from 'react-use-measure'
import { useTheme } from '@/contexts/ThemeContext'
import {
  useSessionModeBanner,
  useSessionModeBannerOptional,
  type SlotBounds,
  type SlotDimensions,
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
  /**
   * Height of sticky elements above the content area (e.g., nav bar).
   * When the banner scrolls under this offset, it projects to the nav slot.
   * Default: 0 (no sticky offset)
   */
  stickyOffset?: number
}

/**
 * ContentBannerSlot - Renders the full banner in document flow.
 * When active, the banner is visible and takes up space in the layout.
 * During transitions, a temporary overlay animates while this slot is hidden.
 * Uses IntersectionObserver to detect when scrolled under sticky nav.
 */
export function ContentBannerSlot({ className, stickyOffset = 0 }: ContentBannerSlotProps) {
  const {
    registerContentSlot,
    unregisterContentSlot,
    setContentBounds,
    setContentDimensions,
    setContentSlotVisible,
    activeSlot,
    sessionMode,
    isLoading,
    activeSession,
    onAction,
    onDefer,
    onResume,
    onStartFresh,
  } = useSessionModeBanner()

  const slotRef = useRef<HTMLDivElement>(null)

  // Measure the banner content dimensions
  const [measureRef, { width: measuredWidth, height: measuredHeight }] = useMeasure()

  // Report dimensions to context when they change
  useEffect(() => {
    if (measuredWidth > 0 && measuredHeight > 0) {
      setContentDimensions({ width: measuredWidth, height: measuredHeight })
    }
    return () => setContentDimensions(null)
  }, [measuredWidth, measuredHeight, setContentDimensions])

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

  // Use IntersectionObserver to detect when banner scrolls under sticky nav
  useEffect(() => {
    if (!slotRef.current) return

    // rootMargin: negative top margin accounts for sticky nav height
    // When top of element is at/above the sticky nav bottom, it's "not visible"
    const rootMargin = `-${stickyOffset}px 0px 0px 0px`

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          // isIntersecting = true when any part of the element is visible below the sticky nav
          setContentSlotVisible(entry.isIntersecting)
        }
      },
      {
        rootMargin,
        threshold: 0, // Trigger as soon as any part enters/exits
      }
    )

    observer.observe(slotRef.current)

    return () => {
      observer.disconnect()
      // Reset visibility when unmounting
      setContentSlotVisible(true)
    }
  }, [stickyOffset, setContentSlotVisible])

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
      onDefer={onDefer}
      isLoading={isLoading}
      variant="dashboard"
    />
  ) : null

  return (
    <div
      ref={slotRef}
      data-slot="content-banner"
      data-active={isActive}
      className={className}
      style={{
        // When projecting to nav, hide visually but preserve space
        visibility: isActive ? undefined : 'hidden',
        // Prevent interaction when hidden
        pointerEvents: isActive ? undefined : 'none',
      }}
    >
      {/* Wrapper for measurement - always render content to preserve space */}
      <div ref={measureRef}>{bannerContent}</div>
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
 * Always renders content for measurement, uses visibility to show/hide.
 */
export function NavBannerSlot({ className }: NavBannerSlotProps) {
  const context = useSessionModeBannerOptional()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const slotRef = useRef<HTMLDivElement>(null)

  // Extract stable callbacks from context to avoid dependency on entire context object
  const setNavDimensions = context?.setNavDimensions
  const setNavBounds = context?.setNavBounds
  const registerNavSlot = context?.registerNavSlot
  const unregisterNavSlot = context?.unregisterNavSlot

  // Measure the banner content dimensions
  const [measureRef, { width: measuredWidth, height: measuredHeight }] = useMeasure()

  // Report dimensions to context when they change
  useEffect(() => {
    if (!setNavDimensions) return
    if (measuredWidth > 0 && measuredHeight > 0) {
      setNavDimensions({ width: measuredWidth, height: measuredHeight })
    }
    return () => setNavDimensions(null)
  }, [setNavDimensions, measuredWidth, measuredHeight])

  // Register on mount
  useEffect(() => {
    if (registerNavSlot && unregisterNavSlot) {
      registerNavSlot()
      return () => unregisterNavSlot()
    }
  }, [registerNavSlot, unregisterNavSlot])

  // Report bounds to context
  useEffect(() => {
    if (!slotRef.current || !setNavBounds) return

    const updateBounds = () => {
      if (slotRef.current) {
        const rect = slotRef.current.getBoundingClientRect()
        setNavBounds({
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
      setNavBounds(null)
    }
  }, [setNavBounds])

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
    <div
      ref={slotRef}
      data-slot="nav-banner"
      data-active={isActive}
      className={className}
      style={{
        // When content slot is active, collapse this completely
        // We use a hidden measurement container instead
        height: isActive ? undefined : 0,
        overflow: isActive ? undefined : 'hidden',
        pointerEvents: isActive ? undefined : 'none',
      }}
    >
      {/* Wrapper for measurement - always render for dimension tracking */}
      <div
        ref={measureRef}
        style={{
          // When collapsed, make content invisible but still measurable
          visibility: isActive ? undefined : 'hidden',
        }}
      >
        {bannerContent}
      </div>
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
  const [animatingSlot, setAnimatingSlot] = useState<'content' | 'nav'>('content')
  const [fromDimensions, setFromDimensions] = useState<SlotDimensions | null>(null)
  const [toDimensions, setToDimensions] = useState<SlotDimensions | null>(null)

  // Track previous slot for detecting transitions
  const previousSlotRef = useRef<'content' | 'nav' | 'hidden'>('hidden')

  useEffect(() => {
    setMounted(true)
  }, [])

  // Watch for slot changes and trigger animation
  useEffect(() => {
    if (!context || !mounted) return

    const { activeSlot, shouldAnimate, contentDimensions, navDimensions } = context
    const prevSlot = previousSlotRef.current

    // Detect slot change
    if (prevSlot !== activeSlot && activeSlot !== 'hidden' && prevSlot !== 'hidden') {
      // Get FRESH bounds directly from DOM to avoid stale state from React batching
      const fromSelector =
        prevSlot === 'content' ? '[data-slot="content-banner"]' : '[data-slot="nav-banner"]'

      const fromEl = document.querySelector(fromSelector)

      // Get dimensions for both slots
      const fromDims = prevSlot === 'content' ? contentDimensions : navDimensions
      const toDims = activeSlot === 'content' ? contentDimensions : navDimensions

      if (fromEl && shouldAnimate && fromDims && toDims) {
        const fromRect = fromEl.getBoundingClientRect()

        const fromBounds: SlotBounds = {
          x: fromRect.x,
          y: fromRect.y,
          width: fromRect.width,
          height: fromRect.height,
        }

        // Start animation - target bounds will be tracked dynamically
        setAnimationFrom(fromBounds)
        setFromDimensions(fromDims)
        setToDimensions(toDims)
        setAnimatingSlot(activeSlot as 'content' | 'nav')
        setIsAnimating(true)

        // End animation after spring settles
        setTimeout(() => {
          setIsAnimating(false)
          setAnimationFrom(null)
          setFromDimensions(null)
          setToDimensions(null)
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
      // After animation, reset the ACTIVE slot so it becomes visible.
      // The inactive content slot keeps React's visibility:hidden to preserve space.
      // The nav slot is always reset since it doesn't need to preserve space.
      document.querySelectorAll('[data-slot="nav-banner"]').forEach((el) => {
        ;(el as HTMLElement).style.visibility = ''
      })
      // If content is now active, reset its visibility too
      if (animatingSlot === 'content') {
        document.querySelectorAll('[data-slot="content-banner"]').forEach((el) => {
          ;(el as HTMLElement).style.visibility = ''
        })
      }
    }
  }, [isAnimating, animatingSlot])

  if (!context || !mounted || !isAnimating || !animationFrom || !fromDimensions || !toDimensions) {
    return null
  }

  const { sessionMode, isLoading, activeSession, onAction, onDefer, onResume, onStartFresh } = context

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

  const targetSelector =
    animatingSlot === 'content' ? '[data-slot="content-banner"]' : '[data-slot="nav-banner"]'

  return createPortal(
    <AnimatingOverlay
      from={animationFrom}
      fromDimensions={fromDimensions}
      toDimensions={toDimensions}
      targetSelector={targetSelector}
    >
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
  fromDimensions: SlotDimensions
  toDimensions: SlotDimensions
  targetSelector: string
  children: React.ReactNode
}

function AnimatingOverlay({
  from,
  fromDimensions,
  toDimensions,
  targetSelector,
  children,
}: AnimatingOverlayProps) {
  const x = useSpring(from.x, springConfig)
  const y = useSpring(from.y, springConfig)
  const width = useSpring(fromDimensions.width, springConfig)
  const height = useSpring(fromDimensions.height, springConfig)

  // Animate to target dimensions on mount
  useEffect(() => {
    width.set(toDimensions.width)
    height.set(toDimensions.height)
  }, [toDimensions.width, toDimensions.height, width, height])

  // Continuously track the target element's position during animation
  // This handles the case where user is still scrolling during the transition
  useEffect(() => {
    const updateTarget = () => {
      const targetEl = document.querySelector(targetSelector)
      if (targetEl) {
        const rect = targetEl.getBoundingClientRect()
        x.set(rect.x)
        y.set(rect.y)
      }
    }

    // Initial update
    updateTarget()

    // Track scroll and resize to follow moving target
    window.addEventListener('scroll', updateTarget, { passive: true })
    window.addEventListener('resize', updateTarget)

    return () => {
      window.removeEventListener('scroll', updateTarget)
      window.removeEventListener('resize', updateTarget)
    }
  }, [targetSelector, x, y])

  return (
    <motion.div
      data-component="animating-overlay"
      style={{
        position: 'fixed',
        left: x,
        top: y,
        width: width,
        height: height,
        overflow: 'hidden', // Clip content during size transition
        zIndex: Z_INDEX.SESSION_MODE_BANNER_ANIMATING,
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
