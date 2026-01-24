/**
 * Smoke test status endpoint for Gatus monitoring
 *
 * GET /api/smoke-test-status
 *
 * Returns the status of the most recent COMPLETED smoke test run:
 * - 200 + {status: 'passed'} if latest completed run passed and is < 30 min old
 * - 503 if failed, stale, or no data
 *
 * Note: Running tests are ignored - we report the last completed result.
 * This prevents Gatus from showing unhealthy status while tests are running.
 *
 * Used by Gatus to determine if browser smoke tests are passing.
 */

import { NextResponse } from "next/server";
import { desc, ne } from "drizzle-orm";
import { db } from "@/db";
import { smokeTestRuns } from "@/db/schema";

export const dynamic = "force-dynamic";

interface SmokeTestStatusResponse {
  status: "passed" | "failed" | "stale" | "no_data" | "running";
  lastRunAt?: string;
  lastRunId?: string;
  totalTests?: number;
  passedTests?: number;
  failedTests?: number;
  durationMs?: number;
  errorMessage?: string;
  ageMinutes?: number;
  currentlyRunning?: boolean;
}

// Maximum age of a test run before it's considered stale (30 minutes)
const MAX_AGE_MS = 30 * 60 * 1000;

export async function GET(): Promise<NextResponse<SmokeTestStatusResponse>> {
  try {
    // Get the most recent COMPLETED test run (not "running")
    const latestCompletedRun = await db
      .select()
      .from(smokeTestRuns)
      .where(ne(smokeTestRuns.status, "running"))
      .orderBy(desc(smokeTestRuns.startedAt))
      .limit(1)
      .get();

    // Check if there's a currently running test (for informational purposes)
    const runningTest = await db
      .select({ id: smokeTestRuns.id })
      .from(smokeTestRuns)
      .where(ne(smokeTestRuns.status, "passed"))
      .orderBy(desc(smokeTestRuns.startedAt))
      .limit(1)
      .get();
    const currentlyRunning = runningTest?.id !== latestCompletedRun?.id;

    if (!latestCompletedRun) {
      // No completed runs yet - if there's a running test, report that
      if (currentlyRunning) {
        return NextResponse.json(
          {
            status: "running",
            currentlyRunning: true,
          },
          { status: 503 },
        );
      }
      return NextResponse.json({ status: "no_data" }, { status: 503 });
    }

    const ageMs = Date.now() - latestCompletedRun.startedAt.getTime();
    const ageMinutes = Math.floor(ageMs / 60000);

    // Check if the run is too old
    if (ageMs > MAX_AGE_MS) {
      return NextResponse.json(
        {
          status: "stale",
          lastRunAt: latestCompletedRun.startedAt.toISOString(),
          lastRunId: latestCompletedRun.id,
          ageMinutes,
          currentlyRunning,
        },
        { status: 503 },
      );
    }

    // Check if the run passed
    if (latestCompletedRun.status === "passed") {
      return NextResponse.json({
        status: "passed",
        lastRunAt: latestCompletedRun.startedAt.toISOString(),
        lastRunId: latestCompletedRun.id,
        totalTests: latestCompletedRun.totalTests ?? undefined,
        passedTests: latestCompletedRun.passedTests ?? undefined,
        failedTests: latestCompletedRun.failedTests ?? undefined,
        durationMs: latestCompletedRun.durationMs ?? undefined,
        ageMinutes,
        currentlyRunning,
      });
    }

    // Run failed or errored
    return NextResponse.json(
      {
        status: "failed",
        lastRunAt: latestCompletedRun.startedAt.toISOString(),
        lastRunId: latestCompletedRun.id,
        totalTests: latestCompletedRun.totalTests ?? undefined,
        passedTests: latestCompletedRun.passedTests ?? undefined,
        failedTests: latestCompletedRun.failedTests ?? undefined,
        durationMs: latestCompletedRun.durationMs ?? undefined,
        errorMessage: latestCompletedRun.errorMessage ?? undefined,
        ageMinutes,
        currentlyRunning,
      },
      { status: 503 },
    );
  } catch (error) {
    console.error("Error checking smoke test status:", error);
    return NextResponse.json(
      {
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 503 },
    );
  }
}
