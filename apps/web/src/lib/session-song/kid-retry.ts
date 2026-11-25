/**
 * When a family may fill in a missing session song themselves, without an admin.
 *
 * Only when all hold:
 * - the song failed for a reason that clears up (rate limit, outage, quota, setup, sign-in),
 *   never a song held back for its content or for an unknown reason;
 * - songs work now: the newest song anywhere in the app that reached an outcome finished,
 *   and it started after this one failed;
 * - this song has been retried fewer than KID_RETRY_LIMIT times, so a cause that hasn't
 *   really cleared can't spend credits on repeated taps.
 *
 * Nothing here retries on its own; it only decides whether the button shows and works.
 */

import { desc, inArray } from 'drizzle-orm'
import { db, schema } from '@/db'
import type { SessionSongFailureKind } from '@/db/schema/session-songs'
import { classifySongFailure } from './classify-failure'

export const KID_RETRY_LIMIT = 3

const HEALS_ON_ITS_OWN: ReadonlySet<SessionSongFailureKind> = new Set([
  'missing_config',
  'auth_invalid',
  'quota_exceeded',
  'rate_limited',
  'transient',
])

export interface RetryCandidate {
  status: string
  /** Stored as free text; older rows have none */
  failureKind: string | null
  errorMessage: string | null
  regenerationCount: number
  createdAt: Date
}

export interface LatestSongOutcome {
  status: string
  createdAt: Date
}

/** Why the family can't retry this song now, or null when they can. */
export function kidRetryRefusal(
  song: RetryCandidate,
  latest: LatestSongOutcome | null
): string | null {
  if (song.status !== 'failed') return 'Only a missing song can be filled in'
  const kind = song.failureKind ?? classifySongFailure(song.errorMessage ?? 'unknown').kind
  if (!HEALS_ON_ITS_OWN.has(kind as SessionSongFailureKind))
    return 'This song needs a grown-up to look at it'
  if (song.regenerationCount >= KID_RETRY_LIMIT) return 'This song has been tried enough times'
  if (!latest || latest.status !== 'completed' || latest.createdAt <= song.createdAt) {
    return 'Songs are not working yet; try again later'
  }
  return null
}

/** The newest song in the app that finished or failed. */
export async function latestSongOutcome(): Promise<LatestSongOutcome | null> {
  const [row] = await db
    .select({ status: schema.sessionSongs.status, createdAt: schema.sessionSongs.createdAt })
    .from(schema.sessionSongs)
    .where(inArray(schema.sessionSongs.status, ['completed', 'failed']))
    .orderBy(desc(schema.sessionSongs.createdAt))
    .limit(1)
  return row ?? null
}
