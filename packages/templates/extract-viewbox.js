#!/usr/bin/env node

// Extract viewBox from crop marks with proper transform accumulation
// This correctly walks up the SVG hierarchy to calculate final coordinates

const fs = require("fs");

function parseSVGWithTransforms(svgContent) {
  // Parse SVG structure to find crop marks in both CLI and Node.js formats
  const cropMarks = [];

  // Method 1: Look for crop-mark:// links (Node.js format)
  const linkMatches = svgContent.matchAll(
    /xlink:href="crop-mark:\/\/(left|right|top|bottom)"/g,
  );
  const transformRegex = /transform="translate\(([^)]+)\)"/g;

  // Convert content to searchable text for easier parsing
  const searchableContent = svgContent.replace(/\n/g, " ").replace(/\s+/g, " ");

  for (const linkMatch of linkMatches) {
    const direction = linkMatch[1];
    const beforeLink = searchableContent.substring(0, linkMatch.index);

    // Find all transforms before this link
    let totalX = 0,
      totalY = 0;
    let transformMatch;
    transformRegex.lastIndex = 0; // Reset regex

    while ((transformMatch = transformRegex.exec(beforeLink)) !== null) {
      const coords = transformMatch[1].split(/[,\s]+/).map(Number);
      totalX += coords[0] || 0;
      totalY += coords[1] || 0;
    }

    cropMarks.push({
      type: "crop-mark",
      direction,
      finalTransform: { x: totalX, y: totalY },
    });
  }

  // Method 2: Fallback to CLI format (multi-line with path elements)
  if (cropMarks.length === 0) {
    const lines = svgContent.split("\n");
    const stack = []; // Track parent transforms

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const indent = line.match(/^(\s*)/)[1].length;

      // Track opening/closing tags to maintain hierarchy
      if (line.includes("<g ") && line.includes("transform=")) {
        const transformMatch = line.match(/transform="translate\(([^)]+)\)"/);
        if (transformMatch) {
          const coords = transformMatch[1].split(/[,\s]+/).map(Number);
          const transform = { x: coords[0] || 0, y: coords[1] || 0 };

          // Maintain stack based on indentation level
          while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
            stack.pop();
          }

          // Calculate accumulated transform
          const accumulated = stack.reduce(
            (acc, parent) => ({
              x: acc.x + parent.transform.x,
              y: acc.y + parent.transform.y,
            }),
            { x: 0, y: 0 },
          );

          const finalTransform = {
            x: accumulated.x + transform.x,
            y: accumulated.y + transform.y,
          };

          stack.push({ indent, transform, finalTransform });

          // Check if this contains a tiny crop mark point (not the dashed lines)
          if (
            i + 1 < lines.length &&
            lines[i + 1].includes('fill="#ff4136"') &&
            lines[i + 1].includes("0.1 0.1")
          ) {
            cropMarks.push({
              type: "crop-mark",
              finalTransform,
              line: i,
            });
          }
        }
      }
    }
  }

  return cropMarks;
}

function extractViewBoxFromCropMarks(svgPath) {
  console.log(
    `📐 Analyzing crop marks with transform accumulation in ${svgPath}...`,
  );

  if (!fs.existsSync(svgPath)) {
    throw new Error(`SVG file not found: ${svgPath}`);
  }

  const svgContent = fs.readFileSync(svgPath, "utf8");

  // Use proper SVG parsing with transform accumulation
  const elements = parseSVGWithTransforms(svgContent);
  const cropMarkElements = elements.filter((e) => e.type === "crop-mark");

  if (cropMarkElements.length === 0) {
    console.log("  ⚠️  No crop marks found in this SVG");
    return null;
  }

  // Extract positions from accumulated transforms
  const cropMarks = {};

  cropMarkElements.forEach((element, index) => {
    let markType;

    if (element.direction) {
      // Node.js format: has explicit direction
      markType = element.direction;
    } else {
      // CLI format: use order-based mapping
      const markTypes = ["left", "right", "top", "bottom"];
      markType = markTypes[index];
    }

    if (markType) {
      const { x, y } = element.finalTransform;
      cropMarks[markType] = { x, y };
      console.log(`  ✅ Found ${markType} at (${x}, ${y}) [accumulated]`);
    }
  });

  // Calculate viewBox from accumulated positions
  const positions = Object.values(cropMarks);
  const minX = Math.min(...positions.map((p) => p.x));
  const maxX = Math.max(...positions.map((p) => p.x));
  const minY = Math.min(...positions.map((p) => p.y));
  const maxY = Math.max(...positions.map((p) => p.y));

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
    cropMarks,
  };
}

function updateSVGViewBox(inputPath, outputPath = null) {
  const result = extractViewBoxFromCropMarks(inputPath);
  if (!result) {
    console.log("❌ Cannot update viewBox - no crop marks found");
    return false;
  }

  const svgContent = fs.readFileSync(inputPath, "utf8");

  // Update the viewBox attribute and SVG dimensions to match aspect ratio
  let updatedSVG = svgContent.replace(
    /viewBox="[^"]*"/,
    `viewBox="${result.viewBox}"`,
  );

  // Update width and height to match the viewBox dimensions for correct aspect ratio
  updatedSVG = updatedSVG.replace(/width="[^"]*"/, `width="${result.width}pt"`);

  updatedSVG = updatedSVG.replace(
    /height="[^"]*"/,
    `height="${result.height}pt"`,
  );

  const output =
    outputPath || inputPath.replace(".svg", "-cropped-correct.svg");
  fs.writeFileSync(output, updatedSVG);

  console.log(`✅ Updated SVG saved to ${output}`);
  return true;
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log(
      "Usage: node extract-viewbox-correct.js <svg-file> [output-file]",
    );
    console.log("");
    console.log("Examples:");
    console.log(
      "  node extract-viewbox-correct.js gallery/debug-crop-marks-89.svg",
    );
    console.log(
      "  node extract-viewbox-correct.js gallery/crop-single-1.svg cropped.svg",
    );
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
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

module.exports = { extractViewBoxFromCropMarks, updateSVGViewBox };
