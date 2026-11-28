/**
 * A kind's browser half (practice-kinds plan §1.3, K9), as far as K3 needs
 * it: the optional optimistic check (amendment A11). K5 adds the views
 * (`ItemView`, `ObserverView`, `TryCard`, `Interlude`) and the browser
 * registry.
 *
 * The server is the only judge (A1): the verdict stored is `judge(...)`'s,
 * and the record reply carries it (`try.isCorrect`). A kind's browser half
 * may answer at once for display; the screen reconciles to the server's
 * verdict when the reply arrives (K5a-3). A kind without a check shows its
 * feedback when the server's verdict returns.
 *
 * Client-safe: no kind vocabulary, no imports.
 */

export interface BrowserKind<Item, A = unknown> {
  readonly id: string
  /**
   * The verdict the screen shows the moment the kid submits, before the
   * server's. Display only: never sent as the verdict, never stored.
   * Absent: the screen waits for the record reply.
   */
  check?(item: Item, answer: A): boolean
}

/** What feedback shows: a verdict, or nothing yet (waiting for the server's). */
export type DisplayVerdict = 'correct' | 'incorrect' | 'pending'

/** Feedback right after a submit: the kind's optimistic check, else 'pending'. */
export function optimisticVerdictOf<Item, A>(
  kind: BrowserKind<Item, A>,
  item: Item,
  answer: A
): DisplayVerdict {
  if (!kind.check) return 'pending'
  return kind.check(item, answer) ? 'correct' : 'incorrect'
}

/** Feedback once the record reply is in: the server's verdict wins; until then, the optimistic one. */
export function settledVerdictOf(
  optimistic: DisplayVerdict,
  server: { isCorrect: boolean } | null
): DisplayVerdict {
  if (!server) return optimistic
  return server.isCorrect ? 'correct' : 'incorrect'
}
