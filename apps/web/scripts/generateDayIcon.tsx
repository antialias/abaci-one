#!/usr/bin/env tsx

/**
 * Generate a single day-of-month favicon
 * Usage: npx tsx scripts/generateDayIcon.tsx <day>
 * Example: npx tsx scripts/generateDayIcon.tsx 15
 */

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { AbacusReact } from '@soroban/abacus-react'

// Extract just the SVG element content from rendered output
function extractSvgContent(markup: string): string {
  const svgMatch = markup.match(/<svg[^>]*>([\s\S]*?)<\/svg>/)
  if (!svgMatch) {
    throw new Error('No SVG element found in rendered output')
  }
  return svgMatch[1]
}

// Calculate bounding box that includes active beads AND structural elements (posts, bar)
interface BoundingBox {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

function getAbacusBoundingBox(
  svgContent: string,
  scaleFactor: number,
  columns: number
): BoundingBox {
  // Parse column posts: <rect x="..." y="..." width="..." height="..." ... >
  const postRegex = /<rect\s+x="([^"]+)"\s+y="([^"]+)"\s+width="([^"]+)"\s+height="([^"]+)"/g
  const postMatches = [...svgContent.matchAll(postRegex)]

  // Parse active bead transforms: <g class="abacus-bead active" transform="translate(x, y)">
  const activeBeadRegex =
    /<g\s+class="abacus-bead active[^"]*"\s+transform="translate\(([^,]+),\s*([^)]+)\)"/g
  const beadMatches = [...svgContent.matchAll(activeBeadRegex)]

  if (beadMatches.length === 0) {
    // Fallback if no active beads found - show full abacus
    return { minX: 0, minY: 0, maxX: 50 * scaleFactor, maxY: 120 * scaleFactor }
  }

  // Bead dimensions (diamond): width ≈ 30px * scaleFactor, height ≈ 21px * scaleFactor
  const beadHeight = 21.6 * scaleFactor

  // HORIZONTAL BOUNDS: Always show full width of both columns (fixed for all days)
  let minX = Infinity
  let maxX = -Infinity

  for (const match of postMatches) {
    const x = parseFloat(match[1])
    const width = parseFloat(match[3])
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x + width)
  }

  // VERTICAL BOUNDS: Crop to active beads (dynamic based on which beads are active)
  let minY = Infinity
  let maxY = -Infinity

  for (const match of beadMatches) {
    const y = parseFloat(match[2])
    // Top of topmost active bead to bottom of bottommost active bead
    minY = Math.min(minY, y)
    maxY = Math.max(maxY, y + beadHeight)
  }

  return { minX, minY, maxX, maxY }
}

// Get day from command line argument
const day = parseInt(process.argv[2], 10)

if (!day || day < 1 || day > 31) {
  console.error('Usage: npx tsx scripts/generateDayIcon.tsx <day>')
  console.error('Example: npx tsx scripts/generateDayIcon.tsx 15')
  process.exit(1)
}

// Render 2-column abacus showing day of month
const abacusMarkup = renderToStaticMarkup(
  <AbacusReact
    value={day}
    columns={2}
    scaleFactor={1.8}
    animated={false}
    interactive={false}
    showNumbers={false}
    hideInactiveBeads={true}
    customStyles={{
      columnPosts: {
        fill: '#1c1917',
        stroke: '#0c0a09',
        strokeWidth: 2,
      },
      reckoningBar: {
        fill: '#1c1917',
        stroke: '#0c0a09',
        strokeWidth: 3,
      },
      columns: {
        0: {
          // Ones place - Bold Blue (high contrast)
          heavenBeads: { fill: '#2563eb', stroke: '#1e40af', strokeWidth: 2 },
          earthBeads: { fill: '#2563eb', stroke: '#1e40af', strokeWidth: 2 },
        },
        1: {
          // Tens place - Bold Green (high contrast)
          heavenBeads: { fill: '#16a34a', stroke: '#15803d', strokeWidth: 2 },
          earthBeads: { fill: '#16a34a', stroke: '#15803d', strokeWidth: 2 },
        },
      },
    }}
  />
)

let svgContent = extractSvgContent(abacusMarkup)

// Remove !important from CSS (production code policy)
svgContent = svgContent.replace(/\s*!important/g, '')

// Calculate bounding box including posts, bar, and active beads
const bbox = getAbacusBoundingBox(svgContent, 1.8, 2)

// Add padding around active beads (in abacus coordinates)
const padding = 10
const cropX = bbox.minX - padding
const cropY = bbox.minY - padding
const cropWidth = bbox.maxX - bbox.minX + padding * 2
const cropHeight = bbox.maxY - bbox.minY + padding * 2

// Calculate scale to fit cropped region into 96x96 (leaving room for border)
const targetSize = 96
const scale = Math.min(targetSize / cropWidth, targetSize / cropHeight)

// Center in 100x100 canvas
const scaledWidth = cropWidth * scale
const scaledHeight = cropHeight * scale
const offsetX = (100 - scaledWidth) / 2
const offsetY = (100 - scaledHeight) / 2

// Wrap in SVG with proper viewBox for favicon sizing
// Use nested SVG with viewBox to actually CROP the content, not just scale it
const svg = `<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <!-- Background circle with border for definition -->
  <circle cx="50" cy="50" r="48" fill="#fef3c7" stroke="#d97706" stroke-width="2"/>

  <!-- Abacus showing day ${day.toString().padStart(2, '0')} (US Central Time) - cropped to active beads -->
  <!-- Nested SVG with viewBox does the actual cropping -->
  <svg x="${offsetX}" y="${offsetY}" width="${scaledWidth}" height="${scaledHeight}"
       viewBox="${cropX} ${cropY} ${cropWidth} ${cropHeight}">
    <g class="hide-inactive-mode">
      ${svgContent}
    </g>
  </svg>
</svg>
`

// Output to stdout so parent process can capture it
process.stdout.write(svg)
