/**
 * API route that creates an ephemeral session token for OpenAI Realtime API.
 *
 * POST /api/realtime/session
 * Body: { number: number, playerId?: string }
 * Returns: { clientSecret: string, expiresAt: number, scenario: GeneratedScenario | null, childProfile, profileFailed? }
 */

import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import {
  getVoiceForNumber,
  getTraitSummary,
  getNeighborsSummary,
} from '@/components/toys/number-line/talkToNumber/generateNumberPersonality'
import {
  generateScenario,
  type GeneratedScenario,
} from '@/components/toys/number-line/talkToNumber/generateScenario'
import {
  AVAILABLE_EXPLORATIONS,
  EXPLORATION_IDS,
} from '@/components/toys/number-line/talkToNumber/explorationRegistry'
import type { ChildProfile } from '@/components/toys/number-line/talkToNumber/childProfile'
import { assembleChildProfile } from '@/components/toys/number-line/talkToNumber/assembleChildProfile'
import { answeringMode } from '@/components/toys/number-line/talkToNumber/sessionModes/answeringMode'
import { getAnsweringTools } from '@/components/toys/number-line/talkToNumber/sessionModes/tools'

export const POST = withAuth(async (request) => {
  try {
    const body = await request.json()
    const {
      number,
      playerId,
      recommendedExplorations: rawRecommended,
      previousScenario,
      availablePlayers: rawAvailablePlayers,
    } = body

    if (typeof number !== 'number' || !isFinite(number)) {
      return NextResponse.json({ error: 'number must be a finite number' }, { status: 400 })
    }

    const apiKey = process.env.LLM_OPENAI_API_KEY || process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 503 })
    }

    // Assemble child profile from player data when a playerId is provided
    let childProfile: ChildProfile | undefined
    let profileFailed = false
    if (typeof playerId === 'string' && playerId) {
      const start = Date.now()
      const result = await assembleChildProfile(playerId)
      console.log(
        '[realtime/session] profile assembly for %s took %dms',
        playerId,
        Date.now() - start
      )
      if (result && 'failed' in result) {
        profileFailed = true
      } else {
        childProfile = result
      }
    }

    // Validate available players (for mid-call identification)
    const validAvailablePlayers: Array<{ id: string; name: string; emoji: string }> = Array.isArray(
      rawAvailablePlayers
    )
      ? rawAvailablePlayers.filter(
          (p: unknown): p is { id: string; name: string; emoji: string } =>
            typeof p === 'object' &&
            p !== null &&
            typeof (p as Record<string, unknown>).id === 'string' &&
            typeof (p as Record<string, unknown>).name === 'string' &&
            typeof (p as Record<string, unknown>).emoji === 'string'
        )
      : []

    // Validate recommended explorations (filter to known IDs)
    const recommendedExplorations: string[] | undefined = Array.isArray(rawRecommended)
      ? rawRecommended.filter(
          (id: unknown) => typeof id === 'string' && EXPLORATION_IDS.has(id as string)
        )
      : undefined

    // Reuse scenario from a prior call to the same number, or generate a new one
    let scenario: Awaited<ReturnType<typeof generateScenario>>
    if (previousScenario?.situation && previousScenario?.hook) {
      scenario = previousScenario as GeneratedScenario
    } else {
      scenario = await generateScenario(
        apiKey,
        number,
        getTraitSummary(number),
        getNeighborsSummary(number),
        AVAILABLE_EXPLORATIONS,
        recommendedExplorations?.length ? recommendedExplorations : undefined,
        childProfile
      )
    }

    // If scenario generation failed (API quota, etc.) and we're not reusing a prior one,
    // bail early — otherwise the call connects but the number never speaks.
    if (!scenario && !previousScenario) {
      console.warn('[realtime/session] scenario generation returned null for number %d', number)
      return NextResponse.json(
        {
          error: 'Phone calls are taking a break right now. Try again later!',
          code: 'quota_exceeded',
        },
        { status: 502 }
      )
    }

    // Use answering mode for initial session — focused greeting prompt + minimal tools
    const answeringCtx = {
      calledNumber: number,
      scenario: scenario ?? null,
      childProfile,
      profileFailed,
      conferenceNumbers: [number],
      currentSpeaker: number,
      activeGameId: null,
      gameState: null,
      availablePlayers: validAvailablePlayers,
      currentInstructions: null,
      sessionActivity: { gamesPlayed: [], explorationsLaunched: [] },
      extensionAvailable: true,
    }
    const instructions = answeringMode.getInstructions(answeringCtx)
    const tools = getAnsweringTools()

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
          threshold: 0.8, // Higher = less sensitive (default 0.5). Prevents echo/ambient triggering.
          prefix_padding_ms: 300, // Audio to include before detected speech start
          silence_duration_ms: 700, // How long silence before turn ends (default 500)
        },
        tools,
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('[realtime/session] OpenAI error:', response.status, errText)

      // Parse the OpenAI error body to classify the failure
      let code = 'unavailable'
      let friendlyMessage = 'Phone calls are unavailable right now. Try again later!'
      try {
        const errBody = JSON.parse(errText)
        const errType = errBody?.error?.type || errBody?.error?.code || ''
        if (/insufficient_quota|quota_exceeded|billing/i.test(errType) || response.status === 429) {
          code = 'quota_exceeded'
          friendlyMessage = 'Phone calls are taking a break right now. Try again later!'
        } else if (/rate_limit/i.test(errType)) {
          code = 'rate_limited'
          friendlyMessage = 'Too many calls right now. Try again in a moment!'
        }
      } catch {
        // If we can't parse the error body, use defaults based on status
        if (response.status === 429) {
          code = 'quota_exceeded'
          friendlyMessage = 'Phone calls are taking a break right now. Try again later!'
        }
      }

      return NextResponse.json({ error: friendlyMessage, code }, { status: 502 })
    }

    const data = await response.json()

    return NextResponse.json({
      clientSecret: data.client_secret?.value ?? data.client_secret,
      expiresAt: data.client_secret?.expires_at ?? Date.now() / 1000 + 60,
      scenario,
      childProfile: childProfile ?? null,
      ...(profileFailed && { profileFailed: true }),
      instructions,
    })
  } catch (error) {
    console.error('[realtime/session] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})
