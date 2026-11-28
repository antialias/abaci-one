/**
 * The attempt panel's review actions address a try by its id (session
 * architecture §10 P6b1-12): `tries/[tryId]`, with the id the views give
 * (`attemptHistoryOf`: the stored id, else `legacy:<planId>:<index>` for a row
 * from before Phase 1).
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SlotResult } from '@/db/schema/session-plans'
import { AttemptHistoryPanel, type ResultWithGlobalIndex } from '../AttemptHistoryPanel'

vi.mock('../../../../styled-system/css', () => ({
  css: vi.fn(() => 'mocked-css-class'),
}))

const STORED_ID = '7d0c5a2e-1b3f-4c6d-8e9f-0a1b2c3d4e5f'

function row(over: Partial<SlotResult>): SlotResult {
  return {
    slotId: 'p1s0',
    partNumber: 1,
    slotIndex: 0,
    problem: { terms: [3, 4], answer: 7, skillsRequired: [] } as never,
    studentAnswer: 1,
    isCorrect: false,
    responseTimeMs: 3000,
    skillsExercised: [],
    usedOnScreenAbacus: false,
    timestamp: new Date('2026-11-01T10:00:00Z'),
    hadHelp: false,
    incorrectAttempts: 0,
    ...over,
  }
}

const onResultEdited = vi.fn()

function renderPanel(results: ResultWithGlobalIndex[]) {
  render(
    <AttemptHistoryPanel
      results={results}
      correctAnswer={7}
      isDark={false}
      studentId="student-1"
      planId="plan-1"
      onResultEdited={onResultEdited}
    />
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) } as Response)
})

const sent = () =>
  vi.mocked(global.fetch).mock.calls.map(([url, init]) => [url, (init as RequestInit).body])

describe('AttemptHistoryPanel review actions (P6b1-12)', () => {
  it('mark correct and exclude address a stored try by its id', async () => {
    renderPanel([{ result: row({ tryId: STORED_ID }), globalIndex: 4, tryId: STORED_ID }])
    fireEvent.click(screen.getByRole('button', { name: 'Mark Correct' }))
    await waitFor(() => expect(onResultEdited).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByRole('button', { name: 'Exclude from Tracking' }))
    await waitFor(() => expect(onResultEdited).toHaveBeenCalledTimes(2))
    expect(sent()).toEqual([
      [
        `/api/curriculum/student-1/sessions/plans/plan-1/tries/${STORED_ID}`,
        JSON.stringify({ action: 'mark_correct' }),
      ],
      [
        `/api/curriculum/student-1/sessions/plans/plan-1/tries/${STORED_ID}`,
        JSON.stringify({ action: 'exclude' }),
      ],
    ])
  })

  it('include addresses a try from before Phase 1 by its legacy id', async () => {
    renderPanel([
      { result: row({ source: 'teacher-excluded' }), globalIndex: 2, tryId: 'legacy:plan-1:2' },
    ])
    fireEvent.click(screen.getByRole('button', { name: 'Include in Tracking' }))
    await waitFor(() => expect(onResultEdited).toHaveBeenCalledTimes(1))
    expect(sent()).toEqual([
      [
        '/api/curriculum/student-1/sessions/plans/plan-1/tries/legacy%3Aplan-1%3A2',
        JSON.stringify({ action: 'include' }),
      ],
    ])
  })

  it("shows the route's error and does not report an edit", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Try not found' }),
    } as Response)
    renderPanel([{ result: row({}), globalIndex: 0, tryId: 'legacy:plan-1:0' }])
    fireEvent.click(screen.getByRole('button', { name: 'Mark Correct' }))
    expect(await screen.findByText(/Try not found/)).toBeInTheDocument()
    expect(onResultEdited).not.toHaveBeenCalled()
  })
})
