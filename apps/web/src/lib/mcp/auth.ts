/**
 * MCP API Key authentication utilities
 */

import { eq, and, isNull } from 'drizzle-orm'
import { db, schema } from '@/db'

/**
 * Validate an MCP API key and return the associated userId
 * Returns null if the key is invalid or revoked
 */
export async function validateMcpApiKey(key: string): Promise<string | null> {
  if (!key) return null

  const apiKey = await db.query.mcpApiKeys.findFirst({
    where: and(eq(schema.mcpApiKeys.key, key), isNull(schema.mcpApiKeys.revokedAt)),
  })

  if (!apiKey) return null

  // Update last used timestamp (fire and forget)
  db.update(schema.mcpApiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(schema.mcpApiKeys.id, apiKey.id))
    .catch(console.error)

  return apiKey.userId
}

/**
 * Generate a random API key (32-byte hex string)
 */
export function generateApiKey(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
