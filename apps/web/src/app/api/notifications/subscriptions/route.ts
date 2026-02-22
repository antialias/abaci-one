import { NextResponse, type NextRequest } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { withAuth } from '@/lib/auth/withAuth'
import { db } from '@/db'
import { practiceNotificationSubscriptions } from '@/db/schema'
import { canPerformAction } from '@/lib/classroom/access-control'
import { validateSessionShare } from '@/lib/session-share'
import {
  createSubscription,
  getActiveSubscriptionsForPlayer,
} from '@/lib/notifications/subscription-manager'
import type { SubscriptionChannels, WebPushSubscriptionJson } from '@/db/schema'

const MAX_ANONYMOUS_SUBS_PER_PLAYER = 10
const ANONYMOUS_EXPIRY_DAYS = 30

/**
 * POST /api/notifications/subscriptions
 *
 * Create a new notification subscription.
 * - Authenticated users: verify canPerformAction(userId, playerId, 'view')
 * - Anonymous users: require valid shareToken, at least one delivery mechanism,
 *   30-day auto-expiry, max 10 anonymous subs per player
 */
export const POST = withAuth(async (request: NextRequest, { userId, userRole }) => {
  try {
    const body = await request.json()
    const {
      playerId,
      pushSubscription,
      shareToken,
      email,
      label,
      channels,
    } = body as {
      playerId: string
      pushSubscription?: WebPushSubscriptionJson
      shareToken?: string
      email?: string
      label?: string
      channels?: SubscriptionChannels
    }

    if (!playerId) {
      return NextResponse.json({ error: 'playerId is required' }, { status: 400 })
    }

    const resolvedChannels: SubscriptionChannels = channels ?? {
      webPush: !!pushSubscription,
      email: !!email,
      inApp: false,
    }

    const isAuthenticated = userRole !== 'guest' && !!userId

    if (isAuthenticated) {
      // Authenticated flow: verify access to this player
      const canView = await canPerformAction(userId, playerId, 'view')
      if (!canView) {
        return NextResponse.json({ error: 'Not authorized for this player' }, { status: 403 })
      }

      const result = await createSubscription({
        userId,
        playerId,
        email,
        pushSubscription,
        channels: resolvedChannels,
        label,
      })

      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 })
      }

      return NextResponse.json({ subscription: result.subscription }, { status: 201 })
    } else {
      // Anonymous flow: require share token
      if (!shareToken) {
        return NextResponse.json(
          { error: 'shareToken is required for anonymous subscriptions' },
          { status: 400 }
        )
      }

      // Validate share token
      const validation = await validateSessionShare(shareToken)
      if (!validation.valid || !validation.share) {
        return NextResponse.json(
          { error: validation.error ?? 'Invalid share token' },
          { status: 403 }
        )
      }

      // Verify the share is for the requested player
      if (validation.share.playerId !== playerId) {
        return NextResponse.json(
          { error: 'Share token does not match playerId' },
          { status: 403 }
        )
      }

      // Require at least one delivery mechanism
      if (!pushSubscription && !email) {
        return NextResponse.json(
          { error: 'Anonymous subscriptions require a push subscription or email' },
          { status: 400 }
        )
      }

      // Rate limit: max anonymous subs per player
      const existingAnonymous = await db
        .select({ id: practiceNotificationSubscriptions.id })
        .from(practiceNotificationSubscriptions)
        .where(
          and(
            eq(practiceNotificationSubscriptions.playerId, playerId),
            eq(practiceNotificationSubscriptions.status, 'active')
          )
        )

      // Count subs without a userId (anonymous)
      const anonymousCount = existingAnonymous.length
      if (anonymousCount >= MAX_ANONYMOUS_SUBS_PER_PLAYER) {
        return NextResponse.json(
          { error: `Maximum of ${MAX_ANONYMOUS_SUBS_PER_PLAYER} subscriptions per player reached` },
          { status: 429 }
        )
      }

      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + ANONYMOUS_EXPIRY_DAYS)

      const result = await createSubscription({
        playerId,
        email,
        pushSubscription,
        channels: resolvedChannels,
        label,
        expiresAt,
      })

      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 })
      }

      return NextResponse.json({ subscription: result.subscription }, { status: 201 })
    }
  } catch (error) {
    console.error('[notifications] Failed to create subscription:', error)
    return NextResponse.json({ error: 'Failed to create subscription' }, { status: 500 })
  }
})

/**
 * GET /api/notifications/subscriptions?playerId=X
 *
 * List subscriptions for the authenticated user + specified player.
 */
export const GET = withAuth(async (request: NextRequest, { userId, userRole }) => {
  try {
    if (userRole === 'guest' || !userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const playerId = searchParams.get('playerId')

    if (!playerId) {
      return NextResponse.json({ error: 'playerId query parameter is required' }, { status: 400 })
    }

    const canView = await canPerformAction(userId, playerId, 'view')
    if (!canView) {
      return NextResponse.json({ error: 'Not authorized for this player' }, { status: 403 })
    }

    const subscriptions = await getActiveSubscriptionsForPlayer(playerId)

    // Filter to only the current user's subscriptions
    const userSubs = subscriptions.filter((s) => s.userId === userId)

    return NextResponse.json({ subscriptions: userSubs })
  } catch (error) {
    console.error('[notifications] Failed to list subscriptions:', error)
    return NextResponse.json({ error: 'Failed to list subscriptions' }, { status: 500 })
  }
})
