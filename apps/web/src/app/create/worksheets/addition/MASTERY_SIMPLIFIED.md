# Mastery System - Simplified for Worksheet Generation

## Core Principle

**Mastery mode is a configuration helper, not a game.**

It helps users quickly configure appropriate problem sets based on what skills have been mastered. No timers, no auto-advance, no time-based logic.

---

## Auto-Advance: REMOVED

**What we had**: Auto-advance toast with 5s timer

**What we need**: Just update the UI state, no automatic changes

**New behavior when user marks skill as mastered**:

```
User clicks "Mark as Mastered" on skill
    ↓
Update mastery state in database
    ↓
Update UI (checkmark, status indicator)
    ↓
THAT'S IT. Stay on current skill.
```

**To move to next skill**:

- User explicitly clicks "Practice This" on a different skill
- OR uses "Next Skill" / "Previous Skill" navigation buttons

**Rationale**: This is a worksheet generator. Users are configuring worksheets, not playing a progression game. They should have full control over what they're generating.

---

## Review Selection: Dependency Graph Only (No Time)

### Recency Windows: REMOVED

**What we had**: Time-based recency (30 days, 21 days, etc.)

**What we need**: Graph-based recency using prerequisite paths

### New Algorithm: "Recent in Dependency Graph"

**Definition**: A skill is "recently mastered" relative to current skill if it's on the **direct path** from root to current skill.

```typescript
/**
 * Get review skills based on dependency graph path
 * Returns skills that are direct prerequisites of current skill
 */
function getReviewSkills(
  currentSkill: SkillDefinition,
  masteryStates: Map<SkillId, MasteryState>,
): SkillId[] {
  // Simply return the current skill's recommendedReview list,
  // filtered to only include mastered skills
  return currentSkill.recommendedReview.filter((skillId) => {
    const state = masteryStates.get(skillId);
    return state?.isMastered === true;
  });
}
```

**Example**:

Current skill: `td-mixed-regroup`

```
Dependency path:
sd-no-regroup → sd-simple-regroup → td-no-regroup → td-ones-regroup → td-mixed-regroup
                                                                        ^^^^^^^^^^^^^^^^
                                                                        (you are here)

recommendedReview: ["td-no-regroup", "td-ones-regroup"]
```

**Review skills** (if mastered):

- `td-no-regroup` ✓ (if mastered)
- `td-ones-regroup` ✓ (if mastered)

That's it. No time calculations, no recency windows. Just "what's immediately behind you in the graph?"

---

## Simplified Skill Definitions

```typescript
export interface SkillDefinition {
  id: SkillId;
  name: string;
  description: string;
  operator: "addition" | "subtraction";

  // Problem generation
  digitRange: { min: number; max: number };
  regroupingConfig: { pAnyStart: number; pAllStart: number };
  recommendedScaffolding: DisplayRules;
  recommendedProblemCount: number;

  // Mastery validation (future)
  masteryThreshold: number; // e.g., 0.85 = 85% accuracy
  minimumAttempts: number;

  // Dependency graph
  prerequisites: SkillId[]; // Must master these first
  recommendedReview: SkillId[]; // Include these in review mix (1-2 recent prerequisites)
}
```

**Key change**: `recommendedReview` is **hand-curated**, not calculated. It's the 1-2 most relevant prerequisites for this skill.

### Example Definitions

```typescript
export const SKILL_DEFINITIONS: SkillDefinition[] = [
  // Single-digit
  {
    id: "sd-no-regroup",
    name: "Single-digit without regrouping",
    description: "3+5, 2+4",
    operator: "addition",
    digitRange: { min: 1, max: 1 },
    regroupingConfig: { pAnyStart: 0, pAllStart: 0 },
    recommendedScaffolding: {
      /* full scaffolding */
    },
    recommendedProblemCount: 20,
    masteryThreshold: 0.9,
    minimumAttempts: 20,
    prerequisites: [],
    recommendedReview: [], // First skill, no review
  },

  {
    id: "sd-simple-regroup",
    name: "Single-digit with regrouping",
    description: "7+8, 9+6",
    operator: "addition",
    digitRange: { min: 1, max: 1 },
    regroupingConfig: { pAnyStart: 1.0, pAllStart: 0 },
    recommendedScaffolding: {
      /* high scaffolding */
    },
    recommendedProblemCount: 20,
    masteryThreshold: 0.9,
    minimumAttempts: 20,
    prerequisites: ["sd-no-regroup"],
    recommendedReview: ["sd-no-regroup"], // Review the immediate prerequisite
  },

  // Two-digit
  {
    id: "td-no-regroup",
    name: "Two-digit without regrouping",
    description: "23+45, 31+28",
    operator: "addition",
    digitRange: { min: 2, max: 2 },
    regroupingConfig: { pAnyStart: 0, pAllStart: 0 },
    recommendedScaffolding: {
      /* medium scaffolding */
    },
    recommendedProblemCount: 15,
    masteryThreshold: 0.85,
    minimumAttempts: 15,
    prerequisites: ["sd-simple-regroup"],
    recommendedReview: ["sd-simple-regroup"], // Keep single-digit sharp
  },

  {
    id: "td-ones-regroup",
    name: "Two-digit with ones place regrouping",
    description: "38+27, 49+15",
    operator: "addition",
    digitRange: { min: 2, max: 2 },
    regroupingConfig: { pAnyStart: 0.5, pAllStart: 0 },
    recommendedScaffolding: {
      /* medium scaffolding */
    },
    recommendedProblemCount: 15,
    masteryThreshold: 0.85,
    minimumAttempts: 15,
    prerequisites: ["td-no-regroup"],
    recommendedReview: ["td-no-regroup"], // Focus on alignment + new regrouping
  },

  {
    id: "td-mixed-regroup",
    name: "Two-digit with mixed regrouping",
    description: "67+58, 84+73",
    operator: "addition",
    digitRange: { min: 2, max: 2 },
    regroupingConfig: { pAnyStart: 0.7, pAllStart: 0.2 },
    recommendedScaffolding: {
      /* reduced scaffolding */
    },
    recommendedProblemCount: 15,
    masteryThreshold: 0.85,
    minimumAttempts: 15,
    prerequisites: ["td-ones-regroup"],
    recommendedReview: ["td-no-regroup", "td-ones-regroup"], // Review both recent skills
  },

  {
    id: "td-full-regroup",
    name: "Two-digit with frequent regrouping",
    description: "88+99, 76+67",
    operator: "addition",
    digitRange: { min: 2, max: 2 },
    regroupingConfig: { pAnyStart: 0.9, pAllStart: 0.5 },
    recommendedScaffolding: {
      /* minimal scaffolding */
    },
    recommendedProblemCount: 15,
    masteryThreshold: 0.8,
    minimumAttempts: 15,
    prerequisites: ["td-mixed-regroup"],
    recommendedReview: ["td-ones-regroup", "td-mixed-regroup"], // Most recent two
  },

  // Three-digit
  {
    id: "3d-no-regroup",
    name: "Three-digit without regrouping",
    description: "234+451, 123+456",
    operator: "addition",
    digitRange: { min: 3, max: 3 },
    regroupingConfig: { pAnyStart: 0, pAllStart: 0 },
    recommendedScaffolding: {
      /* reduced scaffolding */
    },
    recommendedProblemCount: 12,
    masteryThreshold: 0.85,
    minimumAttempts: 12,
    prerequisites: ["td-full-regroup"],
    recommendedReview: ["td-mixed-regroup", "td-full-regroup"], // Keep 2-digit fresh
  },

  {
    id: "3d-simple-regroup",
    name: "Three-digit with occasional regrouping",
    description: "367+258, 484+273",
    operator: "addition",
    digitRange: { min: 3, max: 3 },
    regroupingConfig: { pAnyStart: 0.5, pAllStart: 0.1 },
    recommendedScaffolding: {
      /* minimal scaffolding */
    },
    recommendedProblemCount: 12,
    masteryThreshold: 0.8,
    minimumAttempts: 12,
    prerequisites: ["3d-no-regroup"],
    recommendedReview: ["td-full-regroup", "3d-no-regroup"], // Bridge from 2d to 3d
  },

  {
    id: "3d-full-regroup",
    name: "Three-digit with frequent regrouping",
    description: "888+999, 767+676",
    operator: "addition",
    digitRange: { min: 3, max: 3 },
    regroupingConfig: { pAnyStart: 0.9, pAllStart: 0.6 },
    recommendedScaffolding: {
      /* minimal scaffolding */
    },
    recommendedProblemCount: 12,
    masteryThreshold: 0.8,
    minimumAttempts: 12,
    prerequisites: ["3d-simple-regroup"],
    recommendedReview: ["3d-no-regroup", "3d-simple-regroup"], // Recent 3d only
  },

  // Four/five-digit
  {
    id: "4d-mastery",
    name: "Four-digit mastery",
    description: "3847+2956",
    operator: "addition",
    digitRange: { min: 4, max: 4 },
    regroupingConfig: { pAnyStart: 0.8, pAllStart: 0.4 },
    recommendedScaffolding: {
      /* minimal scaffolding */
    },
    recommendedProblemCount: 10,
    masteryThreshold: 0.8,
    minimumAttempts: 10,
    prerequisites: ["3d-full-regroup"],
    recommendedReview: ["3d-simple-regroup", "3d-full-regroup"], // Keep 3d sharp
  },

  {
    id: "5d-mastery",
    name: "Five-digit mastery",
    description: "38472+29563",
    operator: "addition",
    digitRange: { min: 5, max: 5 },
    regroupingConfig: { pAnyStart: 0.85, pAllStart: 0.5 },
    recommendedScaffolding: {
      /* minimal scaffolding */
    },
    recommendedProblemCount: 10,
    masteryThreshold: 0.75,
    minimumAttempts: 10,
    prerequisites: ["4d-mastery"],
    recommendedReview: ["3d-full-regroup", "4d-mastery"], // High-level review
  },
];
```

---

## Review Distribution Algorithm (Simplified)

```typescript
/**
 * Distribute review problems across mastered skills from recommendedReview list
 */
function distributeReviewProblems(
  currentSkill: SkillDefinition,
  masteryStates: Map<SkillId, MasteryState>,
  totalReviewCount: number,
): Map<SkillId, number> {
  // Get mastered skills from recommendedReview list
  const reviewSkills = currentSkill.recommendedReview.filter((skillId) => {
    const state = masteryStates.get(skillId);
    return state?.isMastered === true;
  });

  const distribution = new Map<SkillId, number>();

  if (reviewSkills.length === 0) {
    return distribution; // No review skills available
  }

  if (reviewSkills.length === 1) {
    // Only one review skill: give it all review problems
    distribution.set(reviewSkills[0], totalReviewCount);
    return distribution;
  }

  // Multiple review skills: distribute evenly
  const baseCount = Math.floor(totalReviewCount / reviewSkills.length);
  const remainder = totalReviewCount % reviewSkills.length;

  reviewSkills.forEach((skillId, index) => {
    const count = baseCount + (index < remainder ? 1 : 0);
    distribution.set(skillId, count);
  });

  return distribution;
}
```

**Example**:

Current skill: `td-mixed-regroup`

- `recommendedReview`: `["td-no-regroup", "td-ones-regroup"]`

Mastery state:

- `td-no-regroup`: ✓ mastered
- `td-ones-regroup`: ✓ mastered

Total review problems: 5

**Distribution**:

- `td-no-regroup`: 2 problems
- `td-ones-regroup`: 3 problems

Simple, deterministic, no time involved.

---

## UI Changes (Simplified)

### 1. Remove Auto-Advance Toast

**Old**: Toast with 5s timer

**New**: Simple confirmation message, no timer

```typescript
// When user marks skill as mastered
function handleMarkAsMastered(skillId: SkillId) {
  // Update database
  await updateMasteryState(skillId, true);

  // Show simple confirmation
  toast.success("Skill marked as mastered!");

  // Update UI state
  setMasteryStates((prev) =>
    new Map(prev).set(skillId, {
      ...prev.get(skillId)!,
      isMastered: true,
      masteredAt: new Date(),
    }),
  );

  // THAT'S IT. No auto-advance, no timers.
}
```

### 2. Navigation Buttons for Moving Between Skills

**New UI element**: Simple previous/next buttons

```
┌─────────────────────────────────────────────────────────┐
│ Current Skill: Two-digit ones regrouping            ✓   │
│                                                          │
│ [← Previous Skill]  [Mark as Mastered]  [Next Skill →]  │
└─────────────────────────────────────────────────────────┘
```

```typescript
function handleNextSkill() {
  const nextSkill = findNextSkill(currentSkillId, masteryStates);
  if (nextSkill) {
    setCurrentSkillId(nextSkill.id);
    // Regenerate preview with new skill
  }
}

function handlePreviousSkill() {
  const prevSkill = findPreviousSkill(currentSkillId, masteryStates);
  if (prevSkill) {
    setCurrentSkillId(prevSkill.id);
    // Regenerate preview with new skill
  }
}
```

### 3. "All Skills" Modal - Simplified

**Old**: Fancy tech tree with auto-selection

**New**: Simple list with click-to-select

```
┌─────────────────────────────────────────────────────────────┐
│ All Skills - Addition                                    × │
│ ───────────────────────────────────────────────────────── │
│                                                             │
│ ✓ Single-digit without regrouping                          │
│   [Practice This]  [Unmark]                                 │
│                                                             │
│ ✓ Single-digit with regrouping                             │
│   [Practice This]  [Unmark]                                 │
│                                                             │
│ ✓ Two-digit without regrouping                             │
│   [Practice This]  [Unmark]                                 │
│                                                             │
│ ⭐ Two-digit with ones regrouping (Current)                │
│   [Mark as Mastered]                                        │
│                                                             │
│ ○ Two-digit with mixed regrouping                          │
│   [Practice This]                                           │
│                                                             │
│ ⊘ Two-digit with frequent regrouping                       │
│   Locked - requires: Two-digit with mixed regrouping       │
│                                                             │
│ Progress: 3/11 skills mastered                              │
└─────────────────────────────────────────────────────────────┘
```

**Actions**:

- **Practice This**: Switch to this skill as current
- **Mark as Mastered**: Toggle mastery state
- **Unmark**: Remove mastery status

No timers, no auto-progression, just simple configuration.

---

## Summary of Simplifications

### What We Removed

1. ❌ Auto-advance toast with 5s timer
2. ❌ Time-based recency windows (30d, 21d, 7d)
3. ❌ Time-based filtering of review skills
4. ❌ Complex sorting by recency timestamp

### What We Kept

1. ✅ Mastery tracking (boolean per skill)
2. ✅ Dependency graph (prerequisites)
3. ✅ Hand-curated recommendedReview lists
4. ✅ User-adjustable mix ratio (0-100% review)
5. ✅ Manual skill selection
6. ✅ Simple navigation (prev/next buttons)

### Core Philosophy

**Mastery mode = Smart configuration preset**

It's like the existing difficulty presets ("Beginner", "Practice", "Expert"), but:

- Organized by skill progression
- Remembers what you've mastered
- Automatically mixes review problems
- User has full manual control

**Not a game. Just a helpful configuration tool.**

---

## Implementation Phases (Updated)

### Phase 1: Foundation

1. Create `worksheet_mastery` table
2. Define `SKILL_DEFINITIONS` array with hand-curated `recommendedReview` lists
3. Implement simple review selection (filter by mastery, distribute evenly)
4. Add mastery GET/POST API endpoints

### Phase 2: Basic UI

5. Add mode selector (Smart/Manual/Mastery)
6. Add MasteryModePanel with mix visualization
7. Add prev/next navigation buttons
8. Add "Mark as Mastered" button

### Phase 3: Skills Modal

9. Add "All Skills" modal with simple list
10. Add click-to-select skill navigation
11. Add manual mastery toggle per skill

### Phase 4: Customization

12. Add "Customize Mix" modal with ratio slider
13. Add manual review skill selection checkboxes
14. Wire up custom mix to problem generator

Sound better?
