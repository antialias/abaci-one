/**
 * E2E tests for API authorization
 *
 * Tests that curriculum and player-stats endpoints properly enforce
 * authorization based on parent/teacher relationships.
 *
 * Test scenarios:
 * - Parent can modify their own child's data (positive)
 * - Unrelated user cannot modify another's child data (negative)
 */

import { expect, test } from '@playwright/test'

test.describe('API Authorization', () => {
  test.describe('Session Plan Authorization', () => {
    test('parent can create and modify session plan for own child', async ({ page }) => {
      // Visit page to establish session cookies
      await page.goto('/')
      await page.waitForLoadState('networkidle')

      const request = page.request

      // Step 1: Create a player (this establishes parent relationship)
      const createPlayerRes = await request.post('/api/players', {
        data: { name: 'Test Child', emoji: '🧒', color: '#4CAF50' },
      })
      expect(createPlayerRes.ok(), `Create player failed: ${await createPlayerRes.text()}`).toBeTruthy()
      const { player } = await createPlayerRes.json()
      const playerId = player.id

      // Step 1.5: Enable skills for this player (required before creating session plan)
      const enableSkillsRes = await request.put(`/api/curriculum/${playerId}/skills`, {
        data: { masteredSkillIds: ['1a-direct-addition', '1b-heaven-bead', '1c-simple-combinations'] },
      })
      expect(enableSkillsRes.ok(), `Enable skills failed: ${await enableSkillsRes.text()}`).toBeTruthy()

      // Step 2: Create a session plan
      const createPlanRes = await request.post(`/api/curriculum/${playerId}/sessions/plans`, {
        data: { durationMinutes: 5 },
      })
      expect(createPlanRes.ok(), `Create plan failed: ${await createPlanRes.text()}`).toBeTruthy()
      const { plan } = await createPlanRes.json()
      const planId = plan.id

      // Step 3: Approve the plan (PATCH - was vulnerable)
      const approveRes = await request.patch(`/api/curriculum/${playerId}/sessions/plans/${planId}`, {
        data: { action: 'approve' },
      })
      expect(approveRes.ok(), `Approve failed: ${await approveRes.text()}`).toBeTruthy()

      // Step 4: Start the plan
      const startRes = await request.patch(`/api/curriculum/${playerId}/sessions/plans/${planId}`, {
        data: { action: 'start' },
      })
      expect(startRes.ok(), `Start failed: ${await startRes.text()}`).toBeTruthy()

      // Step 5: Abandon the plan (cleanup)
      const abandonRes = await request.patch(`/api/curriculum/${playerId}/sessions/plans/${planId}`, {
        data: { action: 'abandon' },
      })
      expect(abandonRes.ok(), `Abandon failed: ${await abandonRes.text()}`).toBeTruthy()

      // Cleanup: Delete the player
      await request.delete(`/api/players/${playerId}`)
    })

    test("unrelated user cannot modify another user's session plan", async ({ browser }) => {
      // Create two isolated browser contexts (simulating two different users)
      const userAContext = await browser.newContext()
      const userBContext = await browser.newContext()

      try {
        // User A: Create page and establish session
        const userAPage = await userAContext.newPage()
        await userAPage.goto('/')
        await userAPage.waitForLoadState('networkidle')
        const userARequest = userAPage.request

        // User B: Create page and establish session
        const userBPage = await userBContext.newPage()
        await userBPage.goto('/')
        await userBPage.waitForLoadState('networkidle')
        const userBRequest = userBPage.request

        // User A: Create a player and session plan
        const createPlayerRes = await userARequest.post('/api/players', {
          data: { name: 'User A Child', emoji: '👧', color: '#2196F3' },
        })
        expect(createPlayerRes.ok()).toBeTruthy()
        const { player } = await createPlayerRes.json()
        const playerId = player.id

        // Enable skills (required before creating session plan)
        const enableSkillsRes = await userARequest.put(`/api/curriculum/${playerId}/skills`, {
          data: { masteredSkillIds: ['1a-direct-addition', '1b-heaven-bead'] },
        })
        expect(enableSkillsRes.ok()).toBeTruthy()

        const createPlanRes = await userARequest.post(`/api/curriculum/${playerId}/sessions/plans`, {
          data: { durationMinutes: 5 },
        })
        expect(createPlanRes.ok()).toBeTruthy()
        const { plan } = await createPlanRes.json()
        const planId = plan.id

        // User B: Try to modify User A's session plan (should fail with 403)
        const attackRes = await userBRequest.patch(`/api/curriculum/${playerId}/sessions/plans/${planId}`, {
          data: { action: 'abandon' },
        })
        expect(attackRes.status()).toBe(403)
        const errorBody = await attackRes.json()
        expect(errorBody.error).toBe('Not authorized')

        // Cleanup: User A deletes their player
        await userARequest.delete(`/api/players/${playerId}`)
      } finally {
        await userAContext.close()
        await userBContext.close()
      }
    })
  })

  test.describe('Skills Endpoint Authorization', () => {
    test('parent can record skill attempts for own child', async ({ page }) => {
      await page.goto('/')
      await page.waitForLoadState('networkidle')
      const request = page.request

      // Create a player
      const createPlayerRes = await request.post('/api/players', {
        data: { name: 'Skill Test Child', emoji: '📚', color: '#9C27B0' },
      })
      expect(createPlayerRes.ok()).toBeTruthy()
      const { player } = await createPlayerRes.json()
      const playerId = player.id

      // POST: Record a skill attempt
      const recordRes = await request.post(`/api/curriculum/${playerId}/skills`, {
        data: { skillId: '1a-direct-addition', isCorrect: true },
      })
      expect(recordRes.ok(), `Record skill failed: ${await recordRes.text()}`).toBeTruthy()

      // PUT: Set mastered skills
      const setMasteredRes = await request.put(`/api/curriculum/${playerId}/skills`, {
        data: { masteredSkillIds: ['1a-direct-addition'] },
      })
      expect(setMasteredRes.ok(), `Set mastered failed: ${await setMasteredRes.text()}`).toBeTruthy()

      // PATCH: Refresh skill recency
      const refreshRes = await request.patch(`/api/curriculum/${playerId}/skills`, {
        data: { skillId: '1a-direct-addition' },
      })
      expect(refreshRes.ok(), `Refresh skill failed: ${await refreshRes.text()}`).toBeTruthy()

      // Cleanup
      await request.delete(`/api/players/${playerId}`)
    })

    test("unrelated user cannot record skill attempts for another's child", async ({ browser }) => {
      const userAContext = await browser.newContext()
      const userBContext = await browser.newContext()

      try {
        const userAPage = await userAContext.newPage()
        await userAPage.goto('/')
        await userAPage.waitForLoadState('networkidle')
        const userARequest = userAPage.request

        const userBPage = await userBContext.newPage()
        await userBPage.goto('/')
        await userBPage.waitForLoadState('networkidle')
        const userBRequest = userBPage.request

        // User A: Create a player
        const createPlayerRes = await userARequest.post('/api/players', {
          data: { name: 'Protected Child', emoji: '🔒', color: '#F44336' },
        })
        expect(createPlayerRes.ok()).toBeTruthy()
        const { player } = await createPlayerRes.json()
        const playerId = player.id

        // User B: Try POST (record skill attempt) - should fail
        const postAttackRes = await userBRequest.post(`/api/curriculum/${playerId}/skills`, {
          data: { skillId: '1a-direct-addition', isCorrect: true },
        })
        expect(postAttackRes.status()).toBe(403)
        expect((await postAttackRes.json()).error).toBe('Not authorized')

        // User B: Try PUT (set mastered skills) - should fail
        const putAttackRes = await userBRequest.put(`/api/curriculum/${playerId}/skills`, {
          data: { masteredSkillIds: ['1a-direct-addition', '1b-heaven-bead'] },
        })
        expect(putAttackRes.status()).toBe(403)
        expect((await putAttackRes.json()).error).toBe('Not authorized')

        // User B: Try PATCH (refresh recency) - should fail
        const patchAttackRes = await userBRequest.patch(`/api/curriculum/${playerId}/skills`, {
          data: { skillId: '1a-direct-addition' },
        })
        expect(patchAttackRes.status()).toBe(403)
        expect((await patchAttackRes.json()).error).toBe('Not authorized')

        // Cleanup
        await userARequest.delete(`/api/players/${playerId}`)
      } finally {
        await userAContext.close()
        await userBContext.close()
      }
    })
  })

  test.describe('Record Game Authorization', () => {
    // Skip these tests if player_stats table doesn't exist (run migrations first)
    test('parent can record game stats for own child', async ({ page }) => {
      await page.goto('/')
      await page.waitForLoadState('networkidle')
      const request = page.request

      // Create a player
      const createPlayerRes = await request.post('/api/players', {
        data: { name: 'Gamer Child', emoji: '🎮', color: '#FF9800' },
      })
      expect(createPlayerRes.ok()).toBeTruthy()
      const { player } = await createPlayerRes.json()
      const playerId = player.id

      // Record a game result
      const recordGameRes = await request.post('/api/player-stats/record-game', {
        data: {
          gameResult: {
            gameType: 'matching',
            completedAt: Date.now(),
            playerResults: [{ playerId, won: true, score: 100, accuracy: 0.95 }],
          },
        },
      })
      expect(recordGameRes.ok(), `Record game failed: ${await recordGameRes.text()}`).toBeTruthy()
      const { success, updates } = await recordGameRes.json()
      expect(success).toBe(true)
      expect(updates).toHaveLength(1)
      expect(updates[0].playerId).toBe(playerId)

      // Cleanup
      await request.delete(`/api/players/${playerId}`)
    })

    test("unrelated user cannot record game stats for another's child", async ({ browser }) => {
      const userAContext = await browser.newContext()
      const userBContext = await browser.newContext()

      try {
        const userAPage = await userAContext.newPage()
        await userAPage.goto('/')
        await userAPage.waitForLoadState('networkidle')
        const userARequest = userAPage.request

        const userBPage = await userBContext.newPage()
        await userBPage.goto('/')
        await userBPage.waitForLoadState('networkidle')
        const userBRequest = userBPage.request

        // User A: Create a player
        const createPlayerRes = await userARequest.post('/api/players', {
          data: { name: 'User A Gamer', emoji: '🕹️', color: '#00BCD4' },
        })
        expect(createPlayerRes.ok()).toBeTruthy()
        const { player } = await createPlayerRes.json()
        const playerId = player.id

        // User B: Try to record game stats for User A's child (should fail)
        const attackRes = await userBRequest.post('/api/player-stats/record-game', {
          data: {
            gameResult: {
              gameType: 'matching',
              completedAt: Date.now(),
              playerResults: [{ playerId, won: true, score: 99999 }],
            },
          },
        })
        expect(attackRes.status()).toBe(403)
        const errorBody = await attackRes.json()
        expect(errorBody.error).toContain('Not authorized')

        // Cleanup
        await userARequest.delete(`/api/players/${playerId}`)
      } finally {
        await userAContext.close()
        await userBContext.close()
      }
    })

    test('cannot record game stats for mixed authorized/unauthorized players', async ({ browser }) => {
      const userAContext = await browser.newContext()
      const userBContext = await browser.newContext()

      try {
        const userAPage = await userAContext.newPage()
        await userAPage.goto('/')
        await userAPage.waitForLoadState('networkidle')
        const userARequest = userAPage.request

        const userBPage = await userBContext.newPage()
        await userBPage.goto('/')
        await userBPage.waitForLoadState('networkidle')
        const userBRequest = userBPage.request

        // User A: Create their player
        const createPlayerARes = await userARequest.post('/api/players', {
          data: { name: 'Player A', emoji: '🅰️', color: '#E91E63' },
        })
        const { player: playerA } = await createPlayerARes.json()

        // User B: Create their player
        const createPlayerBRes = await userBRequest.post('/api/players', {
          data: { name: 'Player B', emoji: '🅱️', color: '#3F51B5' },
        })
        const { player: playerB } = await createPlayerBRes.json()

        // User A: Try to record game with BOTH players (should fail - can't record for Player B)
        const mixedRes = await userARequest.post('/api/player-stats/record-game', {
          data: {
            gameResult: {
              gameType: 'matching',
              completedAt: Date.now(),
              playerResults: [
                { playerId: playerA.id, won: true, score: 100 },
                { playerId: playerB.id, won: false, score: 50 },
              ],
            },
          },
        })
        expect(mixedRes.status()).toBe(403)
        const errorBody = await mixedRes.json()
        expect(errorBody.error).toContain(playerB.id)

        // Cleanup
        await userARequest.delete(`/api/players/${playerA.id}`)
        await userBRequest.delete(`/api/players/${playerB.id}`)
      } finally {
        await userAContext.close()
        await userBContext.close()
      }
    })
  })

  test.describe('Teacher Authorization', () => {
    test.skip('teacher-present can modify student curriculum', async () => {
      // TODO: Implement when classroom e2e helpers are available
    })

    test.skip('teacher-enrolled (not present) cannot modify student curriculum', async () => {
      // TODO: Implement when classroom e2e helpers are available
    })
  })
})
