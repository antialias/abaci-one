/**
 * Proposition dependency graph — DAG computation + layout for the tech tree.
 *
 * Built on top of book1.ts (single source of truth for all 48 propositions).
 * Uses d3-dag with optimal crossing minimization (ILP-based) and transitive
 * reduction to remove redundant edges.
 */

import { graphStratify, sugiyama, decrossOpt, coordSimplex, layeringSimplex } from 'd3-dag'
import { propositions, getPrerequisites, getDependents, getProposition, getAllPrerequisites } from './book1'
import { PRECOMPUTED_NODES, PRECOMPUTED_EDGES } from './book1Layout'
import { PROP_REGISTRY } from '../propositions/registry'

// ---------------------------------------------------------------------------
// Which propositions are playable (have interactive implementations)
// ---------------------------------------------------------------------------

export const IMPLEMENTED_PROPS = new Set(Object.keys(PROP_REGISTRY).map(Number))

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
// Transitive reduction
// ---------------------------------------------------------------------------

/**
 * Compute the transitive reduction of the DAG for a set of visible nodes.
 *
 * Removes edge (u→v) if there is another path from u to v of length ≥ 2.
 * This eliminates the long-range "skip" edges that create visual clutter.
 *
 * For each node v with parents P:
 *   Edge (u→v) is redundant if u is a transitive ancestor of any other
 *   parent w ∈ P (meaning u→...→w→v already exists).
 */
function transitiveReduction(
  visibleIds: number[],
): Array<{ from: number; to: number }> {
  const visibleSet = new Set(visibleIds)
  const edges: Array<{ from: number; to: number }> = []

  for (const v of visibleIds) {
    const directParents = getPrerequisites(v).filter(d => visibleSet.has(d))
    if (directParents.length <= 1) {
      // 0 or 1 parents → no redundancy possible
      for (const u of directParents) {
        edges.push({ from: u, to: v })
      }
      continue
    }

    // For each parent u, check if it's a transitive ancestor of any OTHER parent
    const ancestorSets = new Map<number, Set<number>>()
    for (const u of directParents) {
      // getAllPrerequisites returns the full ancestor set (transitive) in topo order
      ancestorSets.set(u, new Set(getAllPrerequisites(u)))
    }

    for (const u of directParents) {
      let isRedundant = false
      for (const w of directParents) {
        if (w === u) continue
        // If w's ancestors include u, then u→...→w→v already exists
        if (ancestorSets.get(w)!.has(u)) {
          isRedundant = true
          break
        }
      }
      if (!isRedundant) {
        edges.push({ from: u, to: v })
      }
    }
  }

  return edges
}

// ---------------------------------------------------------------------------
// Layout via d3-dag (optimal crossing minimization)
// ---------------------------------------------------------------------------

export interface NodeLayout {
  x: number
  y: number
  level: number
}

/**
 * Edge with routing points for SVG rendering.
 */
export interface LayoutEdge {
  from: number
  to: number
  points: Array<{ x: number; y: number }>
}

const NODE_W = 130
const NODE_H = 48

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

/**
 * Compute layout using d3-dag Sugiyama algorithm with ILP-based optimal
 * crossing minimization and transitive reduction.
 *
 * Returns both node positions and routed edge paths.
 */
export function computeLayout(visibleIds: number[]): {
  nodes: Map<number, NodeLayout>
  edges: LayoutEdge[]
} {
  const nodes = new Map<number, NodeLayout>()
  if (visibleIds.length === 0) return { nodes, edges: [] }

  // For the full 48-node view, use pre-computed optimal layout
  // (decrossOpt ILP takes ~4 min — too slow for runtime)
  const allIds = propositions.map(p => p.id)
  if (visibleIds.length === allIds.length &&
      visibleIds.every((id, i) => id === allIds[i])) {
    for (const id of visibleIds) {
      const pos = PRECOMPUTED_NODES[id]
      if (pos) nodes.set(id, pos)
    }
    return { nodes, edges: PRECOMPUTED_EDGES }
  }

  // For smaller subsets, compute layout dynamically with decrossOpt
  const reducedEdges = transitiveReduction(visibleIds)

  // Build parent map for graphStratify
  const visibleSet = new Set(visibleIds)
  const parentMap = new Map<string, string[]>()
  for (const id of visibleIds) {
    parentMap.set(String(id), [])
  }
  for (const { from, to } of reducedEdges) {
    if (visibleSet.has(from) && visibleSet.has(to)) {
      parentMap.get(String(to))!.push(String(from))
    }
  }

  const stratData = visibleIds.map(id => ({
    id: String(id),
    parentIds: parentMap.get(String(id))!,
  }))

  const dag = graphStratify()(stratData)

  const layout = sugiyama()
    .layering(layeringSimplex())
    .decross(decrossOpt())
    .coord(coordSimplex())
    .nodeSize([NODE_W + 24, NODE_H + 60])
    .gap([24, 12])

  layout(dag)

  // Extract node positions
  for (const node of dag.nodes()) {
    const id = Number(node.data.id)
    nodes.set(id, {
      x: node.x,
      y: node.y,
      level: PROP_LEVELS.get(id) ?? 0,
    })
  }

  // Extract edge routing points (d3-dag uses [x, y] tuples)
  const layoutEdges: LayoutEdge[] = []
  for (const link of dag.links()) {
    const from = Number(link.source.data.id)
    const to = Number(link.target.data.id)
    layoutEdges.push({
      from,
      to,
      points: link.points.map(([x, y]: [number, number]) => ({ x, y })),
    })
  }

  return { nodes, edges: layoutEdges }
}

/**
 * Get the max topological level across all 48 propositions.
 */
export function getMaxLevel(): number {
  return Math.max(...PROP_LEVELS.values())
}

/**
 * Get all edges (prerequisite → dependent) for the visible nodes.
 * Uses transitive reduction to eliminate redundant cross-level edges.
 */
export function getEdges(visibleIds: number[]): Array<{ from: number; to: number }> {
  return transitiveReduction(visibleIds)
}

// Re-export helpers consumers need
export { getProposition, getPrerequisites, getDependents }
