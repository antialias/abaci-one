#!/usr/bin/env node

// Unit test for crop mark positioning to prevent regressions
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Test cases with expected crop mark properties
const testCases = [
    {
        id: 'single-digit',
        number: 7,
        config: {
            bead_shape: 'diamond',
            color_scheme: 'monochrome',
            show_crop_marks: true,
            crop_margin: '10pt',
            base_size: 1.0
        },
        expectedProperties: {
            cropMarkCount: 4,
            leftMarkShouldBeNegative: true,
            rightMarkShouldBePositive: true,
            topMarkShouldBeSmall: true,
            bottomMarkShouldBeLarge: true,
            marksWithinSorobanBounds: true
        }
    },
    {
        id: 'multi-digit',
        number: 123,
        config: {
            bead_shape: 'circle',
            color_scheme: 'place-value',
            show_crop_marks: true,
            crop_margin: '15pt',
            base_size: 1.2
        },
        expectedProperties: {
            cropMarkCount: 4,
            leftMarkShouldBeNegative: true,
            rightMarkShouldBePositive: true,
            topMarkShouldBeSmall: true,
            bottomMarkShouldBeLarge: true,
            marksWithinSorobanBounds: true
        }
    },
    {
        id: 'large-scale',
        number: 5,
        config: {
            bead_shape: 'square',
            color_scheme: 'heaven-earth',
            show_crop_marks: true,
            crop_margin: '20pt',
            base_size: 2.0
        },
        expectedProperties: {
            cropMarkCount: 4,
            leftMarkShouldBeNegative: true,
            rightMarkShouldBePositive: true,
            topMarkShouldBeSmall: true,
            bottomMarkShouldBeLarge: true,
            marksWithinSorobanBounds: true
        }
    }
];

function parseSVGCropMarks(svgContent) {
    const cropMarks = [];
    const translateRegex = /transform="translate\(([^)]+)\)"/g;
    let match;

    while ((match = translateRegex.exec(svgContent)) !== null) {
        const coords = match[1].trim().split(/\s+/);
        const x = parseFloat(coords[0]);
        const y = parseFloat(coords[1]);

        // Get the element context to determine if it's a crop mark
        const elementStart = svgContent.lastIndexOf('<g', match.index);
        const elementEnd = svgContent.indexOf('</g>', match.index);
        const elementContent = svgContent.substring(elementStart, elementEnd);

        // Check if this is a crop mark (red fill)
        const isCropMark = elementContent.includes('fill="#ff4136"');

        if (isCropMark) {
            // Extract dimensions from path elements
            const pathMatch = elementContent.match(/d="M\s+0\s+0\s+L\s+0\s+(\d+)\s+L\s+(\d+)\s+\d+\s+L\s+\d+\s+0\s+Z\s*"/);
            if (pathMatch) {
                const width = parseFloat(pathMatch[2]);
                const height = parseFloat(pathMatch[1]);
                cropMarks.push({
                    x: x,
                    y: y,
                    width: width,
                    height: height,
                    right: x + width,
                    bottom: y + height
                });
            }
        }
    }

    return cropMarks;
}

function generateTestSVG(testCase) {
    const { number, config } = testCase;

    // Create minimal Typst file for testing
    const typstContent = `#import "flashcards.typ": draw-soroban

#set page(width: 200pt, height: 200pt, margin: 12pt, fill: white)

#let soroban-content = draw-soroban(
  ${number},
  bead-shape: "${config.bead_shape}",
  color-scheme: "${config.color_scheme}",
  base-size: ${config.base_size},
  show-crop-marks: ${config.show_crop_marks},
  crop-margin: ${config.crop_margin}
)

#align(center + horizon)[
  #soroban-content
]`;

    const typstFile = `test-${testCase.id}.typ`;
    const svgFile = `test-${testCase.id}.svg`;

    try {
        // Write and compile
        fs.writeFileSync(typstFile, typstContent);
        execSync(`typst compile --root . --format svg "${typstFile}" "${svgFile}"`, { stdio: 'pipe' });

        // Read SVG content
        const svgContent = fs.readFileSync(svgFile, 'utf8');

        // Clean up
        fs.unlinkSync(typstFile);
        fs.unlinkSync(svgFile);

        return svgContent;
    } catch (error) {
        // Clean up on error
        if (fs.existsSync(typstFile)) fs.unlinkSync(typstFile);
        if (fs.existsSync(svgFile)) fs.unlinkSync(svgFile);
        throw error;
    }
}

function validateCropMarks(cropMarks, expected, testId) {
    const results = [];

    // Test 1: Correct number of crop marks
    const countTest = {
        name: `${testId}: Crop mark count`,
        expected: expected.cropMarkCount,
        actual: cropMarks.length,
        pass: cropMarks.length === expected.cropMarkCount
    };
    results.push(countTest);

    if (cropMarks.length === 4) {
        // Sort crop marks by position for consistent testing
        const leftMark = cropMarks.reduce((min, mark) => mark.x < min.x ? mark : min);
        const rightMark = cropMarks.reduce((max, mark) => mark.right > max.right ? mark : max);
        const topMark = cropMarks.reduce((min, mark) => mark.y < min.y ? mark : min);
        const bottomMark = cropMarks.reduce((max, mark) => mark.bottom > max.bottom ? mark : max);

        // Test 2: Left mark should be negative (extends beyond soroban bounds)
        if (expected.leftMarkShouldBeNegative) {
            results.push({
                name: `${testId}: Left mark extends beyond left bound`,
                expected: '< 0',
                actual: leftMark.x,
                pass: leftMark.x < 0
            });
        }

        // Test 3: Right mark should be positive and reasonable
        if (expected.rightMarkShouldBePositive) {
            results.push({
                name: `${testId}: Right mark extends beyond soroban`,
                expected: '> 0',
                actual: rightMark.right,
                pass: rightMark.right > 0
            });
        }

        // Test 4: Top mark should be at small Y value
        if (expected.topMarkShouldBeSmall) {
            results.push({
                name: `${testId}: Top mark positioned near top`,
                expected: '< 50',
                actual: topMark.y,
                pass: topMark.y < 50
            });
        }

        // Test 5: Bottom mark should be at larger Y value than top
        if (expected.bottomMarkShouldBeLarge) {
            results.push({
                name: `${testId}: Bottom mark below top mark`,
                expected: `> ${topMark.y}`,
                actual: bottomMark.bottom,
                pass: bottomMark.bottom > topMark.y
            });
        }

        // Test 6: Marks should be within reasonable soroban coordinate space
        if (expected.marksWithinSorobanBounds) {
            const allMarksReasonable = cropMarks.every(mark =>
                mark.x > -100 && mark.x < 300 &&
                mark.y > -50 && mark.y < 300
            );
            results.push({
                name: `${testId}: All marks within reasonable bounds`,
                expected: 'reasonable coordinates',
                actual: `x: [${Math.min(...cropMarks.map(m => m.x))}, ${Math.max(...cropMarks.map(m => m.right))}], y: [${Math.min(...cropMarks.map(m => m.y))}, ${Math.max(...cropMarks.map(m => m.bottom))}]`,
                pass: allMarksReasonable
            });
        }
    }

    return results;
}

async function runUnitTests() {
    console.log('🧪 Running Crop Mark Unit Tests...\n');

    let totalTests = 0;
    let passedTests = 0;
    const failedTests = [];

    for (const testCase of testCases) {
        console.log(`📋 Testing: ${testCase.id} (number: ${testCase.number})`);

        try {
            // Generate SVG for test case
            const svgContent = generateTestSVG(testCase);

            // Parse crop marks
            const cropMarks = parseSVGCropMarks(svgContent);

            // Validate crop marks
            const results = validateCropMarks(cropMarks, testCase.expectedProperties, testCase.id);

            // Report results
            for (const result of results) {
                totalTests++;
                if (result.pass) {
                    console.log(`   ✅ ${result.name}`);
                    passedTests++;
                } else {
                    console.log(`   ❌ ${result.name}: expected ${result.expected}, got ${result.actual}`);
                    failedTests.push(result);
                }
            }

        } catch (error) {
            console.log(`   ❌ Failed to generate/test ${testCase.id}: ${error.message}`);
            totalTests++;
            failedTests.push({
                name: `${testCase.id}: Generation failed`,
                error: error.message
            });
        }

        console.log(); // Empty line between test cases
    }

    // Summary
    console.log('📊 Test Summary:');
    console.log(`   Total tests: ${totalTests}`);
    console.log(`   Passed: ${passedTests}`);
    console.log(`   Failed: ${failedTests.length}`);

    if (failedTests.length === 0) {
        console.log('\n🎉 All crop mark tests passed! No regressions detected.');
        return true;
    } else {
        console.log('\n💥 Some tests failed. Potential regression detected:');
        failedTests.forEach(test => {
            console.log(`   - ${test.name}${test.error ? ': ' + test.error : ''}`);
        });
        return false;
    }
}

// Export for use in other scripts
module.exports = { runUnitTests, testCases, validateCropMarks, parseSVGCropMarks };

// Run tests if called directly
if (require.main === module) {
    runUnitTests().then(success => {
        process.exit(success ? 0 : 1);
    }).catch(error => {
        console.error('❌ Test runner failed:', error);
        process.exit(1);
    });
}