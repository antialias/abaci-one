#!/usr/bin/env node

/**
 * SVG Post-Processor for Typst-generated Soroban Templates
 *
 * Converts Typst link annotations into HTML data attributes for easier
 * programmatic manipulation of generated SVG files.
 *
 * Usage:
 *   node svg-post-processor.js input.svg output.svg
 *
 * Processes:
 *   - Bead annotations: link("bead://col1-ones-heaven") -> data-bead-* attributes
 *   - Crop mark annotations: link("crop-mark://top-left") -> data-crop-* attributes
 */

const fs = require('fs');
const path = require('path');

// Use jsdom if available, fallback to regex-based processing
let JSDOM;
try {
  JSDOM = require('jsdom').JSDOM;
} catch (e) {
  console.warn('jsdom not found, using fallback regex processing');
}

function processWithJSDOM(svgContent) {
  const dom = new JSDOM(svgContent);
  const document = dom.window.document;

  // Find all elements with href attributes (Typst link annotations)
  const linkedElements = document.querySelectorAll('[href]');
  let processedCount = 0;

  linkedElements.forEach(element => {
    const href = element.getAttribute('href');

    if (href.startsWith('bead://')) {
      // Extract bead information: bead://col1-ones-heaven or bead://col2-tens-earth-1
      const beadInfo = href.replace('bead://', '');
      const parts = beadInfo.split('-');

      if (parts.length >= 3) {
        const column = parts[0];  // col1, col2, etc.
        const position = parts[1]; // ones, tens, hundreds, etc.
        const type = parts[2];     // heaven, earth
        const index = parts[3];    // For earth beads: 1, 2, 3, 4

        element.setAttribute('data-bead-column', column);
        element.setAttribute('data-bead-position', position);
        element.setAttribute('data-bead-type', type);
        element.setAttribute('data-element-type', 'bead');

        if (index) {
          element.setAttribute('data-bead-index', index);
        }

        processedCount++;
      }
    }
    else if (href.startsWith('crop-mark://')) {
      // Extract crop mark position: crop-mark://top-left
      const position = href.replace('crop-mark://', '');

      element.setAttribute('data-crop-position', position);
      element.setAttribute('data-element-type', 'crop-mark');

      // Add CSS class for easier styling
      const currentClass = element.getAttribute('class') || '';
      element.setAttribute('class', `${currentClass} crop-mark crop-mark-${position}`.trim());

      processedCount++;
    }

    // Remove the original href attribute
    element.removeAttribute('href');
  });

  return {
    content: dom.serialize(),
    processedCount
  };
}

function processWithRegex(svgContent) {
  let processedCount = 0;

  // Process bead links: <a href="bead://col1-ones-heaven"><g>...</g></a>
  let result = svgContent.replace(
    /<a[^>]*href="bead:\/\/([^"]+)"[^>]*>(.*?)<\/a>/gs,
    (match, beadInfo, content) => {
      const parts = beadInfo.split('-');
      if (parts.length >= 3) {
        const column = parts[0];
        const position = parts[1];
        const type = parts[2];
        const index = parts[3];

        let dataAttrs = `data-bead-column="${column}" data-bead-position="${position}" data-bead-type="${type}" data-element-type="bead"`;
        if (index) {
          dataAttrs += ` data-bead-index="${index}"`;
        }

        processedCount++;
        // Wrap content in a group with data attributes
        return `<g ${dataAttrs}>${content}</g>`;
      }
      return match;
    }
  );

  // Process crop mark links: <a href="crop-mark://top-left"><rect.../></a>
  result = result.replace(
    /<a[^>]*href="crop-mark:\/\/([^"]+)"[^>]*>(.*?)<\/a>/gs,
    (match, position, content) => {
      processedCount++;
      return `<g data-crop-position="${position}" data-element-type="crop-mark" class="crop-mark crop-mark-${position}">${content}</g>`;
    }
  );

  return {
    content: result,
    processedCount
  };
}

function processTypstSVG(inputPath, outputPath) {
  console.log(`📖 Reading: ${inputPath}`);

  if (!fs.existsSync(inputPath)) {
    console.error(`❌ Input file not found: ${inputPath}`);
    process.exit(1);
  }

  const svgContent = fs.readFileSync(inputPath, 'utf-8');

  // Choose processing method
  const processor = JSDOM ? processWithJSDOM : processWithRegex;
  const processingMethod = JSDOM ? 'JSDOM' : 'regex fallback';

  console.log(`⚙️  Processing with: ${processingMethod}`);

  const result = processor(svgContent);

  // Write processed SVG
  fs.writeFileSync(outputPath, result.content);

  console.log(`✅ Processed: ${result.processedCount} annotations`);
  console.log(`💾 Output: ${outputPath}`);

  return result.processedCount;
}

function showUsage() {
  console.log(`
SVG Post-Processor for Typst Soroban Templates

Usage:
  node svg-post-processor.js <input.svg> [output.svg]

Arguments:
  input.svg    Path to the input SVG file with Typst link annotations
  output.svg   Path for the processed output (optional, defaults to input-processed.svg)

Examples:
  node svg-post-processor.js gallery/basic-5.svg processed-basic-5.svg
  node svg-post-processor.js test-visible-crop.svg

Features:
  • Converts bead annotations to data-bead-* attributes
  • Converts crop mark annotations to data-crop-* attributes
  • Preserves all original SVG styling and structure
  • Adds CSS classes for crop marks

Dependencies:
  • jsdom (optional, for robust DOM processing)
  • Without jsdom: uses regex-based fallback processing
`);
}

// Main execution
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    showUsage();
    process.exit(0);
  }

  const inputPath = args[0];
  const outputPath = args[1] || inputPath.replace(/\.svg$/, '-processed.svg');

  try {
    const count = processTypstSVG(inputPath, outputPath);

    if (count === 0) {
      console.log('⚠️  No Typst link annotations found in the SVG file');
      console.log('   Make sure the SVG was generated with annotated templates');
    } else {
      console.log('🎉 Processing complete!');
      console.log('   You can now use CSS selectors like:');
      console.log('   • [data-bead-type="heaven"] - Select heaven beads');
      console.log('   • [data-crop-position="top-left"] - Select crop boundaries');
      console.log('   • .crop-mark - Select all crop marks');
    }
  } catch (error) {
    console.error('❌ Error processing SVG:', error.message);
    process.exit(1);
  }
}

module.exports = { processTypstSVG };