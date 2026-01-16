/**
 * Expression Evaluator for Flowchart Walker
 *
 * A simple, safe expression language for computing values in flowcharts.
 * Does NOT use JavaScript eval - uses a custom parser for security.
 *
 * Supported:
 * - Field access: left.denom, problem.minuend
 * - State variables: $lcd, $borrowed (prefix with $)
 * - Arithmetic: +, -, *, /, %
 * - Comparison: ==, !=, <, >, <=, >=
 * - Boolean: &&, ||, !
 * - Ternary: condition ? trueValue : falseValue
 * - Functions: lcm, gcd, min, max, abs, floor, ceil, mod
 * - Literals: numbers, strings, booleans (true/false), null
 */

import type { ProblemValue, MixedNumberValue } from './schema'

// =============================================================================
// Types
// =============================================================================

type TokenType =
  | 'NUMBER'
  | 'STRING'
  | 'IDENTIFIER'
  | 'STATE_VAR'
  | 'OPERATOR'
  | 'LPAREN'
  | 'RPAREN'
  | 'COMMA'
  | 'DOT'
  | 'QUESTION'
  | 'COLON'
  | 'EOF'

interface Token {
  type: TokenType
  value: string | number
  position: number
}

/** Context for expression evaluation */
export interface EvalContext {
  /** Problem input values (e.g., left, right, op) */
  problem: Record<string, ProblemValue>
  /** Computed variables (e.g., lcd, needsBorrow) */
  computed: Record<string, ProblemValue>
  /** User-entered state during walkthrough */
  userState: Record<string, ProblemValue>
  /** Special "input" value for checkpoint validation */
  input?: ProblemValue
}

// =============================================================================
// Tokenizer
// =============================================================================

const OPERATORS = ['&&', '||', '==', '!=', '<=', '>=', '<', '>', '+', '-', '*', '/', '%', '!']

function tokenize(expr: string): Token[] {
  const tokens: Token[] = []
  let pos = 0

  while (pos < expr.length) {
    // Skip whitespace
    if (/\s/.test(expr[pos])) {
      pos++
      continue
    }

    // State variable ($varName)
    if (expr[pos] === '$') {
      const start = pos
      pos++ // skip $
      let name = ''
      while (pos < expr.length && /[a-zA-Z0-9_]/.test(expr[pos])) {
        name += expr[pos]
        pos++
      }
      tokens.push({ type: 'STATE_VAR', value: name, position: start })
      continue
    }

    // Number
    if (/[0-9]/.test(expr[pos]) || (expr[pos] === '-' && /[0-9]/.test(expr[pos + 1]))) {
      const start = pos
      let numStr = ''
      if (expr[pos] === '-') {
        // Check if this is a negative number or subtraction
        // It's a negative number if: start of expression, after operator, after ( or ,
        const lastToken = tokens[tokens.length - 1]
        if (
          lastToken &&
          lastToken.type !== 'OPERATOR' &&
          lastToken.type !== 'LPAREN' &&
          lastToken.type !== 'COMMA'
        ) {
          // It's subtraction, not negative number
          tokens.push({ type: 'OPERATOR', value: '-', position: pos })
          pos++
          continue
        }
        numStr += expr[pos]
        pos++
      }
      while (pos < expr.length && /[0-9.]/.test(expr[pos])) {
        numStr += expr[pos]
        pos++
      }
      tokens.push({ type: 'NUMBER', value: parseFloat(numStr), position: start })
      continue
    }

    // String literal
    if (expr[pos] === '"' || expr[pos] === "'") {
      const quote = expr[pos]
      const start = pos
      pos++ // skip opening quote
      let str = ''
      while (pos < expr.length && expr[pos] !== quote) {
        str += expr[pos]
        pos++
      }
      pos++ // skip closing quote
      tokens.push({ type: 'STRING', value: str, position: start })
      continue
    }

    // Multi-character operators (must check before single-char)
    let foundOp = false
    for (const op of OPERATORS) {
      if (expr.slice(pos, pos + op.length) === op) {
        tokens.push({ type: 'OPERATOR', value: op, position: pos })
        pos += op.length
        foundOp = true
        break
      }
    }
    if (foundOp) continue

    // Single character tokens
    if (expr[pos] === '(') {
      tokens.push({ type: 'LPAREN', value: '(', position: pos })
      pos++
      continue
    }
    if (expr[pos] === ')') {
      tokens.push({ type: 'RPAREN', value: ')', position: pos })
      pos++
      continue
    }
    if (expr[pos] === ',') {
      tokens.push({ type: 'COMMA', value: ',', position: pos })
      pos++
      continue
    }
    if (expr[pos] === '.') {
      tokens.push({ type: 'DOT', value: '.', position: pos })
      pos++
      continue
    }
    if (expr[pos] === '?') {
      tokens.push({ type: 'QUESTION', value: '?', position: pos })
      pos++
      continue
    }
    if (expr[pos] === ':') {
      tokens.push({ type: 'COLON', value: ':', position: pos })
      pos++
      continue
    }

    // Identifier (variable name, function name, true/false/null)
    if (/[a-zA-Z_]/.test(expr[pos])) {
      const start = pos
      let name = ''
      while (pos < expr.length && /[a-zA-Z0-9_]/.test(expr[pos])) {
        name += expr[pos]
        pos++
      }
      tokens.push({ type: 'IDENTIFIER', value: name, position: start })
      continue
    }

    throw new Error(`Unexpected character '${expr[pos]}' at position ${pos}`)
  }

  tokens.push({ type: 'EOF', value: '', position: pos })
  return tokens
}

// =============================================================================
// Parser
// =============================================================================

class Parser {
  private tokens: Token[]
  private pos = 0
  private context: EvalContext

  constructor(tokens: Token[], context: EvalContext) {
    this.tokens = tokens
    this.context = context
  }

  private current(): Token {
    return this.tokens[this.pos]
  }

  private advance(): Token {
    const token = this.current()
    this.pos++
    return token
  }

  private expect(type: TokenType): Token {
    const token = this.current()
    if (token.type !== type) {
      throw new Error(`Expected ${type} but got ${token.type} at position ${token.position}`)
    }
    return this.advance()
  }

  parse(): ProblemValue {
    const result = this.parseExpression()
    if (this.current().type !== 'EOF') {
      throw new Error(
        `Unexpected token ${this.current().type} at position ${this.current().position}`
      )
    }
    return result
  }

  // Expression = Ternary
  private parseExpression(): ProblemValue {
    return this.parseTernary()
  }

  // Ternary = Or ('?' Expression ':' Expression)?
  private parseTernary(): ProblemValue {
    const condition = this.parseOr()

    if (this.current().type === 'QUESTION') {
      this.advance() // skip ?
      const trueValue = this.parseExpression()
      this.expect('COLON')
      const falseValue = this.parseExpression()
      return condition ? trueValue : falseValue
    }

    return condition
  }

  // Or = And ('||' And)*
  private parseOr(): ProblemValue {
    let left = this.parseAnd()

    while (this.current().type === 'OPERATOR' && this.current().value === '||') {
      this.advance()
      const right = this.parseAnd()
      left = Boolean(left) || Boolean(right)
    }

    return left
  }

  // And = Equality ('&&' Equality)*
  private parseAnd(): ProblemValue {
    let left = this.parseEquality()

    while (this.current().type === 'OPERATOR' && this.current().value === '&&') {
      this.advance()
      const right = this.parseEquality()
      left = Boolean(left) && Boolean(right)
    }

    return left
  }

  // Equality = Comparison (('==' | '!=') Comparison)*
  private parseEquality(): ProblemValue {
    let left = this.parseComparison()

    while (
      this.current().type === 'OPERATOR' &&
      (this.current().value === '==' || this.current().value === '!=')
    ) {
      const op = this.advance().value
      const right = this.parseComparison()
      left = op === '==' ? left === right : left !== right
    }

    return left
  }

  // Comparison = Addition (('<' | '>' | '<=' | '>=') Addition)*
  private parseComparison(): ProblemValue {
    let left = this.parseAddition()

    while (
      this.current().type === 'OPERATOR' &&
      ['<', '>', '<=', '>='].includes(this.current().value as string)
    ) {
      const op = this.advance().value as string
      const right = this.parseAddition()
      const l = Number(left)
      const r = Number(right)
      switch (op) {
        case '<':
          left = l < r
          break
        case '>':
          left = l > r
          break
        case '<=':
          left = l <= r
          break
        case '>=':
          left = l >= r
          break
      }
    }

    return left
  }

  // Addition = Multiplication (('+' | '-') Multiplication)*
  private parseAddition(): ProblemValue {
    let left = this.parseMultiplication()

    while (
      this.current().type === 'OPERATOR' &&
      (this.current().value === '+' || this.current().value === '-')
    ) {
      const op = this.advance().value
      const right = this.parseMultiplication()
      if (op === '+') {
        // Support string concatenation: if either operand is a string, concatenate
        if (typeof left === 'string' || typeof right === 'string') {
          left = String(left) + String(right)
        } else {
          left = Number(left) + Number(right)
        }
      } else {
        left = Number(left) - Number(right)
      }
    }

    return left
  }

  // Multiplication = Unary (('*' | '/' | '%') Unary)*
  private parseMultiplication(): ProblemValue {
    let left = this.parseUnary()

    while (
      this.current().type === 'OPERATOR' &&
      (this.current().value === '*' || this.current().value === '/' || this.current().value === '%')
    ) {
      const op = this.advance().value
      const right = this.parseUnary()
      if (op === '*') {
        left = Number(left) * Number(right)
      } else if (op === '/') {
        left = Number(left) / Number(right)
      } else {
        left = Number(left) % Number(right)
      }
    }

    return left
  }

  // Unary = '!' Unary | '-' Unary | Primary
  private parseUnary(): ProblemValue {
    if (this.current().type === 'OPERATOR' && this.current().value === '!') {
      this.advance()
      return !this.parseUnary()
    }
    if (this.current().type === 'OPERATOR' && this.current().value === '-') {
      this.advance()
      return -Number(this.parseUnary())
    }
    return this.parsePrimary()
  }

  // Primary = NUMBER | STRING | IDENTIFIER | STATE_VAR | '(' Expression ')' | FunctionCall
  private parsePrimary(): ProblemValue {
    const token = this.current()

    // Number literal
    if (token.type === 'NUMBER') {
      this.advance()
      return token.value as number
    }

    // String literal
    if (token.type === 'STRING') {
      this.advance()
      return token.value as string
    }

    // State variable ($varName)
    if (token.type === 'STATE_VAR') {
      this.advance()
      const name = token.value as string
      // Check userState first, then computed
      if (name in this.context.userState) {
        return this.context.userState[name]
      }
      if (name in this.context.computed) {
        return this.context.computed[name]
      }
      throw new Error(`Unknown state variable: $${name}`)
    }

    // Parenthesized expression
    if (token.type === 'LPAREN') {
      this.advance()
      const value = this.parseExpression()
      this.expect('RPAREN')
      return value
    }

    // Identifier: could be keyword, function call, or variable access
    if (token.type === 'IDENTIFIER') {
      const name = token.value as string
      this.advance()

      // Keywords
      if (name === 'true') return true
      if (name === 'false') return false
      if (name === 'null') return null as unknown as ProblemValue

      // Special "input" variable for checkpoint validation
      if (name === 'input') {
        if (this.context.input === undefined) {
          throw new Error('input is not available in this context')
        }
        return this.context.input
      }

      // Function call
      if (this.current().type === 'LPAREN') {
        return this.parseFunctionCall(name)
      }

      // Variable access (possibly with dot notation)
      return this.parseVariableAccess(name)
    }

    throw new Error(`Unexpected token ${token.type} at position ${token.position}`)
  }

  private parseFunctionCall(name: string): ProblemValue {
    this.expect('LPAREN')
    const args: ProblemValue[] = []

    if (this.current().type !== 'RPAREN') {
      args.push(this.parseExpression())
      while (this.current().type === 'COMMA') {
        this.advance()
        args.push(this.parseExpression())
      }
    }

    this.expect('RPAREN')

    return this.callFunction(name, args)
  }

  private callFunction(name: string, args: ProblemValue[]): ProblemValue {
    switch (name) {
      case 'lcm': {
        if (args.length !== 2) throw new Error('lcm requires 2 arguments')
        return lcm(Number(args[0]), Number(args[1]))
      }
      case 'gcd': {
        if (args.length !== 2) throw new Error('gcd requires 2 arguments')
        return gcd(Number(args[0]), Number(args[1]))
      }
      case 'min': {
        if (args.length < 2) throw new Error('min requires at least 2 arguments')
        return Math.min(...args.map(Number))
      }
      case 'max': {
        if (args.length < 2) throw new Error('max requires at least 2 arguments')
        return Math.max(...args.map(Number))
      }
      case 'abs': {
        if (args.length !== 1) throw new Error('abs requires 1 argument')
        return Math.abs(Number(args[0]))
      }
      case 'floor': {
        if (args.length !== 1) throw new Error('floor requires 1 argument')
        return Math.floor(Number(args[0]))
      }
      case 'ceil': {
        if (args.length !== 1) throw new Error('ceil requires 1 argument')
        return Math.ceil(Number(args[0]))
      }
      case 'mod': {
        if (args.length !== 2) throw new Error('mod requires 2 arguments')
        return Number(args[0]) % Number(args[1])
      }
      default:
        throw new Error(`Unknown function: ${name}`)
    }
  }

  private parseVariableAccess(name: string): ProblemValue {
    // Start with the base variable from problem context
    let value: ProblemValue

    if (name in this.context.problem) {
      value = this.context.problem[name]
    } else if (name in this.context.computed) {
      value = this.context.computed[name]
    } else if (name in this.context.userState) {
      value = this.context.userState[name]
    } else {
      throw new Error(`Unknown variable: ${name}`)
    }

    // Handle dot notation for nested access (e.g., left.denom)
    while (this.current().type === 'DOT') {
      this.advance()
      const prop = this.expect('IDENTIFIER').value as string

      if (value === null || value === undefined) {
        throw new Error(`Cannot access property '${prop}' of ${value}`)
      }

      if (typeof value === 'object' && value !== null && prop in value) {
        // Access property from the object - could be a MixedNumberValue or other nested structure
        value = (value as unknown as Record<string, ProblemValue>)[prop]
      } else {
        throw new Error(`Property '${prop}' does not exist on value`)
      }
    }

    return value
  }
}

// =============================================================================
// Math Helpers
// =============================================================================

function gcd(a: number, b: number): number {
  a = Math.abs(Math.floor(a))
  b = Math.abs(Math.floor(b))
  while (b !== 0) {
    const t = b
    b = a % b
    a = t
  }
  return a
}

function lcm(a: number, b: number): number {
  return Math.abs(a * b) / gcd(a, b)
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Evaluate an expression string in the given context
 */
export function evaluate(expr: string, context: EvalContext): ProblemValue {
  const tokens = tokenize(expr)
  const parser = new Parser(tokens, context)
  return parser.parse()
}

/**
 * Create an empty evaluation context
 */
export function createEmptyContext(): EvalContext {
  return {
    problem: {},
    computed: {},
    userState: {},
  }
}

/**
 * Evaluate a boolean expression (returns true/false)
 */
export function evaluateBoolean(expr: string, context: EvalContext): boolean {
  return Boolean(evaluate(expr, context))
}

/**
 * Evaluate a numeric expression (returns number)
 */
export function evaluateNumber(expr: string, context: EvalContext): number {
  return Number(evaluate(expr, context))
}

/**
 * Check if two values are approximately equal (for decimal tolerance)
 */
export function approximatelyEqual(a: number, b: number, tolerance: number): boolean {
  return Math.abs(a - b) <= tolerance
}

/**
 * Get the numeric value from a mixed number
 */
export function mixedNumberToDecimal(mn: MixedNumberValue): number {
  return mn.whole + mn.num / mn.denom
}

/**
 * Get the fractional value (num/denom) from a mixed number
 */
export function mixedNumberFraction(mn: MixedNumberValue): number {
  return mn.num / mn.denom
}
