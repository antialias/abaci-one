'use client'

import { useMemo } from 'react'
import { css } from '../../../styled-system/css'
import { AnimatedProblemTile } from './AnimatedProblemTile'
import type { GeneratedExample } from '@/lib/flowcharts/loader'
import type { ExecutableFlowchart } from '@/lib/flowcharts/schema'

export interface AnimatedBackgroundTilesProps {
  /** Generated examples to display (will cycle/repeat to fill grid) */
  examples: GeneratedExample[]
  /** The flowchart (needed for formatting) */
  flowchart: ExecutableFlowchart
}

/**
 * Grid of animated problem tiles that serve as a decorative background.
 * Tiles repeat to fill the container with a subtle rotation for visual interest.
 */
export function AnimatedBackgroundTiles({ examples, flowchart }: AnimatedBackgroundTilesProps) {
  // Calculate how many tiles we need to fill the background
  // Target around 60 tiles for good coverage without too much overhead
  const tiles = useMemo(() => {
    if (examples.length === 0) return []

    const tileCount = 60
    const result: Array<{ example: GeneratedExample; key: string }> = []

    for (let i = 0; i < tileCount; i++) {
      const example = examples[i % examples.length]
      result.push({
        example,
        key: `tile-${i}`,
      })
    }

    return result
  }, [examples])

  if (tiles.length === 0) return null

  return (
    <div
      data-component="animated-background-tiles"
      className={css({
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        opacity: 0.15,
        pointerEvents: 'none',
        zIndex: 0,
      })}
      aria-hidden="true"
    >
      <div
        className={css({
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, 100px)',
          gap: '2',
          transform: 'rotate(-5deg)',
          transformOrigin: 'center center',
          width: '120%',
          height: '120%',
          marginLeft: '-10%',
          marginTop: '-10%',
        })}
      >
        {tiles.map((tile, i) => (
          <AnimatedProblemTile
            key={tile.key}
            example={tile.example}
            flowchart={flowchart}
            index={i}
          />
        ))}
      </div>
    </div>
  )
}
