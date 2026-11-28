'use client'

/**
 * Arithmetic's try card (practice-kinds plan §1.3, §4 K5a-3b): one recorded
 * try as the history and review screens show it, the annotated problem
 * (`AnnotatedProblem`) by presentation. K5b moves those screens onto it;
 * until then nothing in the app renders it.
 */

import { AnnotatedProblem } from '@/components/practice/AnnotatedProblem'
import type { SlotResult } from '@/db/schema/session-plans'

export interface ArithmeticTryCardProps {
  result: SlotResult
  /** The presentation of the try's part */
  presentation: string
  isDark: boolean
}

export function ArithmeticTryCard({ result, presentation, isDark }: ArithmeticTryCardProps) {
  return (
    <div data-component="arithmetic-try-card" data-presentation={presentation}>
      <AnnotatedProblem
        terms={result.problem.terms}
        answer={result.problem.answer}
        studentAnswer={result.studentAnswer}
        isCorrect={result.isCorrect}
        trace={result.problem.generationTrace}
        isDark={isDark}
        format={presentation === 'linear' ? 'linear' : 'vertical'}
      />
    </div>
  )
}
