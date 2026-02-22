'use client'

import { useEffect, useState } from 'react'
import { css, cx } from '../../../../styled-system/css'

type LetterState = 'upcoming' | 'current' | 'correct' | 'wrong'

interface LetterDisplayProps {
  letter: string
  state: LetterState
}

export function LetterDisplay({ letter, state }: LetterDisplayProps) {
  const [shaking, setShaking] = useState(false)

  useEffect(() => {
    if (state === 'wrong') {
      setShaking(true)
      const timer = setTimeout(() => setShaking(false), 300)
      return () => clearTimeout(timer)
    }
  }, [state])

  return (
    <span
      data-component="LetterDisplay"
      data-state={state}
      className={cx(
        css({
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '56px',
          height: '64px',
          fontSize: '36px',
          fontWeight: 'bold',
          fontFamily: 'monospace',
          borderRadius: 'xl',
          transition: 'all 0.15s ease',
          textTransform: 'uppercase',
          userSelect: 'none',
          flexShrink: 0,
        }),
        state === 'upcoming' &&
          css({
            color: 'gray.300',
            bg: 'gray.50',
            border: '2px solid',
            borderColor: 'gray.200',
          }),
        state === 'current' &&
          css({
            color: 'blue.700',
            bg: 'blue.50',
            border: '3px solid',
            borderColor: 'blue.400',
            transform: 'scale(1.1)',
            boxShadow: '0 0 12px rgba(59, 130, 246, 0.3)',
            animation: 'pulse 1.5s ease-in-out infinite',
          }),
        state === 'correct' &&
          css({
            color: 'green.700',
            bg: 'green.100',
            border: '2px solid',
            borderColor: 'green.400',
          }),
        state === 'wrong' &&
          css({
            color: 'red.600',
            bg: 'red.50',
            border: '3px solid',
            borderColor: 'red.400',
          }),
        shaking &&
          css({
            animation: 'shake 0.3s ease-in-out',
          })
      )}
    >
      {letter}
    </span>
  )
}
