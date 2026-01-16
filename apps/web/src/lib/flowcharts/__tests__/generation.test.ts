/**
 * Unit tests for flowchart example generation
 *
 * This file helps debug why certain paths aren't getting examples generated.
 */

import { describe, it, expect } from 'vitest'
import {
  loadFlowchart,
  generateDiverseExamples,
  enumerateAllPaths,
  analyzeFlowchart,
  type GeneratedExample,
  type FlowchartPath,
} from '../loader'
import { evaluate, type EvalContext } from '../evaluator'
import { getFlowchart } from '../definitions'

// Helper to load a flowchart by ID
async function loadFlowchartById(id: string) {
  const data = getFlowchart(id)
  if (!data) throw new Error(`Flowchart "${id}" not found`)
  return loadFlowchart(data.definition, data.mermaid)
}

// =============================================================================
// Test: Fraction Add/Sub Path Enumeration
// =============================================================================

describe('fraction-add-sub path enumeration', () => {
  it('enumerates all expected paths', async () => {
    const flowchart = await loadFlowchartById('fraction-add-sub')
    const paths = enumerateAllPaths(flowchart)

    // Log all path signatures for debugging
    console.log('All paths:')
    for (const path of paths) {
      console.log(`  ${path.nodeIds.join('→')}`)
      console.log(`    decisions: ${path.decisions}, checkpoints: ${path.checkpoints}`)
      console.log(`    constraints:`, path.constraints.map(c => `${c.expression}=${c.requiredOutcome}`))
    }

    expect(paths.length).toBeGreaterThan(0)
  })

  it('finds the LCD + borrow path', async () => {
    const flowchart = await loadFlowchartById('fraction-add-sub')
    const paths = enumerateAllPaths(flowchart)

    // Find path that goes through: STEP2 (NO) -> ... -> BORROW
    const lcdBorrowPath = paths.find(p =>
      p.nodeIds.includes('STEP3') && p.nodeIds.includes('BORROW')
    )

    console.log('LCD + borrow path:', lcdBorrowPath?.nodeIds.join('→'))
    console.log('Constraints:', lcdBorrowPath?.constraints)

    expect(lcdBorrowPath).toBeDefined()
  })
})

// =============================================================================
// Test: Path Constraint Satisfaction
// =============================================================================

describe('path constraint satisfaction', () => {
  it('validates the pre-defined LCD+borrow example satisfies constraints', async () => {
    const flowchart = await loadFlowchartById('fraction-add-sub')

    // This is the pre-defined example from the flow.json
    const values = {
      leftWhole: 4,
      leftNum: 1,
      leftDenom: 3,
      op: '−',
      rightWhole: 2,
      rightNum: 3,
      rightDenom: 4,
    }

    // Initialize computed values
    const context: EvalContext = {
      problem: values,
      computed: {},
      userState: {},
    }

    for (const [varName, varDef] of Object.entries(flowchart.definition.variables)) {
      context.computed[varName] = evaluate(varDef.init, context)
    }

    console.log('Computed values for pre-defined example:')
    console.log('  lcd:', context.computed.lcd)
    console.log('  sameBottom:', context.computed.sameBottom)
    console.log('  oneDividesOther:', context.computed.oneDividesOther)
    console.log('  leftNewNum:', context.computed.leftNewNum)
    console.log('  rightNewNum:', context.computed.rightNewNum)
    console.log('  isSubtraction:', context.computed.isSubtraction)
    console.log('  needsBorrow:', context.computed.needsBorrow)

    // Verify the path constraints
    expect(context.computed.sameBottom).toBe(false) // STEP1 -> NO
    expect(context.computed.oneDividesOther).toBe(false) // STEP2 -> NO (LCD path)
    expect(context.computed.isSubtraction).toBe(true) // ADDSUB -> sub
    expect(context.computed.needsBorrow).toBe(true) // BORROWCHECK -> need borrow
  })
})

// =============================================================================
// Test: Example Generation for Specific Paths
// =============================================================================

describe('example generation coverage', () => {
  it('generates examples for LCD + borrow path', async () => {
    const flowchart = await loadFlowchartById('fraction-add-sub')

    // Generate more examples to increase chance of hitting all paths
    const examples = generateDiverseExamples(flowchart, 50)

    // Log all unique path signatures
    const pathSignatures = new Set(examples.map(e => e.pathSignature))
    console.log('Generated path signatures:')
    for (const sig of pathSignatures) {
      console.log(`  ${sig}`)
    }

    // Find LCD + borrow examples
    // The path should contain "LCD" and "borrow" based on pathLabels
    const lcdBorrowExamples = examples.filter(e =>
      e.pathDescriptor.includes('LCD') && e.pathDescriptor.includes('borrow')
    )

    console.log(`\nLCD + borrow examples: ${lcdBorrowExamples.length}`)
    for (const ex of lcdBorrowExamples) {
      console.log(`  ${ex.displayProblem} -> path: ${ex.pathDescriptor}`)
    }

    // This test documents the current behavior
    // If this fails, we've fixed the issue!
    if (lcdBorrowExamples.length === 0) {
      console.log('\n⚠️ NO LCD + borrow examples were generated!')
      console.log('This is the bug we are investigating.')
    }
  })

  it('analyzes why LCD + borrow path might fail generation', async () => {
    const flowchart = await loadFlowchartById('fraction-add-sub')
    const paths = enumerateAllPaths(flowchart)

    // Find the LCD + borrow path
    const lcdBorrowPath = paths.find(p =>
      p.nodeIds.includes('STEP3') && p.nodeIds.includes('BORROW')
    )

    if (!lcdBorrowPath) {
      throw new Error('LCD + borrow path not found in enumeration')
    }

    console.log('LCD + borrow path constraints:')
    for (const constraint of lcdBorrowPath.constraints) {
      console.log(`  ${constraint.expression} must be ${constraint.requiredOutcome}`)
    }

    // Try to generate 1000 random problems and count how many satisfy the constraints
    let satisfiedCount = 0
    let testedCount = 0

    const preferred = flowchart.definition.generation?.preferred
    const leftDenoms = (preferred?.leftDenom as number[]) || [2, 3, 4, 5, 6, 8, 10, 12]
    const rightDenoms = (preferred?.rightDenom as number[]) || [2, 3, 4, 5, 6, 8, 10, 12]
    const leftNums = (preferred?.leftNum as number[]) || [1, 2, 3, 4, 5]
    const rightNums = (preferred?.rightNum as number[]) || [1, 2, 3, 4, 5]

    for (let i = 0; i < 1000; i++) {
      const leftDenom = leftDenoms[Math.floor(Math.random() * leftDenoms.length)]
      const rightDenom = rightDenoms[Math.floor(Math.random() * rightDenoms.length)]
      const leftNum = leftNums.filter(n => n < leftDenom)[Math.floor(Math.random() * leftNums.filter(n => n < leftDenom).length)]
      const rightNum = rightNums.filter(n => n < rightDenom)[Math.floor(Math.random() * rightNums.filter(n => n < rightDenom).length)]

      if (!leftNum || !rightNum) continue
      testedCount++

      const values = {
        leftWhole: Math.floor(Math.random() * 6),
        leftNum,
        leftDenom,
        op: '−', // Force subtraction for this test
        rightWhole: Math.floor(Math.random() * 5),
        rightNum,
        rightDenom,
      }

      // Initialize computed values
      const context: EvalContext = {
        problem: values,
        computed: {},
        userState: {},
      }

      for (const [varName, varDef] of Object.entries(flowchart.definition.variables)) {
        try {
          context.computed[varName] = evaluate(varDef.init, context)
        } catch {
          continue
        }
      }

      // Check if this satisfies LCD + borrow path
      const sameBottom = context.computed.sameBottom
      const oneDividesOther = context.computed.oneDividesOther
      const needsBorrow = context.computed.needsBorrow

      // Also check positiveResult constraint
      const leftValue = values.leftWhole + values.leftNum / values.leftDenom
      const rightValue = values.rightWhole + values.rightNum / values.rightDenom
      const positiveResult = leftValue >= rightValue

      if (!sameBottom && !oneDividesOther && needsBorrow && positiveResult) {
        satisfiedCount++
      }
    }

    console.log(`\nRandom generation statistics (subtraction only):`)
    console.log(`  Tested: ${testedCount}`)
    console.log(`  Satisfied LCD + borrow + positiveResult: ${satisfiedCount}`)
    console.log(`  Probability: ${(satisfiedCount / testedCount * 100).toFixed(1)}%`)

    // The probability should be reasonable for 100 attempts to succeed
    // If it's very low, that explains the missing examples
  })
})

// =============================================================================
// Test: Verify Path Descriptor Generation
// =============================================================================

describe('path descriptor generation', () => {
  it('generates correct path descriptors', async () => {
    const flowchart = await loadFlowchartById('fraction-add-sub')
    const examples = generateDiverseExamples(flowchart, 30)

    console.log('All generated examples with their path descriptors:')
    for (const ex of examples) {
      const difficulty = ex.complexity.decisions + ex.complexity.checkpoints
      console.log(`  [${difficulty}] ${ex.pathDescriptor}`)
    }
  })
})

// =============================================================================
// Test: Debug Hard Tier Grid Mapping
// =============================================================================

import { inferGridDimensionsFromExamples } from '../loader'

describe('hard tier grid debug', () => {
  it('shows grid dimensions and cell mapping for hard tier', async () => {
    const flowchart = await loadFlowchartById('fraction-add-sub')
    const examples = generateDiverseExamples(flowchart, 50)

    // Filter to Hard tier (complexity >= 8 for fraction flowchart)
    // min = 5, max = 9, so normalized >= 0.66 means score >= 7.64, i.e., score >= 8
    const hardExamples = examples.filter(ex => {
      const score = ex.complexity.decisions + ex.complexity.checkpoints
      return score >= 8
    })

    console.log(`\nHard tier examples (${hardExamples.length}):`)
    for (const ex of hardExamples) {
      const score = ex.complexity.decisions + ex.complexity.checkpoints
      console.log(`  [${score}] ${ex.pathDescriptor}`)
      console.log(`       values: leftDenom=${ex.values.leftDenom}, rightDenom=${ex.values.rightDenom}, op=${ex.values.op}`)
    }

    // Group by LCD path key
    const byFirstDim = new Map<string, GeneratedExample[]>()
    const bySecondDim = new Map<string, GeneratedExample[]>()

    for (const ex of hardExamples) {
      // Extract the LCD/Divides dimension
      const lcdMatch = ex.pathDescriptor.match(/^Diff (LCD|Divides)/)
      const firstDim = lcdMatch ? lcdMatch[1] : 'unknown'

      // Extract the borrow dimension
      const borrowMatch = ex.pathDescriptor.match(/(borrow|no borrow)/)
      const secondDim = borrowMatch ? borrowMatch[1] : 'unknown'

      const existing1 = byFirstDim.get(firstDim) || []
      existing1.push(ex)
      byFirstDim.set(firstDim, existing1)

      const existing2 = bySecondDim.get(secondDim) || []
      existing2.push(ex)
      bySecondDim.set(secondDim, existing2)
    }

    console.log(`\nBy LCD/Divides dimension:`)
    for (const [dim, exs] of byFirstDim) {
      console.log(`  ${dim}: ${exs.length} examples`)
    }

    console.log(`\nBy borrow dimension:`)
    for (const [dim, exs] of bySecondDim) {
      console.log(`  ${dim}: ${exs.length} examples`)
    }

    // Cross-tabulate
    console.log(`\nCross-tabulation (LCD/Divides × borrow):`)
    const cells = new Map<string, number>()
    for (const ex of hardExamples) {
      const lcdMatch = ex.pathDescriptor.match(/^Diff (LCD|Divides)/)
      const borrowMatch = ex.pathDescriptor.match(/(borrow|no borrow)/)
      const key = `${lcdMatch?.[1] || '?'} + ${borrowMatch?.[1] || '?'}`
      cells.set(key, (cells.get(key) || 0) + 1)
    }
    for (const [key, count] of cells) {
      console.log(`  ${key}: ${count}`)
    }
  })

  it('shows inferred grid dimensions for hard tier', async () => {
    const flowchart = await loadFlowchartById('fraction-add-sub')
    const examples = generateDiverseExamples(flowchart, 50)

    // Filter to Hard tier
    const hardExamples = examples.filter(ex => {
      const score = ex.complexity.decisions + ex.complexity.checkpoints
      return score >= 8
    })

    // Get inferred grid dimensions
    const gridDimensions = inferGridDimensionsFromExamples(flowchart, hardExamples)

    if (!gridDimensions) {
      console.log('No grid dimensions inferred!')
      return
    }

    console.log('\n=== INFERRED GRID DIMENSIONS ===')
    console.log(`Rows: ${gridDimensions.rows.join(', ')}`)
    console.log(`Row keys: ${gridDimensions.rowKeys.join(', ')}`)
    console.log(`Cols: ${gridDimensions.cols.join(', ')}`)
    console.log(`Col keys: ${gridDimensions.colKeys.join(', ')}`)

    console.log('\n=== CELL MAP ===')
    for (const [descriptor, [row, col]] of gridDimensions.cellMap) {
      console.log(`  "${descriptor}" -> [row=${row}, col=${col}]`)
    }

    console.log('\n=== UNMAPPED EXAMPLES ===')
    const unmapped: string[] = []
    for (const ex of hardExamples) {
      if (!gridDimensions.cellMap.has(ex.pathDescriptor)) {
        unmapped.push(ex.pathDescriptor)
      }
    }
    if (unmapped.length > 0) {
      for (const desc of unmapped) {
        console.log(`  UNMAPPED: "${desc}"`)
      }
    } else {
      console.log('  (all examples mapped)')
    }

    console.log('\n=== GRID VISUALIZATION ===')
    if (gridDimensions.cols.length === 0) {
      // 1D grid
      console.log('1D Grid:')
      for (let r = 0; r < gridDimensions.rows.length; r++) {
        const exs = hardExamples.filter(ex => {
          const cell = gridDimensions.cellMap.get(ex.pathDescriptor)
          return cell && cell[0] === r
        })
        console.log(`  [${gridDimensions.rows[r]}]: ${exs.length} examples`)
      }
    } else {
      // 2D grid
      console.log(`2D Grid (${gridDimensions.rows.length}x${gridDimensions.cols.length}):`)
      console.log('       | ' + gridDimensions.cols.join(' | '))
      console.log('-------|-' + gridDimensions.cols.map(c => '-'.repeat(c.length)).join('-|-'))
      for (let r = 0; r < gridDimensions.rows.length; r++) {
        const cells: string[] = []
        for (let c = 0; c < gridDimensions.cols.length; c++) {
          const exs = hardExamples.filter(ex => {
            const cell = gridDimensions.cellMap.get(ex.pathDescriptor)
            return cell && cell[0] === r && cell[1] === c
          })
          cells.push(exs.length > 0 ? `${exs.length}` : '·')
        }
        console.log(`${gridDimensions.rows[r].padEnd(7)}| ${cells.join(' | ')}`)
      }
    }
  })
})
