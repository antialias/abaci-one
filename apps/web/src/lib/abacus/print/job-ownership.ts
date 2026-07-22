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

/**
 * Every print-service job id THIS user submitted through abaci, as a Set for
 * O(1) roster intersection (#16). The print-service token is shared across
 * every app paired to it, so the raw `/jobs` list is over-broad; this is the
 * scope that narrows it. An empty set ⇒ the user owns nothing ⇒ an empty
 * roster (never the unfiltered list).
 */
export async function listOwnedJobIds(userId: string): Promise<Set<string>> {
  const rows = await db.query.printJobs.findMany({
    columns: { jobId: true },
    where: eq(schema.printJobs.userId, userId),
  })
  return new Set(rows.map((row) => row.jobId))
}
