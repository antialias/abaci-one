export interface HighlightPhase {
  /** ms after dwell start to activate this phase */
  delayMs: number
  /** values to ADD to the highlight set */
  values: number[]
  /** arc pairs to ADD (p1 < p2) */
  arcs?: [number, number][]
}

export interface PrimeTourStop {
  id: string
  viewport: { center: number; pixelsPerUnit: number }
  blurb: string
  ttsText: string
  ttsTone: string
  hoverValue?: number
  highlightValues?: number[]
  /**
   * When present, drives the highlight set with time-based phases.
   * Each phase accumulates onto the previous ones.
   * When absent, highlightValues applies immediately (legacy mode).
   */
  highlightPhases?: HighlightPhase[]
  dimOthers?: number
  minDwellMs: number
  autoAdvance: boolean
}

/** Shared narration voice direction for the tour. */
export const TOUR_TONE =
  'You are a warm, amazed science show host explaining primes to a really smart 5-year-old. ' +
  'Ground everything in cookies, dinosaurs, and building blocks. Be full of wonder.'

export const PRIME_TOUR_STOPS: PrimeTourStop[] = [
  {
    id: 'rainbow',
    viewport: { center: 15, pixelsPerUnit: 60 },
    blurb: 'Every number has a secret color inside! The color comes from its smallest building block.',
    ttsText:
      'Whoa, look at all these colors! It\'s like a rainbow made of numbers. ' +
      'Every single number has its own secret color, and that color tells you what its most important ingredient is. ' +
      'You know how a cookie might taste most like chocolate? ' +
      'A number\'s color comes from its first, smallest building block.',
    ttsTone: 'Bright, excited whisper. Like opening a secret box and explaining the magic inside.',
    hoverValue: 6,
    highlightValues: [6],
    dimOthers: 0.35,
    minDwellMs: 2000,
    autoAdvance: true,
  },
  {
    id: 'cant-split',
    viewport: { center: 7, pixelsPerUnit: 120 },
    blurb: "Some numbers are like super-strong LEGOs. You can't break them into smaller equal piles!",
    ttsText:
      'Now, look at number 7. See how it\'s one solid color? That\'s because it is a building block! ' +
      'Try to split 7 LEGOs into two equal piles... you can\'t! Or three equal piles... nope! ' +
      'Numbers like this, that can\'t be split up, are called prime numbers. ' +
      'They\'re the super-special ingredients for every other number in the universe.',
    ttsTone: 'Playful challenge, then a eureka moment. Like daring them to try a fun puzzle, then revealing the answer.',
    hoverValue: 7,
    highlightValues: [7],
    dimOthers: 0.4,
    minDwellMs: 2000,
    autoAdvance: true,
  },
  {
    id: 'ancient-trick',
    viewport: { center: 50, pixelsPerUnit: 12 },
    blurb: 'A long, long time ago, a clever person in Greece invented a game to find every prime.',
    ttsText:
      'Okay, so how do we find all these primes? ' +
      'A man named Eratosthenes, way back when people rode chariots, invented a super clever game. ' +
      'It\'s like a strainer for numbers! You pour all the numbers in, ' +
      'shake out the ones that aren\'t prime, and the special building blocks are the ones left behind. ' +
      'We still use his idea today!',
    ttsTone: 'Cozy storyteller. Like sharing the origin story of a famous superhero.',
    minDwellMs: 3000,
    autoAdvance: true,
  },
  {
    id: 'prime-twins',
    viewport: { center: 12, pixelsPerUnit: 70 },
    blurb: "Some primes are best friends — they're called twins because they're only two steps apart.",
    ttsText:
      'Hey, do you see that? Look at 11 and 13. See that little arc connecting them? ' +
      'It\'s like they\'re holding hands! They\'re only two steps away from each other. ' +
      'We call them twin primes. And look — 5 and 7? Twins too! ' +
      'And 17 and 19! Our special building blocks love to travel with a buddy.',
    ttsTone: 'Delighted discovery. Like spotting something rare on a nature walk and pointing it out with glee.',
    hoverValue: 11,
    highlightValues: [5, 7, 11, 13, 17, 19],
    highlightPhases: [
      { delayMs: 0, values: [11, 13], arcs: [[11, 13]] },       // "Look at 11 and 13. See that arc?"
      { delayMs: 14000, values: [5, 7], arcs: [[5, 7]] },       // "And look — 5 and 7? Twins too!"
      { delayMs: 17000, values: [17, 19], arcs: [[17, 19]] },   // "And 17 and 19!"
    ],
    dimOthers: 0.35,
    minDwellMs: 2000,
    autoAdvance: true,
  },
  {
    id: 'mirror-numbers',
    viewport: { center: 131, pixelsPerUnit: 5 },
    blurb: 'This prime is a palindrome — it looks the same in a mirror!',
    ttsText:
      'Let\'s be number detectives for a second. Look at this prime: one-three-one. ' +
      'Now, what happens if you read it backwards? One-three-one! It\'s the exact same! ' +
      'A number that looks the same in a mirror. ' +
      'These are called palindrome primes, and finding them is one of the most fun treasure hunts in all of math.',
    ttsTone: 'Mischievous and amazed. Like revealing a magic trick the listener can try themselves.',
    hoverValue: 131,
    highlightValues: [131],
    dimOthers: 0.4,
    minDwellMs: 2000,
    autoAdvance: true,
  },
  {
    id: 'thinning-out',
    viewport: { center: 500, pixelsPerUnit: 0.8 },
    blurb: 'As we fly farther out, the primes get lonelier. But they never, ever disappear completely.',
    ttsText:
      'Okay, hold on tight... let\'s fly way, way out and look at a huge piece of the number line. ' +
      'See how the primes are spreading apart? There are big dark spaces between them now. ' +
      'They get rarer and lonelier the farther you go. ' +
      'But here is the most incredible secret: they never stop. ' +
      'No matter how far you fly, you will always find another one waiting to be discovered.',
    ttsTone: 'Hushed, floating awe. Like drifting through deep space, pointing out distant beautiful stars.',
    minDwellMs: 3000,
    autoAdvance: true,
  },
  {
    id: 'the-giants',
    viewport: { center: 8191, pixelsPerUnit: 0.06 },
    blurb: 'This is a Mersenne prime — a true giant, made from a special recipe using only the number 2.',
    ttsText:
      'Whoa. Look at the glow on this one! This isn\'t just a prime; it\'s a Mersenne prime — a number superhero. ' +
      'You make it with a special recipe: take one cookie, double it, double it again, ' +
      'and keep doubling 13 times... then take one cookie away. ' +
      'People use giant computers to search for even bigger ones. ' +
      'The biggest one ever found, if you wrote it down, would be taller than a mountain!',
    ttsTone: 'Breathless excitement. Like describing a T-Rex skeleton or the world\'s tallest roller coaster.',
    hoverValue: 8191,
    highlightValues: [8191],
    dimOthers: 0.4,
    minDwellMs: 3000,
    autoAdvance: true,
  },
  {
    id: 'the-mystery',
    viewport: { center: 30, pixelsPerUnit: 30 },
    blurb: "Nobody knows if twin primes go on forever. Maybe you'll find the answer!",
    ttsText:
      'Okay, lean in close. I want to tell you a secret that no grown-up has solved. ' +
      'Remember our twin primes? The ones holding hands? ' +
      'Here\'s the mystery: do they go on forever? ' +
      'We keep finding more and more pairs, farther and farther out... ' +
      'but nobody in the whole history of the world has been able to prove they never stop. ' +
      'Maybe the answer is out there, waiting for a number explorer just like you.',
    ttsTone: 'Conspiratorial whisper, building to warm genuine encouragement. Like entrusting them with a precious secret map.',
    hoverValue: 29,
    highlightValues: [29, 31],
    highlightPhases: [
      { delayMs: 0, values: [29, 31], arcs: [[29, 31]] },  // "Remember our twin primes?"
    ],
    dimOthers: 0.3,
    minDwellMs: 3000,
    autoAdvance: false,
  },
]
