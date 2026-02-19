/**
 * Abaci One hero value propositions
 * Rotating subtitles that communicate the core value to new visitors
 */

export interface Subtitle {
  text: string
  description: string
}

export const subtitles: Subtitle[] = [
  {
    text: 'Screen time that builds real math skills',
    description: 'productive screen time for kids',
  },
  {
    text: 'Math practice that adapts to your child',
    description: 'adaptive difficulty system',
  },
  {
    text: 'Mental math starts here',
    description: 'abacus-based mental arithmetic',
  },
  {
    text: "The world's oldest calculator, reimagined",
    description: 'modern take on the abacus',
  },
]

/**
 * Get a random subtitle from the list
 */
export function getRandomSubtitle(): Subtitle {
  const index = Math.floor(Math.random() * subtitles.length)
  return subtitles[index]
}
