export interface HighlightPhase {
  /** ms after dwell start to activate this phase */
  delayMs: number
  /** values to ADD to the highlight set */
  values: number[]
  /** arc pairs to ADD (p1 < p2) */
  arcs?: [number, number][]
}

export interface NarrationSegment {
  /** TTS text for this segment */
  ttsText: string
  /** TTS tone override (falls back to stop.ttsTone) */
  ttsTone?: string
  /** Virtual time this animation phase occupies (ms) */
  animationDurationMs: number
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
  /**
   * When present, TTS is split into sequential segments. Each segment's
   * animation phase only starts after the previous segment's TTS **and**
   * animation have both finished. The stop's ttsText is kept as full
   * concatenated script for display/fallback.
   */
  narrationSegments?: NarrationSegment[]
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
    viewport: { center: 13, pixelsPerUnit: 50 },
    blurb: 'Skip counting shakes the non-primes right off the number line!',
    ttsText:
      'Okay, here\'s a super clever trick from a long, long time ago. ' +
      'You know skip counting? Well, watch what happens when we try it on the number line! ' +
      'Starting at two — two, four, six, eight, ten — see them shaking off? ' +
      'Bye bye! They can all be split into twos, so they\'re not prime. ' +
      'Now starting at three — three, six, nine, twelve — shake \'em out! ' +
      'Faster! Starting at five — five, ten, fifteen, twenty... And seven — seven, fourteen, twenty-one! ' +
      'Now look what\'s left standing. Those are our primes! ' +
      'The numbers that couldn\'t be shaken out, no matter how hard we tried. ' +
      'A man named Eratosthenes invented this game thousands of years ago, ' +
      'and we still use it today!',
    ttsTone:
      'Excited game-show energy building to wonder. Start playful and familiar with skip counting, ' +
      'build momentum as the sieve speeds up, then awe at the primes left standing.',
    narrationSegments: [
      {
        // Seg 0: intro — no sieve animation, no tail needed.
        // Builds anticipation without naming specific numbers (no visual yet).
        ttsText:
          'Okay, here\'s a super clever trick from a long, long time ago. ' +
          'You know skip counting? Well, watch what happens when we try it on the number line!',
        animationDurationMs: 4000,
      },
      {
        // Seg 1: factor 2 sweep (5000ms) + 1200ms tail for last composites to fall.
        // Names "two" right at the start so it coincides with the factor 2 spotlight.
        ttsText:
          'Starting at two — two, four, six, eight, ten — see them shaking off? ' +
          'Bye bye! They can all be split into twos, so they\'re not prime.',
        animationDurationMs: 6200,
      },
      {
        // Seg 2: factor 3 sweep (3000ms) + 1200ms tail.
        // Names "three" right at the start so it coincides with the factor 3 spotlight.
        ttsText:
          'Now starting at three — three, six, nine, twelve — shake \'em out!',
        animationDurationMs: 4200,
      },
      {
        // Seg 3: factors 5+7 sweeps (2000+1500=3500ms) + 1200ms tail.
        // Names "five" first (sweep starts immediately), then "seven" mid-segment.
        ttsText:
          'Faster! Starting at five — five, ten, fifteen, twenty... ' +
          'And seven — seven, fourteen, twenty-one!',
        animationDurationMs: 4700,
      },
      {
        // Seg 4: celebration — no tail needed
        ttsText:
          'Now look what\'s left standing. Those are our primes! ' +
          'The numbers that couldn\'t be shaken out, no matter how hard we tried. ' +
          'A man named Eratosthenes invented this game thousands of years ago, ' +
          'and we still use it today!',
        animationDurationMs: 5000,
      },
    ],
    minDwellMs: 25000,
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
