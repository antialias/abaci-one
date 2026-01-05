import { describe, expect, it } from "vitest";
import { analyzeStepSkills, analyzeRequiredSkills } from "../problemGenerator";

/**
 * These tests verify skill detection using the unified step generator approach.
 * The unified approach simulates actual abacus bead state to accurately determine
 * which techniques are required for each operation.
 *
 * Ported from the legacy columnAnalysis.test.ts which tested the old column-based
 * analysis functions.
 */

describe("analyzeStepSkills - addition skill detection", () => {
  describe("five complement detection", () => {
    it("detects five complement when heaven bead NOT active and result crosses 5", () => {
      // 3 + 4 = 7: heaven bead not active (3 < 5), result needs heaven bead
      // Correct technique: +5, -1 (five complement)
      const skills = analyzeStepSkills(3, 4, 7);
      expect(skills).toContain("fiveComplements.4=5-1");
    });

    it("detects five complement when adding 3 to 4", () => {
      // 4 + 3 = 7: heaven bead not active (4 < 5), result needs heaven bead
      // Correct technique: +5, -2 (five complement)
      const skills = analyzeStepSkills(4, 3, 7);
      expect(skills).toContain("fiveComplements.3=5-2");
    });

    it("does NOT detect five complement when heaven bead already active", () => {
      // 7 + 2 = 9: heaven bead already active (7 >= 5)
      // Just add 2 earth beads directly - no five complement needed
      const skills = analyzeStepSkills(7, 2, 9);
      expect(skills).not.toContain("fiveComplements.2=5-3");
    });

    it("does NOT detect five complement when 5 + 3 = 8", () => {
      // 5 + 3 = 8: heaven bead already active (5 >= 5)
      // Just add 3 earth beads - no five complement needed
      const skills = analyzeStepSkills(5, 3, 8);
      expect(skills).not.toContain("fiveComplements.3=5-2");
    });

    it("does NOT detect five complement when 6 + 3 = 9", () => {
      // 6 + 3 = 9: heaven bead already active (6 >= 5)
      // Just add 3 earth beads - no five complement needed
      const skills = analyzeStepSkills(6, 3, 9);
      expect(skills).not.toContain("fiveComplements.3=5-2");
    });

    it("does NOT detect five complement when 8 + 1 = 9", () => {
      // 8 + 1 = 9: heaven bead already active (8 >= 5)
      // Just add 1 earth bead - no five complement needed
      const skills = analyzeStepSkills(8, 1, 9);
      expect(skills).not.toContain("fiveComplements.1=5-4");
    });
  });

  describe("direct addition (1-4 earth beads)", () => {
    it("detects direct addition when adding 1-4 and staying under 5", () => {
      // 1 + 2 = 3: just add earth beads
      const skills = analyzeStepSkills(1, 2, 3);
      expect(skills).toContain("basic.directAddition");
    });

    it("detects direct addition when adding to 0", () => {
      // 0 + 4 = 4: just add earth beads
      const skills = analyzeStepSkills(0, 4, 4);
      expect(skills).toContain("basic.directAddition");
    });
  });

  describe("ten complement detection", () => {
    it("detects ten complement when result exceeds 9", () => {
      // 7 + 5 = 12: need ten complement (+10-5)
      const skills = analyzeStepSkills(7, 5, 12);
      expect(skills).toContain("tenComplements.5=10-5");
    });

    it("detects ten complement for 9 + 4 = 13", () => {
      // 9 + 4 = 13: need ten complement
      const skills = analyzeStepSkills(9, 4, 13);
      expect(skills).toContain("tenComplements.4=10-6");
    });
  });
});

describe("analyzeStepSkills - subtraction skill detection", () => {
  describe("five complement in subtraction", () => {
    it("detects five complement subtraction when not enough earth beads", () => {
      // 6 - 3 = 3: have 1 earth bead (6 % 5 = 1), need 3
      // Use five complement: -3 = -5 + 2
      const skills = analyzeStepSkills(6, -3, 3);
      expect(skills).toContain("fiveComplementsSub.-3=-5+2");
    });

    it("detects direct subtraction when enough earth beads available", () => {
      // 7 - 2 = 5: have 2 earth beads (7 % 5 = 2), can subtract 2 directly
      const skills = analyzeStepSkills(7, -2, 5);
      expect(skills).toContain("basic.directSubtraction");
    });
  });

  describe("ten complement in subtraction (borrowing)", () => {
    it("detects ten complement for subtraction requiring borrow", () => {
      // 12 - 5 = 7: ones column 2-5 needs borrow
      // Ten complement: -5 = +5-10
      const skills = analyzeStepSkills(12, -5, 7);
      expect(skills).toContain("tenComplementsSub.-5=+5-10");
    });

    it("detects ten complement for 10 - 1 = 9", () => {
      // 10 - 1 = 9: ones column 0-1 needs borrow
      const skills = analyzeStepSkills(10, -1, 9);
      expect(skills).toContain("tenComplementsSub.-1=+9-10");
    });
  });

  describe("heaven bead subtraction", () => {
    it("detects heaven bead subtraction when subtracting exactly 5", () => {
      // 7 - 5 = 2: just remove heaven bead
      const skills = analyzeStepSkills(7, -5, 2);
      expect(skills).toContain("basic.heavenBeadSubtraction");
    });
  });
});

describe("real-world problem: 52 + 37 = 89", () => {
  it("ones column (2 + 7 = 9) should use heaven bead pattern, NOT five complement", () => {
    // This tests the exact bug scenario from user reports
    // Running sum = 52, adding term = 37
    // When we analyze the full step 52 + 37 = 89, the ones column
    // currentDigit = 2, termDigit = 7, result = 9
    // Heaven bead NOT active initially (2 < 5)
    // But adding 7 is direct 5+2 pattern, not five complement
    const skills = analyzeRequiredSkills([52, 37], 89);

    // Should NOT incorrectly detect five complement for +3
    // (which was the bug - misinterpreting the 7 as needing five complement)
    expect(skills).not.toContain("fiveComplements.3=5-2");
  });

  it("tens column with heaven bead already active should NOT use five complement", () => {
    // When analyzing 50 + 30 = 80, tens column has:
    // currentDigit = 5, termDigit = 3, result = 8
    // Heaven bead already active at 5 - just add earth beads
    const skills = analyzeStepSkills(5, 3, 8);
    expect(skills).not.toContain("fiveComplements.3=5-2");
  });
});

describe("multi-digit operations", () => {
  it("detects skills across multiple place values", () => {
    // 45 + 37 = 82
    // Ones: 5+7=12, ten complement needed
    // Tens: 4+3+1(carry)=8
    const skills = analyzeRequiredSkills([45, 37], 82);
    expect(skills).toContain("tenComplements.7=10-3");
  });

  it("handles subtraction across multiple place values", () => {
    // 82 - 37 = 45
    const skills = analyzeStepSkills(82, -37, 45);
    // Should detect the borrow/ten complement technique
    expect(skills.some((s) => s.startsWith("tenComplementsSub"))).toBe(true);
  });
});
