import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { getAllFlagsAdmin, createFlag } from '@/lib/feature-flags'

/**
 * GET /api/admin/feature-flags
 *
 * List all flags with full metadata (admin only).
 */
export const GET = withAuth(async () => {
  try {
    const flags = await getAllFlagsAdmin()
    return NextResponse.json({ flags })
  } catch (error) {
    console.error('[feature-flags] Admin list failed:', error)
    return NextResponse.json(
      { error: 'Failed to fetch feature flags' },
      { status: 500 }
    )
  }
}, { role: 'admin' })

/**
 * POST /api/admin/feature-flags
 *
 * Create a new feature flag (admin only).
 */
export const POST = withAuth(async (request) => {
  try {
    const body = await request.json()
    const { key, enabled, config, description, allowedRoles } = body

    if (!key || typeof key !== 'string') {
      return NextResponse.json(
        { error: 'Flag key is required and must be a string' },
        { status: 400 }
      )
    }

    if (!/^[a-z][a-z0-9_.]*$/.test(key)) {
      return NextResponse.json(
        { error: 'Flag key must be lowercase, dot-namespaced (e.g. billing.enabled)' },
        { status: 400 }
      )
    }

    // Validate config is valid JSON if provided
    if (config !== undefined && config !== null) {
      if (typeof config === 'string') {
        try {
          JSON.parse(config)
        } catch {
          return NextResponse.json(
            { error: 'Config must be valid JSON' },
            { status: 400 }
          )
        }
      } else {
        // Accept objects/arrays — we'll stringify them
        body.config = JSON.stringify(config)
      }
    }

    // Validate allowedRoles if provided
    let allowedRolesJson: string | null = null
    if (allowedRoles != null) {
      if (!Array.isArray(allowedRoles) || !allowedRoles.every((r: unknown) => typeof r === 'string')) {
        return NextResponse.json(
          { error: 'allowedRoles must be an array of strings' },
          { status: 400 }
        )
      }
      allowedRolesJson = allowedRoles.length > 0 ? JSON.stringify(allowedRoles) : null
    }

    await createFlag({
      key,
      enabled: enabled ?? false,
      config: typeof config === 'string' ? config : config != null ? JSON.stringify(config) : null,
      description: description ?? null,
      allowedRoles: allowedRolesJson,
    })

    return NextResponse.json({ success: true, key }, { status: 201 })
  } catch (error) {
    // Handle unique constraint violation
    if (error instanceof Error && error.message.includes('UNIQUE')) {
      return NextResponse.json(
        { error: 'A flag with this key already exists' },
        { status: 409 }
      )
    }
    console.error('[feature-flags] Create failed:', error)
    return NextResponse.json(
      { error: 'Failed to create feature flag' },
      { status: 500 }
    )
  }
}, { role: 'admin' })
