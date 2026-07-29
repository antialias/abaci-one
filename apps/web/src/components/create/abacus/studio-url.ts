/**
 * /create/abacus URL assembly (Gitea #22). The studio's address carries two
 * independent selections — WHOSE abacus (?player=) and WHICH saved design
 * (?design=) — so changing one must never drop the other: picking a student
 * inside a restored design keeps the design in the URL, and vice versa.
 */
export function studioHref(
  pathname: string,
  opts: { playerId: string | null; designId: string | null }
): string {
  const qs = new URLSearchParams()
  if (opts.designId) qs.set('design', opts.designId)
  if (opts.playerId) qs.set('player', opts.playerId)
  const search = qs.toString()
  return search ? `${pathname}?${search}` : pathname
}
