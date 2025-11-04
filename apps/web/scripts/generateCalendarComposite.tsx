#!/usr/bin/env tsx

/**
 * Generate a complete monthly calendar as a single SVG
 * This prevents multi-page overflow - one image scales to fit
 *
 * Usage: npx tsx scripts/generateCalendarComposite.tsx <month> <year>
 * Example: npx tsx scripts/generateCalendarComposite.tsx 12 2025
 */

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { AbacusStatic } from '@soroban/abacus-react/static'

const month = parseInt(process.argv[2], 10)
const year = parseInt(process.argv[3], 10)

if (isNaN(month) || isNaN(year) || month < 1 || month > 12) {
  console.error('Usage: npx tsx scripts/generateCalendarComposite.tsx <month> <year>')
  process.exit(1)
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay()
}

const daysInMonth = getDaysInMonth(year, month)
const firstDayOfWeek = getFirstDayOfWeek(year, month)
const monthName = MONTH_NAMES[month - 1]

// Layout constants for US Letter aspect ratio (8.5 x 11)
const WIDTH = 850
const HEIGHT = 1100
const MARGIN = 40
const CONTENT_WIDTH = WIDTH - MARGIN * 2
const CONTENT_HEIGHT = HEIGHT - MARGIN * 2

// Header
const HEADER_HEIGHT = 80
const TITLE_Y = MARGIN + 30
const YEAR_ABACUS_WIDTH = 120
const YEAR_ABACUS_HEIGHT = 50

// Calendar grid
const GRID_START_Y = MARGIN + HEADER_HEIGHT + 20
const GRID_HEIGHT = CONTENT_HEIGHT - HEADER_HEIGHT - 20
const CELL_WIDTH = CONTENT_WIDTH / 7
const CELL_HEIGHT = GRID_HEIGHT / 6.5 // ~6 weeks max + weekday headers
const WEEKDAY_ROW_HEIGHT = 30
const DAY_CELL_HEIGHT = (GRID_HEIGHT - WEEKDAY_ROW_HEIGHT) / 6

// Generate calendar grid
const calendarCells: (number | null)[] = []
for (let i = 0; i < firstDayOfWeek; i++) {
  calendarCells.push(null)
}
for (let day = 1; day <= daysInMonth; day++) {
  calendarCells.push(day)
}

// Calculate how many columns needed for year
const yearColumns = Math.max(1, Math.ceil(Math.log10(year + 1)))

// Render individual abacus SVGs as strings
function renderAbacusSVG(value: number, columns: number, scale: number): string {
  return renderToStaticMarkup(
    <AbacusStatic
      value={value}
      columns={columns}
      scaleFactor={scale}
      showNumbers={false}
      frameVisible={true}
      compact={false}
    />
  )
}

// Main composite SVG
const compositeSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <!-- Background -->
  <rect width="${WIDTH}" height="${HEIGHT}" fill="white"/>

  <!-- Title -->
  <text x="${WIDTH / 2}" y="${TITLE_Y}" text-anchor="middle" font-family="Arial" font-size="36" font-weight="bold" fill="#000">
    ${monthName} ${year}
  </text>

  <!-- Year Abacus (inline, to the right of title) -->
  <g transform="translate(${WIDTH / 2 + 150}, ${TITLE_Y - 25})">
    ${renderAbacusSVG(year, yearColumns, 0.4).replace(/<svg[^>]*>/, '').replace('</svg>', '')}
  </g>

  <!-- Weekday Headers -->
  ${WEEKDAYS.map((day, i) => `
  <text x="${MARGIN + i * CELL_WIDTH + CELL_WIDTH / 2}" y="${GRID_START_Y + 20}"
        text-anchor="middle" font-family="Arial" font-size="16" font-weight="bold" fill="#333">
    ${day}
  </text>`).join('')}

  <!-- Separator line under weekdays -->
  <line x1="${MARGIN}" y1="${GRID_START_Y + WEEKDAY_ROW_HEIGHT}"
        x2="${WIDTH - MARGIN}" y2="${GRID_START_Y + WEEKDAY_ROW_HEIGHT}"
        stroke="#ccc" stroke-width="2"/>

  <!-- Calendar Grid -->
  ${calendarCells.map((day, index) => {
    if (day === null) return ''

    const row = Math.floor(index / 7)
    const col = index % 7
    const x = MARGIN + col * CELL_WIDTH
    const y = GRID_START_Y + WEEKDAY_ROW_HEIGHT + row * DAY_CELL_HEIGHT

    // Calculate scale to fit abacus in cell (leaving some padding)
    const abacusScale = Math.min(CELL_WIDTH / 120, DAY_CELL_HEIGHT / 230) * 0.7

    const abacusSVG = renderAbacusSVG(day, 2, abacusScale)
      .replace(/<svg[^>]*>/, '')
      .replace('</svg>', '')

    return `
  <!-- Day ${day} -->
  <g transform="translate(${x + CELL_WIDTH / 2}, ${y + DAY_CELL_HEIGHT / 2})">
    <g transform="translate(-60, -115)">
      ${abacusSVG}
    </g>
  </g>`
  }).join('')}
</svg>`

process.stdout.write(compositeSVG)
