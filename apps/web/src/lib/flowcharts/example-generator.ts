/**
 * Flowchart Example Generator
 *
 * Constraint-guided generation system for creating diverse, pedagogically meaningful
 * example problems from flowcharts. Uses path analysis to ensure coverage of all
 * decision branches.
 *
 * @module flowcharts/example-generator
 */

import {
  constraintToFieldFilter,
  type FieldFilter,
  negateConstraint,
  type ParsedConstraint,
  parseConstraintExpression,
} from './constraint-parser'
import { type EvalContext, evaluate } from './evaluator'
import { calculatePathComplexity, type PathComplexity } from './loader'
import { analyzeFlowchart, type FlowchartPath } from './path-analysis'
import type {
  DecisionNode,
  ExecutableFlowchart,
  Field,
  FlowchartDefinition,
  ProblemValue,
} from './schema'

// =============================================================================
// Types
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
 * Diagnostic information about why example generation may have failed or struggled
 */
export interface GenerationDiagnostics {
  /** Whether generation.preferred config is present */
  hasPreferredConfig: boolean
  /** Number of paths enumerated */
  pathCount: number
  /** Number of paths that got at least one example */
  pathsWithExamples: number
  /** Total generation attempts made */
  totalAttempts: number
  /** Total successful examples generated */
  totalSuccesses: number
  /** Human-readable warnings/errors */
  warnings: string[]
}

/**
 * Result type for example generation with diagnostics
 */
export interface GenerationResult {
  examples: GeneratedExample[]
  diagnostics: GenerationDiagnostics
}

// Note: GenerationConstraints.positiveAnswersOnly is now validated via
// flowchart.constraints (e.g., "positiveAnswer": "answer > 0").
// Flowcharts must define their own constraints for this to work.

// =============================================================================
// Utility Functions
// =============================================================================

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

// =============================================================================
// Constraint Extraction
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

// =============================================================================
// Field Value Generation
// =============================================================================

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

  // For 'number' type fields (decimals), we can't enumerate all possible values,
  // so we rely on preferred values directly
  if (field.type === 'number') {
    if (preferred && preferred.length > 0) {
      // Apply filters to preferred values if any
      let validPreferred = preferred
      if (filters.length > 0) {
        validPreferred = applyFieldFilters(preferred, filters) as (number | string)[]
      }
      if (validPreferred.length > 0) {
        const shuffled = shuffle(validPreferred)
        return shuffled[0]
      }
    }
    // No preferred values for a 'number' field - cannot generate
    return null
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
      console.error(
        `Error computing derived field "${fieldName}" in flowchart "${flowchart.definition.title}" (${flowchart.definition.id}):`,
        `\n  Expression: ${expression}`,
        `\n  Available fields: ${Object.keys(result).join(', ')}`,
        `\n  Error:`,
        error
      )
    }
  }

  return result
}

// =============================================================================
// Constraint Validation
// =============================================================================

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
  for (const [varName, varDef] of Object.entries(flowchart.definition.variables || {})) {
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
  for (const [varName, varDef] of Object.entries(flowchart.definition.variables || {})) {
    try {
      context.computed[varName] = evaluate(varDef.init, context)
    } catch {
      return false // Can't evaluate variables = can't check constraints
    }
  }

  // Check each constraint
  for (const constraint of path.constraints) {
    try {
      const result = evaluate(constraint.expression, context)

      // If the constraint has an optionValue (from a decision node), check the constraint
      if (
        constraint.optionValue &&
        constraint.optionValue !== '__skip__' &&
        constraint.optionValue !== '__not_skipped__'
      ) {
        // Two cases for correctAnswer expressions:
        // 1. String-valued (e.g., "dominant" returns 'induced'/'parasitic')
        //    → Check if result equals the option value
        // 2. Boolean-valued (e.g., "needsBorrow" returns true/false)
        //    → Check if truthy result matches first option (requiredOutcome)
        if (typeof result === 'string') {
          // String comparison: result must equal option value
          if (result !== constraint.optionValue) {
            return false
          }
        } else {
          // Boolean comparison: truthy result = first option, falsy = other options
          if (Boolean(result) !== constraint.requiredOutcome) {
            return false
          }
        }
      } else {
        // For skipIf and other boolean expressions
        if (Boolean(result) !== constraint.requiredOutcome) {
          return false
        }
      }
    } catch {
      return false
    }
  }

  return true
}

// =============================================================================
// Path Descriptor Generation
// =============================================================================

/**
 * Generate path descriptor from pathLabel on decision options.
 * Decision nodes must have pathLabel defined on their options for meaningful descriptors.
 */
function generatePathDescriptorGeneric(flowchart: ExecutableFlowchart, path: string[]): string {
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

  // Return joined labels or a generic fallback
  // Flowcharts should define pathLabel on decision options for meaningful descriptors
  return labels.length > 0 ? labels.join(' ') : 'Default path'
}

/**
 * Get human-readable labels for a path (for diagnostic messages)
 */
function getPathLabels(flowchart: ExecutableFlowchart, path: FlowchartPath): string | null {
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
  return labels.length > 0 ? labels.join(' → ') : null
}

// =============================================================================
// Core Generation Functions
// =============================================================================

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
  targetPath: FlowchartPath
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

  // Note: positiveAnswersOnly is validated via flowchart.constraints (e.g., positiveAnswer, positiveResult)
  // which was already checked by validateFlowchartConstraints above.
  // Flowcharts that need positive answers must define the constraint themselves.

  return values
}

// =============================================================================
// Main Generation Functions
// =============================================================================

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
  const analysis = analyzeFlowchart(flowchart)

  // REQUIRED: Flowchart must have generation.preferred config
  // Without this, we cannot generate pedagogically selected examples
  if (!flowchart.definition.generation?.preferred) {
    console.warn(
      `Flowchart "${flowchart.definition.id}" is missing generation.preferred config. ` +
        'Example generation requires preferred values for each input field.'
    )
    return []
  }

  const pathGroups = new Map<string, GeneratedExample[]>()
  const seenPaths = new Set<string>()

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
      const values = generateForPath(flowchart, targetPath)

      if (!values) continue

      try {
        // Verify the generated problem actually takes the target path
        const complexity = calculatePathComplexity(flowchart, values)
        const actualSignature = complexity.path.join('→')
        const pathDescriptor = generatePathDescriptorGeneric(flowchart, complexity.path)

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

  // Phase 2: Generate additional variety for existing paths
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

      while (
        examples.length < targetExamplesPerPath &&
        consecutiveFailures < maxConsecutiveFailures
      ) {
        const values = generateForPath(flowchart, targetPath)

        if (!values) {
          consecutiveFailures++
          continue
        }

        try {
          const complexity = calculatePathComplexity(flowchart, values)
          if (complexity.path.join('→') === pathSignature) {
            const pathDescriptor = generatePathDescriptorGeneric(flowchart, complexity.path)
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

/**
 * Generate examples with diagnostic information about what happened.
 * Use this when you need to understand why generation failed or succeeded.
 */
export function generateDiverseExamplesWithDiagnostics(
  flowchart: ExecutableFlowchart,
  count: number = 6,
  constraints: GenerationConstraints = DEFAULT_CONSTRAINTS
): GenerationResult {
  const warnings: string[] = []
  let totalAttempts = 0
  let totalSuccesses = 0

  // Check for required config
  const hasPreferredConfig = Boolean(flowchart.definition.generation?.preferred)
  if (!hasPreferredConfig) {
    warnings.push(
      `Missing generation.preferred config. Add preferred values for each input field to enable example generation.`
    )
    return {
      examples: [],
      diagnostics: {
        hasPreferredConfig: false,
        pathCount: 0,
        pathsWithExamples: 0,
        totalAttempts: 0,
        totalSuccesses: 0,
        warnings,
      },
    }
  }

  // Check that 'number' type fields have preferred values (we can't enumerate decimals)
  const preferred = flowchart.definition.generation?.preferred || {}
  const numberFieldsWithoutPreferred = flowchart.definition.problemInput.fields
    .filter((f) => f.type === 'number' && !preferred[f.name])
    .map((f) => f.name)
  if (numberFieldsWithoutPreferred.length > 0) {
    warnings.push(
      `Fields with type "number" require preferred values but are missing: ${numberFieldsWithoutPreferred.join(', ')}. ` +
        `Add them to generation.preferred to enable example generation.`
    )
  }

  // Analyze flowchart structure
  let analysis
  try {
    analysis = analyzeFlowchart(flowchart)
  } catch (e) {
    warnings.push(
      `Failed to analyze flowchart structure: ${e instanceof Error ? e.message : 'Unknown error'}`
    )
    return {
      examples: [],
      diagnostics: {
        hasPreferredConfig,
        pathCount: 0,
        pathsWithExamples: 0,
        totalAttempts: 0,
        totalSuccesses: 0,
        warnings,
      },
    }
  }

  const pathCount = analysis.paths.length
  if (pathCount === 0) {
    warnings.push('No valid paths found in flowchart. Check that all paths reach a terminal node.')
  }

  const pathGroups = new Map<string, GeneratedExample[]>()

  // Generate examples with tracking
  const minExamplesPerPath = 5
  for (const targetPath of analysis.paths) {
    const targetSignature = targetPath.nodeIds.join('→')
    let targetHits = 0

    for (let attempt = 0; attempt < 300 && targetHits < minExamplesPerPath; attempt++) {
      totalAttempts++
      const values = generateForPath(flowchart, targetPath)

      if (!values) continue

      try {
        const complexity = calculatePathComplexity(flowchart, values)
        const actualSignature = complexity.path.join('→')
        const pathDescriptor = generatePathDescriptorGeneric(flowchart, complexity.path)

        const example: GeneratedExample = {
          values,
          complexity,
          pathSignature: actualSignature,
          pathDescriptor,
        }

        const existing = pathGroups.get(actualSignature) || []
        existing.push(example)
        pathGroups.set(actualSignature, existing)
        totalSuccesses++

        if (actualSignature === targetSignature) {
          targetHits++
        }
      } catch {
        // Skip problems that cause evaluation errors
      }
    }

    if (targetHits === 0) {
      // Get a descriptor for this path to make the warning more helpful
      const pathLabels = getPathLabels(flowchart, targetPath)
      warnings.push(`Could not generate examples for path: ${pathLabels || targetSignature}`)
    }
  }

  const pathsWithExamples = pathGroups.size

  // If we got no examples at all, add a summary warning
  if (pathsWithExamples === 0 && pathCount > 0) {
    warnings.push(
      `No valid examples could be generated after ${totalAttempts} attempts. ` +
        'This may indicate constraint conflicts or computation errors in the flowchart definition.'
    )
  }

  // Generate the final example list using the same algorithm as generateDiverseExamples
  const descriptorGroups = new Map<string, GeneratedExample[]>()
  for (const [, examples] of pathGroups) {
    for (const ex of examples) {
      const existing = descriptorGroups.get(ex.pathDescriptor) || []
      existing.push(ex)
      descriptorGroups.set(ex.pathDescriptor, existing)
    }
  }

  const results: GeneratedExample[] = []
  const sortedGroups = [...descriptorGroups.entries()].sort((a, b) => {
    const aComplexity = a[1][0].complexity.decisions + a[1][0].complexity.checkpoints
    const bComplexity = b[1][0].complexity.decisions + b[1][0].complexity.checkpoints
    if (aComplexity !== bComplexity) return aComplexity - bComplexity
    return a[1][0].complexity.pathLength - b[1][0].complexity.pathLength
  })

  for (const [, examples] of sortedGroups) {
    if (results.length >= count) break

    const seen = new Set<string>()
    const unique = examples.filter((ex) => {
      const key = JSON.stringify(ex.values)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

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

    const candidateCount = Math.max(1, Math.ceil(sorted.length / 2))
    const candidates = sorted.slice(0, candidateCount)
    const selected = candidates[Math.floor(Math.random() * candidates.length)]
    results.push(selected)
  }

  return {
    examples: results.slice(0, count),
    diagnostics: {
      hasPreferredConfig,
      pathCount,
      pathsWithExamples,
      totalAttempts,
      totalSuccesses,
      warnings,
    },
  }
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
  const analysis = analyzeFlowchart(flowchart)

  // REQUIRED: Flowchart must have generation.preferred config
  if (!flowchart.definition.generation?.preferred) {
    return []
  }

  const results: GeneratedExample[] = []

  // Process only the assigned paths
  const minExamplesPerPath = 5
  for (const pathIndex of pathIndices) {
    const targetPath = analysis.paths[pathIndex]
    if (!targetPath) continue

    const targetSignature = targetPath.nodeIds.join('→')
    let targetHits = 0

    for (let attempt = 0; attempt < 300 && targetHits < minExamplesPerPath; attempt++) {
      const values = generateForPath(flowchart, targetPath)

      if (!values) continue

      try {
        const complexity = calculatePathComplexity(flowchart, values)
        const actualSignature = complexity.path.join('→')
        const pathDescriptor = generatePathDescriptorGeneric(flowchart, complexity.path)

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

    // Generate additional variety for this path
    const targetExamplesPerPath = 10
    const pathExamples = results.filter((ex) => ex.pathSignature === targetSignature)
    if (pathExamples.length < targetExamplesPerPath) {
      const maxConsecutiveFailures = 100
      let consecutiveFailures = 0
      let currentCount = pathExamples.length

      while (currentCount < targetExamplesPerPath && consecutiveFailures < maxConsecutiveFailures) {
        const values = generateForPath(flowchart, targetPath)

        if (!values) {
          consecutiveFailures++
          continue
        }

        try {
          const complexity = calculatePathComplexity(flowchart, values)
          if (complexity.path.join('→') === targetSignature) {
            const pathDescriptor = generatePathDescriptorGeneric(flowchart, complexity.path)
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
