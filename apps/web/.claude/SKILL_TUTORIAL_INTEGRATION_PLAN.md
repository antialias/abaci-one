# Skill Tutorial Integration Plan

## Overview

This document outlines the integration between the curriculum skill system and the existing tutorial system to create a **tutorial-gated skill progression** with **gap-filling enforcement**.

## Core Principles

1. **Skills have two states:**
   - **Conceptual understanding** (tutorial completed) - "I understand how this works"
   - **Fluency** (practice mastery) - "I can do this automatically under cognitive load"

2. **Tutorial completion is required before practice:**
   - A skill must have tutorial completion BEFORE it enters practice rotation (`isPracticing=true`)
   - Teacher override is available for offline learning scenarios

3. **Gap-filling is strict:**
   - Cannot advance to higher curriculum phases until ALL prerequisite skills are mastered
   - System identifies gaps and prioritizes them over new skill introduction

---

## The Tutorial System (Already Exists)

### `generateUnifiedInstructionSequence(startValue, targetValue)`

Location: `src/utils/unifiedStepGenerator.ts`

This function is a complete pedagogical engine that:
- Takes any `(startValue, targetValue)` pair
- Generates step-by-step bead movements with English instructions
- Detects which complement rules are used (Direct, FiveComplement, TenComplement, Cascade)
- Creates `PedagogicalSegment` objects with human-readable explanations

**Output structure:**
```typescript
interface UnifiedInstructionSequence {
  fullDecomposition: string  // e.g., "3 + 4 = 3 + (5 - 1) = 7"
  isMeaningfulDecomposition: boolean
  steps: UnifiedStepData[]  // Each step has:
    // - mathematicalTerm: "5", "-1"
    // - englishInstruction: "activate heaven bead", "remove 1 earth bead"
    // - expectedValue: number after this step
    // - expectedState: AbacusState after this step
    // - beadMovements: which beads to move
  segments: PedagogicalSegment[]  // High-level explanations:
    // - readable.title: "Make 5 — ones"
    // - readable.summary: "Add 4 to the ones, but there isn't room..."
    // - readable.subtitle: "Using 5's friend"
}
```

### TutorialPlayer Component

Location: `src/components/tutorial/TutorialPlayer.tsx`

Already handles:
- Step-by-step guided practice
- Bead highlighting and movement tracking
- Progress tracking through steps
- "Next step" / "Try again" interaction

---

## Integration Architecture

### Key Insight: Generate Tutorials Dynamically

Instead of authoring tutorials for each of 30+ skills, we **generate tutorials dynamically** by:

1. **For a given skill**, identify example problems that REQUIRE that skill
2. **Generate tutorial steps** using `generateUnifiedInstructionSequence()`
3. **Present using TutorialPlayer** with auto-generated steps

### Skill → Tutorial Problem Mapping

Each skill maps to a set of example problems that demonstrate it:

```typescript
// src/lib/curriculum/skill-tutorial-config.ts

interface SkillTutorialConfig {
  skillId: string
  title: string
  description: string
  /** Example problems that demonstrate this skill */
  exampleProblems: Array<{ start: number; target: number }>
  /** Number of practice problems before sign-off (default 3) */
  practiceCount?: number
}

export const SKILL_TUTORIAL_CONFIGS: Record<string, SkillTutorialConfig> = {
  // Five-complement addition
  'fiveComplements.4=5-1': {
    skillId: 'fiveComplements.4=5-1',
    title: 'Adding 4 using 5\'s friend',
    description: 'When you need to add 4 but don\'t have room for 4 earth beads, use 5\'s friend: add 5, then take away 1.',
    exampleProblems: [
      { start: 1, target: 5 },   // 1 + 4 = 5 (simplest)
      { start: 2, target: 6 },   // 2 + 4 = 6
      { start: 3, target: 7 },   // 3 + 4 = 7
    ],
    practiceCount: 3,
  },

  'fiveComplements.3=5-2': {
    skillId: 'fiveComplements.3=5-2',
    title: 'Adding 3 using 5\'s friend',
    description: 'When you need to add 3 but don\'t have room, use 5\'s friend: add 5, then take away 2.',
    exampleProblems: [
      { start: 2, target: 5 },
      { start: 3, target: 6 },
      { start: 4, target: 7 },
    ],
  },

  // Ten-complement addition
  'tenComplements.9=10-1': {
    skillId: 'tenComplements.9=10-1',
    title: 'Adding 9 with a carry',
    description: 'When adding 9 would overflow the column, carry 10 to the next column and take away 1 here.',
    exampleProblems: [
      { start: 1, target: 10 },   // 1 + 9 = 10
      { start: 2, target: 11 },   // 2 + 9 = 11
      { start: 5, target: 14 },   // 5 + 9 = 14
    ],
  },

  // Five-complement subtraction
  'fiveComplementsSub.-4=-5+1': {
    skillId: 'fiveComplementsSub.-4=-5+1',
    title: 'Subtracting 4 using 5\'s friend',
    description: 'When you need to subtract 4 but don\'t have 4 earth beads, use 5\'s friend: take away 5, then add 1 back.',
    exampleProblems: [
      { start: 5, target: 1 },
      { start: 6, target: 2 },
      { start: 7, target: 3 },
    ],
  },

  // Ten-complement subtraction
  'tenComplementsSub.-9=+1-10': {
    skillId: 'tenComplementsSub.-9=+1-10',
    title: 'Subtracting 9 with a borrow',
    description: 'When subtracting 9 but you don\'t have enough, borrow 10 from the next column and add 1 here.',
    exampleProblems: [
      { start: 10, target: 1 },
      { start: 11, target: 2 },
      { start: 15, target: 6 },
    ],
  },

  // Basic skills (simpler tutorials)
  'basic.directAddition': {
    skillId: 'basic.directAddition',
    title: 'Adding by moving earth beads',
    description: 'The simplest way to add: just push up the earth beads you need.',
    exampleProblems: [
      { start: 0, target: 1 },
      { start: 0, target: 3 },
      { start: 1, target: 4 },
    ],
  },

  'basic.heavenBead': {
    skillId: 'basic.heavenBead',
    title: 'Using the heaven bead for 5',
    description: 'The heaven bead is worth 5. Push it down to add 5 in one move.',
    exampleProblems: [
      { start: 0, target: 5 },
      { start: 1, target: 6 },
      { start: 3, target: 8 },
    ],
  },
}
```

---

## New Data Model

### skill_tutorial_progress Table

```sql
CREATE TABLE skill_tutorial_progress (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  skill_id TEXT NOT NULL,

  -- Tutorial completion state
  tutorial_completed INTEGER NOT NULL DEFAULT 0,  -- boolean
  completed_at INTEGER,  -- timestamp

  -- Teacher override
  teacher_override INTEGER NOT NULL DEFAULT 0,  -- boolean
  override_at INTEGER,
  override_reason TEXT,  -- e.g., "Learned in class with Kehkashan"

  -- Metadata
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,

  UNIQUE(player_id, skill_id)
);

CREATE INDEX idx_skill_tutorial_player ON skill_tutorial_progress(player_id);
```

### Schema Definition

```typescript
// src/db/schema/skill-tutorial-progress.ts

import { createId } from '@paralleldrive/cuid2'
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { players } from './players'

export const skillTutorialProgress = sqliteTable(
  'skill_tutorial_progress',
  {
    id: text('id').primaryKey().$defaultFn(() => createId()),

    playerId: text('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),

    skillId: text('skill_id').notNull(),

    // Tutorial completion
    tutorialCompleted: integer('tutorial_completed', { mode: 'boolean' })
      .notNull()
      .default(false),
    completedAt: integer('completed_at', { mode: 'timestamp' }),

    // Teacher override (bypasses tutorial requirement)
    teacherOverride: integer('teacher_override', { mode: 'boolean' })
      .notNull()
      .default(false),
    overrideAt: integer('override_at', { mode: 'timestamp' }),
    overrideReason: text('override_reason'),

    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    playerIdIdx: index('skill_tutorial_player_idx').on(table.playerId),
    playerSkillUnique: uniqueIndex('skill_tutorial_player_skill_unique').on(
      table.playerId,
      table.skillId
    ),
  })
)
```

---

## Next Skill Algorithm

Simple linear walk through curriculum: find the **first unmastered, unpracticed skill**.

### `getNextSkillToLearn(playerId)`

```typescript
// src/lib/curriculum/skill-unlock.ts

interface SkillSuggestion {
  skillId: string
  phaseId: string
  phaseName: string
  description: string
  /** True if tutorial is already completed (or teacher override) */
  tutorialReady: boolean
}

/**
 * Find the next skill the student should learn.
 *
 * Algorithm: Walk through curriculum phases in order.
 * - If skill is MASTERED → skip (they know it)
 * - If skill is PRACTICING → return null (they're working on it)
 * - Otherwise → this is the next skill to learn
 */
export async function getNextSkillToLearn(playerId: string): Promise<SkillSuggestion | null> {
  // 1. Get mastered skills from BKT
  const history = await getRecentSessionResults(playerId, 100)
  const bktResults = computeBktFromHistory(history, {
    confidenceThreshold: 0.3,
    useCrossStudentPriors: false,
  })
  const masteredSkillIds = new Set(
    bktResults.skills
      .filter(s => s.masteryClassification === 'mastered')
      .map(s => s.skillId)
  )

  // 2. Get currently practicing skills
  const practicing = await getPracticingSkills(playerId)
  const practicingIds = new Set(practicing.map(s => s.skillId))

  // 3. Walk curriculum in order
  for (const phase of ALL_PHASES) {
    const skillId = phase.primarySkillId

    // Mastered? Skip - they know it
    if (masteredSkillIds.has(skillId)) {
      continue
    }

    // Currently practicing? They're working on it - no new suggestion
    if (practicingIds.has(skillId)) {
      return null
    }

    // Found first unmastered, unpracticed skill!
    const tutorialProgress = await getSkillTutorialProgress(playerId, skillId)
    const tutorialReady =
      tutorialProgress?.tutorialCompleted ||
      tutorialProgress?.teacherOverride ||
      false

    return {
      skillId,
      phaseId: phase.id,
      phaseName: phase.name,
      description: phase.description,
      tutorialReady,
    }
  }

  // All phases complete - curriculum finished!
  return null
}

/**
 * Get anomalies for teacher dashboard.
 * Returns skills that are mastered but not in practice rotation.
 */
export async function getSkillAnomalies(playerId: string): Promise<Array<{
  skillId: string
  issue: 'mastered_not_practicing' | 'tutorial_skipped_repeatedly'
  details: string
}>> {
  const anomalies = []

  // Get mastered and practicing sets
  const history = await getRecentSessionResults(playerId, 100)
  const bktResults = computeBktFromHistory(history, { confidenceThreshold: 0.3 })
  const masteredSkillIds = new Set(
    bktResults.skills
      .filter(s => s.masteryClassification === 'mastered')
      .map(s => s.skillId)
  )

  const practicing = await getPracticingSkills(playerId)
  const practicingIds = new Set(practicing.map(s => s.skillId))

  // Find mastered but not practicing
  for (const skillId of masteredSkillIds) {
    if (!practicingIds.has(skillId)) {
      anomalies.push({
        skillId,
        issue: 'mastered_not_practicing' as const,
        details: 'Skill is mastered but not in practice rotation',
      })
    }
  }

  // TODO: Track tutorial skip count and flag repeated skips

  return anomalies
}
```

---

## Tutorial Launcher Component

### SkillTutorialLauncher

```typescript
// src/components/tutorial/SkillTutorialLauncher.tsx

interface SkillTutorialLauncherProps {
  skillId: string
  playerId: string
  onComplete: () => void
  onCancel: () => void
}

export function SkillTutorialLauncher({
  skillId,
  playerId,
  onComplete,
  onCancel,
}: SkillTutorialLauncherProps) {
  const config = SKILL_TUTORIAL_CONFIGS[skillId]

  if (!config) {
    return <div>No tutorial available for {skillId}</div>
  }

  // Generate tutorial from config
  const [currentProblemIndex, setCurrentProblemIndex] = useState(0)
  const currentProblem = config.exampleProblems[currentProblemIndex]

  // Generate instruction sequence for current problem
  const sequence = useMemo(() => {
    return generateUnifiedInstructionSequence(
      currentProblem.start,
      currentProblem.target
    )
  }, [currentProblem])

  // Convert to tutorial steps
  const tutorialSteps = useMemo(() => {
    return sequence.steps.map((step, i) => ({
      instruction: step.englishInstruction,
      expectedValue: step.expectedValue,
      expectedState: step.expectedState,
      beadHighlights: step.beadMovements,
      segment: sequence.segments.find(s => s.stepIndices.includes(i)),
    }))
  }, [sequence])

  const handleProblemComplete = async () => {
    if (currentProblemIndex < config.exampleProblems.length - 1) {
      // More problems to go
      setCurrentProblemIndex(i => i + 1)
    } else {
      // Tutorial complete!
      await markTutorialComplete(playerId, skillId)
      onComplete()
    }
  }

  return (
    <div data-component="skill-tutorial-launcher">
      {/* Header with skill info */}
      <header>
        <h2>{config.title}</h2>
        <p>{config.description}</p>
        <div>
          Problem {currentProblemIndex + 1} of {config.exampleProblems.length}
        </div>
      </header>

      {/* Show the decomposition */}
      <div data-section="decomposition">
        <code>{sequence.fullDecomposition}</code>
      </div>

      {/* Show segment explanation if meaningful */}
      {sequence.segments[0]?.readable && (
        <div data-section="explanation">
          <h3>{sequence.segments[0].readable.title}</h3>
          <p>{sequence.segments[0].readable.summary}</p>
        </div>
      )}

      {/* Interactive tutorial player */}
      <TutorialPlayer
        steps={tutorialSteps}
        startValue={currentProblem.start}
        targetValue={currentProblem.target}
        onComplete={handleProblemComplete}
      />

      {/* Cancel button */}
      <button onClick={onCancel}>Cancel</button>
    </div>
  )
}
```

---

## UI Integration Points

### Primary Gate: Start Practice Modal

The tutorial happens BEFORE practice, not after. When a student sits down to practice,
that's when they learn the new skill - not when they're done and tired.

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  STUDENT CLICKS "START PRACTICE"                                │
│                          ↓                                      │
│                                                                 │
│  CHECK: Is there a new skill ready to learn?                    │
│         (first unmastered, unpracticed skill in curriculum)     │
│         AND tutorial not yet completed?                         │
│                                                                 │
│              ↓                              ↓                   │
│             YES                            NO                   │
│              ↓                              ↓                   │
│                                                                 │
│  START PRACTICE MODAL                  START PRACTICE MODAL     │
│  ┌─────────────────────────┐          ┌─────────────────────┐   │
│  │ Before we practice,     │          │ Ready to practice?  │   │
│  │ let's learn something   │          │                     │   │
│  │ new!                    │          │ [Start Session]     │   │
│  │                         │          └─────────────────────┘   │
│  │ +3 Five-Complement      │                    ↓               │
│  │ "Adding 3 using 5's     │                    │               │
│  │  friend"                │                    │               │
│  │                         │                    │               │
│  │ [Learn This First]      │                    │               │
│  │ [Skip for Now]          │                    │               │
│  └─────────────────────────┘                    │               │
│              ↓                                  │               │
│         TUTORIAL                                │               │
│         (3 guided examples)                     │               │
│              ↓                                  │               │
│         Add to isPracticing                     │               │
│              ↓                                  │               │
│              └──────────────────────────────────┘               │
│                          ↓                                      │
│                   PRACTICE SESSION                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 1. Session Summary: Celebrate, Don't Assign

After a session, celebrate unlocks but DON'T make them do a tutorial - they're tired!

```
┌─────────────────────────────────────────┐
│  SESSION COMPLETE                       │
│                                         │
│  Great work today!                      │
│                                         │
│  ✓ 12 problems completed                │
│  ✓ 83% accuracy                         │
│                                         │
│  ─────────────────────────────────────  │
│                                         │
│  🎉 You've unlocked a new skill!        │
│                                         │
│  "+3 Five-Complement" is now            │
│  available to learn.                    │
│                                         │
│  It'll be waiting for you next time!    │
│                                         │
│  [Done]                                 │
│                                         │
└─────────────────────────────────────────┘
```

No tutorial button. Just celebration.

### 2. Skills Dashboard (includes Teacher Anomalies pane)

Shows progression state with readiness indicator and teacher notes:

```
┌─────────────────────────────────────────┐
│  YOUR SKILLS                            │
│                                         │
│  Currently Practicing                   │
│  ───────────────────                    │
│  ✓ +1 Direct (mastered)                 │
│  ✓ +2 Direct (mastered)                 │
│  ○ +3 Direct (learning - 65%)           │
│                                         │
│  Ready to Learn                         │
│  ───────────────────                    │
│  📚 +4 Direct                           │
│     Start a session to learn this       │
│     [Start Session with Tutorial]       │
│                                         │
│  ─────────────────────────────────────  │
│                                         │
│  ⚠️ Teacher Notes                       │
│  ───────────────────                    │
│  • "basic.heavenBead" - mastered but    │
│    not in practice rotation             │
│    [Re-add] [Dismiss]                   │
│                                         │
│  • "+4 Direct" - tutorial skipped       │
│    3 times                              │
│    [Mark as learned] [Investigate]      │
│                                         │
└─────────────────────────────────────────┘
```

The "Start Session with Tutorial" button goes straight to the tutorial, then into practice.

### 3. ManualSkillSelector (Teacher Override)

Add teacher override capability:

```tsx
// In ManualSkillSelector.tsx

function SkillRow({ skill, tutorialProgress, onToggle, onOverride }) {
  const needsTutorial = !tutorialProgress?.tutorialCompleted && !tutorialProgress?.teacherOverride

  return (
    <div data-skill={skill.id}>
      <input
        type="checkbox"
        checked={skill.isPracticing}
        onChange={onToggle}
        disabled={needsTutorial && !skill.isPracticing}
      />
      <span>{skill.displayName}</span>

      {needsTutorial && (
        <span data-status="needs-tutorial">
          📚 Needs tutorial
          <button
            onClick={() => onOverride(skill.id)}
            title="Mark as learned offline"
          >
            Override
          </button>
        </span>
      )}

      {tutorialProgress?.teacherOverride && (
        <span data-status="override">
          ✓ Teacher override
          {tutorialProgress.overrideReason && (
            <span>({tutorialProgress.overrideReason})</span>
          )}
        </span>
      )}
    </div>
  )
}
```

### UI Touchpoint Summary

| Touchpoint | What happens |
|------------|--------------|
| **Start Practice Modal** | PRIMARY GATE - Tutorial offered here before session starts |
| **Session Summary** | Celebrate unlock, no action required |
| **Skills Dashboard** | Shows readiness + teacher anomalies pane, offers "start session with tutorial" |

---

## Implementation Phases

### Phase 1: Data Foundation (1-2 hours)
- [ ] Create `skill_tutorial_progress` schema
- [ ] Create migration
- [ ] Add CRUD operations in `progress-manager.ts`

### Phase 2: Skill Tutorial Config (2-3 hours)
- [ ] Create `src/lib/curriculum/skill-tutorial-config.ts`
- [ ] Map all ~30 skills to example problems
- [ ] Add display names for skills

### Phase 3: Gap Detection (2-3 hours)
- [ ] Implement `computeUnlockSuggestions()`
- [ ] Implement `findHighestMasteredPhase()`
- [ ] Unit tests for gap detection scenarios:
  - Normal progression (no gaps)
  - Gap in five-complements
  - Gap in basic skills
  - Multiple gaps

### Phase 4: Tutorial Launcher (3-4 hours)
- [ ] Create `SkillTutorialLauncher` component
- [ ] Integrate with existing `TutorialPlayer`
- [ ] Handle tutorial completion tracking
- [ ] Test with various skill types

### Phase 5: UI Integration (2-3 hours)
- [ ] Add to Session Summary
- [ ] Create Skills Dashboard progression view
- [ ] Update ManualSkillSelector with tutorial gating
- [ ] Add teacher override modal

### Phase 6: Testing & Polish (2-3 hours)
- [ ] End-to-end flow testing
- [ ] Edge cases (no skills practicing, all mastered, etc.)
- [ ] Mobile responsiveness
- [ ] Accessibility review

---

## Test Scenarios

### Gap Detection Tests

```typescript
describe('Gap Detection', () => {
  it('identifies gap when five-complement missing but ten-complement mastered', async () => {
    // Setup: Student has mastered +7=10-3 but never learned -2=-5+3
    await setMasteredSkill(playerId, 'tenComplements.7=10-3')
    // -2=-5+3 is in L1, should be unlocked before L2 ten-complements

    const suggestions = await computeUnlockSuggestions(playerId)

    expect(suggestions[0]).toMatchObject({
      skillId: 'fiveComplementsSub.-2=-5+3',
      type: 'gap',
    })
  })

  it('suggests advancement when no gaps exist', async () => {
    // Setup: All L1 skills mastered
    await masterAllL1Skills(playerId)

    const suggestions = await computeUnlockSuggestions(playerId)

    expect(suggestions[0]).toMatchObject({
      type: 'advancement',
      // First L2 skill
    })
  })

  it('blocks advancement until all gaps filled', async () => {
    // Setup: Two gaps exist
    await setMasteredSkill(playerId, 'tenComplements.9=10-1')
    // Missing: basic.heavenBead and fiveComplements.3=5-2

    const suggestions = await computeUnlockSuggestions(playerId)

    // Should suggest gaps first, ordered by curriculum
    expect(suggestions.length).toBe(2)
    expect(suggestions[0].type).toBe('gap')
    expect(suggestions[1].type).toBe('gap')
  })
})
```

---

## Open Questions (Resolved)

| Question | Decision |
|----------|----------|
| Gap-fill before advancement? | **STRICT** - Must fill all gaps before advancing |
| Auto-generated vs authored tutorials? | **AUTO** - Use `generateUnifiedInstructionSequence()` |
| Tutorial thoroughness? | **THOROUGH** - 3 guided examples with explanations |
| Teacher override? | **YES** - Teachers can mark skills as "learned offline" |

---

## Files to Create/Modify

### New Files
- `src/db/schema/skill-tutorial-progress.ts` - DB schema
- `drizzle/XXXX_skill_tutorial_progress.sql` - Migration
- `src/lib/curriculum/skill-tutorial-config.ts` - Skill → tutorial mapping
- `src/lib/curriculum/skill-unlock.ts` - Gap detection algorithm
- `src/components/tutorial/SkillTutorialLauncher.tsx` - Tutorial launcher
- `src/app/api/curriculum/[playerId]/tutorial-progress/route.ts` - API

### Modified Files
- `src/lib/curriculum/progress-manager.ts` - Add tutorial progress CRUD
- `src/components/practice/SessionSummary.tsx` - Add unlock prompts
- `src/components/practice/ManualSkillSelector.tsx` - Add tutorial gating
- `src/app/practice/[studentId]/skills/SkillsClient.tsx` - Add progression view

---

## Summary

This integration plan leverages the existing powerful tutorial system to create a seamless skill progression experience:

1. **BKT identifies mastery** → triggers unlock suggestion
2. **Gap detection ensures curriculum integrity** → prerequisites before advancement
3. **Dynamic tutorial generation** → no manual authoring needed
4. **Tutorial completion gates practice** → conceptual understanding before fluency drilling
5. **Teacher override available** → for offline learning scenarios

The key insight is that `generateUnifiedInstructionSequence()` already does all the heavy lifting for tutorial content. We just need to configure which problems demonstrate which skills and wire up the progression logic.
