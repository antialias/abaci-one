/**
 * Flowchart Path Analysis
 *
 * Enumerates all possible paths through a flowchart and computes structural metrics.
 * Used by the example generator to ensure coverage of all decision branches.
 *
 * @module flowcharts/path-analysis
 */

import type { ExecutableFlowchart } from './schema'

// =============================================================================
// Types
// =============================================================================

/**
 * A constraint that must hold for a path to be taken
 */
export interface PathConstraint {
  nodeId: string
  /** The decision expression (correctAnswer) */
  expression: string
  /** What the expression must evaluate to for this path */
  requiredOutcome: boolean
  /** The option that was selected */
  optionValue: string
}

/**
 * A complete path through the flowchart from entry to terminal
 */
export interface FlowchartPath {
  /** Sequence of node IDs */
  nodeIds: string[]
  /** Constraints that must be satisfied for this path */
  constraints: PathConstraint[]
  /** Number of decision nodes in this path */
  decisions: number
  /** Number of checkpoint nodes in this path */
  checkpoints: number
}

/**
 * Analysis of a flowchart's structure and paths
 */
export interface FlowchartAnalysis {
  /** All unique paths through the flowchart */
  paths: FlowchartPath[]
  /** Structural statistics */
  stats: {
    totalNodes: number
    decisionNodes: number
    checkpointNodes: number
    terminalNodes: number
    /** Total unique paths from entry to any terminal */
    totalPaths: number
    /** Minimum path length (in nodes) */
    minPathLength: number
    /** Maximum path length (in nodes) */
    maxPathLength: number
    /** Minimum number of decisions on any path */
    minDecisions: number
    /** Maximum number of decisions on any path */
    maxDecisions: number
    /** Minimum number of checkpoints on any path */
    minCheckpoints: number
    /** Maximum number of checkpoints on any path */
    maxCheckpoints: number
    /** Cyclomatic complexity: E - N + 2P (edges - nodes + 2*connected components) */
    cyclomaticComplexity: number
  }
  /** Recommended Monte Carlo iterations for good coverage */
  recommendedIterations: number
}

// =============================================================================
// Path Enumeration
// =============================================================================

/**
 * Enumerate all paths through a flowchart using DFS.
 * Returns all unique paths from entry node to terminal nodes.
 * Handles cycles by tracking visited nodes within each path.
 */
export function enumerateAllPaths(flowchart: ExecutableFlowchart): FlowchartPath[] {
  const paths: FlowchartPath[] = []
  const entryNode = flowchart.definition.entryNode

  interface DFSFrame {
    nodeId: string
    pathSoFar: string[]
    visitedInPath: Set<string> // Track visited nodes within THIS path to detect cycles
    constraints: PathConstraint[]
    decisions: number
    checkpoints: number
  }

  // DFS with explicit stack to avoid recursion limits
  const stack: DFSFrame[] = [
    {
      nodeId: entryNode,
      pathSoFar: [],
      visitedInPath: new Set(),
      constraints: [],
      decisions: 0,
      checkpoints: 0,
    },
  ]

  const MAX_PATHS = 50 // Safety limit
  const MAX_ITERATIONS = 10000 // Prevent infinite loops
  let iterations = 0

  while (stack.length > 0 && paths.length < MAX_PATHS && iterations < MAX_ITERATIONS) {
    iterations++
    const frame = stack.pop()!
    const { nodeId, pathSoFar, visitedInPath, constraints, decisions, checkpoints } = frame

    // Skip if we've already visited this node in the current path (cycle detection)
    if (visitedInPath.has(nodeId)) {
      continue
    }

    const currentPath = [...pathSoFar, nodeId]
    const currentVisited = new Set(visitedInPath)
    currentVisited.add(nodeId)

    const node = flowchart.nodes[nodeId]
    if (!node) continue

    const def = node.definition

    switch (def.type) {
      case 'terminal':
        // Found a complete path
        paths.push({
          nodeIds: currentPath,
          constraints: [...constraints],
          decisions,
          checkpoints,
        })
        break

      case 'decision': {
        // If this decision has a skipIf/skipTo, enumerate both:
        // 1. The skip path (when skipIf is true)
        // 2. The regular option paths (when skipIf is false or not present)
        if (def.skipIf && def.skipTo) {
          // Add the skip path - this doesn't count as a decision since it's auto-skipped
          const skipConstraint: PathConstraint = {
            nodeId,
            expression: def.skipIf,
            requiredOutcome: true, // skipIf must be true for this path
            optionValue: '__skip__',
          }
          stack.push({
            nodeId: def.skipTo,
            pathSoFar: currentPath,
            visitedInPath: currentVisited,
            constraints: [...constraints, skipConstraint],
            decisions, // Don't increment - decision is skipped
            checkpoints,
          })

          // Also add paths through options (when skipIf is false)
          // These need a constraint that skipIf is false
          for (let optIdx = 0; optIdx < def.options.length; optIdx++) {
            const option = def.options[optIdx]
            const isFirstOption = optIdx === 0
            const optionConstraints: PathConstraint[] = [
              // skipIf must be false to reach this option
              {
                nodeId,
                expression: def.skipIf,
                requiredOutcome: false,
                optionValue: '__not_skipped__',
              },
            ]
            if (def.correctAnswer) {
              optionConstraints.push({
                nodeId,
                expression: def.correctAnswer,
                requiredOutcome: isFirstOption,
                optionValue: option.value,
              })
            }

            stack.push({
              nodeId: option.next,
              pathSoFar: currentPath,
              visitedInPath: currentVisited,
              constraints: [...constraints, ...optionConstraints],
              decisions: decisions + 1,
              checkpoints,
            })
          }
        } else if (!def.excludeFromExampleStructure) {
          // No skipIf - branch into all options normally (unless excluded)
          for (let optIdx = 0; optIdx < def.options.length; optIdx++) {
            const option = def.options[optIdx]
            // Convention: first option (index 0) corresponds to correctAnswer being TRUE
            // This is more reliable than checking for "yes" in the option value
            const isFirstOption = optIdx === 0
            const constraint: PathConstraint | undefined = def.correctAnswer
              ? {
                  nodeId,
                  expression: def.correctAnswer,
                  requiredOutcome: isFirstOption,
                  optionValue: option.value,
                }
              : undefined

            stack.push({
              nodeId: option.next,
              pathSoFar: currentPath,
              visitedInPath: currentVisited,
              constraints: constraint ? [...constraints, constraint] : constraints,
              decisions: decisions + 1,
              checkpoints,
            })
          }
        } else {
          // Decision is excluded from example structure - just take first option
          const option = def.options[0]
          if (option) {
            stack.push({
              nodeId: option.next,
              pathSoFar: currentPath,
              visitedInPath: currentVisited,
              constraints,
              decisions,
              checkpoints,
            })
          }
        }
        break
      }

      case 'checkpoint': {
        // Checkpoints with skipIf can create branching paths by default,
        // unless excludeSkipFromPaths is true (for optional steps that
        // don't represent different problem types).
        if (def.skipIf && def.skipTo && !def.excludeSkipFromPaths) {
          // Create two paths: skip path and non-skip path
          // Path 1: Skip this checkpoint
          if (!currentVisited.has(def.skipTo)) {
            stack.push({
              nodeId: def.skipTo,
              pathSoFar: currentPath,
              visitedInPath: currentVisited,
              constraints,
              decisions,
              checkpoints,
            })
          }
          // Path 2: Don't skip - continue to next node
          const nextNode = getNextNodeForAnalysis(flowchart, nodeId, def)
          if (nextNode && !currentVisited.has(nextNode)) {
            stack.push({
              nodeId: nextNode,
              pathSoFar: currentPath,
              visitedInPath: currentVisited,
              constraints,
              decisions,
              checkpoints: checkpoints + 1,
            })
          }
        } else {
          // No skipIf, or excludeSkipFromPaths is true - just continue
          const nextNode = getNextNodeForAnalysis(flowchart, nodeId, def)
          if (nextNode) {
            stack.push({
              nodeId: nextNode,
              pathSoFar: currentPath,
              visitedInPath: currentVisited,
              constraints,
              decisions,
              checkpoints: checkpoints + 1,
            })
          }
        }
        break
      }

      case 'instruction':
      case 'milestone':
      case 'embellishment': {
        const nextNode = getNextNodeForAnalysis(flowchart, nodeId, def)
        if (nextNode) {
          stack.push({
            nodeId: nextNode,
            pathSoFar: currentPath,
            visitedInPath: currentVisited,
            constraints,
            decisions,
            checkpoints,
          })
        }
        break
      }
    }
  }

  return paths
}

/**
 * Helper to get the next node for path analysis
 */
function getNextNodeForAnalysis(
  flowchart: ExecutableFlowchart,
  nodeId: string,
  def: { next?: string; type: string }
): string | undefined {
  if ((def.type === 'milestone' || def.type === 'embellishment') && 'next' in def) {
    return def.next as string
  }
  if (def.next) return def.next
  const edges = flowchart.definition.edges?.[nodeId]
  if (edges && edges.length > 0) return edges[0]
  const mermaidEdges = flowchart.mermaid.edges.filter((e) => e.from === nodeId)
  return mermaidEdges[0]?.to
}

// =============================================================================
// Flowchart Analysis
// =============================================================================

/**
 * Analyze a flowchart's structure and compute metrics
 */
export function analyzeFlowchart(flowchart: ExecutableFlowchart): FlowchartAnalysis {
  const paths = enumerateAllPaths(flowchart)

  // Count node types
  let decisionNodes = 0
  let checkpointNodes = 0
  let terminalNodes = 0
  const totalNodes = Object.keys(flowchart.nodes).length

  for (const node of Object.values(flowchart.nodes)) {
    switch (node.definition.type) {
      case 'decision':
        decisionNodes++
        break
      case 'checkpoint':
        checkpointNodes++
        break
      case 'terminal':
        terminalNodes++
        break
    }
  }

  // Compute edge count for cyclomatic complexity
  let edgeCount = 0
  for (const node of Object.values(flowchart.nodes)) {
    const def = node.definition
    if (def.type === 'decision') {
      edgeCount += def.options.length
    } else if (def.type !== 'terminal') {
      edgeCount += 1
    }
  }

  // Path statistics
  const pathLengths = paths.map((p) => p.nodeIds.length)
  const pathDecisions = paths.map((p) => p.decisions)
  const pathCheckpoints = paths.map((p) => p.checkpoints)

  const stats = {
    totalNodes,
    decisionNodes,
    checkpointNodes,
    terminalNodes,
    totalPaths: paths.length,
    minPathLength: paths.length > 0 ? Math.min(...pathLengths) : 0,
    maxPathLength: paths.length > 0 ? Math.max(...pathLengths) : 0,
    minDecisions: paths.length > 0 ? Math.min(...pathDecisions) : 0,
    maxDecisions: paths.length > 0 ? Math.max(...pathDecisions) : 0,
    minCheckpoints: paths.length > 0 ? Math.min(...pathCheckpoints) : 0,
    maxCheckpoints: paths.length > 0 ? Math.max(...pathCheckpoints) : 0,
    cyclomaticComplexity: edgeCount - totalNodes + 2,
  }

  // Calculate recommended iterations using coupon collector problem
  // Expected iterations to see all N unique items: N * (ln(N) + 0.5772)
  // But paths aren't equally likely, so we multiply by a safety factor
  const n = paths.length
  const couponCollectorExpected = n > 0 ? n * (Math.log(n) + 0.5772) : 10
  // Add extra iterations for path probability skew (some paths are rare)
  const skewFactor = 3 // Assume some paths are 3x less likely
  // Also factor in the number of decision nodes (more decisions = more branching = need more samples)
  const branchingFactor = 2 ** Math.min(decisionNodes, 5)
  const recommendedIterations = Math.max(
    50, // Minimum
    Math.ceil(couponCollectorExpected * skewFactor),
    branchingFactor * 10
  )

  return { paths, stats, recommendedIterations }
}
