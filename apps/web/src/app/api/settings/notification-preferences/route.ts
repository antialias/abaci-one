import { NextResponse, type NextRequest } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { db } from '@/db'
import { userNotificationSettings, userPushSubscriptions } from '@/db/schema'
import { eq } from 'drizzle-orm'
import type { TypeOverridesMap } from '@/db/schema/user-notification-settings'

/** GET /api/settings/notification-preferences — get current user's notification settings */
export const GET = withAuth(async (_request: NextRequest, { userId }) => {
  const [settings] = await db
    .select()
    .from(userNotificationSettings)
    .where(eq(userNotificationSettings.userId, userId))
    .limit(1)

  const pushSubs = await db
    .select({
      id: userPushSubscriptions.id,
      deviceLabel: userPushSubscriptions.deviceLabel,
      createdAt: userPushSubscriptions.createdAt,
      lastUsedAt: userPushSubscriptions.lastUsedAt,
    })
    .from(userPushSubscriptions)
    .where(eq(userPushSubscriptions.userId, userId))

  return NextResponse.json({
    settings: settings ?? {
      userId,
      inAppEnabled: true,
      pushEnabled: false,
      emailEnabled: false,
      notificationEmail: null,
      typeOverrides: null,
    },
    pushDevices: pushSubs,
  })
})

/** PUT /api/settings/notification-preferences — update notification settings */
export const PUT = withAuth(async (request: NextRequest, { userId }) => {
  const body = await request.json()
  const { inAppEnabled, pushEnabled, emailEnabled, notificationEmail, typeOverrides } = body as {
    inAppEnabled?: boolean
    pushEnabled?: boolean
    emailEnabled?: boolean
    notificationEmail?: string | null
    typeOverrides?: TypeOverridesMap | null
  }

  const now = new Date()

  // Check if settings exist
  const [existing] = await db
    .select({ userId: userNotificationSettings.userId })
    .from(userNotificationSettings)
    .where(eq(userNotificationSettings.userId, userId))
    .limit(1)

  if (existing) {
    const updates: Record<string, unknown> = { updatedAt: now }
    if (inAppEnabled !== undefined) updates.inAppEnabled = inAppEnabled
    if (pushEnabled !== undefined) updates.pushEnabled = pushEnabled
    if (emailEnabled !== undefined) updates.emailEnabled = emailEnabled
    if (notificationEmail !== undefined) updates.notificationEmail = notificationEmail
    if (typeOverrides !== undefined) updates.typeOverrides = typeOverrides

    await db
      .update(userNotificationSettings)
      .set(updates)
      .where(eq(userNotificationSettings.userId, userId))
  } else {
    await db.insert(userNotificationSettings).values({
      userId,
      inAppEnabled: inAppEnabled ?? true,
      pushEnabled: pushEnabled ?? false,
      emailEnabled: emailEnabled ?? false,
      notificationEmail: notificationEmail ?? null,
      typeOverrides: typeOverrides ?? null,
      createdAt: now,
      updatedAt: now,
    })
  }

  // Return updated settings
  const [updated] = await db
    .select()
    .from(userNotificationSettings)
    .where(eq(userNotificationSettings.userId, userId))
    .limit(1)

  return NextResponse.json({ settings: updated })
})
