#!/usr/bin/env tsx

/**
 * Generate a simple abacus SVG (no customization for now - just get it working)
 * Usage: npx tsx scripts/generateCalendarAbacus.tsx <value> <columns>
 * Example: npx tsx scripts/generateCalendarAbacus.tsx 15 2
 *
 * Uses AbacusStatic for server-side rendering (no client hooks)
 */

import React from 'react'
import { AbacusStatic } from '@soroban/abacus-react/static'

export function generateAbacusElement(value: number, columns: number) {
  return (
    <AbacusStatic
      value={value}
      columns={columns}
      scaleFactor={1}
      showNumbers={false}
      frameVisible={true}
    />
  )
}

// CLI interface (if run directly)
if (require.main === module) {
  // Only import react-dom/server for CLI usage
  const { renderToStaticMarkup } = require('react-dom/server')

  const value = parseInt(process.argv[2], 10)
  const columns = parseInt(process.argv[3], 10)

  if (isNaN(value) || isNaN(columns)) {
    console.error('Usage: npx tsx scripts/generateCalendarAbacus.tsx <value> <columns>')
    process.exit(1)
  }

  process.stdout.write(renderToStaticMarkup(generateAbacusElement(value, columns)))
}
