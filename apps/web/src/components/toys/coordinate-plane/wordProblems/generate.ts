import type { WordProblem, DifficultyLevel } from './types'
import { framesForLevel } from './frames'
import { generateNumbers } from './numberGen'
import { expandGrammar } from './grammar'
import { CHARACTERS, resolveCharacter } from './characters'
import { fraction } from '../ruler/fractionMath'
import { SeededRandom } from '../../../../lib/SeededRandom'

/**
 * Generate a word problem from a seed and difficulty level.
 *
 * The seed completely determines the output — same seed + difficulty = same problem.
 *
 * Pipeline: frame selection → character resolution → number generation → grammar expansion → WordProblem assembly
 */
export function generateWordProblem(seed: number, difficulty: DifficultyLevel): WordProblem {
  const rng = new SeededRandom(seed)

  // 1. Select a frame that supports this difficulty
  const frames = framesForLevel(difficulty)
  const frame = rng.pick(frames)

  // 2. Pick a random character and resolve placeholders in the frame
  const charRng = rng.derive('character')
  const character = charRng.pick(CHARACTERS)
  const resolvedFrame = resolveCharacter(frame, character)

  // 3. Generate numbers
  const nums = generateNumbers(resolvedFrame, difficulty, rng.derive('nums'))

  // 4. Expand grammar into annotated spans
  const spans = expandGrammar(resolvedFrame, nums, difficulty, rng.derive('grammar'))

  // 5. Compute equation as reduced fractions
  const slope = fraction(nums.m, 1)
  const intercept = fraction(nums.b, 1)

  // 6. Determine what the student needs to solve for
  const solveFor: 'x' | 'y' | 'equation' =
    difficulty === 1 ? 'y' : difficulty === 2 ? 'y' : difficulty === 4 ? 'equation' : 'x'

  // 7. Assemble the WordProblem
  const text = spans.map((s) => s.text).join('')

  return {
    id: `wp-${seed}-${difficulty}`,
    spans,
    text,
    equation: { slope, intercept },
    answer: { x: nums.xAnswer, y: nums.yTarget, solveFor },
    difficulty,
    frameId: frame.id,
    seed,
    axisLabels: { x: resolvedFrame.xNoun.plural, y: resolvedFrame.yNoun.plural },
    unitFormat: {
      x: {
        unit: resolvedFrame.xUnit,
        position: resolvedFrame.xUnitPosition,
        singular: resolvedFrame.xNoun.singular,
      },
      y: { unit: resolvedFrame.yUnit, position: resolvedFrame.yUnitPosition },
    },
    emoji: resolvedFrame.emoji,
  }
}

/**
 * Generate a problem with a random seed.
 */
export function generateRandomProblem(difficulty: DifficultyLevel): WordProblem {
  const seed = Math.floor(Math.random() * 0xffffffff)
  return generateWordProblem(seed, difficulty)
}
