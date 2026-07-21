import { createId } from '@paralleldrive/cuid2'
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { users } from './users'

/**
 * Print-service connections — per-account pairings with a THH print service
 * (Abacus Studio Phase 2a, ticket #8).
 *
 * Each row is one paired connection owned by exactly one user (the tenant key
 * for everything downstream: proxy reads, job ownership, doorbell fan-out).
 * The bearer token and the webhook ring secret are encrypted at rest with
 * `@/lib/secret-box` — the browser-facing PrintConnection shape never carries
 * either sealed field.
 */
export const printServiceConnections = sqliteTable(
  'print_service_connections',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),

    /** Owning account — the tenant boundary for reads, jobs, and doorbell emits */
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** Human-readable connection name (e.g. "Home X1C") */
    name: text('name').notNull(),

    /** Print-service origin, e.g. "https://things.haunt.house" (no trailing slash) */
    origin: text('origin').notNull(),

    /** Durable bearer token from POST /pair, sealed with secret-box */
    tokenSealed: text('token_sealed').notNull(),

    /** Per-connection webhook ring secret, sealed with secret-box (null until webhook registered) */
    ringSecretSealed: text('ring_secret_sealed'),

    /** When PUT /webhook last succeeded for this connection (null = no doorbell) */
    webhookRegisteredAt: integer('webhook_registered_at', { mode: 'timestamp' }),

    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),

    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    /** Roster lookups are always per-owner */
    userIdIdx: index('print_service_connections_user_id_idx').on(table.userId),
  })
)

/**
 * Print-job ownership map. The print service stays the single source of truth
 * for job state — this table only records which connection/user a submitted
 * job belongs to, so `jobs/*` proxy reads can be authorized and doorbell rings
 * resolved to the owning tenant.
 */
export const printJobs = sqliteTable(
  'print_jobs',
  {
    /** Job id as returned by the print service's 202 submit response */
    jobId: text('job_id').primaryKey(),

    connectionId: text('connection_id')
      .notNull()
      .references(() => printServiceConnections.id, { onDelete: 'cascade' }),

    /** Denormalized owner — matches the connection's userId at submit time */
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** Printer the job was submitted to (service-side printer id) */
    printerId: text('printer_id').notNull(),

    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    /** "My active jobs" listings */
    userIdIdx: index('print_jobs_user_id_idx').on(table.userId),
    connectionIdIdx: index('print_jobs_connection_id_idx').on(table.connectionId),
  })
)

export type PrintServiceConnection = typeof printServiceConnections.$inferSelect
export type NewPrintServiceConnection = typeof printServiceConnections.$inferInsert
export type PrintJob = typeof printJobs.$inferSelect
export type NewPrintJob = typeof printJobs.$inferInsert
