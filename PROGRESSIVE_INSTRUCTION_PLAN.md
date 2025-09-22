# Progressive Multi-Step Instruction System Plan

## Overview
Implement a comprehensive system that coordinates multi-step instructions, bead highlighting, and directional movement indicators to create a step-by-step progressive tutorial experience.

## Current System Analysis

### 1. Bead Highlighting System
- **Location**: `packages/abacus-react/src/AbacusReact.tsx`
- **Interface**: `BeadHighlight` (union of PlaceValueBead | ColumnIndexBead)
- **Current functionality**: Static highlighting of beads
- **Limitation**: Shows all highlighted beads at once, no progressive revelation

### 2. Multi-Step Instructions
- **Location**: `apps/web/src/utils/abacusInstructionGenerator.ts`
- **Data**: `multiStepInstructions: string[]`
- **Current functionality**: Generates step-by-step text instructions
- **Example (99+1)**:
  1. "Click earth bead 1 in the hundreds column to add it"
  2. "Remove 9 from ones column (subtracting second part of decomposition)"
  3. "Remove 90 from tens column (subtracting first part of decomposition)"

### 3. Progressive Display (GuidedAdditionTutorial)
- **Location**: `apps/web/src/components/GuidedAdditionTutorial.tsx`
- **State**: `multiStepProgress: number` (tracks current step)
- **Functionality**: Shows current step in bold, dims future steps
- **Limitation**: No coordination with bead highlighting

### 4. Bead Generation Logic
- **Location**: `apps/web/src/utils/abacusInstructionGenerator.ts:generateBeadHighlights()`
- **Current**: Generates all beads for entire operation
- **Limitation**: No step-by-step bead breakdown

## Proposed Solution Architecture

### Phase 1: Enhanced Data Structures

#### 1.1 Extended BeadHighlight Interface
```typescript
export interface StepBeadHighlight extends BeadHighlight {
  stepIndex: number  // Which instruction step this bead belongs to
  direction: 'up' | 'down' | 'activate' | 'deactivate'  // Movement direction
  order?: number     // Order within the step (for multiple beads per step)
}
```

#### 1.2 Enhanced GeneratedInstruction Interface
```typescript
export interface GeneratedInstruction {
  // ... existing fields
  multiStepInstructions?: string[]
  stepBeadHighlights?: StepBeadHighlight[]  // NEW: beads grouped by step
  totalSteps?: number                       // NEW: total number of steps
}
```

#### 1.3 Progressive Instruction State
```typescript
interface ProgressiveInstructionState {
  currentStep: number
  totalSteps: number
  currentStepBeads: BeadHighlight[]        // Beads for current step only
  completedStepBeads: BeadHighlight[]      // All beads from previous steps
  currentStepInstruction: string
}
```

### Phase 2: Enhanced Instruction Generation

#### 2.1 Modify generateEnhancedStepInstructions()
- Generate beads per step, not just text instructions
- Map each bead operation to its corresponding instruction step
- Determine movement direction for each bead

#### 2.2 New Function: generateStepBeadMapping()
```typescript
function generateStepBeadMapping(
  startValue: number,
  targetValue: number,
  additions: BeadHighlight[],
  removals: BeadHighlight[],
  decomposition: any,
  multiStepInstructions: string[]
): StepBeadHighlight[]
```

### Phase 3: AbacusReact Component Enhancements

#### 3.1 Add Directional Indicators
- **New Props**:
  ```typescript
  interface AbacusReactProps {
    // ... existing props
    stepBeadHighlights?: StepBeadHighlight[]
    showDirectionIndicators?: boolean
  }
  ```

- **Visual Implementation**:
  - Arrow overlays on beads (↑ for up/activate, ↓ for down/deactivate)
  - Different highlight colors for different directions
  - Animation hints for movement direction

#### 3.2 Enhanced Bead Styling
```typescript
interface BeadDirectionStyle extends BeadStyle {
  directionIndicator?: {
    show: boolean
    direction: 'up' | 'down' | 'activate' | 'deactivate'
    color?: string
    size?: number
  }
}
```

### Phase 4: TutorialPlayer Progressive Display

#### 4.1 Add Progressive State Management
```typescript
interface TutorialPlayerState {
  // ... existing state
  progressiveInstruction: ProgressiveInstructionState | null
}
```

#### 4.2 Progressive Instruction Logic
- Track current step within multi-step instructions
- Update highlighted beads based on current step
- Show only current step instruction in bold
- Dim future steps, mark completed steps

#### 4.3 Step Advancement Logic
- User completes current step → advance to next step
- Update bead highlights to show next step's beads
- Maintain previously completed beads in "completed" state

### Phase 5: Testing Strategy

#### 5.1 Unit Tests for Step-by-Step Generation
```typescript
describe('Progressive Instruction Generation', () => {
  test('99+1 generates correct step-bead mapping', () => {
    const instruction = generateAbacusInstructions(99, 100)
    expect(instruction.stepBeadHighlights).toHaveLength(3)

    // Step 0: Add 1 to hundreds
    expect(instruction.stepBeadHighlights[0]).toEqual({
      stepIndex: 0,
      placeValue: 2,
      beadType: 'earth',
      position: 0,
      direction: 'activate'
    })

    // Step 1: Remove 9 from ones (heaven + 4 earth)
    const step1Beads = instruction.stepBeadHighlights.filter(b => b.stepIndex === 1)
    expect(step1Beads).toHaveLength(5) // 1 heaven + 4 earth

    // Step 2: Remove 90 from tens (heaven + 4 earth)
    const step2Beads = instruction.stepBeadHighlights.filter(b => b.stepIndex === 2)
    expect(step2Beads).toHaveLength(5) // 1 heaven + 4 earth
  })

  test('3+98 generates correct step-bead mapping', () => {
    // Test simpler complement case
  })
})
```

#### 5.2 Integration Tests for Progressive Display
```typescript
describe('Progressive Tutorial Player', () => {
  test('shows only current step beads', () => {
    // Render tutorial player with 99+1 case
    // Verify only step 0 beads are highlighted initially
    // Advance step, verify step 1 beads appear
  })

  test('direction indicators display correctly', () => {
    // Verify arrows/indicators show correct directions
  })
})
```

#### 5.3 Visual Regression Tests
- Storybook stories for each progression state
- Visual comparisons for direction indicators
- Progressive highlighting behavior

## Implementation Plan

### Iteration 1: Data Structure Foundation
1. **Design and implement enhanced interfaces** ✓
2. **Modify instruction generator to produce step-bead mapping**
3. **Unit tests for step-bead generation**
4. **Validate with 99+1 and 3+98 test cases**

### Iteration 2: AbacusReact Direction Indicators
1. **Add direction indicator props to AbacusReact**
2. **Implement visual direction indicators (arrows/styling)**
3. **Create Storybook stories for direction indicators**
4. **Test various direction combinations**

### Iteration 3: Progressive TutorialPlayer
1. **Add progressive state management to TutorialPlayer**
2. **Implement step advancement logic**
3. **Coordinate instruction text with bead highlights**
4. **Test tutorial progression flow**

### Iteration 4: Integration and Polish
1. **Integrate all components in tutorial editor preview**
2. **End-to-end testing of complete progressive experience**
3. **Performance optimization**
4. **Accessibility improvements**

## Success Criteria

1. **Bead-Instruction Correspondence**: Each instruction step highlights only its relevant beads
2. **Direction Clarity**: Users can see which direction each bead needs to move
3. **Progressive Revelation**: Only current step is active, future steps are dimmed
4. **Pedagogical Alignment**: Visual progression matches mathematical decomposition
5. **99+1 Test Case**:
   - Step 1: Show only hundreds bead with "up" indicator
   - Step 2: Show only ones column beads with "down" indicators
   - Step 3: Show only tens column beads with "down" indicators

## Technical Considerations

### Performance
- Minimize re-renders during step progression
- Efficient bead highlight calculations
- Smooth animations for step transitions

### Accessibility
- Screen reader announcements for step changes
- Keyboard navigation through steps
- High contrast direction indicators

### Backward Compatibility
- Maintain existing single-step tutorial functionality
- Graceful fallback for tutorials without multi-step data
- Preserve existing AbacusReact API surface

This plan provides a comprehensive roadmap for implementing the progressive multi-step instruction system with proper coordination between pedagogy, visual display, and user interaction.