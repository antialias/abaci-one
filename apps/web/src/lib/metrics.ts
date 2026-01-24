/**
 * Prometheus Metrics Library
 *
 * Provides application metrics for observability:
 * - HTTP request duration and counts
 * - Socket.IO connection metrics
 * - Database query metrics
 * - Node.js runtime metrics (default collectors)
 *
 * Usage:
 *   import { httpRequestDuration, socketConnections } from '@/lib/metrics'
 *
 *   // In middleware or request handler:
 *   const end = httpRequestDuration.startTimer({ method: 'GET', route: '/api/health' })
 *   // ... handle request ...
 *   end({ status_code: '200' })
 */

import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client'

// Create a custom registry to avoid conflicts
export const metricsRegistry = new Registry()

// Set default labels for all metrics
metricsRegistry.setDefaultLabels({
  app: 'abaci-app',
})

// Collect default Node.js metrics (memory, CPU, event loop, etc.)
collectDefaultMetrics({
  register: metricsRegistry,
  prefix: 'nodejs_',
})

// HTTP Request Duration Histogram
// Tracks how long requests take, bucketed for percentile calculations
export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [metricsRegistry],
})

// HTTP Request Counter
// Tracks total number of requests by method, route, and status
export const httpRequestTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [metricsRegistry],
})

// Socket.IO Active Connections Gauge
// Tracks current number of connected Socket.IO clients
export const socketConnections = new Gauge({
  name: 'socketio_connections_active',
  help: 'Number of active Socket.IO connections',
  registers: [metricsRegistry],
})

// Socket.IO Connections Total Counter
// Tracks total connections over time (for rate calculations)
export const socketConnectionsTotal = new Counter({
  name: 'socketio_connections_total',
  help: 'Total number of Socket.IO connections',
  registers: [metricsRegistry],
})

// Database Query Duration Histogram
// Tracks how long database queries take
export const dbQueryDuration = new Histogram({
  name: 'db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['operation', 'table'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
  registers: [metricsRegistry],
})

// Practice Session Metrics
export const practiceSessionsActive = new Gauge({
  name: 'practice_sessions_active',
  help: 'Number of active practice sessions',
  registers: [metricsRegistry],
})

export const practiceProblemsTotal = new Counter({
  name: 'practice_problems_total',
  help: 'Total number of practice problems attempted',
  labelNames: ['correct'],
  registers: [metricsRegistry],
})

// Vision Recording Metrics
export const visionRecordingsActive = new Gauge({
  name: 'vision_recordings_active',
  help: 'Number of active vision recording sessions',
  registers: [metricsRegistry],
})

// Arcade Session Metrics
export const arcadeSessionsActive = new Gauge({
  name: 'arcade_sessions_active',
  help: 'Number of active arcade game sessions',
  labelNames: ['game'],
  registers: [metricsRegistry],
})
