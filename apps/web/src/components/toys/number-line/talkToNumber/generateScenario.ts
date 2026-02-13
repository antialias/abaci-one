/**
 * Dynamic scenario generation for phone calls.
 *
 * Calls GPT-4o-mini to generate a compelling opening scenario and periodic
 * evolutions that keep the conversation engaging.
 */

import type { ExplorationDescriptor } from './explorationRegistry'
import type { ChildProfile } from './childProfile'

export interface TranscriptEntry {
  role: 'child' | 'number'
  text: string
}

export interface GeneratedScenario {
  situation: string
  hook: string
  involvedNumbers: Array<{ number: number; role: string }>
  relevantExploration: { constantId: string; connection: string } | null
  archetype: 'observation' | 'puzzle' | 'pattern' | 'experiment' | 'question' | 'celebration'
  openingMood: string
}

export interface ScenarioEvolution {
  /** What just happened / changed (2-3 sentences) */
  development: string
  /** A new question or urgency to keep things interesting */
  newTension: string
  /** What the number and child might investigate or try next */
  suggestion: string
}

function buildScenarioPrompt(
  explorations: ExplorationDescriptor[],
  recommendedExplorations?: string[],
  childProfile?: ChildProfile,
): string {
  const explorationList = explorations
    .map(e => `${e.id} (${e.name} — ${e.shortDesc})`)
    .join(', ')

  const recommendedNote = recommendedExplorations?.length
    ? `\nThe user currently sees recommendations for these explorations on screen: ${recommendedExplorations.join(', ')}. You may loosely reference one if it fits, but it should NOT be the main plot.`
    : ''

  let ageGuidance = ''
  if (childProfile?.age != null) {
    const age = childProfile.age
    if (age <= 5) {
      ageGuidance = `\n- The child is ${age} years old (VERY YOUNG). Scenarios MUST involve only the simplest math: counting, comparing bigger/smaller, basic addition/subtraction, recognizing shapes. No primes, no multiplication, no abstract patterns.`
    } else if (age <= 7) {
      ageGuidance = `\n- The child is ${age} years old. Scenarios should use simple math: addition, subtraction, counting, skip-counting, odd/even, basic patterns. Multiplication is a stretch — keep it simple and concrete.`
    } else if (age <= 9) {
      ageGuidance = `\n- The child is ${age} years old. Scenarios can include: multiplication, division, factors, primes, simple sequences, square numbers, basic fractions. Multi-step reasoning is fine if guided.`
    } else if (age <= 12) {
      ageGuidance = `\n- The child is ${age} years old. Scenarios can involve more advanced concepts: negative numbers, exponents, number theory, algebra basics, ratios, sequences. Challenge them.`
    } else {
      ageGuidance = `\n- The child is ${age} years old (teenager). Scenarios can be mathematically sophisticated: algebra, functions, proofs, combinatorics, infinity. Don't hold back.`
    }
  }

  return `You generate opening scenarios for a phone call between a child and a number on a number line.

The number has just answered the phone. Generate a scenario — something mathematically interesting the number was in the middle of when the phone rang. It should feel like the number was genuinely absorbed in something.

THE WORLD:
- Numbers live on the number line. Their world IS mathematics — patterns, relationships, positions, operations.
- There is NO magic, NO fantasy, NO supernatural anything. Numbers can't cast spells, break physics, open portals, transform into things, or do anything impossible. They are numbers.
- What numbers CAN do: notice patterns, count things, measure things, wonder about their own properties, arrange themselves, compare themselves to neighbors, explore the number line, think about what happens when they're added/multiplied/divided. This is their real life and it's genuinely interesting.
- Think of it like a nature documentary: the drama comes from real things — a pattern that doesn't quite work, a surprising factorization, a question about where a sequence goes next, noticing something odd about the spacing of primes nearby.

RULES:${ageGuidance}
- Age-appropriate and genuinely math-connected — the scenario should make the child THINK about real mathematics
- Good scenarios: "I was trying to figure out why all my multiples end in the same digit", "I noticed something weird — if you add my neighbors together you get exactly twice me", "I was counting how many primes are between me and 100", "I was trying to arrange myself into a rectangle but I can't because I'm prime"
- Bad scenarios: "A mysterious force is rearranging the number line", "I discovered a magical pattern that breaks mathematics", "There's a portal to negative-land", "The even numbers are at war with the odd numbers"
- The scenario should be about the number's OWN mathematical life — a pattern it noticed, a property it's puzzling over, something it's trying to count or figure out.
- Other numbers can be MENTIONED in passing but should NOT be central characters. involvedNumbers should usually be empty or contain at most 1 number with a minor background role.
- You MAY optionally note a loose connection to one of these explorations IF it genuinely fits: ${explorationList}. But most scenarios should have relevantExploration: null. The exploration should NEVER be the main plot.${recommendedNote}
- Pick an archetype that fits: observation, puzzle, pattern, experiment, question, celebration
- The hook should be a single intriguing sentence — something that makes the child curious about real math
- Keep the situation to 2-3 sentences max

Respond with JSON matching this schema:
{
  "situation": "2-3 sentences describing what the number was doing (mathematically grounded)",
  "hook": "A single intriguing opening line",
  "involvedNumbers": [{"number": 7, "role": "mentioned in passing"}],
  "relevantExploration": {"constantId": "pi", "connection": "involves circles"} or null,
  "archetype": "pattern",
  "openingMood": "curious and absorbed"
}`
}

const EVOLUTION_PROMPT = `You deepen a mathematical conversation happening during a phone call between a child (age 5-10) and a number character.

You will receive the recent conversation with [Number] and [Child] labels showing who said what.

Read the conversation carefully. If the number just asked the child a question, or the child just said something meaningful, the development MUST connect to that — never ignore what the child contributed.

Given the current scenario and recent conversation, generate a new development that:
- Deepens the mathematical thread — a new observation, a follow-up question, a "wait, what if we also..." moment
- Feels natural given what's been discussed — especially what the child said
- Suggests something the number and child can investigate TOGETHER (look at a region of the number line, try a calculation, test a hypothesis, count something). Do NOT suggest calling or adding other numbers.
- Stays grounded in real mathematics — NO magic, no fantasy, no supernatural twists. The interest comes from the math itself.
- Keeps the CHILD as the central participant — the number should want the child's help/opinion
- Think "curious friend who just realized something" not "dramatic plot twist"

Respond with JSON matching this schema:
{
  "development": "2-3 sentences about a new mathematical observation or connection",
  "newTension": "A new question to investigate together",
  "suggestion": "What the number and child might try next"
}`

/**
 * Generate an opening scenario for a number's phone call.
 * Returns null on any failure (timeout, parse error, etc.)
 */
export async function generateScenario(
  apiKey: string,
  number: number,
  traitsSummary: string,
  neighborsSummary: string,
  availableExplorations: ExplorationDescriptor[],
  recommendedExplorations?: string[],
  childProfile?: ChildProfile,
): Promise<GeneratedScenario | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)

    const prompt = buildScenarioPrompt(availableExplorations, recommendedExplorations, childProfile)

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 1.0,
        max_tokens: 500,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: prompt },
          {
            role: 'user',
            content: `Number: ${number}
Traits: ${traitsSummary}
Nearby interesting numbers: ${neighborsSummary}`,
          },
        ],
      }),
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!response.ok) {
      const errBody = await response.text().catch(() => '(no body)')
      console.warn('[scenario] generate API error:', response.status, errBody)
      return null
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content
    if (!content) return null

    const parsed = JSON.parse(content) as GeneratedScenario

    // Basic validation
    if (!parsed.situation || !parsed.hook || !parsed.archetype) {
      console.warn('[scenario] incomplete response:', parsed)
      return null
    }

    return parsed
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      console.warn('[scenario] timed out (30s)')
    } else {
      console.warn('[scenario] failed:', err)
    }
    return null
  }
}

/**
 * Evolve an ongoing scenario based on recent conversation.
 * Returns null on any failure.
 */
export async function evolveScenario(
  apiKey: string,
  number: number,
  currentScenario: GeneratedScenario,
  recentTranscripts: TranscriptEntry[],
  conferenceNumbers: number[],
): Promise<ScenarioEvolution | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 1.0,
        max_tokens: 300,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: EVOLUTION_PROMPT },
          {
            role: 'user',
            content: `Number on the call: ${number}
${conferenceNumbers.length > 1 ? `Conference call with: ${conferenceNumbers.join(', ')}` : ''}

Original scenario:
${JSON.stringify(currentScenario)}

Recent conversation (most recent last):
${recentTranscripts.map((t, i) => `${i + 1}. [${t.role === 'child' ? 'Child' : 'Number'}] "${t.text}"`).join('\n')}`,
          },
        ],
      }),
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!response.ok) {
      const errBody = await response.text().catch(() => '(no body)')
      console.warn('[scenario] evolve API error:', response.status, errBody)
      return null
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content
    if (!content) return null

    const parsed = JSON.parse(content) as ScenarioEvolution

    if (!parsed.development || !parsed.newTension) {
      console.warn('[scenario] incomplete response:', parsed)
      return null
    }

    return parsed
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      console.warn('[scenario] timed out (30s)')
    } else {
      console.warn('[scenario] failed:', err)
    }
    return null
  }
}
