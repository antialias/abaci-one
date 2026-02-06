import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { ToggleOption } from './ToggleOption'

const meta = {
  title: 'Worksheets/Config Panel/ToggleOption',
  component: ToggleOption,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof ToggleOption>

export default meta
type Story = StoryObj<typeof meta>

// Wrapper to handle state
function ToggleWrapper(args: React.ComponentProps<typeof ToggleOption>) {
  const [checked, setChecked] = useState(args.checked)
  return <ToggleOption {...args} checked={checked} onChange={setChecked} />
}

export const UncheckedLight: Story = {
  render: (args) => <ToggleWrapper {...args} />,
  args: {
    checked: false,
    label: 'Progressive Difficulty',
    description: 'Problems gradually increase in complexity throughout the worksheet',
    isDark: false,
  },
}

export const CheckedLight: Story = {
  render: (args) => <ToggleWrapper {...args} />,
  args: {
    checked: true,
    label: 'Progressive Difficulty',
    description: 'Problems gradually increase in complexity throughout the worksheet',
    isDark: false,
  },
}

export const UncheckedDark: Story = {
  render: (args) => <ToggleWrapper {...args} />,
  args: {
    checked: false,
    label: 'Progressive Difficulty',
    description: 'Problems gradually increase in complexity throughout the worksheet',
    isDark: true,
  },
  parameters: {
    backgrounds: { default: 'dark' },
  },
}

export const CheckedDark: Story = {
  render: (args) => <ToggleWrapper {...args} />,
  args: {
    checked: true,
    label: 'Progressive Difficulty',
    description: 'Problems gradually increase in complexity throughout the worksheet',
    isDark: true,
  },
  parameters: {
    backgrounds: { default: 'dark' },
  },
}

export const WithChildren: Story = {
  render: (args) => (
    <ToggleWrapper {...args}>
      <div
        style={{
          padding: '12px',
          borderTop: '1px solid #e5e7eb',
          background: '#f9fafb',
        }}
      >
        <p style={{ margin: 0, fontSize: '11px', color: '#6b7280' }}>
          Additional content can be displayed when this option is toggled on.
        </p>
      </div>
    </ToggleWrapper>
  ),
  args: {
    checked: true,
    label: 'Show Answer Key',
    description: 'Include an answer key at the end of the worksheet',
    isDark: false,
  },
}

export const LongDescription: Story = {
  render: (args) => <ToggleWrapper {...args} />,
  args: {
    checked: false,
    label: 'Include Ten-Frame Diagrams',
    description:
      'Add visual ten-frame representations to help students visualize numbers and develop number sense. This is particularly helpful for early learners who are still developing their understanding of place value and number composition.',
    isDark: false,
  },
}

export const InteractiveDemo: Story = {
  args: {
    checked: false,
    onChange: () => {},
    label: 'Interactive Demo',
    description: '',
  },
  render: () => {
    const [options, setOptions] = useState({
      progressive: false,
      answerKey: true,
      tenFrames: false,
      carryBoxes: true,
    })

    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          maxWidth: '400px',
        }}
      >
        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Worksheet Options</h3>
        <ToggleOption
          checked={options.progressive}
          onChange={(checked) => setOptions({ ...options, progressive: checked })}
          label="Progressive Difficulty"
          description="Problems gradually increase in complexity"
        />
        <ToggleOption
          checked={options.answerKey}
          onChange={(checked) => setOptions({ ...options, answerKey: checked })}
          label="Include Answer Key"
          description="Add an answer key at the end"
        />
        <ToggleOption
          checked={options.tenFrames}
          onChange={(checked) => setOptions({ ...options, tenFrames: checked })}
          label="Ten-Frame Diagrams"
          description="Show visual representations for numbers"
        />
        <ToggleOption
          checked={options.carryBoxes}
          onChange={(checked) => setOptions({ ...options, carryBoxes: checked })}
          label="Carry Notation Boxes"
          description="Display boxes above columns for carrying"
        />
        <div
          style={{
            marginTop: '12px',
            padding: '12px',
            background: '#f3f4f6',
            borderRadius: '6px',
            fontSize: '12px',
          }}
        >
          <strong>Selected:</strong>
          <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
            {Object.entries(options).map(
              ([key, value]) => value && <li key={key}>{key.replace(/([A-Z])/g, ' $1')}</li>
            )}
          </ul>
        </div>
      </div>
    )
  },
}
