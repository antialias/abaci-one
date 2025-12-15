# Bayesian Knowledge Tracing (BKT) Design Specification

## Overview

This document specifies the implementation of Conjunctive Bayesian Knowledge Tracing for the soroban practice system. BKT provides epistemologically honest skill mastery estimates that account for:

1. **Asymmetric evidence**: Correct answers prove all skills; wrong answers only prove ≥1 skill failed
2. **Multi-skill problems**: Probabilistic blame distribution across co-occurring skills
3. **Uncertainty quantification**: Confidence intervals on mastery estimates
4. **Staleness indicators**: Show "last practiced X days ago" separately (not decay)

## Architecture Decision: Lazy Computation

**Key Decision**: BKT is computed on-demand when viewing reports, NOT in real-time during practice.

**Why:**
- No new database tables needed
- No hooks into practice session flow
- Can replay SlotResult history to compute BKT state
- Easy to change algorithm without migration
- Can add user controls (confidence slider, priors toggle) dynamically
- Estimated computation time: ~50ms for full report

**How it works:**
1. User opens Skills Dashboard
2. Dashboard fetches recent SlotResults (already stored in session_plans)
3. Pure functions replay history to compute BKT state for each skill
4. Display results with confidence indicators

---

## The Problem We're Solving

**Current approach (naive):**
```
accuracy = correct / attempts  // Treats both signals as equivalent
```

**Why it's wrong:**
- Correct: Strong evidence ALL skills are known
- Incorrect: Weak evidence that ONE OR MORE skills failed (we don't know which)

**BKT approach:**
- Maintain P(known) per skill with proper Bayesian updates
- Distribute "blame" for errors probabilistically based on prior beliefs
- Report uncertainty honestly

---

## 1. Data Source

### Existing Data (No Schema Changes Needed)

We already have all the data we need in `session_plans.results`:

```typescript
// From src/db/schema/session-plans.ts
export interface SlotResult {
  slotIndex: number
  problemIndex: number
  problem: GeneratedProblem  // Contains skillIds
  isCorrect: boolean
  timestamp: number
  responseTimeMs: number
  userAnswer: number | null
  helpLevel: 0 | 1 | 2 | 3
}
```

The `problem.skillIds` field tells us which skills were involved in each problem.

### Data Fetching

Already implemented: `getRecentSessionResults(playerId, sessionCount)` in `session-planner.ts`

---

## 2. BKT Algorithm (Pure Functions)

### 2.1 Core BKT Update Equations

```typescript
// src/lib/curriculum/bkt/bkt-core.ts

export interface BktParams {
  pInit: number   // P(L0) - prior knowledge
  pLearn: number  // P(T) - learning rate
  pSlip: number   // P(S) - slip rate
  pGuess: number  // P(G) - guess rate
}

export interface BktState {
  pKnown: number
  opportunities: number
  successCount: number
  lastPracticedAt: Date | null
}

/**
 * Standard BKT update for a SINGLE skill given an observation.
 *
 * For correct answer:
 *   P(known | correct) = P(correct | known) × P(known) / P(correct)
 *   where P(correct | known) = 1 - P(slip)
 *   and   P(correct | ¬known) = P(guess)
 *
 * For incorrect answer:
 *   P(known | incorrect) = P(incorrect | known) × P(known) / P(incorrect)
 *   where P(incorrect | known) = P(slip)
 *   and   P(incorrect | ¬known) = 1 - P(guess)
 */
export function bktUpdate(
  priorPKnown: number,
  isCorrect: boolean,
  params: BktParams
): number {
  const { pSlip, pGuess } = params

  if (isCorrect) {
    const pCorrect = priorPKnown * (1 - pSlip) + (1 - priorPKnown) * pGuess
    const pKnownGivenCorrect = (priorPKnown * (1 - pSlip)) / pCorrect
    return pKnownGivenCorrect
  } else {
    const pIncorrect = priorPKnown * pSlip + (1 - priorPKnown) * (1 - pGuess)
    const pKnownGivenIncorrect = (priorPKnown * pSlip) / pIncorrect
    return pKnownGivenIncorrect
  }
}

/**
 * Apply learning transition after observation.
 * P(known after learning) = P(known) + P(¬known) × P(learn)
 */
export function applyLearning(pKnown: number, pLearn: number): number {
  return pKnown + (1 - pKnown) * pLearn
}
```

### 2.2 Conjunctive BKT for Multi-Skill Problems

```typescript
// src/lib/curriculum/bkt/conjunctive-bkt.ts

export interface SkillBktRecord {
  skillId: string
  pKnown: number
  params: BktParams
}

export interface BlameDistribution {
  skillId: string
  blameWeight: number  // Higher = more likely this skill caused the error
  updatedPKnown: number
}

/**
 * For a CORRECT multi-skill answer:
 * All skills receive positive evidence (student knew all of them).
 * Update each skill independently with the correct observation.
 */
export function updateOnCorrect(
  skills: SkillBktRecord[]
): { skillId: string; updatedPKnown: number }[] {
  return skills.map(skill => ({
    skillId: skill.skillId,
    updatedPKnown: applyLearning(
      bktUpdate(skill.pKnown, true, skill.params),
      skill.params.pLearn
    ),
  }))
}

/**
 * For an INCORRECT multi-skill answer:
 * Distribute blame probabilistically based on which skill most likely failed.
 *
 * Simplified approximation:
 *   blame(X) ∝ (1 - pKnown(X)) / Σ(1 - pKnown(all))
 */
export function updateOnIncorrect(
  skills: SkillBktRecord[]
): BlameDistribution[] {
  const totalUnknown = skills.reduce((sum, s) => sum + (1 - s.pKnown), 0)

  if (totalUnknown < 0.001) {
    // All skills appear mastered - must be a slip, distribute evenly
    const evenWeight = 1 / skills.length
    return skills.map(skill => ({
      skillId: skill.skillId,
      blameWeight: evenWeight,
      updatedPKnown: bktUpdate(skill.pKnown, false, skill.params),
    }))
  }

  return skills.map(skill => {
    const blameWeight = (1 - skill.pKnown) / totalUnknown

    // Weighted update: soften negative evidence for skills unlikely to have caused error
    const fullNegativeUpdate = bktUpdate(skill.pKnown, false, skill.params)
    const weightedPKnown = skill.pKnown * (1 - blameWeight) + fullNegativeUpdate * blameWeight

    return {
      skillId: skill.skillId,
      blameWeight,
      updatedPKnown: weightedPKnown,
    }
  })
}
```

### 2.3 Evidence Quality Modifiers

```typescript
// src/lib/curriculum/bkt/evidence-quality.ts

/**
 * Adjust observation weight based on help level.
 * More help = less confident the student really knows it.
 */
export function helpLevelWeight(helpLevel: 0 | 1 | 2 | 3): number {
  switch (helpLevel) {
    case 0: return 1.0    // No help - full evidence
    case 1: return 0.8    // Minor hint - slight reduction
    case 2: return 0.5    // Significant help - halve evidence
    case 3: return 0.5    // Full help - halve evidence
  }
}

/**
 * Adjust observation weight based on response time.
 *
 * - Fast correct → strong evidence of mastery
 * - Slow correct → might have struggled
 * - Fast incorrect → careless slip (less negative)
 * - Slow incorrect → genuine confusion (stronger negative)
 */
export function responseTimeWeight(
  responseTimeMs: number,
  isCorrect: boolean,
  expectedTimeMs: number = 5000
): number {
  const ratio = responseTimeMs / expectedTimeMs

  if (isCorrect) {
    if (ratio < 0.5) return 1.2      // Very fast - strong mastery
    if (ratio > 2.0) return 0.8      // Very slow - struggled
    return 1.0
  } else {
    if (ratio < 0.3) return 0.5      // Very fast error - careless slip
    if (ratio > 2.0) return 1.2      // Very slow error - genuine confusion
    return 1.0
  }
}
```

### 2.4 Domain-Informed Priors

```typescript
// src/lib/curriculum/bkt/skill-priors.ts

export function getDefaultParams(skillId: string): BktParams {
  // Basic skills are easier to learn
  if (skillId.startsWith('basic.')) {
    return { pInit: 0.3, pLearn: 0.4, pSlip: 0.05, pGuess: 0.02 }
  }
  // Five complements are moderately difficult
  if (skillId.startsWith('fiveComplements')) {
    return { pInit: 0.1, pLearn: 0.3, pSlip: 0.1, pGuess: 0.02 }
  }
  // Ten complements are harder
  if (skillId.startsWith('tenComplements')) {
    return { pInit: 0.05, pLearn: 0.25, pSlip: 0.15, pGuess: 0.02 }
  }
  // Mixed complements are hardest
  if (skillId.startsWith('mixedComplements')) {
    return { pInit: 0.02, pLearn: 0.2, pSlip: 0.2, pGuess: 0.02 }
  }
  // Default
  return { pInit: 0.1, pLearn: 0.3, pSlip: 0.1, pGuess: 0.05 }
}
```

### 2.5 Confidence Calculation

```typescript
// src/lib/curriculum/bkt/confidence.ts

/**
 * Calculate confidence in pKnown estimate.
 * Based on number of opportunities and consistency of observations.
 * Returns value in [0, 1] where 1 = highly confident.
 */
export function calculateConfidence(
  opportunities: number,
  successRate: number
): number {
  // More data = more confidence (asymptotic to 1)
  const dataConfidence = 1 - Math.exp(-opportunities / 20)

  // Extreme success rates (very high or very low) = more confidence
  const extremity = Math.abs(successRate - 0.5) * 2  // 0 at 50%, 1 at 0% or 100%
  const consistencyBonus = extremity * 0.2

  return Math.min(1, dataConfidence + consistencyBonus)
}

/**
 * Get confidence label for display.
 */
export function getConfidenceLabel(confidence: number): string {
  if (confidence > 0.7) return 'confident'
  if (confidence > 0.4) return 'moderate'
  return 'uncertain'
}

/**
 * Calculate uncertainty range around pKnown estimate.
 * Wider range when confidence is low.
 */
export function getUncertaintyRange(
  pKnown: number,
  confidence: number
): { low: number; high: number } {
  const uncertainty = (1 - confidence) * 0.3  // Max ±30% when confidence = 0
  return {
    low: Math.max(0, pKnown - uncertainty),
    high: Math.min(1, pKnown + uncertainty),
  }
}
```

---

## 3. Main BKT Computation Function

```typescript
// src/lib/curriculum/bkt/compute-bkt.ts

import type { ProblemResultWithContext } from '../session-planner'
import { getDefaultParams, type BktParams } from './skill-priors'
import { updateOnCorrect, updateOnIncorrect } from './conjunctive-bkt'
import { helpLevelWeight, responseTimeWeight } from './evidence-quality'
import { calculateConfidence, getUncertaintyRange } from './confidence'

export interface BktComputeOptions {
  /** Confidence threshold for mastery classification */
  confidenceThreshold: number
  /** Use cross-student priors (aggregated from other students) */
  useCrossStudentPriors: boolean
}

export interface SkillBktResult {
  skillId: string
  pKnown: number
  confidence: number
  uncertaintyRange: { low: number; high: number }
  opportunities: number
  successCount: number
  lastPracticedAt: Date | null
  masteryClassification: 'mastered' | 'learning' | 'struggling'
}

export interface BktComputeResult {
  skills: SkillBktResult[]
  interventionNeeded: SkillBktResult[]
  strengths: SkillBktResult[]
}

/**
 * Compute BKT state for all skills from problem history.
 * This is the main entry point - call it when displaying the Skills Dashboard.
 */
export function computeBktFromHistory(
  results: ProblemResultWithContext[],
  options: BktComputeOptions = { confidenceThreshold: 0.5, useCrossStudentPriors: false }
): BktComputeResult {
  // Sort by timestamp to replay in order
  const sorted = [...results].sort((a, b) => a.timestamp - b.timestamp)

  // Track state for each skill
  const skillStates = new Map<string, {
    pKnown: number
    opportunities: number
    successCount: number
    lastPracticedAt: Date | null
    params: BktParams
  }>()

  // Initialize and update for each problem
  for (const result of sorted) {
    const skillIds = result.problem.skillIds ?? []
    if (skillIds.length === 0) continue

    // Ensure all skills have state
    for (const skillId of skillIds) {
      if (!skillStates.has(skillId)) {
        const params = getDefaultParams(skillId)
        skillStates.set(skillId, {
          pKnown: params.pInit,
          opportunities: 0,
          successCount: 0,
          lastPracticedAt: null,
          params,
        })
      }
    }

    // Build skill records for BKT update
    const skillRecords = skillIds.map(skillId => {
      const state = skillStates.get(skillId)!
      return {
        skillId,
        pKnown: state.pKnown,
        params: state.params,
      }
    })

    // Calculate evidence weight
    const helpWeight = helpLevelWeight(result.helpLevel)
    const rtWeight = responseTimeWeight(result.responseTimeMs, result.isCorrect)
    const evidenceWeight = helpWeight * rtWeight

    // Compute updates
    const updates = result.isCorrect
      ? updateOnCorrect(skillRecords)
      : updateOnIncorrect(skillRecords)

    // Apply updates with evidence weighting
    for (const update of updates) {
      const state = skillStates.get(update.skillId)!

      // Weighted blend between old and new pKnown based on evidence quality
      const newPKnown = state.pKnown * (1 - evidenceWeight) + update.updatedPKnown * evidenceWeight

      state.pKnown = newPKnown
      state.opportunities += 1
      if (result.isCorrect) state.successCount += 1
      state.lastPracticedAt = new Date(result.timestamp)
    }
  }

  // Convert to results
  const skills: SkillBktResult[] = []

  for (const [skillId, state] of skillStates) {
    const successRate = state.opportunities > 0 ? state.successCount / state.opportunities : 0.5
    const confidence = calculateConfidence(state.opportunities, successRate)
    const uncertaintyRange = getUncertaintyRange(state.pKnown, confidence)

    // Classify mastery
    let masteryClassification: 'mastered' | 'learning' | 'struggling'
    if (state.pKnown >= 0.8 && confidence >= options.confidenceThreshold) {
      masteryClassification = 'mastered'
    } else if (state.pKnown < 0.5 && confidence >= options.confidenceThreshold) {
      masteryClassification = 'struggling'
    } else {
      masteryClassification = 'learning'
    }

    skills.push({
      skillId,
      pKnown: state.pKnown,
      confidence,
      uncertaintyRange,
      opportunities: state.opportunities,
      successCount: state.successCount,
      lastPracticedAt: state.lastPracticedAt,
      masteryClassification,
    })
  }

  // Sort by pKnown ascending (struggling skills first)
  skills.sort((a, b) => a.pKnown - b.pKnown)

  // Identify intervention needed (low pKnown with high confidence)
  const interventionNeeded = skills.filter(
    s => s.masteryClassification === 'struggling'
  )

  // Identify strengths (high pKnown with high confidence)
  const strengths = skills.filter(
    s => s.masteryClassification === 'mastered'
  )

  return { skills, interventionNeeded, strengths }
}
```

---

## 4. UI Display Updates

### 4.1 Honest Language Guidelines

**DON'T say:**
- "85% accuracy" (misleading - implies binary success tracking)
- "Mastery: 85%" (implies certainty we don't have)
- "You know this skill" (we can't know for sure)

**DO say:**
- "~73% mastered (moderate confidence)"
- "Estimated: 73% ± 15%"
- "Appears mastered (based on 12 problems)"
- "Needs attention (5 recent errors)"

### 4.2 Skill Card Display

```typescript
interface SkillDisplayData {
  skillId: string
  displayName: string

  // BKT metrics
  pKnown: number           // 0-1, the main estimate
  confidence: number       // 0-1, how certain we are
  uncertaintyRange: { low: number; high: number }

  // Raw evidence
  opportunities: number    // Total problems
  successCount: number
  errorCount: number       // opportunities - successCount

  // Staleness
  lastPracticedAt: Date | null
  daysSinceLastPractice: number | null
}

// Display:
// "~73% mastered (moderate confidence)"
// "Based on 15 problems (12 correct, 3 with errors)"
// "Last practiced 3 days ago"
```

### 4.3 Staleness Indicator

Show staleness separately from P(known) - don't apply decay to the estimate.

```typescript
function getStalenessWarning(daysSinceLastPractice: number | null): string | null {
  if (daysSinceLastPractice === null) return null
  if (daysSinceLastPractice < 7) return null
  if (daysSinceLastPractice < 14) return 'Not practiced recently'
  if (daysSinceLastPractice < 30) return 'Getting rusty'
  return 'Very stale - may need review'
}
```

### 4.4 UI Controls

**Confidence Threshold Slider:**
- Default: 0.5
- Range: 0.3 to 0.8
- Affects mastery classification: higher threshold = stricter "mastered" label

**Cross-Student Priors Toggle (future):**
- Default: off (use domain-informed priors only)
- When on: adjust priors based on aggregate student data

---

## 5. Implementation Plan

### Phase 1: Core BKT Functions (No DB Changes)
1. Create `src/lib/curriculum/bkt/` directory
2. Implement pure functions: bkt-core.ts, conjunctive-bkt.ts, evidence-quality.ts, skill-priors.ts, confidence.ts
3. Implement main entry point: compute-bkt.ts
4. Write unit tests for BKT math

### Phase 2: Skills Dashboard Update
1. Update `SkillsClient.tsx` to call `computeBktFromHistory()`
2. Replace naive accuracy display with P(known) + confidence
3. Use honest language in all labels
4. Add staleness indicators

### Phase 3: UI Controls
1. Add confidence threshold slider to Skills Dashboard
2. Store preference in localStorage
3. (Future) Add cross-student priors toggle

---

## 6. Open Questions (Deferred)

1. **Cross-student priors**: How do we aggregate data across students to inform priors?
   - Answer: Deferred. Start with domain-informed priors only.

2. **Decay vs Staleness**: Should we eventually add decay?
   - Answer: Show staleness indicator for now. Can add optional decay toggle later.

3. **Parameter estimation**: Should P(T), P(S), P(G) be learned from data?
   - Answer: Start with domain-informed values. Can tune later with A/B testing.

---

## 7. BKT-Driven Problem Generation

**Implemented in December 2024**

### 7.1 Problem Generation Modes

Students can choose between two modes in the "Ready to Practice" modal:

**Adaptive Mode (Default):**
- Uses BKT P(known) estimates for continuous complexity scaling
- Formula: `multiplier = 4 - (pKnown × 3)`
- Requires confidence ≥ 0.5 (~20 problems with skill)
- Falls back to Classic mode if insufficient data

**Classic Mode:**
- Uses fluency-based discrete multipliers
- `effortless (1×), fluent (2×), rusty (3×), practicing (3×), not_practicing (4×)`
- Fluency requires: ≥5 consecutive correct, ≥10 attempts, ≥85% accuracy

### 7.2 Implementation Files

| File | Purpose |
|------|---------|
| `config/bkt-integration.ts` | BKT config and multiplier calculation |
| `utils/skillComplexity.ts` | Cost calculator with BKT support |
| `session-planner.ts` | Session planning with BKT loading |
| `StartPracticeModal.tsx` | Mode selection UI |
| `SkillsClient.tsx` | Skills dashboard with multiplier display |

### 7.3 User Preference Storage

```sql
-- player_curriculum table
problem_generation_mode TEXT DEFAULT 'adaptive' NOT NULL
-- Values: 'adaptive' | 'classic'
```

### 7.4 Skills Dashboard Consistency

The Skills Dashboard now shows:
1. **P(known) estimate** - Same BKT estimate used for problem generation
2. **Complexity multiplier** - Actual multiplier that will be used (e.g., "1.75×")
3. **Mode indicator** - Whether BKT or fluency is being used for this skill

This ensures complete transparency about what drives problem generation.

---

## References

- Corbett, A. T., & Anderson, J. R. (1994). Knowledge tracing: Modeling the acquisition of procedural knowledge.
- Pardos, Z. A., & Heffernan, N. T. (2011). KT-IDEM: Introducing item difficulty to the knowledge tracing model.
