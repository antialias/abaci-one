import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { players } from './players'
import { users } from './users'

/**
 * Parent-child relationships
 *
 * Many-to-many relationship between parents (users) and children (players).
 * A child can have multiple parents, and a parent can have multiple children.
 * All linked parents have equal access to the child.
 */
export const parentChild = sqliteTable(
  'parent_child',
  {
    /** Parent's user ID */
    parentUserId: text('parent_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** Child's player ID */
    childPlayerId: text('child_player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),

    /** When this relationship was created */
    linkedAt: integer('linked_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.parentUserId, table.childPlayerId] }),
  })
)

export type ParentChild = typeof parentChild.$inferSelect
export type NewParentChild = typeof parentChild.$inferInsert
