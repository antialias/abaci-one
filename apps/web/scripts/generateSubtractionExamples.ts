// Script to generate subtraction worksheet examples for the blog post
// Shows different scaffolding levels for subtraction problems

import fs from "fs";
import path from "path";
import { generateWorksheetPreview } from "../src/app/create/worksheets/generatePreview";

// Output directory
const outputDir = path.join(
  process.cwd(),
  "public",
  "blog",
  "subtraction-examples",
);

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Generate examples showing different subtraction scaffolding options
const examples = [
  {
    name: "subtraction-no-borrowing",
    filename: "no-borrowing.svg",
    description: "Simple subtraction (no borrowing needed)",
    config: {
      operator: "subtraction" as const,
      pAllStart: 0.0, // No borrowing problems
      pAnyStart: 0.0,
      digitRange: { min: 2, max: 2 },
      mode: "manual" as const,
      displayRules: {
        carryBoxes: "never" as const,
        answerBoxes: "always" as const,
        placeValueColors: "never" as const,
        tenFrames: "never" as const,
        problemNumbers: "always" as const,
        cellBorders: "always" as const,
      },
      showBorrowNotation: false,
      showBorrowingHints: false,
    },
  },
  {
    name: "subtraction-with-borrow-notation",
    filename: "with-borrow-notation.svg",
    description: "Subtraction with borrow notation boxes",
    config: {
      operator: "subtraction" as const,
      pAllStart: 0.0,
      pAnyStart: 1.0, // Some borrowing
      digitRange: { min: 2, max: 2 },
      mode: "manual" as const,
      displayRules: {
        carryBoxes: "never" as const,
        answerBoxes: "always" as const,
        placeValueColors: "always" as const,
        tenFrames: "never" as const,
        problemNumbers: "always" as const,
        cellBorders: "always" as const,
      },
      showBorrowNotation: true,
      showBorrowingHints: false,
    },
  },
  {
    name: "subtraction-with-hints",
    filename: "with-borrowing-hints.svg",
    description: "Subtraction with borrow notation and hints",
    config: {
      operator: "subtraction" as const,
      pAllStart: 0.0,
      pAnyStart: 1.0, // Some borrowing
      digitRange: { min: 2, max: 2 },
      mode: "manual" as const,
      displayRules: {
        carryBoxes: "never" as const,
        answerBoxes: "always" as const,
        placeValueColors: "always" as const,
        tenFrames: "never" as const,
        problemNumbers: "always" as const,
        cellBorders: "always" as const,
      },
      showBorrowNotation: true,
      showBorrowingHints: true,
    },
  },
  {
    name: "subtraction-multiple-borrows",
    filename: "multiple-borrows.svg",
    description: "Complex subtraction with multiple borrows",
    config: {
      operator: "subtraction" as const,
      pAllStart: 1.0, // All problems require borrowing
      pAnyStart: 1.0,
      digitRange: { min: 3, max: 3 },
      mode: "manual" as const,
      displayRules: {
        carryBoxes: "never" as const,
        answerBoxes: "always" as const,
        placeValueColors: "always" as const,
        tenFrames: "never" as const,
        problemNumbers: "always" as const,
        cellBorders: "always" as const,
      },
      showBorrowNotation: true,
      showBorrowingHints: false,
    },
  },
  {
    name: "subtraction-single-borrow",
    filename: "single-borrow-ones.svg",
    description: "Single borrow in ones place only",
    config: {
      operator: "subtraction" as const,
      pAllStart: 0.0,
      pAnyStart: 1.0, // Some borrowing
      digitRange: { min: 2, max: 2 },
      mode: "manual" as const,
      displayRules: {
        carryBoxes: "never" as const,
        answerBoxes: "always" as const,
        placeValueColors: "always" as const,
        tenFrames: "never" as const,
        problemNumbers: "always" as const,
        cellBorders: "always" as const,
      },
      showBorrowNotation: true,
      showBorrowingHints: false,
    },
  },
  {
    name: "subtraction-comparison-no-notation",
    filename: "comparison-no-notation.svg",
    description: "Borrowing problems WITHOUT notation boxes",
    config: {
      operator: "subtraction" as const,
      pAllStart: 0.0,
      pAnyStart: 1.0,
      digitRange: { min: 2, max: 2 },
      mode: "manual" as const,
      displayRules: {
        carryBoxes: "never" as const,
        answerBoxes: "always" as const,
        placeValueColors: "never" as const,
        tenFrames: "never" as const,
        problemNumbers: "always" as const,
        cellBorders: "always" as const,
      },
      showBorrowNotation: false,
      showBorrowingHints: false,
    },
  },
  {
    name: "subtraction-comparison-with-notation",
    filename: "comparison-with-notation.svg",
    description: "Same problems WITH notation boxes",
    config: {
      operator: "subtraction" as const,
      pAllStart: 0.0,
      pAnyStart: 1.0,
      digitRange: { min: 2, max: 2 },
      mode: "manual" as const,
      displayRules: {
        carryBoxes: "never" as const,
        answerBoxes: "always" as const,
        placeValueColors: "never" as const,
        tenFrames: "never" as const,
        problemNumbers: "always" as const,
        cellBorders: "always" as const,
      },
      showBorrowNotation: true,
      showBorrowingHints: false,
      seed: 12345, // Same seed as above for identical problems
    },
  },
  {
    name: "subtraction-cascading-borrows",
    filename: "cascading-borrows.svg",
    description: "Cascading borrows across multiple places",
    config: {
      operator: "subtraction" as const,
      pAllStart: 1.0,
      pAnyStart: 1.0,
      digitRange: { min: 4, max: 4 },
      mode: "manual" as const,
      displayRules: {
        carryBoxes: "never" as const,
        answerBoxes: "always" as const,
        placeValueColors: "always" as const,
        tenFrames: "never" as const,
        problemNumbers: "always" as const,
        cellBorders: "always" as const,
      },
      showBorrowNotation: true,
      showBorrowingHints: false,
    },
  },
  {
    name: "subtraction-hints-detail",
    filename: "hints-detail.svg",
    description: "Detailed view of borrowing hints",
    config: {
      operator: "subtraction" as const,
      pAllStart: 0.0,
      pAnyStart: 1.0,
      digitRange: { min: 3, max: 3 },
      mode: "manual" as const,
      displayRules: {
        carryBoxes: "never" as const,
        answerBoxes: "always" as const,
        placeValueColors: "always" as const,
        tenFrames: "never" as const,
        problemNumbers: "always" as const,
        cellBorders: "always" as const,
      },
      showBorrowNotation: true,
      showBorrowingHints: true,
      problemsPerPage: 2, // Fewer problems for detail
      cols: 1,
    },
  },
] as const;

console.log("Generating subtraction example worksheets...\n");

for (const example of examples) {
  console.log(`Generating ${example.description}...`);

  const config = {
    problemsPerPage: 4,
    pages: 1,
    cols: 2,
    seed: 12345, // Fixed seed for consistent examples
    ...example.config, // Spread example config last so it can override defaults
  };

  try {
    const result = generateWorksheetPreview(config);

    if (!result.success || !result.pages || result.pages.length === 0) {
      console.error(`Failed to generate ${example.name}:`, result.error);
      console.error(`Details:`, result.details);
      continue;
    }

    // Get the first page's SVG
    const svg = result.pages[0];

    // Save to file
    const outputPath = path.join(outputDir, example.filename);
    fs.writeFileSync(outputPath, svg, "utf-8");

    console.log(`  ✓ Saved to ${outputPath}`);
  } catch (error) {
    console.error(`  ✗ Error generating ${example.name}:`, error);
  }
}

console.log("\nDone! Subtraction example worksheets generated.");
console.log(`\nFiles saved to: ${outputDir}`);
