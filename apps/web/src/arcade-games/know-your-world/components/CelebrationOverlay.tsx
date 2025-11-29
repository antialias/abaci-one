/**
 * Celebration Overlay Component
 *
 * Orchestrates the celebration sequence when a region is found:
 * - Plays sound effect
 * - Shows confetti
 * - Shows encouraging text (for hard-earned)
 * - Notifies when complete to advance game
 */

'use client'

import { css } from '@styled/css'
import { useEffect, useState, useCallback } from 'react'
import type { CelebrationState } from '../Provider'
import { ConfettiBurst } from './Confetti'
import { useCelebrationSound } from '../hooks/useCelebrationSound'
import { CELEBRATION_TIMING } from '../utils/celebration'

interface CelebrationOverlayProps {
  celebration: CelebrationState
  regionCenter: { x: number; y: number }
  onComplete: () => void
  reducedMotion?: boolean
}

// Encouraging messages for hard-earned finds
const HARD_EARNED_MESSAGES = [
  'You found it!',
  'Great perseverance!',
  'Never gave up!',
  'You did it!',
  'Amazing effort!',
]

export function CelebrationOverlay({
  celebration,
  regionCenter,
  onComplete,
  reducedMotion = false,
}: CelebrationOverlayProps) {
  const [confettiComplete, setConfettiComplete] = useState(false)
  const { playCelebration } = useCelebrationSound()
  const timing = CELEBRATION_TIMING[celebration.type]

  // Pick a random message for hard-earned
  const [message] = useState(
    () => HARD_EARNED_MESSAGES[Math.floor(Math.random() * HARD_EARNED_MESSAGES.length)]
  )

  // Play sound on mount
  useEffect(() => {
    playCelebration(celebration.type)
  }, [playCelebration, celebration.type])

  // Handle confetti completion
  const handleConfettiComplete = useCallback(() => {
    setConfettiComplete(true)
    onComplete()
  }, [onComplete])

  // For reduced motion, just show a brief message then complete
  useEffect(() => {
    if (reducedMotion) {
      const timer = setTimeout(() => {
        onComplete()
      }, 500) // Brief delay for reduced motion
      return () => clearTimeout(timer)
    }
  }, [reducedMotion, onComplete])

  // Reduced motion: simple notification only
  if (reducedMotion) {
    return (
      <div
        data-component="celebration-overlay-reduced"
        className={css({
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 10000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        })}
      >
        <div
          className={css({
            bg: 'rgba(34, 197, 94, 0.9)',
            color: 'white',
            px: 6,
            py: 3,
            borderRadius: 'xl',
            fontSize: 'xl',
            fontWeight: 'bold',
            boxShadow: 'lg',
          })}
        >
          Found!
        </div>
      </div>
    )
  }

  return (
    <div
      data-component="celebration-overlay"
      className={css({
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 10000,
      })}
    >
      <style>
        {`
          @keyframes textAppear {
            0% {
              opacity: 0;
              transform: translate(-50%, -50%) scale(0.5);
            }
            20% {
              opacity: 1;
              transform: translate(-50%, -50%) scale(1.1);
            }
            30% {
              transform: translate(-50%, -50%) scale(1);
            }
            80% {
              opacity: 1;
            }
            100% {
              opacity: 0;
              transform: translate(-50%, -50%) scale(0.9);
            }
          }
        `}
      </style>

      {/* Confetti burst from region center */}
      {!confettiComplete && (
        <ConfettiBurst
          type={celebration.type}
          origin={regionCenter}
          onComplete={handleConfettiComplete}
        />
      )}

      {/* Encouraging text for hard-earned finds */}
      {celebration.type === 'hard-earned' && (
        <div
          className={css({
            position: 'absolute',
            left: '50%',
            top: '40%',
            transform: 'translate(-50%, -50%)',
            fontSize: '2xl',
            fontWeight: 'bold',
            color: 'white',
            textShadow: '0 2px 8px rgba(0,0,0,0.5), 0 0 20px rgba(251, 191, 36, 0.5)',
            whiteSpace: 'nowrap',
          })}
          style={{
            animation: `textAppear ${timing.totalDuration}ms ease-out forwards`,
          }}
        >
          {message}
        </div>
      )}
    </div>
  )
}
