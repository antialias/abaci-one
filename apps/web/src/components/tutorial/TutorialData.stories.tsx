import type { Meta, StoryObj } from '@storybook/react'
import { getTutorialForEditor } from '../../utils/tutorialConverter'

// Simple component that just displays tutorial data
function TutorialDataDisplay() {
  const tutorial = getTutorialForEditor()

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h2>Tutorial Data Structure</h2>
      <div>
        <strong>Title:</strong> {tutorial.title}
      </div>
      <div>
        <strong>Steps Count:</strong> {tutorial.steps?.length || 0}
      </div>
      <div>
        <strong>Steps Array:</strong> {Array.isArray(tutorial.steps) ? 'Yes' : 'No'}
      </div>
      <details style={{ marginTop: '20px' }}>
        <summary>Raw Tutorial Data</summary>
        <pre style={{ background: '#f5f5f5', padding: '10px', fontSize: '12px' }}>
          {JSON.stringify(tutorial, null, 2)}
        </pre>
      </details>
    </div>
  )
}

const meta: Meta<typeof TutorialDataDisplay> = {
  title: 'Debug/TutorialData',
  component: TutorialDataDisplay,
  parameters: {
    docs: {
      description: {
        component: 'Simple display of tutorial data to test data structure without complex components'
      }
    }
  }
}

export default meta
type Story = StoryObj<typeof TutorialDataDisplay>

export const BasicData: Story = {}