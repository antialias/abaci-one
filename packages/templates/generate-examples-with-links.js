#!/usr/bin/env node

/**
 * Generate template examples using typst.ts to ensure bead links are preserved
 * This replaces the Typst CLI approach which doesn't support link export to SVG
 */

const fs = require("fs");
const path = require("path");
const { svgCropProcessor } = require("./index.js");

// Import typst.ts for SVG generation with link support
let $typst = null;
let isLoading = false;

async function initializeTypst() {
  if ($typst) return $typst;
  if (isLoading) {
    // Wait for ongoing initialization
    while (isLoading) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return $typst;
  }

  isLoading = true;
  try {
    console.log("🔧 Initializing typst.ts for SVG generation...");
    const { $typst: typstInstance } = await import(
      "@myriaddreamin/typst.ts/dist/esm/contrib/snippet.mjs"
    );
    $typst = typstInstance;
    console.log("✅ typst.ts initialized successfully");
    return $typst;
  } catch (error) {
    console.error("❌ Failed to initialize typst.ts:", error);
    throw error;
  } finally {
    isLoading = false;
  }
}

function createTypstContent(number, config = {}) {
  const {
    beadShape = "diamond",
    colorScheme = "monochrome",
    colorPalette = "default",
    hideInactiveBeads = false,
    showEmptyColumns = false,
    columns = "auto",
    baseSize = 1.0,
    showCropMarks = false,
    cropMargin = "10pt",
  } = config;

  // Calculate canvas size based on number and scale
  const digits = String(number).length;
  let width = Math.max(200, digits * 80 * baseSize);
  let height = Math.max(150, 120 * baseSize);

  if (showCropMarks) {
    const cropMarginPt = parseFloat(cropMargin.replace("pt", ""));
    width += cropMarginPt * 2;
    height += cropMarginPt * 2;
  }

  const template = fs.readFileSync(
    path.join(__dirname, "flashcards.typ"),
    "utf-8",
  );

  return `${template}

#set page(width: ${width}pt, height: ${height}pt, margin: 12pt, fill: white)

#let soroban-content = draw-soroban(
  ${number},
  columns: ${columns === "auto" ? "auto" : columns},
  bead-shape: "${beadShape}",
  color-scheme: "${colorScheme}",
  color-palette: "${colorPalette}",
  ${showEmptyColumns ? "show-empty: true," : ""}
  ${hideInactiveBeads ? "hide-inactive: true," : ""}
  base-size: ${baseSize},
  ${showCropMarks ? "show-crop-marks: true," : ""}
  ${showCropMarks ? `crop-margin: ${cropMargin},` : ""}
)

#align(center + horizon)[
  #soroban-content
]
`;
}

async function generateSVGWithLinks(number, config = {}) {
  const typst = await initializeTypst();
  const typstContent = createTypstContent(number, config);

  console.log(`📐 Generating SVG for number ${number}...`);

  try {
    // Generate SVG using typst.ts
    const rawSvg = await typst.svg({ mainContent: typstContent });

    // First check if the raw SVG has bead links
    const beadLinkCount = (rawSvg.match(/bead:\/\//g) || []).length;
    console.log(`🔍 Raw SVG contains ${beadLinkCount} bead:// links`);

    // Process bead annotations to convert links to data attributes
    const result = svgCropProcessor.extractBeadAnnotations(rawSvg);
    const processedSvg = result.processedSVG;
    const dataAttrCount = (processedSvg.match(/data-bead-/g) || []).length;

    console.log(
      `✅ Generated SVG for ${number} - ${beadLinkCount} links → ${dataAttrCount} data attributes`,
    );
    return processedSvg;
  } catch (error) {
    console.error(`❌ Failed to generate SVG for ${number}:`, error);
    throw error;
  }
}

const examples = [
  {
    name: "example-5-1",
    title: "Basic Number 5",
    number: 5,
    config: { beadShape: "diamond", colorScheme: "monochrome", baseSize: 1.5 },
  },
  {
    name: "example-123-1",
    title: "Colorful 123",
    number: 123,
    config: { beadShape: "circle", colorScheme: "place-value", baseSize: 1.2 },
  },
  {
    name: "example-single-card-1",
    title: "Single Card 42",
    number: 42,
    config: {
      beadShape: "diamond",
      colorScheme: "heaven-earth",
      baseSize: 1.8,
    },
  },
];

async function main() {
  console.log("🚀 Starting template example generation with bead links...\n");

  // Ensure examples directory exists
  const examplesDir = path.join(__dirname, "examples");
  if (!fs.existsSync(examplesDir)) {
    fs.mkdirSync(examplesDir, { recursive: true });
  }

  let successful = 0;
  let failed = 0;

  for (const example of examples) {
    try {
      console.log(`🎨 Generating ${example.title}...`);

      const svg = await generateSVGWithLinks(example.number, example.config);
      const outputPath = path.join(examplesDir, `${example.name}.svg`);

      fs.writeFileSync(outputPath, svg);
      console.log(`✅ Saved ${example.name}.svg`);
      successful++;
    } catch (error) {
      console.error(`❌ Failed to generate ${example.name}:`, error.message);
      failed++;
    }
  }

  console.log("\n📈 Generation Summary:");
  console.log(`   ✅ Successful: ${successful}`);
  console.log(`   ❌ Failed: ${failed}`);

  if (successful > 0) {
    console.log("\n🎉 Template examples generated with bead links!");
    console.log("   📁 Files saved to examples/ directory");

    // Verify bead links exist in generated files
    const firstExample = path.join(examplesDir, `${examples[0].name}.svg`);
    if (fs.existsSync(firstExample)) {
      const content = fs.readFileSync(firstExample, "utf-8");
      const beadDataCount = (content.match(/data-bead-/g) || []).length;
      console.log(
        `   🏷️  Found ${beadDataCount} bead data attributes in ${examples[0].name}.svg`,
      );

      if (beadDataCount > 0) {
        console.log("   ✅ Bead annotations are working correctly!");
      } else {
        console.log(
          "   ⚠️  No bead annotations found - check processing pipeline",
        );
      }
    }
  }

  return failed === 0 ? 0 : 1;
}

if (require.main === module) {
  main()
    .then(process.exit)
    .catch((error) => {
      console.error("💥 Fatal error:", error);
      process.exit(1);
    });
}

module.exports = { generateSVGWithLinks, createTypstContent };
