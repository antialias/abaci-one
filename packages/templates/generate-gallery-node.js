#!/usr/bin/env node

// Node.js script to generate SVGs using typst.ts instead of Typst CLI
// Run with: node generate-gallery-node.js

const fs = require("fs");
const path = require("path");
const { NodeCompiler } = require("@myriaddreamin/typst-ts-node-compiler");
const prettier = require("prettier");

const examples = [
  {
    id: "basic-5",
    title: "Basic Number 5",
    description: "Simple representation of 5 with default settings",
    number: 5,
    config: {
      bead_shape: "diamond",
      color_scheme: "monochrome",
      base_size: 1.5,
    },
  },
  {
    id: "colorful-123",
    title: "Colorful 123",
    description: "Number 123 with place-value colors and diamond beads",
    number: 123,
    config: {
      bead_shape: "diamond",
      color_scheme: "place-value",
      base_size: 1.2,
    },
  },
  {
    id: "circles-42",
    title: "Circle Beads - 42",
    description: "Number 42 with circular beads and heaven-earth colors",
    number: 42,
    config: {
      bead_shape: "circle",
      color_scheme: "heaven-earth",
      base_size: 1.8,
    },
  },
  {
    id: "large-7",
    title: "Large Scale - 7",
    description: "Single digit with maximum scale for detail work",
    number: 7,
    config: {
      bead_shape: "diamond",
      color_scheme: "place-value",
      base_size: 2.5,
    },
  },
  {
    id: "compact-999",
    title: "Compact 999",
    description: "Large number with hidden inactive beads for clean look",
    number: 999,
    config: {
      bead_shape: "square",
      color_scheme: "alternating",
      hide_inactive: true,
      base_size: 1.0,
    },
  },
  {
    id: "educational-1234",
    title: "Educational 1234",
    description: "Four-digit number showing empty columns for learning",
    number: 1234,
    config: {
      bead_shape: "circle",
      color_scheme: "place-value",
      show_empty: true,
      base_size: 1.3,
    },
  },
  {
    id: "debug-crop-marks-89",
    title: "Debug: Crop Marks - 89",
    description: "Visible red crop marks showing viewBox boundaries",
    number: 89,
    config: {
      bead_shape: "diamond",
      color_scheme: "place-value",
      show_crop_marks: true,
      crop_margin: "15pt",
      base_size: 1.5,
    },
  },
  {
    id: "debug-crop-marks-456",
    title: "Debug: Crop Marks - 456",
    description: "Three-digit number with visible crop boundaries",
    number: 456,
    config: {
      bead_shape: "circle",
      color_scheme: "heaven-earth",
      show_crop_marks: true,
      crop_margin: "12pt",
      base_size: 1.2,
    },
  },
  {
    id: "crop-single-1",
    title: "Crop Marks: Single Digit",
    description: "Single digit with crop marks for tight cropping",
    number: 1,
    config: {
      bead_shape: "diamond",
      color_scheme: "monochrome",
      show_crop_marks: true,
      crop_margin: "8pt",
      base_size: 1.0,
    },
  },
  {
    id: "crop-quad-9999",
    title: "Crop Marks: Four 9s",
    description: "Maximum digit density with crop boundaries",
    number: 9999,
    config: {
      bead_shape: "square",
      color_scheme: "place-value",
      show_crop_marks: true,
      crop_margin: "10pt",
      base_size: 0.8,
    },
  },
  {
    id: "crop-large-scale-0",
    title: "Crop Marks: Large Zero",
    description: "Zero with large scale and crop marks",
    number: 0,
    config: {
      bead_shape: "circle",
      color_scheme: "alternating",
      show_crop_marks: true,
      crop_margin: "20pt",
      base_size: 2.0,
    },
  },
  {
    id: "crop-hidden-inactive-555",
    title: "Crop Marks: Hidden Inactive",
    description: "Triple 5s with hidden inactive beads and crop marks",
    number: 555,
    config: {
      bead_shape: "diamond",
      color_scheme: "heaven-earth",
      hide_inactive: true,
      show_crop_marks: true,
      crop_margin: "15pt",
      base_size: 1.4,
    },
  },
  {
    id: "crop-mixed-geometry-321",
    title: "Crop Marks: Mixed Geometry",
    description: "Different bead count pattern with tight margins",
    number: 321,
    config: {
      bead_shape: "circle",
      color_scheme: "place-value",
      show_crop_marks: true,
      crop_margin: "5pt",
      base_size: 1.1,
    },
  },
];

function createTypstFile(example) {
  const { number, config } = example;

  // Calculate canvas size based on number length and scale
  const digits = String(number).length;
  let width = Math.max(200, digits * 80 * (config.base_size || 1.0));
  let height = Math.max(150, 120 * (config.base_size || 1.0));

  // Add extra space for crop marks if enabled
  if (config.show_crop_marks && config.crop_margin) {
    const cropMarginPt = parseFloat(config.crop_margin.replace("pt", ""));
    width += cropMarginPt * 2; // Left and right margins
    height += cropMarginPt * 2; // Top and bottom margins
  }

  const content = `#import "flashcards.typ": draw-soroban

#set page(width: ${width}pt, height: ${height}pt, margin: 12pt, fill: white)

#let soroban-content = draw-soroban(
  ${number},
  columns: ${config.columns || "auto"},
  bead-shape: "${config.bead_shape || "diamond"}",
  color-scheme: "${config.color_scheme || "monochrome"}",
  ${config.color_palette ? `color-palette: "${config.color_palette}",` : ""}
  ${config.show_empty ? "show-empty: true," : ""}
  ${config.hide_inactive ? "hide-inactive: true," : ""}
  base-size: ${config.base_size || 1.0},
  ${config.show_crop_marks ? "show-crop-marks: true," : ""}
  ${config.crop_margin ? `crop-margin: ${config.crop_margin},` : ""}
)

#align(center + horizon)[
  #soroban-content
]

`;

  return content;
}

async function generateExample(example, compiler) {
  console.log(`🎨 Generating ${example.title} with NodeCompiler...`);

  try {
    const svgFile = `gallery/${example.id}.svg`;

    // Ensure gallery directory exists
    if (!fs.existsSync("gallery")) {
      fs.mkdirSync("gallery");
    }

    // Create Typst content
    const typstContent = createTypstFile(example);

    try {
      // Use NodeCompiler.svg() method with mainFileContent (per docs)
      const svgData = await compiler.svg({
        mainFileContent: typstContent,
      });

      // Format SVG for better readability (to match CLI output)
      const formattedSvg = await prettier.format(svgData, {
        parser: "html",
        printWidth: 120,
        tabWidth: 4,
        useTabs: false,
      });

      // Write SVG file
      fs.writeFileSync(svgFile, formattedSvg);
      console.log(`✅ Generated ${example.title} -> ${svgFile}`);
      return true;
    } catch (typstError) {
      console.error(`❌ NodeCompiler.svg failed for ${example.title}:`);
      console.error("Error type:", typeof typstError);
      console.error("Error:", typstError);
      console.error("Error message:", typstError?.message);
      console.error("Error stack:", typstError?.stack);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error generating ${example.title}:`, error.message);
    return false;
  }
}

async function main() {
  console.log(
    "🚀 Starting Soroban Templates Gallery Generation with NodeCompiler\n",
  );

  // Check if flashcards.typ exists
  if (!fs.existsSync("flashcards.typ")) {
    console.error(
      "❌ flashcards.typ not found. Make sure you're running this from the templates directory.",
    );
    process.exit(1);
  }

  // Initialize NodeCompiler
  console.log("🔧 Initializing NodeCompiler...");
  let compiler;
  try {
    // Create NodeCompiler with workspace set to current directory
    compiler = await NodeCompiler.create({
      workspace: process.cwd(),
      // Add font configuration for better rendering
      fontArgs: [],
    });
    console.log("✅ NodeCompiler initialized");

    // Add flashcards.typ to the compiler's memory
    const flashcardsContent = fs.readFileSync("flashcards.typ", "utf8");
    await compiler.addSource("flashcards.typ", flashcardsContent);
    console.log("✅ flashcards.typ loaded into compiler");
  } catch (error) {
    console.error("❌ Failed to initialize NodeCompiler:", error.message);
    process.exit(1);
  }

  console.log(`📊 Generating ${examples.length} gallery examples...\n`);

  let successful = 0;
  let failed = 0;

  for (const example of examples) {
    if (await generateExample(example, compiler)) {
      successful++;
    } else {
      failed++;
    }
  }

  console.log("\n📈 Generation Summary:");
  console.log(`   ✅ Successful: ${successful}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   📁 Output directory: gallery/`);

  if (successful > 0) {
    console.log("\n🎉 Gallery generation complete!");
    console.log("   📁 SVG files are in the gallery/ directory");

    // List generated files
    if (fs.existsSync("gallery")) {
      const files = fs.readdirSync("gallery").filter((f) => f.endsWith(".svg"));
      if (files.length > 0) {
        console.log("\n📄 Generated SVG files:");
        files.forEach((file) => {
          console.log(`   - gallery/${file}`);
        });
      }
    }
  }
}

// Run the generator
if (require.main === module) {
  main().catch(console.error);
}
