import { parseSongPlan } from '@/lib/song-share/songPlan'
import type { SongRow } from './queries'

export const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/
export const VERSION_PATTERN = /^[a-f0-9]{64}$/
// Spelled as a code-unit scan rather than a regex character class: a class over
// C0/C1 is what lint/suspicious/noControlCharactersInRegex exists to catch, and
// suppressing that rule would hide the next one someone writes by accident.
function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    if (code <= 0x1f || (code >= 0x7f && code <= 0x9f)) return true
  }
  return false
}

export function isValidId(value: unknown): value is string {
  return typeof value === 'string' && ID_PATTERN.test(value)
}

export function isValidAudioVersion(value: unknown): value is string {
  return typeof value === 'string' && VERSION_PATTERN.test(value)
}

export function isValidTitle(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const title = value.trim()
  return title.length >= 1 && title.length <= 120 && !hasControlCharacter(title)
}

export function toIso(value: Date | number | string): string {
  return (value instanceof Date ? value : new Date(value)).toISOString()
}

export function toNullableIso(value: Date | number | string | null): string | null {
  return value == null ? null : toIso(value)
}

export interface EligibleSongCandidate extends SongRow {
  title: string
}

export function toEligibleSongCandidate(row: SongRow): EligibleSongCandidate | null {
  if (row.status !== 'completed' || row.contentReviewStatus === 'flagged') return null
  const rawTitle = parseSongPlan(row.llmOutput).title
  if (!isValidTitle(rawTitle)) return null
  return { ...row, title: rawTitle.trim() }
}

export function audioUrlFor(playerId: string, songId: string, version: string): string {
  return `/api/integrations/kid-songs/${playerId}/audio?songId=${songId}&v=${version}`
}
