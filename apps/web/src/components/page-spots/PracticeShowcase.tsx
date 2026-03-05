'use client'

import { css } from '../../../styled-system/css'
import { VerticalProblem } from '@/components/practice/VerticalProblem'

/**
 * Showcase of practice problems for page spots.
 * Shows a row of static VerticalProblem examples in various states
 * (active, correct, incorrect) to demonstrate the practice experience.
 */
export function PracticeShowcase() {
  return (
    <div
      data-component="practice-showcase"
      className={css({
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1.5rem',
        padding: '1.5rem',
        width: '100%',
        height: '100%',
        flexWrap: 'wrap',
      })}
    >
      {/* Completed correct — simple addition */}
      <VerticalProblem
        terms={[27, 14]}
        userAnswer="41"
        isCompleted
        correctAnswer={41}
        size="large"
      />

      {/* Active — subtraction in progress */}
      <VerticalProblem terms={[83, -47]} userAnswer="3" isFocused size="large" />

      {/* Completed correct — 3-term problem */}
      <VerticalProblem
        terms={[45, 32, -18]}
        userAnswer="59"
        isCompleted
        correctAnswer={59}
        size="large"
      />

      {/* Active — multi-digit, waiting for input */}
      <VerticalProblem terms={[156, 234]} userAnswer="" size="large" />
    </div>
  )
}

/**
 * Compact showcase — fewer problems, fits tighter aspect ratios.
 */
export function PracticeShowcaseCompact() {
  return (
    <div
      data-component="practice-showcase-compact"
      className={css({
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1.25rem',
        padding: '1rem',
        width: '100%',
        height: '100%',
      })}
    >
      {/* Correct answer */}
      <VerticalProblem
        terms={[48, 35]}
        userAnswer="83"
        isCompleted
        correctAnswer={83}
        size="large"
      />

      {/* Actively solving */}
      <VerticalProblem terms={[72, -29]} userAnswer="4" isFocused size="large" />

      {/* Waiting for input */}
      <VerticalProblem terms={[63, 18]} userAnswer="" size="large" />
    </div>
  )
}
