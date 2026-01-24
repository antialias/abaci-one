/**
 * Smoke test status endpoint for Gatus monitoring
 *
 * GET /api/smoke-test-status
 *
 * Returns the status of the most recent smoke test run:
 * - 200 + {status: 'passed'} if latest run passed and is < 30 min old
 * - 503 if failed, stale, or no data
 *
 * Used by Gatus to determine if browser smoke tests are passing.
 */

import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
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
}

// Maximum age of a test run before it's considered stale (30 minutes)
const MAX_AGE_MS = 30 * 60 * 1000;

export async function GET(): Promise<NextResponse<SmokeTestStatusResponse>> {
  try {
    // Get the most recent completed test run
    const latestRun = await db
      .select()
      .from(smokeTestRuns)
      .orderBy(desc(smokeTestRuns.startedAt))
      .limit(1)
      .get();

    if (!latestRun) {
      return NextResponse.json({ status: "no_data" }, { status: 503 });
    }

    const ageMs = Date.now() - latestRun.startedAt.getTime();
    const ageMinutes = Math.floor(ageMs / 60000);

    // If the test is still running, report that
    if (latestRun.status === "running") {
      return NextResponse.json(
        {
          status: "running",
          lastRunAt: latestRun.startedAt.toISOString(),
          lastRunId: latestRun.id,
          ageMinutes,
        },
        { status: 503 },
      );
    }

    // Check if the run is too old
    if (ageMs > MAX_AGE_MS) {
      return NextResponse.json(
        {
          status: "stale",
          lastRunAt: latestRun.startedAt.toISOString(),
          lastRunId: latestRun.id,
          ageMinutes,
        },
        { status: 503 },
      );
    }

    // Check if the run passed
    if (latestRun.status === "passed") {
      return NextResponse.json({
        status: "passed",
        lastRunAt: latestRun.startedAt.toISOString(),
        lastRunId: latestRun.id,
        totalTests: latestRun.totalTests ?? undefined,
        passedTests: latestRun.passedTests ?? undefined,
        failedTests: latestRun.failedTests ?? undefined,
        durationMs: latestRun.durationMs ?? undefined,
        ageMinutes,
      });
    }

    // Run failed or errored
    return NextResponse.json(
      {
        status: "failed",
        lastRunAt: latestRun.startedAt.toISOString(),
        lastRunId: latestRun.id,
        totalTests: latestRun.totalTests ?? undefined,
        passedTests: latestRun.passedTests ?? undefined,
        failedTests: latestRun.failedTests ?? undefined,
        durationMs: latestRun.durationMs ?? undefined,
        errorMessage: latestRun.errorMessage ?? undefined,
        ageMinutes,
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
