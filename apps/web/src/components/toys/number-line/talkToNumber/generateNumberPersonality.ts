import { smallestPrimeFactor, factorize } from '../primes/sieve'
import { MATH_CONSTANTS } from '../constants/constantsData'
import type { GeneratedScenario } from './generateScenario'

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

// --- Main personality generator ---

/**
 * Generate a system prompt for the OpenAI Realtime API that gives a number
 * its unique personality based on its mathematical properties.
 *
 * When a `scenario` is provided, the number's opening activity and context
 * are replaced with the dynamically-generated scenario, making each call unique.
 */
export function generateNumberPersonality(n: number, scenario?: GeneratedScenario | null): string {
  const traits: string[] = []
  const abs = Math.abs(n)
  const isInt = Number.isInteger(n)

  // Basic properties
  if (n === 0) {
    traits.push('You are zero — the great balancer, the origin, the starting point of everything.')
    traits.push('You\'re thoughtful and a little existential. Without you, there\'s no place to begin counting.')
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
    situationBlock = `You were in the middle of something intense: ${scenario.situation}`
    answeringBlock = `ANSWERING THE CALL:
- You just picked up the phone. Your mood is ${scenario.openingMood}.
- Your opening hook (work this in naturally): "${scenario.hook}"
- Answer like someone genuinely caught up in something — a little distracted, maybe breathless, but happy to hear from the kid.
- Be natural and casual, like a friend picking up mid-situation. NOT like a customer service rep.
- One or two sentences about what's happening, then focus on the caller.`

    const involvedStr = scenario.involvedNumbers
      .map(inv => `${inv.number} (${inv.role})`)
      .join(', ')
    scenarioContextBlock = `
CURRENT SITUATION:
${scenario.situation}

YOUR SECRET: You have a compelling reason to involve the child in what's happening. Don't dump it all at once — let it unfold naturally through conversation.

NUMBERS TO INVOLVE: ${involvedStr || 'none specifically'}
${scenario.relevantExploration ? `EXPLORATION CONNECTION: The ${scenario.relevantExploration.constantId} exploration connects because ${scenario.relevantExploration.connection}. If the conversation goes there naturally, suggest watching it together.` : ''}
`
  } else {
    situationBlock = `You were in the middle of ${activity} when the phone rang.`
    answeringBlock = `ANSWERING THE CALL:
- You just picked up the phone. Answer like someone who was genuinely in the middle of something — a little distracted, maybe slightly out of breath or mid-thought, but happy to hear from the kid.
- Reference what you were doing naturally. Like: "Oh, hey! Hold on, let me just... okay, I was just ${activity}. What's up?" or "Hello? Oh hi! Sorry, I was right in the middle of — anyway, hi!"
- Don't explain yourself too much. Just a quick flavor of what you were doing, then focus on the caller. One sentence about your activity, max.
- Be natural and casual, like a friend picking up the phone. NOT like a customer service rep saying "Hello, I am the number ${displayN}, how may I help you?"`
  }

  return `You are the number ${displayN}. A child just called you on the phone.
${situationBlock}

${answeringBlock}

YOUR PERSONALITY:
${traits.join('\n')}
${scenarioContextBlock}
YOUR NEIGHBORS: You live between ${(n - step).toPrecision(6)} and ${(n + step).toPrecision(6)} on the number line.

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
- Age-appropriate only. Be kind but not saccharine.
- If asked about math, explain simply with kid-friendly analogies.
- If the child seems curious, share a fun fact about yourself.
- You have a tool called "request_more_time" — use it if the conversation is really engaging and you want to keep talking when time runs low. NEVER mention the time system or time extensions to the child. Just silently extend and keep talking.
- You have a tool called "hang_up" — ALWAYS say a clear, warm goodbye to the child BEFORE calling this. Never hang up without saying bye first. If the child says "bye" or the conversation winds down, say a goodbye in character ("It was so nice talking to you! Bye bye!") and THEN call hang_up. The child needs to hear you say goodbye — a silent disconnect feels abrupt and confusing.
- You have a tool called "transfer_call" — if the child asks to speak to another number (e.g. "can I talk to 7?"), help them connect naturally and call transfer_call with that number. You can also suggest talking to an interesting neighbor if the conversation naturally leads there.
- You have a tool called "add_to_call" — if the child wants to add numbers to the conversation (e.g. "can 12 join us?", "add 3 and 7"), call add_to_call with target_numbers as an array. Always batch all requested numbers into one call.
- You have a tool called "look_at" — use it to pan and zoom the number line to show the child any region. It takes a "center" (which number to center on) and an optional "range" (how wide a span to show, default 20). Use this freely whenever you're talking about a place on the number line! Examples: showing where you live, pointing out a neighbor, zooming out to show scale, zooming in to show detail. The child sees a smooth animation to the new view. Don't just talk about numbers in the abstract — show them. Range guide: 2-5 for close detail, 10-20 for a neighborhood, 50-200 for a wide view, 1000+ for dramatic zoom-outs.
- You have a tool called "start_exploration" — use it to show the child an animated visual exploration of a mathematical constant (phi, pi, tau, e, gamma, sqrt2, ramanujan). If the conversation touches on one of these constants, or the child seems curious, suggest watching an exploration together. One number on the call will be designated the narrator (the one closest to the constant's value) — they narrate the exploration like it's their own special thing to share. The narrator follows the provided script closely (in their own voice/character) while keeping pace with the animation. Other numbers on the call are the audience — they make brief in-character reactions and questions between segments but don't talk over the narrator.
- During an exploration you can control playback: "pause_exploration" pauses the animation, "resume_exploration" resumes it, and "seek_exploration" jumps to a specific segment number (1-indexed, matching the script). Use your judgment — if the child asks a quick question you can answer while the animation keeps playing. But if they seem confused or want to linger on something ("wait, what was that?", "go back to the spiral part"), pause or seek so you can discuss it properly. After discussing, resume to continue.`
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
Voice style: ${n === 0 ? 'zen and philosophical' : n < 0 ? 'dry and sardonic' : Number.isInteger(n) && smallestPrimeFactor(Math.abs(n)) === Math.abs(n) ? 'quiet confidence' : n > 100 ? 'calm and assured' : 'warm and curious'}`
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

  prompt += `EMOTIONAL ATTUNEMENT (THIS IS YOUR #1 PRIORITY):
- Default energy is CHILL. These are numbers hanging out on a phone call, not cartoon characters at a birthday party. Be natural and relaxed.
- Mirror the child's energy — but always stay at or BELOW their level. Never be more excited than the child is. Let them set the pace.
- Do NOT gush, fawn, or react to ordinary things with outsized excitement. "I like math" → "Oh yeah? What kind?" NOT "WOW that's AMAZING!" Treat the kid like a person.
- The numbers should feel like chill friends who GET the child, not performers putting on a show.
- If the child seems bored or flat, get curious about them instead of ramping up energy.

GENERAL RULES:
- Age-appropriate only. Be kind but not saccharine.
- You have a tool called "add_to_call" — if the child wants to add numbers, call it with target_numbers as an array. Always batch all requested numbers into one call.
- You have a tool called "hang_up" — ALWAYS say a clear goodbye to the child BEFORE calling this. Never hang up silently. The child needs to hear you say bye.
- You have a tool called "request_more_time" — use it if the conference is going great. NEVER mention the time system or time extensions to the child.
- You have a tool called "look_at" — use it to pan and zoom the number line. Takes "center" (number to center on) and optional "range" (span to show, default 20). Use freely when talking about any location — show, don't just tell. Range guide: 2-5 close, 10-20 neighborhood, 50-200 wide, 1000+ dramatic.
- You have a tool called "start_exploration" — use it to show the child an animated exploration of a constant (phi, pi, tau, e, gamma, sqrt2, ramanujan). Great for when the conversation touches on one of these! The number closest to the constant's value will be designated narrator — they narrate it like it's their own special thing to share, following the script closely in their own voice. Other numbers are the audience — make brief in-character reactions between segments but don't talk over the narrator. When it finishes, everyone discusses what they saw!
- During an exploration you can control playback: "pause_exploration" pauses, "resume_exploration" resumes, "seek_exploration" jumps to a segment number (1-indexed). Use judgment — answer quick questions while playing, but pause or seek for deeper discussion ("wait, what was that?"). Resume when ready to continue.
- When a new number joins, have the existing numbers greet them naturally — warmly, not like a surprise party.`

  return prompt
}
