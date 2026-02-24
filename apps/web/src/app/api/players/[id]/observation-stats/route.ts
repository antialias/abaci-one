import { NextResponse } from 'next/server'
import { and, desc, eq, sql } from 'drizzle-orm'
import { withAuth } from '@/lib/auth/withAuth'
import { db } from '@/db'
import { sessionObservationShares, practiceNotificationSubscriptions } from '@/db/schema'
import { sessionPlans } from '@/db/schema/session-plans'
import { canPerformAction, isParentOf } from '@/lib/classroom'
import { getShareUrl } from '@/lib/share/urls'

/**
 * GET /api/players/[id]/observation-stats
 *
 * Returns observation share stats for a player: aggregate metrics,
 * active share links, and per-session share breakdown.
 */
export const GET = withAuth(async (_request, { userId, params }) => {
  const { id: playerId } = (await params) as { id: string }

  // Authorization: user must have view access to this player
  const hasAccess = await canPerformAction(userId, playerId, 'view')
  if (!hasAccess) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  try {
    const isParent = await isParentOf(userId, playerId)

    // Fetch all shares for this player (joined with session plans for dates)
    const shares = await db
      .select({
        token: sessionObservationShares.id,
        sessionId: sessionObservationShares.sessionId,
        status: sessionObservationShares.status,
        viewCount: sessionObservationShares.viewCount,
        lastViewedAt: sessionObservationShares.lastViewedAt,
        createdAt: sessionObservationShares.createdAt,
        expiresAt: sessionObservationShares.expiresAt,
        sessionStartedAt: sessionPlans.createdAt,
        sessionCompletedAt: sessionPlans.completedAt,
      })
      .from(sessionObservationShares)
      .innerJoin(sessionPlans, eq(sessionObservationShares.sessionId, sessionPlans.id))
      .where(eq(sessionObservationShares.playerId, playerId))
      .orderBy(desc(sessionObservationShares.createdAt))

    // Auto-expire any shares past their expiration time
    const now = new Date()
    for (const share of shares) {
      if (share.status === 'active' && share.expiresAt && new Date(share.expiresAt) < now) {
        share.status = 'expired'
        // Fire-and-forget update
        db.update(sessionObservationShares)
          .set({ status: 'expired' })
          .where(eq(sessionObservationShares.id, share.token))
          .then(() => {})
          .catch(() => {})
      }
    }

    // Count active notification subscribers
    const subscriberResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(practiceNotificationSubscriptions)
      .where(
        and(
          eq(practiceNotificationSubscriptions.playerId, playerId),
          eq(practiceNotificationSubscriptions.status, 'active')
        )
      )
    const subscriberCount = subscriberResult[0]?.count ?? 0

    // Aggregate stats
    const totalShares = shares.length
    const totalViews = shares.reduce((sum, s) => sum + (s.viewCount ?? 0), 0)
    const activeShareCount = shares.filter((s) => s.status === 'active').length

    // Group shares by session (most recent 20 sessions)
    const sessionMap = new Map<
      string,
      {
        sessionId: string
        startedAt: string
        completedAt: string | null
        shares: typeof shares
        totalViews: number
      }
    >()

    for (const share of shares) {
      if (!sessionMap.has(share.sessionId)) {
        sessionMap.set(share.sessionId, {
          sessionId: share.sessionId,
          startedAt:
            share.sessionStartedAt instanceof Date
              ? share.sessionStartedAt.toISOString()
              : String(share.sessionStartedAt),
          completedAt: share.sessionCompletedAt
            ? share.sessionCompletedAt instanceof Date
              ? share.sessionCompletedAt.toISOString()
              : String(share.sessionCompletedAt)
            : null,
          shares: [],
          totalViews: 0,
        })
      }
      const session = sessionMap.get(share.sessionId)!
      session.shares.push(share)
      session.totalViews += share.viewCount ?? 0
    }

    // Take 20 most recent sessions
    const sessions = Array.from(sessionMap.values())
      .slice(0, 20)
      .map((session) => ({
        sessionId: session.sessionId,
        startedAt: session.startedAt,
        completedAt: session.completedAt,
        totalViews: session.totalViews,
        shares: session.shares.map((s) => ({
          token: s.token,
          url: getShareUrl('observe', s.token),
          status: s.status as 'active' | 'expired' | 'revoked',
          viewCount: s.viewCount ?? 0,
          lastViewedAt: s.lastViewedAt
            ? s.lastViewedAt instanceof Date
              ? s.lastViewedAt.toISOString()
              : String(s.lastViewedAt)
            : null,
          createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : String(s.createdAt),
          expiresAt: s.expiresAt instanceof Date ? s.expiresAt.toISOString() : String(s.expiresAt),
        })),
      }))

    return NextResponse.json({
      totalShares,
      totalViews,
      activeShareCount,
      subscriberCount,
      isParent,
      sessions,
    })
  } catch (error) {
    console.error('Error fetching observation stats:', error)
    return NextResponse.json({ error: 'Failed to fetch observation stats' }, { status: 500 })
  }
})
