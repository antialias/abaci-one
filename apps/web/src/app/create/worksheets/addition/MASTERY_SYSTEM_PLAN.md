# Mastery System Integration Plan

## Overview

Add a **skill mastery tracking system** layered onto the existing smart difficulty mode. Students progress through discrete skills, with worksheets automatically mixing review problems with focused practice on skills approaching mastery.

**Core principle**: Mastery is **boolean per skill** - you either have mastered it or you haven't. Practice worksheets mix 70-80% current skill + 20-30% review of mastered skills.

---

## Skill Taxonomy (Based on Pedagogical Progression)

### Single-Digit Skills (1-digit operands)

These focus on **number parsing, basic counting, small regrouping, and low organizational demands**.

1. **`sd-no-regroup`** - Single-digit addition without regrouping (3+5, 2+4)
   - Challenges: Reading numbers, basic counting, understanding the operation
   - Mastery criteria: 90%+ accuracy on 20 problems

2. **`sd-simple-regroup`** - Single-digit addition with regrouping (7+8, 9+6)
   - Challenges: Understanding "making ten", small regrouping, place value introduction
   - Mastery criteria: 90%+ accuracy on 20 problems

### Two-Digit Skills (2-digit operands)

These require **alignment, high organization, pattern application, and place value understanding**.

3. **`td-no-regroup`** - Two-digit addition without regrouping (23+45, 31+28)
   - Challenges: Alignment, applying pattern to two places, understanding columns
   - Mastery criteria: 90%+ accuracy on 15 problems

4. **`td-ones-regroup`** - Two-digit addition with regrouping in ones place only (38+27, 49+15)
   - Challenges: Carrying from ones to tens, managing two-step process
   - Mastery criteria: 85%+ accuracy on 15 problems

5. **`td-mixed-regroup`** - Two-digit addition with occasional tens regrouping (67+58, 84+73)
   - Challenges: Handling regrouping in both positions (not always)
   - Mastery criteria: 85%+ accuracy on 15 problems

6. **`td-full-regroup`** - Two-digit addition with frequent regrouping (88+99, 76+67)
   - Challenges: High cognitive load, complex regrouping patterns
   - Mastery criteria: 80%+ accuracy on 15 problems

### Three-Digit Skills (3-digit operands)

These require **generalizing patterns** already learned in two-digit work.

7. **`3d-no-regroup`** - Three-digit addition without regrouping (234+451, 123+456)
   - Challenges: Applying known patterns to more columns, sustained attention
   - Mastery criteria: 85%+ accuracy on 12 problems

8. **`3d-simple-regroup`** - Three-digit with occasional regrouping (367+258, 484+273)
   - Challenges: Extending regrouping patterns to three places
   - Mastery criteria: 80%+ accuracy on 12 problems

9. **`3d-full-regroup`** - Three-digit with frequent complex regrouping (888+999, 767+676)
   - Challenges: Sustained focus, managing multiple carries
   - Mastery criteria: 80%+ accuracy on 12 problems

### Four+ Digit Skills (4-5 digit operands)

10. **`4d-mastery`** - Four-digit addition with varied regrouping (3847+2956)
    - Challenges: Sustained attention, confidence with larger numbers
    - Mastery criteria: 80%+ accuracy on 10 problems

11. **`5d-mastery`** - Five-digit addition (master level) (38472+29563)
    - Challenges: Full generalization, independence
    - Mastery criteria: 75%+ accuracy on 10 problems

### Subtraction Skills (Mirror progression)

12. **`sd-sub-no-borrow`** - Single-digit subtraction without borrowing (8-3, 9-4)
13. **`sd-sub-borrow`** - Single-digit subtraction with borrowing (13-7, 15-8)
14. **`td-sub-no-borrow`** - Two-digit subtraction without borrowing (68-43)
15. **`td-sub-ones-borrow`** - Two-digit subtraction with borrowing in ones (52-27)
16. **`td-sub-mixed-borrow`** - Two-digit subtraction with occasional tens borrowing
17. **`td-sub-full-borrow`** - Two-digit subtraction with frequent borrowing (91-78)
18. **`3d-sub-simple`** - Three-digit subtraction with occasional borrowing
19. **`3d-sub-complex`** - Three-digit subtraction with frequent borrowing
20. **`4d-sub-mastery`** - Four-digit subtraction mastery
21. **`5d-sub-mastery`** - Five-digit subtraction mastery

---

## Data Model

### Database Schema (worksheet_mastery table)

```typescript
export const worksheetMastery = sqliteTable("worksheet_mastery", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  skillId: text("skill_id").notNull(), // e.g., "td-ones-regroup"

  // Mastery tracking
  isMastered: integer("is_mastered", { mode: "boolean" }).notNull().default(false),

  // Evidence for mastery (for future validation)
  totalAttempts: integer("total_attempts").notNull().default(0),
  correctAttempts: integer("correct_attempts").notNull().default(0),
  lastAccuracy: real("last_accuracy"), // 0.0-1.0, most recent worksheet accuracy

  // Timestamps
  firstAttemptAt: integer("first_attempt_at", { mode: "timestamp" }),
  masteredAt: integer("mastered_at", { mode: "timestamp" }),
  lastPracticedAt: integer("last_practiced_at", { mode: "timestamp" }).notNull(),

  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// Composite index for fast user+skill lookups
export const worksheetMasteryIndex = index("worksheet_mastery_user_skill_idx")
  .on(worksheetMastery.userId, worksheetMastery.skillId);
```

### TypeScript Types

```typescript
export type SkillId =
  // Single-digit addition
  | "sd-no-regroup"
  | "sd-simple-regroup"
  // Two-digit addition
  | "td-no-regroup"
  | "td-ones-regroup"
  | "td-mixed-regroup"
  | "td-full-regroup"
  // Three-digit addition
  | "3d-no-regroup"
  | "3d-simple-regroup"
  | "3d-full-regroup"
  // Four/five-digit addition
  | "4d-mastery"
  | "5d-mastery"
  // Single-digit subtraction
  | "sd-sub-no-borrow"
  | "sd-sub-borrow"
  // Two-digit subtraction
  | "td-sub-no-borrow"
  | "td-sub-ones-borrow"
  | "td-sub-mixed-borrow"
  | "td-sub-full-borrow"
  // Three-digit subtraction
  | "3d-sub-simple"
  | "3d-sub-complex"
  // Four/five-digit subtraction
  | "4d-sub-mastery"
  | "5d-sub-mastery";

export interface SkillDefinition {
  id: SkillId;
  name: string;
  description: string;
  operator: "addition" | "subtraction";

  // Problem generation constraints
  digitRange: { min: number; max: number };
  regroupingConfig: {
    pAnyStart: number;
    pAllStart: number;
  };

  // Pedagogical settings
  recommendedScaffolding: DisplayRules;
  recommendedProblemCount: number;

  // Mastery validation (for future)
  masteryThreshold: number; // e.g., 0.85 = 85% accuracy
  minimumAttempts: number; // e.g., 15 problems to qualify

  // Prerequisites (skills that should be mastered first)
  prerequisites: SkillId[];
}

export interface MasteryState {
  userId: string;
  skillId: SkillId;
  isMastered: boolean;
  totalAttempts: number;
  correctAttempts: number;
  lastAccuracy: number | null;
  masteredAt: Date | null;
  lastPracticedAt: Date;
}
```

---

## Integration with Smart Difficulty

### Current Smart Difficulty Flow

```
User adjusts difficulty slider
    ↓
makeHarder/makeEasier functions
    ↓
Update pAnyStart, pAllStart, displayRules
    ↓
Generate problems based on probabilities
```

### New Mastery-Enhanced Flow

```
User selects "Mastery Mode" (new toggle in UI)
    ↓
System identifies current skill to practice
  (first non-mastered skill with prerequisites met)
    ↓
Load skill definition (digitRange, regrouping config, scaffolding)
    ↓
Generate mixed worksheet:
  - 70-80% current skill problems
  - 20-30% review from mastered skills (random selection)
    ↓
User completes worksheet (future: submit for grading)
    ↓
Update mastery state (future: based on accuracy)
```

### Skill Selection Algorithm

```typescript
/**
 * Find the next skill to practice based on mastery state
 */
function findNextSkill(
  masteryStates: Map<SkillId, MasteryState>,
  operator: "addition" | "subtraction"
): SkillId | null {
  const skills = SKILL_DEFINITIONS.filter(s => s.operator === operator);

  for (const skill of skills) {
    // Check if already mastered
    const state = masteryStates.get(skill.id);
    if (state?.isMastered) continue;

    // Check if prerequisites are met
    const prereqsMet = skill.prerequisites.every(prereqId => {
      const prereqState = masteryStates.get(prereqId);
      return prereqState?.isMastered === true;
    });

    if (!prereqsMet) continue;

    // Found first non-mastered skill with prerequisites met
    return skill.id;
  }

  return null; // All skills mastered!
}
```

### Problem Generation with Mastery Mix

```typescript
/**
 * Generate problems for mastery practice worksheet
 */
function generateMasteryWorksheet(
  currentSkill: SkillDefinition,
  masteredSkills: SkillDefinition[],
  total: number,
  rng: SeededRandom
): WorksheetProblem[] {
  const currentSkillCount = Math.floor(total * 0.75); // 75% current skill
  const reviewCount = total - currentSkillCount; // 25% review

  const problems: WorksheetProblem[] = [];

  // Generate current skill problems
  for (let i = 0; i < currentSkillCount; i++) {
    problems.push(generateProblemForSkill(currentSkill, rng));
  }

  // Generate review problems from mastered skills
  for (let i = 0; i < reviewCount; i++) {
    if (masteredSkills.length === 0) {
      // No mastered skills yet, generate more current skill problems
      problems.push(generateProblemForSkill(currentSkill, rng));
    } else {
      // Pick random mastered skill
      const reviewSkill = masteredSkills[Math.floor(rng.random() * masteredSkills.length)];
      problems.push(generateProblemForSkill(reviewSkill, rng));
    }
  }

  // Shuffle to mix review and practice
  return shuffleArray(problems, rng);
}

/**
 * Generate a single problem matching skill definition
 */
function generateProblemForSkill(
  skill: SkillDefinition,
  rng: SeededRandom
): WorksheetProblem {
  // Use skill's digitRange and regrouping config
  return generateProblem(
    skill.digitRange,
    skill.regroupingConfig.pAnyStart,
    skill.regroupingConfig.pAllStart,
    rng
  );
}
```

---

## UI Changes

### Config Panel - New Mastery Mode Toggle

Add to `SmartModeControls.tsx`:

```typescript
<div data-section="mastery-mode-toggle">
  <label>
    <input
      type="checkbox"
      checked={formState.masteryMode ?? false}
      onChange={(e) => onChange({ masteryMode: e.target.checked })}
    />
    <span>Mastery Mode</span>
  </label>
  <p className={css({ fontSize: "0.875rem", color: "gray.600" })}>
    Practice one skill at a time with automatic review of mastered skills
  </p>
</div>

{formState.masteryMode && (
  <div data-section="current-skill-indicator">
    <p>Current skill: <strong>{currentSkill.name}</strong></p>
    <p>{currentSkill.description}</p>
    <div>
      Progress: {masteredCount}/{totalSkills} skills mastered
    </div>
  </div>
)}
```

### Skill Progress Indicator

New component to show skill progression:

```typescript
<div data-component="skill-progress">
  {SKILL_DEFINITIONS
    .filter(s => s.operator === formState.operator)
    .map(skill => {
      const state = masteryStates.get(skill.id);
      const isMastered = state?.isMastered ?? false;
      const isCurrent = skill.id === currentSkill.id;
      const prereqsMet = checkPrereqs(skill, masteryStates);

      return (
        <div
          key={skill.id}
          className={css({
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.5rem",
            backgroundColor: isCurrent ? "blue.50" : "transparent",
            borderLeft: isCurrent ? "3px solid blue.500" : "none"
          })}
        >
          <div>
            {isMastered ? "✓" : prereqsMet ? "○" : "⊘"}
          </div>
          <div>
            <div>{skill.name}</div>
            {state && !isMastered && (
              <div className={css({ fontSize: "0.75rem", color: "gray.600" })}>
                {state.totalAttempts} attempts, {Math.round((state.lastAccuracy ?? 0) * 100)}% accuracy
              </div>
            )}
          </div>
        </div>
      );
    })
  }
</div>
```

---

## API Changes

### New Endpoint: `/api/worksheets/mastery`

```typescript
// GET /api/worksheets/mastery
// Returns user's mastery state for all skills
export async function GET(req: Request) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const masteryRecords = await db
    .select()
    .from(worksheetMastery)
    .where(eq(worksheetMastery.userId, session.user.id));

  return NextResponse.json({ mastery: masteryRecords });
}

// POST /api/worksheets/mastery
// Update mastery state for a skill (manual toggle or future grading)
export async function POST(req: Request) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { skillId, isMastered } = await req.json();

  // Validate skillId
  if (!SKILL_IDS.includes(skillId)) {
    return NextResponse.json({ error: "Invalid skill ID" }, { status: 400 });
  }

  // Upsert mastery record
  await db
    .insert(worksheetMastery)
    .values({
      id: crypto.randomUUID(),
      userId: session.user.id,
      skillId,
      isMastered,
      masteredAt: isMastered ? new Date() : null,
      lastPracticedAt: new Date(),
      updatedAt: new Date(),
      createdAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [worksheetMastery.userId, worksheetMastery.skillId],
      set: {
        isMastered,
        masteredAt: isMastered ? new Date() : null,
        updatedAt: new Date(),
      },
    });

  return NextResponse.json({ success: true });
}
```

---

## Config Schema Changes (V5)

Add `masteryMode` and `currentSkillId` to worksheet config:

```typescript
export const additionConfigV5SmartSchema = z.object({
  version: z.literal(5),
  mode: z.literal("smart"),

  // Existing V4 fields
  problemsPerPage: z.number().int().min(1).max(100),
  cols: z.number().int().min(1).max(10),
  pages: z.number().int().min(1).max(10),
  orientation: z.enum(["portrait", "landscape"]),
  name: z.string().max(100),
  digitRange: z.object({
    min: z.number().int().min(1).max(5),
    max: z.number().int().min(1).max(5),
  }),
  operator: z.enum(["addition", "subtraction", "mixed"]),
  fontSize: z.number().int().min(8).max(32),

  // Smart mode specific
  displayRules: displayRulesSchema,
  difficultyProfile: z.string().optional(),

  // NEW: Mastery mode fields
  masteryMode: z.boolean().optional(), // Enable mastery-based practice
  currentSkillId: z.string().optional(), // Which skill to practice (auto-selected if not set)
});

// Migration V4 → V5
function migrateAdditionV4toV5(v4: AdditionConfigV4): AdditionConfigV5 {
  return {
    ...v4,
    version: 5,
    masteryMode: false, // Default: off
    currentSkillId: undefined, // Auto-select based on mastery state
  };
}
```

---

## Implementation Phases

### Phase 1: Foundation (No UI changes yet)
1. Create database migration for `worksheet_mastery` table
2. Define `SKILL_DEFINITIONS` array with all 21 skills
3. Implement `findNextSkill()` algorithm
4. Implement `generateMasteryWorksheet()` function
5. Add mastery GET/POST API endpoints

### Phase 2: Basic UI Integration
6. Add mastery mode toggle to Smart Mode Controls
7. Add current skill indicator
8. Wire up mastery mode to problem generator
9. Test with manual mastery toggles

### Phase 3: Progress Tracking
10. Add skill progress visualization
11. Show mastery status for each skill
12. Add manual mastery toggle per skill (teacher/parent override)

### Phase 4: Future - Automatic Validation
13. Add worksheet submission endpoint
14. Implement grading logic
15. Automatic mastery updates based on accuracy
16. Student feedback on mastery progress

---

## Open Questions

1. **Should mastery be per-user or per-student-profile?**
   - Current: per-user (one mastery state per user account)
   - Alternative: per-student (parent account can track multiple children)

2. **Should we allow manual mastery override?**
   - YES for Phase 3 (teacher/parent can mark skill as mastered)
   - Future: Require both manual + validation evidence

3. **What's the review mix percentage?**
   - Proposed: 75% current skill, 25% review
   - Should this be configurable?

4. **How do we handle "mixed" operator worksheets?**
   - Option A: Disable mastery mode for "mixed" (only works for pure addition or subtraction)
   - Option B: Track addition and subtraction mastery separately, mix review from both

5. **Should digit range be locked when in mastery mode?**
   - YES - mastery mode overrides digit range (determined by current skill)
   - User can still use manual difficulty mode if they want full control

---

## Pedagogical Notes

### Why This Progression Works

1. **Single-digit first** - Builds number sense and basic operation understanding without organizational complexity
2. **Two-digit is the critical phase** - Introduces alignment, place value, and pattern application (hardest cognitive leap)
3. **Three-digit is pattern generalization** - If you master two-digit, three-digit is mostly more of the same
4. **Four/five-digit is confidence building** - Proves they can handle "big scary numbers"

### Why Mastery Mix Matters

- **Pure practice is boring** - Drilling only one skill leads to disengagement
- **Review prevents forgetting** - Spaced repetition of mastered skills
- **Mixed practice builds fluency** - Switching between skills improves transfer
- **70/30 ratio is pedagogically sound** - Majority practice on current skill, enough review to maintain mastery

### Scaffolding Considerations

- Early skills (sd-*, td-no-regroup) should have HIGH scaffolding
- Middle skills (td-ones-regroup, td-mixed-regroup) should have MEDIUM scaffolding
- Advanced skills (3d-*, 4d-*, 5d-*) should have LOW scaffolding
- Mastery mode should respect recommended scaffolding for each skill
