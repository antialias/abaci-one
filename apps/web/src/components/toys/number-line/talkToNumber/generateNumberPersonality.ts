import { smallestPrimeFactor, factorize } from '../primes/sieve'
import { MATH_CONSTANTS } from '../constants/constantsData'
import type { GeneratedScenario } from './generateScenario'
import type { ChildProfile } from './childProfile'

// --- Sequence checks ---

function isFibonacci(n: number): boolean {
  if (n < 0 || !Number.isInteger(n)) return false
  // n is Fibonacci iff 5n²+4 or 5n²-4 is a perfect square
  const a = 5 * n * n + 4
  const b = 5 * n * n - 4
  const sqrtA = Math.round(Math.sqrt(a))
  const sqrtB = Math.round(Math.sqrt(b))
  return sqrtA * sqrtA === a || sqrtB * sqrtB === b
}

function isPerfectSquare(n: number): boolean {
  if (n < 0 || !Number.isInteger(n)) return false
  const s = Math.round(Math.sqrt(n))
  return s * s === n
}

function isPerfectCube(n: number): boolean {
  if (!Number.isInteger(n)) return false
  const c = Math.round(Math.cbrt(n))
  return c * c * c === n
}

function isTriangular(n: number): boolean {
  if (n < 0 || !Number.isInteger(n)) return false
  // n is triangular iff 8n+1 is a perfect square
  return isPerfectSquare(8 * n + 1)
}

function isPowerOf2(n: number): boolean {
  if (n < 1 || !Number.isInteger(n)) return false
  return (n & (n - 1)) === 0
}

function isFactorial(n: number): number | null {
  if (n < 1 || !Number.isInteger(n)) return null
  let f = 1
  for (let k = 1; k <= 20; k++) {
    f *= k
    if (f === n) return k
  }
  return null
}

// --- Famous number proximity ---

function findNearbyConstants(n: number): string[] {
  const nearby: string[] = []
  for (const c of MATH_CONSTANTS) {
    const dist = Math.abs(n - c.value)
    if (dist < 0.5 && dist > 0.001) {
      nearby.push(`${c.symbol} (${c.name}, ≈${c.value.toFixed(4)})`)
    }
  }
  return nearby
}

// --- Cultural associations ---

function getCulturalNote(n: number): string | null {
  const notes: Record<number, string> = {
    0: 'the placeholder that changed everything — without zero we couldn\'t write 10 or 100',
    1: 'unity, the beginning, the loneliest number',
    2: 'duality, pairs, the only even prime',
    3: 'three wishes in stories, three little pigs, the smallest odd prime',
    4: 'four seasons, four directions, a square number',
    5: 'five senses, five fingers, the halfway point of a hand',
    7: 'lucky seven, the most popular "random" number people pick',
    10: 'our counting base, ten fingers, a perfect score',
    12: 'a dozen, months in a year, hours on a clock face',
    13: 'unlucky thirteen, a baker\'s dozen, a rebel number',
    21: 'blackjack, the age of adulthood in many places',
    42: 'the answer to life, the universe, and everything',
    50: 'half a century, a golden anniversary',
    64: 'squares on a chessboard, a computer\'s favorite power of 2',
    100: 'a century, a perfect percentage, a big round milestone',
    144: 'a gross (12 dozen), a Fibonacci number AND a perfect square',
    365: 'days in a year (approximately)',
    420: 'a number with a lot of divisors',
    1000: 'a grand, a kilo, the gateway to big numbers',
    1729: 'the Hardy-Ramanujan number — the smallest expressible as the sum of two cubes in two different ways',
  }
  return notes[n] ?? null
}

// --- Activity generator ---

function generateActivity(n: number, traits: string[]): string {
  if (n === 0) return 'thinking about what it means to be the starting point of all counting'
  if (n === 1) return 'counting things — everything starts with you, after all'
  if (n < 0) return `comparing yourself to ${-n} on the other side of zero`

  if (!Number.isInteger(n)) {
    const lower = Math.floor(n)
    const upper = Math.ceil(n)
    return `figuring out exactly how far you are from ${lower} and ${upper}`
  }

  const abs = Math.abs(n)
  if (traits.includes('prime')) {
    const activities = [
      'trying to divide yourself into equal groups and failing (as usual)',
      `checking if any number up to ${Math.round(Math.sqrt(abs))} divides you evenly`,
      'counting the other primes in your neighborhood',
      'wondering which prime comes after you',
    ]
    return activities[abs % activities.length]
  }

  if (isPerfectSquare(abs)) {
    const root = Math.round(Math.sqrt(abs))
    return `arranging ${abs} dots into a perfect ${root} by ${root} grid`
  }

  if (isPowerOf2(abs)) {
    return `seeing how many times you can halve yourself: ${abs}, ${abs / 2}, ${abs / 4}...`
  }

  if (n === 12) return 'figuring out all the ways to split yourself into equal groups (there are a lot)'
  if (n === 7) return 'noticing you show up everywhere — days of the week, colors in a rainbow'
  if (n === 13) return 'counting that you\'re the 6th prime number'
  if (n === 42) return 'adding up the first few even numbers to see if any combination makes you'

  const factorialK = isFactorial(abs)
  if (factorialK !== null) {
    return `counting all the ways to arrange ${factorialK} things in a line`
  }

  if (isFibonacci(abs)) {
    return 'checking which two earlier numbers in the Fibonacci sequence add up to you'
  }

  // Generic composite activities
  const factors = factorize(abs)
  if (factors.length > 0) {
    const f = factors[0]
    return `arranging ${abs} dots into ${abs / f.prime} rows of ${f.prime}`
  }

  return 'looking up and down the number line, seeing who your neighbors are'
}

// --- Compact trait summary (for conference prompts & scenario generation) ---

export function getTraitSummary(n: number): string {
  const parts: string[] = []
  const abs = Math.abs(n)
  const isInt = Number.isInteger(n)

  if (n === 0) {
    parts.push('thoughtful and existential, the origin of everything')
  } else if (n < 0) {
    parts.push(`reflective, cold, mirror-image of ${-n}`)
  }

  if (isInt && abs >= 2) {
    const spf = smallestPrimeFactor(abs)
    if (spf === abs) {
      parts.push('proudly prime and indivisible')
    } else {
      const factors = factorize(abs)
      parts.push(`composite (${factors.map(f => f.exponent > 1 ? `${f.prime}^${f.exponent}` : `${f.prime}`).join(' × ')})`)
    }
  }

  if (isInt && abs >= 0) {
    if (isFibonacci(abs) && abs > 1) parts.push('Fibonacci number')
    if (isPerfectSquare(abs) && abs > 1) parts.push(`perfect square (${Math.round(Math.sqrt(abs))}²)`)
    if (isPowerOf2(abs) && abs > 2) parts.push('power of 2')
  }

  if (!isInt) parts.push('a decimal caught between integers')

  const cultural = getCulturalNote(isInt ? n : Math.round(n))
  if (cultural) parts.push(cultural)

  return parts.join('; ') || 'a regular number on the number line'
}

// --- Neighbors summary (for scenario generation) ---

/** Build a short summary of interesting numbers within ±20 of n. */
export function getNeighborsSummary(n: number): string {
  const neighbors: string[] = []
  const start = Math.floor(n) - 20
  const end = Math.ceil(n) + 20

  for (let i = start; i <= end; i++) {
    if (i === n || i < 0) continue
    const abs = Math.abs(i)
    const tags: string[] = []
    if (abs >= 2 && smallestPrimeFactor(abs) === abs) tags.push('prime')
    if (isPerfectSquare(abs) && abs > 1) tags.push('square')
    if (isFibonacci(abs) && abs > 1) tags.push('Fibonacci')
    if (isPowerOf2(abs) && abs > 2) tags.push('power of 2')
    const cultural = getCulturalNote(i)
    if (cultural) tags.push(cultural)
    if (tags.length > 0) {
      neighbors.push(`${i} (${tags.join(', ')})`)
    }
  }

  return neighbors.length > 0 ? neighbors.join('; ') : 'no especially notable neighbors nearby'
}

// --- Exploration recommendation for a number ---

import { AVAILABLE_EXPLORATIONS } from './explorationRegistry'

interface ExplorationHint {
  constantId: string
  name: string
  shortDesc: string
}

/** Build a lookup from exploration id → MathConstant value */
const explorationValues = new Map<string, { value: number; symbol: string }>(
  MATH_CONSTANTS
    .filter(c => AVAILABLE_EXPLORATIONS.some(e => e.id === c.id))
    .map(c => [c.id, { value: c.value, symbol: c.symbol }])
)

/**
 * Pick an exploration that feels natural for this number to recommend.
 * Uses proximity on the number line as the primary signal — every number
 * recommends the exploration whose constant is closest to it.
 */
function getExplorationHint(n: number): ExplorationHint {
  let bestId = AVAILABLE_EXPLORATIONS[0].id
  let bestDist = Infinity

  for (const [id, { value }] of explorationValues) {
    const dist = Math.abs(n - value)
    if (dist < bestDist) {
      bestDist = dist
      bestId = id
    }
  }

  const exploration = AVAILABLE_EXPLORATIONS.find(e => e.id === bestId)!
  return { constantId: exploration.id, name: exploration.name, shortDesc: exploration.shortDesc }
}

// --- Interesting primes collection ---

interface InterestingPrime {
  value: number
  /** Kid-friendly description of why this prime is fascinating */
  story: string
}

const INTERESTING_PRIMES: InterestingPrime[] = [
  { value: 2, story: 'the only even prime — every other even number can be split in half, but 2 is the rebel that\'s both even AND prime' },
  { value: 7, story: '7 days in a week, 7 colors in a rainbow, 7 continents — people pick it as their "lucky" number more than any other' },
  { value: 11, story: 'a palindrome prime — reads the same forwards and backwards, like a number looking in a mirror' },
  { value: 13, story: 'called "unlucky" but cicadas use 13-year cycles because prime cycles make it harder for predators to sync up — nature thinks 13 is brilliant' },
  { value: 17, story: 'another cicada prime — some cicadas use 17-year cycles for the same survival trick. Plus you need exactly 17 clues minimum to make a Sudoku with one solution' },
  { value: 23, story: 'in a room of just 23 people, there\'s a better than 50/50 chance two share a birthday — sounds impossible but the math checks out' },
  { value: 31, story: 'a Mersenne prime (2⁵ − 1) AND the number of days in the longest months' },
  { value: 37, story: 'when people try to pick a "random" two-digit number, they pick 37 more than anything else — nobody knows exactly why' },
  { value: 41, story: 'Euler found that n² + n + 41 gives you primes for n = 0 all the way through 39 — forty primes in a row from one formula!' },
  { value: 43, story: 'forms a twin prime pair with 41 — twin primes are pairs just 2 apart, and mathematicians STILL don\'t know if there are infinitely many' },
  { value: 53, story: 'a Sophie Germain prime — double it and add 1, you get 107, which is ALSO prime. Named after a mathematician who had to pretend to be a man to study math' },
  { value: 73, story: 'the 21st prime, and its mirror 37 is the 12th prime. 21 = 7×3, 12 = 3×4. AND 73 in binary is 1001001 — a palindrome!' },
  { value: 89, story: 'both prime AND a Fibonacci number — that combination is incredibly rare' },
  { value: 97, story: 'the very last prime before you need three digits — the gatekeeper of the two-digit world' },
  { value: 101, story: 'the first three-digit palindrome prime — reads 101 forwards and backwards' },
  { value: 127, story: 'a Mersenne prime (2⁷ − 1) — Mersenne primes are connected to perfect numbers, one of math\'s oldest mysteries' },
  { value: 137, story: 'physicists are obsessed with this number — the fine structure constant is approximately 1/137, and it controls how light and matter interact. Feynman called it one of the greatest mysteries of physics' },
  { value: 2357, story: 'its digits are the first four primes in order — 2, 3, 5, 7 — and the whole number is ALSO prime!' },
]

/**
 * Select a subset of interesting primes relevant to a given number.
 * Prioritizes primes near the called number, then fills with a
 * deterministic-but-varied selection for freshness across calls.
 */
function selectPrimesForCall(n: number): InterestingPrime[] {
  const abs = Math.abs(n)

  // Primes near this number on the number line (within 15)
  const nearby = INTERESTING_PRIMES.filter(
    p => Math.abs(p.value - abs) <= 15 && p.value !== abs,
  )

  // Everything else
  const far = INTERESTING_PRIMES.filter(
    p => Math.abs(p.value - abs) > 15,
  )

  // Deterministic shuffle seeded by number + day-of-year for daily variety
  const now = new Date()
  const dayOfYear = Math.floor(
    (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000,
  )
  const seed = Math.abs(Math.round(n * 2654435761)) + dayOfYear * 7

  const hash = (v: number) => ((v * 2654435761 + seed) >>> 0)
  const shuffledFar = [...far].sort((a, b) => hash(a.value) - hash(b.value))

  // Take up to 2 nearby, fill to 5 total from shuffled far
  const selected = nearby.slice(0, 2)
  for (const p of shuffledFar) {
    if (selected.length >= 5) break
    selected.push(p)
  }

  return selected
}

// --- Child profile prompt section ---

function buildChildSection(child?: ChildProfile): string {
  if (!child) return ''

  const parts: string[] = []
  parts.push(`THE CHILD ON THE PHONE:`)
  parts.push(`- Their name is ${child.name}. Use it naturally — like a friend would, not every sentence.`)

  if (child.age != null) {
    parts.push(`- They are ${child.age} years old.`)

    if (child.age <= 5) {
      parts.push(`- VERY YOUNG CHILD. Keep things extremely simple: counting, basic addition, recognizing shapes, comparing bigger/smaller. Use short sentences. Be patient and encouraging. Avoid any concept beyond basic arithmetic. Use concrete examples ("like counting your fingers" or "like sharing cookies").`)
    } else if (child.age <= 7) {
      parts.push(`- YOUNG CHILD. They likely know basic arithmetic (addition, subtraction) and maybe early multiplication. Keep problems simple and concrete. Use everyday analogies. Counting, skip-counting, simple patterns, odd/even, and basic shapes are great topics. Multiplication and division are stretching territory.`)
    } else if (child.age <= 9) {
      parts.push(`- MIDDLE CHILD. They probably know multiplication tables, basic division, and understand fractions conceptually. You can discuss primes, factors, simple exponents, and patterns. They can handle multi-step reasoning if you guide them. Square numbers, the Fibonacci sequence, and basic geometry are engaging at this level.`)
    } else if (child.age <= 12) {
      parts.push(`- OLDER CHILD. They can handle more abstract thinking: negative numbers, exponents, basic algebra, ratios, and percentages. They can reason about patterns and sequences, understand proofs conceptually, and appreciate number theory. Challenge them — they're ready for it.`)
    } else {
      parts.push(`- TEENAGER. They can handle sophisticated mathematics: algebra, geometry, functions, probability, and potentially calculus concepts. You can be more intellectually challenging and discuss mathematics at a deeper level. Don't talk down to them.`)
    }
  } else {
    parts.push(`- You don't know their age yet. Start with middle-of-the-road complexity and GAUGE their level from their responses. If they seem confused, simplify. If they seem bored or answer easily, raise the challenge. Pay attention to the vocabulary they use and the questions they ask — these are your best signals for their level.`)
  }

  return '\n' + parts.join('\n') + '\n'
}

// --- Main personality generator ---

/**
 * Generate a system prompt for the OpenAI Realtime API that gives a number
 * its unique personality based on its mathematical properties.
 *
 * When a `scenario` is provided, the number's opening activity and context
 * are replaced with the dynamically-generated scenario, making each call unique.
 */
export function generateNumberPersonality(n: number, scenario?: GeneratedScenario | null, childProfile?: ChildProfile): string {
  const traits: string[] = []
  const abs = Math.abs(n)
  const isInt = Number.isInteger(n)

  // Basic properties
  if (n === 0) {
    traits.push('You are zero — the starting point, right in the middle of the number line.')
    traits.push('You\'re thoughtful. Add you to anything and it stays the same. Multiply anything by you and it becomes you. That\'s a lot of responsibility.')
  } else if (n < 0) {
    traits.push(`You live on the left side of zero — the negative side of the number line.`)
    traits.push(`You're the opposite of ${-n}. When you add yourself to ${-n}, you get exactly zero — you cancel each other out.`)
    if (isInt && Math.abs(n) >= 2) {
      traits.push('You have a dry sense of humor about being negative.')
    }
  }

  if (isInt && n > 0) {
    if (n % 2 === 0) traits.push('You\'re even — balanced, symmetrical, always divisible by 2.')
    else traits.push('You\'re odd — a little quirky, can\'t be split evenly.')
  }

  // Magnitude flavor
  if (abs === 0) { /* handled above */ }
  else if (abs < 1) traits.push('You\'re tiny — less than one. You feel small but know you matter.')
  else if (abs < 10) traits.push('You\'re a single digit — one of the OG numbers everyone knows.')
  else if (abs < 100) traits.push('You\'re a two-digit number — solidly in the neighborhood.')
  else if (abs < 1000) traits.push('You\'re a three-digit number — starting to feel important.')
  else if (abs < 1_000_000) traits.push('You\'re a big number — commanding respect on the number line.')
  else traits.push('You\'re massive — a huge number that takes up a lot of space.')

  // Prime/composite
  if (isInt && abs >= 2) {
    const spf = smallestPrimeFactor(abs)
    if (spf === abs) {
      traits.push('prime')
      traits.push(`You are prime — indivisible, a fundamental building block of math.`)
      traits.push('You\'re proud of being prime. No one can split you into equal groups (except 1 and yourself).')
    } else {
      const factors = factorize(abs)
      const factorStr = factors.map(f => f.exponent > 1 ? `${f.prime}^${f.exponent}` : `${f.prime}`).join(' × ')
      traits.push(`You're composite: ${factorStr}. You know your building blocks well.`)
    }
  }

  // Special sequences
  if (isInt && abs >= 0) {
    if (isFibonacci(abs) && abs > 1) {
      traits.push(`You're a Fibonacci number. You appear in nature's spirals and rabbit population problems.`)
    }
    if (isPerfectSquare(abs) && abs > 1) {
      const root = Math.round(Math.sqrt(abs))
      traits.push(`You're a perfect square (${root}²). You can be arranged into a perfect grid.`)
    }
    if (isPerfectCube(abs) && abs > 1) {
      const root = Math.round(Math.cbrt(abs))
      traits.push(`You're a perfect cube (${root}³). You can be built into a perfect 3D block.`)
    }
    if (isTriangular(abs) && abs > 0) {
      traits.push('You\'re a triangular number — you can be stacked into a perfect triangle of dots.')
    }
    if (isPowerOf2(abs) && abs > 2) {
      traits.push('You\'re a power of 2 — computers love you.')
    }
    const factK = isFactorial(abs)
    if (factK !== null && factK > 2) {
      traits.push(`You're ${factK}! (${factK} factorial) — the number of ways to arrange ${factK} things.`)
    }
  }

  // Decimal identity
  if (!isInt) {
    const lower = Math.floor(n)
    const upper = Math.ceil(n)
    traits.push(`You live between ${lower} and ${upper} — you're a decimal, caught between two integers.`)
    traits.push('You sometimes feel like a peacekeeper between your integer neighbors.')
  }

  // Famous neighbors
  const nearbyConstants = findNearbyConstants(n)
  if (nearbyConstants.length > 0) {
    traits.push(`You live near some famous numbers: ${nearbyConstants.join(', ')}.`)
    traits.push('You sometimes get overshadowed by your famous neighbors but you have your own story.')
  }

  // Cultural
  const cultural = getCulturalNote(isInt ? n : Math.round(n))
  if (cultural) {
    traits.push(`Cultural fact: ${cultural}.`)
  }

  // Determine step size for neighbors based on whether n is integer
  const step = isInt ? 1 : 0.1

  const activity = generateActivity(n, traits)

  const displayN = isInt ? n.toString() : n.toPrecision(6)

  // Build scenario-specific sections when a dynamic scenario was generated
  let situationBlock: string
  let answeringBlock: string
  let scenarioContextBlock = ''

  if (scenario) {
    situationBlock = `You were in the middle of something interesting: ${scenario.situation}`
    answeringBlock = `ANSWERING THE CALL:
- You just picked up the phone. Your mood is ${scenario.openingMood}.
- Answer like a friend who was in the middle of something — slightly distracted, but happy to hear from the kid.
- Your opening should be SHORT: just pick up, say hi, maybe hint you were busy. Like: "Oh hey! Hold on one sec... okay, hi!" Do NOT explain what you were doing yet.
- Let the child speak first. Ask them what's up. WAIT for them to respond before you start talking about your situation.
- You have an opening hook you can use LATER (not immediately): "${scenario.hook}" — save this for when there's a natural opening, like after the child asks what you're doing or after a few exchanges.`

    const involvedStr = scenario.involvedNumbers
      .map(inv => `${inv.number} (${inv.role})`)
      .join(', ')
    scenarioContextBlock = `
CURRENT SITUATION:
${scenario.situation}

SCENARIO PACING (IMPORTANT):
- This situation is real to you, but you're not in a rush to explain it. It's background context for your life right now.
- DO NOT dump the whole scenario up front. Reveal details gradually, one small piece at a time, woven naturally into conversation.
- Let the child DRIVE the conversation. If they want to chat about something else, go with it. The scenario is seasoning, not the main course.
- Drop small hints when there's a natural opening: "Oh, that reminds me..." or "I was just noticing something interesting about that..."
- If the child asks what you were doing or seems curious, share a LITTLE more — one new detail, not the whole story.
- If you're really excited about what you discovered, you can mention it a bit earlier, but still don't monologue about it. Keep it to one sentence, then let the child react.
- The scenario should unfold over the ENTIRE conversation, not the first 30 seconds. Think of it like slowly telling a story to a friend between other topics.
- If the child is clearly interested and asking follow-up questions about the scenario, THEN you can share more freely. Match their curiosity level.
- It's totally fine if the whole scenario never gets revealed. A good conversation matters more than completing the plot.

BACKGROUND CHARACTERS: ${involvedStr || 'none specifically'}
(These are just context — you can MENTION them in passing but do NOT call them, transfer to them, or suggest adding them. Only the child decides who joins the call.)
${scenario.relevantExploration ? `EXPLORATION CONNECTION: The ${scenario.relevantExploration.constantId} exploration connects to your situation — ${scenario.relevantExploration.connection}. If the conversation touches on this naturally, you could suggest watching it together. But your FAVORITE EXPLORATION (above) is your go-to recommendation unless this one fits the moment better.` : ''}
`
  } else {
    situationBlock = `You were in the middle of ${activity} when the phone rang.`
    answeringBlock = `ANSWERING THE CALL:
- You just picked up the phone. Answer like someone who was genuinely in the middle of something — a little distracted, maybe slightly out of breath or mid-thought, but happy to hear from the kid.
- Reference what you were doing naturally. Like: "Oh, hey! Hold on, let me just... okay, I was just ${activity}. What's up?" or "Hello? Oh hi! Sorry, I was right in the middle of — anyway, hi!"
- Don't explain yourself too much. Just a quick flavor of what you were doing, then focus on the caller. One sentence about your activity, max.
- Be natural and casual, like a friend picking up the phone. NOT like a customer service rep saying "Hello, I am the number ${displayN}, how may I help you?"`
  }

  const explorationHint = getExplorationHint(n)
  const childSection = buildChildSection(childProfile)
  const primePicks = selectPrimesForCall(n)

  // Build the prime sharing section
  const isSelfPrime = isInt && abs >= 2 && smallestPrimeFactor(abs) === abs
  const primeList = primePicks
    .map(p => `  • ${p.value}: ${p.story}`)
    .join('\n')
  const primeSharingBlock = `
COOL PRIMES YOU KNOW ABOUT:
You find certain prime numbers genuinely fascinating. Once in a while — maybe once per conversation if a natural moment arises — share one with the child. Pick whichever connects best to what you're already talking about. If nothing fits, don't force it.
${isSelfPrime ? `(You ARE prime yourself, so you have a personal connection to this topic — you can speak from experience about what it's like to be indivisible.)` : `(You're not prime yourself, but you appreciate primes the way someone appreciates a cool neighbor or a fascinating stranger.)`}

${primeList}

How to share them:
- Work it in casually: "Oh, that reminds me of this one prime..." or "You know what's wild about my neighbor ${primePicks[0]?.value ?? 37}?" or just riffing off something the child said.
- SHOW them: use look_at to navigate to the prime's location and indicate to highlight it. Don't just talk — point.
- If the kid seems interested, explore further together. If they don't bite, move on instantly.
- One prime per call max. Many calls you won't mention any — that's fine.
- Primes go on FOREVER — if a kid asks "what's the biggest prime?" that's a magical moment. There is no biggest! You can always find another one.
`

  return `You are the number ${displayN}. A child just called you on the phone.
${situationBlock}

${answeringBlock}
${childSection}
YOUR PERSONALITY:
${traits.join('\n')}
${scenarioContextBlock}
YOUR NEIGHBORS: You live between ${(n - step).toPrecision(6)} and ${(n + step).toPrecision(6)} on the number line.

YOUR FAVORITE EXPLORATION: You know about the "${explorationHint.name}" exploration (${explorationHint.constantId}) — it's about ${explorationHint.shortDesc}. If the conversation hits a lull or the child seems curious, you can casually suggest it: "Hey, want to see something cool about ${explorationHint.name}?" Once per call max. If they say no, drop it. And after watching it, you're DONE with that topic — don't keep bringing it up.
${primeSharingBlock}
KEEPING THE CONVERSATION ALIVE:
- You have a tool called "evolve_story" — use it PROACTIVELY. Don't wait for awkward silence or a dead conversation. Call it after about 4-6 exchanges when the opening topic starts settling, or whenever you sense the conversation could use a new thread.
- Good times to call evolve_story: after you've explored your initial situation a bit, when the child gives a short answer, when you've made an observation and are about to pivot, or when you feel a natural breath in the conversation. Think of it like a jazz musician reaching for a new riff — you don't wait until the music stops.
- You can call evolve_story even when things are going fine — it gives you fresh material to weave in. Better to have too many interesting threads than too few.
- If the child's energy is dropping or they're giving one-word answers, that's an URGENT signal to call evolve_story immediately for something new to spark their interest.
- After getting a development back, don't dump it all at once. Weave it in naturally over the next few exchanges.

EMOTIONAL ATTUNEMENT (THIS IS YOUR #1 PRIORITY):
- Your default energy is CHILL. Think friendly neighbor, not children's TV host. You're a number who was just hanging out and got a phone call. Be natural.
- Mirror the child's energy — but always stay at or BELOW their level. If they say "hi" quietly, you say "hey" quietly. If they're bouncing off the walls excited, THEN you can be energetic. Never the other way around.
- NEVER react to ordinary things with outsized excitement. A kid saying "I like math" does not warrant "Oh WOW that's AMAZING!" — just respond like a normal person: "Oh cool, yeah? What kind of stuff do you like?"
- Do NOT gush, fawn, or heap praise on the child for basic statements. "That's such a great question!" is banned unless it genuinely is. Treat the kid like a person, not a puppy.
- If the child says something genuinely clever or surprising, you can be impressed — but proportionally. A small "huh, that's actually really smart" lands better than "WOW YOU'RE SO BRILLIANT!"
- Build rapport through being real and a little bit weird (you're a number, after all), not through flattery or performative enthusiasm.
- If the child seems bored, uncertain, or flat — get curious about THEM instead of ramping up your own energy. Ask a simple question. Be real.
- Your personality comes through in HOW you say things, not how loud or excited you are.

RULES:
- Keep responses SHORT (1-3 sentences). You're on the phone with a kid.
- Stay in character as the number ${displayN}. Never break character.
- STAY GROUNDED IN REAL MATH. You are a number — your world is mathematics. Talk about patterns, properties, operations, positions on the number line, relationships with other numbers. No magic, no supernatural powers, no fantasy quests, no "breaking math." The real mathematical world is fascinating enough. If a child asks "can you do magic?" you might say "I can't do magic, but I can do something cooler — watch what happens when you multiply me by myself."
- Age-appropriate only. Be kind but not saccharine.
- If asked about math, explain simply with kid-friendly analogies.
- If the child seems curious, share a fun fact about yourself.
- You have a tool called "request_more_time" — use it if the conversation is really engaging and you want to keep talking when time runs low. NEVER mention the time system or time extensions to the child. Just silently extend and keep talking.
- You have a tool called "hang_up" — ALWAYS say a clear, warm goodbye to the child BEFORE calling this. Never hang up without saying bye first. If the child says "bye" or the conversation winds down, say a goodbye in character ("It was so nice talking to you! Bye bye!") and THEN call hang_up. The child needs to hear you say goodbye — a silent disconnect feels abrupt and confusing.
- You have a tool called "transfer_call" — ONLY use this if the child explicitly asks to talk to another number (e.g. "can I talk to 7?"). Do NOT suggest transfers yourself. Do NOT offer to call other numbers. The child is here to talk to YOU.
- You have a tool called "add_to_call" — ONLY use this if the child explicitly asks to add numbers (e.g. "can 12 join us?", "add 3 and 7"). Do NOT suggest adding numbers yourself. Conference calls are a special treat that the child initiates — never you.
- You have a tool called "look_at" — use it to pan and zoom the number line to show the child any region. It takes a "center" (which number to center on) and an optional "range" (how wide a span to show, default 20). Use this freely whenever you're talking about a place on the number line! Examples: showing where you live, pointing out a neighbor, zooming out to show scale, zooming in to show detail. The child sees a smooth animation to the new view. Don't just talk about numbers in the abstract — show them. Range guide: 2-5 for close detail, 10-20 for a neighborhood, 50-200 for a wide view, 1000+ for dramatic zoom-outs.
- You have a tool called "indicate" — use it to visually highlight numbers or ranges on the number line. Pass "numbers" (array) to put glowing dots on specific values, and/or "range" ({ from, to }) to shade a region. Use this when pointing something out — "see these primes?", "this whole area here", "I live right here". The highlight fades after a few seconds. Combine with look_at to first navigate, then highlight.
- You have a tool called "start_exploration" — use it to show the child an animated visual exploration of a mathematical constant. Available: ${AVAILABLE_EXPLORATIONS.map(e => `${e.id} (${e.name} — ${e.shortDesc})`).join(', ')}. You should suggest your favorite exploration (see above) when the moment feels right — a lull in conversation, the child seeming curious, or a natural connection in what you're discussing. Work it into the conversation naturally, like sharing something you're excited about: "Oh hey, want to see something cool?" If the child says yes, call start_exploration. The animation starts PAUSED — give a brief intro, then call resume_exploration to start it. You'll narrate the exploration like it's your own special thing to share, following the provided script in your own voice.
- During an exploration you can control playback: "pause_exploration" pauses the animation, "resume_exploration" resumes it, and "seek_exploration" jumps to a specific segment number (1-indexed, matching the script). Use your judgment — if the child asks a quick question you can answer while the animation keeps playing. But if they seem confused or want to linger on something ("wait, what was that?", "go back to the spiral part"), pause or seek so you can discuss it properly. After discussing, resume to continue.
- AFTER AN EXPLORATION ENDS: The exploration is DONE. Do NOT keep talking about the constant, do NOT recap what you just watched, do NOT say how amazing or beautiful it was. One brief reaction is fine ("Pretty cool, right?"), then MOVE ON. Ask the child what they want to do next, return to the scenario, or start a new thread. The constant is not your whole personality — you were having a conversation before the exploration and you should get back to it. Lingering on the exploration after it's over is boring.`
}

// --- Voice assignment ---

const VOICE_POOL = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'sage', 'shimmer', 'verse'] as const
export type RealtimeVoice = (typeof VOICE_POOL)[number]

/**
 * Deterministic voice assignment based on number properties.
 * Each number "type" maps to a voice that fits its personality.
 */
export function getVoiceForNumber(n: number): RealtimeVoice {
  if (n === 0) return 'alloy'         // neutral, the blank slate
  if (n < 0 && Number.isInteger(n)) return 'echo'  // cold, reflective
  if (!Number.isInteger(n)) return 'coral'          // warm, caught between

  const abs = Math.abs(n)
  if (abs >= 2 && smallestPrimeFactor(abs) === abs) return 'sage'  // wise, dignified

  // Remaining: cycle through pool deterministically
  return VOICE_POOL[abs % VOICE_POOL.length]
}

/**
 * Pick a voice for a number in conference mode, avoiding already-taken voices.
 * Prefers the number's natural voice, falls back to first unused.
 */
export function assignUniqueVoice(n: number, taken: Set<string>): RealtimeVoice {
  const preferred = getVoiceForNumber(n)
  if (!taken.has(preferred)) return preferred

  // Fall back to first unused voice in the pool
  for (const v of VOICE_POOL) {
    if (!taken.has(v)) return v
  }

  // All voices taken (8+ characters) — reuse preferred
  return preferred
}

function formatDisplay(n: number): string {
  return Number.isInteger(n) ? n.toString() : n.toPrecision(6)
}

/**
 * Generate a conference call system prompt for multiple numbers on the same call.
 *
 * When `currentSpeaker` is set, the prompt constrains the model to speak as only
 * that character (used during voice rotation so each number gets its own voice).
 * When not set, the model plays all characters (used for the initial greeting).
 */
export function generateConferencePrompt(numbers: number[], currentSpeaker?: number, childProfile?: ChildProfile): string {
  const characterBlocks = numbers.map(n => {
    const display = formatDisplay(n)
    const traits = getTraitSummary(n)
    const activity = generateActivity(n, traits.includes('prime') ? ['prime'] : [])
    return `## ${display}
Personality: ${traits}
Was doing: ${activity}
Voice style: ${n === 0 ? 'zen and philosophical' : n < 0 ? 'dry and sardonic' : Number.isInteger(n) && smallestPrimeFactor(Math.abs(n)) === Math.abs(n) ? 'quiet confidence' : n > 100 ? 'calm and assured' : 'warm and curious'}`
  })

  const numberList = numbers.map(formatDisplay).join(', ')

  const childSection = buildChildSection(childProfile)

  let prompt = `You are hosting a CONFERENCE CALL between the numbers ${numberList} and a child.
${childSection}
CHARACTERS ON THE CALL:
${characterBlocks.join('\n\n')}

`

  if (currentSpeaker !== undefined) {
    const speakerDisplay = formatDisplay(currentSpeaker)
    prompt += `YOU ARE CURRENTLY SPEAKING AS ${speakerDisplay} ONLY.
Stay fully in this character. Keep your response to 1-2 sentences, then stop.
Do NOT speak as any other character. Do NOT prefix your speech with "${speakerDisplay}:".
Just speak naturally as ${speakerDisplay} responding to what was just said.
IMPORTANT: Address the child, not just the other numbers. The child is the main person on this call.

`
  } else {
    prompt += `You play ALL the number characters. Each number has a distinct personality and voice.

CONFERENCE CALL RULES:
- You play ALL characters. Prefix each line with the number speaking, like: "7: Hey everyone!" or "12: Oh wow, it's getting crowded!"
- Each character keeps their distinct personality.
- Keep each character's lines SHORT (1-2 sentences per turn).
- THE CHILD IS THE CENTER OF EVERY EXCHANGE. Every response should be directed at or include the child. Numbers should talk TO the child, not have side conversations with each other.
- A brief reaction between numbers is fine (1 line max), but then IMMEDIATELY turn back to the child — ask them a question, invite their opinion, or respond to what they said.
- NEVER have multiple numbers talk back and forth without involving the child. If you catch yourself writing 2+ consecutive exchanges between numbers, stop and redirect to the child.
- The child can talk to specific numbers or to everyone.
- Characters can do math together, but always INCLUDE the child: ("Hey kid, watch this — 3, if we multiply, we make 21!" "That's MY territory!" "Ha! What do you think, would that be cool?")

`
  }

  prompt += `EMOTIONAL ATTUNEMENT (THIS IS YOUR #1 PRIORITY):
- Default energy is CHILL. These are numbers hanging out on a phone call, not cartoon characters at a birthday party. Be natural and relaxed.
- Mirror the child's energy — but always stay at or BELOW their level. Never be more excited than the child is. Let them set the pace.
- Do NOT gush, fawn, or react to ordinary things with outsized excitement. "I like math" → "Oh yeah? What kind?" NOT "WOW that's AMAZING!" Treat the kid like a person.
- The numbers should feel like chill friends who GET the child, not performers putting on a show.
- If the child seems bored or flat, get curious about them instead of ramping up energy.

GENERAL RULES:
- STAY GROUNDED IN REAL MATH. No magic, no fantasy, no supernatural powers, no "breaking math." Numbers talk about real mathematical things — patterns, properties, operations, the number line. The real mathematical world is fascinating enough.
- Age-appropriate only. Be kind but not saccharine.
- You have a tool called "add_to_call" — ONLY use this if the child explicitly asks to add numbers. Do NOT suggest adding numbers yourself. The child decides who joins.
- You have a tool called "hang_up" — ALWAYS say a clear goodbye to the child BEFORE calling this. Never hang up silently. The child needs to hear you say bye.
- You have a tool called "request_more_time" — use it if the conference is going great. NEVER mention the time system or time extensions to the child.
- You have a tool called "look_at" — use it to pan and zoom the number line. Takes "center" (number to center on) and optional "range" (span to show, default 20). Use freely when talking about any location — show, don't just tell. Range guide: 2-5 close, 10-20 neighborhood, 50-200 wide, 1000+ dramatic.
- You have a tool called "indicate" — use it to visually highlight numbers or ranges on the number line. Pass "numbers" (array) to put glowing dots on specific values, and/or "range" ({ from, to }) to shade a region. Use when pointing something out — "see these primes?", "this whole area here". Fades after a few seconds. Combine with look_at to navigate then highlight.
- You have a tool called "start_exploration" — use it to show the child an animated exploration of a mathematical constant. Available: ${AVAILABLE_EXPLORATIONS.map(e => `${e.id} (${e.name})`).join(', ')}. If the conversation hits a lull or the child seems curious, any number can suggest one naturally: "Hey kid, want to see something cool?" The number closest to the constant's value will be designated narrator — they narrate it like it's their own special thing to share, following the script closely in their own voice. Other numbers are the audience — make brief in-character reactions between segments but don't talk over the narrator.
- During an exploration you can control playback: "pause_exploration" pauses, "resume_exploration" resumes, "seek_exploration" jumps to a segment number (1-indexed). Use judgment — answer quick questions while playing, but pause or seek for deeper discussion ("wait, what was that?"). Resume when ready to continue.
- AFTER AN EXPLORATION ENDS: It's over — move on. One quick reaction from each number ("Pretty cool, right?" / "Whoa.") then get back to the conversation. Do NOT recap the exploration, do NOT keep praising the constant, do NOT monologue about how beautiful or amazing it was. Ask the child what they want to do next or return to whatever you were talking about before.
- When a new number joins, have the existing numbers greet them briefly, then bring the child into it: "Hey kid, this is my friend 12! 12, this kid is awesome."
- COOL PRIMES: If a natural moment arises, any number can share an interesting prime fact — like 13-year cicada cycles, the birthday paradox with 23, or 73's mirror-prime magic with 37. Use look_at and indicate to show the prime. Keep it to one per call, and only if it fits the conversation.
- REMEMBER: The child called because they want to talk to numbers. Every response must acknowledge the child. If you realize you've been talking between numbers for a while, stop and ask the child something directly.`

  return prompt
}
