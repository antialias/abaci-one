/**
 * Job ownership map (Abacus Studio Phase 2a, #8.3).
 *
 * The print service stays the single source of truth for job state; these
 * rows only record which connection/user submitted a job so `jobs/*` proxy
 * reads can be authorized and doorbell rings resolved to the owning tenant.
 */
import { and, eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import type { PrintJob } from '@/db/schema'

export async function recordJobOwnership(input: {
  jobId: string
  connectionId: string
  userId: string
  printerId: string
}): Promise<void> {
  await db.insert(schema.printJobs).values(input).onConflictDoNothing()
}

export async function getOwnedJob(userId: string, jobId: string): Promise<PrintJob | undefined> {
  return db.query.printJobs.findFirst({
    where: and(eq(schema.printJobs.jobId, jobId), eq(schema.printJobs.userId, userId)),
  })
}
