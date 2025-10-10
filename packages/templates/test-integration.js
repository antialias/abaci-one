#!/usr/bin/env node

/**
 * Integration test for templates package
 * Quick smoke test to verify basic functionality
 */

const fs = require("fs");

console.log("🔗 Integration Test - @soroban/templates");

try {
  console.log("Testing Node.js interface...");
  console.log("Current working directory:", process.cwd());

  const {
    FLASHCARDS_TEMPLATE,
    SINGLE_CARD_TEMPLATE,
    getTemplatePath,
  } = require(".");

  console.log("Template paths:");
  console.log("  FLASHCARDS_TEMPLATE:", FLASHCARDS_TEMPLATE);
  console.log("  SINGLE_CARD_TEMPLATE:", SINGLE_CARD_TEMPLATE);

  if (!fs.existsSync(FLASHCARDS_TEMPLATE)) {
    throw new Error(`Flashcards template not found: ${FLASHCARDS_TEMPLATE}`);
  }

  if (!fs.existsSync(SINGLE_CARD_TEMPLATE)) {
    throw new Error(`Single card template not found: ${SINGLE_CARD_TEMPLATE}`);
  }

  const dynamicPath = getTemplatePath("flashcards.typ");
  console.log("Dynamic path resolved to:", dynamicPath);

  if (!fs.existsSync(dynamicPath)) {
    throw new Error(`Dynamic path resolution failed: ${dynamicPath}`);
  }

  console.log("✓ Node.js interface working");
  console.log("✅ Integration test passed");
} catch (error) {
  console.error("❌ Integration test failed:", error.message);
  console.error("Error stack:", error.stack);
  process.exit(1);
}
