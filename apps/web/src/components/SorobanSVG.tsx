'use client'

import { css } from '../../styled-system/css'

interface SorobanSVGProps {
  number: number
  colorScheme?: 'monochrome' | 'place-value' | 'heaven-earth' | 'alternating'
  width?: number
  height?: number
  hideInactiveBeads?: boolean
  beadShape?: 'diamond' | 'circle' | 'square'
  className?: string
}

export function SorobanSVG({
  number,
  colorScheme = 'place-value',
  width = 240,
  height = 320,
  hideInactiveBeads = false,
  beadShape = 'diamond',
  className = ''
}: SorobanSVGProps) {
  const svg = generateSorobanSVG({
    number,
    colorScheme,
    width,
    height,
    hideInactiveBeads,
    beadShape
  })

  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

function generateSorobanSVG({
  number,
  colorScheme,
  width,
  height,
  hideInactiveBeads,
  beadShape
}: {
  number: number
  colorScheme: string
  width: number
  height: number
  hideInactiveBeads: boolean
  beadShape: string
}): string {
  const rodWidth = 4
  const beadSize = beadShape === 'circle' ? 10 : 8
  const heavenBeadHeight = 40
  const earthBeadHeight = 40

  // Determine number of rods needed
  const numString = Math.abs(number).toString()
  const rods = Math.max(numString.length, 2) // At least 2 rods for display

  // Adjust width based on number of rods
  const actualWidth = Math.max(width, 80 + rods * 50)

  let svg = `<svg width="${actualWidth}" height="${height}" viewBox="0 0 ${actualWidth} ${height}" xmlns="http://www.w3.org/2000/svg">`

  // Frame
  svg += `<rect x="10" y="10" width="${actualWidth-20}" height="${height-20}" fill="none" stroke="#8B4513" stroke-width="3"/>`

  // Crossbar (divider between heaven and earth)
  const crossbarY = height / 2
  svg += `<line x1="15" y1="${crossbarY}" x2="${actualWidth-15}" y2="${crossbarY}" stroke="#8B4513" stroke-width="3"/>`

  // Generate digits with proper padding
  const digits = numString.padStart(rods, '0').split('').map(d => parseInt(d))

  for (let i = 0; i < rods; i++) {
    const rodX = 40 + i * 50
    const digit = digits[i]
    const placeValue = Math.pow(10, rods - 1 - i) // 100s, 10s, 1s place etc.

    // Rod
    svg += `<line x1="${rodX}" y1="20" x2="${rodX}" y2="${height-20}" stroke="#654321" stroke-width="${rodWidth}"/>`

    // Calculate bead positions for this digit
    const heavenValue = digit >= 5 ? 1 : 0
    const earthValue = digit % 5

    // Get colors based on scheme and place value
    const colors = getBeadColors(colorScheme, placeValue)

    // Heaven bead (worth 5)
    const heavenActive = heavenValue > 0
    const heavenY = heavenActive ? crossbarY - 15 : 30
    const heavenColor = heavenActive ? colors.heaven : (hideInactiveBeads ? 'transparent' : '#E5E5E5')
    const heavenStroke = heavenActive || !hideInactiveBeads ? '#333' : 'transparent'

    if (heavenColor !== 'transparent') {
      svg += createBead(rodX, heavenY, beadSize, heavenColor, heavenStroke, beadShape)
    }

    // Earth beads (worth 1 each)
    for (let j = 0; j < 4; j++) {
      const isActive = j < earthValue
      const earthY = crossbarY + 20 + j * 25
      const earthColor = isActive ? colors.earth : (hideInactiveBeads ? 'transparent' : '#E5E5E5')
      const earthStroke = isActive || !hideInactiveBeads ? '#333' : 'transparent'

      if (earthColor !== 'transparent') {
        svg += createBead(rodX, earthY, beadSize, earthColor, earthStroke, beadShape)
      }
    }
  }

  svg += '</svg>'
  return svg
}

function createBead(x: number, y: number, size: number, fill: string, stroke: string, shape: string): string {
  switch (shape) {
    case 'circle':
      return `<circle cx="${x}" cy="${y}" r="${size}" fill="${fill}" stroke="${stroke}" stroke-width="1"/>`
    case 'square':
      return `<rect x="${x - size}" y="${y - size}" width="${size * 2}" height="${size * 2}" fill="${fill}" stroke="${stroke}" stroke-width="1"/>`
    case 'diamond':
    default:
      const points = `${x},${y - size} ${x + size},${y} ${x},${y + size} ${x - size},${y}`
      return `<polygon points="${points}" fill="${fill}" stroke="${stroke}" stroke-width="1"/>`
  }
}

function getBeadColors(colorScheme: string, placeValue: number): { heaven: string; earth: string } {
  switch (colorScheme) {
    case 'monochrome':
      return { heaven: '#666', earth: '#666' }

    case 'heaven-earth':
      return { heaven: '#FF6B6B', earth: '#4ECDC4' }

    case 'alternating':
      return placeValue % 2 === 0
        ? { heaven: '#FF6B6B', earth: '#4ECDC4' }
        : { heaven: '#4ECDC4', earth: '#FF6B6B' }

    case 'place-value':
    default:
      // Colors based on place value (ones, tens, hundreds, etc.)
      if (placeValue >= 1000) return { heaven: '#9B59B6', earth: '#8E44AD' } // Purple for thousands
      if (placeValue >= 100) return { heaven: '#E74C3C', earth: '#C0392B' }   // Red for hundreds
      if (placeValue >= 10) return { heaven: '#3498DB', earth: '#2980B9' }    // Blue for tens
      return { heaven: '#2ECC71', earth: '#27AE60' }                          // Green for ones
  }
}