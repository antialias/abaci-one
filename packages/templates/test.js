#!/usr/bin/env node

/**
 * Comprehensive test suite for @soroban/templates package
 * Tests Node.js/TypeScript interface and file integrity
 */

const fs = require("fs");
const path = require("path");
const {
  FLASHCARDS_TEMPLATE,
  SINGLE_CARD_TEMPLATE,
  getTemplatePath,
} = require("./index.js");

// Test configuration
const TESTS = [];
let testCount = 0;
let passedTests = 0;

function test(name, fn) {
  TESTS.push({ name, fn });
}

function assert(condition, message) {
  testCount++;
  if (condition) {
    passedTests++;
    console.log("  ✅", message);
  } else {
    console.log("  ❌", message);
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertEqual(actual, expected, message) {
  assert(
    actual === expected,
    `${message} (expected: ${expected}, got: ${actual})`,
  );
}

function assertContains(content, substring, message) {
  assert(
    content.includes(substring),
    `${message} (should contain: ${substring})`,
  );
}

function runTests() {
  console.log("🧮 @soroban/templates - Node.js Test Suite");
  console.log("==========================================\n");

  for (const { name, fn } of TESTS) {
    console.log(`🔍 ${name}`);
    try {
      fn();
      console.log("");
    } catch (error) {
      console.log(`  💥 Test failed: ${error.message}\n`);
      process.exit(1);
    }
  }

  console.log(`🎉 All tests passed! (${passedTests}/${testCount})`);
}

// Test: Package Structure
test("Package Structure Validation", () => {
  assert(
    typeof FLASHCARDS_TEMPLATE === "string",
    "FLASHCARDS_TEMPLATE should be a string",
  );
  assert(
    typeof SINGLE_CARD_TEMPLATE === "string",
    "SINGLE_CARD_TEMPLATE should be a string",
  );
  assert(
    typeof getTemplatePath === "function",
    "getTemplatePath should be a function",
  );

  assert(
    FLASHCARDS_TEMPLATE.endsWith("flashcards.typ"),
    "FLASHCARDS_TEMPLATE should end with flashcards.typ",
  );
  assert(
    SINGLE_CARD_TEMPLATE.endsWith("single-card.typ"),
    "SINGLE_CARD_TEMPLATE should end with single-card.typ",
  );
});

// Test: File Existence
test("Template File Existence", () => {
  assert(
    fs.existsSync(FLASHCARDS_TEMPLATE),
    "flashcards.typ file should exist",
  );
  assert(
    fs.existsSync(SINGLE_CARD_TEMPLATE),
    "single-card.typ file should exist",
  );

  const flashcardsStats = fs.statSync(FLASHCARDS_TEMPLATE);
  const singleCardStats = fs.statSync(SINGLE_CARD_TEMPLATE);

  assert(flashcardsStats.isFile(), "flashcards.typ should be a file");
  assert(singleCardStats.isFile(), "single-card.typ should be a file");
  assert(
    flashcardsStats.size > 1000,
    "flashcards.typ should be substantial (>1KB)",
  );
  assert(
    singleCardStats.size > 1000,
    "single-card.typ should be substantial (>1KB)",
  );
});

// Test: Template Content Validation
test("Template Content Validation", () => {
  const flashcardsContent = fs.readFileSync(FLASHCARDS_TEMPLATE, "utf-8");
  const singleCardContent = fs.readFileSync(SINGLE_CARD_TEMPLATE, "utf-8");

  assertContains(
    flashcardsContent,
    "draw-soroban",
    "flashcards.typ should contain draw-soroban function",
  );
  assertContains(
    singleCardContent,
    "generate-single-card",
    "single-card.typ should contain generate-single-card function",
  );

  // Check for common Typst syntax
  assertContains(
    flashcardsContent,
    "#let",
    "flashcards.typ should use Typst function syntax",
  );
  assertContains(
    singleCardContent,
    "#let",
    "single-card.typ should use Typst function syntax",
  );

  // Check for soroban-specific content
  assertContains(
    flashcardsContent,
    "bead",
    "flashcards.typ should reference beads",
  );
  assertContains(
    flashcardsContent,
    "column",
    "flashcards.typ should reference columns",
  );
});

// Test: Dynamic Path Resolution
test("Dynamic Path Resolution", () => {
  const dynamicFlashcards = getTemplatePath("flashcards.typ");
  const dynamicSingleCard = getTemplatePath("single-card.typ");

  assertEqual(
    dynamicFlashcards,
    FLASHCARDS_TEMPLATE,
    "getTemplatePath should resolve flashcards.typ correctly",
  );
  assertEqual(
    dynamicSingleCard,
    SINGLE_CARD_TEMPLATE,
    "getTemplatePath should resolve single-card.typ correctly",
  );

  // Test error handling
  try {
    getTemplatePath("nonexistent.typ");
    assert(false, "getTemplatePath should throw for nonexistent files");
  } catch (error) {
    assert(
      error.message.includes("not found"),
      "getTemplatePath should provide meaningful error messages",
    );
  }
});

// Test: Path Properties
test("Path Properties and Security", () => {
  // Ensure paths are absolute
  assert(
    path.isAbsolute(FLASHCARDS_TEMPLATE),
    "FLASHCARDS_TEMPLATE should be absolute path",
  );
  assert(
    path.isAbsolute(SINGLE_CARD_TEMPLATE),
    "SINGLE_CARD_TEMPLATE should be absolute path",
  );

  // Ensure paths point to correct directory
  const templatesDir = path.dirname(FLASHCARDS_TEMPLATE);
  const expectedTemplatesDir = path.dirname(SINGLE_CARD_TEMPLATE);
  assertEqual(
    templatesDir,
    expectedTemplatesDir,
    "Both templates should be in same directory",
  );
  assert(
    templatesDir.includes("templates"),
    "Templates should be in templates directory",
  );
});

// Test: Multiple Import Styles
test("Import Compatibility", () => {
  // Test CommonJS require
  const cjsImport = require("./index.js");
  assert(
    typeof cjsImport.FLASHCARDS_TEMPLATE === "string",
    "CommonJS import should work",
  );

  // Test destructuring
  const { FLASHCARDS_TEMPLATE: destructured } = require("./index.js");
  assertEqual(
    destructured,
    FLASHCARDS_TEMPLATE,
    "Destructuring import should work",
  );
});

// Test: File Permissions and Readability
test("File Access and Permissions", () => {
  try {
    fs.accessSync(FLASHCARDS_TEMPLATE, fs.constants.R_OK);
    assert(true, "flashcards.typ should be readable");
  } catch (error) {
    assert(false, "flashcards.typ should have read permissions");
  }

  try {
    fs.accessSync(SINGLE_CARD_TEMPLATE, fs.constants.R_OK);
    assert(true, "single-card.typ should be readable");
  } catch (error) {
    assert(false, "single-card.typ should have read permissions");
  }
});

// Test: Template Encoding
test("Template Encoding and Character Set", () => {
  const flashcardsContent = fs.readFileSync(FLASHCARDS_TEMPLATE, "utf-8");
  const singleCardContent = fs.readFileSync(SINGLE_CARD_TEMPLATE, "utf-8");

  // Test for valid UTF-8 encoding
  assert(
    typeof flashcardsContent === "string",
    "flashcards.typ should decode as valid UTF-8",
  );
  assert(
    typeof singleCardContent === "string",
    "single-card.typ should decode as valid UTF-8",
  );

  // Test for reasonable line count
  const flashcardsLines = flashcardsContent.split("\n").length;
  const singleCardLines = singleCardContent.split("\n").length;

  assert(
    flashcardsLines > 10,
    "flashcards.typ should have substantial content (>10 lines)",
  );
  assert(
    singleCardLines > 10,
    "single-card.typ should have substantial content (>10 lines)",
  );
});

// Test: Package Metadata Consistency
test("Package Metadata Consistency", () => {
  const packageJson = require("./package.json");

  assertEqual(
    packageJson.name,
    "@soroban/templates",
    "Package name should be correct",
  );
  assertEqual(packageJson.main, "index.js", "Main entry should be index.js");
  assertEqual(
    packageJson.types,
    "index.d.ts",
    "Types entry should be index.d.ts",
  );

  // Check that declared files exist
  const declaredFiles = packageJson.files || [];
  const templateFiles = declaredFiles.filter(
    (f) => f.includes(".typ") || f === "*.typ",
  );
  assert(templateFiles.length > 0, "Package should declare template files");
});

// Run all tests
runTests();
