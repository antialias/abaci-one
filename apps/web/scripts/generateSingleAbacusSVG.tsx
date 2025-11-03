#!/usr/bin/env tsx

/**
 * Generate a single abacus SVG
 * Usage: npx tsx scripts/generateSingleAbacusSVG.tsx <value> <columns> <customStylesJson>
 * Example: npx tsx scripts/generateSingleAbacusSVG.tsx 15 2 '{}'
 *
 * Pattern copied from generateDayIcon.tsx
 */

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { AbacusReact } from '@soroban/abacus-react'

// Get arguments
const value = parseInt(process.argv[2], 10)
const columns = parseInt(process.argv[3], 10)
const customStylesJson = process.argv[4] || '{}'

if (isNaN(value) || value < 0) {
  console.error('Invalid value argument')
  process.exit(1)
}

if (isNaN(columns) || columns < 1) {
  console.error('Invalid columns argument')
  process.exit(1)
}

let customStyles: any
try {
  customStyles = JSON.parse(customStylesJson)
} catch (error) {
  console.error('Invalid JSON for customStyles')
  process.exit(1)
}

// Render abacus
const abacusMarkup = renderToStaticMarkup(
  <AbacusReact
    value={value}
    columns={columns}
    customStyles={customStyles}
    scaleFactor={1}
    animated={false}
    interactive={false}
  />
)

// Output SVG to stdout
process.stdout.write(abacusMarkup)
