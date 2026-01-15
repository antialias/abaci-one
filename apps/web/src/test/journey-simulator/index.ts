/**
 * Journey Simulator
 *
 * Test infrastructure for validating BKT-driven problem generation.
 *
 * Usage:
 * ```typescript
 * import {
 *   createEphemeralDatabase,
 *   createTestStudent,
 *   SeededRandom,
 *   SimulatedStudent,
 *   JourneyRunner,
 *   unevenSkillsProfile,
 *   logJourneyResults,
 * } from '@/test/journey-simulator'
 *
 * // Create isolated test database
 * const { db, cleanup } = createEphemeralDatabase()
 *
 * // Create test student in database
 * const { playerId } = await createTestStudent(db)
 *
 * // Set up simulation
 * const rng = new SeededRandom(42)
 * const student = new SimulatedStudent(unevenSkillsProfile, rng)
 * const runner = new JourneyRunner(db, student, config, rng, playerId)
 *
 * // Run simulation
 * const result = await runner.run()
 *
 * // Report results
 * logJourneyResults(result)
 *
 * // Cleanup
 * cleanup()
 * ```
 */

// Core types
export type {
  BktEstimate,
  ComparisonResult,
  JourneyConfig,
  JourneyMetrics,
  JourneyResult,
  JourneyResultJson,
  SessionSnapshot,
  SimulatedAnswer,
  SkillDataPoint,
  SkillTrajectory,
  StudentProfile,
} from "./types";

// Seeded random
export {
  SeededRandom,
  withSeededRandom,
  withSeededRandomAsync,
} from "./SeededRandom";

// Ephemeral database
export {
  createEphemeralDatabase,
  createTestStudent,
  getCurrentEphemeralDb,
  initializeSkillMastery,
  resetDatabase,
  type EphemeralDbResult,
  type TestDatabase,
} from "./EphemeralDatabase";

// Simulated student
export { SimulatedStudent } from "./SimulatedStudent";

// Journey runner
export { JourneyRunner } from "./JourneyRunner";

// Profiles
export {
  ALL_SKILLS,
  BASIC_SKILLS,
  fastLearnerProfile,
  MINIMAL_SKILLS,
  slowLearnerProfile,
  STRONG_SKILLS,
  unevenSkillsProfile,
  WEAK_SKILLS,
} from "./profiles";

// Reporters
export {
  comparisonToJsonSerializable,
  exportComparisonToJson,
  exportToJson,
  formatComparisonResults,
  formatJourneyResults,
  loadFromJson,
  logComparisonResults,
  logJourneyResults,
  toJsonSerializable,
} from "./reporters";

/**
 * Helper to run an A/B comparison between adaptive and classic modes.
 *
 * Runs the same profile with the same seed in both modes and compares results.
 */
export async function runComparison(
  db: import("./EphemeralDatabase").TestDatabase,
  profile: import("./types").StudentProfile,
  config: Omit<import("./types").JourneyConfig, "profile" | "mode">,
  playerId: string,
): Promise<import("./types").ComparisonResult> {
  const { SeededRandom } = await import("./SeededRandom");
  const { SimulatedStudent } = await import("./SimulatedStudent");
  const { JourneyRunner } = await import("./JourneyRunner");
  const { resetDatabase, createTestStudent } = await import(
    "./EphemeralDatabase"
  );

  // Run adaptive mode
  await resetDatabase(db);
  await createTestStudent(db, playerId);
  const adaptiveRng = new SeededRandom(config.seed);
  const adaptiveStudent = new SimulatedStudent(profile, adaptiveRng);
  const adaptiveRunner = new JourneyRunner(
    db,
    adaptiveStudent,
    { ...config, profile, mode: "adaptive" },
    adaptiveRng,
    playerId,
  );
  const adaptiveResult = await adaptiveRunner.run();

  // Run classic mode (same seed)
  await resetDatabase(db);
  await createTestStudent(db, playerId);
  const classicRng = new SeededRandom(config.seed);
  const classicStudent = new SimulatedStudent(profile, classicRng);
  const classicRunner = new JourneyRunner(
    db,
    classicStudent,
    { ...config, profile, mode: "classic" },
    classicRng,
    playerId,
  );
  const classicResult = await classicRunner.run();

  return {
    adaptiveResult,
    classicResult,
    correlationDelta:
      adaptiveResult.finalMetrics.bktCorrelation -
      classicResult.finalMetrics.bktCorrelation,
    weakSkillSurfacingDelta:
      adaptiveResult.finalMetrics.weakSkillSurfacing -
      classicResult.finalMetrics.weakSkillSurfacing,
    accuracyImprovementDelta:
      adaptiveResult.finalMetrics.accuracyImprovement -
      classicResult.finalMetrics.accuracyImprovement,
  };
}
