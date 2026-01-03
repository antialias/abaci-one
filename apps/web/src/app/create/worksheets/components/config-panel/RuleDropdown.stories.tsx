import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { RuleDropdown } from './RuleDropdown'
import type { RuleMode } from '../../displayRules'

const meta = {
  title: 'Worksheets/Config Panel/RuleDropdown',
  component: RuleDropdown,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof RuleDropdown>

export default meta
type Story = StoryObj<typeof meta>

// Wrapper to handle state
function DropdownWrapper(args: React.ComponentProps<typeof RuleDropdown>) {
  const [value, setValue] = useState<RuleMode>(args.value)
  return <RuleDropdown {...args} value={value} onChange={setValue} />
}

export const AlwaysSelectedLight: Story = {
  render: (args) => <DropdownWrapper {...args} />,
  args: {
    label: 'Ten-Frame Diagrams',
    description: 'When should ten-frame visual aids be displayed?',
    value: 'always',
    isDark: false,
  },
}

export const NeverSelectedLight: Story = {
  render: (args) => <DropdownWrapper {...args} />,
  args: {
    label: 'Carry Notation Boxes',
    description: 'When should carry notation be shown?',
    value: 'never',
    isDark: false,
  },
}

export const WhenRegroupingLight: Story = {
  render: (args) => <DropdownWrapper {...args} />,
  args: {
    label: 'Place Value Colors',
    description: 'When should color-coding be applied?',
    value: 'whenRegrouping',
    isDark: false,
  },
}

export const AlwaysSelectedDark: Story = {
  render: (args) => <DropdownWrapper {...args} />,
  args: {
    label: 'Ten-Frame Diagrams',
    description: 'When should ten-frame visual aids be displayed?',
    value: 'always',
    isDark: true,
  },
  parameters: {
    backgrounds: { default: 'dark' },
  },
}

export const NeverSelectedDark: Story = {
  render: (args) => <DropdownWrapper {...args} />,
  args: {
    label: 'Carry Notation Boxes',
    description: 'When should carry notation be shown?',
    value: 'never',
    isDark: true,
  },
  parameters: {
    backgrounds: { default: 'dark' },
  },
}

export const MultipleDropdowns: Story = {
  render: () => {
    const [rules, setRules] = useState({
      tenFrames: 'always' as RuleMode,
      carryBoxes: 'whenRegrouping' as RuleMode,
      placeValueColors: 'never' as RuleMode,
      answerBoxes: 'always' as RuleMode,
    })

    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          maxWidth: '400px',
        }}
      >
        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Display Rules</h3>
        <RuleDropdown
          label="Ten-Frame Diagrams"
          description="Visual representations using ten-frames"
          value={rules.tenFrames}
          onChange={(value) => setRules({ ...rules, tenFrames: value })}
        />
        <RuleDropdown
          label="Carry Notation Boxes"
          description="Small boxes above columns for carrying"
          value={rules.carryBoxes}
          onChange={(value) => setRules({ ...rules, carryBoxes: value })}
        />
        <RuleDropdown
          label="Place Value Colors"
          description="Color-code digits by place value (ones, tens, hundreds)"
          value={rules.placeValueColors}
          onChange={(value) => setRules({ ...rules, placeValueColors: value })}
        />
        <RuleDropdown
          label="Answer Entry Boxes"
          description="Boxes for students to write answers"
          value={rules.answerBoxes}
          onChange={(value) => setRules({ ...rules, answerBoxes: value })}
        />
        <div
          style={{
            marginTop: '8px',
            padding: '12px',
            background: '#f3f4f6',
            borderRadius: '6px',
            fontSize: '12px',
          }}
        >
          <strong>Current Configuration:</strong>
          <pre
            style={{
              margin: '8px 0 0 0',
              fontSize: '10px',
              whiteSpace: 'pre-wrap',
            }}
          >
            {JSON.stringify(rules, null, 2)}
          </pre>
        </div>
      </div>
    )
  },
}

export const AllOptions: Story = {
  render: () => {
    const options: Array<{ value: RuleMode; label: string }> = [
      { value: 'always', label: 'Always' },
      { value: 'never', label: 'Never' },
      { value: 'whenRegrouping', label: 'When Regrouping' },
      { value: 'whenMultipleRegroups', label: 'Multiple Regroups' },
      { value: 'when3PlusDigits', label: '3+ Digits' },
    ]

    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '16px',
          maxWidth: '800px',
        }}
      >
        {options.map((option) => (
          <DropdownWrapper
            key={option.value}
            label={`${option.label} Example`}
            description={`This dropdown is set to "${option.label}"`}
            value={option.value}
          />
        ))}
      </div>
    )
  },
}

export const LongLabel: Story = {
  render: (args) => <DropdownWrapper {...args} />,
  args: {
    label: 'Ten-Frame Diagrams for Visual Number Representation',
    description:
      'Determine when ten-frame visual aids should be displayed to help students understand number composition and place value. Ten-frames are particularly effective for students in early elementary grades.',
    value: 'always',
    isDark: false,
  },
}
