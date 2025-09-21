// Utility to extract and convert the existing GuidedAdditionTutorial data
import { Tutorial, TutorialStep as NewTutorialStep } from '../types/tutorial'
import { PlaceValueUtils, type ValidPlaceValues, type EarthBeadPosition } from '@soroban/abacus-react'

// Type-safe tutorial bead helper functions
const TutorialBeads = {
  ones: {
    earth: (position: EarthBeadPosition) => ({
      placeValue: PlaceValueUtils.ones(),
      beadType: 'earth' as const,
      position
    }),
    heaven: () => ({
      placeValue: PlaceValueUtils.ones(),
      beadType: 'heaven' as const
    })
  }
} as const

// Import the existing tutorial step interface to match the current structure
interface ExistingTutorialStep {
  id: string
  title: string
  problem: string
  description: string
  startValue: number
  targetValue: number
  highlightBeads?: Array<{
    placeValue: number
    beadType: 'heaven' | 'earth'
    position?: number
  }>
  expectedAction: 'add' | 'remove' | 'multi-step'
  actionDescription: string
  tooltip: {
    content: string
    explanation: string
  }
  errorMessages: {
    wrongBead: string
    wrongAction: string
    hint: string
  }
  multiStepInstructions?: string[]
}

// The tutorial steps from GuidedAdditionTutorial.tsx (extracted from the actual file)
export const guidedAdditionSteps: ExistingTutorialStep[] = [
  // Phase 1: Basic Addition (1-4)
  {
    id: 'basic-1',
    title: 'Basic Addition: 0 + 1',
    problem: '0 + 1',
    description: 'Start by adding your first earth bead',
    startValue: 0,
    targetValue: 1,
    highlightBeads: [{ placeValue: 0, beadType: 'earth', position: 0 }],
    expectedAction: 'add',
    actionDescription: 'Click the first earth bead to move it up',
    tooltip: {
      content: 'Adding earth beads',
      explanation: 'Earth beads (bottom) are worth 1 each. Push them UP to activate them.'
    },
    errorMessages: {
      wrongBead: 'Click the highlighted earth bead at the bottom',
      wrongAction: 'Move the bead UP to add it',
      hint: 'Earth beads move up when adding numbers 1-4'
    }
  },
  {
    id: 'basic-2',
    title: 'Basic Addition: 1 + 1',
    problem: '1 + 1',
    description: 'Add the second earth bead to make 2',
    startValue: 1,
    targetValue: 2,
    highlightBeads: [{ placeValue: 0, beadType: 'earth', position: 1 }],
    expectedAction: 'add',
    actionDescription: 'Click the second earth bead to move it up',
    tooltip: {
      content: 'Building up earth beads',
      explanation: 'Continue adding earth beads one by one for numbers 2, 3, and 4'
    },
    errorMessages: {
      wrongBead: 'Click the highlighted earth bead',
      wrongAction: 'Move the bead UP to add it',
      hint: 'You need 2 earth beads for the number 2'
    }
  },
  {
    id: 'basic-3',
    title: 'Basic Addition: 2 + 1',
    problem: '2 + 1',
    description: 'Add the third earth bead to make 3',
    startValue: 2,
    targetValue: 3,
    highlightBeads: [{ placeValue: 0, beadType: 'earth', position: 2 }],
    expectedAction: 'add',
    actionDescription: 'Click the third earth bead to move it up',
    tooltip: {
      content: 'Adding earth beads in sequence',
      explanation: 'Continue adding earth beads one by one until you reach 4'
    },
    errorMessages: {
      wrongBead: 'Click the highlighted earth bead',
      wrongAction: 'Move the bead UP to add it',
      hint: 'You need 3 earth beads for the number 3'
    }
  },
  {
    id: 'basic-4',
    title: 'Basic Addition: 3 + 1',
    problem: '3 + 1',
    description: 'Add the fourth earth bead to make 4',
    startValue: 3,
    targetValue: 4,
    highlightBeads: [{ placeValue: 0, beadType: 'earth', position: 3 }],
    expectedAction: 'add',
    actionDescription: 'Click the fourth earth bead to complete 4',
    tooltip: {
      content: 'Maximum earth beads',
      explanation: 'Four earth beads is the maximum - next we need a different approach'
    },
    errorMessages: {
      wrongBead: 'Click the highlighted earth bead',
      wrongAction: 'Move the bead UP to add it',
      hint: 'Four earth beads represent the number 4'
    }
  },

  // Phase 2: Introduction to Heaven Bead
  {
    id: 'heaven-intro',
    title: 'Heaven Bead: 0 + 5',
    problem: '0 + 5',
    description: 'Use the heaven bead to represent 5',
    startValue: 0,
    targetValue: 5,
    highlightBeads: [{ placeValue: 0, beadType: 'heaven' }],
    expectedAction: 'add',
    actionDescription: 'Click the heaven bead to activate it',
    tooltip: {
      content: 'Heaven bead = 5',
      explanation: 'The single bead above the bar represents 5'
    },
    errorMessages: {
      wrongBead: 'Click the heaven bead at the top',
      wrongAction: 'Move the heaven bead DOWN to activate it',
      hint: 'The heaven bead is worth 5 points'
    }
  },
  {
    id: 'heaven-plus-earth',
    title: 'Combining: 5 + 1',
    problem: '5 + 1',
    description: 'Add 1 to 5 by activating one earth bead',
    startValue: 5,
    targetValue: 6,
    highlightBeads: [{ placeValue: 0, beadType: 'earth', position: 0 }],
    expectedAction: 'add',
    actionDescription: 'Click the first earth bead to make 6',
    tooltip: {
      content: 'Heaven + Earth = 6',
      explanation: 'When you have room in the earth section, simply add directly'
    },
    errorMessages: {
      wrongBead: 'Click the first earth bead',
      wrongAction: 'Move the earth bead UP to add it',
      hint: 'With the heaven bead active, add earth beads for 6, 7, 8, 9'
    }
  },

  // Phase 3: Five Complements (when earth section is full)
  {
    id: 'complement-intro',
    title: 'Five Complement: 3 + 4',
    problem: '3 + 4',
    description: 'Need to add 4, but only have 1 earth bead space. Use complement: 4 = 5 - 1',
    startValue: 3,
    targetValue: 7,
    highlightBeads: [
      { placeValue: 0, beadType: 'heaven' },
      { placeValue: 0, beadType: 'earth', position: 0 }
    ],
    expectedAction: 'multi-step',
    actionDescription: 'First add heaven bead (5), then remove 1 earth bead',
    multiStepInstructions: [
      'Click the heaven bead to add 5',
      'Click the first earth bead to remove 1'
    ],
    tooltip: {
      content: 'Five Complement: 4 = 5 - 1',
      explanation: 'When you need to add 4 but only have 1 space, use: add 5, remove 1'
    },
    errorMessages: {
      wrongBead: 'Follow the two-step process: heaven bead first, then remove earth bead',
      wrongAction: 'Add heaven bead, then remove earth bead',
      hint: 'Complement thinking: 4 = 5 - 1, so add 5 and take away 1'
    }
  },
  {
    id: 'complement-2',
    title: 'Five Complement: 2 + 3',
    problem: '2 + 3',
    description: 'Add 3 to make 5 by using complement: 3 = 5 - 2',
    startValue: 2,
    targetValue: 5,
    highlightBeads: [
      { placeValue: 0, beadType: 'heaven' },
      { placeValue: 0, beadType: 'earth', position: 0 },
      { placeValue: 0, beadType: 'earth', position: 1 }
    ],
    expectedAction: 'multi-step',
    actionDescription: 'Add heaven bead (5), then remove 2 earth beads',
    multiStepInstructions: [
      'Click the heaven bead to add 5',
      'Click the first earth bead to remove it',
      'Click the second earth bead to remove it'
    ],
    tooltip: {
      content: 'Five Complement: 3 = 5 - 2',
      explanation: 'To add 3, think: 3 = 5 - 2, so add 5 and take away 2'
    },
    errorMessages: {
      wrongBead: 'Follow the multi-step process: add heaven, then remove earth beads',
      wrongAction: 'Add heaven bead first, then remove the necessary earth beads',
      hint: 'Complement: 3 = 5 - 2, so add heaven and remove 2 earth'
    }
  },

  // Phase 4: More complex combinations
  {
    id: 'complex-1',
    title: 'Complex: 6 + 2',
    problem: '6 + 2',
    description: 'Add 2 more to 6 (which has heaven + 1 earth)',
    startValue: 6,
    targetValue: 8,
    highlightBeads: [
      { placeValue: 0, beadType: 'earth', position: 1 },
      { placeValue: 0, beadType: 'earth', position: 2 }
    ],
    expectedAction: 'add',
    actionDescription: 'Add two more earth beads',
    tooltip: {
      content: 'Direct addition when possible',
      explanation: 'When you have space in the earth section, just add directly'
    },
    errorMessages: {
      wrongBead: 'Click the next earth beads in sequence',
      wrongAction: 'Move the earth beads UP to add them',
      hint: 'You have room for 2 more earth beads'
    }
  },
  {
    id: 'complex-2',
    title: 'Complex: 7 + 4',
    problem: '7 + 4',
    description: 'Add 4 to 7, but no room for 4 earth beads. Use complement again',
    startValue: 7,
    targetValue: 11,
    highlightBeads: [
      { placeValue: 1, beadType: 'heaven' },
      { placeValue: 0, beadType: 'earth', position: 0 },
      { placeValue: 0, beadType: 'earth', position: 1 }
    ],
    expectedAction: 'multi-step',
    actionDescription: 'This will move to tens place: activate left heaven, remove 3 earth',
    multiStepInstructions: [
      'Click the heaven bead in the tens column (left)',
      'Click the first earth bead to remove it',
      'Click the second earth bead to remove it'
    ],
    tooltip: {
      content: 'Carrying to tens place',
      explanation: '7 + 4 = 11, which needs the tens column heaven bead'
    },
    errorMessages: {
      wrongBead: 'Work with the tens column (left side) and remove earth beads',
      wrongAction: 'Activate tens heaven, then remove earth beads from ones',
      hint: '11 = 10 + 1, so activate tens heaven and adjust ones'
    }
  }
]

// Convert the existing tutorial format to our new format
export function convertGuidedAdditionTutorial(): Tutorial {
  // Temporarily create many steps to test scrolling
  const duplicatedSteps = []
  for (let i = 0; i < 10; i++) {
    duplicatedSteps.push(...guidedAdditionSteps.map(step => ({
      ...step,
      id: `${step.id}-copy-${i}`,
      title: `${step.title} (Copy ${i + 1})`
    })))
  }

  const tutorial: Tutorial = {
    id: 'guided-addition-tutorial',
    title: 'Guided Addition Tutorial (Testing Scrolling)',
    description: 'Learn basic addition on the soroban abacus, from simple earth bead movements to five complements and carrying',
    category: 'Basic Operations',
    difficulty: 'beginner',
    estimatedDuration: 20, // minutes
    steps: duplicatedSteps,
    tags: ['addition', 'basic', 'earth beads', 'heaven beads', 'complements', 'carrying'],
    author: 'Soroban Abacus System',
    version: '1.0.0',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date(),
    isPublished: true
  }

  return tutorial
}

// Helper to validate that the existing tutorial steps work with our new interfaces
export function validateTutorialConversion(): { isValid: boolean; errors: string[] } {
  const errors: string[] = []

  try {
    const tutorial = convertGuidedAdditionTutorial()

    // Basic validation
    if (!tutorial.id || !tutorial.title || !tutorial.steps.length) {
      errors.push('Missing required tutorial fields')
    }

    // Validate each step
    tutorial.steps.forEach((step, index) => {
      if (!step.id || !step.title || !step.problem) {
        errors.push(`Step ${index + 1}: Missing required fields`)
      }

      if (typeof step.startValue !== 'number' || typeof step.targetValue !== 'number') {
        errors.push(`Step ${index + 1}: Invalid start or target value`)
      }

      if (!step.tooltip?.content || !step.tooltip?.explanation) {
        errors.push(`Step ${index + 1}: Missing tooltip content`)
      }

      if (!step.errorMessages?.wrongBead || !step.errorMessages?.wrongAction || !step.errorMessages?.hint) {
        errors.push(`Step ${index + 1}: Missing error messages`)
      }

      if (step.expectedAction === 'multi-step' && (!step.multiStepInstructions || step.multiStepInstructions.length === 0)) {
        errors.push(`Step ${index + 1}: Multi-step action missing instructions`)
      }
    })

  } catch (error) {
    errors.push(`Conversion failed: ${error}`)
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

// Helper to export tutorial data for use in the editor
export function getTutorialForEditor(): Tutorial {
  const validation = validateTutorialConversion()

  if (!validation.isValid) {
    console.warn('Tutorial validation errors:', validation.errors)
  }

  return convertGuidedAdditionTutorial()
}