import { createId } from '@paralleldrive/cuid2'
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { users } from './users'

/**
 * MCP API Keys - authentication tokens for MCP (Model Context Protocol) access
 *
 * These keys allow external tools like Claude Code to access student data
 * via the MCP protocol. Keys are scoped to a user and grant access to all
 * players owned by that user.
 *
 * Security model:
 * - Keys are generated as random tokens and stored as-is (not hashed)
 * - Each key is tied to a userId at creation time
 * - Keys can be revoked but not modified
 * - Deleting a user cascades to delete their keys
 */
export const mcpApiKeys = sqliteTable(
  'mcp_api_keys',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),

    /** User who owns this key - scopes access to their players */
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** The API key token (random 32-byte hex string) */
    key: text('key').notNull(),

    /** Human-readable name for this key (e.g., "Claude Code on MacBook") */
    name: text('name').notNull(),

    /** Optional description of what this key is used for */
    description: text('description'),

    /** Last time this key was used to make an MCP request */
    lastUsedAt: integer('last_used_at', { mode: 'timestamp' }),

    /** When this key was revoked (null if active) */
    revokedAt: integer('revoked_at', { mode: 'timestamp' }),

    /** When this key was created */
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    /** Index for looking up keys by user */
    userIdIdx: index('mcp_api_keys_user_id_idx').on(table.userId),
    /** Unique index on the key itself for fast auth lookups */
    keyIdx: uniqueIndex('mcp_api_keys_key_idx').on(table.key),
  })
)

export type McpApiKey = typeof mcpApiKeys.$inferSelect
export type NewMcpApiKey = typeof mcpApiKeys.$inferInsert
