'use client'

import { animated, useSpring } from '@react-spring/web'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { type Bounds, useSessionModeBanner } from '@/contexts/SessionModeBannerContext'
import { useTheme } from '@/contexts/ThemeContext'
import { Z_INDEX } from '@/constants/zIndex'
import { MorphingBanner } from './MorphingBanner'
import { ActiveSessionBanner } from './ActiveSessionBanner'

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
    activeSession,
    onResume,
    onStartFresh,
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

  // Target progress: 0 = content (full), 1 = nav (compact)
  const targetProgress = activeSlot === 'nav' ? 1 : 0

  // Spring animation for position, size, AND morph progress
  const springProps = useSpring({
    x: targetBounds?.x ?? 0,
    y: targetBounds?.y ?? 0,
    width: targetBounds?.width ?? 0,
    height: targetBounds?.height ?? 0,
    opacity: activeSlot === 'hidden' || !sessionMode ? 0 : 1,
    progress: targetProgress,
    // Animate smoothly when we have valid previous bounds
    immediate: !shouldAnimate,
    config: { tension: 170, friction: 26 }, // Slower, smoother animation
  })

  // Don't render if hidden
  if (activeSlot === 'hidden') {
    return null
  }

  // Don't render if no session mode AND no active session
  if (!sessionMode && !activeSession) {
    return null
  }

  // Don't render until we have valid bounds
  if (!targetBounds) {
    return null
  }

  // Determine which banner to render
  // Active session takes priority over session mode
  const hasActiveSession = activeSession !== null

  // Portal to body for fixed positioning
  return createPortal(
    <animated.div
      data-component="projecting-banner"
      data-slot={activeSlot}
      data-has-active-session={hasActiveSession}
      style={{
        position: 'fixed',
        left: springProps.x,
        top: springProps.y,
        width: springProps.width,
        height: springProps.height,
        opacity: springProps.opacity,
        zIndex: Z_INDEX.SESSION_MODE_BANNER ?? 95,
        pointerEvents: 'auto',
        overflow: 'hidden',
      }}
    >
      {hasActiveSession ? (
        <ActiveSessionBanner
          session={activeSession}
          onResume={onResume}
          onStartFresh={onStartFresh}
          isLoading={isLoading || isLoadingSessionMode}
          variant={activeSlot === 'nav' ? 'nav' : 'dashboard'}
        />
      ) : sessionMode ? (
        <MorphingBanner
          sessionMode={sessionMode}
          onAction={onAction}
          isLoading={isLoading || isLoadingSessionMode}
          isDark={isDark}
          progress={springProps.progress}
          containerWidth={springProps.width}
          containerHeight={springProps.height}
        />
      ) : null}
    </animated.div>,
    document.body
  )
}

export default ProjectingBanner
