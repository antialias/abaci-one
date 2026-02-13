/**
 * API route that creates an ephemeral session token for OpenAI Realtime API.
 *
 * POST /api/realtime/session
 * Body: { number: number }
 * Returns: { clientSecret: string, expiresAt: number, scenario: GeneratedScenario | null }
 */

import { NextResponse } from 'next/server'
import { generateNumberPersonality, getVoiceForNumber, getTraitSummary, getNeighborsSummary } from '@/components/toys/number-line/talkToNumber/generateNumberPersonality'
import { generateScenario } from '@/components/toys/number-line/talkToNumber/generateScenario'
import { AVAILABLE_EXPLORATIONS, EXPLORATION_IDS } from '@/components/toys/number-line/talkToNumber/explorationRegistry'
import type { ChildProfile } from '@/components/toys/number-line/talkToNumber/childProfile'
import { getViewerId } from '@/lib/viewer'
import { getActivePlayers } from '@/lib/arcade/player-manager'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { number, recommendedExplorations: rawRecommended, previousScenario } = body

    if (typeof number !== 'number' || !isFinite(number)) {
      return NextResponse.json(
        { error: 'number must be a finite number' },
        { status: 400 }
      )
    }

    const apiKey = process.env.LLM_OPENAI_API_KEY || process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 503 }
      )
    }

    // Look up the child's profile from the active player
    let childProfile: ChildProfile | undefined
    try {
      const viewerId = await getViewerId()
      const activePlayers = await getActivePlayers(viewerId)
      // Only use profile when exactly one player is active (unambiguous)
      const player = activePlayers.length === 1 ? activePlayers[0] : null
      if (player) {
        childProfile = {
          name: player.name,
          age: player.age ?? null,
        }
        console.log('[realtime/session] child profile:', childProfile.name, 'age:', childProfile.age)
      }
    } catch {
      // Viewer lookup can fail for unauthenticated users — not critical
      console.log('[realtime/session] could not look up child profile')
    }

    // Validate recommended explorations (filter to known IDs)
    const recommendedExplorations: string[] | undefined = Array.isArray(rawRecommended)
      ? rawRecommended.filter((id: unknown) => typeof id === 'string' && EXPLORATION_IDS.has(id as string))
      : undefined

    // Reuse scenario from a prior call to the same number, or generate a new one
    let scenario: Awaited<ReturnType<typeof generateScenario>>
    if (previousScenario?.situation && previousScenario?.hook) {
      scenario = previousScenario
      console.log('[scenario] reusing previous scenario:', scenario.archetype, '—', scenario.hook)
    } else {
      scenario = await generateScenario(
        apiKey,
        number,
        getTraitSummary(number),
        getNeighborsSummary(number),
        AVAILABLE_EXPLORATIONS,
        recommendedExplorations?.length ? recommendedExplorations : undefined,
        childProfile,
      )
      if (scenario) {
        console.log('[scenario] scenario generated:', scenario.archetype, '—', scenario.hook)
      } else {
        console.log('[scenario] no scenario generated, using static personality')
      }
    }

    const instructions = generateNumberPersonality(number, scenario, childProfile)

    const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-realtime-preview-2024-12-17',
        voice: getVoiceForNumber(number),
        instructions,
        input_audio_transcription: { model: 'whisper-1' },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.8,             // Higher = less sensitive (default 0.5). Prevents echo/ambient triggering.
          prefix_padding_ms: 300,     // Audio to include before detected speech start
          silence_duration_ms: 700,   // How long silence before turn ends (default 500)
        },
        tools: [
          {
            type: 'function',
            name: 'request_more_time',
            description:
              'Call this when the conversation is going great and you want more time to keep talking. IMPORTANT: Do NOT mention the time extension to the child. Just keep talking naturally as if nothing happened.',
            parameters: { type: 'object', properties: {} },
          },
          {
            type: 'function',
            name: 'hang_up',
            description:
              'End the phone call. You MUST say a clear, warm goodbye to the child BEFORE calling this — never hang up silently. Say something like "It was great talking to you! Bye!" in character, THEN call this tool. The child needs closure.',
            parameters: { type: 'object', properties: {} },
          },
          {
            type: 'function',
            name: 'transfer_call',
            description:
              'Transfer the phone call to another number. Use this when the child asks to talk to a different number (e.g. "can I talk to 7?"). Say something like "Sure, let me transfer you!" then call this tool.',
            parameters: {
              type: 'object',
              properties: {
                target_number: {
                  type: 'number',
                  description: 'The number to transfer the call to',
                },
              },
              required: ['target_number'],
            },
          },
          {
            type: 'function',
            name: 'add_to_call',
            description:
              'Add one or more numbers to the current call as a conference/group call. Use this when the child wants multiple numbers talking together (e.g. "can 12 join us?", "add 5 and 7 to the call", "let\'s get 3, 8, and 12 on here"). Always pass ALL requested numbers in a single call. After calling this, you will play multiple characters.',
            parameters: {
              type: 'object',
              properties: {
                target_numbers: {
                  type: 'array',
                  items: { type: 'number' },
                  description: 'The numbers to add to the conference call',
                },
              },
              required: ['target_numbers'],
            },
          },
          {
            type: 'function',
            name: 'start_exploration',
            description:
              `Prepare an animated visual exploration of a mathematical constant on the number line. The animation starts PAUSED — introduce the constant to the child first, then call resume_exploration when ready. The number closest to the constant's value will be designated narrator. You will receive the full narration script and segment-by-segment cues. Available constants: ${AVAILABLE_EXPLORATIONS.map(e => `${e.id} (${e.name})`).join(', ')}.`,
            parameters: {
              type: 'object',
              properties: {
                constant_id: {
                  type: 'string',
                  enum: AVAILABLE_EXPLORATIONS.map(e => e.id),
                  description: 'Which mathematical constant to explore',
                },
              },
              required: ['constant_id'],
            },
          },
          {
            type: 'function',
            name: 'pause_exploration',
            description:
              'Pause the currently playing exploration animation. Use this when the child asks a question that needs the animation stopped to discuss, or when you want to linger on something interesting. Use your judgment — simple questions can be answered while the animation keeps playing.',
            parameters: { type: 'object', properties: {} },
          },
          {
            type: 'function',
            name: 'resume_exploration',
            description:
              'Resume the exploration animation from where it was paused. Call this after you\'ve finished discussing a paused moment and are ready to continue.',
            parameters: { type: 'object', properties: {} },
          },
          {
            type: 'function',
            name: 'seek_exploration',
            description:
              'Jump the exploration animation to a specific segment by number (1-indexed, matching the script you received). The animation pauses at that segment so you can discuss it. Use this when the child asks to see a specific part again, e.g. "show me the part about the spiral" — find the matching segment number from the script and seek to it.',
            parameters: {
              type: 'object',
              properties: {
                segment_number: {
                  type: 'number',
                  description: 'Which segment to jump to (1-indexed)',
                },
              },
              required: ['segment_number'],
            },
          },
          {
            type: 'function',
            name: 'look_at',
            description:
              'Pan and zoom the number line to show a specific region. The child sees the number line animate smoothly to the new view. Use this whenever you\'re talking about a specific number or region — e.g. "let me show you where I live", "look over at 100", "let\'s zoom out and see the big picture". You control what the child sees.',
            parameters: {
              type: 'object',
              properties: {
                center: {
                  type: 'number',
                  description: 'The number to center the view on',
                },
                range: {
                  type: 'number',
                  description: 'How wide a range to show (in number-line units). E.g. range=10 shows roughly 5 units on each side of center. Default: 20. Use small values (2-5) to zoom in close, large values (50-1000) to zoom out.',
                },
              },
              required: ['center'],
            },
          },
          {
            type: 'function',
            name: 'evolve_story',
            description:
              'Call this PROACTIVELY to get a fresh story development. Do NOT wait for awkward silence — call it after 4-6 exchanges when the initial topic is settling, when the child gives a short answer, when you feel the conversation could use a new thread, or during any natural breath. Call it even when things are going okay — fresh material keeps the conversation engaging. The only bad time to call this is in the middle of a rapid back-and-forth exchange. You\'ll get back a development, a new tension, and a suggestion to weave in naturally.',
            parameters: { type: 'object', properties: {} },
          },
          {
            type: 'function',
            name: 'start_find_number',
            description:
              'Start a "find the number" game on the number line. Set a target number and challenge the child to find where it lives. The target will be shown in the UI but the child must navigate (pan/zoom) to find its location. You will receive live updates about the child\'s proximity (far, warm, hot, found) and can give verbal hints. Great for teaching number sense!',
            parameters: {
              type: 'object',
              properties: {
                target: {
                  type: 'number',
                  description: 'The target number to find. Can be integer (42), decimal (3.14), negative (-7), etc.',
                },
              },
              required: ['target'],
            },
          },
          {
            type: 'function',
            name: 'stop_find_number',
            description:
              'Stop the current "find the number" game and clear the target from the number line.',
            parameters: { type: 'object', properties: {} },
          },
          {
            type: 'function',
            name: 'indicate',
            description:
              'Highlight specific numbers or a range on the number line with a temporary glowing visual indicator. Use this to point things out — "see these primes?", "this whole area here", "look, I live right here". The highlight fades after a few seconds. You can combine with look_at to first navigate, then highlight.',
            parameters: {
              type: 'object',
              properties: {
                numbers: {
                  type: 'array',
                  items: { type: 'number' },
                  description: 'Specific numbers to highlight with glowing dots on the number line',
                },
                range: {
                  type: 'object',
                  properties: {
                    from: { type: 'number', description: 'Start of the range to highlight' },
                    to: { type: 'number', description: 'End of the range to highlight' },
                  },
                  required: ['from', 'to'],
                  description: 'A range to highlight as a shaded band on the number line',
                },
              },
            },
          },
        ],
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('[realtime/session] OpenAI error:', response.status, errText)
      return NextResponse.json(
        { error: `OpenAI error: ${response.status}` },
        { status: 502 }
      )
    }

    const data = await response.json()

    return NextResponse.json({
      clientSecret: data.client_secret?.value ?? data.client_secret,
      expiresAt: data.client_secret?.expires_at ?? Date.now() / 1000 + 60,
      scenario,
      childProfile: childProfile ?? null,
    })
  } catch (error) {
    console.error('[realtime/session] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
