# Mastery Dependencies & Auto-Advance System

## Auto-Advance Behavior (Question 2)

### When User Marks Skill as Mastered

**Two possible behaviors:**

#### Option A: Stay on Current Skill (Conservative)

```
User marks "td-ones-regroup" as mastered
    ↓
Update mastery state in database
    ↓
UI updates (checkmark, "Mastered on [date]")
    ↓
Worksheet generator STILL uses "td-ones-regroup" as current skill
    ↓
User must manually click "Practice This" on next skill OR click "Next Skill" button
```

**Pros:**

- User has explicit control
- Can generate multiple worksheets at newly-mastered skill level
- Good for teachers who want to verify mastery with multiple worksheets

**Cons:**

- Requires extra click to advance
- Less "guided" experience

#### Option B: Auto-Advance with Confirmation (Recommended)

```
User marks "td-ones-regroup" as mastered
    ↓
Update mastery state in database
    ↓
Show confirmation toast:
  "✓ Two-digit ones regrouping marked as mastered!
   Moving to: Two-digit mixed regrouping
   [Undo] [Stay Here]"
    ↓
After 5 seconds (or immediate if user dismisses):
    ↓
Update current skill to "td-mixed-regroup"
    ↓
Regenerate preview with new skill
```

**Pros:**

- Smooth guided progression
- User can undo or stay if needed
- Encourages continuous learning

**Cons:**

- Might surprise users who want to stay

#### **Recommended Implementation: Option B with Persistent "Stay Here" Option**

```typescript
interface MasteryConfirmationToast {
  type: "mastery-advance";
  previousSkill: SkillDefinition;
  nextSkill: SkillDefinition;

  actions: [
    { label: "Undo Mastery"; action: "undo" },
    { label: "Stay Here"; action: "stay" },
    // Auto-advance after 5s if no action
  ];
}
```

**UI Flow:**

1. User clicks "Mark as Mastered" on skill
2. Toast appears at top of screen:

   ```
   ┌──────────────────────────────────────────────────────────┐
   │ ✓ Two-digit ones regrouping marked as mastered!         │
   │ → Moving to: Two-digit mixed regrouping in 5s...         │
   │                                                           │
   │ [Undo Mastery]  [Stay Here]                      [×]     │
   └──────────────────────────────────────────────────────────┘
   ```

3. Options:
   - **Do nothing**: Auto-advance after 5s
   - **Click "Undo Mastery"**: Revert mastery state, stay on current skill
   - **Click "Stay Here"**: Keep mastery state, stay on current skill (generate more practice worksheets)
   - **Click ×**: Dismiss and auto-advance immediately

4. After advancing:
   - Regenerate preview with new current skill
   - Show new mix breakdown
   - Update "All Skills" modal view

---

## Mastery Dependency Graph (Civilization-style Tech Tree)

### Concept: Skill Prerequisites as DAG (Directed Acyclic Graph)

Like Civilization's tech tree, skills have **dependencies** that must be mastered first. Some skills have **multiple paths** to unlock them.

### Dependency Structure

```typescript
export interface SkillDefinition {
  id: SkillId;
  name: string;
  // ... other fields ...

  // Prerequisites: Skills that MUST be mastered first
  prerequisites: SkillId[];

  // Recommended review: Skills that should appear in review mix when practicing this skill
  // (subset of prerequisites + related skills)
  recommendedReview: SkillId[];
}
```

### Example Dependency Graph (Addition)

```
Legend:
  → Direct prerequisite
  ⇢ Recommended review (not required)

Single-Digit Skills
┌─────────────────────┐
│ sd-no-regroup       │
│ (3+5, 2+4)          │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│ sd-simple-regroup   │
│ (7+8, 9+6)          │
└──────────┬──────────┘
           │
           ↓
Two-Digit Skills
┌─────────────────────┐
│ td-no-regroup       │──────┐
│ (23+45, 31+28)      │      │
└──────────┬──────────┘      │
           │                 │
           ↓                 ↓
┌─────────────────────┐   ┌─────────────────────┐
│ td-ones-regroup     │   │ td-tens-only        │
│ (38+27, 49+15)      │   │ (50+70, 30+80)      │ (optional alt path)
└──────────┬──────────┘   └──────────┬──────────┘
           │                         │
           └──────────┬──────────────┘
                      ↓
           ┌─────────────────────┐
           │ td-mixed-regroup    │
           │ (67+58, 84+73)      │
           └──────────┬──────────┘
                      │
                      ↓
           ┌─────────────────────┐
           │ td-full-regroup     │
           │ (88+99, 76+67)      │
           └──────────┬──────────┘
                      │
                      ↓
Three-Digit Skills
┌─────────────────────┐
│ 3d-no-regroup       │
│ (234+451)           │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│ 3d-simple-regroup   │──────┐
│ (367+258)           │      │
└──────────┬──────────┘      │
           │                 │
           └──────────┬──────┘
                      ↓
           ┌─────────────────────┐
           │ 3d-full-regroup     │
           │ (888+999)           │
           └──────────┬──────────┘
                      │
                      ↓
Four/Five-Digit Skills
┌─────────────────────┐
│ 4d-mastery          │
│ (3847+2956)         │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│ 5d-mastery          │
│ (38472+29563)       │
└─────────────────────┘
```

### Detailed Dependencies Definition

```typescript
export const SKILL_DEPENDENCIES: Record<
  SkillId,
  {
    prerequisites: SkillId[];
    recommendedReview: SkillId[];
  }
> = {
  // Single-digit
  "sd-no-regroup": {
    prerequisites: [],
    recommendedReview: [],
  },
  "sd-simple-regroup": {
    prerequisites: ["sd-no-regroup"],
    recommendedReview: ["sd-no-regroup"],
  },

  // Two-digit
  "td-no-regroup": {
    prerequisites: ["sd-simple-regroup"],
    recommendedReview: ["sd-simple-regroup"], // Still practice single-digit
  },
  "td-ones-regroup": {
    prerequisites: ["td-no-regroup"],
    recommendedReview: ["sd-simple-regroup", "td-no-regroup"], // Related: sd regrouping + td alignment
  },
  "td-mixed-regroup": {
    prerequisites: ["td-ones-regroup"],
    recommendedReview: ["td-no-regroup", "td-ones-regroup"], // Focus on recent prerequisites
  },
  "td-full-regroup": {
    prerequisites: ["td-mixed-regroup"],
    recommendedReview: ["td-ones-regroup", "td-mixed-regroup"], // Most recent skills
  },

  // Three-digit
  "3d-no-regroup": {
    prerequisites: ["td-full-regroup"], // Must master 2-digit completely first
    recommendedReview: ["td-mixed-regroup", "td-full-regroup"], // Keep 2-digit sharp
  },
  "3d-simple-regroup": {
    prerequisites: ["3d-no-regroup"],
    recommendedReview: ["td-full-regroup", "3d-no-regroup"], // Mix 2-digit and 3-digit
  },
  "3d-full-regroup": {
    prerequisites: ["3d-simple-regroup"],
    recommendedReview: ["3d-no-regroup", "3d-simple-regroup"], // Recent 3-digit only
  },

  // Four/five-digit
  "4d-mastery": {
    prerequisites: ["3d-full-regroup"],
    recommendedReview: ["3d-simple-regroup", "3d-full-regroup"], // Keep 3-digit fresh
  },
  "5d-mastery": {
    prerequisites: ["4d-mastery"],
    recommendedReview: ["3d-full-regroup", "4d-mastery"], // High-level review only
  },

  // Subtraction follows similar pattern...
};
```

---

## Review Selection Algorithm: "Recently Mastered" Strategy

### Definition of "Recently Mastered"

**Recency window**: Skills mastered in the last N days, where N depends on skill level:

- Early skills (sd-\*, td-no-regroup): 30 days
- Intermediate skills (td-\*): 21 days
- Advanced skills (3d-_, 4d-_): 14 days
- Expert skills (5d-\*): 7 days

**Rationale**: As students progress, they need tighter review cycles to maintain proficiency at higher levels.

### Selection Algorithm

```typescript
/**
 * Select review skills based on recency and recommended review list
 */
function selectReviewSkills(
  currentSkill: SkillDefinition,
  masteryStates: Map<SkillId, MasteryState>,
  currentDate: Date = new Date(),
): SkillId[] {
  const masteredSkills = Array.from(masteryStates.entries())
    .filter(([_, state]) => state.isMastered)
    .map(([id, state]) => ({ id, state }));

  if (masteredSkills.length === 0) {
    return []; // No review skills available
  }

  // Step 1: Filter by recency window
  const recentlyMasteredSkills = masteredSkills.filter(({ id, state }) => {
    if (!state.masteredAt) return false;

    const skill = SKILL_DEFINITIONS.find((s) => s.id === id);
    const recencyWindow = getRecencyWindowForSkill(skill);
    const daysSinceMastery = differenceInDays(currentDate, state.masteredAt);

    return daysSinceMastery <= recencyWindow;
  });

  // Step 2: Prioritize skills from recommendedReview list
  const recommendedIds = new Set(currentSkill.recommendedReview);

  const reviewCandidates = recentlyMasteredSkills
    .map(({ id }) => ({
      id,
      isRecommended: recommendedIds.has(id),
      masteredAt: masteryStates.get(id)!.masteredAt!,
    }))
    .sort((a, b) => {
      // Sort by: recommended first, then by recency
      if (a.isRecommended && !b.isRecommended) return -1;
      if (!a.isRecommended && b.isRecommended) return 1;
      return b.masteredAt.getTime() - a.masteredAt.getTime(); // Most recent first
    });

  // Step 3: Select top N skills (max 3-4 for variety)
  const maxReviewSkills = Math.min(4, reviewCandidates.length);
  return reviewCandidates.slice(0, maxReviewSkills).map((c) => c.id);
}

/**
 * Get recency window in days based on skill level
 */
function getRecencyWindowForSkill(skill: SkillDefinition): number {
  if (skill.id.startsWith("sd-")) return 30; // Single-digit: 30 days
  if (skill.id.startsWith("td-")) return 21; // Two-digit: 21 days
  if (skill.id.startsWith("3d-")) return 14; // Three-digit: 14 days
  if (skill.id.startsWith("4d-") || skill.id.startsWith("5d-")) return 7; // Expert: 7 days
  return 21; // Default: 21 days
}
```

### Review Distribution

Once review skills are selected, distribute problems proportionally:

```typescript
/**
 * Distribute review problems across selected review skills
 */
function distributeReviewProblems(
  reviewSkills: SkillId[],
  totalReviewCount: number,
  rng: SeededRandom,
): Map<SkillId, number> {
  if (reviewSkills.length === 0) {
    return new Map();
  }

  const distribution = new Map<SkillId, number>();

  if (reviewSkills.length === 1) {
    // Only one review skill: give it all review problems
    distribution.set(reviewSkills[0], totalReviewCount);
    return distribution;
  }

  // Multiple review skills: distribute evenly with slight randomness
  const baseCount = Math.floor(totalReviewCount / reviewSkills.length);
  const remainder = totalReviewCount % reviewSkills.length;

  reviewSkills.forEach((skillId, index) => {
    const count = baseCount + (index < remainder ? 1 : 0);
    distribution.set(skillId, count);
  });

  return distribution;
}
```

### Example Review Selection

**Scenario**: Student is practicing "td-mixed-regroup" (two-digit mixed regrouping)

**Mastery state**:

- ✓ sd-no-regroup (mastered 45 days ago)
- ✓ sd-simple-regroup (mastered 40 days ago)
- ✓ td-no-regroup (mastered 25 days ago)
- ✓ td-ones-regroup (mastered 3 days ago)

**Current skill's recommendedReview**: ["td-no-regroup", "td-ones-regroup"]

**Selection process**:

1. Filter by recency (21 days for td-\* skills):
   - ~~sd-no-regroup~~ (45 days, outside window)
   - ~~sd-simple-regroup~~ (40 days, outside window)
   - ✓ td-no-regroup (25 days, but will be included if needed)
   - ✓ td-ones-regroup (3 days, very recent)

2. Prioritize recommended:
   - td-ones-regroup (recommended + recent = top priority)
   - td-no-regroup (recommended but older)

3. **Selected review skills**: ["td-ones-regroup", "td-no-regroup"]

4. **Distribution** (5 review problems):
   - td-ones-regroup: 3 problems (60%)
   - td-no-regroup: 2 problems (40%)

---

## Dependency Visualization in UI

### Tech Tree Modal (Civilization-style)

**New Modal**: "Skill Tech Tree" (accessible from "View All Skills")

```
┌──────────────────────────────────────────────────────────────┐
│ Skill Progression - Addition Tech Tree                   × │
│ ────────────────────────────────────────────────────────── │
│                                                              │
│  Single-Digit                                                │
│  ┌──────────────┐                                            │
│  │ No Regroup ✓ │                                            │
│  └──────┬───────┘                                            │
│         │                                                     │
│         ↓                                                     │
│  ┌──────────────┐                                            │
│  │ Regroup ✓    │                                            │
│  └──────┬───────┘                                            │
│         │                                                     │
│  Two-Digit    │                                              │
│         ↓                                                     │
│  ┌──────────────┐                                            │
│  │ No Regroup ✓ │                                            │
│  └──────┬───────┘                                            │
│         │                                                     │
│         ↓                                                     │
│  ┌──────────────┐                                            │
│  │ Ones Place ⭐│ ← You are here                             │
│  │ Regrouping   │                                            │
│  └──────┬───────┘                                            │
│         │                                                     │
│         ↓                                                     │
│  ┌──────────────┐                                            │
│  │ Mixed        │ ← Next skill                               │
│  │ Regrouping ○ │                                            │
│  └──────┬───────┘                                            │
│         │                                                     │
│  ... (continues)                                             │
│                                                              │
│  Progress: 4/11 skills mastered                              │
│  [Close]                                                     │
└──────────────────────────────────────────────────────────────┘
```

**Implementation**: Use graphviz-style layout or simple vertical flow

---

## Config Schema Update (V5) - Refined

```typescript
export const additionConfigV5SmartSchema = z.object({
  version: z.literal(5),
  mode: z.literal("smart"),

  // ... existing V4 fields ...

  // Mastery mode
  masteryMode: z.boolean().optional(),
  currentSkillId: z.string().optional(),

  // NEW: Review customization
  reviewMixRatio: z.number().min(0).max(1).optional(), // 0-1, what fraction is review (default 0.25)
  selectedReviewSkills: z.array(z.string()).optional(), // Manual override of review skills

  // NEW: Auto-advance preference
  autoAdvanceOnMastery: z.boolean().optional(), // Default true
});
```

---

## Summary of Design Decisions

### 1. Auto-Advance (Question 2 - Elaborated)

**Decision**: Auto-advance after 5s with "Undo" and "Stay Here" options

- Smooth guided experience
- User retains control
- Can generate multiple worksheets at mastered level if needed

### 2. Review Selection (Question 3)

**Decision**: Recently mastered skills with recency windows

- Recency window varies by skill level (30d → 7d as skills advance)
- Prioritize skills from current skill's `recommendedReview` list
- Max 3-4 review skills for variety

### 3. Dependency Tracking

**Decision**: DAG-based prerequisite system like Civilization

- Skills have explicit prerequisites (must master first)
- Skills have recommended review list (related skills for practice)
- UI shows locked/unlocked state based on prerequisites

### 4. Mix Ratio (Question 4)

**Decision**: User-adjustable 0-100% range

- Default: 75% current / 25% review
- Can go to 100% current (0% review) for focused practice
- Can go to 50% current / 50% review for heavy review mode
- Can go to 0% current / 100% review for pure review (if needed)

---

## Next Steps

Ready to implement? Suggested order:

1. **Phase 1**: Database + dependency system
   - Create worksheet_mastery table
   - Define SKILL_DEFINITIONS with prerequisites and recommendedReview
   - Implement selection algorithms

2. **Phase 2**: Basic mastery mode toggle
   - Add mode selector (Smart/Manual/Mastery)
   - Add MasteryModePanel with mix visualization
   - Wire up to problem generator

3. **Phase 3**: Auto-advance + review selection
   - Implement auto-advance toast with undo/stay
   - Implement recently-mastered selection algorithm
   - Add customize mix modal

4. **Phase 4**: Dependency visualization
   - Add "All Skills" modal with status indicators
   - Optional: Add tech tree visualization

Sound good?
