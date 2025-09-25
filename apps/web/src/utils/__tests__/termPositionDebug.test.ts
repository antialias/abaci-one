import { describe, it } from 'vitest'
import { generateUnifiedInstructionSequence } from '../unifiedStepGenerator'

describe('Term Position Generation Debug', () => {
  const testCases = [
    { start: 4, target: 7, desc: 'Simple five-complement: 4 + 3' },
    { start: 7, target: 15, desc: 'Ten-complement: 7 + 8' },
    { start: 12, target: 34, desc: 'Multi-place: 12 + 22' },
    { start: 99, target: 107, desc: 'Cascading: 99 + 8' }
  ]

  testCases.forEach(({ start, target, desc }) => {
    it(`should generate proper term positions for ${desc}`, () => {
      const result = generateUnifiedInstructionSequence(start, target)

      console.log(`\n--- ${desc} ---`)
      console.log('Full decomposition:', result.fullDecomposition)
      console.log('Term positions:')

      result.steps.forEach((step, i) => {
        const pos = step.termPosition
        if (pos) {
          const highlighted = result.fullDecomposition.substring(pos.startIndex, pos.endIndex)
          console.log(`  Step ${i}: "${step.mathematicalTerm}" -> "${highlighted}" at [${pos.startIndex}-${pos.endIndex}]`)

        // Check if position is reasonable
        const shouldHighlight = step.mathematicalTerm.replace('-', '')
        const isGoodHighlight = highlighted.includes(shouldHighlight) || highlighted === step.mathematicalTerm
        console.log(`    Valid highlight: ${isGoodHighlight ? '✅' : '❌'}`)
        } else {
          console.log(`  Step ${i}: "${step.mathematicalTerm}" -> NO POSITION`)
        }
      })
    })
  })
})