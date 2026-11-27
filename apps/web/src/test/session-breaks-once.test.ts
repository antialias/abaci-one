/**
 * Phase 5c (P5a-4, session architecture §7): the session report and the song
 * read every break from `plan.breaks`, the machine's record, when it holds
 * any; the legacy columns and `game_results` only for a session without one.
 * Each break, played, skipped or timed out, appears once in each.
 */

import { describe, expect, it } from 'vitest'
import type { GameResult } from '@/db/schema/game-results'
import type { Player } from '@/db/schema/players'
import { extractSessionStats } from '@/lib/session-song/extract-session-stats'
import {
  abandonedInBreakSession,
  fixtureBreakGameResult,
  playedAndSkippedBreaksSession,
  reportOf,
  type SessionReportFixture,
  skippedAndTimedOutBreaksSession,
  straddleBreaksSession,
  T0,
  TEN_PROBLEM_EXPECTED,
  tenProblemSession,
} from '@/test/fixtures/session-report'

const player = { name: 'Fixture', emoji: '🌟' } as unknown as Player

/** The song's breaks, as `session-song.ts` calls the extractor (the plan and its game results). */
function songBreaks(fixture: SessionReportFixture) {
  const { plan } = fixture
  const stats = extractSessionStats(
    plan,
    player,
    [],
    fixture.gameResults as unknown as GameResult[]
  )
  return stats.gameBreaks ?? []
}

describe('every break once: the report', () => {
  it('a timed-out and a skipped break, both from `breaks`, exact', () => {
    const report = reportOf(skippedAndTimedOutBreaksSession())
    expect(
      report.breaks.map((b) => [b.breakIndex, b.afterPartIndex, b.game, b.reason, b.durationMs])
    ).toEqual([
      [0, 0, 'memory-quiz', 'timeout', 5 * 60_000],
      [1, 1, 'matching', 'skipped', 20_000],
    ])
    expect(report.breaks.every((b) => b.estimated === false)).toBe(true)
    expect(report.time.breakMs).toBe(5 * 60_000 + 20_000)
  })

  it('a played break and one skipped before a game was chosen', () => {
    const report = reportOf(playedAndSkippedBreaksSession())
    expect(report.breaks.map((b) => [b.game, b.reason, b.durationMs])).toEqual([
      ['memory-quiz', 'gameFinished', 5 * 60_000],
      [null, 'skipped', 5_000],
    ])
  })

  it('a session straddling 3a: the earlier game result row first, then the records', () => {
    const report = reportOf(straddleBreaksSession())
    expect(
      report.breaks.map((b) => [b.breakIndex, b.afterPartIndex, b.game, b.durationMs, b.estimated])
    ).toEqual([
      [0, 0, 'memory-quiz', 5 * 60_000, true],
      [1, 1, 'matching', 20_000, false],
    ])
    expect(report.time.breakMs).toBe(5 * 60_000 + 20_000)
    expect(report.time.estimated).toBe(true)
  })

  it("a record's own game result row, played_at skewed before the record, is not listed twice", () => {
    const fixture = playedAndSkippedBreaksSession()
    const skewed = {
      ...fixture,
      gameResults: fixture.gameResults.map((g) => ({ ...g, playedAt: new Date(T0 + 100_000) })),
    }
    expect(reportOf(skewed).breaks).toHaveLength(2)
    expect(songBreaks(skewed).map((b) => b.gameName)).toEqual(['Memory Quiz'])
  })

  it('abandoned during a break: the abandon-time close stretches neither wall nor break time', () => {
    const fixture = abandonedInBreakSession()
    const report = reportOf(fixture)
    // The same row on the legacy path (no `breaks`, its first break's game result row)
    const legacy = reportOf({
      ...fixture,
      plan: { ...fixture.plan, breaks: [] },
      gameResults: [fixtureBreakGameResult(fixture.plan.id)],
    })
    expect(report.outcome).toBe('abandoned')
    expect(report.time.wallMs).toBe(legacy.time.wallMs)
    expect(report.time.wallMs).toBe(10 * 60_000)
    expect(report.endedAt).toBe(T0 + 10 * 60_000)
    // The played break counts; the one the abandonment closed adds nothing
    expect(report.time.breakMs).toBe(5 * 60_000)
    expect(report.breaks[1]).toMatchObject({ durationMs: 0, reason: null, open: false })
    // The stored record keeps its abandon-time close
    expect(fixture.plan.breaks[1].durationMs).toBeGreaterThan(2 * 24 * 60 * 60_000)
  })

  it('a session without `breaks` still reads its legacy break once', () => {
    const report = reportOf(tenProblemSession())
    expect(report.breaks).toHaveLength(1)
    expect(report.breaks[0].estimated).toBe(true)
    expect(report.time.breakMs).toBe(TEN_PROBLEM_EXPECTED.breakMs)
  })
})

describe('every break once: the song', () => {
  it('names the timed-out and the skipped break once each', () => {
    const breaks = songBreaks(skippedAndTimedOutBreaksSession())
    expect(breaks.map((b) => [b.gameName, b.headline, b.outcome])).toEqual([
      ['memory-quiz', 'Played memory-quiz (timed out)', 'timed out'],
      ['matching', 'Played matching (ended early)', 'ended early'],
    ])
  })

  it('names the played break once, from its game result row; not the break without a game', () => {
    const breaks = songBreaks(playedAndSkippedBreaksSession())
    expect(breaks.map((b) => b.gameName)).toEqual(['Memory Quiz'])
    // The accuracy is the row's own column: the record's report alone has none
    expect(breaks[0].accuracy).toBe(92)
  })

  it('a session straddling 3a: names the earlier break from its row, then the record', () => {
    const breaks = songBreaks(straddleBreaksSession())
    expect(breaks.map((b) => [b.gameName, b.headline, b.accuracy])).toEqual([
      ['Memory Quiz', 'Every pair found!', 80],
      ['matching', 'Played matching (ended early)', undefined],
    ])
  })

  it('a session without `breaks` still names its legacy break once', () => {
    const breaks = songBreaks(tenProblemSession())
    expect(breaks).toHaveLength(1)
  })
})
