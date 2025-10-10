#!/usr/bin/env node

/**
 * Node.js Example: Using @soroban/templates
 *
 * This example demonstrates how to use the templates package
 * in a Node.js environment to generate soroban content.
 */

const fs = require("fs");
const {
  FLASHCARDS_TEMPLATE,
  SINGLE_CARD_TEMPLATE,
  getTemplatePath,
} = require("..");

console.log("📚 Node.js Example: @soroban/templates\n");

// Example 1: Direct template access
console.log("🎯 Example 1: Direct Template Access");
console.log("====================================");
console.log("FLASHCARDS_TEMPLATE:", FLASHCARDS_TEMPLATE);
console.log("SINGLE_CARD_TEMPLATE:", SINGLE_CARD_TEMPLATE);

// Verify files exist
const flashcardsExists = fs.existsSync(FLASHCARDS_TEMPLATE);
const singleCardExists = fs.existsSync(SINGLE_CARD_TEMPLATE);

console.log("Files exist:");
console.log("  flashcards.typ:", flashcardsExists ? "✅" : "❌");
console.log("  single-card.typ:", singleCardExists ? "✅" : "❌");

// Example 2: Dynamic path resolution
console.log("\n🔧 Example 2: Dynamic Path Resolution");
console.log("====================================");
try {
  const dynamicFlashcards = getTemplatePath("flashcards.typ");
  const dynamicSingleCard = getTemplatePath("single-card.typ");

  console.log("Dynamic paths:");
  console.log("  flashcards.typ:", dynamicFlashcards);
  console.log("  single-card.typ:", dynamicSingleCard);
} catch (error) {
  console.error("❌ Error:", error.message);
}

// Example 3: Loading template content
console.log("\n📄 Example 3: Loading Template Content");
console.log("=====================================");
if (flashcardsExists) {
  const content = fs.readFileSync(FLASHCARDS_TEMPLATE, "utf-8");
  const lines = content.split("\n");

  console.log(
    `Template loaded: ${lines.length} lines, ${content.length} characters`,
  );
  console.log("First few lines:");
  lines.slice(0, 3).forEach((line, i) => {
    console.log(
      `  ${i + 1}: ${line.substring(0, 80)}${line.length > 80 ? "..." : ""}`,
    );
  });

  // Check for key functions
  const hasDraw = content.includes("draw-soroban");
  const hasColors = content.includes("color-scheme");
  console.log("\nFunction analysis:");
  console.log("  Contains draw-soroban:", hasDraw ? "✅" : "❌");
  console.log("  Supports color schemes:", hasColors ? "✅" : "❌");
}

// Example 4: Simulated usage in a web API
console.log("\n🌐 Example 4: Simulated Web API Usage");
console.log("====================================");

function simulateAPIRoute(number) {
  try {
    const templatePath = getTemplatePath("flashcards.typ");
    const template = fs.readFileSync(templatePath, "utf-8");

    // In a real scenario, you'd pass this to a Typst compiler
    const mockTypstContent = `
${template}

#set page(width: 120pt, height: 160pt, margin: 0pt)
#draw-soroban(${number}, columns: auto, bead-shape: "diamond", color-scheme: "place-value")
`;

    return {
      success: true,
      number: number,
      templateUsed: "flashcards.typ",
      contentLength: mockTypstContent.length,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

const testNumbers = [123, 4567, 1000];
testNumbers.forEach((num) => {
  const result = simulateAPIRoute(num);
  if (result.success) {
    console.log(
      `✅ Number ${num}: Generated content (${result.contentLength} chars)`,
    );
  } else {
    console.log(`❌ Number ${num}: Failed - ${result.error}`);
  }
});

// Example 5: Error handling
console.log("\n🚨 Example 5: Error Handling");
console.log("===========================");
try {
  const badPath = getTemplatePath("nonexistent.typ");
  console.log("❌ This should not print");
} catch (error) {
  console.log("✅ Caught expected error:", error.message);
}

console.log("\n🎉 Examples completed successfully!");
