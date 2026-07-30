/**
 * A design's name (Gitea #11) — deliberately its own module, not part of
 * `design-snapshot.ts`.
 *
 * The snapshot module defines the envelope that gets hashed into the design's
 * id. A name must stay OUT of that hash: ids are content addresses, so if a
 * name were content, renaming would fork the design and orphan every
 * `?design=` link already printed on a THH job card. Keeping the normalizer in
 * a separate file is that boundary, made visible.
 */

/** Long enough for "Ada's classroom abacus", short enough to stay one rail
 *  line. The rename input caps at the same number. */
export const DESIGN_NAME_MAX = 60

/** Normalize a caller-supplied name.
 *
 *  Returns `null` for "no name" — absent, JSON null, or blank after trimming,
 *  since an empty string is never stored and clearing is how a name is taken
 *  back off. Returns `undefined` for input that is not a usable name at all:
 *  not a string, or longer than the cap. Callers decide whether that is a
 *  refusal (PATCH, where naming IS the request) or something to ignore (POST,
 *  where the snapshot is the request and the name is a passenger). */
export function normalizeDesignName(value: unknown): string | null | undefined {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (trimmed.length > DESIGN_NAME_MAX) return undefined
  return trimmed.length > 0 ? trimmed : null
}
