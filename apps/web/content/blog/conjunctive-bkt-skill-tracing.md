---
title: "Binary Outcomes, Granular Insights: How We Know Which Abacus Skill Needs Work"
description: "How we use conjunctive Bayesian Knowledge Tracing to infer which visual-motor patterns a student has automated when all we observe is 'problem correct' or 'problem incorrect'."
author: "Abaci.one Team"
publishedAt: "2025-12-14"
updatedAt: "2025-12-16"
tags: ["education", "machine-learning", "bayesian", "soroban", "knowledge-tracing", "adaptive-learning"]
featured: true
---

# Binary Outcomes, Granular Insights: How We Know Which Abacus Skill Needs Work

> **Abstract:** Soroban (Japanese abacus) pedagogy treats arithmetic as a sequence of visual-motor patterns to be drilled to automaticity. Each numeral operation (adding 1, adding 2, ...) in each column context is a distinct pattern; curricula explicitly sequence these patterns, requiring mastery of each before introducing the next. This creates a well-defined skill hierarchy of ~30 discrete patterns. We apply conjunctive Bayesian Knowledge Tracing to infer pattern mastery from binary problem outcomes. At problem-generation time, we simulate the abacus to tag each term with the specific patterns it exercises. Correct answers provide evidence for all tagged patterns; incorrect answers distribute blame proportionally to each pattern's estimated weakness. BKT drives both skill targeting (prioritizing weak skills for practice) and difficulty adjustment (scaling problem complexity to mastery level). Simulation studies validate that adaptive targeting reaches mastery 25-33% faster than uniform skill distribution. Our 3-way comparison found that the benefit comes from BKT *targeting*, not the specific cost formula—using BKT for both concerns simplifies the architecture with no performance cost.

---

Soroban (Japanese abacus) pedagogy structures arithmetic as a sequence of visual-motor patterns. Each numeral operation in each column context is a distinct pattern to be drilled until automatic. Curricula explicitly sequence these patterns—master adding 1 before adding 2, master five's complements before ten's complements—creating a well-defined hierarchy of ~30 discrete skills.

This structure creates both an opportunity and a challenge for adaptive practice software. The opportunity: we know exactly which patterns each problem exercises. The challenge: when a student answers incorrectly, we observe only a binary outcome—**correct** or **incorrect**—but need to infer which of several patterns failed.

This post describes how we solve this inference problem using **Conjunctive Bayesian Knowledge Tracing (BKT)**, applied to the soroban's well-defined pattern hierarchy.

## Context-Dependent Patterns

On a soroban, adding "+4" isn't a single pattern. It's one of several distinct visual-motor sequences depending on the current state of the abacus column.

A soroban column has 4 earth beads and 1 heaven bead (worth 5). The earth beads that are "up" (toward the reckoning bar) contribute to the displayed value. When we say "column shows 3," that means 3 earth beads are already up—leaving only 1 earth bead available to push up.

**Scenario 1: Column shows 0**
- Earth beads available: 4 (none are up yet)
- To add 4: Push 4 earth beads up directly
- **Skill exercised**: `basic.directAddition`

**Scenario 2: Column shows 3**
- Earth beads available: 1 (3 are already up)
- To add 4: Can't push 4 beads directly—only 1 is available!
- Operation: Lower the heaven bead (+5), then raise 1 earth bead back (-1)
- **Skill exercised**: `fiveComplements.4=5-1`

**Scenario 3: Column shows 7**
- Column state: Heaven bead is down (5), 2 earth beads are up (5+2=7)
- To add 4: Result would be 11—overflows the column!
- Operation: Add 10 to the next column (carry), subtract 6 from this column
- **Skill exercised**: `tenComplements.4=10-6`

The same term "+4" requires completely different finger movements and visual patterns depending on the abacus state. A student who has automated `basic.directAddition` might still struggle with `tenComplements.4=10-6`—these are distinct patterns that must be drilled separately.

## The Soroban Pattern Hierarchy

Soroban curricula organize patterns into a strict progression, where each level must be mastered before advancing. We model this as approximately 30 distinct patterns:

### Basic Patterns (Complexity 0)
Direct bead manipulations—the foundation that must be automatic before advancing:
- `basic.directAddition` — Push 1-4 earth beads up
- `basic.directSubtraction` — Pull 1-4 earth beads down
- `basic.heavenBead` — Lower the heaven bead (add 5)
- `basic.heavenBeadSubtraction` — Raise the heaven bead (subtract 5)
- `basic.simpleCombinations` — Add 6-9 using earth + heaven beads together

### Five-Complement Patterns (Complexity 1)
Single-column patterns involving the heaven bead threshold—introduced only after basic patterns are automatic:
- `fiveComplements.4=5-1` — "Add 4" becomes "add 5, subtract 1"
- `fiveComplements.3=5-2` — "Add 3" becomes "add 5, subtract 2"
- `fiveComplements.2=5-3` — "Add 2" becomes "add 5, subtract 3"
- `fiveComplements.1=5-4` — "Add 1" becomes "add 5, subtract 4"

And the corresponding subtraction variants (`fiveComplementsSub.*`).

### Ten-Complement Patterns (Complexity 2)
Multi-column patterns involving carries and borrows—the final major category:
- `tenComplements.9=10-1` — "Add 9" becomes "carry 10, subtract 1"
- `tenComplements.8=10-2` — "Add 8" becomes "carry 10, subtract 2"
- ... through `tenComplements.1=10-9`

And the corresponding subtraction variants (`tenComplementsSub.*`).

### Mixed/Advanced Patterns (Complexity 3)
Cascading operations where carries or borrows propagate across multiple columns (e.g., 999 + 1 = 1000).

## Simulation-Based Pattern Tagging

At problem-generation time, we simulate the abacus to determine which patterns each term will exercise. This is more precise than tagging at the problem-type level (e.g., "all +4 problems use skill X")—we tag at the problem-instance level based on the actual column states encountered.

```
Problem: 7 + 4 + 2 = 13

Step 1: Start with 0, add 7
  Column state: ones=0 → ones=7
  Analysis: Adding 6-9 requires moving both heaven bead and earth beads together
  Patterns: [basic.simpleCombinations]

Step 2: From 7, add 4
  Column state: ones=7 → overflow!
  Analysis: 7 + 4 = 11, exceeds column capacity (max 9)
  Rule: Ten-complement (+10, -6)
  Patterns: [tenComplements.4=10-6]

Step 3: From 11 (ones=1, tens=1), add 2
  Column state: ones=1 → ones=3
  Analysis: Only 1 earth bead is up; room to push 2 more
  Patterns: [basic.directAddition]

Total patterns exercised: [basic.simpleCombinations, basic.directAddition, tenComplements.4=10-6]
```

This simulation happens at problem-generation time. The generated problem carries its pattern tags explicitly—static once generated, but computed precisely for this specific problem instance:

```typescript
interface GeneratedProblem {
  terms: number[]             // [7, 4, 2]
  answer: number              // 13
  patternsExercised: string[] // ['basic.simpleCombinations', 'basic.directAddition', 'tenComplements.4=10-6']
}
```

## The Inference Challenge

Now consider what happens when the student solves this problem:

**Observation**: Student answered **incorrectly**.

**Patterns involved**: `basic.simpleCombinations`, `basic.directAddition`, `tenComplements.4=10-6`

**The question**: Which pattern failed?

We have three possibilities:
1. The student made an error on the simple combination (adding 7)
2. The student made an error on the direct addition (adding 2)
3. The student made an error on the ten-complement operation (adding 4 via carry)

But we can't know for certain. All we observe is the binary outcome.

### Asymmetric Evidence

Here's a crucial insight:

**If the student answers correctly**, we have strong evidence that **all** patterns were executed successfully. You can't get the right answer if any pattern fails.

**If the student answers incorrectly**, we only know that **at least one** pattern failed. We don't know which one(s).

This asymmetry is fundamental to our inference approach.

## Conjunctive Bayesian Knowledge Tracing

Standard BKT (Bayesian Knowledge Tracing) models a single skill as a hidden Markov model:
- Hidden state: Does the student know the skill? (binary)
- Observation: Did the student answer correctly? (binary)
- Parameters: P(L₀) initial knowledge, P(T) learning rate, P(S) slip rate, P(G) guess rate

The update equations use Bayes' theorem:

```
P(known | correct) = P(correct | known) × P(known) / P(correct)
                   = (1 - P(slip)) × P(known) / P(correct)

P(known | incorrect) = P(incorrect | known) × P(known) / P(incorrect)
                     = P(slip) × P(known) / P(incorrect)
```

### Extension to Multi-Pattern Problems

For problems involving multiple patterns, we extend BKT with a **conjunctive model**:

**On a correct answer**: All patterns receive positive evidence. We update each pattern independently using the standard BKT correct-answer update.

**On an incorrect answer**: We distribute "blame" probabilistically. Patterns that the student is less likely to have automated receive more of the blame.

The blame distribution formula:

```
blame(pattern) ∝ (1 - P(known_pattern))
```

A pattern with P(known) = 0.3 gets more blame than a pattern with P(known) = 0.9. This is intuitive: if a student has demonstrated automaticity of a pattern many times, an error is less likely to be caused by that pattern.

### The Blame-Weighted Update

For each pattern in an incorrect multi-pattern problem:

```typescript
// Calculate blame weights
const totalUnknown = patterns.reduce((sum, p) => sum + (1 - p.pKnown), 0)
const blameWeight = (1 - pattern.pKnown) / totalUnknown

// Calculate what the full negative update would be
const fullNegativeUpdate = bktUpdate(pattern.pKnown, false, params)

// Apply a weighted blend: more blame → more negative update
const newPKnown = pattern.pKnown * (1 - blameWeight) + fullNegativeUpdate * blameWeight
```

This creates a soft attribution: patterns that likely caused the error receive stronger negative evidence, while patterns that are probably automated receive only weak negative evidence.

### Edge Case: All Patterns Automated

What if all patterns have high P(known)? Then the error is probably a **slip** (random error despite knowledge), and we distribute blame evenly:

```typescript
if (totalUnknown < 0.001) {
  // All patterns appear automated — must be a slip
  const evenWeight = 1 / patterns.length
  // Apply full negative update with even distribution
}
```

## Evidence Quality Modifiers

Not all observations are equally informative. We weight the evidence based on:

### Help Level
If the student used hints or scaffolding, a correct answer provides weaker evidence of automaticity:

| Help Level | Weight | Interpretation |
|------------|--------|----------------|
| 0 (none) | 1.0 | Full evidence |
| 1 (minor hint) | 0.8 | Slight reduction |
| 2 (significant help) | 0.5 | Halved evidence |
| 3 (full solution shown) | 0.5 | Halved evidence |

### Response Time
Fast correct answers suggest automaticity. Slow correct answers might indicate the pattern isn't yet automatic:

| Condition | Weight | Interpretation |
|-----------|--------|----------------|
| Very fast correct | 1.2 | Strong automaticity signal |
| Normal correct | 1.0 | Standard evidence |
| Slow correct | 0.8 | Might have struggled |
| Very fast incorrect | 0.5 | Careless slip |
| Slow incorrect | 1.2 | Genuine confusion |

The combined evidence weight modulates how much we update P(known):

```typescript
const evidenceWeight = helpLevelWeight(helpLevel) * responseTimeWeight(responseTimeMs, isCorrect)
const newPKnown = oldPKnown * (1 - evidenceWeight) + bktUpdate * evidenceWeight
```

## Automaticity-Aware Problem Generation

Problem generation involves two concerns:

1. **Skill targeting** (BKT-based): Identifies which skills need practice and prioritizes them
2. **Cost calculation**: Controls problem difficulty by budgeting cognitive load

Both concerns now use BKT. We experimented with separating them—using BKT only for targeting while using fluency (recent streak consistency) for cost calculation—but found that using BKT for both produces equivalent results while simplifying the architecture.

### Complexity Budgeting

We budget problem complexity based on the student's estimated mastery from BKT. When BKT confidence is low (< 30%), we fall back to fluency-based estimates.

### Complexity Costing

Each pattern has a **base complexity cost**:
- Basic patterns: 0 (trivial)
- Five-complement patterns: 1 (one mental decomposition)
- Ten-complement patterns: 2 (cross-column operation)
- Mixed/cascading: 3 (multi-column propagation)

### Automaticity Multipliers

The cost is scaled by the student's estimated mastery from BKT. The multiplier uses a non-linear (squared) mapping from P(known) to provide better differentiation at high mastery levels:

| P(known) | Multiplier | Meaning |
|----------|------------|---------|
| 1.00 | 1.0× | Fully automated |
| 0.95 | 1.3× | Nearly automated |
| 0.90 | 1.6× | Solid |
| 0.80 | 2.1× | Good but not automatic |
| 0.50 | 3.3× | Halfway there |
| 0.00 | 4.0× | Just starting |

When BKT confidence is insufficient (< 30%), we fall back to discrete fluency states based on recent streaks.

### Adaptive Session Planning

A practice session has a **complexity budget**. The problem generator:

1. Selects terms that exercise the target patterns for the current curriculum phase
2. Simulates the problem to extract actual patterns exercised
3. Calculates total complexity: Σ(base_cost × automaticity_multiplier) for each pattern
4. Accepts the problem only if it fits the session's complexity budget

This creates natural adaptation:
- A student who has automated ten-complements gets harder problems (their multiplier is low)
- A student still learning ten-complements gets simpler problems (their multiplier is high)

```typescript
// Same problem, different complexity for different students:
const problem = [7, 6]  // 7 + 6 = 13, requires tenComplements.6

// Student A: BKT P(known) = 0.95 for ten-complements
complexity_A = 2 × 1.3 = 2.6  // Easy for this student

// Student B: BKT P(known) = 0.50 for ten-complements
complexity_B = 2 × 3.3 = 6.6  // Challenging for this student
```

## Adaptive Skill Targeting

Beyond controlling difficulty, BKT identifies *which skills need practice*.

### Identifying Weak Skills

When planning a practice session, we analyze BKT results to find skills that are:
- **Confident**: The model has enough data (confidence ≥ 30%)
- **Weak**: The estimated P(known) is below threshold (< 50%)

```typescript
function identifyWeakSkills(bktResults: Map<string, BktResult>): string[] {
  const weakSkills: string[] = []
  for (const [skillId, result] of bktResults) {
    if (result.confidence >= 0.3 && result.pKnown < 0.5) {
      weakSkills.push(skillId)
    }
  }
  return weakSkills
}
```

The confidence threshold prevents acting on insufficient data. A skill practiced only twice might show low P(known), but we don't have enough evidence to trust that estimate.

### Targeting Weak Skills in Problem Generation

Identified weak skills are added to the problem generator's `targetSkills` constraint. This biases problem generation toward exercises that include the weak pattern—not by making problems easier, but by ensuring the student gets practice on what they need.

```typescript
// In session planning:
const weakSkills = identifyWeakSkills(bktResults)

// Add weak skills to focus slot targets
for (const slot of focusSlots) {
  slot.targetSkills = [...slot.targetSkills, ...weakSkills]
}
```

### The Budget Trap (and How We Avoided It)

When we first tried using BKT P(known) as a cost multiplier, we hit a problem: skills with low P(known) got high multipliers, making them expensive. If we only used cost filtering, the budget would exclude weak skills—students would never practice what they needed most.

The solution was **skill targeting**: BKT identifies weak skills and adds them to the problem generator's required targets. This ensures weak skills appear in problems *regardless* of their cost. The complexity budget still applies, but it filters problem *structure* (number of terms, digit ranges), not which skills can appear.

A student struggling with ten-complements gets problems that *include* ten-complements (targeting), while the problem complexity stays within their budget (fewer terms, simpler starting values).

## Honest Uncertainty Reporting

Most educational software reports metrics like "85% accuracy" without acknowledging uncertainty. We take a different approach.

### Confidence Calculation

Confidence increases with more data and more consistent observations:

```typescript
function calculateConfidence(opportunities: number, successRate: number): number {
  // More data → more confidence (asymptotic to 1)
  const dataConfidence = 1 - Math.exp(-opportunities / 20)

  // Extreme success rates → more confidence
  const extremity = Math.abs(successRate - 0.5) * 2
  const consistencyBonus = extremity * 0.2

  return Math.min(1, dataConfidence + consistencyBonus)
}
```

With 10 opportunities, we're ~40% confident. With 50 opportunities, we're ~92% confident.

### Uncertainty Ranges

We display P(known) with an uncertainty range that widens as confidence decreases:

```
Pattern: tenComplements.4=10-6
Estimated automaticity: ~73%
Confidence: moderate
Range: 58% - 88%
```

This honest framing prevents over-claiming. A "73% automaticity" with low confidence is very different from "73% automaticity" with high confidence.

### Staleness Indicators

We track when each pattern was last practiced and display warnings:

| Days Since Practice | Warning |
|---------------------|---------|
| < 7 | (none) |
| 7-14 | "Not practiced recently" |
| 14-30 | "Getting rusty" |
| > 30 | "Very stale — may need review" |

Importantly, we show staleness as a **separate indicator**, not by decaying P(known). The student might still have the pattern automated; we just haven't observed it recently.

## Architecture: Lazy Computation

A key architectural decision: we don't store BKT state persistently. Instead, we:

1. Store raw problem results (correct/incorrect, timestamp, response time, help level)
2. Compute BKT on-demand when viewing the skills dashboard
3. Replay history chronologically to build up current P(known) estimates

This has several advantages:
- No database migrations when we tune BKT parameters
- Can experiment with different algorithms without data loss
- User controls (confidence threshold slider) work instantly
- Estimated computation time: ~50ms for a full dashboard with 100+ problems

## Automaticity Classification

We classify patterns into three categories based on P(known) and confidence:

| Classification | Criteria |
|----------------|----------|
| **Automated** | P(known) ≥ 80% AND confidence ≥ threshold |
| **Struggling** | P(known) < 50% AND confidence ≥ threshold |
| **Learning** | Everything else (including low-confidence estimates) |

The confidence threshold is user-adjustable (default 50%), allowing teachers to be more or less strict about what counts as "confident enough to classify."

## Validation: Does Adaptive Targeting Actually Work?

We built a journey simulator to compare three modes across controlled scenarios:
- **Classic**: Uniform skill distribution, fluency-based difficulty
- **Adaptive (fluency)**: BKT skill targeting, fluency-based difficulty
- **Adaptive (full BKT)**: BKT skill targeting, BKT-based difficulty

### Simulation Framework

The simulator models student learning using:

- **Hill function learning model**: `P(correct) = exposure^n / (K^n + exposure^n)`, where exposure is the number of times the student has practiced a skill
- **Conjunctive model**: Multi-skill problems require all skills to succeed—P(correct) is the product of individual skill probabilities
- **Per-skill deficiency profiles**: Each test case starts one skill at zero exposure, with all prerequisites mastered
- **Cognitive fatigue tracking**: Sum of difficulty multipliers for each skill in each problem—measures the mental effort required per session

The Hill function creates realistic learning curves: early practice yields slow improvement (building foundation), then understanding "clicks" (rapid gains), then asymptotic approach to mastery.

### The Measurement Challenge

Our first validation attempt measured overall problem accuracy—but this penalized adaptive mode for doing its job. When adaptive generates problems targeting weak skills, those problems have lower P(correct) by design.

The solution: **per-skill assessment without learning**. After practice sessions, we assess each student's mastery of the originally-deficient skill using trials that don't increment exposure. This measures true mastery independent of problem selection effects.

```typescript
// Assessment that doesn't pollute learning state
assessSkill(skillId: string, trials: number = 20): SkillAssessment {
  const trueProbability = this.getTrueProbability(skillId)
  // Run trials WITHOUT incrementing exposure
  let correct = 0
  for (let i = 0; i < trials; i++) {
    if (this.rng.chance(trueProbability)) correct++
  }
  return { skillId, trueProbability, assessedAccuracy: correct / trials }
}
```

### Convergence Speed Results

The key question: How fast does each mode bring a weak skill to mastery?

| Learner  | Deficient Skill                | Adaptive→50% | Classic→50% | Adaptive→80% | Classic→80% |
|----------|--------------------------------|--------------|-------------|--------------|-------------|
| fast     | fiveComplements.3=5-2          | 3 sessions   | 5 sessions  | 6 sessions   | 9 sessions  |
| fast     | fiveComplementsSub.-3=-5+2     | 3 sessions   | 4 sessions  | 6 sessions   | 8 sessions  |
| fast     | tenComplements.9=10-1          | 3 sessions   | 3 sessions  | 5 sessions   | 6 sessions  |
| fast     | tenComplements.5=10-5          | 4 sessions   | 6 sessions  | 10 sessions  | never       |
| fast     | tenComplementsSub.-9=+1-10     | 3 sessions   | 5 sessions  | 7 sessions   | 12 sessions |
| fast     | tenComplementsSub.-5=+5-10     | 5 sessions   | never       | 11 sessions  | never       |
| average  | fiveComplements.3=5-2          | 4 sessions   | 7 sessions  | 8 sessions   | 10 sessions |
| average  | fiveComplementsSub.-3=-5+2     | 4 sessions   | 6 sessions  | 8 sessions   | 11 sessions |
| average  | tenComplements.9=10-1          | 3 sessions   | 5 sessions  | 6 sessions   | 8 sessions  |

**Totals across all test scenarios:**
- **Faster to 50% mastery**: Adaptive wins 8, Classic wins 0
- **Faster to 80% mastery**: Adaptive wins 9, Classic wins 0

"Never" entries indicate the mode didn't reach that threshold within 12 sessions.

### 3-Way Comparison: BKT vs Fluency Multipliers

We also compared whether using BKT for cost calculation (in addition to targeting) provides additional benefit over fluency-based cost calculation:

| Skill | Mode | →50% | →80% | Fatigue/Session |
|-------|------|------|------|-----------------|
| fiveComplements.3=5-2 | Classic | 5 | 9 | 120.3 |
| fiveComplements.3=5-2 | Adaptive (fluency) | 3 | 6 | 122.8 |
| fiveComplements.3=5-2 | Adaptive (full BKT) | 3 | 6 | 122.8 |
| fiveComplementsSub.-3 | Classic | 4 | 8 | 131.9 |
| fiveComplementsSub.-3 | Adaptive (fluency) | 3 | 6 | 133.6 |
| fiveComplementsSub.-3 | Adaptive (full BKT) | 3 | 6 | 133.0 |

**Finding**: Both adaptive modes perform identically for learning rate—the benefit comes from BKT *targeting*, not from BKT-based cost calculation. However, using BKT for costs simplifies the architecture (one model instead of two) with no measurable downside.

### Example Trajectory

For a fast learner deficient in `fiveComplements.3=5-2`:

| Session | Adaptive Mastery | Classic Mastery |
|---------|------------------|-----------------|
| 0       | 0%               | 0%              |
| 2       | 34%              | 9%              |
| 3       | 64%              | 21%             |
| 4       | 72%              | 39%             |
| 5       | 77%              | 54%             |
| 6       | 83%              | 61%             |
| 9       | 91%              | 83%             |
| 12      | 94%              | 91%             |

Adaptive reaches 50% mastery by session 3; classic doesn't reach 50% until session 5. Adaptive reaches 80% by session 6; classic takes until session 9.

### Why Adaptive Wins

The mechanism is straightforward:
1. BKT identifies skills with low P(known) and sufficient confidence
2. These skills are added to `targetSkills` in problem generation
3. The student gets more exposure to weak skills
4. More exposure → faster mastery (via Hill function)

In our simulations, adaptive mode provided ~5% more exposure to deficient skills on average. This modest increase compounds across sessions into significant mastery differences.

### Remaining Research Questions

1. **Real-world validation**: Do simulated results hold with actual students?
2. **Optimal thresholds**: Are P(known) < 0.5 and confidence ≥ 0.3 the right cutoffs?
3. **Targeting aggressiveness**: Should we weight weak skills more heavily in generation?
4. **Cross-student priors**: Can aggregate data improve initial estimates for new students?

If you're interested in the educational data mining aspects of this work, [reach out](mailto:contact@abaci.one).

## Summary

Building an intelligent tutoring system for soroban arithmetic required solving a fundamental inference problem: how do you know which pattern failed when you only observe binary problem outcomes?

Our approach combines:
1. **Simulation-based pattern tagging** at problem-generation time
2. **Conjunctive BKT** with probabilistic blame distribution
3. **Evidence quality weighting** based on help level and response time
4. **Unified BKT architecture**: BKT drives both difficulty adjustment and skill targeting
5. **Honest uncertainty reporting** with confidence intervals
6. **Validated adaptive targeting** that reaches mastery 25-33% faster than uniform practice

The key insight from our validation: the benefit of adaptive practice comes from *targeting weak skills*, not from the specific formula used for difficulty adjustment. BKT targeting ensures students practice what they need; the complexity budget ensures they're not overwhelmed.

The result is a system that adapts to each student's actual pattern automaticity, not just their overall accuracy—focusing practice where it matters most while honestly communicating what it knows and doesn't know.

---

*This post describes the pattern tracing system built into [abaci.one](https://abaci.one), a free soroban practice application. The full source code is available on [GitHub](https://github.com/...).*

## References

- Corbett, A. T., & Anderson, J. R. (1994). Knowledge tracing: Modeling the acquisition of procedural knowledge. *User Modeling and User-Adapted Interaction*, 4(4), 253-278.

- Pardos, Z. A., & Heffernan, N. T. (2011). KT-IDEM: Introducing item difficulty to the knowledge tracing model. In *International Conference on User Modeling, Adaptation, and Personalization* (pp. 243-254). Springer.

- Baker, R. S., Corbett, A. T., & Aleven, V. (2008). More accurate student modeling through contextual estimation of slip and guess probabilities in Bayesian knowledge tracing. In *International Conference on Intelligent Tutoring Systems* (pp. 406-415). Springer.
