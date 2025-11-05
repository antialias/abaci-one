#!/usr/bin/env tsx

/**
 * Generate a single day-of-month favicon
 * Usage: npx tsx scripts/generateDayIcon.tsx <day>
 * Example: npx tsx scripts/generateDayIcon.tsx 15
 */

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  AbacusReact,
  numberToAbacusState,
  calculateStandardDimensions,
  calculateBeadPosition,
  type BeadPositionConfig,
} from '@soroban/abacus-react'

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

/**
 * Calculate bounding box for icon cropping using actual bead position calculations
 * This replaces fragile regex parsing with deterministic position math
 */
function getAbacusBoundingBox(
  day: number,
  scaleFactor: number,
  columns: number
): BoundingBox {
  // Get which beads are active for this day
  const abacusState = numberToAbacusState(day, columns)

  // Get layout dimensions
  const dimensions = calculateStandardDimensions({
    columns,
    scaleFactor,
    showNumbers: false,
    columnLabels: [],
  })

  // Calculate positions of all active beads
  const activeBeadPositions: Array<{ x: number; y: number }> = []

  for (let placeValue = 0; placeValue < columns; placeValue++) {
    const columnState = abacusState[placeValue]
    if (!columnState) continue

    // Heaven bead
    if (columnState.heavenActive) {
      const bead: BeadPositionConfig = {
        type: 'heaven',
        active: true,
        position: 0,
        placeValue,
      }
      const pos = calculateBeadPosition(bead, dimensions, { earthActive: columnState.earthActive })
      activeBeadPositions.push(pos)
    }

    // Earth beads
    for (let earthPos = 0; earthPos < columnState.earthActive; earthPos++) {
      const bead: BeadPositionConfig = {
        type: 'earth',
        active: true,
        position: earthPos,
        placeValue,
      }
      const pos = calculateBeadPosition(bead, dimensions, { earthActive: columnState.earthActive })
      activeBeadPositions.push(pos)
    }
  }

  if (activeBeadPositions.length === 0) {
    // Fallback if no active beads - show full abacus
    return { minX: 0, minY: 0, maxX: 50 * scaleFactor, maxY: 120 * scaleFactor }
  }

  // Calculate bounding box from active bead positions
  const beadSize = dimensions.beadSize
  const beadWidth = beadSize * 2.5 // Diamond width is ~2.5x the size parameter
  const beadHeight = beadSize * 1.8 // Diamond height is ~1.8x the size parameter

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity

  for (const pos of activeBeadPositions) {
    // Bead center is at pos.x, pos.y
    // Calculate bounding box for diamond shape
    minX = Math.min(minX, pos.x - beadWidth / 2)
    maxX = Math.max(maxX, pos.x + beadWidth / 2)
    minY = Math.min(minY, pos.y - beadHeight / 2)
    maxY = Math.max(maxY, pos.y + beadHeight / 2)
  }

  // HORIZONTAL BOUNDS: Always show full width of all columns (consistent across all days)
  // Use rod positions for consistent horizontal bounds
  const rodSpacing = dimensions.rodSpacing
  minX = rodSpacing / 2 - beadWidth / 2
  maxX = (columns - 0.5) * rodSpacing + beadWidth / 2

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
          // Ones place - Gold (royal theme)
          heavenBeads: { fill: '#fbbf24', stroke: '#f59e0b', strokeWidth: 2 },
          earthBeads: { fill: '#fbbf24', stroke: '#f59e0b', strokeWidth: 2 },
        },
        1: {
          // Tens place - Purple (royal theme)
          heavenBeads: { fill: '#a855f7', stroke: '#7e22ce', strokeWidth: 2 },
          earthBeads: { fill: '#a855f7', stroke: '#7e22ce', strokeWidth: 2 },
        },
      },
    }}
  />
)

let svgContent = extractSvgContent(abacusMarkup)

// Remove !important from CSS (production code policy)
svgContent = svgContent.replace(/\s*!important/g, '')

// Calculate bounding box using proper bead position calculations
const bbox = getAbacusBoundingBox(day, 1.8, 2)

// Add minimal padding around active beads (in abacus coordinates)
// Less padding below since we want to cut tight to the last bead
const paddingTop = 8
const paddingBottom = 2
const paddingSide = 5
const cropX = bbox.minX - paddingSide
const cropY = bbox.minY - paddingTop
const cropWidth = bbox.maxX - bbox.minX + paddingSide * 2
const cropHeight = bbox.maxY - bbox.minY + paddingTop + paddingBottom

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
