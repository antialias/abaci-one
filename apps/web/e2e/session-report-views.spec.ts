/**
 * Phase 4c in a real browser: the parent observer and the public share link
 * show the same numbers as the session report, live and after the end.
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
import {
  type APIRequestContext,
  type BrowserContext,
  expect,
  type Locator,
  type Page,
  test,
} from '@playwright/test'

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

const noAuth = { storageState: { cookies: [], origins: [] } }

// ---------------------------------------------------------------------------
// Scenario
// ---------------------------------------------------------------------------

test.describe('session report views (Phases 4c, 4d)', () => {
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
})
