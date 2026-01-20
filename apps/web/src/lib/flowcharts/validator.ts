/**
 * Flowchart Validator
 *
 * Validates flowchart definitions before they can be published.
 * Checks:
 * - JSON structure matches expected schema
 * - All node references are valid
 * - Mermaid content parses correctly
 * - Node IDs in definition match mermaid
 * - Expressions are syntactically valid
 * - Can successfully load the flowchart
 *
 * @module flowcharts/validator
 */

import type { FlowchartDefinition, FlowchartNode, Field } from './schema'
import { parseMermaidFile } from './parser'
import { loadFlowchart } from './loader'

/**
 * Result of validating a flowchart
 */
export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
}

export interface ValidationError {
  code: string
  message: string
  path?: string
}

export interface ValidationWarning {
  code: string
  message: string
  path?: string
}

/**
 * Validate a flowchart definition and mermaid content.
 *
 * @param definition - The parsed JSON definition
 * @param mermaidContent - The mermaid content string
 * @returns Validation result with errors and warnings
 */
export async function validateFlowchart(
  definition: FlowchartDefinition,
  mermaidContent: string
): Promise<ValidationResult> {
  const errors: ValidationError[] = []
  const warnings: ValidationWarning[] = []

  // 1. Validate required top-level fields
  validateRequiredFields(definition, errors)

  // 2. Validate problem input schema
  validateProblemInput(definition, errors, warnings)

  // 3. Validate nodes
  validateNodes(definition, errors, warnings)

  // 4. Parse mermaid and validate structure
  await validateMermaid(definition, mermaidContent, errors, warnings)

  // 5. Try to load the flowchart (catches runtime issues)
  await validateCanLoad(definition, mermaidContent, errors)

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

/**
 * Validate required top-level fields exist
 */
function validateRequiredFields(definition: FlowchartDefinition, errors: ValidationError[]) {
  if (!definition.id) {
    errors.push({
      code: 'MISSING_ID',
      message: 'Flowchart definition must have an id',
      path: 'id',
    })
  }

  if (!definition.title) {
    errors.push({
      code: 'MISSING_TITLE',
      message: 'Flowchart definition must have a title',
      path: 'title',
    })
  }

  if (!definition.entryNode) {
    errors.push({
      code: 'MISSING_ENTRY_NODE',
      message: 'Flowchart definition must have an entryNode',
      path: 'entryNode',
    })
  }

  if (!definition.nodes || Object.keys(definition.nodes).length === 0) {
    errors.push({
      code: 'NO_NODES',
      message: 'Flowchart must have at least one node',
      path: 'nodes',
    })
  }

  if (!definition.problemInput) {
    errors.push({
      code: 'MISSING_PROBLEM_INPUT',
      message: 'Flowchart must have a problemInput schema',
      path: 'problemInput',
    })
  }
}

/**
 * Validate the problem input schema
 */
function validateProblemInput(
  definition: FlowchartDefinition,
  errors: ValidationError[],
  warnings: ValidationWarning[]
) {
  const { problemInput } = definition
  if (!problemInput) return

  if (!problemInput.fields || problemInput.fields.length === 0) {
    errors.push({
      code: 'NO_INPUT_FIELDS',
      message: 'Problem input must have at least one field',
      path: 'problemInput.fields',
    })
    return
  }

  const fieldNames = new Set<string>()

  for (const field of problemInput.fields) {
    // Check for duplicate names
    if (fieldNames.has(field.name)) {
      errors.push({
        code: 'DUPLICATE_FIELD',
        message: `Duplicate field name: ${field.name}`,
        path: `problemInput.fields.${field.name}`,
      })
    }
    fieldNames.add(field.name)

    // Validate field type
    validateField(field, errors, warnings)
  }
}

/**
 * Validate a single input field
 */
function validateField(field: Field, errors: ValidationError[], warnings: ValidationWarning[]) {
  const validTypes = ['integer', 'number', 'choice', 'mixed-number', 'dynamic']
  if (!validTypes.includes(field.type)) {
    errors.push({
      code: 'INVALID_FIELD_TYPE',
      message: `Invalid field type: ${field.type}`,
      path: `problemInput.fields.${field.name}.type`,
    })
  }

  if (field.type === 'choice') {
    if (!field.options || field.options.length === 0) {
      errors.push({
        code: 'CHOICE_NO_OPTIONS',
        message: `Choice field "${field.name}" must have options`,
        path: `problemInput.fields.${field.name}.options`,
      })
    }
  }

  if (field.type === 'dynamic') {
    if (!field.dependsOn) {
      errors.push({
        code: 'DYNAMIC_NO_DEPENDS_ON',
        message: `Dynamic field "${field.name}" must have dependsOn`,
        path: `problemInput.fields.${field.name}.dependsOn`,
      })
    }
    if (!field.variants || Object.keys(field.variants).length === 0) {
      errors.push({
        code: 'DYNAMIC_NO_VARIANTS',
        message: `Dynamic field "${field.name}" must have variants`,
        path: `problemInput.fields.${field.name}.variants`,
      })
    }
  }
}

/**
 * Validate all nodes in the definition
 */
function validateNodes(
  definition: FlowchartDefinition,
  errors: ValidationError[],
  warnings: ValidationWarning[]
) {
  const nodeIds = new Set(Object.keys(definition.nodes || {}))

  // Check entry node exists
  if (definition.entryNode && !nodeIds.has(definition.entryNode)) {
    errors.push({
      code: 'INVALID_ENTRY_NODE',
      message: `Entry node "${definition.entryNode}" not found in nodes`,
      path: 'entryNode',
    })
  }

  // Validate each node
  for (const [nodeId, node] of Object.entries(definition.nodes || {})) {
    validateNode(nodeId, node, nodeIds, errors, warnings)
  }
}

/**
 * Validate a single node
 */
function validateNode(
  nodeId: string,
  node: FlowchartNode,
  allNodeIds: Set<string>,
  errors: ValidationError[],
  warnings: ValidationWarning[]
) {
  const validTypes = [
    'instruction',
    'decision',
    'checkpoint',
    'milestone',
    'embellishment',
    'terminal',
  ]

  if (!validTypes.includes(node.type)) {
    errors.push({
      code: 'INVALID_NODE_TYPE',
      message: `Node "${nodeId}" has invalid type: ${node.type}`,
      path: `nodes.${nodeId}.type`,
    })
  }

  // Validate next reference if present
  if ('next' in node && node.next && !allNodeIds.has(node.next)) {
    errors.push({
      code: 'INVALID_NEXT_NODE',
      message: `Node "${nodeId}" references non-existent next node: ${node.next}`,
      path: `nodes.${nodeId}.next`,
    })
  }

  // Type-specific validation
  if (node.type === 'decision') {
    validateDecisionNode(nodeId, node, allNodeIds, errors, warnings)
  } else if (node.type === 'checkpoint') {
    validateCheckpointNode(nodeId, node, errors, warnings)
  } else if (node.type === 'milestone' || node.type === 'embellishment') {
    if (!node.next) {
      errors.push({
        code: 'MISSING_NEXT',
        message: `${node.type} node "${nodeId}" must have a next node`,
        path: `nodes.${nodeId}.next`,
      })
    }
  }
}

/**
 * Validate a decision node
 */
function validateDecisionNode(
  nodeId: string,
  node: FlowchartNode & { type: 'decision' },
  allNodeIds: Set<string>,
  errors: ValidationError[],
  warnings: ValidationWarning[]
) {
  if (!node.options || node.options.length === 0) {
    errors.push({
      code: 'DECISION_NO_OPTIONS',
      message: `Decision node "${nodeId}" must have options`,
      path: `nodes.${nodeId}.options`,
    })
    return
  }

  for (let i = 0; i < node.options.length; i++) {
    const option = node.options[i]
    if (!option.next) {
      errors.push({
        code: 'OPTION_NO_NEXT',
        message: `Option ${i} in node "${nodeId}" must have a next node`,
        path: `nodes.${nodeId}.options[${i}].next`,
      })
    } else if (!allNodeIds.has(option.next)) {
      errors.push({
        code: 'INVALID_OPTION_NEXT',
        message: `Option ${i} in node "${nodeId}" references non-existent node: ${option.next}`,
        path: `nodes.${nodeId}.options[${i}].next`,
      })
    }
  }

  // Validate skipTo if present
  if (node.skipIf && node.skipTo && !allNodeIds.has(node.skipTo)) {
    errors.push({
      code: 'INVALID_SKIP_TO',
      message: `Node "${nodeId}" has invalid skipTo: ${node.skipTo}`,
      path: `nodes.${nodeId}.skipTo`,
    })
  }
}

/**
 * Validate a checkpoint node
 */
function validateCheckpointNode(
  nodeId: string,
  node: FlowchartNode & { type: 'checkpoint' },
  errors: ValidationError[],
  warnings: ValidationWarning[]
) {
  if (!node.prompt) {
    warnings.push({
      code: 'CHECKPOINT_NO_PROMPT',
      message: `Checkpoint node "${nodeId}" has no prompt`,
      path: `nodes.${nodeId}.prompt`,
    })
  }

  if (!node.expected) {
    errors.push({
      code: 'CHECKPOINT_NO_EXPECTED',
      message: `Checkpoint node "${nodeId}" must have an expected value`,
      path: `nodes.${nodeId}.expected`,
    })
  }

  const validInputTypes = ['number', 'text', 'two-numbers']
  if (!validInputTypes.includes(node.inputType)) {
    errors.push({
      code: 'INVALID_INPUT_TYPE',
      message: `Checkpoint node "${nodeId}" has invalid inputType: ${node.inputType}`,
      path: `nodes.${nodeId}.inputType`,
    })
  }
}

/**
 * Validate mermaid content parses correctly and matches definition
 */
async function validateMermaid(
  definition: FlowchartDefinition,
  mermaidContent: string,
  errors: ValidationError[],
  warnings: ValidationWarning[]
) {
  if (!mermaidContent || mermaidContent.trim().length === 0) {
    errors.push({
      code: 'EMPTY_MERMAID',
      message: 'Mermaid content is empty',
    })
    return
  }

  try {
    const parsed = parseMermaidFile(mermaidContent)

    // Check that entry node exists in mermaid
    if (definition.entryNode && !parsed.nodes[definition.entryNode]) {
      errors.push({
        code: 'ENTRY_NODE_NOT_IN_MERMAID',
        message: `Entry node "${definition.entryNode}" not found in mermaid content`,
        path: 'entryNode',
      })
    }

    // Check that all definition nodes are in mermaid
    const mermaidNodeIds = new Set(Object.keys(parsed.nodes))
    const definitionNodeIds = Object.keys(definition.nodes || {})

    for (const nodeId of definitionNodeIds) {
      if (!mermaidNodeIds.has(nodeId)) {
        warnings.push({
          code: 'DEFINITION_NODE_NOT_IN_MERMAID',
          message: `Node "${nodeId}" in definition not found in mermaid content`,
          path: `nodes.${nodeId}`,
        })
      }
    }

    // Check for terminal nodes (should exist for completion)
    const hasTerminal = Object.values(definition.nodes || {}).some((n) => n.type === 'terminal')
    if (!hasTerminal) {
      warnings.push({
        code: 'NO_TERMINAL_NODE',
        message: 'Flowchart has no terminal node - users cannot complete it',
      })
    }
  } catch (error) {
    errors.push({
      code: 'MERMAID_PARSE_ERROR',
      message: `Failed to parse mermaid content: ${error instanceof Error ? error.message : 'Unknown error'}`,
    })
  }
}

/**
 * Try to load the flowchart to catch any runtime errors
 */
async function validateCanLoad(
  definition: FlowchartDefinition,
  mermaidContent: string,
  errors: ValidationError[]
) {
  try {
    await loadFlowchart(definition, mermaidContent)
  } catch (error) {
    errors.push({
      code: 'LOAD_FAILED',
      message: `Failed to load flowchart: ${error instanceof Error ? error.message : 'Unknown error'}`,
    })
  }
}

/**
 * Quick validation that only checks required structure without loading
 * Use this for faster feedback during workshop editing
 */
export function validateFlowchartStructure(definition: unknown): ValidationResult {
  const errors: ValidationError[] = []
  const warnings: ValidationWarning[] = []

  if (!definition || typeof definition !== 'object') {
    errors.push({
      code: 'INVALID_DEFINITION',
      message: 'Definition must be an object',
    })
    return { valid: false, errors, warnings }
  }

  const def = definition as Record<string, unknown>

  if (!def.id || typeof def.id !== 'string') {
    errors.push({
      code: 'MISSING_ID',
      message: 'Flowchart must have a string id',
      path: 'id',
    })
  }

  if (!def.title || typeof def.title !== 'string') {
    errors.push({
      code: 'MISSING_TITLE',
      message: 'Flowchart must have a string title',
      path: 'title',
    })
  }

  if (!def.entryNode || typeof def.entryNode !== 'string') {
    errors.push({
      code: 'MISSING_ENTRY_NODE',
      message: 'Flowchart must have a string entryNode',
      path: 'entryNode',
    })
  }

  if (!def.nodes || typeof def.nodes !== 'object') {
    errors.push({
      code: 'MISSING_NODES',
      message: 'Flowchart must have a nodes object',
      path: 'nodes',
    })
  }

  if (!def.problemInput || typeof def.problemInput !== 'object') {
    errors.push({
      code: 'MISSING_PROBLEM_INPUT',
      message: 'Flowchart must have a problemInput schema',
      path: 'problemInput',
    })
  }

  return { valid: errors.length === 0, errors, warnings }
}
