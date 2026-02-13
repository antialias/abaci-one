/**
 * Dynamic scenario generation for phone calls.
 *
 * Calls GPT-5-mini to generate a compelling opening scenario and periodic
 * evolutions that keep the conversation engaging.
 */

export interface GeneratedScenario {
  situation: string
  hook: string
  involvedNumbers: Array<{ number: number; role: string }>
  relevantExploration: { constantId: string; connection: string } | null
  archetype: 'mystery' | 'puzzle' | 'discovery' | 'quest' | 'emergency' | 'celebration'
  openingMood: string
}

export interface ScenarioEvolution {
  /** What just happened / changed (2-3 sentences) */
  development: string
  /** A new question or urgency to keep things interesting */
  newTension: string
  /** What the number might do next (call someone, start exploration, etc.) */
  suggestion: string
}

const SCENARIO_PROMPT = `You generate opening scenarios for a phone call between a child (age 5-10) and a number on a number line.

The number has just answered the phone. Generate a compelling scenario — something the number was in the middle of when the phone rang. It should feel like dropping into the middle of a story.

RULES:
- Age-appropriate, exciting, and math-connected
- The scenario should naturally involve 1-2 other nearby numbers
- When it makes sense, connect to one of these explorations the child can watch: phi (Golden Ratio spirals), pi (circles), tau (full turns), e (growth), gamma (Euler-Mascheroni harmonic series), sqrt2 (diagonal of a square), ramanujan (the surprising -1/12)
- Pick an archetype that fits: mystery, puzzle, discovery, quest, emergency, celebration
- The hook should be a single intriguing sentence the number can say right after answering
- Keep the situation to 2-3 sentences max

Respond with JSON matching this schema:
{
  "situation": "2-3 sentences describing what's happening",
  "hook": "A single intriguing opening line the number says",
  "involvedNumbers": [{"number": 7, "role": "the witness"}],
  "relevantExploration": {"constantId": "pi", "connection": "the missing piece is circular"} or null,
  "archetype": "mystery",
  "openingMood": "breathless and excited"
}`

const EVOLUTION_PROMPT = `You advance a story happening during a phone call between a child (age 5-10) and a number character.

Given the current scenario and recent conversation, generate a new development that:
- Raises the stakes or introduces a twist
- Feels natural given what's been discussed
- Suggests a concrete next action (call another number, start an exploration, look at somewhere on the number line)
- Stays age-appropriate and math-connected

Respond with JSON matching this schema:
{
  "development": "2-3 sentences about what just happened or changed",
  "newTension": "A new question or urgency",
  "suggestion": "What the number might do next"
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
): Promise<GeneratedScenario | null> {
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
        max_tokens: 500,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SCENARIO_PROMPT },
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
  recentTranscripts: string[],
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
${recentTranscripts.slice(-3).map((t, i) => `${i + 1}. ${t}`).join('\n')}`,
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
