'use client'

import { useEffect } from 'react'
import { css } from '../../../../styled-system/css'

interface CelebrationBurstProps {
  stars: number
  onDone: () => void
}

const CELEBRATION_DURATION = 1500

const MESSAGES = ['Nice!', 'Great!', 'Perfect!']

/**
 * Brief celebration overlay between words.
 * Shows stars and an encouraging message for 1.5s.
 */
export function CelebrationBurst({ stars, onDone }: CelebrationBurstProps) {
  useEffect(() => {
    const timer = setTimeout(onDone, CELEBRATION_DURATION)
    return () => clearTimeout(timer)
  }, [onDone])

  const message = stars >= 3 ? MESSAGES[2] : stars >= 2 ? MESSAGES[1] : MESSAGES[0]

  return (
    <div
      data-component="CelebrationBurst"
      className={css({
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        bg: 'rgba(255, 255, 255, 0.92)',
        zIndex: 10,
        animation: 'fadeIn 0.2s ease-out',
      })}
    >
      <div
        className={css({
          fontSize: '48px',
          mb: '3',
          animation: 'bounceIn 0.4s ease-out',
        })}
      >
        {'⭐'.repeat(stars)}
      </div>
      <div
        className={css({
          fontSize: '2xl',
          fontWeight: 'bold',
          color: 'orange.600',
          animation: 'fadeInScale 0.3s ease-out 0.1s both',
        })}
      >
        {message}
      </div>
    </div>
  )
}
