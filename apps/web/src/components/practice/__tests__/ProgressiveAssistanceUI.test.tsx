import React from 'react'
import { render } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ProgressiveAssistanceUI } from '../ProgressiveAssistanceUI'
import type { AssistanceMachineState } from '../hooks/useProgressiveAssistance'

// The component only reads machineState.state; context is never touched, so a
// minimal stub is enough.
const makeState = (state: AssistanceMachineState['state']): AssistanceMachineState => ({
  state,
  context: {} as AssistanceMachineState['context'],
})

function renderUI(props: Partial<React.ComponentProps<typeof ProgressiveAssistanceUI>> = {}) {
  return render(
    <ProgressiveAssistanceUI
      machineState={makeState('offeringHelp')}
      showWrongAnswerSuggestion={false}
      isDark={false}
      onHelpRequested={vi.fn()}
      onSkip={vi.fn()}
      onDismissWrongAnswerSuggestion={vi.fn()}
      {...props}
    />
  )
}

describe('ProgressiveAssistanceUI — showHelpAffordance (LINEAR parts)', () => {
  it('shows the "I need help" button by default when offering help', () => {
    const { container } = renderUI({ machineState: makeState('offeringHelp') })
    expect(container.querySelector('[data-action="request-help"]')).not.toBeNull()
    expect(container.querySelector('[data-action="skip"]')).not.toBeNull()
  })

  it('hides the help button but keeps encouragement + skip when the affordance is off', () => {
    const { container, getByText } = renderUI({
      machineState: makeState('offeringHelp'),
      showHelpAffordance: false,
    })
    expect(container.querySelector('[data-action="request-help"]')).toBeNull()
    // Encouragement and the always-on skip are not abacus-flavored — they stay.
    expect(getByText('Give it a try!')).toBeTruthy()
    expect(container.querySelector('[data-action="skip"]')).not.toBeNull()
  })

  it('shows the wrong-answer help suggestion by default', () => {
    const { container } = renderUI({
      machineState: makeState('idle'),
      showWrongAnswerSuggestion: true,
    })
    expect(container.querySelector('[data-element="wrong-answer-suggestion"]')).not.toBeNull()
  })

  it('omits the wrong-answer help suggestion when the affordance is off', () => {
    const { container } = renderUI({
      machineState: makeState('idle'),
      showWrongAnswerSuggestion: true,
      showHelpAffordance: false,
    })
    expect(container.querySelector('[data-element="wrong-answer-suggestion"]')).toBeNull()
    expect(container.querySelector('[data-action="wrong-answer-help"]')).toBeNull()
    expect(container.querySelector('[data-action="skip"]')).not.toBeNull()
  })
})
