'use client'

import { AbacusReact } from '@soroban/abacus-react'
import { css } from '../../../../styled-system/css'

interface AbacusScoreCounterProps {
  totalStars: number
  /** When true, applies a celebratory wiggle animation */
  celebrate?: boolean
}

/**
 * Tiny animated soroban that displays the cumulative star count.
 * Teaches place value as a side effect — ones and tens columns
 * are visually distinguished via the place-value color scheme.
 */
export function AbacusScoreCounter({ totalStars, celebrate }: AbacusScoreCounterProps) {
  return (
    <div
      data-component="AbacusScoreCounter"
      className={css({
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1',
        bg: 'rgba(255, 255, 255, 0.8)',
        borderRadius: 'lg',
        px: '2',
        py: '1',
        animation: celebrate ? 'shake 0.5s ease-in-out' : undefined,
        transition: 'transform 0.3s ease',
      })}
    >
      <AbacusReact
        value={Math.min(totalStars, 99)}
        columns={2}
        scaleFactor={0.6}
        compact
        animated
        interactive={false}
        showNumbers={false}
        hideInactiveBeads={false}
        colorScheme="place-value"
      />
      <span
        className={css({
          fontSize: 'xs',
          color: 'orange.600',
          fontWeight: 'semibold',
          lineHeight: 1,
        })}
      >
        ⭐ {totalStars}
      </span>
    </div>
  )
}
