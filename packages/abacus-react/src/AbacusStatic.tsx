/**
 * AbacusStatic - Server Component compatible static abacus
 *
 * Shares layout and rendering with AbacusReact through dependency injection.
 * Uses standard dimensions to ensure same props = same exact visual output.
 * Reuses: AbacusSVGRenderer for structure, shared dimension/position calculators
 * Different: No hooks, no animations, no interactions, simplified bead rendering
 */

import { numberToAbacusState, calculateStandardDimensions, type CropPadding } from './AbacusUtils'
import { AbacusSVGRenderer } from './AbacusSVGRenderer'
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
  cropToActiveBeads?: boolean | { padding?: CropPadding }
}

// Shared color logic (matches AbacusReact)
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
  cropToActiveBeads,
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

  // Calculate standard dimensions (same as AbacusReact!)
  const dimensions = calculateStandardDimensions({
    columns: effectiveColumns,
    scaleFactor,
    showNumbers: !!showNumbers,
    columnLabels,
  })

  // Compact mode hides frame
  const effectiveFrameVisible = compact ? false : frameVisible

  // Use shared renderer with static bead component
  return (
    <AbacusSVGRenderer
      value={value}
      columns={effectiveColumns}
      state={state}
      beadConfigs={beadConfigs}
      dimensions={dimensions}
      scaleFactor={scaleFactor}
      beadShape={beadShape}
      colorScheme={colorScheme}
      colorPalette={colorPalette}
      hideInactiveBeads={hideInactiveBeads}
      frameVisible={effectiveFrameVisible}
      showNumbers={!!showNumbers}
      customStyles={customStyles}
      highlightColumns={highlightColumns}
      columnLabels={columnLabels}
      cropToActiveBeads={cropToActiveBeads}
      BeadComponent={AbacusStaticBead}
      getBeadColor={getBeadColor}
    />
  )
}

export default AbacusStatic
