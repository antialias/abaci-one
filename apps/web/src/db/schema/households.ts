import { createId } from '@paralleldrive/cuid2'
import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { users } from './users'

/**
 * Households table
 *
 * A household groups multiple users under a single subscription.
 * The owner's subscription covers all household members.
 * Users can belong to multiple households.
 */
export const households = sqliteTable('households', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),

  /** Display name (e.g. "The Smith Family") */
  name: text('name').notNull(),

  /** The billing owner — their subscription covers all members */
  ownerId: text('owner_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),

  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),

  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
})

export type Household = typeof households.$inferSelect
export type NewHousehold = typeof households.$inferInsert

/**
 * Household members table
 *
 * Maps users to households with a role (owner or member).
 * A user can belong to multiple households.
 * A user can only appear once per household (unique constraint).
 */
export const householdMembers = sqliteTable(
  'household_members',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),

    /** Which household */
    householdId: text('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),

    /** Which user */
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** Role within the household */
    role: text('role', { enum: ['owner', 'member'] })
      .notNull()
      .default('member'),

    /** When this user joined the household */
    joinedAt: integer('joined_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    /** A user can only appear once per household */
    householdUserIdx: uniqueIndex('household_members_household_user_idx').on(
      table.householdId,
      table.userId
    ),
  })
)

export type HouseholdMember = typeof householdMembers.$inferSelect
export type NewHouseholdMember = typeof householdMembers.$inferInsert
