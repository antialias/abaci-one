#!/usr/bin/env node

// Extract viewBox from crop marks in Typst-generated SVGs
// This demonstrates how to use crop marks for automated SVG processing

const fs = require('fs');

function extractViewBoxFromCropMarks(svgPath) {
    console.log(`📐 Analyzing crop marks in ${svgPath}...`);

    if (!fs.existsSync(svgPath)) {
        throw new Error(`SVG file not found: ${svgPath}`);
    }

    const svgContent = fs.readFileSync(svgPath, 'utf8');

    // Use regex to find crop mark links and their positions
    const cropMarks = {};

    // Pattern to match link elements with crop-mark hrefs and their transforms
    const linkPattern = /<use[^>]*xlink:href="(crop-mark:\/\/[^"]*)"[^>]*\/?>|<g[^>]*>\s*<path[^>]*\/>\s*<\/g>/g;

    // Simpler approach: find crop mark red rectangles and their containing transforms
    const redRectPattern = /<g transform="translate\(([^)]+)\)"[^>]*>\s*<path[^>]*fill="#ff4136"[^>]*\/>\s*<\/g>/g;

    let match;
    let markIndex = 0;
    const markTypes = ['left', 'right', 'top', 'bottom']; // Expected order from our implementation

    while ((match = redRectPattern.exec(svgContent)) !== null) {
        const coords = match[1].split(/[,\s]+/).map(Number);
        const x = coords[0] || 0;
        const y = coords[1] || 0;

        if (markIndex < markTypes.length) {
            const markType = markTypes[markIndex];
            cropMarks[markType] = { x, y };
            console.log(`  ✅ Found ${markType} at (${x}, ${y})`);
            markIndex++;
        }
    }

    if (Object.keys(cropMarks).length === 0) {
        console.log('  ⚠️  No crop marks found in this SVG');
        return null;
    }

    // Calculate viewBox from crop mark positions
    const positions = Object.values(cropMarks);
    const minX = Math.min(...positions.map(p => p.x));
    const maxX = Math.max(...positions.map(p => p.x));
    const minY = Math.min(...positions.map(p => p.y));
    const maxY = Math.max(...positions.map(p => p.y));

    const width = maxX - minX;
    const height = maxY - minY;

    const viewBox = `${minX} ${minY} ${width} ${height}`;

    console.log(`📏 Calculated viewBox: "${viewBox}"`);
    console.log(`  📊 Dimensions: ${width} × ${height}`);
    console.log(`  📍 Origin: (${minX}, ${minY})`);

    return {
        viewBox,
        width,
        height,
        minX,
        minY,
        maxX,
        maxY,
        cropMarks
    };
}

function updateSVGViewBox(inputPath, outputPath = null) {
    const result = extractViewBoxFromCropMarks(inputPath);
    if (!result) {
        console.log('❌ Cannot update viewBox - no crop marks found');
        return false;
    }

    const svgContent = fs.readFileSync(inputPath, 'utf8');

    // Update the viewBox attribute
    const updatedSVG = svgContent.replace(
        /viewBox="[^"]*"/,
        `viewBox="${result.viewBox}"`
    );

    const output = outputPath || inputPath.replace('.svg', '-cropped.svg');
    fs.writeFileSync(output, updatedSVG);

    console.log(`✅ Updated SVG saved to ${output}`);
    return true;
}

// CLI usage
if (require.main === module) {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        console.log('Usage: node extract-viewbox.js <svg-file> [output-file]');
        console.log('');
        console.log('Examples:');
        console.log('  node extract-viewbox.js gallery/debug-crop-marks-89.svg');
        console.log('  node extract-viewbox.js gallery/crop-single-1.svg cropped.svg');
        process.exit(1);
    }

    const [inputFile, outputFile] = args;

    try {
        if (outputFile) {
            updateSVGViewBox(inputFile, outputFile);
        } else {
            extractViewBoxFromCropMarks(inputFile);
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

module.exports = { extractViewBoxFromCropMarks, updateSVGViewBox };