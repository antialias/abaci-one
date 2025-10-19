# Tutorial System Documentation

## Overview

The tutorial system is a sophisticated interactive learning platform for teaching soroban abacus concepts. It features step-by-step guidance, bead highlighting, pedagogical decomposition, and progress tracking.

## Key Components

### 1. TutorialPlayer (`/src/components/tutorial/TutorialPlayer.tsx`)
The main tutorial playback component that:
- Displays tutorial steps progressively
- Highlights specific beads users should interact with
- Provides real-time feedback and tooltips
- Shows step-by-step instructions for multi-step operations
- Tracks user progress through the tutorial
- Auto-advances to next step on correct completion

**Key Features:**
- **Bead Highlighting**: Visual indicators showing which beads to manipulate
- **Step Progress**: Shows current step out of total steps
- **Error Feedback**: Provides hints when user makes mistakes
- **Multi-Step Support**: Breaks complex operations into sequential sub-steps
- **Pedagogical Decomposition**: Explains the "why" behind each operation

### 2. TutorialEditor (`/src/components/tutorial/TutorialEditor.tsx`)
A full-featured editor for creating and editing tutorials:
- Visual step editor
- Bead highlight configuration
- Multi-step instruction editor
- Live preview
- Import/export functionality
- Access control

**Editor URL:** `/tutorial-editor`

### 3. Tutorial Data Structure (`/src/types/tutorial.ts`)

```typescript
interface Tutorial {
  id: string
  title: string
  description: string
  category: string
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  estimatedDuration: number // minutes
  steps: TutorialStep[]
  tags: string[]
  author: string
  version: string
  createdAt: Date
  updatedAt: Date
  isPublished: boolean
}

interface TutorialStep {
  id: string
  title: string
  problem: string                    // e.g. "2 + 3"
  description: string                // User-facing explanation
  startValue: number                 // Initial abacus value
  targetValue: number                // Goal value
  expectedAction: 'add' | 'remove' | 'multi-step'
  actionDescription: string

  // Bead highlighting
  highlightBeads?: Array<{
    placeValue: number               // 0=ones, 1=tens, etc.
    beadType: 'heaven' | 'earth'
    position?: number                // For earth beads: 0-3
  }>

  // Progressive step highlighting
  stepBeadHighlights?: Array<{
    placeValue: number
    beadType: 'heaven' | 'earth'
    position?: number
    stepIndex: number                // Which instruction step
    direction: 'up' | 'down' | 'activate' | 'deactivate'
    order?: number                   // Order within step
  }>

  totalSteps?: number                // For multi-step operations
  multiStepInstructions?: string[]   // Sequential instructions

  // Tooltips and guidance
  tooltip: {
    content: string                  // Short title
    explanation: string              // Detailed explanation
  }
}
```

### 4. Tutorial Converter (`/src/utils/tutorialConverter.ts`)

Utility that converts the original `GuidedAdditionTutorial` data into the new tutorial format:
- `guidedAdditionSteps`: Array of tutorial steps from basic addition to complements
- `convertGuidedAdditionTutorial()`: Converts to Tutorial object
- `getTutorialForEditor()`: Main export used in the app

**Current Tutorial Steps:**
1. Basic Addition (0+1, 1+1, 2+1, 3+1)
2. Heaven Bead Introduction (0+5, 5+1)
3. Five Complements (3+4, 2+3 using 5-complement method)
4. Complex Operations (6+2, 7+4 with carrying)

### 5. Supporting Utilities

**`/src/utils/abacusInstructionGenerator.ts`**
- Automatically generates step-by-step instructions from start/target values
- Creates bead highlight data
- Determines movement directions

**`/src/utils/beadDiff.ts`**
- Calculates differences between abacus states
- Generates visual feedback tooltips
- Explains what changed and why

## Usage Examples

### Basic Usage in a Page

```typescript
import { TutorialPlayer } from '@/components/tutorial/TutorialPlayer'
import { getTutorialForEditor } from '@/utils/tutorialConverter'

export function MyPage() {
  return (
    <TutorialPlayer
      tutorial={getTutorialForEditor()}
      isDebugMode={false}
      showDebugPanel={false}
    />
  )
}
```

### Using a Subset of Steps

```typescript
import { getTutorialForEditor } from '@/utils/tutorialConverter'

const fullTutorial = getTutorialForEditor()

// Extract specific steps (e.g., just "Friends of 5")
const friendsOf5Tutorial = {
  ...fullTutorial,
  id: 'friends-of-5-demo',
  title: 'Friends of 5',
  steps: fullTutorial.steps.filter(step =>
    step.id === 'complement-2' // The 2+3=5 step
  )
}

return <TutorialPlayer tutorial={friendsOf5Tutorial} />
```

### Creating a Custom Tutorial

```typescript
const customTutorial: Tutorial = {
  id: 'my-tutorial',
  title: 'My Custom Tutorial',
  description: 'Learning something new',
  category: 'Custom',
  difficulty: 'beginner',
  estimatedDuration: 5,
  steps: [
    {
      id: 'step-1',
      title: 'Add 2',
      problem: '0 + 2',
      description: 'Move two earth beads up',
      startValue: 0,
      targetValue: 2,
      expectedAction: 'add',
      actionDescription: 'Add two earth beads',
      highlightBeads: [
        { placeValue: 0, beadType: 'earth', position: 0 },
        { placeValue: 0, beadType: 'earth', position: 1 }
      ],
      tooltip: {
        content: 'Adding 2',
        explanation: 'Push two earth beads up to represent 2'
      }
    }
  ],
  tags: ['custom'],
  author: 'Me',
  version: '1.0.0',
  createdAt: new Date(),
  updatedAt: new Date(),
  isPublished: true
}
```

## Current Implementation Locations

**Live Tutorials:**
- `/guide` - Second tab "Arithmetic Operations" contains the full guided addition tutorial

**Editor:**
- `/tutorial-editor` - Full tutorial editing interface

**Storybook:**
- Multiple tutorial stories in `/src/components/tutorial/*.stories.tsx`

## Key Design Principles

1. **Progressive Disclosure**: Users see one step at a time
2. **Immediate Feedback**: Real-time validation and hints
3. **Visual Guidance**: Bead highlighting shows exactly what to do
4. **Pedagogical Decomposition**: Multi-step operations broken into atomic actions
5. **Auto-Advancement**: Successful completion automatically moves to next step
6. **Error Recovery**: Helpful hints when user makes mistakes

## Notes

- The tutorial system uses the existing `AbacusReact` component
- Tutorials can be created/edited through the TutorialEditor
- Tutorial data can be exported/imported as JSON
- The system supports both single-step and multi-step operations
- Bead highlighting uses place value indexing (0=ones, 1=tens, etc.)
