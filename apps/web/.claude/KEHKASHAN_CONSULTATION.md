# Consultation with Kehkashan Khan - Student Learning Model

## Context

We are improving the SimulatedStudent model used in journey simulation tests to validate BKT-based adaptive problem generation. The current model uses a Hill function for learning but lacks several realistic phenomena.

## Current Model Limitations

| Phenomenon                 | Reality                                    | Current Model          |
| -------------------------- | ------------------------------------------ | ---------------------- |
| **Forgetting**             | Skills decay without practice              | Skills never decay     |
| **Transfer**               | Learning one complement helps learn others | Skills are independent |
| **Skill difficulty**       | Some skills are inherently harder          | All skills have same K |
| **Within-session fatigue** | Later problems are harder                  | All problems equal     |
| **Warm-up effect**         | First few problems are shakier             | No warm-up             |

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
  "basic.directAddition": 5,
  "fiveComplements.*": 10, // If she says 5-comp is medium
  "tenComplements.*": 18, // If she says 10-comp is harder
};
```

### 2. Transfer Effects

**Question:** Does learning +4 help with +3?
**How to model:** Add transfer weights between related skills

```typescript
// If she says yes, skills transfer within categories:
function getEffectiveExposure(skillId: string): number {
  const direct = exposures.get(skillId) ?? 0;
  const transferred = getRelatedSkills(skillId).reduce(
    (sum, related) => sum + (exposures.get(related) ?? 0) * TRANSFER_WEIGHT,
    0,
  );
  return direct + transferred;
}
```

### 3. Forgetting/Rust

**Question:** How fast do skills decay without practice?
**How to model:** Multiply probability by retention factor

```typescript
// If she says 2 weeks causes noticeable rust:
const HALF_LIFE_DAYS = 14; // Tune based on her answer
retention = Math.exp(-daysSinceLastPractice / HALF_LIFE_DAYS);
P_effective = P_base * retention;
```

### 4. Fatigue & Warm-up

**Question:** Does accuracy drop after 15-20 min? Is there warm-up?
**How to model:** Add session position effects

```typescript
// If she says both exist:
function sessionPositionMultiplier(
  problemIndex: number,
  totalProblems: number,
): number {
  const warmupBoost = Math.min(1, problemIndex / 3); // First 3 problems are warm-up
  const fatiguePenalty = (problemIndex / totalProblems) * 0.1; // 10% drop by end
  return warmupBoost * (1 - fatiguePenalty);
}
```

## Background on Kehkashan

- Abacus coach for Sonia and Fern (Thomas's kids)
- Teaches 1 hour each Sunday
- Getting PhD in something related to academic rigor in children
- Expert in soroban pedagogy
- Currently in Oman caring for her mother
- Not deeply technical/statistical, so answers will be qualitative observations

---

## Response Received (2025-12-16)

**From:** Kehkashan Khan

---

Hi, good to hear from you. We are taking it one day at a time with my mother. Thank you for asking.

I appreciate all your concerns about this program.

First the benefits, it is a developmentally appropriate and age appropriate program. Your books are a bit too complicated if you don't mind me saying that. Your initial push with Sonia and Fern has given them a firm footing. They are such beautiful kids I have no words to describe them.

My concerns,
One is the book I shared with you already. It's unnecessarily complicated.
Secondly the abacus itself, if you want them to learn all the skills then they need to use the one that has beads on both sides and should be able to manipulate them using both hands.

Their foundational skills are strong, maybe you are looking for perfection. I don't know.

I have seen so much improvement in Fern's mastery of concepts. Sonia was an expert even before I started coaching them. The complicated oral problems she does is amazing.

Now in general, this is a stressful class, you need to give them more breaks. They are great negotiators, come up with a strategy that will please them but still keep you in control.

The skills are transferable, not just within the program but also cross curricular. After a while they will want to continue working on this because it makes them smarter and they will know the difference. All the operations whether +/-, combinations of 10 or 5, need practice and patience. Meta cognition is visible all the time, their learning is almost visible.

Let me see the app , we can arrange a google meet just to check it out. No charges. Children get frustrated when pieces of the puzzle don't fit. I wonder if there are parts that are not quite fitting in their mental framework. I will be able to give you a better idea if I see the components.

I hope I was able to respond to your questions. I am on break from my university work and can spend some time on your project if required even if it is just for feedback. Also, please leave a google review for my program. It will be greatly appreciated.

Sincerely,
Khan

---

## Interpreted Responses (with Thomas's context)

| Her Statement                                                  | Context/Interpretation                                                                                    |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| "Your books are a bit too complicated"                         | SAI Speed Academy workbooks - Fern needs more repetition than they provide, which drove building the app  |
| "abacus... beads on both sides... both hands"                  | Thomas made custom 4-column abaci. Kids will need to transition to full-size after mastering add/subtract |
| "this is a stressful class, you need to give them more breaks" | Sunday lessons come after other activities (math, violin). Scheduling issue, not generalizable            |
| "skills are transferable... cross curricular"                  | Too general - she means abacus helps general math, not that +4 helps +3 within soroban                    |
| "All operations... need practice and patience"                 | Every skill needs drilling, none can be skipped. No dramatic difficulty differences implied               |
| "pieces of the puzzle don't fit"                               | Validates our goal - she recognizes value of isolating specific deficiencies. Has NOT seen app yet        |
| "Let me see the app"                                           | Most valuable next step - schedule Google Meet                                                            |

---

## Follow-up Email Sent (2025-12-16)

**From:** Thomas Hallock

---

Hi Ms. Khan,

Good to hear from you. I hope you and your mother continue to hold up well.

Thank you for the feedback on the books and the abacus size. I think you're right that Fern needs more repetition than the books provide, which is what drove me to build the software. I will also look into transitioning them to the full-sized, two-handed abacus now that they are less likely to get distracted by the extra columns.

I would definitely appreciate a Google Meet. I'd love to walk you through the logic the app uses to diagnose student errors. It attempts to automate the "struggle detection" you do naturally as a teacher, and I could use your feedback on whether it's calibrated correctly.

You can preview the basic interface at https://abaci.one/practice, but a live demo would be better to explain the background logic.

Please let me know what time works for you, and send over the link for your Google Review.

Best,
Thomas

---

## Implications for Student Model

### What we learned:

- **All skills need practice** - No evidence of dramatic difficulty differences between skill categories
- **Validation of the goal** - Isolating "puzzle pieces" that don't fit is valuable
- **Individual variance** - Sonia vs Fern confirms wide learner differences (matches our profiles)

### What we still don't know:

- Whether skills transfer within soroban (does +4 help +3?)
- How fast "rust" sets in
- Warm-up effects

### Recommendation:

Wait for Google Meet feedback before making model changes. She'll provide more specific input after seeing the app's "struggle detection" logic.

---

## Next Steps

1. ✅ Send follow-up email requesting Google Meet
2. ⏳ Leave Google review for her program (need link)
3. ⏳ Schedule and conduct Google Meet demo
4. ⏳ Update this document with her feedback on BKT calibration
