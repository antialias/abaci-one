#!/usr/bin/env tsx
/**
 * Test script for GPT-5 worksheet grading
 *
 * Usage:
 *   npx tsx scripts/testGrading.ts path/to/worksheet.jpg
 *
 * This will:
 * 1. Call GPT-5 vision API to grade the worksheet
 * 2. Validate the response
 * 3. Print the results (score, feedback, suggested step)
 */

import { gradeWorksheetWithVision } from "../src/lib/ai/gradeWorksheet";
import { join } from "path";

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error(
      "Usage: npx tsx scripts/testGrading.ts path/to/worksheet.jpg",
    );
    console.error("\nExample:");
    console.error(
      "  npx tsx scripts/testGrading.ts data/uploads/test-worksheet.jpg",
    );
    process.exit(1);
  }

  const imagePath = args[0];
  const absolutePath = imagePath.startsWith("/")
    ? imagePath
    : join(process.cwd(), imagePath);

  console.log("🔍 Testing GPT-5 Worksheet Grading");
  console.log("━".repeat(60));
  console.log(`Image: ${absolutePath}`);
  console.log("━".repeat(60));
  console.log();

  try {
    console.log("📤 Calling GPT-5 vision API...");
    const startTime = Date.now();

    const result = await gradeWorksheetWithVision(absolutePath);

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`✅ Grading complete in ${duration}s`);
    console.log();

    // Print results
    console.log("📊 GRADING RESULTS");
    console.log("━".repeat(60));
    console.log(
      `Score: ${result.correctCount}/${result.totalProblems} (${(result.accuracy * 100).toFixed(1)}%)`,
    );
    console.log();

    console.log("🤖 AI Feedback:");
    console.log(result.feedback);
    console.log();

    console.log("🏷️  Error Patterns:");
    if (result.errorPatterns.length === 0) {
      console.log("  None detected");
    } else {
      result.errorPatterns.forEach((pattern) => {
        console.log(`  • ${pattern}`);
      });
    }
    console.log();

    console.log("📈 Progression:");
    console.log(`  Current estimate: ${result.currentStepEstimate}`);
    console.log(`  Suggested step: ${result.suggestedStepId}`);
    console.log();

    console.log("🧮 Problem Breakdown:");
    console.log("━".repeat(60));
    result.problems.forEach((p) => {
      const status = p.isCorrect ? "✓" : "✗";
      const answer = p.studentAnswer !== null ? p.studentAnswer : "blank";
      console.log(
        `#${p.index + 1}: ${p.operandA} + ${p.operandB} = ${p.correctAnswer} ` +
          `(student: ${answer}) ${status}`,
      );
    });
    console.log();

    console.log("💭 AI Reasoning:");
    console.log(result.reasoning);
    console.log();
  } catch (error) {
    console.error("❌ Grading failed:");
    console.error(error);
    process.exit(1);
  }
}

main();
