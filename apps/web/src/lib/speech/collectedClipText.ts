/**
 * What a collected clip says, for generating it: the first text ever written
 * for the clip, whatever its locale.
 *
 * Say rows are client-written (guests included) and first-write-wins per
 * (clip, locale), but a later flush can still add a new locale. Picking by
 * locale priority (the client's `en-US` before `en`) let anyone add an
 * `en-US` row to an existing clip and become its canonical text. In practice
 * every clip has one row, in `en`, written by the flush that first saw it;
 * the earliest row is that row, and a later locale never displaces it.
 *
 * "Earliest" is SQLite rowid order (tts_collected_clip_say is a rowid table;
 * rows are only ever inserted).
 */
import { asc, inArray, sql } from 'drizzle-orm'
import { db } from '@/db'
import { ttsCollectedClipSay } from '@/db/schema'

/** clipId → its first-written text. Clips with no say rows are absent. */
export async function firstWrittenSayText(clipIds?: string[]): Promise<Map<string, string>> {
  const base = db
    .select({ clipId: ttsCollectedClipSay.clipId, text: ttsCollectedClipSay.text })
    .from(ttsCollectedClipSay)
  const rows = await (clipIds
    ? base.where(inArray(ttsCollectedClipSay.clipId, clipIds))
    : base
  ).orderBy(asc(sql`rowid`))
  const first = new Map<string, string>()
  for (const row of rows) {
    if (row.text && !first.has(row.clipId)) first.set(row.clipId, row.text)
  }
  return first
}
