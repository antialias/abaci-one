/**
 * Phase 4e (session architecture §7): the song and its share page read the
 * session report.
 *
 * Against real migrations, from the shared fixture session
 * (`tenProblemSession()`: 10 problems, first try 7/10, 3 fixed, 58 s active):
 * - the song input states the report's facts and stamps its `rowVersion`;
 * - the share page and the OG card show the report's numbers, for a song
 *   whose stored input is the pre-4e shape (counted tries 13/10, planned minutes);
 * - the song task announces the song's status to the gated report room.
 */

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as schema from '@/db/schema'
import { DEFAULT_SONG_SHARE_VISIBILITY } from '@/db/schema/song-shares'
import { songFactsOf } from '@/lib/session-song/extract-session-stats'
import { buildSongUserPrompt } from '@/lib/session-song/prompt-generator'
import { getSharedSong, projectSharedSong } from '@/lib/song-share/getSharedSong'
import { SongPreviewArtwork } from '@/lib/song-share/SongPreviewArtwork'
import { buildSongPromptInput, startSessionSongGeneration } from '@/lib/tasks/session-song'
import {
  fixtureBreakGameResult,
  TEN_PROBLEM_EXPECTED,
  tenProblemSession,
  tenProblemSessionReport,
} from './fixtures/session-report'
import {
  createEphemeralDatabase,
  createTestStudent,
  type EphemeralDbResult,
  getCurrentEphemeralDb,
  setCurrentEphemeralDb,
} from './journey-simulator/EphemeralDatabase'

vi.mock('server-only', () => ({}))

vi.mock('@/db', () => ({
  get db() {
    return getCurrentEphemeralDb()
  },
  schema,
}))

const { emitted, fakeIo } = vi.hoisted(() => {
  const emitted: Array<{ room: string | null; event: string; data: any }> = []
  const fakeIo = {
    to: (room: string) => ({
      emit: (event: string, data: unknown) => emitted.push({ room, event, data }),
    }),
    emit: (event: string, data: unknown) => emitted.push({ room: null, event, data }),
  }
  return { emitted, fakeIo }
})
vi.mock('@/lib/socket-io', () => ({
  getSocketIO: async () => fakeIo,
  hasSocketIO: () => true,
}))

// The task runs inline (no runner), and the lyric writer fails: the failure path
vi.mock('@/lib/task-manager', () => ({
  createTask: async (
    type: string,
    input: unknown,
    handler: (h: unknown, i: unknown) => Promise<void>
  ) => {
    // The song row references its task
    await getCurrentEphemeralDb().insert(schema.backgroundTasks).values({ id: 'task-1', type })
    const handle = {
      id: 'task-1',
      emit: () => {},
      setProgress: () => {},
      complete: () => {},
      fail: () => {},
    }
    await handler(handle, input)
    return 'task-1'
  },
}))
vi.mock('@/lib/session-song/prompt-generator', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/session-song/prompt-generator')>()),
  generateSongPrompt: async () => {
    throw new Error('writer unavailable (test)')
  },
}))

// The report reads, passed through; a plan id in `failingReports` throws, and
// `getSessionReport`'s calls are counted (the share page skips it when no
// toggle shows report numbers)
const { failingReports, getSessionReportCalls } = vi.hoisted(() => ({
  failingReports: new Set<string>(),
  getSessionReportCalls: [] as string[],
}))
vi.mock('@/lib/curriculum/session-report-server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/curriculum/session-report-server')>()
  return {
    ...actual,
    loadSessionReport: async (...args: Parameters<typeof actual.loadSessionReport>) => {
      if (failingReports.has(args[0].id)) throw new Error('report not built (test)')
      return actual.loadSessionReport(...args)
    },
    getSessionReport: async (planId: string) => {
      getSessionReportCalls.push(planId)
      return actual.getSessionReport(planId)
    },
  }
})

// The share page's client player is not under test
vi.mock('@/components/song-share/SharedSongPlayerCard', () => ({
  SharedSongPlayerCard: () => null,
}))

let eph: EphemeralDbResult
let playerId: string

beforeEach(async () => {
  emitted.length = 0
  failingReports.clear()
  getSessionReportCalls.length = 0
  eph = createEphemeralDatabase()
  setCurrentEphemeralDb(eph.db)
  ;({ playerId } = await createTestStudent(eph.db, 'song-report-kid'))
})

afterEach(() => {
  setCurrentEphemeralDb(null)
  eph.cleanup()
})

async function insertFixtureSession(): Promise<string> {
  const { plan } = tenProblemSession()
  await eph.db.insert(schema.sessionPlans).values({ ...plan, playerId })
  const g = fixtureBreakGameResult(plan.id)
  await eph.db.insert(schema.gameResults).values({
    id: g.id,
    playerId,
    gameName: g.gameName!,
    gameDisplayName: 'Memory Quiz',
    sessionType: 'practice-break',
    sessionId: plan.id,
    normalizedScore: 80,
    durationMs: g.durationMs,
    playedAt: g.playedAt as Date,
    fullReport: g.fullReport as never,
  })
  return plan.id
}

/** A song stored before Phase 4e: counted tries (13 of 10 slots), planned minutes, one `gameBreak` */
const PRE_4E_PROMPT_INPUT = {
  player: { name: 'Song Kid', emoji: '🎵', age: 8 },
  currentSession: {
    accuracy: 10 / 13,
    problemsDone: 13,
    problemsTotal: 10,
    skillsPracticed: ['Direct Addition'],
    bestCorrectStreak: 4,
    partTypes: ['Use Abacus'],
    durationMinutes: 10,
    helpUsed: false,
    totalIncorrectAttempts: 3,
    helpMoments: 0,
    retryMoments: 3,
  },
  practiceDrama: {
    storyAngle: 'the 11 + 4 = 15 comeback',
    arcs: ['Comeback: 11 + 4 = 15 took 2 attempts and finished right.'],
    problemMoments: [],
    skillSpotlights: [],
  },
  history: { recentSessionCount: 0, averageAccuracy: 0, trend: 'steady' },
  gameBreak: {
    gameName: 'Memory Quiz',
    headline: 'Sharp memory!',
    highlights: [],
    details: [],
    moments: [],
  },
}

/** `buildSongUserPrompt` before Phase 4e (`879218f0c`) over `PRE_4E_PROMPT_INPUT` with a 3-session history */
const PRE_4E_EXPECTED_PROMPT = `Write a song for Song Kid 🎵 (age 8), who just finished math practice.

Session details:
- Completed 13 out of 10 problems
- Accuracy: 77%
- Best correct streak: 4 in a row
- Practice types: Use Abacus
- Skills practiced: Direct Addition
- Session length: 10 minutes
- Used help: no
- Total incorrect attempts: 3
- Help moments: 0
- Retry/comeback moments: 3
Recent history: 3 sessions this week, 72% average accuracy, trend: improving.

Practice evidence:
- One standout moment (use it or not): the 11 + 4 = 15 comeback
- Arcs: Comeback: 11 + 4 = 15 took 2 attempts and finished right.

Game break evidence:
- Played Memory Quiz: Sharp memory!

This kid has no earlier songs yet.

Now write something they will not see coming.`

const LLM_OUTPUT = {
  title: 'Fixed It Three Times',
  plan: {
    positive_global_styles: ['kids pop'],
    negative_global_styles: [],
    sections: [
      {
        section_name: 'Chorus',
        lines: ['Seven on the first try, three fixed after'],
        positive_local_styles: [],
        negative_local_styles: [],
        duration_ms: 15000,
      },
    ],
  },
}

async function insertSharedSong(planId: string, code = 'fxShare001', showAccuracy = true) {
  const [song] = await eph.db
    .insert(schema.sessionSongs)
    .values({
      sessionPlanId: planId,
      playerId,
      triggerSource: 'auto',
      status: 'completed',
      promptInput: PRE_4E_PROMPT_INPUT as never,
      llmOutput: LLM_OUTPUT as never,
    })
    .returning()
  await eph.db.insert(schema.songShares).values({
    id: code,
    songId: song.id,
    playerId,
    createdBy: 'parent-1',
    visibility: {
      ...DEFAULT_SONG_SHARE_VISIBILITY,
      showAccuracy,
      showStreakSkills: true,
      showProblemDetail: true,
    },
  })
  return { songId: song.id, code }
}

/** The visible text of rendered markup, one run per element */
function textOf(html: string): string {
  return html
    .replace(/<[^>]+>/g, '\n')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .join(' | ')
}

describe('the song input reads the session report (Phase 4e)', () => {
  it('states the fixture report’s facts and stamps its rowVersion', async () => {
    const planId = await insertFixtureSession()
    const built = await buildSongPromptInput({
      sessionPlanId: planId,
      playerId,
      triggerSource: 'auto',
    })
    const input = built.promptInput!

    expect(input.currentSession).toMatchObject(songFactsOf(tenProblemSessionReport()))
    expect(input.currentSession).toMatchObject({
      accuracy: TEN_PROBLEM_EXPECTED.firstTryAccuracy,
      problemsDone: TEN_PROBLEM_EXPECTED.problems,
      problemsTotal: TEN_PROBLEM_EXPECTED.plannedProblems,
      firstTryCorrect: TEN_PROBLEM_EXPECTED.firstTryCorrect,
      fixedInRetries: TEN_PROBLEM_EXPECTED.fixedInRetries,
      activeMinutes: 1,
    })
    expect(input.currentSession).not.toHaveProperty('durationMinutes')
    expect(input.reportSnapshot).toEqual({ rowVersion: tenProblemSessionReport().rowVersion })

    const details = buildSongUserPrompt(input).split('Practice evidence:')[0]
    expect(details).toMatchInlineSnapshot(`
      "Write a song for Test Student 🧪, who just finished math practice.

      Session details:
      - Completed 10 out of 10 problems
      - Right on the first try: 7 of 10 (70%)
      - Fixed in a retry: 3
      - Best correct streak: 4 in a row
      - Practice types: Use Abacus, Visualize, Linear
      - Skills practiced: Direct Addition (1-4)
      - Time spent answering (breaks not counted): 1 minute
      - Used help: no
      - Total incorrect attempts: 3
      - Help moments: 0
      - Retry/comeback moments: 3
      - Average response time: 4.5s
      Recent history: 1 sessions this week, 70% average first-try accuracy, trend: steady.

      "
    `)
  })

  it('a recent session whose report cannot be built leaves the trend, not the song', async () => {
    const planId = await insertFixtureSession()
    // A completed recent session whose report build throws
    await eph.db.insert(schema.sessionPlans).values({
      id: 'offline-1',
      playerId,
      targetDurationMinutes: 0,
      estimatedProblemCount: 0,
      avgTimePerProblemSeconds: 0,
      parts: [],
      summary: {} as never,
      status: 'completed',
      adjustments: [],
      results: [],
      createdAt: new Date(Date.parse('2026-01-04T15:00:00Z')),
      completedAt: new Date(Date.parse('2026-01-04T15:00:00Z')),
    })
    failingReports.add('offline-1')
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    const built = await buildSongPromptInput({
      sessionPlanId: planId,
      playerId,
      triggerSource: 'auto',
    })
    expect(built.promptInput?.currentSession.problemsDone).toBe(10)
    expect(built.promptInput?.history.recentSessionCount).toBe(1)
    expect(errors).toHaveBeenCalledWith(
      '[session-song] recent session report not built',
      'offline-1',
      expect.anything()
    )
    errors.mockRestore()
  })

  it('a stored pre-4e input renders byte-identically to the prompt before 4e', () => {
    // Expected = 879218f0c's `buildSongUserPrompt` over this input, whole
    const input = {
      ...PRE_4E_PROMPT_INPUT,
      history: { recentSessionCount: 3, averageAccuracy: 0.72, trend: 'improving' },
    }
    expect(buildSongUserPrompt(input as never)).toBe(PRE_4E_EXPECTED_PROMPT)
  })
})

describe('the share page and its OG card read the session report (Phase 4e)', () => {
  it('a pre-4e song shows the fixture report’s numbers, not its stored ones', async () => {
    const planId = await insertFixtureSession()
    const { code } = await insertSharedSong(planId)

    const payload = await getSharedSong(code)
    expect(getSessionReportCalls).toEqual([planId])
    expect(payload?.stats).toMatchObject({
      accuracyPct: 70,
      problemsDone: 10,
      problemsTotal: 10,
      // The song's own story stays as stored
      bestCorrectStreak: 4,
      storyAngle: 'the 11 + 4 = 15 comeback',
    })

    const { default: SharedSongPage } = await import('@/app/song/[code]/page')
    const page = textOf(
      renderToStaticMarkup(await SharedSongPage({ params: Promise.resolve({ code }) }))
    )
    expect(page).toContain('70% | First try')
    expect(page).toContain('10/10 | Problems')
    expect(page).not.toContain('13/10')
    expect(page).toMatchInlineSnapshot(
      `"🧪 | A song for | Test Student | 🎉 | A celebration song from their practice | ♫ Title | “Fixed It Three Times” | kids pop | ✨ | The story so far | the 11 + 4 = 15 comeback | ✨ | Comeback: 11 + 4 = 15 took 2 attempts and finished right. | ✓ | 70% | First try | ∑ | 10/10 | Problems | 🔥 | 4 | Best streak | Skills practiced: | Direct  Addition | Make a song on Abaci.One | → | Adaptive abacus practice that ends in a song."`
    )

    const og = textOf(
      renderToStaticMarkup(createElement(SongPreviewArtwork, { payload, displayFont: 'serif' }))
    )
    expect(og).toContain('70% | first try')
    expect(og).toMatchInlineSnapshot(
      `"🧪 | A song for | Test Student | ♫ Practice Song | “Fixed It Three Times” | ▶ | 70% | first try | 4 🔥 | streak | kids pop | Abaci.One | · A celebration song | ▶ Tap to listen"`
    )
  })

  it('with no toggle that shows report numbers, the share page builds no report', async () => {
    const planId = await insertFixtureSession()
    const { code } = await insertSharedSong(planId, 'fxShare002', false)

    const payload = await getSharedSong(code)
    expect(getSessionReportCalls).toEqual([])
    expect(payload?.stats).not.toHaveProperty('accuracyPct')
    expect(payload?.stats).not.toHaveProperty('problemsDone')
    expect(payload?.stats).toMatchObject({ bestCorrectStreak: 4 })
  })

  it('without a report (the session cannot be read) the stored numbers render', () => {
    const payload = projectSharedSong({
      visibility: { ...DEFAULT_SONG_SHARE_VISIBILITY, showAccuracy: true },
      llmOutput: LLM_OUTPUT,
      promptInput: PRE_4E_PROMPT_INPUT,
      report: null,
      playerName: 'Song Kid',
      playerEmoji: '🎵',
      songId: 'song-1',
      createdAt: 0,
    })
    expect(payload.stats).toMatchObject({ accuracyPct: 77, problemsDone: 13, problemsTotal: 10 })
    expect(payload.song.title).toBe('Fixed It Three Times')
  })

  it('the report is projected through the share’s toggles like the stored facts were', () => {
    const payload = projectSharedSong({
      visibility: DEFAULT_SONG_SHARE_VISIBILITY,
      llmOutput: LLM_OUTPUT,
      promptInput: PRE_4E_PROMPT_INPUT,
      report: tenProblemSessionReport(),
      playerName: 'Song Kid',
      playerEmoji: '🎵',
      songId: 'song-1',
      createdAt: 0,
    })
    expect(payload.stats).not.toHaveProperty('accuracyPct')
    expect(payload.stats).not.toHaveProperty('problemsDone')
  })
})

describe('song status reaches the gated report room (P4a-7, Phase 4e)', () => {
  it('a new song announces pending, then failed; working steps announce nothing', async () => {
    const planId = await insertFixtureSession()
    const { songId } = await startSessionSongGeneration({
      sessionPlanId: planId,
      playerId,
      triggerSource: 'auto',
    })

    const announced = emitted.filter((e) => e.event === 'session-song-status')
    expect(announced.map((e) => e.room)).toEqual([
      `session-report:${planId}`,
      `session-report:${planId}`,
    ])
    expect(announced.map((e) => e.data)).toEqual([
      { sessionId: planId, songId, status: 'pending' },
      { sessionId: planId, songId, status: 'failed' },
    ])
    // The per-plan phase broadcast still carries every step
    expect(
      emitted.filter((e) => e.event === `session-song:phase:${planId}`).map((e) => e.data.status)
    ).toEqual(['pending', 'prompt_generating', 'failed'])
  })
})
