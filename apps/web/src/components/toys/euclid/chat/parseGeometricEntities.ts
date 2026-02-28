/**
 * Parse chat text for structured geometric entity markers.
 *
 * The LLM is instructed to use markers like:
 *   {seg:AB}   → segment A–B
 *   {tri:ABC}  → triangle △ABC
 *   {ang:ABC}  → angle ∠ABC (vertex is middle letter)
 *   {pt:A}     → point A
 *
 * This is far more reliable than guessing from free-form text.
 * If the model doesn't use markers, text renders as-is with no highlights.
 */

export type GeometricEntityRef =
  | { type: 'segment'; from: string; to: string }
  | { type: 'triangle'; vertices: [string, string, string] }
  | { type: 'angle'; points: [string, string, string] }
  | { type: 'point'; label: string }

export type TextSegment =
  | { kind: 'text'; text: string }
  | { kind: 'entity'; text: string; entity: GeometricEntityRef }

/** Display text for each entity type */
function displayText(tag: string, labels: string): string {
  switch (tag) {
    case 'seg': return labels // "AB"
    case 'tri': return `△${labels}` // "△ABC"
    case 'ang': return `∠${labels}` // "∠ABC"
    case 'pt': return labels // "A"
    default: return labels
  }
}

/** Build entity ref from tag and labels, or null if invalid. */
function buildEntity(tag: string, labels: string): GeometricEntityRef | null {
  switch (tag) {
    case 'seg':
      if (labels.length === 2) {
        return { type: 'segment', from: labels[0], to: labels[1] }
      }
      return null
    case 'tri':
      if (labels.length === 3) {
        return { type: 'triangle', vertices: [labels[0], labels[1], labels[2]] }
      }
      return null
    case 'ang':
      if (labels.length === 3) {
        return { type: 'angle', points: [labels[0], labels[1], labels[2]] }
      }
      return null
    case 'pt':
      if (labels.length === 1) {
        return { type: 'point', label: labels[0] }
      }
      return null
    default:
      return null
  }
}

// Match {tag:LABELS} where tag is seg|tri|ang|pt and LABELS is uppercase letters
const MARKER_RE = /\{(seg|tri|ang|pt):([A-Z]+)\}/g

/**
 * Parse text for structured geometric entity markers.
 *
 * `knownLabels` is accepted for API compatibility but not used for filtering —
 * the LLM explicitly marks entities so we trust its output.
 */
export function parseGeometricEntities(
  text: string,
  _knownLabels?: Set<string>
): TextSegment[] {
  const result: TextSegment[] = []
  let lastIndex = 0

  let match: RegExpExecArray | null
  // Reset regex state
  MARKER_RE.lastIndex = 0

  while ((match = MARKER_RE.exec(text)) !== null) {
    const [full, tag, labels] = match
    const entity = buildEntity(tag!, labels!)
    if (!entity) continue

    // Add preceding text
    if (match.index > lastIndex) {
      result.push({ kind: 'text', text: text.slice(lastIndex, match.index) })
    }

    result.push({
      kind: 'entity',
      text: displayText(tag!, labels!),
      entity,
    })

    lastIndex = match.index + full!.length
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
