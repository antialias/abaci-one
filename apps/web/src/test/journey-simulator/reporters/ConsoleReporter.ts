/**
 * Console Reporter
 *
 * Formats journey simulation results for console output.
 * Designed for vitest test output visibility.
 */

import type { ComparisonResult, JourneyResult } from "../types";

/**
 * Format a journey result for console output.
 */
export function formatJourneyResults(result: JourneyResult): string {
  const lines: string[] = [];

  lines.push("");
  lines.push("═══════════════════════════════════════════════════════════");
  lines.push("              JOURNEY SIMULATION RESULTS                   ");
  lines.push("═══════════════════════════════════════════════════════════");
  lines.push("");

  // Configuration
  lines.push(`Profile:    ${result.config.profile.name}`);
  lines.push(`Mode:       ${result.config.mode}`);
  lines.push(`Sessions:   ${result.config.sessionCount}`);
  lines.push(`Duration:   ${result.config.sessionDurationMinutes} min/session`);
  lines.push(`Seed:       ${result.config.seed}`);
  lines.push(`Skills:     ${result.config.practicingSkills.length}`);
  lines.push(`Runtime:    ${result.runtimeMs}ms`);
  lines.push("");

  // Final Metrics
  lines.push("───────────────────────────────────────────────────────────");
  lines.push("                    FINAL METRICS                          ");
  lines.push("───────────────────────────────────────────────────────────");
  lines.push("");
  lines.push(
    `BKT Correlation:       ${formatPercent(result.finalMetrics.bktCorrelation, true)}`,
  );
  lines.push(
    `Weak Skill Surfacing:  ${result.finalMetrics.weakSkillSurfacing.toFixed(2)}x baseline`,
  );
  lines.push(
    `Accuracy Improvement:  ${formatDelta(result.finalMetrics.accuracyImprovement)}`,
  );
  lines.push("");

  // Per-Session Progress
  lines.push("───────────────────────────────────────────────────────────");
  lines.push("                  PER-SESSION PROGRESS                     ");
  lines.push("───────────────────────────────────────────────────────────");
  lines.push("");
  lines.push("Session  Accuracy  Problems  BKT Correlation");
  lines.push("-------  --------  --------  ---------------");

  for (const snapshot of result.snapshots) {
    // Calculate BKT correlation for this snapshot
    const bktCorr = calculateSnapshotCorrelation(
      snapshot,
      result.config.practicingSkills,
    );
    lines.push(
      `   ${String(snapshot.sessionNumber).padStart(2)}     ${formatPercent(snapshot.accuracy).padStart(6)}    ${String(snapshot.problemsAttempted).padStart(6)}    ${formatPercent(bktCorr, true).padStart(6)}`,
    );
  }
  lines.push("");

  // Skill Trajectories (top weak and strong)
  lines.push("───────────────────────────────────────────────────────────");
  lines.push("                   SKILL HIGHLIGHTS                        ");
  lines.push("───────────────────────────────────────────────────────────");
  lines.push("");

  const lastSnapshot = result.snapshots[result.snapshots.length - 1];

  // Find weakest and strongest skills by true probability (Hill function)
  const skillsByProbability = [
    ...lastSnapshot.trueSkillProbabilities.entries(),
  ].sort((a, b) => a[1] - b[1]);

  const weakest = skillsByProbability.slice(0, 3);
  const strongest = skillsByProbability.slice(-3).reverse();

  lines.push("Weakest Skills (True Probability):");
  for (const [skillId, probability] of weakest) {
    const bkt = lastSnapshot.bktEstimates.get(skillId)?.pKnown ?? 0;
    const exposure = lastSnapshot.cumulativeExposures.get(skillId) ?? 0;
    lines.push(
      `  ${skillId.padEnd(30)} True: ${formatPercent(probability)} BKT: ${formatPercent(bkt)} Exp: ${exposure}`,
    );
  }
  lines.push("");

  lines.push("Strongest Skills (True Probability):");
  for (const [skillId, probability] of strongest) {
    const bkt = lastSnapshot.bktEstimates.get(skillId)?.pKnown ?? 0;
    const exposure = lastSnapshot.cumulativeExposures.get(skillId) ?? 0;
    lines.push(
      `  ${skillId.padEnd(30)} True: ${formatPercent(probability)} BKT: ${formatPercent(bkt)} Exp: ${exposure}`,
    );
  }
  lines.push("");

  lines.push("═══════════════════════════════════════════════════════════");

  return lines.join("\n");
}

/**
 * Format a comparison between adaptive and classic modes.
 */
export function formatComparisonResults(comparison: ComparisonResult): string {
  const lines: string[] = [];

  lines.push("");
  lines.push("═══════════════════════════════════════════════════════════");
  lines.push("            A/B COMPARISON: ADAPTIVE vs CLASSIC            ");
  lines.push("═══════════════════════════════════════════════════════════");
  lines.push("");

  const adaptive = comparison.adaptiveResult;
  const classic = comparison.classicResult;

  lines.push(`Profile:    ${adaptive.config.profile.name}`);
  lines.push(`Sessions:   ${adaptive.config.sessionCount}`);
  lines.push(`Seed:       ${adaptive.config.seed}`);
  lines.push("");

  lines.push("───────────────────────────────────────────────────────────");
  lines.push("                    METRIC COMPARISON                      ");
  lines.push("───────────────────────────────────────────────────────────");
  lines.push("");
  lines.push("Metric                     Adaptive    Classic     Delta");
  lines.push("-------------------------  ----------  ----------  ----------");

  lines.push(
    `BKT Correlation            ${formatPercent(adaptive.finalMetrics.bktCorrelation, true).padStart(10)}  ${formatPercent(classic.finalMetrics.bktCorrelation, true).padStart(10)}  ${formatDelta(comparison.correlationDelta, true).padStart(10)}`,
  );
  lines.push(
    `Weak Skill Surfacing       ${(adaptive.finalMetrics.weakSkillSurfacing.toFixed(2) + "x").padStart(10)}  ${(classic.finalMetrics.weakSkillSurfacing.toFixed(2) + "x").padStart(10)}  ${formatDelta(comparison.weakSkillSurfacingDelta).padStart(10)}`,
  );
  lines.push(
    `Accuracy Improvement       ${formatPercent(adaptive.finalMetrics.accuracyImprovement).padStart(10)}  ${formatPercent(classic.finalMetrics.accuracyImprovement).padStart(10)}  ${formatDelta(comparison.accuracyImprovementDelta).padStart(10)}`,
  );
  lines.push("");

  // Winner determination
  lines.push("───────────────────────────────────────────────────────────");
  lines.push("                        WINNER                             ");
  lines.push("───────────────────────────────────────────────────────────");
  lines.push("");

  let adaptiveWins = 0;
  let classicWins = 0;

  if (comparison.correlationDelta > 0.05) {
    adaptiveWins++;
    lines.push(
      "  BKT Correlation:       ADAPTIVE (+" +
        formatPercent(comparison.correlationDelta) +
        ")",
    );
  } else if (comparison.correlationDelta < -0.05) {
    classicWins++;
    lines.push(
      "  BKT Correlation:       CLASSIC (" +
        formatPercent(comparison.correlationDelta) +
        ")",
    );
  } else {
    lines.push("  BKT Correlation:       TIE");
  }

  if (comparison.weakSkillSurfacingDelta > 0.1) {
    adaptiveWins++;
    lines.push(
      "  Weak Skill Surfacing:  ADAPTIVE (+" +
        comparison.weakSkillSurfacingDelta.toFixed(2) +
        "x)",
    );
  } else if (comparison.weakSkillSurfacingDelta < -0.1) {
    classicWins++;
    lines.push(
      "  Weak Skill Surfacing:  CLASSIC (" +
        comparison.weakSkillSurfacingDelta.toFixed(2) +
        "x)",
    );
  } else {
    lines.push("  Weak Skill Surfacing:  TIE");
  }

  if (comparison.accuracyImprovementDelta > 0.02) {
    adaptiveWins++;
    lines.push(
      "  Accuracy Improvement:  ADAPTIVE (+" +
        formatPercent(comparison.accuracyImprovementDelta) +
        ")",
    );
  } else if (comparison.accuracyImprovementDelta < -0.02) {
    classicWins++;
    lines.push(
      "  Accuracy Improvement:  CLASSIC (" +
        formatPercent(comparison.accuracyImprovementDelta) +
        ")",
    );
  } else {
    lines.push("  Accuracy Improvement:  TIE");
  }

  lines.push("");
  if (adaptiveWins > classicWins) {
    lines.push(`  Overall: ADAPTIVE WINS (${adaptiveWins}-${classicWins})`);
  } else if (classicWins > adaptiveWins) {
    lines.push(`  Overall: CLASSIC WINS (${classicWins}-${adaptiveWins})`);
  } else {
    lines.push(`  Overall: TIE (${adaptiveWins}-${classicWins})`);
  }
  lines.push("");

  lines.push("═══════════════════════════════════════════════════════════");

  return lines.join("\n");
}

/**
 * Log journey results to console.
 */
export function logJourneyResults(result: JourneyResult): void {
  console.log(formatJourneyResults(result));
}

/**
 * Log comparison results to console.
 */
export function logComparisonResults(comparison: ComparisonResult): void {
  console.log(formatComparisonResults(comparison));
}

// Helper functions

function formatPercent(value: number, signed = false): string {
  const percent = (value * 100).toFixed(1);
  if (signed && value > 0) {
    return `+${percent}%`;
  }
  return `${percent}%`;
}

function formatDelta(value: number, asPercent = false): string {
  if (asPercent) {
    const percent = (value * 100).toFixed(1);
    return value >= 0 ? `+${percent}%` : `${percent}%`;
  }
  const formatted = value.toFixed(2);
  return value >= 0 ? `+${formatted}` : formatted;
}

function calculateSnapshotCorrelation(
  snapshot: {
    trueSkillProbabilities: Map<string, number>;
    bktEstimates: Map<string, { pKnown: number }>;
  },
  skillIds: string[],
): number {
  const pairs: Array<[number, number]> = [];

  for (const skillId of skillIds) {
    const trueProbability = snapshot.trueSkillProbabilities.get(skillId) ?? 0;
    const bktEstimate = snapshot.bktEstimates.get(skillId)?.pKnown ?? 0.5;
    pairs.push([trueProbability, bktEstimate]);
  }

  if (pairs.length < 2) return 0;

  const n = pairs.length;
  const sumX = pairs.reduce((s, [x]) => s + x, 0);
  const sumY = pairs.reduce((s, [, y]) => s + y, 0);
  const sumXY = pairs.reduce((s, [x, y]) => s + x * y, 0);
  const sumX2 = pairs.reduce((s, [x]) => s + x * x, 0);
  const sumY2 = pairs.reduce((s, [, y]) => s + y * y, 0);

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt(
    (n * sumX2 - sumX ** 2) * (n * sumY2 - sumY ** 2),
  );

  return denominator === 0 ? 0 : numerator / denominator;
}
