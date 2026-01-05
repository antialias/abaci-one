/**
 * JSON Reporter
 *
 * Exports journey simulation results to JSON for further analysis.
 * Converts Maps to objects for JSON serialization.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type {
  ComparisonResult,
  JourneyResult,
  JourneyResultJson,
} from "../types";

/**
 * Convert a JourneyResult to JSON-serializable format.
 */
export function toJsonSerializable(result: JourneyResult): JourneyResultJson {
  return {
    config: {
      profileName: result.config.profile.name,
      mode: result.config.mode,
      sessionCount: result.config.sessionCount,
      sessionDurationMinutes: result.config.sessionDurationMinutes,
      seed: result.config.seed,
      practicingSkills: result.config.practicingSkills,
    },
    metrics: {
      bktCorrelation: result.finalMetrics.bktCorrelation,
      weakSkillSurfacing: result.finalMetrics.weakSkillSurfacing,
      accuracyImprovement: result.finalMetrics.accuracyImprovement,
    },
    trajectories: Object.fromEntries(result.finalMetrics.skillTrajectories),
    snapshots: result.snapshots.map((s) => ({
      session: s.sessionNumber,
      accuracy: s.accuracy,
      problemsAttempted: s.problemsAttempted,
      bktEstimates: Object.fromEntries(s.bktEstimates),
      trueSkillProbabilities: Object.fromEntries(s.trueSkillProbabilities),
      cumulativeExposures: Object.fromEntries(s.cumulativeExposures),
      sessionExposures: Object.fromEntries(s.sessionExposures),
    })),
  };
}

/**
 * Export journey results to a JSON file.
 *
 * @param result - The journey result to export
 * @param filepath - Path to write the JSON file
 */
export function exportToJson(result: JourneyResult, filepath: string): void {
  const jsonData = toJsonSerializable(result);
  const jsonString = JSON.stringify(jsonData, null, 2);

  // Ensure directory exists
  const dir = path.dirname(filepath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(filepath, jsonString, "utf-8");
}

/**
 * JSON-serializable comparison result.
 */
export interface ComparisonResultJson {
  adaptive: JourneyResultJson;
  classic: JourneyResultJson;
  deltas: {
    bktCorrelation: number;
    weakSkillSurfacing: number;
    accuracyImprovement: number;
  };
  winner: "adaptive" | "classic" | "tie";
}

/**
 * Convert a ComparisonResult to JSON-serializable format.
 */
export function comparisonToJsonSerializable(
  comparison: ComparisonResult,
): ComparisonResultJson {
  // Determine winner
  let adaptiveWins = 0;
  let classicWins = 0;

  if (comparison.correlationDelta > 0.05) adaptiveWins++;
  else if (comparison.correlationDelta < -0.05) classicWins++;

  if (comparison.weakSkillSurfacingDelta > 0.1) adaptiveWins++;
  else if (comparison.weakSkillSurfacingDelta < -0.1) classicWins++;

  if (comparison.accuracyImprovementDelta > 0.02) adaptiveWins++;
  else if (comparison.accuracyImprovementDelta < -0.02) classicWins++;

  let winner: "adaptive" | "classic" | "tie";
  if (adaptiveWins > classicWins) winner = "adaptive";
  else if (classicWins > adaptiveWins) winner = "classic";
  else winner = "tie";

  return {
    adaptive: toJsonSerializable(comparison.adaptiveResult),
    classic: toJsonSerializable(comparison.classicResult),
    deltas: {
      bktCorrelation: comparison.correlationDelta,
      weakSkillSurfacing: comparison.weakSkillSurfacingDelta,
      accuracyImprovement: comparison.accuracyImprovementDelta,
    },
    winner,
  };
}

/**
 * Export comparison results to a JSON file.
 */
export function exportComparisonToJson(
  comparison: ComparisonResult,
  filepath: string,
): void {
  const jsonData = comparisonToJsonSerializable(comparison);
  const jsonString = JSON.stringify(jsonData, null, 2);

  // Ensure directory exists
  const dir = path.dirname(filepath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(filepath, jsonString, "utf-8");
}

/**
 * Load a journey result from a JSON file.
 */
export function loadFromJson(filepath: string): JourneyResultJson {
  const jsonString = fs.readFileSync(filepath, "utf-8");
  return JSON.parse(jsonString) as JourneyResultJson;
}
