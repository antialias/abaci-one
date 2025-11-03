#!/usr/bin/env tsx

/**
 * Generate all abacus SVGs needed for a calendar
 * Usage: npx tsx scripts/generateCalendarSVGs.tsx <maxDay> <year> <customStylesJson>
 * Example: npx tsx scripts/generateCalendarSVGs.tsx 31 2025 '{}'
 *
 * This script runs as a subprocess to avoid Next.js restrictions on react-dom/server in API routes.
 * Pattern copied from generateAbacusIcons.tsx which works correctly.
 */

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { AbacusReact as AbacusReactType } from '@soroban/abacus-react'

// Use dynamic import to ensure correct module resolution
const AbacusReactModule = require('@soroban/abacus-react')
const AbacusReact = AbacusReactModule.AbacusReact || AbacusReactModule.default

// Get arguments
const maxDay = parseInt(process.argv[2], 10)
const year = parseInt(process.argv[3], 10)
const customStylesJson = process.argv[4] || '{}'

if (!maxDay || maxDay < 1 || maxDay > 31) {
  console.error('Invalid maxDay argument')
  process.exit(1)
}

if (!year || year < 1 || year > 9999) {
  console.error('Invalid year argument')
  process.exit(1)
}

let customStyles: any
try {
  customStyles = JSON.parse(customStylesJson)
} catch (error) {
  console.error('Invalid JSON for customStyles')
  process.exit(1)
}

interface CalendarSVGs {
  days: Record<string, string>
  year: string
}

const result: CalendarSVGs = {
  days: {},
  year: '',
}

// Generate day SVGs
for (let day = 1; day <= maxDay; day++) {
  const svg = renderToStaticMarkup(
    <AbacusReact
      value={day}
      columns={2}
      customStyles={customStyles}
      scaleFactor={1}
      animated={false}
      interactive={false}
    />
  )
  result.days[`day-${day}`] = svg
}

// Generate year SVG
const yearColumns = Math.max(1, Math.ceil(Math.log10(year + 1)))
const yearSvg = renderToStaticMarkup(
  <AbacusReact
    value={year}
    columns={yearColumns}
    customStyles={customStyles}
    scaleFactor={1}
    animated={false}
    interactive={false}
  />
)
result.year = yearSvg

// Output as JSON to stdout
process.stdout.write(JSON.stringify(result))
