import { NextResponse, type NextRequest } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { db } from '@/db'
import { userPushSubscriptions } from '@/db/schema'
import { and, eq } from 'drizzle-orm'

/** POST /api/settings/notification-preferences/push-subscriptions — register a push endpoint */
export const POST = withAuth(async (request: NextRequest, { userId }) => {
  const body = await request.json()
  const { endpoint, keys, deviceLabel } = body as {
    endpoint: string
    keys: { p256dh: string; auth: string }
    deviceLabel?: string
  }

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: 'endpoint and keys are required' }, { status: 400 })
  }

  // Upsert: if this endpoint already exists for this user, just update it
  const [existing] = await db
    .select({ id: userPushSubscriptions.id })
    .from(userPushSubscriptions)
    .where(
      and(eq(userPushSubscriptions.userId, userId), eq(userPushSubscriptions.endpoint, endpoint))
    )
    .limit(1)

  if (existing) {
    await db
      .update(userPushSubscriptions)
      .set({ keys, deviceLabel: deviceLabel ?? null, lastUsedAt: new Date() })
      .where(eq(userPushSubscriptions.id, existing.id))

    return NextResponse.json({ id: existing.id, created: false })
  }

  const [sub] = await db
    .insert(userPushSubscriptions)
    .values({
      userId,
      endpoint,
      keys,
      deviceLabel: deviceLabel ?? null,
    })
    .returning({ id: userPushSubscriptions.id })

  return NextResponse.json({ id: sub.id, created: true }, { status: 201 })
})

/** DELETE /api/settings/notification-preferences/push-subscriptions — remove a push endpoint */
export const DELETE = withAuth(async (request: NextRequest, { userId }) => {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  await db
    .delete(userPushSubscriptions)
    .where(and(eq(userPushSubscriptions.id, id), eq(userPushSubscriptions.userId, userId)))

  return NextResponse.json({ success: true })
})
