/**
 * Flowchart Loader
 *
 * Combines JSON definitions (`.flow.json`) with Mermaid content (`.mmd` or embedded)
 * to create executable flowcharts, and manages runtime state as users walk through them.
 *
 * ## Key Functions
 *
 * - {@link loadFlowchart} - Merge JSON definition + Mermaid into ExecutableFlowchart
 * - {@link initializeState} - Create initial runtime state from problem input
 * - {@link advanceState} - Move to next node in the flowchart
 * - {@link validateCheckpoint} - Check if user's answer is correct
 * - {@link isDecisionCorrect} - Check if user chose the correct option
 * - {@link formatProblemDisplay} - Format problem values for display
 *
 * ## Data Flow
 *
 * ```
 * FlowchartDefinition + Mermaid content
 *                   ↓
 *           loadFlowchart()
 *                   ↓
 *         ExecutableFlowchart
 *                   ↓
 *     initializeState(flowchart, problemInput)
 *                   ↓
 *           FlowchartState
 *                   ↓
 *     advanceState(), validateCheckpoint(), etc.
 * ```
 *
 * ## Where to Find Mermaid Content
 *
 * **IMPORTANT**: Mermaid content is NOT always in separate `.mmd` files!
 * Check `definitions/index.ts` first - many flowcharts embed their mermaid as constants.
 *
 * @see {@link ./README.md} for complete system documentation
 * @module flowcharts/loader
 */

import type {
  FlowchartDefinition,
  ExecutableFlowchart,
  ExecutableNode,
  FlowchartState,
  ProblemValue,
  WorkingProblemHistoryEntry,
  InstructionNode,
  CheckpointNode,
} from './schema'
import { parseMermaidFile, parseNodeContent } from './parser'
import { evaluate, type EvalContext } from './evaluator'

// =============================================================================
// Re-exports for backwards compatibility
// =============================================================================

// Path Analysis
export type {
  PathConstraint,
  FlowchartPath,
  FlowchartAnalysis,
} from './path-analysis'
export { enumerateAllPaths, analyzeFlowchart } from './path-analysis'

// Example Generation
export type {
  GenerationConstraints,
  GeneratedExample,
  GenerationDiagnostics,
  GenerationResult,
} from './example-generator'
export {
  DEFAULT_CONSTRAINTS,
  createSeededRandom,
  generateDiverseExamples,
  generateDiverseExamplesWithDiagnostics,
  generateExamplesForPaths,
  mergeAndFinalizeExamples,
} from './example-generator'

// Grid Dimensions
export type { GridDimensions } from './grid-dimensions'
export {
  generatePathDescriptorFromPath,
  inferGridDimensions,
  inferGridDimensionsFromExamples,
} from './grid-dimensions'

// Formatting
export {
  createMixedNumber,
  formatMixedNumber,
  formatProblemDisplay,
} from './formatting'

// =============================================================================
// Flowchart Loading
// =============================================================================

/**
 * Load and merge a flowchart definition with its Mermaid content.
 *
 * This is the main entry point for creating an executable flowchart.
 * It combines:
 * - **JSON definition** (`.flow.json`): Node types, validation logic, variables
 * - **Mermaid content**: Node display content, phases, visual structure
 *
 * ## Node Merging
 *
 * For each node ID:
 * 1. If in JSON definition: uses that node type/behavior
 * 2. If only in Mermaid: creates default `instruction` node
 * 3. Content always comes from Mermaid (parsed via `parseNodeContent`)
 *
 * ## Common Usage
 *
 * ```typescript
 * import { getFlowchart } from './definitions'
 * import { loadFlowchart } from './loader'
 *
 * const data = getFlowchart('fraction-add-sub')
 * const flowchart = await loadFlowchart(data.definition, data.mermaid)
 * ```
 *
 * @param definition - The JSON definition from `.flow.json`
 * @param mermaidContent - The Mermaid content (from `.mmd` file or embedded string)
 * @returns Promise resolving to executable flowchart ready for FlowchartWalker
 */
export async function loadFlowchart(
  definition: FlowchartDefinition,
  mermaidContent: string
): Promise<ExecutableFlowchart> {
  // Parse the Mermaid file
  const mermaid = parseMermaidFile(mermaidContent)

  // Build executable nodes by merging definition with parsed content
  const nodes: Record<string, ExecutableNode> = {}

  // Track missing nodes to detect fundamental mismatches
  const missingNodes: string[] = []

  for (const [nodeId, nodeDef] of Object.entries(definition.nodes)) {
    const rawContent = mermaid.nodes[nodeId]
    if (!rawContent) {
      missingNodes.push(nodeId)
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

  // Check for critical mismatches that will break rendering
  const jsonNodeCount = Object.keys(definition.nodes).length
  const missingRatio = missingNodes.length / jsonNodeCount

  if (missingNodes.includes(definition.entryNode)) {
    throw new Error(
      `Entry node "${definition.entryNode}" is not defined in mermaid content. ` +
        `The JSON and mermaid node IDs don't match. Mermaid has: ${Object.keys(mermaid.nodes).slice(0, 5).join(', ')}...`
    )
  }

  if (missingRatio > 0.5) {
    throw new Error(
      `${missingNodes.length} of ${jsonNodeCount} nodes from JSON are missing in mermaid. ` +
        `The JSON and mermaid node IDs don't match. ` +
        `JSON expects: ${missingNodes.slice(0, 5).join(', ')}... ` +
        `Mermaid has: ${Object.keys(mermaid.nodes).slice(0, 5).join(', ')}...`
    )
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
    rawMermaid: mermaidContent,
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

    case 'embellishment': {
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
        // Check for skip condition first
        if (def.skipIf && def.skipTo) {
          try {
            const shouldSkip = evaluate(def.skipIf, context)
            if (shouldSkip) {
              // Skip this decision entirely - don't count it
              currentNodeId = def.skipTo
              break
            }
          } catch {
            // If skipIf evaluation fails, proceed to normal decision handling
          }
        }

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

      case 'checkpoint': {
        // Check for skip condition first
        if (def.skipIf && def.skipTo) {
          try {
            const shouldSkip = evaluate(def.skipIf, context)
            if (shouldSkip) {
              // Skip this checkpoint entirely - don't count it
              currentNodeId = def.skipTo
              break
            }
          } catch {
            // If skipIf evaluation fails, proceed to normal checkpoint handling
          }
        }
        checkpoints++
        // Fall through to instruction logic for next node
      }
      // biome-ignore lint/suspicious/noFallthroughSwitchClause: Intentional fallthrough to share instruction logic
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
      case 'embellishment':
        currentNodeId = def.next
        break

      default:
        currentNodeId = undefined as unknown as string
    }
  }

  return { pathLength: path.length, decisions, checkpoints, path }
}
