'use client'

import { useMemo } from 'react'
import { css } from '../../../styled-system/css'
import { MathDisplay } from './MathDisplay'
import { formatProblemDisplay } from '@/lib/flowcharts/formatting'
import type { GeneratedExample } from '@/lib/flowcharts/loader'
import type { ExecutableFlowchart } from '@/lib/flowcharts/schema'

export interface AnimatedProblemTileProps {
  /** The generated example */
  example: GeneratedExample
  /** The flowchart (needed for formatting) */
  flowchart: ExecutableFlowchart
  /** Tile index (unused, kept for API compatibility) */
  index: number
}

/**
 * Tile that displays a problem expression.
 * Renders math expressions using MathML via MathDisplay.
 */
export function AnimatedProblemTile({ example, flowchart }: AnimatedProblemTileProps) {
  // Format problem using the proper system
  const problemDisplay = useMemo(
    () => formatProblemDisplay(flowchart, example.values),
    [flowchart, example.values]
  )

  return (
    <div
      data-component="animated-problem-tile"
      className={css({
        width: '100px',
        height: '60px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 'sm',
        overflow: 'hidden',
        backgroundColor: { base: 'gray.100', _dark: 'gray.800' },
        padding: '1',
      })}
    >
      <MathDisplay expression={problemDisplay} size="sm" />
    </div>
  )
}
