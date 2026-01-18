'use client'

import { useRef, useEffect, useState } from 'react'
import { css } from '../../../styled-system/css'
import { MathDisplay } from './MathDisplay'

interface AnimatedMathDisplayProps {
  /** Math expression string to render (e.g., "52 − 37" or "3 2/9 − 1 1/2") */
  expression: string
  /** Font size for the display */
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /** Animation duration in ms (default: 700 to match dice animation) */
  duration?: number
}

/**
 * AnimatedMathDisplay - MathML display with crossfade transitions
 *
 * When the expression changes, the old expression fades out while
 * the new expression fades in (inverse opacity). Uses CSS Grid to
 * stack layers independently.
 */
export function AnimatedMathDisplay({
  expression,
  size = 'lg',
  duration = 700,
}: AnimatedMathDisplayProps) {
  const prevExpressionRef = useRef<string>(expression)

  const [layers, setLayers] = useState<
    Array<{ expression: string; opacity: number; id: number }>
  >([{ expression, opacity: 1, id: 0 }])

  const idCounter = useRef(1)

  useEffect(() => {
    if (expression !== prevExpressionRef.current) {
      const oldExpression = prevExpressionRef.current
      prevExpressionRef.current = expression
      const newId = idCounter.current++

      // Add new layer at opacity 0, keep old layer at opacity 1
      setLayers([
        { expression: oldExpression, opacity: 1, id: newId - 1 },
        { expression, opacity: 0, id: newId },
      ])

      // After a frame, trigger the crossfade
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setLayers([
            { expression: oldExpression, opacity: 0, id: newId - 1 },
            { expression, opacity: 1, id: newId },
          ])
        })
      })

      // After animation, remove the old layer
      const timeout = setTimeout(() => {
        setLayers([{ expression, opacity: 1, id: newId }])
      }, duration + 50)

      return () => clearTimeout(timeout)
    }
  }, [expression, duration])

  return (
    <span
      data-testid="animated-math-display"
      data-expression={expression}
      className={css({
        display: 'inline-grid',
        placeItems: 'center',
      })}
    >
      {layers.map((layer) => (
        <span
          key={layer.id}
          style={{
            gridArea: '1 / 1',
            opacity: layer.opacity,
            transition: `opacity ${duration}ms ease-in-out`,
          }}
        >
          <MathDisplay expression={layer.expression} size={size} />
        </span>
      ))}
    </span>
  )
}
