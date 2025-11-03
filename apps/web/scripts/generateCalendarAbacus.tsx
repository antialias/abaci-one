#!/usr/bin/env tsx

/**
 * Generate a simple abacus SVG (no customization for now - just get it working)
 * Usage: npx tsx scripts/generateCalendarAbacus.tsx <value> <columns>
 * Example: npx tsx scripts/generateCalendarAbacus.tsx 15 2
 *
 * Pattern copied directly from working generateDayIcon.tsx
 */

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { AbacusReact } from '@soroban/abacus-react'

const value = parseInt(process.argv[2], 10)
const columns = parseInt(process.argv[3], 10)

if (isNaN(value) || isNaN(columns)) {
	console.error('Usage: npx tsx scripts/generateCalendarAbacus.tsx <value> <columns>')
	process.exit(1)
}

// Use exact same pattern as generateDayIcon - inline customStyles
const abacusMarkup = renderToStaticMarkup(
	<AbacusReact
		value={value}
		columns={columns}
		scaleFactor={1}
		animated={false}
		interactive={false}
		showNumbers={false}
	/>,
)

process.stdout.write(abacusMarkup)
