/**
 * Proposition dependency graph — DAG computation + layout for the tech tree.
 *
 * Built on top of book1.ts (single source of truth for all 48 propositions).
 */

import { propositions, getPrerequisites, getDependents, getProposition } from './book1'

// ---------------------------------------------------------------------------
// Which propositions are playable (have interactive implementations)
// ---------------------------------------------------------------------------

export const IMPLEMENTED_PROPS = new Set([1, 2, 3])

// ---------------------------------------------------------------------------
// Node status computation
// ---------------------------------------------------------------------------

export type NodeStatus = 'completed' | 'available' | 'locked' | 'coming-soon'

/**
 * Determine the status of a single proposition node.
 *
 * - completed: player has finished it
 * - available: implemented + all prerequisite propositions completed (or no deps)
 * - locked: implemented but some prerequisite not completed
 * - coming-soon: not yet implemented
 */
export function getNodeStatus(propId: number, completed: Set<number>): NodeStatus {
  if (completed.has(propId)) return 'completed'
  if (!IMPLEMENTED_PROPS.has(propId)) return 'coming-soon'

  const deps = getPrerequisites(propId)
  const allDepsMet = deps.every(d => completed.has(d))
  return allDepsMet ? 'available' : 'locked'
}

/**
 * Which nodes should be visible on the map.
 *
 * Default view: all implemented props + ONE level of direct dependents as
 * "coming-soon" teasers (only dependents whose prerequisites are ALL visible).
 *
 * Full view: all 48 nodes.
 */
export function getVisibleNodes(completed: Set<number>, showAll: boolean): number[] {
  if (showAll) return propositions.map(p => p.id)

  const visible = new Set<number>()

  // Always show all implemented props
  for (const id of IMPLEMENTED_PROPS) {
    visible.add(id)
  }

  // Add direct dependents of implemented props as teasers,
  // but only those whose ALL prerequisites are in the visible set
  // (prevents pulling in distant unreachable nodes)
  for (const id of IMPLEMENTED_PROPS) {
    for (const depId of getDependents(id)) {
      if (visible.has(depId)) continue
      const deps = getPrerequisites(depId)
      if (deps.every(d => visible.has(d) || IMPLEMENTED_PROPS.has(d))) {
        visible.add(depId)
      }
    }
  }

  return [...visible].sort((a, b) => a - b)
}

/**
 * Given a just-completed proposition, which NEW propositions become available?
 * (Only counts implemented propositions whose deps are now all satisfied.)
 */
export function getUnlockedBy(propId: number, completed: Set<number>): number[] {
  const afterCompletion = new Set(completed)
  afterCompletion.add(propId)

  const dependents = getDependents(propId)
  return dependents.filter(depId => {
    if (!IMPLEMENTED_PROPS.has(depId)) return false
    if (completed.has(depId)) return false
    const deps = getPrerequisites(depId)
    return deps.every(d => afterCompletion.has(d))
  })
}

/**
 * Get the next available implemented proposition to play.
 * Prefers the lowest-numbered available proposition.
 */
export function getNextProp(completed: Set<number>): number | null {
  for (const p of propositions) {
    if (!IMPLEMENTED_PROPS.has(p.id)) continue
    if (completed.has(p.id)) continue
    const deps = getPrerequisites(p.id)
    if (deps.every(d => completed.has(d))) return p.id
  }
  return null
}

// ---------------------------------------------------------------------------
// Topological level layout
// ---------------------------------------------------------------------------

/**
 * Compute the topological level of every proposition.
 * Level = longest path from a root (prop with no prop dependencies).
 */
function computeLevels(): Map<number, number> {
  const levels = new Map<number, number>()

  function getLevel(id: number): number {
    if (levels.has(id)) return levels.get(id)!
    const deps = getPrerequisites(id)
    if (deps.length === 0) {
      levels.set(id, 0)
      return 0
    }
    const level = 1 + Math.max(...deps.map(getLevel))
    levels.set(id, level)
    return level
  }

  for (const p of propositions) getLevel(p.id)
  return levels
}

const PROP_LEVELS = computeLevels()

export interface NodeLayout {
  x: number
  y: number
  level: number
}

// ---------------------------------------------------------------------------
// Sugiyama-style layered DAG layout
//
// Phase 1: Layer assignment (topological levels — already computed above)
// Phase 2: Crossing reduction via barycenter heuristic
// Phase 3: Coordinate assignment with parent-aligned positioning
// ---------------------------------------------------------------------------

const NODE_WIDTH = 130
const ROW_HEIGHT = 80
const NODE_GAP = 24

/**
 * Barycenter crossing-reduction: reorder nodes within each layer so that
 * edges to adjacent layers cross as little as possible.
 *
 * The barycenter of a node = average position of its connected nodes in the
 * adjacent layer. Sorting by barycenter minimizes crossings.
 * We alternate downward and upward sweeps for several iterations.
 */
function reduceCrossings(
  layers: number[][],
  visibleSet: Set<number>,
): void {
  // Build position-in-layer lookup
  const posOf = new Map<number, number>()
  function rebuildPositions() {
    posOf.clear()
    for (const layer of layers) {
      for (let i = 0; i < layer.length; i++) {
        posOf.set(layer[i], i)
      }
    }
  }

  rebuildPositions()

  const SWEEPS = 8

  for (let sweep = 0; sweep < SWEEPS; sweep++) {
    // Downward sweep: use parents (layer above) to sort
    for (let li = 1; li < layers.length; li++) {
      const layer = layers[li]
      const barycenters = new Map<number, number>()
      for (const id of layer) {
        const parents = getPrerequisites(id).filter(d => visibleSet.has(d))
        if (parents.length > 0) {
          const avg = parents.reduce((sum, p) => sum + (posOf.get(p) ?? 0), 0) / parents.length
          barycenters.set(id, avg)
        } else {
          barycenters.set(id, posOf.get(id) ?? 0)
        }
      }
      layer.sort((a, b) => (barycenters.get(a) ?? 0) - (barycenters.get(b) ?? 0))
      // Update positions after sorting this layer
      for (let i = 0; i < layer.length; i++) {
        posOf.set(layer[i], i)
      }
    }

    // Upward sweep: use children (layer below) to sort
    for (let li = layers.length - 2; li >= 0; li--) {
      const layer = layers[li]
      const barycenters = new Map<number, number>()
      for (const id of layer) {
        const children = getDependents(id).filter(d => visibleSet.has(d))
        if (children.length > 0) {
          const avg = children.reduce((sum, c) => sum + (posOf.get(c) ?? 0), 0) / children.length
          barycenters.set(id, avg)
        } else {
          barycenters.set(id, posOf.get(id) ?? 0)
        }
      }
      layer.sort((a, b) => (barycenters.get(a) ?? 0) - (barycenters.get(b) ?? 0))
      for (let i = 0; i < layer.length; i++) {
        posOf.set(layer[i], i)
      }
    }
  }
}

/**
 * Coordinate assignment: position nodes horizontally so that each node is
 * close to the average x of its parents (priority placement), falling back
 * to evenly-spaced within the layer.
 */
function assignCoordinates(
  layers: number[][],
  visibleSet: Set<number>,
): Map<number, { x: number; row: number }> {
  const coords = new Map<number, { x: number; row: number }>()

  // First pass: assign based on order index within each layer
  // This gives us an initial placement based on the crossing-reduced order.
  for (let row = 0; row < layers.length; row++) {
    const layer = layers[row]
    const totalWidth = layer.length * NODE_WIDTH + (layer.length - 1) * NODE_GAP
    const startX = -totalWidth / 2
    for (let i = 0; i < layer.length; i++) {
      coords.set(layer[i], {
        x: startX + i * (NODE_WIDTH + NODE_GAP) + NODE_WIDTH / 2,
        row,
      })
    }
  }

  // Second pass (top-down): shift nodes toward the average x of their parents
  // while respecting minimum spacing. This straightens edges.
  for (let row = 1; row < layers.length; row++) {
    const layer = layers[row]

    // Compute ideal x for each node (avg of parents' x)
    const idealX = new Map<number, number>()
    for (const id of layer) {
      const parents = getPrerequisites(id).filter(d => visibleSet.has(d))
      if (parents.length > 0) {
        const avgX = parents.reduce((sum, p) => sum + (coords.get(p)?.x ?? 0), 0) / parents.length
        idealX.set(id, avgX)
      }
    }

    // Greedily shift nodes toward their ideal x left-to-right
    const minSpacing = NODE_WIDTH + NODE_GAP
    let prevRight = -Infinity

    for (let i = 0; i < layer.length; i++) {
      const id = layer[i]
      const current = coords.get(id)!
      const ideal = idealX.get(id)
      const minX = prevRight + minSpacing
      const targetX = ideal !== undefined ? Math.max(ideal, minX) : Math.max(current.x, minX)
      coords.set(id, { x: targetX, row })
      prevRight = targetX
    }

    // Center the layer around x=0
    const xs = layer.map(id => coords.get(id)!.x)
    const centerOffset = (xs[0] + xs[xs.length - 1]) / 2
    for (const id of layer) {
      const c = coords.get(id)!
      coords.set(id, { x: c.x - centerOffset, row: c.row })
    }
  }

  return coords
}

/**
 * Compute a Sugiyama-style layout for the given visible nodes.
 *
 * 1. Layer assignment (topological levels, compacted)
 * 2. Crossing reduction (barycenter heuristic, 8 sweeps)
 * 3. Coordinate assignment (parent-aligned + minimum spacing)
 */
export function computeLayout(visibleIds: number[]): Map<number, NodeLayout> {
  const layout = new Map<number, NodeLayout>()
  if (visibleIds.length === 0) return layout

  const visibleSet = new Set(visibleIds)

  // Phase 1: group by topological level, compact into sequential rows
  const byLevel = new Map<number, number[]>()
  for (const id of visibleIds) {
    const level = PROP_LEVELS.get(id) ?? 0
    if (!byLevel.has(level)) byLevel.set(level, [])
    byLevel.get(level)!.push(id)
  }

  const sortedLevels = [...byLevel.keys()].sort((a, b) => a - b)
  const layers: number[][] = sortedLevels.map(level => {
    const nodes = byLevel.get(level)!
    // Initial ordering by prop ID (will be improved by crossing reduction)
    nodes.sort((a, b) => a - b)
    return nodes
  })

  // Phase 2: crossing reduction
  reduceCrossings(layers, visibleSet)

  // Phase 3: coordinate assignment
  const coords = assignCoordinates(layers, visibleSet)

  // Build final layout
  for (const id of visibleIds) {
    const c = coords.get(id)
    if (!c) continue
    layout.set(id, {
      x: c.x,
      y: c.row * ROW_HEIGHT,
      level: PROP_LEVELS.get(id) ?? 0,
    })
  }

  return layout
}

/**
 * Get the max topological level across all 48 propositions.
 */
export function getMaxLevel(): number {
  return Math.max(...PROP_LEVELS.values())
}

/**
 * Get all edges (prerequisite → dependent) for the visible nodes.
 */
export function getEdges(visibleIds: number[]): Array<{ from: number; to: number }> {
  const visibleSet = new Set(visibleIds)
  const edges: Array<{ from: number; to: number }> = []

  for (const id of visibleIds) {
    for (const dep of getPrerequisites(id)) {
      if (visibleSet.has(dep)) {
        edges.push({ from: dep, to: id })
      }
    }
  }

  return edges
}

// Re-export helpers consumers need
export { getProposition, getPrerequisites, getDependents }
