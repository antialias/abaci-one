'use client'

/**
 * ProgressiveHighlightOverlay - SVG overlay showing completed problem boxes
 *
 * As the LLM streams parsing results, this component renders boxes
 * around each completed problem. New boxes appear with a pop-in animation.
 *
 * Uses normalized coordinates (0-1) and positions them relative to the
 * parent container.
 */

import { css } from '../../../styled-system/css'
import type { CompletedProblem } from '@/hooks/useWorksheetParsing'

export interface ProgressiveHighlightOverlayProps {
  /** Problems that have been completed (with bounding boxes) */
  completedProblems: CompletedProblem[]
  /** Animation delay per problem (staggered appearance) */
  staggerDelay?: number
}

export function ProgressiveHighlightOverlay({
  completedProblems,
  staggerDelay = 50,
}: ProgressiveHighlightOverlayProps) {
  if (completedProblems.length === 0) {
    return null
  }

  return (
    <svg
      data-component="progressive-highlight-overlay"
      className={css({
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 5,
      })}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      {completedProblems.map((problem, index) => {
        const { x, y, width, height } = problem.problemBoundingBox

        // Convert normalized (0-1) to viewBox (0-100)
        const boxX = x * 100
        const boxY = y * 100
        const boxWidth = width * 100
        const boxHeight = height * 100

        return (
          <g
            key={`problem-${problem.problemNumber}`}
            style={{
              animation: 'problemAppear 0.3s ease-out forwards',
              animationDelay: `${index * staggerDelay}ms`,
              opacity: 0,
            }}
          >
            {/* Background fill */}
            <rect
              x={boxX}
              y={boxY}
              width={boxWidth}
              height={boxHeight}
              fill="rgba(34, 197, 94, 0.2)"
              stroke="rgba(34, 197, 94, 0.8)"
              strokeWidth={0.5}
              rx={0.5}
              ry={0.5}
            />
            {/* Checkmark in corner */}
            <circle cx={boxX + boxWidth - 2} cy={boxY + 2} r={2} fill="rgba(34, 197, 94, 1)" />
            <path
              d={`M ${boxX + boxWidth - 3} ${boxY + 2} l 0.7 0.7 l 1.3 -1.5`}
              stroke="white"
              strokeWidth={0.4}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        )
      })}
    </svg>
  )
}

/**
 * Compact version for smaller tiles (just shows green border, no checkmark)
 */
export function ProgressiveHighlightOverlayCompact({
  completedProblems,
  staggerDelay = 50,
}: ProgressiveHighlightOverlayProps) {
  if (completedProblems.length === 0) {
    return null
  }

  return (
    <svg
      data-component="progressive-highlight-overlay-compact"
      className={css({
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 5,
      })}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      {completedProblems.map((problem, index) => {
        const { x, y, width, height } = problem.problemBoundingBox

        // Convert normalized (0-1) to viewBox (0-100)
        const boxX = x * 100
        const boxY = y * 100
        const boxWidth = width * 100
        const boxHeight = height * 100

        return (
          <rect
            key={`problem-${problem.problemNumber}`}
            x={boxX}
            y={boxY}
            width={boxWidth}
            height={boxHeight}
            fill="rgba(34, 197, 94, 0.15)"
            stroke="rgba(34, 197, 94, 0.7)"
            strokeWidth={0.3}
            rx={0.3}
            ry={0.3}
            style={{
              animation: 'problemAppear 0.3s ease-out forwards',
              animationDelay: `${index * staggerDelay}ms`,
              opacity: 0,
            }}
          />
        )
      })}
    </svg>
  )
}
