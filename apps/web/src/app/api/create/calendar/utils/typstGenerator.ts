interface TypstConfig {
  month: number
  year: number
  paperSize: 'us-letter' | 'a4' | 'a3' | 'tabloid'
  tempDir: string
  daysInMonth: number
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

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay() // 0 = Sunday
}

function getDayOfWeek(year: number, month: number, day: number): string {
  const date = new Date(year, month - 1, day)
  return date.toLocaleDateString('en-US', { weekday: 'long' })
}

type PaperSize = 'us-letter' | 'a4' | 'a3' | 'tabloid'

interface PaperConfig {
  typstName: string
  marginX: string
  marginY: string
}

function getPaperConfig(size: string): PaperConfig {
  const configs: Record<PaperSize, PaperConfig> = {
    // Tight margins to maximize space for calendar grid
    'us-letter': { typstName: 'us-letter', marginX: '0.5in', marginY: '0.5in' },
    // A4 is slightly taller/narrower than US Letter - adjust margins proportionally
    a4: { typstName: 'a4', marginX: '1.3cm', marginY: '1.3cm' },
    // A3 is 2x area of A4 - can use same margins but will scale content larger
    a3: { typstName: 'a3', marginX: '1.5cm', marginY: '1.5cm' },
    // Tabloid (11" × 17") is larger - can use more margin
    tabloid: { typstName: 'us-tabloid', marginX: '0.75in', marginY: '0.75in' },
  }
  return configs[size as PaperSize] || configs['us-letter']
}

export function generateMonthlyTypst(config: TypstConfig): string {
  const { month, year, paperSize, tempDir, daysInMonth } = config
  const paperConfig = getPaperConfig(paperSize)
  const firstDayOfWeek = getFirstDayOfWeek(year, month)
  const monthName = MONTH_NAMES[month - 1]

  // Generate calendar cells with proper empty cells before the first day
  let cells = ''

  // Empty cells before first day
  for (let i = 0; i < firstDayOfWeek; i++) {
    cells += '  [],\n'
  }

  // Day cells
  for (let day = 1; day <= daysInMonth; day++) {
    cells += `  [#image("day-${day}.svg", width: 90%)],\n`
  }

  return `#set page(
  paper: "${paperConfig.typstName}",
  margin: (x: ${paperConfig.marginX}, y: ${paperConfig.marginY}),
)

#set text(font: "Arial", size: 10pt)

// Title and year - compact header
#align(center)[
  #text(size: 18pt, weight: "bold")[${monthName} ${year}]
  #h(1em)
  #box(baseline: 25%, image("year.svg", width: 20%))
]

#v(0.5em)

// Calendar grid - maximizes available space
#grid(
  columns: (1fr, 1fr, 1fr, 1fr, 1fr, 1fr, 1fr),
  gutter: 2pt,
  row-gutter: 2pt,

  // Weekday headers
  [#align(center)[#text(size: 9pt, weight: "bold")[Sun]]],
  [#align(center)[#text(size: 9pt, weight: "bold")[Mon]]],
  [#align(center)[#text(size: 9pt, weight: "bold")[Tue]]],
  [#align(center)[#text(size: 9pt, weight: "bold")[Wed]]],
  [#align(center)[#text(size: 9pt, weight: "bold")[Thu]]],
  [#align(center)[#text(size: 9pt, weight: "bold")[Fri]]],
  [#align(center)[#text(size: 9pt, weight: "bold")[Sat]]],

  // Calendar days
${cells})
`
}

export function generateDailyTypst(config: TypstConfig): string {
  const { month, year, paperSize, tempDir, daysInMonth } = config
  const paperConfig = getPaperConfig(paperSize)
  const monthName = MONTH_NAMES[month - 1]

  let pages = ''

  for (let day = 1; day <= daysInMonth; day++) {
    const dayOfWeek = getDayOfWeek(year, month, day)

    pages += `
#page(
  paper: "${paperConfig.typstName}",
  margin: (x: ${paperConfig.marginX}, y: ${paperConfig.marginY}),
)[
  // Header: Year
  #align(center)[
    #v(1em)
    #image("year.svg", width: 30%)
  ]

  #v(2em)

  // Main: Day number as large abacus
  #align(center + horizon)[
    #image("day-${day}.svg", width: 50%)
  ]

  #v(2em)

  // Footer: Day of week and date
  #align(center)[
    #text(size: 18pt, weight: "bold")[${dayOfWeek}]

    #v(0.5em)

    #text(size: 14pt)[${monthName} ${day}, ${year}]
  ]

  // Notes section
  #v(3em)
  #line(length: 100%, stroke: 0.5pt)
  #v(0.5em)
  #text(size: 10pt, fill: gray)[Notes:]
  #v(0.5em)
  #line(length: 100%, stroke: 0.5pt)
  #v(1em)
  #line(length: 100%, stroke: 0.5pt)
  #v(1em)
  #line(length: 100%, stroke: 0.5pt)
  #v(1em)
  #line(length: 100%, stroke: 0.5pt)
]

${day < daysInMonth ? '' : ''}`

    if (day < daysInMonth) {
      pages += '\n'
    }
  }

  return `#set text(font: "Arial")
${pages}
`
}
