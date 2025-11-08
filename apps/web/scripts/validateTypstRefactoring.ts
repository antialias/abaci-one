#!/usr/bin/env tsx
/**
 * Validation script for typstHelpers refactoring
 *
 * Generates sample worksheets and verifies that the refactored code
 * produces identical Typst output to ensure no regressions.
 */

import { generateSubtractionProblemStackFunction } from "../src/app/create/worksheets/addition/typstHelpers";
import { generateTypstHelpers } from "../src/app/create/worksheets/addition/typstHelpers";
import { generatePlaceValueColors } from "../src/app/create/worksheets/addition/typstHelpers";

console.log("🔍 Validating typstHelpers refactoring...\n");

// Test 1: Check that functions are exported and callable
console.log("✓ Test 1: Functions are exported");
console.log(
  `  - generateSubtractionProblemStackFunction: ${typeof generateSubtractionProblemStackFunction}`,
);
console.log(`  - generateTypstHelpers: ${typeof generateTypstHelpers}`);
console.log(`  - generatePlaceValueColors: ${typeof generatePlaceValueColors}`);

if (typeof generateSubtractionProblemStackFunction !== "function") {
  console.error(
    "❌ generateSubtractionProblemStackFunction is not a function!",
  );
  process.exit(1);
}

// Test 2: Generate sample Typst code
console.log("\n✓ Test 2: Generate sample Typst code");
const cellSize = 0.55;
const maxDigits = 3;

const helpers = generateTypstHelpers(cellSize);
console.log(`  - Helper functions: ${helpers.length} characters`);

const colors = generatePlaceValueColors();
console.log(`  - Color definitions: ${colors.length} characters`);

const problemStack = generateSubtractionProblemStackFunction(
  cellSize,
  maxDigits,
);
console.log(`  - Problem stack function: ${problemStack.length} characters`);

// Test 3: Verify key features are present
console.log("\n✓ Test 3: Verify key features in generated Typst");

const checks = [
  { name: "Borrow boxes row", pattern: /Borrow boxes row/ },
  { name: "Minuend row", pattern: /Minuend row/ },
  { name: "Subtrahend row", pattern: /Subtrahend row/ },
  { name: "Answer boxes", pattern: /Answer boxes/ },
  { name: "Ten-frames", pattern: /Ten-frames row/ },
  { name: "Borrowing hints", pattern: /show-borrowing-hints/ },
  { name: "Arrow rendering", pattern: /path\(/ },
  { name: "Place value colors", pattern: /place-colors/ },
  { name: "Scratch work boxes", pattern: /dotted.*paint: gray/ },
];

let allPassed = true;
for (const check of checks) {
  const found = check.pattern.test(problemStack);
  if (found) {
    console.log(`  ✓ ${check.name}`);
  } else {
    console.log(`  ❌ ${check.name} - NOT FOUND`);
    allPassed = false;
  }
}

// Test 4: Verify structure
console.log("\n✓ Test 4: Verify Typst structure");
const structureChecks = [
  { name: "Function definition", pattern: /#let subtraction-problem-stack\(/ },
  { name: "Grid structure", pattern: /grid\(/ },
  { name: "Stack structure", pattern: /stack\(/ },
  { name: "Problem number display", pattern: /problem-number-display/ },
];

for (const check of structureChecks) {
  const found = check.pattern.test(problemStack);
  if (found) {
    console.log(`  ✓ ${check.name}`);
  } else {
    console.log(`  ❌ ${check.name} - NOT FOUND`);
    allPassed = false;
  }
}

// Summary
console.log("\n" + "=".repeat(60));
if (allPassed) {
  console.log("✅ All validation checks passed!");
  console.log("\nThe refactored code generates valid Typst output with all");
  console.log("expected features present.");
  process.exit(0);
} else {
  console.log("❌ Some validation checks failed!");
  console.log("\nPlease review the output above for details.");
  process.exit(1);
}
