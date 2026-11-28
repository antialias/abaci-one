/**
 * End-to-end check of retry / do-over attribution in a real practice session.
 *
 * Each test seeds its own "⚡ Fast Responder" student (mid-L1, tutorials done,
 * mostly strong skills), generates a 1-minute plan (abacus + visualization,
 * 3 + 2 problems, game break between parts), and drives the session with the
 * keyboard. Every check reads both the screen and the plan the server holds.
 *
 * Run against an already-running server:
 *   BASE_URL=http://localhost:3021 npx playwright test retry-redo-attribution --workers=1
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { type APIRequestContext, expect, type Page, test } from '@playwright/test'

const SHOTS = process.env.RF_SHOTS_DIR ?? '/tmp/rf-e2e'

interface Problem {
  terms: number[]
  answer: number
}
interface Slot {
  slotId: string
  problem: Problem
}
interface Result {
  slotId?: string
  partNumber: number
  /** The slot the try answered (the legacy try fields are not written since 6b-1) */
  slotIndex: number
  isCorrect: boolean
  studentAnswer: number
  problem: Problem
  // The try record (Phase 1), stamped by the server
  tryId?: string
  kind?: 'first' | 'retry' | 'do_over'
  round?: number
  practiceOnly?: boolean
  masteryWeight?: number
}
interface Plan {
  id: string
  status: string
  flowState: string
  flowVersion: number
  currentPartIndex: number
  parts: { type: string; slots: Slot[] }[]
  results: Result[]
  /**
   * Each part's position, the cursor and its retry round (the legacy
   * `currentSlotIndex` and `retryState` are not written since 6b-1, §10 P6b1-9)
   */
  partStates: Record<
    string,
    {
      slotIndex: number
      retry?: {
        currentEpoch: number
        currentRetryIndex: number
        currentEpochItems: { originalSlotIndex: number }[]
        pendingRetries: { originalSlotIndex: number }[]
        redeemedSlots?: number[]
      }
    }
  >
}

/** A part's retry round, from its state */
const retryOf = (plan: Plan, partIndex = 0) => plan.partStates[String(partIndex)]?.retry
/** The cursor of the current part (0 for a part no try has reached) */
const cursorOf = (plan: Plan) => plan.partStates[String(plan.currentPartIndex)]?.slotIndex ?? 0

// ---------------------------------------------------------------------------
// Setup: seed a student and start a short two-part session
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

async function startSession(
  request: APIRequestContext,
  playerId: string,
  opts: { breaks?: boolean } = {}
): Promise<Plan> {
  const gen = await request.post(`/api/curriculum/${playerId}/sessions/plans`, {
    data: {
      durationMinutes: 1,
      enabledParts: { abacus: true, visualization: true, linear: false },
      gameBreakSettings: {
        enabled: opts.breaks ?? true,
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
        planId = (await r.json()).plan?.id ?? ''
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
  const plan = await getPlan(request, playerId, planId)
  if (capture) capture.start = plan
  // The scenarios below rely on a part of at least 3 problems before a second part
  expect(plan.parts.length).toBeGreaterThanOrEqual(2)
  expect(plan.parts[0].slots.length).toBeGreaterThanOrEqual(3)
  return plan
}

async function getPlan(request: APIRequestContext, playerId: string, planId: string) {
  const r = await request.get(`/api/curriculum/${playerId}/sessions/plans/${planId}`)
  expect(r.ok()).toBeTruthy()
  return (await r.json()).plan as Plan
}

/** Each skill's lastPracticedAt: moves whenever a try counts toward mastery. */
async function skillsPracticedAt(request: APIRequestContext, playerId: string) {
  const r = await request.get(`/api/curriculum/${playerId}`)
  expect(r.ok()).toBe(true)
  const { skills } = (await r.json()) as {
    skills: { skillId: string; lastPracticedAt: string | null }[]
  }
  return Object.fromEntries(skills.map((s) => [s.skillId, s.lastPracticedAt]))
}

async function cleanupPlayer(request: APIRequestContext, playerId: string) {
  await request.delete(`/api/players/${playerId}`).catch(() => {})
}

// ---------------------------------------------------------------------------
// Page instrumentation: interaction phases and toasts, recorded as they happen
// ---------------------------------------------------------------------------

async function instrument(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as {
      __phases: (string | null)[]
      __toasts: string[]
      __lastPhase?: string | null
    }
    w.__phases = []
    w.__toasts = []
    const record = () => {
      const el = document.querySelector('[data-component="active-session"]')
      const phase = el?.getAttribute('data-phase') ?? null
      if (phase !== w.__lastPhase) {
        w.__lastPhase = phase
        w.__phases.push(phase)
      }
      for (const t of document.querySelectorAll('li[data-swipe-direction]')) {
        const text = (t as HTMLElement).innerText.trim()
        if (text && !w.__toasts.includes(text)) w.__toasts.push(text)
      }
    }
    new MutationObserver(record).observe(document, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-phase'],
    })
  })
}

const toasts = (page: Page) =>
  page.evaluate(() => (window as unknown as { __toasts: string[] }).__toasts)

const phaseMark = (page: Page) =>
  page.evaluate(() => (window as unknown as { __phases: unknown[] }).__phases.length)

// ---------------------------------------------------------------------------
// Screen reading and input
// ---------------------------------------------------------------------------

const activeProblem = (page: Page) =>
  page.locator(
    '[data-element="problem-container"] [data-component="vertical-problem"][data-status="active"]'
  )

/**
 * Waits until the session accepts input and nothing covers the problem (the
 * "Let's practice those again!" countdown), then reads the problem on screen.
 */
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
  const terms = await problem.locator('[data-element="term-row"]').evaluateAll((rows) =>
    rows.map((row) => {
      const text = (row as HTMLElement).innerText
      const digits = Number(text.replace(/\D/g, ''))
      return /[−-]/.test(text) ? -digits : digits
    })
  )
  return { terms, answer }
}

const sameProblem = (a: Problem, b: Problem) =>
  a.answer === b.answer && a.terms.join(',') === b.terms.join(',')

/** Waits until the submit was taken (the phase left inputting). */
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

/**
 * Presses the first key until the problem shows it. The keyboard listener is
 * attached in an effect after the problem renders, so a key pressed in that
 * window is dropped (a real kid just presses again).
 */
async function pressFirstKey(page: Page, key: string) {
  const cells = activeProblem(page).locator('[data-element="answer-cell"]')
  await expect(async () => {
    if ((await cells.count()) === 0) await page.keyboard.press(key)
    await expect(cells).not.toHaveCount(0, { timeout: 1000 })
  }).toPass({ timeout: 10_000 })
}

async function typeCorrect(page: Page, p: Problem, opts: { doublePress?: boolean } = {}) {
  const mark = await phaseMark(page)
  const digits = String(p.answer)
  await pressFirstKey(page, digits[0])
  await page.keyboard.type(digits.slice(1))
  // A correct answer auto-submits; an extra Enter is the kid's double press
  if (opts.doublePress) await page.keyboard.press('Enter')
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

/**
 * Which write a PATCH body is (K4: the client sends every try as
 * `record_try`; a do-over is `mode: 'do_over'`, anything else a first try or
 * a retry). Null for any other action.
 */
function writeOf(body: { action?: string; result?: { mode?: string } }): 'try' | 'do_over' | null {
  if (body.action !== 'record_try') return null
  return body.result?.mode === 'do_over' ? 'do_over' : 'try'
}

const isWrite =
  (write: 'try' | 'do_over') =>
  (r: { request(): { method(): string; postData(): string | null } }) => {
    if (r.request().method() !== 'PATCH') return false
    try {
      return writeOf(JSON.parse(r.request().postData() ?? '{}')) === write
    } catch {
      return false
    }
  }

/** Answers the problem on screen and waits for the server's reply to that write. */
async function answer(
  page: Page,
  planId: string,
  correct: boolean,
  opts: { doublePress?: boolean } = {}
) {
  const p = await shownProblem(page)
  const reply = page.waitForResponse((r) => r.url().includes(planId) && isWrite('try')(r))
  if (correct) await typeCorrect(page, p, opts)
  else await typeWrong(page, p)
  const res = await reply
  return { shown: p, status: res.status() }
}

/** Taps a finished problem's dot in the current part to start a do-over. */
async function startDoOver(page: Page, slotIndex: number) {
  await shownProblem(page)
  const dot = page.locator(
    `[data-element="expanded-section"] button[data-slot-index="${slotIndex}"][data-clickable-for-redo]`
  )
  await dot.click()
  await expect(page.locator('[data-element="redo-mode-banner"]')).toBeVisible()
}

async function doOverCorrectly(page: Page, planId: string, slotIndex: number) {
  await startDoOver(page, slotIndex)
  const p = await shownProblem(page)
  const reply = page.waitForResponse((r) => r.url().includes(planId) && isWrite('do_over')(r))
  await typeCorrect(page, p)
  const res = await reply
  expect(res.status()).toBe(200)
  return p
}

async function passBreak(page: Page) {
  await expect(page.locator('[data-component="part-transition-screen"]')).toBeVisible({
    timeout: 20_000,
  })
  await page.locator('[data-action="skip-transition"]').click()
  await expect(page.locator('[data-component="game-break-screen"]')).toBeVisible({
    timeout: 20_000,
  })
  await page.screenshot({ path: `${SHOTS}/game-break.png` })
  await page.locator('[data-action="skip-break"]').click()
}

const slotProblem = (plan: Plan, part: number, slot: number) => plan.parts[part].slots[slot].problem

async function openSession(page: Page, playerId: string) {
  console.log(`[${test.info().title.slice(0, 40)}] player ${playerId}`)
  await instrument(page)
  await page.goto(`/practice/${playerId}`)
}

// ---------------------------------------------------------------------------
// Capture (CAPTURE_TRY_BODIES=<dir>): each scenario's plan writes and flow
// events as the page sent them (body and reply status, in the order sent) with the plan at the
// start and at the end, one JSON file a scenario. The fixtures of
// `src/test/record-try-k2-captured.test.ts` were captured so, from the client
// at 208433adb (practice-kinds K2). Off by default; scenarios that fake a
// failed save are not captured (their replies are the test's, not a server's).
// ---------------------------------------------------------------------------

const CAPTURE_DIR = process.env.CAPTURE_TRY_BODIES
interface Capture {
  title: string
  start?: Plan
  writes: { route: 'plan' | 'flow-events'; body: unknown; status?: number }[]
}
let capture: Capture | null = null

function startCapture(page: Page, title: string) {
  capture = null
  if (!CAPTURE_DIR || title.includes('failed save')) return
  const current: Capture = { title, writes: [] }
  capture = current
  const routeOf = (method: string, url: string) => {
    const { pathname } = new URL(url)
    if (method === 'PATCH' && /\/sessions\/plans\/[^/?]+$/.test(pathname)) return 'plan'
    if (method === 'POST' && /\/sessions\/plans\/[^/?]+\/flow-events$/.test(pathname)) {
      return 'flow-events'
    }
    return null
  }
  const pending = new Map<unknown, Capture['writes'][number]>()
  page.on('request', (req) => {
    const route = routeOf(req.method(), req.url())
    if (!route) return
    const write = { route, body: JSON.parse(req.postData() ?? 'null') }
    pending.set(req, write)
    current.writes.push(write)
  })
  page.on('response', (res) => {
    const write = pending.get(res.request())
    if (write) write.status = res.status()
  })
}

async function finishCapture(request: APIRequestContext, playerId: string) {
  const done = capture
  capture = null
  if (!CAPTURE_DIR || !done?.start) return
  const end = await getPlan(request, playerId, done.start.id)
  mkdirSync(CAPTURE_DIR, { recursive: true })
  const slug = done.title
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
  writeFileSync(path.join(CAPTURE_DIR, `${slug}.json`), JSON.stringify({ ...done, end }, null, 2))
}

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

test.describe('retry / do-over attribution', () => {
  test.setTimeout(240_000)

  let playerId = ''
  test.beforeEach(async ({ page }, testInfo) => startCapture(page, testInfo.title))
  test.afterEach(async ({ request }) => {
    if (playerId) await finishCapture(request, playerId)
    // RF_KEEP_PLAYERS=1 keeps the students so their plans can be read afterwards
    if (playerId && !process.env.RF_KEEP_PLAYERS) await cleanupPlayer(request, playerId)
    playerId = ''
  })

  test('do-over of the current retry shows the other unfixed problem, and its answer is attributed to it', async ({
    page,
    request,
  }) => {
    playerId = await seedStudent(request)
    const plan = await startSession(request, playerId)
    await openSession(page, playerId)

    // Two wrong, the rest right: a retry round of slots 0 and 1
    const first = await answer(page, plan.id, false)
    expect(sameProblem(first.shown, slotProblem(plan, 0, 0))).toBe(true)
    await answer(page, plan.id, false)
    for (let i = 2; i < plan.parts[0].slots.length; i++) await answer(page, plan.id, true)

    let server = await getPlan(request, playerId, plan.id)
    expect(retryOf(server)?.currentEpoch).toBe(1)
    expect(sameProblem(await shownProblem(page), slotProblem(plan, 0, 0))).toBe(true)
    await page.screenshot({ path: `${SHOTS}/s1-retry-round.png` })

    // Do-over of slot 0 (the current retry item), correct
    await doOverCorrectly(page, plan.id, 0)
    server = await getPlan(request, playerId, plan.id)
    const redo = server.results.at(-1)!
    expect(redo).toMatchObject({ kind: 'do_over', slotIndex: 0, isCorrect: true })
    // A do-over of a once-wrong problem: round 1, weighs 1/2^1 (Phase 1w, §10 P1-9)
    expect(redo).toMatchObject({
      kind: 'do_over',
      round: 1,
      practiceOnly: false,
      masteryWeight: 0.5,
    })
    expect(retryOf(server)?.redeemedSlots).toContain(0)

    // The screen moves on to slot 1, not back to the redeemed slot 0
    const next = await shownProblem(page)
    await page.screenshot({ path: `${SHOTS}/s1-after-doover.png` })
    expect(sameProblem(next, slotProblem(plan, 0, 1))).toBe(true)

    const r = await answer(page, plan.id, true)
    expect(r.status).toBe(200)
    server = await getPlan(request, playerId, plan.id)
    const last = server.results.at(-1)!
    expect(last).toMatchObject({
      slotId: plan.parts[0].slots[1].slotId,
      slotIndex: 1,
      kind: 'retry',
      round: 1,
      isCorrect: true,
    })
    expect(server.currentPartIndex).toBe(1)
    await expect(page.locator('[data-component="part-transition-screen"]')).toBeVisible({
      timeout: 20_000,
    })
    expect(await toasts(page)).toEqual([])
  })

  test('do-overs that redeem every retry move the session on', async ({ page, request }) => {
    playerId = await seedStudent(request)
    const plan = await startSession(request, playerId)
    await openSession(page, playerId)

    await answer(page, plan.id, false)
    await answer(page, plan.id, false)
    for (let i = 2; i < plan.parts[0].slots.length; i++) await answer(page, plan.id, true)

    await doOverCorrectly(page, plan.id, 0)
    expect(sameProblem(await shownProblem(page), slotProblem(plan, 0, 1))).toBe(true)
    await doOverCorrectly(page, plan.id, 1)

    await expect(page.locator('[data-component="part-transition-screen"]')).toBeVisible({
      timeout: 20_000,
    })
    await page.screenshot({ path: `${SHOTS}/s2-moved-on.png` })
    const server = await getPlan(request, playerId, plan.id)
    expect(server.currentPartIndex).toBe(1)
    expect(server.status).toBe('in_progress')
    expect(server.results.filter((r) => r.partNumber === 1 && r.kind === 'do_over')).toHaveLength(2)
    expect(await toasts(page)).toEqual([])
  })

  test('fast answers with double presses record one try per slot; a replayed write is a no-op', async ({
    page,
    request,
  }) => {
    playerId = await seedStudent(request)
    const plan = await startSession(request, playerId)
    await openSession(page, playerId)

    const bodies: string[] = []
    page.on('request', (req) => {
      if (req.method() === 'PATCH' && req.url().includes(plan.id)) bodies.push(req.postData() ?? '')
    })

    const n = plan.parts[0].slots.length
    for (let i = 0; i < n; i++) await answer(page, plan.id, true, { doublePress: true })
    await expect(page.locator('[data-component="part-transition-screen"]')).toBeVisible({
      timeout: 20_000,
    })

    const records = bodies.filter((b) => writeOf(JSON.parse(b)) === 'try')
    expect(records).toHaveLength(n)

    // The same write sent again (a retried request) changes nothing
    const replay = await request.patch(`/api/curriculum/${playerId}/sessions/plans/${plan.id}`, {
      data: JSON.parse(records.at(-1)!),
    })
    const server = await getPlan(request, playerId, plan.id)
    const part1 = server.results.filter((r) => r.partNumber === 1)
    expect(replay.status(), await replay.text()).toBeLessThan(500)
    expect(part1.map((r) => r.slotIndex)).toEqual([...Array(n).keys()])
    expect(part1.map((r) => r.slotId)).toEqual(plan.parts[0].slots.map((s) => s.slotId))
    expect(server.currentPartIndex).toBe(1)
    expect(await toasts(page)).toEqual([])
  })

  test('full rhythm: part, game break, part, summary; summary counts match the results', async ({
    page,
    request,
  }) => {
    playerId = await seedStudent(request)
    const plan = await startSession(request, playerId)
    await openSession(page, playerId)

    // Part 1: first wrong, then a normal retry round
    await answer(page, plan.id, false)
    for (let i = 1; i < plan.parts[0].slots.length; i++) await answer(page, plan.id, true)
    const retry = await answer(page, plan.id, true)
    expect(sameProblem(retry.shown, slotProblem(plan, 0, 0))).toBe(true)

    for (let part = 1; part < plan.parts.length; part++) {
      await passBreak(page)
      for (let i = 0; i < plan.parts[part].slots.length; i++) await answer(page, plan.id, true)
    }

    await expect(page.locator('[data-component="practice-summary-page"]')).toBeVisible({
      timeout: 30_000,
    })
    await expect(page).toHaveURL(new RegExp(`/practice/${playerId}/summary`))
    await page.screenshot({ path: `${SHOTS}/s4-summary.png`, fullPage: true })
    const server = await getPlan(request, playerId, plan.id)
    expect(server.status).toBe('completed')
    // The summary shows the session report's totals; the report counts the stored tries
    const reportRes = await request.get(
      `/api/curriculum/${playerId}/sessions/plans/${plan.id}/report`
    )
    expect(reportRes.ok()).toBe(true)
    const { totals } = (await reportRes.json()).report as {
      totals: { problems: number; tries: number }
    }
    expect(totals.tries).toBe(server.results.length)
    expect(totals.problems).toBe(plan.parts.reduce((n, p) => n + p.slots.length, 0))
    const problemsStat = page.locator('[data-element="stat-problems"]').first()
    await expect(problemsStat.locator('[data-value]')).toHaveText(`${totals.problems}`)
    await expect(problemsStat).toContainText(`${totals.tries} tries`)
    const retryTry = server.results.find((r) => r.partNumber === 1 && r.kind === 'retry')
    expect(retryTry).toMatchObject({
      slotId: plan.parts[0].slots[0].slotId,
      slotIndex: 0,
      round: 1,
    })
    expect(await toasts(page)).toEqual([])
  })

  for (const failure of ['500', 'contention', 'abort', 'lost-reply'] as const) {
    test(`a failed save (${failure}) is resent once with the same tryId and the session goes on`, async ({
      page,
      request,
    }) => {
      playerId = await seedStudent(request)
      const plan = await startSession(request, playerId)
      await openSession(page, playerId)

      // Fail exactly the second record write (slot 1); the client resends it once
      let recordCount = 0
      const recordTryIds: string[] = []
      await page.route(`**/sessions/plans/${plan.id}`, async (route) => {
        const req = route.request()
        const body = JSON.parse(req.postData() ?? '{}')
        if (req.method() === 'PATCH' && writeOf(body) === 'try') {
          recordCount++
          recordTryIds.push(body.result?.tryId)
          if (recordCount === 2) {
            if (failure === 'abort') return route.abort('failed')
            if (failure === 'lost-reply') await route.fetch() // reaches the server, reply lost
            // contention: the server's row CAS lost three times (Phase 3a's 503)
            return route.fulfill(
              failure === 'contention'
                ? {
                    status: 503,
                    contentType: 'application/json',
                    body: JSON.stringify({
                      error: 'Injected contention',
                      code: 'write_contention',
                    }),
                  }
                : {
                    status: 500,
                    contentType: 'application/json',
                    body: JSON.stringify({ error: 'Injected failure' }),
                  }
            )
          }
        }
        return route.continue()
      })

      await answer(page, plan.id, true)
      const failedShown = await shownProblem(page)
      expect(sameProblem(failedShown, slotProblem(plan, 0, 1))).toBe(true)
      const failedReply = page.waitForRequest(
        (r) => r.method() === 'PATCH' && writeOf(JSON.parse(r.postData() ?? '{}')) === 'try'
      )
      await typeCorrect(page, failedShown)
      await failedReply

      // The resend (same tryId) lands, or for a lost reply is the no-op of an
      // already-recorded try: either way slot 1 is recorded once and slot 2 is up
      const expectedSlot = 2
      await expect
        .poll(async () => cursorOf(await getPlan(request, playerId, plan.id)))
        .toBe(expectedSlot)
      await expect
        .poll(
          async () => sameProblem(await shownProblem(page), slotProblem(plan, 0, expectedSlot)),
          {
            timeout: 20_000,
          }
        )
        .toBe(true)
      await page.screenshot({ path: `${SHOTS}/s5-${failure}-after.png` })

      for (let i = expectedSlot; i < plan.parts[0].slots.length; i++) {
        const r = await answer(page, plan.id, true)
        expect(r.status).toBe(200)
      }
      await expect(page.locator('[data-component="part-transition-screen"]')).toBeVisible({
        timeout: 20_000,
      })
      const end = await getPlan(request, playerId, plan.id)
      const part1 = end.results.filter((r) => r.partNumber === 1)
      expect(part1.map((r) => r.slotId)).toEqual(plan.parts[0].slots.map((s) => s.slotId))
      expect(end.currentPartIndex).toBe(1)
      expect(recordTryIds[2]).toBe(recordTryIds[1])
      expect(new Set(part1.map((r) => r.tryId)).size).toBe(part1.length)
      expect(await toasts(page)).toEqual([])
    })
  }

  test('a save that fails twice tells the kid plainly, resyncs, and the session goes on', async ({
    page,
    request,
  }) => {
    playerId = await seedStudent(request)
    const plan = await startSession(request, playerId)
    await openSession(page, playerId)

    // Fail the second record write and its one resend
    let recordCount = 0
    await page.route(`**/sessions/plans/${plan.id}`, async (route) => {
      const req = route.request()
      if (req.method() === 'PATCH' && writeOf(JSON.parse(req.postData() ?? '{}')) === 'try') {
        recordCount++
        if (recordCount === 2 || recordCount === 3) return route.abort('failed')
      }
      return route.continue()
    })

    await answer(page, plan.id, true)
    const failedShown = await shownProblem(page)
    await typeCorrect(page, failedShown)

    // The screen resyncs to the problem the server is on: slot 1, unsaved
    await expect
      .poll(async () => sameProblem(await shownProblem(page), slotProblem(plan, 0, 1)), {
        timeout: 20_000,
      })
      .toBe(true)
    expect(recordCount).toBe(3)
    const shown = await toasts(page)
    expect(shown.length).toBeGreaterThan(0)
    for (const text of shown) expect(text).not.toMatch(/fetch|inject|error|failed|\d{3}/i)
    await page.screenshot({ path: `${SHOTS}/s5-double-failure-after.png` })

    for (let i = 1; i < plan.parts[0].slots.length; i++) {
      const r = await answer(page, plan.id, true)
      expect(r.status).toBe(200)
    }
    await expect(page.locator('[data-component="part-transition-screen"]')).toBeVisible({
      timeout: 20_000,
    })
    const end = await getPlan(request, playerId, plan.id)
    const part1 = end.results.filter((r) => r.partNumber === 1)
    expect(part1.map((r) => r.slotId)).toEqual(plan.parts[0].slots.map((s) => s.slotId))
  })

  test('a stale tab answering an old problem resyncs quietly (409, no toast)', async ({
    page,
    context,
    request,
  }) => {
    playerId = await seedStudent(request)
    const plan = await startSession(request, playerId)
    await openSession(page, playerId)
    const stale = await context.newPage()
    await openSession(stale, playerId)
    const staleShown = await shownProblem(stale)
    expect(sameProblem(staleShown, slotProblem(plan, 0, 0))).toBe(true)

    // Tab A answers slot 0; tab B still has slot 0 up, unless it already synced
    await answer(page, plan.id, true)
    await expect.poll(async () => cursorOf(await getPlan(request, playerId, plan.id))).toBe(1)

    const nowOnB = await shownProblem(stale)
    if (!sameProblem(nowOnB, slotProblem(plan, 0, 0))) {
      console.log('[stale tab] tab B synced before answering')
      expect(sameProblem(nowOnB, slotProblem(plan, 0, 1))).toBe(true)
      return
    }
    const reply = stale.waitForResponse((r) => r.url().includes(plan.id) && isWrite('try')(r))
    await typeWrong(stale, nowOnB)
    const status = (await reply).status()
    console.log(`[stale tab] reply to the old problem's answer: ${status}`)

    await expect
      .poll(async () => sameProblem(await shownProblem(stale), slotProblem(plan, 0, 1)), {
        timeout: 20_000,
      })
      .toBe(true)
    await stale.screenshot({ path: `${SHOTS}/s5-stale-tab-after.png` })
    expect(await toasts(stale)).toEqual([])
    const server = await getPlan(request, playerId, plan.id)
    if (status === 409) {
      expect(server.results.filter((r) => r.partNumber === 1)).toHaveLength(1)
    }
    await stale.close()
  })

  test('do-overs in an ordinary stretch: a wrong one is redeemed in place, a correct one keeps the position', async ({
    page,
    request,
  }) => {
    playerId = await seedStudent(request)
    const plan = await startSession(request, playerId)
    await openSession(page, playerId)

    await answer(page, plan.id, true)
    await answer(page, plan.id, false)

    // Slot 2 is up; do over slot 1 (wrong) correctly
    expect(sameProblem(await shownProblem(page), slotProblem(plan, 0, 2))).toBe(true)
    await doOverCorrectly(page, plan.id, 1)
    let server = await getPlan(request, playerId, plan.id)
    expect(server.results.at(-1)).toMatchObject({ kind: 'do_over', slotIndex: 1 })
    // Redeemed: round 1 (one counted try before it), weighs 1/2^1 (Phase 1w, §10 P1-9)
    expect(server.results.at(-1)).toMatchObject({
      kind: 'do_over',
      round: 1,
      practiceOnly: false,
      masteryWeight: 0.5,
    })
    expect(retryOf(server)?.pendingRetries ?? []).toHaveLength(0)
    expect(cursorOf(server)).toBe(2)
    expect(sameProblem(await shownProblem(page), slotProblem(plan, 0, 2))).toBe(true)

    // Do over slot 0 (correct): recorded as practice, the position and mastery do not move
    const before = server.results.length
    const practicedBefore = await skillsPracticedAt(request, playerId)
    await startDoOver(page, 0)
    const redoReply = page.waitForResponse(
      (r) => r.url().includes(plan.id) && isWrite('do_over')(r)
    )
    await typeCorrect(page, await shownProblem(page))
    expect((await redoReply).status()).toBe(200)
    await expect
      .poll(async () => sameProblem(await shownProblem(page), slotProblem(plan, 0, 2)))
      .toBe(true)
    server = await getPlan(request, playerId, plan.id)
    expect(cursorOf(server)).toBe(2)
    expect(server.results).toHaveLength(before + 1)
    expect(server.results.at(-1)).toMatchObject({
      slotId: plan.parts[0].slots[0].slotId,
      kind: 'do_over',
      round: 1,
      practiceOnly: true,
      masteryWeight: 0,
    })
    expect(retryOf(server)?.pendingRetries ?? []).toHaveLength(0)
    expect(await skillsPracticedAt(request, playerId)).toEqual(practicedBefore)

    // Slot 2 is attributed to slot 2, and no retry round follows
    await answer(page, plan.id, true)
    await expect(page.locator('[data-component="part-transition-screen"]')).toBeVisible({
      timeout: 20_000,
    })
    server = await getPlan(request, playerId, plan.id)
    const last = server.results.filter((r) => r.kind !== 'do_over').at(-1)!
    expect(last).toMatchObject({ slotId: plan.parts[0].slots[2].slotId, slotIndex: 2 })
    expect(server.currentPartIndex).toBe(1)
    expect(await toasts(page)).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Phase 3c: the client renders from the server's flowState
// ---------------------------------------------------------------------------

const transitionScreen = (page: Page) => page.locator('[data-component="part-transition-screen"]')

/** Answers every problem of part 0 correctly; the server is then in part_transition. */
async function finishFirstPart(
  page: Page,
  request: APIRequestContext,
  playerId: string,
  plan: Plan
) {
  for (let i = 0; i < plan.parts[0].slots.length; i++) await answer(page, plan.id, true)
  await expect(transitionScreen(page)).toBeVisible({ timeout: 20_000 })
  const server = await getPlan(request, playerId, plan.id)
  expect(server).toMatchObject({ flowState: 'part_transition', currentPartIndex: 1 })
  return server
}

test.describe('the client renders from the server flow state (Phase 3c)', () => {
  test.setTimeout(240_000)

  let playerId = ''
  test.beforeEach(async ({ page }, testInfo) => startCapture(page, testInfo.title))
  test.afterEach(async ({ request }) => {
    if (playerId) await finishCapture(request, playerId)
    if (playerId && !process.env.RF_KEEP_PLAYERS) await cleanupPlayer(request, playerId)
    playerId = ''
  })

  test('a reload during part_transition shows the screen, completes it, and the break runs', async ({
    page,
    request,
  }) => {
    playerId = await seedStudent(request)
    const plan = await startSession(request, playerId)
    await openSession(page, playerId)
    await finishFirstPart(page, request, playerId, plan)

    await page.reload()
    // Before 3c a reloaded tab showed no transition screen (it rendered from a
    // part-index change it never saw) and answered into the transition
    await expect(transitionScreen(page)).toBeVisible({ timeout: 20_000 })
    await page.screenshot({ path: `${SHOTS}/s3c-reload-transition.png` })
    // Its countdown runs out and the transition completes: the break starts
    await expect(page.locator('[data-component="game-break-screen"]')).toBeVisible({
      timeout: 30_000,
    })
    await expect
      .poll(async () => (await getPlan(request, playerId, plan.id)).flowState)
      .toMatch(/^break_(pending|active)$/)
    await page.locator('[data-action="skip-break"]').click()
    const next = await shownProblem(page)
    expect(sameProblem(next, slotProblem(plan, 1, 0))).toBe(true)
    expect(await toasts(page)).toEqual([])
  })

  test('a stale flow token refetches and completes the transition with no toast (breaks off, P3a-8)', async ({
    page,
    request,
  }) => {
    playerId = await seedStudent(request)
    const plan = await startSession(request, playerId, { breaks: false })
    await openSession(page, playerId)

    // The part-ending try's reply reaches the tab carrying an older flow
    // version than the server's, so the tab's PART_TRANSITION_COMPLETED goes
    // out with a stale token, as when that reply outran the countdown (§10 P3a-8)
    await page.route(`**/sessions/plans/${plan.id}`, async (route) => {
      const req = route.request()
      const body = JSON.parse(req.postData() ?? '{}')
      if (req.method() !== 'PATCH' || writeOf(body) !== 'try') return route.continue()
      const res = await route.fetch()
      const json = await res.json()
      if (json.plan?.flowState === 'part_transition') json.plan.flowVersion -= 1
      return route.fulfill({ response: res, json })
    })
    const sentVersions: number[] = []
    await page.route(`**/sessions/plans/${plan.id}/flow-events`, async (route) => {
      const body = JSON.parse(route.request().postData() ?? '{}')
      if (body.event?.type === 'PART_TRANSITION_COMPLETED')
        sentVersions.push(body.expectedFlowVersion)
      return route.continue()
    })

    const inTransition = await finishFirstPart(page, request, playerId, plan)
    await page.locator('[data-action="skip-transition"]').click()

    // The stale event got 409; the plan was refetched and the event sent again
    // with the fresh token; the session goes on to part 2
    await expect
      .poll(async () => (await getPlan(request, playerId, plan.id)).flowState, { timeout: 20_000 })
      .toBe('practicing')
    const next = await shownProblem(page)
    expect(sameProblem(next, slotProblem(plan, 1, 0))).toBe(true)
    await expect(transitionScreen(page)).toHaveCount(0)
    // Stale first (else this test exercised nothing), then the refetched token
    expect(sentVersions).toEqual([inTransition.flowVersion - 1, inTransition.flowVersion])
    await page.screenshot({ path: `${SHOTS}/s3c-stale-token-after.png` })
    expect(await toasts(page)).toEqual([])
  })

  test('an adult ends the session during the countdown: the kid leaves the transition, no reload, no toast', async ({
    page,
    request,
  }) => {
    playerId = await seedStudent(request)
    const plan = await startSession(request, playerId)
    await openSession(page, playerId)
    await finishFirstPart(page, request, playerId, plan)

    // The teacher ends early; the kid's tab gets no push for it
    const end = await request.patch(`/api/curriculum/${playerId}/sessions/plans/${plan.id}`, {
      data: { action: 'end_early', reason: 'e2e: adult ends during the countdown' },
    })
    expect(end.ok()).toBe(true)
    await expect(transitionScreen(page)).toBeVisible()

    // The kid goes on: the event meets a completed plan (409, not stale)
    const reply = page.waitForResponse(
      (r) =>
        r.url().endsWith(`/sessions/plans/${plan.id}/flow-events`) &&
        r.request().method() === 'POST'
    )
    await page.locator('[data-action="skip-transition"]').click()
    const res = await reply
    expect(res.status()).toBe(409)
    expect((await res.json()).code).toBe('INVALID_FLOW_TRANSITION')

    // The plan fetched after the failure drives the screen: off to the summary
    await page.waitForURL(`**/practice/${playerId}/summary**`, { timeout: 20_000 })
    expect(await toasts(page)).toEqual([])
  })

  test('a 503 on an optimistic advance: one row, the queued answer waits for the resend', async ({
    page,
    request,
  }) => {
    playerId = await seedStudent(request)
    const plan = await startSession(request, playerId)
    await openSession(page, playerId)

    // Record write 2 (slot 1) answers 503 write_contention; its resend (3) is
    // held until the kid has answered slot 2, so that answer has to queue
    let recordCount = 0
    const recordTryIds: string[] = []
    let releaseResend!: () => void
    const resendHeld = new Promise<void>((resolve) => {
      releaseResend = resolve
    })
    let resendArrived!: () => void
    const resendSeen = new Promise<void>((resolve) => {
      resendArrived = resolve
    })
    await page.route(`**/sessions/plans/${plan.id}`, async (route) => {
      const req = route.request()
      const body = JSON.parse(req.postData() ?? '{}')
      if (req.method() !== 'PATCH' || writeOf(body) !== 'try') return route.continue()
      recordCount++
      recordTryIds.push(body.result?.tryId)
      if (recordCount === 2) {
        return route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Injected contention', code: 'write_contention' }),
        })
      }
      if (recordCount === 3) {
        resendArrived()
        await resendHeld
      }
      return route.continue()
    })

    await answer(page, plan.id, true)
    const slot1 = await shownProblem(page)
    expect(sameProblem(slot1, slotProblem(plan, 0, 1))).toBe(true)
    await typeCorrect(page, slot1)
    await resendSeen

    // Slot 2 is up optimistically; its answer is taken but not sent
    const slot2 = await shownProblem(page)
    expect(sameProblem(slot2, slotProblem(plan, 0, 2))).toBe(true)
    const slot2Reply = page.waitForResponse(
      (r) => r.url().includes(plan.id) && isWrite('try')(r) && r.status() === 200
    )
    await typeCorrect(page, slot2)
    expect(recordCount).toBe(3)

    releaseResend()
    await slot2Reply
    await expect(transitionScreen(page)).toBeVisible({ timeout: 20_000 })
    const end = await getPlan(request, playerId, plan.id)
    const part1 = end.results.filter((r) => r.partNumber === 1)
    expect(part1.map((r) => r.slotId)).toEqual(plan.parts[0].slots.map((s) => s.slotId))
    expect(recordTryIds[2]).toBe(recordTryIds[1])
    expect(recordCount).toBe(4)
    expect(end).toMatchObject({ flowState: 'part_transition', currentPartIndex: 1 })
    expect(await toasts(page)).toEqual([])
  })

  test('a try that reaches a break gets 409 not_practicing and the tab applies its plan', async ({
    page,
    context,
    request,
  }) => {
    playerId = await seedStudent(request)
    const plan = await startSession(request, playerId)
    await openSession(page, playerId)
    const last = plan.parts[0].slots.length - 1
    for (let i = 0; i < last; i++) await answer(page, plan.id, true)

    // Tab B opens on part 0's last problem
    const stale = await context.newPage()
    await openSession(stale, playerId)
    expect(sameProblem(await shownProblem(stale), slotProblem(plan, 0, last))).toBe(true)

    // Tab A finishes the part and goes through the transition into the break
    await answer(page, plan.id, true)
    await expect(transitionScreen(page)).toBeVisible({ timeout: 20_000 })
    await page.locator('[data-action="skip-transition"]').click()
    await expect(page.locator('[data-component="game-break-screen"]')).toBeVisible({
      timeout: 20_000,
    })
    await expect
      .poll(async () => (await getPlan(request, playerId, plan.id)).flowState)
      .toMatch(/^break_(pending|active)$/)

    if (!sameProblem(await shownProblem(stale), slotProblem(plan, 0, last))) {
      throw new Error('tab B synced before answering; the 409 path was not exercised')
    }
    const reply = stale.waitForResponse((r) => r.url().includes(plan.id) && isWrite('try')(r))
    await typeCorrect(stale, slotProblem(plan, 0, last))
    const res = await reply
    expect(res.status()).toBe(409)
    const body = await res.json()
    expect(body).toMatchObject({ code: 'not_practicing', plan: { id: plan.id } })
    expect(body.plan.flowState).toMatch(/^break_(pending|active)$/)

    // Tab B renders the break from the plan the 409 carried; nothing recorded
    await expect(stale.locator('[data-component="game-break-screen"]')).toBeVisible({
      timeout: 20_000,
    })
    await stale.screenshot({ path: `${SHOTS}/s3c-not-practicing-after.png` })
    const server = await getPlan(request, playerId, plan.id)
    expect(server.results.filter((r) => r.partNumber === 1)).toHaveLength(
      plan.parts[0].slots.length
    )
    expect(await toasts(stale)).toEqual([])
    await stale.close()
  })
})
