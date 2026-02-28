/**
 * Generic entity marker parser.
 *
 * Walks text with a configurable regex and delegates to a config-provided
 * parseMatch function to build domain-specific entity refs. The Euclid
 * consumer uses this for geometric markers like {seg:AB}, {tri:ABC}, etc.
 */

import type { EntityMarkerConfig } from './types'

export type MarkedSegment<TEntityRef> =
  | { kind: 'text'; text: string }
  | { kind: 'entity'; text: string; entity: TEntityRef }

export function parseEntityMarkers<TEntityRef>(
  text: string,
  config: EntityMarkerConfig<TEntityRef>,
): MarkedSegment<TEntityRef>[] {
  const result: MarkedSegment<TEntityRef>[] = []
  let lastIndex = 0

  // Reset regex state (required for `g` flag regexes)
  config.pattern.lastIndex = 0

  let match: RegExpExecArray | null
  while ((match = config.pattern.exec(text)) !== null) {
    const groups = match.slice(1) // capture groups only
    const parsed = config.parseMatch(groups)
    if (!parsed) continue

    // Add preceding plain text
    if (match.index > lastIndex) {
      result.push({ kind: 'text', text: text.slice(lastIndex, match.index) })
    }

    result.push({
      kind: 'entity',
      text: parsed.displayText,
      entity: parsed.entity,
    })

    lastIndex = match.index + match[0].length
  }

  // Add trailing text
  if (lastIndex < text.length) {
    result.push({ kind: 'text', text: text.slice(lastIndex) })
  }

  // If no markers found, return the whole thing as text
  if (result.length === 0) {
    return [{ kind: 'text', text }]
  }

  return result
}
