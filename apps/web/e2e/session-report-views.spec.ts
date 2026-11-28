/**
 * Phase 4c in a real browser: the parent observer and the public share link
 * show the same numbers as the session report, live and after the end; and
 * (Phase 5c) the observer's plan overview and the summary's problem grid
 * count what the report counts.
 *
 * The kid's practice page (admin context) drives the session with the keyboard,
 * as retry-redo-attribution.spec.ts does: the observers' problem view needs the
 * kid's broadcast, and the answers go through the same write the app uses.
 *
 * Every number on screen is checked twice: against the report route and
 * against what the test did (one wrong first try fixed by a do-over).
 *
 *   PORT=3021 npx @playwright/test test e2e/session-report-views.spec.ts
 */

import path from 'node:path'
import { type Client, createClient } from '@libsql/client'
import {
  type APIRequestContext,
  type BrowserContext,
  expect,
  type Locator,
  type Page,
  test,
} from '@playwright/test'
import { type Socket as ClientSocket, io as connectSocket } from 'socket.io-client'
import { getLocalAuthSecret, LOCAL_ADMIN_USER_ID, mintSessionJWT } from './session-cookie'

const SHOTS = process.env.RF_SHOTS_DIR ?? '/tmp/4c-views-e2e'

interface Problem {
  terms: number[]
  answer: number
}
interface Plan {
  id: string
  status: string
  parts: { type: string; slots: { slotId: string; problem: Problem }[] }[]
}
interface Counts {
  plannedProblems: number
  problems: number
  tries: number
  firstTryCorrect: number
  firstTryAccuracy: number | null
  fixedInRetries: number
  unresolved: number
  finalCorrect: number
  finalAccuracy: number | null
}
interface Report {
  sessionId: string
  outcome: string
  endedEarly: boolean
  startedAt: number | null
  endedAt: number | null
  time: { activeMs: number; wallMs: number }
  totals: Counts
  position: { progress: { done: number; total: number } } | null
}

// ---------------------------------------------------------------------------
// Setup (as in retry-redo-attribution.spec.ts)
// ---------------------------------------------------------------------------

async function seedStudent(request: APIRequestContext): Promise<string> {
  const seed = await request.post('/api/debug/seed-students', {
    data: { profiles: ['⚡ Fast Responder'] },
  })
  expect(seed.ok(), await seed.text()).toBeTruthy()
  const { taskId } = await seed.json()
  let playerId = ''
  await expect
    .poll(
      async () => {
        const r = await request.get(`/api/admin/tasks?taskId=${taskId}`)
        const { task } = await r.json()
        for (const e of task.events) {
          if (e.eventType !== 'student_completed') continue
          const payload = typeof e.payload === 'string' ? JSON.parse(e.payload) : e.payload
          playerId = payload.playerId
        }
        return task.status
      },
      { timeout: 90_000 }
    )
    .toBe('completed')
  expect(playerId).not.toBe('')
  return playerId
}

/** One abacus part, no breaks: every answer stays in the part the observers show. */
async function startSession(
  request: APIRequestContext,
  playerId: string,
  previous?: string
): Promise<Plan> {
  const gen = await request.post(`/api/curriculum/${playerId}/sessions/plans`, {
    data: {
      durationMinutes: 2,
      enabledParts: { abacus: true, visualization: false, linear: false },
      gameBreakSettings: {
        enabled: false,
        maxDurationMinutes: 1,
        selectionMode: 'auto-start',
        selectedGame: 'matching',
        skipSetupPhase: true,
        useAdaptiveSelection: false,
      },
    },
  })
  expect(gen.status(), await gen.text()).toBe(202)
  let planId = ''
  await expect
    .poll(
      async () => {
        const r = await request.get(`/api/curriculum/${playerId}/sessions/plans`)
        // The player's latest plan may still be the one that just ended
        const id: string = (await r.json()).plan?.id ?? ''
        planId = id === previous ? '' : id
        return planId
      },
      { timeout: 60_000 }
    )
    .not.toBe('')
  for (const action of ['approve', 'start']) {
    const r = await request.patch(`/api/curriculum/${playerId}/sessions/plans/${planId}`, {
      data: { action },
    })
    expect(r.ok(), `${action}: ${await r.text()}`).toBeTruthy()
  }
  const r = await request.get(`/api/curriculum/${playerId}/sessions/plans/${planId}`)
  expect(r.ok()).toBeTruthy()
  return (await r.json()).plan as Plan
}

// ---------------------------------------------------------------------------
// The kid's page: reading and answering (as in retry-redo-attribution.spec.ts)
// ---------------------------------------------------------------------------

async function instrument(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __phases: (string | null)[]; __lastPhase?: string | null }
    w.__phases = []
    new MutationObserver(() => {
      const el = document.querySelector('[data-component="active-session"]')
      const phase = el?.getAttribute('data-phase') ?? null
      if (phase !== w.__lastPhase) {
        w.__lastPhase = phase
        w.__phases.push(phase)
      }
    }).observe(document, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-phase'],
    })
  })
}

const phaseMark = (page: Page) =>
  page.evaluate(() => (window as unknown as { __phases: unknown[] }).__phases.length)

const activeProblem = (page: Page) =>
  page.locator(
    '[data-element="problem-container"] [data-component="vertical-problem"][data-status="active"]'
  )

async function shownProblem(page: Page): Promise<Problem> {
  await expect(page.locator('[data-component="retry-transition-screen"]')).toHaveCount(0, {
    timeout: 20_000,
  })
  await expect(page.locator('[data-component="active-session"]')).toHaveAttribute(
    'data-phase',
    'inputting',
    { timeout: 20_000 }
  )
  const problem = activeProblem(page)
  await expect(problem).toBeVisible()
  const answer = Number(await problem.getAttribute('data-correct-answer'))
  return { terms: [], answer }
}

async function waitSubmitted(page: Page, mark: number) {
  await expect
    .poll(
      () =>
        page.evaluate(
          (m) =>
            (window as unknown as { __phases: string[] }).__phases
              .slice(m)
              .some((p) => p === 'submitting' || p === 'showingFeedback'),
          mark
        ),
      { timeout: 10_000 }
    )
    .toBe(true)
}

async function pressFirstKey(page: Page, key: string) {
  const cells = activeProblem(page).locator('[data-element="answer-cell"]')
  await expect(async () => {
    if ((await cells.count()) === 0) await page.keyboard.press(key)
    await expect(cells).not.toHaveCount(0, { timeout: 1000 })
  }).toPass({ timeout: 10_000 })
}

async function typeCorrect(page: Page, p: Problem) {
  const mark = await phaseMark(page)
  const digits = String(p.answer)
  await pressFirstKey(page, digits[0])
  await page.keyboard.type(digits.slice(1))
  await waitSubmitted(page, mark)
}

async function typeWrong(page: Page, p: Problem) {
  const mark = await phaseMark(page)
  // Three corrections switch the problem to manual submit, which accepts any digits
  await pressFirstKey(page, '0')
  await page.keyboard.press('Backspace')
  for (let i = 0; i < 2; i++) {
    await page.keyboard.press('0')
    await page.keyboard.press('Backspace')
  }
  await page.keyboard.type(String(p.answer + 1))
  await page.keyboard.press('Enter')
  await waitSubmitted(page, mark)
}

const isWrite =
  (action: string) => (r: { request(): { method(): string; postData(): string | null } }) => {
    if (r.request().method() !== 'PATCH') return false
    try {
      return JSON.parse(r.request().postData() ?? '{}').action === action
    } catch {
      return false
    }
  }

/** Answers the problem on screen and waits for the server's reply to that write. */
async function answer(page: Page, planId: string, correct: boolean) {
  const p = await shownProblem(page)
  const reply = page.waitForResponse((r) => r.url().includes(planId) && isWrite('record')(r))
  if (correct) await typeCorrect(page, p)
  else await typeWrong(page, p)
  expect((await reply).status()).toBe(200)
}

/** Taps a finished problem's dot to start a do-over, and answers it correctly. */
async function doOverCorrectly(page: Page, planId: string, slotIndex: number) {
  await shownProblem(page)
  await page
    .locator(
      `[data-element="expanded-section"] button[data-slot-index="${slotIndex}"][data-clickable-for-redo]`
    )
    .click()
  await expect(page.locator('[data-element="redo-mode-banner"]')).toBeVisible()
  const p = await shownProblem(page)
  const reply = page.waitForResponse((r) => r.url().includes(planId) && isWrite('record_redo')(r))
  await typeCorrect(page, p)
  expect((await reply).status()).toBe(200)
}

// ---------------------------------------------------------------------------
// Reports and what the observer views show
// ---------------------------------------------------------------------------

async function planReport(request: APIRequestContext, playerId: string, planId: string) {
  const r = await request.get(`/api/curriculum/${playerId}/sessions/plans/${planId}/report`)
  expect(r.ok(), await r.text()).toBeTruthy()
  return (await r.json()).report as Report
}

async function tokenReport(request: APIRequestContext, token: string) {
  const r = await request.get(`/api/observe/${token}/report`)
  expect(r.ok(), await r.text()).toBeTruthy()
  return (await r.json()).report as Report
}

const pct = (n: number, d: number) => `${Math.round((n / d) * 100)}%`

interface Expected {
  /** Items with a first try */
  problems: number
  tries: number
  firstTryCorrect: number
  fixed: number
  finalCorrect: number
}

/** The report agrees with what the test did. */
function expectCounts(report: Report, want: Expected, planned: number) {
  expect(report.totals).toMatchObject({
    plannedProblems: planned,
    problems: want.problems,
    tries: want.tries,
    firstTryCorrect: want.firstTryCorrect,
    fixedInRetries: want.fixed,
    finalCorrect: want.finalCorrect,
  })
}

/** The desktop live results panel of an observer view. */
const livePanel = (page: Page) =>
  page.locator(
    '[data-component="session-observer-view"] [data-element="results-panel-desktop"] [data-component="live-results-panel"]'
  )

/** Opens "Show all" once, so the list holds every try. */
async function showAllTries(page: Page) {
  const panel = livePanel(page)
  await expect(panel.locator('[data-element="stats-header"]')).toBeVisible({ timeout: 30_000 })
  await panel.locator('[data-element="results-content"] button', { hasText: 'Show all' }).click()
}

/** The live panel shows the report's progress, first-try %, wrong first tries and tries. */
async function expectLivePanel(page: Page, report: Report, want: Expected) {
  const panel = livePanel(page)
  const header = panel.locator('[data-element="stats-header"] > div > span')
  const progress = report.position?.progress
  expect(progress).toBeTruthy()
  await expect(header.nth(0)).toHaveText(`${progress!.done}/${progress!.total}`)
  await expect(header.nth(1)).toHaveText(pct(want.firstTryCorrect, want.problems))
  await expect(header.nth(1)).toHaveText(pct(report.totals.firstTryCorrect, report.totals.problems))
  const wrongFirst = want.problems - want.firstTryCorrect
  expect(report.totals.problems - report.totals.firstTryCorrect).toBe(wrongFirst)
  await expect(header.nth(2)).toHaveText(`✗${wrongFirst}`)
  await expect(panel.locator('[data-element="results-content"]')).toContainText(
    `All Tries (${report.totals.tries})`
  )
  await expect(panel.locator('[data-component="observed-result-item"]')).toHaveCount(want.tries)
}

/** The observer's plan overview counts the report's planned problems (Phase 5c). */
async function expectPlanOverview(page: Page, report: Report) {
  const overview = page.locator(
    '[data-component="session-observer-view"] [data-component="session-plan-overview"]'
  )
  const toggle = overview.locator('[data-action="toggle-session-plan"]')
  await expect(toggle).toContainText(`— ${report.totals.plannedProblems} problems`, {
    timeout: 30_000,
  })
  await toggle.click()
  // One part: its row counts every planned problem
  const rows = overview.locator('[data-element="part-row"]')
  await expect(rows).toHaveCount(1)
  await expect(rows.nth(0)).toContainText(`${report.totals.plannedProblems} problems,`)
  await expect(rows.nth(0)).toHaveAttribute('data-current', 'true')
  await toggle.click()
}

/**
 * The summary's problem grid (Phase 5c): the header counts the report's
 * planned problems, and its cells' marks add up to the report's totals
 * (✓ = final correct, ❌ = unresolved, ○ = not answered).
 */
async function expectProblemGrid(page: Page, report: Report) {
  const t = report.totals
  const grid = page.locator('[data-component="all-problems-section"]')
  await expect(grid).toBeVisible({ timeout: 30_000 })
  await expect(grid).toContainText(`All Session Problems (${t.plannedProblems})`)
  await grid.locator('button', { hasText: 'All Session Problems' }).click()
  const items = grid.locator('[data-element="compact-problem-item"]')
  await expect(items).toHaveCount(t.plannedProblems)
  await expect(items.filter({ hasText: '✓' })).toHaveCount(t.finalCorrect)
  await expect(items.filter({ hasText: '❌' })).toHaveCount(t.unresolved)
  await expect(items.filter({ hasText: '○' })).toHaveCount(t.plannedProblems - t.problems)
}

/** The ended view shows the report's final totals. */
async function expectEndedSummary(scope: Locator, report: Report, want: Expected) {
  const t = report.totals
  const summary = scope.locator('[data-component="session-ended-summary"]')
  await expect(summary).toBeVisible({ timeout: 30_000 })
  await expect(summary).toHaveAttribute('data-outcome', 'ended_early')
  await expect(summary.locator('[data-stat="problems"]')).toContainText(
    `${want.problems}/${t.plannedProblems}`
  )
  await expect(summary.locator('[data-stat="first-try"]')).toContainText(
    pct(want.firstTryCorrect, want.problems)
  )
  await expect(summary.locator('[data-stat="first-try"]')).toContainText(
    `First try (${t.firstTryCorrect}/${t.problems})`
  )
  await expect(summary.locator('[data-stat="fixed"]')).toContainText(String(t.fixedInRetries))
  await expect(summary.locator('[data-stat="final"]')).toContainText(
    pct(want.finalCorrect, want.problems)
  )
  await expect(summary.locator('[data-stat="final"]')).toContainText(
    `Final (${t.finalCorrect}/${t.problems})`
  )
}

/** The admin's classroom, which the seeder enrols every seeded student in. */
async function seededClassroom(request: APIRequestContext, playerId: string) {
  const r = await request.get('/api/classrooms/mine')
  expect(r.ok(), await r.text()).toBeTruthy()
  const classroomId: string = (await r.json()).classroom.id
  const enrolled = await request.get(`/api/classrooms/${classroomId}/enrollments`)
  expect(enrolled.ok(), await enrolled.text()).toBeTruthy()
  const { students } = (await enrolled.json()) as { students: { id: string }[] }
  expect(students.map((st) => st.id)).toContain(playerId)
  return classroomId
}

interface ClassroomActiveSession {
  sessionId: string
  playerId: string
  completedProblems: number
  totalProblems: number
  totals: Counts
}

async function classroomActiveSessions(request: APIRequestContext, classroomId: string) {
  const r = await request.get(`/api/classrooms/${classroomId}/presence/active-sessions`)
  expect(r.ok(), await r.text()).toBeTruthy()
  return (await r.json()).sessions as ClassroomActiveSession[]
}

/** The history list's "N min" (VirtualizedSessionList's formatMinutes). */
const listMinutes = (ms: number) => (ms > 0 && ms < 30_000 ? '<1' : String(Math.round(ms / 60_000)))

/** A finished session's history row shows its report's first try, final, times and end date. */
async function expectHistoryRow(dashboard: Page, report: Report, want: Expected) {
  const t = report.totals
  const row = dashboard.locator(
    `[data-element="session-history-item"][data-session-id="${report.sessionId}"]`
  )
  await expect(row).toBeVisible({ timeout: 30_000 })
  const firstTry = pct(want.firstTryCorrect, want.problems)
  await expect(row.locator('[data-element="status-badge"]')).toHaveAttribute(
    'data-status',
    'completed'
  )
  await expect(row.locator('[data-element="status-badge"]')).toHaveText(
    `${want.firstTryCorrect}/${want.problems} first try · ${firstTry}`
  )
  expect(`${t.firstTryCorrect}/${t.problems}`).toBe(`${want.firstTryCorrect}/${want.problems}`)
  await expect(row.locator('[data-element="final-accuracy"]')).toHaveText(
    `${pct(want.finalCorrect, want.problems)} final`
  )
  expect(pct(t.finalCorrect, t.problems)).toBe(pct(want.finalCorrect, want.problems))
  await expect(row.locator('[data-element="wall-duration"]')).toHaveText(
    `${listMinutes(report.time.wallMs)} min`
  )
  await expect(row.locator('[data-element="active-duration"]')).toHaveText(
    `${listMinutes(report.time.activeMs)} min active`
  )
  // Dated by when it ended, in the browser's own locale and zone
  const date = await dashboard.evaluate((ms) => new Date(ms).toLocaleDateString(), report.endedAt!)
  await expect(row.locator('[data-element="session-header"]')).toContainText(date)
}

// ---------------------------------------------------------------------------
// Song rows (Phase 4e): songs cannot be generated here, so they are written
// straight into the test server's database
// ---------------------------------------------------------------------------

/** The test server's database (`DATABASE_URL=file:./data/sqlite.db`, relative to apps/web). */
const songDb = () => createClient({ url: `file:${path.resolve(__dirname, '../data/sqlite.db')}` })

/** A song's stored input, with numbers that are deliberately not the session's. */
const STORED_SONG_INPUT = {
  player: { name: 'Fast', emoji: '⚡', age: 9 },
  currentSession: {
    accuracy: 0.5,
    problemsDone: 7,
    problemsTotal: 20,
    bestCorrectStreak: 5,
    skillsPracticed: ['basic.directAddition'],
  },
  practiceDrama: { storyAngle: 'the comeback', arcs: ['Streak: 5 correct answers in a row.'] },
}

const SONG_OUTPUT = {
  title: 'e2e 4e song',
  plan: {
    positive_global_styles: ['kids pop'],
    negative_global_styles: [],
    sections: [
      {
        section_name: 'Verse 1',
        lines: ['Bead by bead, we count it through'],
        positive_local_styles: [],
        negative_local_styles: [],
        duration_ms: 15000,
      },
    ],
  },
}

type Visibility = { showAccuracy: boolean }

/** Inserts a completed song for a session and one share per entry; returns the share codes. */
async function insertSongWithShares(
  db: Client,
  ids: { songId: string; planId: string; playerId: string },
  shares: { code: string; visibility: Visibility; status: 'active' | 'revoked' }[]
) {
  const { rows } = await db.execute({
    sql: 'SELECT parent_user_id FROM parent_child WHERE child_player_id = ? LIMIT 1',
    args: [ids.playerId],
  })
  const adminId = String(rows[0]?.parent_user_id ?? '')
  expect(adminId).not.toBe('')
  const now = Math.floor(Date.now() / 1000)
  await db.execute({
    sql: `INSERT INTO session_songs (id, session_plan_id, player_id, status, prompt_input, llm_output, created_at, completed_at)
          VALUES (?, ?, ?, 'completed', ?, ?, ?, ?)`,
    args: [
      ids.songId,
      ids.planId,
      ids.playerId,
      JSON.stringify(STORED_SONG_INPUT),
      JSON.stringify(SONG_OUTPUT),
      now,
      now,
    ],
  })
  for (const s of shares) {
    await db.execute({
      sql: `INSERT INTO song_shares (id, song_id, player_id, created_by, visibility, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        s.code,
        ids.songId,
        ids.playerId,
        adminId,
        JSON.stringify({
          showAge: false,
          showProblemDetail: false,
          showStreakSkills: false,
          autoPlay: false,
          ...s.visibility,
        }),
        s.status,
        now,
      ],
    })
  }
}

async function deleteSong(db: Client, songId: string) {
  await db.execute({ sql: 'DELETE FROM song_shares WHERE song_id = ?', args: [songId] })
  await db.execute({ sql: 'DELETE FROM session_songs WHERE id = ?', args: [songId] })
}

const noAuth = { storageState: { cookies: [], origins: [] } }

// ---------------------------------------------------------------------------
// Socket identity: a raw socket.io client carrying a browser's cookies. The
// server takes the viewer from the handshake's cookies, never from a payload.
// Cookie values are never logged.
// ---------------------------------------------------------------------------

const cookieHeader = (cookies: { name: string; value: string }[]) =>
  cookies.map((c) => `${c.name}=${c.value}`).join('; ')

async function rawSocket(baseURL: string, cookie: string): Promise<ClientSocket> {
  const sock = connectSocket(baseURL, {
    path: '/api/socket',
    transports: ['websocket'],
    extraHeaders: cookie ? { cookie } : {},
    reconnection: false,
    forceNew: true,
  })
  await new Promise<void>((resolve, reject) => {
    sock.once('connect', () => resolve())
    sock.once('connect_error', (e) => reject(new Error(`socket connect failed: ${e.message}`)))
  })
  return sock
}

/**
 * The guest cookie the middleware issues a signed-out visitor, as a `name=value`
 * pair ('' if none). Read from `Set-Cookie`: in production it is `__Host-guest`
 * (Secure), which a cookie jar on http://localhost does not keep.
 */
async function issuedGuestCookie(request: APIRequestContext): Promise<string> {
  let url = '/'
  for (let hop = 0; hop < 3; hop++) {
    const res = await request.get(url, { maxRedirects: 0 })
    for (const { name, value } of res.headersArray()) {
      if (name.toLowerCase() !== 'set-cookie') continue
      const pair = value.split(';')[0]
      if (/^(__Host-)?guest=./.test(pair)) return pair
    }
    const next = res.headers().location
    if (!next) break
    url = next
  }
  return ''
}

/** Emit `event` and wait for whichever of `outcomes` the server answers with. */
function ask(
  sock: ClientSocket,
  event: string,
  data: unknown,
  outcomes: string[]
): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`no answer to ${event}`)), 10_000)
    for (const outcome of outcomes) {
      sock.once(outcome, () => {
        clearTimeout(timer)
        for (const o of outcomes) sock.off(o)
        resolve(outcome)
      })
    }
    sock.emit(event, data)
  })
}

// ---------------------------------------------------------------------------
// Scenario
// ---------------------------------------------------------------------------

test.describe('session report views (Phases 4c-4e)', () => {
  test.setTimeout(300_000)

  let playerId = ''
  const contexts: BrowserContext[] = []
  test.afterEach(async ({ request }) => {
    for (const c of contexts.splice(0)) await c.close().catch(() => {})
    if (playerId && !process.env.RF_KEEP_PLAYERS) {
      await request.delete(`/api/players/${playerId}`).catch(() => {})
    }
    playerId = ''
  })

  test('parent observer and share link show the report, live and ended', async ({
    page,
    context,
    browser,
    request,
  }) => {
    playerId = await seedStudent(request)
    const plan = await startSession(request, playerId)
    const planned = plan.parts[0].slots.length
    // Slots 0-2 are answered with one more left, so the part never ends under the observers
    expect(plan.parts).toHaveLength(1)
    expect(planned).toBeGreaterThanOrEqual(4)
    console.log(`[4c views] player ${playerId} plan ${plan.id} (${planned} problems)`)

    // 1. The kid: slot 0 wrong, fixed by a do-over; slot 1 right
    await instrument(page)
    await page.goto(`/practice/${playerId}`)
    await answer(page, plan.id, false)
    await doOverCorrectly(page, plan.id, 0)
    await answer(page, plan.id, true)

    let want: Expected = { problems: 2, tries: 3, firstTryCorrect: 1, fixed: 1, finalCorrect: 2 }
    const before = await planReport(request, playerId, plan.id)
    expectCounts(before, want, planned)
    expect(before.position?.progress).toEqual({ done: 2, total: planned })
    // First try and final differ, so a view showing the wrong one fails
    expect(pct(1, 2)).not.toBe(pct(2, 2))

    // 2. The parent observer
    const observer = await context.newPage()
    await observer.goto(`/practice/${playerId}/observe`)
    await expect(observer.locator('[data-component="practice-observation-page"]')).toBeVisible()
    await showAllTries(observer)
    await expectLivePanel(observer, before, want)
    await expectPlanOverview(observer, before)
    await observer.screenshot({ path: `${SHOTS}/observer-live.png` })

    // 3. The share link, in a browser with no sign-in
    const share = await request.post(`/api/sessions/${plan.id}/share`, {
      data: { expiresIn: '1h' },
    })
    expect(share.ok(), await share.text()).toBeTruthy()
    const { token } = (await share.json()) as { token: string }
    const shareContext = await browser.newContext(noAuth)
    contexts.push(shareContext)
    const shareRequest = shareContext.request
    const shared = await tokenReport(shareRequest, token)
    expect(shared.sessionId).toBe(plan.id)
    expectCounts(shared, want, planned)
    expect(shared.totals).toEqual(before.totals)

    const sharePage = await shareContext.newPage()
    await sharePage.goto(`/observe/${token}`)
    await expect(sharePage.locator('[data-component="public-observation-page"]')).toBeVisible()
    await expect(sharePage.locator('[data-component="session-observer-view"]')).toBeVisible()
    await showAllTries(sharePage)
    await expectLivePanel(sharePage, shared, want)
    await sharePage.screenshot({ path: `${SHOTS}/share-live.png` })

    // 4. Live push: one more right answer reaches both pages without a reload
    await answer(page, plan.id, true)
    want = { problems: 3, tries: 4, firstTryCorrect: 2, fixed: 1, finalCorrect: 3 }
    const after = await planReport(request, playerId, plan.id)
    expectCounts(after, want, planned)
    expect(after.position?.progress).toEqual({ done: 3, total: planned })
    const sharedAfter = await tokenReport(shareRequest, token)
    expect(sharedAfter.totals).toEqual(after.totals)
    await expectLivePanel(observer, after, want)
    await expectLivePanel(sharePage, sharedAfter, want)

    // 5. An adult ends the session: both views keep the final report on screen
    const end = await request.patch(`/api/curriculum/${playerId}/sessions/plans/${plan.id}`, {
      data: { action: 'end_early', reason: 'e2e: observers see the end' },
    })
    expect(end.ok(), await end.text()).toBeTruthy()
    const final = await planReport(request, playerId, plan.id)
    expect(final.outcome).toBe('completed')
    expect(final.endedEarly).toBe(true)
    expectCounts(final, want, planned)
    const sharedFinal = await tokenReport(shareRequest, token)
    expect(sharedFinal.totals).toEqual(final.totals)

    await expectEndedSummary(sharePage.locator('body'), sharedFinal, want)
    await sharePage.screenshot({ path: `${SHOTS}/share-ended.png` })
    await expectEndedSummary(observer.locator('body'), final, want)
    await observer.screenshot({ path: `${SHOTS}/observer-ended.png` })

    // The share link opened afresh after the end: the server-rendered ended page
    const reopened = await shareContext.newPage()
    await reopened.goto(`/observe/${token}`)
    await expect(reopened.locator('[data-component="session-ended-page"]')).toBeVisible()
    await expectEndedSummary(reopened.locator('body'), sharedFinal, want)
    await reopened.screenshot({ path: `${SHOTS}/share-reopened.png` })

    // 6. A made-up token shows no session, and its report is refused
    const strangerContext = await browser.newContext(noAuth)
    contexts.push(strangerContext)
    const stranger = await strangerContext.newPage()
    const bogus = `bogus${token.slice(5)}x`
    const res = await stranger.goto(`/observe/${bogus}`)
    expect(res?.status()).toBe(404)
    await expect(stranger.locator('[data-component="session-observer-view"]')).toHaveCount(0)
    await expect(stranger.locator('[data-component="session-ended-summary"]')).toHaveCount(0)
    await expect(stranger.locator('[data-component="public-observation-page"]')).toHaveCount(0)
    const bogusReport = await strangerContext.request.get(`/api/observe/${bogus}/report`)
    expect(bogusReport.status()).toBe(404)

    // 7. The session's summary page (Phase 5c): its problem grid agrees with
    // the report route's totals, as the observer's live results did
    expect(final.totals.unresolved).toBe(0)
    await page.goto(`/practice/${playerId}/session/${plan.id}`)
    await expectProblemGrid(page, final)
    const items = page.locator(
      '[data-component="all-problems-section"] [data-element="compact-problem-item"]'
    )
    // By position: slots 0-2 answered (slot 0 fixed by its do-over), slot 3 not
    for (const i of [0, 1, 2]) await expect(items.nth(i)).toContainText('✓')
    await expect(items.nth(3)).toContainText('○')
    await expect(items.nth(3)).toHaveAttribute('data-problem-number', '4')
    await page.screenshot({ path: `${SHOTS}/summary-grid.png` })
  })

  test('the socket is its signed-in viewer: an id a payload names grants nothing', async ({
    context,
    browser,
    request,
    baseURL,
  }) => {
    playerId = await seedStudent(request)
    const plan = await startSession(request, playerId)
    const report = { sessionId: plan.id, playerId }
    const reportOutcomes = ['session-report-subscribed', 'session-report-error']
    const roomOutcomes = ['session-room-joined', 'session-room-error']
    const sockets: ClientSocket[] = []
    try {
      // The admin (the kid's parent), with no id in the payload
      const admin = await rawSocket(baseURL!, cookieHeader(await context.cookies()))
      sockets.push(admin)
      expect(await ask(admin, 'subscribe-session-report', report, reportOutcomes)).toBe(
        'session-report-subscribed'
      )
      expect(await ask(admin, 'join-session', report, roomOutcomes)).toBe('session-room-joined')

      // A second signed-in user, and a guest, each naming the parent's id
      const secondUser = `e2e-socket-stranger-${Date.now()}`
      const strangerCookie = `authjs.session-token=${await mintSessionJWT(
        getLocalAuthSecret(),
        'authjs.session-token',
        secondUser,
        { name: 'Socket Stranger', email: null }
      )}`
      const guestContext = await browser.newContext(noAuth)
      contexts.push(guestContext)
      const guestCookie = await issuedGuestCookie(guestContext.request)
      expect(guestCookie, 'the middleware issues a guest cookie').not.toBe('')

      for (const [who, cookie] of [
        ['second user', strangerCookie],
        ['guest', guestCookie],
        ['anonymous', ''],
      ] as const) {
        const sock = await rawSocket(baseURL!, cookie)
        sockets.push(sock)
        const asserted = { ...report, viewerId: LOCAL_ADMIN_USER_ID }
        expect(
          await ask(sock, 'subscribe-session-report', asserted, reportOutcomes),
          `${who}: report`
        ).toBe('session-report-error')
        expect(await ask(sock, 'join-session', asserted, roomOutcomes), `${who}: live room`).toBe(
          'session-room-error'
        )
        expect(
          await ask(sock, 'subscribe-session-stats', asserted, roomOutcomes),
          `${who}: stats`
        ).toBe('session-room-error')
      }
    } finally {
      for (const sock of sockets) sock.disconnect()
    }
  })

  test('dashboard history and the classroom route read the report (Phase 4d)', async ({
    page,
    context,
    request,
  }) => {
    const t0 = Date.now()
    playerId = await seedStudent(request)
    const classroomId = await seededClassroom(request, playerId)
    await instrument(page)

    // Session A: slot 0 wrong then fixed by a do-over, slot 1 right
    const a = await startSession(request, playerId)
    const planned = a.parts[0].slots.length
    expect(planned).toBeGreaterThanOrEqual(4)
    console.log(`[4d views] player ${playerId} plans A ${a.id}`)
    await page.goto(`/practice/${playerId}`)
    await answer(page, a.id, false)
    await doOverCorrectly(page, a.id, 0)
    await answer(page, a.id, true)
    const wantA: Expected = { problems: 2, tries: 3, firstTryCorrect: 1, fixed: 1, finalCorrect: 2 }

    // The classroom route, while A is live: the report's progress and totals
    const liveA = await planReport(request, playerId, a.id)
    expectCounts(liveA, wantA, planned)
    const cardA = (await classroomActiveSessions(request, classroomId)).find(
      (s) => s.playerId === playerId
    )
    expect(cardA?.sessionId).toBe(a.id)
    expect(cardA).toMatchObject({ completedProblems: 2, totalProblems: planned })
    expect(cardA!.totals).toEqual(liveA.totals)

    let end = await request.patch(`/api/curriculum/${playerId}/sessions/plans/${a.id}`, {
      data: { action: 'end_early', reason: 'e2e: dashboard A' },
    })
    expect(end.ok(), await end.text()).toBeTruthy()
    const finalA = await planReport(request, playerId, a.id)
    expectCounts(finalA, wantA, planned)
    const ended = (await classroomActiveSessions(request, classroomId)).filter(
      (s) => s.playerId === playerId
    )
    expect(ended).toEqual([])

    // Session B: two right; the dashboard opens while it is live
    const b = await startSession(request, playerId, a.id)
    expect(b.id).not.toBe(a.id)
    await page.goto(`/practice/${playerId}`)
    await answer(page, b.id, true)
    await answer(page, b.id, true)
    const dashboard = await context.newPage()
    await dashboard.goto(`/practice/${playerId}/dashboard?tab=history`)
    await expectHistoryRow(dashboard, finalA, wantA)
    await expect(
      dashboard.locator(`[data-element="active-session-item"][data-session-id="${b.id}"]`)
    ).toContainText(`2/${planned} · 100% first try`)
    // The dashboard's in-progress card (the sub-nav carries a hidden variant too)
    const inProgress = dashboard.locator('[data-element="active-session-banner"]')
    await expect(inProgress.and(dashboard.locator('[data-variant="dashboard"]'))).toBeVisible()
    await expect(inProgress.and(dashboard.locator('[data-variant="dashboard"]'))).toContainText(
      `2/${planned}`
    )

    // B's third answer is wrong and never fixed; ending B lists it without a reload
    await answer(page, b.id, false)
    end = await request.patch(`/api/curriculum/${playerId}/sessions/plans/${b.id}`, {
      data: { action: 'end_early', reason: 'e2e: dashboard B' },
    })
    expect(end.ok(), await end.text()).toBeTruthy()
    const wantB: Expected = { problems: 3, tries: 3, firstTryCorrect: 2, fixed: 0, finalCorrect: 2 }
    const finalB = await planReport(request, playerId, b.id)
    expectCounts(finalB, wantB, planned)
    await expectHistoryRow(dashboard, finalB, wantB)
    // ...and the in-progress card goes with it, also without a reload (P4d-13)
    await expect(inProgress).toHaveCount(0)
    await expect(
      dashboard.locator(`[data-element="active-session-item"][data-session-id="${b.id}"]`)
    ).toHaveCount(0)
    await dashboard.screenshot({ path: `${SHOTS}/dashboard-history.png` })

    // Dates are the reports' end times; newest first
    for (const r of [finalA, finalB]) {
      expect(r.endedAt).toBeGreaterThanOrEqual(t0)
      expect(r.endedAt).toBeLessThanOrEqual(Date.now())
    }
    expect(finalB.endedAt!).toBeGreaterThan(finalA.endedAt!)
    const ids = await dashboard
      .locator('[data-element="session-history-item"]')
      .evaluateAll((rows) => rows.map((row) => row.getAttribute('data-session-id')))
    expect(ids.slice(0, 2)).toEqual([b.id, a.id])
  })

  test.describe('song share page (Phase 4e)', () => {
    let db: Client
    let songId = ''
    test.beforeAll(() => {
      db = songDb()
    })
    test.afterAll(async () => {
      if (songId) await deleteSong(db, songId)
      db.close()
    })

    test('the song share page shows the live report, gated by showAccuracy', async ({
      page,
      browser,
      request,
    }) => {
      playerId = await seedStudent(request)
      const plan = await startSession(request, playerId)
      const planned = plan.parts[0].slots.length
      expect(planned).toBeGreaterThanOrEqual(4)
      console.log(`[4e views] player ${playerId} plan ${plan.id}`)

      // Slot 0 wrong then fixed by a do-over, slots 1 and 2 right; an adult ends it
      await instrument(page)
      await page.goto(`/practice/${playerId}`)
      await answer(page, plan.id, false)
      await doOverCorrectly(page, plan.id, 0)
      await answer(page, plan.id, true)
      await answer(page, plan.id, true)
      const end = await request.patch(`/api/curriculum/${playerId}/sessions/plans/${plan.id}`, {
        data: { action: 'end_early', reason: 'e2e: song share' },
      })
      expect(end.ok(), await end.text()).toBeTruthy()
      const want: Expected = {
        problems: 3,
        tries: 4,
        firstTryCorrect: 2,
        fixed: 1,
        finalCorrect: 3,
      }
      const report = await planReport(request, playerId, plan.id)
      expectCounts(report, want, planned)

      // The song's stored numbers (50%, 7/20) are not the session's (67%, 3/planned)
      const firstTry = pct(want.firstTryCorrect, want.problems)
      const problems = `${want.problems}/${planned}`
      expect(firstTry).toBe('67%')
      expect(pct(report.totals.firstTryCorrect, report.totals.problems)).toBe(firstTry)
      expect(`${report.totals.problems}/${report.totals.plannedProblems}`).toBe(problems)
      const stored = STORED_SONG_INPUT.currentSession
      const storedFirstTry = `${Math.round(stored.accuracy * 100)}%`
      const storedProblems = `${stored.problemsDone}/${stored.problemsTotal}`
      expect(storedFirstTry).not.toBe(firstTry)
      expect(storedProblems).not.toBe(problems)

      const tag = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
      songId = `e2e-4e-song-${tag}`
      const codes = {
        shown: `e2e4e-on-${tag}`,
        hidden: `e2e4e-off-${tag}`,
        revoked: `e2e4e-rv-${tag}`,
      }
      await insertSongWithShares(db, { songId, planId: plan.id, playerId }, [
        { code: codes.shown, visibility: { showAccuracy: true }, status: 'active' },
        { code: codes.hidden, visibility: { showAccuracy: false }, status: 'active' },
        { code: codes.revoked, visibility: { showAccuracy: true }, status: 'revoked' },
      ])

      const visitor = await browser.newContext(noAuth)
      try {
        const song = await visitor.newPage()
        const tiles = song.locator('[data-component="trophy-tile"]')

        // showAccuracy on: the live report's first try and problems, not the stored ones
        let res = await song.goto(`/song/${codes.shown}`)
        expect(res?.status()).toBe(200)
        await expect(song.locator('[data-component="shared-song-page"]')).toBeVisible()
        const firstTryTile = tiles.filter({ hasText: 'First try' })
        const problemsTile = tiles.filter({ hasText: 'Problems' })
        await expect(firstTryTile).toHaveAttribute('data-tone', 'emerald')
        await expect(firstTryTile).toContainText(firstTry)
        await expect(problemsTile).toHaveAttribute('data-tone', 'sky')
        await expect(problemsTile).toContainText(problems)
        await expect(firstTryTile).not.toContainText(storedFirstTry)
        await expect(problemsTile).not.toContainText(storedProblems)
        await song.screenshot({ path: `${SHOTS}/song-share-accuracy.png`, fullPage: true })

        // showAccuracy off: no session numbers at all
        res = await song.goto(`/song/${codes.hidden}`)
        expect(res?.status()).toBe(200)
        await expect(song.locator('[data-component="shared-song-page"]')).toBeVisible()
        await expect(tiles.filter({ hasText: 'First try' })).toHaveCount(0)
        await expect(tiles.filter({ hasText: 'Problems' })).toHaveCount(0)
        for (const text of [firstTry, problems, storedFirstTry, storedProblems]) {
          await expect(song.locator('[data-component="shared-song-page"]')).not.toContainText(text)
        }
        await song.screenshot({ path: `${SHOTS}/song-share-hidden.png`, fullPage: true })

        // A revoked code and a made-up one show no song
        for (const code of [codes.revoked, `e2e4e-bogus-${tag}`]) {
          res = await song.goto(`/song/${code}`)
          expect(res?.status()).toBe(404)
          await expect(song.locator('[data-component="shared-song-page"]')).toHaveCount(0)
        }
      } finally {
        await visitor.close()
      }
    })
  })
})
