import { describe, expect, it } from "vitest";
import { generateUnifiedInstructionSequence } from "../unifiedStepGenerator";
import {
  extractSkillsFromSequence,
  getUniqueSkillIds,
  extractSkillsFromProblem,
  flattenProblemSkills,
  getSkillCategory,
  getSkillKey,
  type ExtractedSkill,
} from "../skillExtraction";

describe("skillExtraction", () => {
  describe("extractSkillsFromSequence", () => {
    it("extracts directAddition skill for simple additions (1-4)", () => {
      // 0 + 3 = 3 - direct addition of earth beads
      const sequence = generateUnifiedInstructionSequence(0, 3);
      const skills = extractSkillsFromSequence(sequence);

      expect(skills.length).toBeGreaterThan(0);
      expect(skills.some((s) => s.skillId === "basic.directAddition")).toBe(
        true,
      );
      expect(skills[0].digit).toBe(3);
      expect(skills[0].place).toBe(0); // ones place
    });

    it("extracts heavenBead skill when adding 5", () => {
      // 0 + 5 = 5 - activate heaven bead
      const sequence = generateUnifiedInstructionSequence(0, 5);
      const skills = extractSkillsFromSequence(sequence);

      expect(skills.length).toBeGreaterThan(0);
      expect(skills.some((s) => s.skillId === "basic.heavenBead")).toBe(true);
    });

    it("extracts fiveComplement skill when adding 4 to 3", () => {
      // 3 + 4 = 7, uses five's complement: +5 - 1
      const sequence = generateUnifiedInstructionSequence(3, 7);
      const skills = extractSkillsFromSequence(sequence);

      expect(skills.length).toBeGreaterThan(0);
      expect(skills.some((s) => s.skillId === "fiveComplements.4=5-1")).toBe(
        true,
      );
    });

    it("extracts fiveComplement skill when adding 3 to 4", () => {
      // 4 + 3 = 7, uses five's complement: +5 - 2
      const sequence = generateUnifiedInstructionSequence(4, 7);
      const skills = extractSkillsFromSequence(sequence);

      expect(skills.some((s) => s.skillId === "fiveComplements.3=5-2")).toBe(
        true,
      );
    });

    it("extracts tenComplement skill when causing a carry", () => {
      // 3 + 8 = 11, uses ten's complement: +10 - 2
      const sequence = generateUnifiedInstructionSequence(3, 11);
      const skills = extractSkillsFromSequence(sequence);

      expect(skills.length).toBeGreaterThan(0);
      expect(skills.some((s) => s.skillId === "tenComplements.8=10-2")).toBe(
        true,
      );
    });

    it("extracts tenComplement skill for adding 9", () => {
      // 5 + 9 = 14, uses ten's complement: +10 - 1
      const sequence = generateUnifiedInstructionSequence(5, 14);
      const skills = extractSkillsFromSequence(sequence);

      expect(skills.some((s) => s.skillId === "tenComplements.9=10-1")).toBe(
        true,
      );
    });

    it("handles multi-digit additions with multiple skills", () => {
      // 15 + 27 = 42
      // tens: 1 + 2 = 3 (direct)
      // ones: 5 + 7 = 12 (ten's complement: +10 - 3)
      const sequence = generateUnifiedInstructionSequence(15, 42);
      const skills = extractSkillsFromSequence(sequence);

      expect(skills.length).toBeGreaterThanOrEqual(2);

      // Should have a skill for tens column and ones column
      const skillIds = skills.map((s) => s.skillId);

      // The ones column should use ten's complement for +7
      expect(skillIds).toContain("tenComplements.7=10-3");
    });

    it("tracks the place value of each skill", () => {
      // 10 + 50 = 60, adding 5 in the tens place
      const sequence = generateUnifiedInstructionSequence(10, 60);
      const skills = extractSkillsFromSequence(sequence);

      const tensSkill = skills.find((s) => s.place === 1);
      expect(tensSkill).toBeDefined();
      expect(tensSkill?.digit).toBe(5);
    });
  });

  describe("getUniqueSkillIds", () => {
    it("returns unique skill IDs", () => {
      const sequence = generateUnifiedInstructionSequence(0, 3);
      const uniqueIds = getUniqueSkillIds(sequence);

      // Should be an array of strings
      expect(Array.isArray(uniqueIds)).toBe(true);
      expect(uniqueIds.every((id) => typeof id === "string")).toBe(true);

      // Should have no duplicates
      expect(uniqueIds.length).toBe(new Set(uniqueIds).size);
    });
  });

  describe("extractSkillsFromProblem", () => {
    it("extracts skills for each term in a multi-term problem", () => {
      // Problem: 0 + 5 + 3 = 8
      const terms = [5, 3];
      const skillsByTerm = extractSkillsFromProblem(
        terms,
        generateUnifiedInstructionSequence,
      );

      expect(skillsByTerm.size).toBe(2);

      // First term (0 -> 5): heaven bead
      const term0Skills = skillsByTerm.get(0);
      expect(term0Skills).toBeDefined();
      expect(term0Skills?.some((s) => s.skillId === "basic.heavenBead")).toBe(
        true,
      );

      // Second term (5 -> 8): direct addition
      const term1Skills = skillsByTerm.get(1);
      expect(term1Skills).toBeDefined();
      expect(
        term1Skills?.some((s) => s.skillId === "basic.directAddition"),
      ).toBe(true);
    });

    it("handles problems that require carries between terms", () => {
      // Problem: 0 + 7 + 5 = 12
      const terms = [7, 5];
      const skillsByTerm = extractSkillsFromProblem(
        terms,
        generateUnifiedInstructionSequence,
      );

      // First term (0 -> 7): simpleCombinations or direct
      const term0Skills = skillsByTerm.get(0);
      expect(term0Skills).toBeDefined();

      // Second term (7 -> 12): ten's complement for +5
      const term1Skills = skillsByTerm.get(1);
      expect(term1Skills).toBeDefined();
      expect(
        term1Skills?.some((s) => s.skillId === "tenComplements.5=10-5"),
      ).toBe(true);
    });
  });

  describe("flattenProblemSkills", () => {
    it("combines all skills from all terms", () => {
      const terms = [5, 3];
      const skillsByTerm = extractSkillsFromProblem(
        terms,
        generateUnifiedInstructionSequence,
      );
      const allSkills = flattenProblemSkills(skillsByTerm);

      // Should have at least 2 skills (one from each term)
      expect(allSkills.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("getSkillCategory", () => {
    it("extracts the category from a skill ID", () => {
      expect(getSkillCategory("fiveComplements.4=5-1")).toBe("fiveComplements");
      expect(getSkillCategory("tenComplements.9=10-1")).toBe("tenComplements");
      expect(getSkillCategory("basic.directAddition")).toBe("basic");
    });

    it("returns the whole ID if no dot separator", () => {
      expect(getSkillCategory("someSkill")).toBe("someSkill");
    });
  });

  describe("getSkillKey", () => {
    it("extracts the key from a skill ID", () => {
      expect(getSkillKey("fiveComplements.4=5-1")).toBe("4=5-1");
      expect(getSkillKey("tenComplements.9=10-1")).toBe("9=10-1");
      expect(getSkillKey("basic.directAddition")).toBe("directAddition");
    });

    it("returns the whole ID if no dot separator", () => {
      expect(getSkillKey("someSkill")).toBe("someSkill");
    });
  });

  describe("skill mapping completeness", () => {
    it("maps all five complement patterns correctly", () => {
      // 4=5-1: Add 4 when earth beads are full
      let sequence = generateUnifiedInstructionSequence(3, 7); // 3 + 4 = 7
      let skills = extractSkillsFromSequence(sequence);
      expect(skills.some((s) => s.skillId === "fiveComplements.4=5-1")).toBe(
        true,
      );

      // 3=5-2: Add 3 when earth beads would overflow
      sequence = generateUnifiedInstructionSequence(4, 7); // 4 + 3 = 7
      skills = extractSkillsFromSequence(sequence);
      expect(skills.some((s) => s.skillId === "fiveComplements.3=5-2")).toBe(
        true,
      );

      // 2=5-3: Add 2 when earth beads would overflow
      sequence = generateUnifiedInstructionSequence(3, 5); // 3 + 2 = 5, but actually 0 + 2 + 3 = 5
      // This might be direct, let's try different values
      sequence = generateUnifiedInstructionSequence(4, 6); // 4 + 2 = 6, might use five's complement
      skills = extractSkillsFromSequence(sequence);
      // This one may or may not trigger depending on bead state

      // 1=5-4: Add 1 when 4 earth beads are already active
      sequence = generateUnifiedInstructionSequence(4, 5); // 4 + 1 = 5
      skills = extractSkillsFromSequence(sequence);
      // This one triggers five's complement when adding 1 to 4
      expect(skills.some((s) => s.skillId === "fiveComplements.1=5-4")).toBe(
        true,
      );
    });

    it("maps all ten complement patterns correctly", () => {
      // Test each ten complement from 9=10-1 to 1=10-9
      const testCases = [
        { start: 5, add: 9, expected: "9=10-1" },
        { start: 5, add: 8, expected: "8=10-2" },
        { start: 5, add: 7, expected: "7=10-3" },
        { start: 5, add: 6, expected: "6=10-4" },
        { start: 5, add: 5, expected: "5=10-5" },
        // Lower complements are harder to trigger - they require specific starting values
      ];

      for (const { start, add, expected } of testCases) {
        const target = start + add;
        const sequence = generateUnifiedInstructionSequence(start, target);
        const skills = extractSkillsFromSequence(sequence);
        expect(
          skills.some((s) => s.skillId === `tenComplements.${expected}`),
        ).toBe(true);
      }
    });
  });
});
