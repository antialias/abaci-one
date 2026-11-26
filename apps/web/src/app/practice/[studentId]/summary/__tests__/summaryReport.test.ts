/** The summary's report merge (Phase 4b): server copy first, newer live copy wins. */

import { describe, expect, it, vi } from 'vitest'
import { tenProblemSessionReport } from '@/test/fixtures/session-report'
import { pickSummaryReport } from '../summaryReport'

vi.mock('@/lib/socket', () => ({ createSocket: vi.fn() }))

const SESSION = 'fx-ten-problems'
const at = (rowVersion: number, wallMs = 1) => ({
  ...tenProblemSessionReport(),
  rowVersion,
  time: { ...tenProblemSessionReport().time, wallMs },
})

describe('pickSummaryReport', () => {
  it('shows the server copy until the live one arrives', () => {
    const initial = at(14)
    expect(pickSummaryReport(SESSION, initial, undefined)).toBe(initial)
  })

  it('a newer push wins', () => {
    const live = at(15)
    expect(pickSummaryReport(SESSION, at(14), live)).toBe(live)
  })

  it('an older live copy does not replace the server copy', () => {
    const initial = at(15)
    expect(pickSummaryReport(SESSION, initial, at(14))).toBe(initial)
  })

  it('on a rowVersion tie the fresher live copy wins', () => {
    const live = at(14, 2)
    expect(pickSummaryReport(SESSION, at(14, 1), live)).toBe(live)
  })

  it("ignores another session's live report", () => {
    const initial = at(14)
    expect(pickSummaryReport(SESSION, initial, { ...at(20), sessionId: 'other' })).toBe(initial)
    expect(pickSummaryReport(null, null, at(20))).toBeNull()
  })

  it('uses the live copy when the server could not build one', () => {
    const live = at(14)
    expect(pickSummaryReport(SESSION, null, live)).toBe(live)
  })
})
