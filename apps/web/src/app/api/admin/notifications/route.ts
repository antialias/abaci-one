import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { appSettings, type NotificationChannelsConfig } from '@/db/schema/app-settings'
import { withAuth } from '@/lib/auth/withAuth'

const DEFAULT_CONFIG: NotificationChannelsConfig = {
  webPush: { enabled: false },
  email: { enabled: false },
  inApp: { enabled: false },
}

export interface ChannelStatus {
  operational: boolean
  reason?: string
}

function getChannelStatuses(): Record<string, ChannelStatus> {
  const hasVapidPublic = !!process.env.VAPID_PUBLIC_KEY
  const hasVapidPrivate = !!process.env.VAPID_PRIVATE_KEY
  const hasEmailServer = !!process.env.EMAIL_SERVER

  return {
    webPush:
      hasVapidPublic && hasVapidPrivate
        ? { operational: true }
        : {
            operational: false,
            reason: `Missing env: ${[!hasVapidPublic && 'VAPID_PUBLIC_KEY', !hasVapidPrivate && 'VAPID_PRIVATE_KEY'].filter(Boolean).join(', ')}`,
          },
    email: hasEmailServer
      ? { operational: true }
      : { operational: false, reason: 'Missing env: EMAIL_SERVER' },
    inApp: { operational: true },
  }
}

/**
 * GET /api/admin/notifications
 *
 * Returns the current notification channels config + operational status.
 */
export const GET = withAuth(
  async () => {
    try {
      const [settings] = await db
        .select({ notificationChannels: appSettings.notificationChannels })
        .from(appSettings)
        .where(eq(appSettings.id, 'default'))
        .limit(1)

      let config = DEFAULT_CONFIG
      if (settings?.notificationChannels) {
        try {
          config = JSON.parse(settings.notificationChannels) as NotificationChannelsConfig
        } catch {
          // use default
        }
      }

      return NextResponse.json({
        config,
        status: getChannelStatuses(),
        vapidPublicKey: process.env.VAPID_PUBLIC_KEY ?? null,
      })
    } catch (error) {
      console.error('[admin/notifications] Error fetching config:', error)
      return NextResponse.json({ error: 'Failed to fetch notification config' }, { status: 500 })
    }
  },
  { role: 'admin' }
)

/**
 * PATCH /api/admin/notifications
 *
 * Update notification channels config.
 * Body: NotificationChannelsConfig shape.
 */
export const PATCH = withAuth(
  async (request) => {
    try {
      const body = await request.json()
      const config = body as NotificationChannelsConfig

      // Validate shape
      if (!config || typeof config !== 'object') {
        return NextResponse.json({ error: 'Invalid config shape' }, { status: 400 })
      }

      for (const key of ['webPush', 'email', 'inApp'] as const) {
        if (!config[key] || typeof config[key].enabled !== 'boolean') {
          return NextResponse.json({ error: `${key}.enabled must be a boolean` }, { status: 400 })
        }
      }

      const configJson = JSON.stringify(config)

      // Ensure default row exists
      const existing = await db
        .select({ id: appSettings.id })
        .from(appSettings)
        .where(eq(appSettings.id, 'default'))
        .limit(1)

      if (existing.length === 0) {
        await db.insert(appSettings).values({
          id: 'default',
          notificationChannels: configJson,
        })
      } else {
        await db
          .update(appSettings)
          .set({ notificationChannels: configJson })
          .where(eq(appSettings.id, 'default'))
      }

      return NextResponse.json(config)
    } catch (error) {
      console.error('[admin/notifications] Error updating config:', error)
      return NextResponse.json({ error: 'Failed to update notification config' }, { status: 500 })
    }
  },
  { role: 'admin' }
)
