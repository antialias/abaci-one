# SVG Crop Processor

High-performance, zero-dependency SVG post-processor for optimizing Typst-generated soroban abacus SVGs with automatic crop mark detection and viewBox optimization.

## Overview

The SVG Crop Processor automatically detects crop marks in Typst-generated SVGs and optimizes the viewBox to minimize file size while preserving all visual content. Additionally, it processes interactive bead annotations by converting link elements to HTML5 data attributes for easier JavaScript interaction. It's designed specifically for soroban abacus flashcards but works with any SVG containing the crop mark format.

**Key Features:**

- ⚡ **High Performance**: Zero dependencies, pure JavaScript/DOM APIs
- 🌐 **Universal Compatibility**: Works in Node.js and all evergreen browsers
- 🎯 **Precise Processing**: Accurate coordinate calculation with transform accumulation
- 🔗 **Bead Annotation Processing**: Converts bead links to structured data attributes
- 🛡️ **Robust Error Handling**: Comprehensive error messages with actionable guidance
- 📦 **TypeScript Ready**: Full TypeScript definitions included
- 🔧 **Flexible API**: Multiple processing options and output formats

## Installation

The crop processor is included in the `@soroban/templates` package:

```bash
npm install @soroban/templates
```

## Quick Start

### Node.js / TypeScript

```typescript
import { svgCropProcessor } from "@soroban/templates";
import fs from "fs";

// Read SVG file with crop marks
const svgContent = fs.readFileSync("soroban-with-crops.svg", "utf-8");

// Process and optimize
const result = svgCropProcessor.processSVG(svgContent);

console.log(`✅ Processing successful!`);
console.log(`📊 File size reduced by ${result.cropData.reduction}%`);
console.log(
  `📏 New dimensions: ${result.cropData.width} × ${result.cropData.height}pt`,
);
console.log(`🔗 Interactive beads found: ${result.beadData?.count || 0}`);

// Save optimized SVG
fs.writeFileSync("soroban-optimized.svg", result.svg);
```

### Browser / Client-Side

```html
<!DOCTYPE html>
<html>
  <head>
    <script src="node_modules/@soroban/templates/svg-crop-processor.js"></script>
  </head>
  <body>
    <input type="file" id="svg-upload" accept=".svg" />
    <div id="results"></div>

    <script>
      const { processSVGFile } = window.SorobanSVGCropProcessor;

      document
        .getElementById("svg-upload")
        .addEventListener("change", async (e) => {
          const file = e.target.files[0];
          if (!file) return;

          try {
            const result = await processSVGFile(file);

            document.getElementById("results").innerHTML = `
                    <h3>✅ Processing Complete!</h3>
                    <p>📊 File size reduced by ${result.cropData.reduction}%</p>
                    <p>📏 Optimized to ${result.cropData.width} × ${result.cropData.height}pt</p>
                `;

            // Create download link
            const blob = new Blob([result.svg], { type: "image/svg+xml" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = "optimized.svg";
            link.textContent = "Download Optimized SVG";
            document.getElementById("results").appendChild(link);
          } catch (error) {
            console.error("Processing failed:", error.message);
            document.getElementById("results").innerHTML =
              `<p>❌ Error: ${error.message}</p>`;
          }
        });
    </script>
  </body>
</html>
```

## API Reference

### `processSVG(svgContent, options?)`

Main processing function that extracts crop marks and optimizes the SVG.

**Parameters:**

- `svgContent` (string): Raw SVG content
- `options` (object, optional):
  - `removeCropMarks` (boolean): Remove crop mark elements from output (default: false)
  - `preserveAspectRatio` (boolean): Update width/height to match viewBox (default: true)
  - `extractBeadAnnotations` (boolean): Convert bead links to data attributes (default: true)

**Returns:** `ProcessResult` object with:

- `svg` (string): Optimized SVG content
- `cropData` (object): Detailed crop analysis
- `beadData` (object|null): Bead annotation results (null if disabled)
- `success` (boolean): Processing success status
- `warnings` (string[]): Non-fatal issues

**Example:**

```javascript
const result = svgCropProcessor.processSVG(svgContent, {
  preserveAspectRatio: true,
  removeCropMarks: false, // Keep for debugging
  extractBeadAnnotations: true, // Process interactive beads
});

console.log(`Found ${result.beadData?.count || 0} interactive beads`);
```

### `processSVGFile(file, options?)`

Browser-compatible function for processing File/Blob objects.

**Parameters:**

- `file` (File|Blob): SVG file to process
- `options` (object, optional): Same as `processSVG`

**Returns:** Promise resolving to `ProcessResult`

**Example:**

```javascript
const fileInput = document.querySelector('input[type="file"]');
fileInput.addEventListener("change", async (e) => {
  const result = await svgCropProcessor.processSVGFile(e.target.files[0]);
  console.log("Optimized!", result.cropData);
});
```

### `extractCropMarks(svgContent)`

Extract crop mark analysis without modifying the SVG.

**Parameters:**

- `svgContent` (string): Raw SVG content

**Returns:** `CropResult` object with boundary and dimension data

**Example:**

```javascript
const analysis = svgCropProcessor.extractCropMarks(svgContent);
console.log(
  `Crop boundaries: (${analysis.minX}, ${analysis.minY}) to (${analysis.maxX}, ${analysis.maxY})`,
);
```

## Bead Annotation Processing

The SVG Crop Processor includes powerful bead annotation processing that converts Typst link elements to structured HTML5 data attributes. This makes interactive soroban abacus applications much easier to develop.

### How It Works

1. **Link Detection**: Finds `<a href="bead://...">` and `xlink:href="bead://..."` elements
2. **ID Parsing**: Extracts structured data from bead IDs like `heaven-col1-active1`
3. **Data Conversion**: Converts to HTML5 data attributes like `data-bead-type="heaven"`
4. **Link Removal**: Removes link wrappers while preserving the SVG elements

### Bead ID Format

The processor understands bead IDs with this structure:

- **Heaven beads**: `heaven-col{N}-active{0|1}`
- **Earth beads**: `earth-col{N}-pos{1-4}-active{0|1}`

Examples:

- `heaven-col1-active1` → Heaven bead, column 1, active
- `earth-col2-pos3-active0` → Earth bead, column 2, position 3, inactive

### Generated Data Attributes

Each bead element gets these data attributes:

| Attribute                  | Description                  | Example                |
| -------------------------- | ---------------------------- | ---------------------- |
| `data-bead-id`             | Original bead ID             | `heaven-col1-active1`  |
| `data-bead-type`           | Bead type                    | `heaven` or `earth`    |
| `data-bead-position`       | Bead position                | `heaven` or `earth`    |
| `data-bead-column`         | Column number                | `1`, `2`, `3`, etc.    |
| `data-bead-place-value`    | Place value (same as column) | `1`, `2`, `3`, etc.    |
| `data-bead-earth-position` | Earth bead position          | `1`, `2`, `3`, `4`     |
| `data-bead-active`         | Active state                 | `true` or `false`      |
| `data-bead-state`          | State description            | `active` or `inactive` |

### Usage Example

```typescript
import { svgCropProcessor } from "@soroban/templates";

const result = svgCropProcessor.processSVG(svgContent, {
  extractBeadAnnotations: true,
});

// Access bead data
console.log(`Found ${result.beadData.count} interactive beads`);
result.beadData.beads.forEach((bead) => {
  console.log(
    `${bead.type} bead in column ${bead.column}, active: ${bead.active}`,
  );
});

// Use in browser - beads now have data attributes
document.getElementById("soroban-container").innerHTML = result.svg;

// Add click handlers using data attributes
document.querySelectorAll("[data-bead-type]").forEach((bead) => {
  bead.addEventListener("click", (e) => {
    const type = e.target.dataset.beadType;
    const column = e.target.dataset.beadColumn;
    const active = e.target.dataset.beadActive === "true";

    console.log(
      `Clicked ${type} bead in column ${column}, currently ${active ? "active" : "inactive"}`,
    );

    // Toggle bead state
    toggleBead(column, type, !active);
  });
});
```

### Standalone Bead Processing

You can process bead annotations without crop mark optimization:

```javascript
const {
  extractBeadAnnotations,
} = require("@soroban/templates/svg-crop-processor");

const result = extractBeadAnnotations(svgContent);
console.log("Processed SVG:", result.processedSVG);
console.log("Bead data:", result.beadLinks);
```

## Crop Mark Format

The processor detects crop marks in the specific format generated by the Soroban Typst templates:

- **Size**: Exactly 0.1 × 0.1 point rectangles
- **Color**: Red (#ff4136)
- **Position**: Four marks defining left, right, top, bottom boundaries
- **Transform**: Properly handles nested SVG transform groups

Example crop mark element:

```svg
<g transform="translate(10, 20)">
    <rect width="0.1" height="0.1" fill="#ff4136" stroke="none"/>
</g>
```

## Error Handling

The processor provides detailed error information for debugging:

```javascript
try {
  const result = svgCropProcessor.processSVG(svgContent);
} catch (error) {
  if (error instanceof svgCropProcessor.SVGCropError) {
    console.error(`Crop Error [${error.code}]: ${error.message}`);
    console.error("Details:", error.details);

    // Handle specific error types
    switch (error.code) {
      case "NO_CROP_MARKS":
        console.log("💡 Hint: Enable crop marks in your Typst template");
        break;
      case "INSUFFICIENT_CROP_MARKS":
        console.log("💡 Hint: Ensure all 4 crop marks are present");
        break;
      case "INVALID_DIMENSIONS":
        console.log("💡 Hint: Check crop mark positioning");
        break;
    }
  }
}
```

### Common Error Codes

- **`NO_CROP_MARKS`**: No crop marks found in SVG
- **`INSUFFICIENT_CROP_MARKS`**: Less than 4 crop marks detected
- **`INVALID_DIMENSIONS`**: Calculated dimensions are invalid
- **`INVALID_SVG_FORMAT`**: Malformed SVG content
- **`PROCESSING_ERROR`**: Unexpected processing failure

## Integration with Typst

### Generating SVGs with Crop Marks

Use the Soroban templates with crop marks enabled:

```typst
#import "@soroban/templates/flashcards.typ": *

// Generate with crop marks
#draw-soroban(
  number: 42,
  crop-marks: true,  // Enable crop marks
  base-size: 12
)
```

### Post-Processing Workflow

1. **Generate SVG** with Typst including crop marks
2. **Process SVG** with the crop processor to optimize viewBox
3. **Use optimized SVG** in your application with reduced file size

```bash
# Command line example
typst compile flashcard.typ flashcard.svg
node -e "
const { svgCropProcessor } = require('@soroban/templates');
const fs = require('fs');
const svg = fs.readFileSync('flashcard.svg', 'utf-8');
const result = svgCropProcessor.processSVG(svg);
fs.writeFileSync('flashcard-optimized.svg', result.svg);
console.log(\`Reduced by \${result.cropData.reduction}%\`);
"
```

## Performance

The crop processor is optimized for high performance:

- **Zero Dependencies**: No external libraries required
- **Minimal Memory**: Streams processing without loading full DOM tree
- **Fast Parsing**: Efficient regex-based coordinate extraction
- **Browser Optimized**: Uses native DOM APIs when available

### Benchmark Results

Typical processing times for soroban SVGs:

- **Small SVG** (1-5 beads): ~1-2ms
- **Medium SVG** (10-50 beads): ~2-5ms
- **Large SVG** (100+ beads): ~5-15ms

File size reductions typically range from 58-95% depending on the original padding and crop area.

## Debugging

### Visual Debugging

Keep crop marks visible during development:

```javascript
const result = svgCropProcessor.processSVG(svgContent, {
  removeCropMarks: false, // Keep crop marks for visual verification
});
```

### Detailed Analysis

Extract crop data for debugging:

```javascript
const analysis = svgCropProcessor.extractCropMarks(svgContent);
console.log("Crop Analysis:", {
  boundaries: `(${analysis.minX}, ${analysis.minY}) to (${analysis.maxX}, ${analysis.maxY})`,
  dimensions: `${analysis.width} × ${analysis.height}`,
  reduction: `${analysis.reduction}%`,
  cropMarks: analysis.cropMarks,
});
```

## Best Practices

1. **Always Enable Crop Marks**: Include crop marks in your Typst templates for processing
2. **Preserve Aspect Ratio**: Keep `preserveAspectRatio: true` for proper display
3. **Handle Errors Gracefully**: Implement proper error handling for robust applications
4. **Test with Samples**: Verify processing with various SVG sizes and complexities
5. **Monitor Performance**: Check processing times for large batch operations

## Troubleshooting

### No Crop Marks Found

- Ensure crop marks are enabled in your Typst template
- Verify the SVG contains red 0.1×0.1 rectangles
- Check that transforms are properly nested

### Invalid Dimensions

- Confirm crop marks are positioned correctly
- Ensure all 4 crop marks (left, right, top, bottom) are present
- Verify crop marks don't overlap or have zero distance

### Browser Compatibility Issues

- Use evergreen browsers (Chrome 60+, Firefox 55+, Safari 11+)
- Ensure File API support for `processSVGFile()`
- Check console for specific browser errors

## Contributing

Found an issue or want to contribute? Visit the [project repository](https://github.com/soroban-flashcards/soroban-abacus-flashcards) to report bugs, suggest features, or submit pull requests.

## License

MIT License - see the main project for full license details.
