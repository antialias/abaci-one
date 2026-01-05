/**
 * E2E tests for Entry Prompts feature
 *
 * Tests the complete flow of teachers sending entry prompts to parents
 * to have their children enter the classroom.
 *
 * Test scenarios:
 * - Teacher creates classroom and enrolls student
 * - Teacher sends entry prompt to parent
 * - Parent accepts/declines prompt
 * - Teacher configures entry prompt expiry time
 * - Watch Session visible for practicing enrolled students
 */

import { expect, test, type APIRequestContext } from "@playwright/test";

/**
 * Helper to get or create a classroom for the teacher
 * Teachers can only have one classroom, so this handles both cases
 */
async function getOrCreateClassroom(
  request: APIRequestContext,
  name: string,
): Promise<{
  id: string;
  code: string;
  entryPromptExpiryMinutes: number | null;
}> {
  // First try to get existing classroom
  const getRes = await request.get("/api/classrooms/mine");
  if (getRes.ok()) {
    const data = await getRes.json();
    if (data.classroom) {
      return {
        id: data.classroom.id,
        code: data.classroom.code,
        entryPromptExpiryMinutes: data.classroom.entryPromptExpiryMinutes,
      };
    }
  }

  // No existing classroom, create one
  const createRes = await request.post("/api/classrooms", {
    data: { name },
  });
  if (!createRes.ok()) {
    throw new Error(`Failed to create classroom: ${await createRes.text()}`);
  }
  const { classroom } = await createRes.json();
  return {
    id: classroom.id,
    code: classroom.code,
    entryPromptExpiryMinutes: classroom.entryPromptExpiryMinutes,
  };
}

test.describe("Entry Prompts", () => {
  test.describe("API Endpoints", () => {
    test("teacher can create entry prompt for enrolled student", async ({
      browser,
    }) => {
      // Create two isolated browser contexts (teacher and parent)
      const teacherContext = await browser.newContext();
      const parentContext = await browser.newContext();

      try {
        // Teacher: Set up classroom
        const teacherPage = await teacherContext.newPage();
        await teacherPage.goto("/");
        await teacherPage.waitForLoadState("networkidle");
        const teacherRequest = teacherPage.request;

        // Parent: Create player (child)
        const parentPage = await parentContext.newPage();
        await parentPage.goto("/");
        await parentPage.waitForLoadState("networkidle");
        const parentRequest = parentPage.request;

        // Step 1: Parent creates a child
        const createPlayerRes = await parentRequest.post("/api/players", {
          data: { name: "Entry Test Child", emoji: "🧒", color: "#4CAF50" },
        });
        expect(
          createPlayerRes.ok(),
          `Create player failed: ${await createPlayerRes.text()}`,
        ).toBeTruthy();
        const { player } = await createPlayerRes.json();
        const childId = player.id;

        // Step 2: Teacher gets or creates classroom
        const classroom = await getOrCreateClassroom(
          teacherRequest,
          "Entry Prompt Test Class",
        );
        const classroomId = classroom.id;
        const classroomCode = classroom.code;

        // Step 3: Parent enrolls child using classroom code
        const lookupRes = await parentRequest.get(
          `/api/classrooms/code/${classroomCode}`,
        );
        expect(
          lookupRes.ok(),
          `Lookup classroom failed: ${await lookupRes.text()}`,
        ).toBeTruthy();

        const enrollRes = await parentRequest.post(
          `/api/classrooms/${classroomId}/enrollment-requests`,
          {
            data: { playerId: childId },
          },
        );
        expect(
          enrollRes.ok(),
          `Enroll failed: ${await enrollRes.text()}`,
        ).toBeTruthy();
        const { request: enrollmentRequest } = await enrollRes.json();

        // Step 4: Teacher approves enrollment
        const approveRes = await teacherRequest.post(
          `/api/classrooms/${classroomId}/enrollment-requests/${enrollmentRequest.id}/approve`,
          { data: {} },
        );
        expect(
          approveRes.ok(),
          `Approve enrollment failed: ${await approveRes.text()}`,
        ).toBeTruthy();

        // Step 5: Teacher sends entry prompt
        const promptRes = await teacherRequest.post(
          `/api/classrooms/${classroomId}/entry-prompts`,
          {
            data: { playerIds: [childId] },
          },
        );
        expect(
          promptRes.ok(),
          `Create prompt failed: ${await promptRes.text()}`,
        ).toBeTruthy();
        const promptData = await promptRes.json();
        expect(promptData.created).toBe(1);
        expect(promptData.prompts).toHaveLength(1);
        expect(promptData.prompts[0].playerId).toBe(childId);

        // Cleanup - just delete the player, keep the classroom
        await parentRequest.delete(`/api/players/${childId}`);
      } finally {
        await teacherContext.close();
        await parentContext.close();
      }
    });

    test("cannot send prompt to student already present", async ({
      browser,
    }) => {
      const teacherContext = await browser.newContext();
      const parentContext = await browser.newContext();

      try {
        const teacherPage = await teacherContext.newPage();
        await teacherPage.goto("/");
        await teacherPage.waitForLoadState("networkidle");
        const teacherRequest = teacherPage.request;

        const parentPage = await parentContext.newPage();
        await parentPage.goto("/");
        await parentPage.waitForLoadState("networkidle");
        const parentRequest = parentPage.request;

        // Setup: Create child
        const { player } = await (
          await parentRequest.post("/api/players", {
            data: { name: "Present Child", emoji: "🧒", color: "#4CAF50" },
          })
        ).json();

        // Get or create classroom
        const classroom = await getOrCreateClassroom(
          teacherRequest,
          "Presence Test Class",
        );

        // Enroll child
        await parentRequest.post(
          `/api/classrooms/${classroom.id}/enrollment-requests`,
          {
            data: { playerId: player.id },
          },
        );

        // Get enrollment request ID and approve
        const requestsRes = await teacherRequest.get(
          `/api/classrooms/${classroom.id}/enrollment-requests`,
        );
        const { requests } = await requestsRes.json();
        const enrollmentRequest = requests.find(
          (r: { playerId: string }) => r.playerId === player.id,
        );

        await teacherRequest.post(
          `/api/classrooms/${classroom.id}/enrollment-requests/${enrollmentRequest.id}/approve`,
          { data: {} },
        );

        // Parent enters child into classroom
        const enterRes = await parentRequest.post(
          `/api/classrooms/${classroom.id}/presence`,
          {
            data: { playerId: player.id },
          },
        );
        expect(
          enterRes.ok(),
          `Enter classroom failed: ${await enterRes.text()}`,
        ).toBeTruthy();

        // Teacher tries to send prompt - should be skipped
        const promptRes = await teacherRequest.post(
          `/api/classrooms/${classroom.id}/entry-prompts`,
          {
            data: { playerIds: [player.id] },
          },
        );
        expect(promptRes.ok()).toBeTruthy();
        const promptData = await promptRes.json();
        expect(promptData.created).toBe(0);
        expect(promptData.skipped).toHaveLength(1);
        expect(promptData.skipped[0].reason).toBe("already_present");

        // Cleanup
        await parentRequest.delete(`/api/players/${player.id}`);
      } finally {
        await teacherContext.close();
        await parentContext.close();
      }
    });

    test("parent can accept entry prompt", async ({ browser }) => {
      const teacherContext = await browser.newContext();
      const parentContext = await browser.newContext();

      try {
        const teacherPage = await teacherContext.newPage();
        await teacherPage.goto("/");
        await teacherPage.waitForLoadState("networkidle");
        const teacherRequest = teacherPage.request;

        const parentPage = await parentContext.newPage();
        await parentPage.goto("/");
        await parentPage.waitForLoadState("networkidle");
        const parentRequest = parentPage.request;

        // Setup: Create child
        const { player } = await (
          await parentRequest.post("/api/players", {
            data: { name: "Accept Test Child", emoji: "🧒", color: "#4CAF50" },
          })
        ).json();

        // Get or create classroom
        const classroom = await getOrCreateClassroom(
          teacherRequest,
          "Accept Test Class",
        );

        // Enroll and approve
        await parentRequest.post(
          `/api/classrooms/${classroom.id}/enrollment-requests`,
          {
            data: { playerId: player.id },
          },
        );

        const requestsRes = await teacherRequest.get(
          `/api/classrooms/${classroom.id}/enrollment-requests`,
        );
        const { requests } = await requestsRes.json();
        const enrollmentRequest = requests.find(
          (r: { playerId: string }) => r.playerId === player.id,
        );

        await teacherRequest.post(
          `/api/classrooms/${classroom.id}/enrollment-requests/${enrollmentRequest.id}/approve`,
          { data: {} },
        );

        // Teacher sends entry prompt
        const promptRes = await teacherRequest.post(
          `/api/classrooms/${classroom.id}/entry-prompts`,
          {
            data: { playerIds: [player.id] },
          },
        );
        const { prompts } = await promptRes.json();
        const promptId = prompts[0].id;

        // Parent accepts prompt
        const acceptRes = await parentRequest.post(
          `/api/entry-prompts/${promptId}/respond`,
          {
            data: { action: "accept" },
          },
        );
        expect(
          acceptRes.ok(),
          `Accept prompt failed: ${await acceptRes.text()}`,
        ).toBeTruthy();
        const acceptData = await acceptRes.json();
        expect(acceptData.action).toBe("accepted");

        // Verify child is now present
        const presenceRes = await teacherRequest.get(
          `/api/classrooms/${classroom.id}/presence`,
        );
        expect(presenceRes.ok()).toBeTruthy();
        const presenceData = await presenceRes.json();
        const childPresent = presenceData.students.some(
          (s: { id: string }) => s.id === player.id,
        );
        expect(childPresent).toBe(true);

        // Cleanup
        await parentRequest.delete(`/api/players/${player.id}`);
      } finally {
        await teacherContext.close();
        await parentContext.close();
      }
    });

    test("parent can decline entry prompt", async ({ browser }) => {
      const teacherContext = await browser.newContext();
      const parentContext = await browser.newContext();

      try {
        const teacherPage = await teacherContext.newPage();
        await teacherPage.goto("/");
        await teacherPage.waitForLoadState("networkidle");
        const teacherRequest = teacherPage.request;

        const parentPage = await parentContext.newPage();
        await parentPage.goto("/");
        await parentPage.waitForLoadState("networkidle");
        const parentRequest = parentPage.request;

        // Setup: Create child
        const { player } = await (
          await parentRequest.post("/api/players", {
            data: { name: "Decline Test Child", emoji: "🧒", color: "#4CAF50" },
          })
        ).json();

        // Get or create classroom
        const classroom = await getOrCreateClassroom(
          teacherRequest,
          "Decline Test Class",
        );

        // Enroll and approve
        await parentRequest.post(
          `/api/classrooms/${classroom.id}/enrollment-requests`,
          {
            data: { playerId: player.id },
          },
        );

        const requestsRes = await teacherRequest.get(
          `/api/classrooms/${classroom.id}/enrollment-requests`,
        );
        const { requests } = await requestsRes.json();
        const enrollmentRequest = requests.find(
          (r: { playerId: string }) => r.playerId === player.id,
        );

        await teacherRequest.post(
          `/api/classrooms/${classroom.id}/enrollment-requests/${enrollmentRequest.id}/approve`,
          { data: {} },
        );

        // Teacher sends entry prompt
        const promptRes = await teacherRequest.post(
          `/api/classrooms/${classroom.id}/entry-prompts`,
          {
            data: { playerIds: [player.id] },
          },
        );
        const { prompts } = await promptRes.json();
        const promptId = prompts[0].id;

        // Parent declines prompt
        const declineRes = await parentRequest.post(
          `/api/entry-prompts/${promptId}/respond`,
          {
            data: { action: "decline" },
          },
        );
        expect(
          declineRes.ok(),
          `Decline prompt failed: ${await declineRes.text()}`,
        ).toBeTruthy();
        const declineData = await declineRes.json();
        expect(declineData.action).toBe("declined");

        // Verify child is NOT present
        const presenceRes = await teacherRequest.get(
          `/api/classrooms/${classroom.id}/presence`,
        );
        expect(presenceRes.ok()).toBeTruthy();
        const presenceData = await presenceRes.json();
        const childPresent = presenceData.students.some(
          (s: { id: string }) => s.id === player.id,
        );
        expect(childPresent).toBe(false);

        // Cleanup
        await parentRequest.delete(`/api/players/${player.id}`);
      } finally {
        await teacherContext.close();
        await parentContext.close();
      }
    });
  });

  test.describe("Classroom Settings", () => {
    test("teacher can configure entry prompt expiry time", async ({ page }) => {
      await page.goto("/");
      await page.waitForLoadState("networkidle");
      const request = page.request;

      // Get or create classroom
      const classroom = await getOrCreateClassroom(
        request,
        "Settings Test Class",
      );

      // Update expiry setting to 60 minutes
      const updateRes = await request.patch(`/api/classrooms/${classroom.id}`, {
        data: { entryPromptExpiryMinutes: 60 },
      });
      expect(
        updateRes.ok(),
        `Update failed: ${await updateRes.text()}`,
      ).toBeTruthy();
      const { classroom: updated } = await updateRes.json();
      expect(updated.entryPromptExpiryMinutes).toBe(60);

      // Update to a different value
      const update2Res = await request.patch(
        `/api/classrooms/${classroom.id}`,
        {
          data: { entryPromptExpiryMinutes: 15 },
        },
      );
      expect(update2Res.ok()).toBeTruthy();
      const { classroom: updated2 } = await update2Res.json();
      expect(updated2.entryPromptExpiryMinutes).toBe(15);

      // Reset to default (null)
      const resetRes = await request.patch(`/api/classrooms/${classroom.id}`, {
        data: { entryPromptExpiryMinutes: null },
      });
      expect(resetRes.ok()).toBeTruthy();
      const { classroom: reset } = await resetRes.json();
      expect(reset.entryPromptExpiryMinutes).toBeNull();
    });

    test("entry prompt uses classroom expiry setting", async ({ browser }) => {
      const teacherContext = await browser.newContext();
      const parentContext = await browser.newContext();

      try {
        const teacherPage = await teacherContext.newPage();
        await teacherPage.goto("/");
        await teacherPage.waitForLoadState("networkidle");
        const teacherRequest = teacherPage.request;

        const parentPage = await parentContext.newPage();
        await parentPage.goto("/");
        await parentPage.waitForLoadState("networkidle");
        const parentRequest = parentPage.request;

        // Setup: Create child
        const { player } = await (
          await parentRequest.post("/api/players", {
            data: { name: "Expiry Test Child", emoji: "🧒", color: "#4CAF50" },
          })
        ).json();

        // Get or create classroom
        const classroom = await getOrCreateClassroom(
          teacherRequest,
          "Expiry Test Class",
        );

        // Set classroom expiry to 90 minutes
        await teacherRequest.patch(`/api/classrooms/${classroom.id}`, {
          data: { entryPromptExpiryMinutes: 90 },
        });

        // Enroll and approve
        await parentRequest.post(
          `/api/classrooms/${classroom.id}/enrollment-requests`,
          {
            data: { playerId: player.id },
          },
        );

        const requestsRes = await teacherRequest.get(
          `/api/classrooms/${classroom.id}/enrollment-requests`,
        );
        const { requests } = await requestsRes.json();
        const enrollmentRequest = requests.find(
          (r: { playerId: string }) => r.playerId === player.id,
        );

        await teacherRequest.post(
          `/api/classrooms/${classroom.id}/enrollment-requests/${enrollmentRequest.id}/approve`,
          { data: {} },
        );

        // Send entry prompt - should use 90 minute expiry
        const promptRes = await teacherRequest.post(
          `/api/classrooms/${classroom.id}/entry-prompts`,
          {
            data: { playerIds: [player.id] },
          },
        );
        expect(promptRes.ok()).toBeTruthy();
        const { prompts } = await promptRes.json();

        // Verify expiry is approximately 90 minutes from now
        const expiresAt = new Date(prompts[0].expiresAt);
        const now = new Date();
        const diffMinutes = (expiresAt.getTime() - now.getTime()) / (60 * 1000);

        // Allow some tolerance for test execution time
        expect(diffMinutes).toBeGreaterThan(88);
        expect(diffMinutes).toBeLessThan(92);

        // Reset classroom setting and cleanup
        await teacherRequest.patch(`/api/classrooms/${classroom.id}`, {
          data: { entryPromptExpiryMinutes: null },
        });
        await parentRequest.delete(`/api/players/${player.id}`);
      } finally {
        await teacherContext.close();
        await parentContext.close();
      }
    });
  });

  test.describe("Active Sessions for Enrolled Students", () => {
    test("active sessions returned for enrolled students not present", async ({
      browser,
    }) => {
      test.setTimeout(60000); // Increase timeout for this complex test
      const teacherContext = await browser.newContext();
      const parentContext = await browser.newContext();

      try {
        const teacherPage = await teacherContext.newPage();
        await teacherPage.goto("/");
        await teacherPage.waitForLoadState("networkidle");
        const teacherRequest = teacherPage.request;

        const parentPage = await parentContext.newPage();
        await parentPage.goto("/");
        await parentPage.waitForLoadState("networkidle");
        const parentRequest = parentPage.request;

        // Setup: Create child with skills
        const { player } = await (
          await parentRequest.post("/api/players", {
            data: { name: "Session Test Child", emoji: "🧒", color: "#4CAF50" },
          })
        ).json();

        // Enable skills for the player
        await parentRequest.put(`/api/curriculum/${player.id}/skills`, {
          data: {
            masteredSkillIds: [
              "1a-direct-addition",
              "1b-heaven-bead",
              "1c-simple-combinations",
            ],
          },
        });

        // Get or create classroom
        const classroom = await getOrCreateClassroom(
          teacherRequest,
          "Session Test Class",
        );

        // Enroll and approve
        await parentRequest.post(
          `/api/classrooms/${classroom.id}/enrollment-requests`,
          {
            data: { playerId: player.id },
          },
        );

        const requestsRes = await teacherRequest.get(
          `/api/classrooms/${classroom.id}/enrollment-requests`,
        );
        const { requests } = await requestsRes.json();
        const enrollmentRequest = requests.find(
          (r: { playerId: string }) => r.playerId === player.id,
        );

        await teacherRequest.post(
          `/api/classrooms/${classroom.id}/enrollment-requests/${enrollmentRequest.id}/approve`,
          { data: {} },
        );

        // Parent starts a practice session for their child (without entering classroom)
        const createPlanRes = await parentRequest.post(
          `/api/curriculum/${player.id}/sessions/plans`,
          {
            data: { durationMinutes: 5 },
          },
        );
        expect(
          createPlanRes.ok(),
          `Create plan failed: ${await createPlanRes.text()}`,
        ).toBeTruthy();
        const { plan } = await createPlanRes.json();

        // Approve and start the plan
        await parentRequest.patch(
          `/api/curriculum/${player.id}/sessions/plans/${plan.id}`,
          {
            data: { action: "approve" },
          },
        );
        await parentRequest.patch(
          `/api/curriculum/${player.id}/sessions/plans/${plan.id}`,
          {
            data: { action: "start" },
          },
        );

        // Teacher checks active sessions - should include this student even though not present
        const sessionsRes = await teacherRequest.get(
          `/api/classrooms/${classroom.id}/presence/active-sessions`,
        );
        expect(
          sessionsRes.ok(),
          `Get sessions failed: ${await sessionsRes.text()}`,
        ).toBeTruthy();
        const { sessions } = await sessionsRes.json();

        // Find the session for our test player
        const playerSession = sessions.find(
          (s: { playerId: string }) => s.playerId === player.id,
        );
        expect(playerSession).toBeDefined();
        expect(playerSession.isPresent).toBe(false); // Not present but session is visible

        // Cleanup - abandon session first
        await parentRequest.patch(
          `/api/curriculum/${player.id}/sessions/plans/${plan.id}`,
          {
            data: { action: "abandon" },
          },
        );
        await parentRequest.delete(`/api/players/${player.id}`);
      } finally {
        await teacherContext.close();
        await parentContext.close();
      }
    });
  });
});
