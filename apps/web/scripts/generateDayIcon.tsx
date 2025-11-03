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

// Wrap in SVG with proper viewBox for favicon sizing
// AbacusReact with 2 columns + scaleFactor 1.8 = ~90×216px
// Scale 0.48 = ~43×104px (slightly overflows height, but fine for icon)
const svg = `<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <!-- Background circle with border for definition -->
  <circle cx="50" cy="50" r="48" fill="#fef3c7" stroke="#d97706" stroke-width="2"/>

  <!-- Abacus showing day ${day.toString().padStart(2, '0')} (US Central Time) -->
  <g class="hide-inactive-mode" transform="translate(28, -2) scale(0.48)">
    ${svgContent}
  </g>
</svg>
`

// Output to stdout so parent process can capture it
process.stdout.write(svg)
