/**
 * API routes for managing MCP API keys
 *
 * GET /api/settings/mcp-keys - List user's API keys (key values are masked)
 * POST /api/settings/mcp-keys - Create a new API key (returns full key once)
 */

import { eq, isNull, and } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { getDbUserId } from '@/lib/viewer'
import { generateApiKey } from '@/lib/mcp/auth'
import { withAuth } from '@/lib/auth/withAuth'

/**
 * GET - List all API keys for the current user
 * Key values are masked for security (only shown on creation)
 */
export const GET = withAuth(async () => {
  try {
    const userId = await getDbUserId()

    const keys = await db.query.mcpApiKeys.findMany({
      where: eq(schema.mcpApiKeys.userId, userId),
      orderBy: (keys, { desc }) => [desc(keys.createdAt)],
    })

    // Mask the key values - only show first 8 and last 4 chars
    const maskedKeys = keys.map((k) => ({
      id: k.id,
      name: k.name,
      keyPreview: `${k.key.slice(0, 8)}...${k.key.slice(-4)}`,
      createdAt: k.createdAt,
      lastUsedAt: k.lastUsedAt,
      isRevoked: !!k.revokedAt,
    }))

    return NextResponse.json({ keys: maskedKeys })
  } catch (error) {
    console.error('Error fetching MCP API keys:', error)
    return NextResponse.json({ error: 'Failed to fetch API keys' }, { status: 500 })
  }
})

/**
 * POST - Create a new API key
 * Returns the full key value - this is the only time it's shown!
 */
export const POST = withAuth(async (request) => {
  try {
    const userId = await getDbUserId()
    console.log('[MCP-KEYS] Got userId:', userId)

    const body = await request.json()

    const name = body.name?.trim()
    if (!name) {
      return NextResponse.json({ error: 'Key name is required' }, { status: 400 })
    }

    // Generate a random API key
    const key = generateApiKey()

    console.log('[MCP-KEYS] Inserting key for user:', userId, 'name:', name)

    // Insert the new key
    const [newKey] = await db
      .insert(schema.mcpApiKeys)
      .values({
        userId,
        key,
        name,
      })
      .returning()

    console.log('[MCP-KEYS] Key created successfully:', newKey.id)

    return NextResponse.json({
      id: newKey.id,
      name: newKey.name,
      key, // Full key - only shown this once!
      createdAt: newKey.createdAt,
      message: 'Save this key securely - it will not be shown again!',
    })
  } catch (error) {
    console.error('[MCP-KEYS] Error creating MCP API key:', error)
    // Return more specific error for debugging
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Failed to create API key', details: errorMessage },
      { status: 500 }
    )
  }
})
