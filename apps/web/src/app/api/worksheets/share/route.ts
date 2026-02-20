import { eq } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { worksheetShares } from '@/db/schema'
import { generateShareId } from '@/lib/generateShareId'
import { serializeAdditionConfig } from '@/app/create/worksheets/config-schemas'
import { withAuth } from '@/lib/auth/withAuth'

/**
 * POST /api/worksheets/share
 *
 * Create a shareable link for a worksheet configuration
 *
 * Request body:
 * {
 *   worksheetType: 'addition' | 'subtraction' | ...,
 *   config: { ...worksheet config object },
 *   title?: string (optional description)
 * }
 *
 * Response:
 * {
 *   id: 'abc123X',
 *   url: 'https://abaci.one/worksheets/shared/abc123X'
 * }
 */
export const POST = withAuth(async (request) => {
  try {
    const body = await request.json()
    const { worksheetType, config, title } = body

    // Validate required fields
    if (!worksheetType || !config) {
      return NextResponse.json(
        { error: 'Missing required fields: worksheetType, config' },
        { status: 400 }
      )
    }

    // Validate worksheetType - only 'addition' is supported for now
    if (worksheetType !== 'addition') {
      return NextResponse.json(
        { error: `Unsupported worksheet type: ${worksheetType}` },
        { status: 400 }
      )
    }

    // Generate unique ID (retry if collision - extremely unlikely with base62^7)
    let shareId = generateShareId()
    let attempts = 0
    const MAX_ATTEMPTS = 5
    let isUnique = false

    while (!isUnique && attempts < MAX_ATTEMPTS) {
      shareId = generateShareId()
      const existing = await db.query.worksheetShares.findFirst({
        where: eq(worksheetShares.id, shareId),
      })

      if (!existing) {
        isUnique = true
      } else {
        attempts++
      }
    }

    if (!isUnique) {
      return NextResponse.json({ error: 'Failed to generate unique share ID' }, { status: 500 })
    }

    // Get creator IP (hashed for privacy)
    const forwardedFor = request.headers.get('x-forwarded-for')
    const ip = forwardedFor?.split(',')[0] || request.headers.get('x-real-ip') || 'unknown'

    // Simple hash function for IP (not cryptographic, just for basic spam prevention)
    const hashIp = (str: string) => {
      let hash = 0
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i)
        hash = (hash << 5) - hash + char
        hash = hash & hash // Convert to 32-bit integer
      }
      return hash.toString(36)
    }

    // Serialize config (adds version, validates structure)
    // This ensures the shared config uses the same format as database auto-save
    const configJson = serializeAdditionConfig(config)

    // Create share record
    await db.insert(worksheetShares).values({
      id: shareId,
      worksheetType,
      config: configJson,
      createdAt: new Date(),
      views: 0,
      creatorIp: hashIp(ip),
      title: title || null,
    })

    // Build full URL
    const protocol = request.headers.get('x-forwarded-proto') || 'https'
    const host = request.headers.get('host') || 'abaci.one'
    const url = `${protocol}://${host}/worksheets/shared/${shareId}`

    return NextResponse.json({
      id: shareId,
      url,
    })
  } catch (error) {
    console.error('Error creating worksheet share:', error)
    return NextResponse.json({ error: 'Failed to create share' }, { status: 500 })
  }
})
