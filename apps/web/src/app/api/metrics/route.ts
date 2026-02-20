/**
 * Prometheus Metrics Endpoint
 *
 * GET /api/metrics
 *
 * Returns Prometheus-formatted metrics for scraping by Prometheus.
 * This endpoint should be called by the Prometheus server, not by users directly.
 *
 * Metrics exposed:
 * - HTTP request duration and counts
 * - Socket.IO connection metrics
 * - Node.js runtime metrics (memory, CPU, event loop)
 * - Practice session metrics
 * - Vision recording metrics
 */

import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { metricsRegistry, initSmokeTestMetrics, initCoverageMetrics } from '@/lib/metrics'

export const dynamic = 'force-dynamic'

export const GET = withAuth(async () => {
  try {
    // Initialize metrics from DB on first scrape (runs once per pod)
    await initSmokeTestMetrics()
    await initCoverageMetrics()

    const metrics = await metricsRegistry.metrics()

    return new NextResponse(metrics, {
      status: 200,
      headers: {
        'Content-Type': metricsRegistry.contentType,
        // Prevent caching of metrics
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    })
  } catch (error) {
    console.error('Error collecting metrics:', error)

    return NextResponse.json({ error: 'Failed to collect metrics' }, { status: 500 })
  }
})
