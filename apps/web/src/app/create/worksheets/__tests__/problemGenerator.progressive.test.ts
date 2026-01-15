/**
 * Tests for progressive difficulty mode in problem generator
 * Verifies that problems are shuffled within difficulty windows
 * while maintaining overall easy→hard progression
 */

import { describe, expect, it } from "vitest";
import {
  generateProblems,
  countRegroupingOperations,
} from "../problemGenerator";

describe("Progressive Difficulty Mode", () => {
  it("should randomize problems within difficulty windows, not strict order", () => {
    // Generate with progressive difficulty enabled
    const problems = generateProblems(
      20, // total
      0.7, // pAnyStart
      0.5, // pAllStart
      true, // interpolate (progressive difficulty ON)
      42, // seed
      { min: 2, max: 2 }, // digitRange
    );

    // Extract top numbers (first operand)
    const topNumbers = problems.map((p) => p.a);

    // Problems should NOT be in strict ascending order
    // (which was the bug - they were all sorted: 10, 11, 12, 13...)
    let strictlyAscending = true;
    for (let i = 1; i < topNumbers.length; i++) {
      if (topNumbers[i] < topNumbers[i - 1]) {
        strictlyAscending = false;
        break;
      }
    }

    expect(strictlyAscending).toBe(false);
  });

  it("should maintain overall easy→hard progression", () => {
    const problems = generateProblems(30, 0.7, 0.5, true, 123, {
      min: 2,
      max: 2,
    });

    // Calculate difficulty (carry count) for each problem
    const difficulties = problems.map((p) =>
      countRegroupingOperations(p.a, p.b),
    );

    // Split into three sections: beginning, middle, end
    const sectionSize = Math.floor(problems.length / 3);
    const beginningDifficulties = difficulties.slice(0, sectionSize);
    const middleDifficulties = difficulties.slice(sectionSize, sectionSize * 2);
    const endDifficulties = difficulties.slice(sectionSize * 2);

    // Calculate average difficulty for each section
    const avgBeginning =
      beginningDifficulties.reduce((a, b) => a + b, 0) /
      beginningDifficulties.length;
    const avgMiddle =
      middleDifficulties.reduce((a, b) => a + b, 0) / middleDifficulties.length;
    const avgEnd =
      endDifficulties.reduce((a, b) => a + b, 0) / endDifficulties.length;

    // Beginning should be easier than middle, middle easier than end
    expect(avgBeginning).toBeLessThanOrEqual(avgMiddle);
    expect(avgMiddle).toBeLessThanOrEqual(avgEnd);
  });

  it("should have variety in adjacent problems", () => {
    const problems = generateProblems(20, 0.7, 0.5, true, 456, {
      min: 2,
      max: 2,
    });

    // Count how many times adjacent problems have different top numbers
    let differentCount = 0;
    for (let i = 1; i < problems.length; i++) {
      if (problems[i].a !== problems[i - 1].a) {
        differentCount++;
      }
    }

    // At least 50% of adjacent problems should have different top numbers
    // (strict ordering would have very low variety)
    const varietyRatio = differentCount / (problems.length - 1);
    expect(varietyRatio).toBeGreaterThan(0.5);
  });

  it("should produce different sequences with different seeds", () => {
    const problems1 = generateProblems(20, 0.7, 0.5, true, 100, {
      min: 2,
      max: 2,
    });

    const problems2 = generateProblems(20, 0.7, 0.5, true, 200, {
      min: 2,
      max: 2,
    });

    const sequence1 = problems1.map((p) => `${p.a}+${p.b}`).join(",");
    const sequence2 = problems2.map((p) => `${p.a}+${p.b}`).join(",");

    // Different seeds should produce different problem sequences
    expect(sequence1).not.toBe(sequence2);
  });

  it("should work with small digit ranges", () => {
    // Test with limited problem space (single-digit + single-digit)
    const problems = generateProblems(10, 0, 0, true, 789, { min: 1, max: 1 });

    expect(problems).toHaveLength(10);

    // All problems should be within digit range (1-digit = 0-9)
    for (const problem of problems) {
      expect(problem.a).toBeGreaterThanOrEqual(0);
      expect(problem.a).toBeLessThan(10);
      expect(problem.b).toBeGreaterThanOrEqual(0);
      expect(problem.b).toBeLessThan(10);
    }
  });

  it("should handle cases where more problems requested than available", () => {
    // Request more problems than possible unique combinations
    const problems = generateProblems(
      200, // More than possible unique 1-digit problems
      0,
      0,
      true,
      999,
      { min: 1, max: 1 },
    );

    expect(problems).toHaveLength(200);

    // Should still maintain progression even with cycles
    const difficulties = problems.map((p) =>
      countRegroupingOperations(p.a, p.b),
    );
    const first10Avg =
      difficulties.slice(0, 10).reduce((a, b) => a + b, 0) / 10;
    const last10Avg = difficulties.slice(-10).reduce((a, b) => a + b, 0) / 10;

    // Last 10 should still be harder than first 10 (or equal if very limited problem space)
    expect(last10Avg).toBeGreaterThanOrEqual(first10Avg);
  });

  it("should not have long runs of identical top numbers", () => {
    const problems = generateProblems(30, 0.7, 0.5, true, 333, {
      min: 2,
      max: 2,
    });

    // Count maximum run length of same top number
    let maxRunLength = 1;
    let currentRunLength = 1;

    for (let i = 1; i < problems.length; i++) {
      if (problems[i].a === problems[i - 1].a) {
        currentRunLength++;
        maxRunLength = Math.max(maxRunLength, currentRunLength);
      } else {
        currentRunLength = 1;
      }
    }

    // No more than 3 consecutive problems with same top number
    // (strict ordering would have very long runs)
    expect(maxRunLength).toBeLessThanOrEqual(3);
  });
});
