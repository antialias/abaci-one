/**
 * Constraint Parser
 *
 * Parses correctAnswer expressions from flowchart decision nodes into
 * structured constraints that can guide problem generation.
 *
 * Recognizes patterns like:
 * - "a == b" (equality)
 * - "a != b" (inequality)
 * - "a > b", "a >= b", "a < b", "a <= b" (comparison)
 * - "a % b == 0" (divisibility)
 * - "a == 0", "a != 0" (zero checks)
 * - Boolean expressions with && and ||
 */

// =============================================================================
// Types
// =============================================================================

export type ComparisonOp = '==' | '!=' | '>' | '>=' | '<' | '<='

/**
 * A parsed constraint representing a comparison between two operands.
 */
export interface ParsedConstraint {
  /** Type of constraint */
  type: 'comparison' | 'divisibility' | 'boolean'

  /** Left operand (field name or expression) */
  left: string

  /** Comparison operator */
  op: ComparisonOp

  /** Right operand (field name, literal, or expression) */
  right: string

  /**
   * Whether the right side is a literal value.
   * If true, we can directly constrain the left field.
   */
  rightIsLiteral: boolean

  /**
   * The literal value if rightIsLiteral is true.
   */
  literalValue?: number | string | boolean

  /**
   * For divisibility constraints (a % b == 0), the divisor field.
   */
  divisor?: string

  /**
   * The original expression string.
   */
  original: string
}

/**
 * Result of parsing a correctAnswer expression.
 */
export interface ParseResult {
  /** Successfully parsed constraints */
  constraints: ParsedConstraint[]

  /** Whether the expression was fully parsed */
  fullyParsed: boolean

  /** Original expression */
  original: string
}

// =============================================================================
// Parser
// =============================================================================

/**
 * Parse a correctAnswer expression into structured constraints.
 *
 * @param expression The correctAnswer expression string
 * @returns ParseResult with extracted constraints
 */
export function parseConstraintExpression(expression: string): ParseResult {
  const constraints: ParsedConstraint[] = []
  const original = expression.trim()

  // Handle simple boolean literals
  if (original === 'true' || original === 'false') {
    return {
      constraints: [{
        type: 'boolean',
        left: original,
        op: '==',
        right: 'true',
        rightIsLiteral: true,
        literalValue: original === 'true',
        original,
      }],
      fullyParsed: true,
      original,
    }
  }

  // Try to parse as a single comparison
  const singleConstraint = parseSingleComparison(original)
  if (singleConstraint) {
    constraints.push(singleConstraint)
    return { constraints, fullyParsed: true, original }
  }

  // Try to parse && expressions (all must be true)
  if (original.includes('&&')) {
    const parts = splitOnOperator(original, '&&')
    let allParsed = true

    for (const part of parts) {
      const constraint = parseSingleComparison(part.trim())
      if (constraint) {
        constraints.push(constraint)
      } else {
        allParsed = false
      }
    }

    return { constraints, fullyParsed: allParsed, original }
  }

  // Try to parse || expressions (any can be true)
  // For generation, we'll pick one branch to satisfy
  if (original.includes('||')) {
    const parts = splitOnOperator(original, '||')

    // For OR expressions, we parse all branches but mark as not fully parsed
    // since the generator needs to decide which branch to take
    for (const part of parts) {
      const constraint = parseSingleComparison(part.trim())
      if (constraint) {
        constraints.push(constraint)
      }
    }

    return { constraints, fullyParsed: false, original }
  }

  // Couldn't parse - return empty constraints
  return { constraints: [], fullyParsed: false, original }
}

/**
 * Parse a single comparison expression like "a == b" or "a != 0".
 */
function parseSingleComparison(expr: string): ParsedConstraint | null {
  const trimmed = expr.trim()

  // Remove outer parentheses if present
  const unwrapped = unwrapParens(trimmed)

  // Check for divisibility pattern: a % b == 0
  const divMatch = unwrapped.match(/^(.+?)\s*%\s*(.+?)\s*==\s*0$/)
  if (divMatch) {
    return {
      type: 'divisibility',
      left: divMatch[1].trim(),
      op: '==',
      right: '0',
      rightIsLiteral: true,
      literalValue: 0,
      divisor: divMatch[2].trim(),
      original: expr,
    }
  }

  // Check for comparison operators (order matters - check >= before >)
  const ops: ComparisonOp[] = ['==', '!=', '>=', '<=', '>', '<']

  for (const op of ops) {
    const parts = splitOnOperator(unwrapped, op)
    if (parts.length === 2) {
      const left = parts[0].trim()
      const right = parts[1].trim()

      // Check if right side is a literal
      const literalValue = parseLiteral(right)
      const rightIsLiteral = literalValue !== undefined

      return {
        type: 'comparison',
        left,
        op,
        right,
        rightIsLiteral,
        literalValue,
        original: expr,
      }
    }
  }

  return null
}

/**
 * Split an expression on an operator, respecting parentheses.
 */
function splitOnOperator(expr: string, operator: string): string[] {
  const result: string[] = []
  let current = ''
  let parenDepth = 0
  let i = 0

  while (i < expr.length) {
    const char = expr[i]

    if (char === '(') {
      parenDepth++
      current += char
      i++
    } else if (char === ')') {
      parenDepth--
      current += char
      i++
    } else if (parenDepth === 0 && expr.substring(i, i + operator.length) === operator) {
      result.push(current)
      current = ''
      i += operator.length
    } else {
      current += char
      i++
    }
  }

  if (current) {
    result.push(current)
  }

  return result
}

/**
 * Remove outer parentheses from an expression.
 */
function unwrapParens(expr: string): string {
  const trimmed = expr.trim()
  if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
    // Check if the parens actually wrap the whole expression
    let depth = 0
    for (let i = 0; i < trimmed.length - 1; i++) {
      if (trimmed[i] === '(') depth++
      if (trimmed[i] === ')') depth--
      if (depth === 0) return trimmed // Parens don't wrap whole thing
    }
    return unwrapParens(trimmed.slice(1, -1))
  }
  return trimmed
}

/**
 * Try to parse a string as a literal value.
 */
function parseLiteral(value: string): number | string | boolean | undefined {
  const trimmed = value.trim()

  // Boolean
  if (trimmed === 'true') return true
  if (trimmed === 'false') return false

  // Number
  const num = parseFloat(trimmed)
  if (!isNaN(num) && isFinite(num) && String(num) === trimmed) {
    return num
  }

  // Integer (handles cases like "0" that parseFloat would also handle)
  const int = parseInt(trimmed, 10)
  if (!isNaN(int) && String(int) === trimmed) {
    return int
  }

  // String literal (quoted)
  if ((trimmed.startsWith("'") && trimmed.endsWith("'")) ||
      (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
    return trimmed.slice(1, -1)
  }

  return undefined
}

// =============================================================================
// Constraint Analysis
// =============================================================================

/**
 * Extract field names referenced in a constraint.
 */
export function extractFieldsFromConstraint(constraint: ParsedConstraint): string[] {
  const fields: string[] = []

  // Add left side (could be a field or expression)
  const leftFields = extractFieldsFromExpression(constraint.left)
  fields.push(...leftFields)

  // Add right side if not a literal
  if (!constraint.rightIsLiteral) {
    const rightFields = extractFieldsFromExpression(constraint.right)
    fields.push(...rightFields)
  }

  // Add divisor if present
  if (constraint.divisor) {
    const divisorFields = extractFieldsFromExpression(constraint.divisor)
    fields.push(...divisorFields)
  }

  return [...new Set(fields)] // Deduplicate
}

/**
 * Extract field names from an expression string.
 * Recognizes patterns like: fieldName, obj.field, field1 + field2
 */
function extractFieldsFromExpression(expr: string): string[] {
  const fields: string[] = []

  // Match identifiers (including dot notation like left.denom)
  const identifierRegex = /[a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*/g
  const matches = expr.match(identifierRegex) || []

  for (const match of matches) {
    // Filter out keywords and function names
    const keywords = ['true', 'false', 'null', 'undefined', 'floor', 'ceil', 'abs', 'min', 'max', 'lcm', 'gcd']
    if (!keywords.includes(match)) {
      fields.push(match)
    }
  }

  return fields
}

/**
 * Negate a constraint (for when correctAnswer must be false).
 */
export function negateConstraint(constraint: ParsedConstraint): ParsedConstraint {
  const negatedOps: Record<ComparisonOp, ComparisonOp> = {
    '==': '!=',
    '!=': '==',
    '>': '<=',
    '>=': '<',
    '<': '>=',
    '<=': '>',
  }

  return {
    ...constraint,
    op: negatedOps[constraint.op],
    original: `!(${constraint.original})`,
  }
}

/**
 * Determine if a constraint can be directly used to filter field values.
 * Returns the field name and filter function if applicable.
 */
export interface FieldFilter {
  field: string
  filter: (value: number | string) => boolean
  description: string
}

export function constraintToFieldFilter(constraint: ParsedConstraint): FieldFilter | null {
  // Only handle simple cases where left is a single field and right is a literal
  if (!constraint.rightIsLiteral) return null
  if (constraint.literalValue === undefined) return null

  const field = constraint.left
  const literal = constraint.literalValue

  // Check if left is a simple field (no operators)
  if (field.includes('+') || field.includes('-') || field.includes('*') || field.includes('/')) {
    return null
  }

  switch (constraint.op) {
    case '==':
      return {
        field,
        filter: (v) => v === literal,
        description: `${field} must equal ${literal}`,
      }
    case '!=':
      return {
        field,
        filter: (v) => v !== literal,
        description: `${field} must not equal ${literal}`,
      }
    case '>':
      if (typeof literal === 'number') {
        return {
          field,
          filter: (v) => typeof v === 'number' && v > literal,
          description: `${field} must be greater than ${literal}`,
        }
      }
      break
    case '>=':
      if (typeof literal === 'number') {
        return {
          field,
          filter: (v) => typeof v === 'number' && v >= literal,
          description: `${field} must be at least ${literal}`,
        }
      }
      break
    case '<':
      if (typeof literal === 'number') {
        return {
          field,
          filter: (v) => typeof v === 'number' && v < literal,
          description: `${field} must be less than ${literal}`,
        }
      }
      break
    case '<=':
      if (typeof literal === 'number') {
        return {
          field,
          filter: (v) => typeof v === 'number' && v <= literal,
          description: `${field} must be at most ${literal}`,
        }
      }
      break
  }

  return null
}
