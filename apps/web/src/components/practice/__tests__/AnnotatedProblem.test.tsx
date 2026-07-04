import React from 'react'
import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { AnnotatedProblem } from '../AnnotatedProblem'

// The review/annotated surface must render linear problems horizontally (not as a
// vertical stack) and show the correct answer.
describe('AnnotatedProblem — format', () => {
  it('renders a linear problem as a horizontal sentence, not a vertical stack', () => {
    const { container } = render(
      <AnnotatedProblem
        terms={[45, 27]}
        answer={72}
        studentAnswer={70}
        isCorrect={false}
        isDark={false}
        format="linear"
      />
    )
    expect(container.querySelector('[data-component="linear-problem"]')).not.toBeNull()
    expect(container.querySelector('[data-element="collapsed-problem"]')).toBeNull()
    expect(container.querySelector('[data-element="expanded-problem"]')).toBeNull()
    expect(
      container.querySelector('[data-component="annotated-problem"]')?.getAttribute('data-format')
    ).toBe('linear')
  })

  it('shows the correct answer + struck student answer for an incorrect linear problem', () => {
    const { container } = render(
      <AnnotatedProblem
        terms={[45, 27]}
        answer={72}
        studentAnswer={70}
        isCorrect={false}
        isDark={false}
        format="linear"
      />
    )
    expect(container.querySelector('[data-element="answer-box"]')?.textContent).toBe('72')
    expect(container.querySelector('[data-element="user-answer"]')?.textContent).toContain('70')
  })

  it('still renders vertical problems as a vertical stack (default / back-compat)', () => {
    const { container } = render(
      <AnnotatedProblem
        terms={[45, 27]}
        answer={72}
        studentAnswer={72}
        isCorrect={true}
        isDark={false}
      />
    )
    expect(container.querySelector('[data-element="collapsed-problem"]')).not.toBeNull()
    expect(container.querySelector('[data-component="linear-problem"]')).toBeNull()
    expect(
      container.querySelector('[data-component="annotated-problem"]')?.getAttribute('data-format')
    ).toBe('vertical')
  })
})
