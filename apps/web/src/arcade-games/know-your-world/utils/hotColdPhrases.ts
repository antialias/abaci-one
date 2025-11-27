/**
 * Hot/Cold feedback phrases for Know Your World
 *
 * Provides audible feedback as the user moves their cursor
 * toward or away from the target region.
 */

export type FeedbackType =
  | 'found_it' // Actually hovering over target!
  | 'on_fire' // Very close but not over target
  | 'hot' // Getting closer, close distance
  | 'warmer' // Getting closer, medium/far distance
  | 'colder' // Getting farther, medium distance
  | 'cold' // Getting farther, far distance
  | 'freezing' // Getting farther, very far
  | 'overshot' // Was close, now moving away rapidly
  | 'stuck' // Not making progress, searching aimlessly

const PHRASES: Record<FeedbackType, string[]> = {
  // Actually hovering over the target - encourage clicking
  found_it: ["That's it!", 'Right there!', 'Click it!', 'You found it!', 'Bingo!'],

  // Very close but not over target yet
  on_fire: ["You're on fire!", 'So hot!', 'Burning up!', 'Almost!', 'So close!'],

  // Getting closer
  hot: ['Getting hot!', 'Super warm!', 'Getting close!', 'Toasty!'],
  warmer: ['Warmer!', 'Getting warmer!', 'Good direction!', 'Heating up!'],

  // Getting farther
  colder: ['Colder!', 'Getting colder!', 'Wrong way!', 'Not that way!'],
  cold: ['Cold!', 'Pretty cold!', 'Getting icy!', 'Way cold!'],
  freezing: ['Freezing!', 'Ice cold!', 'Way off!', 'Brrrrr!'],

  // Special cases
  overshot: ['You passed it!', 'Go back!', 'Too far!', 'Turn around!'],
  stuck: ['Try a different direction!', 'Explore somewhere new!', 'Keep searching!'],
}

/**
 * Get a random phrase for the given feedback type.
 */
export function getRandomPhrase(type: FeedbackType): string {
  const phrases = PHRASES[type]
  return phrases[Math.floor(Math.random() * phrases.length)]
}
