// Script to generate multi-digit (>2 digits) worksheet examples for the blog post
// Shows how scaffolding adapts to different digit ranges

import fs from 'fs'
import path from 'path'
import { generateWorksheetPreview } from '../src/app/create/worksheets/generatePreview'

// Output directory
const outputDir = path.join(process.cwd(), 'public', 'blog', 'multi-digit-examples')

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true })
}

// Generate examples showing different digit ranges and adaptive scaffolding
const examples = [
  {
    name: 'two-digit-addition',
    filename: 'two-digit.svg',
    description: '2-digit addition (baseline)',
    config: {
      operator: 'addition' as const,
      pAllStart: 0.0,
      pAnyStart: 0.5,
      digitRange: { min: 2, max: 2 },
      mode: 'manual' as const,
      displayRules: {
        carryBoxes: 'always' as const,
        answerBoxes: 'always' as const,
        placeValueColors: 'never' as const,
        tenFrames: 'never' as const,
        problemNumbers: 'always' as const,
        cellBorders: 'always' as const,
        borrowNotation: 'never' as const,
        borrowingHints: 'never' as const,
      },
      showBorrowNotation: false,
      showBorrowingHints: false,
      showCarryBoxes: true,
    },
  },
  {
    name: 'three-digit-with-colors',
    filename: 'three-digit-colors.svg',
    description: '3-digit addition with place value colors',
    config: {
      operator: 'addition' as const,
      pAllStart: 0.0,
      pAnyStart: 0.5,
      digitRange: { min: 3, max: 3 },
      mode: 'manual' as const,
      displayRules: {
        carryBoxes: 'always' as const,
        answerBoxes: 'always' as const,
        placeValueColors: 'always' as const,
        tenFrames: 'never' as const,
        problemNumbers: 'always' as const,
        cellBorders: 'always' as const,
        borrowNotation: 'never' as const,
        borrowingHints: 'never' as const,
      },
      showBorrowNotation: false,
      showBorrowingHints: false,
      showCarryBoxes: true,
      showPlaceValueColors: true,
    },
  },
  {
    name: 'four-digit-addition',
    filename: 'four-digit.svg',
    description: '4-digit addition with adaptive scaffolding',
    config: {
      operator: 'addition' as const,
      pAllStart: 0.0,
      pAnyStart: 0.6,
      digitRange: { min: 4, max: 4 },
      mode: 'manual' as const,
      displayRules: {
        carryBoxes: 'always' as const,
        answerBoxes: 'always' as const,
        placeValueColors: 'always' as const,
        tenFrames: 'never' as const,
        problemNumbers: 'always' as const,
        cellBorders: 'always' as const,
        borrowNotation: 'never' as const,
        borrowingHints: 'never' as const,
      },
      showBorrowNotation: false,
      showBorrowingHints: false,
      showCarryBoxes: true,
      showPlaceValueColors: true,
    },
  },
  {
    name: 'five-digit-addition',
    filename: 'five-digit.svg',
    description: '5-digit addition (maximum complexity)',
    config: {
      operator: 'addition' as const,
      pAllStart: 0.3,
      pAnyStart: 0.8,
      digitRange: { min: 5, max: 5 },
      mode: 'manual' as const,
      displayRules: {
        carryBoxes: 'always' as const,
        answerBoxes: 'always' as const,
        placeValueColors: 'always' as const,
        tenFrames: 'never' as const,
        problemNumbers: 'always' as const,
        cellBorders: 'always' as const,
        borrowNotation: 'never' as const,
        borrowingHints: 'never' as const,
      },
      showBorrowNotation: false,
      showBorrowingHints: false,
      showCarryBoxes: true,
      showPlaceValueColors: true,
    },
  },
  {
    name: 'mixed-digit-range',
    filename: 'mixed-range.svg',
    description: 'Mixed problem sizes (2-4 digits)',
    config: {
      operator: 'addition' as const,
      pAllStart: 0.0,
      pAnyStart: 0.5,
      digitRange: { min: 2, max: 4 },
      mode: 'manual' as const,
      displayRules: {
        carryBoxes: 'always' as const,
        answerBoxes: 'always' as const,
        placeValueColors: 'always' as const,
        tenFrames: 'never' as const,
        problemNumbers: 'always' as const,
        cellBorders: 'always' as const,
        borrowNotation: 'never' as const,
        borrowingHints: 'never' as const,
      },
      showBorrowNotation: false,
      showBorrowingHints: false,
      showCarryBoxes: true,
      showPlaceValueColors: true,
    },
  },
  {
    name: 'three-digit-subtraction',
    filename: 'three-digit-subtraction.svg',
    description: '3-digit subtraction with borrowing',
    config: {
      operator: 'subtraction' as const,
      pAllStart: 0.0,
      pAnyStart: 0.8,
      digitRange: { min: 3, max: 3 },
      mode: 'manual' as const,
      displayRules: {
        carryBoxes: 'never' as const,
        answerBoxes: 'always' as const,
        placeValueColors: 'always' as const,
        tenFrames: 'never' as const,
        problemNumbers: 'always' as const,
        cellBorders: 'always' as const,
        borrowNotation: 'never' as const,
        borrowingHints: 'never' as const,
      },
      showBorrowNotation: true,
      showBorrowingHints: false,
    },
  },
] as const

console.log('Generating multi-digit example worksheets...\n')

for (const example of examples) {
  console.log(`Generating ${example.description}...`)

  const config = {
    ...example.config,
    problemsPerPage: 4,
    pages: 1,
    cols: 2,
    seed: 54321, // Fixed seed for consistent examples
  }

  try {
    const result = generateWorksheetPreview(config)

    if (!result.success || !result.pages || result.pages.length === 0) {
      console.error(`Failed to generate ${example.name}:`, result.error)
      console.error(`Details:`, result.details)
      continue
    }

    // Get the first page's SVG
    const svg = result.pages[0]

    // Save to file
    const outputPath = path.join(outputDir, example.filename)
    fs.writeFileSync(outputPath, svg, 'utf-8')

    console.log(`  ✓ Saved to ${outputPath}`)
  } catch (error) {
    console.error(`  ✗ Error generating ${example.name}:`, error)
  }
}

console.log('\nDone! Multi-digit example worksheets generated.')
console.log(`\nFiles saved to: ${outputDir}`)
