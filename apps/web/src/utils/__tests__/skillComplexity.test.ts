import { describe, it, expect } from "vitest";
import {
  BASE_SKILL_COMPLEXITY,
  MASTERY_MULTIPLIERS,
  getBaseComplexity,
  createSkillCostCalculator,
  buildStudentSkillHistoryFromRecords,
  computeMasteryState,
  type StudentSkillHistory,
  type DbSkillRecord,
} from "../skillComplexity";

describe("BASE_SKILL_COMPLEXITY", () => {
  it("should have costs for all 34 skills", () => {
    expect(Object.keys(BASE_SKILL_COMPLEXITY).length).toBe(34);
  });

  it("should have base cost 0 for basic skills", () => {
    expect(BASE_SKILL_COMPLEXITY["basic.directAddition"]).toBe(0);
    expect(BASE_SKILL_COMPLEXITY["basic.directSubtraction"]).toBe(0);
    expect(BASE_SKILL_COMPLEXITY["basic.heavenBead"]).toBe(0);
    expect(BASE_SKILL_COMPLEXITY["basic.heavenBeadSubtraction"]).toBe(0);
    expect(BASE_SKILL_COMPLEXITY["basic.simpleCombinations"]).toBe(0);
    expect(BASE_SKILL_COMPLEXITY["basic.simpleCombinationsSub"]).toBe(0);
  });

  it("should have base cost 1 for five complement skills", () => {
    expect(BASE_SKILL_COMPLEXITY["fiveComplements.4=5-1"]).toBe(1);
    expect(BASE_SKILL_COMPLEXITY["fiveComplements.3=5-2"]).toBe(1);
    expect(BASE_SKILL_COMPLEXITY["fiveComplements.2=5-3"]).toBe(1);
    expect(BASE_SKILL_COMPLEXITY["fiveComplements.1=5-4"]).toBe(1);
    expect(BASE_SKILL_COMPLEXITY["fiveComplementsSub.-4=-5+1"]).toBe(1);
    expect(BASE_SKILL_COMPLEXITY["fiveComplementsSub.-3=-5+2"]).toBe(1);
    expect(BASE_SKILL_COMPLEXITY["fiveComplementsSub.-2=-5+3"]).toBe(1);
    expect(BASE_SKILL_COMPLEXITY["fiveComplementsSub.-1=-5+4"]).toBe(1);
  });

  it("should have base cost 2 for ten complement skills", () => {
    expect(BASE_SKILL_COMPLEXITY["tenComplements.9=10-1"]).toBe(2);
    expect(BASE_SKILL_COMPLEXITY["tenComplements.8=10-2"]).toBe(2);
    expect(BASE_SKILL_COMPLEXITY["tenComplements.7=10-3"]).toBe(2);
    expect(BASE_SKILL_COMPLEXITY["tenComplements.6=10-4"]).toBe(2);
    expect(BASE_SKILL_COMPLEXITY["tenComplements.5=10-5"]).toBe(2);
    expect(BASE_SKILL_COMPLEXITY["tenComplements.4=10-6"]).toBe(2);
    expect(BASE_SKILL_COMPLEXITY["tenComplements.3=10-7"]).toBe(2);
    expect(BASE_SKILL_COMPLEXITY["tenComplements.2=10-8"]).toBe(2);
    expect(BASE_SKILL_COMPLEXITY["tenComplements.1=10-9"]).toBe(2);
    expect(BASE_SKILL_COMPLEXITY["tenComplementsSub.-9=+1-10"]).toBe(2);
    expect(BASE_SKILL_COMPLEXITY["tenComplementsSub.-8=+2-10"]).toBe(2);
    expect(BASE_SKILL_COMPLEXITY["tenComplementsSub.-7=+3-10"]).toBe(2);
    expect(BASE_SKILL_COMPLEXITY["tenComplementsSub.-6=+4-10"]).toBe(2);
    expect(BASE_SKILL_COMPLEXITY["tenComplementsSub.-5=+5-10"]).toBe(2);
    expect(BASE_SKILL_COMPLEXITY["tenComplementsSub.-4=+6-10"]).toBe(2);
    expect(BASE_SKILL_COMPLEXITY["tenComplementsSub.-3=+7-10"]).toBe(2);
    expect(BASE_SKILL_COMPLEXITY["tenComplementsSub.-2=+8-10"]).toBe(2);
    expect(BASE_SKILL_COMPLEXITY["tenComplementsSub.-1=+9-10"]).toBe(2);
  });

  it("should have base cost 3 for advanced cascading skills", () => {
    expect(BASE_SKILL_COMPLEXITY["advanced.cascadingCarry"]).toBe(3);
    expect(BASE_SKILL_COMPLEXITY["advanced.cascadingBorrow"]).toBe(3);
  });
});

describe("MASTERY_MULTIPLIERS", () => {
  it("should have correct multipliers for two states (BKT handles fine-grained mastery)", () => {
    // Only two states: practicing (in rotation) and not_practicing
    // BKT provides fine-grained mastery via continuous P(known) values
    expect(MASTERY_MULTIPLIERS.practicing).toBe(3);
    expect(MASTERY_MULTIPLIERS.not_practicing).toBe(4);
  });

  it("should only have two mastery states", () => {
    // Verify we don't have legacy states like effortless, fluent, rusty
    const keys = Object.keys(MASTERY_MULTIPLIERS);
    expect(keys).toHaveLength(2);
    expect(keys).toContain("practicing");
    expect(keys).toContain("not_practicing");
  });
});

describe("getBaseComplexity", () => {
  it("should return base complexity for known skills", () => {
    expect(getBaseComplexity("basic.directAddition")).toBe(0);
    expect(getBaseComplexity("fiveComplements.4=5-1")).toBe(1);
    expect(getBaseComplexity("tenComplements.9=10-1")).toBe(2);
    expect(getBaseComplexity("advanced.cascadingCarry")).toBe(3);
  });

  it("should return 1 for unknown skills", () => {
    expect(getBaseComplexity("unknown.skill")).toBe(1);
  });
});

describe("createSkillCostCalculator", () => {
  it("should calculate cost based on isPracticing status (without BKT)", () => {
    // Without BKT data, practicing skills use multiplier 3, not_practicing use 4
    const history: StudentSkillHistory = {
      skills: {
        "fiveComplements.4=5-1": {
          skillId: "fiveComplements.4=5-1",
          masteryState: "practicing",
        },
        "tenComplements.9=10-1": {
          skillId: "tenComplements.9=10-1",
          masteryState: "not_practicing",
        },
      },
    };

    const calculator = createSkillCostCalculator(history);

    // fiveComplement: base 1 × practicing 3 = 3 (no BKT to override)
    expect(calculator.calculateSkillCost("fiveComplements.4=5-1")).toBe(3);

    // tenComplement: base 2 × not_practicing 4 = 8
    expect(calculator.calculateSkillCost("tenComplements.9=10-1")).toBe(8);
  });

  it("should treat unknown skills as not_practicing", () => {
    const history: StudentSkillHistory = { skills: {} };
    const calculator = createSkillCostCalculator(history);

    // Unknown skill with base 1: base 1 × not_practicing 4 = 4
    expect(calculator.calculateSkillCost("fiveComplements.4=5-1")).toBe(4);
  });

  it("should calculate term cost as sum of skill costs", () => {
    // Without BKT, all practicing skills use multiplier 3
    const history: StudentSkillHistory = {
      skills: {
        "fiveComplements.4=5-1": {
          skillId: "fiveComplements.4=5-1",
          masteryState: "practicing",
        },
        "fiveComplements.3=5-2": {
          skillId: "fiveComplements.3=5-2",
          masteryState: "practicing",
        },
        "tenComplements.9=10-1": {
          skillId: "tenComplements.9=10-1",
          masteryState: "practicing",
        },
      },
    };

    const calculator = createSkillCostCalculator(history);

    const termCost = calculator.calculateTermCost([
      "fiveComplements.4=5-1", // 1 × 3 = 3
      "fiveComplements.3=5-2", // 1 × 3 = 3
      "tenComplements.9=10-1", // 2 × 3 = 6
    ]);

    expect(termCost).toBe(12);
  });

  it("should return 0 for empty skill list", () => {
    const history: StudentSkillHistory = { skills: {} };
    const calculator = createSkillCostCalculator(history);
    expect(calculator.calculateTermCost([])).toBe(0);
  });

  it("should return correct mastery state via getMasteryState", () => {
    const history: StudentSkillHistory = {
      skills: {
        "fiveComplements.4=5-1": {
          skillId: "fiveComplements.4=5-1",
          masteryState: "practicing",
        },
        "tenComplements.9=10-1": {
          skillId: "tenComplements.9=10-1",
          masteryState: "not_practicing",
        },
      },
    };

    const calculator = createSkillCostCalculator(history);

    expect(calculator.getMasteryState("fiveComplements.4=5-1")).toBe(
      "practicing",
    );
    expect(calculator.getMasteryState("tenComplements.9=10-1")).toBe(
      "not_practicing",
    );
    expect(calculator.getMasteryState("unknown.skill")).toBe("not_practicing");
  });
});

describe("computeMasteryState (simplified - BKT handles fine-grained mastery)", () => {
  it("should return not_practicing when isPracticing is false", () => {
    expect(computeMasteryState(false, 0, 0, 0, undefined)).toBe(
      "not_practicing",
    );
    expect(computeMasteryState(false, 100, 100, 100, 5)).toBe("not_practicing");
  });

  it("should return practicing when isPracticing is true (regardless of stats)", () => {
    // BKT now handles fine-grained mastery; this just tracks rotation status
    expect(computeMasteryState(true, 0, 0, 0, undefined)).toBe("practicing");
    expect(computeMasteryState(true, 5, 5, 5, 5)).toBe("practicing");
    expect(computeMasteryState(true, 10, 9, 5, 5)).toBe("practicing");
    expect(computeMasteryState(true, 100, 100, 100, 90)).toBe("practicing");
  });
});

describe("buildStudentSkillHistoryFromRecords (simplified)", () => {
  it("should build history from database records", () => {
    const referenceDate = new Date("2024-03-01");
    const records: DbSkillRecord[] = [
      {
        skillId: "fiveComplements.4=5-1",
        isPracticing: true,
        attempts: 10,
        correct: 9,
        consecutiveCorrect: 5,
        lastPracticedAt: new Date("2024-02-25"), // 5 days ago
      },
      {
        skillId: "tenComplements.9=10-1",
        isPracticing: true,
        attempts: 5,
        correct: 4,
        consecutiveCorrect: 2,
        lastPracticedAt: null,
      },
      {
        skillId: "basic.directAddition",
        isPracticing: false,
        attempts: 0,
        correct: 0,
        consecutiveCorrect: 0,
        lastPracticedAt: null,
      },
    ];

    const history = buildStudentSkillHistoryFromRecords(records, referenceDate);

    // In practice rotation = practicing (BKT handles fine-grained mastery)
    expect(history.skills["fiveComplements.4=5-1"].masteryState).toBe(
      "practicing",
    );
    // In practice rotation = practicing
    expect(history.skills["tenComplements.9=10-1"].masteryState).toBe(
      "practicing",
    );
    // Not in practice rotation = not_practicing
    expect(history.skills["basic.directAddition"].masteryState).toBe(
      "not_practicing",
    );
  });

  it("should handle empty records", () => {
    const history = buildStudentSkillHistoryFromRecords([]);
    expect(history.skills).toEqual({});
  });
});
