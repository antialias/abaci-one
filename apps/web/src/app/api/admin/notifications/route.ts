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

/**
 * GET /api/admin/notifications
 *
 * Returns the current notification channels config from app_settings.
 */
export const GET = withAuth(
  async () => {
    try {
      const [settings] = await db
        .select({ notificationChannels: appSettings.notificationChannels })
        .from(appSettings)
        .where(eq(appSettings.id, 'default'))
        .limit(1)

      if (!settings?.notificationChannels) {
        return NextResponse.json(DEFAULT_CONFIG)
      }

      try {
        const config = JSON.parse(settings.notificationChannels) as NotificationChannelsConfig
        return NextResponse.json(config)
      } catch {
        return NextResponse.json(DEFAULT_CONFIG)
      }
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
          return NextResponse.json(
            { error: `${key}.enabled must be a boolean` },
            { status: 400 }
          )
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
