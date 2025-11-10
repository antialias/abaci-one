#!/usr/bin/env node

/**
 * Test script to parse the Rithmomachia board CSV and verify the layout.
 */

const fs = require('fs')
const path = require('path')

const csvPath = path.join(
  process.env.HOME,
  'Downloads',
  'rithmomachia board setup - Sheet1 (1).csv'
)

function parseCSV(csvContent) {
  const lines = csvContent.trim().split('\n')
  const pieces = []

  // Process in triplets (color, shape, number)
  for (let rankIndex = 0; rankIndex < 16; rankIndex++) {
    const colorRowIndex = rankIndex * 3
    const shapeRowIndex = rankIndex * 3 + 1
    const numberRowIndex = rankIndex * 3 + 2

    if (numberRowIndex >= lines.length) break

    const colorRow = lines[colorRowIndex].split(',')
    const shapeRow = lines[shapeRowIndex].split(',')
    const numberRow = lines[numberRowIndex].split(',')

    // Process each column (8 total)
    for (let colIndex = 0; colIndex < 8; colIndex++) {
      const color = colorRow[colIndex]?.trim()
      const shape = shapeRow[colIndex]?.trim()
      const numberStr = numberRow[colIndex]?.trim()

      // Skip empty cells (but allow empty number for Pyramids)
      if (!color || !shape) continue

      // Map CSV position to game square
      // CSV column → game row (1-8)
      // CSV rank → game column (A-P)
      const gameRow = colIndex + 1 // CSV col 0 → row 1, col 7 → row 8
      const gameCol = String.fromCharCode(65 + rankIndex) // rank 0 → A, rank 15 → P
      const square = `${gameCol}${gameRow}`

      // Parse color
      const pieceColor = color.toLowerCase() === 'black' ? 'B' : 'W'

      // Parse type
      let pieceType
      const shapeLower = shape.toLowerCase()
      if (shapeLower === 'circle') pieceType = 'C'
      else if (shapeLower === 'triangle' || shapeLower === 'traingle')
        pieceType = 'T' // Handle typo
      else if (shapeLower === 'square') pieceType = 'S'
      else if (shapeLower === 'pyramid') pieceType = 'P'
      else {
        console.warn(`Unknown shape "${shape}" at ${square}`)
        continue
      }

      // Parse value/pyramid faces
      if (pieceType === 'P') {
        // Pyramid - number cell should be empty, use default faces
        pieces.push({
          color: pieceColor,
          type: pieceType,
          pyramidFaces: pieceColor === 'B' ? [36, 25, 16, 4] : [64, 49, 36, 25],
          square,
        })
      } else {
        // Regular piece needs a number
        if (!numberStr) {
          console.warn(`Missing number for non-Pyramid ${shape} at ${square}`)
          continue
        }

        const value = parseInt(numberStr, 10)
        if (isNaN(value)) {
          console.warn(`Invalid number "${numberStr}" at ${square}`)
          continue
        }

        pieces.push({
          color: pieceColor,
          type: pieceType,
          value,
          square,
        })
      }
    }
  }

  return pieces
}

function generateBoardDisplay(pieces) {
  const lines = []

  lines.push('\n=== Board Layout (Game Orientation) ===')
  lines.push('BLACK (top)\n')
  lines.push(
    '    A      B      C      D      E      F      G      H      I      J      K      L      M      N      O      P'
  )

  for (let row = 8; row >= 1; row--) {
    let line = `${row}  `
    for (let colCode = 65; colCode <= 80; colCode++) {
      const col = String.fromCharCode(colCode)
      const square = `${col}${row}`
      const piece = pieces.find((p) => p.square === square)

      if (piece) {
        const val = piece.type === 'P' ? '  P' : piece.value.toString().padStart(3, ' ')
        line += ` ${piece.color}${piece.type}${val} `
      } else {
        line += '  ----  '
      }
    }
    lines.push(line)
  }

  lines.push('\nWHITE (bottom)\n')

  return lines.join('\n')
}

function generateColumnSummaries(pieces) {
  const lines = []

  lines.push('\n=== Column-by-Column Summary ===\n')

  for (let colCode = 65; colCode <= 80; colCode++) {
    const col = String.fromCharCode(colCode)
    const columnPieces = pieces
      .filter((p) => p.square[0] === col)
      .sort((a, b) => {
        const rowA = parseInt(a.square.substring(1))
        const rowB = parseInt(b.square.substring(1))
        return rowA - rowB
      })

    if (columnPieces.length === 0) continue

    const color = columnPieces[0].color === 'B' ? 'BLACK' : 'WHITE'
    lines.push(`Column ${col} (${color}):`)
    for (const piece of columnPieces) {
      const val = piece.type === 'P' ? 'P[36,25,16,4]' : piece.value
      lines.push(`  ${piece.square}: ${piece.type}(${val})`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

function countPieces(pieces) {
  const blackPieces = pieces.filter((p) => p.color === 'B')
  const whitePieces = pieces.filter((p) => p.color === 'W')

  const countByType = (pieces) => {
    const counts = { C: 0, T: 0, S: 0, P: 0 }
    for (const p of pieces) counts[p.type]++
    return counts
  }

  const blackCounts = countByType(blackPieces)
  const whiteCounts = countByType(whitePieces)

  console.log('\n=== Piece Counts ===')
  console.log(
    `Black: ${blackPieces.length} total (C:${blackCounts.C}, T:${blackCounts.T}, S:${blackCounts.S}, P:${blackCounts.P})`
  )
  console.log(
    `White: ${whitePieces.length} total (C:${whiteCounts.C}, T:${whiteCounts.T}, S:${whiteCounts.S}, P:${whiteCounts.P})`
  )
}

// Main
try {
  const csvContent = fs.readFileSync(csvPath, 'utf-8')
  const pieces = parseCSV(csvContent)

  console.log(`\nParsed ${pieces.length} pieces from CSV`)
  console.log(generateBoardDisplay(pieces))
  console.log(generateColumnSummaries(pieces))
  countPieces(pieces)

  // Save parsed data
  const outputPath = path.join(
    __dirname,
    '..',
    'src',
    'arcade-games',
    'rithmomachia',
    'utils',
    'parsedBoard.json'
  )
  fs.writeFileSync(outputPath, JSON.stringify(pieces, null, 2))
  console.log(`\n✅ Saved parsed board to: ${outputPath}`)
} catch (error) {
  console.error('Error:', error.message)
  process.exit(1)
}
