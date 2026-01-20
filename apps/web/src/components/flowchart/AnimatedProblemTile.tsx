'use client'

import { useEffect, useState, useMemo } from 'react'
import { css } from '../../../styled-system/css'
import { MathDisplay } from './MathDisplay'
import { formatProblemDisplay } from '@/lib/flowcharts/formatting'
import { evaluate, type EvalContext } from '@/lib/flowcharts/evaluator'
import type { GeneratedExample } from '@/lib/flowcharts/loader'
import type { ExecutableFlowchart, MixedNumberValue } from '@/lib/flowcharts/schema'

export interface AnimatedProblemTileProps {
  /** The generated example */
  example: GeneratedExample
  /** The flowchart (needed for formatting) */
  flowchart: ExecutableFlowchart
  /** Tile index for staggered animations */
  index: number
}

/**
 * Format an answer value for display based on schema type
 */
function formatAnswerDisplay(
  flowchart: ExecutableFlowchart,
  values: Record<string, unknown>
): string {
  const schema = flowchart.definition.problemInput.schema

  // Build evaluation context
  const context: EvalContext = {
    problem: values,
    computed: {},
    userState: {},
  }

  // Evaluate variables to get computed values (including answer)
  for (const [varName, varDef] of Object.entries(flowchart.definition.variables)) {
    try {
      context.computed[varName] = evaluate(varDef.init, context)
    } catch {
      // Skip on error
    }
  }

  switch (schema) {
    case 'two-digit-subtraction': {
      const answer = (values.minuend as number) - (values.subtrahend as number)
      return String(answer)
    }

    case 'linear-equation': {
      // Answer is x
      const answer = context.computed.answer
      if (typeof answer === 'number') {
        return `x = ${answer}`
      }
      return 'x = ?'
    }

    case 'two-fractions-with-op': {
      // For fractions, the answer is computed from the operation
      // This is complex - let's show a simplified version
      const answerWhole = context.computed.answerWhole as number | undefined
      const answerNum = context.computed.answerNum as number | undefined
      const answerDenom = context.computed.answerDenom as number | undefined

      if (answerDenom !== undefined && answerNum !== undefined) {
        if (answerWhole && answerWhole > 0) {
          if (answerNum === 0) return String(answerWhole)
          return `${answerWhole} ${answerNum}/${answerDenom}`
        }
        if (answerNum === 0) return '0'
        return `${answerNum}/${answerDenom}`
      }
      return '?'
    }

    default:
      return '?'
  }
}

/**
 * Animated tile that transitions between showing a problem and its answer.
 * Uses opacity transitions with random timing for an organic, staggered effect.
 * Renders math expressions using MathML via MathDisplay.
 */
export function AnimatedProblemTile({ example, flowchart, index }: AnimatedProblemTileProps) {
  const [showAnswer, setShowAnswer] = useState(false)

  // Format problem and answer using the proper system
  const problemDisplay = useMemo(
    () => formatProblemDisplay(flowchart, example.values),
    [flowchart, example.values]
  )

  const answerDisplay = useMemo(
    () => formatAnswerDisplay(flowchart, example.values),
    [flowchart, example.values]
  )

  useEffect(() => {
    // Random initial delay (0-10s) so tiles don't all animate together
    const initialDelay = Math.random() * 10000

    let animTimer: ReturnType<typeof setInterval>

    const delayTimer = setTimeout(() => {
      // Random interval between 3-8 seconds
      const interval = 3000 + Math.random() * 5000

      animTimer = setInterval(() => {
        setShowAnswer((prev) => !prev)
        // Stay in the new state for 1-3 seconds before potentially switching back
        setTimeout(
          () => {
            // 50% chance to switch back
            if (Math.random() > 0.5) {
              setShowAnswer((prev) => !prev)
            }
          },
          1000 + Math.random() * 2000
        )
      }, interval)
    }, initialDelay)

    return () => {
      clearTimeout(delayTimer)
      if (animTimer) clearInterval(animTimer)
    }
  }, [])

  return (
    <div
      data-component="animated-problem-tile"
      className={css({
        width: '100px',
        height: '60px',
        position: 'relative',
        borderRadius: 'sm',
        overflow: 'hidden',
        backgroundColor: { base: 'gray.100', _dark: 'gray.800' },
      })}
    >
      {/* Problem layer */}
      <div
        data-element="problem-layer"
        className={css({
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1',
          transition: 'opacity 0.8s ease-in-out',
        })}
        style={{ opacity: showAnswer ? 0 : 1 }}
      >
        <MathDisplay expression={problemDisplay} size="sm" />
      </div>

      {/* Answer layer */}
      <div
        data-element="answer-layer"
        className={css({
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1',
          transition: 'opacity 0.8s ease-in-out',
        })}
        style={{ opacity: showAnswer ? 1 : 0 }}
      >
        <MathDisplay expression={answerDisplay} size="sm" />
      </div>
    </div>
  )
}
