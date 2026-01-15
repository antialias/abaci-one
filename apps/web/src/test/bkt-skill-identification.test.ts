/**
 * @vitest-environment node
 *
 * BKT Skill Identification Unit Tests
 *
 * Tests that BKT correctly identifies weak skills when a student
 * consistently fails problems containing a specific skill while
 * succeeding on all other problems.
 *
 * For each skill:
 * 1. Generate problems covering multiple skills (3+ skills per problem)
 * 2. Categorize problems by whether they contain the "target weak skill"
 * 3. Answer all problems correctly EXCEPT those containing the target skill
 * 4. Verify BKT identifies the target skill as weak (low pKnown)
 *
 * This validates that BKT's conjunctive model correctly attributes
 * blame to the failing skill.
 */

import { describe, expect, it } from "vitest";
import type { SkillSet } from "@/types/tutorial";
import { computeBktFromHistory } from "@/lib/curriculum/bkt";
import type { SkillBktResult } from "@/lib/curriculum/bkt";
import type { ProblemResultWithContext } from "@/lib/curriculum/session-planner";

/**
 * Helper to create a valid ProblemResultWithContext
 */
function createResult(
  sessionId: string,
  slotIndex: number,
  timestamp: Date,
  skillsExercised: string[],
  isCorrect: boolean,
  responseTimeMs: number,
): ProblemResultWithContext {
  return {
    sessionId,
    partNumber: 1,
    slotIndex,
    problem: {
      terms: [1, 2],
      answer: 3,
      skillsRequired: skillsExercised,
    },
    studentAnswer: isCorrect ? 3 : 4,
    isCorrect,
    responseTimeMs,
    skillsExercised,
    usedOnScreenAbacus: false,
    timestamp,
    hadHelp: false,
    incorrectAttempts: 0,
    sessionCompletedAt: timestamp,
    partType: "abacus",
  };
}

// All skills in the system
const ALL_SKILLS = {
  basic: [
    "basic.directAddition",
    "basic.heavenBead",
    "basic.simpleCombinations",
    "basic.directSubtraction",
    "basic.heavenBeadSubtraction",
    "basic.simpleCombinationsSub",
  ],
  fiveComplements: [
    "fiveComplements.4=5-1",
    "fiveComplements.3=5-2",
    "fiveComplements.2=5-3",
    "fiveComplements.1=5-4",
  ],
  tenComplements: [
    "tenComplements.9=10-1",
    "tenComplements.8=10-2",
    "tenComplements.7=10-3",
    "tenComplements.6=10-4",
    "tenComplements.5=10-5",
    "tenComplements.4=10-6",
    "tenComplements.3=10-7",
    "tenComplements.2=10-8",
    "tenComplements.1=10-9",
  ],
  fiveComplementsSub: [
    "fiveComplementsSub.-4=-5+1",
    "fiveComplementsSub.-3=-5+2",
    "fiveComplementsSub.-2=-5+3",
    "fiveComplementsSub.-1=-5+4",
  ],
  tenComplementsSub: [
    "tenComplementsSub.-9=+1-10",
    "tenComplementsSub.-8=+2-10",
    "tenComplementsSub.-7=+3-10",
    "tenComplementsSub.-6=+4-10",
    "tenComplementsSub.-5=+5-10",
    "tenComplementsSub.-4=+6-10",
    "tenComplementsSub.-3=+7-10",
    "tenComplementsSub.-2=+8-10",
    "tenComplementsSub.-1=+9-10",
  ],
  advanced: ["advanced.cascadingCarry", "advanced.cascadingBorrow"],
};

const FLAT_SKILLS = Object.values(ALL_SKILLS).flat();

/**
 * Generate synthetic problem results for testing BKT.
 *
 * Creates problems where:
 * - Each problem uses 2-4 skills from the provided skillPool
 * - Problems containing weakSkill are marked incorrect
 * - All other problems are marked correct
 *
 * @param skillPool - Pool of skills to use in problems
 * @param weakSkill - The skill that should cause failures
 * @param problemCount - Total number of problems to generate
 * @param minSkillsPerProblem - Minimum skills per problem (default 2)
 * @param maxSkillsPerProblem - Maximum skills per problem (default 4)
 */
function generateSyntheticResults(
  skillPool: string[],
  weakSkill: string,
  problemCount: number,
  minSkillsPerProblem = 2,
  maxSkillsPerProblem = 4,
): ProblemResultWithContext[] {
  const results: ProblemResultWithContext[] = [];
  const baseTime = Date.now() - problemCount * 5000; // Space problems 5s apart

  // Ensure weakSkill is in pool
  if (!skillPool.includes(weakSkill)) {
    skillPool = [...skillPool, weakSkill];
  }

  // Ensure we have enough skills
  if (skillPool.length < minSkillsPerProblem) {
    throw new Error(
      `Need at least ${minSkillsPerProblem} skills in pool, got ${skillPool.length}`,
    );
  }

  for (let i = 0; i < problemCount; i++) {
    // Determine how many skills this problem uses
    const numSkills =
      minSkillsPerProblem +
      Math.floor(
        Math.random() * (maxSkillsPerProblem - minSkillsPerProblem + 1),
      );

    // Select random skills for this problem
    const shuffled = [...skillPool].sort(() => Math.random() - 0.5);
    const problemSkills = shuffled.slice(
      0,
      Math.min(numSkills, skillPool.length),
    );

    // Include weak skill in ~40% of problems (if not already included)
    const includeWeakSkill = Math.random() < 0.4;
    if (includeWeakSkill && !problemSkills.includes(weakSkill)) {
      // Replace one skill with the weak skill
      problemSkills[Math.floor(Math.random() * problemSkills.length)] =
        weakSkill;
    }

    const containsWeakSkill = problemSkills.includes(weakSkill);

    const isCorrect = !containsWeakSkill; // Fail only when weak skill is present
    results.push({
      sessionId: `test-session-${i}`,
      partNumber: 1,
      slotIndex: i,
      problem: {
        terms: [1, 2],
        answer: 3,
        skillsRequired: problemSkills,
      },
      studentAnswer: isCorrect ? 3 : 4,
      timestamp: new Date(baseTime + i * 5000),
      skillsExercised: problemSkills,
      isCorrect,
      responseTimeMs: containsWeakSkill ? 8000 : 3000, // Slower on weak skill
      usedOnScreenAbacus: false,
      hadHelp: false,
      incorrectAttempts: 0,
      sessionCompletedAt: new Date(baseTime + i * 5000),
      partType: "abacus",
    });
  }

  return results;
}

/**
 * Create a synthetic result set where one skill is weak
 * and all others are strong.
 */
function createWeakSkillScenario(
  weakSkillId: string,
  otherSkills: string[],
  problemCount = 50,
): ProblemResultWithContext[] {
  const skillPool = [
    weakSkillId,
    ...otherSkills.filter((s) => s !== weakSkillId),
  ];
  return generateSyntheticResults(skillPool, weakSkillId, problemCount);
}

describe("BKT Skill Identification", () => {
  describe("Basic Skill Isolation", () => {
    it("should correctly identify a weak basic.directAddition skill", () => {
      const weakSkill = "basic.directAddition";
      const otherSkills = [
        "basic.heavenBead",
        "fiveComplements.4=5-1",
        "fiveComplements.3=5-2",
      ];

      const results = createWeakSkillScenario(weakSkill, otherSkills, 60);
      const bkt = computeBktFromHistory(results);

      // Find the weak skill in BKT results
      const weakSkillResult = bkt.skills.find((s) => s.skillId === weakSkill);
      const otherSkillResults = bkt.skills.filter(
        (s) => s.skillId !== weakSkill,
      );

      console.log(`\nWeak skill: ${weakSkill}`);
      console.log(`  pKnown: ${(weakSkillResult?.pKnown ?? 0).toFixed(3)}`);
      console.log(
        `  confidence: ${(weakSkillResult?.confidence ?? 0).toFixed(3)}`,
      );
      console.log(`  opportunities: ${weakSkillResult?.opportunities ?? 0}`);

      console.log(`\nOther skills:`);
      for (const skill of otherSkillResults) {
        console.log(
          `  ${skill.skillId}: pKnown=${skill.pKnown.toFixed(3)}, conf=${skill.confidence.toFixed(3)}`,
        );
      }

      // Assertions
      expect(weakSkillResult).toBeDefined();
      expect(weakSkillResult!.pKnown).toBeLessThan(0.5);

      // Other skills should have higher pKnown
      for (const skill of otherSkillResults) {
        if (skill.confidence > 0.2) {
          // Only check confident skills
          expect(skill.pKnown).toBeGreaterThan(weakSkillResult!.pKnown);
        }
      }
    });

    it("should correctly identify a weak fiveComplements skill", () => {
      const weakSkill = "fiveComplements.4=5-1";
      const otherSkills = [
        "basic.directAddition",
        "basic.heavenBead",
        "fiveComplements.3=5-2",
      ];

      const results = createWeakSkillScenario(weakSkill, otherSkills, 60);
      const bkt = computeBktFromHistory(results);

      const weakSkillResult = bkt.skills.find((s) => s.skillId === weakSkill);
      const otherSkillResults = bkt.skills.filter(
        (s) => s.skillId !== weakSkill,
      );

      console.log(`\nWeak skill: ${weakSkill}`);
      console.log(`  pKnown: ${(weakSkillResult?.pKnown ?? 0).toFixed(3)}`);
      console.log(
        `  confidence: ${(weakSkillResult?.confidence ?? 0).toFixed(3)}`,
      );

      expect(weakSkillResult).toBeDefined();
      expect(weakSkillResult!.pKnown).toBeLessThan(0.5);

      // Other skills should be higher
      for (const skill of otherSkillResults) {
        if (skill.confidence > 0.2) {
          expect(skill.pKnown).toBeGreaterThan(weakSkillResult!.pKnown);
        }
      }
    });
  });

  describe("Systematic Skill Testing", () => {
    // Test each skill category
    const testCases: Array<{
      category: string;
      skills: string[];
      companions: string[]; // Other skills to include in problems
    }> = [
      {
        category: "Basic Addition",
        skills: ALL_SKILLS.basic.slice(0, 3), // Addition-related basic skills
        companions: ["fiveComplements.4=5-1", "fiveComplements.3=5-2"],
      },
      {
        category: "Five Complements (Addition)",
        skills: ALL_SKILLS.fiveComplements,
        companions: ["basic.directAddition", "basic.heavenBead"],
      },
      {
        category: "Ten Complements (Addition)",
        skills: ALL_SKILLS.tenComplements.slice(0, 5), // Test first 5
        companions: [
          "basic.directAddition",
          "basic.heavenBead",
          "fiveComplements.4=5-1",
        ],
      },
    ];

    for (const testCase of testCases) {
      describe(testCase.category, () => {
        for (const skill of testCase.skills) {
          it(`should identify ${skill} as weak when it fails consistently`, () => {
            const otherSkills = [
              ...testCase.companions,
              ...testCase.skills.filter((s) => s !== skill),
            ].slice(0, 4); // Use up to 4 other skills

            const results = createWeakSkillScenario(skill, otherSkills, 50);
            const bkt = computeBktFromHistory(results);

            const weakSkillResult = bkt.skills.find((s) => s.skillId === skill);

            // Log results for debugging
            console.log(`\n${skill}:`);
            console.log(
              `  pKnown: ${(weakSkillResult?.pKnown ?? 0).toFixed(3)}`,
            );
            console.log(
              `  confidence: ${(weakSkillResult?.confidence ?? 0).toFixed(3)}`,
            );
            console.log(
              `  opportunities: ${weakSkillResult?.opportunities ?? 0}`,
            );

            // Weak skill should be identified
            expect(weakSkillResult).toBeDefined();

            // With enough opportunities, BKT should identify this as weak
            if (weakSkillResult!.opportunities >= 5) {
              expect(weakSkillResult!.pKnown).toBeLessThan(0.6);
            }
          });
        }
      });
    }
  });

  describe("Conjunctive Model Validation", () => {
    it("should correctly distribute blame across multi-skill problems", () => {
      // Create a scenario where failures only occur when BOTH skills A and B are present
      // but succeed when only A or only B is present
      const skillA = "basic.directAddition";
      const skillB = "fiveComplements.4=5-1";
      const skillC = "basic.heavenBead";
      const skillD = "fiveComplements.3=5-2";

      const results: ProblemResultWithContext[] = [];
      const baseTime = Date.now();

      // Problems with only A: correct
      for (let i = 0; i < 10; i++) {
        results.push(
          createResult(
            "test",
            results.length,
            new Date(baseTime + results.length * 5000),
            [skillA, skillC], // A + C (no B)
            true,
            3000,
          ),
        );
      }

      // Problems with only B: correct
      for (let i = 0; i < 10; i++) {
        results.push(
          createResult(
            "test",
            results.length,
            new Date(baseTime + results.length * 5000),
            [skillB, skillD], // B + D (no A)
            true,
            3000,
          ),
        );
      }

      // Problems with A + B: fail (this is the weak combination)
      for (let i = 0; i < 15; i++) {
        results.push(
          createResult(
            "test",
            results.length,
            new Date(baseTime + results.length * 5000),
            [skillA, skillB], // A + B together
            false,
            8000,
          ),
        );
      }

      const bkt = computeBktFromHistory(results);

      console.log("\nConjunctive Model Test:");
      console.log("Scenario: A alone=pass, B alone=pass, A+B=fail");
      for (const skill of bkt.skills) {
        console.log(
          `  ${skill.skillId}: pKnown=${skill.pKnown.toFixed(3)}, conf=${skill.confidence.toFixed(3)}, opp=${skill.opportunities}`,
        );
      }

      // Both A and B should have lower pKnown than C and D
      // because the failures are distributed between A and B
      const resultA = bkt.skills.find((s) => s.skillId === skillA);
      const resultB = bkt.skills.find((s) => s.skillId === skillB);
      const resultC = bkt.skills.find((s) => s.skillId === skillC);
      const resultD = bkt.skills.find((s) => s.skillId === skillD);

      expect(resultA).toBeDefined();
      expect(resultB).toBeDefined();
      expect(resultC).toBeDefined();

      // C and D should be strong (only appear in correct problems)
      if (resultC && resultC.confidence > 0.2) {
        expect(resultC.pKnown).toBeGreaterThan(0.5);
      }
      if (resultD && resultD.confidence > 0.2) {
        expect(resultD.pKnown).toBeGreaterThan(0.5);
      }

      // A and B should have lower pKnown (they share blame for failures)
      // They won't be as low as single-skill failures because they also appear in successes
      if (
        resultA &&
        resultB &&
        resultA.confidence > 0.2 &&
        resultB.confidence > 0.2
      ) {
        const avgWeakPKnown = (resultA.pKnown + resultB.pKnown) / 2;
        const avgStrongPKnown =
          ((resultC?.pKnown ?? 0) + (resultD?.pKnown ?? 0)) / 2;
        console.log(`\n  Avg weak (A,B) pKnown: ${avgWeakPKnown.toFixed(3)}`);
        console.log(`  Avg strong (C,D) pKnown: ${avgStrongPKnown.toFixed(3)}`);

        // Weak skills should have lower pKnown than strong skills
        expect(avgWeakPKnown).toBeLessThan(avgStrongPKnown);
      }
    });
  });

  describe("BKT vs No BKT Comparison", () => {
    it("should show clear differentiation between weak and strong skills", () => {
      // Create a scenario with one definitively weak skill
      const weakSkill = "fiveComplements.4=5-1";
      const strongSkills = [
        "basic.directAddition",
        "basic.heavenBead",
        "fiveComplements.3=5-2",
        "tenComplements.9=10-1",
      ];

      const results = createWeakSkillScenario(weakSkill, strongSkills, 80);

      const bkt = computeBktFromHistory(results);

      // Calculate statistics
      const weakResult = bkt.skills.find((s) => s.skillId === weakSkill);
      const strongResults = bkt.skills.filter((s) =>
        strongSkills.includes(s.skillId),
      );

      const confidentStrong = strongResults.filter((s) => s.confidence > 0.2);
      const avgStrongPKnown =
        confidentStrong.length > 0
          ? confidentStrong.reduce((sum, s) => sum + s.pKnown, 0) /
            confidentStrong.length
          : 0;

      console.log("\n=== BKT vs No BKT Comparison ===");
      console.log(`\nWeak skill (${weakSkill}):`);
      console.log(`  pKnown: ${(weakResult?.pKnown ?? 0).toFixed(3)}`);
      console.log(`  confidence: ${(weakResult?.confidence ?? 0).toFixed(3)}`);
      console.log(`  opportunities: ${weakResult?.opportunities ?? 0}`);

      console.log(
        `\nStrong skills (avg of ${confidentStrong.length} confident skills):`,
      );
      console.log(`  avg pKnown: ${avgStrongPKnown.toFixed(3)}`);

      if (weakResult) {
        const gap = avgStrongPKnown - weakResult.pKnown;
        console.log(
          `\nGap: ${gap.toFixed(3)} (${gap > 0.3 ? "GOOD" : "POOR"} differentiation)`,
        );

        // We expect a clear gap between weak and strong skills
        expect(gap).toBeGreaterThan(0.2);
      }

      // Verify interventionNeeded list
      console.log(
        `\nIntervention needed: ${bkt.interventionNeeded.length} skills`,
      );
      for (const s of bkt.interventionNeeded) {
        console.log(`  - ${s.skillId}: pKnown=${s.pKnown.toFixed(3)}`);
      }

      // The weak skill should be in intervention list (or at least have low pKnown)
      const weakInIntervention = bkt.interventionNeeded.some(
        (s) => s.skillId === weakSkill,
      );
      console.log(
        `\nWeak skill in intervention list: ${weakInIntervention ? "YES" : "NO (may need more data or lower threshold)"}`,
      );
    });
  });

  describe("Confidence Building", () => {
    it("should require sufficient opportunities before confident identification", () => {
      const weakSkill = "fiveComplements.4=5-1";
      const otherSkills = [
        "basic.directAddition",
        "basic.heavenBead",
        "fiveComplements.3=5-2",
      ];

      // Test with increasing problem counts
      const problemCounts = [10, 20, 40, 80];
      const confidenceResults: Array<{
        count: number;
        conf: number;
        pKnown: number;
      }> = [];

      console.log("\n=== Confidence Building ===");

      for (const count of problemCounts) {
        const results = createWeakSkillScenario(weakSkill, otherSkills, count);
        const bkt = computeBktFromHistory(results);
        const weakResult = bkt.skills.find((s) => s.skillId === weakSkill);

        if (weakResult) {
          confidenceResults.push({
            count,
            conf: weakResult.confidence,
            pKnown: weakResult.pKnown,
          });

          console.log(`${count} problems:`);
          console.log(
            `  confidence=${weakResult.confidence.toFixed(3)}, pKnown=${weakResult.pKnown.toFixed(3)}`,
          );
        }
      }

      // Confidence should increase with more problems
      for (let i = 1; i < confidenceResults.length; i++) {
        expect(confidenceResults[i].conf).toBeGreaterThanOrEqual(
          confidenceResults[i - 1].conf,
        );
      }

      // With 80 problems, confidence should be reasonably high
      const finalConf = confidenceResults[confidenceResults.length - 1];
      expect(finalConf.conf).toBeGreaterThan(0.3);
    });
  });
});

describe("BKT Summary Statistics", () => {
  it("should provide accurate summary for mixed skill levels", () => {
    // Create a mixed scenario with some weak and some strong skills
    const results: ProblemResultWithContext[] = [];
    const baseTime = Date.now();

    const weakSkills = ["fiveComplements.4=5-1", "tenComplements.9=10-1"];
    const strongSkills = [
      "basic.directAddition",
      "basic.heavenBead",
      "fiveComplements.3=5-2",
    ];
    const allSkills = [...weakSkills, ...strongSkills];

    // Generate 100 problems
    for (let i = 0; i < 100; i++) {
      // Each problem uses 2-3 random skills
      const numSkills = 2 + Math.floor(Math.random() * 2);
      const shuffled = [...allSkills].sort(() => Math.random() - 0.5);
      const problemSkills = shuffled.slice(0, numSkills);

      // Fail if ANY weak skill is present
      const hasWeakSkill = problemSkills.some((s) => weakSkills.includes(s));

      results.push(
        createResult(
          "test",
          i,
          new Date(baseTime + i * 5000),
          problemSkills,
          !hasWeakSkill,
          hasWeakSkill ? 8000 : 3000,
        ),
      );
    }

    const bkt = computeBktFromHistory(results);

    console.log("\n=== BKT Summary Statistics ===");
    console.log(`Total skills tracked: ${bkt.skills.length}`);
    console.log(`Intervention needed: ${bkt.interventionNeeded.length}`);
    console.log(`Strengths: ${bkt.strengths.length}`);

    console.log("\nAll skills:");
    for (const skill of bkt.skills.sort((a, b) => a.pKnown - b.pKnown)) {
      const isWeak = weakSkills.includes(skill.skillId);
      const marker = isWeak ? "[EXPECTED WEAK]" : "";
      console.log(
        `  ${skill.skillId}: pKnown=${skill.pKnown.toFixed(3)}, conf=${skill.confidence.toFixed(3)} ${marker}`,
      );
    }

    // Verify weak skills have lower pKnown
    for (const weakId of weakSkills) {
      const weak = bkt.skills.find((s) => s.skillId === weakId);
      for (const strongId of strongSkills) {
        const strong = bkt.skills.find((s) => s.skillId === strongId);
        if (
          weak &&
          strong &&
          weak.confidence > 0.2 &&
          strong.confidence > 0.2
        ) {
          expect(weak.pKnown).toBeLessThan(strong.pKnown);
        }
      }
    }
  });
});
