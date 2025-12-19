# Daily Practice System

> Architecture and implementation plan for the structured daily practice system.

## Overview

This document outlines the plan to implement a structured daily practice system following the traditional Japanese soroban teaching methodology. The curriculum follows the order used in physical abacus workbooks.

## Book's Teaching Order

The workbooks teach in this specific order:

### Level 1: No Regrouping (Single Column Operations)

Operations that don't require carrying/borrowing across columns.

**Addition (+1 through +9)**
For each number, practice in this order:

1. **Without friends of 5**: Direct bead movements only
   - e.g., `2 + 1 = 3` (just move earth beads)
2. **With friends of 5**: Using the 5-complement technique
   - e.g., `3 + 4 = 7` → needs `+5, -1`

**Subtraction (-9 through -1)**
For each number, practice in this order:

1. **Without friends of 5**: Direct bead movements only
   - e.g., `7 - 2 = 5` (just remove earth beads)
2. **With friends of 5**: Using the 5-complement technique
   - e.g., `6 - 4 = 2` → needs `-5, +1`

### Level 2: Addition with Regrouping (Friends of 10)

Addition that requires carrying to the next column.

**Addition (+1 through +9)**
For each number:

1. **Without friends of 5**: Pure 10-complement
   - e.g., `5 + 7 = 12` → needs `-3, +10` (no 5-bead manipulation in ones)
2. **With friends of 5**: Combined 10-complement and 5-complement
   - e.g., `9 + 6 = 15` → needs `+10, -5, +1`

### Level 3: Subtraction with Regrouping (Friends of 10)

Subtraction that requires borrowing from the next column.

**Subtraction (-9 through -1)**
For each number:

1. **Without friends of 5**: Pure 10-complement
   - e.g., `12 - 7 = 5` → needs `+3, -10`
2. **With friends of 5**: Combined 10-complement and 5-complement
   - e.g., `15 - 6 = 9` → needs `-10, +5, -1`

## Problem Format

- **Multi-term sequences** (3-7 terms): `12 + 45 + 23 + 67 + 8 = ?`
- **Double-digit from the start**: The books don't start with single-digit only
- **Visualization starts Level 1**: Once mechanics are familiar, practice without abacus visible

## Existing Infrastructure

### What We Have

| Component         | Location                                            | Can Leverage            |
| ----------------- | --------------------------------------------------- | ----------------------- |
| Problem generator | `src/utils/problemGenerator.ts`                     | ✅ Core logic exists    |
| Skill analysis    | `analyzeColumnAddition()`                           | ✅ Pattern to follow    |
| SkillSet types    | `src/types/tutorial.ts`                             | ✅ Has 5/10 complements |
| Practice player   | `src/components/tutorial/PracticeProblemPlayer.tsx` | ✅ UI exists            |
| Constraint system | `allowedSkills`, `targetSkills`, `forbiddenSkills`  | ✅ Ready to use         |

### What We Need to Add

| Feature                    | Description                             | File(s) to Modify               | Status     |
| -------------------------- | --------------------------------------- | ------------------------------- | ---------- |
| Subtraction skill analysis | `analyzeColumnSubtraction()`            | `src/utils/problemGenerator.ts` | ✅ Done    |
| Subtraction in SkillSet    | Add subtraction-specific skills         | `src/types/tutorial.ts`         | ✅ Done    |
| Curriculum definitions     | Level 1/2/3 PracticeStep configs        | New: `src/curriculum/`          | ⏳ Pending |
| Visualization mode         | Hide abacus option                      | `PracticeProblemPlayer.tsx`     | ⏳ Pending |
| Adaptive mastery           | Continue until N consecutive correct    | New logic                       | ⏳ Pending |
| Progress persistence       | Track technique mastery                 | Database/localStorage           | ⏳ Pending |
| **Student profiles**       | Extend players with curriculum progress | New DB tables                   | ✅ Done    |
| **Student selection UI**   | Pick student before practice            | `src/components/practice/`      | ✅ Done    |

## Student Progress Architecture

### Design Decision: Players ARE Students

Rather than creating a separate "student" concept, we extend the existing **arcade player system**:

- **Players already have identity** - name, emoji, color (kid-friendly!)
- **Players are scoped to users** - supports multiple kids per parent account
- **Active/inactive concept** - can select which student is practicing
- **Guest-friendly** - works without auth via `guestId`
- **Stats infrastructure exists** - `player_stats` with per-game JSON breakdown

This means a child's avatar in arcade games is the same avatar they use for practice - unified experience.

### Database Schema Extension

```
┌─────────────────────────────────────────────────────────────────┐
│                        EXISTING                                  │
├─────────────────────────────────────────────────────────────────┤
│  players                    │  player_stats                     │
│  ├── id                     │  ├── playerId (PK, FK)            │
│  ├── userId (FK)            │  ├── gamesPlayed                  │
│  ├── name                   │  ├── gameStats (JSON)             │
│  ├── emoji                  │  └── ...                          │
│  ├── color                  │                                   │
│  └── isActive               │                                   │
├─────────────────────────────────────────────────────────────────┤
│                        NEW TABLES                                │
├─────────────────────────────────────────────────────────────────┤
│  player_curriculum          │  player_skill_mastery             │
│  ├── playerId (PK, FK)      │  ├── id (PK)                      │
│  ├── currentLevel (1,2,3)   │  ├── playerId (FK)                │
│  ├── currentPhaseId         │  ├── skillId                      │
│  ├── worksheetPreset        │  ├── attempts                     │
│  ├── visualizationMode      │  ├── correct                      │
│  └── updatedAt              │  ├── consecutiveCorrect           │
│                             │  ├── masteryLevel                 │
│  practice_sessions          │  └── lastPracticedAt              │
│  ├── id (PK)                │                                   │
│  ├── playerId (FK)          │  UNIQUE(playerId, skillId)        │
│  ├── phaseId                │                                   │
│  ├── problemsAttempted      │                                   │
│  ├── problemsCorrect        │                                   │
│  ├── skillsUsed (JSON)      │                                   │
│  └── completedAt            │                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Data Models

```typescript
// player_curriculum - Overall curriculum position for a player
interface PlayerCurriculum {
  playerId: string; // FK to players, PRIMARY KEY
  currentLevel: 1 | 2 | 3; // Which level they're on
  currentPhaseId: string; // e.g., "L1.add.+3.withFive"
  worksheetPreset: string; // Saved worksheet difficulty profile
  visualizationMode: boolean; // Practice without visible abacus
  updatedAt: Date;
}

// player_skill_mastery - Per-skill progress tracking
interface PlayerSkillMastery {
  id: string;
  playerId: string; // FK to players
  skillId: string; // e.g., "fiveComplements.4=5-1"
  attempts: number; // Total attempts using this skill
  correct: number; // Successful uses
  consecutiveCorrect: number; // Current streak (resets on error)
  masteryLevel: "learning" | "practicing" | "mastered";
  lastPracticedAt: Date;
  // UNIQUE constraint on (playerId, skillId)
}

// practice_sessions - Historical session data
interface PracticeSession {
  id: string;
  playerId: string;
  phaseId: string; // Which curriculum phase
  problemsAttempted: number;
  problemsCorrect: number;
  averageTimeMs: number;
  skillsUsed: string[]; // Skills exercised this session
  startedAt: Date;
  completedAt: Date;
}
```

### Mastery Logic

```typescript
const MASTERY_CONFIG = {
  consecutiveForMastery: 5, // 5 correct in a row = mastered
  minimumAttempts: 10, // Need at least 10 attempts
  accuracyThreshold: 0.85, // 85% accuracy for practicing → mastered
};

function updateMasteryLevel(skill: PlayerSkillMastery): MasteryLevel {
  if (
    skill.consecutiveCorrect >= MASTERY_CONFIG.consecutiveForMastery &&
    skill.attempts >= MASTERY_CONFIG.minimumAttempts &&
    skill.correct / skill.attempts >= MASTERY_CONFIG.accuracyThreshold
  ) {
    return "mastered";
  }
  if (skill.attempts >= 5) {
    return "practicing";
  }
  return "learning";
}
```

### UX Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ PARENT/TEACHER VIEW                                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  "Who is practicing today?"                                      │
│                                                                  │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────────┐                     │
│  │  😊  │  │  🦊  │  │  🚀  │  │   ➕     │                     │
│  │ Sonia│  │Carlos│  │ Maya │  │ Add New  │                     │
│  │ Lv.2 │  │ Lv.1 │  │ Lv.1 │  │ Student  │                     │
│  └──────┘  └──────┘  └──────┘  └──────────┘                     │
│                                                                  │
│  [Select student, hand computer to child]                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ STUDENT VIEW (after selection)                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Hi Sonia! 😊                                                    │
│                                                                  │
│  ┌─────────────────────────────────────────┐                    │
│  │  Level 2: Addition with Regrouping      │                    │
│  │  Current: +6 with Friends of 5          │                    │
│  │  ████████████░░░░░░░░  60% mastered     │                    │
│  │                                          │                    │
│  │  [Continue Practice]   [View Progress]  │                    │
│  └─────────────────────────────────────────┘                    │
│                                                                  │
│  [Generate Worksheet for My Level]                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Worksheet Integration

When generating worksheets:

1. **No student selected**: Manual difficulty selection (current behavior)
2. **Student selected**:
   - Pre-populate settings based on their curriculum position
   - "Generate for Sonia's level" button
   - Still allow manual override

## Practice Session Planning

### Overview

A "session plan" is the system's recommendation for what a student should practice, generated based on:

- Available time (specified by teacher)
- Student's current curriculum position
- Skill mastery levels (what needs work vs. what's mastered)
- Spaced repetition needs (when were skills last practiced)

The teacher drives the process: select student → specify time → review plan → start session.

### Session Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  1. SETUP (Teacher)                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │ Select      │ →  │ Set Time    │ →  │ Generate    │         │
│  │ Student     │    │ Available   │    │ Plan        │         │
│  └─────────────┘    └─────────────┘    └─────────────┘         │
├─────────────────────────────────────────────────────────────────┤
│  2. REVIEW PLAN (Teacher + Student)                             │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  "Today's Practice for Emma"                    [Config]  │  │
│  │                                                    ⚙️     │  │
│  │  Time: ~15 minutes (20 problems)                         │  │
│  │                                                          │  │
│  │  Focus: Adding +3 using five-complement (12 problems)    │  │
│  │  Review: +1, +2 direct addition (6 problems)             │  │
│  │  Challenge: Mixed +1 to +3 (2 problems)                  │  │
│  │                                                          │  │
│  │  [Adjust Plan]              [Let's Go! ✓]                │  │
│  └──────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│  3. ACTIVE SESSION (Student, Teacher monitors)                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Problem 7 of 20                    ⏱️ 8:32 remaining    │  │
│  │  ████████░░░░░░░░░░░░ 35%                      [Config]  │  │
│  │                                                    ⚙️     │  │
│  │  Session Health: 🟢 On Track                             │  │
│  │  Accuracy: 85% (6/7)  |  Avg: 42s/problem                │  │
│  │                                                          │  │
│  │  [Teacher: Pause] [Teacher: Adjust] [Teacher: End Early] │  │
│  └──────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│  4. SESSION SUMMARY                                             │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Great job, Emma! 🎉                                     │  │
│  │                                                          │  │
│  │  Completed: 18/20 problems in 14 minutes                 │  │
│  │  Accuracy: 83%                                           │  │
│  │                                                          │  │
│  │  Mastery Progress:                                       │  │
│  │  +3 five-comp: Learning → Practicing ⬆️                  │  │
│  │  +1 direct: Mastered ✓ (reviewed)                        │  │
│  │                                                          │  │
│  │  [Done] [Generate Worksheet] [Start Another Session]     │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Configuration Inspector (Debug/Fine-tune Mode)

Both the **Plan Review** and **Active Session** screens include a "Config" button (⚙️) that opens a panel showing the exact configuration being applied. This is useful for:

- **Teachers**: Understanding why certain problems appear
- **Developers**: Debugging the plan generation algorithm
- **Fine-tuning**: Adjusting parameters before starting

```
┌──────────────────────────────────────────────────────────────────┐
│  Session Configuration                                    [×]    │
├──────────────────────────────────────────────────────────────────┤
│  PLAN PARAMETERS                                                 │
│  ├── targetDuration: 15 minutes                                  │
│  ├── estimatedProblems: 20                                       │
│  ├── avgTimePerProblem: 45s (based on student history)           │
│  └── planGeneratedAt: 2024-01-15T10:30:00Z                       │
│                                                                  │
│  DISTRIBUTION                                                    │
│  ├── focus: 60% (12 problems)                                    │
│  │   └── targetSkills: ["fiveComplements.3=5-2"]                 │
│  ├── reinforce: 20% (4 problems)                                 │
│  │   └── targetSkills: ["basic.directAddition"]                  │
│  ├── review: 15% (3 problems)                                    │
│  │   └── targetSkills: ["fiveComplements.1=5-4"]                 │
│  └── challenge: 5% (1 problem)                                   │
│      └── targetSkills: ["mixed"]                                 │
│                                                                  │
│  PROBLEM CONSTRAINTS (Current Slot)                              │
│  ├── slotIndex: 7                                                │
│  ├── purpose: "focus"                                            │
│  ├── allowedSkills: { fiveComplements: { "3=5-2": true } }      │
│  ├── forbiddenSkills: { tenComplements: true }                   │
│  ├── digitRange: { min: 1, max: 2 }                              │
│  └── termCount: { min: 3, max: 5 }                               │
│                                                                  │
│  STUDENT STATE SNAPSHOT                                          │
│  ├── currentPhase: "L1.add.+3.five"                              │
│  ├── phaseProgress: 4/10 skills at 'practicing' or better        │
│  └── skillMastery:                                               │
│      ├── fiveComplements.3=5-2: { attempts: 23, accuracy: 74% }  │
│      ├── fiveComplements.2=5-3: { attempts: 18, accuracy: 89% }  │
│      └── basic.directAddition: { attempts: 45, accuracy: 96% }   │
│                                                                  │
│  [Copy to Clipboard]  [Export JSON]                              │
└──────────────────────────────────────────────────────────────────┘
```

### Session Health Indicators

Real-time metrics visible to the teacher during the active session:

| Indicator      | 🟢 Good                | 🟡 Warning         | 🔴 Struggling        |
| -------------- | ---------------------- | ------------------ | -------------------- |
| **Accuracy**   | >80%                   | 60-80%             | <60%                 |
| **Pace**       | On track or ahead      | 10-30% behind      | >30% behind          |
| **Streak**     | 3+ consecutive correct | Mixed results      | 3+ consecutive wrong |
| **Engagement** | <60s per problem       | 60-90s per problem | >90s or long pauses  |

Overall session health is the worst of the four indicators.

### Teacher Adjustments Mid-Session

When the session isn't going well, the teacher can:

| Adjustment             | Effect                                             | When to Use                         |
| ---------------------- | -------------------------------------------------- | ----------------------------------- |
| **Reduce Difficulty**  | Switch remaining slots to easier problems          | Accuracy < 60%, frustration visible |
| **Enable Scaffolding** | Turn on visualization mode (show abacus)           | Conceptual confusion                |
| **Narrow Focus**       | Drop review/challenge, focus only on current skill | Overwhelmed by variety              |
| **Take a Break**       | Pause timer, allow discussion                      | Long pauses, emotional state        |
| **Extend Session**     | Add more problems                                  | Going well, student wants more      |
| **End Gracefully**     | Complete current problem, show summary             | Time constraint, fatigue            |

All adjustments are logged in `SessionPlan.adjustments[]` for later analysis.

### Data Model

```typescript
interface SessionPlan {
  id: string;
  playerId: string;

  // Setup parameters
  targetDurationMinutes: number;
  estimatedProblemCount: number;
  avgTimePerProblemSeconds: number; // Calculated from student history

  // Problem slots (generated upfront, can be modified)
  slots: ProblemSlot[];

  // Human-readable summary for plan review screen
  summary: SessionSummary;

  // State machine
  status: "draft" | "approved" | "in_progress" | "completed" | "abandoned";

  // Timestamps
  createdAt: Date;
  approvedAt?: Date; // When teacher/student clicked "Let's Go"
  startedAt?: Date; // When first problem displayed
  completedAt?: Date;

  // Live tracking
  currentSlotIndex: number;
  sessionHealth: SessionHealth;
  adjustments: SessionAdjustment[];

  // Results (filled in as session progresses)
  results: SlotResult[];
}

interface ProblemSlot {
  index: number;
  purpose: "focus" | "reinforce" | "review" | "challenge";

  // Constraints passed to problem generator
  constraints: {
    allowedSkills?: Partial<SkillSet>;
    targetSkills?: Partial<SkillSet>;
    forbiddenSkills?: Partial<SkillSet>;
    digitRange?: { min: number; max: number };
    termCount?: { min: number; max: number };
    operator?: "addition" | "subtraction" | "mixed";
  };

  // Generated problem (filled when slot is reached)
  problem?: GeneratedProblem;
}

interface SessionSummary {
  focusDescription: string; // "Adding +3 using five-complement"
  focusCount: number;
  reviewSkills: string[]; // Human-readable skill names
  reviewCount: number;
  challengeCount: number;
  estimatedMinutes: number;
}

interface SessionHealth {
  overall: "good" | "warning" | "struggling";
  accuracy: number; // 0-1
  pacePercent: number; // 100 = on track, <100 = behind
  currentStreak: number; // Positive = correct streak, negative = wrong streak
  avgResponseTimeMs: number;
}

interface SessionAdjustment {
  timestamp: Date;
  type:
    | "difficulty_reduced"
    | "scaffolding_enabled"
    | "focus_narrowed"
    | "paused"
    | "resumed"
    | "extended"
    | "ended_early";
  reason?: string; // Optional teacher note
  previousHealth: SessionHealth;
}

interface SlotResult {
  slotIndex: number;
  problem: GeneratedProblem;
  studentAnswer: number;
  isCorrect: boolean;
  responseTimeMs: number;
  skillsExercised: string[]; // Which skills this problem tested
  timestamp: Date;
}
```

### Plan Generation Algorithm

```typescript
interface PlanGenerationConfig {
  // Distribution weights (should sum to 1.0)
  focusWeight: number; // Default: 0.60
  reinforceWeight: number; // Default: 0.20
  reviewWeight: number; // Default: 0.15
  challengeWeight: number; // Default: 0.05

  // Timing
  defaultSecondsPerProblem: number; // Default: 45

  // Spaced repetition
  reviewIntervalDays: {
    mastered: number; // Default: 7 (review mastered skills weekly)
    practicing: number; // Default: 3 (review practicing skills every 3 days)
  };
}

function generateSessionPlan(
  playerId: string,
  durationMinutes: number,
  config: PlanGenerationConfig = DEFAULT_CONFIG,
): SessionPlan {
  // 1. Load student state
  const curriculum = await getPlayerCurriculum(playerId);
  const skillMastery = await getAllSkillMastery(playerId);
  const recentSessions = await getRecentSessions(playerId, 10);

  // 2. Calculate personalized timing
  const avgTime =
    calculateAvgTimePerProblem(recentSessions) ??
    config.defaultSecondsPerProblem;
  const problemCount = Math.floor((durationMinutes * 60) / avgTime);

  // 3. Categorize skills by need
  const currentPhaseSkills = getSkillsForPhase(curriculum.currentPhaseId);
  const struggling = skillMastery.filter(
    (s) =>
      currentPhaseSkills.includes(s.skillId) && s.correct / s.attempts < 0.7,
  );
  const needsReview = skillMastery.filter(
    (s) =>
      s.masteryLevel === "mastered" &&
      daysSince(s.lastPracticedAt) > config.reviewIntervalDays.mastered,
  );

  // 4. Calculate slot distribution
  const focusCount = Math.round(problemCount * config.focusWeight);
  const reinforceCount = Math.round(problemCount * config.reinforceWeight);
  const reviewCount = Math.round(problemCount * config.reviewWeight);
  const challengeCount =
    problemCount - focusCount - reinforceCount - reviewCount;

  // 5. Build slots with constraints
  const slots: ProblemSlot[] = [];

  // Focus slots: current phase, primary skill
  for (let i = 0; i < focusCount; i++) {
    slots.push({
      index: slots.length,
      purpose: "focus",
      constraints: buildConstraintsForPhase(curriculum.currentPhaseId),
    });
  }

  // Reinforce slots: struggling skills get extra practice
  for (let i = 0; i < reinforceCount; i++) {
    const skill = struggling[i % struggling.length];
    slots.push({
      index: slots.length,
      purpose: "reinforce",
      constraints: buildConstraintsForSkill(skill?.skillId),
    });
  }

  // Review slots: spaced repetition of mastered skills
  for (let i = 0; i < reviewCount; i++) {
    const skill = needsReview[i % needsReview.length];
    slots.push({
      index: slots.length,
      purpose: "review",
      constraints: buildConstraintsForSkill(skill?.skillId),
    });
  }

  // Challenge slots: slightly harder or mixed
  for (let i = 0; i < challengeCount; i++) {
    slots.push({
      index: slots.length,
      purpose: "challenge",
      constraints: buildChallengeConstraints(curriculum),
    });
  }

  // 6. Shuffle to interleave purposes (but keep some focus problems together)
  const shuffledSlots = intelligentShuffle(slots);

  // 7. Build summary
  const summary = buildHumanReadableSummary(shuffledSlots, curriculum);

  return {
    id: generateId(),
    playerId,
    targetDurationMinutes: durationMinutes,
    estimatedProblemCount: problemCount,
    avgTimePerProblemSeconds: avgTime,
    slots: shuffledSlots,
    summary,
    status: "draft",
    createdAt: new Date(),
    currentSlotIndex: 0,
    sessionHealth: {
      overall: "good",
      accuracy: 1,
      pacePercent: 100,
      currentStreak: 0,
      avgResponseTimeMs: 0,
    },
    adjustments: [],
    results: [],
  };
}
```

### Database Schema Addition

```sql
-- Add to existing schema
CREATE TABLE session_plans (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,

  -- Setup
  target_duration_minutes INTEGER NOT NULL,
  estimated_problem_count INTEGER NOT NULL,
  avg_time_per_problem_seconds INTEGER NOT NULL,

  -- Slots and summary stored as JSON
  slots TEXT NOT NULL,           -- JSON array of ProblemSlot
  summary TEXT NOT NULL,         -- JSON SessionSummary

  -- State
  status TEXT NOT NULL DEFAULT 'draft',
  current_slot_index INTEGER NOT NULL DEFAULT 0,
  session_health TEXT,           -- JSON SessionHealth
  adjustments TEXT,              -- JSON array of SessionAdjustment
  results TEXT,                  -- JSON array of SlotResult

  -- Timestamps
  created_at INTEGER NOT NULL,
  approved_at INTEGER,
  started_at INTEGER,
  completed_at INTEGER
);

CREATE INDEX idx_session_plans_player ON session_plans(player_id);
CREATE INDEX idx_session_plans_status ON session_plans(status);
```

### API Endpoints

```
POST   /api/curriculum/{playerId}/sessions/plan
       Body: { durationMinutes: number, config?: PlanGenerationConfig }
       Returns: SessionPlan (status: 'draft')

GET    /api/curriculum/{playerId}/sessions/plan/{planId}
       Returns: SessionPlan with full slot details

PATCH  /api/curriculum/{playerId}/sessions/plan/{planId}
       Body: { status: 'approved' } or adjustment data
       Returns: Updated SessionPlan

POST   /api/curriculum/{playerId}/sessions/plan/{planId}/slot/{index}/result
       Body: { studentAnswer: number, responseTimeMs: number }
       Returns: { isCorrect, updatedHealth, nextSlot? }

POST   /api/curriculum/{playerId}/sessions/plan/{planId}/adjust
       Body: { type: AdjustmentType, reason?: string }
       Returns: Updated SessionPlan with modified remaining slots
```

## Practice Experience

### Overview

The practice experience is the actual problem-solving interface where the student works through their session plan. The computer/phone serves as the primary proctoring device - displaying problems, collecting answers, and tracking progress.

### Design Principles

1. **One problem at a time** - Clean, focused display without distraction
2. **Physical abacus preferred** - On-screen abacus is a "last resort"
3. **Device-appropriate input** - Native keyboard on desktop, simplified keypad on phone
4. **Visualization mode** - Encourages mental math by hiding abacus aids
5. **Skill-appropriate problems** - Never ask for skills not yet learned

### Hardware Recommendations

```
┌─────────────────────────────────────────────────────────────────┐
│  RECOMMENDED SETUP                                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│    ┌─────────────┐       ┌───────────────────────┐             │
│    │   SCREEN    │       │   PHYSICAL ABACUS     │             │
│    │  (problems) │       │   (3D printed STL)    │             │
│    │             │       │                       │             │
│    │   45 + 23   │       │  ☐ ☐ ☐ ☐ ☐ ☐ ☐ ☐ ☐   │             │
│    │             │       │  ───────────────────  │             │
│    │   [  68  ]  │       │  ● ● ● ● ○ ○ ○ ○ ○   │             │
│    │             │       │  ● ● ● ● ○ ○ ○ ○ ○   │             │
│    └─────────────┘       │  ● ● ● ● ○ ○ ○ ○ ○   │             │
│                          │  ● ● ● ● ○ ○ ○ ○ ○   │             │
│                          └───────────────────────┘             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Problem Formats

The curriculum uses two distinct problem formats:

#### 1. Vertical (Columnar) Format - Primary

This is the main format from the workbooks. Numbers are stacked vertically:

- **Plus sign omitted** - Addition is implicit
- **Minus sign shown** - Only subtraction is marked
- **Answer box at bottom** - Student fills in the result

```
┌─────────────────────────────────────────────────────────────────┐
│  VERTICAL FORMAT (Primary - Parts 1 & 2)                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Problem 7 of 20                           ⏱️ 8:32 remaining   │
│  ████████░░░░░░░░░░░░ 35%                                      │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                                                          │  │
│  │                         88                               │  │
│  │                         61                               │  │
│  │                         33                               │  │
│  │                       - 55                               │  │
│  │                         47                               │  │
│  │                       - 28                               │  │
│  │                      ──────                              │  │
│  │                    ┌───────┐                             │  │
│  │                    │  146  │  ← Student input            │  │
│  │                    └───────┘                             │  │
│  │                                                          │  │
│  │                      [Submit]                            │  │
│  │                                                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  [Need Help?]                              [Show Abacus]        │
│                                            (last resort)        │
└─────────────────────────────────────────────────────────────────┘
```

#### 2. Linear Format - Mental Math (Part 3)

After visualization practice, students progress to linear problems - sequences presented as a math sentence for mental calculation:

```
┌─────────────────────────────────────────────────────────────────┐
│  LINEAR FORMAT (Part 3 - Mental Math)                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Problem 4 of 10                    🧠 Mental Math Practice     │
│  ████████████░░░░░░░░ 40%                                      │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                                                          │  │
│  │           88 + 61 + 33 - 55 + 47 - 28 = ?                │  │
│  │                                                          │  │
│  │                    ┌───────────┐                         │  │
│  │                    │    146    │                         │  │
│  │                    └───────────┘                         │  │
│  │                                                          │  │
│  │                      [Submit]                            │  │
│  │                                                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  💭 "Visualize the beads as you work through each number"      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Daily Practice Structure

Based on the workbook format, a typical daily practice session has three parts:

| Part                       | Format   | Abacus          | Purpose                                |
| -------------------------- | -------- | --------------- | -------------------------------------- |
| **Part 1: Skill Building** | Vertical | Physical abacus | Build muscle memory, learn techniques  |
| **Part 2: Visualization**  | Vertical | Hidden/mental   | Internalize bead movements mentally    |
| **Part 3: Mental Math**    | Linear   | None            | Pure mental calculation, no visual aid |

### Input Methods

| Device                   | Primary Input   | Implementation                          |
| ------------------------ | --------------- | --------------------------------------- |
| **Desktop/Laptop**       | Native keyboard | `<input type="number">` with auto-focus |
| **Tablet with keyboard** | Native keyboard | Same as desktop                         |
| **Phone/Touch tablet**   | Virtual keypad  | `react-simple-keyboard` numeric layout  |

#### Phone Keypad Implementation

Reference existing implementations:

- **Know Your World**: `src/arcade-games/know-your-world/components/SimpleLetterKeyboard.tsx`
  - Uses `react-simple-keyboard` v3.8.139
  - Configured for letter input in learning mode
- **Memory Quiz**: `src/arcade-games/memory-quiz/components/InputPhase.tsx`
  - Custom numeric keypad implementation
  - Device detection logic for keyboard vs touch

```typescript
// Simplified numeric keypad for practice
const numericLayout = {
  default: ["7 8 9", "4 5 6", "1 2 3", "{bksp} 0 {enter}"],
};

// Use device detection from memory quiz
const useDeviceType = () => {
  // Returns 'desktop' | 'tablet' | 'phone'
  // Based on screen size and touch capability
};
```

### Abacus Access

The on-screen abacus is available as a **last resort**, not a primary tool:

```
┌─────────────────────────────────────────────────────────────────┐
│  ABACUS ACCESS (when clicked)                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  💡 Tip: Using a physical abacus helps build muscle      │  │
│  │     memory! We have a 3D-printable model available.      │  │
│  │                                                          │  │
│  │     [Download STL]    [Show On-Screen Abacus Anyway]     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

If the student insists, show the `AbacusReact` component from `@soroban/abacus-react`.

**Tracking**: Log when students use the on-screen abacus to identify those who may need a physical one.

### Visualization Mode

When `visualizationMode: true` in the student's curriculum settings:

```
┌─────────────────────────────────────────────────────────────────┐
│  VISUALIZATION MODE                                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Problem 7 of 20                    🧠 Visualization Practice   │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                                                          │  │
│  │              45 + 23 + 12 + 8 = ?                        │  │
│  │                                                          │  │
│  │         💭 "Picture the beads in your mind"              │  │
│  │                                                          │  │
│  │                    ┌───────────┐                         │  │
│  │                    │           │                         │  │
│  │                    └───────────┘                         │  │
│  │                                                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  [Having Trouble?]          ← Opens hints, NOT the abacus      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Visualization mode behaviors**:

- Hide "Show Abacus" button entirely
- Add gentle reminder: "Picture the beads in your mind"
- If student struggles (2+ wrong in a row):
  - Offer guided visualization hints
  - Suggest stepping back to physical abacus practice
  - Do NOT automatically show abacus
- Track accuracy separately for visualization vs. abacus-assisted

### Skill Constraint Enforcement

**CRITICAL**: Never present problems requiring skills the student hasn't learned yet.

The problem generator (`src/utils/problemGenerator.ts`) already supports:

- `allowedSkills` - Skills the problem MUST use
- `targetSkills` - Skills we're trying to practice
- `forbiddenSkills` - Skills the problem must NOT use

```typescript
// For a Level 1 student who has only learned +1, +2, +3 direct addition:
const constraints = {
  forbiddenSkills: {
    fiveComplements: true, // No five-complement techniques
    tenComplements: true, // No ten-complement techniques
    tenComplementsSub: true, // No subtraction borrowing
    fiveComplementsSub: true, // No subtraction with fives
  },
  allowedSkills: {
    basic: { directAddition: true },
  },
};
```

**Audit checklist for problem generation**:

1. ✅ `analyzeRequiredSkills()` accurately categorizes all techniques needed
2. ✅ `problemMatchesSkills()` correctly validates against constraints
3. ⏳ Create curriculum phase → constraints mapping
4. ⏳ Validate no "skill leak" (problems requiring unlearned techniques)

### Existing Components to Leverage

| Component               | Location                                                               | Purpose                                   |
| ----------------------- | ---------------------------------------------------------------------- | ----------------------------------------- |
| `PracticeProblemPlayer` | `src/components/tutorial/PracticeProblemPlayer.tsx`                    | Existing practice UI (abacus-based input) |
| `SimpleLetterKeyboard`  | `src/arcade-games/know-your-world/components/SimpleLetterKeyboard.tsx` | `react-simple-keyboard` integration       |
| `InputPhase`            | `src/arcade-games/memory-quiz/components/InputPhase.tsx`               | Custom numeric keypad + device detection  |
| `problemGenerator`      | `src/utils/problemGenerator.ts`                                        | Skill-constrained problem generation      |
| `AbacusReact`           | `@soroban/abacus-react`                                                | On-screen abacus (last resort)            |

### Data Model Extensions

```typescript
interface PracticeAnswer {
  slotIndex: number;
  studentAnswer: number;
  isCorrect: boolean;
  responseTimeMs: number;
  inputMethod: "keyboard" | "virtual_keypad" | "touch";
  usedOnScreenAbacus: boolean; // Track abacus usage
  visualizationMode: boolean; // Was this in visualization mode?
}

// For identifying students who may need a physical abacus
interface StudentAbacusUsage {
  onScreenAbacusUsed: number; // Count of problems using on-screen
  totalProblems: number;
  usageRate: number; // Percentage
  suggestPhysicalAbacus: boolean; // true if usage rate > 30%
}
```

### Mobile Responsiveness

```
┌────────────────────┐
│ PHONE - VERTICAL   │
├────────────────────┤
│                    │
│   Problem 7/20     │
│   ████░░░░░ 35%    │
│                    │
│         88         │
│         61         │
│         33         │
│       - 55         │
│         47         │
│       - 28         │
│       ──────       │
│    ┌────────┐      │
│    │  146   │      │
│    └────────┘      │
│                    │
│  ┌──┬──┬──┐       │
│  │ 7│ 8│ 9│       │
│  ├──┼──┼──┤       │
│  │ 4│ 5│ 6│       │
│  ├──┼──┼──┤       │
│  │ 1│ 2│ 3│       │
│  ├──┼──┼──┤       │
│  │ ⌫│ 0│ ⏎│       │
│  └──┴──┴──┘       │
│                    │
└────────────────────┘
```

```
┌────────────────────┐
│ PHONE - LINEAR     │
│ (Mental Math)      │
├────────────────────┤
│                    │
│   Problem 4/10     │
│  🧠 Mental Math    │
│                    │
│  88 + 61 + 33      │
│  - 55 + 47 - 28    │
│      = ?           │
│                    │
│    ┌────────┐      │
│    │  146   │      │
│    └────────┘      │
│                    │
│  ┌──┬──┬──┐       │
│  │ 7│ 8│ 9│       │
│  ├──┼──┼──┤       │
│  │ 4│ 5│ 6│       │
│  ├──┼──┼──┤       │
│  │ 1│ 2│ 3│       │
│  ├──┼──┼──┤       │
│  │ ⌫│ 0│ ⏎│       │
│  └──┴──┴──┘       │
│                    │
└────────────────────┘
```

## Implementation Phases

### Phase 0: Student Progress Infrastructure ✅ COMPLETE

**Goal**: Create database tables and basic UI for tracking student progress through the curriculum.

**Tasks**:

1. ✅ Create `player_curriculum` table schema - `src/db/schema/player-curriculum.ts`
2. ✅ Create `player_skill_mastery` table schema - `src/db/schema/player-skill-mastery.ts`
3. ✅ Create `practice_sessions` table schema - `src/db/schema/practice-sessions.ts`
4. ✅ Migrations run automatically on app start
5. ✅ Create student selection UI component - `src/components/practice/StudentSelector.tsx`
6. ✅ Create progress dashboard component - `src/components/practice/ProgressDashboard.tsx`
7. ✅ Create API routes for curriculum progress CRUD - `src/app/api/curriculum/[playerId]/`
8. ✅ Create `src/lib/curriculum/progress-manager.ts`
9. ✅ Create `src/hooks/usePlayerCurriculum.ts`
10. ✅ Create `/practice` page - `src/app/practice/page.tsx`

**Files Created**:

- ✅ `src/db/schema/player-curriculum.ts` - Curriculum position tracking
- ✅ `src/db/schema/player-skill-mastery.ts` - Per-skill mastery tracking with `MASTERY_CONFIG` and `calculateMasteryLevel()`
- ✅ `src/db/schema/practice-sessions.ts` - Practice session history
- ✅ `src/components/practice/StudentSelector.tsx` - Student selection UI
- ✅ `src/components/practice/ProgressDashboard.tsx` - Progress display and actions
- ✅ `src/components/practice/index.ts` - Component exports
- ✅ `src/lib/curriculum/progress-manager.ts` - CRUD operations for curriculum data
- ✅ `src/hooks/usePlayerCurriculum.ts` - Client-side curriculum state management
- ✅ `src/app/api/curriculum/[playerId]/route.ts` - GET/PATCH curriculum
- ✅ `src/app/api/curriculum/[playerId]/advance/route.ts` - POST advance phase
- ✅ `src/app/api/curriculum/[playerId]/skills/route.ts` - POST record skill attempt
- ✅ `src/app/api/curriculum/[playerId]/skills/batch/route.ts` - POST batch record
- ✅ `src/app/api/curriculum/[playerId]/sessions/route.ts` - POST start session
- ✅ `src/app/api/curriculum/[playerId]/sessions/[sessionId]/complete/route.ts` - POST complete
- ✅ `src/app/practice/page.tsx` - Practice entry point page

### Phase 1: Problem Generator Extension ✅ COMPLETE

**Goal**: Enable the problem generator to handle subtraction and properly categorize "with/without friends of 5".

**Tasks**:

1. ✅ Add `analyzeColumnSubtraction()` function - `src/utils/problemGenerator.ts:148`
2. ✅ Add subtraction skills to `SkillSet` type - `src/types/tutorial.ts:36`
   - `fiveComplementsSub`: `-4=-5+1`, `-3=-5+2`, `-2=-5+3`, `-1=-5+4`
   - `tenComplementsSub`: `-9=+1-10`, `-8=+2-10`, ... `-1=+9-10`
   - `basic.directSubtraction`, `basic.heavenBeadSubtraction`, `basic.simpleCombinationsSub`
3. ✅ Add `analyzeSubtractionStepSkills()` function - `src/utils/problemGenerator.ts:225`
4. ✅ Refactor `problemMatchesSkills()` and `findValidNextTerm()` to support new skill categories
5. ⏳ Test with Storybook stories (pending)
6. ⏳ Add `generateSubtractionSequence()` for mixed operation problems (pending)

### Phase 2: Curriculum Definitions

**Goal**: Define the Level 1/2/3 structure as data that drives practice.

**Tasks**:

1. Create curriculum data structure:

   ```typescript
   interface CurriculumLevel {
     id: string;
     name: string;
     description: string;
     phases: CurriculumPhase[];
   }

   interface CurriculumPhase {
     targetNumber: number; // +1, +2, ... +9 or -9, -8, ... -1
     operation: "addition" | "subtraction";
     useFiveComplement: boolean;
     usesTenComplement: boolean;
     practiceStep: PracticeStep; // Existing type
   }
   ```

2. Define all phases for Level 1, 2, 3
3. Create helper to convert curriculum phase to PracticeStep constraints

### Phase 3: Daily Practice Mode ⏳ NEXT UP

**Goal**: A `/practice` page that guides students through the curriculum with intelligent session planning.

**Tasks**:

1. ✅ Create `/app/practice/page.tsx` - Basic structure done
2. ✅ Track current position in curriculum - Database schema done
3. ⏳ Create session plan generator (`src/lib/curriculum/session-planner.ts`)
4. ⏳ Create `session_plans` database table
5. ⏳ Create Plan Review screen component
6. ⏳ Create Active Session screen component
7. ⏳ Create Configuration Inspector component
8. ⏳ Create Session Summary screen component
9. ⏳ Implement session health tracking and indicators
10. ⏳ Implement teacher adjustment controls
11. ⏳ Visualization toggle (show/hide abacus)
12. ⏳ API routes for session plan CRUD

**Sub-phases**:

#### Phase 3a: Session Plan Generation

- Create `SessionPlan` type definitions
- Implement `generateSessionPlan()` algorithm
- Create `session_plans` table schema
- API: POST `/api/curriculum/{playerId}/sessions/plan`

#### Phase 3b: Plan Review UI

- Plan summary display
- Configuration inspector (debug panel)
- "Adjust Plan" controls
- "Let's Go" approval flow

#### Phase 3c: Active Session UI (Practice Experience)

- One-problem-at-a-time display with progress bar
- Timer and pace tracking
- Device-appropriate input:
  - Desktop: native keyboard with auto-focus
  - Phone: `react-simple-keyboard` numeric keypad (reference: `SimpleLetterKeyboard.tsx`)
  - Device detection logic (reference: `InputPhase.tsx`)
- On-screen abacus access (last resort):
  - Prompt suggesting physical abacus first
  - Track on-screen abacus usage
  - `AbacusReact` from `@soroban/abacus-react`
- Visualization mode:
  - Hide abacus button entirely
  - "Picture the beads" reminder
  - Guided hints for struggling students
- Session health indicators (accuracy, pace, streak, engagement)
- Teacher controls (pause, adjust, end early)
- Configuration inspector (current slot details)

#### Phase 3d: Session Completion

- Summary display with results
- Mastery level changes
- Skill update and persistence
- Next steps (worksheet, another session, done)

### Phase 4: Worksheet Integration

**Goal**: Generate printable worksheets targeting specific techniques.

**Tasks**:

1. Add "technique mode" to worksheet config
2. Allow selecting specific curriculum phase for worksheet
3. Generate problems using same constraints as online practice

## Technical Details

### Skill Analysis Logic

**Current addition analysis** (from `analyzeColumnAddition`):

- Checks if adding `termDigit` to `currentDigit` requires:
  - Direct addition (result ≤ 4)
  - Heaven bead (involves 5)
  - Five complement (needs +5-n)
  - Ten complement (needs -n+10)

**Subtraction analysis** (to implement):

- Check if subtracting `termDigit` from `currentDigit` requires:
  - Direct subtraction (have enough earth beads)
  - Heaven bead removal (have 5-bead to remove)
  - Five complement (needs -5+n)
  - Ten complement (needs +n-10)

### "With/Without Friends of 5" Implementation

Use `forbiddenSkills` to exclude five-complement techniques:

```typescript
// Level 1, +3, WITHOUT friends of 5
const practiceStep: PracticeStep = {
  allowedSkills: { basic: { directAddition: true, heavenBead: true } },
  targetSkills: {
    /* target +3 specifically */
  },
  forbiddenSkills: {
    fiveComplements: {
      "3=5-2": true,
      "2=5-3": true,
      "1=5-4": true,
      "4=5-1": true,
    },
  },
};

// Level 1, +3, WITH friends of 5
const practiceStep: PracticeStep = {
  allowedSkills: {
    basic: { directAddition: true, heavenBead: true },
    fiveComplements: { "2=5-3": true },
  },
  targetSkills: { fiveComplements: { "2=5-3": true } }, // Specifically target +3 via +5-2
};
```

## Assessment Data to Track

- **Per technique**:
  - Total attempts
  - Correct count
  - Consecutive correct streak
  - Average time per problem
  - Error patterns (which complement pairs are weak)

- **Per session**:
  - Date/time
  - Problems completed
  - Accuracy
  - Techniques practiced

## Questions Resolved

| Question            | Answer                                              |
| ------------------- | --------------------------------------------------- |
| Problem format?     | Multi-term sequences (3-7 terms), like the books    |
| Single-digit first? | No, double-digit from the start                     |
| Visualization mode? | No abacus visible - that's the point of mental math |
| Adaptive mastery?   | Yes, continue until demonstrated proficiency        |

## Sources

- [Fine Motor Math - 5-Complement Addition](https://finemotormath.com/abacus-lesson7/)
- [Fine Motor Math - 10-Complement Addition](https://finemotormath.com/abacus-lesson9/)
- [Fine Motor Math - Subtraction with Borrowing](https://finemotormath.com/abacus-lesson10/)
- [Learn Abacus At Home - Curriculum](https://learnabacusathome.com/curriculum/)
- [Soroban Exam - Basics](https://www.sorobanexam.org/basics/add.html)
