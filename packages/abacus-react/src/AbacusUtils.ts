/**
 * Utility functions for working with abacus states and calculations
 * These help convert between numbers and bead positions, calculate diffs, etc.
 */

import type { ValidPlaceValues, BeadHighlight } from './AbacusReact'

/**
 * Calculate the actual rendered dimensions of a bead based on its shape
 * These values match the exact rendering in AbacusStaticBead and AbacusAnimatedBead
 *
 * @param size - The base bead size parameter
 * @param shape - The bead shape ('circle', 'diamond', or 'square')
 * @returns Object with width and height of the rendered bead
 */
export function calculateBeadDimensions(
  size: number,
  shape: 'circle' | 'diamond' | 'square' = 'diamond'
): { width: number; height: number } {
  switch (shape) {
    case 'diamond':
      // Diamond polygon: points=`${size*0.7},0 ${size*1.4},${size/2} ${size*0.7},${size} 0,${size/2}`
      // Spans from x=0 to x=size*1.4, y=0 to y=size
      return { width: size * 1.4, height: size }

    case 'circle':
      // Circle with radius=size/2, so diameter=size
      return { width: size, height: size }

    case 'square':
      // Square with width=size, height=size
      return { width: size, height: size }

    default:
      // Default to diamond (most common/largest)
      return { width: size * 1.4, height: size }
  }
}

/**
 * Represents the state of beads in a single column
 */
export interface BeadState {
  heavenActive: boolean
  earthActive: number // 0-4
}

/**
 * Represents the complete state of an abacus
 * Key is the place value (0 = ones, 1 = tens, etc.)
 */
export interface AbacusState {
  [placeValue: number]: BeadState
}

/**
 * Convert a number to abacus state representation
 * @param value - The number to convert
 * @param maxPlaces - Maximum number of place values to include
 * @returns AbacusState object representing the bead positions
 */
export function numberToAbacusState(value: number | bigint, maxPlaces: number = 5): AbacusState {
  const state: AbacusState = {}
  const valueNum = typeof value === 'bigint' ? Number(value) : value

  for (let place = 0; place < maxPlaces; place++) {
    const placeValueNum = 10 ** place
    const digit = Math.floor(valueNum / placeValueNum) % 10

    state[place] = {
      heavenActive: digit >= 5,
      earthActive: digit >= 5 ? digit - 5 : digit,
    }
  }

  return state
}

/**
 * Convert abacus state to a number
 * @param state - The abacus state to convert
 * @returns The numeric value represented by the abacus
 */
export function abacusStateToNumber(state: AbacusState): number {
  let total = 0

  for (const placeStr in state) {
    const place = parseInt(placeStr, 10)
    const beadState = state[place]
    const digit = (beadState.heavenActive ? 5 : 0) + beadState.earthActive
    total += digit * (10 ** place)
  }

  return total
}

/**
 * Bead highlight with place value (internal type for calculations)
 */
export interface PlaceValueBasedBead {
  placeValue: ValidPlaceValues
  beadType: 'heaven' | 'earth'
  position?: 0 | 1 | 2 | 3
}

/**
 * Calculate which beads need to change between two abacus states
 * @param startState - The starting abacus state
 * @param targetState - The target abacus state
 * @returns Object with arrays of bead additions and removals
 */
export function calculateBeadChanges(
  startState: AbacusState,
  targetState: AbacusState
): {
  additions: PlaceValueBasedBead[]
  removals: PlaceValueBasedBead[]
  placeValue: number
} {
  const additions: PlaceValueBasedBead[] = []
  const removals: PlaceValueBasedBead[] = []
  let mainPlaceValue = 0

  for (const placeStr in targetState) {
    const place = parseInt(placeStr, 10) as ValidPlaceValues
    const start = startState[place] || { heavenActive: false, earthActive: 0 }
    const target = targetState[place]

    // Check heaven bead changes
    if (!start.heavenActive && target.heavenActive) {
      additions.push({ placeValue: place, beadType: 'heaven' })
      mainPlaceValue = place
    } else if (start.heavenActive && !target.heavenActive) {
      removals.push({ placeValue: place, beadType: 'heaven' })
      mainPlaceValue = place
    }

    // Check earth bead changes
    if (target.earthActive > start.earthActive) {
      // Adding earth beads
      for (let pos = start.earthActive; pos < target.earthActive; pos++) {
        additions.push({ placeValue: place, beadType: 'earth', position: pos as 0 | 1 | 2 | 3 })
        mainPlaceValue = place
      }
    } else if (target.earthActive < start.earthActive) {
      // Removing earth beads
      for (let pos = start.earthActive - 1; pos >= target.earthActive; pos--) {
        removals.push({ placeValue: place, beadType: 'earth', position: pos as 0 | 1 | 2 | 3 })
        mainPlaceValue = place
      }
    }
  }

  return { additions, removals, placeValue: mainPlaceValue }
}

/**
 * Result of a bead diff calculation
 */
export interface BeadDiffResult {
  placeValue: ValidPlaceValues
  beadType: 'heaven' | 'earth'
  position?: number
  direction: 'activate' | 'deactivate'
  order: number // Order of operations for animations
}

/**
 * Output of calculateBeadDiff function
 */
export interface BeadDiffOutput {
  changes: BeadDiffResult[]
  highlights: PlaceValueBasedBead[]
  hasChanges: boolean
  summary: string
}

/**
 * Calculate the diff between two abacus states
 * Returns exactly which beads need to move with directions and order
 * @param fromState - Starting state
 * @param toState - Target state
 * @returns BeadDiffOutput with changes, highlights, and summary
 */
export function calculateBeadDiff(fromState: AbacusState, toState: AbacusState): BeadDiffOutput {
  const { additions, removals } = calculateBeadChanges(fromState, toState)

  const changes: BeadDiffResult[] = []
  const highlights: PlaceValueBasedBead[] = []
  let order = 0

  // Process removals first (pedagogical order: clear before adding)
  removals.forEach((removal) => {
    changes.push({
      placeValue: removal.placeValue,
      beadType: removal.beadType,
      position: removal.position,
      direction: 'deactivate',
      order: order++,
    })

    highlights.push({
      placeValue: removal.placeValue,
      beadType: removal.beadType,
      position: removal.position,
    })
  })

  // Process additions second (pedagogical order: add after clearing)
  additions.forEach((addition) => {
    changes.push({
      placeValue: addition.placeValue,
      beadType: addition.beadType,
      position: addition.position,
      direction: 'activate',
      order: order++,
    })

    highlights.push({
      placeValue: addition.placeValue,
      beadType: addition.beadType,
      position: addition.position,
    })
  })

  // Generate summary
  const summary = generateDiffSummary(changes)

  return {
    changes,
    highlights,
    hasChanges: changes.length > 0,
    summary,
  }
}

/**
 * Calculate bead diff from numeric values
 * Convenience function for when you have numbers instead of states
 * @param fromValue - Starting numeric value
 * @param toValue - Target numeric value
 * @param maxPlaces - Maximum number of place values to consider
 * @returns BeadDiffOutput
 */
export function calculateBeadDiffFromValues(
  fromValue: number | bigint,
  toValue: number | bigint,
  maxPlaces: number = 5
): BeadDiffOutput {
  const fromState = numberToAbacusState(fromValue, maxPlaces)
  const toState = numberToAbacusState(toValue, maxPlaces)
  return calculateBeadDiff(fromState, toState)
}

/**
 * Validate that an abacus value is within the supported range
 * @param value - The value to validate
 * @param maxPlaces - Maximum number of place values supported
 * @returns Object with isValid boolean and optional error message
 */
export function validateAbacusValue(
  value: number | bigint,
  maxPlaces: number = 5
): { isValid: boolean; error?: string } {
  const valueNum = typeof value === 'bigint' ? Number(value) : value

  if (valueNum < 0) {
    return { isValid: false, error: 'Negative values are not supported' }
  }

  const maxValue = 10 ** maxPlaces - 1
  if (valueNum > maxValue) {
    return { isValid: false, error: `Value exceeds maximum for ${maxPlaces} columns (max: ${maxValue})` }
  }

  return { isValid: true }
}

/**
 * Check if two abacus states are equal
 * @param state1 - First state
 * @param state2 - Second state
 * @returns true if states are equal
 */
export function areStatesEqual(state1: AbacusState, state2: AbacusState): boolean {
  const places1 = Object.keys(state1)
    .map((k) => parseInt(k, 10))
    .sort()
  const places2 = Object.keys(state2)
    .map((k) => parseInt(k, 10))
    .sort()

  if (places1.length !== places2.length) return false

  for (const place of places1) {
    const bead1 = state1[place]
    const bead2 = state2[place]

    if (!bead2) return false
    if (bead1.heavenActive !== bead2.heavenActive) return false
    if (bead1.earthActive !== bead2.earthActive) return false
  }

  return true
}

// Internal helper functions

function generateDiffSummary(changes: BeadDiffResult[]): string {
  if (changes.length === 0) {
    return 'No changes needed'
  }

  // Sort by order to respect pedagogical sequence
  const sortedChanges = [...changes].sort((a, b) => a.order - b.order)

  const deactivations = sortedChanges.filter((c) => c.direction === 'deactivate')
  const activations = sortedChanges.filter((c) => c.direction === 'activate')

  const parts: string[] = []

  // Process deactivations first (pedagogical order)
  if (deactivations.length > 0) {
    const deactivationsByPlace = groupByPlace(deactivations)
    Object.entries(deactivationsByPlace).forEach(([place, beads]) => {
      const placeName = getPlaceName(parseInt(place, 10))
      const heavenBeads = beads.filter((b) => b.beadType === 'heaven')
      const earthBeads = beads.filter((b) => b.beadType === 'earth')

      if (heavenBeads.length > 0) {
        parts.push(`remove heaven bead in ${placeName}`)
      }
      if (earthBeads.length > 0) {
        const count = earthBeads.length
        parts.push(`remove ${count} earth bead${count > 1 ? 's' : ''} in ${placeName}`)
      }
    })
  }

  // Process activations second (pedagogical order)
  if (activations.length > 0) {
    const activationsByPlace = groupByPlace(activations)
    Object.entries(activationsByPlace).forEach(([place, beads]) => {
      const placeName = getPlaceName(parseInt(place, 10))
      const heavenBeads = beads.filter((b) => b.beadType === 'heaven')
      const earthBeads = beads.filter((b) => b.beadType === 'earth')

      if (heavenBeads.length > 0) {
        parts.push(`add heaven bead in ${placeName}`)
      }
      if (earthBeads.length > 0) {
        const count = earthBeads.length
        parts.push(`add ${count} earth bead${count > 1 ? 's' : ''} in ${placeName}`)
      }
    })
  }

  return parts.join(', then ')
}

function groupByPlace(changes: BeadDiffResult[]): {
  [place: string]: BeadDiffResult[]
} {
  return changes.reduce(
    (groups, change) => {
      const place = change.placeValue.toString()
      if (!groups[place]) {
        groups[place] = []
      }
      groups[place].push(change)
      return groups
    },
    {} as { [place: string]: BeadDiffResult[] }
  )
}

function getPlaceName(place: number): string {
  switch (place) {
    case 0:
      return 'ones column'
    case 1:
      return 'tens column'
    case 2:
      return 'hundreds column'
    case 3:
      return 'thousands column'
    default:
      return `place ${place} column`
  }
}

/**
 * Complete layout dimensions for abacus rendering
 * Used by both static and dynamic rendering to ensure identical layouts
 */
export interface AbacusLayoutDimensions {
  // SVG canvas size
  width: number
  height: number

  // Bead and spacing
  beadSize: number
  rodSpacing: number  // Same as columnSpacing
  rodWidth: number
  barThickness: number

  // Gaps and positioning
  heavenEarthGap: number  // Gap between heaven and earth sections (where bar sits)
  activeGap: number       // Gap between active beads and reckoning bar
  inactiveGap: number     // Gap between inactive beads and active beads/bar
  adjacentSpacing: number // Minimal spacing for adjacent beads of same type

  // Key Y positions (absolute coordinates)
  barY: number           // Y position of reckoning bar
  heavenY: number        // Y position where inactive heaven beads rest
  earthY: number         // Y position where inactive earth beads rest

  // Padding and extras
  padding: number
  labelHeight: number
  numbersHeight: number

  // Derived values
  totalColumns: number
}

/**
 * Calculate standard layout dimensions for abacus rendering
 * This ensures both static and dynamic rendering use identical geometry
 * Same props = same exact visual output
 *
 * @param columns - Number of columns in the abacus
 * @param scaleFactor - Size multiplier (default: 1)
 * @param showNumbers - Whether numbers are shown below columns
 * @param columnLabels - Array of column labels (if any)
 * @returns Complete layout dimensions object
 */
export function calculateStandardDimensions({
  columns,
  scaleFactor = 1,
  showNumbers = false,
  columnLabels = [],
}: {
  columns: number
  scaleFactor?: number
  showNumbers?: boolean
  columnLabels?: string[]
}): AbacusLayoutDimensions {
  // Standard dimensions - used by both AbacusStatic and AbacusReact
  const rodWidth = 3 * scaleFactor
  const beadSize = 12 * scaleFactor
  const adjacentSpacing = 0.5 * scaleFactor
  const columnSpacing = 25 * scaleFactor
  const heavenEarthGap = 30 * scaleFactor
  const barThickness = 2 * scaleFactor

  // Positioning gaps
  const activeGap = 1 * scaleFactor
  const inactiveGap = 8 * scaleFactor

  // Calculate total dimensions
  const totalWidth = columns * columnSpacing
  const baseHeight = heavenEarthGap + 5 * (beadSize + 4 * scaleFactor) + 10 * scaleFactor

  // Extra spacing
  const numbersSpace = showNumbers ? 40 * scaleFactor : 0
  const labelSpace = columnLabels.length > 0 ? 30 * scaleFactor : 0
  const padding = 0 // No padding - keeps layout clean

  const totalHeight = baseHeight + numbersSpace + labelSpace

  // Key Y positions - bar is at heavenEarthGap from top
  const barY = heavenEarthGap + labelSpace
  const heavenY = labelSpace + activeGap  // Top area for inactive heaven beads
  const earthY = barY + barThickness + (4 * beadSize) + activeGap + inactiveGap  // Bottom area for inactive earth

  return {
    width: totalWidth,
    height: totalHeight,
    beadSize,
    rodSpacing: columnSpacing,
    rodWidth,
    barThickness,
    heavenEarthGap,
    activeGap,
    inactiveGap,
    adjacentSpacing,
    barY,
    heavenY,
    earthY,
    padding,
    labelHeight: labelSpace,
    numbersHeight: numbersSpace,
    totalColumns: columns,
  }
}

/**
 * @deprecated Use calculateStandardDimensions instead for full layout info
 * This function only returns width/height for backward compatibility
 */
export function calculateAbacusDimensions({
  columns,
  showNumbers = true,
  columnLabels = [],
}: {
  columns: number
  showNumbers?: boolean
  columnLabels?: string[]
}): { width: number; height: number } {
  // Redirect to new function for backward compatibility
  const dims = calculateStandardDimensions({ columns, scaleFactor: 1, showNumbers, columnLabels })
  return { width: dims.width, height: dims.height }
}

/**
 * Simplified bead config for position calculation
 * (Compatible with BeadConfig from AbacusReact)
 */
export interface BeadPositionConfig {
  type: 'heaven' | 'earth'
  active: boolean
  position: number  // 0 for heaven, 0-3 for earth
  placeValue: number
}

/**
 * Column state needed for earth bead positioning
 * (Required to calculate inactive earth bead positions correctly)
 */
export interface ColumnStateForPositioning {
  earthActive: number  // Number of active earth beads (0-4)
}

/**
 * Calculate the x,y position for a bead based on standard layout dimensions
 * This ensures both static and dynamic rendering position beads identically
 * Uses exact Typst formulas from the original implementation
 *
 * @param bead - Bead configuration
 * @param dimensions - Layout dimensions from calculateStandardDimensions
 * @param columnState - Optional column state (required for inactive earth beads)
 * @returns Object with x and y coordinates
 */
export function calculateBeadPosition(
  bead: BeadPositionConfig,
  dimensions: AbacusLayoutDimensions,
  columnState?: ColumnStateForPositioning
): { x: number; y: number } {
  const { beadSize, rodSpacing, heavenEarthGap, barThickness, activeGap, inactiveGap, adjacentSpacing, totalColumns, labelHeight } = dimensions

  // X position based on place value (rightmost = ones place)
  const columnIndex = totalColumns - 1 - bead.placeValue
  const x = columnIndex * rodSpacing + rodSpacing / 2

  // Y position based on bead type and active state
  // These formulas match the original Typst implementation exactly
  // NOTE: All Y positions are offset by labelHeight to match absolute SVG coordinates
  if (bead.type === 'heaven') {
    if (bead.active) {
      // Active heaven bead: positioned close to reckoning bar (Typst line 175)
      const y = labelHeight + heavenEarthGap - beadSize / 2 - activeGap
      return { x, y }
    } else {
      // Inactive heaven bead: positioned away from reckoning bar (Typst line 178)
      const y = labelHeight + heavenEarthGap - inactiveGap - beadSize / 2
      return { x, y }
    }
  } else {
    // Earth bead positioning (Typst lines 249-261)
    const earthActive = columnState?.earthActive ?? 0

    if (bead.active) {
      // Active beads: positioned near reckoning bar, adjacent beads touch (Typst line 251)
      const y = labelHeight + heavenEarthGap + barThickness + activeGap + beadSize / 2 +
                bead.position * (beadSize + adjacentSpacing)
      return { x, y }
    } else {
      // Inactive beads: positioned after active beads + gap (Typst lines 254-261)
      let y: number
      if (earthActive > 0) {
        // Position after the last active bead + gap, then adjacent inactive beads touch (Typst line 256)
        y = labelHeight + heavenEarthGap + barThickness + activeGap + beadSize / 2 +
            (earthActive - 1) * (beadSize + adjacentSpacing) +
            beadSize / 2 + inactiveGap + beadSize / 2 +
            (bead.position - earthActive) * (beadSize + adjacentSpacing)
      } else {
        // No active beads: position after reckoning bar + gap, adjacent inactive beads touch (Typst line 259)
        y = labelHeight + heavenEarthGap + barThickness + inactiveGap + beadSize / 2 +
            bead.position * (beadSize + adjacentSpacing)
      }
      return { x, y }
    }
  }
}

/**
 * Padding configuration for cropping
 */
export interface CropPadding {
  top?: number
  bottom?: number
  left?: number
  right?: number
}

/**
 * Bounding box for crop area
 */
export interface BoundingBox {
  minX: number
  minY: number
  maxX: number
  maxY: number
  width: number
  height: number
}

/**
 * Complete crop calculation result
 */
export interface CropResult extends BoundingBox {
  viewBox: string  // SVG viewBox attribute value
  scaledWidth: number  // Width after scaling to fit target
  scaledHeight: number  // Height after scaling to fit target
}

/**
 * Calculate bounding box around active beads for a given value
 * Uses the same position calculations as the rendering engine
 *
 * @param value - The number to display
 * @param columns - Number of columns
 * @param scaleFactor - Scale factor for the abacus
 * @returns Bounding box containing all active beads
 */
export function calculateActiveBeadsBounds(
  value: number,
  columns: number,
  scaleFactor: number = 1
): BoundingBox {
  // Get which beads are active for this value
  const abacusState = numberToAbacusState(value, columns)

  // Get layout dimensions
  const dimensions = calculateStandardDimensions({
    columns,
    scaleFactor,
    showNumbers: false,
    columnLabels: [],
  })

  // Calculate positions of all active beads
  const activeBeadPositions: Array<{ x: number; y: number }> = []

  for (let placeValue = 0; placeValue < columns; placeValue++) {
    const columnState = abacusState[placeValue]
    if (!columnState) continue

    // Heaven bead
    if (columnState.heavenActive) {
      const bead: BeadPositionConfig = {
        type: 'heaven',
        active: true,
        position: 0,
        placeValue,
      }
      const pos = calculateBeadPosition(bead, dimensions, { earthActive: columnState.earthActive })
      activeBeadPositions.push(pos)
    }

    // Earth beads
    for (let earthPos = 0; earthPos < columnState.earthActive; earthPos++) {
      const bead: BeadPositionConfig = {
        type: 'earth',
        active: true,
        position: earthPos,
        placeValue,
      }
      const pos = calculateBeadPosition(bead, dimensions, { earthActive: columnState.earthActive })
      activeBeadPositions.push(pos)
    }
  }

  if (activeBeadPositions.length === 0) {
    // Fallback if no active beads - show full abacus
    return {
      minX: 0,
      minY: 0,
      maxX: dimensions.width,
      maxY: dimensions.height,
      width: dimensions.width,
      height: dimensions.height,
    }
  }

  // Calculate bounding box from active bead positions
  // Use diamond dimensions (largest bead shape) for consistent cropping across all shapes
  const { width: beadWidth, height: beadHeight } = calculateBeadDimensions(dimensions.beadSize, 'diamond')

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity

  for (const pos of activeBeadPositions) {
    // Bead center is at pos.x, pos.y
    // Calculate bounding box for diamond shape
    minX = Math.min(minX, pos.x - beadWidth / 2)
    maxX = Math.max(maxX, pos.x + beadWidth / 2)
    minY = Math.min(minY, pos.y - beadHeight / 2)
    maxY = Math.max(maxY, pos.y + beadHeight / 2)
  }

  // HORIZONTAL BOUNDS: Always show full width of all columns (consistent across all values)
  // Use rod positions for consistent horizontal bounds
  const rodSpacing = dimensions.rodSpacing
  minX = rodSpacing / 2 - beadWidth / 2
  maxX = (columns - 0.5) * rodSpacing + beadWidth / 2

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  }
}

/**
 * Calculate crop parameters with padding for SVG viewBox
 *
 * @param value - The number to display
 * @param columns - Number of columns
 * @param scaleFactor - Scale factor for the abacus
 * @param padding - Padding to add around the crop area
 * @returns Complete crop result with viewBox and dimensions
 */
export function calculateAbacusCrop(
  value: number,
  columns: number,
  scaleFactor: number = 1,
  padding: CropPadding = {}
): CropResult {
  const bbox = calculateActiveBeadsBounds(value, columns, scaleFactor)

  // Apply padding
  const paddingTop = padding.top ?? 0
  const paddingBottom = padding.bottom ?? 0
  const paddingLeft = padding.left ?? 0
  const paddingRight = padding.right ?? 0

  const cropX = bbox.minX - paddingLeft
  const cropY = bbox.minY - paddingTop
  const cropWidth = bbox.width + paddingLeft + paddingRight
  const cropHeight = bbox.height + paddingTop + paddingBottom

  // Create viewBox string
  const viewBox = `${cropX} ${cropY} ${cropWidth} ${cropHeight}`

  return {
    minX: cropX,
    minY: cropY,
    maxX: cropX + cropWidth,
    maxY: cropY + cropHeight,
    width: cropWidth,
    height: cropHeight,
    viewBox,
    scaledWidth: cropWidth,
    scaledHeight: cropHeight,
  }
}
