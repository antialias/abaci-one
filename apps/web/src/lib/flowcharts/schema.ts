/**
 * Flowchart Walker Schema Types
 *
 * This module defines all TypeScript types for the flowchart walker system.
 * These types correspond to the structure of `.flow.json` files and the
 * runtime state used during flowchart execution.
 *
 * ## Architecture Overview
 *
 * ```
 * FlowchartDefinition (from .flow.json)
 *   ├── problemInput: ProblemInputSchema    # User input form definition
 *   ├── nodes: Record<string, FlowchartNode>  # Node behavior definitions
 *   │     └── transform?: TransformExpression[]  # Computations at this node
 *   ├── answer?: AnswerDefinition  # How to extract final answer
 *   ├── workingProblem?: WorkingProblemConfig  # Evolving problem display
 *   └── constraints?: GenerationConstraints  # Problem generation rules
 *
 * ParsedMermaid (from .mmd or embedded)
 *   ├── nodes: Record<string, string>  # Raw node content
 *   ├── edges: ParsedEdge[]  # Connections between nodes
 *   └── phases: Phase[]  # Subgraph groupings
 *
 * ExecutableFlowchart = FlowchartDefinition + ParsedMermaid merged
 *   └── nodes: Record<string, ExecutableNode>  # Ready for display
 *
 * FlowchartState (runtime)
 *   ├── problem: user input values
 *   ├── values: accumulated transform results (starts with problem)
 *   ├── currentNode: where we are
 *   ├── snapshots: state history at each node (for trace)
 *   └── history: actions taken
 * ```
 *
 * ## Computation Model
 *
 * Transforms execute progressively during the walk:
 * 1. State starts with problem input in `values`
 * 2. Each node can have `transform` array
 * 3. Transforms execute in order, results accumulate in `values`
 * 4. Later transforms can reference earlier ones
 * 5. Terminal state contains final answer in `values`
 * 6. `extractAnswer()` uses `answer` definition to format the result
 *
 * ## Node Types
 *
 * | Type | Purpose | User Action |
 * |------|---------|-------------|
 * | `instruction` | Show content | Tap to continue |
 * | `decision` | Yes/No or multiple choice | Tap option |
 * | `checkpoint` | Validate user answer | Enter value |
 * | `milestone` | Success marker | Auto-advances |
 * | `embellishment` | Decorative emoji/celebration | Auto-advances with animation |
 * | `terminal` | End state | Shows completion |
 *
 * ## File Locations
 *
 * - JSON definitions: `lib/flowcharts/definitions/*.flow.json`
 * - Mermaid content: `lib/flowcharts/definitions/index.ts` (embedded) or `*.mmd`
 * - This file: Type definitions only, no runtime logic
 *
 * @see {@link ../README.md} for complete system documentation
 * @module flowcharts/schema
 */

// =============================================================================
// Problem Input Schemas
// =============================================================================

/** Field types for problem input forms */
export type FieldType = 'integer' | 'number' | 'choice' | 'mixed-number' | 'dynamic'

/** Base field definition */
export interface BaseField {
  name: string
  label?: string
  type: FieldType
}

/** Integer field with optional constraints */
export interface IntegerField extends BaseField {
  type: 'integer'
  min?: number
  max?: number
  default?: number
}

/** Number field (allows decimals) */
export interface NumberField extends BaseField {
  type: 'number'
  min?: number
  max?: number
  default?: number
  step?: number
}

/** Choice field (dropdown/select) */
export interface ChoiceField extends BaseField {
  type: 'choice'
  options: string[]
  default?: string
}

/** Mixed number field (whole + numerator + denominator) */
export interface MixedNumberField extends BaseField {
  type: 'mixed-number'
}

/** Dynamic field (changes based on other field values) */
export interface DynamicField extends BaseField {
  type: 'dynamic'
  dependsOn: string
  variants: Record<string, Field[]>
}

export type Field = IntegerField | NumberField | ChoiceField | MixedNumberField | DynamicField

/** An example problem that can be pre-loaded */
export interface ProblemExample {
  /** Display name for the example (e.g., "No regrouping") */
  name: string
  /** Description of the path this covers */
  description?: string
  /** Values to populate the form with */
  values: Record<string, ProblemValue>
  /** Expected answer string that display.answer should produce (for test validation) */
  expectedAnswer?: string
  /** Optional: expected decision path values taken (e.g., ["direct", "same"]) */
  expectedPath?: string[]
}

/** Problem input schema definition */
export interface ProblemInputSchema {
  schema: string
  fields: Field[]
  /** Optional expression that must evaluate to true for input to be valid */
  validation?: string
  /** Pre-defined example problems that cover different paths */
  examples?: ProblemExample[]
}

// =============================================================================
// Transforms (progressive computation during walk)
// =============================================================================

/**
 * A single transform expression that computes a value.
 * Transforms execute in order - later transforms can reference earlier ones.
 */
export interface TransformExpression {
  /** Variable name to create/update in accumulated state */
  key: string
  /** Expression to evaluate (uses existing evaluator syntax) */
  expr: string
}

/**
 * Snapshot of state at a specific node (for trace visualization).
 * One snapshot is recorded per node visited during a walk.
 */
export interface StateSnapshot {
  /** Node ID where this snapshot was taken */
  nodeId: string
  /** Human-readable node title for display */
  nodeTitle?: string
  /** Accumulated values after transforms at this node */
  values: Record<string, ProblemValue>
  /** Transforms that were applied at this node */
  transforms: TransformExpression[]
  /** Working problem display after this node (if applicable) */
  workingProblem?: string
  /** Timestamp when this snapshot was taken */
  timestamp: number
}

// =============================================================================
// Answer Definition (extracted from terminal state)
// =============================================================================

/**
 * Template for displaying answers in different contexts.
 */
export interface DisplayTemplate {
  /** Plain text format (for tests, simple display) */
  text: string
  /** Web format with MathML (for browser display) */
  web?: string
  /** Typst format (for PDF worksheets) */
  typst?: string
}

/**
 * Defines how to extract the final answer from terminal state.
 */
export interface AnswerDefinition {
  /**
   * Map answer component names to variable refs in accumulated state.
   * Example: { "answer": "finalResult" } extracts state.values.finalResult
   */
  values: Record<string, string>
  /** Templates for displaying the answer */
  display: DisplayTemplate
}

// =============================================================================
// Structured Test Cases
// =============================================================================

/**
 * A test case with structured expected values (primitives, not strings).
 * Used for validating flowchart correctness.
 */
export interface StructuredTestCase {
  /** Human-readable test name */
  name: string
  /** Problem input values */
  values: Record<string, ProblemValue>
  /** Expected answer values (primitives, compared directly) */
  expected: Record<string, ProblemValue>
}

// =============================================================================
// Working Problem (evolving problem display)
// =============================================================================

/**
 * Configuration for the working problem feature.
 * The working problem shows the problem as it evolves through the solution process.
 * Example: "2x - 9 = 3" → "2x = 12" → "x = 6"
 */
export interface WorkingProblemConfig {
  /** Expression that evaluates to the initial working problem display string */
  initial: string
}

/**
 * Defines how a node transforms the working problem.
 * Applied when the user successfully completes the node.
 */
export interface WorkingProblemStep {
  /** Expression that evaluates to the new working problem representation */
  result: string
  /** Label describing what operation was performed (e.g., "Add 9 to both sides") */
  label: string
}

// =============================================================================
// Node Types
// =============================================================================

/** Base node properties shared by all node types */
interface BaseNode {
  /** Optional explicit next node (for nodes with single outgoing edge) */
  next?: string
  /**
   * Transforms to apply when entering this node.
   * Executed in order - later transforms can reference earlier ones.
   * Results accumulate in state.values.
   */
  transform?: TransformExpression[]
}

/**
 * Instruction node - shows content, waits for "I did it" tap
 */
export interface InstructionNode extends BaseNode {
  type: 'instruction'
  advance: 'tap'
  /** Optional: transform the working problem when this node is completed */
  workingProblemUpdate?: WorkingProblemStep
}

/**
 * Decision node - shows question, user taps choice, routes accordingly
 */
export interface DecisionNode extends BaseNode {
  type: 'decision'
  /** Expression that evaluates to the correct answer (true/false or matches option value) */
  correctAnswer?: string
  /** Available choices */
  options: DecisionOption[]
  /** Optional: skip this decision entirely if expression is true */
  skipIf?: string
  /** Node to skip to if skipIf evaluates to true */
  skipTo?: string
  /**
   * If true, this decision is excluded from consideration when structuring examples.
   * Use for pedagogical decisions that shouldn't define grid dimensions.
   */
  excludeFromExampleStructure?: boolean
}

/** A single option in a decision node */
export interface DecisionOption {
  /** Display label for the button */
  label: string
  /** Value used for routing and validation */
  value: string
  /** Next node if this option is selected */
  next: string
  /** Short label for path descriptors (e.g., "Same", "+"). Used in concatenated paths like "Same +" */
  pathLabel?: string
  /** Kid-friendly label for grid headers (e.g., "Same denominators", "Addition"). Falls back to pathLabel if not provided */
  gridLabel?: string
}

/**
 * Checkpoint node - user enters a value, app validates
 */
export interface CheckpointNode extends BaseNode {
  type: 'checkpoint'
  /** Prompt text shown to user */
  prompt: string
  /** Type of input expected */
  inputType: 'number' | 'text' | 'two-numbers'
  /** Expression that evaluates to the expected value (or array of expressions for two-numbers) */
  expected: string | [string, string]
  /** Labels for two-numbers inputs (defaults to ["First", "Second"]) */
  inputLabels?: [string, string]
  /** For two-numbers: whether order matters (default: true). Set to false if either order is acceptable. */
  orderMatters?: boolean
  /** Optional state update when checkpoint is passed */
  stateUpdate?: Record<string, string>
  /** Optional tolerance for numeric comparisons (for decimals) */
  tolerance?: number
  /** Optional: transform the working problem when this checkpoint is passed */
  workingProblemUpdate?: WorkingProblemStep
  /** Optional: skip this checkpoint entirely if expression is true */
  skipIf?: string
  /** Node to skip to if skipIf evaluates to true */
  skipTo?: string
  /**
   * If true, the skipIf condition won't create a branching path for grid dimensions.
   * Use for optional steps that don't represent different problem types.
   * Default: false (skipIf creates a branch for path enumeration)
   */
  excludeSkipFromPaths?: boolean
}

/**
 * Milestone node - intermediate success marker, auto-advances
 */
export interface MilestoneNode extends BaseNode {
  type: 'milestone'
  /** Required: next node to advance to */
  next: string
}

/**
 * Embellishment node - decorative emoji/celebration moment
 * Shows an animated emoji within the content card, then auto-advances.
 * Used for encouraging moments like 👍, 😎, 💪 between substantive steps.
 */
export interface EmbellishmentNode extends BaseNode {
  type: 'embellishment'
  /** Required: next node to advance to */
  next: string
}

/**
 * Terminal node - end state
 */
export interface TerminalNode extends BaseNode {
  type: 'terminal'
  /** Show celebration animation */
  celebration?: boolean
}

export type FlowchartNode =
  | InstructionNode
  | DecisionNode
  | CheckpointNode
  | MilestoneNode
  | EmbellishmentNode
  | TerminalNode

// =============================================================================
// Generation Configuration
// =============================================================================

/**
 * Preferred values for a field during generation.
 * Can be an array of specific values or a range configuration.
 */
export type PreferredValues =
  | number[]
  | string[]
  | {
      range: [number, number]
      step?: number
    }

/**
 * Configuration for constraint-guided example generation.
 * This allows the flowchart to express how to generate pedagogically
 * appropriate problems without schema-specific code in the engine.
 */
export interface GenerationConfig {
  /**
   * The "target" field - typically the answer we're solving for.
   * Generated first with nice values, then other fields are derived/generated.
   * Should reference a variable name from the variables section.
   */
  target?: string

  /**
   * Fields that are computed from other fields rather than generated randomly.
   * Maps field name to expression that computes it.
   * Example: { "equals": "coefficient * answer + constant" }
   */
  derived?: Record<string, string>

  /**
   * Preferred values for fields - pedagogically nice numbers.
   * The engine will bias generation toward these values.
   */
  preferred?: Record<string, PreferredValues>
}

/**
 * Teacher/flowchart-defined constraints that generated problems must satisfy.
 * Each constraint is an expression that must evaluate to true.
 */
export type GenerationConstraints = Record<string, string>

/**
 * Configuration for how to display the problem.
 */
export interface DisplayConfig {
  /**
   * Expression that evaluates to the problem display string.
   * Example: "coefficient + 'x ' + operation + ' ' + constant + ' = ' + equals"
   */
  problem?: string

  /**
   * Expression that evaluates to the answer display string.
   * Example: "'x = ' + answer" or "answer" or complex fraction formatting
   */
  answer?: string
}

// =============================================================================
// Flowchart Definition
// =============================================================================

/**
 * @deprecated Use transform on nodes instead
 * Variable definition with initialization expression (legacy)
 */
export interface VariableDefinition {
  /** Expression to evaluate at start to initialize this variable */
  init: string
}

/**
 * Complete flowchart definition (.flow.json)
 */
export interface FlowchartDefinition {
  /** Unique identifier for this flowchart */
  id: string
  /** Human-readable title */
  title: string
  /** Path to the companion .mmd file */
  mermaidFile: string
  /** Problem input configuration */
  problemInput: ProblemInputSchema
  /**
   * @deprecated Use transform on nodes instead.
   * Variables computed at start - being replaced by node transforms.
   */
  variables?: Record<string, VariableDefinition>
  /** First node to display */
  entryNode: string
  /** Node definitions keyed by node ID */
  nodes: Record<string, FlowchartNode>
  /**
   * Fallback edge definitions (used when node doesn't specify next)
   * Maps node ID to array of possible next nodes
   */
  edges?: Record<string, string[]>
  /**
   * Optional: Configuration for the working problem feature.
   * When defined, displays an evolving problem representation as the user progresses.
   */
  workingProblem?: WorkingProblemConfig

  /**
   * Optional: Configuration for constraint-guided example generation.
   * Defines how to generate pedagogically appropriate problems.
   */
  generation?: GenerationConfig

  /**
   * Optional: Constraints that generated problems must satisfy.
   * Each key is a constraint name, value is an expression that must be true.
   * Example: { "positiveAnswer": "answer > 0", "integerAnswer": "floor(answer) == answer" }
   */
  constraints?: GenerationConstraints

  /**
   * Optional: Configuration for how to display the problem (legacy).
   * Being replaced by answer.display.
   */
  display?: DisplayConfig

  /**
   * Defines how to extract the final answer from terminal state.
   * Required for new-format flowcharts using transforms.
   */
  answer?: AnswerDefinition

  /**
   * Structured test cases for validating flowchart correctness.
   * Uses primitive expected values instead of string matching.
   */
  tests?: StructuredTestCase[]
}

// =============================================================================
// Runtime State
// =============================================================================

/** Structured mixed number value */
export interface MixedNumberValue {
  whole: number
  num: number
  denom: number
}

/** Problem input values (from user form) */
export type ProblemValue = number | string | boolean | MixedNumberValue

/** History entry for tracking user actions */
export interface HistoryEntry {
  node: string
  action: 'advance' | 'decision' | 'checkpoint' | 'skip'
  timestamp: number
  userInput?: ProblemValue
  correct?: boolean
}

/** A recorded step in the working problem evolution */
export interface WorkingProblemHistoryEntry {
  /** The working problem representation after this step */
  value: string
  /** Label describing what was done (e.g., "Add 9 to both sides") */
  label: string
  /** Node ID where this transformation occurred */
  nodeId: string
}

/**
 * Runtime state for a flowchart walkthrough
 */
export interface FlowchartState {
  /** Problem input values (immutable after start) */
  problem: Record<string, ProblemValue>
  /**
   * @deprecated Use values instead.
   * Computed values from variable init expressions (legacy).
   */
  computed: Record<string, ProblemValue>
  /**
   * Accumulated values from transforms (starts with problem input).
   * This is the new way - transforms add to this as nodes are visited.
   */
  values: Record<string, ProblemValue>
  /** User-entered values during walkthrough */
  userState: Record<string, ProblemValue>
  /** Current node ID */
  currentNode: string
  /** History of actions taken */
  history: HistoryEntry[]
  /** Session start time */
  startTime: number
  /** Number of wrong answers */
  mistakes: number
  /** Current working problem display string (evolves through walkthrough) */
  workingProblem?: string
  /** History of working problem transformations */
  workingProblemHistory: WorkingProblemHistoryEntry[]
  /**
   * Snapshots of state at each node visited (for trace visualization).
   * Each entry represents the state after visiting that node.
   */
  snapshots: StateSnapshot[]
  /**
   * Whether any transform errors occurred during the walk.
   * Errors are logged but don't stop the walk - values are set to null.
   */
  hasError: boolean
}

// =============================================================================
// Parsed Mermaid Content
// =============================================================================

/** Parsed content from a Mermaid node label */
export interface ParsedNodeContent {
  /** Title text (from first <b>...</b>) */
  title: string
  /** Main body lines */
  body: string[]
  /** Example text (lines with emoji or <i>) */
  example?: string
  /** Warning text (lines with warning emoji) */
  warning?: string
  /** Checklist items (lines starting with checkbox) */
  checklist?: string[]
  /** Raw content for fallback display */
  raw: string
}

/** Edge parsed from Mermaid file */
export interface ParsedEdge {
  from: string
  to: string
  label?: string
}

/** Parsed Mermaid flowchart structure */
export interface ParsedMermaid {
  /** Node ID to raw content mapping */
  nodes: Record<string, string>
  /** All edges in the flowchart */
  edges: ParsedEdge[]
  /** Subgraph (phase) definitions */
  phases: Array<{
    id: string
    title: string
    nodes: string[]
  }>
}

// =============================================================================
// Merged Flowchart (ready for execution)
// =============================================================================

/** Node ready for display with both definition and parsed content */
export interface ExecutableNode {
  id: string
  definition: FlowchartNode
  content: ParsedNodeContent
}

/** Complete flowchart ready for execution */
export interface ExecutableFlowchart {
  definition: FlowchartDefinition
  mermaid: ParsedMermaid
  /** Raw mermaid content string (for debug rendering) */
  rawMermaid: string
  nodes: Record<string, ExecutableNode>
}
