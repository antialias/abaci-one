import type { Meta, StoryObj } from '@storybook/react'
import { AbacusReact } from '@soroban/abacus-react'

// Test AbacusReact in isolation
function AbacusTestComponent() {
  return (
    <div style={{ padding: '20px' }}>
      <h2>AbacusReact Test</h2>
      <AbacusReact
        value={0}
        interactive={true}
        animated={false}
        scaleFactor={1.5}
        colorScheme="place-value"
        onValueChange={(value) => console.log('Value changed:', value)}
        callbacks={{
          onBeadClick: (beadInfo) => console.log('Bead clicked:', beadInfo)
        }}
      />
    </div>
  )
}

const meta: Meta<typeof AbacusTestComponent> = {
  title: 'Debug/AbacusTest',
  component: AbacusTestComponent,
  parameters: {
    docs: {
      description: {
        component: 'Test AbacusReact component in isolation to see if it causes the c.some error'
      }
    }
  }
}

export default meta
type Story = StoryObj<typeof AbacusTestComponent>

export const BasicAbacus: Story = {}

export const AbacusWithHighlights: Story = {
  render: () => (
    <div style={{ padding: '20px' }}>
      <h2>AbacusReact with Highlights</h2>
      <AbacusReact
        value={3}
        interactive={true}
        animated={false}
        scaleFactor={1.5}
        colorScheme="place-value"
        highlightBeads={[
          { columnIndex: 4, beadType: 'earth', position: 0 }
        ]}
        customStyles={{
          beads: {
            0: {
              earth: {
                0: { fill: '#fbbf24', stroke: '#f59e0b', strokeWidth: 3 }
              }
            }
          }
        }}
        onValueChange={(value) => console.log('Value changed:', value)}
        callbacks={{
          onBeadClick: (beadInfo) => console.log('Bead clicked:', beadInfo)
        }}
      />
    </div>
  )
}