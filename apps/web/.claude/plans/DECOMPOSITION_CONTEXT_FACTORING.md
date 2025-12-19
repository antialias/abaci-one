# Plan: Factor Out DecompositionContext

## Goal

Create a standalone `DecompositionContext` that can be used anywhere in the app where we want to show an interactive decomposition display for an abacus problem. The context only needs `startValue` and `targetValue` as inputs and provides all the derived data and interaction handlers.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    DecompositionProvider                        │
│  Input: startValue, targetValue                                 │
│  Optional: currentStepIndex, onSegmentChange, onTermHover       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  generateUnifiedInstructionSequence(start, target)       │   │
│  │  → fullDecomposition, segments, steps, termPositions     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                            │                                    │
│                            ▼                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Derived Functions                                       │   │
│  │  • getColumnFromTermIndex(termIndex)                     │   │
│  │  • getTermIndicesFromColumn(columnIndex)                 │   │
│  │  • getGroupTermIndicesFromTermIndex(termIndex)           │   │
│  └─────────────────────────────────────────────────────────┘   │
│                            │                                    │
│                            ▼                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Interactive State                                       │   │
│  │  • activeTermIndices: Set<number>                        │   │
│  │  • activeIndividualTermIndex: number | null              │   │
│  │  • handleTermHover, handleColumnHover                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐   ┌─────────────────┐   ┌─────────────────┐
│ TutorialPlayer │   │ Practice Help   │   │ Future Uses     │
│               │   │ Panel           │   │ (Flashcards,    │
│ Wraps with    │   │                 │   │  Games, etc.)   │
│ Provider,     │   │ Wraps term help │   │                 │
│ syncs step    │   │ with Provider   │   │                 │
└───────────────┘   └─────────────────┘   └─────────────────┘
```

## Implementation Steps

### Step 1: Create DecompositionContext

**File:** `src/contexts/DecompositionContext.tsx`

```typescript
'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  generateUnifiedInstructionSequence,
  type PedagogicalSegment,
  type UnifiedInstructionSequence,
  type UnifiedStepData,
} from '@/utils/unifiedStepGenerator'

// ============================================================================
// Types
// ============================================================================

export interface DecompositionContextConfig {
  /** Starting abacus value */
  startValue: number
  /** Target abacus value to reach */
  targetValue: number
  /** Current step index for highlighting (optional) */
  currentStepIndex?: number
  /** Callback when active segment changes (optional) */
  onSegmentChange?: (segment: PedagogicalSegment | null) => void
  /** Callback when a term is hovered (optional) */
  onTermHover?: (termIndex: number | null, columnIndex: number | null) => void
  /** Number of abacus columns for column mapping (default: 5) */
  abacusColumns?: number
}

export interface DecompositionContextType {
  // Generated data
  sequence: UnifiedInstructionSequence
  fullDecomposition: string
  isMeaningfulDecomposition: boolean
  termPositions: Array<{ startIndex: number; endIndex: number }>
  segments: PedagogicalSegment[]
  steps: UnifiedStepData[]

  // Configuration
  startValue: number
  targetValue: number
  currentStepIndex: number
  abacusColumns: number

  // Highlighting state
  activeTermIndices: Set<number>
  setActiveTermIndices: (indices: Set<number>) => void
  activeIndividualTermIndex: number | null
  setActiveIndividualTermIndex: (index: number | null) => void

  // Derived functions
  getColumnFromTermIndex: (termIndex: number, useGroupColumn?: boolean) => number | null
  getTermIndicesFromColumn: (columnIndex: number) => number[]
  getGroupTermIndicesFromTermIndex: (termIndex: number) => number[]

  // Event handlers
  handleTermHover: (termIndex: number, isHovering: boolean) => void
  handleColumnHover: (columnIndex: number, isHovering: boolean) => void
}

// ============================================================================
// Context
// ============================================================================

const DecompositionContext = createContext<DecompositionContextType | null>(null)

export function useDecomposition(): DecompositionContextType {
  const context = useContext(DecompositionContext)
  if (!context) {
    throw new Error('useDecomposition must be used within a DecompositionProvider')
  }
  return context
}

// Optional hook that returns null if not in provider (for conditional usage)
export function useDecompositionOptional(): DecompositionContextType | null {
  return useContext(DecompositionContext)
}

// ============================================================================
// Provider
// ============================================================================

interface DecompositionProviderProps extends DecompositionContextConfig {
  children: ReactNode
}

export function DecompositionProvider({
  startValue,
  targetValue,
  currentStepIndex = 0,
  onSegmentChange,
  onTermHover,
  abacusColumns = 5,
  children,
}: DecompositionProviderProps) {
  // -------------------------------------------------------------------------
  // Generate sequence (memoized on value changes)
  // -------------------------------------------------------------------------
  const sequence = useMemo(
    () => generateUnifiedInstructionSequence(startValue, targetValue),
    [startValue, targetValue]
  )

  // -------------------------------------------------------------------------
  // Highlighting state
  // -------------------------------------------------------------------------
  const [activeTermIndices, setActiveTermIndices] = useState<Set<number>>(new Set())
  const [activeIndividualTermIndex, setActiveIndividualTermIndex] = useState<number | null>(null)

  // -------------------------------------------------------------------------
  // Derived: term positions from steps
  // -------------------------------------------------------------------------
  const termPositions = useMemo(
    () => sequence.steps.map((step) => step.termPosition),
    [sequence.steps]
  )

  // -------------------------------------------------------------------------
  // Derived function: Get column index from term index
  // -------------------------------------------------------------------------
  const getColumnFromTermIndex = useCallback(
    (termIndex: number, useGroupColumn = false): number | null => {
      const step = sequence.steps[termIndex]
      if (!step?.provenance) return null

      // For group highlighting: use rhsPlace (target column of the operation)
      // For individual term: use termPlace (specific column this term affects)
      const placeValue = useGroupColumn
        ? step.provenance.rhsPlace
        : (step.provenance.termPlace ?? step.provenance.rhsPlace)

      // Convert place value to column index (rightmost column is highest index)
      return abacusColumns - 1 - placeValue
    },
    [sequence.steps, abacusColumns]
  )

  // -------------------------------------------------------------------------
  // Derived function: Get term indices that affect a given column
  // -------------------------------------------------------------------------
  const getTermIndicesFromColumn = useCallback(
    (columnIndex: number): number[] => {
      const placeValue = abacusColumns - 1 - columnIndex
      return sequence.steps
        .map((step, index) => ({ step, index }))
        .filter(({ step }) => {
          if (!step.provenance) return false
          return (
            step.provenance.rhsPlace === placeValue ||
            step.provenance.termPlace === placeValue
          )
        })
        .map(({ index }) => index)
    },
    [sequence.steps, abacusColumns]
  )

  // -------------------------------------------------------------------------
  // Derived function: Get all term indices in the same complement group
  // -------------------------------------------------------------------------
  const getGroupTermIndicesFromTermIndex = useCallback(
    (termIndex: number): number[] => {
      const step = sequence.steps[termIndex]
      if (!step?.provenance) return [termIndex]

      const groupId = step.provenance.groupId
      if (!groupId) return [termIndex]

      // Find all steps with the same groupId
      return sequence.steps
        .map((s, i) => ({ step: s, index: i }))
        .filter(({ step: s }) => s.provenance?.groupId === groupId)
        .map(({ index }) => index)
    },
    [sequence.steps]
  )

  // -------------------------------------------------------------------------
  // Event handler: Term hover
  // -------------------------------------------------------------------------
  const handleTermHover = useCallback(
    (termIndex: number, isHovering: boolean) => {
      if (isHovering) {
        // Set individual term highlight
        setActiveIndividualTermIndex(termIndex)

        // Set group highlights
        const groupIndices = getGroupTermIndicesFromTermIndex(termIndex)
        setActiveTermIndices(new Set(groupIndices))

        // Notify external listener
        if (onTermHover) {
          const columnIndex = getColumnFromTermIndex(termIndex, true)
          onTermHover(termIndex, columnIndex)
        }
      } else {
        setActiveIndividualTermIndex(null)
        setActiveTermIndices(new Set())
        onTermHover?.(null, null)
      }
    },
    [getGroupTermIndicesFromTermIndex, getColumnFromTermIndex, onTermHover]
  )

  // -------------------------------------------------------------------------
  // Event handler: Column hover (for bidirectional abacus ↔ decomposition)
  // -------------------------------------------------------------------------
  const handleColumnHover = useCallback(
    (columnIndex: number, isHovering: boolean) => {
      if (isHovering) {
        const termIndices = getTermIndicesFromColumn(columnIndex)
        setActiveTermIndices(new Set(termIndices))
      } else {
        setActiveTermIndices(new Set())
      }
    },
    [getTermIndicesFromColumn]
  )

  // -------------------------------------------------------------------------
  // Effect: Notify when active segment changes
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!onSegmentChange) return

    const segment = sequence.segments.find((seg) =>
      seg.stepIndices?.includes(currentStepIndex)
    )
    onSegmentChange(segment || null)
  }, [currentStepIndex, sequence.segments, onSegmentChange])

  // -------------------------------------------------------------------------
  // Context value
  // -------------------------------------------------------------------------
  const value: DecompositionContextType = useMemo(
    () => ({
      // Generated data
      sequence,
      fullDecomposition: sequence.fullDecomposition,
      isMeaningfulDecomposition: sequence.isMeaningfulDecomposition,
      termPositions,
      segments: sequence.segments,
      steps: sequence.steps,

      // Configuration
      startValue,
      targetValue,
      currentStepIndex,
      abacusColumns,

      // Highlighting state
      activeTermIndices,
      setActiveTermIndices,
      activeIndividualTermIndex,
      setActiveIndividualTermIndex,

      // Derived functions
      getColumnFromTermIndex,
      getTermIndicesFromColumn,
      getGroupTermIndicesFromTermIndex,

      // Event handlers
      handleTermHover,
      handleColumnHover,
    }),
    [
      sequence,
      termPositions,
      startValue,
      targetValue,
      currentStepIndex,
      abacusColumns,
      activeTermIndices,
      activeIndividualTermIndex,
      getColumnFromTermIndex,
      getTermIndicesFromColumn,
      getGroupTermIndicesFromTermIndex,
      handleTermHover,
      handleColumnHover,
    ]
  )

  return (
    <DecompositionContext.Provider value={value}>
      {children}
    </DecompositionContext.Provider>
  )
}
```

### Step 2: Create Standalone DecompositionDisplay Component

**File:** `src/components/decomposition/DecompositionDisplay.tsx`

This will be a refactored version of `DecompositionWithReasons` that:

1. Uses `useDecomposition()` instead of `useTutorialContext()`
2. Receives no props (gets everything from context)
3. Can be dropped anywhere inside a `DecompositionProvider`

```typescript
"use client";

import { useDecomposition } from "@/contexts/DecompositionContext";
import { ReasonTooltip } from "./ReasonTooltip"; // Moved here
import "./decomposition.css";

export function DecompositionDisplay() {
  const {
    fullDecomposition,
    termPositions,
    segments,
    steps,
    currentStepIndex,
    activeTermIndices,
    activeIndividualTermIndex,
    handleTermHover,
    getGroupTermIndicesFromTermIndex,
  } = useDecomposition();

  // ... rendering logic (adapted from DecompositionWithReasons)
}
```

### Step 3: Refactor SegmentGroup

Pass `steps` as a prop instead of reading from TutorialContext:

```typescript
// Before:
function SegmentGroup({ segment, ... }) {
  const { unifiedSteps: steps } = useTutorialContext()
  // ...
}

// After:
function SegmentGroup({ segment, steps, ... }) {
  // steps comes from props (DecompositionDisplay passes it from context)
}
```

### Step 4: Update ReasonTooltip

The tooltip already has a conditional import pattern for TutorialUIContext. We keep that but also:

1. Move it to `src/components/decomposition/ReasonTooltip.tsx`
2. Receive `steps` as a prop instead of from context

### Step 5: Update TutorialPlayer Integration

**File:** `src/components/tutorial/TutorialPlayer.tsx`

Wrap the decomposition area with `DecompositionProvider`:

```typescript
// In TutorialPlayer:
<DecompositionProvider
  startValue={currentStep.startValue}
  targetValue={currentStep.targetValue}
  currentStepIndex={currentMultiStep}
  onSegmentChange={(segment) => ui.setActiveSegment(segment)}
  onTermHover={(termIndex, columnIndex) => {
    // Update abacus column highlighting
    setHighlightedColumn(columnIndex)
  }}
>
  <div data-element="decomposition-container">
    <DecompositionDisplay />
  </div>
</DecompositionProvider>
```

### Step 6: Integrate into Practice Help Panel

**File:** `src/components/practice/ActiveSession.tsx`

Add decomposition to the help panel:

```typescript
{/* Per-term help panel */}
{helpTermIndex !== null && helpContext && (
  <div data-section="term-help">
    {/* Header and dismiss button ... */}

    {/* NEW: Decomposition display */}
    <DecompositionProvider
      startValue={helpContext.currentValue}
      targetValue={helpContext.targetValue}
      currentStepIndex={currentHelpStepIndex}
    >
      <div data-element="decomposition-container">
        <DecompositionDisplay />
      </div>
    </DecompositionProvider>

    {/* Existing: Provenance breakdown */}
    {/* Existing: HelpAbacus */}
  </div>
)}
```

## File Structure After Refactoring

```
src/
├── contexts/
│   └── DecompositionContext.tsx     # NEW: Standalone context
│
├── components/
│   ├── decomposition/               # NEW: Shared decomposition components
│   │   ├── DecompositionDisplay.tsx
│   │   ├── TermSpan.tsx
│   │   ├── SegmentGroup.tsx
│   │   ├── ReasonTooltip.tsx        # MOVED from tutorial/
│   │   ├── decomposition.css        # MOVED from tutorial/
│   │   └── index.ts                 # Re-exports
│   │
│   ├── tutorial/
│   │   ├── TutorialPlayer.tsx       # UPDATED: Uses DecompositionProvider
│   │   ├── TutorialContext.tsx      # SIMPLIFIED: Remove decomposition logic
│   │   └── ...
│   │
│   └── practice/
│       ├── ActiveSession.tsx        # UPDATED: Uses DecompositionProvider
│       └── ...
```

## Migration Strategy

### Phase 1: Create New Context (Non-Breaking)

1. Create `DecompositionContext.tsx` with all logic
2. Create `DecompositionDisplay.tsx` using new context
3. Keep existing `DecompositionWithReasons.tsx` working

### Phase 2: Update TutorialPlayer

1. Wrap decomposition area with `DecompositionProvider`
2. Update TutorialPlayer to sync state via callbacks
3. Verify tutorial still works identically

### Phase 3: Integrate into Practice

1. Add `DecompositionProvider` to help panel
2. Render `DecompositionDisplay`
3. Test practice help flow

### Phase 4: Cleanup (Optional)

1. Remove decomposition logic from `TutorialContext`
2. Delete old `DecompositionWithReasons.tsx`
3. Update imports throughout codebase

## Testing Checklist

### Tutorial Mode

- [ ] Decomposition shows correctly for each step
- [ ] Current step is highlighted
- [ ] Term hover shows tooltip
- [ ] Term hover highlights related terms
- [ ] Term hover highlights abacus column
- [ ] Abacus column hover highlights related terms

### Practice Mode

- [ ] Decomposition shows when help is active
- [ ] Correct decomposition for current term (start → target)
- [ ] Tooltips work on hover
- [ ] Dark mode styling correct
- [ ] No console errors

### Edge Cases

- [ ] Single-digit addition (no meaningful decomposition)
- [ ] Multi-column carries
- [ ] Complement operations (five/ten complements)
- [ ] Very large numbers
- [ ] Empty/invalid values handled gracefully

## Risks and Mitigations

| Risk                                | Mitigation                                                          |
| ----------------------------------- | ------------------------------------------------------------------- |
| Breaking tutorial functionality     | Phase 2: Keep old code working in parallel during migration         |
| Performance: Re-generating sequence | useMemo ensures sequence only regenerates on value changes          |
| CSS conflicts                       | Move CSS to shared location, use consistent naming                  |
| Missing data in practice context    | `usePracticeHelp` already generates sequence - verify compatibility |

## Notes

### Why Not Just Pass Props?

We could pass all data as props, but:

1. Deep prop drilling through TermSpan, SegmentGroup, ReasonTooltip
2. Many components need same data
3. Interactive state (hover) needs to be shared
4. Context pattern is cleaner and more React-idiomatic

### Compatibility with usePracticeHelp

The `usePracticeHelp` hook already calls `generateUnifiedInstructionSequence()` and stores the result. For practice mode, we have two options:

1. **Option A:** Let `DecompositionProvider` regenerate (simple, slightly redundant)
2. **Option B:** Accept pre-generated `sequence` as prop (more efficient)

Recommend starting with Option A for simplicity, optimize later if needed.
