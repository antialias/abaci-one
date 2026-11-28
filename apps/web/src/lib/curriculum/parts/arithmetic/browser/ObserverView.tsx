'use client'

/**
 * Arithmetic's observer view (practice-kinds plan §1.3, §4 K5a-3b): the
 * problem a teacher watches, drawn from the student's broadcast the way the
 * observer modal draws it today (`SessionObserverModal`: the purpose badge,
 * the problem by presentation with the student's digits, the feedback).
 * K5b moves the modal onto it; until then nothing in the app renders it.
 */

import type { BroadcastState } from '@/components/practice/session/types'
import { css } from '../../../../../../styled-system/css'
import { LinearProblem } from './LinearProblem'
import { PracticeFeedback } from './PracticeFeedback'
import { PurposeBadge } from './PurposeBadge'
import { VerticalProblem } from './VerticalProblem'

export interface ArithmeticObserverViewProps {
  state: BroadcastState
  /** The presentation of the part being watched */
  presentation: string
  isDark: boolean
}

export function ArithmeticObserverView({
  state,
  presentation,
  isDark,
}: ArithmeticObserverViewProps) {
  return (
    <div
      data-component="arithmetic-observer-view"
      data-phase={state.phase}
      data-presentation={presentation}
      className={css({
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: { base: '8px', md: '16px' },
      })}
    >
      {/* Purpose badge with tooltip - matches student's view */}
      <PurposeBadge purpose={state.purpose} complexity={state.complexity} />

      {presentation === 'linear' ? (
        <LinearProblem
          terms={state.currentProblem.terms}
          userAnswer={state.studentAnswer}
          isFocused={state.phase === 'problem'}
          isCompleted={state.phase === 'feedback'}
          correctAnswer={state.currentProblem.answer}
          isDark={isDark}
        />
      ) : (
        <VerticalProblem
          terms={state.currentProblem.terms}
          userAnswer={state.studentAnswer}
          isFocused={state.phase === 'problem'}
          isCompleted={state.phase === 'feedback'}
          correctAnswer={state.currentProblem.answer}
          size="large"
        />
      )}

      {/* Feedback message */}
      {state.studentAnswer && state.phase === 'feedback' && (
        <PracticeFeedback
          isCorrect={state.isCorrect ?? false}
          correctAnswer={state.currentProblem.answer}
        />
      )}
    </div>
  )
}
