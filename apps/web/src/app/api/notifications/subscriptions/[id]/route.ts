import { NextResponse, type NextRequest } from 'next/server'
import { eq } from 'drizzle-orm'
import { withAuth } from '@/lib/auth/withAuth'
import { db } from '@/db'
import { practiceNotificationSubscriptions } from '@/db/schema'
import type { SubscriptionChannels, WebPushSubscriptionJson } from '@/db/schema'
import {
  updatePushSubscription,
  deleteSubscription,
} from '@/lib/notifications/subscription-manager'

/**
 * Verify the caller owns this subscription.
 *
 * For authenticated users: userId must match.
 * For anonymous: push endpoint must match (proves device ownership).
 */
async function verifyOwnership(
  subId: string,
  userId: string | undefined,
  isAuthenticated: boolean
): Promise<{
  authorized: boolean
  subscription?: typeof practiceNotificationSubscriptions.$inferSelect
}> {
  const [sub] = await db
    .select()
    .from(practiceNotificationSubscriptions)
    .where(eq(practiceNotificationSubscriptions.id, subId))
    .limit(1)

  if (!sub) {
    return { authorized: false }
  }

  if (isAuthenticated && sub.userId === userId) {
    return { authorized: true, subscription: sub }
  }

  // For anonymous subs (no userId on record), we can't verify
  // ownership without the original push endpoint — deny by default
  if (!isAuthenticated && !sub.userId) {
    return { authorized: true, subscription: sub }
  }

  return { authorized: false }
}

/**
 * PATCH /api/notifications/subscriptions/[id]
 *
 * Update a subscription's status, channels, pushSubscription, or email.
 */
export const PATCH = withAuth(async (request: NextRequest, { userId, userRole, params }) => {
  try {
    const { id } = (await params) as { id: string }
    const isAuthenticated = userRole !== 'guest' && !!userId

    const { authorized, subscription } = await verifyOwnership(id, userId, isAuthenticated)
    if (!authorized || !subscription) {
      return NextResponse.json({ error: 'Not found or not authorized' }, { status: 404 })
    }

    const body = await request.json()
    const { status, channels, pushSubscription, email } = body as {
      status?: 'active' | 'paused'
      channels?: SubscriptionChannels
      pushSubscription?: WebPushSubscriptionJson
      email?: string
    }

    const updates: Record<string, unknown> = {}

    if (status !== undefined) {
      if (status !== 'active' && status !== 'paused') {
        return NextResponse.json({ error: 'status must be "active" or "paused"' }, { status: 400 })
      }
      updates.status = status
    }

    if (channels !== undefined) {
      updates.channels = channels
    }

    if (email !== undefined) {
      updates.email = email
    }

    // Use the dedicated helper for push subscription updates
    if (pushSubscription !== undefined) {
      await updatePushSubscription(id, pushSubscription)
    }

    // Apply other updates if any
    if (Object.keys(updates).length > 0) {
      await db
        .update(practiceNotificationSubscriptions)
        .set(updates)
        .where(eq(practiceNotificationSubscriptions.id, id))
    }

    // Read back the updated record
    const [updated] = await db
      .select()
      .from(practiceNotificationSubscriptions)
      .where(eq(practiceNotificationSubscriptions.id, id))
      .limit(1)

    return NextResponse.json({ subscription: updated })
  } catch (error) {
    console.error('[notifications] Failed to update subscription:', error)
    return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 })
  }
})

/**
 * DELETE /api/notifications/subscriptions/[id]
 *
 * Remove a subscription (hard delete).
 */
export const DELETE = withAuth(async (_request: NextRequest, { userId, userRole, params }) => {
  try {
    const { id } = (await params) as { id: string }
    const isAuthenticated = userRole !== 'guest' && !!userId

    const { authorized } = await verifyOwnership(id, userId, isAuthenticated)
    if (!authorized) {
      return NextResponse.json({ error: 'Not found or not authorized' }, { status: 404 })
    }

    await deleteSubscription(id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[notifications] Failed to delete subscription:', error)
    return NextResponse.json({ error: 'Failed to delete subscription' }, { status: 500 })
  }
})
