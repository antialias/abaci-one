# BKT-Driven Problem Generation Plan

## Overview

**Goal:** Use BKT P(known) estimates to drive problem complexity budgeting, replacing the discrete fluency-based system. Add preference toggle and ensure transparency across the system.

**Status:** Implementation in progress

---

## Current State vs Target State

| Aspect | Current (Fluency) | Target (BKT) |
|--------|-------------------|--------------|
| **Output** | 5 discrete states | Continuous P(known) [0,1] |
| **Multi-skill blame** | All skills get +1 attempt | Probabilistic: `blame ∝ (1 - pKnown)` |
| **Help level** | Heavy help breaks streak | Weighted evidence: 1.0×, 0.8×, 0.5× |
| **Response time** | Recorded but IGNORED | Weighted evidence: 0.5× to 1.2× |
| **Confidence** | None | Built-in confidence measure |
| **Progress** | Binary threshold (cliff effect) | Continuous smooth updates |

---

## Architecture

### Core Flow

```
generateSessionPlan()
  │
  ├─ Load problem history → getRecentSessionResults(playerId, 50)
  │
  ├─ Compute BKT → computeBktFromHistory(problemHistory)
  │     Returns: Map<skillId, {pKnown, confidence}>
  │
  └─ createSkillCostCalculator(fluencyHistory, { bktResults, useBktScaling })
        │
        ├─ IF useBktScaling AND bkt[skillId].confidence ≥ 0.5:
        │     multiplier = 4 - (pKnown × 3)   // Continuous [1, 4]
        │
        └─ ELSE: fluency fallback (discrete [1, 4])
```

### Multiplier Mapping

**BKT Continuous:**
- `pKnown = 0.0` → multiplier 4.0 (struggling)
- `pKnown = 0.5` → multiplier 2.5 (learning)
- `pKnown = 1.0` → multiplier 1.0 (mastered)

**Fluency Discrete (fallback):**
- `effortless` → 1
- `fluent` → 2
- `rusty` → 3
- `practicing` → 3
- `not_practicing` → 4

---

## Implementation Phases

### Phase 1: Core Backend Integration

**Files to modify:**

1. `src/utils/skillComplexity.ts`
   - Add `SkillCostCalculatorOptions` interface
   - Add `bktResults` and `useBktScaling` parameters
   - Implement continuous multiplier calculation

2. `src/lib/curriculum/session-planner.ts`
   - Add `getRecentSessionResults()` call
   - Compute BKT during session planning
   - Pass BKT results to cost calculator

3. `src/lib/curriculum/bkt/index.ts`
   - Export necessary types and functions

### Phase 2: Preference Setting

**Files to create/modify:**

1. `src/db/schema/player-curriculum.ts`
   - Add `problemGenerationMode` field

2. `drizzle/XXXX_add_problem_generation_mode.sql`
   - Migration to add column

3. `src/lib/curriculum/progress-manager.ts`
   - Add getter/setter for preference

4. `src/components/practice/StartSessionModal.tsx` (or equivalent)
   - Add toggle in expanded settings

### Phase 3: Skills Dashboard Consistency

**Files to modify:**

1. `src/app/practice/[studentId]/skills/SkillsClient.tsx`
   - Show complexity multiplier derived from P(known)
   - Add evidence breakdown
   - Show "what this means for problem generation"

2. `src/app/api/curriculum/[playerId]/bkt/route.ts`
   - Ensure same BKT computation as session planner

### Phase 4: Transparency & Education

**Files to create:**

1. `src/components/practice/BktExplainer.tsx`
   - "Learn more" modal content

2. `src/components/practice/SessionSummary.tsx` (enhance)
   - Show BKT changes after session

---

## Configuration

### New Config Constants

Location: `src/lib/curriculum/config/bkt-integration.ts`

```typescript
export const BKT_INTEGRATION_CONFIG = {
  /** Confidence threshold for trusting BKT over fluency */
  confidenceThreshold: 0.5,

  /** Minimum multiplier (when pKnown = 1.0) */
  minMultiplier: 1.0,

  /** Maximum multiplier (when pKnown = 0.0) */
  maxMultiplier: 4.0,

  /** Number of recent sessions to load for BKT computation */
  sessionHistoryDepth: 50,
}
```

---

## UI Design

### Ready to Practice Modal - Advanced Settings

```
┌─────────────────────────────────────────────────────────────┐
│  ▼ Advanced Settings                                        │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Problem Selection                                       ││
│  │                                                         ││
│  │ ○ Adaptive (recommended)                                ││
│  │   Uses Bayesian inference to estimate pattern mastery.  ││
│  │   Problems adjust smoothly based on your performance.   ││
│  │                                                         ││
│  │ ○ Classic                                               ││
│  │   Uses streak-based fluency thresholds.                 ││
│  │   Problems change when you hit mastery milestones.      ││
│  │                                                         ││
│  │ [?] Learn more about how problem selection works        ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### Enhanced Skill Card

```
┌─────────────────────────────────────────────────────────────┐
│  Pattern: Ten Complements +6                                │
│                                                             │
│  Mastery: ████████░░ 78%        Confidence: High (0.72)    │
│                                                             │
│  Problem Generation Impact:                                 │
│  • Complexity multiplier: 1.66× (lower = easier problems)  │
│  • This pattern appears in review and mixed practice       │
│                                                             │
│  Evidence:                                                  │
│  • 47 problems • 89% accuracy • Avg 4.2s • 4 hints used    │
└─────────────────────────────────────────────────────────────┘
```

---

## Testing Strategy

1. **Unit tests:** `createSkillCostCalculator` with/without BKT
2. **Integration tests:** Session planning produces valid plans in both modes
3. **Consistency tests:** Same BKT input → same output in dashboard and generation
4. **Manual testing:** Toggle preference, verify behavior changes

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Performance (loading history) | Load in parallel; consider caching |
| Cold start (no data) | Automatic fluency fallback |
| User confusion | Clear explanations, "Learn more" |
| Dashboard/generation mismatch | Single BKT computation source |

---

## Documentation Updates

After implementation, update:
- `docs/DAILY_PRACTICE_SYSTEM.md` - Add BKT integration section
- `.claude/CLAUDE.md` - Add BKT integration notes
- Blog post - Update to reflect actual integration
