import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PracticeFeedback } from '../PracticeFeedback'
import { VerticalProblem } from '../VerticalProblem'

vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({
    theme: 'light',
    resolvedTheme: 'light',
    setTheme: vi.fn(),
  }),
}))

describe('Answer reveal policy', () => {
  it('hides the correct answer in feedback when configured', () => {
    render(<PracticeFeedback isCorrect={false} correctAnswer={44} showCorrectAnswer={false} />)
    expect(screen.getByText('Not quite.')).toBeInTheDocument()
    expect(screen.queryByText('The answer was 44')).not.toBeInTheDocument()
  })

  it('reveals the correct answer in feedback by default', () => {
    render(<PracticeFeedback isCorrect={false} correctAnswer={44} />)
    expect(screen.getByText('The answer was 44')).toBeInTheDocument()
  })

  it('keeps user answer in vertical problem when reveal is disabled', () => {
    const { container } = render(
      <VerticalProblem
        terms={[12, 3]}
        userAnswer="14"
        isCompleted={true}
        correctAnswer={15}
        showCorrectAnswerOnIncorrect={false}
      />
    )

    const answerRow = container.querySelector('[data-element="answer-row"]')
    expect(answerRow).not.toBeNull()
    expect(answerRow?.textContent).toContain('14')
    expect(container.querySelector('[data-element="user-answer"]')).toBeNull()
  })

  it('reveals correct answer in vertical problem by default', () => {
    const { container } = render(
      <VerticalProblem terms={[12, 3]} userAnswer="14" isCompleted={true} correctAnswer={15} />
    )

    const answerRow = container.querySelector('[data-element="answer-row"]')
    expect(answerRow).not.toBeNull()
    expect(answerRow?.textContent).toContain('15')
    expect(container.querySelector('[data-element="user-answer"]')).not.toBeNull()
  })
})
