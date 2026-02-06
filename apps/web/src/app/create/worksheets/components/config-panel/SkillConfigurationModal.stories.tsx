import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { SkillConfigurationModal } from './SkillConfigurationModal'
import { DIFFICULTY_PROFILES } from '../../difficultyProfiles'

const meta = {
  title: 'Worksheets/Config Panel/SkillConfigurationModal',
  component: SkillConfigurationModal,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof SkillConfigurationModal>

export default meta
type Story = StoryObj<typeof meta>

// Wrapper component to manage modal state
function ModalWrapper(args: React.ComponentProps<typeof SkillConfigurationModal>) {
  const [open, setOpen] = useState(true)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          padding: '12px 24px',
          background: '#3b82f6',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: '500',
        }}
      >
        Open Modal
      </button>
      <SkillConfigurationModal {...args} open={open} onClose={() => setOpen(false)} />
    </>
  )
}

export const CreateMode: Story = {
  render: (args) => <ModalWrapper {...args} />,
  args: {
    open: true,
    mode: 'create',
    operator: 'addition',
    onSave: (config) => {
      console.log('Created skill:', config)
    },
  },
}

export const EditModeEarlyLearner: Story = {
  render: (args) => <ModalWrapper {...args} />,
  args: {
    open: true,
    mode: 'edit',
    operator: 'addition',
    existingConfig: {
      name: 'Early Learner Addition',
      description: 'Simple addition with lots of scaffolding',
      digitRange: { min: 2, max: 2 },
      regroupingConfig: DIFFICULTY_PROFILES.earlyLearner.regrouping,
      displayRules: DIFFICULTY_PROFILES.earlyLearner.displayRules,
    },
    onSave: (config) => {
      console.log('Updated skill:', config)
    },
  },
}

export const EditModeIntermediate: Story = {
  render: (args) => <ModalWrapper {...args} />,
  args: {
    open: true,
    mode: 'edit',
    operator: 'addition',
    existingConfig: {
      name: 'Intermediate Addition',
      description: 'Moderate difficulty with some scaffolding',
      digitRange: { min: 2, max: 3 },
      regroupingConfig: DIFFICULTY_PROFILES.intermediate.regrouping,
      displayRules: DIFFICULTY_PROFILES.intermediate.displayRules,
    },
    onSave: (config) => {
      console.log('Updated skill:', config)
    },
  },
}

export const EditModeExpert: Story = {
  render: (args) => <ModalWrapper {...args} />,
  args: {
    open: true,
    mode: 'edit',
    operator: 'subtraction',
    existingConfig: {
      name: 'Expert Subtraction',
      description: 'Advanced subtraction with minimal support',
      digitRange: { min: 3, max: 4 },
      regroupingConfig: DIFFICULTY_PROFILES.expert.regrouping,
      displayRules: DIFFICULTY_PROFILES.expert.displayRules,
    },
    onSave: (config) => {
      console.log('Updated skill:', config)
    },
  },
}

export const CustomConfiguration: Story = {
  render: (args) => <ModalWrapper {...args} />,
  args: {
    open: true,
    mode: 'edit',
    operator: 'addition',
    existingConfig: {
      name: 'Custom Skill',
      description: 'My customized difficulty settings',
      digitRange: { min: 2, max: 4 },
      regroupingConfig: {
        pAnyStart: 0.5,
        pAllStart: 0.1,
      },
      displayRules: {
        carryBoxes: 'whenRegrouping',
        answerBoxes: 'always',
        placeValueColors: 'whenRegrouping',
        tenFrames: 'never',
        problemNumbers: 'always',
        cellBorders: 'always',
        borrowNotation: 'never',
        borrowingHints: 'never',
      },
    },
    onSave: (config) => {
      console.log('Updated custom skill:', config)
    },
  },
}
