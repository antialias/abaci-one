/**
 * Flowchart Loader
 *
 * Loads and merges .mmd and .flow.json files into an executable flowchart.
 */

import type {
  FlowchartDefinition,
  ExecutableFlowchart,
  ExecutableNode,
  FlowchartState,
  ProblemValue,
  MixedNumberValue,
  WorkingProblemHistoryEntry,
  InstructionNode,
  CheckpointNode,
  DecisionNode,
  Field,
} from './schema'
import { parseMermaidFile, parseNodeContent } from './parser'
import { evaluate, type EvalContext } from './evaluator'
import {
  parseConstraintExpression,
  negateConstraint,
  constraintToFieldFilter,
  type ParsedConstraint,
  type FieldFilter,
} from './constraint-parser'

// =============================================================================
// Flowchart Loading
// =============================================================================

/**
 * Load and merge a flowchart definition with its Mermaid content
 */
export async function loadFlowchart(
  definition: FlowchartDefinition,
  mermaidContent: string
): Promise<ExecutableFlowchart> {
  // Parse the Mermaid file
  const mermaid = parseMermaidFile(mermaidContent)

  // Build executable nodes by merging definition with parsed content
  const nodes: Record<string, ExecutableNode> = {}

  for (const [nodeId, nodeDef] of Object.entries(definition.nodes)) {
    const rawContent = mermaid.nodes[nodeId]
    if (!rawContent) {
      console.warn(`Node ${nodeId} defined in .flow.json but not found in .mmd file`)
    }

    nodes[nodeId] = {
      id: nodeId,
      definition: nodeDef,
      content: rawContent
        ? parseNodeContent(rawContent)
        : {
            title: nodeId,
            body: [],
            raw: nodeId,
          },
    }
  }

  // Also include nodes from Mermaid that aren't in the definition
  // (they'll be treated as instruction nodes by default)
  for (const [nodeId, rawContent] of Object.entries(mermaid.nodes)) {
    if (!nodes[nodeId]) {
      nodes[nodeId] = {
        id: nodeId,
        definition: { type: 'instruction', advance: 'tap' },
        content: parseNodeContent(rawContent),
      }
    }
  }

  return {
    definition,
    mermaid,
    nodes,
  }
}

// =============================================================================
// State Initialization
// =============================================================================

/**
 * Initialize flowchart state from problem input
 */
export function initializeState(
  flowchart: ExecutableFlowchart,
  problemInput: Record<string, ProblemValue>
): FlowchartState {
  // Create evaluation context with problem values
  const context: EvalContext = {
    problem: problemInput,
    computed: {},
    userState: {},
  }

  // Evaluate all variable init expressions
  const computed: Record<string, ProblemValue> = {}
  for (const [varName, varDef] of Object.entries(flowchart.definition.variables)) {
    try {
      computed[varName] = evaluate(varDef.init, context)
      // Update context so subsequent variables can reference earlier ones
      context.computed[varName] = computed[varName]
    } catch (error) {
      console.error(`Error evaluating init for variable ${varName}:`, error)
      computed[varName] = null as unknown as ProblemValue
    }
  }

  // Initialize working problem if configured
  let workingProblem: string | undefined
  const workingProblemHistory: WorkingProblemHistoryEntry[] = []

  if (flowchart.definition.workingProblem) {
    const wpContext: EvalContext = {
      problem: problemInput,
      computed,
      userState: {},
    }
    try {
      workingProblem = String(evaluate(flowchart.definition.workingProblem.initial, wpContext))
      // Add initial state to history
      workingProblemHistory.push({
        value: workingProblem,
        label: 'Start',
        nodeId: 'initial',
      })
    } catch (error) {
      console.error('Error evaluating initial working problem:', error)
    }
  }

  return {
    problem: problemInput,
    computed,
    userState: {},
    currentNode: flowchart.definition.entryNode,
    history: [],
    startTime: Date.now(),
    mistakes: 0,
    workingProblem,
    workingProblemHistory,
  }
}

/**
 * Create evaluation context from current state
 */
export function createContextFromState(state: FlowchartState): EvalContext {
  return {
    problem: state.problem,
    computed: state.computed,
    userState: state.userState,
  }
}

// =============================================================================
// Navigation
// =============================================================================

/**
 * Get the next node ID based on current state and user action
 */
export function getNextNode(
  flowchart: ExecutableFlowchart,
  state: FlowchartState,
  userChoice?: string
): string | null {
  const currentNode = flowchart.nodes[state.currentNode]
  if (!currentNode) return null

  const def = currentNode.definition

  // Handle based on node type
  switch (def.type) {
    case 'instruction': {
      // Check for explicit next in definition
      if (def.next) return def.next
      // Fall back to edges from Mermaid
      const edges = flowchart.definition.edges?.[state.currentNode]
      if (edges && edges.length > 0) return edges[0]
      // Or from parsed Mermaid
      const mermaidEdges = flowchart.mermaid.edges.filter((e) => e.from === state.currentNode)
      if (mermaidEdges.length > 0) return mermaidEdges[0].to
      return null
    }

    case 'decision': {
      // Check for skip condition
      if (def.skipIf && def.skipTo) {
        const context = createContextFromState(state)
        try {
          if (evaluate(def.skipIf, context)) {
            return def.skipTo
          }
        } catch (error) {
          console.error('Error evaluating skipIf:', error)
        }
      }

      // User must have made a choice
      if (!userChoice) return null
      const option = def.options.find((o) => o.value === userChoice)
      return option?.next ?? null
    }

    case 'checkpoint': {
      // Check for explicit next
      if (def.next) return def.next
      // Fall back to edges
      const edges = flowchart.definition.edges?.[state.currentNode]
      if (edges && edges.length > 0) return edges[0]
      const mermaidEdges = flowchart.mermaid.edges.filter((e) => e.from === state.currentNode)
      if (mermaidEdges.length > 0) return mermaidEdges[0].to
      return null
    }

    case 'milestone': {
      return def.next
    }

    case 'terminal': {
      return null // End of flowchart
    }

    default:
      return null
  }
}

/**
 * Check if a decision answer is correct
 */
export function isDecisionCorrect(
  flowchart: ExecutableFlowchart,
  state: FlowchartState,
  nodeId: string,
  userChoice: string
): boolean | null {
  const node = flowchart.nodes[nodeId]
  if (!node || node.definition.type !== 'decision') return null

  const def = node.definition
  if (!def.correctAnswer) return null // No validation defined

  const context = createContextFromState(state)
  try {
    const correct = evaluate(def.correctAnswer, context)
    // correctAnswer is an expression that evaluates to true/false
    // If true, the "yes" option (or first option) is correct
    // If false, the "no" option (or second option) is correct
    if (typeof correct === 'boolean') {
      // Find which option corresponds to the correct answer
      const yesOption = def.options.find(
        (o) => o.value === 'yes' || o.value.toLowerCase().includes('yes')
      )
      const noOption = def.options.find(
        (o) => o.value === 'no' || o.value.toLowerCase().includes('no')
      )

      // If we found yes/no options, use them
      if (yesOption || noOption) {
        if (correct) {
          return userChoice === yesOption?.value
        } else {
          return userChoice === noOption?.value
        }
      }

      // Fallback: true = first option, false = second option
      const correctOption = correct ? def.options[0] : def.options[1]
      return userChoice === correctOption?.value
    }
    // If correctAnswer evaluates to a string, compare directly
    return String(correct) === userChoice
  } catch (error) {
    console.error('Error evaluating correctAnswer:', error)
    return null
  }
}

/**
 * Validate a checkpoint answer
 */
export function validateCheckpoint(
  flowchart: ExecutableFlowchart,
  state: FlowchartState,
  nodeId: string,
  userInput: number | string | [number, number]
): { correct: boolean; expected: ProblemValue | [number, number] } | null {
  const node = flowchart.nodes[nodeId]
  if (!node || node.definition.type !== 'checkpoint') return null

  const def = node.definition

  try {
    // Handle two-numbers input type with array of expected expressions
    if (def.inputType === 'two-numbers' && Array.isArray(def.expected)) {
      // For two-numbers, we don't use `input` in expressions - we validate against problem values
      const context: EvalContext = createContextFromState(state)
      const expected1 = evaluate(def.expected[0], context) as number
      const expected2 = evaluate(def.expected[1], context) as number
      const expectedArray: [number, number] = [expected1, expected2]

      if (!Array.isArray(userInput)) {
        return { correct: false, expected: expectedArray }
      }

      const tolerance = def.tolerance ?? 0
      const orderMatters = def.orderMatters !== false // default true

      // Check if input matches expected (in order)
      const matchesInOrder =
        Math.abs(expected1 - userInput[0]) <= tolerance &&
        Math.abs(expected2 - userInput[1]) <= tolerance

      // If order doesn't matter, also check reversed
      const matchesReversed =
        !orderMatters &&
        Math.abs(expected1 - userInput[1]) <= tolerance &&
        Math.abs(expected2 - userInput[0]) <= tolerance

      const correct = matchesInOrder || matchesReversed

      return { correct, expected: expectedArray }
    }

    // Original single-value validation
    const context: EvalContext = {
      ...createContextFromState(state),
      input: userInput as ProblemValue,
    }
    const expected = evaluate(def.expected as string, context)
    const tolerance = def.tolerance ?? 0

    let correct: boolean
    if (typeof expected === 'number' && typeof userInput === 'number') {
      correct = Math.abs(expected - userInput) <= tolerance
    } else {
      correct = expected === userInput
    }

    return { correct, expected }
  } catch (error) {
    console.error('Error evaluating checkpoint expected value:', error)
    return null
  }
}

/**
 * Apply state update after passing a checkpoint
 */
export function applyStateUpdate(
  state: FlowchartState,
  nodeId: string,
  flowchart: ExecutableFlowchart,
  userInput: ProblemValue
): FlowchartState {
  const node = flowchart.nodes[nodeId]
  if (!node || node.definition.type !== 'checkpoint') return state

  const def = node.definition
  if (!def.stateUpdate) return state

  const newUserState = { ...state.userState }
  const context: EvalContext = {
    ...createContextFromState(state),
    input: userInput,
  }

  for (const [varName, expr] of Object.entries(def.stateUpdate)) {
    try {
      newUserState[varName] = evaluate(expr, context)
    } catch (error) {
      console.error(`Error evaluating stateUpdate for ${varName}:`, error)
    }
  }

  return {
    ...state,
    userState: newUserState,
  }
}

/**
 * Apply working problem transform after successfully completing a node.
 * Returns updated state with new working problem value and history entry.
 */
export function applyWorkingProblemUpdate(
  state: FlowchartState,
  nodeId: string,
  flowchart: ExecutableFlowchart,
  userInput?: ProblemValue
): FlowchartState {
  const node = flowchart.nodes[nodeId]
  if (!node) return state

  // Check if this node has a working problem update
  const def = node.definition
  let workingProblemUpdate: { result: string; label: string } | undefined

  if (def.type === 'checkpoint') {
    workingProblemUpdate = (def as CheckpointNode).workingProblemUpdate
  } else if (def.type === 'instruction') {
    workingProblemUpdate = (def as InstructionNode).workingProblemUpdate
  }

  if (!workingProblemUpdate) return state

  const context: EvalContext = {
    ...createContextFromState(state),
    input: userInput,
  }

  try {
    const newWorkingProblem = String(evaluate(workingProblemUpdate.result, context))
    return {
      ...state,
      workingProblem: newWorkingProblem,
      workingProblemHistory: [
        ...state.workingProblemHistory,
        {
          value: newWorkingProblem,
          label: workingProblemUpdate.label,
          nodeId,
        },
      ],
    }
  } catch (error) {
    console.error('Error applying working problem update:', error)
    return state
  }
}

// =============================================================================
// Progress Tracking
// =============================================================================

/**
 * Advance to the next node and record history
 */
export function advanceState(
  state: FlowchartState,
  nextNode: string,
  action: 'advance' | 'decision' | 'checkpoint' | 'skip',
  userInput?: ProblemValue,
  correct?: boolean
): FlowchartState {
  return {
    ...state,
    currentNode: nextNode,
    history: [
      ...state.history,
      {
        node: state.currentNode,
        action,
        timestamp: Date.now(),
        userInput,
        correct,
      },
    ],
    mistakes: correct === false ? state.mistakes + 1 : state.mistakes,
  }
}

/**
 * Check if the current node is a terminal node
 */
export function isTerminal(flowchart: ExecutableFlowchart, nodeId: string): boolean {
  const node = flowchart.nodes[nodeId]
  return node?.definition.type === 'terminal'
}

// =============================================================================
// Path Complexity Analysis
// =============================================================================

export interface PathComplexity {
  /** Total number of nodes in the path */
  pathLength: number
  /** Number of decision points in the path */
  decisions: number
  /** Number of checkpoints (user input required) */
  checkpoints: number
  /** List of node IDs in the path */
  path: string[]
}

/**
 * Simulate walking through a flowchart with given problem values to calculate path complexity.
 * Returns the path length, number of decisions, and checkpoints.
 */
export function calculatePathComplexity(
  flowchart: ExecutableFlowchart,
  problemInput: Record<string, ProblemValue>
): PathComplexity {
  // Initialize a temporary state to simulate the walk
  const state = initializeState(flowchart, problemInput)
  const context = createContextFromState(state)

  const path: string[] = []
  let decisions = 0
  let checkpoints = 0
  let currentNodeId = flowchart.definition.entryNode
  const visited = new Set<string>()

  // Walk the flowchart until we hit a terminal or loop
  while (currentNodeId && !visited.has(currentNodeId)) {
    visited.add(currentNodeId)
    path.push(currentNodeId)

    const node = flowchart.nodes[currentNodeId]
    if (!node) break

    const def = node.definition

    switch (def.type) {
      case 'terminal':
        // End of path
        return { pathLength: path.length, decisions, checkpoints, path }

      case 'decision': {
        decisions++
        // Determine which path would be taken based on correctAnswer
        if (def.correctAnswer) {
          try {
            const correct = evaluate(def.correctAnswer, context)
            // Find the correct option
            if (typeof correct === 'boolean') {
              const yesOption = def.options.find(
                (o) => o.value === 'yes' || o.value.toLowerCase().includes('yes')
              )
              const noOption = def.options.find(
                (o) => o.value === 'no' || o.value.toLowerCase().includes('no')
              )

              if (correct && yesOption) {
                currentNodeId = yesOption.next
              } else if (!correct && noOption) {
                currentNodeId = noOption.next
              } else {
                // Fallback to first/second option
                currentNodeId = correct ? def.options[0]?.next : def.options[1]?.next
              }
            } else {
              // correctAnswer is a specific value
              const option = def.options.find((o) => o.value === String(correct))
              currentNodeId = option?.next ?? def.options[0]?.next
            }
          } catch {
            // If evaluation fails, take first option
            currentNodeId = def.options[0]?.next
          }
        } else {
          // No correctAnswer, take first option
          currentNodeId = def.options[0]?.next
        }
        break
      }

      // biome-ignore lint/suspicious/noFallthroughSwitchClause: Intentional fallthrough to share instruction logic
      case 'checkpoint': {
        checkpoints++
      }
      case 'instruction': {
        if (def.next) {
          currentNodeId = def.next
        } else {
          const edges = flowchart.definition.edges?.[currentNodeId]
          if (edges && edges.length > 0) {
            currentNodeId = edges[0]
          } else {
            const mermaidEdges = flowchart.mermaid.edges.filter((e) => e.from === currentNodeId)
            currentNodeId = mermaidEdges[0]?.to
          }
        }
        break
      }

      case 'milestone':
        currentNodeId = def.next
        break

      default:
        currentNodeId = undefined as unknown as string
    }
  }

  return { pathLength: path.length, decisions, checkpoints, path }
}

// =============================================================================
// Flowchart Path Analysis
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
        // Branch into all options
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
        break
      }

      case 'checkpoint': {
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
        break
      }

      case 'instruction':
      case 'milestone': {
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
  if (def.type === 'milestone' && 'next' in def) {
    return def.next as string
  }
  if (def.next) return def.next
  const edges = flowchart.definition.edges?.[nodeId]
  if (edges && edges.length > 0) return edges[0]
  const mermaidEdges = flowchart.mermaid.edges.filter((e) => e.from === nodeId)
  return mermaidEdges[0]?.to
}

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
    minPathLength: Math.min(...pathLengths),
    maxPathLength: Math.max(...pathLengths),
    minDecisions: Math.min(...pathDecisions),
    maxDecisions: Math.max(...pathDecisions),
    minCheckpoints: Math.min(...pathCheckpoints),
    maxCheckpoints: Math.max(...pathCheckpoints),
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

// =============================================================================
// Constraint-Aware Example Generation
// =============================================================================

/**
 * Teacher-configurable constraints for problem generation.
 * These allow customizing the difficulty and characteristics of generated problems.
 */
export interface GenerationConstraints {
  /** Ensure all generated problems have positive answers (no negative results) */
  positiveAnswersOnly?: boolean
  /** Maximum value for whole numbers in fractions (default: 5) */
  maxWholeNumber?: number
  /** Maximum denominator to use (default: 12) */
  maxDenominator?: number
  /** For linear equations, maximum value for x (default: 12) */
  maxSolution?: number
}

/** Default constraints for kid-friendly problems */
export const DEFAULT_CONSTRAINTS: GenerationConstraints = {
  positiveAnswersOnly: true,
  maxWholeNumber: 5,
  maxDenominator: 12,
  maxSolution: 12,
}

export interface GeneratedExample {
  values: Record<string, ProblemValue>
  complexity: PathComplexity
  /** Hash of the path for grouping */
  pathSignature: string
  /** Human-readable description of the path taken (e.g., "Same denom + Add") */
  pathDescriptor: string
}

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
  const decisionAppearances = new Map<string, {
    nodeId: string
    optionLabels: Map<string, string>  // optionValue -> pathLabel
    optionGridLabels: Map<string, string>  // optionValue -> gridLabel (kid-friendly)
    pathCount: number  // how many paths include this decision
    pathsWithOption: Map<string, Set<number>>  // optionValue -> set of path indices
  }>()

  // Analyze each path
  for (let pathIdx = 0; pathIdx < paths.length; pathIdx++) {
    const path = paths[pathIdx]

    for (let i = 0; i < path.nodeIds.length - 1; i++) {
      const nodeId = path.nodeIds[i]
      const nextNodeId = path.nodeIds[i + 1]
      const node = flowchart.nodes[nodeId]

      if (node?.definition.type === 'decision') {
        const decision = node.definition as DecisionNode
        const option = decision.options.find(o => o.next === nextNodeId)

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
    return buildOneDimensionalGrid(flowchart, paths, dim1NodeId, dim1Info, dependentDecisions, decisionAppearances)
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

        const overlap = [...pathsForOption].filter(idx => depPathIndices.has(idx))
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
  const rows = rowTuples.map(t => t[0])
  const rowKeys = rowTuples.map(t => t[1])
  const cols = colTuples.map(t => t[0])
  const colKeys = colTuples.map(t => t[1])

  // Step 6: Build cell map from actual path descriptors (use keys for matching)
  const cellMap = new Map<string, [number, number]>()

  for (const path of paths) {
    // Get the path descriptor (uses pathLabel, same as keys)
    const descriptor = generatePathDescriptorFromPath(flowchart, path)

    // Find which row and column this descriptor belongs to (match against keys)
    const rowIdx = rowKeys.findIndex(k => descriptor.startsWith(k) || descriptor.includes(k))
    const colIdx = colKeys.findIndex(k => descriptor.endsWith(k) || descriptor.includes(k))

    if (rowIdx !== -1 && colIdx !== -1) {
      cellMap.set(descriptor, [rowIdx, colIdx])
    }
  }

  // Validate: every unique descriptor should have a cell
  const uniqueDescriptors = new Set(paths.map(p => generatePathDescriptorFromPath(flowchart, p)))
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

      const overlap = [...pathsForOption].filter(idx => depPathIndices.has(idx))
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
      if (descriptor === keyValue || descriptor.startsWith(keyValue + ' ') || descriptor.endsWith(' ' + keyValue)) {
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
  const rows = groupTuples.map(t => t[0])
  const rowKeys = groupTuples.map(t => t[1])

  // Build cell map - for 1D, column is always 0 (use keys for matching)
  const cellMap = new Map<string, [number, number]>()
  for (const path of paths) {
    const descriptor = generatePathDescriptorFromPath(flowchart, path)
    const groupIdx = rowKeys.findIndex(k => descriptor === k || descriptor.startsWith(k + ' ') || descriptor.endsWith(' ' + k) || descriptor.includes(k))
    if (groupIdx !== -1) {
      cellMap.set(descriptor, [groupIdx, 0])
    }
  }

  // For 1D, cols is empty array to indicate single dimension
  return { rows, cols: [], rowKeys, colKeys: [], cellMap }
}

/**
 * Generate path descriptor from a path object (without running the problem)
 */
function generatePathDescriptorFromPath(
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
      const option = decision.options.find(o => o.next === nextNodeId)
      if (option?.pathLabel) {
        labels.push(option.pathLabel)
      }
    }
  }

  return labels.join(' ')
}

/**
 * Fallback: infer grid by analyzing the descriptor strings directly
 */
function inferGridFromDescriptors(
  flowchart: ExecutableFlowchart,
  paths: FlowchartPath[]
): GridDimensions | null {
  // Get all unique descriptors
  const descriptors = [...new Set(paths.map(p => generatePathDescriptorFromPath(flowchart, p)))]

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
      const covered = descriptors.filter(d => d.startsWith(prefix + ' ') || d === prefix)
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
            cols: [...allSuffixes].filter(s => s !== ''),
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
    const rowIdx = bestSplit.rows.findIndex(r => desc.startsWith(r))
    const colIdx = bestSplit.cols.findIndex(c => desc.endsWith(c))
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
    cellMap
  }
}

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
        const option = decision.options.find(o => o.next === nextNodeId)
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
  const decisionVariation = new Map<string, {
    uniqueValues: Set<string>
    pathLabels: Map<string, string>  // value -> pathLabel
    gridLabels: Map<string, string | undefined>  // value -> gridLabel
  }>()

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
      const aCount = exampleDecisions.filter(d => d.has(a[0])).length
      const bCount = exampleDecisions.filter(d => d.has(b[0])).length
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
      const rowIdx = rowKeys.findIndex(k =>
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
    const rowIdx = rowKeys.findIndex(k =>
      example.pathDescriptor === k ||
      example.pathDescriptor.startsWith(k + ' ') ||
      example.pathDescriptor.includes(' ' + k + ' ') ||
      example.pathDescriptor.endsWith(' ' + k)
    )

    // Find col - which colKey appears in the descriptor?
    const colIdx = colKeys.findIndex(k =>
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

  const maxColsPerRow = Math.max(...[...colsPerRow.values()].map(s => s.size), 0)
  const maxRowsPerCol = Math.max(...[...rowsPerCol.values()].map(s => s.size), 0)

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

    return { rows: combinedRows, cols: [], rowKeys: combinedRowKeys, colKeys: [], cellMap: combinedCellMap }
  }

  return { rows, cols, rowKeys, colKeys, cellMap }
}

/**
 * Fallback: infer grid from pathDescriptor strings when no varying decisions found
 */
function inferGridFromDescriptorsFromExamples(
  examples: GeneratedExample[]
): GridDimensions | null {
  const descriptors = [...new Set(examples.map(ex => ex.pathDescriptor))]

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
      cellMap
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

// =============================================================================
// Constraint-Guided Generation System
// =============================================================================

/**
 * Extract path constraints from the decisions in a path.
 * For each decision node, determines what the correctAnswer expression
 * must evaluate to for this path to be taken.
 */
function extractPathConstraints(
  flowchart: ExecutableFlowchart,
  path: FlowchartPath
): ParsedConstraint[] {
  const constraints: ParsedConstraint[] = []

  for (const constraint of path.constraints) {
    const parsed = parseConstraintExpression(constraint.expression)

    for (const c of parsed.constraints) {
      // If the path requires the expression to be false, negate the constraint
      if (!constraint.requiredOutcome) {
        constraints.push(negateConstraint(c))
      } else {
        constraints.push(c)
      }
    }
  }

  return constraints
}

/**
 * Get field filters from constraints that can directly filter field values.
 */
function getFieldFilters(constraints: ParsedConstraint[]): Map<string, FieldFilter[]> {
  const filtersByField = new Map<string, FieldFilter[]>()

  for (const constraint of constraints) {
    const filter = constraintToFieldFilter(constraint)
    if (filter) {
      const existing = filtersByField.get(filter.field) || []
      existing.push(filter)
      filtersByField.set(filter.field, existing)
    }
  }

  return filtersByField
}

/**
 * Get preferred values for a field from the generation config.
 */
function getPreferredValues(
  fieldName: string,
  config: FlowchartDefinition['generation']
): (number | string)[] | null {
  if (!config?.preferred) return null

  const pref = config.preferred[fieldName]
  if (!pref) return null

  if (Array.isArray(pref)) {
    return pref as (number | string)[]
  }

  // It's a range config
  const { range, step = 1 } = pref as { range: [number, number]; step?: number }
  const values: number[] = []
  for (let v = range[0]; v <= range[1]; v += step) {
    values.push(v)
  }
  return values
}

/**
 * Get all possible values for a field based on its definition.
 */
function getFieldPossibleValues(field: Field): (number | string)[] {
  switch (field.type) {
    case 'integer': {
      const min = field.min ?? 0
      const max = field.max ?? 99
      const values: number[] = []
      for (let v = min; v <= max; v++) {
        values.push(v)
      }
      return values
    }
    case 'choice':
      return field.options || []
    default:
      return []
  }
}

/**
 * Filter values based on field filters.
 */
function applyFieldFilters(
  values: (number | string)[],
  filters: FieldFilter[]
): (number | string)[] {
  let result = values
  for (const filter of filters) {
    result = result.filter(filter.filter)
  }
  return result
}

/**
 * Create a seeded random number generator using mulberry32 algorithm.
 * Returns a function that produces deterministic random numbers [0, 1).
 */
export function createSeededRandom(seed: number): () => number {
  let state = seed
  return () => {
    state |= 0
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Shuffle an array in place (Fisher-Yates).
 * @param array - Array to shuffle
 * @param random - Optional random function (defaults to Math.random)
 */
function shuffle<T>(array: T[], random: () => number = Math.random): T[] {
  const result = [...array]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

/**
 * Generate values for a single field, respecting constraints and preferences.
 */
function generateFieldValue(
  field: Field,
  filters: FieldFilter[],
  preferred: (number | string)[] | null
): number | string | null {
  // Get all possible values
  let possibleValues = getFieldPossibleValues(field)

  // Apply filters from constraints
  if (filters.length > 0) {
    possibleValues = applyFieldFilters(possibleValues, filters)
  }

  if (possibleValues.length === 0) {
    return null // No valid values
  }

  // If we have preferred values, try those first (shuffled)
  if (preferred && preferred.length > 0) {
    const validPreferred = preferred.filter((v) => possibleValues.includes(v))
    if (validPreferred.length > 0) {
      const shuffled = shuffle(validPreferred)
      return shuffled[0]
    }
  }

  // Fall back to random from possible values
  const shuffled = shuffle(possibleValues)
  return shuffled[0]
}

/**
 * Compute derived field values using expressions from the generation config.
 */
function computeDerivedFields(
  values: Record<string, ProblemValue>,
  derived: Record<string, string>,
  flowchart: ExecutableFlowchart
): Record<string, ProblemValue> {
  const result = { ...values }

  // Build context for evaluation
  const context: EvalContext = {
    problem: result,
    computed: {},
    userState: {},
  }

  // Compute each derived field
  for (const [fieldName, expression] of Object.entries(derived)) {
    try {
      result[fieldName] = evaluate(expression, context)
      // Update context for subsequent derivations
      context.problem[fieldName] = result[fieldName]
    } catch (error) {
      console.error(`Error computing derived field ${fieldName}:`, error)
    }
  }

  return result
}

/**
 * Validate that all constraints in the flowchart's constraints config are satisfied.
 */
function validateFlowchartConstraints(
  values: Record<string, ProblemValue>,
  flowchart: ExecutableFlowchart
): boolean {
  const constraints = flowchart.definition.constraints
  if (!constraints) return true

  // Initialize variables to create full context
  const context: EvalContext = {
    problem: values,
    computed: {},
    userState: {},
  }

  // Evaluate variable init expressions
  for (const [varName, varDef] of Object.entries(flowchart.definition.variables)) {
    try {
      context.computed[varName] = evaluate(varDef.init, context)
    } catch {
      // Continue - constraint check will fail if needed
    }
  }

  // Check each constraint
  for (const [name, expression] of Object.entries(constraints)) {
    try {
      const result = evaluate(expression, context)
      if (!result) {
        return false
      }
    } catch (error) {
      console.error(`Error evaluating constraint ${name}:`, error)
      return false
    }
  }

  return true
}

/**
 * Generate a problem for a specific path using constraint-guided generation.
 *
 * Algorithm:
 * 1. Extract constraints from the path's decision nodes
 * 2. Convert constraints to field filters where possible
 * 3. Generate target field first (if configured)
 * 4. Generate other independent fields with filters and preferences
 * 5. Compute derived fields
 * 6. Validate all constraints
 */
function generateForPath(
  flowchart: ExecutableFlowchart,
  targetPath: FlowchartPath,
  teacherConstraints: TeacherConstraints
): Record<string, ProblemValue> | null {
  const schema = flowchart.definition.problemInput
  const genConfig = flowchart.definition.generation
  const fields = schema.fields

  // Extract constraints from this path
  const pathConstraints = extractPathConstraints(flowchart, targetPath)
  const fieldFilters = getFieldFilters(pathConstraints)

  // Determine which fields are derived (computed) vs generated
  const derivedFieldNames = new Set(Object.keys(genConfig?.derived || {}))

  // Determine field generation order
  // Target field first, then others, derived fields last
  const targetField = genConfig?.target
  const independentFields = fields.filter(
    (f) => !derivedFieldNames.has(f.name) && f.name !== targetField
  )

  // Generate values
  const values: Record<string, ProblemValue> = {}

  // Generate target field first (if configured)
  if (targetField) {
    const targetFieldDef = fields.find((f) => f.name === targetField)
    if (targetFieldDef) {
      // Target is a schema field - generate normally
      const filters = fieldFilters.get(targetField) || []
      const preferred = getPreferredValues(targetField, genConfig)
      const value = generateFieldValue(targetFieldDef, filters, preferred)
      if (value === null) return null
      values[targetField] = value
    } else {
      // Target is a computed variable (e.g., "answer") - generate from preferred values
      const preferred = getPreferredValues(targetField, genConfig)
      if (preferred && preferred.length > 0) {
        const shuffled = shuffle([...preferred])
        values[targetField] = shuffled[0] as ProblemValue
      }
    }
  }

  // Generate independent fields
  for (const field of independentFields) {
    const filters = fieldFilters.get(field.name) || []
    const preferred = getPreferredValues(field.name, genConfig)
    const value = generateFieldValue(field, filters, preferred)
    if (value === null) return null
    values[field.name] = value
  }

  // Compute derived fields
  if (genConfig?.derived) {
    const withDerived = computeDerivedFields(values, genConfig.derived, flowchart)
    Object.assign(values, withDerived)
  }

  // Validate schema validation expression
  if (schema.validation) {
    try {
      const context = { problem: values, computed: {}, userState: {} }
      if (!evaluate(schema.validation, context)) {
        return null
      }
    } catch {
      return null
    }
  }

  // Validate flowchart constraints
  if (!validateFlowchartConstraints(values, flowchart)) {
    return null
  }

  // Validate that generated values satisfy path constraints (e.g., needsBorrow)
  // This is crucial for constraints involving computed variables
  if (!satisfiesPathConstraints(flowchart, values, targetPath)) {
    return null
  }

  // Validate teacher constraints (legacy support)
  if (teacherConstraints.positiveAnswersOnly) {
    if (!validatePositiveAnswer(values, flowchart)) {
      return null
    }
  }

  return values
}

/**
 * Validate that the answer is positive using the flowchart's constraints
 * or falling back to schema-specific logic.
 */
function validatePositiveAnswer(
  values: Record<string, ProblemValue>,
  flowchart: ExecutableFlowchart
): boolean {
  // If the flowchart has a positiveAnswer constraint, it's already checked
  // by validateFlowchartConstraints. This is a fallback for older flowcharts.

  const constraints = flowchart.definition.constraints
  if (constraints && ('positiveAnswer' in constraints || 'positive' in constraints)) {
    return true // Already validated
  }

  // Fall back to legacy schema-specific check
  return hasPositiveAnswerLegacy(flowchart.definition.problemInput.schema, values)
}

/**
 * Generate path descriptor from pathLabel on decision options.
 * Falls back to schema-specific descriptors for older flowcharts.
 */
function generatePathDescriptorGeneric(
  flowchart: ExecutableFlowchart,
  path: string[],
  values: Record<string, ProblemValue>
): string {
  const labels: string[] = []

  // Collect pathLabel from each decision node in the path
  for (let i = 0; i < path.length - 1; i++) {
    const nodeId = path[i]
    const nextNodeId = path[i + 1]
    const node = flowchart.nodes[nodeId]

    if (node?.definition.type === 'decision') {
      const decision = node.definition as DecisionNode
      // Find which option leads to the next node
      const option = decision.options.find((o) => o.next === nextNodeId)
      if (option?.pathLabel) {
        labels.push(option.pathLabel)
      }
    }
  }

  if (labels.length > 0) {
    return labels.join(' ')
  }

  // Fall back to legacy schema-specific descriptors
  return generatePathDescriptorLegacy(flowchart, path, values)
}

/**
 * Teacher constraints (legacy interface, to be replaced by flowchart constraints)
 */
interface TeacherConstraints {
  positiveAnswersOnly?: boolean
}

// =============================================================================
// Legacy Schema-Specific Functions (to be removed)
// =============================================================================

/**
 * @deprecated Use flowchart.constraints instead
 * Check if a problem produces a positive answer based on schema type.
 */
function hasPositiveAnswerLegacy(
  schemaType: string,
  values: Record<string, ProblemValue>
): boolean {
  switch (schemaType) {
    case 'two-fractions-with-op': {
      const leftWhole = (values.leftWhole as number) || 0
      const leftNum = (values.leftNum as number) || 0
      const leftDenom = (values.leftDenom as number) || 1
      const rightWhole = (values.rightWhole as number) || 0
      const rightNum = (values.rightNum as number) || 0
      const rightDenom = (values.rightDenom as number) || 1
      const op = values.op as string

      // Convert to decimal for easy comparison
      const left = leftWhole + leftNum / leftDenom
      const right = rightWhole + rightNum / rightDenom

      if (op === '+') {
        return left + right > 0
      } else {
        return left - right >= 0
      }
    }

    case 'two-digit-subtraction': {
      const minuend = values.minuend as number
      const subtrahend = values.subtrahend as number
      return minuend > subtrahend
    }

    case 'linear-equation': {
      // For ax + b = c or ax - b = c, x = (c ∓ b) / a
      const coefficient = values.coefficient as number
      const operation = values.operation as string
      const constant = values.constant as number
      const equals = values.equals as number

      const x =
        operation === '+' ? (equals - constant) / coefficient : (equals + constant) / coefficient

      return x > 0
    }

    default:
      return true
  }
}

/**
 * @deprecated Use generatePathDescriptorGeneric with pathLabel instead
 * Generate a human-readable descriptor for a path based on the decision nodes visited.
 * This helps users understand what makes each example different.
 */
function generatePathDescriptorLegacy(
  flowchart: ExecutableFlowchart,
  path: string[],
  values: Record<string, ProblemValue>
): string {
  const parts: string[] = []
  const schema = flowchart.definition.problemInput.schema

  // Schema-specific descriptors
  if (schema === 'two-fractions-with-op') {
    // Check which LCD path was taken
    if (path.includes('READY1')) {
      parts.push('Same')
    } else if (path.includes('CONV1A') || path.includes('READY2')) {
      parts.push('Divides')
    } else if (path.includes('STEP3') || path.includes('READY3')) {
      parts.push('LCD')
    }

    // Check operation
    const op = values.op as string
    parts.push(op === '+' ? '+' : '−')

    // Check if borrowing occurred
    if (path.includes('BORROW')) {
      parts.push('borrow')
    }
  } else if (schema === 'two-digit-subtraction') {
    // Check regrouping
    if (path.includes('TENS') || path.includes('TAKEONE')) {
      parts.push('Regroup')
    } else {
      parts.push('No regroup')
    }
  } else if (schema === 'linear-equation') {
    const constant = values.constant as number
    const coef = values.coefficient as number
    const op = values.operation as string

    if (constant !== 0 && coef === 1) {
      // Addition/subtraction only: x + 5 = 12
      parts.push(op === '+' ? 'Undo +' : 'Undo −')
    } else if (constant === 0 && coef !== 1) {
      // Multiplication only: 4x = 20
      parts.push(`÷${coef}`)
    } else if (constant !== 0 && coef !== 1) {
      // Two-step (shouldn't happen with current generation)
      parts.push(op === '+' ? '−const' : '+const')
      parts.push(`÷${coef}`)
    } else {
      // Trivial: x = c
      parts.push('x = ?')
    }
  } else {
    // Generic: count key decision outcomes
    const decisionCount = path.filter((nodeId) => {
      const node = flowchart.nodes[nodeId]
      return node?.definition.type === 'decision'
    }).length

    if (decisionCount > 0) {
      parts.push(`${decisionCount} decisions`)
    }
  }

  return parts.join(' ') || 'Standard'
}

// =============================================================================
// Pedagogically Sensible Number Generation
// =============================================================================

/** Common denominators used in textbooks (easy to visualize and compute) */
const NICE_DENOMINATORS = [2, 3, 4, 5, 6, 8, 10, 12]

/** Denominator pairs that divide evenly (one is multiple of other) */
const DIVIDING_PAIRS: [number, number][] = [
  [2, 4],
  [2, 6],
  [2, 8],
  [2, 10],
  [2, 12],
  [3, 6],
  [3, 9],
  [3, 12],
  [4, 8],
  [4, 12],
  [5, 10],
  [6, 12],
]

/** Coprime denominator pairs (require finding LCD) */
const COPRIME_PAIRS: [number, number][] = [
  [2, 3],
  [2, 5],
  [2, 7],
  [2, 9],
  [3, 4],
  [3, 5],
  [3, 7],
  [3, 8],
  [3, 10],
  [4, 5],
  [4, 7],
  [4, 9],
  [5, 6],
  [5, 7],
  [5, 8],
  [5, 9],
  [6, 7],
  [7, 8],
  [7, 9],
  [7, 10],
  [8, 9],
  [9, 10],
]

/** Pick a random element from an array */
function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

/** Generate a random integer in range [min, max] */
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

/**
 * Generate a pedagogically sensible fraction problem based on target path.
 * Works backwards from the desired path to generate appropriate numbers.
 */
function generateFractionProblem(targetPath?: FlowchartPath): Record<string, ProblemValue> {
  // Determine which path characteristics we want
  const pathNodes = targetPath?.nodeIds || []

  const wantSameDenom = pathNodes.includes('READY1')
  const wantDivides = pathNodes.includes('CONV1A') || pathNodes.includes('READY2')
  const wantLCD = pathNodes.includes('STEP3') || pathNodes.includes('READY3')
  const wantBorrow = pathNodes.includes('BORROW')

  // Determine operation based on path (borrow only happens with subtraction)
  const op = wantBorrow ? '−' : Math.random() < 0.5 ? '+' : '−'

  let leftDenom: number
  let rightDenom: number

  if (wantSameDenom) {
    // Same denominator path
    leftDenom = pickRandom(NICE_DENOMINATORS)
    rightDenom = leftDenom
  } else if (wantDivides) {
    // One divides the other path
    const pair = pickRandom(DIVIDING_PAIRS)
    if (Math.random() < 0.5) {
      ;[leftDenom, rightDenom] = pair
    } else {
      ;[rightDenom, leftDenom] = pair
    }
  } else if (wantLCD) {
    // Need to find LCD (coprime denominators)
    const pair = pickRandom(COPRIME_PAIRS)
    if (Math.random() < 0.5) {
      ;[leftDenom, rightDenom] = pair
    } else {
      ;[rightDenom, leftDenom] = pair
    }
  } else {
    // Random path - pick any nice denominators
    leftDenom = pickRandom(NICE_DENOMINATORS)
    rightDenom = pickRandom(NICE_DENOMINATORS)
  }

  // Generate numerators (proper fractions: 1 to denom-1)
  let leftNum = randomInt(1, leftDenom - 1)
  let rightNum = randomInt(1, rightDenom - 1)

  // Generate whole numbers (0-5 for reasonable problems, sometimes 0 for simple fractions)
  let leftWhole = Math.random() < 0.3 ? 0 : randomInt(1, 5)
  const rightWhole = Math.random() < 0.3 ? 0 : randomInt(1, 5)

  // If we want borrowing for subtraction, ensure left fraction < right fraction (after LCD conversion)
  if (wantBorrow && op === '−') {
    const lcd = lcm(leftDenom, rightDenom)
    const leftConverted = leftNum * (lcd / leftDenom)
    const rightConverted = rightNum * (lcd / rightDenom)

    // Need leftConverted < rightConverted for borrowing
    if (leftConverted >= rightConverted) {
      // Swap to ensure we need to borrow
      ;[leftNum, rightNum] = [rightNum, leftNum]
      ;[leftDenom, rightDenom] = [rightDenom, leftDenom]
    }

    // Also ensure left whole >= right whole (so overall subtraction is valid)
    if (leftWhole < rightWhole) {
      leftWhole = rightWhole + randomInt(1, 3)
    }
  }

  // For subtraction without borrow, ensure left fraction >= right fraction
  if (!wantBorrow && op === '−') {
    const lcd = lcm(leftDenom, rightDenom)
    const leftConverted = leftNum * (lcd / leftDenom)
    const rightConverted = rightNum * (lcd / rightDenom)

    if (leftConverted < rightConverted) {
      // Swap to avoid needing borrow
      ;[leftNum, rightNum] = [rightNum, leftNum]
      ;[leftDenom, rightDenom] = [rightDenom, leftDenom]
    }
  }

  return {
    leftWhole,
    leftNum,
    leftDenom,
    op,
    rightWhole,
    rightNum,
    rightDenom,
  }
}

/**
 * Generate a pedagogically sensible subtraction problem.
 */
function generateSubtractionProblem(targetPath?: FlowchartPath): Record<string, ProblemValue> {
  const pathNodes = targetPath?.nodeIds || []
  const wantRegroup = pathNodes.includes('TENS') || pathNodes.includes('TAKEONE')

  let minuend: number
  let subtrahend: number

  if (wantRegroup) {
    // Need ones digit of minuend < ones digit of subtrahend
    const minuendTens = randomInt(3, 9)
    const minuendOnes = randomInt(0, 4)
    const subtrahendTens = randomInt(1, minuendTens - 1)
    const subtrahendOnes = randomInt(minuendOnes + 1, 9)

    minuend = minuendTens * 10 + minuendOnes
    subtrahend = subtrahendTens * 10 + subtrahendOnes
  } else {
    // No regrouping: ones digit of minuend >= ones digit of subtrahend
    const minuendTens = randomInt(3, 9)
    const minuendOnes = randomInt(5, 9)
    const subtrahendTens = randomInt(1, minuendTens - 1)
    const subtrahendOnes = randomInt(0, minuendOnes)

    minuend = minuendTens * 10 + minuendOnes
    subtrahend = subtrahendTens * 10 + subtrahendOnes
  }

  return { minuend, subtrahend }
}

/**
 * Generate a pedagogically sensible linear equation problem.
 *
 * For intro to linear equations, we generate ONE-STEP problems only:
 * - "ADDED ON" path: x + 5 = 12 (coefficient = 1, constant != 0)
 * - "MULTIPLIED IN" path: 4x = 20 (coefficient > 1, constant = 0)
 *
 * NOT two-step problems like 4x + 9 = 41 (that's for an advanced flowchart)
 */
function generateLinearEquationProblem(targetPath?: FlowchartPath): Record<string, ProblemValue> {
  const pathNodes = targetPath?.nodeIds || []

  // Determine which type of one-step problem to generate
  const wantAdditionPath =
    pathNodes.includes('STUCK_ADD') || pathNodes.includes('ZERO') || pathNodes.includes('MAKEZ')
  const wantMultiplicationPath =
    pathNodes.includes('STUCK_MUL') || pathNodes.includes('ONE') || pathNodes.includes('MAKEONE')

  // Generate problems where x is a nice integer answer
  const x = randomInt(2, 12)

  if (wantMultiplicationPath) {
    // Multiplication-only: ax = c (no constant)
    // e.g., 4x = 20 where x = 5
    const coefficient = pickRandom([2, 3, 4, 5, 6])
    const equals = coefficient * x
    return { coefficient, operation: '+', constant: 0, equals }
  } else if (wantAdditionPath) {
    // Addition/subtraction only: x ± b = c (coefficient = 1)
    // e.g., x + 5 = 12 where x = 7
    const operation = Math.random() < 0.5 ? '+' : '−'
    const constant = randomInt(2, 15)
    const equals = operation === '+' ? x + constant : x - constant
    return { coefficient: 1, operation, constant, equals }
  } else {
    // No specific path - randomly pick one type (not both!)
    if (Math.random() < 0.5) {
      // Addition/subtraction only
      const operation = Math.random() < 0.5 ? '+' : '−'
      const constant = randomInt(2, 15)
      const equals = operation === '+' ? x + constant : x - constant
      return { coefficient: 1, operation, constant, equals }
    } else {
      // Multiplication only
      const coefficient = pickRandom([2, 3, 4, 5, 6])
      const equals = coefficient * x
      return { coefficient, operation: '+', constant: 0, equals }
    }
  }
}

/**
 * Generate a problem with pedagogically sensible numbers for the given schema.
 * If targetPath is provided, generates numbers that will follow that path.
 */
function generateSmartProblem(
  schemaType: string,
  targetPath?: FlowchartPath
): Record<string, ProblemValue> {
  switch (schemaType) {
    case 'two-fractions-with-op':
      return generateFractionProblem(targetPath)
    case 'two-digit-subtraction':
      return generateSubtractionProblem(targetPath)
    case 'linear-equation':
      return generateLinearEquationProblem(targetPath)
    default:
      return {}
  }
}

/** Simple GCD using Euclidean algorithm */
function gcd(a: number, b: number): number {
  a = Math.abs(a)
  b = Math.abs(b)
  while (b > 0) {
    const t = b
    b = a % b
    a = t
  }
  return a
}

/** Simple LCM */
function lcm(a: number, b: number): number {
  return Math.abs(a * b) / gcd(a, b)
}

/**
 * Generate a random problem based on the schema fields (fallback for unknown schemas)
 */
export function generateRandomProblem(schema: {
  fields: Array<{
    name: string
    type: string
    min?: number
    max?: number
    options?: string[]
    default?: ProblemValue
  }>
}): Record<string, ProblemValue> {
  const values: Record<string, ProblemValue> = {}

  for (const field of schema.fields) {
    switch (field.type) {
      case 'integer':
      case 'number': {
        const min = field.min ?? 0
        const max = field.max ?? 99
        values[field.name] = Math.floor(Math.random() * (max - min + 1)) + min
        break
      }
      case 'choice': {
        const options = field.options ?? []
        values[field.name] = options[Math.floor(Math.random() * options.length)]
        break
      }
      default:
        values[field.name] = field.default ?? 0
    }
  }

  return values
}

/**
 * Check if a problem is valid according to the schema validation
 */
function isValidProblem(
  values: Record<string, ProblemValue>,
  validation: string | undefined
): boolean {
  if (!validation) return true
  try {
    const context = { problem: values, computed: {}, userState: {} }
    return Boolean(evaluate(validation, context))
  } catch {
    return false
  }
}

/**
 * Check if a problem satisfies a path's constraints
 */
function satisfiesPathConstraints(
  flowchart: ExecutableFlowchart,
  values: Record<string, ProblemValue>,
  path: FlowchartPath
): boolean {
  // Initialize computed values like we do in initializeState
  const context: EvalContext = {
    problem: values,
    computed: {},
    userState: {},
  }

  // Evaluate all variable init expressions
  for (const [varName, varDef] of Object.entries(flowchart.definition.variables)) {
    try {
      context.computed[varName] = evaluate(varDef.init, context)
    } catch {
      return false // Can't evaluate variables = can't check constraints
    }
  }

  // Check each constraint
  for (const constraint of path.constraints) {
    try {
      const result = Boolean(evaluate(constraint.expression, context))
      if (result !== constraint.requiredOutcome) {
        return false
      }
    } catch {
      return false
    }
  }

  return true
}

/**
 * Generate diverse examples with guaranteed path coverage using constraint-guided generation.
 *
 * Algorithm:
 * 1. Analyze the flowchart to enumerate all paths
 * 2. For each path, use smart generation to create problems that will follow that path
 * 3. Verify each generated problem actually takes the intended path
 * 4. Fall back to Monte Carlo for any paths we couldn't generate directly
 * 5. Return diverse set sorted by complexity
 *
 * @param flowchart The flowchart to generate examples for
 * @param count Number of examples to generate
 * @param constraints Optional teacher-configured constraints (e.g., positive answers only)
 */
export function generateDiverseExamples(
  flowchart: ExecutableFlowchart,
  count: number = 6,
  constraints: GenerationConstraints = DEFAULT_CONSTRAINTS
): GeneratedExample[] {
  const schema = flowchart.definition.problemInput
  const schemaType = schema.schema
  const analysis = analyzeFlowchart(flowchart)
  const hasGenerationConfig = !!flowchart.definition.generation

  const pathGroups = new Map<string, GeneratedExample[]>()
  const seenPaths = new Set<string>()

  // Convert legacy constraints to teacher constraints
  const teacherConstraints: TeacherConstraints = {
    positiveAnswersOnly: constraints.positiveAnswersOnly,
  }

  /**
   * Check if a generated problem satisfies all constraints (legacy fallback)
   */
  function satisfiesConstraintsLegacy(values: Record<string, ProblemValue>): boolean {
    if (constraints.positiveAnswersOnly && !hasPositiveAnswerLegacy(schemaType, values)) {
      return false
    }
    return true
  }

  // Phase 1: Constraint-guided generation for each enumerated path
  // Goal: Get at least 5 examples per target path (provides baseline coverage for filtered views)
  // Higher count ensures reliable coverage even when filtering by difficulty tier
  const minExamplesPerPath = 5
  for (const targetPath of analysis.paths) {
    const targetSignature = targetPath.nodeIds.join('→')
    let targetHits = 0

    // Try multiple times to generate valid problems for this path
    // Higher count needed for paths with computed constraints (like needsBorrow)
    // which have ~15% hit rate, so we need ~300 attempts to get 5 hits reliably
    for (let attempt = 0; attempt < 300 && targetHits < minExamplesPerPath; attempt++) {
      // Use new constraint-guided generation if flowchart has generation config
      // Otherwise fall back to legacy smart generation
      const values = hasGenerationConfig
        ? generateForPath(flowchart, targetPath, teacherConstraints)
        : generateSmartProblem(schemaType, targetPath)

      if (!values) continue

      // Check if schema validation passes (for legacy generation)
      if (!hasGenerationConfig && !isValidProblem(values, schema.validation)) continue

      // Check teacher constraints (for legacy generation)
      if (!hasGenerationConfig && !satisfiesConstraintsLegacy(values)) continue

      try {
        // Verify the generated problem actually takes the target path
        const complexity = calculatePathComplexity(flowchart, values)
        const actualSignature = complexity.path.join('→')
        const pathDescriptor = generatePathDescriptorGeneric(flowchart, complexity.path, values)

        // Record this example under its actual path (might differ from target)
        seenPaths.add(actualSignature)
        const example: GeneratedExample = {
          values,
          complexity,
          pathSignature: actualSignature,
          pathDescriptor,
        }

        const existing = pathGroups.get(actualSignature) || []
        existing.push(example)
        pathGroups.set(actualSignature, existing)

        // Count hits on the target path
        if (actualSignature === targetSignature) {
          targetHits++
        }
      } catch {
        // Skip problems that cause evaluation errors
      }
    }
  }

  // Phase 2: Monte Carlo for any paths we missed
  const targetPaths = new Set(analysis.paths.map((p) => p.nodeIds.join('→')))
  const missingPaths = [...targetPaths].filter((p) => !seenPaths.has(p))

  if (missingPaths.length > 0) {
    // Use Monte Carlo to try to hit missing paths
    const iterations = Math.max(50, missingPaths.length * 30)

    for (let i = 0; i < iterations && missingPaths.length > 0; i++) {
      // Use smart generation (avoid pure random which ignores constraints)
      const values = generateSmartProblem(schemaType)

      if (!isValidProblem(values, schema.validation)) continue
      if (!satisfiesConstraintsLegacy(values)) continue
      // Also validate flowchart constraints if they exist
      if (hasGenerationConfig && !validateFlowchartConstraints(values, flowchart)) continue

      try {
        const complexity = calculatePathComplexity(flowchart, values)
        const pathSignature = complexity.path.join('→')

        if (missingPaths.includes(pathSignature)) {
          seenPaths.add(pathSignature)
          const pathDescriptor = generatePathDescriptorGeneric(flowchart, complexity.path, values)
          const example: GeneratedExample = { values, complexity, pathSignature, pathDescriptor }

          const existing = pathGroups.get(pathSignature) || []
          existing.push(example)
          pathGroups.set(pathSignature, existing)

          // Remove from missing
          const idx = missingPaths.indexOf(pathSignature)
          if (idx >= 0) missingPaths.splice(idx, 1)
        }
      } catch {
        // Skip
      }
    }
  }

  // Phase 3: Generate additional variety for existing paths
  // (So we have multiple nice examples to choose from, especially when filtered by difficulty)
  for (const [pathSignature, examples] of pathGroups) {
    // Target 10 examples per path to ensure good coverage when filtered by difficulty tier
    const targetExamplesPerPath = 10
    if (examples.length < targetExamplesPerPath) {
      // Find the path definition for this signature
      const targetPath = analysis.paths.find((p) => p.nodeIds.join('→') === pathSignature)
      if (!targetPath) continue

      // Try multiple attempts per additional example (complex paths may have low hit rate ~13%)
      // With 100 consecutive failure limit, probability of giving up before 1 hit is 0.87^100 ≈ 0.000001
      const maxConsecutiveFailures = 100
      let consecutiveFailures = 0

      while (examples.length < targetExamplesPerPath && consecutiveFailures < maxConsecutiveFailures) {
        const values = hasGenerationConfig
          ? generateForPath(flowchart, targetPath, teacherConstraints)
          : generateSmartProblem(schemaType, targetPath)

        if (!values) {
          consecutiveFailures++
          continue
        }
        if (!hasGenerationConfig && !isValidProblem(values, schema.validation)) {
          consecutiveFailures++
          continue
        }
        if (!hasGenerationConfig && !satisfiesConstraintsLegacy(values)) {
          consecutiveFailures++
          continue
        }

        try {
          const complexity = calculatePathComplexity(flowchart, values)
          if (complexity.path.join('→') === pathSignature) {
            const pathDescriptor = generatePathDescriptorGeneric(flowchart, complexity.path, values)
            examples.push({ values, complexity, pathSignature, pathDescriptor })
            consecutiveFailures = 0 // Reset on success
          } else {
            consecutiveFailures++
          }
        } catch {
          consecutiveFailures++
        }
      }
    }
  }

  // Phase 3: Group examples by pathDescriptor (pedagogical category)
  // This ensures we cover different learning scenarios, not just different node paths
  const descriptorGroups = new Map<string, GeneratedExample[]>()
  for (const [, examples] of pathGroups) {
    for (const ex of examples) {
      const existing = descriptorGroups.get(ex.pathDescriptor) || []
      existing.push(ex)
      descriptorGroups.set(ex.pathDescriptor, existing)
    }
  }

  const results: GeneratedExample[] = []

  // Sort descriptor groups by complexity (simpler first for learning progression)
  const sortedGroups = [...descriptorGroups.entries()].sort((a, b) => {
    // Primary sort: total complexity (decisions + checkpoints)
    const aComplexity = a[1][0].complexity.decisions + a[1][0].complexity.checkpoints
    const bComplexity = b[1][0].complexity.decisions + b[1][0].complexity.checkpoints
    if (aComplexity !== bComplexity) return aComplexity - bComplexity
    // Secondary sort: path length
    return a[1][0].complexity.pathLength - b[1][0].complexity.pathLength
  })

  // Take one "nice" example from each unique descriptor (pedagogical category)
  for (const [, examples] of sortedGroups) {
    if (results.length >= count) break

    // Deduplicate by problem display (same values = same problem)
    const seen = new Set<string>()
    const unique = examples.filter((ex) => {
      const key = JSON.stringify(ex.values)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    // Sort by numeric sum (smaller = more readable)
    const sorted = unique.sort((a, b) => {
      const aSum = Object.values(a.values).reduce<number>(
        (s, v) => s + (typeof v === 'number' ? v : 0),
        0
      )
      const bSum = Object.values(b.values).reduce<number>(
        (s, v) => s + (typeof v === 'number' ? v : 0),
        0
      )
      return aSum - bSum
    })

    // Randomly pick from the smaller half (variety while keeping numbers reasonable)
    const candidateCount = Math.max(1, Math.ceil(sorted.length / 2))
    const candidates = sorted.slice(0, candidateCount)
    const selected = candidates[Math.floor(Math.random() * candidates.length)]
    results.push(selected)
  }

  // If we need more examples and have extra from groups, add variety
  if (results.length < count) {
    // Look for examples with different number magnitudes
    for (const [, examples] of sortedGroups) {
      if (results.length >= count) break

      // Find an example with larger numbers for variety
      const larger = examples.find((ex) => {
        const sum = Object.values(ex.values).reduce<number>(
          (s, v) => s + (typeof v === 'number' ? v : 0),
          0
        )
        return (
          sum > 20 &&
          !results.some(
            (r) =>
              r.pathDescriptor === ex.pathDescriptor &&
              JSON.stringify(r.values) === JSON.stringify(ex.values)
          )
        )
      })

      if (larger) results.push(larger)
    }
  }

  return results.slice(0, count)
}

// =============================================================================
// Parallel Example Generation
// =============================================================================

/**
 * Generate examples for a specific subset of paths.
 * Used by parallel workers to split work across multiple threads.
 *
 * Returns raw examples (not yet selected/deduped) that can be merged with
 * results from other workers.
 */
export function generateExamplesForPaths(
  flowchart: ExecutableFlowchart,
  pathIndices: number[],
  constraints: GenerationConstraints = DEFAULT_CONSTRAINTS
): GeneratedExample[] {
  const schema = flowchart.definition.problemInput
  const schemaType = schema.schema
  const analysis = analyzeFlowchart(flowchart)
  const hasGenerationConfig = !!flowchart.definition.generation

  const results: GeneratedExample[] = []

  const teacherConstraints: TeacherConstraints = {
    positiveAnswersOnly: constraints.positiveAnswersOnly,
  }

  function satisfiesConstraintsLegacy(values: Record<string, ProblemValue>): boolean {
    if (constraints.positiveAnswersOnly && !hasPositiveAnswerLegacy(schemaType, values)) {
      return false
    }
    return true
  }

  // Process only the assigned paths
  const minExamplesPerPath = 5
  for (const pathIndex of pathIndices) {
    const targetPath = analysis.paths[pathIndex]
    if (!targetPath) continue

    const targetSignature = targetPath.nodeIds.join('→')
    let targetHits = 0

    for (let attempt = 0; attempt < 300 && targetHits < minExamplesPerPath; attempt++) {
      const values = hasGenerationConfig
        ? generateForPath(flowchart, targetPath, teacherConstraints)
        : generateSmartProblem(schemaType, targetPath)

      if (!values) continue
      if (!hasGenerationConfig && !isValidProblem(values, schema.validation)) continue
      if (!hasGenerationConfig && !satisfiesConstraintsLegacy(values)) continue

      try {
        const complexity = calculatePathComplexity(flowchart, values)
        const actualSignature = complexity.path.join('→')
        const pathDescriptor = generatePathDescriptorGeneric(flowchart, complexity.path, values)

        const example: GeneratedExample = {
          values,
          complexity,
          pathSignature: actualSignature,
          pathDescriptor,
        }
        results.push(example)

        if (actualSignature === targetSignature) {
          targetHits++
        }
      } catch {
        // Skip problems that cause evaluation errors
      }
    }

    // Phase 3 for this path: Generate additional variety
    const targetExamplesPerPath = 10
    const pathExamples = results.filter((ex) => ex.pathSignature === targetSignature)
    if (pathExamples.length < targetExamplesPerPath) {
      const maxConsecutiveFailures = 100
      let consecutiveFailures = 0
      let currentCount = pathExamples.length

      while (currentCount < targetExamplesPerPath && consecutiveFailures < maxConsecutiveFailures) {
        const values = hasGenerationConfig
          ? generateForPath(flowchart, targetPath, teacherConstraints)
          : generateSmartProblem(schemaType, targetPath)

        if (!values) {
          consecutiveFailures++
          continue
        }
        if (!hasGenerationConfig && !isValidProblem(values, schema.validation)) {
          consecutiveFailures++
          continue
        }
        if (!hasGenerationConfig && !satisfiesConstraintsLegacy(values)) {
          consecutiveFailures++
          continue
        }

        try {
          const complexity = calculatePathComplexity(flowchart, values)
          if (complexity.path.join('→') === targetSignature) {
            const pathDescriptor = generatePathDescriptorGeneric(flowchart, complexity.path, values)
            results.push({ values, complexity, pathSignature: targetSignature, pathDescriptor })
            currentCount++
            consecutiveFailures = 0
          } else {
            consecutiveFailures++
          }
        } catch {
          consecutiveFailures++
        }
      }
    }
  }

  return results
}

/**
 * Merge and finalize examples from multiple parallel workers.
 * Takes raw examples from workers and produces final selected results.
 */
export function mergeAndFinalizeExamples(
  allExamples: GeneratedExample[],
  count: number
): GeneratedExample[] {
  // Group by pathDescriptor (pedagogical category)
  const descriptorGroups = new Map<string, GeneratedExample[]>()
  for (const ex of allExamples) {
    const existing = descriptorGroups.get(ex.pathDescriptor) || []
    existing.push(ex)
    descriptorGroups.set(ex.pathDescriptor, existing)
  }

  const results: GeneratedExample[] = []

  // Sort descriptor groups by complexity (simpler first)
  const sortedGroups = [...descriptorGroups.entries()].sort((a, b) => {
    const aComplexity = a[1][0].complexity.decisions + a[1][0].complexity.checkpoints
    const bComplexity = b[1][0].complexity.decisions + b[1][0].complexity.checkpoints
    if (aComplexity !== bComplexity) return aComplexity - bComplexity
    return a[1][0].complexity.pathLength - b[1][0].complexity.pathLength
  })

  // Take one "nice" example from each unique descriptor
  for (const [, examples] of sortedGroups) {
    if (results.length >= count) break

    // Deduplicate by problem values
    const seen = new Set<string>()
    const unique = examples.filter((ex) => {
      const key = JSON.stringify(ex.values)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    // Sort by numeric sum (smaller = more readable)
    const sorted = unique.sort((a, b) => {
      const aSum = Object.values(a.values).reduce<number>(
        (s, v) => s + (typeof v === 'number' ? v : 0),
        0
      )
      const bSum = Object.values(b.values).reduce<number>(
        (s, v) => s + (typeof v === 'number' ? v : 0),
        0
      )
      return aSum - bSum
    })

    // Randomly pick from the smaller half
    const candidateCount = Math.max(1, Math.ceil(sorted.length / 2))
    const candidates = sorted.slice(0, candidateCount)
    const selected = candidates[Math.floor(Math.random() * candidates.length)]
    results.push(selected)
  }

  // Add variety with larger numbers if needed
  if (results.length < count) {
    for (const [, examples] of sortedGroups) {
      if (results.length >= count) break

      const larger = examples.find((ex) => {
        const sum = Object.values(ex.values).reduce<number>(
          (s, v) => s + (typeof v === 'number' ? v : 0),
          0
        )
        return (
          sum > 20 &&
          !results.some(
            (r) =>
              r.pathDescriptor === ex.pathDescriptor &&
              JSON.stringify(r.values) === JSON.stringify(ex.values)
          )
        )
      })

      if (larger) results.push(larger)
    }
  }

  return results.slice(0, count)
}

// =============================================================================
// Problem Input Helpers
// =============================================================================

/**
 * Create a mixed number value
 */
export function createMixedNumber(whole: number, num: number, denom: number): MixedNumberValue {
  return { whole, num, denom }
}

/**
 * Format a mixed number for display
 */
export function formatMixedNumber(mn: MixedNumberValue): string {
  if (mn.whole === 0) {
    return `${mn.num}/${mn.denom}`
  }
  if (mn.num === 0) {
    return String(mn.whole)
  }
  return `${mn.whole} ${mn.num}/${mn.denom}`
}

/**
 * Format problem input for display
 */
export function formatProblemDisplay(
  flowchart: ExecutableFlowchart,
  problem: Record<string, ProblemValue>
): string {
  const schema = flowchart.definition.problemInput.schema

  switch (schema) {
    case 'two-digit-subtraction': {
      return `${problem.minuend} − ${problem.subtrahend}`
    }
    case 'two-mixed-numbers-with-op': {
      const left = problem.left as MixedNumberValue
      const right = problem.right as MixedNumberValue
      const op = problem.op as string
      return `${formatMixedNumber(left)} ${op} ${formatMixedNumber(right)}`
    }
    case 'linear-equation': {
      const coef = problem.coefficient as number
      const op = problem.operation as string
      const constant = problem.constant as number
      const equals = problem.equals as number
      const coefStr = coef === 1 ? '' : String(coef)
      // Clean display: skip "+ 0" or "- 0" for multiplication-only problems
      if (constant === 0) {
        return `${coefStr}x = ${equals}`
      }
      return `${coefStr}x ${op} ${constant} = ${equals}`
    }
    case 'two-fractions-with-op': {
      const leftWhole = problem.leftWhole as number
      const leftNum = problem.leftNum as number
      const leftDenom = problem.leftDenom as number
      const op = problem.op as string
      const rightWhole = problem.rightWhole as number
      const rightNum = problem.rightNum as number
      const rightDenom = problem.rightDenom as number
      const leftStr =
        leftWhole > 0 ? `${leftWhole} ${leftNum}/${leftDenom}` : `${leftNum}/${leftDenom}`
      const rightStr =
        rightWhole > 0 ? `${rightWhole} ${rightNum}/${rightDenom}` : `${rightNum}/${rightDenom}`
      return `${leftStr} ${op} ${rightStr}`
    }
    default: {
      // Generic display
      return Object.entries(problem)
        .map(([k, v]) => {
          if (typeof v === 'object' && v !== null && 'denom' in v) {
            return formatMixedNumber(v as MixedNumberValue)
          }
          return String(v)
        })
        .join(' ')
    }
  }
}
