/**
 * Practice-kinds client contract (plan of record §3.3, §4 K2 and K4, R14): the
 * two status codes K2 changes resync quietly, and from K4 every try is sent
 * as `record_try` with the envelope and no verdict (the server is the only
 * judge, amendments A1 and A15).
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import type React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionPlan, SlotResult, SlotResultSubmission } from '@/db/schema/session-plans'
import type { TrySubmission } from '@/lib/curriculum/record-try'
import {
  isQuietTryWriteFailure,
  SlotMismatchClientError,
  UnknownKindClientError,
  useRecordRedoResult,
  useRecordSlotResult,
  useRecordTry,
} from '../useSessionPlan'

let queryClient: QueryClient
let fetchMock: ReturnType<typeof vi.fn>

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
)

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

const sentBodies = () =>
  fetchMock.mock.calls
    .filter(([url]) => String(url).endsWith('/sessions/plans/plan-1'))
    .map(([, init]) => JSON.parse(String(init?.body)))

const problem = { terms: [1, 2], answer: 3, skillsRequired: ['basic.directAddition'] }
const answer = {
  tryId: '00000000-0000-4000-8000-000000000001',
  slotId: 'p0s0',
  slotIndex: 0,
  epochNumber: 0,
  problem,
  studentAnswer: 3,
  isCorrect: true,
  responseTimeMs: 2000,
  skillsExercised: problem.skillsRequired,
  usedOnScreenAbacus: false,
  incorrectAttempts: 0,
  hadHelp: false,
  partIndex: 0,
} as SlotResultSubmission & { tryId: string }

beforeEach(() => {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  fetchMock = vi.fn()
  global.fetch = fetchMock as unknown as typeof fetch
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('K2: the status codes R14 changes are quiet', () => {
  it('a do-over of a divulged answer: 409 SLOT_MISMATCH, quiet, and the plan refetched', async () => {
    fetchMock
      .mockResolvedValueOnce(json(409, { code: 'SLOT_MISMATCH', error: 'Answer is for slot p0s0' }))
      .mockResolvedValue(json(200, { plan: { id: 'plan-1' } }))
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    const { result } = renderHook(() => useRecordRedoResult(), { wrapper })

    const error = await result.current
      .mutateAsync({
        playerId: 'p1',
        planId: 'plan-1',
        result: answer as Omit<SlotResult, 'timestamp' | 'partNumber'> & { tryId: string },
        redoContext: {
          itemId: 'p0s0',
          originalPartIndex: 0,
          originalSlotIndex: 0,
          originalWasCorrect: false,
        },
      })
      .catch((e: unknown) => e)

    expect(error).toBeInstanceOf(SlotMismatchClientError)
    expect(isQuietTryWriteFailure(error)).toBe(true)
    expect(invalidate).toHaveBeenCalled()
    expect(console.error).not.toHaveBeenCalled()
  })

  it('a try for a kind the server does not know: 409 unknown_kind, quiet', async () => {
    fetchMock
      .mockResolvedValueOnce(json(409, { code: 'unknown_kind', error: 'Unknown part kind zzz' }))
      .mockResolvedValue(json(200, { plan: { id: 'plan-1' } }))
    const { result } = renderHook(() => useRecordTry(), { wrapper })
    const submission: TrySubmission = {
      tryId: answer.tryId!,
      partIndex: 0,
      itemId: 'z0',
      mode: 'first_or_retry',
      outcome: 'answered',
      answer: 3,
      payload: { kind: 'zzz' },
      timing: { responseTimeMs: 1000 },
      help: { hadHelp: false, incorrectAttempts: 0 },
    }

    const error = await result.current
      .mutateAsync({ playerId: 'p1', planId: 'plan-1', submission })
      .catch((e: unknown) => e)

    expect(error).toBeInstanceOf(UnknownKindClientError)
    expect(isQuietTryWriteFailure(error)).toBe(true)
    expect(sentBodies()[0]).toEqual({ action: 'record_try', result: submission })
    expect(console.error).not.toHaveBeenCalled()
  })
})

describe('K4: every try is sent as record_try, with no verdict', () => {
  it('a first try: the envelope with its round, and the plan read from a reply with a verdict', async () => {
    const stored = { id: 'plan-1', flowState: 'practicing' } as SessionPlan
    fetchMock.mockResolvedValueOnce(
      json(200, {
        plan: stored,
        try: { tryId: answer.tryId, isCorrect: true, outcome: 'answered' },
      })
    )
    const { result } = renderHook(() => useRecordSlotResult(), { wrapper })

    const landed = await result.current.mutateAsync({
      playerId: 'p1',
      planId: 'plan-1',
      result: { ...answer, partIndex: 0 },
    })

    expect(landed).toEqual(stored)
    expect(sentBodies()).toEqual([
      {
        action: 'record_try',
        result: {
          tryId: answer.tryId,
          partIndex: 0,
          itemId: 'p0s0',
          mode: 'first_or_retry',
          round: 0,
          outcome: 'answered',
          answer: 3,
          payload: { kind: 'arithmetic', usedOnScreenAbacus: false },
          timing: { responseTimeMs: 2000 },
          help: { hadHelp: false, incorrectAttempts: 0 },
        },
      },
    ])
    // The screen's check stays on the screen (amendment A15)
    expect(JSON.stringify(sentBodies())).not.toContain('isCorrect')
  })

  it('a retry names its round; a skip is sent with outcome skipped and no answer', async () => {
    fetchMock.mockResolvedValue(json(200, { plan: { id: 'plan-1' } }))
    const { result } = renderHook(() => useRecordSlotResult(), { wrapper })
    const skip = {
      ...answer,
      epochNumber: 1,
      isCorrect: false,
      hadHelp: true,
      helpTrigger: 'manual' as const,
      outcome: 'skipped' as const,
      partIndex: 0,
    }

    await result.current.mutateAsync({ playerId: 'p1', planId: 'plan-1', result: skip })

    const [body] = sentBodies()
    expect(body.action).toBe('record_try')
    expect(body.result).toMatchObject({
      mode: 'first_or_retry',
      round: 1,
      outcome: 'skipped',
      answer: null,
      help: { hadHelp: true, incorrectAttempts: 0, helpTrigger: 'manual' },
    })
    expect(body.result).not.toHaveProperty('isCorrect')
  })

  it('a do-over: mode do_over, its item and part from the redo context, no round', async () => {
    fetchMock.mockResolvedValueOnce(json(200, { plan: { id: 'plan-1' } }))
    const { result } = renderHook(() => useRecordRedoResult(), { wrapper })

    await result.current.mutateAsync({
      playerId: 'p1',
      planId: 'plan-1',
      result: { ...answer, slotId: 'p1s2', slotIndex: 2 } as Omit<
        SlotResult,
        'timestamp' | 'partNumber'
      > & { tryId: string },
      redoContext: {
        itemId: 'p1s2',
        originalPartIndex: 1,
        originalSlotIndex: 2,
        originalWasCorrect: false,
      },
    })

    const [body] = sentBodies()
    expect(body).toEqual({
      action: 'record_try',
      result: {
        tryId: answer.tryId,
        partIndex: 1,
        itemId: 'p1s2',
        mode: 'do_over',
        outcome: 'answered',
        answer: 3,
        payload: { kind: 'arithmetic', usedOnScreenAbacus: false },
        timing: { responseTimeMs: 2000 },
        help: { hadHelp: false, incorrectAttempts: 0 },
      },
    })
  })
})
