/**
 * The part-kind contract (session architecture plan of record §1.2, D3).
 *
 * A session is `part, (break, part)*, end`. Structural code (the flow machine,
 * the try recorder, the report) knows a part only through this interface and
 * the registry (`registry.ts`); everything about what a part contains and how
 * its cursor moves lives in the kind's module (`arithmetic/` today).
 *
 * This file must stay free of any one kind's vocabulary: no problems, no
 * retry rounds, nothing a second kind would not have. A kind's module may
 * import it; it imports no kind.
 *
 * Phase 2 scope (§10 P2-1): `plan`, `reportContribution` and `evidenceOf` are
 * not on the contract yet. Generation stays in `generateSessionPlan`, the
 * report arrives in Phase 4a, skill evidence moves with the ledger rebase.
 *
 * Client-safe: type-only.
 */

import type { TryKind } from '@/db/schema/session-plans'

/** A stored part as structure sees it. Absent `kind` is a part from before kinds: arithmetic. */
export interface StoredPart {
  kind?: string
  partNumber: number
}

/** The try record as a kind sees it (a subset of the normalized `Try`, §2). */
export interface KindTry {
  /** The item the try answered */
  itemId: string
  kind: TryKind
  round: number
  practiceOnly: boolean
  isCorrect: boolean
}

/** Progress through one part: items done of items planned. */
export interface PartProgress {
  done: number
  total: number
}

/** The ledger's presentation axes for an attempt (§6). */
export interface AttemptPresentation {
  layer: string
  modality: string
  abacusAvailable: boolean
  input: string
}

/** The BKT modes; a kind whose tries are not BKT evidence answers null. */
export type BktMode = 'abacus' | 'visualization' | 'linear'

/**
 * One kind of practice part.
 *
 * `Content` is what the plan stores for the part, `State` its cursor (opaque
 * to structure), `Item` what the student is shown next.
 */
export interface PartKind<Content, State, Item, Part extends StoredPart = StoredPart> {
  readonly id: string
  /** The part's content as stored in the plan */
  contentOf(part: Part): Content
  /** Whether a stored part can be played (replaces the old auto-abandon test) */
  isPlayable(content: Content): boolean
  initialState(content: Content): State
  /** What the student is shown next; null when the part has nothing left to show */
  expectedItem(content: Content, state: State): Item | null
  /** Whether a do-over of `itemId` may be recorded, given the part's tries so far */
  acceptsDoOver(content: Content, state: State, tries: readonly KindTry[], itemId: string): boolean
  /** The state after a recorded try (`tries` = the part's tries before it) */
  applyTry(content: Content, state: State, tries: readonly KindTry[], t: KindTry): State
  isDone(content: Content, state: State): boolean
  progress(content: Content, state: State, tries: readonly KindTry[]): PartProgress
  /** Whether `answer` is correct for `itemId` */
  judge(content: Content, itemId: string, answer: unknown): boolean
  presentationOf(part: Part): AttemptPresentation
  /** null = the part's tries are not BKT evidence */
  bktMode(part: Part): BktMode | null
}

/** Any registered kind, as structure holds it. */
export type AnyPartKind = PartKind<unknown, unknown, unknown, StoredPart>
