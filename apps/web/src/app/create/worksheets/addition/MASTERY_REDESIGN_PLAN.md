# Mastery Mode Redesign Plan

## Executive Summary

Redesign mastery mode to use a **1D slider that follows a curated path through 3D+ space**:

- **Dimension 1**: Digit count (1-5 digits)
- **Dimension 2**: Regrouping difficulty (0-100%)
- **Dimension 3**: Scaffolding level (full → minimal)

The slider maps to discrete steps on a **progression path** that zig-zags through this space, reintroducing scaffolding (ten-frames) as complexity (digit count) increases.

**Key insight**: This is NOT a new mode - it's just **smart difficulty with a progression system**. All three modes (Smart/Manual/Mastery) can eventually merge into one unified UI.

## The Problem We're Solving

**Current issue**: "We show ten-frames for 2-digit regrouping, then never show them again even when we jump to 3-digit regrouping"

**Root cause**: Current "skills" are flat - no concept of scaffolding cycling as complexity increases.

**Solution**: Define a progression path where scaffolding cycles:

- 2-digit WITH ten-frames → 2-digit WITHOUT ten-frames
- 3-digit WITH ten-frames → 3-digit WITHOUT ten-frames (ten-frames return!)
- 4-digit WITH ten-frames → 4-digit WITHOUT ten-frames (ten-frames return again!)

## Architecture: No New Worksheet Config Version

**IMPORTANT**: This does NOT create a new worksheet config version.

Current worksheet config (version 4) already has everything we need:

- `digitRange: { min, max }`
- `regroupingConfig: { pAnyStart, pAllStart }`
- `displayRules: { tenFrames, carryBoxes, ... }`
- `operator: 'addition' | 'subtraction' | 'mixed'`

The mastery progression is just **pre-defined combinations** of these existing fields.

## Core Concepts

### 1. Technique (What Skill?)

The actual mathematical skill being practiced:

- **basic-addition**: No carrying
- **single-carry**: Carrying in one place value
- **multi-carry**: Carrying in multiple places
- **basic-subtraction**: No borrowing
- **single-borrow**: Borrowing from one place
- **multi-borrow**: Borrowing across multiple places

**Just 6 techniques total.**

### 2. Complexity (How Hard?)

Problem characteristics:

- Digit count (1, 2, 3, 4, 5 digits)
- Regrouping frequency (0%, 50%, 100%)
- Regrouping positions (ones only, tens only, multiple places)

**~13 complexity levels total.**

### 3. Scaffolding (How Much Support?)

Visual scaffolding provided:

- **Full**: Ten-frames shown, carry boxes shown, place value colors
- **Partial**: No ten-frames, still have carry boxes and colors
- **Minimal**: Minimal visual aids

**2-3 scaffolding levels per (technique × complexity) pair.**

### 4. Progression Path = 1D Path Through 3D Space

Instead of letting users navigate freely through 3D space, we define a **curated learning path**:

```
Path for single-carry technique:

Step 1: (1-digit, 100% regroup, full scaffold)
Step 2: (1-digit, 100% regroup, minimal scaffold)  ← scaffolding fades
Step 3: (2-digit, 100% regroup, full scaffold)     ← digit ↑, scaffold RETURNS
Step 4: (2-digit, 100% regroup, minimal scaffold)  ← scaffolding fades
Step 5: (3-digit, 100% regroup, full scaffold)     ← digit ↑, scaffold RETURNS
Step 6: (3-digit, 100% regroup, minimal scaffold)  ← scaffolding fades
...
```

This is the **zig-zag pattern**: increase complexity → reintroduce scaffolding → fade scaffolding → repeat.

## UI Design

### Primary Control: Difficulty Slider

```
┌─────────────────────────────────────────────────────────┐
│ Difficulty Progression                                  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Easier ←―――――――●――――――――――――――――→ Harder               │
│                                                         │
│  Currently practicing:                                  │
│  • 2-digit problems                                     │
│  • Single-place carrying (ones place only)              │
│  • Full scaffolding (ten-frames shown)                  │
│                                                         │
│  Progress: [●●●●○○○○○○○○] Step 4 of 12                  │
│                                                         │
│  Next milestone:                                        │
│  → Same problems, less scaffolding (no ten-frames)      │
│                                                         │
│  [Show Advanced Controls ▼]                             │
└─────────────────────────────────────────────────────────┘
```

### Advanced Controls (Expandable)

When user clicks "Show Advanced Controls":

```
┌─────────────────────────────────────────────────────────┐
│ ▼ Advanced Controls                                     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Technique:                                              │
│  ○ Basic Addition    ● Single-carry    ○ Multi-carry   │
│                                                         │
│ Digit Count:                                            │
│  [1] [2] [3] [4] [5]  ← Button group                    │
│   ○  ●  ○  ○  ○                                        │
│                                                         │
│ Regrouping Frequency:                                   │
│  None ←―――――●―――――――→ Always                            │
│        (100% regrouping)                                │
│                                                         │
│ Scaffolding Level:                                      │
│  ● Full (ten-frames, carry boxes, colors)               │
│  ○ Partial (carry boxes, colors only)                   │
│  ○ Minimal (carry boxes only)                           │
│                                                         │
│  ⚠ Manual changes will move you off the progression path│
└─────────────────────────────────────────────────────────┘
```

### Interaction Flow

**Scenario 1: User drags slider right (easier → harder)**

1. Slider value changes: 33% → 42%
2. Map to progression step: Step 4 → Step 5
3. Step 5 config:
   - `digitRange: { min: 2, max: 2 }` (same)
   - `pAnyStart: 1.0` (same)
   - `tenFrames: 'whenRegrouping'` → `'never'` ← CHANGE
4. Display updates: "2-digit problems, independent practice (no ten-frames)"
5. Preview regenerates with new config

**Scenario 2: User drags slider further right**

1. Slider value: 42% → 50%
2. Map to step: Step 5 → Step 6
3. Step 6 config:
   - `digitRange: { min: 2, max: 2 }` → `{ min: 3, max: 3 }` ← DIGIT INCREASE
   - `pAnyStart: 1.0` (same)
   - `tenFrames: 'never'` → `'whenRegrouping'` ← SCAFFOLDING RETURNS!
4. Display updates: "3-digit problems with visual support (ten-frames)"
5. Preview regenerates

**Scenario 3: User manually changes digit count**

1. User expands "Advanced Controls"
2. User clicks "4" in digit count buttons
3. System searches progression path for nearest step with 4-digit
4. Finds Step 9: (4-digit, 80% regroup, full scaffold)
5. Slider jumps to 75% position
6. Display updates: "Moved to Step 9"
7. Warning shown: "You're now at 4-digit, but may want to practice 3-digit first"

## Data Structures

### 1. Progression Path Definition

```typescript
// File: src/app/create/worksheets/addition/progressionPath.ts

import type { WorksheetFormState } from "./types";

/**
 * A single step in the mastery progression path
 */
export interface ProgressionStep {
  // Unique ID for this step
  id: string;

  // Position in progression (0-based)
  stepNumber: number;

  // Which technique is being practiced
  technique:
    | "basic-addition"
    | "single-carry"
    | "multi-carry"
    | "basic-subtraction"
    | "single-borrow"
    | "multi-borrow";

  // Human-readable description
  name: string;
  description: string;

  // Complete worksheet configuration for this step
  // This is worksheet config v4 format - no new version!
  config: Partial<WorksheetFormState>;

  // Mastery tracking
  masteryThreshold: number; // e.g., 0.85 = 85% accuracy required
  minimumAttempts: number; // e.g., 15 problems minimum

  // What comes next?
  nextStepId: string | null;
  previousStepId: string | null;
}

/**
 * Complete progression path for single-carry technique
 */
export const SINGLE_CARRY_PATH: ProgressionStep[] = [
  // Step 0: 1-digit with full scaffolding
  {
    id: "single-carry-1d-full",
    stepNumber: 0,
    technique: "single-carry",
    name: "Single-digit carrying (with support)",
    description: "Practice carrying with single-digit problems and ten-frames",
    config: {
      digitRange: { min: 1, max: 1 },
      operator: "addition",
      pAnyStart: 1.0,
      pAllStart: 0,
      displayRules: {
        carryBoxes: "whenRegrouping",
        answerBoxes: "always",
        placeValueColors: "always",
        tenFrames: "whenRegrouping", // ← FULL SCAFFOLDING
        problemNumbers: "always",
        cellBorders: "always",
        borrowNotation: "never",
        borrowingHints: "never",
      },
      interpolate: false,
    },
    masteryThreshold: 0.9,
    minimumAttempts: 20,
    nextStepId: "single-carry-1d-minimal",
    previousStepId: null,
  },

  // Step 1: 1-digit with minimal scaffolding
  {
    id: "single-carry-1d-minimal",
    stepNumber: 1,
    technique: "single-carry",
    name: "Single-digit carrying (independent)",
    description: "Practice carrying without visual aids",
    config: {
      digitRange: { min: 1, max: 1 },
      operator: "addition",
      pAnyStart: 1.0,
      pAllStart: 0,
      displayRules: {
        carryBoxes: "whenRegrouping",
        answerBoxes: "always",
        placeValueColors: "always",
        tenFrames: "never", // ← SCAFFOLDING FADED
        problemNumbers: "always",
        cellBorders: "always",
        borrowNotation: "never",
        borrowingHints: "never",
      },
      interpolate: false,
    },
    masteryThreshold: 0.9,
    minimumAttempts: 20,
    nextStepId: "single-carry-2d-full",
    previousStepId: "single-carry-1d-full",
  },

  // Step 2: 2-digit with full scaffolding (SCAFFOLDING RETURNS!)
  {
    id: "single-carry-2d-full",
    stepNumber: 2,
    technique: "single-carry",
    name: "Two-digit carrying (with support)",
    description: "Apply carrying to two-digit problems with visual support",
    config: {
      digitRange: { min: 2, max: 2 },
      operator: "addition",
      pAnyStart: 1.0,
      pAllStart: 0,
      displayRules: {
        carryBoxes: "whenRegrouping",
        answerBoxes: "always",
        placeValueColors: "always",
        tenFrames: "whenRegrouping", // ← SCAFFOLDING RETURNS for new complexity!
        problemNumbers: "always",
        cellBorders: "always",
        borrowNotation: "never",
        borrowingHints: "never",
      },
      interpolate: false,
    },
    masteryThreshold: 0.85,
    minimumAttempts: 20,
    nextStepId: "single-carry-2d-minimal",
    previousStepId: "single-carry-1d-minimal",
  },

  // Step 3: 2-digit with minimal scaffolding
  {
    id: "single-carry-2d-minimal",
    stepNumber: 3,
    technique: "single-carry",
    name: "Two-digit carrying (independent)",
    description: "Practice two-digit carrying without visual aids",
    config: {
      digitRange: { min: 2, max: 2 },
      operator: "addition",
      pAnyStart: 1.0,
      pAllStart: 0,
      displayRules: {
        carryBoxes: "whenRegrouping",
        answerBoxes: "always",
        placeValueColors: "always",
        tenFrames: "never", // ← SCAFFOLDING FADED
        problemNumbers: "always",
        cellBorders: "always",
        borrowNotation: "never",
        borrowingHints: "never",
      },
      interpolate: false,
    },
    masteryThreshold: 0.85,
    minimumAttempts: 20,
    nextStepId: "single-carry-3d-full",
    previousStepId: "single-carry-2d-full",
  },

  // Step 4: 3-digit with full scaffolding (SCAFFOLDING RETURNS AGAIN!)
  {
    id: "single-carry-3d-full",
    stepNumber: 4,
    technique: "single-carry",
    name: "Three-digit carrying (with support)",
    description: "Apply carrying to three-digit problems with visual support",
    config: {
      digitRange: { min: 3, max: 3 },
      operator: "addition",
      pAnyStart: 1.0,
      pAllStart: 0,
      displayRules: {
        carryBoxes: "whenRegrouping",
        answerBoxes: "always",
        placeValueColors: "always",
        tenFrames: "whenRegrouping", // ← SCAFFOLDING RETURNS for 3-digit!
        problemNumbers: "always",
        cellBorders: "always",
        borrowNotation: "never",
        borrowingHints: "never",
      },
      interpolate: false,
    },
    masteryThreshold: 0.85,
    minimumAttempts: 20,
    nextStepId: "single-carry-3d-minimal",
    previousStepId: "single-carry-2d-minimal",
  },

  // Step 5: 3-digit with minimal scaffolding
  {
    id: "single-carry-3d-minimal",
    stepNumber: 5,
    technique: "single-carry",
    name: "Three-digit carrying (independent)",
    description: "Practice three-digit carrying without visual aids",
    config: {
      digitRange: { min: 3, max: 3 },
      operator: "addition",
      pAnyStart: 1.0,
      pAllStart: 0,
      displayRules: {
        carryBoxes: "whenRegrouping",
        answerBoxes: "always",
        placeValueColors: "always",
        tenFrames: "never", // ← SCAFFOLDING FADED
        problemNumbers: "always",
        cellBorders: "always",
        borrowNotation: "never",
        borrowingHints: "never",
      },
      interpolate: false,
    },
    masteryThreshold: 0.85,
    minimumAttempts: 20,
    nextStepId: null, // End of single-carry path
    previousStepId: "single-carry-3d-full",
  },
];

/**
 * Map slider value (0-100) to progression step
 */
export function getStepFromSliderValue(
  sliderValue: number,
  path: ProgressionStep[],
): ProgressionStep {
  const stepIndex = Math.round((sliderValue / 100) * (path.length - 1));
  return path[stepIndex];
}

/**
 * Map progression step to slider value (0-100)
 */
export function getSliderValueFromStep(
  stepNumber: number,
  pathLength: number,
): number {
  return (stepNumber / (pathLength - 1)) * 100;
}

/**
 * Find nearest step in path matching given config
 */
export function findNearestStep(
  config: Partial<WorksheetFormState>,
  path: ProgressionStep[],
): ProgressionStep {
  // Score each step by how well it matches config
  let bestMatch = path[0];
  let bestScore = -Infinity;

  for (const step of path) {
    let score = 0;

    // Match digit range (most important)
    if (
      step.config.digitRange?.min === config.digitRange?.min &&
      step.config.digitRange?.max === config.digitRange?.max
    ) {
      score += 100;
    }

    // Match regrouping config
    if (step.config.pAnyStart === config.pAnyStart) score += 50;
    if (step.config.pAllStart === config.pAllStart) score += 50;

    // Match scaffolding (ten-frames)
    if (
      step.config.displayRules?.tenFrames === config.displayRules?.tenFrames
    ) {
      score += 30;
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = step;
    }
  }

  return bestMatch;
}
```

### 2. Database Schema (No Changes Needed!)

**Current database** (already exists):

```sql
CREATE TABLE worksheet_mastery (
  user_id TEXT NOT NULL,
  skill_id TEXT NOT NULL,  -- Can be step ID like 'single-carry-2d-full'
  is_mastered BOOLEAN NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  correct_count INTEGER NOT NULL DEFAULT 0,
  last_practiced_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, skill_id)
);
```

We can reuse this table! Just use step IDs as skill IDs:

- Old: `skill_id = 'td-ones-regroup'`
- New: `skill_id = 'single-carry-2d-full'`

**Migration**: Map old skill IDs to new step IDs.

### 3. UI Component Structure

```typescript
// File: src/app/create/worksheets/addition/components/config-panel/ProgressionModePanel.tsx

import { useState } from 'react'
import { SINGLE_CARRY_PATH, getStepFromSliderValue, getSliderValueFromStep } from '../../progressionPath'
import type { WorksheetFormState } from '../../types'

interface ProgressionModePanelProps {
  formState: WorksheetFormState
  onChange: (updates: Partial<WorksheetFormState>) => void
  isDark?: boolean
}

export function ProgressionModePanel({ formState, onChange, isDark }: ProgressionModePanelProps) {
  // Current step (from formState.currentStepId or default to step 0)
  const currentStepId = formState.currentStepId ?? SINGLE_CARRY_PATH[0].id
  const currentStep = SINGLE_CARRY_PATH.find(s => s.id === currentStepId) ?? SINGLE_CARRY_PATH[0]

  // Slider value derived from step
  const sliderValue = getSliderValueFromStep(currentStep.stepNumber, SINGLE_CARRY_PATH.length)

  // Expanded/collapsed state for advanced controls
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Handle slider change
  const handleSliderChange = (newValue: number) => {
    const newStep = getStepFromSliderValue(newValue, SINGLE_CARRY_PATH)

    // Apply step's config to form state
    onChange({
      currentStepId: newStep.id,
      ...newStep.config,
    })
  }

  // Handle manual config changes
  const handleManualChange = (updates: Partial<WorksheetFormState>) => {
    onChange(updates)

    // Find nearest step matching new config
    const nearestStep = findNearestStep({ ...formState, ...updates }, SINGLE_CARRY_PATH)

    // Update step ID (might move off path)
    onChange({ currentStepId: nearestStep.id })
  }

  return (
    <div data-component="progression-mode-panel">
      {/* Slider */}
      <div>
        <label>Difficulty Progression</label>
        <input
          type="range"
          min={0}
          max={100}
          value={sliderValue}
          onChange={(e) => handleSliderChange(Number(e.target.value))}
        />
      </div>

      {/* Current status */}
      <div>
        <h4>Currently practicing:</h4>
        <ul>
          <li>{currentStep.config.digitRange?.min}-digit problems</li>
          <li>{currentStep.name}</li>
          <li>
            {currentStep.config.displayRules?.tenFrames === 'whenRegrouping'
              ? 'Full scaffolding (ten-frames shown)'
              : 'Independent practice (no ten-frames)'}
          </li>
        </ul>
      </div>

      {/* Progress dots */}
      <div>
        Progress:
        {SINGLE_CARRY_PATH.map((step, i) => (
          <span key={step.id}>
            {i <= currentStep.stepNumber ? '●' : '○'}
          </span>
        ))}
        Step {currentStep.stepNumber + 1} of {SINGLE_CARRY_PATH.length}
      </div>

      {/* Next milestone */}
      {currentStep.nextStepId && (
        <div>
          Next milestone: {SINGLE_CARRY_PATH.find(s => s.id === currentStep.nextStepId)?.description}
        </div>
      )}

      {/* Advanced controls */}
      <button onClick={() => setShowAdvanced(!showAdvanced)}>
        {showAdvanced ? 'Hide' : 'Show'} Advanced Controls
      </button>

      {showAdvanced && (
        <div>
          {/* Digit count buttons */}
          <div>
            <label>Digit Count:</label>
            {[1, 2, 3, 4, 5].map(d => (
              <button
                key={d}
                onClick={() => handleManualChange({ digitRange: { min: d, max: d } })}
                data-selected={formState.digitRange?.min === d}
              >
                {d}
              </button>
            ))}
          </div>

          {/* Regrouping slider */}
          <div>
            <label>Regrouping Frequency:</label>
            <input
              type="range"
              min={0}
              max={100}
              value={(formState.pAnyStart ?? 0) * 100}
              onChange={(e) => handleManualChange({ pAnyStart: Number(e.target.value) / 100 })}
            />
          </div>

          {/* Scaffolding radio buttons */}
          <div>
            <label>Scaffolding:</label>
            <label>
              <input
                type="radio"
                checked={formState.displayRules?.tenFrames === 'whenRegrouping'}
                onChange={() => handleManualChange({
                  displayRules: { ...formState.displayRules, tenFrames: 'whenRegrouping' }
                })}
              />
              Full (ten-frames shown)
            </label>
            <label>
              <input
                type="radio"
                checked={formState.displayRules?.tenFrames === 'never'}
                onChange={() => handleManualChange({
                  displayRules: { ...formState.displayRules, tenFrames: 'never' }
                })}
              />
              Minimal (no ten-frames)
            </label>
          </div>

          <p>⚠ Manual changes may move you off the progression path</p>
        </div>
      )}
    </div>
  )
}
```

## Implementation Plan

### Phase 1: Core Infrastructure (Week 1)

**Goal**: Set up progression path system without changing UI

1. ✅ Create `progressionPath.ts` with `ProgressionStep` type
2. ✅ Define `SINGLE_CARRY_PATH` array (~6-8 steps)
3. ✅ Create utility functions:
   - `getStepFromSliderValue()`
   - `getSliderValueFromStep()`
   - `findNearestStep()`
4. ✅ Write tests for utility functions

**Deliverable**: Progression path data structure working, tested

### Phase 2: Update Mastery Mode UI (Week 1-2)

**Goal**: Replace current MasteryModePanel with slider-based UI

1. ✅ Create new `ProgressionModePanel` component
2. ✅ Implement slider that maps to progression steps
3. ✅ Show current step info (digit count, scaffolding, description)
4. ✅ Show progress dots (mastered vs remaining)
5. ✅ Add "Advanced Controls" expandable section
6. ✅ Wire up to existing mastery database (reuse `worksheet_mastery` table)

**Deliverable**: New UI working in mastery mode

### Phase 3: Migration and Polish (Week 2)

**Goal**: Migrate old "skills" to new "steps"

1. ✅ Create migration mapping:
   ```typescript
   const OLD_TO_NEW_SKILL_MAPPING = {
     "sd-simple-regroup": "single-carry-1d-full",
     "td-ones-regroup": "single-carry-2d-full",
     "xd-ones-regroup": "single-carry-3d-full",
     // ... etc
   };
   ```
2. ✅ Write database migration script (optional, or do lazy migration)
3. ✅ Update `AllSkillsModal` to show progression structure
4. ✅ Polish styling, add animations
5. ✅ User testing and feedback

**Deliverable**: Old mastery data works with new system

### Phase 4: Additional Paths (Week 3+)

**Goal**: Add more technique paths beyond single-carry

1. Create `BASIC_ADDITION_PATH` (no carrying)
2. Create `MULTI_CARRY_PATH` (multiple place carrying)
3. Create `SINGLE_BORROW_PATH` (subtraction)
4. Add technique selector to UI
5. Support multiple active paths simultaneously

**Deliverable**: Full progression system with all techniques

### Phase 5: Unify Modes (Future)

**Goal**: Merge Smart/Manual/Mastery into one unified UI

1. Recognize that all three modes set the same config fields
2. Create unified config panel with three "entry points":
   - Guided (progression path)
   - Preset (difficulty profiles)
   - Advanced (manual settings)
3. Remove mode selector entirely
4. Gentle migration messaging for users

**Deliverable**: Single unified worksheet configuration UI

## Testing Strategy

### Unit Tests

- Progression path utilities (`getStepFromSliderValue`, etc.)
- Step mapping logic
- Config merging

### Integration Tests

- Slider changes update config correctly
- Manual changes find nearest step
- Database mastery tracking works

### User Testing

- Can users understand the progression path?
- Is the slider intuitive?
- Do advanced controls make sense?

## Success Metrics

1. **Ten-frames return**: Verify ten-frames show for 3-digit after being hidden for 2-digit
2. **User progression**: Students complete more steps in sequence
3. **Mastery tracking**: Database shows gradual progress through steps
4. **User feedback**: Positive feedback on clarity of progression

## Open Questions

1. **How many steps per path?**
   - Current: 6 steps for single-carry (1d→2d→3d, each with 2 scaffolding levels)
   - Could extend to 4d, 5d for advanced students

2. **Should we support multiple paths simultaneously?**
   - User practices single-carry AND single-borrow in parallel?
   - Or linear: finish single-carry before starting single-borrow?

3. **What about mixed operations?**
   - Separate path for mixed add/subtract?
   - Or just increase difficulty within single paths?

4. **Database migration strategy?**
   - Lazy migration (map on read)?
   - Batch migration script?
   - Support both old and new skill IDs?

## Mode Unification Strategy

### Current State: Three Separate Modes

Users currently choose between three mutually exclusive modes:

- **Smart Difficulty**: Choose difficulty profile, get preset configs
- **Manual Control**: Set all parameters manually
- **Mastery Progression**: Follow skill-based progression

**Problem**: These feel like three different tools, but they all produce the same output (worksheet config v4).

### Proposed State: Unified Interface

**No mode selector.** One worksheet configuration UI with three "entry points":

```
┌─────────────────────────────────────────────────────────┐
│ How would you like to start?                            │
├─────────────────────────────────────────────────────────┤
│ ┌─────────────────┐  ┌─────────────────┐  ┌──────────┐│
│ │ 🎯 Guided Path  │  │ 📊 Quick Preset │  │ ⚙️ Custom││
│ │ Follow learning │  │ Choose standard │  │ Set all  ││
│ │ progression     │  │ difficulty      │  │ settings ││
│ └─────────────────┘  └─────────────────┘  └──────────┘│
└─────────────────────────────────────────────────────────┘
```

### The Three Entry Points

**1. Guided Path** (was "Mastery Mode"):

- Shows: Technique selector + difficulty slider
- Hides: Full configuration controls (until "Show All Settings" clicked)
- For: Teachers following curriculum, systematic learning

**2. Quick Preset** (was "Smart Difficulty"):

- Shows: Preset difficulty buttons (Beginner/Intermediate/Advanced/Expert)
- Hides: Full configuration controls (until "Show All Settings" clicked)
- For: Quick worksheet generation at standard levels

**3. Custom** (was "Manual Control"):

- Shows: Full configuration panel immediately
- Hides: Nothing (power user mode)
- For: Fine-grained control over all settings

### The Convergence: Progressive Disclosure

All three entry points lead to **the same underlying configuration**:

- **Guided Path** and **Quick Preset** start collapsed, showing simplified controls
- Clicking "Show All Settings" reveals the **full configuration panel**
- **Custom** starts with full panel already visible

**They're the same interface**, just with different default visibility states.

### Migration Phases

**Phase 1**: Keep three modes (current), fix mastery bugs

- No UI changes
- Fix ten-frames cycling issue
- Users see familiar interface

**Phase 2**: Add "Unified Mode" as 4th option

- New users default to unified interface
- Existing users can opt-in to try it
- Gather feedback, iterate
- Old modes remain available

**Phase 3**: Make unified the default

- New users see unified by default
- Existing users can still use old modes
- Deprecation notice on classic modes

**Phase 4**: Remove old modes (breaking change)

- Only unified interface remains
- Auto-migrate saved configs
- One-time user migration guide

### Benefits

1. **Simpler mental model**: One worksheet generator with different starting points
2. **Progressive disclosure**: Beginners not overwhelmed, experts get full control
3. **Smooth learning curve**: Start simple, gradually reveal complexity
4. **Less code**: One component instead of three
5. **No mode confusion**: No "which mode should I use?" decision paralysis
6. **Same output**: All paths produce worksheet config v4

## Summary

**What we're building**: A slider-based UI that follows a curated learning path through (digit count × regrouping × scaffolding) space.

**Why it works**: The path zig-zags to reintroduce scaffolding as complexity increases, solving the ten-frames problem.

**What doesn't change**: Worksheet config format (still v4), database schema, problem generation logic.

**What does change**: Mastery mode UI becomes "Guided Path" entry point, eventually merges with other modes.

**End goal**: One unified worksheet configuration interface with three entry points (Guided/Preset/Custom) instead of three separate modes.
