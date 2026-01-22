/**
 * Unit tests for flowchart example generation
 *
 * This file helps debug why certain paths aren't getting examples generated,
 * and verifies correctness of parallel generation.
 */

import { describe, it, expect } from 'vitest'
import {
  loadFlowchart,
  generateDiverseExamples,
  generateExamplesForPaths,
  mergeAndFinalizeExamples,
  enumerateAllPaths,
  analyzeFlowchart,
  type GeneratedExample,
  type FlowchartPath,
} from '../loader'
import { evaluate, type EvalContext } from '../evaluator'
import { FLOWCHART_SEEDS } from '../definitions'

// Helper to load a flowchart by ID using seeds (for testing without database)
async function loadFlowchartById(id: string) {
  const seed = FLOWCHART_SEEDS[id]
  if (!seed) throw new Error(`Flowchart seed "${id}" not found`)
  return loadFlowchart(seed.definition, seed.mermaid)
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
      console.log(
        `    constraints:`,
        path.constraints.map((c) => `${c.expression}=${c.requiredOutcome}`)
      )
    }

    expect(paths.length).toBeGreaterThan(0)
  })

  it('finds the Divides + borrow path', async () => {
    const flowchart = await loadFlowchartById('fraction-add-sub')
    const paths = enumerateAllPaths(flowchart)

    // Find path that goes through CONV1A (multiplier) and BORROW
    const dividesBorrowPath = paths.find(
      (p) => p.nodeIds.includes('CONV1A') && p.nodeIds.includes('BORROW')
    )

    console.log('Divides + borrow path:', dividesBorrowPath?.nodeIds.join('→'))
    console.log(
      'Constraints:',
      dividesBorrowPath?.constraints.map((c) => `${c.expression}=${c.requiredOutcome}`)
    )

    expect(dividesBorrowPath).toBeDefined()
  })

  it('finds the LCD + borrow path', async () => {
    const flowchart = await loadFlowchartById('fraction-add-sub')
    const paths = enumerateAllPaths(flowchart)

    // Find path that goes through: STEP2 (NO) -> ... -> BORROW
    const lcdBorrowPath = paths.find(
      (p) => p.nodeIds.includes('STEP3') && p.nodeIds.includes('BORROW')
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

    for (const [varName, varDef] of Object.entries(flowchart.definition.variables || {})) {
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
    const pathSignatures = new Set(examples.map((e) => e.pathSignature))
    console.log('Generated path signatures:')
    for (const sig of pathSignatures) {
      console.log(`  ${sig}`)
    }

    // Find LCD + borrow examples
    // The path should contain "LCD" and "borrow" based on pathLabels
    const lcdBorrowExamples = examples.filter(
      (e) => e.pathDescriptor.includes('LCD') && e.pathDescriptor.includes('borrow')
    )

    console.log(`\nLCD + borrow examples: ${lcdBorrowExamples.length}`)
    for (const ex of lcdBorrowExamples) {
      console.log(`  ${JSON.stringify(ex.values)} -> path: ${ex.pathDescriptor}`)
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
    const lcdBorrowPath = paths.find(
      (p) => p.nodeIds.includes('STEP3') && p.nodeIds.includes('BORROW')
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
      const leftNum = leftNums.filter((n) => n < leftDenom)[
        Math.floor(Math.random() * leftNums.filter((n) => n < leftDenom).length)
      ]
      const rightNum = rightNums.filter((n) => n < rightDenom)[
        Math.floor(Math.random() * rightNums.filter((n) => n < rightDenom).length)
      ]

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

      for (const [varName, varDef] of Object.entries(flowchart.definition.variables || {})) {
        try {
          context.computed[varName] = evaluate(varDef.init, context)
        } catch {}
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
    console.log(`  Probability: ${((satisfiedCount / testedCount) * 100).toFixed(1)}%`)

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
    const hardExamples = examples.filter((ex) => {
      const score = ex.complexity.decisions + ex.complexity.checkpoints
      return score >= 8
    })

    console.log(`\nHard tier examples (${hardExamples.length}):`)
    for (const ex of hardExamples) {
      const score = ex.complexity.decisions + ex.complexity.checkpoints
      console.log(`  [${score}] ${ex.pathDescriptor}`)
      console.log(
        `       values: leftDenom=${ex.values.leftDenom}, rightDenom=${ex.values.rightDenom}, op=${ex.values.op}`
      )
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

  it('shows inferred grid dimensions for medium tier', async () => {
    const flowchart = await loadFlowchartById('fraction-add-sub')
    const examples = generateDiverseExamples(flowchart, 500)

    // Figure out the complexity range
    const scores = examples.map((ex) => ex.complexity.decisions + ex.complexity.checkpoints)
    const minScore = Math.min(...scores)
    const maxScore = Math.max(...scores)
    console.log(`\nComplexity range: ${minScore} - ${maxScore}`)

    // Medium tier: ~0.33-0.66 of the range
    const range = maxScore - minScore
    const mediumMin = minScore + range * 0.33
    const mediumMax = minScore + range * 0.66

    console.log(`Medium tier range: ${mediumMin.toFixed(1)} - ${mediumMax.toFixed(1)}`)

    const mediumExamples = examples.filter((ex) => {
      const score = ex.complexity.decisions + ex.complexity.checkpoints
      return score >= mediumMin && score < mediumMax
    })

    console.log(`\nMedium tier examples (${mediumExamples.length}):`)
    const byDescriptor = new Map<string, number>()
    for (const ex of mediumExamples) {
      byDescriptor.set(ex.pathDescriptor, (byDescriptor.get(ex.pathDescriptor) || 0) + 1)
    }
    for (const [desc, count] of byDescriptor) {
      console.log(`  ${desc}: ${count}`)
    }

    // Show grid dimensions for Medium
    const gridDimensions = inferGridDimensionsFromExamples(flowchart, mediumExamples)
    if (gridDimensions) {
      console.log('\n=== MEDIUM GRID DIMENSIONS ===')
      console.log(`Rows: ${gridDimensions.rows.join(', ')}`)
      console.log(`Cols: ${gridDimensions.cols.join(', ')}`)
      console.log(`RowKeys: ${gridDimensions.rowKeys.join(', ')}`)
      console.log(`ColKeys: ${gridDimensions.colKeys.join(', ')}`)
    }
  })

  it('shows inferred grid dimensions for hard tier', async () => {
    const flowchart = await loadFlowchartById('fraction-add-sub')
    const examples = generateDiverseExamples(flowchart, 500)

    // Log complexity distribution by path
    const byPath = new Map<string, number[]>()
    for (const ex of examples) {
      const score = ex.complexity.decisions + ex.complexity.checkpoints
      const pathKey =
        ex.pathDescriptor.match(/^Diff (LCD|Divides) − (borrow|no borrow)/)?.[0] || 'other'
      const scores = byPath.get(pathKey) || []
      scores.push(score)
      byPath.set(pathKey, scores)
    }
    console.log('\nComplexity distribution by path key:')
    for (const [path, scores] of byPath) {
      const min = Math.min(...scores)
      const max = Math.max(...scores)
      const hardCount = scores.filter((s) => s >= 8).length
      console.log(`  ${path}: ${scores.length} total, complexity ${min}-${max}, ${hardCount} hard`)
    }

    // Filter to Hard tier
    const hardExamples = examples.filter((ex) => {
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
        const exs = hardExamples.filter((ex) => {
          const cell = gridDimensions.cellMap.get(ex.pathDescriptor)
          return cell && cell[0] === r
        })
        console.log(`  [${gridDimensions.rows[r]}]: ${exs.length} examples`)
      }
    } else {
      // 2D grid
      console.log(`2D Grid (${gridDimensions.rows.length}x${gridDimensions.cols.length}):`)
      console.log('       | ' + gridDimensions.cols.join(' | '))
      console.log('-------|-' + gridDimensions.cols.map((c) => '-'.repeat(c.length)).join('-|-'))
      for (let r = 0; r < gridDimensions.rows.length; r++) {
        const cells: string[] = []
        for (let c = 0; c < gridDimensions.cols.length; c++) {
          const exs = hardExamples.filter((ex) => {
            const cell = gridDimensions.cellMap.get(ex.pathDescriptor)
            return cell && cell[0] === r && cell[1] === c
          })
          cells.push(exs.length > 0 ? `${exs.length}` : '·')
        }
        console.log(`${gridDimensions.rows[r].padEnd(7)}| ${cells.join(' | ')}`)
      }
    }
  })

  it('collapses sparse diagonal grids to 1D', async () => {
    const flowchart = await loadFlowchartById('fraction-add-sub')

    // Create examples that form a diagonal pattern:
    // - Some examples: Same denominators + Subtract
    // - Some examples: Different denominators + Add
    // This should collapse to 1D since each row has only 1 column occupied
    const mockExamples: GeneratedExample[] = [
      // Same denom + Subtract (cell [0,0] if rows=[Same,Diff], cols=[Sub,Add])
      {
        values: {
          leftWhole: 5,
          leftNum: 3,
          leftDenom: 6,
          op: '−',
          rightWhole: 0,
          rightNum: 1,
          rightDenom: 6,
        },
        pathSignature:
          'STEP0→STEP1→READY1→CHECK1→REMIND→ADDSUB→BORROWCHECK→GOSTEP4B→CHECK2→STEP4→SIMPLIFY_Q→IMPROPER_Q→CHECK3→DONE',
        pathDescriptor: 'Same − no borrow no simp proper',
        complexity: { decisions: 4, checkpoints: 1, pathLength: 14, path: [] },
      },
      // Another Same denom + Subtract
      {
        values: {
          leftWhole: 3,
          leftNum: 2,
          leftDenom: 4,
          op: '−',
          rightWhole: 1,
          rightNum: 1,
          rightDenom: 4,
        },
        pathSignature:
          'STEP0→STEP1→READY1→CHECK1→REMIND→ADDSUB→BORROWCHECK→GOSTEP4B→CHECK2→STEP4→SIMPLIFY_Q→IMPROPER_Q→CHECK3→DONE',
        pathDescriptor: 'Same − no borrow no simp proper',
        complexity: { decisions: 4, checkpoints: 1, pathLength: 14, path: [] },
      },
      // Different denom + Add (cell [1,1] if rows=[Same,Diff], cols=[Sub,Add])
      {
        values: {
          leftWhole: 1,
          leftNum: 2,
          leftDenom: 4,
          op: '+',
          rightWhole: 2,
          rightNum: 4,
          rightDenom: 6,
        },
        pathSignature:
          'STEP0→STEP1→STEP2→STEP3→STEP3B→READY3→CHECK1→REMIND→ADDSUB→GOSTEP4→CHECK2→STEP4→SIMPLIFY_Q→IMPROPER_Q→CHECK3→DONE',
        pathDescriptor: 'Diff LCD + no simp proper',
        complexity: { decisions: 4, checkpoints: 2, pathLength: 16, path: [] },
      },
      // Another Different denom + Add
      {
        values: {
          leftWhole: 3,
          leftNum: 4,
          leftDenom: 8,
          op: '+',
          rightWhole: 2,
          rightNum: 3,
          rightDenom: 5,
        },
        pathSignature:
          'STEP0→STEP1→STEP2→STEP3→STEP3B→READY3→CHECK1→REMIND→ADDSUB→GOSTEP4→CHECK2→STEP4→SIMPLIFY_Q→IMPROPER_Q→CHECK3→DONE',
        pathDescriptor: 'Diff LCD + no simp proper',
        complexity: { decisions: 4, checkpoints: 2, pathLength: 16, path: [] },
      },
    ]

    const gridDimensions = inferGridDimensionsFromExamples(flowchart, mockExamples)

    console.log('\n=== SPARSE GRID COLLAPSE TEST ===')
    console.log(`Input: 4 examples in diagonal pattern`)
    console.log(`Rows: ${gridDimensions?.rows.join(', ')}`)
    console.log(`Cols: ${gridDimensions?.cols.join(', ') || '(empty - 1D)'}`)

    // The grid should be collapsed to 1D (cols should be empty)
    expect(gridDimensions).not.toBeNull()
    expect(gridDimensions!.cols.length).toBe(0)
    // Should have 2 rows with combined labels
    expect(gridDimensions!.rows.length).toBe(2)
    // Labels should be combined like "Same denominators + Subtract"
    for (const row of gridDimensions!.rows) {
      expect(row).toContain(' + ')
      console.log(`  Combined label: "${row}"`)
    }
  })

  it('does NOT collapse when grid has non-diagonal occupancy', async () => {
    const flowchart = await loadFlowchartById('fraction-add-sub')

    // Create examples that form an L-shape or full grid:
    // - Same denom + Subtract
    // - Same denom + Add (same row, different column!)
    // - Different denom + Add
    // Row "Same" has 2 columns occupied, so should NOT collapse
    const mockExamples: GeneratedExample[] = [
      // Same denom + Subtract
      {
        values: {
          leftWhole: 5,
          leftNum: 3,
          leftDenom: 6,
          op: '−',
          rightWhole: 0,
          rightNum: 1,
          rightDenom: 6,
        },
        pathSignature:
          'STEP0→STEP1→READY1→CHECK1→REMIND→ADDSUB→BORROWCHECK→GOSTEP4B→CHECK2→STEP4→SIMPLIFY_Q→IMPROPER_Q→CHECK3→DONE',
        pathDescriptor: 'Same − no borrow no simp proper',
        complexity: { decisions: 4, checkpoints: 1, pathLength: 14, path: [] },
      },
      // Same denom + Add (same row as above, different column)
      {
        values: {
          leftWhole: 2,
          leftNum: 1,
          leftDenom: 4,
          op: '+',
          rightWhole: 1,
          rightNum: 2,
          rightDenom: 4,
        },
        pathSignature:
          'STEP0→STEP1→READY1→CHECK1→REMIND→ADDSUB→GOSTEP4→CHECK2→STEP4→SIMPLIFY_Q→IMPROPER_Q→CHECK3→DONE',
        pathDescriptor: 'Same + no simp proper',
        complexity: { decisions: 3, checkpoints: 1, pathLength: 13, path: [] },
      },
      // Different denom + Add
      {
        values: {
          leftWhole: 1,
          leftNum: 2,
          leftDenom: 4,
          op: '+',
          rightWhole: 2,
          rightNum: 4,
          rightDenom: 6,
        },
        pathSignature:
          'STEP0→STEP1→STEP2→STEP3→STEP3B→READY3→CHECK1→REMIND→ADDSUB→GOSTEP4→CHECK2→STEP4→SIMPLIFY_Q→IMPROPER_Q→CHECK3→DONE',
        pathDescriptor: 'Diff LCD + no simp proper',
        complexity: { decisions: 4, checkpoints: 2, pathLength: 16, path: [] },
      },
    ]

    const gridDimensions = inferGridDimensionsFromExamples(flowchart, mockExamples)

    console.log('\n=== NON-SPARSE GRID TEST ===')
    console.log(`Input: 3 examples in L-shape (row "Same" has 2 columns)`)
    console.log(`Rows: ${gridDimensions?.rows.join(', ')}`)
    console.log(`Cols: ${gridDimensions?.cols.join(', ') || '(empty - 1D)'}`)

    // The grid should NOT be collapsed (cols should have values)
    expect(gridDimensions).not.toBeNull()
    expect(gridDimensions!.cols.length).toBeGreaterThan(0)
    console.log(`  Grid is 2D: ${gridDimensions!.rows.length}x${gridDimensions!.cols.length}`)
  })
})

// =============================================================================
// Test: Parallel Generation Correctness
// =============================================================================

describe('parallel generation correctness', () => {
  it('generateExamplesForPaths produces valid examples for assigned paths', async () => {
    const flowchart = await loadFlowchartById('fraction-add-sub')
    const analysis = analyzeFlowchart(flowchart)

    // Generate for just the first 3 paths
    const pathIndices = [0, 1, 2]
    const examples = generateExamplesForPaths(flowchart, pathIndices, { positiveAnswersOnly: true })

    console.log(`\nGenerated ${examples.length} examples for paths [0, 1, 2]`)

    // Each example should have valid structure
    for (const ex of examples) {
      expect(ex.values).toBeDefined()
      expect(ex.complexity).toBeDefined()
      expect(ex.pathSignature).toBeDefined()
      expect(ex.pathDescriptor).toBeDefined()
      expect(typeof ex.complexity.decisions).toBe('number')
      expect(typeof ex.complexity.checkpoints).toBe('number')
    }

    // Should have at least some examples
    expect(examples.length).toBeGreaterThan(0)

    // Log path descriptors for debugging
    const descriptors = new Set(examples.map((e) => e.pathDescriptor))
    console.log(`Unique path descriptors: ${descriptors.size}`)
    for (const desc of descriptors) {
      console.log(`  ${desc}`)
    }
  })

  it('mergeAndFinalizeExamples produces correct count and diversity', async () => {
    const flowchart = await loadFlowchartById('fraction-add-sub')
    const analysis = analyzeFlowchart(flowchart)

    // Simulate parallel generation by splitting paths
    const halfIdx = Math.floor(analysis.paths.length / 2)
    const worker1Paths = Array.from({ length: halfIdx }, (_, i) => i)
    const worker2Paths = Array.from(
      { length: analysis.paths.length - halfIdx },
      (_, i) => halfIdx + i
    )

    // Generate examples for each "worker"
    const examples1 = generateExamplesForPaths(flowchart, worker1Paths, {
      positiveAnswersOnly: true,
    })
    const examples2 = generateExamplesForPaths(flowchart, worker2Paths, {
      positiveAnswersOnly: true,
    })

    console.log(`\nWorker 1 (paths 0-${halfIdx - 1}): ${examples1.length} examples`)
    console.log(
      `Worker 2 (paths ${halfIdx}-${analysis.paths.length - 1}): ${examples2.length} examples`
    )

    // Merge results
    const allExamples = [...examples1, ...examples2]
    const count = 20
    const finalExamples = mergeAndFinalizeExamples(allExamples, count)

    console.log(
      `\nMerged: ${allExamples.length} total -> ${finalExamples.length} final (requested ${count})`
    )

    // Should return the requested count or fewer if not enough unique paths
    expect(finalExamples.length).toBeLessThanOrEqual(count)
    expect(finalExamples.length).toBeGreaterThan(0)

    // Final examples should be diverse (different path descriptors)
    const finalDescriptors = new Set(finalExamples.map((e) => e.pathDescriptor))
    console.log(`Unique path descriptors in final: ${finalDescriptors.size}`)

    // Should have reasonable diversity
    expect(finalDescriptors.size).toBeGreaterThan(1)
  })

  it('parallel generation covers same paths as sync generation', async () => {
    const flowchart = await loadFlowchartById('fraction-add-sub')
    const analysis = analyzeFlowchart(flowchart)

    // Run sync generation
    const syncExamples = generateDiverseExamples(flowchart, 50, { positiveAnswersOnly: true })
    const syncDescriptors = new Set(syncExamples.map((e) => e.pathDescriptor))

    // Simulate parallel generation with 4 workers
    const numWorkers = 4
    const pathsPerWorker = Math.ceil(analysis.paths.length / numWorkers)
    const workerResults: GeneratedExample[][] = []

    for (let w = 0; w < numWorkers; w++) {
      const startIdx = w * pathsPerWorker
      const endIdx = Math.min(startIdx + pathsPerWorker, analysis.paths.length)
      if (startIdx >= analysis.paths.length) break

      const pathIndices = Array.from({ length: endIdx - startIdx }, (_, i) => startIdx + i)
      const examples = generateExamplesForPaths(flowchart, pathIndices, {
        positiveAnswersOnly: true,
      })
      workerResults.push(examples)
    }

    const allParallel = workerResults.flat()
    const parallelExamples = mergeAndFinalizeExamples(allParallel, 50)
    const parallelDescriptors = new Set(parallelExamples.map((e) => e.pathDescriptor))

    console.log(`\n=== PATH COVERAGE COMPARISON ===`)
    console.log(`Sync paths covered: ${syncDescriptors.size}`)
    console.log(`Parallel paths covered: ${parallelDescriptors.size}`)

    // Check for paths in sync but not parallel
    const missingInParallel = [...syncDescriptors].filter((d) => !parallelDescriptors.has(d))
    const extraInParallel = [...parallelDescriptors].filter((d) => !syncDescriptors.has(d))

    if (missingInParallel.length > 0) {
      console.log(`\nPaths in SYNC but not PARALLEL:`)
      for (const d of missingInParallel) {
        console.log(`  - ${d}`)
      }
    }

    if (extraInParallel.length > 0) {
      console.log(`\nPaths in PARALLEL but not SYNC:`)
      for (const d of extraInParallel) {
        console.log(`  + ${d}`)
      }
    }

    // Path coverage should be similar (within 20% difference is acceptable due to randomness)
    const coverageDiff = Math.abs(syncDescriptors.size - parallelDescriptors.size)
    const maxDiff = Math.ceil(syncDescriptors.size * 0.2)
    console.log(`\nCoverage difference: ${coverageDiff} (max allowed: ${maxDiff})`)

    expect(coverageDiff).toBeLessThanOrEqual(maxDiff)
  })

  it('parallel generation produces valid problem values', async () => {
    const flowchart = await loadFlowchartById('fraction-add-sub')
    const analysis = analyzeFlowchart(flowchart)

    // Generate examples in parallel
    const pathIndices = Array.from({ length: analysis.paths.length }, (_, i) => i)
    const examples = generateExamplesForPaths(flowchart, pathIndices, { positiveAnswersOnly: true })

    console.log(`\nValidating ${examples.length} examples...`)

    let validCount = 0
    let invalidCount = 0
    const errors: string[] = []

    for (const ex of examples) {
      try {
        // Verify values are valid fractions
        const { leftNum, leftDenom, rightNum, rightDenom, leftWhole, rightWhole, op } =
          ex.values as {
            leftNum: number
            leftDenom: number
            rightNum: number
            rightDenom: number
            leftWhole: number
            rightWhole: number
            op: string
          }

        // Denominators should be positive
        if (leftDenom <= 0 || rightDenom <= 0) {
          errors.push(`Invalid denom: ${leftDenom}, ${rightDenom}`)
          invalidCount++
          continue
        }

        // Numerators should be less than denominators (proper fractions)
        if (leftNum >= leftDenom || rightNum >= rightDenom) {
          // This is actually allowed for improper fractions
        }

        // Whole numbers should be non-negative
        if (leftWhole < 0 || rightWhole < 0) {
          errors.push(`Negative whole: ${leftWhole}, ${rightWhole}`)
          invalidCount++
          continue
        }

        // For subtraction, result should be positive (positiveAnswersOnly constraint)
        if (op === '−') {
          const leftValue = leftWhole + leftNum / leftDenom
          const rightValue = rightWhole + rightNum / rightDenom
          if (leftValue < rightValue) {
            errors.push(`Negative result: ${leftValue} - ${rightValue}`)
            invalidCount++
            continue
          }
        }

        validCount++
      } catch (e) {
        errors.push(`Error: ${e}`)
        invalidCount++
      }
    }

    console.log(`Valid: ${validCount}, Invalid: ${invalidCount}`)
    if (errors.length > 0 && errors.length <= 5) {
      console.log(`Errors:`)
      for (const err of errors) {
        console.log(`  ${err}`)
      }
    }

    // Should have very few invalid examples (< 1%)
    const invalidRatio = invalidCount / examples.length
    expect(invalidRatio).toBeLessThan(0.01)
  })
})
