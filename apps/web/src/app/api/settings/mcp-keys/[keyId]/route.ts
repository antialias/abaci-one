/**
 * API routes for managing a specific MCP API key
 *
 * DELETE /api/settings/mcp-keys/[keyId] - Revoke an API key
 */

import { eq, and } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { getDbUserId } from '@/lib/viewer'
import { withAuth } from '@/lib/auth/withAuth'

/**
 * DELETE - Revoke an API key
 * Sets revokedAt timestamp, doesn't actually delete the record
 */
export const DELETE = withAuth(async (_request, { params }) => {
  try {
    const { keyId } = (await params) as { keyId: string }
    const userId = await getDbUserId()

    if (!keyId) {
      return NextResponse.json({ error: 'Key ID is required' }, { status: 400 })
    }

    // Verify the key belongs to this user
    const existingKey = await db.query.mcpApiKeys.findFirst({
      where: and(eq(schema.mcpApiKeys.id, keyId), eq(schema.mcpApiKeys.userId, userId)),
    })

    if (!existingKey) {
      return NextResponse.json({ error: 'API key not found' }, { status: 404 })
    }

    if (existingKey.revokedAt) {
      return NextResponse.json({ error: 'API key is already revoked' }, { status: 400 })
    }

    // Revoke the key
    await db
      .update(schema.mcpApiKeys)
      .set({ revokedAt: new Date() })
      .where(eq(schema.mcpApiKeys.id, keyId))

    return NextResponse.json({
      success: true,
      message: 'API key revoked successfully',
    })
  } catch (error) {
    console.error('Error revoking MCP API key:', error)
    return NextResponse.json({ error: 'Failed to revoke API key' }, { status: 500 })
  }
})
