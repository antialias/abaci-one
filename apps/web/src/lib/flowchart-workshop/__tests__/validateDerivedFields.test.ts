/**
 * Unit tests for validateDerivedFields function
 */

import { describe, it, expect } from 'vitest'
import { validateDerivedFields } from '../llm-schemas'
import type { FlowchartDefinition } from '../../flowcharts/schema'

// =============================================================================
// Test Helpers
// =============================================================================

function makeDefinition(
  fields: Array<{ name: string; type: 'integer' }>,
  variables: Record<string, { init: string }>,
  derived?: Record<string, string>
): FlowchartDefinition {
  return {
    id: 'test-flowchart',
    title: 'Test Flowchart',
    mermaidFile: 'test.mmd',
    problemInput: {
      schema: 'two-digit-subtraction',
      fields: fields.map((f) => ({ ...f, min: 0, max: 100 })),
    },
    variables,
    nodes: {
      START: { type: 'terminal' },
    },
    entryNode: 'START',
    generation: derived ? { derived } : undefined,
  }
}

// =============================================================================
// Valid Cases
// =============================================================================

describe('validateDerivedFields - valid cases', () => {
  it('returns no errors when there are no derived fields', () => {
    const definition = makeDefinition(
      [
        { name: 'top', type: 'integer' },
        { name: 'bottom', type: 'integer' },
      ],
      { answer: { init: 'top - bottom' } },
      undefined
    )

    const errors = validateDerivedFields(definition)
    expect(errors).toHaveLength(0)
  })

  it('returns no errors when derived fields only reference input fields', () => {
    const definition = makeDefinition(
      [
        { name: 'top', type: 'integer' },
        { name: 'bottom', type: 'integer' },
      ],
      { answer: { init: 'top - bottom' } },
      { difference: 'top - bottom' }
    )

    const errors = validateDerivedFields(definition)
    expect(errors).toHaveLength(0)
  })

  it('allows derived fields to reference other derived fields defined earlier', () => {
    const definition = makeDefinition(
      [
        { name: 'a', type: 'integer' },
        { name: 'b', type: 'integer' },
      ],
      { result: { init: 'a + b' } },
      {
        sum: 'a + b',
        doubled: 'sum * 2', // references the derived field 'sum'
      }
    )

    const errors = validateDerivedFields(definition)
    expect(errors).toHaveLength(0)
  })

  it('allows built-in functions in derived expressions', () => {
    const definition = makeDefinition(
      [
        { name: 'denom_a', type: 'integer' },
        { name: 'denom_b', type: 'integer' },
      ],
      { lcd: { init: 'lcm(denom_a, denom_b)' } },
      { lcd: 'lcm(denom_a, denom_b)' }
    )

    const errors = validateDerivedFields(definition)
    expect(errors).toHaveLength(0)
  })

  it('allows math functions like abs, floor, ceil, min, max, gcd', () => {
    const definition = makeDefinition(
      [
        { name: 'x', type: 'integer' },
        { name: 'y', type: 'integer' },
      ],
      {},
      {
        absX: 'abs(x)',
        floorY: 'floor(y)',
        minXY: 'min(x, y)',
        maxXY: 'max(x, y)',
        gcdXY: 'gcd(x, y)',
      }
    )

    const errors = validateDerivedFields(definition)
    expect(errors).toHaveLength(0)
  })
})

// =============================================================================
// Invalid Cases - Referencing Variables
// =============================================================================

describe('validateDerivedFields - invalid variable references', () => {
  it('detects when derived field references a computed variable', () => {
    const definition = makeDefinition(
      [
        { name: 'top', type: 'integer' },
        { name: 'bottom', type: 'integer' },
      ],
      { answer: { init: 'top - bottom' } },
      { answer: 'answer' } // ERROR: references computed variable 'answer'
    )

    const errors = validateDerivedFields(definition)
    expect(errors).toHaveLength(1)
    expect(errors[0].fieldName).toBe('answer')
    expect(errors[0].invalidReference).toBe('answer')
    expect(errors[0].message).toContain('computed variable')
  })

  it('detects when derived field uses computed variable in expression', () => {
    const definition = makeDefinition(
      [
        { name: 'top', type: 'integer' },
        { name: 'bottom', type: 'integer' },
      ],
      { needsBorrow: { init: 'top < bottom' } },
      { result: 'needsBorrow ? 1 : 0' } // ERROR: references computed variable 'needsBorrow'
    )

    const errors = validateDerivedFields(definition)
    expect(errors).toHaveLength(1)
    expect(errors[0].fieldName).toBe('result')
    expect(errors[0].invalidReference).toBe('needsBorrow')
  })

  it('detects multiple invalid references in one expression', () => {
    const definition = makeDefinition(
      [{ name: 'top', type: 'integer' }],
      {
        answer: { init: 'top * 2' },
        needsBorrow: { init: 'top < 50' },
      },
      { result: 'answer + needsBorrow' } // ERROR: references two computed variables
    )

    const errors = validateDerivedFields(definition)
    expect(errors).toHaveLength(2)
    expect(errors.map((e) => e.invalidReference).sort()).toEqual(['answer', 'needsBorrow'])
  })
})

// =============================================================================
// Invalid Cases - Unknown Identifiers
// =============================================================================

describe('validateDerivedFields - unknown identifiers', () => {
  it('detects unknown identifiers that are not input fields or variables', () => {
    const definition = makeDefinition(
      [
        { name: 'top', type: 'integer' },
        { name: 'bottom', type: 'integer' },
      ],
      { answer: { init: 'top - bottom' } },
      { result: 'foo + bar' } // ERROR: 'foo' and 'bar' don't exist
    )

    const errors = validateDerivedFields(definition)
    expect(errors).toHaveLength(2)
    expect(errors.map((e) => e.invalidReference).sort()).toEqual(['bar', 'foo'])
    expect(errors[0].message).toContain('unknown identifier')
  })

  it('detects when derived field references later-defined derived field', () => {
    const definition = makeDefinition(
      [
        { name: 'a', type: 'integer' },
        { name: 'b', type: 'integer' },
      ],
      {},
      {
        first: 'second + a', // ERROR: 'second' is defined after 'first'
        second: 'a + b',
      }
    )

    const errors = validateDerivedFields(definition)
    expect(errors).toHaveLength(1)
    expect(errors[0].fieldName).toBe('first')
    expect(errors[0].invalidReference).toBe('second')
  })
})

// =============================================================================
// Edge Cases
// =============================================================================

describe('validateDerivedFields - edge cases', () => {
  it('handles empty generation config', () => {
    const definition = makeDefinition([{ name: 'x', type: 'integer' }], {}, {})

    const errors = validateDerivedFields(definition)
    expect(errors).toHaveLength(0)
  })

  it('handles property access (dot notation) correctly', () => {
    const definition = makeDefinition(
      [{ name: 'left', type: 'integer' }],
      {},
      {
        // 'left.num' should not flag 'num' as unknown - it's a property access
        leftNum: 'left.num',
      }
    )

    const errors = validateDerivedFields(definition)
    // Should not report 'num' as unknown since it's property access
    expect(errors.filter((e) => e.invalidReference === 'num')).toHaveLength(0)
  })

  it('does not flag function calls as unknown variables', () => {
    const definition = makeDefinition(
      [{ name: 'x', type: 'integer' }],
      {},
      { result: 'someFunction(x)' } // someFunction is called, not a variable
    )

    const errors = validateDerivedFields(definition)
    // Should not report 'someFunction' as unknown since it looks like a function call
    expect(errors.filter((e) => e.invalidReference === 'someFunction')).toHaveLength(0)
  })
})
