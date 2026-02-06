/**
 * Generate SVG elements for flashcards using React SSR
 * This replaces Python-based SVG generation for better performance
 */

import type React from 'react'
import { AbacusStatic } from '@soroban/abacus-react/static'

export interface FlashcardConfig {
  beadShape?: 'diamond' | 'circle' | 'square'
  colorScheme?: 'monochrome' | 'place-value' | 'heaven-earth' | 'alternating'
  colorPalette?: 'default' | 'pastel' | 'vibrant' | 'earth-tones'
  hideInactiveBeads?: boolean
  showEmptyColumns?: boolean
  columns?: number | 'auto'
  scaleFactor?: number
  coloredNumerals?: boolean
}

/**
 * Generate front SVG (abacus) for a flashcard
 */
export function generateFlashcardFront(
  value: number,
  config: FlashcardConfig = {}
): React.ReactElement {
  const {
    beadShape = 'diamond',
    colorScheme = 'place-value',
    colorPalette = 'default',
    hideInactiveBeads = false,
    columns = 'auto',
    scaleFactor = 0.9,
  } = config

  return (
    <AbacusStatic
      value={value}
      columns={columns}
      beadShape={beadShape}
      colorScheme={colorScheme}
      colorPalette={colorPalette}
      hideInactiveBeads={hideInactiveBeads}
      showNumbers={false}
      frameVisible={true}
      scaleFactor={scaleFactor}
    />
  )
}

/**
 * Generate back SVG (numeral) for a flashcard
 */
export function generateFlashcardBack(
  value: number,
  config: FlashcardConfig = {}
): React.ReactElement {
  const { coloredNumerals = false, colorScheme = 'place-value' } = config

  // For back, we show just the numeral
  // Use a simple SVG with text
  const fontSize = 120
  const width = 300
  const height = 200

  // Get color based on place value if colored numerals enabled
  const textColor =
    coloredNumerals && colorScheme === 'place-value' ? getPlaceValueColor(value) : '#000000'

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
    >
      <text
        x={width / 2}
        y={height / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={fontSize}
        fontWeight="bold"
        fontFamily="DejaVu Sans, Arial, sans-serif"
        fill={textColor}
      >
        {value}
      </text>
    </svg>
  )
}

function getPlaceValueColor(value: number): string {
  // Simple place value coloring for single digits
  const colors = [
    '#ef4444', // red - ones
    '#f59e0b', // amber - tens
    '#10b981', // emerald - hundreds
    '#3b82f6', // blue - thousands
    '#8b5cf6', // purple - ten thousands
  ]

  const digits = value.toString().length
  return colors[(digits - 1) % colors.length]
}
