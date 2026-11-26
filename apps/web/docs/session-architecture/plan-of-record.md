# Session architecture: plan of record (2026-11-26)

Companion to [findings.md](./findings.md), which holds the owner's decisions and the fact base. This document settles the target model, the contracts and the phases. Paths are under `apps/web/src/`. Every claim about today's code below was re-read in the worktree at `6423f579b` unless marked *reported*.

Assumed landed first: `fix/retry-redo-attribution` (one shared "current item" function skipping redeemed retries, used by `getCurrentProblemInfo` and `recordSlotResult`; server advances when do-overs redeem every remaining retry; duplicate `slotId` = no-op, mismatch = 409). This plan builds on it and does not restate it.

## 0. Decisions in one screen

| # | Decision | Why |
|---|---|---|
| D1 | A session is `part, (break, part)*, end`. The **flow machine** (`session-flow.ts`) is the only writer of `flowState`, `currentPartIndex`, `breaks`, `status`, `completedAt`. Every write to the row is a compare-and-set on `flowVersion`, renamed in meaning to "row version". | Today `recordSlotResult` decides end-of-part, end-of-session and the next flow state outside the machine and writes unconditionally (`session-planner.ts:1537-1566`). |
| D2 | A **part kind** is a TypeScript module behind one interface (`PartKind`). The structure sees `partState: unknown`, `expectedItem()`, `applyTry()`, `isDone()`. Slots, retry rounds and do-overs live inside `arithmeticKind`. | Owner: architecture before diversity. |
| D3 | A **try** is the atom: client-generated `tryId`, `itemId`, `kind: first \| retry \| do_over`, `round`. Stored in the existing `results` JSON (`SlotResult` gains fields; legacy fields stay readable). Weights come from one helper, `weightOfTry`, used by BKT, the report and the ledger adapter; the client never sends a weight. | Owner: every try recorded with its own id; readers decide weight. Keeps BKT's SQL reader (`bkt/evidence-query.ts:139` `json_extract('$.masteryWeight')`) working: the server stamps `masteryWeight = weightOfTry(...)` as a cache of the helper. |
| D4 | **Breaks are a list** (`breaks` JSON column, one entry per break, results kept). The four `break_*` columns are dual-written for one release, then dropped. | `BREAK_RESULTS_ACKED` nulls them today (`session-flow.ts:184-189`); the song reads one arbitrary `game_results` row (`tasks/session-song.ts:203-210`, `limit(1)`, no order). |
| D5 | **One completion signal: `status`.** `completedAt` means "ended at" (set for completed and abandoned, as today). `flowState` keeps `completed`/`abandoned` only as a mirror written in the same CAS; one helper `sessionOutcome(plan)` is the only reader of the triple. | Six different completion tests today (findings). |
| D6 | **One report**, `buildSessionReport()` (pure, server-side), served by `GET …/plans/[planId]/report` and pushed to the `session:<id>` socket room after every write. All views read it through one React Query key. | Owner: every view consistent. |
| D7 | **Read-time normalization, no data backfill**, except the one-release dual-write for the break columns and the part-state column. | Old rows stay byte-identical; the normalizer is a pure function covered by fixtures; nothing can corrupt history. |
| D8 | Old clients keep working against the new server through every phase: unknown fields are ignored, a missing `tryId` is minted server-side, `shouldRunBreak` from the client is ignored. | Rolling deploy with open practice tabs. |

## 1. Target model

### 1.1 Segments and the flow machine

```ts
type Segment =
  | { kind: 'part'; partIndex: number }
  | { kind: 'break'; breakIndex: number; afterPartIndex: number }
  | { kind: 'end' }                         // song + summary

/** Derived, never stored: parts + gameBreakSettings.enabled → the rhythm. */
function segmentsOf(plan): Segment[]
```

Position is **two stored fields plus the part's own state**:

- `flowState` — the segment's phase: `practicing | part_transition | break_pending | break_active | break_results | completed | abandoned` (unchanged values, new meanings pinned below).
- `currentPartIndex` — the part being practiced or, during a transition/break, the part about to start. `breaks[n].afterPartIndex = currentPartIndex − 1` during a break.
- `partStates[partIndex]` — opaque to the structure; the part kind's cursor (for arithmetic: slot index, retry rounds, redeemed items). Today's `currentSlotIndex` + `retryState[partIndex]` are its legacy encoding.

Flow events, all applied by `applyFlowEvent(plan, event)` and persisted by `applySessionFlowEvent` (CAS on `flowVersion`):

| Event | From | To | Source |
|---|---|---|---|
| `TRY_RECORDED { try }` | `practicing` | `practicing`, or `part_transition` when the kind says done and parts remain, or `completed` when the last part is done | server, inside `recordTry` |
| `PART_TRANSITION_COMPLETED` | `part_transition` | `break_pending` if `gameBreakSettings.enabled`, else `practicing` (client's `shouldRunBreak` ignored) | client |
| `BREAK_STARTED { game }` | `break_pending` | `break_active`; appends `breaks[n]` | client |
| `BREAK_FINISHED { reason, results }` | `break_active \| break_pending` | `break_results` (gameFinished) or `practicing`; fills `breaks[n]` | client |
| `BREAK_RESULTS_ACKED` | `break_results` | `practicing`; **does not clear** `breaks[n]` | client |
| `SESSION_ENDED_EARLY { reason }` | any live | `completed`, `status='completed'`, adjustment appended | adult |
| `SESSION_ABANDONED` | any live | `abandoned`, `status='abandoned'` | client/adult |

`status` and `completedAt` become part of the machine's patch (`AppliedFlowEvent.patch`), so `completeSessionPlanEarly` and `abandonSessionPlan` lose their second write (`session-planner.ts:1845-1856`, `1873-1883`). A try arriving in any state other than `practicing` is rejected with 409 (today it is accepted mid-break: `recordSlotResult` never reads `flowState`).

`PART_TRANSITION_STARTED` is retired: the server enters `part_transition` itself. The client renders the transition screen from `flowState`, not from an index change.

### 1.2 The part-kind contract

```ts
interface PartKind<Plan = unknown, State = unknown, Item = unknown> {
  readonly id: string                                   // 'arithmetic' today; registry key

  // Planning (server, generateSessionPlan)
  plan(input: PartPlanInput): Promise<Plan>             // content; today: slots with problems

  // Driving (server, recordTry; client, rendering)
  initialState(plan: Plan): State
  expectedItem(plan: Plan, state: State): Item | null   // null ⇔ isDone
  acceptsDoOver(plan: Plan, state: State, tries: Try[], itemId: string): boolean
  applyTry(plan: Plan, state: State, tries: Try[], t: Try): State
  isDone(plan: Plan, state: State): boolean
  progress(plan: Plan, state: State, tries: Try[]): PartProgress   // {done, total, label}

  // Reporting
  reportContribution(plan: Plan, tries: Try[]): PartReport        // kind-specific block
  presentationOf(part: Plan): AttemptPresentation                   // ledger axes (§6)
  evidenceOf(part: Plan, t: Try): SkillEvidence[]                   // skills + weight hook

  // UI (client bundle; separate module so the server never imports it)
  // components: ItemView, PartProgressDots, PartIntro, RetryIntro?
}

interface Try {
  tryId: string            // client-generated UUID; idempotency key
  itemId: string           // the slot / item it answers (today slotId)
  partIndex: number        // 0-based; partNumber stays for legacy readers
  kind: 'first' | 'retry' | 'do_over'
  round: number            // first: 0; retry: 1..MAX; do_over: prior tries of the item
  answer: unknown          // kind-typed; number today
  isCorrect: boolean
  timing: {...}            // today's responseTimeMs + guard fields, unchanged
  help: {...}              // hadHelp / helpTrigger / usedOnScreenAbacus, unchanged
  recordedAt: Date
  review?: {...}           // today's source/originalSource/timingReview, unchanged
}
```

`arithmeticKind` implements it with `Plan = SessionPart` (slots), `State = { slotIndex, round, roundItems, pending, redeemed }` (today's `currentSlotIndex` + `PartRetryState`), `Item = { itemId, problem, purpose, kind, round }` (today's `getCurrentProblemInfo` return). `expectedItem` is the shared current-item function from the fix PR, moved here. `MAX_RETRY_EPOCHS`, divulging, redemption by do-over: all inside.

The structure (`session-flow.ts`, `recordTry`, the report builder, the progress indicator's outer ring) imports only `PartKind` and the registry `partKinds[part.kind]`. Nothing structural reads `slots`, `retryState` or `currentSlotIndex` after Phase 5 (Phase 3 moves the server; Phase 5 moves the client).

**Weights** (owner's rule, in one helper `weightOfTry(t, itemTries)`):
- `first`: correct → 1, wrong → 0.
- `retry` round r: correct → 1/2^r, wrong → 0.
- `do_over` of an item whose latest weighted try was wrong: as a retry with r = `round` (prior tries of the item), so the first do-over of a once-wrong item is 0.5, like its first retry would be. Wrong → 0.
- `do_over` of an item whose latest weighted try was correct: 0 (recorded, zero weight).

### 1.3 Proof the contract fits a second kind (sketch only, not scheduled)

"Read the abacus": each item is a bead picture; the student types the number.

- `plan`: N items with `{ itemId, beadState, expectedValue, skillsRequired: ['placeValue.*'] }`; `format: 'image'`, `useAbacus: false`.
- `initialState`: `{ index: 0 }`. `expectedItem`: `items[index]` or null. `applyTry`: `index + 1`; no retry rounds, so every try is `first` (or `do_over`). `isDone`: `index >= items.length`. `acceptsDoOver`: any answered item.
- `progress`: `{ done: index, total: items.length }`. `reportContribution`: per-item correctness and median time; no "fixed in retries" block (the generic report shows 0 fixed, which is true).
- `presentationOf`: `{ layer: 'read_abacus', modality: 'visual', abacusAvailable: false, input: 'keypad' }`. `evidenceOf`: its skills with `weightOfTry`.
- UI: its own `ItemView` (an `AbacusReact` render) and dots. `PartTransitionScreen` asks each kind `needsPhysicalAbacus` instead of switching on `'abacus' | 'visualization' | 'linear'` (`PartTransitionScreen.tsx:113-114`), and `PartTransitionEvent.previousPartType/nextPartType` become `string` with a `label`.

Nothing in the flow machine, the try record, the report or the socket payloads changes. That is the test of D2.

## 2. Try record

- **Id and idempotency.** The client mints `tryId = crypto.randomUUID()` when it shows an item and sends it with the answer. `recordTry` finds an existing try with that id → returns the current plan (200, no-op). Old clients send none → server mints one (no idempotency, as today, until they reload).
- **Expectation check.** `kind: first | retry`: `itemId` must equal `expectedItem().itemId`, else 409 `{ code: 'unexpected_item', expectedItemId }`. `kind: do_over`: `acceptsDoOver(...)` must be true (item has a try, answer not divulged, part is current or finished), else 409. Any kind while `flowState !== 'practicing'` → 409 `{ code: 'not_practicing' }`. Any kind when `status !== 'in_progress'` → 409.
- **Every do-over is recorded**, including one of a correct item (today skipped, `ActiveSession.tsx` ~1517). The client sends `{ kind: 'do_over', itemId, tryId, answer, … }`; the server computes `round` and the redemption; `redoContext.originalWasCorrect` is no longer trusted (legacy `record_redo` payloads are mapped onto this path).
- **Stamped by the server, never by the client:** `kind`, `round`, `partIndex`, `partNumber`, `recordedAt`, `masteryWeight` (= `weightOfTry`, cache for SQL readers). Client-sent `isRetry/epochNumber/masteryWeight` are dropped (fixes finding 5).
- **Adult review addresses a try by `tryId`.** New route `PATCH …/plans/[planId]/tries/[tryId]` with the same actions as today's `results/[resultIndex]`; the old route stays for one release, resolving `resultIndex` to the `tryId` of the normalized try at that position. Legacy tries get `tryId = legacy:<planId>:<arrayIndex>` from the normalizer; since `results` is append-only (the only positional delete is worksheet unapproval, which deletes the whole worksheet's rows, not one), the legacy id is stable.

**Storage.** `SlotResult` gains optional `tryId`, `kind`, `round`, `partIndex`. `normalizeTry(result, arrayIndex, planId): Try` derives them for old rows: `kind = isManualRedo ? 'do_over' : isRetry ? 'retry' : 'first'`, `round = kind === 'do_over' ? countPriorTriesOfItem : epochNumber ?? 0`, `itemId = slotId`, `partIndex` from `partNumber`. Legacy fields keep being written for one release (BKT, ledger backfill and the attempt-history panel read them) and are dropped from writes in Phase 6.

## 3. Breaks as a list, one completion signal, position

```ts
interface BreakRecord {
  breakIndex: number
  afterPartIndex: number
  startedAt: Date
  endedAt?: Date
  reason?: 'timeout' | 'skipped' | 'gameFinished'
  game?: string | null
  results?: GameResultsReport | null     // what BREAK_FINISHED carried
  gameResultId?: string                  // game_results.id when the arcade wrote one
}
```

- New column `breaks` (JSON, default `[]`). `BREAK_STARTED` appends; `BREAK_FINISHED` fills; `BREAK_RESULTS_ACKED` only moves `flowState`.
- Legacy sessions: `breaksOf(plan, gameResults)` returns `plan.breaks` when non-empty, else reconstructs from `game_results where session_id = plan.id and session_type = 'practice-break' order by played_at` (one record per break, `afterPartIndex` unknown → inferred from `playedAt` against try timestamps, else `null`), else from the four legacy columns (at most one break).
- The song's reader (`tasks/session-song.ts:201-210` and `:532`) takes every break, not `limit(1)`. **Note:** that file has uncommitted edits in the main checkout; this phase lands after that work or is rebased over it (findings → Constraints).
- **Completion**: `sessionOutcome(plan): 'in_progress' | 'completed' | 'abandoned' | 'not_started' | 'deleted'` reads `status` only; `endedAt = completedAt`; `endedEarly = adjustments.some(type === 'ended_early')`. `flowState in (completed, abandoned)` is written by the same CAS so it cannot disagree going forward; the normalizer resolves legacy disagreement by `status`, except `status = in_progress && completedAt != null`, which `getActiveSessionPlan` already treats as not active and the normalizer reports as `abandoned`.
- **Position lives on the server row** (§1.1). Client copies removed in Phase 5: `prevPartIndexRef` and the index-change effect (`ActiveSession.tsx:1124-1159`), the completion fallback (`:1117-1121`), `previousPartIndexRef`, `redoState.returnTo*`, the broadcast's `currentPartIndex/currentSlotIndex` as inputs (they become outputs copied from the report), `isInPartTransition` (derived from `flowState`). The retry-intro screen stays client-rendered but is derived from `expectedItem().round` changing, not from a parallel ref.

## 4. One server-built session report

```ts
interface SessionReport {
  version: number                      // flowVersion at build time; pushes are orderable
  sessionId: string; playerId: string
  outcome: 'in_progress' | 'completed' | 'abandoned'; endedEarly: boolean
  startedAt: number | null; endedAt: number | null
  time: { activeMs: number; wallMs: number; breakMs: number; pausedMs: number }
  totals: Counts
  parts: PartReportRow[]               // one per part, in order
  breaks: BreakReportRow[]             // one per break, in order
  song: { status: 'none' | 'pending' | 'ready' | 'failed'; songId?: string; shareCode?: string }
  position: { segment: Segment; flowState; currentItem?: ItemSummary; progress: {done,total} } | null
  tries: TryRow[]                      // normalized, for drill-down views (observer, review)
}

interface Counts {
  problems: number        // unique items that have ≥1 try ("attempted"); plannedProblems alongside
  plannedProblems: number
  tries: number           // every try, all kinds
  firstTryCorrect: number
  firstTryAccuracy: number | null   // firstTryCorrect / problems; null when problems = 0
  fixedInRetries: number  // first try wrong, final verdict correct
  unresolved: number      // first try wrong, final verdict wrong (includes divulged)
  finalCorrect: number
  finalAccuracy: number | null      // finalCorrect / problems
}
```

Exact definitions, applied per part and summed for totals:
- **problem** = a unique `itemId`. Attempted = has at least one try. Headline denominators use attempted problems; `plannedProblems` is shown as "of N" for in-progress and abandoned sessions.
- **first try** = the try with `kind: 'first'`. There is exactly one per attempted item (the server enforces it).
- **final verdict** of an item = `isCorrect` of its last **weighted** try, where weighted = `first`, `retry`, or `do_over` whose `weightOfTry` rule is the retry rule (i.e. the item was wrong before it). A do-over of an already-correct item never changes the verdict.
- **fixed in retries** = first wrong ∧ final correct (whether by retry round or by do-over). Reported next to the headline as the owner asked.
- **active time** = Σ over tries of `getEffectiveResponseTimeMs(try)` (`timing/effective-time.ts:100`; omitted samples contribute 0). **wall time** = `endedAt ?? now` − `startedAt`. **break time** = Σ `breaks[n].endedAt − startedAt`. **paused** = Σ pause intervals when recorded (today only the current pause is stored; reported as 0 for history until pauses are logged, flagged in §8).
- **completed vs abandoned** = `sessionOutcome` (§3). `endedEarly` is a flag on `completed`.
- **per part** = the same `Counts` over that part's tries plus `kind`-specific `contribution` and `status: planned | active | done`. **per break** = `BreakRecord` plus `durationMs`. **song** = from `session_songs` for the plan.

Builder: `lib/curriculum/session-report.ts` `buildSessionReport({ plan, gameResults, song })`, pure. Route: `GET /api/curriculum/[playerId]/sessions/plans/[planId]/report` (auth as the plan route) and `GET /api/sessions/[sessionId]/share/[token]/report` (token auth as `observe-session`). Hook: `useSessionReport(planId)` on `sessionReportKeys.detail(planId)` in `lib/queryKeys.ts`.

**Live updates, event-driven.** After every successful write in `recordTry` and `applySessionFlowEvent`, the server emits `session-report { report }` to `io.to('session:<id>')` via `getSocketIO()` (`lib/socket-io.ts:16`), and `session-ended` to the same room on completion/abandonment. Today `session-ended` goes only to `classroom:`/`player:` rooms (`lib/classroom/socket-emitter.ts:275,328`) and only from the `end_early`/`abandon` actions of the plan PATCH route (`…/plans/[planId]/route.ts:186,192`); natural completion emits nothing to anyone, so the `session-ended` listeners in `useSessionObserver.ts:548` and `useLiveSessionTimeEstimate.ts:173` never fire for an observer. Observers already sit in that room (`socket-server.ts` `observe-session`). `useSessionReport` subscribes and `setQueryData`s the pushed report when `report.version` is newer. The student's own screen keeps using the mutation response (`useSessionPlan.ts:420-421`). No new polling; the `setInterval`s in `PublicObservationClient.tsx:47`, `SessionPausedModal.tsx:182` and `VirtualizedSessionList.tsx:481` are clocks, not fetches, and stay. One existing poll was found: `useActiveSessionsInClassroom` (`hooks/useClassroom.ts:23-29`, `refetchInterval: 15_000`) alongside socket invalidation; removing it is §8 Q9.

Migration targets, all moving onto `SessionReport` (verified paths; see findings for today's divergent formulas):

| View | Files | Today reads | Target |
|---|---|---|---|
| Share link | `app/observe/[token]/page.tsx`, `PublicObservationClient.tsx`, `SessionEndedClient.tsx`, `opengraph-image.tsx`, `app/api/observe/[token]/route.ts` | plan row (done = slot-index math `page.tsx:154-160`; completed = `completedAt \|\| !startedAt` `:101`) + student broadcast; OG stats only from the song's frozen `promptInput` (`opengraph-image.tsx:64-83`), none without a song | `useSessionReport` via token route; the page flips to "ended" on the pushed `session-ended` instead of needing a reload; OG renders `totals` |
| Live observer | `hooks/useSessionObserver.ts`, `components/classroom/SessionObserverModal.tsx`, `components/practice/LiveSessionReportModal.tsx`, `app/practice/[studentId]/dashboard/DashboardClient.tsx:3840-3852`; student side `hooks/useSessionBroadcast.ts` | student broadcast (`PracticeStateEvent.slotResults`, deduped by problemNumber); duration = `Date.now() − timing.startedAt`, which is the **current attempt's** start (`useSessionBroadcast.ts:192`), not the session's; dashboard passes `createdAt` as start | report for counts/accuracy/time/position; broadcast keeps only the sub-second state (typed digits, phase, timer) |
| Summary | `app/practice/[studentId]/summary/page.tsx`, `app/practice/[studentId]/session/[sessionId]/page.tsx`, `SummaryClient.tsx`, `components/practice/SessionHero.tsx` (what the page renders; `SessionSummary.tsx` has no non-test consumer and is deleted), `sessionSummaryUtils.ts` | plan row as a server prop; `results.length`; wall time (`SessionHero.tsx:70-73`); in-progress = `startedAt && !completedAt` (`SummaryClient.tsx:259`) | report; the "all eventually correct" celebration = `unresolved === 0` (fixes finding 8) |
| Dashboard list / history | `lib/curriculum/progress-manager.ts` (`getPaginatedSessions`, `getRecentSessions`, `toPracticeSession`), `app/api/curriculum/[playerId]/sessions/route.ts`, `hooks/useSessionHistory.ts`, `components/practice/VirtualizedSessionList.tsx`, `hooks/useLiveSessionTimeEstimate.ts` (active row; `subscribe-session-stats` room), `components/practice/ContinueSessionCard.tsx`, `lib/curriculum/trends.ts` | plan rows, `results.length`, Σ raw `responseTimeMs`; completion by `status`; nothing invalidates the list when a session completes | `toPracticeSession` built from `buildSessionReport(...).totals/time`; `sessionHistoryKeys.list` invalidated on the pushed `session-ended`; `app/api/curriculum/[playerId]/sessions/history/route.ts` has no caller and is deleted |
| MCP | `lib/mcp/tools.ts` (`get_student_overview` :495, `get_practice_sessions` :629, `get_active_session` :794) | `getRecentSessions`; `get_practice_sessions` returns only date/`completedAt`/wall minutes; `get_active_session` uses `results.length` and `status` | `SessionReport` fields (counts, both times, outcome); `currentProblem` from `position` |
| Song + song share | `lib/session-song/extract-session-stats.ts`, `lib/tasks/session-song.ts`, `lib/song-share/getSharedSong.ts`, `sessionFacts.ts`, `app/song/[code]/page.tsx`, `app/song/[code]/opengraph-image.tsx`, `app/embed/song/[code]/page.tsx` | plan + one `game_results` row; `durationMinutes = targetDurationMinutes` (`extract-session-stats.ts:717`); "recent sessions" = 10 completed plans ordered `createdAt` **ascending** (`session-song.ts:178-188`, the oldest ten); share pages project the song's frozen `promptInput` | `buildSessionReport` at song time for lyrics (frozen by nature), recent sessions newest-first; the share pages re-read the report at render |
| SessionPausedModal | `components/practice/SessionPausedModal.tsx:192` | the student's local plan; excludes retries and redos | `position.progress` |
| Classroom / parent active sessions | `app/api/classrooms/[classroomId]/presence/active-sessions/route.ts` (+ `hooks/useClassroom.ts` poll), `app/api/players/[id]/active-session/route.ts` (+ `hooks/useChildSessionsSocket.ts`, `useUnifiedStudents.ts`) | slot-index math vs `results.length`; the player route has no `completedAt` guard and the hook invents `startedAt: new Date()` | `position` + `totals` + `startedAt` from the report; `sessionOutcome` filter |
| Teacher observe page | `app/practice/[studentId]/observe/page.tsx`, `ObservationClient.tsx` | `getActiveSessionPlan`; slot-index math; an unreachable `completedAt` branch (`:52-63`) | report `position`; ended banner from the pushed `session-ended` |

## 5. Storage and migration

`session_plans` changes (all through `/db-migrate`, `npx drizzle-kit generate --custom`, committed with `drizzle/meta`):

| Phase | Migration | Columns |
|---|---|---|
| 3 | `add_session_plans_breaks_part_states` | `breaks` text JSON not null default `'[]'`; `part_states` text JSON not null default `'{}'` |
| 6 | `drop_session_plans_legacy_position_and_break_columns` | drop `break_started_at`, `break_reason`, `break_selected_game`, `break_results`, `current_slot_index`, `retry_state` (SQLite `DROP COLUMN`, one statement each with breakpoints) |

JSON shapes: `SlotResult` gains `tryId?`, `kind?`, `round?`, `partIndex?` (Phase 1); `SessionPart` gains `kind: string` (default `'arithmetic'` when absent) and `partNumber` widens to `number` (Phase 2); `breaks: BreakRecord[]`, `partStates: Record<number, unknown>` (Phase 3).

**Read-time normalization, not backfill** (D7): `normalizePlan(plan): NormalizedPlan` in `db/schema/session-plan-normalize.ts` (drizzle-free, client-safe) derives `tries`, `kind` per part, `partStates` (from `part_states`, else from `current_slot_index` + `retry_state`), `breaks` (from the column, else §3 reconstruction), `outcome`. Every reader goes through it. Reasons: old rows are never rewritten (no risk to BKT history or the ledger backfill, which keys legacy rows by `slotId:epoch:redoN` and must keep seeing the same inputs); the function is unit-testable on fixtures of every historical shape (offline sessions with slot-less parts, `recency-refresh` sentinels with `parts: []`, worksheet plans, pre-`slotId` residue); and it is reversible. Backfill would be a one-shot, hard-to-verify write over 100k+ JSON rows for no reader benefit.

**Dual-write windows** (one release each): Phase 3 writes `part_states` and `current_slot_index`/`retry_state` together, and `breaks` together with the four break columns, so a rollback to the previous image keeps live sessions. Phase 6 stops the legacy writes and drops the columns after the owner has run a normal week on Phase 5.

`getActiveSessionPlan`'s auto-abandon of slot-less parts (`session-planner.ts:1136-1143`) becomes `partKinds[part.kind].isPlayable(part)`, so a future kind without slots is not abandoned at start.

## 6. Ledger compatibility

The ledger (`feat/practice-ledger`, `lib/ledger/events.ts`) is rebased onto this. Mapping of the try record onto `attempt.answered`:

| Try field | `attempt.answered` payload | Change needed on rebase |
|---|---|---|
| `itemId` | `slotId` | none |
| `partIndex` / `partNumber` | `partNumber`; `slotIndex` | `slotIndex` comes from `arithmeticKind` (item position); other kinds send `0` or the payload makes it optional — recommend optional |
| `kind: 'retry'`, `round` | `retry: { epoch: round, ofSlotId: itemId }` | none |
| `kind: 'do_over'`, `round` | `manualRedo: n` (nth do-over of the item) | `manualRedo` stays; add `doOverRound: round` so the fold can apply the owner's weight rule without replaying history |
| `masteryWeight` (server cache) | `recordedMasteryWeight` | none; the fold should prefer `weightOfTry` (shared helper) and keep `recordedMasteryWeight` for pre-rework rows whose rule differed |
| `tryId` | — | **new dedupe key form** `attempt:<planId>:try:<tryId>`; legacy rows keep `attempt:<planId>:<slotId>:<epoch>:<redoN>` via the normalizer's derived `epoch`/`redoN`, so already-backfilled keys do not move |
| presentation | `presentation { layer, modality, abacusAvailable, input, format }` | built by `partKinds[kind].presentationOf(part)` instead of the adapter's `part.type` switch (`ledger/adapters/problem-result.ts:158-164`); `layer` = part type for arithmetic, kind id otherwise |
| skills | `problem.skillsRequired` | from `evidenceOf` |

Session view fold: `session.started/completed/abandoned` are emitted from the flow machine's committed patch (one place), with `occurredAt = completedAt` as the ledger plan requires; `partTypes` = `parts.map(p => p.kind === 'arithmetic' ? p.type : p.kind)`. The dual-write hooks the ledger adds to `recordSlotResult`/`recordRedoResult` (`-practice` checkout, `session-planner.ts:1903-1911, 2091`) move into `recordTry`, which is the single write point. `plan.decided` is unaffected. The ledger's `arrayIndexFallback` stays for pre-`slotId` residue.

## 7. Phases

Each phase is one squashable PR, independently deployable, safe for open practice tabs (old client → new server) and for a rollback of one release, and keeps every old session rendering. Acceptance tests are vitest with `src/test/journey-simulator/EphemeralDatabase.ts` (runs real migrations) and the `vi.mock('@/db')` pattern of `src/test/retry-redo-attribution.test.ts`. Lint only changed files with `npx @biomejs/biome check`.

### Phase 1 — Try record and weights (no schema change)
- **Scope.** `tryId`, `kind`, `round`, `partIndex` on `SlotResult`; `normalizeTry`; `weightOfTry`; idempotent `recordSlotResult` by `tryId`; 409 on `flowState !== 'practicing'`; do-overs of correct items recorded; server stamps all retry/redo fields; `tries/[tryId]` review route with `results/[resultIndex]` delegating. BKT reads `masteryWeight ?? weightOfTry(normalized)`.
- **Files.** `db/schema/session-plans.ts`, new `db/schema/session-plan-normalize.ts`, new `lib/curriculum/try-weight.ts`, `lib/curriculum/session-planner.ts` (`recordSlotResult`, `recordRedoResult`), `lib/curriculum/session-review.ts`, `app/api/curriculum/[playerId]/sessions/plans/[planId]/route.ts`, new `…/tries/[tryId]/route.ts`, `…/results/[resultIndex]/route.ts`, `components/practice/ActiveSession.tsx` (send `tryId`; record every do-over), `hooks/useSessionPlan.ts`, `lib/curriculum/bkt/compute-bkt.ts`.
- **Contracts.** `Try`, `weightOfTry`, 409 bodies `{ code: 'unexpected_item' | 'not_practicing' | 'not_in_progress', expectedItemId? }`.
- **Acceptance.** Extend `retry-redo-attribution.test.ts`: duplicate `tryId` is a no-op; a do-over of a correct item is stored with weight 0; a do-over of a wrong item is stored with 0.5 and redeems; the retry-round try of the same item gets 0.5; a try mid-break is 409; `normalizeTry` on fixtures of every historical row shape; review by `tryId` and by legacy index reach the same row.
- **Risks.** BKT parity: run `compute-bkt` over a fixture before/after and assert identical pKnown. Old clients without `tryId`: covered by minting.
- **Owner hand test.** Answer wrong, tap the dot, do it over right, see the retry round skip it; do a correct problem over and see nothing change in the score; double-tap submit.
- **Parallel packages.** (a) server + normalizer + tests; (b) client `ActiveSession`/hooks; (c) review routes. Disjoint files.

### Phase 2 — Part-kind contract, arithmetic kind extracted (behaviour-identical refactor)
- **Scope.** `PartKind` interface and registry; `arithmeticKind` wrapping the slot/retry logic now spread over `session-plan-helpers.ts` (`getCurrentProblemInfo`, `isInRetryEpoch`, `initRetryState`, `needsRetryTransition`, `calculateTotalProblemsWithRetries`) and `recordSlotResult`'s advance block (`:1469-1526`); `SessionPart.kind`; `partNumber: number`. `recordSlotResult` becomes `recordTry` calling the kind, but still writes position the old way (`currentSlotIndex`/`retryState`) through an adapter. No behaviour change: this is the refactor that makes Phase 3 small.
- **Files.** New `lib/curriculum/parts/kind.ts`, `parts/registry.ts`, `parts/arithmetic/{server.ts,state.ts,report.ts}`, `parts/arithmetic/ui.tsx` (client only); `session-plan-helpers.ts` becomes re-exports; `session-planner.ts`; `generateSessionPlan` sets `kind: 'arithmetic'`.
- **Acceptance.** Golden test: replay the recorded sequence of tries from `retry-redo-attribution.test.ts` and from a 3-part plan with breaks through old and new code paths and assert identical rows (`results`, `currentPartIndex`, `currentSlotIndex`, `retryState`, `flowState`). Type test: a stub second kind compiles against `PartKind` with no structural imports of `slots`.
- **Risks.** Hidden imports of the helpers across the client (`SessionProgressIndicator`, `PracticeClient` ×2, observer) — keep the re-exports until Phase 5.
- **Owner hand test.** A full three-part session with breaks behaves exactly as before.

### Phase 3 — Server owns the rhythm; breaks as a list; one completion signal (migration)
- **Scope.** Migration `breaks` + `part_states` (dual-write with legacy columns). `applyFlowEvent` gains `TRY_RECORDED`, `SESSION_ENDED_EARLY`, writes `status`/`completedAt`/`currentPartIndex`/`breaks`/`partStates`; `recordTry` = load → kind → machine → one CAS update on `flowVersion`, retry once on conflict; `PART_TRANSITION_COMPLETED` ignores `shouldRunBreak`; server enters `part_transition` after every finished part when parts remain; `BREAK_RESULTS_ACKED` keeps the break; `completeSessionPlanEarly`/`abandonSessionPlan` become single writes; `sessionOutcome`; song reads all breaks. `PracticeClient` stops computing `shouldRunBreak` (`[studentId]/PracticeClient.tsx:826-829`) and renders the transition screen from `flowState`.
- **Files.** `drizzle/<next>_add_session_plans_breaks_part_states.sql` + meta, `db/schema/session-plans.ts`, `lib/curriculum/session-flow.ts`, `session-planner.ts`, `session-plan-normalize.ts`, `lib/tasks/session-song.ts`, `lib/session-song/extract-session-stats.ts` (breaks input), `app/practice/[studentId]/PracticeClient.tsx`, `components/practice/ActiveSession.tsx`, `hooks/useSessionPlan.ts`.
- **Contracts.** Flow table §1.1; `BreakRecord`; `sessionOutcome`.
- **Acceptance.** Two concurrent `recordTry` calls on one plan: exactly one wins, the other gets a conflict and the retry sees the new expected item (no lost write). A break with two games produces two `breaks` rows and the song input lists both. `end_early` leaves `status`, `flowState`, `completedAt` consistent in one row version. Legacy fixture with the four break columns and no `breaks` normalizes to one break. In-flight fixture with `current_slot_index`/`retry_state` and empty `part_states` resumes at the right item. A try during `break_active` is 409.
- **Risks.** Rolling deploy: the old pod ignores `breaks`/`part_states` and keeps writing legacy columns; the new pod reads legacy when `part_states` lacks the part — tested by the in-flight fixture. Rebase over the song file's in-flight edits.
- **Owner hand test.** Start a session on the old tab, deploy, finish it: no stall at the part boundary, break runs, summary correct. Two breaks in one session; song mentions both games.
- **Parallel packages.** (a) migration + machine + `recordTry`; (b) song/breaks readers; (c) client transition rendering. Disjoint files.

### Phase 4 — The report, the push, the views
- **Scope.** `buildSessionReport`, both report routes, `useSessionReport` + query key, `session-report` emitted to `session:<id>` after every write; `session-ended` emitted from the flow machine's commit on **every** end (natural completion included) to `session:<id>` as well as the existing `classroom:`/`player:` rooms; `sessionHistoryKeys.list` and `sessionPlanKeys.active` invalidated on it; the classroom poll removed (§8 Q8); every view in §4's table reads the report; `SessionSummary.tsx` and the dead history route deleted.
- **Files.** New `lib/curriculum/session-report.ts`, `app/api/curriculum/[playerId]/sessions/plans/[planId]/report/route.ts`, `app/api/sessions/[sessionId]/share/[token]/report/route.ts` (or extend `app/api/sessions/[sessionId]/share/route.ts`), `hooks/useSessionReport.ts`, `lib/queryKeys.ts`, `lib/classroom/socket-events.ts` (+`SessionReportEvent`), `lib/classroom/socket-emitter.ts`, plus the view files listed in §4.
- **Acceptance.** `buildSessionReport` on fixtures: the findings' 10-problem/3-wrong/5-minute-break session yields problems 10, tries 13, first-try 70 %, fixed 3, final 100 %, active ≈ Σ effective ms, wall = ended − started, breaks 1 × 5 min; an abandoned fixture reports `abandoned` and never "Complete!"; `recency-refresh` and offline fixtures build without throwing. Route test: push payload `version` strictly increases across two writes. Snapshot test per view component rendering from one shared report fixture, so the numbers are provably the same on every screen.
- **Risks.** Observer modal and share page currently trust the student broadcast for progress; keep the broadcast for sub-second state only. Song stats frozen at song time vs live edits: lyrics frozen, share page live (§8 Q4).
- **Owner hand test.** Open the share link, the observer modal, the dashboard, the summary and `get_practice_sessions` for the same session: identical problems, tries, first-try, fixed, final, active and wall time.
- **Parallel packages** (disjoint files): (a) builder + routes + hook + emitter; then in parallel (b) summary + SessionPausedModal, (c) observer + share link + OG, (d) dashboard list, active-session cards, classroom/parent active sessions, teacher observe page, MCP, (e) song stats + song share. (b)–(e) depend on (a) only through the `SessionReport` type.

### Phase 5 — Position consolidation and client cleanup
- **Scope.** Readers switch to `partStates`; `SessionProgressIndicator`, both `PracticeClient`s and `ActiveSession` drop every position copy listed in §3; the do-over tap sends `itemId` (not a linear index decoded at `[studentId]/PracticeClient.tsx:472-485`); `PartTransitionEvent` carries kind labels; `PartTransitionScreen` asks the kind about the physical abacus; `useSessionSongTrigger` reads `report.position.progress` and remaining time from the report; `getActiveSessionPlan` uses `isPlayable`.
- **Files.** `components/practice/SessionProgressIndicator.tsx`, `ActiveSession.tsx`, `PartTransitionScreen.tsx`, `app/practice/PracticeClient.tsx`, `app/practice/[studentId]/PracticeClient.tsx`, `hooks/useSessionBroadcast.ts`, `hooks/useSessionSongTrigger.ts`, `lib/classroom/socket-events.ts`, `session-planner.ts`.
- **Acceptance.** `grep` gate in a test: no file under `components/practice`, `app/practice`, `hooks` imports `retryState`, `currentSlotIndex` or `slots` except `parts/arithmetic/ui.tsx` and the normalizer. Observer and broadcast tests (`hooks/__tests__/useSessionObserver.*`, `useSessionBroadcast.*`) updated to the report-driven progress.
- **Risks.** Largest UI diff; land only after Phase 4 has been seen live.
- **Owner hand test.** Full session with do-overs across parts; observer follows; transition screens show at the right moments without flicker.

### Phase 6 — Drop legacy columns and legacy writes
- **Scope.** Migration dropping the six columns; stop writing `isRetry/epochNumber/isManualRedo/originalSlotIndex` (keep `masteryWeight` cache); remove `results/[resultIndex]` route and the `record_redo` action; remove the re-export shims.
- **Acceptance.** Normalizer fixtures still pass (they are the only path for old rows); BKT parity test unchanged; the ledger backfill fixture from the `-practice` checkout keys the same legacy rows identically.
- **Risks.** Irreversible; lands a release after Phase 5 and after the ledger rebase has been planned against §6.

## 8. Open questions for the owner

1. **Headline denominator for unfinished sessions.** Accuracy over attempted problems, progress "of planned"? *Recommend yes*: accuracy is about what was answered; progress is about the plan.
2. **"Active time" as the practice-time headline** was chosen by the integrator (findings). Confirm, and confirm that break and pause time are excluded and shown separately. *Recommend confirm.*
3. **Push payload.** Full `SessionReport` to the session room after every write (simple, works for token observers) versus a version ping plus HTTP refetch (less socket traffic). *Recommend the full report*; it is a few KB and keeps the share page off any extra auth route.
4. **Song share and OG after adult edits.** Lyrics are frozen by nature; should the share page's numbers be live (re-read the report) or frozen with the song? *Recommend live numbers, frozen lyrics*, with a "numbers as of" note only if they differ.
5. **Pause time.** Only the current pause is stored (`isPaused/pausedAt`), so historical `pausedMs` is 0. Log pause intervals on the row (small JSON list, same pattern as breaks) in Phase 3, or leave it? *Recommend log them in Phase 3*; it is the same shape of change and makes wall − active − breaks explainable.
6. **Do-over of an item still waiting in the retry queue** redeems it (today's behaviour, kept by the fix PR). Keep? *Recommend keep.*
7. **Ended-early sessions** count as `completed` with `endedEarly: true` (today: status completed + adjustment). Keep? *Recommend keep*, and show the flag in the dashboard.
8. **Existing poll.** `useActiveSessionsInClassroom` refetches every 15 s in addition to socket invalidation (`hooks/useClassroom.ts:23-29`). Remove it in Phase 4 when `session-ended` is emitted on natural completion too, or keep it as a safety net? *Recommend remove*; the owner rule is no polling, and the event path becomes complete in Phase 4.
9. **Phase 6 timing.** Drop the legacy columns one release after Phase 5, or hold until the ledger rebase lands? *Recommend after the ledger rebase*, since its backfill reads the legacy fields.

## 9. Findings corrected or sharpened while verifying

- Finding "a part without slots would be treated as legacy and abandoned": confirmed (`session-planner.ts:1102-1110, 1136-1143`); offline sessions already have slot-less parts but are never `in_progress`, so they are not affected today.
- `completePartTransition` (`:1895-1906`) is correct as written (`currentPartIndex` already points at the next part when it runs); the finding is right that nothing calls it. Phase 3 makes the flow-events route use its decision and ignore the client's.
- The summary page renders `components/practice/SessionHero.tsx`, not `SessionSummary.tsx`; the latter has only test and story consumers. Finding 8's grouping bug exists in `SessionSummary.tsx:121-132` and the same per-slot logic must be checked in `SessionHero` before deletion.
- Natural completion emits no socket event at all: `emitSessionEnded*` is called only from the `end_early`/`abandon` actions. The findings said only the rooms were wrong; the trigger is missing too.
- The live observer's duration is not "since session start, breaks included" but since the **current attempt** started (`useSessionBroadcast.ts:192` sends `attempt.startTime` as `timing.startedAt`; `LiveSessionReportModal.tsx:221-222` subtracts it from now).
- The classroom active-sessions hook polls (`refetchInterval: 15_000`); the findings listed no polling.
- `app/api/curriculum/[playerId]/sessions/history/route.ts` has no caller anywhere in `src` (confirmed by grep); the findings said "no UI caller found".
- The song's "recent sessions" window is ordered `createdAt` ascending, so it is the ten oldest completed sessions, not the newest.
- The song's `limit(1)` read appears twice (`tasks/session-song.ts:203-210` and `:532-537`), not once.
- `recordSlotResult` bumps `flowVersion` only when the flow state changed (`:1543-1547`), so a plain try is an unversioned write today; this is why D1 makes every write a CAS.
