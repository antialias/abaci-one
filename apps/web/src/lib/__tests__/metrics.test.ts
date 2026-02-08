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

  describe('additional metric categories', () => {
    it('socket category has expected metrics', async () => {
      const { metrics } = await import('../metrics')

      expect(metrics.socket.connections).toBeDefined()
      expect(metrics.socket.connectionsTotal).toBeDefined()
      expect(metrics.socket.eventsTotal).toBeDefined()
      expect(metrics.socket.roomsActive).toBeDefined()
    })

    it('db category has expected metrics', async () => {
      const { metrics } = await import('../metrics')

      expect(metrics.db.queryDuration).toBeDefined()
      expect(metrics.db.queryTotal).toBeDefined()
      expect(metrics.db.connectionsActive).toBeDefined()
    })

    it('arcade category has expected metrics', async () => {
      const { metrics } = await import('../metrics')

      expect(metrics.arcade.sessionsActive).toBeDefined()
      expect(metrics.arcade.sessionsTotal).toBeDefined()
      expect(metrics.arcade.gamesCompleted).toBeDefined()
      expect(metrics.arcade.scoreHistogram).toBeDefined()
      expect(metrics.arcade.highScore).toBeDefined()
    })

    it('worksheet category has expected metrics', async () => {
      const { metrics } = await import('../metrics')

      expect(metrics.worksheet.generationsTotal).toBeDefined()
      expect(metrics.worksheet.generationDuration).toBeDefined()
      expect(metrics.worksheet.problemsGenerated).toBeDefined()
    })

    it('flashcard category has expected metrics', async () => {
      const { metrics } = await import('../metrics')

      expect(metrics.flashcard.generationsTotal).toBeDefined()
      expect(metrics.flashcard.cardsGenerated).toBeDefined()
    })

    it('flowchart category has expected metrics', async () => {
      const { metrics } = await import('../metrics')

      expect(metrics.flowchart.viewsTotal).toBeDefined()
      expect(metrics.flowchart.workshopSessionsActive).toBeDefined()
      expect(metrics.flowchart.workshopProblemsTotal).toBeDefined()
    })

    it('vision category has expected metrics', async () => {
      const { metrics } = await import('../metrics')

      expect(metrics.vision.recordingsActive).toBeDefined()
      expect(metrics.vision.recordingsTotal).toBeDefined()
      expect(metrics.vision.framesProcessed).toBeDefined()
      expect(metrics.vision.recognitionsTotal).toBeDefined()
      expect(metrics.vision.remoteCameraSessionsActive).toBeDefined()
    })

    it('classroom category has expected metrics', async () => {
      const { metrics } = await import('../metrics')

      expect(metrics.classroom.active).toBeDefined()
      expect(metrics.classroom.studentsTotal).toBeDefined()
      expect(metrics.classroom.playerLogins).toBeDefined()
      expect(metrics.classroom.teacherLogins).toBeDefined()
    })

    it('curriculum category has expected metrics', async () => {
      const { metrics } = await import('../metrics')

      expect(metrics.curriculum.skillMastery).toBeDefined()
      expect(metrics.curriculum.skillsUnlocked).toBeDefined()
      expect(metrics.curriculum.sessionsCompleted).toBeDefined()
    })

    it('llm category has expected metrics', async () => {
      const { metrics } = await import('../metrics')

      expect(metrics.llm.requestsTotal).toBeDefined()
      expect(metrics.llm.requestDuration).toBeDefined()
      expect(metrics.llm.tokensUsed).toBeDefined()
    })

    it('smokeTest category has expected metrics', async () => {
      const { metrics } = await import('../metrics')

      expect(metrics.smokeTest.lastStatus).toBeDefined()
      expect(metrics.smokeTest.lastRunTimestamp).toBeDefined()
      expect(metrics.smokeTest.lastDuration).toBeDefined()
      expect(metrics.smokeTest.lastTotal).toBeDefined()
      expect(metrics.smokeTest.lastPassed).toBeDefined()
      expect(metrics.smokeTest.lastFailed).toBeDefined()
      expect(metrics.smokeTest.runsTotal).toBeDefined()
    })

    it('coverage category has expected metrics', async () => {
      const { metrics } = await import('../metrics')

      expect(metrics.coverage.linesPct).toBeDefined()
      expect(metrics.coverage.branchesPct).toBeDefined()
      expect(metrics.coverage.functionsPct).toBeDefined()
      expect(metrics.coverage.statementsPct).toBeDefined()
      expect(metrics.coverage.lastRunTimestamp).toBeDefined()
    })

    it('errors category has expected metrics', async () => {
      const { metrics } = await import('../metrics')

      expect(metrics.errors.total).toBeDefined()
      expect(metrics.errors.byCode).toBeDefined()
    })

    it('sessions category has expected metrics', async () => {
      const { metrics } = await import('../metrics')

      expect(metrics.sessions.active).toBeDefined()
      expect(metrics.sessions.duration).toBeDefined()
      expect(metrics.sessions.pageViews).toBeDefined()
      expect(metrics.sessions.uniqueVisitors).toBeDefined()
    })
  })

  describe('individual metric names', () => {
    it('http metrics have correct names', async () => {
      const { httpRequestDuration, httpRequestTotal, httpRequestsInFlight } = await import(
        '../metrics'
      )

      expect((httpRequestDuration as any).name).toBe('http_request_duration_seconds')
      expect((httpRequestTotal as any).name).toBe('http_requests_total')
      expect((httpRequestsInFlight as any).name).toBe('http_requests_in_flight')
    })

    it('socket metrics have correct names', async () => {
      const { socketConnections, socketConnectionsTotal, socketEventsTotal } = await import(
        '../metrics'
      )

      expect((socketConnections as any).name).toBe('socketio_connections_active')
      expect((socketConnectionsTotal as any).name).toBe('socketio_connections_total')
      expect((socketEventsTotal as any).name).toBe('socketio_events_total')
    })

    it('db metrics have correct names', async () => {
      const { dbQueryDuration, dbQueryTotal, dbConnectionsActive } = await import('../metrics')

      expect((dbQueryDuration as any).name).toBe('db_query_duration_seconds')
      expect((dbQueryTotal as any).name).toBe('db_queries_total')
      expect((dbConnectionsActive as any).name).toBe('db_connections_active')
    })

    it('practice metrics have correct names', async () => {
      const { practiceProblemsTotal, practiceResponseTime } = await import('../metrics')

      expect((practiceProblemsTotal as any).name).toBe('practice_problems_total')
      expect((practiceResponseTime as any).name).toBe('practice_response_time_seconds')
    })

    it('error metrics have correct names', async () => {
      const { errorsTotal, errorsByCode } = await import('../metrics')

      expect((errorsTotal as any).name).toBe('errors_total')
      expect((errorsByCode as any).name).toBe('errors_by_code_total')
    })
  })

  describe('updateSmokeTestMetrics edge cases', () => {
    it('sets durationMs in seconds', async () => {
      const { updateSmokeTestMetrics, smokeTestLastDuration } = await import('../metrics')

      updateSmokeTestMetrics({
        status: 'passed',
        startedAt: new Date(),
        completedAt: new Date(),
        totalTests: 5,
        passedTests: 5,
        failedTests: 0,
        durationMs: 45000,
      })

      expect((smokeTestLastDuration as any).getValue()).toBe(45)
    })

    it('sets passedTests and failedTests counts', async () => {
      const { updateSmokeTestMetrics, smokeTestLastPassed, smokeTestLastFailed } = await import(
        '../metrics'
      )

      updateSmokeTestMetrics({
        status: 'failed',
        startedAt: new Date(),
        completedAt: new Date(),
        totalTests: 10,
        passedTests: 7,
        failedTests: 3,
        durationMs: 30000,
      })

      expect((smokeTestLastPassed as any).getValue()).toBe(7)
      expect((smokeTestLastFailed as any).getValue()).toBe(3)
    })

    it('handles status other than passed as 0', async () => {
      const { updateSmokeTestMetrics, smokeTestLastStatus } = await import('../metrics')

      updateSmokeTestMetrics({
        status: 'error',
        startedAt: new Date(),
        completedAt: null,
        totalTests: null,
        passedTests: null,
        failedTests: null,
        durationMs: null,
      })

      expect((smokeTestLastStatus as any).getValue()).toBe(0)
    })
  })

  describe('updateCoverageMetrics edge cases', () => {
    it('handles zero coverage values', async () => {
      const { updateCoverageMetrics, coverageLinesPct, coverageBranchesPct } = await import(
        '../metrics'
      )

      updateCoverageMetrics({
        linesPct: 0,
        branchesPct: 0,
        functionsPct: 0,
        statementsPct: 0,
        timestamp: new Date(),
      })

      expect((coverageLinesPct as any).getValue()).toBe(0)
      expect((coverageBranchesPct as any).getValue()).toBe(0)
    })

    it('handles 100% coverage values', async () => {
      const { updateCoverageMetrics, coverageLinesPct, coverageFunctionsPct } = await import(
        '../metrics'
      )

      updateCoverageMetrics({
        linesPct: 100,
        branchesPct: 100,
        functionsPct: 100,
        statementsPct: 100,
        timestamp: new Date(),
      })

      expect((coverageLinesPct as any).getValue()).toBe(100)
      expect((coverageFunctionsPct as any).getValue()).toBe(100)
    })
  })
})
