import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  FlaggedAttempt,
  SerializedSlotResult,
} from '@/lib/curriculum/timing/review-types'
import { FlaggedAttemptCard } from '../FlaggedAttemptCard'

let queryClient: QueryClient

beforeEach(() => {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  vi.clearAllMocks()
  global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) } as Response)
})

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
)

/**
 * The LITMUS attempt (acceptance criterion 1): a legacy record with NO #156
 * capture flags whose effective time exceeds the 5-minute cap (the real prod
 * 8h01m 2026-05-28 value). Classification is read-time, so it arrives here as a
 * Tier-1 / legacy-implausible flagged attempt with no DB repair.
 */
const legacyResult: SerializedSlotResult = {
  slotId: 'slot-1',
  partNumber: 1,
  slotIndex: 0,
  problem: { terms: [12, 34], answer: 46, skillsRequired: [] },
  studentAnswer: 46,
  isCorrect: true,
  responseTimeMs: 28_860_000, // 8h 1m — no wasIdleCapped / raw / cap fields
  skillsExercised: [],
  usedOnScreenAbacus: false,
  timestamp: '2026-05-28T10:00:00.000Z',
  hadHelp: false,
  incorrectAttempts: 0,
}

const legacyAttempt: FlaggedAttempt = {
  sessionId: 'session-1',
  completedAt: '2026-05-28T10:05:00.000Z',
  resultIndex: 0,
  tier: 'tier1',
  reason: 'legacy-implausible',
  effectiveMs: 28_860_000,
  resolved: false,
  result: legacyResult,
}

describe('FlaggedAttemptCard — legacy 8h01m litmus', () => {
  it('renders the legacy poison attempt as a flagged, actionable card', () => {
    render(<FlaggedAttemptCard playerId="player-1" attempt={legacyAttempt} />, { wrapper })

    // Tier-1 legacy copy + the human-formatted recorded time.
    expect(screen.getByText('Unrealistic')).toBeInTheDocument()
    expect(screen.getAllByText('8h 1m').length).toBeGreaterThan(0)
    expect(screen.getByText(/12 \+ 34 = 46/)).toBeInTheDocument()

    // All four repair affordances are actionable (no DB pre-repair needed).
    expect(screen.getByRole('button', { name: /Don’t count this timing/i })).toBeEnabled()
    expect(screen.getByRole('button', { name: /Set exact time/i })).toBeEnabled()
    expect(screen.getByRole('button', { name: /Don’t count toward progress/i })).toBeEnabled()
  })

  it('omit-from-timing calls the results PATCH with scope=timing', async () => {
    render(<FlaggedAttemptCard playerId="player-1" attempt={legacyAttempt} />, { wrapper })

    fireEvent.click(screen.getByRole('button', { name: /Don’t count this timing/i }))

    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/curriculum/player-1/sessions/plans/session-1/results/0',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ action: 'exclude', scope: 'timing' }),
      })
    )
  })

  it('omit-from-mastery calls the results PATCH with scope=mastery', async () => {
    render(<FlaggedAttemptCard playerId="player-1" attempt={legacyAttempt} />, { wrapper })

    fireEvent.click(screen.getByRole('button', { name: /Don’t count toward progress/i }))

    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/curriculum/player-1/sessions/plans/session-1/results/0',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ action: 'exclude', scope: 'mastery' }),
      })
    )
  })
})

describe('FlaggedAttemptCard — set exact time', () => {
  it('submits set_time with the entered seconds converted to ms', async () => {
    render(<FlaggedAttemptCard playerId="player-1" attempt={legacyAttempt} />, { wrapper })

    fireEvent.click(screen.getByRole('button', { name: /Set exact time/i }))
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '12' } })
    fireEvent.click(screen.getByRole('button', { name: /Save time/i }))

    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/curriculum/player-1/sessions/plans/session-1/results/0',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ action: 'set_time', adjustedResponseTimeMs: 12_000 }),
      })
    )
  })
})

describe('FlaggedAttemptCard — resolved state', () => {
  it('offers to re-count a timing that was already omitted', () => {
    const omitted: FlaggedAttempt = {
      ...legacyAttempt,
      resolved: true,
      effectiveMs: null,
      result: {
        ...legacyResult,
        timingReview: {
          omitFromTiming: true,
          reviewedBy: 'user-1',
          reviewedAt: '2026-06-01T00:00:00.000Z',
        },
      },
    }
    render(<FlaggedAttemptCard playerId="player-1" attempt={omitted} />, { wrapper })

    expect(screen.getByText('✓ Reviewed')).toBeInTheDocument()
    expect(screen.getByText('Not counted')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Count this timing again/i })).toBeInTheDocument()
  })

  it('hides the set-time controls while the sample is omitted (no silent no-op)', () => {
    const omitted: FlaggedAttempt = {
      ...legacyAttempt,
      resolved: true,
      effectiveMs: null,
      result: {
        ...legacyResult,
        timingReview: {
          omitFromTiming: true,
          reviewedBy: 'user-1',
          reviewedAt: '2026-06-01T00:00:00.000Z',
        },
      },
    }
    render(<FlaggedAttemptCard playerId="player-1" attempt={omitted} />, { wrapper })

    // While omitted the primary CTA is re-include; set-time / confirm are hidden.
    expect(screen.queryByRole('button', { name: /Set exact time/i })).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /This time is real/i })
    ).not.toBeInTheDocument()
  })
})

describe('FlaggedAttemptCard — confirm timing is real', () => {
  it('offers "This time is real — keep it" on an unresolved flag and PATCHes confirm_timing', async () => {
    render(<FlaggedAttemptCard playerId="player-1" attempt={legacyAttempt} />, { wrapper })

    fireEvent.click(screen.getByRole('button', { name: /This time is real — keep it/i }))

    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/curriculum/player-1/sessions/plans/session-1/results/0',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ action: 'confirm_timing' }),
      })
    )
  })

  it('shows an undo affordance once confirmed and PATCHes unconfirm_timing', async () => {
    const confirmed: FlaggedAttempt = {
      ...legacyAttempt,
      resolved: true,
      result: {
        ...legacyResult,
        timingReview: {
          timingConfirmed: true,
          reviewedBy: 'user-1',
          reviewedAt: '2026-06-01T00:00:00.000Z',
        },
      },
    }
    render(<FlaggedAttemptCard playerId="player-1" attempt={confirmed} />, { wrapper })

    // No re-offer to confirm; instead an undo.
    expect(
      screen.queryByRole('button', { name: /This time is real — keep it/i })
    ).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Undo/i }))

    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/curriculum/player-1/sessions/plans/session-1/results/0',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ action: 'unconfirm_timing' }),
      })
    )
  })
})
