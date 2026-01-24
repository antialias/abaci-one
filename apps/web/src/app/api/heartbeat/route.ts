/**
 * Lightweight heartbeat endpoint for session tracking
 *
 * POST /api/heartbeat
 *
 * Tracks active user sessions using in-memory storage.
 * Sessions are considered active if they've sent a heartbeat within the last 60 seconds.
 * This endpoint is designed to be minimal-impact on performance.
 */

import { NextResponse } from 'next/server'
import { metrics } from '@/lib/metrics'

// In-memory session tracking (resets on server restart, which is fine for metrics)
interface SessionData {
  lastSeen: number
  startTime: number
  path?: string
}

const activeSessions = new Map<string, SessionData>()

// Session timeout in milliseconds (60 seconds)
const SESSION_TIMEOUT_MS = 60_000

// Cleanup interval (every 30 seconds)
const CLEANUP_INTERVAL_MS = 30_000

// Track unique visitors (approximate, daily reset)
const uniqueVisitorHashes = new Set<string>()
let lastVisitorReset = Date.now()

// Periodic cleanup of stale sessions
let cleanupInterval: ReturnType<typeof setInterval> | null = null

function ensureCleanupRunning() {
  if (cleanupInterval) return

  cleanupInterval = setInterval(() => {
    const now = Date.now()
    let activeCount = 0

    for (const [sessionId, data] of activeSessions.entries()) {
      if (now - data.lastSeen > SESSION_TIMEOUT_MS) {
        // Session ended - record duration
        const durationSeconds = (data.lastSeen - data.startTime) / 1000
        if (durationSeconds > 0) {
          metrics.sessions.duration.observe(durationSeconds)
        }
        activeSessions.delete(sessionId)
      } else {
        activeCount++
      }
    }

    // Update active sessions gauge
    metrics.sessions.active.set(activeCount)

    // Reset unique visitors daily
    if (now - lastVisitorReset > 24 * 60 * 60 * 1000) {
      uniqueVisitorHashes.clear()
      lastVisitorReset = now
    }
    metrics.sessions.uniqueVisitors.set(uniqueVisitorHashes.size)
  }, CLEANUP_INTERVAL_MS)
}

// Simple hash function for session anonymization
function hashString(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }
  return hash.toString(36)
}

export async function POST(request: Request) {
  ensureCleanupRunning()

  try {
    const body = await request.json().catch(() => ({}))
    const { sessionId, path } = body as { sessionId?: string; path?: string }

    if (!sessionId) {
      return NextResponse.json({ ok: false }, { status: 400 })
    }

    const now = Date.now()
    const existing = activeSessions.get(sessionId)

    if (existing) {
      // Update existing session
      existing.lastSeen = now
      if (path && path !== existing.path) {
        existing.path = path
        metrics.sessions.pageViews.inc({ path: normalizePath(path) })
      }
    } else {
      // New session
      activeSessions.set(sessionId, {
        lastSeen: now,
        startTime: now,
        path,
      })

      // Track unique visitor (using hashed session ID)
      const visitorHash = hashString(sessionId)
      uniqueVisitorHashes.add(visitorHash)

      if (path) {
        metrics.sessions.pageViews.inc({ path: normalizePath(path) })
      }
    }

    // Return minimal response
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}

// Normalize paths to avoid high cardinality
// e.g., /practice/abc123 -> /practice/[id]
function normalizePath(path: string): string {
  return path
    .replace(/\/[a-f0-9]{8,}/gi, '/[id]') // UUIDs and hex IDs
    .replace(/\/\d+/g, '/[id]') // Numeric IDs
    .replace(/\?.*$/, '') // Remove query strings
    .slice(0, 50) // Limit length
}
