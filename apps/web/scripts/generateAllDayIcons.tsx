#!/usr/bin/env tsx

/**
 * Pre-generate all 31 day-of-month favicons for production
 *
 * This script generates icon-day-01.svg through icon-day-31.svg
 * Production route handler will read these pre-generated files
 */

// biome-ignore lint/correctness/noUnusedImports: React is required for JSX transform
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { AbacusStatic } from "@soroban/abacus-react";

// Extract just the SVG element from rendered output
function extractSvgElement(markup: string): string {
  const svgMatch = markup.match(/<svg[^>]*>[\s\S]*?<\/svg>/);
  if (!svgMatch) {
    throw new Error("No SVG element found in rendered output");
  }
  return svgMatch[0];
}

// Generate a single day icon
function generateDayIcon(day: number): string {
  // Render 2-column abacus showing day of month
  const abacusMarkup = renderToStaticMarkup(
    <AbacusStatic
      value={day}
      columns={2}
      scaleFactor={1.8}
      showNumbers={false}
      hideInactiveBeads={true}
      frameVisible={true}
      cropToActiveBeads={{
        padding: {
          top: 8,
          bottom: 2,
          left: 5,
          right: 5,
        },
      }}
      customStyles={{
        columnPosts: {
          fill: "#1c1917",
          stroke: "#0c0a09",
          strokeWidth: 2,
        },
        reckoningBar: {
          fill: "#1c1917",
          stroke: "#0c0a09",
          strokeWidth: 3,
        },
        columns: {
          0: {
            // Ones place - Gold (royal theme)
            heavenBeads: { fill: "#fbbf24", stroke: "#f59e0b", strokeWidth: 2 },
            earthBeads: { fill: "#fbbf24", stroke: "#f59e0b", strokeWidth: 2 },
          },
          1: {
            // Tens place - Purple (royal theme)
            heavenBeads: { fill: "#a855f7", stroke: "#7e22ce", strokeWidth: 2 },
            earthBeads: { fill: "#a855f7", stroke: "#7e22ce", strokeWidth: 2 },
          },
        },
      }}
    />,
  );

  // Extract the cropped SVG
  let croppedSvg = extractSvgElement(abacusMarkup);

  // Remove !important from CSS (production code policy)
  croppedSvg = croppedSvg.replace(/\s*!important/g, "");

  // Parse width and height from the cropped SVG
  const widthMatch = croppedSvg.match(/width="([^"]+)"/);
  const heightMatch = croppedSvg.match(/height="([^"]+)"/);

  if (!widthMatch || !heightMatch) {
    throw new Error("Could not parse dimensions from cropped SVG");
  }

  const croppedWidth = parseFloat(widthMatch[1]);
  const croppedHeight = parseFloat(heightMatch[1]);

  // Calculate scale to fit cropped region into 96x96 (leaving room for border)
  const targetSize = 96;
  const scale = Math.min(targetSize / croppedWidth, targetSize / croppedHeight);

  // Center in 100x100 canvas
  const scaledWidth = croppedWidth * scale;
  const scaledHeight = croppedHeight * scale;
  const offsetX = (100 - scaledWidth) / 2;
  const offsetY = (100 - scaledHeight) / 2;

  // Wrap in 100x100 SVG canvas for favicon
  // Extract viewBox from cropped SVG to preserve it
  const viewBoxMatch = croppedSvg.match(/viewBox="([^"]+)"/);
  const viewBox = viewBoxMatch
    ? viewBoxMatch[1]
    : `0 0 ${croppedWidth} ${croppedHeight}`;

  return `<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <!-- Abacus showing day ${day.toString().padStart(2, "0")} (US Central Time) - cropped to active beads -->
  <svg x="${offsetX}" y="${offsetY}" width="${scaledWidth}" height="${scaledHeight}"
       viewBox="${viewBox}">
    ${croppedSvg.match(/<svg[^>]*>([\s\S]*?)<\/svg>/)?.[1] || ""}
  </svg>
</svg>
`;
}

// Main execution
const publicDir = join(__dirname, "..", "public");
const iconsDir = join(publicDir, "icons");

try {
  // Ensure icons directory exists
  mkdirSync(iconsDir, { recursive: true });

  console.log("Generating all 31 day-of-month favicons...\n");

  // Generate all 31 days
  for (let day = 1; day <= 31; day++) {
    const svg = generateDayIcon(day);
    const filename = `icon-day-${day.toString().padStart(2, "0")}.svg`;
    const filepath = join(iconsDir, filename);
    writeFileSync(filepath, svg);
    console.log(`✓ Generated ${filename}`);
  }

  console.log("\n✅ All day icons generated successfully!");
  console.log(`   Location: public/icons/icon-day-*.svg`);
} catch (error) {
  console.error("❌ Error generating day icons:", error);
  process.exit(1);
}
