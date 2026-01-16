/**
 * Flowchart Walker Schema Types
 *
 * Defines the structure of .flow.json companion files that add
 * interactivity metadata to .mmd Mermaid flowcharts.
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
// Variables
// =============================================================================

/** Variable definition with initialization expression */
export interface VariableDefinition {
  /** Expression to evaluate at start to initialize this variable */
  init: string
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
  /** Optional state update when checkpoint is passed */
  stateUpdate?: Record<string, string>
  /** Optional tolerance for numeric comparisons (for decimals) */
  tolerance?: number
  /** Optional: transform the working problem when this checkpoint is passed */
  workingProblemUpdate?: WorkingProblemStep
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
}

// =============================================================================
// Flowchart Definition
// =============================================================================

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
  /** Variables computed at start and updated during walkthrough */
  variables: Record<string, VariableDefinition>
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
   * Optional: Configuration for how to display the problem.
   */
  display?: DisplayConfig
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
  /** Computed values from variable init expressions */
  computed: Record<string, ProblemValue>
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
  nodes: Record<string, ExecutableNode>
}
