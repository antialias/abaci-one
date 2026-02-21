/**
 * E2E tests for tier enforcement
 *
 * Verifies server-side enforcement of tier limits:
 * - Practice student count
 * - Session duration clamping
 * - Sessions per week
 *
 * All tests run as the admin user (via auth.setup.ts storage state).
 * Uses the debug billing-set-tier endpoint to toggle tiers.
 *
 * API-only — no browser page needed, uses the `request` fixture directly.
 */

import { expect, test, type APIRequestContext } from '@playwright/test'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function setTier(request: APIRequestContext, tier: 'free' | 'family') {
  const res = await request.post('/api/debug/billing-set-tier', {
    data: { tier },
  })
  expect(res.ok(), `setTier(${tier}) failed: ${await res.text()}`).toBeTruthy()
}

async function createPlayer(request: APIRequestContext, name: string) {
  const res = await request.post('/api/players', {
    data: { name, emoji: '🧪', color: '#6366f1', isPracticeStudent: true },
  })
  expect(res.ok(), `createPlayer failed: ${await res.text()}`).toBeTruthy()
  const { player } = await res.json()
  return player as { id: string; name: string }
}

async function deletePlayer(request: APIRequestContext, id: string) {
  await request.delete(`/api/players/${id}`)
}

/** Archive all practice students so they don't count toward limits. */
async function archiveAllPracticeStudents(request: APIRequestContext) {
  const res = await request.post('/api/debug/archive-practice-students', {
    data: { archive: true },
  })
  expect(res.ok(), `archiveAll failed: ${await res.text()}`).toBeTruthy()
}

/** Unarchive all practice students (restore original state). */
async function unarchiveAllPracticeStudents(request: APIRequestContext) {
  const res = await request.post('/api/debug/archive-practice-students', {
    data: { archive: false },
  })
  expect(res.ok(), `unarchiveAll failed: ${await res.text()}`).toBeTruthy()
}

async function enableSkills(request: APIRequestContext, playerId: string) {
  const res = await request.put(`/api/curriculum/${playerId}/skills`, {
    data: {
      masteredSkillIds: ['1a-direct-addition', '1b-heaven-bead', '1c-simple-combinations'],
    },
  })
  expect(res.ok(), `enableSkills failed: ${await res.text()}`).toBeTruthy()
}

async function createOfflineSession(request: APIRequestContext, playerId: string) {
  const res = await request.post(`/api/curriculum/${playerId}/offline-sessions`, {
    multipart: {
      practiceTypes: '["abacus"]',
    },
  })
  return res
}

async function waitForTask(
  request: APIRequestContext,
  taskId: string,
  timeoutMs = 30_000
) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const res = await request.get(`/api/admin/tasks?taskId=${taskId}`)
    expect(res.ok(), `waitForTask failed: ${await res.text()}`).toBeTruthy()
    const { task } = await res.json()
    if (task.status === 'completed') return task
    if (task.status === 'failed') {
      throw new Error(`Task ${taskId} failed: ${task.error}`)
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`Task ${taskId} timed out after ${timeoutMs}ms`)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Tier enforcement', () => {
  // All tests share the admin user's tier + player state — must run serially
  test.describe.configure({ mode: 'serial' })

  // Track players created during each test for cleanup
  const createdPlayerIds: string[] = []

  test.beforeEach(async ({ request }) => {
    createdPlayerIds.length = 0
    // Archive pre-existing practice students so they don't count toward limits
    await archiveAllPracticeStudents(request)
    await setTier(request, 'free')
  })

  test.afterEach(async ({ request }) => {
    // Delete players created during this test
    for (const id of createdPlayerIds) {
      await deletePlayer(request, id)
    }
    // Restore: unarchive original practice students + restore family tier
    // (family tier is the default set by auth.setup.ts so other tests can create players)
    await unarchiveAllPracticeStudents(request)
    await setTier(request, 'family')
  })

  // -----------------------------------------------------------------------
  // Tier API endpoint
  // -----------------------------------------------------------------------

  test.describe('Tier API endpoint', () => {
    test('free user gets correct limits', async ({ request }) => {
      await setTier(request, 'free')

      const res = await request.get('/api/billing/tier')
      expect(res.ok()).toBeTruthy()
      const body = await res.json()

      expect(body.tier).toBe('free')
      expect(body.limits.maxPracticeStudents).toBe(1)
      expect(body.limits.maxSessionMinutes).toBe(10)
      expect(body.limits.maxSessionsPerWeek).toBe(5)
      expect(body.limits.maxOfflineParsingPerMonth).toBe(3)
    })

    test('family user gets correct limits', async ({ request }) => {
      await setTier(request, 'family')

      const res = await request.get('/api/billing/tier')
      expect(res.ok()).toBeTruthy()
      const body = await res.json()

      expect(body.tier).toBe('family')
      expect(body.limits.maxPracticeStudents).toBeNull()
      expect(body.limits.maxSessionMinutes).toBe(20)
      expect(body.limits.maxSessionsPerWeek).toBeNull()
      expect(body.limits.maxOfflineParsingPerMonth).toBe(30)
    })
  })

  // -----------------------------------------------------------------------
  // Practice student limit
  // -----------------------------------------------------------------------

  test.describe('Practice student limit', () => {
    test('free: 2nd student blocked', async ({ request }) => {
      await setTier(request, 'free')

      const player1 = await createPlayer(request, 'Student One')
      createdPlayerIds.push(player1.id)

      // 2nd student should be blocked
      const res = await request.post('/api/players', {
        data: { name: 'Student Two', emoji: '🧪', color: '#6366f1', isPracticeStudent: true },
      })
      expect(res.status()).toBe(403)
      const body = await res.json()
      expect(body.code).toBe('PRACTICE_STUDENT_LIMIT_REACHED')
    })

    test('upgrade unlocks 2nd student', async ({ request }) => {
      await setTier(request, 'free')

      const player1 = await createPlayer(request, 'Student One')
      createdPlayerIds.push(player1.id)

      // Blocked on free
      const blockedRes = await request.post('/api/players', {
        data: { name: 'Student Two', emoji: '🧪', color: '#6366f1', isPracticeStudent: true },
      })
      expect(blockedRes.status()).toBe(403)

      // Upgrade to family
      await setTier(request, 'family')

      // Now succeeds
      const player2Res = await request.post('/api/players', {
        data: { name: 'Student Two', emoji: '🧪', color: '#6366f1', isPracticeStudent: true },
      })
      expect(player2Res.ok(), `2nd student after upgrade failed: ${await player2Res.text()}`).toBeTruthy()
      const { player: player2 } = await player2Res.json()
      createdPlayerIds.push(player2.id)
    })

    test('family: can create 3+ students', async ({ request }) => {
      await setTier(request, 'family')

      for (let i = 1; i <= 3; i++) {
        const player = await createPlayer(request, `Family Student ${i}`)
        createdPlayerIds.push(player.id)
      }
      // If we got here, all 3 succeeded
    })
  })

  // -----------------------------------------------------------------------
  // Session duration clamping
  // -----------------------------------------------------------------------

  test.describe('Session duration clamping', () => {
    test('free: 15 min clamped to 10', async ({ request }) => {
      await setTier(request, 'free')

      const player = await createPlayer(request, 'Duration Test Free')
      createdPlayerIds.push(player.id)
      await enableSkills(request, player.id)

      // Request 15 min session
      const createRes = await request.post(
        `/api/curriculum/${player.id}/sessions/plans`,
        { data: { durationMinutes: 15 } }
      )
      expect(createRes.status()).toBe(202)
      const { taskId } = await createRes.json()

      // Wait for plan generation
      await waitForTask(request, taskId)

      // Fetch the active plan
      const planRes = await request.get(`/api/curriculum/${player.id}/sessions/plans`)
      expect(planRes.ok()).toBeTruthy()
      const { plan } = await planRes.json()
      expect(plan).not.toBeNull()
      expect(plan.targetDurationMinutes).toBe(10)

      // Abandon the plan to clean up
      const abandonRes = await request.patch(
        `/api/curriculum/${player.id}/sessions/plans/${plan.id}`,
        { data: { action: 'abandon' } }
      )
      expect(abandonRes.ok(), `abandon failed: ${await abandonRes.text()}`).toBeTruthy()
    })

    test('family: 15 min honored', async ({ request }) => {
      await setTier(request, 'family')

      const player = await createPlayer(request, 'Duration Test Family')
      createdPlayerIds.push(player.id)
      await enableSkills(request, player.id)

      // Request 15 min session
      const createRes = await request.post(
        `/api/curriculum/${player.id}/sessions/plans`,
        { data: { durationMinutes: 15 } }
      )
      expect(createRes.status()).toBe(202)
      const { taskId } = await createRes.json()

      // Wait for plan generation
      await waitForTask(request, taskId)

      // Fetch the active plan
      const planRes = await request.get(`/api/curriculum/${player.id}/sessions/plans`)
      expect(planRes.ok()).toBeTruthy()
      const { plan } = await planRes.json()
      expect(plan).not.toBeNull()
      expect(plan.targetDurationMinutes).toBe(15)

      // Abandon the plan to clean up
      const abandonRes = await request.patch(
        `/api/curriculum/${player.id}/sessions/plans/${plan.id}`,
        { data: { action: 'abandon' } }
      )
      expect(abandonRes.ok(), `abandon failed: ${await abandonRes.text()}`).toBeTruthy()
    })
  })

  // -----------------------------------------------------------------------
  // Sessions per week limit
  // -----------------------------------------------------------------------

  test.describe('Sessions per week limit', () => {
    test('free: 6th session blocked', async ({ request }) => {
      await setTier(request, 'free')

      const player = await createPlayer(request, 'Weekly Limit Test')
      createdPlayerIds.push(player.id)
      await enableSkills(request, player.id)

      // Create 5 offline sessions (the free limit)
      for (let i = 0; i < 5; i++) {
        const res = await createOfflineSession(request, player.id)
        expect(res.ok(), `offline session ${i + 1} failed: ${await res.text()}`).toBeTruthy()
      }

      // 6th should be blocked
      const blockedRes = await createOfflineSession(request, player.id)
      expect(blockedRes.status()).toBe(403)
      const body = await blockedRes.json()
      expect(body.code).toBe('SESSION_LIMIT_REACHED')
    })

    test('free: online session also blocked when at limit', async ({ request }) => {
      await setTier(request, 'free')

      const player = await createPlayer(request, 'Weekly Online Block')
      createdPlayerIds.push(player.id)
      await enableSkills(request, player.id)

      // Fill up with 5 offline sessions
      for (let i = 0; i < 5; i++) {
        const res = await createOfflineSession(request, player.id)
        expect(res.ok(), `offline session ${i + 1} failed: ${await res.text()}`).toBeTruthy()
      }

      // Online session plan should also be blocked
      const planRes = await request.post(
        `/api/curriculum/${player.id}/sessions/plans`,
        { data: { durationMinutes: 5 } }
      )
      expect(planRes.status()).toBe(403)
      const body = await planRes.json()
      expect(body.code).toBe('SESSION_LIMIT_REACHED')
    })

    test('upgrade unlocks sessions', async ({ request }) => {
      await setTier(request, 'free')

      const player = await createPlayer(request, 'Weekly Upgrade Test')
      createdPlayerIds.push(player.id)
      await enableSkills(request, player.id)

      // Fill up with 5 offline sessions
      for (let i = 0; i < 5; i++) {
        const res = await createOfflineSession(request, player.id)
        expect(res.ok(), `offline session ${i + 1} failed: ${await res.text()}`).toBeTruthy()
      }

      // Blocked
      const blockedRes = await createOfflineSession(request, player.id)
      expect(blockedRes.status()).toBe(403)

      // Upgrade to family (unlimited sessions)
      await setTier(request, 'family')

      // Now succeeds
      const unlockedRes = await createOfflineSession(request, player.id)
      expect(unlockedRes.ok(), `6th session after upgrade failed: ${await unlockedRes.text()}`).toBeTruthy()
    })

    test('family: 6+ sessions allowed', async ({ request }) => {
      await setTier(request, 'family')

      const player = await createPlayer(request, 'Family Weekly Test')
      createdPlayerIds.push(player.id)
      await enableSkills(request, player.id)

      // Create 6 offline sessions — should all succeed
      for (let i = 0; i < 6; i++) {
        const res = await createOfflineSession(request, player.id)
        expect(res.ok(), `offline session ${i + 1} failed: ${await res.text()}`).toBeTruthy()
      }
    })
  })
})
