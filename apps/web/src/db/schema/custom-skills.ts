import { sqliteTable, text, index, primaryKey } from 'drizzle-orm/sqlite-core'
import { users } from './users'

/**
 * Custom Skills Table
 *
 * Stores fully user-created custom skills for mastery mode progression.
 * These are new skills that users create from scratch, not modifications
 * of existing default skills.
 */
export const customSkills = sqliteTable(
  'custom_skills',
  {
    id: text('id').primaryKey().notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    operator: text('operator').notNull(), // 'addition' | 'subtraction'
    name: text('name').notNull(),
    description: text('description'),
    digitRange: text('digit_range').notNull(), // JSON: {min, max}
    regroupingConfig: text('regrouping_config').notNull(), // JSON: {pAnyStart, pAllStart}
    displayRules: text('display_rules').notNull(), // JSON: DisplayRules
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => ({
    userOperatorIdx: index('idx_custom_skills_user_operator').on(table.userId, table.operator),
  })
)

/**
 * Skill Customizations Table
 *
 * Stores user customizations of default skills. These modifications
 * override the default skill configuration but maintain the skill's
 * identity and position in the progression.
 */
export const skillCustomizations = sqliteTable(
  'skill_customizations',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    skillId: text('skill_id').notNull(), // ID of the default skill being customized
    operator: text('operator').notNull(), // 'addition' | 'subtraction'
    digitRange: text('digit_range').notNull(), // JSON: {min, max}
    regroupingConfig: text('regrouping_config').notNull(), // JSON: {pAnyStart, pAllStart}
    displayRules: text('display_rules').notNull(), // JSON: DisplayRules
    updatedAt: text('updated_at').notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.skillId, table.operator] }),
  })
)
