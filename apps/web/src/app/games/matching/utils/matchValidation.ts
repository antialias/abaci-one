import type { GameCard, MatchValidationResult } from '../context/types'

// Validate abacus-numeral match (abacus card matches with number card of same value)
export function validateAbacusNumeralMatch(
  card1: GameCard,
  card2: GameCard
): MatchValidationResult {
  // Both cards must have the same number
  if (card1.number !== card2.number) {
    return {
      isValid: false,
      reason: 'Numbers do not match',
      type: 'invalid',
    }
  }

  // Cards must be different types (one abacus, one number)
  if (card1.type === card2.type) {
    return {
      isValid: false,
      reason: 'Both cards are the same type',
      type: 'invalid',
    }
  }

  // One must be abacus, one must be number
  const hasAbacus = card1.type === 'abacus' || card2.type === 'abacus'
  const hasNumber = card1.type === 'number' || card2.type === 'number'

  if (!hasAbacus || !hasNumber) {
    return {
      isValid: false,
      reason: 'Must match abacus with number representation',
      type: 'invalid',
    }
  }

  // Neither should be complement type for this game mode
  if (card1.type === 'complement' || card2.type === 'complement') {
    return {
      isValid: false,
      reason: 'Complement cards not valid in abacus-numeral mode',
      type: 'invalid',
    }
  }

  return {
    isValid: true,
    type: 'abacus-numeral',
  }
}

// Validate complement match (two numbers that add up to target sum)
export function validateComplementMatch(card1: GameCard, card2: GameCard): MatchValidationResult {
  // Both cards must be complement type
  if (card1.type !== 'complement' || card2.type !== 'complement') {
    return {
      isValid: false,
      reason: 'Both cards must be complement type',
      type: 'invalid',
    }
  }

  // Both cards must have the same target sum
  if (card1.targetSum !== card2.targetSum) {
    return {
      isValid: false,
      reason: 'Cards have different target sums',
      type: 'invalid',
    }
  }

  // Check if the numbers are actually complements
  if (!card1.complement || !card2.complement) {
    return {
      isValid: false,
      reason: 'Complement information missing',
      type: 'invalid',
    }
  }

  // Verify the complement relationship
  if (card1.number !== card2.complement || card2.number !== card1.complement) {
    return {
      isValid: false,
      reason: 'Numbers are not complements of each other',
      type: 'invalid',
    }
  }

  // Verify the sum equals the target
  const sum = card1.number + card2.number
  if (sum !== card1.targetSum) {
    return {
      isValid: false,
      reason: `Sum ${sum} does not equal target ${card1.targetSum}`,
      type: 'invalid',
    }
  }

  return {
    isValid: true,
    type: 'complement',
  }
}

// Main validation function that determines which validation to use
export function validateMatch(card1: GameCard, card2: GameCard): MatchValidationResult {
  // Cannot match the same card with itself
  if (card1.id === card2.id) {
    return {
      isValid: false,
      reason: 'Cannot match card with itself',
      type: 'invalid',
    }
  }

  // Cannot match already matched cards
  if (card1.matched || card2.matched) {
    return {
      isValid: false,
      reason: 'Cannot match already matched cards',
      type: 'invalid',
    }
  }

  // Determine which type of match to validate based on card types
  const hasComplement = card1.type === 'complement' || card2.type === 'complement'

  if (hasComplement) {
    // If either card is complement type, use complement validation
    return validateComplementMatch(card1, card2)
  } else {
    // Otherwise, use abacus-numeral validation
    return validateAbacusNumeralMatch(card1, card2)
  }
}

// Helper function to check if a card can be flipped
export function canFlipCard(
  card: GameCard,
  flippedCards: GameCard[],
  isProcessingMove: boolean
): boolean {
  // Cannot flip if processing a move
  if (isProcessingMove) return false

  // Cannot flip already matched cards
  if (card.matched) return false

  // Cannot flip if already flipped
  if (flippedCards.some((c) => c.id === card.id)) return false

  // Cannot flip if two cards are already flipped
  if (flippedCards.length >= 2) return false

  return true
}

// Get hint for what kind of match the player should look for
export function getMatchHint(card: GameCard): string {
  switch (card.type) {
    case 'abacus':
      return `Find the number ${card.number}`

    case 'number':
      return `Find the abacus showing ${card.number}`

    case 'complement':
      if (card.complement !== undefined && card.targetSum !== undefined) {
        return `Find ${card.complement} to make ${card.targetSum}`
      }
      return 'Find the matching complement'

    default:
      return 'Find the matching card'
  }
}

// Calculate match score based on difficulty and time
export function calculateMatchScore(
  difficulty: number,
  timeForMatch: number,
  isComplementMatch: boolean
): number {
  const baseScore = isComplementMatch ? 15 : 10 // Complement matches worth more
  const difficultyMultiplier = difficulty / 6 // Scale with difficulty
  const timeBonus = Math.max(0, (10000 - timeForMatch) / 1000) // Bonus for speed

  return Math.round(baseScore * difficultyMultiplier + timeBonus)
}

// Analyze game performance
export function analyzeGamePerformance(
  totalMoves: number,
  matchedPairs: number,
  totalPairs: number,
  gameTime: number
): {
  accuracy: number
  efficiency: number
  averageTimePerMove: number
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
} {
  const accuracy = totalMoves > 0 ? (matchedPairs / totalMoves) * 100 : 0
  const efficiency = totalPairs > 0 ? (matchedPairs / (totalPairs * 2)) * 100 : 0 // Ideal is 100% (each pair found in 2 moves)
  const averageTimePerMove = totalMoves > 0 ? gameTime / totalMoves : 0

  // Calculate grade based on accuracy and efficiency
  let grade: 'A' | 'B' | 'C' | 'D' | 'F' = 'F'
  if (accuracy >= 90 && efficiency >= 80) grade = 'A'
  else if (accuracy >= 80 && efficiency >= 70) grade = 'B'
  else if (accuracy >= 70 && efficiency >= 60) grade = 'C'
  else if (accuracy >= 60 && efficiency >= 50) grade = 'D'

  return {
    accuracy,
    efficiency,
    averageTimePerMove,
    grade,
  }
}
