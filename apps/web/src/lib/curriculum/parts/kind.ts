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
 * Phase 2 scope (§10 P2-1): `plan` and `reportContribution` are not on the
 * contract yet. Generation stays in `generateSessionPlan`, the report arrives
 * in Phase 4a. The recorder's half (`judge`, `evidenceOf`, `describe`,
 * `payloadOf`) is the practice-kinds plan's K1a (§1.3); the presentations,
 * the item list (`items`, `itemOf`), `roundsRemaining` and `presentationOf`
 * returning the `Presentation` are K3's, which retired `bktMode` (the mode
 * is the presentation's, `masteryModeOf`). Planning (`PartPlanner`) is K6's.
 *
 * Client-safe: type-only.
 */

import type {
  StoredTry,
  TryEvidence,
  TryKind,
  TryOutcome,
  TryPayload,
} from '@/db/schema/session-plans'

/**
 * A stored part as structure sees it (§1.3). Absent `kind` is a part from
 * before kinds: arithmetic. `presentation` is written from K6 on; a part
 * without it has its kind's legacy field (`presentationOf` reads either).
 */
export interface StoredPart {
  kind?: string
  partNumber: number
  presentation?: string
  estimatedMinutes?: number
}

/** One item of a part, in the order `items()` lists them (position = index; R9). */
export interface ItemRef {
  itemId: string
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

/**
 * A recorded try as a kind reads its evidence and description from it: the
 * stored row, its outcome, and its payload completed by the kind's
 * `payloadOf` (a subset of the normalized `Try`, practice-kinds plan §1.3).
 * Worksheet and offline tries have no item in the plan, so a kind reads the
 * try, never the item (R9).
 */
export interface KindTryRecord {
  result: StoredTry
  outcome: TryOutcome
  payload: TryPayload
}

/**
 * Why a do-over is refused: the item is not the part's, it has no try yet, or
 * its answer was shown (a kind that divulges answers).
 */
export type DoOverRefusal = 'unknown_item' | 'no_try' | 'divulged'

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

/**
 * How a kind's items are shown and answered (practice-kinds plan §1.3, K1).
 * A kind has one or more (`PartKind.presentations`); a part names one.
 * Looked up by id across kinds in `parts/presentations.ts`. `Part` is the
 * kind's stored part, as in `PartKind`.
 */
export interface Presentation<Part extends StoredPart = StoredPart> {
  /** Stored on a try's evidence (`evidence.presentation`) and, from K3, on a part */
  id: string
  label: string
  emoji: string
  /**
   * The mode this presentation's evidence counts toward, resolved at read
   * time (`masteryModeOf`), never stamped; null = its tries are not evidence
   */
  masteryMode: string | null
  /** The ledger's presentation axes (§3.4); data the adapter copies */
  axes: AttemptPresentation
  /** Whether the kid works this presentation on the physical abacus */
  needsPhysicalAbacus(part: Part): boolean
  /** false for a timed presentation: the shell never auto-pauses mid-item */
  autoPause: boolean
  /** Time-estimate multiplier; default 1 (moves here from `time-estimation.ts` in K6) */
  timeMultiplier?: number
}

/**
 * One kind of practice part.
 *
 * `Content` is what the plan stores for the part, `State` its cursor (opaque
 * to structure), `Item` what the student is shown next.
 */
export interface PartKind<Content, State, Item, Part extends StoredPart = StoredPart> {
  readonly id: string
  /** The kind's presentations by id, in offer order */
  readonly presentations: ReadonlyMap<string, Presentation<Part>>
  /** The part's content as stored in the plan */
  contentOf(part: Part): Content
  /** Whether a stored part can be played (replaces the old auto-abandon test) */
  isPlayable(content: Content): boolean
  /** The part's items in order: the dots, the planned count, per-item report rows */
  items(content: Content): ItemRef[]
  /** An item by id as the kind shows it, or null when the part has none */
  itemOf(content: Content, itemId: string): Item | null
  initialState(content: Content): State
  /** What the student is shown next; null when the part has nothing left to show */
  expectedItem(content: Content, state: State): Item | null
  /**
   * Whether the kid has been shown `itemId`'s answer, decided from the part's
   * tries alone, never from where its cursor stands (amendment A17). The
   * recorder stores a do-over of such an item practice-only when the kind
   * accepts it at all. The shared cursor's is `answerShownWith(maxRounds)`.
   */
  answerShown(tries: readonly KindTry[], itemId: string): boolean
  /** Whether a do-over of `itemId` may be recorded, given the part's tries so far */
  acceptsDoOver(content: Content, state: State, tries: readonly KindTry[], itemId: string): boolean
  /**
   * Why `acceptsDoOver` refuses, named in the recorder's 409 (K2, amendment
   * A12); null when it accepts. Default: the refusal is `not_accepted`.
   */
  whyNotDoOver?(
    content: Content,
    state: State,
    tries: readonly KindTry[],
    itemId: string
  ): DoOverRefusal | null
  /** The state after a recorded try (`tries` = the part's tries before it) */
  applyTry(content: Content, state: State, tries: readonly KindTry[], t: KindTry): State
  /**
   * The state after a do-over recorded while its part is not the one being
   * practiced (a finished part, or any part during a transition or a break):
   * the kind updates what the try changes without moving its cursor. Returns
   * `state` itself when nothing changes. (Phase 3a, §10 P3a-3.)
   */
  applyTryAside(content: Content, state: State, tries: readonly KindTry[], t: KindTry): State
  isDone(content: Content, state: State): boolean
  progress(content: Content, state: State, tries: readonly KindTry[]): PartProgress
  /**
   * Rounds still to come for `itemId` after a wrong try where it stands now;
   * 0 = a wrong try shows the answer (feedback's `showAnswer`, R9)
   */
  roundsRemaining(content: Content, state: State, itemId: string): number
  /** Whether `answer` is correct for `itemId` (only an answered try is judged) */
  judge(content: Content, itemId: string, answer: unknown): boolean
  /** What the try is evidence of; null = recorded, not counted */
  evidenceOf(part: Part, t: KindTryRecord): TryEvidence | null
  /** One line naming what the try answered, for MCP, the song and logs */
  describe(part: Part, t: KindTryRecord): string
  /** The in-memory payload, completed from the row (default: the stored payload) */
  payloadOf(row: StoredTry): TryPayload
  /**
   * The part's presentation: from `part.presentation`, else the kind's legacy
   * field. Its label, emoji, `needsPhysicalAbacus`, mastery mode and ledger
   * axes come from it. Never throws: an id the kind does not register is
   * answered with a presentation of its own (labelled by the id, its own mode).
   */
  presentationOf(part: Part): Presentation<Part>
  /**
   * The id and round of an item `expectedItem` returned, for the recorder's
   * `record_try` (K2, amendment A12). Default: the item's own `itemId`, round 0.
   * K3's shared cursor answers it for every kind on it.
   */
  itemPositionOf?(item: Item): { itemId: string; round: number }
  /**
   * The row fields a try sent in the envelope (`record_try`) stores beside the
   * envelope, and the payload stored (K2, amendment A12). Arithmetic: its
   * top-level snapshot and a skip's frozen projection (§3.1, K14). Default: no
   * fields, the submitted payload. null = no such item.
   */
  snapshotOf?(
    content: Content,
    itemId: string,
    t: { outcome: TryOutcome; answer: unknown; payload: TryPayload }
  ): { fields: Partial<StoredTry>; payload: TryPayload } | null
}

/** Any registered kind, as structure holds it. */
export type AnyPartKind = PartKind<unknown, unknown, unknown, StoredPart>
