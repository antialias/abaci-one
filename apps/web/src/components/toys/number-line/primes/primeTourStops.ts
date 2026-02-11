export interface PrimeTourStop {
  id: string
  viewport: { center: number; pixelsPerUnit: number }
  blurb: string
  ttsText: string
  ttsTone: string
  hoverValue?: number
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
    blurb: 'Every number has its own color. The color comes from the smallest building block inside it.',
    ttsText:
      'See all these colors? Every number on this line has its own special color. ' +
      'The color tells you something secret — what\'s hiding inside the number. ' +
      'Like how every cookie is made of ingredients... numbers are made of ingredients too.',
    ttsTone: 'Full of wonder, like opening a treasure chest.',
    hoverValue: 6,
    minDwellMs: 2000,
    autoAdvance: true,
  },
  {
    id: 'cant-split',
    viewport: { center: 7, pixelsPerUnit: 120 },
    blurb: "7 can't be split into equal groups. That makes it a building block — a prime.",
    ttsText:
      "Look at 7. Can you split 7 dinosaurs into equal groups? You can't make 2 equal piles, or 3 equal piles. " +
      "It just won't split! Numbers like that are called prime numbers. " +
      "They're the building blocks — every other number is made by multiplying primes together.",
    ttsTone: 'Playful challenge, like asking a riddle.',
    hoverValue: 7,
    minDwellMs: 2000,
    autoAdvance: true,
  },
  {
    id: 'ancient-trick',
    viewport: { center: 50, pixelsPerUnit: 12 },
    blurb: '2,000 years ago, a man named Eratosthenes found a trick to spot every prime.',
    ttsText:
      'Way before cars or computers, a man in ancient Greece figured out a trick. ' +
      'Cross out every second number after 2. Then every third after 3. Then every fifth. ' +
      "The numbers left standing? Those are the primes. People have been hunting for primes ever since.",
    ttsTone: 'Storytelling voice, like beginning a fairy tale.',
    minDwellMs: 3000,
    autoAdvance: true,
  },
  {
    id: 'prime-twins',
    viewport: { center: 12, pixelsPerUnit: 70 },
    blurb: '11 and 13 are twin primes — only 2 apart. Like best friends who sit together.',
    ttsText:
      "Now look at 11 and 13. See that arc connecting them? They're only 2 apart — we call them twin primes. " +
      'Like best friends. And 5 and 7? Twins too! And 17 and 19! Primes love to travel in pairs.',
    ttsTone: 'Excited, like spotting a pair of matching butterflies.',
    hoverValue: 11,
    minDwellMs: 2000,
    autoAdvance: true,
  },
  {
    id: 'mirror-numbers',
    viewport: { center: 131, pixelsPerUnit: 5 },
    blurb: '131 reads the same forwards and backwards — a palindrome prime!',
    ttsText:
      "Here's something cool. 131 — read it backwards — still 131! It's a palindrome prime. " +
      "And there's 101, and 151, and 181. Mathematicians are like pattern detectives, " +
      'and palindrome primes are one of their favorite finds.',
    ttsTone: 'Delighted surprise, like a magic trick reveal.',
    hoverValue: 131,
    minDwellMs: 2000,
    autoAdvance: true,
  },
  {
    id: 'thinning-out',
    viewport: { center: 500, pixelsPerUnit: 0.8 },
    blurb: 'The farther you go, the fewer primes you find. But they never completely stop.',
    ttsText:
      'Now let\'s zoom way out. See how the dots spread apart? Primes get lonelier and lonelier. ' +
      "But here's the amazing thing — they never stop. No matter how far you go, " +
      "there's always another prime waiting. Always.",
    ttsTone: 'Hushed awe, like looking at stars.',
    minDwellMs: 3000,
    autoAdvance: true,
  },
  {
    id: 'the-giants',
    viewport: { center: 8191, pixelsPerUnit: 0.06 },
    blurb: '8,191 is a Mersenne prime — 2 multiplied by itself 13 times, minus 1.',
    ttsText:
      'This is 8,191. See that pink glow? That\'s a Mersenne prime. ' +
      'You make it by multiplying 2 by itself 13 times, then subtracting 1. ' +
      'People use giant computers to search for bigger ones. ' +
      'The biggest Mersenne prime ever found has over 41 million digits!',
    ttsTone: 'Impressed and a little breathless, like describing a skyscraper.',
    hoverValue: 8191,
    minDwellMs: 3000,
    autoAdvance: true,
  },
  {
    id: 'the-mystery',
    viewport: { center: 30, pixelsPerUnit: 30 },
    blurb: "Nobody knows if twin primes go on forever. Maybe you'll be the one to figure it out.",
    ttsText:
      "Here's a secret. There's a question about primes that nobody in the whole world can answer. " +
      'Do twin primes go on forever? We keep finding more and more pairs... ' +
      "but nobody can prove they never stop. Maybe someday, you'll be the one to figure it out.",
    ttsTone: 'Conspiratorial whisper, then warm encouragement.',
    hoverValue: 29,
    minDwellMs: 3000,
    autoAdvance: false,
  },
]
