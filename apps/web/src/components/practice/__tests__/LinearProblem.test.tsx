import React from 'react'
import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { LinearProblem } from '../LinearProblem'

// Guard/characterization tests: lock the horizontal-sentence rendering (shared by
// every surface) and the display-only reveal behavior the read-only surfaces rely on.
describe('LinearProblem', () => {
  it('renders a horizontal number sentence with "=" and the answer box', () => {
    const { container } = render(
      <LinearProblem terms={[45, 27]} userAnswer="" isFocused correctAnswer={72} isDark={false} />
    )
    const root = container.querySelector('[data-component="linear-problem"]')
    expect(root).not.toBeNull()
    const sentence = container.querySelector('[data-element="linear-sentence"]')
    expect(sentence?.textContent).toContain('45 + 27')
    expect(sentence?.textContent).toContain('=')
    expect(sentence?.textContent).not.toContain('…')
    // Focused + unanswered box shows the "?" placeholder
    expect(container.querySelector('[data-element="answer-box"]')?.textContent).toBe('?')
    expect(root?.getAttribute('data-status')).toBe('active')
  })

  it('renders subtraction terms with a minus', () => {
    const { container } = render(
      <LinearProblem terms={[50, -8]} correctAnswer={42} isDark={false} />
    )
    expect(container.querySelector('[data-element="linear-sentence"]')?.textContent).toContain(
      '50 - 8'
    )
  })

  it('shows "…" instead of "=" when a prefix sum is detected', () => {
    const { container } = render(
      <LinearProblem
        terms={[45, 27]}
        userAnswer="45"
        detectedPrefixIndex={0}
        correctAnswer={72}
        isDark={false}
      />
    )
    const root = container.querySelector('[data-component="linear-problem"]')
    expect(root?.getAttribute('data-prefix-mode')).toBe('true')
    const sentence = container.querySelector('[data-element="linear-sentence"]')
    expect(sentence?.textContent).toContain('…')
    expect(sentence?.textContent).not.toContain('=')
  })

  it('keeps the wrong answer and does NOT reveal when showCorrectAnswerOnIncorrect is false (live player)', () => {
    const { container } = render(
      <LinearProblem
        terms={[45, 27]}
        userAnswer="70"
        isCompleted
        correctAnswer={72}
        showCorrectAnswerOnIncorrect={false}
        isDark={false}
      />
    )
    expect(container.querySelector('[data-element="answer-box"]')?.textContent).toBe('70')
    expect(container.querySelector('[data-element="user-answer"]')).toBeNull()
    expect(
      container.querySelector('[data-component="linear-problem"]')?.getAttribute('data-status')
    ).toBe('incorrect')
  })

  it('reveals the correct answer and strikes the student answer on incorrect (default reveal)', () => {
    const { container } = render(
      <LinearProblem terms={[45, 27]} userAnswer="70" isCompleted correctAnswer={72} isDark={false} />
    )
    expect(container.querySelector('[data-element="answer-box"]')?.textContent).toBe('72')
    const struck = container.querySelector('[data-element="user-answer"]')
    expect(struck).not.toBeNull()
    expect(struck?.textContent).toContain('70')
  })

  it('marks a correct completed answer as correct (no reveal)', () => {
    const { container } = render(
      <LinearProblem terms={[45, 27]} userAnswer="72" isCompleted correctAnswer={72} isDark={false} />
    )
    expect(
      container.querySelector('[data-component="linear-problem"]')?.getAttribute('data-status')
    ).toBe('correct')
    expect(container.querySelector('[data-element="user-answer"]')).toBeNull()
  })
})
