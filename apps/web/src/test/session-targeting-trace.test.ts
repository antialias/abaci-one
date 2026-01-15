/**
 * @vitest-environment node
 *
 * Session Targeting Trace Test
 *
 * Traces exactly what happens with targetSkills during session generation
 * to identify where the targeting information might be getting lost.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";
import {
  createEphemeralDatabase,
  createTestStudent,
  getCurrentEphemeralDb,
  setCurrentEphemeralDb,
  type EphemeralDbResult,
} from "./journey-simulator/EphemeralDatabase";
import {
  starkContrastProfile,
  STARK_WEAK_SKILLS,
} from "./journey-simulator/profiles";
import { SeededRandom } from "./journey-simulator/SeededRandom";
import { SimulatedStudent } from "./journey-simulator/SimulatedStudent";
import {
  generateSessionPlan,
  approveSessionPlan,
  recordSlotResult,
  getRecentSessionResults,
} from "@/lib/curriculum/session-planner";
import { setPracticingSkills } from "@/lib/curriculum/progress-manager";

// Mock the @/db module to use our ephemeral database
vi.mock("@/db", () => ({
  get db() {
    return getCurrentEphemeralDb();
  },
  schema,
}));

describe("Session Targeting Trace", () => {
  let ephemeralDb: EphemeralDbResult;
  const seed = 12345;
  const skills = [
    "basic.directAddition",
    "basic.heavenBead",
    "fiveComplements.3=5-2",
    "fiveComplements.4=5-1",
  ];

  beforeEach(() => {
    ephemeralDb = createEphemeralDatabase();
    setCurrentEphemeralDb(ephemeralDb.db);
  });

  afterEach(() => {
    setCurrentEphemeralDb(null);
    ephemeralDb.cleanup();
  });

  it("should trace targetSkills through session generation", async () => {
    const { playerId } = await createTestStudent(ephemeralDb.db, "trace-test");
    await setPracticingSkills(playerId, skills);

    const rng = new SeededRandom(seed);
    const student = new SimulatedStudent(starkContrastProfile, rng);
    student.ensureSkillsTracked(skills);

    // Mock Math.random
    const originalRandom = Math.random;
    Math.random = rng.createMathRandomMock();

    try {
      console.log("\n" + "=".repeat(80));
      console.log("     SESSION TARGETING TRACE");
      console.log("=".repeat(80));

      // Session 1: No BKT data, should not have targeting
      console.log("\n--- SESSION 1 (no BKT data) ---");
      const plan1 = await generateSessionPlan({
        playerId,
        durationMinutes: 12,
        problemGenerationMode: "adaptive",
      });

      // Analyze session 1 slots
      let session1FiveComplementCount = 0;
      let session1TotalSlots = 0;
      for (const part of plan1.parts) {
        for (const slot of part.slots) {
          session1TotalSlots++;
          const hasFiveComplement = slot.problem.skillsRequired?.some(
            (s: string) => s.startsWith("fiveComplements."),
          );
          if (hasFiveComplement) session1FiveComplementCount++;
        }
      }
      console.log(
        `Session 1: ${session1FiveComplementCount}/${session1TotalSlots} problems use five complements (${((session1FiveComplementCount / session1TotalSlots) * 100).toFixed(1)}%)`,
      );

      // Complete session 1 to build BKT history
      await approveSessionPlan(plan1.id);
      for (const part of plan1.parts) {
        for (const slot of part.slots) {
          const answer = student.answerProblem(slot.problem);
          await recordSlotResult(plan1.id, part.partNumber, slot.index, {
            isCorrect: answer.isCorrect,
            responseTimeMs: answer.responseTimeMs,
            hadHelp: answer.hadHelp,
            skillsExercised: answer.skillsChallenged,
          });
        }
      }

      // Check BKT after session 1
      const history1 = await getRecentSessionResults(playerId, 50);
      console.log(`After session 1: ${history1.length} results in history`);

      // Session 2: Should have BKT data and targeting
      console.log("\n--- SESSION 2 (with BKT data) ---");
      const plan2 = await generateSessionPlan({
        playerId,
        durationMinutes: 12,
        problemGenerationMode: "adaptive",
      });

      // Analyze session 2 slots - check constraints for targetSkills
      let session2FiveComplementCount = 0;
      let session2TotalSlots = 0;
      let slotsWithTargeting = 0;

      for (const part of plan2.parts) {
        for (const slot of part.slots) {
          session2TotalSlots++;

          // Check if slot has targetSkills
          const hasTargets = slot.constraints?.targetSkills;
          const targetList = hasTargets
            ? Object.entries(slot.constraints.targetSkills).flatMap(
                ([cat, skills]) =>
                  Object.entries(skills as Record<string, boolean>)
                    .filter(([, v]) => v)
                    .map(([s]) => `${cat}.${s}`),
              )
            : [];

          if (targetList.length > 0) {
            slotsWithTargeting++;
          }

          const hasFiveComplement = slot.problem.skillsRequired?.some(
            (s: string) => s.startsWith("fiveComplements."),
          );
          if (hasFiveComplement) session2FiveComplementCount++;

          // Log first few slots in detail
          if (slot.index < 3) {
            console.log(
              `  Slot ${slot.index} (${slot.purpose}): targets=${targetList.length > 0 ? targetList.join(",") : "none"} → skills=${slot.problem.skillsRequired?.join(",")}`,
            );
          }
        }
      }

      console.log(
        `\nSession 2: ${session2FiveComplementCount}/${session2TotalSlots} problems use five complements (${((session2FiveComplementCount / session2TotalSlots) * 100).toFixed(1)}%)`,
      );
      console.log(
        `Slots with targeting: ${slotsWithTargeting}/${session2TotalSlots}`,
      );

      // Now run CLASSIC mode with same seed for comparison
      console.log("\n--- CLASSIC MODE COMPARISON ---");
      const { playerId: classicPlayerId } = await createTestStudent(
        ephemeralDb.db,
        "classic-trace",
      );
      await setPracticingSkills(classicPlayerId, skills);

      const classicRng = new SeededRandom(seed);
      const classicStudent = new SimulatedStudent(
        starkContrastProfile,
        classicRng,
      );
      classicStudent.ensureSkillsTracked(skills);
      Math.random = classicRng.createMathRandomMock();

      // Session 1 classic
      const classicPlan1 = await generateSessionPlan({
        playerId: classicPlayerId,
        durationMinutes: 12,
        problemGenerationMode: "classic",
      });

      // Complete session 1
      await approveSessionPlan(classicPlan1.id);
      for (const part of classicPlan1.parts) {
        for (const slot of part.slots) {
          const answer = classicStudent.answerProblem(slot.problem);
          await recordSlotResult(classicPlan1.id, part.partNumber, slot.index, {
            isCorrect: answer.isCorrect,
            responseTimeMs: answer.responseTimeMs,
            hadHelp: answer.hadHelp,
            skillsExercised: answer.skillsChallenged,
          });
        }
      }

      // Session 2 classic
      const classicPlan2 = await generateSessionPlan({
        playerId: classicPlayerId,
        durationMinutes: 12,
        problemGenerationMode: "classic",
      });

      let classicSession2FiveComplementCount = 0;
      let classicSession2TotalSlots = 0;
      let classicSlotsWithTargeting = 0;

      for (const part of classicPlan2.parts) {
        for (const slot of part.slots) {
          classicSession2TotalSlots++;

          const hasTargets = slot.constraints?.targetSkills;
          const targetList = hasTargets
            ? Object.entries(slot.constraints.targetSkills).flatMap(
                ([cat, skills]) =>
                  Object.entries(skills as Record<string, boolean>)
                    .filter(([, v]) => v)
                    .map(([s]) => `${cat}.${s}`),
              )
            : [];

          if (targetList.length > 0) {
            classicSlotsWithTargeting++;
          }

          const hasFiveComplement = slot.problem.skillsRequired?.some(
            (s: string) => s.startsWith("fiveComplements."),
          );
          if (hasFiveComplement) classicSession2FiveComplementCount++;
        }
      }

      console.log(
        `Classic Session 2: ${classicSession2FiveComplementCount}/${classicSession2TotalSlots} problems use five complements (${((classicSession2FiveComplementCount / classicSession2TotalSlots) * 100).toFixed(1)}%)`,
      );
      console.log(
        `Classic slots with targeting: ${classicSlotsWithTargeting}/${classicSession2TotalSlots}`,
      );

      // Summary
      console.log("\n" + "=".repeat(80));
      console.log("SUMMARY");
      console.log("=".repeat(80));
      console.log(
        `Adaptive Session 2: ${((session2FiveComplementCount / session2TotalSlots) * 100).toFixed(1)}% five complement usage`,
      );
      console.log(
        `Classic Session 2:  ${((classicSession2FiveComplementCount / classicSession2TotalSlots) * 100).toFixed(1)}% five complement usage`,
      );
      console.log(`Adaptive slots with targeting: ${slotsWithTargeting}`);
      console.log(
        `Classic slots with targeting:  ${classicSlotsWithTargeting}`,
      );

      const adaptiveRate = session2FiveComplementCount / session2TotalSlots;
      const classicRate =
        classicSession2FiveComplementCount / classicSession2TotalSlots;
      const improvement = adaptiveRate - classicRate;

      console.log(
        `\nDifference: ${improvement >= 0 ? "+" : ""}${(improvement * 100).toFixed(1)}pp`,
      );

      if (improvement > 0.1) {
        console.log(
          "\n✓ Adaptive mode shows significantly more weak skill targeting!",
        );
      } else if (slotsWithTargeting > classicSlotsWithTargeting) {
        console.log(
          "\n⚠ Targeting is being SET but not producing more weak skill problems.",
        );
        console.log(
          "  This suggests the problem generator is not responding to targetSkills.",
        );
      } else {
        console.log("\n✗ No targeting difference detected.");
      }

      // Expectations
      expect(slotsWithTargeting).toBeGreaterThan(0); // Adaptive should have some targeting
      expect(classicSlotsWithTargeting).toBe(0); // Classic should have no targeting
    } finally {
      Math.random = originalRandom;
    }
  }, 60000);
});
