/**
 * Canonical parser for a session song's `llmOutput` composition plan.
 *
 * The admin songs page and the public `/song/[code]` page both need the title,
 * style tags, and per-section lyrics out of `llmOutput`. This is the single
 * place that shape is decoded so the two surfaces never fork their parsing
 * (they keep their own visual treatments, but consume the same data).
 *
 * Defensive over `unknown` — older rows predate parts of the schema and must
 * degrade to empty arrays rather than throw.
 */

export interface ParsedSongSection {
  name: string
  lines: string[]
  localStyles: string[]
  negativeLocalStyles: string[]
  durationMs: number
  /** Stable short IDs of session moments this section references, if any. */
  momentRefs: string[]
}

export interface ParsedSongPlan {
  title: string | null
  globalStyles: string[]
  negativeGlobalStyles: string[]
  totalDurationMs: number
  sections: ParsedSongSection[]
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
}

export function parseSongPlan(llmOutput: unknown): ParsedSongPlan {
  const output = asRecord(llmOutput)
  const plan = asRecord(output?.plan)
  const rawSections = Array.isArray(plan?.sections) ? plan!.sections : []

  const sections: ParsedSongSection[] = rawSections
    .map((raw) => asRecord(raw))
    .filter((s): s is Record<string, unknown> => s !== null)
    .map((s) => ({
      name: typeof s.section_name === 'string' ? s.section_name : 'Untitled section',
      lines: stringArray(s.lines),
      localStyles: stringArray(s.positive_local_styles),
      negativeLocalStyles: stringArray(s.negative_local_styles),
      durationMs: typeof s.duration_ms === 'number' ? s.duration_ms : 0,
      momentRefs: stringArray(s.moment_refs),
    }))

  return {
    title: typeof output?.title === 'string' ? output.title : null,
    globalStyles: stringArray(plan?.positive_global_styles),
    negativeGlobalStyles: stringArray(plan?.negative_global_styles),
    totalDurationMs: sections.reduce((sum, s) => sum + s.durationMs, 0),
    sections,
  }
}
