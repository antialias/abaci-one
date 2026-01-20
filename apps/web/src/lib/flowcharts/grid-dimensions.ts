/**
 * Flowchart Grid Dimensions
 *
 * Infers grid layouts for displaying examples by analyzing the decision structure
 * of flowcharts. Used to organize examples into rows/columns based on the paths
 * they take through decision nodes.
 *
 * @module flowcharts/grid-dimensions
 */

import type { ExecutableFlowchart, DecisionNode } from './schema'
import type { FlowchartPath } from './path-analysis'
import type { GeneratedExample } from './example-generator'

// =============================================================================
// Types
// =============================================================================

/**
 * Grid dimensions inferred from flowchart decision structure
 */
export interface GridDimensions {
  /** Row display labels (kid-friendly, from gridLabel or pathLabel) */
  rows: string[]
  /** Column display labels (kid-friendly, from gridLabel or pathLabel) */
  cols: string[]
  /** Row matching keys (from pathLabel, for cellMap lookups) */
  rowKeys: string[]
  /** Column matching keys (from pathLabel, for cellMap lookups) */
  colKeys: string[]
  /** Map from pathDescriptor to [rowIndex, colIndex] */
  cellMap: Map<string, [number, number]>
}

// =============================================================================
// Path Descriptor Generation
// =============================================================================

/**
 * Generate path descriptor from a path object (without running the problem)
 */
export function generatePathDescriptorFromPath(
  flowchart: ExecutableFlowchart,
  path: FlowchartPath
): string {
  const labels: string[] = []

  for (let i = 0; i < path.nodeIds.length - 1; i++) {
    const nodeId = path.nodeIds[i]
    const nextNodeId = path.nodeIds[i + 1]
    const node = flowchart.nodes[nodeId]

    if (node?.definition.type === 'decision') {
      const decision = node.definition as DecisionNode
      const option = decision.options.find((o) => o.next === nextNodeId)
      if (option?.pathLabel) {
        labels.push(option.pathLabel)
      }
    }
  }

  return labels.join(' ')
}

// =============================================================================
// Grid Inference from Paths
// =============================================================================

/**
 * Infer grid dimensions by analyzing decision node structure.
 *
 * Algorithm:
 * 1. Find all decision nodes with pathLabel options
 * 2. Determine which decisions appear on ALL paths (independent) vs some paths (dependent)
 * 3. Independent decisions form the primary dimensions
 * 4. Dependent decisions refine their parent dimension's values
 * 5. Combine into row/column labels
 */
export function inferGridDimensions(
  flowchart: ExecutableFlowchart,
  paths: FlowchartPath[]
): GridDimensions | null {
  if (paths.length === 0) return null

  // Step 1: Find all decision nodes with pathLabel and track their appearances
  const decisionAppearances = new Map<
    string,
    {
      nodeId: string
      optionLabels: Map<string, string> // optionValue -> pathLabel
      optionGridLabels: Map<string, string> // optionValue -> gridLabel (kid-friendly)
      pathCount: number // how many paths include this decision
      pathsWithOption: Map<string, Set<number>> // optionValue -> set of path indices
    }
  >()

  // Analyze each path
  for (let pathIdx = 0; pathIdx < paths.length; pathIdx++) {
    const path = paths[pathIdx]

    for (let i = 0; i < path.nodeIds.length - 1; i++) {
      const nodeId = path.nodeIds[i]
      const nextNodeId = path.nodeIds[i + 1]
      const node = flowchart.nodes[nodeId]

      if (node?.definition.type === 'decision') {
        const decision = node.definition as DecisionNode
        const option = decision.options.find((o) => o.next === nextNodeId)

        if (option?.pathLabel) {
          let info = decisionAppearances.get(nodeId)
          if (!info) {
            info = {
              nodeId,
              optionLabels: new Map(),
              optionGridLabels: new Map(),
              pathCount: 0,
              pathsWithOption: new Map(),
            }
            decisionAppearances.set(nodeId, info)
          }

          info.optionLabels.set(option.value, option.pathLabel)
          // Store gridLabel if provided, for kid-friendly display (check undefined, not truthy, to allow empty string)
          if (option.gridLabel !== undefined) {
            info.optionGridLabels.set(option.value, option.gridLabel)
          }
          info.pathCount++

          let pathSet = info.pathsWithOption.get(option.value)
          if (!pathSet) {
            pathSet = new Set()
            info.pathsWithOption.set(option.value, pathSet)
          }
          pathSet.add(pathIdx)
        }
      }
    }
  }

  // Step 2: Classify decisions as independent (appear on all paths) or dependent
  const totalPaths = paths.length
  const independentDecisions: string[] = []
  const dependentDecisions: string[] = []

  for (const [nodeId, info] of decisionAppearances) {
    if (info.pathCount === totalPaths) {
      independentDecisions.push(nodeId)
    } else {
      dependentDecisions.push(nodeId)
    }
  }

  // Step 3: Order independent decisions by when they appear in paths (earlier = dimension 1)
  const avgPosition = (nodeId: string): number => {
    let sum = 0
    let count = 0
    for (const path of paths) {
      const idx = path.nodeIds.indexOf(nodeId)
      if (idx !== -1) {
        sum += idx
        count++
      }
    }
    return count > 0 ? sum / count : Infinity
  }

  independentDecisions.sort((a, b) => avgPosition(a) - avgPosition(b))

  // Handle different cases based on number of independent decisions
  if (independentDecisions.length === 0) {
    return inferGridFromDescriptors(flowchart, paths)
  }

  const dim1NodeId = independentDecisions[0]
  const dim1Info = decisionAppearances.get(dim1NodeId)!

  // 1D case: only one independent decision
  if (independentDecisions.length === 1) {
    return buildOneDimensionalGrid(
      flowchart,
      paths,
      dim1NodeId,
      dim1Info,
      dependentDecisions,
      decisionAppearances
    )
  }

  // 2D case: two independent decisions
  const dim2NodeId = independentDecisions[1]
  const dim2Info = decisionAppearances.get(dim2NodeId)!

  // Step 4: Build dimension values, incorporating dependent decisions as refinements
  // Returns both display labels (gridLabel) and matching keys (pathLabel)
  const buildDimensionValues = (
    primaryNodeId: string,
    primaryInfo: typeof dim1Info
  ): { displays: string[]; keys: string[] } => {
    const displays: string[] = []
    const keys: string[] = []

    for (const [optionValue, pathLabel] of primaryInfo.optionLabels) {
      // Use gridLabel if explicitly set (even if empty string), otherwise fall back to pathLabel
      const hasExplicitGridLabel = primaryInfo.optionGridLabels.has(optionValue)
      const gridLabel = hasExplicitGridLabel
        ? (primaryInfo.optionGridLabels.get(optionValue) ?? '')
        : pathLabel
      const pathsForOption = primaryInfo.pathsWithOption.get(optionValue)!

      // Check if any dependent decision refines this option
      const refinementDisplays: string[] = []
      const refinementKeys: string[] = []
      for (const depNodeId of dependentDecisions) {
        const depInfo = decisionAppearances.get(depNodeId)!

        // Check if this dependent decision appears on paths where primary chose this option
        const depPathIndices = new Set<number>()
        for (const pathSet of depInfo.pathsWithOption.values()) {
          for (const idx of pathSet) depPathIndices.add(idx)
        }

        const overlap = [...pathsForOption].filter((idx) => depPathIndices.has(idx))
        if (overlap.length > 0 && overlap.length === depInfo.pathCount) {
          // This dependent decision refines this option
          for (const [depOptValue, depPathLabel] of depInfo.optionLabels) {
            // Use gridLabel if explicitly set (even if empty), otherwise fall back to pathLabel
            const hasDepGridLabel = depInfo.optionGridLabels.has(depOptValue)
            const depGridLabel = hasDepGridLabel
              ? (depInfo.optionGridLabels.get(depOptValue) ?? '')
              : depPathLabel
            refinementDisplays.push(depGridLabel)
            refinementKeys.push(depPathLabel)
          }
        }
      }

      if (refinementDisplays.length > 0) {
        // Combine primary label with each refinement (trim to handle empty gridLabel)
        for (let i = 0; i < refinementDisplays.length; i++) {
          displays.push(`${gridLabel} ${refinementDisplays[i]}`.trim())
          keys.push(`${pathLabel} ${refinementKeys[i]}`)
        }
      } else {
        displays.push(gridLabel)
        keys.push(pathLabel)
      }
    }

    return { displays, keys }
  }

  const dim1 = buildDimensionValues(dim1NodeId, dim1Info)
  const dim2 = buildDimensionValues(dim2NodeId, dim2Info)

  // Step 5: Sort dimensions by average path complexity (simpler first)
  // Sort as tuples to keep displays and keys in sync
  const getAvgComplexity = (keyValue: string, isRow: boolean): number => {
    let totalDecisions = 0
    let count = 0
    for (const path of paths) {
      const descriptor = generatePathDescriptorFromPath(flowchart, path)
      const matches = isRow
        ? descriptor.startsWith(keyValue) || descriptor.startsWith(keyValue + ' ')
        : descriptor.endsWith(keyValue) || descriptor.endsWith(' ' + keyValue)
      if (matches) {
        totalDecisions += path.decisions
        count++
      }
    }
    return count > 0 ? totalDecisions / count : Infinity
  }

  // Sort by complexity, with "no X" variants before "X" variants (pedagogically simpler)
  const hasNegation = (s: string) => s.includes('no ') || s.includes('No ')

  // Create tuples of [display, key] and sort together
  const rowTuples: [string, string][] = dim1.displays.map((d, i) => [d, dim1.keys[i]])
  const colTuples: [string, string][] = dim2.displays.map((d, i) => [d, dim2.keys[i]])

  rowTuples.sort((a, b) => {
    const complexityDiff = getAvgComplexity(a[1], true) - getAvgComplexity(b[1], true)
    if (Math.abs(complexityDiff) > 0.1) return complexityDiff
    // "no borrow" before "borrow" - negated forms are simpler
    if (hasNegation(a[1]) && !hasNegation(b[1])) return -1
    if (!hasNegation(a[1]) && hasNegation(b[1])) return 1
    return a[1].localeCompare(b[1])
  })
  colTuples.sort((a, b) => {
    const complexityDiff = getAvgComplexity(a[1], false) - getAvgComplexity(b[1], false)
    if (Math.abs(complexityDiff) > 0.1) return complexityDiff
    // "no borrow" before "borrow" - negated forms are simpler
    if (hasNegation(a[1]) && !hasNegation(b[1])) return -1
    if (!hasNegation(a[1]) && hasNegation(b[1])) return 1
    return a[1].localeCompare(b[1])
  })

  // Extract sorted arrays
  const rows = rowTuples.map((t) => t[0])
  const rowKeys = rowTuples.map((t) => t[1])
  const cols = colTuples.map((t) => t[0])
  const colKeys = colTuples.map((t) => t[1])

  // Step 6: Build cell map from actual path descriptors (use keys for matching)
  const cellMap = new Map<string, [number, number]>()

  for (const path of paths) {
    // Get the path descriptor (uses pathLabel, same as keys)
    const descriptor = generatePathDescriptorFromPath(flowchart, path)

    // Find which row and column this descriptor belongs to (match against keys)
    const rowIdx = rowKeys.findIndex((k) => descriptor.startsWith(k) || descriptor.includes(k))
    const colIdx = colKeys.findIndex((k) => descriptor.endsWith(k) || descriptor.includes(k))

    if (rowIdx !== -1 && colIdx !== -1) {
      cellMap.set(descriptor, [rowIdx, colIdx])
    }
  }

  // Validate: every unique descriptor should have a cell
  const uniqueDescriptors = new Set(paths.map((p) => generatePathDescriptorFromPath(flowchart, p)))
  if (cellMap.size < uniqueDescriptors.size) {
    // Some descriptors didn't map - fall back
    return inferGridFromDescriptors(flowchart, paths)
  }

  return { rows, cols, rowKeys, colKeys, cellMap }
}

/**
 * Build a 1D grid when there's only one independent decision.
 * Returns a grid with groups (rows) but no columns.
 */
function buildOneDimensionalGrid(
  flowchart: ExecutableFlowchart,
  paths: FlowchartPath[],
  dimNodeId: string,
  dimInfo: {
    nodeId: string
    optionLabels: Map<string, string>
    optionGridLabels: Map<string, string>
    pathCount: number
    pathsWithOption: Map<string, Set<number>>
  },
  dependentDecisions: string[],
  decisionAppearances: Map<string, typeof dimInfo>
): GridDimensions {
  // Build dimension values with refinements (both display and key)
  const groupTuples: [string, string][] = [] // [display, key]

  for (const [optionValue, pathLabel] of dimInfo.optionLabels) {
    // Use gridLabel if explicitly set (even if empty string), otherwise fall back to pathLabel
    const hasExplicitGridLabel = dimInfo.optionGridLabels.has(optionValue)
    const gridLabel = hasExplicitGridLabel
      ? (dimInfo.optionGridLabels.get(optionValue) ?? '')
      : pathLabel
    const pathsForOption = dimInfo.pathsWithOption.get(optionValue)!

    // Check for refinements from dependent decisions
    const refinementTuples: [string, string][] = [] // [display, key]
    for (const depNodeId of dependentDecisions) {
      const depInfo = decisionAppearances.get(depNodeId)!

      const depPathIndices = new Set<number>()
      for (const pathSet of depInfo.pathsWithOption.values()) {
        for (const idx of pathSet) depPathIndices.add(idx)
      }

      const overlap = [...pathsForOption].filter((idx) => depPathIndices.has(idx))
      if (overlap.length > 0 && overlap.length === depInfo.pathCount) {
        for (const [depOptValue, depPathLabel] of depInfo.optionLabels) {
          // Use gridLabel if explicitly set (even if empty), otherwise fall back to pathLabel
          const hasDepGridLabel = depInfo.optionGridLabels.has(depOptValue)
          const depGridLabel = hasDepGridLabel
            ? (depInfo.optionGridLabels.get(depOptValue) ?? '')
            : depPathLabel
          refinementTuples.push([depGridLabel, depPathLabel])
        }
      }
    }

    if (refinementTuples.length > 0) {
      // Combine primary label with each refinement (trim to handle empty gridLabel)
      for (const [refDisplay, refKey] of refinementTuples) {
        groupTuples.push([`${gridLabel} ${refDisplay}`.trim(), `${pathLabel} ${refKey}`])
      }
    } else {
      groupTuples.push([gridLabel, pathLabel])
    }
  }

  // Sort by complexity (simpler first) - sort as tuples to keep display/key in sync
  const hasNegation = (s: string) => s.includes('no ') || s.includes('No ')
  const getAvgComplexity = (keyValue: string): number => {
    let totalDecisions = 0
    let count = 0
    for (const path of paths) {
      const descriptor = generatePathDescriptorFromPath(flowchart, path)
      if (
        descriptor === keyValue ||
        descriptor.startsWith(keyValue + ' ') ||
        descriptor.endsWith(' ' + keyValue)
      ) {
        totalDecisions += path.decisions
        count++
      }
    }
    return count > 0 ? totalDecisions / count : Infinity
  }

  groupTuples.sort((a, b) => {
    const complexityDiff = getAvgComplexity(a[1]) - getAvgComplexity(b[1])
    if (Math.abs(complexityDiff) > 0.1) return complexityDiff
    if (hasNegation(a[1]) && !hasNegation(b[1])) return -1
    if (!hasNegation(a[1]) && hasNegation(b[1])) return 1
    return a[1].localeCompare(b[1])
  })

  // Extract sorted arrays
  const rows = groupTuples.map((t) => t[0])
  const rowKeys = groupTuples.map((t) => t[1])

  // Build cell map - for 1D, column is always 0 (use keys for matching)
  const cellMap = new Map<string, [number, number]>()
  for (const path of paths) {
    const descriptor = generatePathDescriptorFromPath(flowchart, path)
    const groupIdx = rowKeys.findIndex(
      (k) =>
        descriptor === k ||
        descriptor.startsWith(k + ' ') ||
        descriptor.endsWith(' ' + k) ||
        descriptor.includes(k)
    )
    if (groupIdx !== -1) {
      cellMap.set(descriptor, [groupIdx, 0])
    }
  }

  // For 1D, cols is empty array to indicate single dimension
  return { rows, cols: [], rowKeys, colKeys: [], cellMap }
}

/**
 * Fallback: infer grid by analyzing the descriptor strings directly
 */
function inferGridFromDescriptors(
  flowchart: ExecutableFlowchart,
  paths: FlowchartPath[]
): GridDimensions | null {
  // Get all unique descriptors
  const descriptors = [...new Set(paths.map((p) => generatePathDescriptorFromPath(flowchart, p)))]

  if (descriptors.length < 2) return null

  // Try to find a natural split point by looking at common prefixes
  const prefixGroups = new Map<string, Set<string>>()

  for (const desc of descriptors) {
    const words = desc.split(' ')
    // Try different prefix lengths
    for (let len = 1; len < words.length; len++) {
      const prefix = words.slice(0, len).join(' ')
      const suffix = words.slice(len).join(' ')
      if (!prefixGroups.has(prefix)) {
        prefixGroups.set(prefix, new Set())
      }
      prefixGroups.get(prefix)!.add(suffix)
    }
  }

  // Find prefixes that have multiple distinct suffixes and cover all descriptors
  let bestSplit: { rows: string[]; cols: string[] } | null = null
  let bestScore = 0

  for (const [prefix, suffixes] of prefixGroups) {
    if (suffixes.size >= 2) {
      // Check how many descriptors this prefix covers
      const covered = descriptors.filter((d) => d.startsWith(prefix + ' ') || d === prefix)
      const score = covered.length * suffixes.size

      if (score > bestScore) {
        // Find all prefixes at this "level"
        const prefixLen = prefix.split(' ').length
        const allPrefixes = new Set<string>()
        const allSuffixes = new Set<string>()

        for (const desc of descriptors) {
          const words = desc.split(' ')
          if (words.length > prefixLen) {
            allPrefixes.add(words.slice(0, prefixLen).join(' '))
            allSuffixes.add(words.slice(prefixLen).join(' '))
          } else {
            allPrefixes.add(desc)
            allSuffixes.add('')
          }
        }

        if (allPrefixes.size >= 2 && allSuffixes.size >= 2) {
          bestSplit = {
            rows: [...allPrefixes],
            cols: [...allSuffixes].filter((s) => s !== ''),
          }
          bestScore = score
        }
      }
    }
  }

  if (!bestSplit || bestSplit.cols.length === 0) return null

  // Build cell map
  const cellMap = new Map<string, [number, number]>()
  for (const desc of descriptors) {
    const rowIdx = bestSplit.rows.findIndex((r) => desc.startsWith(r))
    const colIdx = bestSplit.cols.findIndex((c) => desc.endsWith(c))
    if (rowIdx !== -1 && colIdx !== -1) {
      cellMap.set(desc, [rowIdx, colIdx])
    }
  }

  // For fallback, keys are the same as displays (no gridLabel available)
  return {
    rows: bestSplit.rows,
    cols: bestSplit.cols,
    rowKeys: bestSplit.rows,
    colKeys: bestSplit.cols,
    cellMap,
  }
}

// =============================================================================
// Grid Inference from Examples
// =============================================================================

/**
 * Infer grid dimensions dynamically from a set of examples.
 * Unlike inferGridDimensions (which uses all possible paths), this function
 * analyzes which dimensions actually VARY within the given examples and
 * uses the top 2 varying dimensions as grid axes.
 *
 * This is useful when filtering by difficulty tier - the grid adapts to show
 * the dimensions that are most meaningful for that tier.
 */
export function inferGridDimensionsFromExamples(
  flowchart: ExecutableFlowchart,
  examples: GeneratedExample[]
): GridDimensions | null {
  if (examples.length === 0) return null

  // Step 1: Extract decision choices from each example's pathSignature
  // pathSignature is "NODE1→NODE2→NODE3→..." - we trace through to find decisions
  const exampleDecisions: Array<Map<string, { pathLabel: string; gridLabel?: string }>> = []

  for (const example of examples) {
    const nodeIds = example.pathSignature.split('→')
    const decisions = new Map<string, { pathLabel: string; gridLabel?: string }>()

    for (let i = 0; i < nodeIds.length - 1; i++) {
      const nodeId = nodeIds[i]
      const nextNodeId = nodeIds[i + 1]
      const node = flowchart.nodes[nodeId]

      if (node?.definition.type === 'decision') {
        const decision = node.definition as DecisionNode
        const option = decision.options.find((o) => o.next === nextNodeId)
        if (option?.pathLabel) {
          decisions.set(nodeId, {
            pathLabel: option.pathLabel,
            gridLabel: option.gridLabel,
          })
        }
      }
    }

    exampleDecisions.push(decisions)
  }

  // Step 2: Count unique values per decision node
  const decisionVariation = new Map<
    string,
    {
      uniqueValues: Set<string>
      pathLabels: Map<string, string> // value -> pathLabel
      gridLabels: Map<string, string | undefined> // value -> gridLabel
    }
  >()

  for (const decisions of exampleDecisions) {
    for (const [nodeId, { pathLabel, gridLabel }] of decisions) {
      let info = decisionVariation.get(nodeId)
      if (!info) {
        info = {
          uniqueValues: new Set(),
          pathLabels: new Map(),
          gridLabels: new Map(),
        }
        decisionVariation.set(nodeId, info)
      }
      info.uniqueValues.add(pathLabel)
      info.pathLabels.set(pathLabel, pathLabel)
      info.gridLabels.set(pathLabel, gridLabel)
    }
  }

  // Step 3: Rank decisions by variation (number of unique values)
  const rankedDecisions = [...decisionVariation.entries()]
    .filter(([, info]) => info.uniqueValues.size >= 2) // Only decisions with variation
    .sort((a, b) => {
      // Primary: more unique values = more important
      const diff = b[1].uniqueValues.size - a[1].uniqueValues.size
      if (diff !== 0) return diff
      // Secondary: more examples that hit this decision
      const aCount = exampleDecisions.filter((d) => d.has(a[0])).length
      const bCount = exampleDecisions.filter((d) => d.has(b[0])).length
      return bCount - aCount
    })

  if (rankedDecisions.length === 0) {
    // No varying dimensions - fall back to single cell or descriptor-based
    return inferGridFromDescriptorsFromExamples(examples)
  }

  // Step 4: Build grid from top 1 or 2 dimensions
  const dim1NodeId = rankedDecisions[0][0]
  const dim1Info = rankedDecisions[0][1]

  if (rankedDecisions.length === 1) {
    // 1D grid
    const rows: string[] = []
    const rowKeys: string[] = []

    for (const pathLabel of dim1Info.uniqueValues) {
      const gridLabel = dim1Info.gridLabels.get(pathLabel)
      // Use gridLabel if it's a non-empty string, otherwise fall back to pathLabel
      rows.push(gridLabel ? gridLabel : pathLabel)
      rowKeys.push(pathLabel)
    }

    // Build cell map
    const cellMap = new Map<string, [number, number]>()
    for (const example of examples) {
      const rowIdx = rowKeys.findIndex(
        (k) =>
          example.pathDescriptor === k ||
          example.pathDescriptor.startsWith(k + ' ') ||
          example.pathDescriptor.includes(' ' + k + ' ') ||
          example.pathDescriptor.endsWith(' ' + k)
      )
      if (rowIdx !== -1) {
        cellMap.set(example.pathDescriptor, [rowIdx, 0])
      }
    }

    return { rows, cols: [], rowKeys, colKeys: [], cellMap }
  }

  // 2D grid
  const dim2NodeId = rankedDecisions[1][0]
  const dim2Info = rankedDecisions[1][1]

  // Determine which dimension appears first in paths (use as rows)
  let dim1First = true
  for (const decisions of exampleDecisions) {
    const keys = [...decisions.keys()]
    const idx1 = keys.indexOf(dim1NodeId)
    const idx2 = keys.indexOf(dim2NodeId)
    if (idx1 !== -1 && idx2 !== -1) {
      dim1First = idx1 < idx2
      break
    }
  }

  const rowInfo = dim1First ? dim1Info : dim2Info
  const colInfo = dim1First ? dim2Info : dim1Info

  const rows: string[] = []
  const rowKeys: string[] = []
  const cols: string[] = []
  const colKeys: string[] = []

  for (const pathLabel of rowInfo.uniqueValues) {
    const gridLabel = rowInfo.gridLabels.get(pathLabel)
    // Use gridLabel if it's a non-empty string, otherwise fall back to pathLabel
    rows.push(gridLabel ? gridLabel : pathLabel)
    rowKeys.push(pathLabel)
  }

  for (const pathLabel of colInfo.uniqueValues) {
    const gridLabel = colInfo.gridLabels.get(pathLabel)
    // Use gridLabel if it's a non-empty string, otherwise fall back to pathLabel
    cols.push(gridLabel ? gridLabel : pathLabel)
    colKeys.push(pathLabel)
  }

  // Build cell map
  const cellMap = new Map<string, [number, number]>()
  for (const example of examples) {
    // Find row - which rowKey appears in the descriptor?
    const rowIdx = rowKeys.findIndex(
      (k) =>
        example.pathDescriptor === k ||
        example.pathDescriptor.startsWith(k + ' ') ||
        example.pathDescriptor.includes(' ' + k + ' ') ||
        example.pathDescriptor.endsWith(' ' + k)
    )

    // Find col - which colKey appears in the descriptor?
    const colIdx = colKeys.findIndex(
      (k) =>
        example.pathDescriptor === k ||
        example.pathDescriptor.startsWith(k + ' ') ||
        example.pathDescriptor.includes(' ' + k + ' ') ||
        example.pathDescriptor.endsWith(' ' + k)
    )

    if (rowIdx !== -1 && colIdx !== -1) {
      cellMap.set(example.pathDescriptor, [rowIdx, colIdx])
    }
  }

  // Check if 2D grid is sparse (diagonal pattern) - if so, collapse to 1D
  // A 2D grid is "sparse" if no row or column has more than 1 occupied CELL
  // (not counting descriptors - multiple descriptors can share a cell)

  // Count unique columns per row, and unique rows per column
  const colsPerRow = new Map<number, Set<number>>()
  const rowsPerCol = new Map<number, Set<number>>()
  for (const [rowIdx, colIdx] of cellMap.values()) {
    if (!colsPerRow.has(rowIdx)) colsPerRow.set(rowIdx, new Set())
    colsPerRow.get(rowIdx)!.add(colIdx)

    if (!rowsPerCol.has(colIdx)) rowsPerCol.set(colIdx, new Set())
    rowsPerCol.get(colIdx)!.add(rowIdx)
  }

  const maxColsPerRow = Math.max(...[...colsPerRow.values()].map((s) => s.size), 0)
  const maxRowsPerCol = Math.max(...[...rowsPerCol.values()].map((s) => s.size), 0)

  // If no row spans >1 column AND no column spans >1 row, collapse to 1D
  if (maxColsPerRow <= 1 && maxRowsPerCol <= 1) {
    // Create combined labels: "Row Label + Col Label"
    // Group by unique (rowIdx, colIdx) pairs
    const uniqueCells = new Map<string, { rowIdx: number; colIdx: number; descriptors: string[] }>()
    for (const [descriptor, [rowIdx, colIdx]] of cellMap.entries()) {
      const key = `${rowIdx},${colIdx}`
      if (!uniqueCells.has(key)) {
        uniqueCells.set(key, { rowIdx, colIdx, descriptors: [] })
      }
      uniqueCells.get(key)!.descriptors.push(descriptor)
    }

    const combinedRows: string[] = []
    const combinedRowKeys: string[] = []
    const combinedCellMap = new Map<string, [number, number]>()

    let idx = 0
    for (const { rowIdx, colIdx, descriptors } of uniqueCells.values()) {
      const combinedLabel = `${rows[rowIdx]} + ${cols[colIdx]}`
      combinedRows.push(combinedLabel)
      combinedRowKeys.push(descriptors[0]) // Use first descriptor as key
      // Map all descriptors for this cell to the new 1D index
      for (const descriptor of descriptors) {
        combinedCellMap.set(descriptor, [idx, 0])
      }
      idx++
    }

    return {
      rows: combinedRows,
      cols: [],
      rowKeys: combinedRowKeys,
      colKeys: [],
      cellMap: combinedCellMap,
    }
  }

  return { rows, cols, rowKeys, colKeys, cellMap }
}

/**
 * Fallback: infer grid from pathDescriptor strings when no varying decisions found
 */
function inferGridFromDescriptorsFromExamples(examples: GeneratedExample[]): GridDimensions | null {
  const descriptors = [...new Set(examples.map((ex) => ex.pathDescriptor))]

  if (descriptors.length < 2) {
    // Single cell - all examples in one group
    const cellMap = new Map<string, [number, number]>()
    for (const ex of examples) {
      cellMap.set(ex.pathDescriptor, [0, 0])
    }
    return {
      rows: [descriptors[0] || 'All'],
      cols: [],
      rowKeys: [descriptors[0] || 'All'],
      colKeys: [],
      cellMap,
    }
  }

  // Simple 1D grid with each descriptor as a row
  const rows = descriptors
  const rowKeys = descriptors
  const cellMap = new Map<string, [number, number]>()
  for (let i = 0; i < descriptors.length; i++) {
    cellMap.set(descriptors[i], [i, 0])
  }

  return { rows, cols: [], rowKeys, colKeys: [], cellMap }
}
