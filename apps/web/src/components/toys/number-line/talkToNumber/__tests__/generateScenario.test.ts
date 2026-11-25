/**
 * @vitest-environment node
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const call = vi.fn()
const trackedCall = vi.fn()

vi.mock('@/lib/llm', () => ({ llm: { call: (...a: unknown[]) => call(...a) } }))
vi.mock('@/lib/ai-usage/llm-middleware', () => ({
  trackedCall: (...a: unknown[]) => trackedCall(...a),
}))

import { evolveScenario, generateScenario } from '../generateScenario'

const scenario = {
  situation: 'I was counting my factors.',
  hook: 'Did you know I have exactly four factors?',
  involvedNumbers: [],
  relevantExploration: null,
  archetype: 'pattern' as const,
  openingMood: 'curious',
}

describe('generateScenario', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the scenario, recording usage for a known user', async () => {
    trackedCall.mockResolvedValue({ data: scenario })

    const result = await generateScenario(6, 'even', 'near 5 and 7', [], undefined, undefined, 'u1')

    expect(result).toEqual(scenario)
    const [, req, ctx] = trackedCall.mock.calls[0]
    expect(req.prompt).toContain('Number: 6')
    expect(req.timeoutMs).toBe(30_000)
    expect(ctx.userId).toBe('u1')
  })

  it('returns null when the call fails', async () => {
    call.mockRejectedValue(new Error('claude -p timed out'))

    expect(await generateScenario(6, 'even', 'near 5 and 7', [])).toBeNull()
  })
})

describe('evolveScenario', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sends the transcript and returns the evolution', async () => {
    const evolution = { development: 'd', newTension: 't', suggestion: 's' }
    call.mockResolvedValue({ data: evolution })

    const result = await evolveScenario(6, scenario, [{ role: 'child', text: 'why four?' }], [6])

    expect(result).toEqual(evolution)
    expect(call.mock.calls[0][0].prompt).toContain('1. [Child] "why four?"')
  })
})
