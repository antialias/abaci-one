# Mastery Mode V2: Technique + Complexity Architecture

## Problem with V1

Current "skills" conflate two orthogonal concepts:

- **Techniques** (carrying, borrowing) - actual new skills to learn
- **Complexity** (digit count, regrouping frequency) - problem difficulty

This leads to artificial "skills" like "Two-digit without regrouping" which aren't really skills.

## V2 Architecture: Separate Techniques from Complexity

### Core Concepts

**Technique** = A mathematical procedure/algorithm

- Carrying (regrouping) in addition
- Borrowing (regrouping) in subtraction
- Multi-column operations
- Place value alignment

**Complexity Level** = Problem characteristics

- Digit range (1-5 digits)
- Regrouping frequency (never, sometimes, always)
- Regrouping positions (ones only, tens only, multiple places)

**Scaffolding Level** = Amount of visual support (affects learning progression)

- With ten-frames (visual scaffolding for regrouping)
- Without ten-frames (internalized concept)
- With carry/borrow notation
- Without carry/borrow notation

**Key Insight**: Scaffolding should CYCLE as complexity increases!

- 2-digit regrouping WITH ten-frames → 2-digit regrouping WITHOUT ten-frames
- 3-digit regrouping WITH ten-frames → 3-digit regrouping WITHOUT ten-frames
- Pattern repeats: new complexity = reintroduce scaffolding, then fade it

**Practice Objective** = Technique × Complexity

- "Practice carrying with 2-digit problems where only ones place regroups"
- "Practice basic addition with 3-digit numbers (no carrying)"

### Data Model

```typescript
// Core technique being practiced
interface Technique {
  id: TechniqueId;
  name: string;
  description: string;
  operator: "addition" | "subtraction";

  // Prerequisites are OTHER techniques
  prerequisites: TechniqueId[];

  // Recommended scaffolding for this technique
  recommendedScaffolding: Partial<DisplayRules>;
}

// Problem complexity configuration
interface ComplexityLevel {
  id: string;
  name: string;
  description: string;

  // Problem generation parameters
  digitRange: { min: number; max: number };
  regroupingConfig: { pAnyStart: number; pAllStart: number };

  // Scaffolding adjustments for this complexity
  scaffoldingAdjustments?: Partial<DisplayRules>;
}

// Scaffolding level (affects learning progression)
type ScaffoldingLevel = "full" | "partial" | "minimal";

// A learnable practice objective
interface PracticeObjective {
  id: string;
  name: string;
  description: string;

  // What technique is being practiced?
  technique: TechniqueId;

  // At what complexity level?
  complexity: ComplexityLevel;

  // With what scaffolding level?
  scaffolding: ScaffoldingLevel;

  // Scaffolding overrides for this specific objective
  // Example: 'full' = tenFrames: 'whenRegrouping', 'minimal' = tenFrames: 'never'
  scaffoldingOverrides: Partial<DisplayRules>;

  // Final config = technique.scaffolding + complexity.adjustments + scaffolding.overrides

  // Mastery tracking
  masteryThreshold: number;
  minimumAttempts: number;

  // What objectives should come next?
  // Usually: same technique+complexity with less scaffolding, OR
  //          same technique with higher complexity and full scaffolding
  nextObjectives: string[];
}

// Technique IDs
type TechniqueId =
  | "basic-addition" // No carrying
  | "single-carry" // Carrying in one place
  | "multi-carry" // Carrying in multiple places
  | "basic-subtraction" // No borrowing
  | "single-borrow" // Borrowing from one place
  | "multi-borrow"; // Borrowing across multiple places
```

### Scaffolding Fade Pattern

For each (technique × complexity) combination, progression follows:

```
New Complexity Level:
1. WITH scaffolding (ten-frames, carry boxes) ← learn the pattern
2. WITHOUT scaffolding ← internalize the concept
3. Move to next complexity → restart at step 1
```

**Example: Single-carry technique across complexities**

| Step | Complexity         | Ten-frames | Mastery Goal                         |
| ---- | ------------------ | ---------- | ------------------------------------ |
| 1    | 2-digit (ones)     | YES        | Learn carrying with visual support   |
| 2    | 2-digit (ones)     | NO         | Internalize without support          |
| 3    | 3-digit (ones)     | YES        | Apply to new complexity with support |
| 4    | 3-digit (ones)     | NO         | Internalize at new complexity        |
| 5    | 3-digit (multiple) | YES        | More complex regrouping with support |
| 6    | 3-digit (multiple) | NO         | Internalize complex regrouping       |

This creates **mini-cycles of scaffolding** rather than permanently removing support.

### Example: Progression Path

#### Addition Techniques

1. **Basic Addition** (no carrying)
   - Complexity: Single-digit → Two-digit → Three-digit
   - Scaffolding: Answer boxes, place value colors
   - Carry boxes: 'always' (show structure) or 'never' (cleaner)

2. **Single-place Carrying**
   - Complexity: Two-digit (ones) → Three-digit (ones) → Three-digit (tens)
   - Scaffolding: Carry boxes 'whenRegrouping', ten-frames 'whenRegrouping'

3. **Multi-place Carrying**
   - Complexity: Three-digit → Four-digit → Five-digit
   - Scaffolding: Carry boxes 'whenMultipleRegroups'

#### Subtraction Techniques

1. **Basic Subtraction** (no borrowing)
2. **Single-place Borrowing**
3. **Multi-place Borrowing**

### Complexity Progression

For each technique, students progress through complexity:

```typescript
const complexityLevels: ComplexityLevel[] = [
  {
    id: "single-digit",
    digitRange: { min: 1, max: 1 },
    regroupingConfig: { pAnyStart: 0, pAllStart: 0 },
  },
  {
    id: "two-digit-no-regroup",
    digitRange: { min: 2, max: 2 },
    regroupingConfig: { pAnyStart: 0, pAllStart: 0 },
    scaffoldingAdjustments: {
      carryBoxes: "always", // Show structure even when not carrying
    },
  },
  {
    id: "two-digit-ones-regroup",
    digitRange: { min: 2, max: 2 },
    regroupingConfig: { pAnyStart: 1.0, pAllStart: 0 },
  },
  {
    id: "two-digit-all-regroup",
    digitRange: { min: 2, max: 2 },
    regroupingConfig: { pAnyStart: 1.0, pAllStart: 1.0 },
  },
  // ... etc
];
```

### Benefits of This Model

1. **Clarity**: Clear separation between "learning new techniques" vs "practicing with harder numbers"
2. **Flexibility**: Same technique can be practiced at different complexity levels
3. **Scaffolding**: Technique defines baseline scaffolding, complexity can adjust
4. **Progression**: Natural progression: master technique at low complexity → increase complexity
5. **No fake skills**: "Two-digit without regrouping" is just complexity, not a technique

### UI Changes

#### Current (V1):

```
Skill: "Two-digit with ones place regrouping" ← confusing
```

#### New (V2):

```
Technique: Single-place Carrying
Complexity: Two-digit (ones place only)
```

Or simplified:

```
Practice: Carrying (ones place, 2-digit problems)
```

### Migration Strategy

1. **Phase 1**: New data structures (technique, complexity, objective)
2. **Phase 2**: Map existing 21 skills → technique + complexity combinations
3. **Phase 3**: Update UI to show "Technique + Complexity" instead of "Skill"
4. **Phase 4**: Migrate database mastery tracking (backwards compatible)

### Open Questions

1. **Should complexity be auto-progressive?**
   - Option A: Track mastery per (technique × complexity) separately
   - Option B: Once technique is mastered at any complexity, auto-advance complexity

2. **How to handle "show structure" scaffolding?**
   - "Two-digit without regrouping" wants carryBoxes='always' to show structure
   - But that's a complexity-level scaffolding choice, not technique-level

3. **Review mixing?**
   - Current: Review previous skills
   - New: Review previous techniques? Or previous complexity levels?

## Implementation Plan

### Step 1: Define Core Types

Create `techniques.ts` and `complexityLevels.ts`

### Step 2: Create Mapping

Map current 21 skills → (technique, complexity) pairs

### Step 3: Update UI

- MasteryModePanel shows technique + complexity
- AllSkillsModal groups by technique, shows complexity progression

### Step 4: Database Migration

- Keep `worksheet_mastery.skill_id` for backwards compatibility
- Or migrate to `technique_id` + `complexity_id`

### Step 5: Worksheet Generation

- Select technique → get base scaffolding
- Select complexity → get problem generation params + scaffolding adjustments
- Merge into final config

---

**Status**: Design phase - awaiting approval before implementation
