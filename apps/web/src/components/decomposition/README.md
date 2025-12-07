# Decomposition Display Components

**Interactive mathematical decomposition visualization for soroban addition/subtraction operations.**

## Overview

The decomposition system breaks down soroban arithmetic into step-by-step operations, showing users exactly how to perform calculations using complement-based methods. It supports:

- **Interactive term highlighting** - Hover over terms to see pedagogical explanations
- **Grouped operations** - Related terms (e.g., "+10 -3" for adding 7) are grouped visually
- **Current step tracking** - Integrates with tutorial/practice step progression
- **Abacus coordination** - Bidirectional highlighting between decomposition and abacus display

## Quick Start

```typescript
import { DecompositionProvider, DecompositionDisplay } from '@/components/decomposition'

// Basic usage - just provide start and target values
function MyComponent() {
  return (
    <DecompositionProvider startValue={45} targetValue={72}>
      <DecompositionDisplay />
    </DecompositionProvider>
  )
}
```

## Components

### DecompositionProvider

Context provider that generates all decomposition data from start/target values.

```typescript
interface DecompositionContextConfig {
  /** Starting value on the abacus */
  startValue: number
  /** Target value to reach */
  targetValue: number
  /** Current step index for highlighting (optional) */
  currentStepIndex?: number
  /** Number of abacus columns for coordinate mapping (default: 5) */
  abacusColumns?: number
  /** Callback when segment changes (optional) */
  onSegmentChange?: (segment: PedagogicalSegment | null) => void
  /** Callback when term is hovered (optional) */
  onTermHover?: (termIndex: number | null, columnIndex: number | null) => void
}
```

**Props:**
| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `startValue` | `number` | Yes | Initial abacus value |
| `targetValue` | `number` | Yes | Target value to calculate |
| `currentStepIndex` | `number` | No | Which step to highlight (default: 0) |
| `abacusColumns` | `number` | No | Number of columns for mapping (default: 5) |
| `onSegmentChange` | `function` | No | Called when user hovers a grouped segment |
| `onTermHover` | `function` | No | Called when user hovers individual term |

### DecompositionDisplay

Renders the interactive decomposition string with hoverable terms.

```typescript
import { DecompositionDisplay } from '@/components/decomposition'

// Must be inside a DecompositionProvider
<DecompositionDisplay />
```

The display automatically:
- Renders all terms from the decomposition
- Groups related terms (pedagogical segments)
- Shows tooltips with explanations on hover
- Highlights the current step
- Coordinates with external abacus highlighting

### ReasonTooltip

Tooltip component showing pedagogical reasoning for each term.

```typescript
import { ReasonTooltip } from '@/components/decomposition'

// Usually used internally by DecompositionDisplay
<ReasonTooltip
  reason={termReason}
  variant="blue"
  open={isOpen}
  onOpenChange={setIsOpen}
>
  <span>+10</span>
</ReasonTooltip>
```

## Hooks

### useDecomposition()

Access decomposition context data. Must be inside `DecompositionProvider`.

```typescript
const {
  // Data
  fullDecomposition,     // "45 +10 -3 +20" (full string)
  termPositions,         // Position metadata for each term
  segments,              // Grouped pedagogical segments
  steps,                 // Unified instruction steps
  currentStepIndex,      // Current highlighted step

  // Highlighting state
  activeTermIndices,     // Set of currently highlighted term indices
  activeIndividualTermIndex, // Single hovered term index

  // Actions
  setActiveTermIndices,  // Highlight multiple terms
  setActiveIndividualTermIndex, // Highlight single term
  getGroupTermIndicesFromTermIndex, // Get all terms in a group
  getColumnIndexFromTermIndex, // Map term to abacus column
} = useDecomposition()
```

### useDecompositionOptional()

Same as `useDecomposition()` but returns `null` outside provider (doesn't throw).

```typescript
const decomposition = useDecompositionOptional()

if (decomposition) {
  // Use decomposition data
}
```

## Integration Examples

### Tutorial Player

```typescript
import { DecompositionProvider, DecompositionDisplay } from '@/components/decomposition'

function TutorialPlayer({ step, currentMultiStep }) {
  return (
    <DecompositionProvider
      startValue={step.startValue}
      targetValue={step.targetValue}
      currentStepIndex={currentMultiStep}
      abacusColumns={5}
    >
      <div className="tutorial-content">
        <DecompositionDisplay />
        <AbacusWithHighlighting />
      </div>
    </DecompositionProvider>
  )
}
```

### Practice Help Panel

```typescript
import { DecompositionProvider, DecompositionDisplay } from '@/components/decomposition'

function PracticeHelpPanel({ currentValue, targetValue, helpLevel }) {
  // Show decomposition at help level 2+
  if (helpLevel < 2) return null

  return (
    <DecompositionProvider
      startValue={currentValue}
      targetValue={targetValue}
      abacusColumns={3}
    >
      <div className="step-by-step-help">
        <DecompositionDisplay />
      </div>
    </DecompositionProvider>
  )
}
```

### With Abacus Coordination

```typescript
function CoordinatedDisplay({ startValue, targetValue }) {
  const [highlightedColumn, setHighlightedColumn] = useState<number | null>(null)

  return (
    <DecompositionProvider
      startValue={startValue}
      targetValue={targetValue}
      onTermHover={(termIndex, columnIndex) => {
        setHighlightedColumn(columnIndex)
      }}
    >
      <DecompositionDisplay />
      <AbacusReact
        value={startValue}
        highlightedColumn={highlightedColumn}
      />
    </DecompositionProvider>
  )
}
```

## Architecture

### Data Flow

```
startValue, targetValue
         │
         ▼
generateUnifiedInstructionSequence()
         │
         ▼
┌────────────────────────────────────┐
│   DecompositionContext             │
│                                    │
│  - fullDecomposition: "45 +10 -3"  │
│  - termPositions: [{start, end}]   │
│  - segments: [PedagogicalSegment]  │
│  - steps: [UnifiedStep]            │
│  - highlighting state              │
└────────────────────────────────────┘
         │
         ▼
    DecompositionDisplay
         │
         ▼
    TermSpan / SegmentGroup
         │
         ▼
    ReasonTooltip (on hover)
```

### Key Types

```typescript
/** Position of a term in the decomposition string */
interface TermPosition {
  index: number           // Term index in sequence
  start: number          // Character start position
  end: number            // Character end position
  term: string           // The term text (e.g., "+10")
  value: number          // Numeric value
  columnIndex?: number   // Abacus column this affects
}

/** Group of related terms */
interface PedagogicalSegment {
  segmentIndex: number
  termIndices: number[]  // Which terms belong to this segment
  ruleName: string       // e.g., "Add 7 using complement"
  description: string    // User-friendly explanation
}

/** Pedagogical explanation for a term */
interface TermReason {
  name: string           // Rule name
  description: string    // Why this operation
  emoji: string          // Visual indicator
  variant: 'green' | 'blue' | 'purple' | 'orange' | 'gray'
  steps?: BeadStep[]     // Physical bead movements
  expansion?: string     // Mathematical expansion
  context?: string       // Additional context
}
```

## Styling

The components use CSS files for styling:

- `decomposition.css` - Term and segment styling
- `reason-tooltip.css` - Tooltip appearance

### CSS Classes

```css
.decomposition { }        /* Container */
.term { }                 /* Individual term */
.term--current { }        /* Current step highlight */
.term--active { }         /* Hovered/selected term */
.term--grouped { }        /* Term in a segment */
.segment-group { }        /* Grouped segment wrapper */
```

### Customization

Override CSS variables or classes:

```css
/* Custom term highlight color */
.term--current {
  background: rgba(139, 92, 246, 0.2);
  border-color: rgba(139, 92, 246, 0.6);
}

/* Custom tooltip variant */
.reason-tooltip--custom {
  border-color: #10b981;
  background: linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%);
}
```

## File Structure

```
src/components/decomposition/
├── README.md                    # This file
├── index.ts                     # Public exports
├── DecompositionDisplay.tsx     # Main display component
├── ReasonTooltip.tsx           # Tooltip with explanations
├── decomposition.css           # Term styling
└── reason-tooltip.css          # Tooltip styling

src/contexts/
└── DecompositionContext.tsx    # Provider and hooks
```

## Testing

```bash
# Type check
npm run type-check

# Lint
npm run lint

# Full pre-commit check
npm run pre-commit
```

## Related Documentation

**Parent**: [`apps/web/README.md`](../../../README.md) - Web application overview
**Tutorial System**: [`src/components/tutorial/`](../tutorial/) - Tutorial player integration
**Practice System**: [`src/components/practice/`](../practice/) - Practice help panel integration
**Instruction Generation**: [`src/utils/generateUnifiedInstructionSequence.ts`](../../utils/generateUnifiedInstructionSequence.ts) - Core algorithm

## Changelog

### v1.0.0 (December 2024)

- Initial standalone extraction from TutorialContext
- Decoupled from tutorial-specific UI context
- Added support for practice help panel integration
- Simplified API: only requires startValue and targetValue
