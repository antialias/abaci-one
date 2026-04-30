import type { LLMResponse } from '@soroban/llm-client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SongPromptInput } from '../extract-session-stats'
import { generateSongPrompt, type SongLLMOutput } from '../prompt-generator'

const { callMock } = vi.hoisted(() => ({
  callMock: vi.fn(),
}))

vi.mock('@/lib/llm', () => ({
  llm: {
    call: callMock,
  },
}))

vi.mock('@/lib/ai-usage/llm-middleware', () => ({
  trackedCall: vi.fn(),
}))

function makeInput(): SongPromptInput {
  return {
    player: { name: 'Sonia', emoji: '*' },
    currentSession: {
      accuracy: 0.8,
      problemsDone: 10,
      problemsTotal: 10,
      skillsPracticed: ['Direct Addition'],
      bestCorrectStreak: 3,
      partTypes: ['Use Abacus'],
      durationMinutes: 5,
      helpUsed: false,
      totalIncorrectAttempts: 2,
      helpMoments: 0,
      retryMoments: 1,
      averageResponseSeconds: 5,
    },
    practiceDrama: {
      storyAngle: 'the 9 + 6 = 15 comeback',
      arcs: ['Comeback: 9 + 6 = 15 took 3 attempts and finished right.'],
      problemMoments: [
        {
          kind: 'comeback',
          reason: 'came back on this problem after 3 attempts',
          problem: '9 + 6 = 15',
          partType: 'Use Abacus',
          purpose: 'challenge',
          answer: 15,
          studentAnswers: [11, 15],
          attempts: 3,
          incorrectAttempts: 2,
          outcome: 'eventually_correct',
          skills: ['+6 = +10 - 4'],
          strategySteps: ['9 + 6 = 15 using +6 = +10 - 4'],
          responseSeconds: 12,
        },
      ],
      skillSpotlights: [
        {
          skill: '+6 = +10 - 4',
          attempts: 3,
          correct: 1,
          problems: 1,
          exampleProblems: ['9 + 6 = 15'],
        },
      ],
    },
    history: {
      recentSessionCount: 0,
      averageAccuracy: 0,
      trend: 'steady',
    },
  }
}

function makeOutput(overrides: Partial<SongLLMOutput> = {}): SongLLMOutput {
  return {
    title: "Sonia's Practice Beat",
    positive_global_styles: ['children', 'upbeat', 'pop'],
    negative_global_styles: ['explicit', 'sad'],
    sections: [
      {
        section_name: 'Verse 1',
        positive_local_styles: ['bright'],
        negative_local_styles: [],
        duration_ms: 12_000,
        lines: ['Sonia saw nine plus six equals fifteen'],
      },
      {
        section_name: 'Chorus',
        positive_local_styles: ['catchy'],
        negative_local_styles: [],
        duration_ms: 9_000,
        lines: ['Sonia kept the rhythm bright'],
      },
      {
        section_name: 'Verse 2',
        positive_local_styles: ['warm'],
        negative_local_styles: [],
        duration_ms: 12_000,
        lines: ['Used plus six equals plus ten minus four'],
      },
      {
        section_name: 'Final Chorus',
        positive_local_styles: ['celebration'],
        negative_local_styles: [],
        duration_ms: 9_000,
        lines: ['Sonia carried on'],
      },
    ],
    ...overrides,
  }
}

function makeInvalidOutput(): SongLLMOutput {
  return makeOutput({
    title: "Sonia's Bridge",
    sections: [
      ...makeOutput().sections.slice(0, 2),
      {
        section_name: 'Bridge',
        positive_local_styles: ['spoken'],
        negative_local_styles: [],
        duration_ms: 8_000,
        lines: ['Sonia took a halftime lap'],
      },
      ...makeOutput().sections.slice(2),
    ],
  })
}

function response(data: SongLLMOutput): LLMResponse<SongLLMOutput> {
  return {
    data,
    usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
    attempts: 1,
    provider: 'test',
    model: 'test-model',
    rawResponse: JSON.stringify(data),
    jsonSchema: '{}',
  }
}

describe('generateSongPrompt validation policy', () => {
  beforeEach(() => {
    callMock.mockReset()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('observe mode records issues and returns the original plan', async () => {
    callMock.mockResolvedValueOnce(response(makeInvalidOutput()))

    const output = await generateSongPrompt(makeInput(), 'pop', undefined, {
      validationPolicy: {
        mode: 'observe',
        maxRepairAttempts: 0,
        fallbackOnFailedRepair: true,
        logPassingPlans: false,
      },
    })

    expect(callMock).toHaveBeenCalledTimes(1)
    expect(output.title).toBe("Sonia's Bridge")
    expect(output.validation?.outcome).toBe('flagged')
    expect(output.validation?.issues.map((issue) => issue.code)).toContain(
      'unexpected_game_break_section'
    )
  })

  it('repair mode retries and returns a valid repaired plan', async () => {
    callMock
      .mockResolvedValueOnce(response(makeInvalidOutput()))
      .mockResolvedValueOnce(response(makeOutput({ title: "Sonia's Fixed Beat" })))

    const output = await generateSongPrompt(makeInput(), 'pop', undefined, {
      validationPolicy: {
        mode: 'repair',
        maxRepairAttempts: 1,
        fallbackOnFailedRepair: true,
        logPassingPlans: false,
      },
    })

    expect(callMock).toHaveBeenCalledTimes(2)
    expect(output.title).toBe("Sonia's Fixed Beat")
    expect(output.validation?.outcome).toBe('repaired')
    expect(output.validation?.repaired).toBe(true)
  })

  it('repair mode uses fallback when configured and repair fails', async () => {
    callMock
      .mockResolvedValueOnce(response(makeInvalidOutput()))
      .mockResolvedValueOnce(response(makeInvalidOutput()))

    const output = await generateSongPrompt(makeInput(), 'pop', undefined, {
      validationPolicy: {
        mode: 'repair',
        maxRepairAttempts: 1,
        fallbackOnFailedRepair: true,
        logPassingPlans: false,
      },
    })

    expect(callMock).toHaveBeenCalledTimes(2)
    expect(output.validation?.outcome).toBe('fallback')
    expect(output.validation?.fallbackUsed).toBe(true)
    expect(output.plan.sections.some((section) => section.section_name === 'Bridge')).toBe(false)
  })

  it('repair mode can preserve the original plan when fallback is disabled', async () => {
    callMock
      .mockResolvedValueOnce(response(makeInvalidOutput()))
      .mockResolvedValueOnce(response(makeInvalidOutput()))

    const output = await generateSongPrompt(makeInput(), 'pop', undefined, {
      validationPolicy: {
        mode: 'repair',
        maxRepairAttempts: 1,
        fallbackOnFailedRepair: false,
        logPassingPlans: false,
      },
    })

    expect(output.title).toBe("Sonia's Bridge")
    expect(output.validation?.outcome).toBe('flagged')
    expect(output.validation?.fallbackUsed).toBe(false)
  })

  it('enforce mode falls back instead of returning a known-invalid plan', async () => {
    callMock
      .mockResolvedValueOnce(response(makeInvalidOutput()))
      .mockResolvedValueOnce(response(makeInvalidOutput()))

    const output = await generateSongPrompt(makeInput(), 'pop', undefined, {
      validationPolicy: {
        mode: 'enforce',
        maxRepairAttempts: 1,
        fallbackOnFailedRepair: true,
        logPassingPlans: false,
      },
    })

    expect(output.validation?.outcome).toBe('fallback')
    expect(output.plan.sections.some((section) => section.section_name === 'Bridge')).toBe(false)
  })
})
