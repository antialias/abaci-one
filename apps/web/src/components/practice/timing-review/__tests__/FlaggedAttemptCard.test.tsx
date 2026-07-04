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

    // Repair affordances are actionable (no DB pre-repair needed).
    expect(screen.getByRole('button', { name: /Ignore this time/i })).toBeEnabled()
    expect(screen.getByRole('button', { name: /Custom/i })).toBeEnabled()
    expect(screen.getByRole('button', { name: /Doesn.t count/i })).toBeEnabled()

    // "Looks right — keep it" is Tier-2 only; vouching a Tier-1 broken/idle
    // value as real is incoherent, so it isn't offered here.
    expect(screen.queryByRole('button', { name: /Looks right/i })).not.toBeInTheDocument()

    // The pace state is spelled out: this legacy value is set aside, not counting.
    expect(document.querySelector('[data-element="axis-status"]')).toHaveTextContent(
      'Not counting'
    )
  })

  it('omit-from-timing calls the results PATCH with scope=timing', async () => {
    render(<FlaggedAttemptCard playerId="player-1" attempt={legacyAttempt} />, { wrapper })

    fireEvent.click(screen.getByRole('button', { name: /Ignore this time/i }))

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

    fireEvent.click(screen.getByRole('button', { name: /Doesn.t count/i }))

    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/curriculum/player-1/sessions/plans/session-1/results/0',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ action: 'exclude', scope: 'mastery' }),
      })
    )
  })

  it('shows skill progress as a toggle with the current side selected', () => {
    render(<FlaggedAttemptCard playerId="player-1" attempt={legacyAttempt} />, { wrapper })

    // Not excluded → the "Counts toward progress" segment is the pressed one.
    const counts = screen.getByRole('button', { name: /Counts toward progress/i })
    const doesnt = screen.getByRole('button', { name: /Doesn.t count/i })
    expect(counts).toHaveAttribute('aria-pressed', 'true')
    expect(doesnt).toHaveAttribute('aria-pressed', 'false')
  })
})

describe('FlaggedAttemptCard — set exact time', () => {
  it('submits set_time with the entered seconds converted to ms', async () => {
    render(<FlaggedAttemptCard playerId="player-1" attempt={legacyAttempt} />, { wrapper })

    fireEvent.click(screen.getByRole('button', { name: /Custom/i }))
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
    expect(document.querySelector('[data-status="notCounting"]')).toHaveTextContent('Not counting')
    expect(screen.getByRole('button', { name: /Count this time again/i })).toBeInTheDocument()
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

    // While omitted the primary CTA is re-include; the "Count it as" value
    // control (custom entry / confirm) is hidden — you can't set a value on a
    // sample that isn't counting.
    expect(screen.queryByRole('button', { name: /Custom/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Looks right/i })).not.toBeInTheDocument()
  })
})

describe('FlaggedAttemptCard — confirm timing is real', () => {
  // "Keep it counting" is meaningful only for a Tier-2 (slow-but-plausible,
  // currently-counting) attempt — so these use a Tier-2 fixture, not the Tier-1
  // legacy one.
  const tier2Attempt: FlaggedAttempt = {
    ...legacyAttempt,
    tier: 'tier2',
    reason: 'unusual-for-child',
    effectiveMs: 95_000,
    result: { ...legacyResult, responseTimeMs: 95_000 },
  }

  it('offers "Looks right — keep it" on a Tier-2 flag and PATCHes confirm_timing', async () => {
    render(<FlaggedAttemptCard playerId="player-1" attempt={tier2Attempt} />, { wrapper })

    fireEvent.click(screen.getByRole('button', { name: /Looks right — keep it/i }))

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
      ...tier2Attempt,
      resolved: true,
      result: {
        ...tier2Attempt.result,
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
      screen.queryByRole('button', { name: /Looks right — keep it/i })
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

describe('FlaggedAttemptCard — idle-capped attempt with a raw span', () => {
  // Idle-capped: the stored value was trimmed to the 5-min cap while the real
  // un-capped span survives on responseTimeMsRaw. Here the "Count it as" picker
  // offers the full recorded span as a preset next to custom entry, and the
  // vaguer "Looks right — keep it" is suppressed (Tier-1 can't be vouched real).
  const idleCappedAttempt: FlaggedAttempt = {
    ...legacyAttempt,
    reason: 'idle-capped',
    effectiveMs: 300_000,
    result: {
      ...legacyResult,
      responseTimeMs: 300_000,
      responseTimeMsRaw: 28_894_000, // 8h 1m 34s → formats to "8h 1m"
      wasIdleCapped: true,
    } as SerializedSlotResult,
  }

  it('offers the full-recorded preset (with its value) alongside custom entry', () => {
    render(<FlaggedAttemptCard playerId="player-1" attempt={idleCappedAttempt} />, { wrapper })

    // Both value options live inside the one "Count it as" picker.
    const preset = document.querySelector('[data-action="count-full-recorded-time"]')
    expect(preset).not.toBeNull()
    expect(preset).toHaveTextContent('Full recorded')
    expect(preset).toHaveTextContent('8h 1m')
    expect(screen.getByRole('button', { name: /Custom/i })).toBeInTheDocument()

    expect(
      screen.queryByRole('button', { name: /Looks right — keep it/i })
    ).not.toBeInTheDocument()
  })

  it('sets the adjusted time to the raw span when the preset is chosen', async () => {
    render(<FlaggedAttemptCard playerId="player-1" attempt={idleCappedAttempt} />, { wrapper })

    fireEvent.click(screen.getByRole('button', { name: /Full recorded/i }))

    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/curriculum/player-1/sessions/plans/session-1/results/0',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ action: 'set_time', adjustedResponseTimeMs: 28_894_000 }),
      })
    )
  })

  it('marks the chosen value as selected in the picker (so a mis-click is visible)', () => {
    // Already set to the full recorded span → that preset reads as pressed and
    // a reset affordance is present.
    const chosen: FlaggedAttempt = {
      ...idleCappedAttempt,
      resolved: true,
      result: {
        ...idleCappedAttempt.result,
        timingReview: {
          adjustedResponseTimeMs: 28_894_000,
          reviewedBy: 'user-1',
          reviewedAt: '2026-06-01T00:00:00.000Z',
        },
      } as SerializedSlotResult,
    }
    render(<FlaggedAttemptCard playerId="player-1" attempt={chosen} />, { wrapper })

    expect(document.querySelector('[data-action="count-full-recorded-time"]')).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(screen.getByRole('button', { name: /Reset to automatic/i })).toBeInTheDocument()
  })
})
