#!/usr/bin/env npx tsx
/**
 * Smoke Test Runner
 *
 * Runs Playwright smoke tests and reports results to the abaci-app API.
 * Optionally saves HTML reports to a filesystem directory for viewing.
 *
 * Environment variables:
 * - BASE_URL: The base URL to test against (default: http://localhost:3000)
 * - RESULTS_API_URL: The URL to POST results to (default: http://localhost:3000/api/smoke-test-results)
 * - REPORT_DIR: Directory to save HTML reports (optional, e.g., /artifacts/smoke-reports)
 *
 * Usage:
 *   npx tsx scripts/smoke-test-runner.ts
 */

import { spawn, execSync } from 'child_process'
import { randomUUID } from 'crypto'
import {
  existsSync,
  mkdirSync,
  cpSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  readdirSync,
  statSync,
} from 'fs'
import { join } from 'path'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
const RESULTS_API_URL = process.env.RESULTS_API_URL || `${BASE_URL}/api/smoke-test-results`
const REPORT_DIR = process.env.REPORT_DIR // Optional: directory to save HTML reports

interface PlaywrightTestResult {
  title: string
  status: 'passed' | 'failed' | 'skipped' | 'timedOut'
  duration: number
  errors?: string[]
}

interface PlaywrightReport {
  suites: Array<{
    title: string
    specs: Array<{
      title: string
      tests: Array<{
        status: 'expected' | 'unexpected' | 'skipped'
        results: Array<{
          status: 'passed' | 'failed' | 'skipped' | 'timedOut'
          duration: number
          error?: { message: string }
        }>
      }>
    }>
  }>
  stats: {
    expected: number
    unexpected: number
    skipped: number
    duration: number
  }
}

async function reportResults(results: {
  id: string
  startedAt: string
  completedAt?: string
  status: 'running' | 'passed' | 'failed' | 'error'
  totalTests?: number
  passedTests?: number
  failedTests?: number
  durationMs?: number
  resultsJson?: string
  errorMessage?: string
}): Promise<void> {
  try {
    console.log(`Reporting results to ${RESULTS_API_URL}...`)
    const response = await fetch(RESULTS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(results),
    })

    if (!response.ok) {
      const text = await response.text()
      console.error(`Failed to report results: ${response.status} ${text}`)
    } else {
      console.log('Results reported successfully')
    }
  } catch (error) {
    console.error('Error reporting results:', error)
  }
}

/**
 * Save HTML report to the artifacts directory
 */
function saveHtmlReport(runId: string, htmlReportDir: string, passed: boolean): string | null {
  if (!REPORT_DIR) {
    return null
  }

  try {
    // Ensure report directory exists
    if (!existsSync(REPORT_DIR)) {
      mkdirSync(REPORT_DIR, { recursive: true })
    }

    // Create run-specific directory with timestamp prefix for sorting
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const status = passed ? 'passed' : 'failed'
    const reportDirName = `${timestamp}_${status}_${runId.slice(0, 8)}`
    const destDir = join(REPORT_DIR, reportDirName)

    // Copy HTML report to destination
    if (existsSync(htmlReportDir)) {
      cpSync(htmlReportDir, destDir, { recursive: true })
      console.log(`HTML report saved to: ${destDir}`)

      // Copy screenshots into the report directory
      const screenshotsDir = join(process.cwd(), 'screenshots')
      if (existsSync(screenshotsDir)) {
        const destScreenshots = join(destDir, 'screenshots')
        cpSync(screenshotsDir, destScreenshots, { recursive: true })
        console.log(`Screenshots copied to: ${destScreenshots}`)
      }

      // Update "latest" symlink
      const latestLink = join(REPORT_DIR, 'latest')
      try {
        if (existsSync(latestLink)) {
          unlinkSync(latestLink)
        }
        symlinkSync(reportDirName, latestLink)
        console.log(`Updated 'latest' symlink to: ${reportDirName}`)
      } catch (symlinkError) {
        console.warn('Could not create latest symlink:', symlinkError)
      }

      // Clean up old reports (keep last 20)
      cleanupOldReports(20)

      return reportDirName
    } else {
      console.warn(`HTML report directory not found: ${htmlReportDir}`)
      return null
    }
  } catch (error) {
    console.error('Error saving HTML report:', error)
    return null
  }
}

/**
 * Remove old reports, keeping only the most recent N
 */
function cleanupOldReports(keepCount: number): void {
  if (!REPORT_DIR || !existsSync(REPORT_DIR)) {
    return
  }

  try {
    const entries = readdirSync(REPORT_DIR)
      .filter((name) => {
        // Only consider directories that match our naming pattern (timestamp_status_id)
        const fullPath = join(REPORT_DIR, name)
        return (
          name !== 'latest' &&
          existsSync(fullPath) &&
          statSync(fullPath).isDirectory() &&
          /^\d{4}-\d{2}-\d{2}T/.test(name)
        )
      })
      .sort()
      .reverse() // Most recent first

    // Remove old entries
    const toRemove = entries.slice(keepCount)
    for (const dir of toRemove) {
      const fullPath = join(REPORT_DIR, dir)
      rmSync(fullPath, { recursive: true, force: true })
      console.log(`Removed old report: ${dir}`)
    }
  } catch (error) {
    console.error('Error cleaning up old reports:', error)
  }
}

async function runTests(): Promise<void> {
  const runId = randomUUID()
  const startedAt = new Date().toISOString()

  console.log(`Starting smoke test run: ${runId}`)
  console.log(`Base URL: ${BASE_URL}`)
  console.log(`Results API: ${RESULTS_API_URL}`)

  // Report that we're starting
  await reportResults({
    id: runId,
    startedAt,
    status: 'running',
  })

  const reportDir = join(process.cwd(), 'playwright-report')
  const htmlReportDir = join(process.cwd(), 'playwright-html-report')
  const jsonReportPath = join(reportDir, 'results.json')

  // Ensure report directories exist
  if (!existsSync(reportDir)) {
    mkdirSync(reportDir, { recursive: true })
  }
  if (!existsSync(htmlReportDir)) {
    mkdirSync(htmlReportDir, { recursive: true })
  }

  try {
    // Run Playwright tests with JSON reporter (stdout) and HTML reporter (directory)
    // Note: testDir in playwright.config.ts is './e2e', so we pass 'smoke' not 'e2e/smoke'
    const playwrightProcess = spawn(
      'npx',
      ['playwright', 'test', 'smoke', '--reporter=json,html', `--output=${reportDir}`],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          BASE_URL,
          CI: 'true', // Ensure CI mode
          PLAYWRIGHT_HTML_REPORT: htmlReportDir, // Output directory for HTML report
        },
        stdio: ['inherit', 'pipe', 'pipe'],
      }
    )

    let stdout = ''
    let stderr = ''

    playwrightProcess.stdout?.on('data', (data) => {
      stdout += data.toString()
    })

    playwrightProcess.stderr?.on('data', (data) => {
      stderr += data.toString()
      process.stderr.write(data)
    })

    const exitCode = await new Promise<number>((resolve) => {
      playwrightProcess.on('close', (code) => {
        resolve(code ?? 1)
      })
    })

    const completedAt = new Date().toISOString()
    const durationMs = new Date(completedAt).getTime() - new Date(startedAt).getTime()

    // Try to parse the JSON report from stdout
    let report: PlaywrightReport | null = null
    try {
      report = JSON.parse(stdout)
    } catch {
      console.log('Could not parse JSON report from stdout')
    }

    if (report) {
      const totalTests = report.stats.expected + report.stats.unexpected + report.stats.skipped
      const passedTests = report.stats.expected
      const failedTests = report.stats.unexpected
      const passed = failedTests === 0

      // Save HTML report to artifacts directory
      const savedReportDir = saveHtmlReport(runId, htmlReportDir, passed)
      if (savedReportDir) {
        console.log(`HTML report: https://dev.abaci.one/smoke-reports/${savedReportDir}/`)
      }

      await reportResults({
        id: runId,
        startedAt,
        completedAt,
        status: passed ? 'passed' : 'failed',
        totalTests,
        passedTests,
        failedTests,
        durationMs,
        resultsJson: JSON.stringify(report),
      })

      console.log(`\nTest run completed:`)
      console.log(`  Total: ${totalTests}`)
      console.log(`  Passed: ${passedTests}`)
      console.log(`  Failed: ${failedTests}`)
      console.log(`  Duration: ${durationMs}ms`)

      process.exit(exitCode)
    } else {
      // Fallback: report based on exit code
      const passed = exitCode === 0

      // Save HTML report to artifacts directory
      const savedReportDir = saveHtmlReport(runId, htmlReportDir, passed)
      if (savedReportDir) {
        console.log(`HTML report: https://dev.abaci.one/smoke-reports/${savedReportDir}/`)
      }

      await reportResults({
        id: runId,
        startedAt,
        completedAt,
        status: passed ? 'passed' : 'failed',
        durationMs,
        errorMessage: exitCode !== 0 ? `Playwright exited with code ${exitCode}` : undefined,
      })

      process.exit(exitCode)
    }
  } catch (error) {
    const completedAt = new Date().toISOString()
    const durationMs = new Date(completedAt).getTime() - new Date(startedAt).getTime()

    await reportResults({
      id: runId,
      startedAt,
      completedAt,
      status: 'error',
      durationMs,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    })

    console.error('Error running tests:', error)
    process.exit(1)
  }
}

runTests()
