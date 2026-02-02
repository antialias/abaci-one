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
  TransformExpression,
  StateSnapshot,
  AnswerDefinition,
} from './schema'
import { computeEdgeId } from './schema'
import { parseMermaidFile, parseNodeContent } from './parser'
import { evaluate, type EvalContext } from './evaluator'
import { formatProblemDisplay, interpolateTemplate } from './formatting'

// =============================================================================
// Helpers
// =============================================================================

/**
 * Escape special regex characters in a string.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

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
  interpolateTemplate,
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

  // Track edge ID infills so we can inject them into the raw mermaid string
  const edgeIdInfills: Array<{ from: string; to: string; label?: string; edgeId: string }> = []

  // Infill missing edge IDs for decision edges
  // For each decision node, if the edge doesn't have an explicit ID (starts with "edge_"),
  // assign the computed ID based on {nodeId}_{optionValue}
  for (const [nodeId, nodeDef] of Object.entries(definition.nodes)) {
    if (nodeDef.type !== 'decision') continue

    for (const option of nodeDef.options) {
      const expectedEdgeId = computeEdgeId(nodeId, option.value)

      // Find the edge from this node to the option's next node
      const edge = mermaid.edges.find((e) => e.from === nodeId && e.to === option.next)

      if (edge && edge.id.startsWith('edge_')) {
        // Edge exists but has auto-generated ID - replace with computed ID
        edge.id = expectedEdgeId
        // Track for injection into raw mermaid
        edgeIdInfills.push({
          from: nodeId,
          to: option.next,
          label: edge.label,
          edgeId: expectedEdgeId,
        })
      }
    }
  }

  // Inject edge IDs into the raw mermaid string so SVG elements will have them
  let modifiedMermaid = mermaidContent
  for (const infill of edgeIdInfills) {
    // Build regex to match this specific edge
    // Pattern: FROM -->|"LABEL"| TO  or  FROM --> TO
    const labelPart = infill.label ? `\\s*\\|"${escapeRegex(infill.label)}"\\|\\s*` : '\\s*'
    const edgeRegex = new RegExp(
      `(${escapeRegex(infill.from)})\\s+-->${labelPart}(${escapeRegex(infill.to)})`,
      'g'
    )
    // Replace with: FROM EDGEID@-->|"LABEL"| TO
    const replacement = infill.label
      ? `$1 ${infill.edgeId}@-->|"${infill.label}"| $2`
      : `$1 ${infill.edgeId}@--> $2`
    modifiedMermaid = modifiedMermaid.replace(edgeRegex, replacement)
  }

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
    rawMermaid: modifiedMermaid,
    nodes,
  }
}

// =============================================================================
// State Initialization
// =============================================================================

/**
 * Initialize flowchart state from problem input.
 *
 * In the new transform model:
 * - `values` starts with problem input and accumulates transform results
 * - `computed` is populated from legacy `variables` section (for backwards compatibility)
 * - `snapshots` tracks state at each node for trace visualization
 *
 * @param flowchart - The executable flowchart
 * @param problemInput - User's problem input values
 * @returns Initial state ready for walking
 */
export function initializeState(
  flowchart: ExecutableFlowchart,
  problemInput: Record<string, ProblemValue>
): FlowchartState {
  // Start values with problem input (new transform model)
  const values: Record<string, ProblemValue> = { ...problemInput }

  // Create evaluation context with problem values
  const context: EvalContext = {
    problem: problemInput,
    computed: {},
    userState: {},
  }

  // LEGACY: Evaluate all variable init expressions for backwards compatibility
  // This will be removed when all flowcharts migrate to transforms
  const computed: Record<string, ProblemValue> = {}
  const variables = flowchart.definition.variables || {}
  for (const [varName, varDef] of Object.entries(variables)) {
    try {
      computed[varName] = evaluate(varDef.init, context)
      // Update context so subsequent variables can reference earlier ones
      context.computed[varName] = computed[varName]
      // Also add to values for hybrid mode
      values[varName] = computed[varName]
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

  // Create initial snapshot
  const initialSnapshot: StateSnapshot = {
    nodeId: 'initial',
    nodeTitle: 'Start',
    values: { ...values },
    transforms: [],
    workingProblem,
    timestamp: Date.now(),
  }

  return {
    problem: problemInput,
    computed, // Legacy - for backwards compatibility
    values, // New - accumulates transform results
    userState: {},
    currentNode: flowchart.definition.entryNode,
    history: [],
    startTime: Date.now(),
    mistakes: 0,
    workingProblem,
    workingProblemHistory,
    snapshots: [initialSnapshot],
    hasError: false,
  }
}

/**
 * Create evaluation context from current state.
 *
 * Uses `values` (accumulated transforms) as `computed` for the evaluator.
 * Falls back to legacy `computed` for backwards compatibility.
 */
export function createContextFromState(state: FlowchartState): EvalContext {
  // Prefer values (new model) over computed (legacy)
  // Merge both so expressions can reference either
  const computed = { ...state.computed, ...state.values }
  return {
    problem: state.problem,
    computed,
    userState: state.userState,
  }
}

/**
 * Create evaluation context from accumulated values (for transforms).
 */
export function createContextFromValues(
  problem: Record<string, ProblemValue>,
  values: Record<string, ProblemValue>,
  userState: Record<string, ProblemValue>
): EvalContext {
  return {
    problem,
    computed: values, // In transform model, accumulated values are the "computed"
    userState,
  }
}

// =============================================================================
// Transform System (new unified computation model)
// =============================================================================

/**
 * Apply node transforms to state.
 *
 * Transforms execute in order - later transforms can reference earlier ones.
 * Results accumulate in state.values. Errors are logged but don't stop the walk.
 *
 * @param state - Current flowchart state
 * @param nodeId - ID of the node whose transforms to apply
 * @param flowchart - The executable flowchart
 * @returns Updated state with transforms applied and new snapshot added
 */
export function applyTransforms(
  state: FlowchartState,
  nodeId: string,
  flowchart: ExecutableFlowchart
): FlowchartState {
  const node = flowchart.nodes[nodeId]
  if (!node) return state

  const transforms = node.definition.transform || []

  // Apply transforms in order
  const newValues = { ...state.values }
  let hasError = state.hasError
  const appliedTransforms: TransformExpression[] = []

  for (const transform of transforms) {
    try {
      const context = createContextFromValues(state.problem, newValues, state.userState)
      const result = evaluate(transform.expr, context)
      newValues[transform.key] = result
      appliedTransforms.push(transform)
    } catch (error) {
      console.error(`Transform error at ${nodeId}.${transform.key}:`, error)
      newValues[transform.key] = null as unknown as ProblemValue
      hasError = true
    }
  }

  // Check for workingProblemUpdate on this node
  let newWorkingProblem = state.workingProblem
  let newWorkingProblemHistory = state.workingProblemHistory
  const def = node.definition

  let workingProblemUpdate: { result: string; label: string } | undefined
  if (def.type === 'checkpoint') {
    workingProblemUpdate = (def as CheckpointNode).workingProblemUpdate
  } else if (def.type === 'instruction') {
    workingProblemUpdate = (def as InstructionNode).workingProblemUpdate
  }

  if (workingProblemUpdate) {
    try {
      const context = createContextFromValues(state.problem, newValues, state.userState)
      newWorkingProblem = String(evaluate(workingProblemUpdate.result, context))
      newWorkingProblemHistory = [
        ...state.workingProblemHistory,
        {
          value: newWorkingProblem,
          label: workingProblemUpdate.label,
          nodeId,
        },
      ]
    } catch (error) {
      console.error(`Working problem update error at ${nodeId}:`, error)
    }
  }

  // Create snapshot after applying transforms (with updated working problem)
  const snapshot: StateSnapshot = {
    nodeId,
    nodeTitle: node.content?.title || nodeId,
    values: { ...newValues },
    transforms: appliedTransforms,
    workingProblem: newWorkingProblem,
    timestamp: Date.now(),
  }

  return {
    ...state,
    values: newValues,
    computed: { ...state.computed, ...newValues }, // Keep computed in sync for backwards compat
    hasError,
    workingProblem: newWorkingProblem,
    workingProblemHistory: newWorkingProblemHistory,
    snapshots: [...state.snapshots, snapshot],
  }
}

/**
 * Extract the final answer from terminal state.
 *
 * Uses the flowchart's `answer` definition to:
 * 1. Extract answer component values from accumulated state
 * 2. Interpolate display templates (text, web, typst)
 *
 * Falls back to legacy `display.answer` if no `answer` definition exists.
 *
 * @param flowchart - The executable flowchart
 * @param state - Terminal state with all transforms applied
 * @returns Extracted answer values and formatted display strings
 */
export function extractAnswer(
  flowchart: ExecutableFlowchart,
  state: FlowchartState
): {
  values: Record<string, ProblemValue>
  display: { text: string; web: string; typst: string }
} {
  const answerDef = flowchart.definition.answer

  // If we have a new-style answer definition, use it
  if (answerDef) {
    const values: Record<string, ProblemValue> = {}

    // Extract each answer component from accumulated state
    for (const [name, ref] of Object.entries(answerDef.values)) {
      values[name] = state.values[ref] ?? null
    }

    // Interpolate display templates
    const allValues = { ...state.values, ...values }
    return {
      values,
      display: {
        text: interpolateTemplate(answerDef.display.text, allValues),
        web: interpolateTemplate(answerDef.display.web || answerDef.display.text, allValues),
        typst: interpolateTemplate(answerDef.display.typst || answerDef.display.text, allValues),
      },
    }
  }

  // LEGACY: Fall back to display.answer expression
  if (flowchart.definition.display?.answer) {
    try {
      const context = createContextFromState(state)
      const result = evaluate(flowchart.definition.display.answer, context)
      const displayStr = String(result)
      return {
        values: { answer: result },
        display: { text: displayStr, web: displayStr, typst: displayStr },
      }
    } catch (error) {
      console.error('Error evaluating legacy display.answer:', error)
    }
  }

  // No answer definition - return empty
  return {
    values: {},
    display: { text: '', web: '', typst: '' },
  }
}

/**
 * Simulate walking through a flowchart to terminal state.
 *
 * This is THE canonical function for computing answers. All other code paths
 * (worksheets, tests, example generation) should use this function.
 *
 * The walk:
 * 1. Starts with problem input in state.values
 * 2. Visits each node, applying transforms
 * 3. Makes decisions based on accumulated state
 * 4. Ends at terminal node with final answer in state.values
 *
 * @param flowchart - The executable flowchart
 * @param input - Problem input values
 * @returns Terminal state with all transforms applied and full snapshot history
 */
export function simulateWalk(
  flowchart: ExecutableFlowchart,
  input: Record<string, ProblemValue>
): FlowchartState {
  let state = initializeState(flowchart, input)
  const maxSteps = 100 // Safety limit to prevent infinite loops
  const visited = new Set<string>()

  for (let step = 0; step < maxSteps; step++) {
    const nodeId = state.currentNode
    if (!nodeId || visited.has(nodeId)) break
    visited.add(nodeId)

    const node = flowchart.nodes[nodeId]
    if (!node) break

    // Apply transforms for this node
    state = applyTransforms(state, nodeId, flowchart)

    // Check if terminal
    if (node.definition.type === 'terminal') break

    // Determine next node based on node type and accumulated state
    const { nextNodeId, selectedOptionValue, edgeId, edgeIndex } = getNextNodeForSimulation(
      flowchart,
      state,
      nodeId
    )
    if (!nextNodeId) break

    // Update the last snapshot with decision/transition info
    if (state.snapshots.length > 0) {
      const lastSnapshot = state.snapshots[state.snapshots.length - 1]
      const updatedSnapshot = {
        ...lastSnapshot,
        // Include decision info if this was a decision node
        ...(selectedOptionValue ? { selectedOptionValue } : {}),
        nextNodeId,
        // Include both edge ID and index for reliable matching
        edgeId,
        edgeIndex,
      }
      state = {
        ...state,
        snapshots: [...state.snapshots.slice(0, -1), updatedSnapshot],
      }
    }

    state = { ...state, currentNode: nextNodeId }
  }

  return state
}

/**
 * Result of determining next node during simulation.
 */
interface SimulationNextResult {
  nextNodeId: string | null
  /** For decision nodes: the option value that was selected (e.g., "MD" for multiply/divide) */
  selectedOptionValue?: string
  /** The unique ID of the edge taken (from ParsedEdge.id) for reliable edge matching */
  edgeId?: string
  /** The index of the edge in parse order (from ParsedEdge.index), for fallback matching */
  edgeIndex?: number
}

/**
 * Get next node during simulation (without user input).
 * Used by simulateWalk to determine path based on expressions.
 */
function getNextNodeForSimulation(
  flowchart: ExecutableFlowchart,
  state: FlowchartState,
  nodeId: string
): SimulationNextResult {
  const node = flowchart.nodes[nodeId]
  if (!node) return { nextNodeId: null }

  const def = node.definition
  const context = createContextFromState(state)

  /**
   * Find an edge by ID (preferred) or by from/to/label (fallback).
   *
   * Priority:
   * 1. If edgeId is provided, match by ID directly (canonical method)
   * 2. If from/to match a single edge, use that
   * 3. If multiple edges exist between from/to, try to match by label
   * 4. Fallback to first matching edge
   */
  const findEdge = (from: string, to: string, edgeId?: string, edgeLabel?: string) => {
    // Priority 1: Match by edge ID (canonical)
    if (edgeId) {
      const edgeById = flowchart.mermaid.edges.find((e) => e.id === edgeId)
      if (edgeById) return edgeById
      // If specified edgeId doesn't exist, fall through to from/to matching
    }

    // Priority 2+: Match by from/to
    const matchingEdges = flowchart.mermaid.edges.filter((e) => e.from === from && e.to === to)
    if (matchingEdges.length <= 1) return matchingEdges[0]

    // Priority 3: Multiple edges - try to match by label
    if (edgeLabel) {
      const labelMatch = matchingEdges.find((e) => e.label === edgeLabel)
      if (labelMatch) return labelMatch
    }

    // Priority 4: Fallback to first edge
    return matchingEdges[0]
  }

  // Helper to build result with edge info
  const buildResult = (
    nextNodeId: string | null,
    selectedOptionValue?: string,
    explicitEdgeId?: string
  ): SimulationNextResult => {
    if (!nextNodeId) return { nextNodeId: null }
    const edge = findEdge(nodeId, nextNodeId, explicitEdgeId, selectedOptionValue)
    return {
      nextNodeId,
      selectedOptionValue,
      edgeId: edge?.id,
      edgeIndex: edge?.index,
    }
  }

  switch (def.type) {
    case 'terminal':
      return { nextNodeId: null }

    case 'decision': {
      // Check for skip condition
      if (def.skipIf && def.skipTo) {
        try {
          if (evaluate(def.skipIf, context)) {
            return buildResult(def.skipTo, '__skip__')
          }
        } catch {
          // Continue to normal decision handling
        }
      }

      // Determine path based on correctAnswer expression
      // Use pathLabel for edge label matching (fallback), value for edge ID computation
      const getEdgeLabel = (opt: (typeof def.options)[0]) => opt.pathLabel || opt.value

      // Helper to build result from an option
      // Edge ID is computed as {nodeId}_{optionValue} - mermaid must use this pattern
      const buildFromOption = (opt: (typeof def.options)[0] | undefined) => {
        if (!opt) return buildResult(null)
        const edgeId = computeEdgeId(nodeId, opt.value)
        return buildResult(opt.next, getEdgeLabel(opt), edgeId)
      }

      if (def.correctAnswer) {
        try {
          const correct = evaluate(def.correctAnswer, context)
          if (typeof correct === 'boolean') {
            const yesOption = def.options.find(
              (o) => o.value === 'yes' || o.value.toLowerCase().includes('yes')
            )
            const noOption = def.options.find(
              (o) => o.value === 'no' || o.value.toLowerCase().includes('no')
            )
            if (correct && yesOption) return buildFromOption(yesOption)
            if (!correct && noOption) return buildFromOption(noOption)
            // Fallback to index-based
            return buildFromOption(correct ? def.options[0] : def.options[1])
          }
          // String match
          const option = def.options.find((o) => o.value === String(correct))
          if (option) return buildFromOption(option)
          return buildFromOption(def.options[0])
        } catch {
          return buildFromOption(def.options[0])
        }
      }
      return buildFromOption(def.options[0])
    }

    case 'checkpoint': {
      // Check for skip condition
      if (def.skipIf && def.skipTo) {
        try {
          if (evaluate(def.skipIf, context)) {
            return buildResult(def.skipTo)
          }
        } catch {
          // Continue to normal handling
        }
      }
      // Fall through to instruction logic
    }
    // biome-ignore lint/suspicious/noFallthroughSwitchClause: Intentional fallthrough
    case 'instruction': {
      if (def.next) return buildResult(def.next)
      const edges = flowchart.definition.edges?.[nodeId]
      if (edges && edges.length > 0) return buildResult(edges[0])
      const mermaidEdges = flowchart.mermaid.edges.filter((e) => e.from === nodeId)
      return buildResult(mermaidEdges[0]?.to ?? null)
    }

    case 'milestone':
    case 'embellishment':
      return buildResult(def.next)

    default:
      return { nextNodeId: null }
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
