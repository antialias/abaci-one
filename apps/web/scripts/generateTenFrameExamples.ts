// Script to generate ten-frame example images for blog post
// Shows single problems with different ten-frame scaffolding levels
//
// REUSABLE PATTERN: This script demonstrates how to generate single-problem
// examples for blog posts using the SAME code that powers the display options
// preview in the worksheet generator UI. The generateExampleTypst function
// in src/app/api/create/worksheets/addition/example/route.ts is the single
// source of truth for rendering individual problems with display options.
//
// To generate examples for other blog posts:
// 1. Import generateTypstHelpers and generateProblemStackFunction from typstHelpers.ts
// 2. Use the generateExampleTypst pattern below with your desired options
// 3. Compile to SVG using typst
// 4. Save to public/blog/[your-post-name]/

import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import {
  generateTypstHelpers,
  generateProblemStackFunction,
} from '../src/app/create/worksheets/typstHelpers'

// Output directory
const outputDir = path.join(process.cwd(), 'public', 'blog', 'ten-frame-examples')

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true })
}

interface ExampleOptions {
  showCarryBoxes?: boolean
  showAnswerBoxes?: boolean
  showPlaceValueColors?: boolean
  showTenFrames?: boolean
  showProblemNumbers?: boolean
  transparentBackground?: boolean
  fontSize?: number
  addend1: number
  addend2: number
}

/**
 * Generate a single compact problem example
 * This is the SAME logic used by the API route for display option previews
 * Extracted here so we can generate static examples for blog posts
 */
function generateExampleTypst(config: ExampleOptions): string {
  const a = config.addend1
  const b = config.addend2
  const fontSize = config.fontSize || 16
  const cellSize = 0.45 // Slightly larger for blog examples vs UI previews (0.35)

  // Boolean flags matching worksheet generator
  const showCarries = config.showCarryBoxes ?? false
  const showAnswers = config.showAnswerBoxes ?? false
  const showColors = config.showPlaceValueColors ?? false
  const showNumbers = config.showProblemNumbers ?? false
  const showTenFrames = config.showTenFrames ?? false
  const showTenFramesForAll = false // Not used for blog examples
  const transparentBg = config.transparentBackground ?? false

  return String.raw`
#set page(width: auto, height: auto, margin: 12pt, fill: ${transparentBg ? 'none' : 'white'})
#set text(size: ${fontSize}pt, font: "New Computer Modern Math")

#let heavy-stroke = 0.8pt
#let show-ten-frames-for-all = ${showTenFramesForAll ? 'true' : 'false'}

${generateTypstHelpers(cellSize)}

${generateProblemStackFunction(cellSize)}

#let a = ${a}
#let b = ${b}
#let aT = calc.floor(calc.rem(a, 100) / 10)
#let aO = calc.rem(a, 10)
#let bT = calc.floor(calc.rem(b, 100) / 10)
#let bO = calc.rem(b, 10)

#align(center + horizon)[
  #problem-stack(
    a, b, aT, aO, bT, bO,
    ${showNumbers ? '0' : 'none'},
    ${showCarries},
    ${showAnswers},
    ${showColors},
    ${showTenFrames},
    ${showNumbers}
  )
]
`
}

// Generate examples showing ten-frames in action
// Use problems that WILL have regrouping to show ten-frames
const examples = [
  {
    name: 'with-ten-frames',
    filename: 'with-ten-frames.svg',
    description: 'With Ten-Frames: Visual scaffolding for regrouping',
    options: {
      addend1: 47,
      addend2: 38, // 7+8=15 requires regrouping, will show ten-frames
      showCarryBoxes: false,
      showAnswerBoxes: false,
      showPlaceValueColors: false,
      showTenFrames: true,
      showProblemNumbers: false,
      transparentBackground: true,
    },
  },
  {
    name: 'without-ten-frames',
    filename: 'without-ten-frames.svg',
    description: 'Without Ten-Frames: Abstract representation',
    options: {
      addend1: 47,
      addend2: 38, // Same problem, no ten-frames
      showCarryBoxes: false,
      showAnswerBoxes: false,
      showPlaceValueColors: false,
      showTenFrames: false, // No ten-frames
      showProblemNumbers: false,
      transparentBackground: true,
    },
  },
  {
    name: 'beginner-with-ten-frames',
    filename: 'beginner-ten-frames.svg',
    description: 'Beginner: Learning regrouping with ten-frames',
    options: {
      addend1: 28,
      addend2: 15, // 8+5=13 requires regrouping
      showCarryBoxes: false,
      showAnswerBoxes: false,
      showPlaceValueColors: false,
      showTenFrames: true,
      showProblemNumbers: false,
      transparentBackground: true,
    },
  },
  {
    name: 'ten-frames-both-columns',
    filename: 'ten-frames-both-columns.svg',
    description: 'Ten-frames in both columns: Double regrouping',
    options: {
      addend1: 57,
      addend2: 68, // Both ones (7+8=15) and tens (5+6+1=12) regroup
      showCarryBoxes: false,
      showAnswerBoxes: false,
      showPlaceValueColors: false,
      showTenFrames: true,
      showProblemNumbers: false,
      transparentBackground: true,
    },
  },
] as const

console.log('Generating ten-frame example images (single problems)...\n')

for (const example of examples) {
  console.log(`Generating ${example.description}...`)

  try {
    const typstSource = generateExampleTypst(example.options)

    // Compile to SVG
    let svg = execSync('typst compile --format svg - -', {
      input: typstSource,
      encoding: 'utf8',
      maxBuffer: 2 * 1024 * 1024,
    })

    // Post-process: Make SVG visible on dark background
    // - Digits on white cells should stay BLACK
    // - Operator symbols (+) should be WHITE
    // - Structural elements (borders, bars) should be WHITE
    svg = svg
      .replace(/stroke="#000000"/g, 'stroke="rgba(255, 255, 255, 0.8)"')
      .replace(/stroke="#0000004d"/g, 'stroke="rgba(255, 255, 255, 0.4)"')

    // Replace operator (+) fill specifically to white
    svg = svg.replace(
      /(<use xlink:href="#gCFEF70472F9D2AA9AC128F96529819DA"[^>]*fill=")#000000/g,
      '$1rgba(255, 255, 255, 0.9)'
    )

    // Save to file
    const outputPath = path.join(outputDir, example.filename)
    fs.writeFileSync(outputPath, svg, 'utf-8')

    console.log(`  ✓ Saved to ${outputPath}`)
  } catch (error) {
    console.error(`  ✗ Error generating ${example.name}:`, error)
  }
}

console.log('\nDone! Ten-frame example images generated.')
console.log(`\nFiles saved to: ${outputDir}`)
