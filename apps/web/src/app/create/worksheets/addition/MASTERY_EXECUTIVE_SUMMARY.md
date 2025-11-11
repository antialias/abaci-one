# Mastery Mode - Executive Summary

## What Is It?

**Mastery Mode** is a third worksheet configuration mode (alongside Smart and Manual) that helps users generate pedagogically-appropriate practice worksheets based on skill progression.

Think of it as **Smart Difficulty with skill-based presets instead of difficulty presets**.

---

## Core Concept

### Current Smart Mode

User picks a difficulty preset:

- "Beginner" → No regrouping, full scaffolding
- "Practice" → High regrouping, high scaffolding
- "Expert" → High regrouping, no scaffolding

### New Mastery Mode

User picks a skill to practice:

- "Two-digit with ones regrouping" → Auto-configured for that specific skill
- Worksheet automatically mixes 75% current skill + 25% review of mastered skills
- User can customize the mix ratio and review selection

---

## User Experience Flow

### 1. Mode Selection

User sees three tabs at the top of the config panel:

```
┌─────────────────────────────────┐
│ [ Smart ] [ Manual ] [Mastery]  │ ← Click Mastery
└─────────────────────────────────┘
```

### 2. Skill Selection

Interface shows current skill with navigation:

```
┌──────────────────────────────────────────────────────┐
│ Current Skill: Two-digit with ones regrouping    ✓   │
│                                                       │
│ [← Previous]  [Mark as Mastered]  [Next →]           │
└──────────────────────────────────────────────────────┘
```

**Actions:**

- **← Previous / Next →**: Navigate through skill sequence
- **Mark as Mastered**: Toggle mastery status (remembered for this user)
- **✓ indicator**: Shows this skill is already mastered

### 3. Mix Visualization (Collapsed by Default)

Like the current difficulty preset dropdown, shows a summary:

```
┌──────────────────────────────────────────────────────┐
│ Difficulty: Mastery - Two-digit ones regrouping   ▼  │
│ ──────────────────────────────────────────────────   │
│ 15 current skill, 5 review from 2 mastered skills    │
│ Recommended scaffolding                               │
└──────────────────────────────────────────────────────┘
```

Click to expand for full details:

```
┌──────────────────────────────────────────────────────┐
│ Difficulty: Mastery - Two-digit ones regrouping   ▲  │
│ ──────────────────────────────────────────────────   │
│                                                       │
│ 📊 Worksheet Mix (20 problems)                       │
│                                                       │
│ ┌────────────────────────────────────────┐           │
│ │ 15 problems │ Two-digit + ones regroup │ 75%      │
│ │ (current)   │ Example: 38 + 27         │          │
│ └────────────────────────────────────────┘           │
│                                                       │
│ ┌────────────────────────────────────────┐           │
│ │ 5 problems  │ Review: Mastered skills  │ 25%      │
│ │ (review)    │ • 2: Single-digit regroup│          │
│ │             │ • 3: Two-digit no regroup│          │
│ └────────────────────────────────────────┘           │
│                                                       │
│ ⚙️ Scaffolding (recommended for this skill)          │
│ • Carry boxes when regrouping                        │
│ • Answer boxes always                                │
│ • Place value colors always                          │
│ • Ten-frames when regrouping                         │
│                                                       │
│ [View All Skills]  [Customize Mix]                   │
└──────────────────────────────────────────────────────┘
```

**Key observability features:**

- **Current skill block** (blue): Shows count, percentage, example problem
- **Review block** (green): Shows count, percentage, breakdown by skill
- **Scaffolding summary**: What scaffolds are enabled for this skill
- **Action buttons**: Access full skill list or customize the mix

### 4. Preview with Problem Attribution

Worksheet preview shows which problems are current vs review:

```
┌─────────────────────────────────────┐
│ Problem 1            [Current]     │
│    38                               │
│  + 27                               │
│  ----                               │
├─────────────────────────────────────┤
│ Problem 2            [Review: 1d]  │
│     7                               │
│   + 8                               │
│  ----                               │
├─────────────────────────────────────┤
│ Problem 3            [Current]     │
│    49                               │
│  + 15                               │
│  ----                               │
└─────────────────────────────────────┘
```

**Badges:**

- Blue "Current" badge → Current skill problem
- Green "Review: skill-name" → Review problem (shows which skill)

**Note:** Badges only appear in preview, not in final PDF (cleaner output).

---

## Advanced Features

### View All Skills Modal

Click "View All Skills" to see complete progression:

```
┌─────────────────────────────────────────────────────┐
│ All Skills - Addition                            ×  │
│ ─────────────────────────────────────────────────   │
│                                                      │
│ ✓ Single-digit without regrouping                   │
│   Mastered • [Practice This] [Unmark]               │
│                                                      │
│ ✓ Single-digit with regrouping                      │
│   Mastered • [Practice This] [Unmark]               │
│                                                      │
│ ✓ Two-digit without regrouping                      │
│   Mastered • [Practice This] [Unmark]               │
│                                                      │
│ ⭐ Two-digit with ones regrouping (Current)         │
│   12 attempts • 78% accuracy                         │
│   [Mark as Mastered]                                 │
│                                                      │
│ ○ Two-digit with mixed regrouping                   │
│   Not started • [Practice This]                      │
│                                                      │
│ ⊘ Two-digit with frequent regrouping                │
│   Locked • Requires: Two-digit mixed regrouping     │
│                                                      │
│ ... (11 skills total for addition)                  │
│                                                      │
│ Progress: 3/11 skills mastered (27%)                 │
│                                                      │
│ [Close]                                              │
└─────────────────────────────────────────────────────┘
```

**Status indicators:**

- ✓ = Mastered (green)
- ⭐ = Current skill (blue, with stats)
- ○ = Available (prerequisites met)
- ⊘ = Locked (prerequisites not met)

**Actions per skill:**

- **Practice This**: Switch to this skill
- **Mark as Mastered / Unmark**: Toggle mastery
- Shows prerequisite requirements for locked skills

### Customize Mix Modal

Click "Customize Mix" for fine control:

```
┌─────────────────────────────────────────────────────┐
│ Customize Worksheet Mix                          ×  │
│ ─────────────────────────────────────────────────   │
│                                                      │
│ Mix Ratio                                            │
│                                                      │
│ Current Skill: 75% ███████████░░░                   │
│ Review:        25% ███░░░░░░░░░░                    │
│                                                      │
│ [━━━━━━●━━━━━━━━━━━] 75%                           │
│  More review      More current skill                │
│                                                      │
│ Review Skills                                        │
│ ☑ Single-digit with regrouping                      │
│ ☑ Two-digit without regrouping                      │
│                                                      │
│ [Reset to Default]  [Cancel]  [Apply]                │
└─────────────────────────────────────────────────────┘
```

**Controls:**

- **Slider**: Adjust current/review ratio (0-100% review)
- **Checkboxes**: Select which mastered skills to include in review
- **Reset**: Return to defaults (75% current, all recommended review skills)

---

## What Problems Get Generated?

### Example: Practicing "Two-digit with ones regrouping"

**Worksheet configuration** (20 problems):

- **15 current skill problems** (75%):
  - Digit range: 2 digits
  - Regrouping: ~50% of problems need ones place regrouping
  - Examples: 38+27, 49+15, 56+38

- **5 review problems** (25%):
  - 2-3 problems from "Single-digit with regrouping" (7+8, 9+6)
  - 2-3 problems from "Two-digit without regrouping" (23+45, 31+28)

**Scaffolding** (auto-configured for this skill level):

- Carry boxes: When regrouping
- Answer boxes: Always
- Place value colors: Always
- Ten-frames: When regrouping

**Result**: Worksheet is pedagogically appropriate for a student working on this specific skill, with built-in review to prevent forgetting.

---

## Skill Progression

### 11 Addition Skills (Linear Progression)

```
1. Single-digit without regrouping     (3+5, 2+4)
   └→ 2. Single-digit with regrouping  (7+8, 9+6)
      └→ 3. Two-digit without regrouping (23+45)
         └→ 4. Two-digit ones regrouping (38+27)
            └→ 5. Two-digit mixed regrouping (67+58)
               └→ 6. Two-digit full regrouping (88+99)
                  └→ 7. Three-digit no regrouping (234+451)
                     └→ 8. Three-digit simple regrouping (367+258)
                        └→ 9. Three-digit full regrouping (888+999)
                           └→ 10. Four-digit mastery (3847+2956)
                              └→ 11. Five-digit mastery (38472+29563)
```

### 10 Subtraction Skills (Mirror Structure)

Same progression pattern for subtraction (borrowing instead of carrying).

**Prerequisites**: Each skill requires mastering the previous one first.

**Review recommendations**: Each skill reviews 1-2 immediate prerequisites.

---

## Key UX Principles

### 1. **Transparency**

User always sees:

- What's in the mix (current skill vs review)
- How many of each type of problem
- Which skills are being reviewed
- Why (based on dependency graph)

### 2. **Control**

User can:

- Navigate freely between skills
- Manually mark skills as mastered/unmastered
- Customize mix ratio (0-100% review)
- Select specific review skills
- Jump to any unlocked skill

### 3. **Simplicity**

- No timers, no auto-advance
- No complex time-based calculations
- Just configuration presets organized by skill
- Works exactly like Smart mode, but skill-focused

### 4. **Observability**

- Collapsed summary (quick glance)
- Expanded detail (full breakdown)
- Problem attribution in preview
- Progress tracking (X/Y skills mastered)

---

## What Makes This Better Than Smart Mode?

### Smart Mode

- User picks difficulty level ("Beginner" to "Expert")
- Adjusts regrouping probability and scaffolding globally
- No concept of skill progression
- No automatic review mixing
- User manually adjusts digit range

### Mastery Mode

- User picks pedagogical skill to practice
- Problem configuration auto-tuned for that skill
- Clear progression path (unlock skills in order)
- Automatic review of prerequisite skills
- Digit range determined by skill (2-digit skill = 2-digit problems)

**Result**: Teachers/parents get appropriate worksheets without understanding regrouping probabilities, scaffolding rules, or digit ranges. Just pick the skill and generate.

---

## Technical Architecture

### Data Storage

**New table**: `worksheet_mastery`

```sql
CREATE TABLE worksheet_mastery (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  skill_id TEXT NOT NULL,
  is_mastered BOOLEAN NOT NULL DEFAULT FALSE,
  total_attempts INTEGER NOT NULL DEFAULT 0,
  correct_attempts INTEGER NOT NULL DEFAULT 0,
  last_accuracy REAL,
  mastered_at TIMESTAMP,
  last_practiced_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

**Tracks**:

- Which skills user has mastered (boolean)
- Attempt/accuracy stats (for future validation)
- Timestamps (for UI display only, not logic)

### Problem Generation

```typescript
// Phase 1: Determine current skill
const currentSkill = SKILL_DEFINITIONS.find(
  (s) => s.id === formState.currentSkillId,
);

// Phase 2: Get review skills (from recommendedReview list, filtered by mastery)
const reviewSkills = currentSkill.recommendedReview.filter(
  (skillId) => masteryStates.get(skillId)?.isMastered === true,
);

// Phase 3: Calculate mix
const total = formState.problemsPerPage;
const mixRatio = formState.reviewMixRatio ?? 0.25; // Default 25% review
const reviewCount = Math.floor(total * mixRatio);
const currentCount = total - reviewCount;

// Phase 4: Generate problems
const problems = [
  ...generateProblemsForSkill(currentSkill, currentCount),
  ...generateReviewProblems(reviewSkills, reviewCount),
];

// Phase 5: Shuffle and return
return shuffle(problems);
```

### Config Schema (V5)

```typescript
{
  version: 5,
  mode: "smart",
  masteryMode: true,  // NEW: Enable mastery mode
  currentSkillId: "td-ones-regroup",  // NEW: Which skill to practice
  reviewMixRatio: 0.25,  // NEW: What fraction is review (0-1)
  selectedReviewSkills: ["sd-simple-regroup", "td-no-regroup"],  // NEW: Manual override
  // ... all existing smart mode fields
}
```

---

## Implementation Phases

### Phase 1: Foundation (Backend)

- Database migration for `worksheet_mastery` table
- Define 21 `SKILL_DEFINITIONS` (11 addition, 10 subtraction)
- API endpoints: GET/POST `/api/worksheets/mastery`
- Problem generation with skill mix

### Phase 2: Basic UI

- Mode selector (Smart/Manual/Mastery tabs)
- Mastery mode panel with current skill display
- Previous/Next navigation buttons
- Collapsed/expanded mix visualization
- "Mark as Mastered" toggle

### Phase 3: Modals

- "View All Skills" modal with full progression
- Progress tracking (X/Y skills mastered)
- Click-to-select skill navigation

### Phase 4: Customization

- "Customize Mix" modal with slider
- Manual review skill selection
- Custom mix ratio persistence

### Phase 5: Polish

- Problem attribution badges in preview
- Smooth transitions between skills
- Responsive design (mobile/tablet)

---

## User Personas

### Persona 1: Parent Homeschooling 2nd Grader

**Goal**: Generate practice worksheets for child learning two-digit addition

**Flow**:

1. Opens worksheet generator
2. Clicks "Mastery" tab
3. Sees child is on "Two-digit with ones regrouping"
4. Clicks "Generate" → Gets appropriate worksheet
5. After child completes it successfully, clicks "Mark as Mastered"
6. Clicks "Next →" to move to "Two-digit mixed regrouping"
7. Generates next worksheet

**Value**: No need to understand regrouping probabilities or scaffolding rules. Just follow the skill progression.

### Persona 2: Teacher Managing Classroom

**Goal**: Create differentiated worksheets for students at different levels

**Flow**:

1. Opens worksheet generator
2. Clicks "View All Skills"
3. Sees student A is on skill #4, student B is on skill #7
4. For student A: Selects skill #4, generates worksheet
5. For student B: Selects skill #7, generates worksheet
6. Both worksheets are pedagogically appropriate for their levels

**Value**: Quick access to any skill level, clear progression tracking, appropriate scaffolding per skill.

### Persona 3: Math Tutor

**Goal**: Create targeted practice with heavy review component

**Flow**:

1. Opens worksheet generator
2. Clicks "Mastery" tab
3. Sees student is on "Three-digit simple regrouping"
4. Clicks "Customize Mix"
5. Adjusts slider to 50% review (more review than default)
6. Checks which review skills to include
7. Generates heavily-mixed worksheet

**Value**: Full control over mix ratio while maintaining skill-appropriate problem generation.

---

## Questions & Answers

### Q: What if I want pure practice (no review)?

**A**: Adjust mix ratio slider to 100% current / 0% review.

### Q: What if I want pure review?

**A**: Adjust mix ratio slider to 0% current / 100% review.

### Q: Can I practice a skill I haven't "unlocked" yet?

**A**: Yes! Click "Practice This" on any skill. Prerequisites only affect the suggested progression, not what you can select.

### Q: Does marking a skill as mastered change anything automatically?

**A**: No. It just updates the checkmark and enables that skill for review in future worksheets. You manually navigate to the next skill.

### Q: Can I go back to a mastered skill?

**A**: Yes. Click "Practice This" on any skill, including mastered ones. Useful for generating extra practice or review.

### Q: What happens if I unmark a skill as mastered?

**A**: It removes the checkmark and excludes it from review pools. You can re-mark it anytime.

### Q: Do the mastery states sync across devices?

**A**: Yes, they're stored in the database per user account.

---

## Summary

**Mastery Mode = Smart Mode + Skill Progression + Automatic Review Mixing**

- Same underlying system (regrouping probabilities, scaffolding rules)
- Organized around pedagogical skill sequence instead of difficulty levels
- Automatically mixes current practice with review of prerequisites
- User maintains full manual control
- Transparent observability into what's being generated and why
