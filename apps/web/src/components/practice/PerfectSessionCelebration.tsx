'use client'

import { useEffect, useRef } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import { fireConfettiCelebration } from '@/utils/confetti'
import { css } from '../../../styled-system/css'

interface PerfectSessionCelebrationProps {
  studentName: string
}

/**
 * PerfectSessionCelebration - Fires confetti when a student completes
 * a session with all problems eventually correct (including retries).
 *
 * Used on the session summary page, NOT for skill progression.
 */
export function PerfectSessionCelebration({ studentName }: PerfectSessionCelebrationProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const confettiFiredRef = useRef(false)

  useEffect(() => {
    if (!confettiFiredRef.current) {
      confettiFiredRef.current = true
      fireConfettiCelebration()
    }
  }, [])

  return (
    <div
      data-component="perfect-session-celebration"
      className={css({
        textAlign: 'center',
        padding: '1.5rem',
        borderRadius: '16px',
        border: '2px solid',
        borderColor: isDark ? 'yellow.600' : 'yellow.300',
      })}
      style={{
        background: isDark
          ? 'linear-gradient(135deg, rgba(234, 179, 8, 0.15) 0%, rgba(251, 191, 36, 0.1) 100%)'
          : 'linear-gradient(135deg, rgba(234, 179, 8, 0.08) 0%, rgba(251, 191, 36, 0.05) 100%)',
      }}
    >
      <div
        className={css({
          fontSize: '4rem',
          marginBottom: '0.5rem',
        })}
      >
        🌟
      </div>
      <h1
        className={css({
          fontSize: '1.5rem',
          fontWeight: 'bold',
          color: isDark ? 'gray.100' : 'gray.800',
          marginBottom: '0.25rem',
        })}
      >
        Perfect Session, {studentName}!
      </h1>
      <p
        className={css({
          fontSize: '1rem',
          color: isDark ? 'gray.400' : 'gray.600',
        })}
      >
        Every problem answered correctly!
      </p>
    </div>
  )
}
