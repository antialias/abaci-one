# Practice kinds: plan of record (2026-11-27, rev. 1)

Companion to the [session architecture plan](../session-architecture/plan-of-record.md) (Phases 1–6 live on prod 2026-11-27, PRs #239–#275) and its [findings](../session-architecture/findings.md). That rework is the foundation: one flow machine owns the rhythm, every write is a CAS on `rowVersion`, one report serves every view, every try has an id, and a part is known to structure only through `PartKind`. This document settles how **many kinds of practice**, each in several **presentations**, plug into that session with no edit outside their own folder.

Paths are under `apps/web/src/`; `L/` is the ledger checkout (`~/projects/soroban-abacus-flashcards-practice/apps/web/`, read-only). Every code claim was re-read at `c12abd87f`. §8 is empty, for the reviewer.

**The bar.** Adding a kind or a presentation = one new folder plus one line in each registry (server and browser). Every view (kid's screen, transition, summary, share link and OG, live observer, dashboard lists, adult review, MCP tools, song) handles it with no edit. Tests enforce this (§4 Phase K4). The rhythm `part, (break, part)*, end` then song and summary does not change.

**The rule behind the rule.** A kind that needs an edit outside its folder and registry lines is a defect in the architecture, not in the kind; the architecture is fixed first (an entry in §8, then a phase).

## 0. Decisions in one screen

| # | Decision | Status | Why |
|---|---|---|---|
| K1 | **Two axes.** A *kind* says what the items are and how the cursor moves. A *presentation* says how an item is shown and answered. Today's abacus / visualization / linear are three presentations of one kind, arithmetic. The composer schedules `(kind, presentation)`. | Owner, as recommended | Flash anzan and listening are arithmetic shown differently; "read the abacus" is different items. One axis would fork arithmetic three more times. |
| K2 | **Each presentation names its mastery mode or none** (`masteryMode: string \| null`). New presentations and kinds get their own mode: recorded, reported, not consulted by any decision until decided per kind. The mode is resolved **at read time** from the stamped presentation id, never stamped itself. | Owner, as recommended; read-time resolution is this plan's sharpening (§3.1) | `byMode` is already an open string map (`bkt/types.ts:153`, `compute-bkt.ts:308`). Read-time resolution lets "flash anzan counts toward visualization" (§7 Q1) be one registry line with no backfill (D8). |
| K3 | **The server judges.** `recordTry` calls `kind.judge(content, itemId, answer)` and stamps `isCorrect`. The browser runs the same pure function for instant feedback and may send its verdict; the server ignores it. A try carries `outcome: 'answered' \| 'skipped'`; only an `answered` try is judged. | Owner, as recommended; `outcome` is a sharpening forced by `handleSkip` (§3.1) | Today the browser decides (`ActiveSession.tsx:1440`) and a skip stores the correct answer with `isCorrect: false` (`:1699-1700`), which a judge would call right. |
| K4 | **Shared cursor "items with retry rounds and do-overs"**, generalized from `parts/arithmetic/state.ts`; most kinds use it; the general `PartKind` contract stays for unusual kinds. Its **stored encoding stays byte-identical** to arithmetic's `part_states` entry. | Owner, as recommended; the byte-identical encoding is this plan's constraint | Retry, do-over and practice-only then mean one thing everywhere. The encoding stays so a rollback image reads an in-flight row (D9, both directions) and the golden replay stays green. |
| K5 | **An item is stored before it is shown.** Up front at plan time today; an adaptive kind later appends the next item inside the same CAS write that records the try. | Owner, as recommended | The report, the observer and the adult's review can only name what the row holds. |
| K6 | **Try envelope.** Generic fields plus `answer: unknown`, `outcome`, the server's verdict, `evidence` and a self-contained **kind payload** with the item snapshot. Arithmetic's `problem/studentAnswer/skillsExercised/usedOnScreenAbacus` move into the payload; written at top level too for one release. Old rows read through the normalizer, no backfill. | Owner, as recommended | One record shape for every kind; the ledger's `attempt.answered` takes it as is (§3.4). |
| K7 | **One recorder, `recordTry`**: idempotency → match → judge → evidence → machine. Replaces `recordSlotResult` and `recordRedoResult`; a do-over is one more try through it. | Owner, as recommended | Two recorders today, both arithmetic-shaped (`session-planner.ts:1517, 1817`). |
| K8 | **Composer**, pure and traced: asks each kind for offers, builds ordered parts with minutes within the adult's length and choices; policy from flag config. A break after every part; no three-part cap, no fixed order. Arithmetic's gates become its `offer`. For today's settings the plan is identical (golden-plan test). | Owner, as recommended | `generateSessionPlan` builds abacus → visualization → linear in a fixed order with `partNumber: 1 \| 2 \| 3` (`session-planner.ts:584, 694`; `part-gating.ts:44`). |
| K9 | **Browser split.** The session shell (try lifecycle, pause, teacher control, end early, broadcast, browse, do-over, progress) comes out of `ActiveSession`; a kind's browser half is `ItemView`, `ObserverView`, `TryCard`, `Interlude`; input devices are shared pieces; a browser registry mirrors the server one. | Owner, as recommended | `ActiveSession.tsx` is 2,431 lines of shell and arithmetic views together; `useInteractionPhase` is typed on `GeneratedProblem` (`useInteractionPhase.ts:29`). |
| K10 | **Readers** of the arithmetic shape are classified a–d (§2) and moved: shared fields retyped, evidence readers read `evidence`, content display asks the kind, arithmetic-only features move under arithmetic. | Owner, as recommended | 103 non-test files match the arithmetic shape (§2); about 70 are practice readers. |
| K11 | **The kit**: conformance suite on `EphemeralDatabase`, import gates extended, Storybook per kind, a dev route that starts a session of one kind. | Owner, as recommended | The bar is only real when a test fails without it. |
| K12 | **Design the envelope for the ledger; don't wait for it.** | Owner, as recommended | §3.4 maps every field; the ledger payload already has `outcome`, `presentation.layer`, `pacing`, `termsRevealedAtMs` (`L/docs/practice-ledger-plan-of-record.md:79`). |
| K13 | **Behaviour-identical groundwork first; one squashable PR per phase; old sessions render; old and new code coexist both directions; one release between a write change and a read change; no polling, timers or sleeps.** | Binding (session plan D8, D9) | Learned the hard way in Phases 3–6. |

## 1. Target model

### 1.1 Taxonomy

| Term | Meaning | Today | Examples to come |
|---|---|---|---|
| **Kind** | What the items are and how the part's cursor moves. Owns `plan`, `judge`, `evidenceOf`, `describe`, the cursor, the item views. | `arithmetic` (slots of generated problems; cursor = slots, two retry rounds, do-overs) | `read_abacus` (bead pictures → number), `set_abacus` (number → beads), `facts` (recall) |
| **Presentation** | How an item of a kind is shown and answered: visual form, pacing, input device, whether the physical abacus is in hand. Names its mastery mode. | arithmetic: `abacus` (vertical, abacus in hand, mode `abacus`), `visualization` (vertical, no abacus, mode `visualization`), `linear` (number sentence, abacus during the ramp, mode `linear`) | arithmetic: `flash_anzan` (terms one at a time, keypad, mode `flash_anzan`), `listening` (terms spoken, keypad, mode `listening`); read_abacus: `static` |
| **Part** | One scheduled `(kind, presentation)` with content (items) and minutes. | `SessionPart { type, format, useAbacus, slots, … }` (`session-plans.ts:23-42`) | `StoredPart { kind, presentation, content }` |
| **Item** | What the kid is shown and answers once per try; has a stable id stored before it is shown. | `ProblemSlot.slotId` (`:48-50`) | `itemId` |
| **Try** | One answer to one item: first, retry or do-over; the atom (session plan D4). | `SlotResult` (`:254-378`) | the envelope (§1.4) |
| **Offer** | A kind's proposal to the composer: a `(kind, presentation)` this student may practice now, with eligibility, reason, weight and the input `plan` needs. | the three `partsToInclude` keys after `resolveEnabledPartTypes` (`part-gating.ts:30-78`) | one per presentation per kind |

How today's three parts map, exactly:

| Today | Kind | Presentation | `masteryMode` | `needsPhysicalAbacus` | Plan input |
|---|---|---|---|---|---|
| `type: 'abacus'`, `format: 'vertical'`, `useAbacus: true` (`session-planner.ts:938-939`) | `arithmetic` | `abacus` | `'abacus'` | true | `abacusConstraints` (`:641-650`) |
| `type: 'visualization'`, `format: 'vertical'`, `useAbacus: false` | `arithmetic` | `visualization` | `'visualization'` | false | `visualConstraints`; eligible iff `hasVisualSkills` (`part-gating.ts:50-53`) |
| `type: 'linear'`, `format: 'linear'`, `useAbacus: linearUsesAbacus` (`:676`) | `arithmetic` | `linear` | `'linear'` | `part.useAbacus` (the ramp) | `linearConstraints ?? visualConstraints`; eligibility = `part-gating.ts:56-70` (flag, ready count, vetoes) |

Nothing about a stored arithmetic part changes: `type` is its presentation id (`presentationOf` reads it), `slots` its content (`contentOf`, `arithmetic/server.ts:52`). A new part written by K3 on also carries `presentation` (same value as `type`); old rows derive it.

### 1.2 Layers and what each owns

| Layer | Owns | Must not know |
|---|---|---|
| **Flow machine** `lib/curriculum/session-flow.ts` | the rhythm, `flowState`, `currentPartIndex`, breaks, status; calls only `partKindOf(part).applyTry/applyTryAside/isDone` (`:513-526`) | any kind's vocabulary (already true; `stub-kind.test.ts:18` enforces on the contract file) |
| **Recorder** `recordTry` (new, `lib/curriculum/record-try.ts`) | idempotency, match, judge, evidence, stamps, the write, side effects after commit | item shapes (asks the kind) |
| **Normalizer** `db/schema/session-plan-normalize.ts` | old row → `Try` with `evidence`, `answer`, `payload`, `outcome` filled | nothing kind-specific beyond the arithmetic legacy branch it already has (`:140-190`) |
| **Report** `lib/curriculum/session-report.ts` | counts, position, tries, breaks; per-part rows through the registry (`:357-404`) | `part.type` (today at `:680`; becomes `presentation` through the kind) |
| **Composer** `lib/curriculum/compose/` (new) | offers → ordered parts with minutes; the trace | how a kind plans content |
| **Server kind** `lib/curriculum/parts/<kind>/server.ts` | presentations, offer, plan, items, cursor, match, judge, evidenceOf, describe | React, the DB, the socket (bundle hazard: `seed-script-bundles.test.ts`) |
| **Shared cursor** `lib/curriculum/parts/cursor/retry-rounds.ts` (new) | items in order, two retry rounds, redemption, do-over acceptance, practice-only | item content |
| **Session shell** `components/practice/session/` (new) | try lifecycle, timing, write queue hand-off, pause and auto-pause, teacher control relay, end early, broadcast skeleton, browse, do-over, progress HUD, resync | how an item is drawn or answered |
| **Browser kind** `lib/curriculum/parts/<kind>/browser.tsx` | `ItemView`, `ObserverView`, `TryCard`, `Interlude`; per-presentation views | the plan row, the write queue, pause |
| **Shared input devices** `components/practice/input/` | `NumericKeypad`, `AbacusDock`, keyboard digit listener, voice later | which kind is on screen |
| **Views** (summary, share, OG, observer, lists, review, MCP, song) | the report and the registries | any kind's shape |

### 1.3 Contracts

Server kind (extends today's `PartKind`, `parts/kind.ts:61-89`; the cursor half is unchanged):

```ts
// parts/kind.ts
export interface StoredPart { kind?: string; partNumber: number; presentation?: string; estimatedMinutes: number }

export interface Presentation {
  id: string                       // 'abacus' | 'visualization' | 'linear' | 'flash_anzan' | …
  label: string; emoji: string
  masteryMode: string | null       // read-time mode of this presentation's evidence; null = none
  axes: AttemptPresentation        // ledger axes: layer = id, modality, input, abacusAvailable, format?, pacing?
  needsPhysicalAbacus(part: StoredPart): boolean
}

export interface ItemRef { itemId: string; index: number }

export interface Offer {
  kind: string; presentation: string
  key: string                      // the adult's toggle key; arithmetic: = presentation ('abacus' | 'visualization' | 'linear')
  eligible: boolean; reason?: string          // 'not-ready' | 'vetoed' | 'no-visual-skills' | kind-specific
  weight: number                   // relative share of the session's minutes (today config.partTimeWeights[type])
  minMinutes: number
  planInput: unknown               // opaque to the composer; handed back to plan()
  describe: string                 // one line for the trace
}

export interface OfferContext {    // gathered once by the planner host (today's loads, session-planner.ts:293-308)
  playerId: string; now: Date
  curriculum; skillMastery; bkt; paceAssessment; comfort; linearReadiness; vetoes; flags
  request: { durationMinutes: number; enabled: Record<string, boolean>; weights?: Record<string, number>; overrideItemsPerPart?: number; comfortAdjustment: number; shufflePurposes: boolean }
}

export interface PlanSpec { partNumber: number; presentation: string; minutes: number; itemCount: number; planInput: unknown }

export interface Match { itemId: string; kind: 'first' | 'retry' }   // which item a submission answers, and as what

export interface Evidence { skills: string[]; presentation: string }   // mode resolved at read time (K2)

export interface PartKind<Content, State, Item, Part extends StoredPart = StoredPart> {
  readonly id: string
  readonly presentations: ReadonlyMap<string, Presentation>
  offer(ctx: OfferContext): Offer[]
  plan(spec: PlanSpec, ctx: OfferContext, rng: () => number): Promise<Part>     // items made up front, each with a stable id
  contentOf(part: Part): Content
  isPlayable(content: Content): boolean
  items(content: Content): ItemRef[]                                            // ordered; the dots, plannedItemCount, per-item report rows
  itemOf(content: Content, itemId: string): Item | null
  // cursor (unchanged from today)
  initialState(content): State
  expectedItem(content, state): Item | null
  acceptsDoOver(content, state, tries: readonly KindTry[], itemId): boolean
  applyTry(content, state, tries, t: KindTry): State
  applyTryAside(content, state, tries, t: KindTry): State
  isDone(content, state): boolean
  progress(content, state, tries): PartProgress
  // the recorder's half
  match(content, state, submission: { itemId: string; mode: 'first_or_retry' | 'do_over' }): Match | null
  judge(content, itemId, answer: unknown): boolean
  evidenceOf(part: Part, item: Item, t: KindTry): Evidence | null              // null = recorded, not counted
  describe(part: Part, item: Item, t?: KindTry): string                       // one line for MCP, song, logs
  describePart(part: Part): { label: string; emoji: string; needsPhysicalAbacus: boolean }
  presentationOf(part: Part): Presentation                                    // from part.presentation ?? kind's legacy field
}
```

`bktMode(part)` (`kind.ts:88`) is retired by `presentationOf(part).masteryMode`; `presentationOf` stops returning the bare axes (`arithmetic/server.ts:92-98`) and returns the `Presentation`, whose `axes` the ledger adapter copies.

Shared cursor, generalized from `arithmetic/state.ts` (`expectedArithmeticItem :124-157`, `settleArithmetic :245-273`, `stepPastItem :280-304`, `redeemSlot :311-326`, `MAX_RETRY_EPOCHS :27`):

```ts
// parts/cursor/retry-rounds.ts
export interface RetryRoundsState { slotIndex: number; retry: PartRetryState | undefined }   // the stored encoding, byte-identical to ArithmeticState (K4)
export interface RetryRoundsOptions<Item> {
  maxRounds?: number                                     // default MAX_RETRY_EPOCHS = 2
  snapshot?(item: Item): Partial<RetryItem>              // extra fields a queued retry item carries (arithmetic: problem, originalPurpose, for rollback images)
}
export function retryRoundsCursor<Content, Item extends { itemId: string }>(
  items: (c: Content) => Item[], opts?: RetryRoundsOptions<Item>
): Pick<PartKind<Content, RetryRoundsState, RetryRoundItem<Item>>, 'initialState' | 'expectedItem' | 'acceptsDoOver' | 'applyTry' | 'applyTryAside' | 'isDone' | 'progress' | 'match'>
export type RetryRoundItem<Item> = Item & { round: number; retryIndex: number | null }
```

The stored field names (`slotIndex`, `retry.currentEpoch`, `pendingRetries[].slotId`, `redeemedSlots`) are an **encoding**, documented as such; the API speaks `index`, `round`, `queue`. Renaming the encoding is a separate decision with a normalizer and a release gap; nothing here needs it. `arithmeticKind` becomes `{ ...retryRoundsCursor(slotsAsItems, { snapshot: slotSnapshot }), … }`; `arithmetic-kind.test.ts` and the golden replay (`src/test/part-kind-golden-replay.test.ts`) prove identity.

Composer:

```ts
// lib/curriculum/compose/compose.ts (pure)
export interface ComposerPolicy { minPartMinutes: number; maxParts: number | null; order: 'offered' }   // flag `practice_composer`, resolved like resolveLinearEntryPolicy (linear-entry-policy.ts:71)
export interface Composition {
  parts: PlanSpec[]                                      // ordered; partNumber 1..n
  skipped: { kind: string; presentation: string; key: string; reason: string }[]
  trace: ComposeTrace                                    // offers as seen, policy, minutes per part, why each was kept or dropped
}
export function compose(offers: Offer[], request: OfferContext['request'], policy: ComposerPolicy): Composition
```

Today's behaviour, reproduced exactly: offers come in kind-registration order then the kind's own order (arithmetic: abacus, visualization, linear, as `part-gating.ts:44`); an offer is kept iff `enabled[key]` and `eligible`; `weight` normalized over kept offers (`session-planner.ts:550-553`); minutes = `durationMinutes × normalizedWeight`; `itemCount = overrideItemsPerPart ?? max(2, floor(minutes·60 / avgTimeSeconds))` (`:594-598`); no cap, no reorder. `NoEligiblePartsError` when nothing is kept (`:546-548`). The trace is stored additively as `summary.composition` (the `summary` JSON column, `session-plans.ts:651`; there is no plan-level generation trace today, `GenerationTrace` is per problem, `:133-146`) and is what the ledger's `plan.decided` event will carry (`L/docs/...:96`).

Try envelope (stored row; `SlotResult` keeps its name in code until the ledger, gains these; §3.1 has the storage rules):

```ts
export interface StoredTry {
  // identity and attribution (today's try record, session-plans.ts:330-348)
  tryId: string; itemId: string; partIndex: number; partNumber: number
  kind: 'first' | 'retry' | 'do_over'; round: number; practiceOnly: boolean
  // the answer and the verdict
  outcome: 'answered' | 'skipped'
  answer: unknown | null                  // null when skipped
  isCorrect: boolean                      // the server's judge; adult review may flip it (mark_correct)
  // evidence (K2): null = recorded, not counted; absent on old rows = derived by the normalizer
  evidence: Evidence | null
  masteryWeight: number                   // weightOfTry, unchanged
  // the kind payload: self-contained item snapshot
  payload: { kind: string } & Record<string, unknown>   // arithmetic: { kind: 'arithmetic', problem: GeneratedProblem, usedOnScreenAbacus: boolean }
  // shared, unchanged: timestamp, responseTimeMs + the #156 guard fields, hiddenTimeExcludedMs, hadHelp, incorrectAttempts, helpTrigger, source, originalSource, voided, attachmentId, timingReview
  // legacy arithmetic top-level copies, written one release more (§3.2): slotId, slotIndex, problem, studentAnswer, skillsExercised, usedOnScreenAbacus
}
```

Recorder:

```ts
// lib/curriculum/record-try.ts
export interface TrySubmission {
  tryId: string; partIndex: number; itemId: string
  mode: 'first_or_retry' | 'do_over'
  outcome: 'answered' | 'skipped'; answer: unknown | null
  payload: { kind: string } & Record<string, unknown>
  timing: Pick<StoredTry, 'responseTimeMs' | 'responseTimeMsRaw' | 'wasIdleCapped' | 'capReason' | 'capThresholdMs' | 'capSource' | 'hiddenTimeExcludedMs'>
  help: Pick<StoredTry, 'hadHelp' | 'incorrectAttempts' | 'helpTrigger'>
  clientVerdict?: boolean                 // ignored; logged when it disagrees with the judge
}
export async function recordTry(planId: string, s: TrySubmission | LegacySubmission): Promise<SessionPlan>
// withRowCas(planId, plan =>
//   normalizeSubmission(s, plan)             legacy shape → TrySubmission (§3.3)
//   → isRecordedTry(tryId) ? noWrite          (session-planner.ts:1451-1453)
//   → part = plan.parts[partIndex]; kind = findPartKind(part) ?? throw UnknownKindError (409 unknown_kind)
//   → m = kind.match(content, state, s) ?? throw SlotResultMismatchError (409 SLOT_MISMATCH)
//   → flowState !== 'practicing' && mode === 'first_or_retry' ? throw NotPracticingError (409 not_practicing)
//   → isCorrect = outcome === 'answered' && kind.judge(content, m.itemId, answer)
//   → { round, practiceOnly } = mode === 'do_over' ? doOverStamp(priorTries) : { round: m.round, practiceOnly: false }
//   → evidence = kind.evidenceOf(part, item, try)
//   → row = stamp(...); write = tryWrite(plan, row, try)   (the machine, session-planner.ts:1472-1481)
// ) then, once, after commit: recordSkillAttemptsWithHelp(evidence.skills) unless practiceOnly || !evidence; revokeSharesIfComplete
```

Browser kind and the `ItemView` slot:

```ts
// parts/browser-kind.ts (type-only), parts/browser-registry.ts ('use client' safe)
export interface AnswerChannel<A = unknown> {
  answer: A | null; setAnswer(a: A | null): void
  submit(extra?: { payload?: Record<string, unknown>; help?: Partial<TrySubmission['help']> }): void
  skip(): void
  canSubmit: boolean
}
export interface ItemViewProps<Item, A> {
  item: Item; presentation: Presentation
  channel: AnswerChannel<A>
  feedback: { verdict: 'correct' | 'incorrect'; showAnswer: boolean } | null
  paused: boolean
  devices: { keypadAvailable: boolean; hasPhysicalKeyboard: boolean }
  teacherControl?: unknown                 // arithmetic's abacus presentation reads ReceivedAbacusControl
}
export interface BrowserKind<Item, A> {
  id: string
  ItemView: ComponentType<ItemViewProps<Item, A>>
  ObserverView: ComponentType<{ broadcast: KindBroadcast; presentation: Presentation }>
  TryCard: ComponentType<{ try: TryRow; item: Item | null; presentation: Presentation; variant: 'history' | 'review' | 'browse' }>
  Interlude?: ComponentType<{ from: Item | null; to: Item; state: unknown; onDone(): void }>   // arithmetic: RetryTransitionScreen
  broadcastOf(item: Item, answer: A | null): KindBroadcast                                     // what the observer needs, serializable
  presentations: Record<string, PresentationView<Item, A>>                                      // per-presentation ItemView/ObserverView when they differ
}
export interface KindBroadcast { kind: string; itemId: string; answerText: string; display: unknown }   // answerText feeds VisionRecorder (lib/vision/recording/VisionRecorder.ts:308) and the observer's mirror
```

The shell gives the `ItemView` nothing it could use to reach the plan row, the write queue or pause: that is the narrowness that makes "no edit outside the folder" true.

## 2. Reader inventory

Grep at `c12abd87f`, non-test files outside `parts/arithmetic/`, for `.studentAnswer|.slots|.skillsExercised|usedOnScreenAbacus|part.type|SlotResult|GeneratedProblem`: 103 files (`/tmp/pk-readers.txt`, reproduced below), plus the 13 users of `ProblemResultWithContext` and the callers of `getRecentSessionResults` that read `partType`. Groups: **a** shared fields only (retype); **b** evidence (read `evidence`/`mode`); **c** content display (ask the kind); **d** arithmetic-only feature (move under arithmetic); **s** structure that must become kind-blind; **—** a false positive (another `studentAnswer`/`slots`). Phase letters are §4's.

| File | Hits | Group | Target | Phase |
|---|---|---|---|---|
| `db/schema/session-plans.ts` | types | s | `StoredPart` union, `StoredTry` fields, `partNumber: number` (`:32, 164, 258`) | K1, K3 |
| `db/schema/session-plan-normalize.ts` | `.studentAnswer :181`, `.slots :114`, `SlotResult` | s | fills `answer`, `outcome`, `evidence`, `payload` for old rows; `currentItemOf` (`:244-251`, arithmetic-only) becomes kind-generic | K1, K2 |
| `db/schema/session-plan-helpers.ts` | `.slots ×4`, `GeneratedProblem ×3`, `SlotResult ×5` | s/d | plan-level helpers (`getNextSlot`, `isPartComplete`) move to arithmetic or onto the registry | K3 |
| `db/schema/legacy-try-fields.ts` | `SlotResult` | a | retype | K1 |
| `lib/curriculum/session-flow.ts` | `SlotResult ×3` (the row in `TRY_RECORDED`) | a | `StoredTry` | K1 |
| `lib/curriculum/session-planner.ts` | all seven | s/d | `recordSlotResult`/`recordRedoResult` → `recordTry` (K2); `generateSessionPlan` → composer host; `buildSessionPart`, constraints, `createSlot` → `parts/arithmetic/plan.ts` (K6); `batchGetRecentSessionResults` `partType ?? 'linear'` (`:1289`) → `mode` from evidence (K1) | K1, K2, K6 |
| `lib/curriculum/session-report.ts` | `part.type :680` | s | `presentation` via `presentationOf`; `TryRow.answer: unknown` (`:92`), `TryRow.outcome` | K1, K3 |
| `lib/curriculum/session-report-batch.ts` | `$.slots` SQL `:49-60` | s | kind-blind slim projection: arithmetic's slot slimming under `CASE WHEN kind IS NULL OR kind = 'arithmetic'`, `content` passed whole otherwise | K3 |
| `lib/curriculum/session-review.ts` | `SlotResult ×10` | a | `StoredTry`; `mark_correct` flips `isCorrect` as today | K1 |
| `lib/curriculum/try-weight.ts` | `SlotResult ×2` | a | retype | K1 |
| `lib/curriculum/read-tries.ts` | — | a | unchanged seam | — |
| `lib/curriculum/bkt/compute-bkt.ts` | `.skillsExercised :114`, `partType :153` | b | `evidence.skills`, `mode` | K1 |
| `lib/curriculum/bkt/evidence-query.ts` | SQL `:186-217`, `partType ?? 'linear' :154` | b | project `$.evidence`, `json_type(value,'$.evidence')`; `mode = evidence ? masteryModeOf(evidence.presentation) : legacy part map`; null mode → not evidence | K1 |
| `lib/curriculum/bkt/types.ts` | `SlotResult ×3`, `partType?: SessionPartType :37` | b | `mode?: string` | K1 |
| `lib/curriculum/skill-readiness.ts` | `.skillsExercised :81` | b | `evidence.skills` | K1 |
| `lib/curriculum/skill-metrics.ts` | `.skillsExercised :568` | b | `evidence.skills` | K1 |
| `lib/curriculum/linear-gate.ts` | `partType === 'linear' :91`, `.skillsExercised :118` | b/d | `mode === 'linear'`, `evidence.skills`; stays a linear (arithmetic) policy, moves to `parts/arithmetic/linear-gate.ts` | K1, K6 |
| `lib/curriculum/linear-readiness.ts`, `linear-readiness-service.ts`, `linear-entry-policy.ts` | `ProblemResultWithContext` | b/d | history rows retyped; the policy becomes arithmetic's `offer` input | K1, K6 |
| `lib/curriculum/part-gating.ts` | types | d | becomes arithmetic's offer eligibility (`parts/arithmetic/offer.ts`) | K6 |
| `lib/curriculum/skipped-parts.ts` | `part.type :22` | c | label from `describePart`/`Presentation.label`; reason text generic | K6 |
| `lib/curriculum/observer-report.ts` | `.slots :64`, `terms :83` | c | per-item rows from `items()` + `describe`/`TryCard` data | K5 |
| `lib/curriculum/progress-manager.ts` | `SlotResult ×7`, `.skillsExercised :566`, sentinel `:322-335` | a/b | sentinel row keeps shape (normalizer fixture); `skillsUsed` from `evidence.skills` | K1 |
| `lib/curriculum/server.ts` | `ProblemResultWithContext` re-export | a | retype | K1 |
| `lib/curriculum/problem-generator.ts` | `GeneratedProblem ×2` | d | arithmetic's; unchanged | — |
| `lib/curriculum/timing/{effective-time,pace-estimation,response-time-guard,review-types}.ts` | `SlotResult` | a | retype to the shared timing fields | K1 |
| `lib/mcp/tools.ts` | `.skillsExercised :542,624,630`, `part.type :817`, `.slots :818,822` | b/c/s | errors: `evidence.skills` + `describe`; plan summary: `items().length`, `describePart`; `start_practice_session` `enabledParts` → `enabled: Record<string, boolean>` (`:760-797`) | K1, K6 |
| `lib/session-song/extract-session-stats.ts` | eight patterns, `partType :557` | c | moments from `describe(part, item, try)` + shared help/timing fields; `usedOnScreenAbacus` becomes a kind-reported `help` tag | K5 |
| `lib/session-song/prompt-generator.ts` | `.studentAnswer ×2`, `partType :127` | c | from the describe lines and `presentation.label` | K5 |
| `lib/session-song/composition-plan-validation.ts` | `.studentAnswer` | c | validates against describe lines | K5 |
| `lib/song-share/sessionFacts.ts` | `.slots :56-59` | c | `items()` + `describe` | K5 |
| `lib/tasks/session-plan.ts` | `event.partType :68` | c | `presentation.label` | K6 |
| `lib/classroom/socket-events.ts` | `currentProblem :201`, `slotResults :226` | s | `PracticeStateEvent` carries `KindBroadcast`; `sessionParts`/`slotResults` stay the plan's content (P6b1-13) | K5 |
| `socket-server.ts` | `data.studentAnswer :1079` | s | `answerText` | K5 |
| `lib/vision/recording/VisionRecorder.ts` | `.studentAnswer ×5` | s | reads `answerText` | K5 |
| `lib/grading/processAttempt.ts`, `lib/tasks/worksheet-reparse.ts`, `lib/worksheet-parsing/parser.ts` | `.studentAnswer` (a parsed worksheet problem) | — | not a session reader | — |
| `lib/worksheet-parsing/session-converter.ts` | `SlotResult ×6`, `GeneratedProblem`, `partNumber?: 1\|2\|3 :16` | d | writes arithmetic tries (worksheet origin): emits the envelope with `payload.kind: 'arithmetic'`; lives under `parts/arithmetic/worksheet/` | K1 |
| `lib/seed/{create-student,helpers,problem-generation,types}.ts` | `SlotResult`, `GeneratedProblem` | d | seeds write arithmetic envelopes (fixture-tested by the normalizer) | K1 |
| `utils/problemGenerator.ts` | `GeneratedProblem ×16` | d | arithmetic's | — |
| `app/api/curriculum/[playerId]/sessions/plans/[planId]/route.ts` | `SlotResult ×3`, actions `:138-166` | s | `record`/`record_redo` → `recordTry` (legacy shape adapter); new `record_try`; 409 `unknown_kind` | K2 |
| `app/api/curriculum/[playerId]/route.ts` | `.skillsExercised :66` | b | `evidence.skills` | K1 |
| `app/api/curriculum/[playerId]/problem-history/route.ts` | returns raw history | c | returns normalized tries with `describe` lines | K1 |
| `app/api/curriculum/[playerId]/skills/metrics/route.ts`, `app/api/settings/bkt/aggregate/route.ts`, `app/api/classroom/[classroomId]/skills/leaderboard/route.ts` | `getRecentSessionResults` | b | retype | K1 |
| `app/api/curriculum/[playerId]/attachments/[attachmentId]/{approve,unapprove}/route.ts` | `SlotResult`, `.skillsExercised :155` | d | worksheet approval appends arithmetic envelopes via the machine (`WORKSHEET_APPROVED`) | K1 |
| `app/api/curriculum/[playerId]/attachments/[attachmentId]/review-progress/route.ts`, `app/api/worksheets/attempts/[attemptId]/route.ts`, `app/worksheets/attempts/[attemptId]/page.tsx` | `studentAnswer` (parsed problem) | — | not a session reader | — |
| `app/api/curriculum/[playerId]/offline-sessions/route.ts` | `part.type :59`, `partNumber as 1\|2\|3 :72` | d | writes arithmetic parts and envelopes; `partNumber: number` | K1, K3 |
| `app/api/debug/practice-session/route.ts` | `.slots :194`, `GeneratedProblem` | s | presets name `(kind, presentation)`; the slot rewrite becomes `kind.plan` with a fixed `rng` | K4 |
| `app/practice/[studentId]/PracticeClient.tsx` | `SlotResult ×2` | s | the shell's host; `handleAnswer`/`handleRecordRedo` (`:395, 526`) → one `submitTry` | K5 |
| `app/practice/[studentId]/summary/SummaryClient.tsx`, `session/[sessionId]/page.tsx`, `summary/page.tsx` | `SlotResult`, `getRecentSessionResults` | a/c | report already; history rows retyped | K1 |
| `app/practice/[studentId]/dashboard/DashboardClient.tsx`, `dashboard/page.tsx` | `.skillsExercised :393`, `.studentAnswer :1778` | b/c | `evidence.skills`; "Answered: …" from `TryCard`/describe | K1, K5 |
| `components/practice/ActiveSession.tsx` | `SlotResult ×6`, `usedOnScreenAbacus :1480` | s/d | split: shell to `components/practice/session/`, arithmetic views to `parts/arithmetic/browser/` | K5 |
| `components/practice/hooks/useInteractionPhase.ts` | `GeneratedProblem ×11` | s/d | generic `useTryLifecycle` (phases, pause, hidden time, tryId, timing); digit entry, prefix sums, disambiguation, help mode → `parts/arithmetic/browser/useDigitEntry.ts` | K5 |
| `components/practice/hooks/useProgressiveAssistance.ts` | `SlotResult ×2`, `generationTrace :466-508` | d | arithmetic's help machine; thresholds from shared timing fields | K5 |
| `components/practice/autoPauseCalculator.ts` | `SlotResult ×6`, `getComplexityCost :249-267` | a/d | timing stats on shared fields; complexity from `payload.problem` through arithmetic | K5 |
| `components/practice/redoReturnTarget.ts` | `SlotResult ×2` | s | generic do-over return (item refs) | K5 |
| `components/practice/RetryTransitionScreen.tsx` | — | d | arithmetic `Interlude` | K5 |
| `components/practice/{VerticalProblem,LinearProblem,PracticeFeedback,PracticeHelpOverlay,ProgressiveAssistanceUI,AssistanceDebugPanel,coachHintGenerator,ProblemDebugPanel,PurposeBadge}.tsx` | arithmetic views (`ProblemDebugPanel`: `GeneratedProblem`, `part.type`) | d | `parts/arithmetic/browser/` | K5 |
| `components/practice/{NumericKeypad,AbacusDock}.tsx`, `hooks/useDeviceDetection.ts` | — | shared device | `components/practice/input/` | K5 |
| `components/practice/PartTransitionScreen.tsx` | `part.type ×2`, imports `arithmeticTransitionView :15,52` | s | `describePart` via the registry; message pools from `presentation` through the browser kind | K5 |
| `components/practice/SessionProgressIndicator.tsx` | `.slots ×13`, `part.type ×6`, `SlotResult ×11`; gate-exempt (`session-view-import-gate.test.ts:30`) | s | one dot per `items()`; labels from `describePart`; exemption removed | K5 |
| `components/practice/{SessionPlanOverview,PracticeSubNav,PracticeTimingDisplay}.tsx` | `part.type`, `SlotResult` | s/c | report + `describePart` | K5 |
| `components/practice/{AllProblemsSection,BrowseModeView,LiveResultsPanel,MobileResultsSummary}.tsx` | `.studentAnswer`, `part.type`, `SlotResult`, `usedOnScreenAbacus` | c | `TryCard variant='browse'`; cells from `items()` + report | K5 |
| `components/practice/{AttemptHistoryPanel,DetailedProblemCard,AnnotatedProblem,ProblemToReview,ProblemsToReviewPanel,PhotoViewerEditor}.tsx` | `.studentAnswer`, `part.type`, `SlotResult` | c | `TryCard variant='history' \| 'review'`; `AnnotatedProblem` becomes arithmetic's card body | K5 |
| `components/practice/timing-review/FlaggedAttemptCard.tsx` | `.studentAnswer` | c | `TryCard` | K5 |
| `components/practice/{SessionHero,sessionSummaryUtils}.tsx` | `part.type :55-56` cast to `PracticeTypeId`, `formatProblemAsEquation :232` | c | presentation chips from the report's `presentation` + registry labels; equation text from `describe` | K5 |
| `components/practice/SkillsPanel.tsx` | `.skillsExercised :222` | b | `evidence.skills` | K1 |
| `components/practice/{PlanReview,PracticePreview}.tsx`, `start-practice-modal/StartButton.tsx` | `part.type` | c | `summary.parts[].label/emoji` | K6 |
| `components/practice/start-practice-modal/{PracticeModesSelector,MaxTermsSelector,LinearLockNote,LinearGraduationBanner}.tsx`, `StartPracticeModalContext.tsx` (`EnabledParts :80-84`) | three fixed keys | d→s | chips from the student's offers (`GET …/offers`); `enabled: Record<string, boolean>`; linear notes become arithmetic's offer `reason` text | K6 |
| `components/practice/{SkillProgressChart,StartPracticeModal}.tsx`, `contexts/BktContext.tsx`, `app/admin/bkt-settings/BktSettingsClient.tsx` | `ProblemResultWithContext` | b | retype | K1 |
| `components/classroom/SessionObserverModal.tsx` | `.slots :454`, `.studentAnswer :477-483, 1268-1329` | s/c | `ObserverView` via the browser registry; the abacus mirror is arithmetic's observer view | K5 |
| `components/practice/LiveSessionReportModal.tsx`, `hooks/useSessionObserver.ts`, `hooks/useSessionBroadcast.ts` (`:210-227`) | `.studentAnswer`, `SlotResult` | s | `KindBroadcast` | K5 |
| `components/debug/{BroadcastDebugPanel,ObserverDebugPanel}.tsx` | `.studentAnswer` | s | `answerText` | K5 |
| `hooks/useSessionPlan.ts` | `SlotResult ×3` (`:369, 874`) | s | one `useRecordTry` (`record_try`), legacy mutations kept one release | K2, K5 |
| `hooks/{useSessionTimeEstimate,useLiveSessionTimeEstimate}.ts` | `SlotResult`, `SessionPart` | a | report-driven already (5c); retype | K1 |
| `components/tutorial/PracticeProblemPlayer.tsx` | `GeneratedProblem ×4` | d | tutorial, arithmetic's; may import arithmetic's presentation views | — |
| `components/vision/ProblemVideoPlayer.tsx` | `.studentAnswer ×4` (DVR entries) | s | `answerText` | K5 |
| `components/worksheet-parsing/*.tsx` (6 files) | `.studentAnswer` (parsed problem) | — | not a session reader | — |
| `components/create/abacus/*.ts(x)` (4 files) | `.slots` (3-D model slots) | — | unrelated | — |
| `components/toys/number-line/talkToNumber/assembleChildProfile.ts`, `lib/curriculum/{session-mode,session-mode-comfort,skill-unlock}.ts` | `getRecentSessionResults` | b/d | retype; comfort and session mode consult only the three arithmetic modes by name (unchanged) | K1 |
| `test/fixtures/session-report.ts`, `test/journey-simulator/{JourneyRunner,SimulatedStudent}.ts` | fixtures | a | fixtures write envelopes; the simulator answers through `recordTry` | K1, K2 |
| `lib/curriculum/parts/arithmetic/ui.tsx` | imported by nothing (verified: zero importers) | d | deleted; replaced by `parts/arithmetic/browser.tsx` | K5 |

Counts: 103 grep hits = 11 false positives (worksheet parsing, abacus studio) + 92 practice files; plus 13 `ProblemResultWithContext` users and ~25 `getRecentSessionResults` callers (overlapping). Group b is one seam (`getRecentSessionResults` → normalized history rows with `mode`) plus the SQL projection; group c is six surfaces (history, review, browse, observer, MCP errors, song) behind two kind methods (`TryCard`, `describe`).

## 3. Storage and wire

### 3.1 What is written

- **Rows** stay in `session_plans.results` (`session-plans.ts:696`); no column changes in any phase of this plan. New fields on each try are JSON (D8): `itemId`, `outcome`, `answer`, `evidence`, `payload`. `isCorrect` keeps its name and is the server's verdict from K1 on.
- **`evidence`** is `{ skills, presentation }` or `null`. The mode is `masteryModeOf(presentation)` at read time (K2): the kind's `presentations.get(id).masteryMode`, or, for an id no registry knows, the id itself (its own mode: recorded, not consulted). Absent (old rows) → the normalizer derives `{ skills: skillsExercised, presentation: part.type ?? 'linear' }`, reproducing `bktModeOf`'s legacy default (`arithmetic/server.ts:102`, `evidence-query.ts:154`). SQL tells null from absent with `json_type(value, '$.evidence')` (`'null'` vs `NULL`).
- **`outcome`.** `handleSkip` records `studentAnswer: problem.answer, isCorrect: false, hadHelp: true` (`ActiveSession.tsx:1699-1707`); a judge would mark it right. A skip is `outcome: 'skipped', answer: null, isCorrect: false`. Old rows: `outcome = 'answered'` always (a skipped row is wrong either way; its stored answer is the correct one, so `TryCard` shows "skipped" when `hadHelp && helpTrigger === 'manual' && answer === problem.answer && !isCorrect` as a display heuristic only, never for counting).
- **`payload`** holds the kind's item snapshot so a row stands alone when the plan's content is slimmed or the kind is unknown to the image. Arithmetic: `{ kind: 'arithmetic', problem, usedOnScreenAbacus }`. Size: a `GeneratedProblem` with its `generationTrace` is what rows carry today (`SlotResult.problem`, `:261`), so nothing grows.
- **Parts.** Arithmetic parts keep `type, format, useAbacus, slots` at top level and gain `presentation` (= `type`). Another kind's part is `{ kind, partNumber, presentation, estimatedMinutes, content }`. `partNumber` widens to `number` (`:32`; `SlotResult.partNumber :258`; `GeneratedProblem.partNumber :164`; `session-planner.ts:584, 694, 767, 950`; `offline-sessions/route.ts:72`; `session-converter.ts:16`; `arithmetic/state.ts:184`).
- **`part_states`** encoding is unchanged (K4). A kind on the general contract stores whatever its `State` is, as today (`partStateOf`, `session-plan-normalize.ts:229-234`).
- **`summary.composition`** (K6): the composer's trace, additive on the `summary` JSON. `summary.parts[]` gains `kind`, `presentation`, `label`, `emoji`, `itemCount`; `type`/`problemCount`/`description` keep being written for arithmetic one release. `skippedParts[]` gains `kind`, `presentation`, `key`; `type` stays for arithmetic.

### 3.2 Normalizer fixtures (each a stored row or plan, replayed through `normalizeTries`/`normalizePlan` and the report)

Existing (session plan §5): three-part with retries and redos; legacy duplicate originals; offline; sentinel; worksheet; seed; pre-`slotId` residue; lagged `slotId`. Added here: (1) a K1 row (envelope + legacy copies) and the same try as a pre-K1 row → identical `Try`; (2) a post-K2 row with no legacy copies; (3) a skipped try, old shape and new shape; (4) `evidence: null` beside `evidence` absent; (5) a part of an unknown kind with tries whose `payload.kind` names it (the report counts them, `TryCard` falls back to `describe` text stored? no: to "a try" with the verdict; MCP shows the verdict and time); (6) a flash-anzan row (`evidence.presentation: 'flash_anzan'`) read by an image that resolves it to its own mode; (7) a read-abacus part and rows; (8) a `summary` without `composition` and one with it.

### 3.3 The wire, both directions (D9)

| Release | Server accepts | New bundle sends | Old bundle sends | Rollback target reads |
|---|---|---|---|---|
| K1 | `record`/`record_redo` with the legacy body; stores envelope + legacy copies | unchanged | unchanged | pre-K1 image ignores the new JSON fields; rows carry the legacy copies, so every pre-K1 reader works |
| K2 | the above, plus the envelope on `record`/`record_redo`, plus `record_try` | **superset body** on `record`/`record_redo` (legacy fields + `itemId`, `outcome`, `answer`, `payload`, `clientVerdict`) | legacy body | K1 image: ignores the envelope fields of the superset body, records from the legacy fields; identical row |
| K3 | the above | unchanged | unchanged | K2 image reads arithmetic parts (unchanged shape) and `part_states` (unchanged encoding) |
| K4 | the above | `record_try` with the envelope only (one release after K2) | superset body (K2 bundle) or legacy body | K3 image has `record_try` |
| K5 | the above; **legacy top-level copies no longer written** (one release after K2 made every reader envelope-first) | unchanged | K4 bundle (envelope) | K4 image reads the envelope |
| K6 | `enabled: Record<string, boolean>` and the three legacy `enabledParts` keys (same keys) | `enabled` | `enabledParts` | K5 image reads `enabledParts`; the new bundle's `enabled` has the same three keys |
| K7/K8 | new presentation / kind behind flags | — | an old bundle shown a part of an unknown kind crashes in `getCurrentProblemInfo` (`arithmetic/state.ts:165-170` reads `part.slots`) | the flag is turned on only after the deploy has settled (open tabs reloaded); a rollback target is K3+ (string `type`, registry fallbacks) |

The `record`/`record_redo` actions and the legacy-shape adapter stay until the owner retires them (§7 Q6); the adapter is ~40 lines in `record-try.ts`.

### 3.4 Ledger mapping (`attempt.answered`, `L/docs/practice-ledger-plan-of-record.md:79`; event table `:55-70`)

| Envelope | Ledger payload | Note |
|---|---|---|
| `tryId` | event `id`; dedupe `attempt:<planId>:try:<tryId>` | session plan §6 B4 |
| `itemId`, `partNumber`, `partIndex` | `slotId`, `partNumber`, `slotIndex` | `slotIndex` = `items(content).findIndex(itemId)` |
| `outcome`, `answer` | `outcome: answered \| timeout \| skipped`, `studentAnswer` | the ledger already has `outcome`; `studentAnswer: number \| null` widens to `unknown` |
| `isCorrect` | **stored** for every kind | the ledger plan folds `studentAnswer === problem.answer` (`L/…/folds/attempts.ts`); for a non-arithmetic kind that is `kind.judge`. Rebase item already noted in session plan §6; this plan makes the stored verdict the rule for every kind, arithmetic included, so one fold rule |
| `evidence.presentation` | `presentation.layer`; `presentation.{modality,input,abacusAvailable,format,pacing}` from `Presentation.axes` | "per-mode BKT replay keys on `layer`" (`:79`): the layer → mode mapping is the same read-time `masteryModeOf` |
| `evidence.skills` | `problem.skillsRequired` for arithmetic; generally a `skills: string[]` on the payload | `evidenceOf` |
| `payload` | `problem { terms, answer, skillsRequired, classifierVersion, generationTrace }` for arithmetic; a kind-keyed `item` object otherwise | the ledger's `problem` is arithmetic's payload |
| `kind`/`round`/`practiceOnly`/`masteryWeight` | `retry { epoch, ofSlotId }`, `manualRedo`, `practiceOnly`, `recordedMasteryWeight` | unchanged from session plan §6 |
| `summary.composition` | `plan.decided` payload (`:96`) | the composer's trace is that event's body |

## 4. Phases

Each phase is one squashable PR (K1 and K5 are two each, named), lands behaviour-identical unless the row says otherwise, keeps old sessions rendering, and is safe to roll back one release. Gates for every phase: `npx tsc` on changed code; the tests that reach it (`vi.mock('@/db')` or `EphemeralDatabase`); the golden replay (`src/test/part-kind-golden-replay.test.ts`; re-recorded only where a row says, with the diff in the PR); e2e `session-report-views` + `retry-redo-attribution` on a prod build; `seed-script-bundles.test.ts` when a phase adds an import to a module scripts reach; `npx @biomejs/biome check <files>` on changed files only.

Order and why it differs from the brief's list: the kit's server half (K4) lands **before** the browser split (K5) so the conformance suite guards the riskiest refactor, and the composer (K6) is independent of the browser and can run in parallel with K5 (disjoint files). The two proofs follow because flash anzan needs the composer to be chosen and the shell to be drawn.

### K1 — Envelope, server judge, evidence, readers (two PRs: K1a server, K1b readers)

- **Scope (K1a).** `StoredTry` fields on `SlotResult`; `recordSlotResult`/`recordRedoResult` stamp `itemId`, `outcome` (`'answered'`; skips arrive as legacy bodies and are detected as `hadHelp && helpTrigger === 'manual' && studentAnswer === problem.answer && !isCorrect` **only here, in the legacy adapter**, the one place the heuristic lives), `answer`, `isCorrect = judge(...)` (parity with the client verdict logged on disagreement), `evidence = evidenceOf(...)`, `payload`; legacy copies still written. `PartKind` gains `evidenceOf` (arithmetic: `{ skills: problem.skillsRequired, presentation: part.type }`) and `describe` (arithmetic: `formatProblemExpression`-style line, moved from `extract-session-stats.ts:314`). Normalizer derives the four fields for old rows. `recordSkillAttemptsWithHelp` takes `evidence.skills` (`session-planner.ts:1707-1713, 1920-1925`).
- **Scope (K1b).** Group-b readers (§2): `getRecentSessionResults`/`batchGetRecentSessionResults` return `HistoryTry = Try & { sessionId; sessionCompletedAt; presentation; mode: string | null }`, `mode` from `masteryModeOf(evidence.presentation)`; `partType ?? 'linear'` (`:1289`) is gone; `compute-bkt.ts:153` keys modes by `mode`; `bkt/types.ts:37`; `linear-gate.ts:91` `mode === 'linear'`; `skill-readiness.ts:81`, `skill-metrics.ts:568`, `DashboardClient.tsx:393`, `SkillsPanel.tsx:222`, `[playerId]/route.ts:66`, `progress-manager.ts:566`, MCP `:542-630` read `evidence.skills`; the SQL projection (`evidence-query.ts:186-217`) adds `$.evidence` and `json_type`; `toBktEvidence` resolves the mode and drops `evidence: null` rows. Shared-field retypes (group a) ride along.
- **Files.** K1a: `db/schema/session-plans.ts`, `db/schema/session-plan-normalize.ts`, `lib/curriculum/parts/kind.ts`, `parts/arithmetic/{server,describe}.ts`, `lib/curriculum/session-planner.ts` (recorders only), `lib/worksheet-parsing/session-converter.ts`, `lib/seed/helpers.ts`, `attachments/.../approve/route.ts`, `offline-sessions/route.ts`, `test/fixtures/session-report.ts`. K1b: the group-a/b files in §2 marked K1, `lib/curriculum/parts/presentations.ts` (`masteryModeOf`).
- **Acceptance.** Judge parity: every scenario of the golden replay stores the same `isCorrect` (snapshot re-recorded with only the four additive fields differing; the diff is the PR's evidence). BKT parity: `computeBktFromHistory` over every seeded profile (`lib/seed/profiles.ts`) gives identical pKnown, classification, readiness and linear-gate verdicts before and after (the Phase 1w table's harness, `src/test/legacy-try-readers.test.ts` pattern); the SQL path and the in-JS path agree on a fixture with K1 rows, pre-K1 rows and `evidence: null` rows. Normalizer fixtures (1), (3), (4). A row whose part has no `type` and no `evidence` resolves to `linear` as today. A part of another kind with `evidence` stamped is not labelled `linear` (the `:1289` bug, tested).
- **Rollback.** Pre-K1 image ignores the new fields; the legacy copies make every pre-K1 reader whole. **Rollout window.** None: no behaviour changes.
- **Owner hand test.** A session with a skip, a wrong, a retry, a do-over; the summary, dashboard and skills tab read as before.

### K2 — One recorder

- **Scope.** `lib/curriculum/record-try.ts`: `recordTry` (§1.3) with `normalizeSubmission` (legacy body → `TrySubmission`, content-matching retained from `session-planner.ts:1566-1575` for bodies without `itemId`), `match` on the contract with the shared default (`expectedItem` id equality; `acceptsDoOver` for a do-over), `UnknownKindError` → 409 `unknown_kind` (today `partKindOf` throws → 500, `registry.ts:30-34`), the divulged-answer rule (`:1853-1868`) moved into arithmetic's `acceptsDoOver`. Route: `record` and `record_redo` call `recordTry`; new action `record_try`. `recordSlotResult`/`recordRedoResult` deleted; the GBTRACE logs keep their names and read position through `describe`/`progress`. Client: `useRecordSlotResult`/`useRecordRedoResult` send the superset body (§3.3); `useRecordTry` added, unused until K4.
- **Files.** `lib/curriculum/record-try.ts` (new), `session-planner.ts` (deletions, re-exports of the error classes), `plans/[planId]/route.ts`, `lib/curriculum/parts/kind.ts` (`match`), `parts/arithmetic/server.ts`, `hooks/useSessionPlan.ts`, `components/practice/ActiveSession.tsx` (body only), `test/journey-simulator/JourneyRunner.ts`.
- **Acceptance.** Golden replay unchanged (it drives `recordSlotResult`/`recordRedoResult` today; it is repointed at `recordTry` with the legacy bodies and must reproduce the snapshot byte for byte). `retry-redo-attribution.test.ts` passes unchanged. New: the superset body and the legacy body for the same try give identical rows; a `record_try` for a part of kind `'zzz'` is 409 `unknown_kind`, the row unchanged, the session still `in_progress` and endable; a duplicate `tryId` across the two action names is one row; four concurrent `recordTry` on one row: one wins per CAS round, no lost write (the `session-row-version.test.ts` walk).
- **Rollback.** K1 image: both actions exist, legacy body understood; the superset body's extra fields are dropped by `withoutServerStamps`-style destructuring (verified: `:1409-1428` passes `...rest` through, so unknown fields would be **stored**; K2's K1-targeted rollback therefore stores `itemId/outcome/answer/payload` verbatim from the client, which are the same values the server would compute. Acceptable; noted.) **Rollout window.** Old pod + new pod both record from the same bodies; identical rows.
- **Owner hand test.** Same as K1 on the new recorder; double-tap submit; a do-over of a right answer.

### K3 — Contract widening, shared cursor, kind-blind structure

- **Scope.** `PartKind` gains `presentations`, `items`, `itemOf`, `describePart`, `presentationOf → Presentation`; `bktMode` retired (`masteryModeOf` through the presentation). `StoredPart` union; `partNumber: number` everywhere in §3.1. `parts/cursor/retry-rounds.ts` extracted from `arithmetic/state.ts`; `arithmeticKind` composed from it with `snapshot` adding `problem`/`originalPurpose` to queued retry items (rollback images read `item.problem`, `state.ts:139`). Structure made kind-blind: `session-report.ts:680` `type` → `presentation`; `session-report-batch.ts:43-69` slim projection by kind; `session-plan-normalize.ts:244-251` `currentItemOf` through the registry; `plannedItemCount` from `items()`; `partStateOf` unchanged. `arithmetic/presentations.ts` registers `abacus`, `visualization`, `linear` with their `masteryMode` and axes (today's `presentationOf`, `arithmetic/server.ts:92-98`).
- **Files.** `lib/curriculum/parts/{kind,registry,presentations}.ts`, `parts/cursor/retry-rounds.ts`, `parts/arithmetic/{server,state,presentations,report}.ts`, `db/schema/session-plans.ts`, `session-plan-normalize.ts`, `session-plan-helpers.ts`, `session-report.ts`, `session-report-batch.ts`, `bkt/evidence-query.ts` (mode via presentation), the `partNumber` cast sites.
- **Acceptance.** Golden replay unchanged (stored `part_states` byte-identical; `arithmetic-kind.test.ts` and a new `retry-rounds.test.ts` cover the cursor on a non-arithmetic item type). `stub-kind.test.ts`'s `SLOT_WORDS` gate (`:18`) extended to `parts/cursor/` and `parts/presentations.ts`. Report snapshot (`tenProblemSessionReport()`) identical except `type` → `presentation` with the same values. Slim projection: a plan with an arithmetic part and a stub `read_abacus` part lists both with the right `plannedProblems`. Normalizer fixtures (5), (7).
- **Rollback.** K2 image reads arithmetic parts (unchanged) and `part_states` (unchanged); a `presentation` field on a part is ignored. **Rollout window.** None.
- **Owner hand test.** A three-part session with breaks, do-overs across parts; the summary's part chips read as before.

### K4 — The kit, server half, and the dev route

- **Scope.** `src/test/kind-conformance/` : `conformanceSuite(kind, fixtures)` run on `EphemeralDatabase` through `recordTry`, `applyFlowEvent`, `buildSessionReport`, `normalizeTries`: a duplicate `tryId` is recorded once; wrong → retry → right (first-try accuracy, fixed-in-retries, final verdict); a do-over of a wrong item and of a right item, in the part and after it (round, `practiceOnly`, weight, redemption through `applyTryAside`); the report's numbers for a fixed try script; old rows normalize (the kind supplies a legacy-shaped row or declares none); an unknown kind after a rollback (the registry without the kind: report 0/0, `isPartPlayable` true, `record_try` 409, end-early works). Arithmetic and the stub `read_abacus` fixture (`parts/__tests__/fixtures/read-abacus-kind.ts`) both run it. Import gates: `session-view-import-gate.test.ts` gains `GATED_NAMES` `problem`, `studentAnswer`, `skillsExercised`, `usedOnScreenAbacus`, `terms` for `components/practice/session/`, `lib/curriculum/{session-flow,session-report,record-try,compose}` and `app/api/curriculum`; a new gate asserts no file outside `parts/<kind>/` imports from `parts/<kind>/` except the two registries; `parts/*/server.ts` imports no `.tsx` and no `@/db` (the seed-bundle hazard). Dev route: `app/api/debug/practice-session` presets name `(kind, presentation)` and a new `?kind=&presentation=` builds a one-part plan through `kind.plan` with a fixed `rng` (the `:190-194` slot rewrite becomes that). Client switches to `record_try` (§3.3).
- **Files.** `src/test/kind-conformance/*`, `src/test/session-view-import-gate.test.ts`, `src/test/kind-folder-gate.test.ts` (new), `app/api/debug/practice-session/route.ts`, `hooks/useSessionPlan.ts`, `components/practice/ActiveSession.tsx` (action name only).
- **Acceptance.** The suite passes for arithmetic and the stub; it fails when a kind's `applyTry` ignores a do-over redemption (mutation test in the PR). The gates fail on a planted import.
- **Rollback.** K3 image has `record_try`. **Owner hand test.** `?preset=minimal` still works; `?kind=arithmetic&presentation=linear` starts a one-part linear session.

### K5 — Browser shell split (two PRs: K5a shell + arithmetic views, K5b readers c and observer)

- **Scope (K5a).** `components/practice/session/`: `SessionShell` (props: `plan`, `report`, `student`, the teacher/pause requests, `onEndEarly`; owns `useTryLifecycle`, the submit path to `useRecordTry`, optimistic advance by running the kind's pure cursor locally (`applyTry` + `expectedItem` on the plan's content and state) under today's condition (same part, next item exists, no interlude; `ActiveSession.tsx:1516-1525`), feedback timing (`:1551`, UI pacing, kept), do-over (`ActiveRedo`), browse, broadcast skeleton, resync), `useTryLifecycle` (the generic phases of `useInteractionPhase.ts:106-126` minus `awaitingDisambiguation`/`helpMode`, which become states inside arithmetic's presentation; pause accounting `:235`, hidden-time fold `:270`, tryId mint, timing guard). `parts/arithmetic/browser/`: `ItemView` dispatching on presentation (`VerticalProblem`/`LinearProblem` + `useDigitEntry` with prefix sums, disambiguation, help mode, `useProgressiveAssistance`, `DecompositionSection`, vision capture `:1467`), `ObserverView`, `TryCard` (`AnnotatedProblem` body), `Interlude` (`RetryTransitionScreen`), `broadcastOf`. `parts/browser-registry.ts`. `PracticeClient` renders `SessionShell`; `ActiveSession.tsx`, `useInteractionPhase.ts`, `parts/arithmetic/ui.tsx` deleted. Shared devices to `components/practice/input/`.
- **Scope (K5b).** Group-c and the remaining s readers in §2 marked K5: `PartTransitionScreen` via `describePart`; dots from `items()` (exemption removed); `SessionObserverModal`, `useSessionBroadcast`, `socket-events.ts`, `VisionRecorder`, `ProblemVideoPlayer`, debug panels on `KindBroadcast`; history/review/browse panels on `TryCard`; song and share on `describe`; `SessionHero` chips from `presentation`.
- **Files.** As §2. K5a and K5b are disjoint (K5b never touches `components/practice/session/` or `parts/arithmetic/browser/`).
- **Acceptance.** e2e `retry-redo-attribution` and `session-report-views` unchanged; `practice-help-disambiguation.spec.ts` unchanged (the 4 s `AMBIGUOUS_HELP_DELAY_MS`, `useInteractionPhase.ts:146`, is arithmetic's, kept inside its presentation); `useInteractionPhase.test.ts` split into `useTryLifecycle.test.ts` + `useDigitEntry.test.ts` with every case kept; broadcast/observer tests on `KindBroadcast`; Storybook stories for arithmetic's `ItemView` × 3 presentations, `ObserverView`, `TryCard`, `Interlude` (the sandbox's browser half); the import gate passes with the exemption removed.
- **Rollback.** Client-only; the wire is unchanged. **Rollout window.** None.
- **Owner hand test.** Full session on a phone and a laptop: keypad, abacus dock, help, skip, pause, teacher pause from the observer, do-over from a dot, browse, end early; the observer mirrors digits.

### K6 — Composer and offers (two PRs: K6a server, K6b modal)

- **Scope (K6a).** `lib/curriculum/compose/{compose,policy,trace}.ts`; `generateSessionPlan` becomes the host: loads the `OfferContext` (today's loads, `session-planner.ts:293-308` plus BKT/comfort), gathers `offer()` from every registered kind, `compose()`, then `kind.plan()` per spec, writes `summary.composition`. Arithmetic's `offer` absorbs `resolveEnabledPartTypes` (`part-gating.ts`), the linear readiness explanation and the ramp (`:461-487, 676`), comfort by mode, constraints by presentation (`:641-650`); its `plan` absorbs `buildSessionPart`/`buildSessionPartAsync`, `createSlot`, `intelligentShuffle`, term counts (`:766-1110, 949, 2172-2540`) into `parts/arithmetic/plan.ts`. `partNumber` 1..n. Flag `practice_composer` config → `ComposerPolicy` (default reproduces today). MCP `start_practice_session` takes `enabled` (`tools.ts:760-797`). New `GET /api/curriculum/[playerId]/offers` returns the student's offers (eligibility, reasons, labels) for the modal and MCP.
- **Scope (K6b).** The start-practice modal renders chips from `/offers` grouped by kind; `EnabledParts` → `enabled: Record<string, boolean>` (`StartPracticeModalContext.tsx:80-84`); `LinearLockNote`/`LinearGraduationBanner` text from the linear offer's `reason`; `StartButton`, `PlanReview`, `PracticePreview`, `skipped-parts.ts` from `summary.parts[].label`. Per-student preferences store `enabled` by key (today's three keys unchanged; a new key defaults off, §7 Q2).
- **Acceptance.** **Golden plan:** for every seeded profile × each of the 7 non-empty `enabledParts` subsets × `linear_readiness.enabled` on/off, with `Math.random` mocked by `SeededRandom` (`session-targeting-trace.test.ts:87-93`), the composed plan's structure (parts' kind, presentation, order, `estimatedMinutes`, slot count, per-slot `purpose`/`constraints`/`complexityBounds`, `useAbacus`, `skippedParts`, `summary`) equals a snapshot recorded from `generateSessionPlan` at `c12abd87f` before K6 lands, byte for byte; a difference is a behaviour change and needs its own decision. `compose()` unit tests: weights normalize, minutes sum to the request, `NoEligiblePartsError` when nothing is kept, the trace names every offer. `/offers` for a seeded profile matches the modal's locks today.
- **Rollback.** K5 image reads `enabledParts` (same keys) and ignores `summary.composition`; plans it wrote have no `presentation` on parts, which K6 derives. **Rollout window.** None for today's settings.
- **Owner hand test.** The modal looks the same for an existing student; the plan is the same; the summary shows the same parts; MCP `start_practice_session` works with and without `enabled`.

### K7 — Proof 1: flash anzan (a presentation of arithmetic)

- **Scope.** Folder `parts/arithmetic/presentations/flash-anzan/` + one line in `parts/arithmetic/presentations.ts` + one line in `parts/arithmetic/browser.tsx`. Flag `practice_kinds.flash_anzan` (default off) gates the offer's eligibility. §5.1 specifies it.
- **Acceptance.** The conformance suite for arithmetic passes with the presentation added and a flash-anzan fixture plan; the folder gate shows no edit outside the folder and the two lines (the PR's file list is the proof); e2e: a one-part flash-anzan session via the dev route completes, the report, summary, share link, observer and MCP show it with the presentation's label; a rollback to K6 renders the session's summary (unknown presentation → own mode, label falls back to the id).
- **Owner hand test.** Turn the flag on for one student; a session with abacus → flash anzan → linear, two breaks, a song.

### K8 — Proof 2: Read the abacus (a kind)

- **Scope.** Folder `parts/read-abacus/` + one line in `parts/registry.ts` + one line in `parts/browser-registry.ts`. Flag `practice_kinds.read_abacus`. §5.2 specifies it.
- **Acceptance.** As K7, with the kind's own conformance run and legacy-row fixture declared `none`; a plan of arithmetic + read_abacus + arithmetic with breaks; every view handles it; an image without the kind (K7) handles a session containing it safely (409 on record, report 0/0 for that part, end early works).
- **Owner hand test.** A mixed session on the kid's screen; the observer shows the bead picture; the summary lists the part.

## 5. The two proofs

### 5.1 Flash anzan (arithmetic, presentation `flash_anzan`)

- **Presentation.** `{ id: 'flash_anzan', label: 'Flash', emoji: '⚡', masteryMode: 'flash_anzan', axes: { layer: 'flash_anzan', modality: 'visual', input: 'keypad', abacusAvailable: false, format: 'flash', pacing: { perTermMs } }, needsPhysicalAbacus: () => false }`.
- **Offer.** Eligible iff the flag is on and `hasVisualSkills` (the visualization gate); `key: 'flash_anzan'`, default `enabled` false (§7 Q2); `weight` = `partTimeWeights.visualization`; `planInput` = `visualConstraints` with the comfort for mode `visualization` and `pacing.perTermMs` from a per-student preference (default 1,500 ms; a flag-config default).
- **Plan.** Arithmetic's `plan()` unchanged: slots of generated problems; the part stores `presentation: 'flash_anzan'`, `type: 'flash_anzan'` (string), `format: 'vertical'`, `useAbacus: false`, `pacing` on the part.
- **Item view.** Shows one term at a time at `perTermMs`, then the keypad; `channel.submit({ payload: { usedOnScreenAbacus: false, pacing, termsRevealedAtMs } })`. Paused mid-flash: on resume the sequence replays from the first term; `payload.replays` counts it (§7 Q4). A retry (round 1–2) replays the flash; the answer is divulged after round 2 as for every arithmetic presentation (the cursor is shared, nothing to add).
- **Judge.** Arithmetic's: `answer === problem.answer`.
- **Evidence.** `{ skills: problem.skillsRequired, presentation: 'flash_anzan' }` → mode `flash_anzan`: in `byMode`, on the dashboard's per-mode chart, consulted by nothing. Changing §7 Q1 to "counts toward visualization" is `masteryMode: 'visualization'` on this one object.
- **Observer.** `broadcastOf` sends the whole problem plus the index of the term showing; the observer's `ObserverView` draws the same flash in step.
- **Transition.** `describePart` → `{ label: 'Flash', emoji: '⚡', needsPhysicalAbacus: false }`; abacus put-away after an abacus part comes from the shell's existing rule (`PartTransitionScreen.tsx:121-123`).
- **Must not touch.** The flow machine, `record-try.ts`, `session-report*.ts`, the normalizer, `components/practice/session/`, `PartTransitionScreen`, the observer modal, summary, share, OG, lists, MCP, song, the modal (chips come from `/offers`). If any of these needs a line, §8 gets an entry first.

### 5.2 Read the abacus (kind `read_abacus`)

- **Content.** `{ items: { itemId, columns: number, beads: number[] (per-column value 0–9), value: number, skills: string[] }[] }`. `items()` in order. Generated at plan time from the student's working range (columns = digits of the largest answer in the skill mastery's practising set; one presentation `static`).
- **Presentation.** `{ id: 'static', label: 'Read the abacus', emoji: '👀', masteryMode: 'read_abacus', axes: { layer: 'read_abacus', modality: 'visual', input: 'keypad', abacusAvailable: false } }`.
- **Offer.** Eligible iff the flag is on; `key: 'read_abacus'`, default off; `weight` 1 (configurable); `minMinutes` 2; `planInput` = the range.
- **Cursor.** `retryRoundsCursor(c => c.items)`: two retry rounds, redemption, do-overs, practice-only, all shared.
- **Match.** The shared default. **Judge.** `answer === item.value`. **Evidence.** `{ skills: item.skills, presentation: 'static' }` with `skills` = place-value tags (`place.ones`, `place.tens`, …), a vocabulary no BKT reader consults (own mode); `null` would also be a correct choice and is one line (§7 Q5).
- **Item view.** `@soroban/abacus-react` drawing the beads read-only; `NumericKeypad` from the shared devices; feedback shows the value. **Observer.** The same picture and the typed digits. **TryCard.** Picture thumbnail + "you said N". **Describe.** `read 1,247 as 1,274`.
- **Transition.** `{ label: 'Read the abacus', emoji: '👀', needsPhysicalAbacus: false }`.
- **Legacy rows.** None (conformance fixture declares `legacy: 'none'`).
- **Must not touch.** As §5.1, plus `parts/arithmetic/` anything.

Both proofs are the test of decisions K1–K11: each PR's file list is its evidence, and the folder gate (K4) keeps it so.

## 6. Risks and unknowns

1. **`useInteractionPhase` resists the split.** `helpMode` and `awaitingDisambiguation` are phases of the one machine (`:106-126`), and `handleSubmit` reads `phase.phase === 'helpMode'` for `usedOnScreenAbacus` (`ActiveSession.tsx:1480`) and enters help from submit on a prefix-sum match (`:1418-1422`). The split makes them states of arithmetic's `useDigitEntry` beneath a generic `answering` phase; the shell's `AnswerChannel.submit(extra)` carries what help did. Risk: the twelve `showX` predicates (`useInteractionPhase.ts:490-506`) are consumed across `ActiveSession`; the test file's cases are the safety net, kept one for one.
2. **Optimistic advance** today knows the next slot (`:1516-1521`). The shell predicts with the kind's pure cursor; a kind whose `applyTry` is not pure in the browser bundle (none planned) would break it. The conformance suite runs `applyTry` without a DB, which proves purity.
3. **Server judge vs client verdict.** Any disagreement is logged (`clientVerdict`); a disagreement that persists is an arithmetic bug surfaced, not a plan problem. The e2e specs assert on the server's rows.
4. **Skips.** The heuristic in §3.1 is for display and for the K1 legacy adapter only; the K4 bundle sends `outcome: 'skipped'`. If an old bundle skips during the K1–K3 window, the row is right (`isCorrect: false`) because the adapter detects it; the K2 rollback-target note applies.
5. **Shared cursor encoding.** Keeping `slotIndex`/`redeemedSlots` names inside `parts/cursor/` is a vocabulary leak the gate must exempt explicitly (`stub-kind.test.ts:18` `SLOT_WORDS` applied to `kind.ts` only; the cursor file gets its own list without `slot`). Renaming later is a normalizer + one release; not scheduled.
6. **Slim parts SQL** (`session-report-batch.ts`) passes a non-arithmetic part's `content` whole; a kind with large content would slow list pages. Budget: the conformance suite asserts a 20-item part's content under 16 KB; a kind that needs more adds its own slimming rule to the projection (one `CASE` arm) and §8 records it.
7. **`PracticeTypeId` is a closed union** (`constants/practiceTypes.ts:51`) used by `SessionPartType`, `PartSummary.type`, `SessionHero` (`:55-56` cast), `getPartTypeEmoji`. K3 widens `SessionPart.type` to `string`; readers that index `PRACTICE_TYPES` by it fall back to the registry's `Presentation.label/emoji`. A missed reader shows "⭐ Next part" (the fallback at `PartTransitionScreen.tsx:53`), not a crash; the K7 e2e run is the sweep.
8. **Observer abacus mirror** parses the broadcast's `studentAnswer` string (`SessionObserverModal.tsx:477-483`); `answerText` keeps it working for arithmetic and is meaningless for a kind whose answer is not a number; the kind's `ObserverView` decides.
9. **Old bundle meets a new kind** (§3.3 K7/K8 row): crash in `getCurrentProblemInfo`. Mitigation is procedural (flag on after the deploy settles). A "new version, reload" prompt would remove the class of problem; it is not in this plan (session plan status block notes the app has none).
10. **The modal (K6b)** is the largest UI change outside the shell; chips from `/offers` must look identical for the three keys. Storybook stories against a fixture offers list; the `start-practice-modal.spec.ts` e2e.
11. **`getRecentSessionResults` has ~25 callers** returning raw rows typed `ProblemResultWithContext extends SlotResult`. K1b changes the return type; `tsc` finds every reader, which is the point; the risk is volume, not subtlety.
12. **Song prompt and validator** read `studentAnswers` and `partType` (`extract-session-stats.ts:461, 557`; `prompt-generator.ts:127`; `composition-plan-validation.ts`). `describe` lines replace them; `session-song-report.test.ts` and `composition-plan-validation.test.ts` pin the prompt text.
13. **Journey simulator** answers through the recorders (`JourneyRunner.ts`); K2 repoints it; the BKT validation snapshots (`journey-simulator/__snapshots__`) must not move.
14. **Not a race, a note:** the write queue (`PracticeClient.tsx:361-377`) and the 503 resend rule are unchanged; no new timer, poll or sleep anywhere in this plan. The two existing UI timers (feedback 500/1500 ms, help delay 4 s) are pacing, kept where they are.

## 7. Open questions for the owner (each with a recommendation)

1. **Should flash anzan count toward visualization?** Recommendation: not yet. Give it its own mode (`flash_anzan`) for the first sessions, look at the per-mode chart beside visualization, then decide; the change is one line (`masteryMode`) and applies to history with no backfill.
2. **Are new offers on by default for existing students?** Recommendation: off. The adult turns a chip on per student; today's plans stay identical, and the first flash-anzan or read-the-abacus session is a deliberate choice.
3. **How should the start modal show offers?** Recommendation: one flat row of chips grouped under small kind headings (Arithmetic: Abacus, Visualize, Linear, Flash; Read the abacus), with an ineligible chip greyed and its reason on tap, replacing the two linear notes with the same words.
4. **Flash anzan interrupted by a pause.** Recommendation: resume replays the whole sequence; the try records `replays`; nothing else changes (its own mode means no mastery effect to argue about).
5. **Read the abacus evidence.** Recommendation: record place-value skill tags under its own mode rather than `null`, so the data exists when a readiness rule for reading is wanted; nothing consults them until then.
6. **Retiring the legacy wire** (`record`/`record_redo`, the top-level arithmetic copies, `enabledParts`). Recommendation: as scheduled, one release after each replacement, so a rollback is always safe; if you prefer to shorten it as on 2026-11-27, say so per phase and the cost is the same as then (an open tab until it reloads).
7. **Composer policy defaults.** Recommendation: `minPartMinutes: 2`, `maxParts: null`, `order: 'offered'`; tune through the `practice_composer` flag config without a deploy, as the linear entry policy is tuned today.
8. **Do retry rounds and do-overs apply to every presentation identically?** Recommendation: yes; the shared cursor is the point. A kind that wants no retries (facts drills, later) uses the general contract or `maxRounds: 0`.

## 8. Review log

(empty; for the reviewer)
