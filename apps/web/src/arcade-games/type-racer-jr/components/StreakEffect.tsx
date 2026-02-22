'use client'

import type { ReactNode } from 'react'
import { useEffect, useRef } from 'react'
import confetti from 'canvas-confetti'
import { css } from '../../../../styled-system/css'

interface StreakEffectProps {
  streak: number
  children: ReactNode
}

const GOLD_COLORS = ['#FFD700', '#FFA500', '#FF8C00', '#FFB347']

/** Escalating visual wrapper based on consecutive clean word streak. */
export function StreakEffect({ streak, children }: StreakEffectProps) {
  const prevStreakRef = useRef(0)

  // Fire confetti only on tier transitions
  useEffect(() => {
    const prev = prevStreakRef.current
    prevStreakRef.current = streak

    // Entering tier 2 (streak === 2)
    if (streak >= 2 && prev < 2) {
      confetti({
        particleCount: 15,
        spread: 50,
        origin: { x: 0.5, y: 0.6 },
        colors: GOLD_COLORS,
        zIndex: 10000,
        ticks: 40,
      })
    }

    // Entering tier 3+ (streak === 3)
    if (streak >= 3 && prev < 3) {
      confetti({
        particleCount: 30,
        spread: 70,
        origin: { x: 0.5, y: 0.5 },
        colors: GOLD_COLORS,
        zIndex: 10000,
        ticks: 60,
        startVelocity: 25,
      })
    }
  }, [streak])

  const tier = streak >= 3 ? 'fire' : streak >= 2 ? 'hot' : streak >= 1 ? 'warm' : 'none'

  return (
    <div
      data-component="StreakEffect"
      data-tier={tier}
      className={css({
        position: 'relative',
        transition: 'box-shadow 0.4s ease, transform 0.3s ease',
        borderRadius: 'xl',
        ...(tier === 'warm' && {
          boxShadow: '0 0 20px rgba(255, 200, 50, 0.3)',
        }),
        ...(tier === 'hot' && {
          boxShadow: '0 0 30px rgba(255, 200, 50, 0.5)',
        }),
        ...(tier === 'fire' && {
          boxShadow: '0 0 40px rgba(255, 200, 50, 0.6), 0 0 80px rgba(255, 165, 0, 0.2)',
          animation: 'pulse 1.5s ease-in-out infinite',
        }),
      })}
    >
      {children}
    </div>
  )
}
