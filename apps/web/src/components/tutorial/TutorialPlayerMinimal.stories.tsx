import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { css } from '../../styled-system/css'
import { getTutorialForEditor } from '../../utils/tutorialConverter'

// Minimal tutorial player that only shows the step info without AbacusReact
function MinimalTutorialPlayer() {
  const tutorial = getTutorialForEditor()
  const [currentStepIndex] = useState(0)

  // Safely get current step with proper validation
  const currentStep = tutorial.steps && Array.isArray(tutorial.steps) && tutorial.steps[currentStepIndex]

  if (!currentStep) {
    return <div>No step available</div>
  }

  return (
    <div className={css({ p: 4, border: '1px solid gray', borderRadius: 'md' })}>
      <h2>Minimal Tutorial Player</h2>
      <div>
        <strong>Tutorial:</strong> {tutorial.title}
      </div>
      <div>
        <strong>Step:</strong> {currentStep.title}
      </div>
      <div>
        <strong>Problem:</strong> {currentStep.problem}
      </div>
      <div>
        <strong>Description:</strong> {currentStep.description}
      </div>

      {/* Test the problematic array operations */}
      <div>
        <strong>Highlight Beads:</strong> {
          currentStep.highlightBeads && Array.isArray(currentStep.highlightBeads)
            ? `${currentStep.highlightBeads.length} beads`
            : 'None'
        }
      </div>

      {/* Test steps array */}
      <div>
        <strong>Total Steps:</strong> {
          tutorial.steps && Array.isArray(tutorial.steps)
            ? tutorial.steps.length
            : 'Unknown'
        }
      </div>
    </div>
  )
}

const meta: Meta<typeof MinimalTutorialPlayer> = {
  title: 'Debug/MinimalTutorialPlayer',
  component: MinimalTutorialPlayer,
  parameters: {
    docs: {
      description: {
        component: 'Minimal tutorial player without AbacusReact to isolate the array error'
      }
    }
  }
}

export default meta
type Story = StoryObj<typeof MinimalTutorialPlayer>

export const WithoutAbacus: Story = {}

// Test with manually created minimal tutorial data
export const WithMinimalData: Story = {
  render: () => {
    const minimalTutorial = {
      id: 'test',
      title: 'Test Tutorial',
      description: 'Test',
      category: 'test',
      difficulty: 'beginner' as const,
      estimatedDuration: 5,
      steps: [
        {
          id: 'step1',
          title: 'Test Step',
          problem: '1 + 1',
          description: 'Add one',
          startValue: 0,
          targetValue: 1,
          highlightBeads: [{ columnIndex: 4, beadType: 'earth' as const, position: 0 }],
          expectedAction: 'add' as const,
          actionDescription: 'Add bead',
          tooltip: { content: 'Test', explanation: 'Test' },
          errorMessages: { wrongBead: 'Wrong', wrongAction: 'Wrong', hint: 'Hint' }
        }
      ],
      tags: ['test'],
      author: 'test'
    }

    const currentStep = minimalTutorial.steps[0]

    return (
      <div style={{ padding: '20px' }}>
        <h2>Manual Minimal Data</h2>
        <div>Steps: {minimalTutorial.steps.length}</div>
        <div>Current Step: {currentStep.title}</div>
        <div>Highlight Beads: {currentStep.highlightBeads?.length || 0}</div>
      </div>
    )
  }
}