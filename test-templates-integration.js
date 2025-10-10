#!/usr/bin/env node

// Test template integration from web app context
console.log("🌐 Testing web app template integration\n");

// Test the web app's current imports
try {
  // Simulate the current web app API route import
  const { FLASHCARDS_TEMPLATE } = require("@soroban/templates");
  console.log("✅ Web app import successful:");
  console.log("  Path:", FLASHCARDS_TEMPLATE);

  // Test file system access
  const fs = require("fs");
  const exists = fs.existsSync(FLASHCARDS_TEMPLATE);
  console.log("  File accessible:", exists);

  if (exists) {
    const content = fs.readFileSync(FLASHCARDS_TEMPLATE, "utf-8");
    console.log("  Content length:", content.length + " chars");
    console.log("  Content preview:", content.substring(0, 100) + "...");
  }
} catch (error) {
  console.log("❌ Web app import failed:", error.message);
}

console.log("\n🧮 Testing what the current web app files expect:\n");

// Test the exact same pattern used in the web app files
try {
  const templatesPackage = require("@soroban/templates");
  console.log("✅ Package structure:");
  console.log("  Available exports:", Object.keys(templatesPackage));
  console.log(
    "  FLASHCARDS_TEMPLATE type:",
    typeof templatesPackage.FLASHCARDS_TEMPLATE,
  );
  console.log(
    "  SINGLE_CARD_TEMPLATE type:",
    typeof templatesPackage.SINGLE_CARD_TEMPLATE,
  );
} catch (error) {
  console.log("❌ Package import failed:", error.message);
}
