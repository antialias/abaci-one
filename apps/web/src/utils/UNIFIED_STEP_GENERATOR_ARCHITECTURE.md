# Unified Step Generator Architecture

**A comprehensive guide to the pedagogical decomposition system for soroban arithmetic operations.**

## Overview

The Unified Step Generator is the core algorithm that powers all soroban arithmetic tutorials, practice hints, and coaching features in this application. It generates mathematically correct, pedagogically sound step-by-step breakdowns of arithmetic operations that are perfectly synchronized across:

- **Mathematical decomposition** (the equation breakdown)
- **English instructions** (what to do in words)
- **Bead movements** (which beads move where)
- **State transitions** (abacus state at each step)
- **Skill tracking** (which pedagogical skills are exercised)

## Quick Reference

**Main Entry Point:**
```typescript
import { generateUnifiedInstructionSequence } from '@/utils/unifiedStepGenerator'

const sequence = generateUnifiedInstructionSequence(startValue, targetValue)
// Returns: UnifiedInstructionSequence with all tutorial data
```

**Current Limitations:**
- ✅ Addition: Fully implemented
- ❌ Subtraction: Throws `Error('Subtraction not implemented yet')` at line 705-708

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        User Interface Layer                                  │
│  ┌──────────────┐  ┌──────────────────┐  ┌─────────────────┐                │
│  │ TutorialPlayer│  │ DecompositionDisplay│  │ PracticeHelpPanel│               │
│  │ (step-by-step)│  │ (hover tooltips)    │  │ (coach hints)    │               │
│  └───────┬──────┘  └────────┬─────────┘  └────────┬────────┘                │
│          │                  │                     │                          │
│          └──────────────────┼─────────────────────┘                          │
│                             │                                                │
│                             ▼                                                │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    DecompositionContext                               │   │
│  │  - Manages highlighting state                                         │   │
│  │  - Provides term ↔ column mappings                                    │   │
│  │  - Handles hover/click coordination                                   │   │
│  └───────────────────────────┬──────────────────────────────────────────┘   │
│                              │                                               │
└──────────────────────────────┼───────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Core Algorithm Layer                                      │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │              generateUnifiedInstructionSequence()                     │   │
│  │                                                                       │   │
│  │  Input:  startValue, targetValue                                      │   │
│  │  Output: UnifiedInstructionSequence                                   │   │
│  │                                                                       │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │   │
│  │  │ Step 1: generateDecompositionTerms()                            │ │   │
│  │  │   - Process digits left-to-right (highest place first)          │ │   │
│  │  │   - Decision tree: a+d ≤ 9 → Direct/FiveComplement              │ │   │
│  │  │                    a+d > 9 → TenComplement/Cascade              │ │   │
│  │  │   - Returns: terms[], segmentsPlan[], decompositionSteps[]      │ │   │
│  │  └─────────────────────────────────────────────────────────────────┘ │   │
│  │                              │                                        │   │
│  │                              ▼                                        │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │   │
│  │  │ Step 2: Build unified steps (for each term)                     │ │   │
│  │  │   - calculateStepResult() → newValue                             │ │   │
│  │  │   - calculateStepBeadMovements() → StepBeadHighlight[]          │ │   │
│  │  │   - generateInstructionFromTerm() → English instruction          │ │   │
│  │  │   - validateStepConsistency() → isValid, issues[]               │ │   │
│  │  └─────────────────────────────────────────────────────────────────┘ │   │
│  │                              │                                        │   │
│  │                              ▼                                        │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │   │
│  │  │ Step 3: Build display structures                                │ │   │
│  │  │   - buildFullDecompositionWithPositions() → string + positions   │ │   │
│  │  │   - buildSegmentsWithPositions() → PedagogicalSegment[]         │ │   │
│  │  │   - generateSegmentReadable() → titles, summaries, chips         │ │   │
│  │  │   - buildEquationAnchors() → digit highlighting positions        │ │   │
│  │  └─────────────────────────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Core Data Structures

### UnifiedInstructionSequence

The main output of the system, containing everything needed for tutorials and help:

```typescript
interface UnifiedInstructionSequence {
  // The full equation string: "3 + 14 = 3 + 10 + (5 - 1) = 17"
  fullDecomposition: string

  // Whether decomposition adds pedagogical value (vs redundant "5 = 5")
  isMeaningfulDecomposition: boolean

  // Individual steps with all coordinated data
  steps: UnifiedStepData[]

  // High-level "chapters" explaining the why
  segments: PedagogicalSegment[]

  // Start/end values and step count
  startValue: number
  targetValue: number
  totalSteps: number

  // For highlighting addend digits in UI
  equationAnchors?: EquationAnchors
}
```

### UnifiedStepData

Each step contains perfectly synchronized information:

```typescript
interface UnifiedStepData {
  stepIndex: number

  // MATH: The term for this step
  mathematicalTerm: string          // e.g., "10", "-3", "5"
  termPosition: { startIndex, endIndex }  // Position in fullDecomposition

  // ENGLISH: Human-readable instruction
  englishInstruction: string        // e.g., "add 1 to tens"

  // STATE: Expected abacus state after this step
  expectedValue: number
  expectedState: AbacusState

  // BEADS: Which beads move (for arrows/highlights)
  beadMovements: StepBeadHighlight[]

  // VALIDATION: Self-consistency check
  isValid: boolean
  validationIssues?: string[]

  // TRACKING: Links to source
  segmentId?: string
  provenance?: TermProvenance
}
```

### PedagogicalSegment

Groups related steps into "chapters" with human-friendly explanations:

```typescript
interface PedagogicalSegment {
  id: string                    // e.g., "place-1-digit-4"
  place: number                 // Place value (0=ones, 1=tens, etc.)
  digit: number                 // The digit being added

  // Current abacus state at this place
  a: number                     // Current digit showing
  L: number                     // Earth beads active (0-4)
  U: 0 | 1                      // Heaven bead active?

  // Pedagogical classification
  goal: string                  // "Add 4 to tens with a carry"
  plan: SegmentDecision[]       // One or more rules applied

  // Term/step mappings
  expression: string            // "(100 - 90 - 6)" for complements
  stepIndices: number[]         // Which steps belong here
  termIndices: number[]         // Which terms belong here
  termRange: { startIndex, endIndex }  // Position in fullDecomposition

  // State snapshots
  startValue: number
  endValue: number
  startState: AbacusState
  endState: AbacusState

  // Human-friendly content for tooltips
  readable: SegmentReadable
}
```

### SegmentReadable

User-facing explanations generated for each segment:

```typescript
interface SegmentReadable {
  title: string           // "Make 10 — ones" or "Add 3 — tens"
  subtitle?: string       // "Using 10's friend"
  chips: Array<{ label: string; value: string }>  // Quick context
  why: string[]           // Bullet explanations
  carryPath?: string      // "Tens is 9 → hundreds +1; tens → 0"
  stepsFriendly: string[] // Bead instructions for each step
  showMath?: { lines: string[] }  // Math explanation
  summary: string         // 1-2 sentence plain English
  validation?: { ok: boolean; issues: string[] }  // Dev self-check
}
```

### TermProvenance

Links each term back to its source in the original problem:

```typescript
interface TermProvenance {
  rhs: number              // The addend (e.g., 25)
  rhsDigit: number         // The specific digit (e.g., 2 for tens)
  rhsPlace: number         // Place value (1=tens, 0=ones)
  rhsPlaceName: string     // "tens"
  rhsDigitIndex: number    // Index in addend string (for UI)
  rhsValue: number         // digit × 10^place (e.g., 20)
  groupId?: string         // Same ID for complement groups

  // For complement operations affecting multiple columns
  termPlace?: number       // Actual place this term affects
  termPlaceName?: string
  termValue?: number       // Actual value (e.g., 100, -90)
}
```

---

## The Pedagogical Decision Tree

The core algorithm for choosing how to add a digit at a place:

```
processDigitAtPlace(digit, place, currentDigit, currentState):

  a = currentDigit (what abacus shows at this place, 0-9)
  d = digit to add (1-9)
  L = earth beads active at place (0-4)
  U = heaven bead active (0 or 1)

  ┌─────────────────────────────────────────────────────────────────────┐
  │ CASE A: a + d ≤ 9 (fits without carry)                             │
  ├─────────────────────────────────────────────────────────────────────┤
  │                                                                     │
  │  IF d ≤ 4:                                                          │
  │    ├─ IF L + d ≤ 4:                                                 │
  │    │    → DIRECT: Add d earth beads                                 │
  │    │    Term: "d × 10^place"                                        │
  │    │                                                                │
  │    └─ ELSE (L + d > 4, but a + d ≤ 9 means heaven is off):          │
  │         → FIVE_COMPLEMENT: +5 - (5-d)                               │
  │         Terms: "5 × 10^place", "-(5-d) × 10^place"                  │
  │         Example: 3 + 4: have 3 earth, need 4 → +5 -1 → 7            │
  │                                                                     │
  │  IF d = 5:                                                          │
  │    → DIRECT: Activate heaven bead                                   │
  │    Term: "5 × 10^place"                                             │
  │                                                                     │
  │  IF d ≥ 6:                                                          │
  │    → DIRECT: Activate heaven + add (d-5) earth beads                │
  │    Terms: "5 × 10^place", "(d-5) × 10^place"                        │
  │                                                                     │
  └─────────────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────────────┐
  │ CASE B: a + d > 9 (requires carry)                                 │
  ├─────────────────────────────────────────────────────────────────────┤
  │                                                                     │
  │  nextPlaceDigit = digit at (place + 1)                              │
  │                                                                     │
  │  IF nextPlaceDigit ≠ 9:                                             │
  │    → SIMPLE TEN_COMPLEMENT: +10 - (10-d)                            │
  │    Terms: "10^(place+1)", "-(10-d) × 10^place"                      │
  │    Example: 7 + 5 → +10 -5 → 12                                     │
  │                                                                     │
  │  ELSE (nextPlaceDigit = 9):                                         │
  │    → CASCADE: Find highest non-9 place, add there, clear 9s         │
  │    Example: 99 + 5 → +100 -90 -5 → 104                              │
  │    Terms cascade through multiple places                            │
  │                                                                     │
  └─────────────────────────────────────────────────────────────────────┘
```

---

## The Four Pedagogical Rules

### 1. Direct
**When:** `a + d ≤ 9` and enough beads available
**What:** Simply add beads
**Example:** `3 + 2 = 5` (add 2 earth beads)

### 2. FiveComplement
**When:** `a + d ≤ 9` but not enough earth beads, heaven is inactive
**What:** `+d = +5 - (5-d)` — activate heaven, remove complement
**Example:** `3 + 4 = 7` → `+5 - 1` (activate heaven, remove 1 earth)

### 3. TenComplement
**When:** `a + d > 9` and next place is not 9
**What:** `+d = +10 - (10-d)` — add to next place, remove complement
**Example:** `7 + 5 = 12` → `+10 - 5` (add 1 to tens, remove 5 from ones)

### 4. Cascade
**When:** `a + d > 9` and next place is 9 (or chain of 9s)
**What:** Find first non-9 place, add there, clear all 9s
**Example:** `99 + 5 = 104` → `+100 - 90 - 5` (add 1 to hundreds, clear tens, subtract 5 from ones)

---

## Processing Order

**Addition processes digits LEFT TO RIGHT (highest place first).**

This is important because:
1. Carries propagate toward higher places
2. Processing high-to-low means we know the destination state before processing each digit
3. The decomposition string reads naturally (left-to-right like the original number)

```
Adding 45 to start value:
  Step 1: Process "4" at tens place
  Step 2: Process "5" at ones place
```

---

## Integration Points

### 1. DecompositionContext

**Location:** `src/contexts/DecompositionContext.tsx`

The React context that wraps components needing decomposition data:

```typescript
<DecompositionProvider startValue={0} targetValue={45}>
  <DecompositionDisplay />  {/* Shows interactive equation */}
  <AbacusWithHighlighting /> {/* Coordinated highlighting */}
</DecompositionProvider>
```

**Key features:**
- Memoized sequence generation
- Term ↔ column bidirectional mapping
- Highlighting state management
- Event coordination (hover, click)

### 2. DecompositionDisplay

**Location:** `src/components/decomposition/DecompositionDisplay.tsx`

Renders the interactive equation with:
- Hoverable terms that show tooltips
- Grouped segments (parenthesized complements)
- Current step highlighting
- Multi-line overflow handling

### 3. ReasonTooltip

**Location:** `src/components/decomposition/ReasonTooltip.tsx`

Rich tooltips showing:
- Rule name and emoji (✨ Direct, 🤝 Five's Friend, 🔟 Ten's Friend, 🌊 Cascade)
- Summary explanation
- Context chips (source digit, rod shows)
- Expandable details (math, bead steps, carry path)
- Provenance information

### 4. Practice Help System

**Location:** `src/hooks/usePracticeHelp.ts`

Progressive help levels using the unified sequence:
- **L0:** No help
- **L1:** Coach hint (from `segment.readable.summary`)
- **L2:** Decomposition display
- **L3:** Bead arrows (from `step.beadMovements`)

### 5. Skill Extraction

**Location:** `src/utils/skillExtraction.ts`

Maps pedagogical segments to mastery tracking:
- `Direct` → `basic.directAddition`, `basic.heavenBead`, `basic.simpleCombinations`
- `FiveComplement` → `fiveComplements.4=5-1`, etc.
- `TenComplement` → `tenComplements.9=10-1`, etc.
- `Cascade` → Same as TenComplement (underlying skill)

---

## Test Coverage

**292 snapshot tests** protect the algorithm across:
- 41 Direct entry cases
- 25 Five-complement cases
- 28 Ten-complement cases
- 25 Cascading cases
- 18 Mixed operation cases
- 25 Edge cases
- 15 Large number operations
- 50 Systematic coverage tests
- 8 Stress test cases
- 21 Regression prevention cases

See `src/utils/__tests__/SNAPSHOT_TEST_SUMMARY.md` for details.

---

## Validation System

Each step is validated for self-consistency:

```typescript
validateStepConsistency(term, instruction, startValue, expectedValue, beadMovements, toState)
```

Checks:
1. Bead movements produce the expected state
2. Earth bead counts stay in valid range (0-4)
3. Heaven bead state is boolean
4. Simulated state matches expected state
5. Numeric value matches

Validation results are stored in `step.isValid` and `step.validationIssues`.

---

## Known Limitations

### Subtraction Not Implemented

The system currently only handles addition. Subtraction throws an error:

```typescript
if (addend < 0) {
  throw new Error('Subtraction not implemented yet')
}
```

See `SUBTRACTION_IMPLEMENTATION_PLAN.md` for the planned implementation.

### Processing Order Fixed

The left-to-right (high-to-low place) processing order is hardcoded. This works well for addition but may need reconsideration for subtraction (where borrowing propagates differently).

---

## File Map

```
src/utils/
├── unifiedStepGenerator.ts           # Core algorithm (1764 lines)
├── abacusInstructionGenerator.ts     # Re-exports + legacy helpers
├── skillExtraction.ts                # Maps rules to skill IDs
├── UNIFIED_STEP_GENERATOR_ARCHITECTURE.md  # This document
├── SUBTRACTION_IMPLEMENTATION_PLAN.md      # Subtraction design
└── __tests__/
    ├── pedagogicalSnapshot.test.ts   # 292 snapshot tests
    ├── unifiedStepGenerator.correctness.test.ts
    ├── provenance.test.ts
    └── SNAPSHOT_TEST_SUMMARY.md

src/contexts/
└── DecompositionContext.tsx          # React context wrapper

src/components/decomposition/
├── DecompositionDisplay.tsx          # Interactive equation display
├── ReasonTooltip.tsx                 # Pedagogical tooltips
├── README.md                         # Component usage guide
├── decomposition.css
└── reason-tooltip.css

src/hooks/
└── usePracticeHelp.ts               # Progressive help hook

src/components/practice/
└── coachHintGenerator.ts            # Simple hint extraction
```

---

## Extension Guide

### Adding a New Pedagogical Rule

1. Add to `PedagogicalRule` type:
```typescript
export type PedagogicalRule = 'Direct' | 'FiveComplement' | 'TenComplement' | 'Cascade' | 'NewRule'
```

2. Add decision function in `unifiedStepGenerator.ts`:
```typescript
function decisionForNewRule(...): SegmentDecision[] { ... }
```

3. Update `determineSegmentDecisions()` to detect and return the new rule

4. Update `generateSegmentReadable()` with title/summary for the rule

5. Update `ReasonTooltip` with emoji and description

6. Update `skillExtraction.ts` to map to skill IDs

7. Add snapshot tests

### Adding Multi-Step Animations

The `beadMovements` array on each step is already ordered:
1. Higher place first
2. Heaven beads before earth
3. Activations before deactivations

Use `step.beadMovements[].order` for animation sequencing.

---

## Glossary

| Term | Definition |
|------|------------|
| **Place** | Position in number (0=ones, 1=tens, 2=hundreds) |
| **Heaven bead** | The single bead above the reckoning bar (value: 5) |
| **Earth beads** | The four beads below the reckoning bar (value: 1 each) |
| **Complement** | The number that adds to make 5 or 10 |
| **Cascade** | Chain reaction through consecutive 9s |
| **Provenance** | Tracking where a term came from in the original problem |
| **Segment** | Group of related terms forming one pedagogical "chapter" |

---

*Last updated: December 2024*
