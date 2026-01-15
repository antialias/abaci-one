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

/**
 * GET - List all API keys for the current user
 * Key values are masked for security (only shown on creation)
 */
export async function GET() {
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
}

/**
 * POST - Create a new API key
 * Returns the full key value - this is the only time it's shown!
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getDbUserId()
    const body = await request.json()

    const name = body.name?.trim()
    if (!name) {
      return NextResponse.json({ error: 'Key name is required' }, { status: 400 })
    }

    // Generate a random API key
    const key = generateApiKey()

    // Insert the new key
    const [newKey] = await db
      .insert(schema.mcpApiKeys)
      .values({
        userId,
        key,
        name,
      })
      .returning()

    return NextResponse.json({
      id: newKey.id,
      name: newKey.name,
      key, // Full key - only shown this once!
      createdAt: newKey.createdAt,
      message: 'Save this key securely - it will not be shown again!',
    })
  } catch (error) {
    console.error('Error creating MCP API key:', error)
    return NextResponse.json({ error: 'Failed to create API key' }, { status: 500 })
  }
}
