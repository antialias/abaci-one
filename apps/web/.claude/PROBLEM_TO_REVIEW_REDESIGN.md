# Plan: ProblemToReview Redesign

## Problem Statement

The current ProblemToReview component has redundant information - the collapsed view shows the problem, and expanding reveals DetailedProblemCard which shows the same problem again. Users need to quickly identify problems and understand why they went wrong.

## Design Goals

1. **Single problem representation** - never duplicate the problem display
2. **BKT-driven weak skill detection** - use mastery data to identify likely causes
3. **Progressive disclosure** - collapsed shows identification, expanded shows annotations
4. **Actionable insights** - surface what the student needs to work on

---

## Collapsed View

```
┌─────────────────────────────────────────────────────────────────┐
│ #5  🧮 Abacus                              ❌ Incorrect         │
│     ┌─────┐                                                     │
│     │   5 │                                                     │
│     │ + 4 │  = 9  [said 8]                                     │
│     └─────┘                                                     │
│                                                                 │
│  ⚠️ 5's: 4=5-1, 10's: 8=10-2  (+1 more)                  [▼]   │
└─────────────────────────────────────────────────────────────────┘
```

**Elements:**
- Problem number + part type (🧮 Abacus, 🧠 Visualize, 💭 Mental)
- Problem in vertical format (even for linear problems)
- Wrong answer indicator: `[said 8]`
- Reason badges (❌ Incorrect, ⏱️ Slow, 💡 Help used)
- Weak skills summary: up to 3, ordered by BKT severity, "+N more" if truncated
- Expand button

---

## Expanded View

```
┌─────────────────────────────────────────────────────────────────┐
│ #5  🧮 Abacus                              ❌ Incorrect    [▲]  │
│                                                                 │
│     ┌─────┬───────────────────────────────────────────────────┐│
│     │   5 │  direct addition                                  ││
│     │ + 4 │  ⚠️ 5's: 4=5-1  ← likely cause                    ││
│     ├─────┼───────────────────────────────────────────────────┤│
│     │ = 9 │  [said 8]                                         ││
│     └─────┴───────────────────────────────────────────────────┘│
│                                                                 │
│  ⚠️ Weak: 5's: 4=5-1 (23%), 10's: 8=10-2 (41%), +1 more        │
│                                                                 │
│  ⏱️ 12.3s response (threshold: 8.5s)                           │
│                                                                 │
│  🎯 Focus: Practicing a skill you're still learning, with      │
│     scaffolding to build confidence.                           │
└─────────────────────────────────────────────────────────────────┘
```

**Elements:**
- Same header as collapsed
- Problem with skill annotations next to each term
- Weak skills marked with ⚠️ and "← likely cause" indicator
- Weak skills summary with BKT mastery percentages
- Timing info (response time vs threshold)
- Purpose with full explanation text

---

## Implementation Steps

### Step 1: Add BKT data to ProblemToReview props
- Add `skillMasteries: Record<string, number>` prop (skillId → mastery 0-1)
- Pass from SessionSummary which can compute from session or fetch from API

### Step 2: Create weak skill detection utility
- `getWeakSkillsForProblem(skillsExercised: string[], masteries: Record<string, number>)`
- Returns skills sorted by mastery (lowest first)
- Include mastery percentage for display

### Step 3: Create AnnotatedProblem component
- Single component that handles both collapsed and expanded states
- Vertical format for all problems (linear and vertical parts)
- In expanded mode: shows skill annotation next to each term
- Highlights weak skills with ⚠️ indicator

### Step 4: Create WeakSkillsSummary component
- Shows up to 3 weak skills, ordered by severity
- "+N more" indicator if truncated
- In expanded mode: includes mastery percentages

### Step 5: Create PurposeExplanation component
- Maps purpose (focus/reinforce/review/challenge) to explanation text
- Reuse or extract from existing purpose tooltip logic

### Step 6: Refactor ProblemToReview
- Remove DetailedProblemCard usage
- Use new AnnotatedProblem component
- Add WeakSkillsSummary to both views
- Add timing and purpose sections to expanded view

### Step 7: Update SessionSummary to pass BKT data
- Compute skill masteries from session results OR
- Fetch from /api/curriculum/[playerId]/skills endpoint
- Pass to ProblemToReview components

### Step 8: Hide costs in session summary context
- Add `showCosts` prop to any shared components
- Default false for session summary, true for plan review

---

## Files to Modify/Create

| File | Action |
|------|--------|
| `src/components/practice/ProblemToReview.tsx` | Major refactor |
| `src/components/practice/AnnotatedProblem.tsx` | New component |
| `src/components/practice/WeakSkillsSummary.tsx` | New component |
| `src/components/practice/weakSkillUtils.ts` | New utility |
| `src/components/practice/SessionSummary.tsx` | Pass BKT data |
| `src/components/practice/purposeExplanations.ts` | New or extract existing |

---

## Data Flow

```
SessionSummary
  ├── Fetches/computes skill masteries
  └── Passes to ProblemToReview
        ├── weakSkillUtils.getWeakSkillsForProblem()
        ├── AnnotatedProblem (collapsed or expanded)
        ├── WeakSkillsSummary
        └── Timing + Purpose sections (expanded only)
```

---

## Open Questions (Resolved)

- ✅ Use BKT data for weak skill detection
- ✅ Show up to 3 weak skills, "+N more" if truncated
- ✅ Order by BKT severity (lowest mastery first)
- ✅ Show weak skills on correct problems too (if they're in review list for timing/help reasons)
- ✅ Single problem representation, annotated in expanded view
