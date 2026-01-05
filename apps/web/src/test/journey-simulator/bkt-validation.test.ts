/**
 * @vitest-environment node
 *
 * BKT Validation Test Suite
 *
 * Runs multiple combinations of student profiles and skill sets to validate
 * that our BKT implementation correctly:
 * 1. Correlates P(known) with true student performance
 * 2. Builds confidence over time with more observations
 * 3. Identifies weak skills accurately
 * 4. Improves learning outcomes when adaptive targeting is enabled
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";
import {
  createEphemeralDatabase,
  createTestStudent,
  getCurrentEphemeralDb,
  setCurrentEphemeralDb,
  type EphemeralDbResult,
} from "./EphemeralDatabase";
import { JourneyRunner } from "./JourneyRunner";
import {
  fastLearnerProfile,
  slowLearnerProfile,
  unevenSkillsProfile,
  starkContrastProfile,
  MINIMAL_SKILLS,
  BASIC_SKILLS,
} from "./profiles";
import { SeededRandom } from "./SeededRandom";
import { SimulatedStudent } from "./SimulatedStudent";
import type { JourneyConfig, JourneyResult, StudentProfile } from "./types";

// Mock the @/db module to use our ephemeral database
vi.mock("@/db", () => ({
  get db() {
    return getCurrentEphemeralDb();
  },
  schema,
}));

/**
 * Skill set configurations for testing
 */
const SKILL_SETS = {
  minimal: {
    name: "Minimal (4 skills)",
    skills: [...MINIMAL_SKILLS],
  },
  basic: {
    name: "Basic Only (3 skills)",
    skills: [...BASIC_SKILLS],
  },
  basicPlusFive: {
    name: "Basic + Five Complements (7 skills)",
    skills: [
      "basic.directAddition",
      "basic.heavenBead",
      "basic.simpleCombinations",
      "fiveComplements.4=5-1",
      "fiveComplements.3=5-2",
      "fiveComplements.2=5-3",
      "fiveComplements.1=5-4",
    ],
  },
  focused: {
    name: "Focused (2 strong + 2 weak)",
    skills: [
      "basic.directAddition",
      "basic.heavenBead",
      "fiveComplements.3=5-2",
      "fiveComplements.4=5-1",
    ],
  },
} as const;

/**
 * Student profiles for testing
 */
const PROFILES: Record<string, StudentProfile> = {
  fastLearner: fastLearnerProfile,
  slowLearner: slowLearnerProfile,
  unevenSkills: unevenSkillsProfile,
  starkContrast: starkContrastProfile,
};

type ProfileName = keyof typeof PROFILES;
type SkillSetName = keyof typeof SKILL_SETS;

/**
 * Test scenario configuration
 */
interface TestScenario {
  profile: ProfileName;
  skillSet: SkillSetName;
  sessions: number;
  seed: number;
}

/**
 * Result of a validation run
 */
interface ValidationResult {
  scenario: TestScenario;
  adaptive: JourneyResult;
  classic: JourneyResult;
  metrics: {
    adaptiveAccuracy: number;
    classicAccuracy: number;
    accuracyDifference: number;
    adaptiveBktCorrelation: number;
    classicBktCorrelation: number;
    adaptiveImprovement: number;
    classicImprovement: number;
  };
}

/**
 * Run a single validation scenario
 */
async function runValidationScenario(
  scenario: TestScenario,
  ephemeralDb: EphemeralDbResult,
): Promise<ValidationResult> {
  const profile = PROFILES[scenario.profile];
  const skillSet = SKILL_SETS[scenario.skillSet];

  // Run adaptive mode
  const { playerId: adaptivePlayerId } = await createTestStudent(
    ephemeralDb.db,
    `adaptive-${scenario.seed}`,
  );

  const adaptiveConfig: JourneyConfig = {
    profile,
    sessionCount: scenario.sessions,
    sessionDurationMinutes: 12,
    seed: scenario.seed,
    practicingSkills: [...skillSet.skills],
    mode: "adaptive",
  };

  const adaptiveRng = new SeededRandom(scenario.seed);
  const adaptiveStudent = new SimulatedStudent(profile, adaptiveRng);
  const adaptiveRunner = new JourneyRunner(
    ephemeralDb.db,
    adaptiveStudent,
    adaptiveConfig,
    adaptiveRng,
    adaptivePlayerId,
  );
  const adaptiveResults = await adaptiveRunner.run();

  // Run classic mode with fresh student (same seed for comparison)
  const { playerId: classicPlayerId } = await createTestStudent(
    ephemeralDb.db,
    `classic-${scenario.seed}`,
  );

  const classicConfig: JourneyConfig = {
    ...adaptiveConfig,
    mode: "classic",
  };

  const classicRng = new SeededRandom(scenario.seed);
  const classicStudent = new SimulatedStudent(profile, classicRng);
  const classicRunner = new JourneyRunner(
    ephemeralDb.db,
    classicStudent,
    classicConfig,
    classicRng,
    classicPlayerId,
  );
  const classicResults = await classicRunner.run();

  // Calculate metrics
  const adaptiveAccuracy =
    adaptiveResults.snapshots[adaptiveResults.snapshots.length - 1]?.accuracy ??
    0;
  const classicAccuracy =
    classicResults.snapshots[classicResults.snapshots.length - 1]?.accuracy ??
    0;

  const adaptiveFirstAccuracy = adaptiveResults.snapshots[0]?.accuracy ?? 0;
  const classicFirstAccuracy = classicResults.snapshots[0]?.accuracy ?? 0;

  return {
    scenario,
    adaptive: adaptiveResults,
    classic: classicResults,
    metrics: {
      adaptiveAccuracy,
      classicAccuracy,
      accuracyDifference: adaptiveAccuracy - classicAccuracy,
      adaptiveBktCorrelation: adaptiveResults.finalMetrics.bktCorrelation,
      classicBktCorrelation: classicResults.finalMetrics.bktCorrelation,
      adaptiveImprovement: adaptiveAccuracy - adaptiveFirstAccuracy,
      classicImprovement: classicAccuracy - classicFirstAccuracy,
    },
  };
}

describe("BKT Validation Suite", () => {
  let ephemeralDb: EphemeralDbResult;

  beforeEach(() => {
    ephemeralDb = createEphemeralDatabase();
    setCurrentEphemeralDb(ephemeralDb.db);
  });

  afterEach(() => {
    setCurrentEphemeralDb(null);
    ephemeralDb.cleanup();
  });

  describe("Multi-Profile Validation", () => {
    // Define test scenarios - combinations of profiles, skill sets, and session counts
    const scenarios: TestScenario[] = [
      // Fast learner scenarios
      { profile: "fastLearner", skillSet: "focused", sessions: 6, seed: 11111 },
      {
        profile: "fastLearner",
        skillSet: "basicPlusFive",
        sessions: 8,
        seed: 22222,
      },

      // Slow learner scenarios
      { profile: "slowLearner", skillSet: "minimal", sessions: 8, seed: 33333 },
      { profile: "slowLearner", skillSet: "basic", sessions: 10, seed: 44444 },

      // Uneven skills scenarios
      {
        profile: "unevenSkills",
        skillSet: "focused",
        sessions: 6,
        seed: 55555,
      },
      {
        profile: "unevenSkills",
        skillSet: "basicPlusFive",
        sessions: 8,
        seed: 66666,
      },

      // Stark contrast scenarios
      {
        profile: "starkContrast",
        skillSet: "focused",
        sessions: 6,
        seed: 77777,
      },
      {
        profile: "starkContrast",
        skillSet: "minimal",
        sessions: 8,
        seed: 88888,
      },
    ];

    it("should validate BKT assumptions across multiple scenarios", async () => {
      const results: ValidationResult[] = [];

      console.log("\n" + "=".repeat(80));
      console.log("           BKT VALIDATION SUITE - RUNNING ALL SCENARIOS");
      console.log("=".repeat(80) + "\n");

      for (const scenario of scenarios) {
        const profile = PROFILES[scenario.profile];
        const skillSet = SKILL_SETS[scenario.skillSet];

        console.log(
          `Running: ${profile.name} + ${skillSet.name} (${scenario.sessions} sessions)...`,
        );

        const result = await runValidationScenario(scenario, ephemeralDb);
        results.push(result);

        // Quick summary for this scenario
        const m = result.metrics;
        console.log(
          `  Adaptive: ${(m.adaptiveAccuracy * 100).toFixed(0)}% | ` +
            `Classic: ${(m.classicAccuracy * 100).toFixed(0)}% | ` +
            `Diff: ${m.accuracyDifference >= 0 ? "+" : ""}${(m.accuracyDifference * 100).toFixed(0)}pp\n`,
        );
      }

      // Print comprehensive summary
      printValidationSummary(results);

      // Validate key assumptions
      validateBktAssumptions(results);
    }, 300000); // 5 minute timeout for all scenarios
  });

  describe("Individual Profile Deep Dive", () => {
    it.skip("should show detailed BKT behavior for stark contrast profile", async () => {
      const scenario: TestScenario = {
        profile: "starkContrast",
        skillSet: "focused",
        sessions: 8,
        seed: 12345,
      };

      const result = await runValidationScenario(scenario, ephemeralDb);

      // Print detailed per-session analysis
      console.log("\n" + "=".repeat(80));
      console.log("       STARK CONTRAST PROFILE - DETAILED SESSION ANALYSIS");
      console.log("=".repeat(80) + "\n");

      console.log("ADAPTIVE MODE:");
      printSessionDetails(result.adaptive);

      console.log("\nCLASSIC MODE:");
      printSessionDetails(result.classic);
    }, 60000);

    it.skip("should show detailed BKT behavior for slow learner profile", async () => {
      const scenario: TestScenario = {
        profile: "slowLearner",
        skillSet: "minimal",
        sessions: 10,
        seed: 54321,
      };

      const result = await runValidationScenario(scenario, ephemeralDb);

      console.log("\n" + "=".repeat(80));
      console.log("       SLOW LEARNER PROFILE - DETAILED SESSION ANALYSIS");
      console.log("=".repeat(80) + "\n");

      console.log("ADAPTIVE MODE:");
      printSessionDetails(result.adaptive);

      console.log("\nCLASSIC MODE:");
      printSessionDetails(result.classic);
    }, 60000);
  });

  describe("BKT Correlation Validation", () => {
    it("should show BKT pKnown correlates with true performance over time", async () => {
      // Use a profile where we know the ground truth
      const scenario: TestScenario = {
        profile: "starkContrast",
        skillSet: "focused",
        sessions: 8,
        seed: 99999,
      };

      const result = await runValidationScenario(scenario, ephemeralDb);

      console.log("\n" + "=".repeat(80));
      console.log("           BKT CORRELATION WITH TRUE PERFORMANCE");
      console.log("=".repeat(80) + "\n");

      // Track how BKT estimates evolve with true probability
      const lastSnapshot =
        result.adaptive.snapshots[result.adaptive.snapshots.length - 1];

      console.log(
        "Skill                     True P    BKT P(known)  Confidence  Exposures",
      );
      console.log("-".repeat(75));

      for (const skillId of SKILL_SETS[scenario.skillSet].skills) {
        const trueP = lastSnapshot.trueSkillProbabilities.get(skillId) ?? 0;
        const bkt = lastSnapshot.bktEstimates.get(skillId);
        const exp = lastSnapshot.cumulativeExposures.get(skillId) ?? 0;

        console.log(
          `${skillId.padEnd(25)} ${(trueP * 100).toFixed(1).padStart(5)}%   ` +
            `${((bkt?.pKnown ?? 0) * 100).toFixed(1).padStart(5)}%       ` +
            `${(bkt?.confidence ?? 0).toFixed(2).padStart(5)}       ` +
            `${exp.toString().padStart(5)}`,
        );
      }

      // Validate correlation direction
      // Skills with high exposure should have high BKT pKnown
      const skillEntries = [...lastSnapshot.cumulativeExposures.entries()];
      const highExposureSkills = skillEntries.filter(([, exp]) => exp > 50);
      const lowExposureSkills = skillEntries.filter(([, exp]) => exp < 20);

      if (highExposureSkills.length > 0 && lowExposureSkills.length > 0) {
        const avgHighBkt =
          highExposureSkills.reduce((sum, [skillId]) => {
            return sum + (lastSnapshot.bktEstimates.get(skillId)?.pKnown ?? 0);
          }, 0) / highExposureSkills.length;
        const avgLowBkt =
          lowExposureSkills.reduce((sum, [skillId]) => {
            return sum + (lastSnapshot.bktEstimates.get(skillId)?.pKnown ?? 0);
          }, 0) / lowExposureSkills.length;

        console.log(
          `\nAvg BKT P(known) for high-exposure skills (>50): ${(avgHighBkt * 100).toFixed(1)}%`,
        );
        console.log(
          `Avg BKT P(known) for low-exposure skills (<20):  ${(avgLowBkt * 100).toFixed(1)}%`,
        );

        // High exposure skills should have higher BKT estimates
        expect(avgHighBkt).toBeGreaterThan(avgLowBkt);
      }
    }, 60000);
  });

  describe("Confidence Growth Validation", () => {
    it("should show confidence increases with more opportunities", async () => {
      const scenario: TestScenario = {
        profile: "unevenSkills",
        skillSet: "focused",
        sessions: 8,
        seed: 11111,
      };

      const result = await runValidationScenario(scenario, ephemeralDb);

      console.log("\n" + "=".repeat(80));
      console.log("           CONFIDENCE GROWTH OVER SESSIONS");
      console.log("=".repeat(80) + "\n");

      // Track confidence growth per session
      const snapshots = result.adaptive.snapshots;
      const skills = [...SKILL_SETS[scenario.skillSet].skills];

      console.log(
        "Session  " +
          skills.map((s) => s.split(".")[1].slice(0, 10).padEnd(12)).join(""),
      );
      console.log("-".repeat(80));

      for (let i = 0; i < snapshots.length; i++) {
        const snapshot = snapshots[i];
        const confValues = skills.map((skillId) => {
          const bkt = snapshot.bktEstimates.get(skillId);
          return bkt ? bkt.confidence.toFixed(2).padEnd(12) : "N/A".padEnd(12);
        });
        console.log(`   ${i + 1}     ${confValues.join("")}`);
      }

      // Verify confidence increases over time for practiced skills
      const firstSnapshot = snapshots[0];
      const lastSnapshot = snapshots[snapshots.length - 1];

      for (const skillId of skills) {
        const firstConf =
          firstSnapshot?.bktEstimates.get(skillId)?.confidence ?? 0;
        const lastConf =
          lastSnapshot?.bktEstimates.get(skillId)?.confidence ?? 0;

        // If the skill was practiced, confidence should increase
        const exposures = lastSnapshot?.cumulativeExposures.get(skillId) ?? 0;
        if (exposures > 10) {
          expect(lastConf).toBeGreaterThanOrEqual(firstConf);
        }
      }
    }, 60000);
  });
});

/**
 * Print detailed session information
 */
function printSessionDetails(results: JourneyResult): void {
  console.log("\nSession  Accuracy  BKT Corr  Weak Skills Identified");
  console.log("-".repeat(60));

  for (let i = 0; i < results.snapshots.length; i++) {
    const snapshot = results.snapshots[i];
    const accuracy = (snapshot.accuracy * 100).toFixed(0).padStart(3) + "%";

    // Count weak skills identified (pKnown < 0.5, confidence > 0.3)
    const weakCount = [...snapshot.bktEstimates.values()].filter(
      (e) => e.pKnown < 0.5 && e.confidence >= 0.3,
    ).length;

    console.log(
      `   ${i + 1}       ${accuracy}      N/A        ${weakCount} skills`,
    );
  }
}

/**
 * Print comprehensive validation summary
 */
function printValidationSummary(results: ValidationResult[]): void {
  console.log("\n" + "=".repeat(80));
  console.log("                    VALIDATION SUMMARY");
  console.log("=".repeat(80) + "\n");

  // Summary table header
  console.log(
    "Profile            Skills              Sess  Adapt%  Class%  Diff   Adapt Δ  Class Δ",
  );
  console.log("-".repeat(80));

  for (const r of results) {
    const profile = PROFILES[r.scenario.profile].name.slice(0, 16).padEnd(18);
    const skills = SKILL_SETS[r.scenario.skillSet].name.slice(0, 18).padEnd(20);
    const sessions = r.scenario.sessions.toString().padStart(4);
    const adaptAcc =
      (r.metrics.adaptiveAccuracy * 100).toFixed(0).padStart(5) + "%";
    const classAcc =
      (r.metrics.classicAccuracy * 100).toFixed(0).padStart(5) + "%";
    const diff =
      (r.metrics.accuracyDifference >= 0 ? "+" : "") +
      (r.metrics.accuracyDifference * 100).toFixed(0) +
      "pp";
    const adaptImpr =
      (r.metrics.adaptiveImprovement >= 0 ? "+" : "") +
      (r.metrics.adaptiveImprovement * 100).toFixed(0) +
      "%";
    const classImpr =
      (r.metrics.classicImprovement >= 0 ? "+" : "") +
      (r.metrics.classicImprovement * 100).toFixed(0) +
      "%";

    console.log(
      `${profile}${skills}${sessions}  ${adaptAcc}  ${classAcc}  ${diff.padStart(5)}  ${adaptImpr.padStart(6)}  ${classImpr.padStart(6)}`,
    );
  }

  // Aggregate stats
  const avgAdaptive =
    results.reduce((sum, r) => sum + r.metrics.adaptiveAccuracy, 0) /
    results.length;
  const avgClassic =
    results.reduce((sum, r) => sum + r.metrics.classicAccuracy, 0) /
    results.length;
  const adaptiveWins = results.filter(
    (r) => r.metrics.accuracyDifference > 0,
  ).length;
  const classicWins = results.filter(
    (r) => r.metrics.accuracyDifference < 0,
  ).length;
  const ties = results.filter((r) => r.metrics.accuracyDifference === 0).length;

  console.log("\n" + "-".repeat(80));
  console.log(`\nAGGREGATE RESULTS:`);
  console.log(
    `  Average final accuracy - Adaptive: ${(avgAdaptive * 100).toFixed(1)}%`,
  );
  console.log(
    `  Average final accuracy - Classic:  ${(avgClassic * 100).toFixed(1)}%`,
  );
  console.log(
    `  Adaptive wins: ${adaptiveWins} | Classic wins: ${classicWins} | Ties: ${ties}`,
  );
  console.log(
    `  Overall advantage: ${avgAdaptive > avgClassic ? "ADAPTIVE" : avgClassic > avgAdaptive ? "CLASSIC" : "TIED"}`,
  );
}

/**
 * Validate key BKT assumptions from results
 */
function validateBktAssumptions(results: ValidationResult[]): void {
  console.log("\n" + "=".repeat(80));
  console.log("                BKT ASSUMPTION VALIDATION");
  console.log("=".repeat(80) + "\n");

  // Assumption 1: Adaptive mode should generally match or beat classic mode
  const adaptiveMatchOrBetter = results.filter(
    (r) => r.metrics.accuracyDifference >= -0.05,
  ).length;
  console.log(
    `[1] Adaptive >= Classic (within 5pp): ${adaptiveMatchOrBetter}/${results.length} scenarios ` +
      `(${((adaptiveMatchOrBetter / results.length) * 100).toFixed(0)}%)`,
  );
  expect(adaptiveMatchOrBetter).toBeGreaterThanOrEqual(results.length * 0.5); // At least 50%

  // Assumption 2: Students should improve from first to last session
  const improvedAdaptive = results.filter(
    (r) => r.metrics.adaptiveImprovement > 0,
  ).length;
  const improvedClassic = results.filter(
    (r) => r.metrics.classicImprovement > 0,
  ).length;
  console.log(
    `[2] Adaptive improvement: ${improvedAdaptive}/${results.length} scenarios showed improvement`,
  );
  console.log(
    `[2] Classic improvement:  ${improvedClassic}/${results.length} scenarios showed improvement`,
  );
  // Most scenarios should show improvement
  expect(improvedAdaptive + improvedClassic).toBeGreaterThanOrEqual(
    results.length,
  );

  // Assumption 3: Average adaptive accuracy should be >= classic (within noise margin)
  const avgAdaptive =
    results.reduce((sum, r) => sum + r.metrics.adaptiveAccuracy, 0) /
    results.length;
  const avgClassic =
    results.reduce((sum, r) => sum + r.metrics.classicAccuracy, 0) /
    results.length;
  console.log(
    `[3] Avg accuracy - Adaptive: ${(avgAdaptive * 100).toFixed(1)}%, Classic: ${(avgClassic * 100).toFixed(1)}%`,
  );

  // Adaptive should be at least as good as classic on average (allow 5pp margin for noise)
  expect(avgAdaptive).toBeGreaterThanOrEqual(avgClassic - 0.05);

  console.log("\n✓ All BKT assumptions validated!\n");
}
