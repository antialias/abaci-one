#!/usr/bin/env tsx

/**
 * Generate a single day-of-month favicon
 * Usage: npx tsx scripts/generateDayIcon.tsx <day>
 * Example: npx tsx scripts/generateDayIcon.tsx 15
 */

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AbacusStatic } from "@soroban/abacus-react";

// Extract just the SVG element from rendered output
function extractSvgElement(markup: string): string {
  const svgMatch = markup.match(/<svg[^>]*>[\s\S]*?<\/svg>/);
  if (!svgMatch) {
    throw new Error("No SVG element found in rendered output");
  }
  return svgMatch[0];
}

// Get day from command line argument
const day = parseInt(process.argv[2], 10);

if (!day || day < 1 || day > 31) {
  console.error("Usage: npx tsx scripts/generateDayIcon.tsx <day>");
  console.error("Example: npx tsx scripts/generateDayIcon.tsx 15");
  process.exit(1);
}

// Render 2-column abacus showing day of month
// Using AbacusStatic for server-side rendering
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

const svg = `<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <!-- Abacus showing day ${day.toString().padStart(2, "0")} (US Central Time) - cropped to active beads -->
  <svg x="${offsetX}" y="${offsetY}" width="${scaledWidth}" height="${scaledHeight}"
       viewBox="${viewBox}">
    ${croppedSvg.match(/<svg[^>]*>([\s\S]*?)<\/svg>/)?.[1] || ""}
  </svg>
</svg>
`;

// Output to stdout so parent process can capture it
process.stdout.write(svg);
