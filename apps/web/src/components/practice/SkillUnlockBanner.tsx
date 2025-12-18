'use client'

import type { Shape } from 'canvas-confetti'
import confetti from 'canvas-confetti'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import { css } from '../../../styled-system/css'

const CELEBRATED_SKILLS_KEY = 'celebrated-skill-unlocks'

interface SkillUnlockBannerProps {
  skillId: string
  skillTitle: string
  studentId: string
  /** If true, show a "Start" button. If false, show a link to dashboard */
  showStartButton?: boolean
  /** Called when the start button is clicked */
  onStartPractice?: () => void
}

/**
 * Get the list of skill IDs that have already been celebrated
 */
function getCelebratedSkills(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(CELEBRATED_SKILLS_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

/**
 * Mark a skill as celebrated
 */
function markSkillCelebrated(skillId: string): void {
  if (typeof window === 'undefined') return
  try {
    const celebrated = getCelebratedSkills()
    if (!celebrated.includes(skillId)) {
      celebrated.push(skillId)
      localStorage.setItem(CELEBRATED_SKILLS_KEY, JSON.stringify(celebrated))
    }
  } catch {
    // Ignore localStorage errors
  }
}

/**
 * Fire a spectacular confetti celebration
 */
function fireConfettiCelebration(): void {
  const duration = 4000
  const animationEnd = Date.now() + duration
  const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 10000 }

  function randomInRange(min: number, max: number) {
    return Math.random() * (max - min) + min
  }

  // Multiple bursts of confetti
  const interval = setInterval(() => {
    const timeLeft = animationEnd - Date.now()

    if (timeLeft <= 0) {
      clearInterval(interval)
      return
    }

    const particleCount = 50 * (timeLeft / duration)

    // Confetti from left side
    confetti({
      ...defaults,
      particleCount,
      origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
      colors: ['#FFD700', '#FFA500', '#FF6347', '#FF1493', '#00CED1', '#32CD32'],
    })

    // Confetti from right side
    confetti({
      ...defaults,
      particleCount,
      origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
      colors: ['#FFD700', '#FFA500', '#FF6347', '#FF1493', '#00CED1', '#32CD32'],
    })
  }, 250)

  // Initial big burst from center
  confetti({
    particleCount: 100,
    spread: 70,
    origin: { x: 0.5, y: 0.5 },
    colors: ['#FFD700', '#FFA500', '#FF6347'],
    zIndex: 10000,
  })

  // Fireworks effect - shooting stars
  setTimeout(() => {
    confetti({
      particleCount: 50,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.8 },
      colors: ['#FFD700', '#FFFF00', '#FFA500'],
      zIndex: 10000,
    })
    confetti({
      particleCount: 50,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.8 },
      colors: ['#FFD700', '#FFFF00', '#FFA500'],
      zIndex: 10000,
    })
  }, 500)

  // More fireworks
  setTimeout(() => {
    confetti({
      particleCount: 80,
      angle: 90,
      spread: 100,
      origin: { x: 0.5, y: 0.9 },
      colors: ['#FF1493', '#FF69B4', '#FFB6C1', '#FF6347'],
      zIndex: 10000,
    })
  }, 1000)

  // Star burst finale
  setTimeout(() => {
    const shapes: Shape[] = ['star', 'circle']
    confetti({
      particleCount: 150,
      spread: 180,
      origin: { x: 0.5, y: 0.4 },
      colors: ['#FFD700', '#FFA500', '#FF6347', '#FF1493', '#00CED1', '#9370DB'],
      shapes,
      scalar: 1.2,
      zIndex: 10000,
    })
  }, 1500)
}

// CSS animation styles injected into head
const celebrationStyles = `
@keyframes skillUnlockPulseGlow {
  0%, 100% { box-shadow: 0 0 20px rgba(234, 179, 8, 0.4), 0 0 40px rgba(234, 179, 8, 0.2); }
  50% { box-shadow: 0 0 30px rgba(234, 179, 8, 0.6), 0 0 60px rgba(234, 179, 8, 0.3); }
}
@keyframes skillUnlockBounceIn {
  0% { opacity: 0; transform: scale(0.3) translateY(-50px); }
  50% { transform: scale(1.05) translateY(0); }
  70% { transform: scale(0.95); }
  100% { opacity: 1; transform: scale(1); }
}
@keyframes skillUnlockShimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
@keyframes skillUnlockWiggle {
  0%, 100% { transform: rotate(-3deg); }
  50% { transform: rotate(3deg); }
}
`

/**
 * SkillUnlockBanner - Shows a banner when a new skill is unlocked
 *
 * On first view of a skill unlock, fires a spectacular confetti celebration.
 * Subsequent views show the banner without the celebration.
 */
export function SkillUnlockBanner({
  skillId,
  skillTitle,
  studentId,
  showStartButton = true,
  onStartPractice,
}: SkillUnlockBannerProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const [isFirstView, setIsFirstView] = useState(false)
  const [showCelebration, setShowCelebration] = useState(false)
  const celebrationFiredRef = useRef(false)

  // Inject animation styles on first render
  useEffect(() => {
    const styleId = 'skill-unlock-animations'
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style')
      style.id = styleId
      style.textContent = celebrationStyles
      document.head.appendChild(style)
    }
  }, [])

  // Check if this is the first time seeing this skill unlock
  useEffect(() => {
    const celebrated = getCelebratedSkills()
    const isFirst = !celebrated.includes(skillId)
    setIsFirstView(isFirst)

    if (isFirst && !celebrationFiredRef.current) {
      celebrationFiredRef.current = true
      setShowCelebration(true)

      // Fire confetti after a short delay for the banner to appear
      const timer = setTimeout(() => {
        fireConfettiCelebration()
        markSkillCelebrated(skillId)
      }, 300)

      // End celebration mode after animations complete
      const endTimer = setTimeout(() => {
        setShowCelebration(false)
      }, 5000)

      return () => {
        clearTimeout(timer)
        clearTimeout(endTimer)
      }
    }
  }, [skillId])

  // Celebration mode - big, animated banner
  if (showCelebration) {
    return (
      <div
        data-section="skill-unlock-celebration"
        className={css({
          position: 'relative',
          padding: '1.5rem',
          marginBottom: '1rem',
          background: isDark
            ? 'linear-gradient(135deg, rgba(234, 179, 8, 0.25) 0%, rgba(251, 191, 36, 0.15) 50%, rgba(234, 179, 8, 0.25) 100%)'
            : 'linear-gradient(135deg, rgba(234, 179, 8, 0.2) 0%, rgba(251, 191, 36, 0.1) 50%, rgba(234, 179, 8, 0.2) 100%)',
          border: '3px solid',
          borderColor: isDark ? 'yellow.500' : 'yellow.400',
          borderRadius: '16px',
          textAlign: 'center',
          overflow: 'hidden',
        })}
        style={{
          animation:
            'skillUnlockBounceIn 0.6s ease-out, skillUnlockPulseGlow 2s ease-in-out infinite',
        }}
      >
        {/* Shimmer overlay */}
        <div
          className={css({
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background:
              'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.2) 50%, transparent 100%)',
            backgroundSize: '200% 100%',
            pointerEvents: 'none',
          })}
          style={{ animation: 'skillUnlockShimmer 2s linear infinite' }}
        />

        {/* Trophy/unlock icon with wiggle */}
        <div
          className={css({
            fontSize: '4rem',
            marginBottom: '0.5rem',
          })}
          style={{ animation: 'skillUnlockWiggle 0.5s ease-in-out infinite' }}
        >
          🏆
        </div>

        <h2
          className={css({
            fontSize: '1.75rem',
            fontWeight: 'bold',
            color: isDark ? 'yellow.200' : 'yellow.700',
            marginBottom: '0.5rem',
            textShadow: isDark ? '0 0 20px rgba(234, 179, 8, 0.5)' : 'none',
          })}
        >
          New Skill Unlocked!
        </h2>

        <p
          className={css({
            fontSize: '1.25rem',
            color: isDark ? 'gray.200' : 'gray.800',
            marginBottom: '1rem',
          })}
        >
          You&apos;re ready to learn{' '}
          <strong
            className={css({
              color: isDark ? 'yellow.300' : 'yellow.700',
            })}
          >
            {skillTitle}
          </strong>
        </p>

        <p
          className={css({
            fontSize: '1rem',
            color: isDark ? 'gray.400' : 'gray.600',
            marginBottom: '1.5rem',
          })}
        >
          Start your next practice session to begin the tutorial!
        </p>

        {showStartButton && onStartPractice ? (
          <button
            type="button"
            onClick={onStartPractice}
            className={css({
              padding: '0.75rem 2rem',
              fontSize: '1.125rem',
              fontWeight: 'bold',
              color: isDark ? 'gray.900' : 'white',
              background: isDark
                ? 'linear-gradient(135deg, #FCD34D 0%, #F59E0B 100%)'
                : 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
              borderRadius: '12px',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 4px 15px rgba(245, 158, 11, 0.4)',
              transition: 'transform 0.2s, box-shadow 0.2s',
              _hover: {
                transform: 'scale(1.05)',
                boxShadow: '0 6px 20px rgba(245, 158, 11, 0.5)',
              },
            })}
          >
            Start Learning!
          </button>
        ) : (
          <Link
            href={`/practice/${studentId}/dashboard`}
            className={css({
              display: 'inline-block',
              padding: '0.75rem 2rem',
              fontSize: '1.125rem',
              fontWeight: 'bold',
              color: isDark ? 'gray.900' : 'white',
              background: isDark
                ? 'linear-gradient(135deg, #FCD34D 0%, #F59E0B 100%)'
                : 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
              borderRadius: '12px',
              textDecoration: 'none',
              boxShadow: '0 4px 15px rgba(245, 158, 11, 0.4)',
              transition: 'transform 0.2s, box-shadow 0.2s',
              _hover: {
                transform: 'scale(1.05)',
                boxShadow: '0 6px 20px rgba(245, 158, 11, 0.5)',
              },
            })}
          >
            Go to Dashboard
          </Link>
        )}
      </div>
    )
  }

  // Normal mode - compact banner
  return (
    <div
      data-section="skill-unlock-banner"
      className={css({
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.75rem 1rem',
        marginBottom: '1rem',
        backgroundColor: isDark ? 'rgba(234, 179, 8, 0.15)' : 'rgba(234, 179, 8, 0.1)',
        border: '2px solid',
        borderColor: isDark ? 'yellow.600' : 'yellow.400',
        borderRadius: '12px',
      })}
    >
      <div
        className={css({
          fontSize: '1.5rem',
          flexShrink: 0,
        })}
      >
        🔓
      </div>
      <div className={css({ flex: 1 })}>
        <p
          className={css({
            fontSize: '0.9375rem',
            fontWeight: 'bold',
            color: isDark ? 'yellow.200' : 'yellow.800',
            marginBottom: '0.125rem',
          })}
        >
          New Skill Unlocked!
        </p>
        <p
          className={css({
            fontSize: '0.8125rem',
            color: isDark ? 'gray.300' : 'gray.700',
          })}
        >
          Ready to learn <strong>{skillTitle}</strong> — start practicing to begin the tutorial!
        </p>
      </div>
      {showStartButton && onStartPractice ? (
        <button
          type="button"
          onClick={onStartPractice}
          className={css({
            padding: '0.5rem 1rem',
            fontSize: '0.8125rem',
            fontWeight: 'bold',
            color: 'white',
            backgroundColor: isDark ? 'yellow.600' : 'yellow.500',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            _hover: {
              backgroundColor: isDark ? 'yellow.500' : 'yellow.600',
            },
          })}
        >
          Start
        </button>
      ) : (
        <Link
          href={`/practice/${studentId}/dashboard`}
          className={css({
            padding: '0.5rem 1rem',
            fontSize: '0.8125rem',
            fontWeight: 'bold',
            color: 'white',
            backgroundColor: isDark ? 'yellow.600' : 'yellow.500',
            borderRadius: '8px',
            textDecoration: 'none',
            whiteSpace: 'nowrap',
            _hover: {
              backgroundColor: isDark ? 'yellow.500' : 'yellow.600',
            },
          })}
        >
          Dashboard
        </Link>
      )}
    </div>
  )
}
