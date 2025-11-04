/**
 * AbacusStatic - Server Component compatible static abacus
 *
 * Shares core logic with AbacusReact but uses static rendering without hooks/animations.
 * Reuses: numberToAbacusState, getBeadColor logic, positioning calculations
 * Different: No hooks, no animations, no interactions, simplified rendering
 */

import { numberToAbacusState } from './AbacusUtils'
import { AbacusStaticBead } from './AbacusStaticBead'
import type {
  AbacusCustomStyles,
  BeadConfig,
  ValidPlaceValues
} from './AbacusReact'

export interface AbacusStaticConfig {
  value: number | bigint
  columns?: number | 'auto'
  beadShape?: 'circle' | 'diamond' | 'square'
  colorScheme?: 'monochrome' | 'place-value' | 'alternating' | 'heaven-earth'
  colorPalette?: 'default' | 'pastel' | 'vibrant' | 'earth-tones'
  showNumbers?: boolean | 'always' | 'never'
  hideInactiveBeads?: boolean
  scaleFactor?: number
  frameVisible?: boolean
  compact?: boolean
  customStyles?: AbacusCustomStyles
  highlightColumns?: number[]
  columnLabels?: string[]
}

// Shared color logic from AbacusReact (simplified for static use)
function getBeadColor(
  bead: BeadConfig,
  totalColumns: number,
  colorScheme: string,
  colorPalette: string
): string {
  const placeValue = bead.placeValue

  // Place-value coloring
  if (colorScheme === 'place-value') {
    const colors: Record<string, string[]> = {
      default: [
        '#ef4444', // red - ones
        '#f59e0b', // amber - tens
        '#10b981', // emerald - hundreds
        '#3b82f6', // blue - thousands
        '#8b5cf6', // purple - ten thousands
        '#ec4899', // pink - hundred thousands
        '#14b8a6', // teal - millions
        '#f97316', // orange - ten millions
        '#6366f1', // indigo - hundred millions
        '#84cc16', // lime - billions
      ],
      pastel: [
        '#fca5a5', '#fcd34d', '#6ee7b7', '#93c5fd', '#c4b5fd',
        '#f9a8d4', '#5eead4', '#fdba74', '#a5b4fc', '#bef264',
      ],
      vibrant: [
        '#dc2626', '#d97706', '#059669', '#2563eb', '#7c3aed',
        '#db2777', '#0d9488', '#ea580c', '#4f46e5', '#65a30d',
      ],
      'earth-tones': [
        '#92400e', '#78350f', '#365314', '#1e3a8a', '#4c1d95',
        '#831843', '#134e4a', '#7c2d12', '#312e81', '#3f6212',
      ],
    }

    const palette = colors[colorPalette] || colors.default
    return palette[placeValue % palette.length]
  }

  // Heaven-earth coloring
  if (colorScheme === 'heaven-earth') {
    return bead.type === 'heaven' ? '#3b82f6' : '#10b981'
  }

  // Alternating coloring
  if (colorScheme === 'alternating') {
    const columnIndex = totalColumns - 1 - placeValue
    return columnIndex % 2 === 0 ? '#3b82f6' : '#10b981'
  }

  // Monochrome (default)
  return '#3b82f6'
}

// Calculate bead positions (simplified from AbacusReact)
function calculateBeadPosition(
  bead: BeadConfig,
  dimensions: { beadSize: number; rodSpacing: number; heavenY: number; earthY: number; barY: number; totalColumns: number }
): { x: number; y: number } {
  const { beadSize, rodSpacing, heavenY, earthY, barY, totalColumns } = dimensions

  // X position based on place value (rightmost = ones place)
  const columnIndex = totalColumns - 1 - bead.placeValue
  const x = columnIndex * rodSpacing + rodSpacing / 2

  // Y position based on bead type and active state
  if (bead.type === 'heaven') {
    // Heaven bead: if active, near bar; if inactive, at top
    const y = bead.active ? barY - beadSize - 5 : heavenY
    return { x, y }
  } else {
    // Earth bead: if active, stack up from bar; if inactive, at bottom
    const earthSpacing = beadSize + 4
    if (bead.active) {
      // Active earth beads stack upward from the bar
      const y = barY + beadSize / 2 + 10 + bead.position * earthSpacing
      return { x, y }
    } else {
      // Inactive earth beads rest at the bottom
      const y = earthY + (bead.position - 2) * earthSpacing
      return { x, y }
    }
  }
}

/**
 * AbacusStatic - Pure static abacus component (Server Component compatible)
 */
export function AbacusStatic({
  value,
  columns = 'auto',
  beadShape = 'circle',
  colorScheme = 'place-value',
  colorPalette = 'default',
  showNumbers = true,
  hideInactiveBeads = false,
  scaleFactor = 1,
  frameVisible = true,
  compact = false,
  customStyles,
  highlightColumns = [],
  columnLabels = [],
}: AbacusStaticConfig) {
  // Calculate columns
  const valueStr = value.toString().replace('-', '')
  const minColumns = Math.max(1, valueStr.length)
  const effectiveColumns = columns === 'auto' ? minColumns : Math.max(columns, minColumns)

  // Use shared utility to convert value to bead states
  const state = numberToAbacusState(value, effectiveColumns)

  // Generate bead configs (matching AbacusReact's structure)
  const beadConfigs: BeadConfig[][] = []
  for (let colIndex = 0; colIndex < effectiveColumns; colIndex++) {
    const placeValue = (effectiveColumns - 1 - colIndex) as ValidPlaceValues
    const columnState = state[placeValue] || { heavenActive: false, earthActive: 0 }

    const beads: BeadConfig[] = []

    // Heaven bead
    beads.push({
      type: 'heaven',
      value: 5,
      active: columnState.heavenActive,
      position: 0,
      placeValue,
    })

    // Earth beads
    for (let i = 0; i < 4; i++) {
      beads.push({
        type: 'earth',
        value: 1,
        active: i < columnState.earthActive,
        position: i,
        placeValue,
      })
    }

    beadConfigs.push(beads)
  }

  // Calculate dimensions (matching AbacusReact)
  const beadSize = 20
  const rodSpacing = 40
  const heavenHeight = 60
  const earthHeight = 120
  const barHeight = 10
  const padding = 20
  const numberHeightCalc = showNumbers ? 30 : 0
  const labelHeight = columnLabels.length > 0 ? 30 : 0

  const width = effectiveColumns * rodSpacing + padding * 2
  const height = heavenHeight + earthHeight + barHeight + padding * 2 + numberHeightCalc + labelHeight

  const dimensions = {
    width,
    height,
    beadSize,
    rodSpacing,
    heavenY: padding + labelHeight + heavenHeight / 3,
    earthY: padding + labelHeight + heavenHeight + barHeight + earthHeight * 0.7,
    barY: padding + labelHeight + heavenHeight,
    padding,
    totalColumns: effectiveColumns,
  }

  // Compact mode hides frame
  const effectiveFrameVisible = compact ? false : frameVisible

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={width * scaleFactor}
      height={height * scaleFactor}
      viewBox={`0 0 ${width} ${height}`}
      className={`abacus-svg ${hideInactiveBeads ? 'hide-inactive-mode' : ''}`}
      style={{ overflow: 'visible', display: 'block' }}
    >
      <defs>
        <style>{`
          .abacus-bead {
            transition: opacity 0.2s ease-in-out;
          }
          .hide-inactive-mode .abacus-bead.hidden-inactive {
            opacity: 0 !important;
          }
        `}</style>
      </defs>

      {/* Column highlights */}
      {highlightColumns.map((colIndex) => {
        if (colIndex < 0 || colIndex >= effectiveColumns) return null

        const x = colIndex * rodSpacing + rodSpacing / 2 + padding
        const highlightWidth = rodSpacing * 0.9
        const highlightHeight = height - padding * 2 - numberHeightCalc - labelHeight

        return (
          <rect
            key={`column-highlight-${colIndex}`}
            x={x - highlightWidth / 2}
            y={padding + labelHeight}
            width={highlightWidth}
            height={highlightHeight}
            fill="rgba(59, 130, 246, 0.15)"
            stroke="rgba(59, 130, 246, 0.4)"
            strokeWidth={2}
            rx={6}
            style={{ pointerEvents: 'none' }}
          />
        )
      })}

      {/* Column labels */}
      {columnLabels.map((label, colIndex) => {
        if (!label || colIndex >= effectiveColumns) return null

        const x = colIndex * rodSpacing + rodSpacing / 2 + padding

        return (
          <text
            key={`column-label-${colIndex}`}
            x={x}
            y={padding + 15}
            textAnchor="middle"
            fontSize="14"
            fontWeight="600"
            fill="rgba(0, 0, 0, 0.7)"
            style={{ pointerEvents: 'none', userSelect: 'none' }}
          >
            {label}
          </text>
        )
      })}

      {/* Rods (column posts) */}
      {effectiveFrameVisible && beadConfigs.map((_, colIndex) => {
        const x = colIndex * rodSpacing + rodSpacing / 2 + padding

        return (
          <rect
            key={`rod-${colIndex}`}
            x={x - 3}
            y={padding + labelHeight}
            width={6}
            height={heavenHeight + earthHeight + barHeight}
            fill={customStyles?.columnPosts?.fill || 'rgb(0, 0, 0, 0.1)'}
            stroke={customStyles?.columnPosts?.stroke || 'rgba(0, 0, 0, 0.2)'}
            strokeWidth={customStyles?.columnPosts?.strokeWidth || 1}
            opacity={customStyles?.columnPosts?.opacity ?? 1}
          />
        )
      })}

      {/* Reckoning bar */}
      {effectiveFrameVisible && (
        <rect
          x={padding}
          y={dimensions.barY}
          width={effectiveColumns * rodSpacing}
          height={barHeight}
          fill={customStyles?.reckoningBar?.fill || 'rgb(0, 0, 0, 0.15)'}
          stroke={customStyles?.reckoningBar?.stroke || 'rgba(0, 0, 0, 0.3)'}
          strokeWidth={customStyles?.reckoningBar?.strokeWidth || 2}
          opacity={customStyles?.reckoningBar?.opacity ?? 1}
        />
      )}

      {/* Beads */}
      {beadConfigs.map((columnBeads, colIndex) => {
        const placeValue = effectiveColumns - 1 - colIndex

        return (
          <g key={`column-${colIndex}`}>
            {columnBeads.map((bead, beadIndex) => {
              const position = calculateBeadPosition(bead, dimensions)

              // Adjust X for padding
              position.x += padding

              const color = getBeadColor(bead, effectiveColumns, colorScheme, colorPalette)

              return (
                <AbacusStaticBead
                  key={`bead-${colIndex}-${beadIndex}`}
                  bead={bead}
                  x={position.x}
                  y={position.y}
                  size={beadSize}
                  shape={beadShape}
                  color={color}
                  hideInactiveBeads={hideInactiveBeads}
                  customStyle={
                    bead.type === 'heaven'
                      ? customStyles?.heavenBeads
                      : customStyles?.earthBeads
                  }
                />
              )
            })}
          </g>
        )
      })}

      {/* Column numbers */}
      {showNumbers && beadConfigs.map((_, colIndex) => {
        const placeValue = effectiveColumns - 1 - colIndex
        const columnState = state[placeValue] || { heavenActive: false, earthActive: 0 }
        const digit = (columnState.heavenActive ? 5 : 0) + columnState.earthActive
        const x = colIndex * rodSpacing + rodSpacing / 2 + padding

        return (
          <text
            key={`number-${colIndex}`}
            x={x}
            y={height - padding + 5}
            textAnchor="middle"
            fontSize={customStyles?.numerals?.fontSize || 16}
            fontWeight={customStyles?.numerals?.fontWeight || '600'}
            fill={customStyles?.numerals?.color || 'rgba(0, 0, 0, 0.8)'}
            style={{ pointerEvents: 'none', userSelect: 'none' }}
          >
            {digit}
          </text>
        )
      })}
    </svg>
  )
}

export default AbacusStatic
