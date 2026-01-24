#!/usr/bin/env npx tsx
/**
 * Smoke Test Runner
 *
 * Runs Playwright smoke tests and reports results to the abaci-app API.
 *
 * Environment variables:
 * - BASE_URL: The base URL to test against (default: http://localhost:3000)
 * - RESULTS_API_URL: The URL to POST results to (default: http://localhost:3000/api/smoke-test-results)
 *
 * Usage:
 *   npx tsx scripts/smoke-test-runner.ts
 */

import { spawn } from "child_process";
import { randomUUID } from "crypto";
import { existsSync, readFileSync, mkdirSync } from "fs";
import { join } from "path";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const RESULTS_API_URL =
  process.env.RESULTS_API_URL || `${BASE_URL}/api/smoke-test-results`;

interface PlaywrightTestResult {
  title: string;
  status: "passed" | "failed" | "skipped" | "timedOut";
  duration: number;
  errors?: string[];
}

interface PlaywrightReport {
  suites: Array<{
    title: string;
    specs: Array<{
      title: string;
      tests: Array<{
        status: "expected" | "unexpected" | "skipped";
        results: Array<{
          status: "passed" | "failed" | "skipped" | "timedOut";
          duration: number;
          error?: { message: string };
        }>;
      }>;
    }>;
  }>;
  stats: {
    expected: number;
    unexpected: number;
    skipped: number;
    duration: number;
  };
}

async function reportResults(results: {
  id: string;
  startedAt: string;
  completedAt?: string;
  status: "running" | "passed" | "failed" | "error";
  totalTests?: number;
  passedTests?: number;
  failedTests?: number;
  durationMs?: number;
  resultsJson?: string;
  errorMessage?: string;
}): Promise<void> {
  try {
    console.log(`Reporting results to ${RESULTS_API_URL}...`);
    const response = await fetch(RESULTS_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(results),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`Failed to report results: ${response.status} ${text}`);
    } else {
      console.log("Results reported successfully");
    }
  } catch (error) {
    console.error("Error reporting results:", error);
  }
}

async function runTests(): Promise<void> {
  const runId = randomUUID();
  const startedAt = new Date().toISOString();

  console.log(`Starting smoke test run: ${runId}`);
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Results API: ${RESULTS_API_URL}`);

  // Report that we're starting
  await reportResults({
    id: runId,
    startedAt,
    status: "running",
  });

  const reportDir = join(process.cwd(), "playwright-report");
  const jsonReportPath = join(reportDir, "results.json");

  // Ensure report directory exists
  if (!existsSync(reportDir)) {
    mkdirSync(reportDir, { recursive: true });
  }

  try {
    // Run Playwright tests with JSON reporter
    const playwrightProcess = spawn(
      "npx",
      [
        "playwright",
        "test",
        "e2e/smoke",
        "--reporter=json",
        `--output=${reportDir}`,
      ],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          BASE_URL,
          CI: "true", // Ensure CI mode
        },
        stdio: ["inherit", "pipe", "pipe"],
      },
    );

    let stdout = "";
    let stderr = "";

    playwrightProcess.stdout?.on("data", (data) => {
      stdout += data.toString();
    });

    playwrightProcess.stderr?.on("data", (data) => {
      stderr += data.toString();
      process.stderr.write(data);
    });

    const exitCode = await new Promise<number>((resolve) => {
      playwrightProcess.on("close", (code) => {
        resolve(code ?? 1);
      });
    });

    const completedAt = new Date().toISOString();
    const durationMs =
      new Date(completedAt).getTime() - new Date(startedAt).getTime();

    // Try to parse the JSON report from stdout
    let report: PlaywrightReport | null = null;
    try {
      report = JSON.parse(stdout);
    } catch {
      console.log("Could not parse JSON report from stdout");
    }

    if (report) {
      const totalTests =
        report.stats.expected + report.stats.unexpected + report.stats.skipped;
      const passedTests = report.stats.expected;
      const failedTests = report.stats.unexpected;

      await reportResults({
        id: runId,
        startedAt,
        completedAt,
        status: failedTests > 0 ? "failed" : "passed",
        totalTests,
        passedTests,
        failedTests,
        durationMs,
        resultsJson: JSON.stringify(report),
      });

      console.log(`\nTest run completed:`);
      console.log(`  Total: ${totalTests}`);
      console.log(`  Passed: ${passedTests}`);
      console.log(`  Failed: ${failedTests}`);
      console.log(`  Duration: ${durationMs}ms`);

      process.exit(exitCode);
    } else {
      // Fallback: report based on exit code
      await reportResults({
        id: runId,
        startedAt,
        completedAt,
        status: exitCode === 0 ? "passed" : "failed",
        durationMs,
        errorMessage:
          exitCode !== 0
            ? `Playwright exited with code ${exitCode}`
            : undefined,
      });

      process.exit(exitCode);
    }
  } catch (error) {
    const completedAt = new Date().toISOString();
    const durationMs =
      new Date(completedAt).getTime() - new Date(startedAt).getTime();

    await reportResults({
      id: runId,
      startedAt,
      completedAt,
      status: "error",
      durationMs,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });

    console.error("Error running tests:", error);
    process.exit(1);
  }
}

runTests();
