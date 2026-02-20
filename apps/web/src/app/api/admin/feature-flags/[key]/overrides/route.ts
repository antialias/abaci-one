import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { withAuth } from '@/lib/auth/withAuth'
import { getOverridesForFlag, setOverride } from '@/lib/feature-flags'
import { db, schema } from '@/db'

/**
 * GET /api/admin/feature-flags/[key]/overrides
 *
 * List all per-user overrides for a flag (admin only).
 * Includes user email for display in the admin UI.
 */
export const GET = withAuth(
  async (_request, { params }) => {
    const { key } = (await params) as { key: string }

    try {
      const overrides = await getOverridesForFlag(key)

      // Resolve user emails for display (small N, query individually)
      const userMap = new Map<string, string | null>()
      for (const o of overrides) {
        const [user] = await db
          .select({ email: schema.users.email })
          .from(schema.users)
          .where(eq(schema.users.id, o.userId))
          .limit(1)
        userMap.set(o.userId, user?.email ?? null)
      }

      const result = overrides.map((o) => ({
        flagKey: o.flagKey,
        userId: o.userId,
        userEmail: userMap.get(o.userId) ?? null,
        enabled: o.enabled,
        config: o.config,
        createdAt: o.createdAt,
        updatedAt: o.updatedAt,
      }))

      return NextResponse.json({ overrides: result })
    } catch (error) {
      console.error('[feature-flags] List overrides failed:', error)
      return NextResponse.json({ error: 'Failed to fetch overrides' }, { status: 500 })
    }
  },
  { role: 'admin' }
)

/**
 * PUT /api/admin/feature-flags/[key]/overrides
 *
 * Set a per-user override for a flag (admin only).
 * Accepts email (resolved to userId) or userId directly.
 */
export const PUT = withAuth(
  async (request, { params }) => {
    const { key } = (await params) as { key: string }

    try {
      const body = await request.json()
      const { email, userId: directUserId, enabled, config } = body

      // Resolve userId from email if provided
      let userId = directUserId
      if (!userId && email) {
        const [user] = await db
          .select({ id: schema.users.id })
          .from(schema.users)
          .where(eq(schema.users.email, email))
          .limit(1)

        if (!user) {
          return NextResponse.json({ error: `No user found with email: ${email}` }, { status: 404 })
        }
        userId = user.id
      }

      if (!userId || typeof userId !== 'string') {
        return NextResponse.json({ error: 'Either email or userId is required' }, { status: 400 })
      }

      if (typeof enabled !== 'boolean') {
        return NextResponse.json({ error: 'enabled must be a boolean' }, { status: 400 })
      }

      // Validate config is valid JSON if provided
      let configStr: string | null = null
      if (config !== undefined && config !== null) {
        if (typeof config === 'string') {
          try {
            JSON.parse(config)
            configStr = config
          } catch {
            return NextResponse.json({ error: 'Config must be valid JSON' }, { status: 400 })
          }
        } else {
          configStr = JSON.stringify(config)
        }
      }

      await setOverride(key, userId, { enabled, config: configStr })

      return NextResponse.json({ success: true, flagKey: key, userId })
    } catch (error) {
      console.error('[feature-flags] Set override failed:', error)
      return NextResponse.json({ error: 'Failed to set override' }, { status: 500 })
    }
  },
  { role: 'admin' }
)
