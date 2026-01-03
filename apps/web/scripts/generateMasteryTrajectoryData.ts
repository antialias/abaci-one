#!/usr/bin/env tsx
/**
 * Generate JSON data from A/B mastery trajectory test snapshots.
 *
 * This script reads the Vitest snapshot file and extracts the multi-skill
 * A/B trajectory data into a JSON format for the blog post charts.
 *
 * Usage: npx tsx scripts/generateMasteryTrajectoryData.ts
 * Output: public/data/ab-mastery-trajectories.json
 */

import fs from "fs";
import path from "path";

const SNAPSHOT_PATH = path.join(
  process.cwd(),
  "src/test/journey-simulator/__snapshots__/skill-difficulty.test.ts.snap",
);

const OUTPUT_PATH = path.join(
  process.cwd(),
  "public/data/ab-mastery-trajectories.json",
);

interface TrajectoryPoint {
  session: number;
  mastery: number;
}

interface SkillTrajectory {
  adaptive: TrajectoryPoint[];
  classic: TrajectoryPoint[];
  sessionsTo50Adaptive: number | null;
  sessionsTo50Classic: number | null;
  sessionsTo80Adaptive: number | null;
  sessionsTo80Classic: number | null;
}

interface ABMasterySnapshot {
  config: {
    seed: number;
    sessionCount: number;
    sessionDurationMinutes: number;
  };
  summary: {
    skills: string[];
    adaptiveWins50: number;
    classicWins50: number;
    ties50: number;
    adaptiveWins80: number;
    classicWins80: number;
    ties80: number;
  };
  trajectories: Record<string, SkillTrajectory>;
}

function parseSnapshotFile(content: string): ABMasterySnapshot | null {
  // Extract the ab-mastery-trajectories snapshot using regex
  const regex =
    /exports\[`[^\]]*ab-mastery-trajectories[^\]]*`\]\s*=\s*`([\s\S]*?)`\s*;/m;
  const match = content.match(regex);
  if (!match) {
    console.warn("Warning: Could not find ab-mastery-trajectories snapshot");
    return null;
  }
  try {
    // The snapshot content is a JavaScript object literal, parse it
    // biome-ignore lint/security/noGlobalEval: parsing vitest snapshot format requires eval
    return eval(`(${match[1]})`) as ABMasterySnapshot;
  } catch (e) {
    console.error("Error parsing snapshot:", e);
    return null;
  }
}

// Categorize skill IDs for display
function getSkillCategory(
  skillId: string,
): "fiveComplement" | "tenComplement" | "basic" {
  if (
    skillId.startsWith("fiveComplements") ||
    skillId.startsWith("fiveComplementsSub")
  ) {
    return "fiveComplement";
  }
  if (
    skillId.startsWith("tenComplements") ||
    skillId.startsWith("tenComplementsSub")
  ) {
    return "tenComplement";
  }
  return "basic";
}

// Generate a human-readable label for skill IDs
function getSkillLabel(skillId: string): string {
  // Extract the formula part after the dot
  const parts = skillId.split(".");
  if (parts.length < 2) return skillId;

  const formula = parts[1];

  // Categorize by type
  if (skillId.startsWith("fiveComplements.")) {
    return `5-comp: ${formula}`;
  }
  if (skillId.startsWith("fiveComplementsSub.")) {
    return `5-comp sub: ${formula}`;
  }
  if (skillId.startsWith("tenComplements.")) {
    return `10-comp: ${formula}`;
  }
  if (skillId.startsWith("tenComplementsSub.")) {
    return `10-comp sub: ${formula}`;
  }
  return skillId;
}

// Get color for skill based on category
function getSkillColor(skillId: string, index: number): string {
  const category = getSkillCategory(skillId);

  // Color palettes by category
  const colors = {
    fiveComplement: ["#eab308", "#facc15"], // yellows
    tenComplement: ["#ef4444", "#f97316", "#dc2626", "#ea580c"], // reds/oranges
    basic: ["#22c55e", "#16a34a"], // greens
  };

  const palette = colors[category];
  return palette[index % palette.length];
}

function generateReport(data: ABMasterySnapshot) {
  const skills = data.summary.skills;

  return {
    generatedAt: new Date().toISOString(),
    version: "1.0",

    // Config used to generate this data
    config: data.config,

    // Summary statistics
    summary: {
      totalSkills: skills.length,
      adaptiveWins50: data.summary.adaptiveWins50,
      classicWins50: data.summary.classicWins50,
      ties50: data.summary.ties50,
      adaptiveWins80: data.summary.adaptiveWins80,
      classicWins80: data.summary.classicWins80,
      ties80: data.summary.ties80,
    },

    // Session labels (x-axis)
    sessions: Array.from({ length: data.config.sessionCount }, (_, i) => i + 1),

    // Skills with their trajectory data
    skills: skills.map((skillId, i) => {
      const trajectory = data.trajectories[skillId];
      return {
        id: skillId,
        label: getSkillLabel(skillId),
        category: getSkillCategory(skillId),
        color: getSkillColor(skillId, i),
        adaptive: {
          data: trajectory.adaptive.map((p) => Math.round(p.mastery * 100)),
          sessionsTo50: trajectory.sessionsTo50Adaptive,
          sessionsTo80: trajectory.sessionsTo80Adaptive,
        },
        classic: {
          data: trajectory.classic.map((p) => Math.round(p.mastery * 100)),
          sessionsTo50: trajectory.sessionsTo50Classic,
          sessionsTo80: trajectory.sessionsTo80Classic,
        },
      };
    }),

    // Summary table for comparison
    comparisonTable: skills.map((skillId) => {
      const trajectory = data.trajectories[skillId];
      const sessionsTo80Adaptive = trajectory.sessionsTo80Adaptive;
      const sessionsTo80Classic = trajectory.sessionsTo80Classic;

      // Calculate advantage
      let advantage: string | null = null;
      if (sessionsTo80Adaptive !== null && sessionsTo80Classic !== null) {
        const diff = sessionsTo80Classic - sessionsTo80Adaptive;
        if (diff > 0) {
          advantage = `Adaptive +${diff} sessions`;
        } else if (diff < 0) {
          advantage = `Classic +${Math.abs(diff)} sessions`;
        } else {
          advantage = "Tie";
        }
      } else if (
        sessionsTo80Adaptive !== null &&
        sessionsTo80Classic === null
      ) {
        advantage = "Adaptive (Classic never reached 80%)";
      } else if (
        sessionsTo80Adaptive === null &&
        sessionsTo80Classic !== null
      ) {
        advantage = "Classic (Adaptive never reached 80%)";
      }

      return {
        skill: getSkillLabel(skillId),
        category: getSkillCategory(skillId),
        adaptiveTo80: sessionsTo80Adaptive,
        classicTo80: sessionsTo80Classic,
        advantage,
      };
    }),
  };
}

async function main() {
  console.log("Reading snapshot file...");

  if (!fs.existsSync(SNAPSHOT_PATH)) {
    console.error(`Snapshot file not found: ${SNAPSHOT_PATH}`);
    console.log(
      "Run the tests first: npx vitest run src/test/journey-simulator/skill-difficulty.test.ts",
    );
    process.exit(1);
  }

  const snapshotContent = fs.readFileSync(SNAPSHOT_PATH, "utf-8");
  console.log("Parsing snapshots...");

  const data = parseSnapshotFile(snapshotContent);
  if (!data) {
    console.error("Failed to parse snapshot data");
    process.exit(1);
  }

  console.log("Generating report...");
  const report = generateReport(data);

  // Ensure output directory exists
  const outputDir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(report, null, 2));
  console.log(`Report written to: ${OUTPUT_PATH}`);

  // Print summary
  console.log("\n--- Summary ---");
  console.log(`Skills analyzed: ${report.summary.totalSkills}`);
  console.log(`Sessions: ${report.config.sessionCount}`);
  console.log(`\nAt 50% mastery threshold:`);
  console.log(`  Adaptive wins: ${report.summary.adaptiveWins50}`);
  console.log(`  Classic wins: ${report.summary.classicWins50}`);
  console.log(`  Ties: ${report.summary.ties50}`);
  console.log(`\nAt 80% mastery threshold:`);
  console.log(`  Adaptive wins: ${report.summary.adaptiveWins80}`);
  console.log(`  Classic wins: ${report.summary.classicWins80}`);
  console.log(`  Ties: ${report.summary.ties80}`);

  console.log("\n--- Comparison Table ---");
  for (const row of report.comparisonTable) {
    const a80 = row.adaptiveTo80 !== null ? row.adaptiveTo80 : "never";
    const c80 = row.classicTo80 !== null ? row.classicTo80 : "never";
    console.log(
      `${row.skill}: Adaptive ${a80}, Classic ${c80} → ${row.advantage}`,
    );
  }
}

main().catch(console.error);
