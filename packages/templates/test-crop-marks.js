#!/usr/bin/env node

// Test script to verify crop marks are positioned at SVG extremes
const fs = require('fs');
const path = require('path');

function parseSVG(svgContent) {
    const elements = [];
    const cropMarks = [];

    // Extract all transform="translate(x y)" patterns
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
        const isCropMark = elementContent.includes('fill="#ff4136"') ||
                          elementContent.includes('fill="red"');


        if (isCropMark) {
            // Extract dimensions from path elements in crop marks
            // Path format: "M 0 0 L 0 3 L 3 3 L 3 0 Z" means 3x3 rectangle
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
        } else {
            // Extract dimensions for content elements
            let width = 0, height = 0;

            // Look for rect elements
            const rectMatch = elementContent.match(/d="M\s+([^"]+)"/);
            if (rectMatch) {
                // Parse path data to get approximate bounds
                const pathData = rectMatch[1];
                const coords = pathData.match(/(\d+\.?\d*)/g);
                if (coords && coords.length >= 4) {
                    width = Math.max(...coords.map(parseFloat)) - Math.min(...coords.map(parseFloat));
                    height = Math.max(...coords.slice(1).filter((_, i) => i % 2 === 1).map(parseFloat)) -
                           Math.min(...coords.slice(1).filter((_, i) => i % 2 === 1).map(parseFloat));
                }
            }

            // Look for direct width/height attributes
            const widthMatch = elementContent.match(/width="([^"]+)"/);
            const heightMatch = elementContent.match(/height="([^"]+)"/);
            if (widthMatch) width = parseFloat(widthMatch[1]);
            if (heightMatch) height = parseFloat(heightMatch[1]);

            // For polygon elements (diamond beads), estimate size
            if (elementContent.includes('polygon') || elementContent.includes('L ')) {
                if (width === 0) width = 25; // Approximate bead width
                if (height === 0) height = 18; // Approximate bead height
            }

            elements.push({
                x: x,
                y: y,
                width: width,
                height: height,
                right: x + width,
                bottom: y + height
            });
        }
    }

    return { elements, cropMarks };
}

function calculateContentBounds(elements) {
    if (elements.length === 0) return null;

    const left = Math.min(...elements.map(e => e.x));
    const right = Math.max(...elements.map(e => e.right));
    const top = Math.min(...elements.map(e => e.y));
    const bottom = Math.max(...elements.map(e => e.bottom));

    return { left, right, top, bottom };
}

function testCropMarks(svgFile) {
    console.log(`\n🧪 Testing crop marks in ${svgFile}...`);

    const svgContent = fs.readFileSync(svgFile, 'utf8');
    const { elements, cropMarks } = parseSVG(svgContent);

    console.log(`   Found ${elements.length} content elements`);
    console.log(`   Found ${cropMarks.length} crop marks`);

    if (cropMarks.length !== 4) {
        console.log(`   ❌ Expected 4 crop marks, found ${cropMarks.length}`);
        return false;
    }

    const contentBounds = calculateContentBounds(elements);
    if (!contentBounds) {
        console.log(`   ❌ No content elements found`);
        return false;
    }

    console.log(`   Content bounds: left=${contentBounds.left}, right=${contentBounds.right}, top=${contentBounds.top}, bottom=${contentBounds.bottom}`);

    // Find crop marks by position
    const tolerance = 1; // Allow 1pt tolerance

    const leftMark = cropMarks.find(m => Math.abs(m.x - Math.min(...cropMarks.map(c => c.x))) < tolerance);
    const rightMark = cropMarks.find(m => Math.abs(m.right - Math.max(...cropMarks.map(c => c.right))) < tolerance);
    const topMark = cropMarks.find(m => Math.abs(m.y - Math.min(...cropMarks.map(c => c.y))) < tolerance);
    const bottomMark = cropMarks.find(m => Math.abs(m.bottom - Math.max(...cropMarks.map(c => c.bottom))) < tolerance);

    console.log(`   Crop marks: left=${leftMark?.x}, right=${rightMark?.right}, top=${topMark?.y}, bottom=${bottomMark?.bottom}`);

    let passed = true;
    const tests = [
        {
            name: "Left crop mark is leftmost element",
            actual: leftMark?.x,
            expected: "<= " + contentBounds.left,
            pass: leftMark && leftMark.x <= contentBounds.left
        },
        {
            name: "Right crop mark is rightmost element",
            actual: rightMark?.right,
            expected: "> " + contentBounds.right,
            pass: rightMark && rightMark.right > contentBounds.right
        },
        {
            name: "Top crop mark is topmost element",
            actual: topMark?.y,
            expected: "<= " + contentBounds.top,
            pass: topMark && topMark.y <= contentBounds.top
        },
        {
            name: "Bottom crop mark is bottommost element",
            actual: bottomMark?.bottom,
            expected: "> " + contentBounds.bottom,
            pass: bottomMark && bottomMark.bottom > contentBounds.bottom
        }
    ];

    for (const test of tests) {
        if (test.pass) {
            console.log(`   ✅ ${test.name}: ${test.actual} ${test.expected}`);
        } else {
            console.log(`   ❌ ${test.name}: ${test.actual} should be ${test.expected}`);
            passed = false;
        }
    }

    return passed;
}

async function main() {
    console.log('🧪 Testing crop mark positioning...\n');

    const debugFiles = [
        'gallery/debug-crop-marks-89.svg',
        'gallery/debug-crop-marks-456.svg'
    ];

    let allPassed = true;

    for (const file of debugFiles) {
        if (fs.existsSync(file)) {
            const passed = testCropMarks(file);
            if (!passed) allPassed = false;
        } else {
            console.log(`❌ File not found: ${file}`);
            allPassed = false;
        }
    }

    console.log('\n📊 Test Summary:');
    if (allPassed) {
        console.log('✅ All crop mark tests passed!');
    } else {
        console.log('❌ Some crop mark tests failed. Crop marks need repositioning.');
    }

    return allPassed;
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { testCropMarks, main };