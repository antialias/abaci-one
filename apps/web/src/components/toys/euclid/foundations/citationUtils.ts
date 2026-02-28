/**
 * Shared utilities for mapping citation keys to foundation IDs and hrefs.
 * Used by both EuclidCanvas (proof panel) and CitationPopover.
 */

/** Maps a citation key like "Post.3", "Def.15", "C.N.1" to a foundation item ID. */
export function getFoundationIdForCitation(citationKey?: string | null): string | null {
  if (!citationKey) return null
  const defMatch = citationKey.match(/^Def\.(\d+)$/)
  if (defMatch) return `def-${defMatch[1]}`
  const postMatch = citationKey.match(/^Post\.(\d+)$/)
  if (postMatch) return `post-${postMatch[1]}`
  const cnMatch = citationKey.match(/^C\.N\.(\d+)$/)
  if (cnMatch) return `cn-${cnMatch[1]}`
  return null
}

/** Returns the href for the foundations page focused on this citation, or null for propositions. */
export function getFoundationHref(citationKey?: string | null): string | null {
  const id = getFoundationIdForCitation(citationKey)
  if (!id) return null
  return `/toys/euclid?focus=${encodeURIComponent(id)}`
}

/** Returns the proposition number for I.N citations, or null for others. */
export function getPropIdForCitation(citationKey?: string | null): number | null {
  if (!citationKey) return null
  const propMatch = citationKey.match(/^I\.(\d+)$/)
  if (!propMatch) return null
  return parseInt(propMatch[1], 10)
}

/** Returns the proposition page href for I.N citations, or null for others. */
export function getPropositionHref(citationKey?: string | null): string | null {
  const propId = getPropIdForCitation(citationKey)
  if (propId == null) return null
  return `/toys/euclid/${propId}`
}
