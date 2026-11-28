/**
 * One line for an arithmetic problem (practice-kinds plan §1.3 `describe`):
 * what the song's stats, MCP and logs name a try by. Moved from the song's
 * stats extraction (`extract-session-stats.ts`), which reads it from here.
 *
 * Pure, client-safe.
 */

/** `12 + 5 - 3 = 14`: the terms as a sentence, then the answer. */
export function formatProblemExpression(terms: number[], answer: number): string {
  const expression = terms
    .map((term, index) => {
      if (index === 0) return String(term)
      return term < 0 ? ` - ${Math.abs(term)}` : ` + ${term}`
    })
    .join('')
  return `${expression} = ${answer}`
}
