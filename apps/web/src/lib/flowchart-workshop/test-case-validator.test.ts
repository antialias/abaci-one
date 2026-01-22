/**
 * Unit tests for test-case-validator
 *
 * Verifies that test evaluation matches worksheet evaluation
 */

import { describe, it, expect } from 'vitest'
import {
  validateTestCasesWithCoverage,
  evaluateDisplayAnswer,
  runTestCaseWithFlowchart,
} from './test-case-validator'
import { loadFlowchart } from '../flowcharts/loader'
import type { FlowchartDefinition, ProblemExample } from '../flowcharts/schema'

// Minimal fraction add/sub flowchart definition from session j7qigoel6895eby6c6l1b8ls
const fractionAddSubDefinition: FlowchartDefinition = {
  id: 'fraction-add-sub',
  title: 'Fraction Addition & Subtraction',
  mermaidFile: 'fraction-flowchart.mmd',
  problemInput: {
    schema: 'two-fractions-with-op',
    fields: [
      { name: 'leftWhole', label: 'Left whole', type: 'integer', min: 0, max: 99, default: 0 },
      { name: 'leftNum', label: 'Left numerator', type: 'integer', min: 0, max: 99, default: 0 },
      { name: 'leftDenom', label: 'Left denom', type: 'integer', min: 1, max: 99, default: 1 },
      { name: 'op', label: 'Operation', type: 'choice', options: ['+', '−'], default: '+' },
      { name: 'rightWhole', label: 'Right whole', type: 'integer', min: 0, max: 99, default: 0 },
      { name: 'rightNum', label: 'Right numerator', type: 'integer', min: 0, max: 99, default: 0 },
      { name: 'rightDenom', label: 'Right denom', type: 'integer', min: 1, max: 99, default: 1 },
    ],
    examples: [
      // Example with CORRECT op format
      {
        name: 'Same denom + add (simple) - correct format',
        values: {
          leftWhole: 0,
          leftNum: 1,
          leftDenom: 4,
          op: '+', // Correct: just the operator
          rightWhole: 0,
          rightNum: 2,
          rightDenom: 4,
        },
        expectedAnswer: '3/4',
      },
      // Example with WRONG op format (as stored in DB)
      {
        name: 'Same denom + add (simple) - wrong format',
        values: {
          leftWhole: 0,
          leftNum: 1,
          leftDenom: 4,
          op: "'+'" as string, // Wrong: operator wrapped in quotes
          rightWhole: 0,
          rightNum: 2,
          rightDenom: 4,
        },
        expectedAnswer: '3/4',
      },
      // Subtraction with borrow - correct format
      {
        name: 'Same denom + sub (borrow) - correct format',
        values: {
          leftWhole: 3,
          leftNum: 1,
          leftDenom: 4,
          op: '−', // Unicode minus
          rightWhole: 1,
          rightNum: 3,
          rightDenom: 4,
        },
        expectedAnswer: '1 1/2',
      },
      // Subtraction with borrow - wrong format
      {
        name: 'Same denom + sub (borrow) - wrong format',
        values: {
          leftWhole: 3,
          leftNum: 1,
          leftDenom: 4,
          op: "'−'", // Wrong: wrapped in quotes
          rightWhole: 1,
          rightNum: 3,
          rightDenom: 4,
        },
        expectedAnswer: '1 1/2',
      },
    ],
  },
  variables: {
    lcd: { init: 'lcm(leftDenom, rightDenom)' },
    sameBottom: { init: 'leftDenom == rightDenom' },
    oneDividesOther: { init: 'leftDenom % rightDenom == 0 || rightDenom % leftDenom == 0' },
    leftMultiplier: { init: 'lcd / leftDenom' },
    rightMultiplier: { init: 'lcd / rightDenom' },
    leftNewNum: { init: 'leftNum * (lcd / leftDenom)' },
    rightNewNum: { init: 'rightNum * (lcd / rightDenom)' },
    isSubtraction: { init: "op == '−'" },
    needsBorrow: { init: "op == '−' && leftNewNum < rightNewNum" },
    rawResultNum: {
      init: "op == '+' ? (leftNewNum + rightNewNum) : (needsBorrow ? (leftNewNum + lcd - rightNewNum) : (leftNewNum - rightNewNum))",
    },
    resultGcd: { init: 'gcd(rawResultNum, lcd)' },
    needsSimplify: { init: 'resultGcd > 1' },
    simplifiedNum: { init: 'rawResultNum / resultGcd' },
    simplifiedDenom: { init: 'lcd / resultGcd' },
    isImproper: { init: 'simplifiedNum >= simplifiedDenom' },
    hasWholeNumbers: { init: 'leftWhole > 0 || rightWhole > 0' },
    resultWhole: {
      init: "op == '+' ? (leftWhole + rightWhole) : (needsBorrow ? (leftWhole - 1 - rightWhole) : (leftWhole - rightWhole))",
    },
    improperWhole: {
      init: '(simplifiedNum - (simplifiedNum % simplifiedDenom)) / simplifiedDenom',
    },
    finalWhole: { init: 'resultWhole + improperWhole' },
    finalNum: { init: 'simplifiedNum % simplifiedDenom' },
  },
  entryNode: 'STEP0',
  nodes: {
    STEP0: {
      type: 'checkpoint',
      prompt: 'What are the two bottom numbers?',
      inputType: 'two-numbers',
      expected: ['leftDenom', 'rightDenom'],
      next: 'DONE',
    },
    DONE: { type: 'terminal' },
  },
  display: {
    answer:
      "finalNum == 0 ? (finalWhole > 0 ? finalWhole : '0') : (finalWhole > 0 ? (finalWhole + ' ' + finalNum + '/' + simplifiedDenom) : (finalNum + '/' + simplifiedDenom))",
  },
}

const minimalMermaid = `flowchart TB
  STEP0["Start"] --> DONE["Done"]
`

describe('test-case-validator', () => {
  describe('evaluateDisplayAnswer', () => {
    it('should compute correct answer with proper op format', () => {
      // 1/4 + 2/4 = 3/4
      const result = evaluateDisplayAnswer(fractionAddSubDefinition, {
        leftWhole: 0,
        leftNum: 1,
        leftDenom: 4,
        op: '+',
        rightWhole: 0,
        rightNum: 2,
        rightDenom: 4,
      })
      expect(result.error).toBeUndefined()
      expect(result.answer).toBe('3/4')
    })

    it('should NOW WORK with quoted op format (after normalization fix)', () => {
      // After the fix: normalizeExampleValues strips wrapper quotes
      // so op="'+'" becomes op="+"
      const result = evaluateDisplayAnswer(fractionAddSubDefinition, {
        leftWhole: 0,
        leftNum: 1,
        leftDenom: 4,
        op: "'+'" as string, // Wrong format from LLM, but normalization fixes it
        rightWhole: 0,
        rightNum: 2,
        rightDenom: 4,
      })
      expect(result.error).toBeUndefined()
      expect(result.answer).toBe('3/4') // Fixed: correct answer after normalization
    })

    it('should compute subtraction with borrow correctly', () => {
      // 3 1/4 - 1 3/4 = 1 1/2
      const result = evaluateDisplayAnswer(fractionAddSubDefinition, {
        leftWhole: 3,
        leftNum: 1,
        leftDenom: 4,
        op: '−', // Unicode minus
        rightWhole: 1,
        rightNum: 3,
        rightDenom: 4,
      })
      expect(result.error).toBeUndefined()
      expect(result.answer).toBe('1 1/2')
    })

    it('should NOW WORK subtraction with quoted op format (after normalization fix)', () => {
      const result = evaluateDisplayAnswer(fractionAddSubDefinition, {
        leftWhole: 3,
        leftNum: 1,
        leftDenom: 4,
        op: "'−'", // Wrong format from LLM, but normalization fixes it
        rightWhole: 1,
        rightNum: 3,
        rightDenom: 4,
      })
      expect(result.error).toBeUndefined()
      expect(result.answer).toBe('1 1/2') // Fixed: correct answer after normalization
    })
  })

  describe('evaluateDisplayAnswer with flowchart', () => {
    it('should produce correct answer when used with loaded flowchart', async () => {
      const flowchart = await loadFlowchart(fractionAddSubDefinition, minimalMermaid)

      const values = {
        leftWhole: 0,
        leftNum: 1,
        leftDenom: 4,
        op: '+',
        rightWhole: 0,
        rightNum: 2,
        rightDenom: 4,
      }

      // evaluateDisplayAnswer is the canonical function for all answer computation
      const result = evaluateDisplayAnswer(flowchart.definition, values)

      expect(result.error).toBeUndefined()
      expect(result.answer).toBe('3/4')
    })
  })

  describe('validateTestCasesWithCoverage', () => {
    it('should NOW PASS when op has quoted format (normalization fixes it)', async () => {
      const definitionWithQuotedOp: FlowchartDefinition = {
        ...fractionAddSubDefinition,
        problemInput: {
          ...fractionAddSubDefinition.problemInput,
          examples: [
            {
              name: 'Quoted format test',
              values: {
                leftWhole: 0,
                leftNum: 1,
                leftDenom: 4,
                op: "'+'" as string, // Wrong format, but normalization fixes it
                rightWhole: 0,
                rightNum: 2,
                rightDenom: 4,
              },
              expectedAnswer: '3/4',
            },
          ],
        },
      }

      const report = await validateTestCasesWithCoverage(definitionWithQuotedOp, minimalMermaid)

      // Should pass because normalization strips the quotes
      expect(report.passed).toBe(true)
      expect(report.results[0].passed).toBe(true)
      expect(report.results[0].actualAnswer).toBe('3/4')
    })

    it('should pass when op has correct format', async () => {
      const definitionWithGoodExamples: FlowchartDefinition = {
        ...fractionAddSubDefinition,
        problemInput: {
          ...fractionAddSubDefinition.problemInput,
          examples: [
            {
              name: 'Good format test',
              values: {
                leftWhole: 0,
                leftNum: 1,
                leftDenom: 4,
                op: '+', // Correct format
                rightWhole: 0,
                rightNum: 2,
                rightDenom: 4,
              },
              expectedAnswer: '3/4',
            },
          ],
        },
      }

      const report = await validateTestCasesWithCoverage(definitionWithGoodExamples, minimalMermaid)

      expect(report.passed).toBe(true)
      expect(report.results[0].passed).toBe(true)
      expect(report.results[0].actualAnswer).toBe('3/4')
    })
  })
})
