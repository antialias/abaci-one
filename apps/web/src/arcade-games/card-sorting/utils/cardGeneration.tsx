import { AbacusReact } from '@soroban/abacus-react'
import { renderToString } from 'react-dom/server'
import type { SortingCard } from '../types'

/**
 * Generate random cards for sorting game
 * @param count Number of cards to generate
 * @param minValue Minimum abacus value (default 0)
 * @param maxValue Maximum abacus value (default 99)
 */
export function generateRandomCards(count: number, minValue = 0, maxValue = 99): SortingCard[] {
  // Generate pool of unique random numbers
  const numbers = new Set<number>()
  while (numbers.size < count) {
    const num = Math.floor(Math.random() * (maxValue - minValue + 1)) + minValue
    numbers.add(num)
  }

  // Convert to sorted array (for answer key)
  const sortedNumbers = Array.from(numbers).sort((a, b) => a - b)

  // Create card objects with SVG content
  return sortedNumbers.map((number, index) => {
    // Render AbacusReact to SVG string
    const svgContent = renderToString(
      <AbacusReact
        value={number}
        columns="auto"
        scaleFactor={1.0}
        interactive={false}
        showNumbers={false}
        animated={false}
      />
    )

    return {
      id: `card-${index}-${number}`,
      number,
      svgContent,
    }
  })
}

/**
 * Shuffle array for random order
 */
export function shuffleCards(cards: SortingCard[]): SortingCard[] {
  const shuffled = [...cards]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}
