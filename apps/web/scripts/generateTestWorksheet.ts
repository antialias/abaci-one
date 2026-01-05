#!/usr/bin/env tsx
/**
 * Generate a test worksheet image for grading tests
 *
 * Usage:
 *   npx tsx scripts/generateTestWorksheet.ts
 *
 * Creates: data/uploads/test-worksheet.png
 *
 * This generates a simple addition worksheet image that can be used
 * to test the GPT-5 grading pipeline without needing a real photo.
 */

import { createCanvas } from 'canvas'
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

function generateTestWorksheet() {
  // Create canvas (8.5" x 11" at 150 DPI)
  const width = 1275
  const height = 1650
  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')

  // White background
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)

  // Title
  ctx.fillStyle = '#000000'
  ctx.font = 'bold 48px Arial'
  ctx.fillText('Addition Practice Worksheet', 100, 100)

  // Generate 20 problems (4 rows × 5 columns)
  const problems = [
    { a: 45, b: 27, answer: 72, studentAnswer: 72 }, // Correct
    { a: 68, b: 45, answer: 113, studentAnswer: 103 }, // Incorrect (forgot to carry)
    { a: 23, b: 56, answer: 79, studentAnswer: 79 }, // Correct
    { a: 89, b: 34, answer: 123, studentAnswer: 123 }, // Correct
    { a: 57, b: 66, answer: 123, studentAnswer: 113 }, // Incorrect
    { a: 38, b: 47, answer: 85, studentAnswer: 85 }, // Correct
    { a: 74, b: 58, answer: 132, studentAnswer: 132 }, // Correct
    { a: 29, b: 83, answer: 112, studentAnswer: 102 }, // Incorrect
    { a: 91, b: 19, answer: 110, studentAnswer: 110 }, // Correct
    { a: 46, b: 78, answer: 124, studentAnswer: 124 }, // Correct
    { a: 63, b: 59, answer: 122, studentAnswer: 112 }, // Incorrect
    { a: 85, b: 27, answer: 112, studentAnswer: 112 }, // Correct
    { a: 34, b: 88, answer: 122, studentAnswer: 122 }, // Correct
    { a: 77, b: 65, answer: 142, studentAnswer: 132 }, // Incorrect
    { a: 52, b: 49, answer: 101, studentAnswer: 101 }, // Correct
    { a: 96, b: 37, answer: 133, studentAnswer: 133 }, // Correct
    { a: 41, b: 69, answer: 110, studentAnswer: 100 }, // Incorrect
    { a: 73, b: 58, answer: 131, studentAnswer: 131 }, // Correct
    { a: 28, b: 94, answer: 122, studentAnswer: 122 }, // Correct
    { a: 87, b: 76, answer: 163, studentAnswer: 153 }, // Incorrect
  ]

  // Draw problems in grid
  const startY = 200
  const problemWidth = 240
  const problemHeight = 280
  const cols = 5
  const rows = 4

  problems.forEach((problem, index) => {
    const col = index % cols
    const row = Math.floor(index / cols)
    const x = 80 + col * problemWidth
    const y = startY + row * problemHeight

    // Problem number
    ctx.font = 'bold 20px Arial'
    ctx.fillText(`${index + 1}.`, x, y)

    // Draw problem in column format
    ctx.font = '32px Arial'
    const aStr = problem.a.toString().padStart(3, ' ')
    const bStr = `+ ${problem.b.toString()}`

    ctx.fillText(aStr, x + 40, y + 40)
    ctx.fillText(bStr, x + 40, y + 80)

    // Draw line
    ctx.strokeStyle = '#000000'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(x + 40, y + 90)
    ctx.lineTo(x + 180, y + 90)
    ctx.stroke()

    // Student's answer (simulate handwriting with slight variation)
    ctx.font = 'italic 32px Arial'
    const answerStr = problem.studentAnswer.toString()
    const xOffset = x + 40 + (3 - answerStr.length) * 20 // Right-align
    ctx.fillText(answerStr, xOffset, y + 130)
  })

  // Footer
  ctx.font = '18px Arial'
  ctx.fillText('Score: 13/20 (65%) - Practice carrying in tens place', 100, height - 100)

  // Save to file
  const uploadDir = join(process.cwd(), 'data', 'uploads')
  mkdirSync(uploadDir, { recursive: true })

  const outputPath = join(uploadDir, 'test-worksheet.png')
  const buffer = canvas.toBuffer('image/png')
  writeFileSync(outputPath, buffer)

  console.log(`✅ Test worksheet generated: ${outputPath}`)
  console.log(`   13/20 correct (65%)`)
  console.log(`   7 errors (mostly carrying mistakes)`)
}

// Check if canvas is available
try {
  generateTestWorksheet()
} catch (error) {
  if (error instanceof Error && error.message.includes('canvas')) {
    console.error('❌ Canvas library not installed.')
    console.error('   This is optional - you can use a real worksheet photo instead.')
    console.error('   To install: npm install canvas')
  } else {
    throw error
  }
}
