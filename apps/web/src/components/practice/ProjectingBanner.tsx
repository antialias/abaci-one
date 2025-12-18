'use client'

import { animated, useSpring } from '@react-spring/web'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { type Bounds, useSessionModeBanner } from '@/contexts/SessionModeBannerContext'
import { useTheme } from '@/contexts/ThemeContext'
import { Z_INDEX } from '@/constants/zIndex'
import { SessionModeBanner } from './SessionModeBanner'
import { CompactBanner } from './CompactBanner'

// ============================================================================
// Types
// ============================================================================

interface ProjectingBannerProps {
  /** Whether loading state is active */
  isLoading?: boolean
}

// ============================================================================
// Helper to get target bounds based on active slot
// ============================================================================

function getTargetBounds(
  activeSlot: 'content' | 'nav' | 'hidden',
  contentBounds: Bounds | null,
  navBounds: Bounds | null
): Bounds | null {
  switch (activeSlot) {
    case 'content':
      return contentBounds
    case 'nav':
      return navBounds
    case 'hidden':
      return null
  }
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * ProjectingBanner - Animated banner that morphs between content and nav slots
 *
 * This component renders via portal and animates between positions when the
 * active slot changes. It shows the full SessionModeBanner in content slot
 * and CompactBanner in nav slot.
 */
export function ProjectingBanner({ isLoading = false }: ProjectingBannerProps) {
  const {
    activeSlot,
    contentBounds,
    navBounds,
    sessionMode,
    isLoading: isLoadingSessionMode,
    onAction,
    isInitialRender,
    previousSlot,
  } = useSessionModeBanner()

  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  // Track if we've rendered before (to skip initial animation)
  const hasRenderedRef = useRef(false)
  const [hasRendered, setHasRendered] = useState(false)

  // Cache the last known valid bounds for each slot
  // This is crucial because when a slot unmounts, its bounds become null
  // but we need the old bounds to animate FROM
  const lastContentBoundsRef = useRef<Bounds | null>(null)
  const lastNavBoundsRef = useRef<Bounds | null>(null)

  // Update cached bounds when we get valid ones
  useEffect(() => {
    if (contentBounds) {
      lastContentBoundsRef.current = contentBounds
    }
  }, [contentBounds])

  useEffect(() => {
    if (navBounds) {
      lastNavBoundsRef.current = navBounds
    }
  }, [navBounds])

  useEffect(() => {
    if (!hasRenderedRef.current) {
      hasRenderedRef.current = true
      // Small delay to ensure we skip initial animation
      const timer = setTimeout(() => setHasRendered(true), 50)
      return () => clearTimeout(timer)
    }
  }, [])

  // Get current target bounds - prefer live bounds, fall back to cached
  const liveTargetBounds = getTargetBounds(activeSlot, contentBounds, navBounds)
  const cachedTargetBounds = getTargetBounds(
    activeSlot,
    lastContentBoundsRef.current,
    lastNavBoundsRef.current
  )
  const targetBounds = liveTargetBounds ?? cachedTargetBounds

  // Get previous bounds for animation start position
  // Use cached bounds since the previous slot may have unmounted
  const previousBounds = previousSlot
    ? getTargetBounds(previousSlot, lastContentBoundsRef.current, lastNavBoundsRef.current)
    : null

  // Determine if we should animate
  const shouldAnimate = hasRendered && !isInitialRender && previousBounds !== null

  // Spring animation for position and size
  const springProps = useSpring({
    x: targetBounds?.x ?? 0,
    y: targetBounds?.y ?? 0,
    width: targetBounds?.width ?? 0,
    height: targetBounds?.height ?? 0,
    opacity: activeSlot === 'hidden' || !sessionMode ? 0 : 1,
    // Animate smoothly when we have valid previous bounds
    immediate: !shouldAnimate,
    config: { tension: 170, friction: 26 }, // Slower, smoother animation
  })

  // Track slot change for content transition
  const [displaySlot, setDisplaySlot] = useState(activeSlot)
  const [isTransitioning, setIsTransitioning] = useState(false)

  useEffect(() => {
    if (activeSlot !== displaySlot) {
      setIsTransitioning(true)
      // Delay content change to middle of animation (match spring timing)
      const timer = setTimeout(() => {
        setDisplaySlot(activeSlot)
        setIsTransitioning(false)
      }, 200) // Slightly longer for smoother spring
      return () => clearTimeout(timer)
    }
  }, [activeSlot, displaySlot])

  // Don't render if no session mode or hidden
  if (!sessionMode || activeSlot === 'hidden') {
    return null
  }

  // Don't render until we have valid bounds
  if (!targetBounds) {
    return null
  }

  // Render content based on display slot (with transition delay)
  const renderContent = () => {
    if (displaySlot === 'content') {
      return (
        <SessionModeBanner
          sessionMode={sessionMode}
          onAction={onAction}
          isLoading={isLoading || isLoadingSessionMode}
          variant="dashboard"
        />
      )
    }
    return (
      <CompactBanner
        sessionMode={sessionMode}
        onAction={onAction}
        isLoading={isLoading || isLoadingSessionMode}
        isDark={isDark}
      />
    )
  }

  // Portal to body for fixed positioning
  return createPortal(
    <animated.div
      data-component="projecting-banner"
      data-slot={activeSlot}
      data-transitioning={isTransitioning || undefined}
      style={{
        position: 'fixed',
        left: springProps.x,
        top: springProps.y,
        width: springProps.width,
        // Don't animate height to avoid content squishing
        minHeight: springProps.height,
        opacity: springProps.opacity,
        zIndex: Z_INDEX.SESSION_MODE_BANNER ?? 95,
        pointerEvents: 'auto',
        overflow: 'hidden',
      }}
    >
      {renderContent()}
    </animated.div>,
    document.body
  )
}

export default ProjectingBanner
