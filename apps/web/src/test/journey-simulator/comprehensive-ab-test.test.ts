/**
 * @vitest-environment node
 *
 * Comprehensive A/B Test: Per-Skill Deficiency Profiles
 *
 * Tests BKT-driven adaptive mode vs classic mode across ALL 32 abacus skills.
 * Each test creates a student deficient in ONE specific skill, with all
 * prerequisites mastered.
 *
 * Configuration (4x the previous test):
 * - 24 sessions per journey (was 6)
 * - 40 minutes per session (was 10) → ~48 problems per session
 * - Total: ~1,152 problems per journey
 *
 * This provides statistical power to detect if BKT correctly identifies
 * and targets the specific deficient skill.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";
import {
  createEphemeralDatabase,
  createTestStudent,
  type EphemeralDbResult,
  getCurrentEphemeralDb,
  setCurrentEphemeralDb,
} from "./EphemeralDatabase";
import { JourneyRunner } from "./JourneyRunner";
import {
  generateDeficientProfile,
  getPracticingSkillsForDeficiency,
  getRepresentativeProfilesAllLearners,
  LEARNER_TYPES,
  type LearnerType,
  SKILL_ORDER,
} from "./profiles";
import { formatJourneyResults } from "./reporters";
import { SeededRandom } from "./SeededRandom";
import { SimulatedStudent } from "./SimulatedStudent";
import type { JourneyConfig } from "./types";

// Mock the @/db module to use our ephemeral database
vi.mock("@/db", () => ({
  get db() {
    return getCurrentEphemeralDb();
  },
  schema,
}));

// Test configuration
const COMPREHENSIVE_CONFIG = {
  sessionCount: 24, // 4x previous (was 6)
  sessionDurationMinutes: 40, // 4x previous (was 10) → ~48 problems
  seed: 54321,
};

// Quick test configuration (for development)
const QUICK_CONFIG = {
  sessionCount: 12,
  sessionDurationMinutes: 20, // ~24 problems
  seed: 54321,
};

describe("Comprehensive A/B Test: Per-Skill Deficiency", () => {
  let ephemeralDb: EphemeralDbResult;

  beforeEach(() => {
    ephemeralDb = createEphemeralDatabase();
    setCurrentEphemeralDb(ephemeralDb.db);
  });

  afterEach(() => {
    setCurrentEphemeralDb(null);
    ephemeralDb.cleanup();
  });

  describe("Representative Skills - All Learner Types (Quick)", () => {
    // 10 representative skills × 3 learner types = 30 profiles
    const representativeProfiles = getRepresentativeProfilesAllLearners();

    for (const {
      skillId,
      learnerType,
      profile,
      practicingSkills,
    } of representativeProfiles) {
      it(`[${learnerType}] ${skillId}: Adaptive should identify and target deficiency`, async () => {
        const skillSlug = skillId.replace(/[^a-zA-Z0-9]/g, "-");
        const { playerId: adaptivePlayerId } = await createTestStudent(
          ephemeralDb.db,
          `adaptive-${learnerType}-${skillSlug}`,
        );
        const { playerId: classicPlayerId } = await createTestStudent(
          ephemeralDb.db,
          `classic-${learnerType}-${skillSlug}`,
        );

        const baseConfig = {
          ...QUICK_CONFIG,
          practicingSkills,
        };

        // Run adaptive mode
        const adaptiveConfig: JourneyConfig = {
          ...baseConfig,
          profile,
          mode: "adaptive",
        };

        const adaptiveRng = new SeededRandom(baseConfig.seed);
        const adaptiveStudent = new SimulatedStudent(profile, adaptiveRng);
        const adaptiveRunner = new JourneyRunner(
          ephemeralDb.db,
          adaptiveStudent,
          adaptiveConfig,
          adaptiveRng,
          adaptivePlayerId,
        );
        const adaptiveResult = await adaptiveRunner.run();

        // Run classic mode (same seed for fair comparison)
        const classicConfig: JourneyConfig = {
          ...baseConfig,
          profile,
          mode: "classic",
        };

        const classicRng = new SeededRandom(baseConfig.seed);
        const classicStudent = new SimulatedStudent(profile, classicRng);
        const classicRunner = new JourneyRunner(
          ephemeralDb.db,
          classicStudent,
          classicConfig,
          classicRng,
          classicPlayerId,
        );
        const classicResult = await classicRunner.run();

        // Output results
        console.log(`\n${"=".repeat(70)}`);
        console.log(`SKILL: ${skillId} | LEARNER: ${learnerType}`);
        console.log(`${"=".repeat(70)}`);
        console.log("\n--- ADAPTIVE ---");
        console.log(formatJourneyResults(adaptiveResult));
        console.log("\n--- CLASSIC ---");
        console.log(formatJourneyResults(classicResult));

        // Compare final accuracy
        const adaptiveFinal =
          adaptiveResult.snapshots[adaptiveResult.snapshots.length - 1]
            .accuracy;
        const classicFinal =
          classicResult.snapshots[classicResult.snapshots.length - 1].accuracy;

        console.log(`\n--- COMPARISON ---`);
        console.log(
          `Adaptive final accuracy: ${(adaptiveFinal * 100).toFixed(1)}%`,
        );
        console.log(
          `Classic final accuracy:  ${(classicFinal * 100).toFixed(1)}%`,
        );
        console.log(
          `Winner: ${adaptiveFinal > classicFinal ? "ADAPTIVE" : adaptiveFinal < classicFinal ? "CLASSIC" : "TIE"}`,
        );

        // Check if BKT identified the deficient skill
        const lastSnapshot =
          adaptiveResult.snapshots[adaptiveResult.snapshots.length - 1];
        const deficientSkillBkt = lastSnapshot.bktEstimates.get(skillId);

        if (deficientSkillBkt) {
          console.log(`\nBKT estimate for deficient skill (${skillId}):`);
          console.log(
            `  P(known): ${(deficientSkillBkt.pKnown * 100).toFixed(1)}%`,
          );
          console.log(
            `  Confidence: ${deficientSkillBkt.confidence.toFixed(2)}`,
          );
        }

        // Verify results are different (modes are working)
        const adaptiveAccuracies = adaptiveResult.snapshots.map(
          (s) => s.accuracy,
        );
        const classicAccuracies = classicResult.snapshots.map(
          (s) => s.accuracy,
        );
        const accuracyDiffs = adaptiveAccuracies.map((a, i) =>
          Math.abs(a - classicAccuracies[i]),
        );
        const totalDiff = accuracyDiffs.reduce((sum, d) => sum + d, 0);

        // Modes should produce different trajectories (unless identical by chance)
        if (totalDiff === 0) {
          console.log(
            "⚠️ WARNING: Identical trajectories - modes may not be differentiating",
          );
        }
      }, 300000); // 5 minute timeout per skill
    }
  });

  describe("Summary: All Learner Types Comparison", () => {
    it("should output aggregate comparison across all learner types and representative skills", async () => {
      // 10 representative skills × 3 learner types = 30 profiles
      const representativeProfiles = getRepresentativeProfilesAllLearners();
      const results: Array<{
        skillId: string;
        learnerType: LearnerType;
        adaptiveFinal: number;
        classicFinal: number;
        winner: "adaptive" | "classic" | "tie";
      }> = [];

      for (const {
        skillId,
        learnerType,
        profile,
        practicingSkills,
      } of representativeProfiles) {
        const skillSlug = skillId.replace(/[^a-zA-Z0-9]/g, "-");
        const { playerId: adaptivePlayerId } = await createTestStudent(
          ephemeralDb.db,
          `sum-adaptive-${learnerType}-${skillSlug}`,
        );
        const { playerId: classicPlayerId } = await createTestStudent(
          ephemeralDb.db,
          `sum-classic-${learnerType}-${skillSlug}`,
        );

        const baseConfig = {
          ...QUICK_CONFIG,
          practicingSkills,
        };

        // Adaptive
        const adaptiveConfig: JourneyConfig = {
          ...baseConfig,
          profile,
          mode: "adaptive",
        };
        const adaptiveRng = new SeededRandom(baseConfig.seed);
        const adaptiveResult = await new JourneyRunner(
          ephemeralDb.db,
          new SimulatedStudent(profile, adaptiveRng),
          adaptiveConfig,
          adaptiveRng,
          adaptivePlayerId,
        ).run();

        // Classic
        const classicConfig: JourneyConfig = {
          ...baseConfig,
          profile,
          mode: "classic",
        };
        const classicRng = new SeededRandom(baseConfig.seed);
        const classicResult = await new JourneyRunner(
          ephemeralDb.db,
          new SimulatedStudent(profile, classicRng),
          classicConfig,
          classicRng,
          classicPlayerId,
        ).run();

        const adaptiveFinal =
          adaptiveResult.snapshots[adaptiveResult.snapshots.length - 1]
            .accuracy;
        const classicFinal =
          classicResult.snapshots[classicResult.snapshots.length - 1].accuracy;

        results.push({
          skillId,
          learnerType,
          adaptiveFinal,
          classicFinal,
          winner:
            adaptiveFinal > classicFinal
              ? "adaptive"
              : adaptiveFinal < classicFinal
                ? "classic"
                : "tie",
        });
      }

      // Output summary table
      console.log(`\n${"=".repeat(90)}`);
      console.log(
        "AGGREGATE SUMMARY: All Learner Types × Representative Skills",
      );
      console.log("=".repeat(90));
      console.log(
        "\n| Learner  | Skill ID                       | Adaptive | Classic | Winner   |",
      );
      console.log(
        "|----------|--------------------------------|----------|---------|----------|",
      );

      for (const r of results) {
        console.log(
          `| ${r.learnerType.padEnd(8)} | ${r.skillId.padEnd(30)} | ${(r.adaptiveFinal * 100).toFixed(1).padStart(6)}% | ${(r.classicFinal * 100).toFixed(1).padStart(5)}% | ${r.winner.padEnd(8)} |`,
        );
      }

      const adaptiveWins = results.filter(
        (r) => r.winner === "adaptive",
      ).length;
      const classicWins = results.filter((r) => r.winner === "classic").length;
      const ties = results.filter((r) => r.winner === "tie").length;

      // Group by learner type
      const byLearner = {
        fast: results.filter((r) => r.learnerType === "fast"),
        average: results.filter((r) => r.learnerType === "average"),
        slow: results.filter((r) => r.learnerType === "slow"),
      };

      console.log("\n--- TOTALS ---");
      console.log(
        `Total: Adaptive wins: ${adaptiveWins}, Classic wins: ${classicWins}, Ties: ${ties}`,
      );

      for (const [type, typeResults] of Object.entries(byLearner)) {
        const aWins = typeResults.filter((r) => r.winner === "adaptive").length;
        const cWins = typeResults.filter((r) => r.winner === "classic").length;
        const tWins = typeResults.filter((r) => r.winner === "tie").length;
        console.log(
          `${type.padEnd(8)}: Adaptive wins: ${aWins}, Classic wins: ${cWins}, Ties: ${tWins}`,
        );
      }

      // BKT should help in majority of cases
      expect(adaptiveWins).toBeGreaterThanOrEqual(classicWins);
    }, 1200000); // 20 minute timeout for summary (30 profiles now)
  });

  describe("Per-Skill Assessment Comparison", () => {
    it("should show adaptive gives more exposure to deficient skill", async () => {
      // Test a subset of profiles with per-skill assessment
      const testProfiles = getRepresentativeProfilesAllLearners().slice(0, 15); // First 15 for speed
      const results: Array<{
        skillId: string;
        learnerType: LearnerType;
        adaptiveExposure: number;
        classicExposure: number;
        adaptiveTrueProb: number;
        classicTrueProb: number;
        adaptiveAssessment: number;
        classicAssessment: number;
        exposureWinner: "adaptive" | "classic" | "tie";
        masteryWinner: "adaptive" | "classic" | "tie";
      }> = [];

      for (const {
        skillId,
        learnerType,
        profile,
        practicingSkills,
      } of testProfiles) {
        const skillSlug = skillId.replace(/[^a-zA-Z0-9]/g, "-");
        const { playerId: adaptivePlayerId } = await createTestStudent(
          ephemeralDb.db,
          `assess-adaptive-${learnerType}-${skillSlug}`,
        );
        const { playerId: classicPlayerId } = await createTestStudent(
          ephemeralDb.db,
          `assess-classic-${learnerType}-${skillSlug}`,
        );

        const baseConfig = {
          ...QUICK_CONFIG,
          practicingSkills,
        };

        // Run adaptive mode
        const adaptiveConfig: JourneyConfig = {
          ...baseConfig,
          profile,
          mode: "adaptive",
        };
        const adaptiveRng = new SeededRandom(baseConfig.seed);
        const adaptiveStudent = new SimulatedStudent(profile, adaptiveRng);
        await new JourneyRunner(
          ephemeralDb.db,
          adaptiveStudent,
          adaptiveConfig,
          adaptiveRng,
          adaptivePlayerId,
        ).run();

        // Run classic mode
        const classicConfig: JourneyConfig = {
          ...baseConfig,
          profile,
          mode: "classic",
        };
        const classicRng = new SeededRandom(baseConfig.seed);
        const classicStudent = new SimulatedStudent(profile, classicRng);
        await new JourneyRunner(
          ephemeralDb.db,
          classicStudent,
          classicConfig,
          classicRng,
          classicPlayerId,
        ).run();

        // Assess the DEFICIENT skill specifically (no learning during assessment)
        const adaptiveAssessment = adaptiveStudent.assessSkill(skillId, 50);
        const classicAssessment = classicStudent.assessSkill(skillId, 50);

        const exposureWinner =
          adaptiveAssessment.exposure > classicAssessment.exposure
            ? "adaptive"
            : adaptiveAssessment.exposure < classicAssessment.exposure
              ? "classic"
              : "tie";

        const masteryWinner =
          adaptiveAssessment.trueProbability > classicAssessment.trueProbability
            ? "adaptive"
            : adaptiveAssessment.trueProbability <
                classicAssessment.trueProbability
              ? "classic"
              : "tie";

        results.push({
          skillId,
          learnerType,
          adaptiveExposure: adaptiveAssessment.exposure,
          classicExposure: classicAssessment.exposure,
          adaptiveTrueProb: adaptiveAssessment.trueProbability,
          classicTrueProb: classicAssessment.trueProbability,
          adaptiveAssessment: adaptiveAssessment.assessedAccuracy,
          classicAssessment: classicAssessment.assessedAccuracy,
          exposureWinner,
          masteryWinner,
        });
      }

      // Output per-skill assessment table
      console.log(`\n${"=".repeat(120)}`);
      console.log("PER-SKILL ASSESSMENT: Deficient Skill Exposure & Mastery");
      console.log("=".repeat(120));
      console.log(
        "\n| Learner  | Deficient Skill                | A.Exp | C.Exp | Exp Win  | A.P(k) | C.P(k) | Mastery Win |",
      );
      console.log(
        "|----------|--------------------------------|-------|-------|----------|--------|--------|-------------|",
      );

      for (const r of results) {
        console.log(
          `| ${r.learnerType.padEnd(8)} | ${r.skillId.padEnd(30)} | ${String(r.adaptiveExposure).padStart(5)} | ${String(r.classicExposure).padStart(5)} | ${r.exposureWinner.padEnd(8)} | ${(r.adaptiveTrueProb * 100).toFixed(0).padStart(5)}% | ${(r.classicTrueProb * 100).toFixed(0).padStart(5)}% | ${r.masteryWinner.padEnd(11)} |`,
        );
      }

      // Statistics
      const exposureAdaptiveWins = results.filter(
        (r) => r.exposureWinner === "adaptive",
      ).length;
      const exposureClassicWins = results.filter(
        (r) => r.exposureWinner === "classic",
      ).length;
      const exposureTies = results.filter(
        (r) => r.exposureWinner === "tie",
      ).length;

      const masteryAdaptiveWins = results.filter(
        (r) => r.masteryWinner === "adaptive",
      ).length;
      const masteryClassicWins = results.filter(
        (r) => r.masteryWinner === "classic",
      ).length;
      const masteryTies = results.filter(
        (r) => r.masteryWinner === "tie",
      ).length;

      const avgAdaptiveExposure =
        results.reduce((sum, r) => sum + r.adaptiveExposure, 0) /
        results.length;
      const avgClassicExposure =
        results.reduce((sum, r) => sum + r.classicExposure, 0) / results.length;

      const avgAdaptiveMastery =
        results.reduce((sum, r) => sum + r.adaptiveTrueProb, 0) /
        results.length;
      const avgClassicMastery =
        results.reduce((sum, r) => sum + r.classicTrueProb, 0) / results.length;

      console.log(`\n${"=".repeat(60)}`);
      console.log("TOTALS");
      console.log("=".repeat(60));
      console.log(
        `\nExposure: Adaptive wins: ${exposureAdaptiveWins}, Classic wins: ${exposureClassicWins}, Ties: ${exposureTies}`,
      );
      console.log(
        `Mastery:  Adaptive wins: ${masteryAdaptiveWins}, Classic wins: ${masteryClassicWins}, Ties: ${masteryTies}`,
      );
      console.log(
        `\nAvg Deficient Skill Exposure: Adaptive=${avgAdaptiveExposure.toFixed(1)}, Classic=${avgClassicExposure.toFixed(1)}`,
      );
      console.log(
        `Avg Deficient Skill Mastery:  Adaptive=${(avgAdaptiveMastery * 100).toFixed(1)}%, Classic=${(avgClassicMastery * 100).toFixed(1)}%`,
      );

      // Adaptive should give MORE exposure to the deficient skill
      expect(exposureAdaptiveWins).toBeGreaterThanOrEqual(exposureClassicWins);
    }, 1200000);
  });

  describe("Convergence Speed Comparison", () => {
    it("should show adaptive reaches mastery faster than classic", async () => {
      // Test a few profiles to compare convergence speed
      const testProfiles = getRepresentativeProfilesAllLearners().filter(
        (p) =>
          p.skillId.includes("tenComplements") ||
          p.skillId.includes("fiveComplements"),
      );

      const convergenceResults: Array<{
        skillId: string;
        learnerType: LearnerType;
        adaptiveTrajectory: number[];
        classicTrajectory: number[];
        adaptiveSessions50: number | null;
        classicSessions50: number | null;
        adaptiveSessions80: number | null;
        classicSessions80: number | null;
        fasterTo50: "adaptive" | "classic" | "tie" | "neither";
        fasterTo80: "adaptive" | "classic" | "tie" | "neither";
      }> = [];

      for (const {
        skillId,
        learnerType,
        profile,
        practicingSkills,
      } of testProfiles.slice(0, 9)) {
        const skillSlug = skillId.replace(/[^a-zA-Z0-9]/g, "-");

        // Run adaptive mode session by session
        const adaptiveTrajectory: number[] = [];
        {
          const { playerId } = await createTestStudent(
            ephemeralDb.db,
            `conv-adaptive-${learnerType}-${skillSlug}`,
          );
          const rng = new SeededRandom(QUICK_CONFIG.seed);
          const student = new SimulatedStudent(profile, rng);
          student.ensureSkillsTracked(practicingSkills);

          // Record initial mastery (should be 0 for deficient skill)
          adaptiveTrajectory.push(student.getTrueProbability(skillId));

          const config: JourneyConfig = {
            ...QUICK_CONFIG,
            practicingSkills,
            profile,
            mode: "adaptive",
          };

          const runner = new JourneyRunner(
            ephemeralDb.db,
            student,
            config,
            rng,
            playerId,
          );
          await runner.run();

          // We need per-session tracking, so let's just record final and interpolate
          // Actually, let's track exposure growth instead
          adaptiveTrajectory.push(student.getTrueProbability(skillId));
        }

        // Run classic mode session by session
        const classicTrajectory: number[] = [];
        {
          const { playerId } = await createTestStudent(
            ephemeralDb.db,
            `conv-classic-${learnerType}-${skillSlug}`,
          );
          const rng = new SeededRandom(QUICK_CONFIG.seed);
          const student = new SimulatedStudent(profile, rng);
          student.ensureSkillsTracked(practicingSkills);

          classicTrajectory.push(student.getTrueProbability(skillId));

          const config: JourneyConfig = {
            ...QUICK_CONFIG,
            practicingSkills,
            profile,
            mode: "classic",
          };

          const runner = new JourneyRunner(
            ephemeralDb.db,
            student,
            config,
            rng,
            playerId,
          );
          await runner.run();

          classicTrajectory.push(student.getTrueProbability(skillId));
        }

        // For proper convergence tracking, we need session-by-session data
        // Let's run a custom loop that tracks after each session
        const adaptivePerSession: number[] = [];
        const classicPerSession: number[] = [];

        // Adaptive per-session tracking
        {
          const { playerId } = await createTestStudent(
            ephemeralDb.db,
            `conv2-adaptive-${learnerType}-${skillSlug}`,
          );
          const rng = new SeededRandom(QUICK_CONFIG.seed);
          const student = new SimulatedStudent(profile, rng);
          student.ensureSkillsTracked(practicingSkills);

          adaptivePerSession.push(student.getTrueProbability(skillId));

          // Run sessions one at a time
          for (let s = 0; s < QUICK_CONFIG.sessionCount; s++) {
            const sessionConfig: JourneyConfig = {
              ...QUICK_CONFIG,
              sessionCount: 1, // Run single session
              practicingSkills,
              profile,
              mode: "adaptive",
            };
            const runner = new JourneyRunner(
              ephemeralDb.db,
              student,
              sessionConfig,
              rng,
              playerId,
            );
            await runner.run();
            adaptivePerSession.push(student.getTrueProbability(skillId));
          }
        }

        // Classic per-session tracking
        {
          const { playerId } = await createTestStudent(
            ephemeralDb.db,
            `conv2-classic-${learnerType}-${skillSlug}`,
          );
          const rng = new SeededRandom(QUICK_CONFIG.seed);
          const student = new SimulatedStudent(profile, rng);
          student.ensureSkillsTracked(practicingSkills);

          classicPerSession.push(student.getTrueProbability(skillId));

          for (let s = 0; s < QUICK_CONFIG.sessionCount; s++) {
            const sessionConfig: JourneyConfig = {
              ...QUICK_CONFIG,
              sessionCount: 1,
              practicingSkills,
              profile,
              mode: "classic",
            };
            const runner = new JourneyRunner(
              ephemeralDb.db,
              student,
              sessionConfig,
              rng,
              playerId,
            );
            await runner.run();
            classicPerSession.push(student.getTrueProbability(skillId));
          }
        }

        // Find sessions to reach thresholds
        const findSessionToReach = (
          trajectory: number[],
          threshold: number,
        ): number | null => {
          for (let i = 0; i < trajectory.length; i++) {
            if (trajectory[i] >= threshold) return i;
          }
          return null;
        };

        const adaptiveSessions50 = findSessionToReach(adaptivePerSession, 0.5);
        const classicSessions50 = findSessionToReach(classicPerSession, 0.5);
        const adaptiveSessions80 = findSessionToReach(adaptivePerSession, 0.8);
        const classicSessions80 = findSessionToReach(classicPerSession, 0.8);

        const fasterTo50 =
          adaptiveSessions50 === null && classicSessions50 === null
            ? "neither"
            : adaptiveSessions50 === null
              ? "classic"
              : classicSessions50 === null
                ? "adaptive"
                : adaptiveSessions50 < classicSessions50
                  ? "adaptive"
                  : adaptiveSessions50 > classicSessions50
                    ? "classic"
                    : "tie";

        const fasterTo80 =
          adaptiveSessions80 === null && classicSessions80 === null
            ? "neither"
            : adaptiveSessions80 === null
              ? "classic"
              : classicSessions80 === null
                ? "adaptive"
                : adaptiveSessions80 < classicSessions80
                  ? "adaptive"
                  : adaptiveSessions80 > classicSessions80
                    ? "classic"
                    : "tie";

        convergenceResults.push({
          skillId,
          learnerType,
          adaptiveTrajectory: adaptivePerSession,
          classicTrajectory: classicPerSession,
          adaptiveSessions50,
          classicSessions50,
          adaptiveSessions80,
          classicSessions80,
          fasterTo50,
          fasterTo80,
        });
      }

      // Output convergence table
      console.log(`\n${"=".repeat(130)}`);
      console.log("CONVERGENCE SPEED: Sessions to Reach Mastery Thresholds");
      console.log("=".repeat(130));
      console.log(
        "\n| Learner  | Deficient Skill                | A→50% | C→50% | Faster50 | A→80% | C→80% | Faster80 | A.Final | C.Final |",
      );
      console.log(
        "|----------|--------------------------------|-------|-------|----------|-------|-------|----------|---------|---------|",
      );

      for (const r of convergenceResults) {
        const aFinal = r.adaptiveTrajectory[r.adaptiveTrajectory.length - 1];
        const cFinal = r.classicTrajectory[r.classicTrajectory.length - 1];
        console.log(
          `| ${r.learnerType.padEnd(8)} | ${r.skillId.padEnd(30)} | ${(r.adaptiveSessions50?.toString() ?? "-").padStart(5)} | ${(r.classicSessions50?.toString() ?? "-").padStart(5)} | ${r.fasterTo50.padEnd(8)} | ${(r.adaptiveSessions80?.toString() ?? "-").padStart(5)} | ${(r.classicSessions80?.toString() ?? "-").padStart(5)} | ${r.fasterTo80.padEnd(8)} | ${(aFinal * 100).toFixed(0).padStart(6)}% | ${(cFinal * 100).toFixed(0).padStart(6)}% |`,
        );
      }

      // Show trajectory for one example
      const example = convergenceResults[0];
      if (example) {
        console.log(
          `\n--- Example Trajectory: ${example.skillId} (${example.learnerType}) ---`,
        );
        console.log("Session | Adaptive | Classic");
        for (let i = 0; i < example.adaptiveTrajectory.length; i++) {
          console.log(
            `   ${i.toString().padStart(2)}   |   ${(example.adaptiveTrajectory[i] * 100).toFixed(0).padStart(3)}%   |   ${(example.classicTrajectory[i] * 100).toFixed(0).padStart(3)}%`,
          );
        }
      }

      // Statistics
      const faster50Adaptive = convergenceResults.filter(
        (r) => r.fasterTo50 === "adaptive",
      ).length;
      const faster50Classic = convergenceResults.filter(
        (r) => r.fasterTo50 === "classic",
      ).length;
      const faster80Adaptive = convergenceResults.filter(
        (r) => r.fasterTo80 === "adaptive",
      ).length;
      const faster80Classic = convergenceResults.filter(
        (r) => r.fasterTo80 === "classic",
      ).length;

      console.log(`\n${"=".repeat(60)}`);
      console.log("TOTALS");
      console.log("=".repeat(60));
      console.log(
        `\nFaster to 50%: Adaptive=${faster50Adaptive}, Classic=${faster50Classic}`,
      );
      console.log(
        `Faster to 80%: Adaptive=${faster80Adaptive}, Classic=${faster80Classic}`,
      );

      // Adaptive should reach thresholds faster
      expect(faster50Adaptive + faster80Adaptive).toBeGreaterThanOrEqual(
        faster50Classic + faster80Classic,
      );
    }, 1800000); // 30 min timeout
  });

  describe("3-Way Comparison: Learning Rate vs Fatigue", () => {
    /**
     * Compares three modes:
     * - classic: No BKT targeting, discrete cost multipliers (practicing/not_practicing)
     * - adaptive: BKT skill targeting, discrete cost multipliers
     * - adaptive-bkt: BKT skill targeting, BKT-based continuous cost multipliers
     *
     * Metrics:
     * - Learning rate: Sessions to reach 50%/80% mastery on deficient skill
     * - Fatigue: Total cognitive load during practice (lower = better)
     *
     * Hypothesis:
     * - adaptive-bkt should have similar learning rate to adaptive
     * - adaptive-bkt should have LOWER fatigue (more accurate budgeting)
     */
    it("should compare learning rate and fatigue across 3 modes", async () => {
      const testProfiles = getRepresentativeProfilesAllLearners().filter(
        (p) =>
          p.skillId.includes("fiveComplements") && p.learnerType === "fast",
      );

      type ModeType = "classic" | "adaptive" | "adaptive-bkt";
      const modes: ModeType[] = ["classic", "adaptive", "adaptive-bkt"];

      const results: Array<{
        skillId: string;
        learnerType: LearnerType;
        mode: ModeType;
        sessionsTo50: number | null;
        sessionsTo80: number | null;
        finalMastery: number;
        totalFatigue: number;
        avgFatiguePerSession: number;
      }> = [];

      for (const {
        skillId,
        learnerType,
        profile,
        practicingSkills,
      } of testProfiles.slice(0, 3)) {
        for (const mode of modes) {
          const skillSlug = skillId.replace(/[^a-zA-Z0-9]/g, "-");
          const { playerId } = await createTestStudent(
            ephemeralDb.db,
            `3way-${mode}-${learnerType}-${skillSlug}`,
          );

          const rng = new SeededRandom(QUICK_CONFIG.seed);
          const student = new SimulatedStudent(profile, rng);
          student.ensureSkillsTracked(practicingSkills);

          // Track per-session mastery
          const masteryPerSession: number[] = [
            student.getTrueProbability(skillId),
          ];

          // Run sessions one at a time to track trajectory
          for (let s = 0; s < QUICK_CONFIG.sessionCount; s++) {
            const sessionConfig: JourneyConfig = {
              ...QUICK_CONFIG,
              sessionCount: 1,
              practicingSkills,
              profile,
              mode,
            };
            const runner = new JourneyRunner(
              ephemeralDb.db,
              student,
              sessionConfig,
              rng,
              playerId,
            );
            await runner.run();
            masteryPerSession.push(student.getTrueProbability(skillId));
          }

          // Run full journey for fatigue metrics
          const { playerId: fullPlayerId } = await createTestStudent(
            ephemeralDb.db,
            `3way-full-${mode}-${learnerType}-${skillSlug}`,
          );
          const fullRng = new SeededRandom(QUICK_CONFIG.seed);
          const fullStudent = new SimulatedStudent(profile, fullRng);
          fullStudent.ensureSkillsTracked(practicingSkills);

          const fullConfig: JourneyConfig = {
            ...QUICK_CONFIG,
            practicingSkills,
            profile,
            mode,
          };
          const fullRunner = new JourneyRunner(
            ephemeralDb.db,
            fullStudent,
            fullConfig,
            fullRng,
            fullPlayerId,
          );
          const fullResult = await fullRunner.run();

          // Find sessions to reach thresholds
          let sessionsTo50: number | null = null;
          let sessionsTo80: number | null = null;
          for (let i = 0; i < masteryPerSession.length; i++) {
            if (sessionsTo50 === null && masteryPerSession[i] >= 0.5) {
              sessionsTo50 = i;
            }
            if (sessionsTo80 === null && masteryPerSession[i] >= 0.8) {
              sessionsTo80 = i;
            }
          }

          results.push({
            skillId,
            learnerType,
            mode,
            sessionsTo50,
            sessionsTo80,
            finalMastery: masteryPerSession[masteryPerSession.length - 1],
            totalFatigue: fullResult.finalMetrics.totalFatigue,
            avgFatiguePerSession: fullResult.finalMetrics.avgFatiguePerSession,
          });
        }
      }

      // Output results table
      console.log(`\n${"=".repeat(140)}`);
      console.log("3-WAY COMPARISON: Learning Rate vs Fatigue");
      console.log("=".repeat(140));
      console.log(
        "\n| Skill                          | Mode         | →50% | →80% | Final | TotalFatigue | AvgFatigue |",
      );
      console.log(
        "|--------------------------------|--------------|------|------|-------|--------------|------------|",
      );

      for (const r of results) {
        console.log(
          `| ${r.skillId.padEnd(30)} | ${r.mode.padEnd(12)} | ${(r.sessionsTo50?.toString() ?? "-").padStart(4)} | ${(r.sessionsTo80?.toString() ?? "-").padStart(4)} | ${(r.finalMastery * 100).toFixed(0).padStart(4)}% | ${r.totalFatigue.toFixed(1).padStart(12)} | ${r.avgFatiguePerSession.toFixed(1).padStart(10)} |`,
        );
      }

      // Group by skill and compare modes
      const skills = [...new Set(results.map((r) => r.skillId))];

      console.log(`\n${"=".repeat(80)}`);
      console.log("COMPARISON BY SKILL");
      console.log("=".repeat(80));

      for (const skillId of skills) {
        const skillResults = results.filter((r) => r.skillId === skillId);
        const classic = skillResults.find((r) => r.mode === "classic")!;
        const adaptive = skillResults.find((r) => r.mode === "adaptive")!;
        const adaptiveBkt = skillResults.find(
          (r) => r.mode === "adaptive-bkt",
        )!;

        console.log(`\n${skillId}:`);
        console.log(`  Learning (sessions to 80%):`);
        console.log(`    classic:      ${classic.sessionsTo80 ?? "never"}`);
        console.log(`    adaptive:     ${adaptive.sessionsTo80 ?? "never"}`);
        console.log(`    adaptive-bkt: ${adaptiveBkt.sessionsTo80 ?? "never"}`);
        console.log(`  Fatigue (avg per session):`);
        console.log(
          `    classic:      ${classic.avgFatiguePerSession.toFixed(1)}`,
        );
        console.log(
          `    adaptive:     ${adaptive.avgFatiguePerSession.toFixed(1)}`,
        );
        console.log(
          `    adaptive-bkt: ${adaptiveBkt.avgFatiguePerSession.toFixed(1)}`,
        );

        // Calculate improvement
        const learningImprovementAdaptive =
          classic.sessionsTo80 && adaptive.sessionsTo80
            ? ((classic.sessionsTo80 - adaptive.sessionsTo80) /
                classic.sessionsTo80) *
              100
            : null;
        const learningImprovementBkt =
          classic.sessionsTo80 && adaptiveBkt.sessionsTo80
            ? ((classic.sessionsTo80 - adaptiveBkt.sessionsTo80) /
                classic.sessionsTo80) *
              100
            : null;
        const fatigueReductionAdaptive =
          ((classic.avgFatiguePerSession - adaptive.avgFatiguePerSession) /
            classic.avgFatiguePerSession) *
          100;
        const fatigueReductionBkt =
          ((classic.avgFatiguePerSession - adaptiveBkt.avgFatiguePerSession) /
            classic.avgFatiguePerSession) *
          100;

        console.log(`  vs classic:`);
        console.log(
          `    adaptive:     ${learningImprovementAdaptive?.toFixed(0) ?? "N/A"}% faster learning, ${fatigueReductionAdaptive.toFixed(1)}% fatigue change`,
        );
        console.log(
          `    adaptive-bkt: ${learningImprovementBkt?.toFixed(0) ?? "N/A"}% faster learning, ${fatigueReductionBkt.toFixed(1)}% fatigue change`,
        );
      }

      // Summary statistics
      const classicResults = results.filter((r) => r.mode === "classic");
      const adaptiveResults = results.filter((r) => r.mode === "adaptive");
      const adaptiveBktResults = results.filter(
        (r) => r.mode === "adaptive-bkt",
      );

      const avgFatigueClassic =
        classicResults.reduce((sum, r) => sum + r.avgFatiguePerSession, 0) /
        classicResults.length;
      const avgFatigueAdaptive =
        adaptiveResults.reduce((sum, r) => sum + r.avgFatiguePerSession, 0) /
        adaptiveResults.length;
      const avgFatigueBkt =
        adaptiveBktResults.reduce((sum, r) => sum + r.avgFatiguePerSession, 0) /
        adaptiveBktResults.length;

      console.log(`\n${"=".repeat(60)}`);
      console.log("SUMMARY");
      console.log("=".repeat(60));
      console.log(`\nAverage Fatigue Per Session:`);
      console.log(`  classic:      ${avgFatigueClassic.toFixed(1)}`);
      console.log(`  adaptive:     ${avgFatigueAdaptive.toFixed(1)}`);
      console.log(`  adaptive-bkt: ${avgFatigueBkt.toFixed(1)}`);

      // Both adaptive modes should have reasonable learning rates
      // adaptive-bkt should have lower or equal fatigue compared to adaptive
      expect(avgFatigueBkt).toBeLessThanOrEqual(avgFatigueAdaptive * 1.1); // Allow 10% margin
    }, 1800000); // 30 min timeout
  });
});

/**
 * Full comprehensive test (run separately due to time)
 *
 * This tests ALL 32 skills × 3 learner types = 96 profiles with full configuration.
 * Each profile runs adaptive vs classic = 192 total journeys.
 *
 * Run with: npx vitest run comprehensive-ab-test.test.ts --testNamePattern="Full 32-Skill"
 */
describe("Full 32-Skill A/B Test - All Learner Types", () => {
  let ephemeralDb: EphemeralDbResult;

  beforeEach(() => {
    ephemeralDb = createEphemeralDatabase();
    setCurrentEphemeralDb(ephemeralDb.db);
  });

  afterEach(() => {
    setCurrentEphemeralDb(null);
    ephemeralDb.cleanup();
  });

  const learnerTypes: LearnerType[] = ["fast", "average", "slow"];

  for (const learnerType of learnerTypes) {
    describe(`${LEARNER_TYPES[learnerType].name}`, () => {
      for (const skillId of SKILL_ORDER) {
        it(`[${learnerType}] ${skillId}: Comprehensive comparison`, async () => {
          const profile = generateDeficientProfile(skillId, learnerType);
          const practicingSkills = getPracticingSkillsForDeficiency(skillId);
          const skillSlug = skillId.replace(/[^a-zA-Z0-9]/g, "-");

          const { playerId: adaptivePlayerId } = await createTestStudent(
            ephemeralDb.db,
            `full-adaptive-${learnerType}-${skillSlug}`,
          );
          const { playerId: classicPlayerId } = await createTestStudent(
            ephemeralDb.db,
            `full-classic-${learnerType}-${skillSlug}`,
          );

          const baseConfig = {
            ...COMPREHENSIVE_CONFIG,
            practicingSkills,
          };

          // Adaptive
          const adaptiveConfig: JourneyConfig = {
            ...baseConfig,
            profile,
            mode: "adaptive",
          };
          const adaptiveRng = new SeededRandom(baseConfig.seed);
          const adaptiveResult = await new JourneyRunner(
            ephemeralDb.db,
            new SimulatedStudent(profile, adaptiveRng),
            adaptiveConfig,
            adaptiveRng,
            adaptivePlayerId,
          ).run();

          // Classic
          const classicConfig: JourneyConfig = {
            ...baseConfig,
            profile,
            mode: "classic",
          };
          const classicRng = new SeededRandom(baseConfig.seed);
          const classicResult = await new JourneyRunner(
            ephemeralDb.db,
            new SimulatedStudent(profile, classicRng),
            classicConfig,
            classicRng,
            classicPlayerId,
          ).run();

          const adaptiveFinal =
            adaptiveResult.snapshots[adaptiveResult.snapshots.length - 1]
              .accuracy;
          const classicFinal =
            classicResult.snapshots[classicResult.snapshots.length - 1]
              .accuracy;
          const winner =
            adaptiveFinal > classicFinal
              ? "ADAPTIVE"
              : adaptiveFinal < classicFinal
                ? "CLASSIC"
                : "TIE";

          console.log(
            `[${learnerType}] ${skillId}: Adaptive=${(adaptiveFinal * 100).toFixed(1)}% Classic=${(classicFinal * 100).toFixed(1)}% → ${winner}`,
          );
        }, 600000); // 10 minute timeout per skill
      }
    });
  }
});

/**
 * Aggregate Summary Test
 *
 * Runs ALL 96 profiles and produces a comprehensive summary table.
 * Run with: npx vitest run comprehensive-ab-test.test.ts --testNamePattern="Aggregate Summary"
 */
describe("Aggregate Summary: Full 32-Skill × 3 Learner Types", () => {
  let ephemeralDb: EphemeralDbResult;

  beforeEach(() => {
    ephemeralDb = createEphemeralDatabase();
    setCurrentEphemeralDb(ephemeralDb.db);
  });

  afterEach(() => {
    setCurrentEphemeralDb(null);
    ephemeralDb.cleanup();
  });

  it("should output comprehensive comparison across all skills and learner types", async () => {
    const learnerTypes: LearnerType[] = ["fast", "average", "slow"];
    const results: Array<{
      skillId: string;
      learnerType: LearnerType;
      adaptiveFinal: number;
      classicFinal: number;
      winner: "adaptive" | "classic" | "tie";
    }> = [];

    let completed = 0;
    const total = SKILL_ORDER.length * learnerTypes.length;

    for (const learnerType of learnerTypes) {
      for (const skillId of SKILL_ORDER) {
        const profile = generateDeficientProfile(skillId, learnerType);
        const practicingSkills = getPracticingSkillsForDeficiency(skillId);
        const skillSlug = skillId.replace(/[^a-zA-Z0-9]/g, "-");

        const { playerId: adaptivePlayerId } = await createTestStudent(
          ephemeralDb.db,
          `agg-adaptive-${learnerType}-${skillSlug}`,
        );
        const { playerId: classicPlayerId } = await createTestStudent(
          ephemeralDb.db,
          `agg-classic-${learnerType}-${skillSlug}`,
        );

        const baseConfig = {
          ...COMPREHENSIVE_CONFIG,
          practicingSkills,
        };

        // Adaptive
        const adaptiveConfig: JourneyConfig = {
          ...baseConfig,
          profile,
          mode: "adaptive",
        };
        const adaptiveRng = new SeededRandom(baseConfig.seed);
        const adaptiveResult = await new JourneyRunner(
          ephemeralDb.db,
          new SimulatedStudent(profile, adaptiveRng),
          adaptiveConfig,
          adaptiveRng,
          adaptivePlayerId,
        ).run();

        // Classic
        const classicConfig: JourneyConfig = {
          ...baseConfig,
          profile,
          mode: "classic",
        };
        const classicRng = new SeededRandom(baseConfig.seed);
        const classicResult = await new JourneyRunner(
          ephemeralDb.db,
          new SimulatedStudent(profile, classicRng),
          classicConfig,
          classicRng,
          classicPlayerId,
        ).run();

        const adaptiveFinal =
          adaptiveResult.snapshots[adaptiveResult.snapshots.length - 1]
            .accuracy;
        const classicFinal =
          classicResult.snapshots[classicResult.snapshots.length - 1].accuracy;

        results.push({
          skillId,
          learnerType,
          adaptiveFinal,
          classicFinal,
          winner:
            adaptiveFinal > classicFinal
              ? "adaptive"
              : adaptiveFinal < classicFinal
                ? "classic"
                : "tie",
        });

        completed++;
        console.log(
          `Progress: ${completed}/${total} (${((completed / total) * 100).toFixed(1)}%)`,
        );
      }
    }

    // Output comprehensive summary table
    console.log(`\n${"=".repeat(100)}`);
    console.log(
      "COMPREHENSIVE SUMMARY: 32 Skills × 3 Learner Types = 96 Profiles",
    );
    console.log("=".repeat(100));
    console.log(
      "\n| Learner  | Skill ID                       | Adaptive | Classic | Diff   | Winner   |",
    );
    console.log(
      "|----------|--------------------------------|----------|---------|--------|----------|",
    );

    for (const r of results) {
      const diff = ((r.adaptiveFinal - r.classicFinal) * 100).toFixed(1);
      const diffStr =
        r.adaptiveFinal >= r.classicFinal ? `+${diff}%` : `${diff}%`;
      console.log(
        `| ${r.learnerType.padEnd(8)} | ${r.skillId.padEnd(30)} | ${(r.adaptiveFinal * 100).toFixed(1).padStart(6)}% | ${(r.classicFinal * 100).toFixed(1).padStart(5)}% | ${diffStr.padStart(6)} | ${r.winner.padEnd(8)} |`,
      );
    }

    // Statistics
    const adaptiveWins = results.filter((r) => r.winner === "adaptive").length;
    const classicWins = results.filter((r) => r.winner === "classic").length;
    const ties = results.filter((r) => r.winner === "tie").length;

    // Group by learner type
    const byLearner = {
      fast: results.filter((r) => r.learnerType === "fast"),
      average: results.filter((r) => r.learnerType === "average"),
      slow: results.filter((r) => r.learnerType === "slow"),
    };

    console.log(`\n${"=".repeat(60)}`);
    console.log("TOTALS");
    console.log("=".repeat(60));
    console.log(
      `\nOverall: Adaptive wins: ${adaptiveWins}, Classic wins: ${classicWins}, Ties: ${ties}`,
    );
    console.log(
      `Win rate: Adaptive ${((adaptiveWins / results.length) * 100).toFixed(1)}%, Classic ${((classicWins / results.length) * 100).toFixed(1)}%`,
    );

    console.log("\nBy Learner Type:");
    for (const [type, typeResults] of Object.entries(byLearner)) {
      const aWins = typeResults.filter((r) => r.winner === "adaptive").length;
      const cWins = typeResults.filter((r) => r.winner === "classic").length;
      const tWins = typeResults.filter((r) => r.winner === "tie").length;
      const avgAdaptive =
        typeResults.reduce((sum, r) => sum + r.adaptiveFinal, 0) /
        typeResults.length;
      const avgClassic =
        typeResults.reduce((sum, r) => sum + r.classicFinal, 0) /
        typeResults.length;
      console.log(
        `  ${type.padEnd(8)}: Adaptive wins: ${aWins}, Classic wins: ${cWins}, Ties: ${tWins} | Avg: Adaptive ${(avgAdaptive * 100).toFixed(1)}%, Classic ${(avgClassic * 100).toFixed(1)}%`,
      );
    }

    // BKT should help in majority of cases
    expect(adaptiveWins).toBeGreaterThanOrEqual(classicWins);
  }, 7200000); // 2 hour timeout for full comprehensive test (96 profiles)
});
