/**
 * @vitest-environment node
 *
 * Tests for updateSessionPlanRemoteCamera function
 *
 * Tests that remote camera session IDs are properly persisted
 * with session plans in the database.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";
import { createId } from "@paralleldrive/cuid2";
import {
  createEphemeralDatabase,
  createTestStudent,
  getCurrentEphemeralDb,
  setCurrentEphemeralDb,
  type EphemeralDbResult,
  type TestDatabase,
} from "@/test/journey-simulator/EphemeralDatabase";

// Mock the db module to use our ephemeral database
vi.mock("@/db", () => ({
  get db() {
    return getCurrentEphemeralDb();
  },
  schema,
}));

// Import after mocks are set up
const { updateSessionPlanRemoteCamera, getSessionPlan } = await import(
  "../session-planner"
);

describe("updateSessionPlanRemoteCamera", () => {
  let ephemeralDb: EphemeralDbResult;
  let db: TestDatabase;
  let testPlayerId: string;
  let testPlanId: string;

  beforeEach(async () => {
    // Create ephemeral database
    ephemeralDb = createEphemeralDatabase();
    db = ephemeralDb.db;
    setCurrentEphemeralDb(db);

    // Create test user and player
    const { playerId } = await createTestStudent(db, `player-${createId()}`);
    testPlayerId = playerId;

    // Create a test session plan
    testPlanId = createId();
    await db.insert(schema.sessionPlans).values({
      id: testPlanId,
      playerId: testPlayerId,
      targetDurationMinutes: 10,
      estimatedProblemCount: 5,
      avgTimePerProblemSeconds: 30,
      parts: [],
      summary: {
        parts: [],
        totalProblems: 5,
        estimatedMinutes: 10,
      },
      masteredSkillIds: [],
      status: "active",
      remoteCameraSessionId: null,
    });
  });

  afterEach(() => {
    setCurrentEphemeralDb(null);
    ephemeralDb.cleanup();
  });

  it("should set remote camera session ID on a session plan", async () => {
    const remoteCameraSessionId = "remote-camera-session-123";

    const updatedPlan = await updateSessionPlanRemoteCamera(
      testPlanId,
      remoteCameraSessionId,
    );

    expect(updatedPlan.remoteCameraSessionId).toBe(remoteCameraSessionId);

    // Verify it persisted in database
    const planFromDb = await getSessionPlan(testPlanId);
    expect(planFromDb?.remoteCameraSessionId).toBe(remoteCameraSessionId);
  });

  it("should clear remote camera session ID when set to null", async () => {
    // First set a value
    await updateSessionPlanRemoteCamera(testPlanId, "initial-session-id");

    // Verify it was set
    let plan = await getSessionPlan(testPlanId);
    expect(plan?.remoteCameraSessionId).toBe("initial-session-id");

    // Now clear it
    const updatedPlan = await updateSessionPlanRemoteCamera(testPlanId, null);

    expect(updatedPlan.remoteCameraSessionId).toBeNull();

    // Verify it persisted in database
    plan = await getSessionPlan(testPlanId);
    expect(plan?.remoteCameraSessionId).toBeNull();
  });

  it("should throw error for non-existent plan", async () => {
    await expect(
      updateSessionPlanRemoteCamera("non-existent-plan-id", "session-123"),
    ).rejects.toThrow("Plan non-existent-plan-id not found");
  });

  it("should update remote camera session ID multiple times", async () => {
    // Set first value
    await updateSessionPlanRemoteCamera(testPlanId, "session-v1");
    let plan = await getSessionPlan(testPlanId);
    expect(plan?.remoteCameraSessionId).toBe("session-v1");

    // Update to second value
    await updateSessionPlanRemoteCamera(testPlanId, "session-v2");
    plan = await getSessionPlan(testPlanId);
    expect(plan?.remoteCameraSessionId).toBe("session-v2");

    // Update to third value
    await updateSessionPlanRemoteCamera(testPlanId, "session-v3");
    plan = await getSessionPlan(testPlanId);
    expect(plan?.remoteCameraSessionId).toBe("session-v3");
  });

  it("should not affect other session plan fields", async () => {
    // Get initial plan state
    const initialPlan = await getSessionPlan(testPlanId);

    // Update remote camera session ID
    await updateSessionPlanRemoteCamera(testPlanId, "new-session-id");

    // Get updated plan
    const updatedPlan = await getSessionPlan(testPlanId);

    // Verify other fields are unchanged
    expect(updatedPlan?.playerId).toBe(initialPlan?.playerId);
    expect(updatedPlan?.targetDurationMinutes).toBe(
      initialPlan?.targetDurationMinutes,
    );
    expect(updatedPlan?.status).toBe(initialPlan?.status);
    expect(updatedPlan?.estimatedProblemCount).toBe(
      initialPlan?.estimatedProblemCount,
    );
  });
});
