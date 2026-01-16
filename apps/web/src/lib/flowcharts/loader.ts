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
} from './schema'
import { parseMermaidFile, parseNodeContent } from './parser'
import { evaluate, type EvalContext } from './evaluator'

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
  userInput: number | string
): { correct: boolean; expected: ProblemValue } | null {
  const node = flowchart.nodes[nodeId]
  if (!node || node.definition.type !== 'checkpoint') return null

  const def = node.definition
  const context: EvalContext = {
    ...createContextFromState(state),
    input: userInput,
  }

  try {
    const expected = evaluate(def.expected, context)
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
      const leftStr = leftWhole > 0 ? `${leftWhole} ${leftNum}/${leftDenom}` : `${leftNum}/${leftDenom}`
      const rightStr = rightWhole > 0 ? `${rightWhole} ${rightNum}/${rightDenom}` : `${rightNum}/${rightDenom}`
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
