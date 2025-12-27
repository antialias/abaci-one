'use client'

import { animated, useSpring } from '@react-spring/web'
import { useEffect, useRef, useState } from 'react'
import { Z_INDEX } from '@/constants/zIndex'
import { usePageTransition, type TransitionState } from '@/contexts/PageTransitionContext'
import { css } from '../../styled-system/css'

// ============================================================================
// Component
// ============================================================================

/**
 * Full-screen overlay for smooth page transitions.
 *
 * Animates from the QuickLook modal position to cover the full viewport,
 * then fades out to reveal the destination page.
 */
export function PageTransitionOverlay() {
  const { transitionState, isTransitioning, isRevealing } = usePageTransition()
  const [phase, setPhase] = useState<'idle' | 'expanding' | 'covering' | 'revealing'>('idle')

  // Track the animation state
  useEffect(() => {
    if (isTransitioning && transitionState) {
      // Determine which phase we're in based on where we are in the flow
      // If we just started (on source page), we're expanding
      // If we arrived on destination, we're revealing
      const age = Date.now() - transitionState.timestamp

      if (age < 300) {
        setPhase('expanding')
        // After expansion, switch to covering
        const remainingExpand = Math.max(0, 300 - age)
        setTimeout(() => setPhase('covering'), remainingExpand)
      } else if (age < 1500) {
        // We're on the destination page, covering until ready
        setPhase('covering')
      } else {
        // Stale - should reveal
        setPhase('revealing')
      }
    } else {
      setPhase('idle')
    }
  }, [isTransitioning, transitionState])

  // When context signals revealing, sync our phase
  useEffect(() => {
    if (isRevealing && phase === 'covering') {
      console.log('[PageTransitionOverlay] Context signaled revealing, switching to reveal phase')
      setPhase('revealing')
    }
  }, [isRevealing, phase])

  // Debug logging
  useEffect(() => {
    console.log('[PageTransitionOverlay] phase:', phase, 'isRevealing:', isRevealing, 'isTransitioning:', isTransitioning)
  }, [phase, isRevealing, isTransitioning])

  // When phase changes to revealing, start the fade out
  useEffect(() => {
    if (phase === 'revealing') {
      const timer = setTimeout(() => setPhase('idle'), 350)
      return () => clearTimeout(timer)
    }
  }, [phase])

  // Don't render if not transitioning
  if (!isTransitioning || !transitionState || phase === 'idle') {
    return null
  }

  return (
    <OverlayAnimation
      transitionState={transitionState}
      phase={phase}
    />
  )
}

// ============================================================================
// Animation Component
// ============================================================================

interface OverlayAnimationProps {
  transitionState: TransitionState
  phase: 'expanding' | 'covering' | 'revealing'
}

function OverlayAnimation({ transitionState, phase }: OverlayAnimationProps) {
  const { originBounds, studentEmoji, studentName, studentColor } = transitionState
  const isFirstRender = useRef(true)

  // Calculate target (full screen)
  const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 800
  const windowHeight = typeof window !== 'undefined' ? window.innerHeight : 600

  // Animation spring - position is immediate, opacity animates for cross-fade
  const spring = useSpring({
    // Position and size - start at origin, expand to full screen
    left: phase === 'expanding' ? originBounds.left : 0,
    top: phase === 'expanding' ? originBounds.top : 0,
    width: phase === 'expanding' ? originBounds.width : windowWidth,
    height: phase === 'expanding' ? originBounds.height : windowHeight,
    // Border radius (from modal rounded to full screen square)
    borderRadius: phase === 'expanding' ? 16 : 0,
    // Opacity - fade in on first render, fade out when revealing
    opacity: phase === 'revealing' ? 0 : 1,
    // Scale for subtle effect
    scale: phase === 'expanding' ? 1 : 1,
    // Start from opacity 0 for fade-in, position starts at origin
    from: {
      left: originBounds.left,
      top: originBounds.top,
      width: originBounds.width,
      height: originBounds.height,
      borderRadius: 16,
      opacity: 0,
      scale: 1,
    },
    // Position/size are immediate on first render, but opacity animates for cross-fade with modal
    immediate: (key) => isFirstRender.current && key !== 'opacity',
    config: phase === 'revealing'
      ? { tension: 200, friction: 26 } // Slower fade-out for smooth cross-fade
      : { tension: 300, friction: 20 }, // Quick fade-in for modal cross-fade
  })

  // Mark first render as complete
  useEffect(() => {
    isFirstRender.current = false
  }, [])

  // Avatar animation (grows and centers)
  const avatarSpring = useSpring({
    // Size grows as overlay expands
    size: phase === 'expanding' ? 48 : 80,
    // Opacity
    opacity: phase === 'revealing' ? 0 : 1,
    immediate: isFirstRender.current,
    config: { tension: 200, friction: 26 },
  })

  return (
    <animated.div
      data-component="page-transition-overlay"
      style={{
        position: 'fixed',
        left: spring.left,
        top: spring.top,
        width: spring.width,
        height: spring.height,
        borderRadius: spring.borderRadius,
        opacity: spring.opacity,
        transform: spring.scale.to(s => `scale(${s})`),
        zIndex: Z_INDEX.MODAL + 100,
        backgroundColor: studentColor,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    >
      {/* Student emoji avatar */}
      <animated.div
        style={{
          width: avatarSpring.size,
          height: avatarSpring.size,
          opacity: avatarSpring.opacity,
          borderRadius: '50%',
          backgroundColor: 'rgba(255, 255, 255, 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: avatarSpring.size.to(s => `${s * 0.5}px`),
        }}
      >
        {studentEmoji}
      </animated.div>

      {/* Student name */}
      <animated.div
        style={{
          opacity: avatarSpring.opacity,
          color: 'white',
          fontSize: 24,
          fontWeight: 600,
          textShadow: '0 2px 4px rgba(0,0,0,0.2)',
        }}
      >
        {studentName}
      </animated.div>

      {/* Loading indicator (shows after a delay) */}
      <LoadingIndicator phase={phase} />
    </animated.div>
  )
}

// ============================================================================
// Loading Indicator
// ============================================================================

function LoadingIndicator({ phase }: { phase: string }) {
  const [showLoading, setShowLoading] = useState(false)

  // Only show loading indicator if covering phase lasts > 800ms
  useEffect(() => {
    if (phase === 'covering') {
      const timer = setTimeout(() => setShowLoading(true), 800)
      return () => clearTimeout(timer)
    } else {
      setShowLoading(false)
    }
  }, [phase])

  if (!showLoading) return null

  return (
    <div
      className={css({
        display: 'flex',
        gap: '8px',
        opacity: 0.7,
      })}
    >
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={css({
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: 'white',
            animation: 'pulse 1s ease-in-out infinite',
            animationDelay: `${i * 0.15}s`,
          })}
        />
      ))}
    </div>
  )
}
