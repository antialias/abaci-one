# Session architecture: plan of record (2026-11-26, rev. 2)

Companion to [findings.md](./findings.md), which holds the owner's decisions and the fact base. This document settles the target model, the contracts and the phases. Paths are under `apps/web/src/`; `L/` means the ledger checkout (`~/projects/soroban-abacus-flashcards-practice/apps/web/src/`). Every code claim was re-read in the worktree at `6423f579b`. Section 10 records the adversarial review and what changed.

Assumed landed first: `fix/retry-redo-attribution` (`0f99ab38b` plus a follow-up in progress), to the extent `src/test/retry-redo-attribution.test.ts` requires. Names Phase 1 builds on: `resolveCurrentItem(plan)` in `session-plan-helpers.ts` (used by `getCurrentProblemInfo` and `recordSlotResult`); `settlePosition` / `settledPositionFields` in `session-planner.ts` (the shared advance step, also run by `recordRedoResult` when a redemption empties the current retry round); `SlotResultMismatchError` → route 409 `SLOT_MISMATCH`, on which the client refetches; the client sends the answered slot's id plus `epochNumber`; the follow-up attributes by problem content + `slotIndex` when an old client's `slotId` lags, and treats a resubmit as a no-op only on an exact match. Nothing else about that PR is assumed.

## 0. Decisions in one screen

| # | Decision | Why |
|---|---|---|
| D1 | A session is `part, (break, part)*, end`. The **flow machine** (`session-flow.ts`) is the only writer of `flowState`, `currentPartIndex`, `breaks`, `status`, `completedAt`. It calls `partKinds[kind].applyTry/isDone` and nothing else of a part. Every writer of the row (machine or not, §3.3) is a compare-and-set on a new `rowVersion`. | Today `recordSlotResult` decides the rhythm outside the machine and writes unconditionally (`session-planner.ts:1537-1566`). |
| D2 | **Two versions.** `rowVersion` = CAS for every writer, bumped on every write, orders report pushes. `flowVersion` keeps its meaning: bumped only by flow transitions, the client's optimistic token. | Clients send `expectedFlowVersion` on every flow event (`[studentId]/PracticeClient.tsx:225,576,611,630,833`) and show "Failed to transition session" on a stale one (`:842`); a row version that moved on every try or adult edit would stale it constantly. |
| D3 | A **part kind** is a module behind one interface (`PartKind`). Slots, retry rounds and do-overs live inside `arithmeticKind`. | Owner: architecture before diversity. |
| D4 | A **try** is the atom: client `tryId`, `itemId`, `kind: first \| retry \| do_over`, `round`, `practiceOnly`. Stored in `results` until the ledger makes `ledger_events` the store (§6). The server stamps `masteryWeight = weightOfTry(...)`, which reproduces today's numbers exactly; readers keep `masteryWeight ?? 1.0`. | Owner: every try has an id; readers decide weight; the BKT SQL reader (`bkt/evidence-query.ts:139`) and the ledger fold (`L/readiness/engine/bkt.ts:89`) read the stamped weight and must not refold history. |
| D5 | **Breaks are a list** (`breaks` column). **Expand/contract**: Phase 3a writes new and legacy columns and reads legacy; Phase 5 flips reads; Phase 6 drops legacy. | A rollback between writes-new and reads-new would resume from a stale `part_states` and lose a break; reading legacy until the flip makes rollback safe in both directions. |
| D6 | **One completion signal: `status`.** `sessionOutcome(plan)` is the only reader of `status`/`flowState`/`completedAt`. | Three definitions today (findings; §10 verification). |
| D7 | **One report**, `buildSessionReport()`, served over HTTP and pushed to the `session:<id>` room after every write, ordered by `rowVersion`. | Owner: every view consistent. |
| D8 | **Read-time normalization**, no backfill. | Old rows stay byte-identical; the normalizer is a pure, fixture-tested function. |
| D9 | Old clients keep working against the new server through every phase; the new client keeps sending what the old server needs for one release. | Rolling deploy with open tabs, and rollback. |

## 1. Target model

### 1.1 Segments, position, the flow machine

```ts
type Segment = { kind: 'part'; partIndex } | { kind: 'break'; breakIndex; afterPartIndex } | { kind: 'end' }
function segmentsOf(plan): Segment[]        // derived from parts + gameBreakSettings.enabled; never stored
```

Position = `flowState` (the segment's phase) + `currentPartIndex` (the part being practiced, or about to start) + `partStates[partIndex]` (the kind's cursor, opaque to the structure; today's `currentSlotIndex` + `retryState[i]` are its legacy encoding).

| Event | From | To | Source |
|---|---|---|---|
| `TRY_RECORDED { try }` | `practicing` | `practicing`; `part_transition` when `isDone` and parts remain; `completed` when the last part is done | server, inside `recordTry` |
| `TRY_RECORDED` | `part_transition` | **Phase 3a–3b:** implicit `PART_TRANSITION_COMPLETED` with the break skipped (today's reload behaviour, made explicit), then as above. **Phase 3c on:** 409 `not_practicing`, body carries the fresh plan | server |
| `PART_TRANSITION_COMPLETED` | `part_transition` | `break_pending` if `gameBreakSettings.enabled`, else `practicing`. Client's `shouldRunBreak` ignored | client |
| `BREAK_STARTED { game }` | `break_pending` | `break_active`; appends `breaks[n]` | client |
| `BREAK_FINISHED { reason, results }` | `break_active \| break_pending` | `break_results` or `practicing`; fills `breaks[n]` | client |
| `BREAK_RESULTS_ACKED` | `break_results` | `practicing`; **keeps** `breaks[n]` | client |
| `WORKSHEET_APPROVED { tries }` / `WORKSHEET_UNAPPROVED { tryIds }` | any | appends / voids tries; `completed` ↔ `in_progress` with `completedAt` set / cleared together | adult (§3.3) |
| `SESSION_PAUSED` / `SESSION_RESUMED` | live | appends to `pauses[]` (only if §8 Q5 is approved) | adult |
| `SESSION_ENDED_EARLY { reason }` | any live | `completed`; adjustment appended | adult |
| `SESSION_ABANDONED` | any live | `abandoned` | client / adult / auto-abandon |

`status` and `completedAt` are in the machine's patch, so `completeSessionPlanEarly` / `abandonSessionPlan` lose their second write (`session-planner.ts:1845-1856, 1873-1883`). `PART_TRANSITION_STARTED` is retired; the server enters `part_transition` itself and the client renders the screen from `flowState` (Phase 3c).

**Why implicit-then-409 (B3).** A tab reloaded during `part_transition` shows no transition screen today (`prevPartIndexRef` initialises to `currentPartIndex`, `ActiveSession.tsx:908`; `PracticeClient` renders only break states, `[studentId]/PracticeClient.tsx:200-203`) and simply answers; `recordSlotResult` accepts because it never reads `flowState`. Rejecting before the client renders from `flowState` would stall every such reload. After 3c a reload loads the new client, which renders the transition screen, so the only submits arriving in `part_transition` are stale ones.

### 1.2 The part-kind contract

```ts
interface PartKind<Content, State, Item> {
  readonly id: string                                  // 'arithmetic'
  plan(input: PartPlanInput): Promise<Content>
  isPlayable(content: Content): boolean                // replaces the slot-less auto-abandon
  initialState(content: Content): State
  expectedItem(content, state): Item | null            // null ⇔ isDone
  acceptsDoOver(content, state, tries: Try[], itemId): boolean
  applyTry(content, state, tries: Try[], t: Try): State
  isDone(content, state): boolean
  progress(content, state, tries): { done: number; total: number }
  judge(content, itemId, answer: unknown): boolean     // correctness; arithmetic: answer === problem.answer
  reportContribution(content, tries): PartReport
  presentationOf(part): AttemptPresentation            // ledger axes (§6)
  evidenceOf(part, t: Try): SkillEvidence[]            // skills; weight via weightOfTry
  bktMode(part): 'abacus' | 'visualization' | 'linear' | null   // null = not BKT evidence (fixes evidence-query.ts:98 defaulting to 'linear')
  // UI lives in a client-only module: ItemView, Dots, Intro, RetryIntro
}

interface Try {
  tryId: string            // client UUID; idempotency key; the ledger attempt event id
  itemId: string           // today slotId
  partIndex: number        // partNumber kept for legacy readers
  kind: 'first' | 'retry' | 'do_over'
  round: number            // first 0; retry 1..MAX; do_over: prior weighted tries of the item (practiceOnly tries excluded)
  practiceOnly: boolean    // do_over of an item whose latest weighted try was correct
  answer: unknown; isCorrect: boolean
  timing, help, recordedAt, review?   // unchanged from SlotResult
}

type SessionPart = { kind: 'arithmetic'; partNumber: number; type; format; useAbacus; estimatedMinutes; slots } | { kind: string; partNumber; content: unknown }
```

`arithmeticKind`: `Content = slots`, `State = { slotIndex, round, roundItems, pending, redeemed }`, `Item = getCurrentProblemInfo`'s return. `expectedItem` is the fix PR's `resolveCurrentItem`, moved here; `settlePosition` becomes `applyTry` + `isDone`. Structural code (`session-flow.ts`, `recordTry`, `session-report.ts`, the progress indicator's outer ring) imports only `PartKind` and `partKinds[part.kind]`; nothing structural reads `slots`, `retryState` or `currentSlotIndex` after Phase 5.

**`weightOfTry(t)`**, today's numbers exactly: `first` correct 1, `retry` round r correct 1/2^r, `do_over` of a wrong item correct 1/2^round (so the first do-over of a once-wrong item is 0.5 like its first retry), any wrong 0, `practiceOnly` 0. Today's rule that a wrong try carries weight 0 and therefore never lowers pKnown (`compute-bkt.ts:200-247`) is preserved unchanged; changing it is §8 Q10.

**`practiceOnly` has no pedagogical effect**, by reader (Phase 1 unless noted): `compute-bkt.ts` skips the row (no `opportunities`, `successCount`, `lastPracticedAt`); `bkt/evidence-query.ts` projects `kind` and `practiceOnly`; `skill-readiness.ts:78` and `linear-gate.ts:89-90` add `!r.practiceOnly`; `recordSkillAttemptsWithHelp` is not called for it (`session-planner.ts:1590,1750`); `calculateSessionHealth`'s streak and the song's best-streak skip it; the report counts it in `tries` and never in verdicts; the ledger adapter sends `manualRedo` with `recordedMasteryWeight: 0` and the rebase adds `practiceOnly` to the payload so the fold skips it (§6).

### 1.3 Proof: a second kind (sketch, not scheduled)

"Read the abacus": `Content = { items: { itemId, beadState, expectedValue, skillsRequired }[] }`, `State = { index }`, every try `first` (or `do_over`), `judge = answer === expectedValue`, `bktMode = null` (place-value skills are not BKT modes today), `presentationOf = { layer: 'read_abacus', modality: 'visual', abacusAvailable: false, input: 'keypad' }`, own `ItemView`. `PartTransitionScreen` asks `needsPhysicalAbacus(part)` instead of switching on three strings (`PartTransitionScreen.tsx:113-114`); `PartTransitionEvent.previousPartType/nextPartType` become `{ kind, label }`; `PracticeStateEvent.slotResults` is dropped in favour of the report (Phase 4). The flow machine, the try record and the report do not change. That is the test of D3.

## 2. Try record

- **Id.** The client mints `tryId` when it shows an item. Duplicate `tryId` → 200 with the current plan. Old clients send none → minted server-side.
- **Expectation.** `first`/`retry`: `itemId === expectedItem().itemId` else 409 `unexpected_item { expectedItemId }`. `do_over`: `acceptsDoOver` else 409. `status !== 'in_progress'` → 409. `flowState` rule per §1.1.
- **Every do-over is recorded**, including one of a correct item (today skipped, `ActiveSession.tsx` ~1517), stamped `practiceOnly: true`. `redoContext.originalWasCorrect` is no longer trusted.
- **Stamped by the server only:** `kind`, `round`, `practiceOnly`, `partIndex`, `partNumber`, `recordedAt`, `masteryWeight`. Client-sent `isRetry/epochNumber/masteryWeight` are dropped (fixes finding 5).
- **Legacy fields** `isRetry`, `epochNumber`, `isManualRedo`, `originalSlotIndex` keep being written until Phase 6 (readers in §7 Phase 6).
- **Review by `tryId`.** `PATCH …/plans/[planId]/tries/[tryId]`; `results/[resultIndex]` kept until Phase 6 and resolves the index to the try at that position.
- **Legacy `slotId` is unreliable.** `ActiveSession` advances optimistically for epoch-0 tries (`ActiveSession.tsx:1556-1558`, `void onAnswer(result)`) and builds the payload with `slotId: currentProblemInfo!.slotId` from the not-yet-refreshed plan (`:1502`), while `slotIndex` and `problem` come from the attempt actually answered (`:1503-1504`). The server never checked, so prod rows can name the **previous** slot. Legacy rows are therefore keyed by `(partNumber, originalSlotIndex ?? slotIndex, epochNumber)` and the problem content; `slotId` is trusted only when it agrees with the slot `slotIndex` names in `parts`. New rows (fix PR on) carry a verified `itemId`.
- **Normalizer** `normalizeTry(result, arrayIndex, planId, parts): Try`: `itemId` = the slot at `(partNumber, originalSlotIndex ?? slotIndex)` when it exists and its `problem` matches the row's, else the raw `slotId` (pre-`slotId` residue and sentinel-shaped rows get `legacy-item:<partNumber>:<slotIndex>`); `tryId ??= legacy:<planId>:<arrayIndex>` (stable because the only positional delete, worksheet unapproval, slices the tail: `unapprove/route.ts:76`); `kind = isManualRedo ? do_over : isRetry ? retry : first`; `round = kind === do_over ? priorWeightedTries : epochNumber ?? 0`; `practiceOnly = do_over && latest prior weighted try correct`; when two `first` rows exist for one item in one part (legacy bug 3) the array-first is `first` and the rest are `do_over` with `practiceOnly` derived. `source: 'recency-refresh'` rows are **not tries** (their plans have outcome `sentinel`, §3.2).

## 3. Breaks, completion, writers

### 3.1 Breaks
`BreakRecord { breakIndex, afterPartIndex, startedAt, endedAt?, reason?, game?, results?, gameResultId?, durationMs?, estimated?: boolean }`. `breaksOf(plan, gameResults)` (legacy path, used until Phase 5): `game_results where session_id = plan.id and session_type = 'practice-break' order by played_at`, one record per row with `durationMs` from the row and `estimated: true`, `afterPartIndex` inferred from `playedAt` against try times (else null); else the four legacy columns (one break at most). After Phase 5: `plan.breaks`, falling back to the legacy path when empty. An open break contributes to the live view, never to totals.

### 3.2 Completion
`sessionOutcome(plan): 'not_started' | 'in_progress' | 'completed' | 'abandoned' | 'deleted' | 'sentinel'` from `status` (`draft/approved → not_started`, `recency-refresh → sentinel`), with one legacy repair: `in_progress && completedAt != null → abandoned` (what `getActiveSessionPlan` already does, `:1123-1129`). `SessionReport.outcome` has the same union; list views filter `completed | abandoned`, active views `in_progress`; `sentinel`/`not_started` never render as sessions. `endedAt = completedAt`; `endedEarly = adjustments.some(ended_early)`.

### 3.3 Every writer of `session_plans`
| Writer | Treatment |
|---|---|
| `recordSlotResult` / `recordRedoResult` → `recordTry` | machine (`TRY_RECORDED`), CAS |
| `applySessionFlowEvent` callers | machine, CAS; `expectedFlowVersion` check kept |
| `completeSessionPlanEarly`, `abandonSessionPlan`, `getActiveSessionPlan` auto-abandon | machine, single CAS write |
| `attachments/[id]/approve/route.ts:129-139` | machine `WORKSHEET_APPROVED` (today writes `results`, `status`, `completedAt` directly) |
| `attachments/[id]/unapprove/route.ts:76-84` | machine `WORKSHEET_UNAPPROVED`; today leaves `completedAt` set with `status: in_progress`, which §3.2 would read as abandoned, so the event clears it |
| `updateSessionPlanResults` (adult review, `:1928-1965`), `applySlotResultReview` | not a flow change; CAS on `rowVersion`; bumps `rowVersion` so the pushed report updates |
| `updateSessionPlanRemoteCamera` (`:1971`), pause writes if Q5 | CAS on `rowVersion` |
| `offline-sessions/route.ts:181-196`, `lib/seed/create-student.ts:257-279`, `progress-manager.ts:339` sentinel insert | inserts, exempt; must produce rows `normalizePlan` accepts (fixture-tested) |
| `app/api/debug/practice-session/route.ts:200` (rewrites `parts`) | dev-only; CAS |

### 3.4 Position copies removed (Phase 5)
`prevPartIndexRef` + index-change effect (`ActiveSession.tsx:908, 1124-1159`), completion fallback (`:1117-1121`), `previousPartIndexRef` (`[studentId]/PracticeClient.tsx:125`), `redoState.returnTo*` (`:47-49, 499-500`), the linear-index decode (`:472-485`), `isInPartTransition`, and the broadcast's `currentPartIndex/currentSlotIndex/slotResults` as inputs.

## 4. The session report

```ts
interface SessionReport {
  rowVersion: number; sessionId; playerId
  outcome: SessionOutcome; endedEarly: boolean; startedAt: number | null; endedAt: number | null
  time: { activeMs; wallMs; breakMs; pausedMs; estimated: boolean }
  totals: Counts; parts: PartReportRow[]; breaks: BreakReportRow[]
  song: { status: 'none' | 'pending' | 'ready' | 'failed'; songId?; shareCode?; snapshotAtRowVersion? }
  position: { segment; flowState; currentItem?; progress: { done; total } } | null
  tries: TryRow[]
}
interface Counts { plannedProblems; problems; tries; firstTryCorrect; firstTryAccuracy: number | null; fixedInRetries; unresolved; finalCorrect; finalAccuracy: number | null }
```

Exact definitions (per part, summed for totals):
- **problem** = unique `itemId` as resolved by the normalizer (for legacy rows: part + slot index + content, never raw `slotId`, so two tries of different slots cannot collide on one lagged id); **attempted** = has a non-excluded try. `plannedProblems` = `progress.total` summed. Denominators use attempted problems.
- **try** = every `Try`, `practiceOnly` and excluded included, sentinels excluded. **excluded** = `source: 'teacher-excluded'`: counted in `tries`, dropped from every accuracy numerator and denominator (an item whose first try is excluded is not attempted).
- **first try** = the `kind: 'first'` try. **`mark_correct`** changes that try's `isCorrect`, so it flips `firstTryCorrect`: the adult is correcting the record of what happened, not the outcome.
- **final verdict** = `isCorrect` of the item's last weighted (non-`practiceOnly`, non-excluded) try. **fixed in retries** = first wrong ∧ final correct. **unresolved** = first wrong ∧ final wrong (includes divulged).
- **active time** = Σ `getEffectiveResponseTimeMs(try)` (`timing/effective-time.ts:100`), omitted samples 0. **wall time** = `end − startedAt`, where `end = endedAt` for `completed`, `max(last try recordedAt, last break endedAt)` for `abandoned` (auto-abandon can be days late), `now` for `in_progress`. **break time** = Σ closed breaks; `estimated: true` when any break came from `game_results`. **paused** = Σ `pauses[]` when Q5 lands, else 0.
- **song** is generated mid-session (`useSessionSongTrigger.ts` fires in the last part): lyrics are built from an in-progress snapshot, `snapshotAtRowVersion` records which; the share pages show live numbers (§8 Q4).

Builder `lib/curriculum/session-report.ts`, pure over `{ plan, tries, gameResults, song }`. Routes: `GET …/plans/[planId]/report`; `GET /api/observe/[token]/report`, which accepts a **revoked** token when `outcome !== 'in_progress'` (completion revokes shares today: `session-planner.ts:1605,1860,1887`, which would otherwise blank the ended view). Hook `useSessionReport(planId | token)` on `sessionReportKeys` in `lib/queryKeys.ts`; it subscribes to `session-report` and `session-ended` on the session room, applies a push only when `rowVersion` is newer, and **refetches on socket `connect`** (React Query's `refetchOnReconnect` is about the network, not the socket).

**Push.** After every CAS write the server emits `session-report { report }` to `session:<id>` via `getSocketIO()` and, on every end including natural completion, `session-ended` to `session:<id>`, `classroom:<id>` and `player:<id>` (today only `end_early`/`abandon` emit, only to the last two: `…/plans/[planId]/route.ts:186,192`, `socket-emitter.ts:275,328`). `subscribe-session-stats` subscribers (`useLiveSessionTimeEstimate`, one per active row) receive the reports too; intended, that hook reads them. No new polling; the two existing classroom polls are §8 Q8.

Migration targets (today's formulas verified; file lists are the owning packages in Phase 4):

| Pkg | View | Files | Today | Target |
|---|---|---|---|---|
| 4b | Summary | `app/practice/[studentId]/summary/page.tsx`, `…/session/[sessionId]/page.tsx`, `SummaryClient.tsx`, `components/practice/SessionHero.tsx`, `sessionSummaryUtils.ts`; delete `SessionSummary.tsx` + its `components/practice/index.ts:89` export | `results.length`; wall; in-progress = `startedAt && !completedAt` (`SummaryClient.tsx:259`) | report; "all eventually correct" = `unresolved === 0` |
| 4b | SessionPausedModal | `components/practice/SessionPausedModal.tsx:192` | local plan, excludes retries/redos | `position.progress` |
| 4c | Share link + OG | `app/observe/[token]/{page,PublicObservationClient,SessionEndedClient,opengraph-image}.tsx`, `app/api/observe/[token]/route.ts` | slot-index math (`page.tsx:154-160`); completed = `completedAt \|\| !startedAt` (`:101`); OG only from the song's frozen `promptInput` | token report route; ended view on pushed `session-ended`; OG from `totals` |
| 4c | Live observer | `hooks/useSessionObserver.ts`, `components/classroom/SessionObserverModal.tsx`, `components/practice/LiveSessionReportModal.tsx`, `app/practice/[studentId]/dashboard/DashboardClient.tsx:3840-3852`, `app/practice/[studentId]/observe/{page,ObservationClient}.tsx`; student side `hooks/useSessionBroadcast.ts` | broadcast `slotResults` deduped by problemNumber; duration = now − **current attempt's** start (`useSessionBroadcast.ts:192`) | report; broadcast keeps sub-second state only |
| 4d | Dashboard list, active cards | `lib/curriculum/progress-manager.ts` (`toPracticeSession`, `getRecentSessions`, `getPaginatedSessions`), `app/api/curriculum/[playerId]/sessions/route.ts`, `hooks/useSessionHistory.ts`, `components/practice/VirtualizedSessionList.tsx`, `hooks/useLiveSessionTimeEstimate.ts`, `components/practice/ContinueSessionCard.tsx`, `lib/curriculum/trends.ts`; delete caller-less `app/api/curriculum/[playerId]/sessions/history/route.ts` | `results.length`, Σ raw `responseTimeMs`; list never invalidated on completion | `toPracticeSession` from `buildSessionReport`; invalidate `sessionHistoryKeys.list` on `session-ended` |
| 4d | Classroom / parent active sessions | `app/api/classrooms/[classroomId]/presence/active-sessions/route.ts`, `hooks/useClassroom.ts:668`, `app/api/players/[id]/active-session/route.ts` (no `completedAt` guard), `hooks/useChildSessionsSocket.ts`, `hooks/useUnifiedStudents.ts` | slot math vs `results.length`; invented `startedAt` | `position`, `totals`, `startedAt`, `sessionOutcome` |
| 4d | MCP | `lib/mcp/tools.ts:495,629,794` | `getRecentSessions`; wall minutes; `results.length` | report fields |
| 4e | Song + share | `lib/session-song/extract-session-stats.ts:717` (planned minutes), `lib/tasks/session-song.ts:178-188` (recent = ten **oldest**), `lib/song-share/{getSharedSong,sessionFacts}.ts`, `app/song/[code]/{page,opengraph-image}.tsx`, `app/embed/song/[code]/page.tsx` | frozen `promptInput` | report snapshot for lyrics; live report on share pages |

## 5. Storage and migration

| Phase | Migration (via `/db-migrate`) | Columns |
|---|---|---|
| 3a | `add_session_plans_row_version_breaks_part_states` | `row_version integer not null default 0`; `breaks` JSON not null default `'[]'`; `part_states` JSON not null default `'{}'`; `pauses` JSON default `'[]'` only if Q5 |
| 6 | `drop_session_plans_legacy_position_and_break_columns` | drop `break_started_at`, `break_reason`, `break_selected_game`, `break_results`, `current_slot_index`, `retry_state` |

JSON: `SlotResult` + `tryId? kind? round? practiceOnly? partIndex?` (Phase 1); `SessionPart` discriminated on `kind` (Phase 2, absent = `arithmetic`); `breaks`, `partStates` (3a).

**Expand/contract (B1).** 3a–4: write `part_states`/`breaks` **and** `current_slot_index`/`retry_state`/`break_*`; read legacy. 5: read new (fall back to legacy when the new field is absent for an in-flight row); keep writing both. 6: stop legacy writes, drop columns. Rollback at any point before 6 lands on an image that reads what every image wrote. Chosen over a version stamp on the new columns because it needs no comparison logic and the legacy columns are complete for position (they cannot hold two breaks, which is why the song fix in 3b reads `game_results`, not `breaks`).

**Normalization, not backfill (D8).** `normalizePlan(plan, gameResults)` in `db/schema/session-plan-normalize.ts` (drizzle-free) yields `tries`, `kind` per part, `partStates`, `breaks`, `outcome`. Fixtures: three-part session with retries and redos; legacy duplicate originals; offline (slot-less parts, `currentPartIndex: 3`); sentinel (`parts: []`); worksheet (rows without `masteryWeight`, `session-converter.ts:60-90`); seed (`currentPartIndex: 1`); pre-`slotId` residue; lagged-`slotId` rows from the optimistic advance (§2). **Backfill would rewrite 100k+ JSON rows the ledger backfill keys by raw content (§6)**; a normalizer never does.

`sessionHealth` keeps being computed by `recordTry` (`calculateSessionHealth`, skipping `practiceOnly`) until Phase 4a derives it from the report's totals; readers (`PracticeSubNav`, `ActiveSession`, `PracticeClient`) are unchanged.

## 6. Ledger compatibility

The ledger (`feat/practice-ledger`) rebases onto this. Its plan retires `results` (ledger 4b writes from the fold, 4e drops the column), so **the post-ledger try store is `ledger_events` rows of kind `attempt.answered`**, read through `readTries(planId)`: `results` today, `foldAttempts(readEventsBySession)` after ledger 4b. `normalizePlan`, the report, `tries/[tryId]` and idempotency all go through that seam; after 4b idempotency is the `dedupe_key` unique index.

| Try | `attempt.answered` | Rebase change |
|---|---|---|
| `tryId` | the event `id` | event id = `tryId` for new rows (ledger ids are cuid2 today; accept UUIDs or mint `tryId` as cuid2 on the client, decide at rebase) |
| dedupe key | `attempt:<planId>:try:<tryId>` when the raw row has `tryId`; otherwise today's `attempt:<planId>:<slotId>:<epoch>:<redoN>` built by `fromSlotResult` from the **raw `SlotResult`** (`epochNumber ?? 0`, redoN = earlier rows with the same `(slotId, epoch)`, `L/ledger/backfill.ts:522-525`), never from a `Try` | the choice is made by row content at all three key sites: dual-write, backfill, review's `ensureAttemptEvent`. Legacy keys stay keyed by the raw, possibly lagged `slotId` (§2): they are still unique because `redoN` counts collisions, and already-backfilled keys must not move; but the fold's `slotId` is not a reliable item id for legacy rows, so any per-item grouping in the ledger (e.g. the session view) should take `itemId` from the normalizer or re-derive it from `partNumber`/`slotIndex`/content. Rebase item. |
| `kind: retry`, `round` | `retry: { epoch: round, ofSlotId }` | none |
| `kind: do_over` | `manualRedo: n`; add `practiceOnly: boolean` | fold skips `practiceOnly` for opportunities and recency |
| `masteryWeight` | `recordedMasteryWeight` | none; the fold keeps `recordedMasteryWeight ?? 1.0` (`L/readiness/engine/bkt.ts:89`) and never refolds |
| `isCorrect` | not stored; fold computes `studentAnswer === problem.answer` (`L/ledger/folds/attempts.ts`) | arithmetic unchanged; a non-numeric kind needs `answer: unknown` + the kind's `judge` at fold time, or stored `isCorrect` for `kind !== 'arithmetic'`. Rebase item, not needed for arithmetic |
| presentation | the adapter copies `layer: part?.type ?? 'linear'`, `abacusAvailable: part?.useAbacus`, constants `modality: 'visual'`, `input: 'keypad'` (`L/ledger/adapters/problem-result.ts:158-164`) | call `partKinds[kind].presentationOf(part)` instead |
| skills | `problem.skillsRequired` from `skillsExercised` | `evidenceOf` |

Lifecycle: `session.completed/abandoned` are emitted from the machine's committed patch for every path that goes through it (§3.3 makes worksheet approve/unapprove go through it); the offline insert emits at insert, as today. `session.completed.occurredAt = completedAt` as the ledger requires. The ledger's dual-write hooks in `recordSlotResult`/`recordRedoResult` (`L/…/session-planner.ts:1903-1911, 2091`) move into `recordTry`.

## 7. Phases

Each phase is one squashable PR; old clients keep working; a rollback of one release is safe; old sessions render. Tests: vitest with `src/test/journey-simulator/EphemeralDatabase.ts` (real migrations) and the `vi.mock('@/db')` pattern of `retry-redo-attribution.test.ts`. Lint changed files only (`npx @biomejs/biome check`). Every file below belongs to exactly one package (letters).

### Phase 1 — Try record, weights, practiceOnly (no schema)
- **Scope.** `Try` fields on `SlotResult`; `normalizeTry` with the legacy item resolution (§2); `weightOfTry`; idempotent record by `tryId` (the fix PR's exact-match resubmit rule becomes the fallback when `tryId` is absent); `resolveCurrentItem` is the expectation check and `SlotResultMismatchError`/`SLOT_MISMATCH` the 409 (the plan's `unexpected_item` is that code); `settlePosition` is the advance step `recordTry` keeps calling until Phase 3a moves it into the machine; every do-over recorded, `practiceOnly` stamped and skipped by every reader in §1.2; review by `tryId`.
- **Packages.** (a) server: `db/schema/session-plans.ts`, new `db/schema/session-plan-normalize.ts`, new `lib/curriculum/try-weight.ts`, `lib/curriculum/session-planner.ts` (`recordSlotResult`, `recordRedoResult`), `lib/curriculum/bkt/{compute-bkt,evidence-query}.ts`, `lib/curriculum/skill-readiness.ts`, `lib/curriculum/linear-gate.ts`, `lib/session-song/extract-session-stats.ts` (streak skip). (b) client: `components/practice/ActiveSession.tsx` (send `tryId`, record every do-over), `hooks/useSessionPlan.ts`. (c) review: `lib/curriculum/session-review.ts`, new `app/api/…/plans/[planId]/tries/[tryId]/route.ts`, `…/results/[resultIndex]/route.ts`, `app/api/…/plans/[planId]/route.ts` (actions).
- **Acceptance.** Extend `retry-redo-attribution.test.ts`: duplicate `tryId` no-op; do-over of a correct item stored with `practiceOnly`, weight 0, and BKT/readiness/linear-gate/`recordSkillAttemptsWithHelp` unchanged by it; do-over of a wrong item 0.5 and redeems; `weightOfTry` equals today's `calculateMasteryWeight` on every (kind, round, correct) combination; BKT parity: identical pKnown before/after over a fixture including rows without `masteryWeight`; `normalizeTry` fixtures (§5) including a prod-shaped row whose `slotId` names the previous slot, resolved to the slot `slotIndex` names, and two such rows that share a lagged `slotId` yet resolve to different items; review by `tryId` and by legacy index reach the same row.
- **Risks.** BKT parity (tested). **Owner hand test.** Wrong → dot → correct do-over → retry round skips it; correct problem redone → score unchanged; double submit.

### Phase 2 — Part-kind contract, arithmetic extracted (behaviour-identical)
- **Scope.** `PartKind`, registry, `arithmeticKind` absorbing `getCurrentProblemInfo`, `isInRetryEpoch`, `initRetryState`, `needsRetryTransition`, `calculateTotalProblemsWithRetries` and `recordSlotResult`'s advance block (`:1469-1526`); `SessionPart.kind`; `bktMode` replaces `evidence-query.ts:98`'s default; `isPlayable` replaces the auto-abandon test (`:1102-1110`). Position still written the legacy way.
- **Packages.** (a) `lib/curriculum/parts/{kind,registry}.ts`, `parts/arithmetic/{server,state,report}.ts`, `session-plan-helpers.ts` (re-exports), `session-planner.ts`, `bkt/evidence-query.ts`, `lib/curriculum/server.ts:165-184`. (b) `parts/arithmetic/ui.tsx` and `generateSessionPlan` setting `kind`.
- **Acceptance.** Golden replay: the same try sequences through old and new paths give identical rows. A stub kind compiles with no structural import of `slots`. `bktMode(null)` rows are excluded from BKT.
- **Risk.** Hidden helper imports; keep re-exports until Phase 5. **Owner hand test.** Three-part session with breaks behaves as before.

### Phase 3a — Row version, machine owns the rhythm (migration)
- **Scope.** Migration (§5). `applyFlowEvent` gains `TRY_RECORDED` (implicit transition rule, §1.1), `SESSION_ENDED_EARLY`, `WORKSHEET_APPROVED/UNAPPROVED`, writes `status`/`completedAt`/`currentPartIndex`/`breaks`/`partStates`. `recordTry`: load → idempotency check → kind → machine → `UPDATE … WHERE id AND row_version = read`; on 0 rows reload and recompute, **at most 3 attempts**, then 503 `write_contention`. Every writer in §3.3 becomes a CAS. `expectedFlowVersion` check unchanged. `PART_TRANSITION_COMPLETED` ignores `shouldRunBreak`; the server enters `part_transition` after every finished part with parts remaining. Reads stay on legacy columns.
- **Files (one package).** `drizzle/<next>_*.sql` + meta, `db/schema/session-plans.ts`, `lib/curriculum/session-flow.ts`, `session-planner.ts`, `session-plan-normalize.ts`, `attachments/[attachmentId]/{approve,unapprove}/route.ts`, `app/api/debug/practice-session/route.ts`.
- **Acceptance.** Two concurrent `recordTry` calls: one wins, the loser retries and sees the new expected item or returns no-op on duplicate `tryId`; four concurrent calls exhaust to 503 without a lost write. `end_early`, worksheet approve/unapprove leave `status`/`flowState`/`completedAt` consistent in one `rowVersion`. In-flight fixture (legacy columns, empty `part_states`) resumes correctly; legacy fixture with break columns normalizes to one break. Try in `part_transition` with breaks off is accepted and transitions; with breaks on it is accepted and the break is recorded skipped. Try during `break_active` is 409.
- **Rollback.** Old image ignores the new columns and keeps writing legacy; roll-forward reads legacy. Tested by writing with the new code, mutating legacy columns as the old code would, and resuming.

### Phase 3b — Breaks readers for the song
- **Scope.** `tasks/session-song.ts:201-210, 532-537` read every `game_results` row ordered by `played_at`; recent sessions newest-first (`:178-188`); `extract-session-stats.ts` takes a break list. Lands after, or rebased over, the main checkout's in-flight song edits.
- **Files.** `lib/tasks/session-song.ts`, `lib/session-song/extract-session-stats.ts`.
- **Acceptance.** Two breaks → both named in the song input. **Owner hand test.** Two-break session; song mentions both games.

### Phase 3c — Client renders from `flowState`; not-practicing 409
- **Scope.** `PracticeClient` renders the transition screen from `flowState === 'part_transition'`; keeps sending `shouldRunBreak` for one release (an old server treats `undefined` as false, `session-flow.ts:82,96`); on 409 `STALE_FLOW_VERSION` the mutation invalidates `sessionPlanKeys.active` and the fresh plan drives rendering (no toast; the server already returns the plan when the event is a no-op from the fresh state). Server: try outside `practicing` → 409 `not_practicing` with the plan in the body; the client applies it.
- **Files.** `app/practice/[studentId]/PracticeClient.tsx`, `components/practice/ActiveSession.tsx`, `hooks/useSessionPlan.ts`, `session-planner.ts` (the 409), `…/flow-events/route.ts`.
- **Acceptance.** Reload during `part_transition` shows the screen and completes the transition; stale token → refetch, no error. **Owner hand test.** Start on an old tab, deploy, finish: no stall; break runs.

### Phase 4a — Report builder, routes, hook, push
- **Scope.** `buildSessionReport`, `readTries` seam, both routes (revoked-token rule), `useSessionReport`, `session-report`/`session-ended` emission from the CAS commit, `sessionHealth` derived from totals, query keys.
- **Files.** `lib/curriculum/session-report.ts`, `lib/curriculum/read-tries.ts`, `app/api/curriculum/[playerId]/sessions/plans/[planId]/report/route.ts`, `app/api/observe/[token]/report/route.ts`, `hooks/useSessionReport.ts`, `lib/queryKeys.ts`, `lib/classroom/socket-events.ts`, `lib/classroom/socket-emitter.ts`, `session-planner.ts` (emit hook), `lib/session-shares` validate (`allowEnded`).
- **Acceptance.** The findings' 10/3-wrong/5-min-break fixture → problems 10, tries 13, first-try 70 %, fixed 3, final 100 %, active = Σ effective, wall = end − start, one 5-min break; abandoned fixture → `abandoned`, wall from last activity; excluded first try drops the item from denominators; `mark_correct` flips `firstTryCorrect`; sentinel/offline fixtures build; two writes → strictly increasing `rowVersion` pushes; revoked token serves an ended report and refuses a live one.

### Phases 4b–4e — One PR per view group (parallel, disjoint files per §4 table)
4b summary + paused modal; 4c share link + OG + live observer + teacher observe; 4d dashboard list, active cards, classroom/parent active sessions (poll removed if Q8 approved), MCP; 4e song + share. Each: snapshot test rendering from the shared report fixture so every screen shows the same numbers; `useSessionHistory` invalidated on `session-ended` (4d). **Owner hand test (after all):** share link, observer, dashboard, summary and `get_practice_sessions` for one session show identical numbers.

### Phase 5 — Flip reads to the new columns; remove position copies
- **Scope.** Readers switch to `partStates`/`breaks` (legacy fallback for in-flight rows); still dual-writing. Client copies in §3.4 removed; do-over sends `itemId`; `PartTransitionEvent` carries `{ kind, label }`; `PartTransitionScreen` asks the kind; `useSessionSongTrigger` reads `report.position`; structural slot readers moved onto the report or the kind's UI.
- **Packages.** (a) server flip: `session-planner.ts`, `session-plan-normalize.ts`, `session-flow.ts`. (b) practice client: `components/practice/{SessionProgressIndicator,ActiveSession,PartTransitionScreen,PracticeSubNav,SessionPlanOverview,AllProblemsSection,BrowseModeView,LiveResultsPanel,MobileResultsSummary}.tsx`, `app/practice/PracticeClient.tsx`, `app/practice/[studentId]/PracticeClient.tsx`, `hooks/{useSessionBroadcast,useSessionSongTrigger,useSessionTimeEstimate,useProgressiveAssistance}.ts`, `lib/curriculum/autoPauseCalculator.ts`, `lib/classroom/socket-events.ts`.
- **Acceptance.** Import gate test: no file under `components/practice`, `app/practice`, `hooks` imports `retryState`, `currentSlotIndex` or `.slots` except `parts/arithmetic/ui.tsx` and the normalizer. Observer/broadcast tests updated. Rollback test: a row written by Phase 5 code read by Phase 3a code.
- **Owner hand test.** Full session with do-overs across parts; transitions without flicker; observer follows.

### Phase 6 — Legacy readers, then drop (after the ledger rebase, §8 Q9)
- **Scope.** (a) Readers of `isRetry/epochNumber/isManualRedo/originalSlotIndex` move to `normalizeTry().kind/round`: `skill-readiness.ts:78`, `linear-gate.ts:89-90`, `components/practice/AttemptHistoryPanel.tsx:42-123`, `BrowseModeView.tsx:121-171`, `bkt/evidence-query.ts`, and the ledger's backfill/review/parity (`L/ledger/parity.ts:323-324`) in the rebase. (b) Stop legacy writes, migration dropping six columns, delete `results/[resultIndex]`, `record_redo`, re-export shims.
- **Acceptance.** New rows (no legacy fields) read identically through every reader in (a); normalizer fixtures; BKT parity; ledger backfill keys legacy rows identically. **Risk.** Irreversible.

## 8. Open questions for the owner

1. **Denominators for unfinished sessions:** accuracy over attempted, progress "of planned". *Recommend yes.*
2. **"Active time" headline**, breaks and pauses excluded and shown separately. *Recommend confirm.*
3. **Push payload:** full report vs version ping + refetch. *Recommend full report*; token observers then need no extra auth path.
4. **Song share / OG numbers:** live from the report (lyrics stay frozen, built mid-session) or frozen with the song. *Recommend live.*
5. **Pauses:** the columns exist (`session-plans.ts:638-648`) but nothing writes them; pause is socket-only (`PracticeClient.tsx:104`). Logging means two machine events and a `pauses` column in 3a. *Recommend yes, in 3a*; otherwise `pausedMs` stays 0.
6. **Do-over of a queued retry redeems it** (today). *Recommend keep.*
7. **Ended-early = `completed` + `endedEarly`.** *Recommend keep.*
8. **Existing polls:** `useActiveSessionsInClassroom` 15 s (`hooks/useClassroom.ts:668`) and `useClassroomPresence` 30 s (`:584`). Remove the first in 4d once `session-ended` fires on natural completion; the second is presence, not sessions. *Recommend remove the first; leave the second unless the rule covers it.*
9. **Phase 6 timing:** after the ledger rebase, since its backfill reads legacy fields. *Recommend after.*
10. **Wrong answers carry no evidence today**: every wrong try is stamped weight 0 (`calculateMasteryWeight`), and BKT blends by that weight (`compute-bkt.ts:200`), so a wrong answer never lowers pKnown; only the absence of correct ones does. `weightOfTry` reproduces this exactly. Change it (e.g. wrong tries weighted 1/2^round so BKT's slip update applies)? *Recommend yes, as a separate decision with a BKT re-baseline over seeded profiles*; if approved it is one line in `weightOfTry` in Phase 1 plus the parity test's expected values. Not scheduled otherwise.

## 9. Findings corrected or sharpened while verifying

- Summary renders `SessionHero.tsx`, not `SessionSummary.tsx`; the latter has only test/story consumers plus the `components/practice/index.ts:89` export. Finding 8's grouping bug is in `SessionSummary.tsx:121-132`; check `SessionHero` for the same before deleting.
- Natural completion emits no socket event at all; `emitSessionEnded*` fires only from `end_early`/`abandon`.
- The live observer's duration is since the current attempt started, not since session start.
- Two classroom polls exist (`useClassroom.ts:584, 668`).
- The history route has no caller at all; the song's "recent sessions" is the ten oldest (`createdAt` ascending); the `limit(1)` read appears twice.
- Readers the findings missed: teacher observe page, `ContinueSessionCard`, `DashboardClient` active-session info, `useLiveSessionTimeEstimate`, `useChildSessionsSocket` + `players/[id]/active-session` (no `completedAt` guard), `trends.ts`, and the structural slot readers in Phase 5 (b).
- `completePartTransition` (`:1895-1906`) is correct as written; it is simply never called.
- `recordSlotResult` bumps `flowVersion` only when the flow state changed (`:1543-1547`); a plain try is an unversioned write.
- Legacy `slotId` can name the previous slot (optimistic advance, `ActiveSession.tsx:1502, 1556-1558`); the findings treated `slotId` as a reliable key. Coordinator-verified; folded into §2, §4, §6.
- Worksheet unapproval slices the tail (`unapprove/route.ts:76`) and leaves `completedAt` set with `status: in_progress`.

## 10. Review (2026-11-26)

Adversarial review at the same tier; each finding verified against the code before acting.

| # | Ruling |
|---|---|
| B1 | **Changed.** Expand/contract (coordinator's ruling): 3a writes both and reads legacy, 5 flips reads, 6 drops. Stamp variant rejected: more logic, and legacy columns are complete for position anyway. |
| B2 | **Changed.** New `rowVersion` (CAS for every writer, orders pushes); `flowVersion` keeps its meaning as the client token. `recordTry` retries ≤3 then 503. Stale token → client refetches, no toast. |
| B3 | **Changed.** Implicit `PART_TRANSITION_COMPLETED` for a try in `part_transition` in 3a–3b; 409 only from 3c when the client renders from `flowState`. Reason in §1.1. |
| B4 | **Changed.** Legacy keys from the raw `SlotResult`; new form `attempt:<planId>:try:<tryId>` chosen by row content at all three sites; fold keeps `recordedMasteryWeight`; `doOverRound` dropped; attempt event id = `tryId`; post-ledger store = `ledger_events` behind `readTries`. |
| M5 | **Accepted.** §3.3 lists every writer with its treatment; worksheet approve/unapprove become machine events. |
| M6 | **Accepted.** BKT keeps `masteryWeight ?? 1.0`; `weightOfTry` stamps new rows only; parity test includes weight-less rows. |
| M7 | **Accepted.** `practiceOnly` stamped and skipped by every reader named in §1.2. Side note → §8 Q10. |
| M8 | **Accepted.** Phase 6 (a) migrates those readers first; acceptance on new rows. |
| M9 | **Accepted.** Structural readers assigned to Phase 5 (b) and Phase 2 (a); `sessionHealth` owned (§5); `SessionPart` becomes a `kind` union; `bktMode` fixes the `'linear'` default; §1.3 wording fixed. |
| M10 | **Accepted.** New client keeps sending `shouldRunBreak` for one release (3c). |
| M11 | **Accepted.** Excluded tries, `mark_correct`, sentinels, duplicate originals, abandoned `wallMs`, reconstructed/open breaks all defined in §4 and §2. |
| M12 | **Accepted.** One `SessionOutcome` union in §3.2, used by the report. |
| M13 | **Accepted.** Refetch on socket `connect`; revoked tokens serve ended reports; stats subscribers intended. |
| M14 | **Accepted.** Song snapshot is in-progress; `snapshotAtRowVersion`; share pages live (Q4). |
| M15 | **Accepted.** 3a/3b/3c, 4a + 4b–4e; every file has one package; `session-review.ts` in 1(c). |
| M16 | **Accepted.** Adapter described as it is; `presentationOf` replaces it at rebase; non-numeric correctness and lifecycle emission corrected in §6. |
| M17 | **Accepted.** Q5 reworded: new machine events + column. |
| M18 | **Accepted.** D5/§5: dual-write until Phase 6, which follows the ledger rebase. |
| M19 | **Accepted.** §2 says tail slice. |
| M20 | **Accepted.** D1 and §1.1 say the machine calls `applyTry/isDone` through the registry. |
| M21 | **Accepted.** Barrel export deleted in 4b. |
| M22 | **Accepted, one correction.** The 15 s poll is at `useClassroom.ts:668` (not :23-29); the 30 s poll at `:584` is presence. Both in Q8. |
| M23 | **Accepted.** `practiceOnly` tries do not count toward `round`. |
| C1 (coordinator) | **Accepted.** Legacy `slotId` lag: normalizer, `itemId`, report grouping and the ledger key discussion key legacy rows on `(partNumber, originalSlotIndex ?? slotIndex, epoch)` + problem content; `slotId` trusted only when it agrees with the indexed slot. Phase 1 built on the fix PR's names. |
