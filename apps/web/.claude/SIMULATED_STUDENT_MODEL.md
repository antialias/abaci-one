# Simulated Student Model

## Overview

The `SimulatedStudent` class models how students learn soroban skills over time. It's used in journey simulation tests to validate that BKT-based adaptive problem generation outperforms classic random generation.

**Location:** `src/test/journey-simulator/SimulatedStudent.ts`

## Core Model: Hill Function Learning

The model uses the **Hill function** (from biochemistry/pharmacology) to model learning:

```
P(correct | skill) = exposure^n / (K^n + exposure^n)
```

Where:

- **exposure**: Number of times the student has attempted problems using this skill
- **K** (halfMaxExposure): Exposure count where P(correct) = 0.5
- **n** (hillCoefficient): Controls curve shape (n > 1 delays onset, then accelerates)

### Why Hill Function?

The Hill function naturally models how real learning works:

1. **Early struggles**: Low exposure = low probability (building foundation)
2. **Breakthrough**: At some point, understanding "clicks" (steep improvement)
3. **Mastery plateau**: High exposure approaches but never reaches 100%

### Example Curves

With K=10, n=2:

| Exposures | P(correct) | Stage                         |
| --------- | ---------- | ----------------------------- |
| 0         | 0%         | No knowledge                  |
| 5         | 20%        | Building foundation           |
| 10        | 50%        | Half-way (by definition of K) |
| 15        | 69%        | Understanding clicks          |
| 20        | 80%        | Confident                     |
| 30        | 90%        | Near mastery                  |

## Skill-Specific Difficulty

**Key insight from pedagogy:** Not all skills are equally hard. Ten-complements require cross-column operations and are inherently harder than five-complements.

### Difficulty Multipliers

Each skill has a difficulty multiplier applied to K:

```typescript
effectiveK = profile.halfMaxExposure * SKILL_DIFFICULTY_MULTIPLIER[skillId];
```

| Skill Category                     | Multiplier | Effect                           |
| ---------------------------------- | ---------- | -------------------------------- |
| Basic (directAddition, heavenBead) | 0.8-0.9x   | Easier, fewer exposures needed   |
| Five-complements                   | 1.2-1.3x   | Moderate, ~20-30% more exposures |
| Ten-complements                    | 1.6-2.1x   | Hardest, ~60-110% more exposures |

### Concrete Example

With profile K=10:

| Skill                 | Multiplier | Effective K | Exposures for 50% |
| --------------------- | ---------- | ----------- | ----------------- |
| basic.directAddition  | 0.8        | 8           | 8                 |
| fiveComplements.4=5-1 | 1.2        | 12          | 12                |
| tenComplements.9=10-1 | 1.6        | 16          | 16                |
| tenComplements.1=10-9 | 2.0        | 20          | 20                |

### Rationale for Specific Values

Based on soroban pedagogy:

- **Basic skills (0.8-0.9)**: Single-column, direct bead manipulation
- **Five-complements (1.2-1.3)**: Requires decomposition thinking (+4 = +5 -1)
- **Ten-complements (1.6-2.1)**: Cross-column carrying/borrowing, harder mental model
- **Harder ten-complements**: Larger adjustments (tenComplements.1=10-9 = +1 requires -9+10) are cognitively harder

## Conjunctive Model for Multi-Skill Problems

When a problem requires multiple skills (e.g., basic.directAddition + tenComplements.9=10-1):

```
P(correct) = P(skill_A) × P(skill_B) × P(skill_C) × ...
```

This models that ALL component skills must be applied correctly. A student strong in basics but weak in ten-complements will fail problems requiring ten-complements.

## Student Profiles

Profiles define different learner types:

```typescript
interface StudentProfile {
  name: string;
  halfMaxExposure: number; // K: lower = faster learner
  hillCoefficient: number; // n: curve shape
  initialExposures: Record<string, number>; // Pre-seeded learning
  helpUsageProbabilities: [number, number, number, number];
  helpBonuses: [number, number, number, number];
  baseResponseTimeMs: number;
  responseTimeVariance: number;
}
```

### Example Profiles

| Profile         | K   | n   | Description                        |
| --------------- | --- | --- | ---------------------------------- |
| Fast Learner    | 8   | 1.5 | Quick acquisition, smooth curve    |
| Average Learner | 12  | 2.0 | Typical learning rate              |
| Slow Learner    | 15  | 2.5 | Needs more practice, delayed onset |

## Exposure Accumulation

**Critical behavior**: Exposure increments on EVERY attempt, not just correct answers.

This models that students learn from engaging with material, regardless of success. The attempt itself is the learning event.

```typescript
// Learning happens from attempting, not just succeeding
for (const skillId of skillsChallenged) {
  const current = this.skillExposures.get(skillId) ?? 0;
  this.skillExposures.set(skillId, current + 1);
}
```

## Fatigue Tracking

The model tracks cognitive load based on true skill mastery:

| True P(correct) | Fatigue Multiplier | Interpretation                 |
| --------------- | ------------------ | ------------------------------ |
| ≥ 90%           | 1.0x               | Automated, low effort          |
| ≥ 70%           | 1.5x               | Nearly automated               |
| ≥ 50%           | 2.0x               | Moderate effort                |
| ≥ 30%           | 3.0x               | Struggling                     |
| < 30%           | 4.0x               | Very weak, high cognitive load |

## Help System

Students can use help at four levels:

- **Level 0**: No help
- **Level 1**: Hint
- **Level 2**: Decomposition shown
- **Level 3**: Full solution

Help provides an additive bonus to probability (not multiplicative), simulating that help scaffolds understanding but doesn't guarantee correctness.

## Validation

The model is validated by:

1. **BKT Correlation**: BKT's P(known) should correlate with true P(correct)
2. **Learning Trajectories**: Accuracy should improve over sessions
3. **Skill Targeting**: Adaptive mode should surface weak skills faster
4. **Difficulty Ordering**: Ten-complements should take longer to master than five-complements

## Files

- `src/test/journey-simulator/SimulatedStudent.ts` - Main model implementation
- `src/test/journey-simulator/types.ts` - StudentProfile type definition
- `src/test/journey-simulator/profiles/` - Predefined learner profiles
- `src/test/journey-simulator/journey-simulator.test.ts` - Validation tests

## Future Improvements

Based on consultation with Kehkashan Khan (abacus coach):

1. **Forgetting/Decay**: Skills may decay without practice (not yet implemented)
2. **Transfer Effects**: Learning +4 may help learning +3 (not yet implemented)
3. **Warm-up Effects**: First few problems may be shakier (not yet implemented)
4. **Within-session Fatigue**: Later problems may be harder (partially implemented via fatigue tracking)

See `.claude/KEHKASHAN_CONSULTATION.md` for full consultation notes.
