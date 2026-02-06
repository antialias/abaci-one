import { action } from '@storybook/addon-actions'
import type { Meta, StoryObj } from '@storybook/react'
import { createBasicSkillSet, createEmptySkillSet } from '../../types/tutorial'
import { PracticeStepEditor } from './PracticeStepEditor'

const meta: Meta<typeof PracticeStepEditor> = {
  title: 'Tutorial/PracticeStepEditor',
  component: PracticeStepEditor,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `
The PracticeStepEditor component provides a comprehensive interface for configuring skill-based practice problem generation.

## Features
- Visual skill selection with color-coded modes (required, target, forbidden)
- Quick preset configurations for common skill levels
- Advanced constraints for number ranges and sum limits
- Real-time configuration summary and validation
- Support for five complements (4=5-1, 3=5-2, etc.) and ten complements (9=10-1, 8=10-2, etc.)

## Skill System
The editor implements a sophisticated skill-based system where problems are generated based on specific abacus calculation techniques the user has mastered. This ensures learners only encounter problems they can solve with their current knowledge.
        `,
      },
    },
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof meta>

// Basic practice step for beginners
const basicPracticeStep = {
  id: 'practice-basic',
  title: 'Practice: Basic Addition (1-4)',
  description: 'Practice adding numbers 1-4 using only earth beads',
  problemCount: 12,
  maxTerms: 3,
  allowedSkills: createBasicSkillSet(),
  numberRange: { min: 1, max: 4 },
  sumConstraints: { maxSum: 9 },
}

// Advanced practice step with five complements
const fiveComplementsPracticeStep = {
  id: 'practice-five-complements',
  title: 'Practice: Five Complements',
  description: 'Practice using five complement techniques when earth section is full',
  problemCount: 15,
  maxTerms: 4,
  allowedSkills: {
    basic: {
      directAddition: true,
      heavenBead: true,
      simpleCombinations: true,
      directSubtraction: false,
      heavenBeadSubtraction: false,
      simpleCombinationsSub: false,
    },
    fiveComplements: {
      '4=5-1': true,
      '3=5-2': true,
      '2=5-3': false,
      '1=5-4': false,
    },
    tenComplements: createEmptySkillSet().tenComplements,
    fiveComplementsSub: createEmptySkillSet().fiveComplementsSub,
    tenComplementsSub: createEmptySkillSet().tenComplementsSub,
    advanced: createEmptySkillSet().advanced,
  },
  targetSkills: {
    fiveComplements: {
      '4=5-1': true,
      '3=5-2': true,
      '2=5-3': false,
      '1=5-4': false,
    },
  },
  numberRange: { min: 1, max: 9 },
  sumConstraints: { maxSum: 9 },
}

// Advanced practice with ten complements
const tenComplementsPracticeStep = {
  id: 'practice-ten-complements',
  title: 'Practice: Ten Complements & Carrying',
  description: 'Practice advanced carrying operations using ten complement techniques',
  problemCount: 20,
  maxTerms: 5,
  allowedSkills: {
    basic: {
      directAddition: true,
      heavenBead: true,
      simpleCombinations: true,
      directSubtraction: false,
      heavenBeadSubtraction: false,
      simpleCombinationsSub: false,
    },
    fiveComplements: {
      '4=5-1': true,
      '3=5-2': true,
      '2=5-3': true,
      '1=5-4': true,
    },
    tenComplements: {
      '9=10-1': true,
      '8=10-2': true,
      '7=10-3': true,
      '6=10-4': false,
      '5=10-5': false,
      '4=10-6': false,
      '3=10-7': false,
      '2=10-8': false,
      '1=10-9': false,
    },
    fiveComplementsSub: createEmptySkillSet().fiveComplementsSub,
    tenComplementsSub: createEmptySkillSet().tenComplementsSub,
    advanced: createEmptySkillSet().advanced,
  },
  targetSkills: {
    tenComplements: {
      '9=10-1': true,
      '8=10-2': true,
      '7=10-3': true,
      '6=10-4': false,
      '5=10-5': false,
      '4=10-6': false,
      '3=10-7': false,
      '2=10-8': false,
      '1=10-9': false,
    },
  },
  numberRange: { min: 1, max: 99 },
  sumConstraints: { maxSum: 99, minSum: 10 },
}

export const BasicPractice: Story = {
  args: {
    step: basicPracticeStep,
    onChange: action('practice-step-changed'),
    onDelete: action('practice-step-deleted'),
  },
  parameters: {
    docs: {
      description: {
        story:
          'Basic practice step configuration for beginners learning earth bead addition (1-4).',
      },
    },
  },
}

export const FiveComplements: Story = {
  args: {
    step: fiveComplementsPracticeStep,
    onChange: action('practice-step-changed'),
    onDelete: action('practice-step-deleted'),
  },
  parameters: {
    docs: {
      description: {
        story:
          'Practice step focused on five complement techniques (4=5-1, 3=5-2, etc.) with target skills specified.',
      },
    },
  },
}

export const TenComplements: Story = {
  args: {
    step: tenComplementsPracticeStep,
    onChange: action('practice-step-changed'),
    onDelete: action('practice-step-deleted'),
  },
  parameters: {
    docs: {
      description: {
        story:
          'Advanced practice step with ten complement operations for multi-column arithmetic with carrying.',
      },
    },
  },
}

export const EmptyStep: Story = {
  args: {
    step: {
      id: 'practice-empty',
      title: 'New Practice Step',
      description: '',
      problemCount: 10,
      maxTerms: 3,
      allowedSkills: createBasicSkillSet(),
    },
    onChange: action('practice-step-changed'),
    onDelete: action('practice-step-deleted'),
  },
  parameters: {
    docs: {
      description: {
        story:
          'Empty practice step configuration showing the default state when creating a new practice step.',
      },
    },
  },
}

export const WithoutDelete: Story = {
  args: {
    step: basicPracticeStep,
    onChange: action('practice-step-changed'),
    // onDelete omitted
  },
  parameters: {
    docs: {
      description: {
        story: 'Practice step editor without delete functionality (onDelete prop omitted).',
      },
    },
  },
}
