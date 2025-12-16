# Consultation with Kehkashan Khan - Student Learning Model

## Context

We are improving the SimulatedStudent model used in journey simulation tests to validate BKT-based adaptive problem generation. The current model uses a Hill function for learning but lacks several realistic phenomena.

## Current Model Limitations

| Phenomenon | Reality | Current Model |
|------------|---------|---------------|
| **Forgetting** | Skills decay without practice | Skills never decay |
| **Transfer** | Learning one complement helps learn others | Skills are independent |
| **Skill difficulty** | Some skills are inherently harder | All skills have same K |
| **Within-session fatigue** | Later problems are harder | All problems equal |
| **Warm-up effect** | First few problems are shakier | No warm-up |

## Email Sent to Kehkashan

**Date:** 2025-12-15
**From:** Thomas Hallock <hallock@gmail.com>
**To:** Kehkashan Khan
**Subject:** (not captured)

---

Hi Ms. Hkan,

I hope you and your mother are doing well in Oman. Please don't feel the need to reply to this immediately—whenever you have a spare moment is fine.

I've been updating some abacus practice software and I've been testing on Sonia and Fern, but I only have a sample size of 2, so I have had to make some assumptions that I'd like to improve upon. Specifically I've been trying to make it "smarter" about which problems to generate for them. The goal is for the app to automatically detect when they are struggling with a specific movement (like a 5-complement) and give them just enough practice to fix it without getting boring.

I have a computer simulation running to test this, and have seen some very positive results in learning compared to the method from my books, but I realized my assumptions about how children actually learn might be a bit too simple. Since you have observes this process with many different children, I'd love your take on a few things:

Are some skills inherently harder? In your experience, are certain movements just naturally harder for kids to grasp than others? For example, is a "10-complement" (like +9 = -1 +10) usually harder to master than a "5-complement" (like +4 = +5 -1)? Or are they about the same difficulty once the concept clicks?

Do skills transfer? Once a student truly understands the movement for +4, does that make learning +3 easier? Or do they tend to treat every new number as a completely new skill that needs to be practiced from scratch?

How fast does "rust" set in? If a student masters a specific skill but doesn't use it for two weeks, do they usually retain it? Or do they tend to forget it and need to re-learn it?

Fatigue vs. Warm-up Do you notice that accuracy drops significantly after 15-20 minutes? Or is there the opposite effect, where they need a "warm-up" period at the start of a lesson before they hit their stride?

Any "gut feeling" or observations you have would be incredibly helpful. I can use that info to make the math behind the app much more realistic.

Hope you are managing everything over there. See you Sunday!

p.s If you're curious, I have written up a draft about the system on my blog here:
https://abaci.one/blog/conjunctive-bkt-skill-tracing

Best,
Thomas

---

## Questions Asked & How to Use Answers

### 1. Skill Difficulty
**Question:** Are 10-complements harder than 5-complements?
**How to model:** Add per-skill K values (half-max exposure) in SimulatedStudent
```typescript
const SKILL_DIFFICULTY: Record<string, number> = {
  'basic.directAddition': 5,
  'fiveComplements.*': 10,      // If she says 5-comp is medium
  'tenComplements.*': 18,       // If she says 10-comp is harder
}
```

### 2. Transfer Effects
**Question:** Does learning +4 help with +3?
**How to model:** Add transfer weights between related skills
```typescript
// If she says yes, skills transfer within categories:
function getEffectiveExposure(skillId: string): number {
  const direct = exposures.get(skillId) ?? 0
  const transferred = getRelatedSkills(skillId)
    .reduce((sum, related) => sum + (exposures.get(related) ?? 0) * TRANSFER_WEIGHT, 0)
  return direct + transferred
}
```

### 3. Forgetting/Rust
**Question:** How fast do skills decay without practice?
**How to model:** Multiply probability by retention factor
```typescript
// If she says 2 weeks causes noticeable rust:
const HALF_LIFE_DAYS = 14  // Tune based on her answer
retention = Math.exp(-daysSinceLastPractice / HALF_LIFE_DAYS)
P_effective = P_base * retention
```

### 4. Fatigue & Warm-up
**Question:** Does accuracy drop after 15-20 min? Is there warm-up?
**How to model:** Add session position effects
```typescript
// If she says both exist:
function sessionPositionMultiplier(problemIndex: number, totalProblems: number): number {
  const warmupBoost = Math.min(1, problemIndex / 3)  // First 3 problems are warm-up
  const fatiguePenalty = problemIndex / totalProblems * 0.1  // 10% drop by end
  return warmupBoost * (1 - fatiguePenalty)
}
```

## Background on Kehkashan

- Abacus coach for Sonia and Fern (Thomas's kids)
- Teaches 1 hour each Sunday
- Getting PhD in something related to academic rigor in children
- Expert in soroban pedagogy
- Currently in Oman caring for her mother
- Not deeply technical/statistical, so answers will be qualitative observations

## When Reply Arrives

1. Extract her observations for each question
2. Translate qualitative answers to model parameters
3. Implement changes to SimulatedStudent.ts
4. Re-run 3-way comparison to see if results change
5. Update blog post if findings are significant
