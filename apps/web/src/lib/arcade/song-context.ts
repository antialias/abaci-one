import type { GameSongContext } from './game-sdk/types'

export type SongMomentCategory =
  | 'Opening beat'
  | 'Clutch moment'
  | 'Near miss'
  | 'Clean run'
  | 'Perfect run'
  | 'Comeback'
  | 'Tough item'
  | 'Strategy'
  | 'Signature items'

const DEFAULT_PHRASE_LIMIT = 120

export type GameSongContextDraft = Omit<
  GameSongContext,
  'details' | 'dramaticMoments' | 'strategyNotes'
> & {
  details?: Array<string | null | undefined>
  dramaticMoments?: Array<string | null | undefined>
  strategyNotes?: Array<string | null | undefined>
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return count === 1 ? singular : plural
}

export function compactSongPhrase(
  value: string | null | undefined,
  maxLength = DEFAULT_PHRASE_LIMIT
) {
  const compacted = value?.replace(/\s+/g, ' ').trim()
  if (!compacted) return undefined
  if (compacted.length <= maxLength) return compacted
  return `${compacted.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...`
}

export function uniqueSongPhrases(
  values: Array<string | null | undefined>,
  limit: number,
  maxLength = DEFAULT_PHRASE_LIMIT
): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const value of values) {
    const compacted = compactSongPhrase(value, maxLength)
    if (!compacted || seen.has(compacted)) continue
    seen.add(compacted)
    result.push(compacted)
    if (result.length >= limit) break
  }

  return result
}

export function songDetail(label: string, value: string | number | null | undefined) {
  if (value == null) return undefined
  return compactSongPhrase(`${label}: ${value}`)
}

export function songList(
  label: string,
  values: Array<string | number | null | undefined>,
  limit: number
) {
  const items = uniqueSongPhrases(
    values.map((value) => (value == null ? undefined : String(value))),
    limit,
    48
  )
  if (items.length === 0) return undefined
  return songDetail(label, items.join(', '))
}

export function songMoment(category: SongMomentCategory, detail: string | null | undefined) {
  const compacted = compactSongPhrase(detail)
  if (!compacted) return undefined
  return `${category}: ${compacted}`
}

export function finalizeSongContext(context: GameSongContextDraft): GameSongContext {
  const summary = compactSongPhrase(context.summary, 140)
  const details = uniqueSongPhrases(context.details ?? [], 6)
  const dramaticMoments = uniqueSongPhrases(context.dramaticMoments ?? [], 7)
  const strategyNotes = uniqueSongPhrases(context.strategyNotes ?? [], 4)
  const outcome = compactSongPhrase(context.outcome, 100)

  return {
    ...(summary && { summary }),
    ...(details.length > 0 && { details }),
    ...(dramaticMoments.length > 0 && { dramaticMoments }),
    ...(strategyNotes.length > 0 && { strategyNotes }),
    ...(outcome && { outcome }),
  }
}
