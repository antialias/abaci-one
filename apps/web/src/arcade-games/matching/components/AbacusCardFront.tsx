'use client'

import { AbacusReact, useAbacusConfig } from '@soroban/abacus-react'
import { css } from '../../../../styled-system/css'
import type { AbacusCard } from '../types'

/**
 * Card front rendering for the abacus matching game variant.
 * Named component (not inline arrow) so hooks can be used inside.
 */
export function AbacusCardFront({ card }: { card: AbacusCard }) {
  const appConfig = useAbacusConfig()

  if (card.type === 'abacus') {
    return (
      <div
        className={css({
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          '& svg': {
            maxWidth: '100%',
            maxHeight: '100%',
          },
        })}
      >
        <AbacusReact
          value={card.number}
          columns="auto"
          beadShape={appConfig.beadShape}
          colorScheme={appConfig.colorScheme}
          hideInactiveBeads={appConfig.hideInactiveBeads}
          scaleFactor={0.8}
          interactive={false}
          showNumbers={false}
          animated={false}
        />
      </div>
    )
  }

  if (card.type === 'number') {
    return (
      <div
        className={css({
          fontSize: '32px',
          fontWeight: 'bold',
          color: 'gray.800',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        })}
      >
        {card.number}
      </div>
    )
  }

  if (card.type === 'complement') {
    return (
      <div
        className={css({
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '4px',
        })}
      >
        <div
          className={css({
            fontSize: '28px',
            fontWeight: 'bold',
            color: 'gray.800',
          })}
        >
          {card.number}
        </div>
        <div
          className={css({
            fontSize: '16px',
            color: 'gray.600',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          })}
        >
          <span>{card.targetSum === 5 ? '✋' : '🔟'}</span>
          <span>Friends</span>
        </div>
        {card.complement !== undefined && (
          <div
            className={css({
              fontSize: '12px',
              color: 'gray.500',
            })}
          >
            + {card.complement} = {card.targetSum}
          </div>
        )}
      </div>
    )
  }

  // Fallback for unknown card types
  return (
    <div
      className={css({
        fontSize: '24px',
        color: 'gray.500',
      })}
    >
      ?
    </div>
  )
}
