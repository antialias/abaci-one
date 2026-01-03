// Tests for progression path utilities

import { describe, expect, it } from "vitest";
import {
  SINGLE_CARRY_PATH,
  configMatchesStep,
  findNearestStep,
  getSliderValueFromStep,
  getStepById,
  getStepFromSliderValue,
  type ProgressionStep,
} from "../progressionPath";

describe("progressionPath", () => {
  describe("SINGLE_CARRY_PATH", () => {
    it("should have 6 steps", () => {
      expect(SINGLE_CARRY_PATH).toHaveLength(6);
    });

    it("should have consecutive step numbers", () => {
      SINGLE_CARRY_PATH.forEach((step, index) => {
        expect(step.stepNumber).toBe(index);
      });
    });

    it("should have correct next/previous links", () => {
      // First step
      expect(SINGLE_CARRY_PATH[0].previousStepId).toBe(null);
      expect(SINGLE_CARRY_PATH[0].nextStepId).toBe("single-carry-1d-minimal");

      // Middle steps
      expect(SINGLE_CARRY_PATH[1].previousStepId).toBe("single-carry-1d-full");
      expect(SINGLE_CARRY_PATH[1].nextStepId).toBe("single-carry-2d-full");

      // Last step
      expect(SINGLE_CARRY_PATH[5].previousStepId).toBe("single-carry-3d-full");
      expect(SINGLE_CARRY_PATH[5].nextStepId).toBe(null);
    });

    it("should demonstrate scaffolding cycling", () => {
      // 1-digit: full → minimal
      expect(SINGLE_CARRY_PATH[0].config.displayRules?.tenFrames).toBe(
        "whenRegrouping",
      );
      expect(SINGLE_CARRY_PATH[1].config.displayRules?.tenFrames).toBe("never");

      // 2-digit: full → minimal (ten-frames RETURN)
      expect(SINGLE_CARRY_PATH[2].config.displayRules?.tenFrames).toBe(
        "whenRegrouping",
      );
      expect(SINGLE_CARRY_PATH[3].config.displayRules?.tenFrames).toBe("never");

      // 3-digit: full → minimal (ten-frames RETURN AGAIN)
      expect(SINGLE_CARRY_PATH[4].config.displayRules?.tenFrames).toBe(
        "whenRegrouping",
      );
      expect(SINGLE_CARRY_PATH[5].config.displayRules?.tenFrames).toBe("never");
    });

    it("should have increasing digit complexity", () => {
      // 1-digit (steps 0-1)
      expect(SINGLE_CARRY_PATH[0].config.digitRange?.min).toBe(1);
      expect(SINGLE_CARRY_PATH[0].config.digitRange?.max).toBe(1);
      expect(SINGLE_CARRY_PATH[1].config.digitRange?.min).toBe(1);

      // 2-digit (steps 2-3)
      expect(SINGLE_CARRY_PATH[2].config.digitRange?.min).toBe(2);
      expect(SINGLE_CARRY_PATH[2].config.digitRange?.max).toBe(2);
      expect(SINGLE_CARRY_PATH[3].config.digitRange?.min).toBe(2);

      // 3-digit (steps 4-5)
      expect(SINGLE_CARRY_PATH[4].config.digitRange?.min).toBe(3);
      expect(SINGLE_CARRY_PATH[4].config.digitRange?.max).toBe(3);
      expect(SINGLE_CARRY_PATH[5].config.digitRange?.min).toBe(3);
    });

    it("should have consistent regrouping config", () => {
      // All steps have 100% regrouping, ones place only
      SINGLE_CARRY_PATH.forEach((step) => {
        expect(step.config.pAnyStart).toBe(1.0);
        expect(step.config.pAllStart).toBe(0);
      });
    });

    it("should all be addition operator", () => {
      SINGLE_CARRY_PATH.forEach((step) => {
        expect(step.config.operator).toBe("addition");
      });
    });

    it("should all be single-carry technique", () => {
      SINGLE_CARRY_PATH.forEach((step) => {
        expect(step.technique).toBe("single-carry");
      });
    });

    it("should have interpolate disabled", () => {
      // Mastery mode = no progressive difficulty
      SINGLE_CARRY_PATH.forEach((step) => {
        expect(step.config.interpolate).toBe(false);
      });
    });
  });

  describe("getStepFromSliderValue", () => {
    it("should return first step for value 0", () => {
      const step = getStepFromSliderValue(0, SINGLE_CARRY_PATH);
      expect(step.stepNumber).toBe(0);
      expect(step.id).toBe("single-carry-1d-full");
    });

    it("should return last step for value 100", () => {
      const step = getStepFromSliderValue(100, SINGLE_CARRY_PATH);
      expect(step.stepNumber).toBe(5);
      expect(step.id).toBe("single-carry-3d-minimal");
    });

    it("should return middle steps for middle values", () => {
      // 6 steps → positions at 0, 20, 40, 60, 80, 100
      const step1 = getStepFromSliderValue(20, SINGLE_CARRY_PATH);
      expect(step1.stepNumber).toBe(1);

      const step2 = getStepFromSliderValue(40, SINGLE_CARRY_PATH);
      expect(step2.stepNumber).toBe(2);

      const step3 = getStepFromSliderValue(60, SINGLE_CARRY_PATH);
      expect(step3.stepNumber).toBe(3);
    });

    it("should round to nearest step", () => {
      // 6 steps → positions at 0, 20, 40, 60, 80, 100
      // Value 30: (30/100) * 5 = 1.5 → rounds to 2
      const step = getStepFromSliderValue(30, SINGLE_CARRY_PATH);
      expect(step.stepNumber).toBe(2);

      // Value 10: (10/100) * 5 = 0.5 → rounds to 1
      const step2 = getStepFromSliderValue(10, SINGLE_CARRY_PATH);
      expect(step2.stepNumber).toBe(1);

      // Value 50: (50/100) * 5 = 2.5 → rounds to 3
      const step3 = getStepFromSliderValue(50, SINGLE_CARRY_PATH);
      expect(step3.stepNumber).toBe(3);
    });

    it("should clamp values below 0 to first step", () => {
      const step = getStepFromSliderValue(-10, SINGLE_CARRY_PATH);
      expect(step.stepNumber).toBe(0);
    });

    it("should clamp values above 100 to last step", () => {
      const step = getStepFromSliderValue(150, SINGLE_CARRY_PATH);
      expect(step.stepNumber).toBe(5);
    });
  });

  describe("getSliderValueFromStep", () => {
    it("should return 0 for first step", () => {
      const value = getSliderValueFromStep(0, SINGLE_CARRY_PATH.length);
      expect(value).toBe(0);
    });

    it("should return 100 for last step", () => {
      const value = getSliderValueFromStep(5, SINGLE_CARRY_PATH.length);
      expect(value).toBe(100);
    });

    it("should return evenly spaced values for middle steps", () => {
      // 6 steps → 0, 20, 40, 60, 80, 100
      expect(getSliderValueFromStep(0, 6)).toBe(0);
      expect(getSliderValueFromStep(1, 6)).toBe(20);
      expect(getSliderValueFromStep(2, 6)).toBe(40);
      expect(getSliderValueFromStep(3, 6)).toBe(60);
      expect(getSliderValueFromStep(4, 6)).toBe(80);
      expect(getSliderValueFromStep(5, 6)).toBe(100);
    });

    it("should handle single-step path", () => {
      const value = getSliderValueFromStep(0, 1);
      expect(value).toBe(0);
    });

    it("should be inverse of getStepFromSliderValue", () => {
      // Round-trip should preserve step number
      for (let stepNum = 0; stepNum < SINGLE_CARRY_PATH.length; stepNum++) {
        const sliderValue = getSliderValueFromStep(
          stepNum,
          SINGLE_CARRY_PATH.length,
        );
        const step = getStepFromSliderValue(sliderValue, SINGLE_CARRY_PATH);
        expect(step.stepNumber).toBe(stepNum);
      }
    });
  });

  describe("findNearestStep", () => {
    it("should find exact match for step config", () => {
      const step2Config = SINGLE_CARRY_PATH[2].config;
      const nearest = findNearestStep(step2Config, SINGLE_CARRY_PATH);
      expect(nearest.stepNumber).toBe(2);
      expect(nearest.id).toBe("single-carry-2d-full");
    });

    it("should prioritize digit range matching", () => {
      // Config with 3-digit but wrong scaffolding
      // Use a complete displayRules object from an existing step
      const baseDisplayRules = SINGLE_CARRY_PATH[0].config.displayRules!;
      const config = {
        digitRange: { min: 3, max: 3 },
        operator: "addition" as const,
        pAnyStart: 1.0,
        pAllStart: 0,
        displayRules: {
          ...baseDisplayRules,
          tenFrames: "always" as const, // Wrong, but digit range matches
        },
      };

      const nearest = findNearestStep(config, SINGLE_CARRY_PATH);
      // Should match step 4 or 5 (both 3-digit)
      expect(nearest.config.digitRange?.min).toBe(3);
    });

    it("should fall back to first step if no good match", () => {
      const config = {
        digitRange: { min: 5, max: 5 }, // No 5-digit steps
        operator: "subtraction" as const, // Wrong operator
        pAnyStart: 0.5, // Wrong regrouping
        pAllStart: 0.5,
      };

      const nearest = findNearestStep(config, SINGLE_CARRY_PATH);
      expect(nearest).toBeDefined(); // Should still return something
      expect(nearest.stepNumber).toBe(0); // Default to first
    });

    it("should match regrouping config when digit range matches", () => {
      // Two steps with same digit range, different scaffolding
      const baseDisplayRules = SINGLE_CARRY_PATH[2].config.displayRules!;

      const config1 = {
        digitRange: { min: 2, max: 2 },
        operator: "addition" as const,
        pAnyStart: 1.0,
        pAllStart: 0,
        displayRules: {
          ...baseDisplayRules,
          tenFrames: "whenRegrouping" as const,
        },
      };

      const nearest1 = findNearestStep(config1, SINGLE_CARRY_PATH);
      expect(nearest1.id).toBe("single-carry-2d-full"); // Step 2

      const config2 = {
        digitRange: { min: 2, max: 2 },
        operator: "addition" as const,
        pAnyStart: 1.0,
        pAllStart: 0,
        displayRules: {
          ...baseDisplayRules,
          tenFrames: "never" as const,
        },
      };

      const nearest2 = findNearestStep(config2, SINGLE_CARRY_PATH);
      expect(nearest2.id).toBe("single-carry-2d-minimal"); // Step 3
    });
  });

  describe("configMatchesStep", () => {
    it("should return true for exact match", () => {
      const step = SINGLE_CARRY_PATH[2];
      const matches = configMatchesStep(step.config, step);
      expect(matches).toBe(true);
    });

    it("should return false if digit range differs", () => {
      const step = SINGLE_CARRY_PATH[2];
      const config = {
        ...step.config,
        digitRange: { min: 3, max: 3 }, // Different
      };
      const matches = configMatchesStep(config, step);
      expect(matches).toBe(false);
    });

    it("should return false if regrouping config differs", () => {
      const step = SINGLE_CARRY_PATH[2];
      const config = {
        ...step.config,
        pAnyStart: 0.5, // Different
      };
      const matches = configMatchesStep(config, step);
      expect(matches).toBe(false);
    });

    it("should return false if scaffolding differs", () => {
      const step = SINGLE_CARRY_PATH[2];
      const config = {
        ...step.config,
        displayRules: step.config.displayRules
          ? {
              ...step.config.displayRules,
              tenFrames: "never" as const, // Different
            }
          : undefined,
      };
      const matches = configMatchesStep(config, step);
      expect(matches).toBe(false);
    });

    it("should return false if operator differs", () => {
      const step = SINGLE_CARRY_PATH[2];
      const config = {
        ...step.config,
        operator: "subtraction" as const, // Different
      };
      const matches = configMatchesStep(config, step);
      expect(matches).toBe(false);
    });
  });

  describe("getStepById", () => {
    it("should find step by ID", () => {
      const step = getStepById("single-carry-2d-full", SINGLE_CARRY_PATH);
      expect(step).toBeDefined();
      expect(step?.stepNumber).toBe(2);
      expect(step?.config.digitRange?.min).toBe(2);
    });

    it("should return undefined for non-existent ID", () => {
      const step = getStepById("does-not-exist", SINGLE_CARRY_PATH);
      expect(step).toBeUndefined();
    });

    it("should find first step", () => {
      const step = getStepById("single-carry-1d-full", SINGLE_CARRY_PATH);
      expect(step).toBeDefined();
      expect(step?.stepNumber).toBe(0);
    });

    it("should find last step", () => {
      const step = getStepById("single-carry-3d-minimal", SINGLE_CARRY_PATH);
      expect(step).toBeDefined();
      expect(step?.stepNumber).toBe(5);
    });
  });
});
