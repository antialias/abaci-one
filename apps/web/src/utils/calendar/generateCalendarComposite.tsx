/**
 * Generate a complete monthly calendar as a single SVG
 * This prevents multi-page overflow - one image scales to fit
 */

import type React from 'react'
import { AbacusStatic, calculateAbacusDimensions } from '@soroban/abacus-react/static'

interface CalendarCompositeOptions {
  month: number
  year: number
  renderToString: (element: React.ReactElement) => string
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay()
}

export function generateCalendarComposite(options: CalendarCompositeOptions): string {
  const { month, year, renderToString } = options
  const daysInMonth = getDaysInMonth(year, month)
  const firstDayOfWeek = getFirstDayOfWeek(year, month)
  const monthName = MONTH_NAMES[month - 1]

  // Layout constants for US Letter aspect ratio (8.5 x 11)
  const WIDTH = 850
  const HEIGHT = 1100
  const MARGIN = 50
  const CONTENT_WIDTH = WIDTH - MARGIN * 2
  const CONTENT_HEIGHT = HEIGHT - MARGIN * 2

  // Abacus natural size is 120x230 at scale=1
  const ABACUS_NATURAL_WIDTH = 120
  const ABACUS_NATURAL_HEIGHT = 230

  // Calculate how many columns needed for year
  const yearColumns = Math.max(1, Math.ceil(Math.log10(year + 1)))

  // Year abacus dimensions (calculate first to determine header height)
  // Use the shared dimension calculator so we stay in sync with AbacusStatic
  const { width: yearAbacusActualWidth, height: yearAbacusActualHeight } =
    calculateAbacusDimensions({
      columns: yearColumns,
      showNumbers: false,
      columnLabels: [],
    })

  const yearAbacusDisplayWidth = WIDTH * 0.15 // Display size on page
  const yearAbacusDisplayHeight =
    (yearAbacusActualHeight / yearAbacusActualWidth) * yearAbacusDisplayWidth

  // Header - sized to fit month name + year abacus
  const MONTH_NAME_HEIGHT = 40
  const HEADER_HEIGHT = MONTH_NAME_HEIGHT + yearAbacusDisplayHeight + 20 // 20px spacing
  const TITLE_Y = MARGIN + 35
  const yearAbacusX = (WIDTH - yearAbacusDisplayWidth) / 2
  const yearAbacusY = TITLE_Y + 10

  // Calendar grid
  const GRID_START_Y = MARGIN + HEADER_HEIGHT
  const GRID_HEIGHT = CONTENT_HEIGHT - HEADER_HEIGHT
  const WEEKDAY_ROW_HEIGHT = 25
  const DAY_GRID_HEIGHT = GRID_HEIGHT - WEEKDAY_ROW_HEIGHT

  // 7 columns, up to 6 rows (35 cells max = 5 empty + 30 days worst case)
  const CELL_WIDTH = CONTENT_WIDTH / 7
  const DAY_CELL_HEIGHT = DAY_GRID_HEIGHT / 6

  // Day abacus sizing - fit in cell with padding
  const CELL_PADDING = 5

  // Calculate max scale to fit in cell
  const MAX_SCALE_X = (CELL_WIDTH - CELL_PADDING * 2) / ABACUS_NATURAL_WIDTH
  const MAX_SCALE_Y = (DAY_CELL_HEIGHT - CELL_PADDING * 2) / ABACUS_NATURAL_HEIGHT
  const ABACUS_SCALE = Math.min(MAX_SCALE_X, MAX_SCALE_Y) * 0.9 // 90% to leave breathing room

  const SCALED_ABACUS_WIDTH = ABACUS_NATURAL_WIDTH * ABACUS_SCALE
  const SCALED_ABACUS_HEIGHT = ABACUS_NATURAL_HEIGHT * ABACUS_SCALE

  // Generate calendar grid
  const calendarCells: (number | null)[] = []
  for (let i = 0; i < firstDayOfWeek; i++) {
    calendarCells.push(null)
  }
  for (let day = 1; day <= daysInMonth; day++) {
    calendarCells.push(day)
  }

  // Render individual abacus SVGs as complete SVG elements
  function renderAbacusSVG(value: number, columns: number, scale: number): string {
    return renderToString(
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

  <!-- Title: Month Name -->
  <text x="${WIDTH / 2}" y="${TITLE_Y}" text-anchor="middle" font-family="Arial" font-size="32" font-weight="bold" fill="#1a1a1a">
    ${monthName}
  </text>

  <!-- Year Abacus (centered below month name) -->
  ${(() => {
    const yearAbacusSVG = renderAbacusSVG(year, yearColumns, 1)
    const yearAbacusContent = yearAbacusSVG.replace(/<svg[^>]*>/, '').replace(/<\/svg>$/, '')
    return `<svg x="${yearAbacusX}" y="${yearAbacusY}" width="${yearAbacusDisplayWidth}" height="${yearAbacusDisplayHeight}"
         viewBox="0 0 ${yearAbacusActualWidth} ${yearAbacusActualHeight}">
    ${yearAbacusContent}
  </svg>`
  })()}

  <!-- Weekday Headers -->
  ${WEEKDAYS.map(
    (day, i) => `
  <text x="${MARGIN + i * CELL_WIDTH + CELL_WIDTH / 2}" y="${GRID_START_Y + 18}"
        text-anchor="middle" font-family="Arial" font-size="14" font-weight="bold" fill="#555">
    ${day}
  </text>`
  ).join('')}

  <!-- Separator line under weekdays -->
  <line x1="${MARGIN}" y1="${GRID_START_Y + WEEKDAY_ROW_HEIGHT}"
        x2="${WIDTH - MARGIN}" y2="${GRID_START_Y + WEEKDAY_ROW_HEIGHT}"
        stroke="#333" stroke-width="2"/>

  <!-- Calendar Grid Cells -->
  ${calendarCells
    .map((day, index) => {
      const row = Math.floor(index / 7)
      const col = index % 7
      const cellX = MARGIN + col * CELL_WIDTH
      const cellY = GRID_START_Y + WEEKDAY_ROW_HEIGHT + row * DAY_CELL_HEIGHT

      return `
  <rect x="${cellX}" y="${cellY}" width="${CELL_WIDTH}" height="${DAY_CELL_HEIGHT}"
        fill="none" stroke="#333" stroke-width="2"/>`
    })
    .join('')}

  <!-- Calendar Day Abaci -->
  ${calendarCells
    .map((day, index) => {
      if (day === null) return ''

      const row = Math.floor(index / 7)
      const col = index % 7
      const cellX = MARGIN + col * CELL_WIDTH
      const cellY = GRID_START_Y + WEEKDAY_ROW_HEIGHT + row * DAY_CELL_HEIGHT

      // Center abacus in cell
      const abacusCenterX = cellX + CELL_WIDTH / 2
      const abacusCenterY = cellY + DAY_CELL_HEIGHT / 2

      // Offset to top-left corner of abacus (accounting for scaled size)
      const abacusX = abacusCenterX - SCALED_ABACUS_WIDTH / 2
      const abacusY = abacusCenterY - SCALED_ABACUS_HEIGHT / 2

      // Render at scale=1 and let the nested SVG handle scaling via viewBox
      const abacusSVG = renderAbacusSVG(day, 2, 1)
      const svgContent = abacusSVG.replace(/<svg[^>]*>/, '').replace(/<\/svg>$/, '')

      return `
  <!-- Day ${day} (row ${row}, col ${col}) -->
  <svg x="${abacusX}" y="${abacusY}" width="${SCALED_ABACUS_WIDTH}" height="${SCALED_ABACUS_HEIGHT}"
       viewBox="0 0 ${ABACUS_NATURAL_WIDTH} ${ABACUS_NATURAL_HEIGHT}">
    ${svgContent}
  </svg>`
    })
    .join('')}
</svg>`

  return compositeSVG
}
