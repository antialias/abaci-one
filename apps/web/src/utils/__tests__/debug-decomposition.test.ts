import { describe, it } from 'vitest'
import { generateUnifiedInstructionSequence } from '../unifiedStepGenerator'

describe('Debug Decomposition', () => {
  it('should show what decompositions look like', () => {
    const cases = [
      [0, 1],   // Simple: 0 + 1 = 1
      [5, 4],   // Simple: 5 - 1 = 4
      [3, 7],   // Simple: 3 + 4 = 7
      [10, 3],  // Simple: 10 - 7 = 3
      [99, 100] // Complex: 99 + 1 = 100
    ]

    cases.forEach(([start, target]) => {
      const result = generateUnifiedInstructionSequence(start, target)
      console.log(`\n${start} -> ${target}:`)
      console.log(`  Decomposition: "${result.fullDecomposition}"`)
      console.log(`  Terms: [${result.steps.map(s => s.mathematicalTerm).join(', ')}]`)
      console.log(`  Meaningful: ${result.isMeaningfulDecomposition}`)
      console.log(`  Steps: ${result.steps.length}`)
    })
  })
})