#!/usr/bin/env node

/**
 * Comprehensive test suite for SVG post-processor functionality
 * Tests all aspects of svg-crop-processor.js exports and processing
 */

const fs = require('fs');
const path = require('path');
const {
  processSVG,
  processSVGFile,
  extractCropMarks,
  extractBeadAnnotations,
  SVGCropError
} = require('./index.js');

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
    console.log('  ✅', message);
  } else {
    console.log('  ❌', message);
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertEqual(actual, expected, message) {
  assert(actual === expected, `${message} (expected: ${expected}, got: ${actual})`);
}

function assertContains(content, substring, message) {
  assert(content.includes(substring), `${message} (should contain: ${substring})`);
}

function assertGreaterThan(actual, expected, message) {
  assert(actual > expected, `${message} (expected > ${expected}, got: ${actual})`);
}

function assertInstanceOf(obj, constructor, message) {
  assert(obj instanceof constructor, `${message} (expected instance of ${constructor.name})`);
}

// Sample SVG with crop marks for testing
const SAMPLE_SVG_WITH_CROP_MARKS = `<svg class="typst-doc" viewBox="0 0 270 210" width="270pt" height="210pt" xmlns="http://www.w3.org/2000/svg">
  <path class="typst-shape" fill="#ffffff" fill-rule="nonzero" d="M 0 0 L 0 210 L 270 210 L 270 0 Z "/>
  <g>
    <g transform="translate(97.5 17.5)">
      <g class="typst-group">
        <g>
          <g transform="translate(0 0)">
            <g class="typst-group">
              <g>
                <g transform="translate(16.5 26)">
                  <path class="typst-shape" fill="#eeeeee" fill-rule="nonzero" d="M 0 0 L 0 104.5 L 4.5 104.5 L 4.5 0 Z "/>
                </g>
                <g transform="translate(-25.2 -18)">
                  <path class="typst-shape" fill="#ff4136" fill-rule="nonzero" d="M 0 0 L 0 0.1 L 0.1 0.1 L 0.1 0 Z "/>
                </g>
                <g transform="translate(100.2 -18)">
                  <path class="typst-shape" fill="#ff4136" fill-rule="nonzero" d="M 0 0 L 0 0.1 L 0.1 0.1 L 0.1 0 Z "/>
                </g>
                <g transform="translate(36 -18)">
                  <path class="typst-shape" fill="#ff4136" fill-rule="nonzero" d="M 0 0 L 0 0.1 L 0.1 0.1 L 0.1 0 Z "/>
                </g>
                <g transform="translate(36 187)">
                  <path class="typst-shape" fill="#ff4136" fill-rule="nonzero" d="M 0 0 L 0 0.1 L 0.1 0.1 L 0.1 0 Z "/>
                </g>
              </g>
            </g>
          </g>
        </g>
      </g>
    </g>
  </g>
</svg>`;

// Sample SVG with bead annotations for testing
const SAMPLE_SVG_WITH_BEAD_LINKS = `<svg class="typst-doc" viewBox="0 0 200 150" width="200pt" height="150pt" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <g>
    <a href="bead://heaven-col1-active1">
      <path class="typst-shape" fill="#2e86ab" d="M 21 0 L 42 15 L 21 30 L 0 15 Z"/>
    </a>
    <g transform="translate(50 0)">
      <a href="bead://earth-col1-pos1-active0">
        <path class="typst-shape" fill="#e6e6e6" d="M 21 0 L 42 15 L 21 30 L 0 15 Z"/>
      </a>
    </g>
  </g>
</svg>`;

// Sample SVG without crop marks
const SAMPLE_SVG_NO_CROP_MARKS = `<svg viewBox="0 0 100 100" width="100pt" height="100pt" xmlns="http://www.w3.org/2000/svg">
  <circle cx="50" cy="50" r="40" fill="blue"/>
</svg>`;

// Invalid SVG content
const INVALID_SVG = `<notsvg>invalid content</notsvg>`;

function runTests() {
  console.log('🧮 SVG Post-Processor Test Suite');
  console.log('=================================\n');

  for (const { name, fn } of TESTS) {
    console.log(`🔍 ${name}`);
    try {
      fn();
      console.log('');
    } catch (error) {
      console.log(`  💥 Test failed: ${error.message}\n`);
      process.exit(1);
    }
  }

  console.log(`🎉 All SVG processor tests passed! (${passedTests}/${testCount})`);
}

// Test: Export Validation
test('SVG Processor Export Validation', () => {
  assert(typeof processSVG === 'function', 'processSVG should be exported as function');
  assert(typeof processSVGFile === 'function', 'processSVGFile should be exported as function');
  assert(typeof extractCropMarks === 'function', 'extractCropMarks should be exported as function');
  assert(typeof extractBeadAnnotations === 'function', 'extractBeadAnnotations should be exported as function');
  assert(typeof SVGCropError === 'function', 'SVGCropError should be exported as constructor');
});

// Test: extractCropMarks Function
test('extractCropMarks Function', () => {
  // Note: extractCropMarks expects link-based crop marks (from typst.ts),
  // but gallery SVGs use coordinate-based crop marks (from Typst CLI).
  // So we test error handling and the interface.

  console.log('  ℹ️  Testing extractCropMarks interface (designed for typst.ts SVGs with link annotations)');

  // Test that the function exists and handles no crop marks correctly
  try {
    extractCropMarks(SAMPLE_SVG_NO_CROP_MARKS);
    assert(false, 'should throw when no crop marks found');
  } catch (error) {
    assertInstanceOf(error, SVGCropError, 'should throw SVGCropError');
    assertEqual(error.code, 'NO_CROP_MARKS', 'should have correct error code');
  }

  // Test with gallery SVG (which has coordinate-based, not link-based crop marks)
  if (fs.existsSync('gallery/crop-single-1.svg')) {
    const gallerySVG = fs.readFileSync('gallery/crop-single-1.svg', 'utf8');
    try {
      extractCropMarks(gallerySVG);
      assert(false, 'should not find link-based crop marks in Typst CLI SVG');
    } catch (error) {
      assertInstanceOf(error, SVGCropError, 'should throw for missing link annotations');
      assertEqual(error.code, 'NO_CROP_MARKS', 'gallery SVGs use coordinates, not links');
    }
  }
});

// Test: extractCropMarks Error Handling
test('extractCropMarks Error Handling', () => {
  // Test with no crop marks
  try {
    extractCropMarks(SAMPLE_SVG_NO_CROP_MARKS);
    assert(false, 'extractCropMarks should throw for SVG without crop marks');
  } catch (error) {
    assertInstanceOf(error, SVGCropError, 'should throw SVGCropError');
    assertEqual(error.code, 'NO_CROP_MARKS', 'should have correct error code');
  }

  // Test with invalid SVG
  try {
    extractCropMarks(INVALID_SVG);
    assert(false, 'extractCropMarks should throw for invalid SVG');
  } catch (error) {
    assertInstanceOf(error, SVGCropError, 'should throw SVGCropError for invalid SVG');
  }

  // Test with non-string input
  try {
    extractCropMarks(null);
    assert(false, 'extractCropMarks should throw for null input');
  } catch (error) {
    assertInstanceOf(error, SVGCropError, 'should throw SVGCropError for null');
    assertEqual(error.code, 'INVALID_INPUT', 'should have correct error code');
  }

  // Test with empty string
  try {
    extractCropMarks('');
    assert(false, 'extractCropMarks should throw for empty string');
  } catch (error) {
    assertInstanceOf(error, SVGCropError, 'should throw SVGCropError for empty string');
    assertEqual(error.code, 'EMPTY_INPUT', 'should have correct error code');
  }
});

// Test: extractBeadAnnotations Function
test('extractBeadAnnotations Function', () => {
  // Test with sample SVG that has bead links
  const result = extractBeadAnnotations(SAMPLE_SVG_WITH_BEAD_LINKS);

  assert(typeof result === 'object', 'extractBeadAnnotations should return object');
  assert(typeof result.processedSVG === 'string', 'result should have processedSVG string');
  assert(Array.isArray(result.beadLinks), 'result should have beadLinks array');
  assert(Array.isArray(result.warnings), 'result should have warnings array');
  assert(typeof result.count === 'number', 'result should have count number');

  assertEqual(result.count, 2, 'should find 2 bead links in sample SVG');
  assertGreaterThan(result.beadLinks.length, 0, 'should extract bead link data');

  // Test that links are converted to data attributes
  assertContains(result.processedSVG, 'data-bead-', 'processed SVG should contain data attributes');
  assert(!result.processedSVG.includes('href="bead://'), 'processed SVG should not contain bead:// links');

  // Test specific data attributes
  assertContains(result.processedSVG, 'data-bead-type="heaven"', 'should extract heaven bead type');
  assertContains(result.processedSVG, 'data-bead-column="1"', 'should extract column information');
  assertContains(result.processedSVG, 'data-bead-active="true"', 'should extract active state');
});

// Test: extractBeadAnnotations with no beads
test('extractBeadAnnotations with no bead links', () => {
  const result = extractBeadAnnotations(SAMPLE_SVG_NO_CROP_MARKS);

  assertEqual(result.count, 0, 'should find 0 bead links in SVG without beads');
  assertEqual(result.beadLinks.length, 0, 'beadLinks array should be empty');
  assertGreaterThan(result.warnings.length, 0, 'should generate warning for no beads found');
  assertEqual(result.processedSVG, SAMPLE_SVG_NO_CROP_MARKS, 'SVG should be unchanged when no beads found');
});

// Test: processSVG Function Integration
test('processSVG Function Integration', () => {
  // Test that processSVG throws when no crop marks are found
  try {
    processSVG(SAMPLE_SVG_WITH_BEAD_LINKS, {
      extractBeadAnnotations: true,
      preserveAspectRatio: false,
      removeCropMarks: false
    });
    assert(false, 'processSVG should throw when no crop marks found');
  } catch (error) {
    assertInstanceOf(error, SVGCropError, 'should throw SVGCropError');
    assertEqual(error.code, 'NO_CROP_MARKS', 'should have correct error code');
  }

  // Test processSVG interface exists and handles errors correctly
  assert(typeof processSVG === 'function', 'processSVG should be a function');
});

// Test: processSVG with bead annotation extraction
test('processSVG with bead annotation extraction', () => {
  // Test that processSVG throws even when bead extraction is enabled
  try {
    processSVG(SAMPLE_SVG_WITH_BEAD_LINKS, {
      extractBeadAnnotations: true,
      preserveAspectRatio: false,
      removeCropMarks: false
    });
    assert(false, 'should throw when no crop marks present even with bead extraction');
  } catch (error) {
    assertInstanceOf(error, SVGCropError, 'should throw SVGCropError');
    assertEqual(error.code, 'NO_CROP_MARKS', 'crop marks are required for processSVG');
  }
});

// Test: processSVG error handling
test('processSVG error handling', () => {
  // Test with invalid SVG
  try {
    processSVG(INVALID_SVG);
    assert(false, 'processSVG should throw for invalid SVG');
  } catch (error) {
    assertInstanceOf(error, SVGCropError, 'should throw SVGCropError');
  }

  // Test with SVG that has no crop marks but bead extraction enabled
  try {
    processSVG(SAMPLE_SVG_NO_CROP_MARKS);
    assert(false, 'processSVG should throw when no crop marks found');
  } catch (error) {
    assertInstanceOf(error, SVGCropError, 'should throw SVGCropError for missing crop marks');
    assertEqual(error.code, 'NO_CROP_MARKS', 'should have correct error code');
  }
});

// Test: SVGCropError class
test('SVGCropError class', () => {
  const error = new SVGCropError('Test message', 'TEST_CODE', { detail: 'test' });

  assertInstanceOf(error, Error, 'SVGCropError should extend Error');
  assertInstanceOf(error, SVGCropError, 'should be instance of SVGCropError');
  assertEqual(error.name, 'SVGCropError', 'should have correct name');
  assertEqual(error.message, 'Test message', 'should preserve message');
  assertEqual(error.code, 'TEST_CODE', 'should have code property');
  assert(typeof error.details === 'object', 'should have details object');
  assertEqual(error.details.detail, 'test', 'should preserve details');
});

// Test: processSVG with all options
test('processSVG with all options enabled - error handling', () => {
  // Create a complex SVG with bead links but no valid crop marks
  // (since current SVG processor expects link-based crop marks which don't exist in CLI-generated SVGs)
  const complexSVG = `<svg class="typst-doc" viewBox="0 0 270 210" width="270pt" height="210pt" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
    <g>
      <g transform="translate(97.5 17.5)">
        <g>
          <a href="bead://heaven-col1-active1">
            <path class="typst-shape" fill="#2e86ab" d="M 21 0 L 42 15 L 21 30 L 0 15 Z"/>
          </a>
          <g transform="translate(-25.2 -18)">
            <path class="typst-shape" fill="#ff4136" fill-rule="nonzero" d="M 0 0 L 0 0.1 L 0.1 0.1 L 0.1 0 Z "/>
          </g>
          <g transform="translate(100.2 -18)">
            <path class="typst-shape" fill="#ff4136" fill-rule="nonzero" d="M 0 0 L 0 0.1 L 0.1 0.1 L 0.1 0 Z "/>
          </g>
          <g transform="translate(36 -18)">
            <path class="typst-shape" fill="#ff4136" fill-rule="nonzero" d="M 0 0 L 0 0.1 L 0.1 0.1 L 0.1 0 Z "/>
          </g>
          <g transform="translate(36 187)">
            <path class="typst-shape" fill="#ff4136" fill-rule="nonzero" d="M 0 0 L 0 0.1 L 0.1 0.1 L 0.1 0 Z "/>
          </g>
        </g>
      </g>
    </g>
  </svg>`;

  // Test that processSVG throws even with complex SVG and all options
  // because it still requires link-based crop marks which CLI SVGs don't have
  try {
    processSVG(complexSVG, {
      extractBeadAnnotations: true,
      preserveAspectRatio: true,
      removeCropMarks: false
    });
    assert(false, 'should throw even with complex SVG when crop marks are missing');
  } catch (error) {
    assertInstanceOf(error, SVGCropError, 'should throw SVGCropError');
    assertEqual(error.code, 'NO_CROP_MARKS', 'processSVG requires link-based crop marks');
  }

  // Test that bead extraction still works independently
  const beadResult = extractBeadAnnotations(complexSVG);
  assertEqual(beadResult.count, 1, 'should extract beads even when crop marks fail');
  assertContains(beadResult.processedSVG, 'data-bead-', 'should contain bead data attributes');
  assert(!beadResult.processedSVG.includes('href="bead://'), 'should remove bead links');
});

// Test: Bead data parsing accuracy
test('Bead data parsing accuracy', () => {
  const beadSVG = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
    <a href="bead://heaven-col3-active1">
      <path fill="#blue" d="M 0 0 L 10 10"/>
    </a>
    <a href="bead://earth-col2-pos4-active0">
      <path fill="#red" d="M 20 20 L 30 30"/>
    </a>
  </svg>`;

  const result = extractBeadAnnotations(beadSVG);

  assertEqual(result.count, 2, 'should find 2 beads');

  // Test heaven bead data
  const heavenBead = result.beadLinks.find(link => link.id === 'heaven-col3-active1');
  assert(heavenBead, 'should find heaven bead');
  assertEqual(heavenBead.data.type, 'heaven', 'should parse heaven type');
  assertEqual(heavenBead.data.column, 3, 'should parse column 3');
  assertEqual(heavenBead.data.active, true, 'should parse active state true');

  // Test earth bead data
  const earthBead = result.beadLinks.find(link => link.id === 'earth-col2-pos4-active0');
  assert(earthBead, 'should find earth bead');
  assertEqual(earthBead.data.type, 'earth', 'should parse earth type');
  assertEqual(earthBead.data.column, 2, 'should parse column 2');
  assertEqual(earthBead.data.earthPosition, 4, 'should parse earth position 4');
  assertEqual(earthBead.data.active, false, 'should parse active state false');
});

// Test: Edge cases and boundary conditions
test('Edge cases and boundary conditions', () => {
  // Test extractCropMarks error handling with coordinate-based crop marks
  // (current processor expects link-based crop marks from typst.ts)
  try {
    extractCropMarks(`<svg viewBox="0 0 10 10">
      <g transform="translate(2 1)">
        <g transform="translate(-1 -1)">
          <path fill="#ff4136" d="M 0 0 L 0 0.1 L 0.1 0.1 L 0.1 0 Z"/>
        </g>
        <g transform="translate(8 -1)">
          <path fill="#ff4136" d="M 0 0 L 0 0.1 L 0.1 0.1 L 0.1 0 Z"/>
        </g>
        <g transform="translate(4 -1)">
          <path fill="#ff4136" d="M 0 0 L 0 0.1 L 0.1 0.1 L 0.1 0 Z"/>
        </g>
        <g transform="translate(4 8)">
          <path fill="#ff4136" d="M 0 0 L 0 0.1 L 0.1 0.1 L 0.1 0 Z"/>
        </g>
      </g>
    </svg>`);
    assert(false, 'should throw for coordinate-based crop marks');
  } catch (error) {
    assertInstanceOf(error, SVGCropError, 'should throw SVGCropError for coordinate crop marks');
    assertEqual(error.code, 'NO_CROP_MARKS', 'coordinate marks not recognized as link-based');
  }

  // Test large numbers in bead IDs
  const largeBead = extractBeadAnnotations('<svg xmlns:xlink="http://www.w3.org/1999/xlink"><a href="bead://earth-col999-pos99-active1"><rect/></a></svg>');
  assertEqual(largeBead.count, 1, 'should handle large column numbers');
  assertEqual(largeBead.beadLinks[0].data.column, 999, 'should parse large column correctly');
  assertEqual(largeBead.beadLinks[0].data.earthPosition, 99, 'should parse large position correctly');
});

// Run all tests
runTests();