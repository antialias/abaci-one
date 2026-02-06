// Script to generate example worksheet images for the blog post
// Shows different scaffolding levels for the 2D difficulty blog post

import fs from 'fs'
import path from 'path'
import { generateWorksheetPreview } from '../src/app/create/worksheets/generatePreview'
import { DIFFICULTY_PROFILES } from '../src/app/create/worksheets/difficultyProfiles'

// Output directory
const outputDir = path.join(process.cwd(), 'public', 'blog', 'difficulty-examples')

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true })
}

// Generate examples with SAME regrouping level but different scaffolding
// This clearly shows how scaffolding changes while keeping problem complexity constant
const examples = [
  {
    name: 'full-scaffolding',
    filename: 'full-scaffolding.svg',
    description: 'Full Scaffolding: Maximum visual support',
    // Use medium regrouping with full scaffolding
    config: {
      pAllStart: 0.3,
      pAnyStart: 0.7,
      displayRules: {
        carryBoxes: 'always' as const,
        answerBoxes: 'always' as const,
        placeValueColors: 'always' as const,
        tenFrames: 'always' as const,
        problemNumbers: 'always' as const,
        cellBorders: 'always' as const,
        borrowNotation: 'never' as const,
        borrowingHints: 'never' as const,
      },
    },
  },
  {
    name: 'medium-scaffolding',
    filename: 'medium-scaffolding.svg',
    description: 'Medium Scaffolding: Strategic support',
    config: {
      pAllStart: 0.3,
      pAnyStart: 0.7,
      displayRules: {
        carryBoxes: 'whenRegrouping' as const,
        answerBoxes: 'always' as const,
        placeValueColors: 'when3PlusDigits' as const,
        tenFrames: 'never' as const,
        problemNumbers: 'always' as const,
        cellBorders: 'always' as const,
        borrowNotation: 'never' as const,
        borrowingHints: 'never' as const,
      },
    },
  },
  {
    name: 'minimal-scaffolding',
    filename: 'minimal-scaffolding.svg',
    description: 'Minimal Scaffolding: Carry boxes only',
    config: {
      pAllStart: 0.3,
      pAnyStart: 0.7,
      displayRules: {
        carryBoxes: 'whenMultipleRegroups' as const,
        answerBoxes: 'never' as const,
        placeValueColors: 'never' as const,
        tenFrames: 'never' as const,
        problemNumbers: 'always' as const,
        cellBorders: 'always' as const,
        borrowNotation: 'never' as const,
        borrowingHints: 'never' as const,
      },
    },
  },
  {
    name: 'no-scaffolding',
    filename: 'no-scaffolding.svg',
    description: 'No Scaffolding: Students work independently',
    config: {
      pAllStart: 0.3,
      pAnyStart: 0.7,
      displayRules: {
        carryBoxes: 'never' as const,
        answerBoxes: 'never' as const,
        placeValueColors: 'never' as const,
        tenFrames: 'never' as const,
        problemNumbers: 'always' as const,
        cellBorders: 'always' as const,
        borrowNotation: 'never' as const,
        borrowingHints: 'never' as const,
      },
    },
  },
] as const

console.log('Generating blog example worksheets...\n')

for (const example of examples) {
  console.log(`Generating ${example.description}...`)

  const config = {
    pAllStart: example.config.pAllStart,
    pAnyStart: example.config.pAnyStart,
    displayRules: example.config.displayRules,
    problemsPerPage: 4,
    pages: 1,
    cols: 2,
  }

  try {
    const result = await generateWorksheetPreview(config)

    if (!result.success || !result.pages || result.pages.length === 0) {
      console.error(`Failed to generate ${example.name}:`, result.error)
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

console.log('\nDone! Example worksheets generated.')
console.log(`\nFiles saved to: ${outputDir}`)
