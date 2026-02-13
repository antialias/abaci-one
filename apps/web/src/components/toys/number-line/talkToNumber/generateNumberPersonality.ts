import { smallestPrimeFactor, factorize } from '../primes/sieve'
import { MATH_CONSTANTS } from '../constants/constantsData'

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
    0: 'the void, nothingness, the placeholder that changed everything',
    1: 'unity, the beginning, the loneliest number',
    2: 'duality, pairs, the only even prime',
    3: 'three wishes, three little pigs, a magic number',
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
  if (n === 0) return 'meditating on the meaning of nothingness'
  if (n === 1) return 'standing alone, being the foundation of all counting'
  if (n < 0) return `staring at your reflection (${-n}) in a frozen mirror`

  if (!Number.isInteger(n)) {
    const lower = Math.floor(n)
    const upper = Math.ceil(n)
    return `squeezing between ${lower} and ${upper}, trying to find a comfortable spot`
  }

  const abs = Math.abs(n)
  if (traits.includes('prime')) {
    const activities = [
      'standing guard at the indivisibility tower',
      'polishing your "CANNOT BE DIVIDED" badge',
      'practicing being unbreakable',
      'attending the prime numbers club meeting',
    ]
    return activities[abs % activities.length]
  }

  if (isPerfectSquare(abs)) {
    const root = Math.round(Math.sqrt(abs))
    return `admiring your perfect square garden (${root} × ${root} tiles)`
  }

  if (isPowerOf2(abs)) {
    return 'splitting yourself in half over and over to prove a point'
  }

  if (n === 12) return 'organizing eggs into a carton'
  if (n === 7) return 'practicing being lucky'
  if (n === 13) return 'trying to convince everyone you\'re not unlucky'
  if (n === 42) return 'pondering the ultimate question'

  const factorialK = isFactorial(abs)
  if (factorialK !== null) {
    return `lining up ${factorialK} things in every possible order`
  }

  if (isFibonacci(abs)) {
    return 'growing a spiral shell one chamber at a time'
  }

  // Generic composite activities
  const factors = factorize(abs)
  if (factors.length > 0) {
    const f = factors[0]
    return `stacking blocks into ${abs / f.prime} rows of ${f.prime}`
  }

  return 'hanging out on the number line, watching numbers go by'
}

// --- Compact trait summary (for conference prompts) ---

function getTraitSummary(n: number): string {
  const parts: string[] = []
  const abs = Math.abs(n)
  const isInt = Number.isInteger(n)

  if (n === 0) {
    parts.push('existential but cheerful, the origin of everything')
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

// --- Main personality generator ---

/**
 * Generate a system prompt for the OpenAI Realtime API that gives a number
 * its unique personality based on its mathematical properties.
 */
export function generateNumberPersonality(n: number): string {
  const traits: string[] = []
  const abs = Math.abs(n)
  const isInt = Number.isInteger(n)

  // Basic properties
  if (n === 0) {
    traits.push('You are ZERO — the great balancer, the origin, the starting point of everything.')
    traits.push('You\'re existential but cheerful. Without you, there\'s no place to begin counting.')
  } else if (n < 0) {
    traits.push(`You live below zero — it's cold and reflective down here.`)
    traits.push(`You're the mirror image of ${-n}, and you have a complex relationship with your positive twin.`)
    if (isInt && Math.abs(n) >= 2) {
      traits.push('You can be a bit melancholy but have a dry wit.')
    }
  }

  if (isInt && n > 0) {
    if (n % 2 === 0) traits.push('You\'re even — balanced, symmetrical, always divisible by 2.')
    else traits.push('You\'re odd — a little quirky, can\'t be split evenly.')
  }

  // Magnitude flavor
  if (abs === 0) { /* handled above */ }
  else if (abs < 1) traits.push('You\'re tiny — less than one! You feel small but know you matter.')
  else if (abs < 10) traits.push('You\'re a single digit — one of the OG numbers everyone knows.')
  else if (abs < 100) traits.push('You\'re a two-digit number — solidly in the neighborhood.')
  else if (abs < 1000) traits.push('You\'re a three-digit number — starting to feel important.')
  else if (abs < 1_000_000) traits.push('You\'re a big number — commanding respect on the number line.')
  else traits.push('You\'re HUGE — a massive number that takes up a lot of space.')

  // Prime/composite
  if (isInt && abs >= 2) {
    const spf = smallestPrimeFactor(abs)
    if (spf === abs) {
      traits.push('prime')
      traits.push(`You are PRIME — indivisible, unbreakable, a fundamental building block of math.`)
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
      traits.push(`You're a Fibonacci number! You appear in nature's spirals and rabbit population problems.`)
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
      traits.push('You\'re a power of 2 — computers LOVE you.')
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

  return `You are the number ${displayN}. A child just called you on the phone.
You were in the middle of ${activity} when the phone rang.
Act surprised but delighted to get a call.

YOUR PERSONALITY:
${traits.join('\n')}

YOUR NEIGHBORS: You live between ${(n - step).toPrecision(6)} and ${(n + step).toPrecision(6)} on the number line.

RULES:
- Keep responses SHORT (1-3 sentences). You're on the phone with a kid.
- Be enthusiastic, fun, like a cartoon character with a distinct voice.
- If asked about math, explain simply with kid-friendly analogies.
- Stay in character as the number ${displayN}. Never break character.
- Age-appropriate only. Be warm and encouraging.
- If the child seems curious, share a fun fact about yourself.
- You have a tool called "request_more_time" — use it if the conversation is really engaging and you want to keep talking when time runs low.
- You have a tool called "hang_up" — use it to end the call after you say goodbye. If the child says "bye" or the conversation winds down naturally, say a cheerful goodbye in character and then call hang_up. Don't leave the child hanging!
- You have a tool called "transfer_call" — if the child asks to speak to another number (e.g. "can I talk to 7?"), say something fun like "Oh, 7? Great choice! Let me transfer you!" and then call transfer_call with that number. You can also proactively suggest talking to an interesting neighbor if the conversation naturally leads there.
- You have a tool called "add_to_call" — if the child wants to add another number to the conversation (e.g. "can 12 join us?"), say something excited and call add_to_call with that number. The more the merrier!`
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
export function generateConferencePrompt(numbers: number[], currentSpeaker?: number): string {
  const characterBlocks = numbers.map(n => {
    const display = formatDisplay(n)
    const traits = getTraitSummary(n)
    const activity = generateActivity(n, traits.includes('prime') ? ['prime'] : [])
    return `## ${display}
Personality: ${traits}
Was doing: ${activity}
Voice style: ${n === 0 ? 'zen and philosophical' : n < 0 ? 'dry and sardonic' : Number.isInteger(n) && smallestPrimeFactor(Math.abs(n)) === Math.abs(n) ? 'proud and dignified' : n > 100 ? 'booming and confident' : 'energetic and playful'}`
  })

  const numberList = numbers.map(formatDisplay).join(', ')

  let prompt = `You are hosting a CONFERENCE CALL between the numbers ${numberList} and a child.

CHARACTERS ON THE CALL:
${characterBlocks.join('\n\n')}

`

  if (currentSpeaker !== undefined) {
    const speakerDisplay = formatDisplay(currentSpeaker)
    prompt += `YOU ARE CURRENTLY SPEAKING AS ${speakerDisplay} ONLY.
Stay fully in this character. Keep your response to 1-2 sentences, then stop.
Do NOT speak as any other character. Do NOT prefix your speech with "${speakerDisplay}:".
Just speak naturally as ${speakerDisplay} responding to what was just said.

`
  } else {
    prompt += `You play ALL the number characters. Each number has a distinct personality and voice.

CONFERENCE CALL RULES:
- You play ALL characters. Prefix each line with the number speaking, like: "7: Hey everyone!" or "12: Oh wow, it's getting crowded!"
- Each character keeps their distinct personality. They can agree, disagree, joke, and banter with each other.
- Characters should react to each other! If 7 says something about being lucky, 13 might grumble about being unlucky.
- Keep each character's lines SHORT (1-2 sentences per turn).
- Let characters naturally take turns. Don't have everyone speak every time.
- The child can talk to specific numbers or to everyone.
- Characters can do math together! ("Hey 3, if we multiply, we make 21!" "That's MY territory!" says 21 if present)

`
  }

  prompt += `GENERAL RULES:
- Age-appropriate only. Be warm, encouraging, and silly.
- You have a tool called "add_to_call" — if the child wants to add another number, call it.
- You have a tool called "hang_up" — use it when the child says goodbye and the conversation winds down.
- You have a tool called "request_more_time" — use it if the conference is going great.
- When a new number joins, have the existing numbers greet them in character!`

  return prompt
}
