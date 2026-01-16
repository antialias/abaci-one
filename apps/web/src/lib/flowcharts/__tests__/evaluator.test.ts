/**
 * Unit tests for the flowchart expression evaluator
 */

import { describe, it, expect } from 'vitest'
import {
  evaluate,
  evaluateBoolean,
  evaluateNumber,
  createEmptyContext,
  type EvalContext,
} from '../evaluator'

// =============================================================================
// Test Helpers
// =============================================================================

function makeContext(problem: Record<string, unknown> = {}): EvalContext {
  return {
    problem: problem as Record<string, number | string | boolean>,
    computed: {},
    userState: {},
  }
}

// =============================================================================
// Basic Literals
// =============================================================================

describe('evaluator - literals', () => {
  it('evaluates number literals', () => {
    expect(evaluate('42', createEmptyContext())).toBe(42)
    expect(evaluate('3.14', createEmptyContext())).toBe(3.14)
    expect(evaluate('0', createEmptyContext())).toBe(0)
  })

  it('evaluates negative numbers', () => {
    expect(evaluate('-5', createEmptyContext())).toBe(-5)
    expect(evaluate('-3.14', createEmptyContext())).toBe(-3.14)
  })

  it('evaluates boolean literals', () => {
    expect(evaluate('true', createEmptyContext())).toBe(true)
    expect(evaluate('false', createEmptyContext())).toBe(false)
  })

  it('evaluates string literals', () => {
    expect(evaluate('"hello"', createEmptyContext())).toBe('hello')
    expect(evaluate("'world'", createEmptyContext())).toBe('world')
  })

  it('evaluates null', () => {
    expect(evaluate('null', createEmptyContext())).toBe(null)
  })
})

// =============================================================================
// Arithmetic Operations
// =============================================================================

describe('evaluator - arithmetic', () => {
  it('evaluates addition', () => {
    expect(evaluate('2 + 3', createEmptyContext())).toBe(5)
    expect(evaluate('10 + 20 + 30', createEmptyContext())).toBe(60)
  })

  it('evaluates subtraction', () => {
    expect(evaluate('10 - 3', createEmptyContext())).toBe(7)
    expect(evaluate('100 - 50 - 25', createEmptyContext())).toBe(25)
  })

  it('evaluates multiplication', () => {
    expect(evaluate('4 * 5', createEmptyContext())).toBe(20)
    expect(evaluate('2 * 3 * 4', createEmptyContext())).toBe(24)
  })

  it('evaluates division', () => {
    expect(evaluate('20 / 4', createEmptyContext())).toBe(5)
    expect(evaluate('100 / 10 / 2', createEmptyContext())).toBe(5)
  })

  it('evaluates modulo', () => {
    expect(evaluate('17 % 5', createEmptyContext())).toBe(2)
    expect(evaluate('10 % 3', createEmptyContext())).toBe(1)
  })

  it('respects operator precedence', () => {
    expect(evaluate('2 + 3 * 4', createEmptyContext())).toBe(14)
    expect(evaluate('10 - 6 / 2', createEmptyContext())).toBe(7)
    expect(evaluate('2 * 3 + 4 * 5', createEmptyContext())).toBe(26)
  })

  it('handles parentheses', () => {
    expect(evaluate('(2 + 3) * 4', createEmptyContext())).toBe(20)
    expect(evaluate('10 / (2 + 3)', createEmptyContext())).toBe(2)
    expect(evaluate('((2 + 3) * (4 + 5))', createEmptyContext())).toBe(45)
  })
})

// =============================================================================
// Comparison Operations
// =============================================================================

describe('evaluator - comparisons', () => {
  it('evaluates less than', () => {
    expect(evaluate('3 < 5', createEmptyContext())).toBe(true)
    expect(evaluate('5 < 3', createEmptyContext())).toBe(false)
    expect(evaluate('5 < 5', createEmptyContext())).toBe(false)
  })

  it('evaluates greater than', () => {
    expect(evaluate('5 > 3', createEmptyContext())).toBe(true)
    expect(evaluate('3 > 5', createEmptyContext())).toBe(false)
    expect(evaluate('5 > 5', createEmptyContext())).toBe(false)
  })

  it('evaluates less than or equal', () => {
    expect(evaluate('3 <= 5', createEmptyContext())).toBe(true)
    expect(evaluate('5 <= 5', createEmptyContext())).toBe(true)
    expect(evaluate('6 <= 5', createEmptyContext())).toBe(false)
  })

  it('evaluates greater than or equal', () => {
    expect(evaluate('5 >= 3', createEmptyContext())).toBe(true)
    expect(evaluate('5 >= 5', createEmptyContext())).toBe(true)
    expect(evaluate('4 >= 5', createEmptyContext())).toBe(false)
  })

  it('evaluates equality', () => {
    expect(evaluate('5 == 5', createEmptyContext())).toBe(true)
    expect(evaluate('5 == 3', createEmptyContext())).toBe(false)
    expect(evaluate('"a" == "a"', createEmptyContext())).toBe(true)
  })

  it('evaluates inequality', () => {
    expect(evaluate('5 != 3', createEmptyContext())).toBe(true)
    expect(evaluate('5 != 5', createEmptyContext())).toBe(false)
  })
})

// =============================================================================
// Boolean Operations
// =============================================================================

describe('evaluator - boolean logic', () => {
  it('evaluates logical AND', () => {
    expect(evaluate('true && true', createEmptyContext())).toBe(true)
    expect(evaluate('true && false', createEmptyContext())).toBe(false)
    expect(evaluate('false && true', createEmptyContext())).toBe(false)
    expect(evaluate('false && false', createEmptyContext())).toBe(false)
  })

  it('evaluates logical OR', () => {
    expect(evaluate('true || true', createEmptyContext())).toBe(true)
    expect(evaluate('true || false', createEmptyContext())).toBe(true)
    expect(evaluate('false || true', createEmptyContext())).toBe(true)
    expect(evaluate('false || false', createEmptyContext())).toBe(false)
  })

  it('evaluates logical NOT', () => {
    expect(evaluate('!true', createEmptyContext())).toBe(false)
    expect(evaluate('!false', createEmptyContext())).toBe(true)
    expect(evaluate('!!true', createEmptyContext())).toBe(true)
  })

  it('handles complex boolean expressions', () => {
    expect(evaluate('(true && false) || true', createEmptyContext())).toBe(true)
    expect(evaluate('!(false || false)', createEmptyContext())).toBe(true)
    expect(evaluate('true && !false', createEmptyContext())).toBe(true)
  })
})

// =============================================================================
// Ternary Operator
// =============================================================================

describe('evaluator - ternary', () => {
  it('evaluates ternary with true condition', () => {
    expect(evaluate('true ? 1 : 2', createEmptyContext())).toBe(1)
    expect(evaluate('5 > 3 ? "yes" : "no"', createEmptyContext())).toBe('yes')
  })

  it('evaluates ternary with false condition', () => {
    expect(evaluate('false ? 1 : 2', createEmptyContext())).toBe(2)
    expect(evaluate('3 > 5 ? "yes" : "no"', createEmptyContext())).toBe('no')
  })

  it('handles nested ternary', () => {
    expect(evaluate('true ? (false ? 1 : 2) : 3', createEmptyContext())).toBe(2)
  })
})

// =============================================================================
// Variable Access
// =============================================================================

describe('evaluator - variables', () => {
  it('accesses problem variables', () => {
    const ctx = makeContext({ minuend: 52, subtrahend: 37 })
    expect(evaluate('minuend', ctx)).toBe(52)
    expect(evaluate('subtrahend', ctx)).toBe(37)
  })

  it('uses variables in expressions', () => {
    const ctx = makeContext({ a: 10, b: 3 })
    expect(evaluate('a + b', ctx)).toBe(13)
    expect(evaluate('a - b', ctx)).toBe(7)
    expect(evaluate('a * b', ctx)).toBe(30)
    expect(evaluate('a > b', ctx)).toBe(true)
  })

  it('accesses nested properties with dot notation', () => {
    const ctx = makeContext({
      left: { whole: 3, num: 1, denom: 4 },
    })
    expect(evaluate('left.whole', ctx)).toBe(3)
    expect(evaluate('left.num', ctx)).toBe(1)
    expect(evaluate('left.denom', ctx)).toBe(4)
  })

  it('accesses computed variables', () => {
    const ctx: EvalContext = {
      problem: {},
      computed: { lcd: 12, needsBorrow: true },
      userState: {},
    }
    expect(evaluate('lcd', ctx)).toBe(12)
    expect(evaluate('needsBorrow', ctx)).toBe(true)
  })

  it('accesses state variables with $ prefix', () => {
    const ctx: EvalContext = {
      problem: {},
      computed: { lcd: 12 },
      userState: { userAnswer: 15 },
    }
    expect(evaluate('$lcd', ctx)).toBe(12)
    expect(evaluate('$userAnswer', ctx)).toBe(15)
  })

  it('throws on unknown variables', () => {
    expect(() => evaluate('unknownVar', createEmptyContext())).toThrow('Unknown variable')
  })
})

// =============================================================================
// Built-in Functions
// =============================================================================

describe('evaluator - functions', () => {
  it('evaluates min()', () => {
    expect(evaluate('min(3, 5)', createEmptyContext())).toBe(3)
    expect(evaluate('min(10, 2)', createEmptyContext())).toBe(2)
    expect(evaluate('min(5, 5)', createEmptyContext())).toBe(5)
  })

  it('evaluates max()', () => {
    expect(evaluate('max(3, 5)', createEmptyContext())).toBe(5)
    expect(evaluate('max(10, 2)', createEmptyContext())).toBe(10)
  })

  it('evaluates abs()', () => {
    expect(evaluate('abs(-5)', createEmptyContext())).toBe(5)
    expect(evaluate('abs(5)', createEmptyContext())).toBe(5)
    expect(evaluate('abs(0)', createEmptyContext())).toBe(0)
  })

  it('evaluates floor()', () => {
    expect(evaluate('floor(3.7)', createEmptyContext())).toBe(3)
    expect(evaluate('floor(3.2)', createEmptyContext())).toBe(3)
    expect(evaluate('floor(-3.2)', createEmptyContext())).toBe(-4)
  })

  it('evaluates ceil()', () => {
    expect(evaluate('ceil(3.2)', createEmptyContext())).toBe(4)
    expect(evaluate('ceil(3.7)', createEmptyContext())).toBe(4)
    expect(evaluate('ceil(-3.7)', createEmptyContext())).toBe(-3)
  })

  it('evaluates gcd()', () => {
    expect(evaluate('gcd(12, 8)', createEmptyContext())).toBe(4)
    expect(evaluate('gcd(17, 13)', createEmptyContext())).toBe(1)
    expect(evaluate('gcd(100, 25)', createEmptyContext())).toBe(25)
  })

  it('evaluates lcm()', () => {
    expect(evaluate('lcm(4, 6)', createEmptyContext())).toBe(12)
    expect(evaluate('lcm(3, 5)', createEmptyContext())).toBe(15)
    expect(evaluate('lcm(12, 8)', createEmptyContext())).toBe(24)
  })

  it('evaluates mod()', () => {
    expect(evaluate('mod(17, 5)', createEmptyContext())).toBe(2)
    expect(evaluate('mod(10, 3)', createEmptyContext())).toBe(1)
  })

  it('handles functions with variable arguments', () => {
    const ctx = makeContext({ a: 4, b: 6 })
    expect(evaluate('lcm(a, b)', ctx)).toBe(12)
    expect(evaluate('min(a, b)', ctx)).toBe(4)
    expect(evaluate('max(a, b)', ctx)).toBe(6)
  })
})

// =============================================================================
// Helper Functions
// =============================================================================

describe('evaluator - helper functions', () => {
  it('evaluateBoolean returns boolean', () => {
    expect(evaluateBoolean('5 > 3', createEmptyContext())).toBe(true)
    expect(evaluateBoolean('3 > 5', createEmptyContext())).toBe(false)
    expect(evaluateBoolean('1', createEmptyContext())).toBe(true)
    expect(evaluateBoolean('0', createEmptyContext())).toBe(false)
  })

  it('evaluateNumber returns number', () => {
    expect(evaluateNumber('5 + 3', createEmptyContext())).toBe(8)
    expect(evaluateNumber('true', createEmptyContext())).toBe(1)
    expect(evaluateNumber('false', createEmptyContext())).toBe(0)
  })
})

// =============================================================================
// Real-World Flowchart Expressions
// =============================================================================

describe('evaluator - flowchart expressions', () => {
  it('evaluates subtraction regrouping expressions', () => {
    const ctx = makeContext({ minuend: 52, subtrahend: 37 })

    // topOnes = minuend % 10
    expect(evaluate('minuend % 10', ctx)).toBe(2)

    // bottomOnes = subtrahend % 10
    expect(evaluate('subtrahend % 10', ctx)).toBe(7)

    // topTens = floor(minuend / 10)
    expect(evaluate('floor(minuend / 10)', ctx)).toBe(5)

    // needsBorrow = topOnes < bottomOnes
    expect(evaluate('(minuend % 10) < (subtrahend % 10)', ctx)).toBe(true)

    // answer = minuend - subtrahend
    expect(evaluate('minuend - subtrahend', ctx)).toBe(15)
  })

  it('evaluates validation: minuend > subtrahend', () => {
    expect(evaluate('minuend > subtrahend', makeContext({ minuend: 52, subtrahend: 37 }))).toBe(
      true
    )
    expect(evaluate('minuend > subtrahend', makeContext({ minuend: 37, subtrahend: 52 }))).toBe(
      false
    )
    expect(evaluate('minuend > subtrahend', makeContext({ minuend: 50, subtrahend: 50 }))).toBe(
      false
    )
  })

  it('evaluates checkpoint expected values', () => {
    const ctx: EvalContext = {
      problem: { minuend: 52, subtrahend: 37 },
      computed: {
        topOnes: 2,
        bottomOnes: 7,
        topTens: 5,
        bottomTens: 3,
        needsBorrow: true,
      },
      userState: {},
    }

    // New tens digit after borrowing: topTens - 1
    expect(evaluate('topTens - 1', ctx)).toBe(4)

    // New ones digit after adding 10: topOnes + 10
    expect(evaluate('topOnes + 10', ctx)).toBe(12)

    // Ones digit of answer with borrowing
    expect(
      evaluate('needsBorrow ? (topOnes + 10 - bottomOnes) : (topOnes - bottomOnes)', ctx)
    ).toBe(5)

    // Tens digit of answer with borrowing
    expect(evaluate('needsBorrow ? (topTens - 1 - bottomTens) : (topTens - bottomTens)', ctx)).toBe(
      1
    )
  })

  it('evaluates fraction LCD expressions', () => {
    const ctx = makeContext({
      left: { whole: 3, num: 1, denom: 4 },
      right: { whole: 1, num: 2, denom: 3 },
    })

    // Check if denominators are equal
    expect(evaluate('left.denom == right.denom', ctx)).toBe(false)

    // Calculate LCD
    expect(evaluate('lcm(left.denom, right.denom)', ctx)).toBe(12)

    // Check if one denom divides the other
    expect(evaluate('left.denom % right.denom == 0 || right.denom % left.denom == 0', ctx)).toBe(
      false
    )
  })
})
