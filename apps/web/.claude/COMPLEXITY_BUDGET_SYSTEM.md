# Complexity Budget System

## Overview

The complexity budget system controls problem difficulty by measuring the cognitive cost of each term in a problem. This allows us to:

1. **Cap difficulty** for beginners (max budget) - don't overwhelm with too many hard skills per term
2. **Require difficulty** for challenge problems (min budget) - ensure every term exercises real skills
3. **Personalize difficulty** based on student mastery - same problem is "harder" for students still learning

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         SESSION PLANNER                                  │
│  ┌─────────────────────┐    ┌─────────────────────────────────────────┐ │
│  │ PlayerSkillMastery  │───▶│ buildStudentSkillHistory()              │ │
│  │ (from DB)           │    │ ↓                                       │ │
│  └─────────────────────┘    │ StudentSkillHistory                     │ │
│                             │ ↓                                       │ │
│                             │ createSkillCostCalculator()             │ │
│                             │ ↓                                       │ │
│                             │ SkillCostCalculator                     │──┐
│                             └─────────────────────────────────────────┘ │ │
│                                                                          │ │
│  ┌─────────────────────┐    ┌─────────────────────────────────────────┐ │ │
│  │ purposeComplexity   │───▶│ getComplexityBoundsForSlot()            │ │ │
│  │ Bounds (config)     │    │ ↓                                       │ │ │
│  └─────────────────────┘    │ { min?: number, max?: number }          │──┼─┐
│                             └─────────────────────────────────────────┘ │ │ │
└──────────────────────────────────────────────────────────────────────────┘ │ │
                                                                             │ │
┌─────────────────────────────────────────────────────────────────────────┐ │ │
│                      PROBLEM GENERATOR                                   │ │ │
│                                                                          │ │ │
│  generateProblemFromConstraints(constraints, costCalculator) ◀───────────┘ │
│                               │                                            │
│                               ▼                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │ For each candidate term:                                            │  │
│  │   termCost = costCalculator.calculateTermCost(stepSkills)           │◀─┘
│  │                                                                      │
│  │   if (termCost > maxBudget) continue  // Too hard                   │
│  │   if (termCost < minBudget) continue  // Too easy                   │
│  │                                                                      │
│  │   candidates.push({ term, skillsUsed, complexityCost: termCost })   │
│  └─────────────────────────────────────────────────────────────────────┘
│                               │
│                               ▼
│  ┌─────────────────────────────────────────────────────────────────────┐
│  │ GenerationTrace (output)                                            │
│  │   - steps[].complexityCost                                          │
│  │   - totalComplexityCost                                             │
│  │   - minBudgetConstraint / budgetConstraint                          │
│  │   - skillMasteryContext (per-skill mastery for display)             │
│  └─────────────────────────────────────────────────────────────────────┘
└─────────────────────────────────────────────────────────────────────────┘
```

## Cost Calculation

### Base Skill Complexity (Intrinsic)

| Skill Category           | Base Cost | Rationale                  |
| ------------------------ | --------- | -------------------------- |
| `basic.*` (direct moves) | 0         | Trivial bead movements     |
| `fiveComplements.*`      | 1         | Single mental substitution |
| `tenComplements.*`       | 2         | Cross-column operation     |
| `advanced.cascading*`    | 3         | Multi-column propagation   |

### Mastery Multipliers (Student-Specific)

| Mastery State | Multiplier | Description                       |
| ------------- | ---------- | --------------------------------- |
| `effortless`  | 1×         | Automatic, no thought required    |
| `fluent`      | 2×         | Solid but needs some attention    |
| `practicing`  | 3×         | Currently working on, needs focus |
| `learning`    | 4×         | Just introduced, maximum effort   |

### Effective Cost Formula

```
effectiveCost = baseCost × masteryMultiplier
termCost = Σ(effectiveCost for each skill in term)
```

**Example**: `5 + 9 = 14` requires `tenComplements.9=10-1`

- For a beginner (learning): `2 × 4 = 8`
- For an expert (effortless): `2 × 1 = 2`

Same problem, different cognitive load.

## Configuration

### Purpose-Specific Complexity Bounds

```typescript
purposeComplexityBounds: {
  focus: {
    abacus:        { min: null, max: null },  // Full range
    visualization: { min: null, max: 3 },     // Cap for mental math
    linear:        { min: null, max: null },
  },
  reinforce: {
    abacus:        { min: null, max: null },
    visualization: { min: null, max: 3 },
    linear:        { min: null, max: null },
  },
  review: {
    abacus:        { min: null, max: null },
    visualization: { min: null, max: 3 },
    linear:        { min: null, max: null },
  },
  challenge: {
    abacus:        { min: 1, max: null },     // Require complement skills
    visualization: { min: 1, max: null },     // No cap, require min
    linear:        { min: 1, max: null },
  },
}
```

### What the Bounds Mean

- **`min: null`** - Any term is acceptable, including trivial `+1` direct additions
- **`min: 1`** - Every term must use at least one non-trivial skill (five-complement or higher)
- **`max: 3`** - No term can exceed cost 3 (prevents overwhelming visualization)
- **`max: null`** - No upper limit

## Data Flow

### 1. Session Planning

```typescript
// session-planner.ts
const skillMastery = await getAllSkillMastery(playerId);

// Build student-aware calculator
const studentHistory = buildStudentSkillHistory(skillMastery);
const costCalculator = createSkillCostCalculator(studentHistory);

// For each slot
const bounds = getComplexityBoundsForSlot(purpose, partType, config);
const slot = createSlot(index, purpose, constraints, partType, config);
slot.complexityBounds = bounds;

// Generate problem with calculator
slot.problem = generateProblemFromConstraints(slot.constraints, costCalculator);
```

### 2. Problem Generation

```typescript
// problem-generator.ts
function generateProblemFromConstraints(
  constraints: ProblemConstraints,
  costCalculator?: SkillCostCalculator,
): GeneratedProblem {
  // Pass through to generator
  const problem = generateSingleProblem({
    constraints: {
      ...generatorConstraints,
      minComplexityBudgetPerTerm: constraints.minComplexityBudgetPerTerm,
      maxComplexityBudgetPerTerm: constraints.maxComplexityBudgetPerTerm,
    },
    allowedSkills,
    costCalculator,
  });
}
```

### 3. Term Filtering

```typescript
// problemGenerator.ts - findValidNextTermWithTrace
const termCost = costCalculator?.calculateTermCost(stepSkills);

if (termCost !== undefined) {
  if (maxBudget !== undefined && termCost > maxBudget) continue;
  if (minBudget !== undefined && termCost < minBudget) continue;
}

candidates.push({ term, skillsUsed, complexityCost: termCost });
```

### 4. Trace Capture

```typescript
// Captured in GenerationTrace
{
  steps: [
    { termAdded: 4, skillsUsed: ['fiveComplements.4=5-1'], complexityCost: 2 },
    { termAdded: 9, skillsUsed: ['tenComplements.9=10-1'], complexityCost: 4 },
  ],
  totalComplexityCost: 6,
  minBudgetConstraint: 1,
  budgetConstraint: null,
  skillMasteryContext: {
    'fiveComplements.4=5-1': { masteryLevel: 'fluent', baseCost: 1, effectiveCost: 2 },
    'tenComplements.9=10-1': { masteryLevel: 'practicing', baseCost: 2, effectiveCost: 6 },
  }
}
```

## UI Display

### Purpose Tooltip (Enhanced)

The purpose badge tooltip shows complexity information:

```
⭐ Challenge

Harder problems - every term requires complement techniques.

┌─────────────────────────────────────────┐
│ Complexity                              │
│ ─────────────────────────────────────── │
│ Required: ≥1 per term   Actual: 2 avg   │
│                                         │
│ +4 (5-comp)  cost: 2  [fluent]          │
│ +9 (10-comp) cost: 4  [practicing]      │
│                                         │
│ Total: 6                                │
└─────────────────────────────────────────┘
```

## Future Extensions

### Mastery Recency (Not Implemented Yet)

The architecture supports adding recency-based mastery states:

**Scenarios to support:**

1. **Mastered + continuously practiced** → `effortless` (1×)
2. **Mastered + not practiced recently** → `rusty` (2.5×) - NEW STATE
3. **Recently mastered** → `fluent` (2×)

**Implementation path:**

1. **Track `masteredAt` timestamp** in `player_skill_mastery` table
2. **Add `rusty` state** to `MasteryState` type and multipliers:

   ```typescript
   export type MasteryState =
     | "effortless"
     | "fluent"
     | "rusty"
     | "practicing"
     | "learning";

   export const MASTERY_MULTIPLIERS: Record<MasteryState, number> = {
     effortless: 1,
     fluent: 2,
     rusty: 2.5, // NEW
     practicing: 3,
     learning: 4,
   };
   ```

3. **Enhance `dbMasteryToState` conversion:**

   ```typescript
   export function dbMasteryToState(
     dbLevel: "learning" | "practicing" | "mastered",
     daysSinceLastPractice?: number,
     daysSinceMastery?: number,
   ): MasteryState {
     if (dbLevel === "learning") return "learning";
     if (dbLevel === "practicing") return "practicing";

     // Mastered - but how rusty?
     if (daysSinceLastPractice !== undefined && daysSinceLastPractice > 14) {
       return "rusty"; // Mastered but neglected
     }
     if (daysSinceMastery !== undefined && daysSinceMastery > 30) {
       return "effortless"; // Long-term mastery + recent practice
     }
     return "fluent"; // Recently mastered
   }
   ```

**Why this is straightforward:**

- `SkillCostCalculator` is an interface - can swap implementations
- `dbMasteryToState` is the single conversion point - all recency logic goes here
- `StudentSkillState` interface already has documented extension points
- UI captures `skillMasteryContext` in trace - automatically displays new states

### Other Future Extensions

1. **Accuracy-based multipliers**: Students with <70% accuracy on a skill get higher multiplier
2. **Time-based decay**: Multiplier increases gradually based on days since practice
3. **Per-skill complexity overrides**: Some skills are harder for specific students

## Files Reference

| File                                        | Purpose                                        |
| ------------------------------------------- | ---------------------------------------------- |
| `src/utils/skillComplexity.ts`              | Base costs, mastery states, calculator factory |
| `src/utils/problemGenerator.ts`             | Term filtering with budget enforcement         |
| `src/lib/curriculum/problem-generator.ts`   | Wrapper that passes calculator through         |
| `src/lib/curriculum/session-planner.ts`     | Builds calculator, sets purpose bounds         |
| `src/db/schema/session-plans.ts`            | Type definitions, config defaults              |
| `src/components/practice/ActiveSession.tsx` | UI display of complexity data                  |

## Testing

### Verify Budget Enforcement

```typescript
// Existing test file: src/utils/__tests__/problemGenerator.budget.test.ts

describe('complexity budget', () => {
  it('rejects terms exceeding max budget', () => { ... })
  it('rejects terms below min budget', () => { ... })  // NEW
  it('uses student mastery to calculate cost', () => { ... })
})
```

### Verify UI Display

Check Storybook stories for `PurposeBadge` with complexity data visible.
