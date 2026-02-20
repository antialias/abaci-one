import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { updateFlag, deleteFlag } from '@/lib/feature-flags'

/**
 * PATCH /api/admin/feature-flags/[key]
 *
 * Update a feature flag (admin only).
 */
export const PATCH = withAuth(
  async (request, { params }) => {
    const { key } = (await params) as { key: string }

    try {
      const body = await request.json()
      const update: {
        enabled?: boolean
        config?: string | null
        description?: string | null
        allowedRoles?: string | null
      } = {}

      if ('enabled' in body) {
        update.enabled = Boolean(body.enabled)
      }

      if ('description' in body) {
        update.description = body.description ?? null
      }

      if ('config' in body) {
        if (body.config === null) {
          update.config = null
        } else if (typeof body.config === 'string') {
          // Validate it's valid JSON
          try {
            JSON.parse(body.config)
            update.config = body.config
          } catch {
            return NextResponse.json({ error: 'Config must be valid JSON' }, { status: 400 })
          }
        } else {
          update.config = JSON.stringify(body.config)
        }
      }

      if ('allowedRoles' in body) {
        if (body.allowedRoles === null) {
          update.allowedRoles = null
        } else if (Array.isArray(body.allowedRoles)) {
          if (!body.allowedRoles.every((r: unknown) => typeof r === 'string')) {
            return NextResponse.json(
              { error: 'allowedRoles must be an array of strings' },
              { status: 400 }
            )
          }
          update.allowedRoles =
            body.allowedRoles.length > 0 ? JSON.stringify(body.allowedRoles) : null
        } else {
          return NextResponse.json(
            { error: 'allowedRoles must be an array of strings or null' },
            { status: 400 }
          )
        }
      }

      const updated = await updateFlag(key, update)

      if (!updated) {
        return NextResponse.json({ error: 'Flag not found' }, { status: 404 })
      }

      return NextResponse.json({ success: true, key })
    } catch (error) {
      console.error('[feature-flags] Update failed:', error)
      return NextResponse.json({ error: 'Failed to update feature flag' }, { status: 500 })
    }
  },
  { role: 'admin' }
)

/**
 * DELETE /api/admin/feature-flags/[key]
 *
 * Delete a feature flag (admin only).
 */
export const DELETE = withAuth(
  async (_request, { params }) => {
    const { key } = (await params) as { key: string }

    try {
      const deleted = await deleteFlag(key)

      if (!deleted) {
        return NextResponse.json({ error: 'Flag not found' }, { status: 404 })
      }

      return NextResponse.json({ success: true, key })
    } catch (error) {
      console.error('[feature-flags] Delete failed:', error)
      return NextResponse.json({ error: 'Failed to delete feature flag' }, { status: 500 })
    }
  },
  { role: 'admin' }
)
