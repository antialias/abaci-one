/**
 * @vitest-environment node
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Must mock prom-client before importing metrics
vi.mock('prom-client', () => {
  class MockGauge {
    name: string
    private value = 0
    constructor(opts: { name: string; [key: string]: any }) {
      this.name = opts.name
    }
    set(val: number) {
      this.value = val
    }
    inc(_labels?: Record<string, string>) {
      this.value++
    }
    dec() {
      this.value--
    }
    getValue() {
      return this.value
    }
  }

  class MockCounter {
    name: string
    private value = 0
    constructor(opts: { name: string; [key: string]: any }) {
      this.name = opts.name
    }
    inc(_labels?: Record<string, string>) {
      this.value++
    }
    getValue() {
      return this.value
    }
  }

  class MockHistogram {
    name: string
    constructor(opts: { name: string; [key: string]: any }) {
      this.name = opts.name
    }
    observe(_labelsOrValue: any, _value?: number) {}
    startTimer(_labels?: Record<string, string>) {
      return (_endLabels?: Record<string, string>) => {}
    }
  }

  class MockSummary {
    name: string
    constructor(opts: { name: string; [key: string]: any }) {
      this.name = opts.name
    }
    observe(_labelsOrValue: any, _value?: number) {}
  }

  class MockRegistry {
    setDefaultLabels(_labels: Record<string, string>) {}
  }

  return {
    Registry: MockRegistry,
    Counter: MockCounter,
    Histogram: MockHistogram,
    Gauge: MockGauge,
    Summary: MockSummary,
    collectDefaultMetrics: vi.fn(),
  }
})

describe('metrics', () => {
  describe('updateSmokeTestMetrics', () => {
    it('sets status to 1 for passed runs', async () => {
      const { updateSmokeTestMetrics, smokeTestLastStatus } = await import('../metrics')

      updateSmokeTestMetrics({
        status: 'passed',
        startedAt: new Date('2025-01-01T00:00:00Z'),
        completedAt: new Date('2025-01-01T00:01:00Z'),
        totalTests: 10,
        passedTests: 10,
        failedTests: 0,
        durationMs: 60000,
      })

      expect((smokeTestLastStatus as any).getValue()).toBe(1)
    })

    it('sets status to 0 for failed runs', async () => {
      const { updateSmokeTestMetrics, smokeTestLastStatus } = await import('../metrics')

      updateSmokeTestMetrics({
        status: 'failed',
        startedAt: new Date('2025-01-01T00:00:00Z'),
        completedAt: new Date('2025-01-01T00:01:00Z'),
        totalTests: 10,
        passedTests: 8,
        failedTests: 2,
        durationMs: 60000,
      })

      expect((smokeTestLastStatus as any).getValue()).toBe(0)
    })

    it('uses completedAt for timestamp when available', async () => {
      const { updateSmokeTestMetrics, smokeTestLastRunTimestamp } = await import('../metrics')

      const completedAt = new Date('2025-06-15T12:00:00Z')
      updateSmokeTestMetrics({
        status: 'passed',
        startedAt: new Date('2025-06-15T11:59:00Z'),
        completedAt,
        totalTests: 5,
        passedTests: 5,
        failedTests: 0,
        durationMs: 60000,
      })

      expect((smokeTestLastRunTimestamp as any).getValue()).toBe(completedAt.getTime() / 1000)
    })

    it('falls back to startedAt when completedAt is null', async () => {
      const { updateSmokeTestMetrics, smokeTestLastRunTimestamp } = await import('../metrics')

      const startedAt = new Date('2025-06-15T11:59:00Z')
      updateSmokeTestMetrics({
        status: 'failed',
        startedAt,
        completedAt: null,
        totalTests: null,
        passedTests: null,
        failedTests: null,
        durationMs: null,
      })

      expect((smokeTestLastRunTimestamp as any).getValue()).toBe(startedAt.getTime() / 1000)
    })

    it('handles null metrics gracefully', async () => {
      const { updateSmokeTestMetrics, smokeTestLastDuration, smokeTestLastTotal } = await import(
        '../metrics'
      )

      // Set known values first
      updateSmokeTestMetrics({
        status: 'passed',
        startedAt: new Date(),
        completedAt: new Date(),
        totalTests: 10,
        passedTests: 10,
        failedTests: 0,
        durationMs: 5000,
      })

      const durationBefore = (smokeTestLastDuration as any).getValue()
      const totalBefore = (smokeTestLastTotal as any).getValue()

      // Now call with nulls -- the previous values should NOT be overwritten
      // because the function only calls .set when the value != null
      updateSmokeTestMetrics({
        status: 'error',
        startedAt: new Date(),
        completedAt: null,
        totalTests: null,
        passedTests: null,
        failedTests: null,
        durationMs: null,
      })

      // durationMs is null so smokeTestLastDuration.set() was not called again
      // meaning it retains its previous value
      expect((smokeTestLastDuration as any).getValue()).toBe(durationBefore)
      expect((smokeTestLastTotal as any).getValue()).toBe(totalBefore)
    })
  })

  describe('updateCoverageMetrics', () => {
    it('sets coverage percentages correctly', async () => {
      const {
        updateCoverageMetrics,
        coverageLinesPct,
        coverageBranchesPct,
        coverageFunctionsPct,
        coverageStatementsPct,
      } = await import('../metrics')

      updateCoverageMetrics({
        linesPct: 85.5,
        branchesPct: 72.3,
        functionsPct: 90.1,
        statementsPct: 88.8,
        timestamp: new Date('2025-06-15T12:00:00Z'),
      })

      expect((coverageLinesPct as any).getValue()).toBe(85.5)
      expect((coverageBranchesPct as any).getValue()).toBe(72.3)
      expect((coverageFunctionsPct as any).getValue()).toBe(90.1)
      expect((coverageStatementsPct as any).getValue()).toBe(88.8)
    })

    it('sets coverage timestamp correctly', async () => {
      const { updateCoverageMetrics, coverageLastRunTimestamp } = await import('../metrics')

      const ts = new Date('2025-03-20T10:30:00Z')
      updateCoverageMetrics({
        linesPct: 50,
        branchesPct: 50,
        functionsPct: 50,
        statementsPct: 50,
        timestamp: ts,
      })

      expect((coverageLastRunTimestamp as any).getValue()).toBe(ts.getTime() / 1000)
    })
  })

  describe('metrics namespace export', () => {
    it('exposes all metric categories', async () => {
      const { metrics } = await import('../metrics')

      expect(metrics.http).toBeDefined()
      expect(metrics.socket).toBeDefined()
      expect(metrics.db).toBeDefined()
      expect(metrics.practice).toBeDefined()
      expect(metrics.arcade).toBeDefined()
      expect(metrics.worksheet).toBeDefined()
      expect(metrics.flashcard).toBeDefined()
      expect(metrics.flowchart).toBeDefined()
      expect(metrics.vision).toBeDefined()
      expect(metrics.classroom).toBeDefined()
      expect(metrics.curriculum).toBeDefined()
      expect(metrics.llm).toBeDefined()
      expect(metrics.smokeTest).toBeDefined()
      expect(metrics.coverage).toBeDefined()
      expect(metrics.errors).toBeDefined()
      expect(metrics.sessions).toBeDefined()
    })

    it('http category has expected metrics', async () => {
      const { metrics } = await import('../metrics')

      expect(metrics.http.requestDuration).toBeDefined()
      expect(metrics.http.requestTotal).toBeDefined()
      expect(metrics.http.requestsInFlight).toBeDefined()
      expect(metrics.http.requestSize).toBeDefined()
      expect(metrics.http.responseSize).toBeDefined()
    })

    it('practice category has expected metrics', async () => {
      const { metrics } = await import('../metrics')

      expect(metrics.practice.sessionsActive).toBeDefined()
      expect(metrics.practice.sessionsTotal).toBeDefined()
      expect(metrics.practice.problemsTotal).toBeDefined()
      expect(metrics.practice.responseTime).toBeDefined()
      expect(metrics.practice.streakMax).toBeDefined()
    })
  })

  describe('metricsRegistry', () => {
    it('is exported', async () => {
      const { metricsRegistry } = await import('../metrics')
      expect(metricsRegistry).toBeDefined()
    })
  })
})
