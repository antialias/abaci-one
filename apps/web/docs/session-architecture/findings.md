# Session architecture: findings (2026-11-26)

Fact base for the session-architecture rework. Read from `origin/main` at `6423f579b`. Paths are under `apps/web/src/`. "Confirmed" means a test or a direct read of the code; "reported" means a read-only survey pass, spot-checked where marked.

## Owner decisions (2026-11-26)

- **The rhythm is fixed:** practice part → game break → practice part → … → last part → song + session summary. New kinds of practice must fit this rhythm, not change it.
- **Architecture before diversity:** session structure must depend only on an abstract part, with no knowledge of problems/slots, before any new kind of practice is added.
- **Every view reports consistently:** the live share link, the parent/teacher live observer, the reports/history/dashboard, the summary page, the MCP tools and the song all read one server-built session report with fixed meanings.
- **Score:** the headline is first-try accuracy. "Fixed in retries" sits next to it, and final accuracy is also available.
- **Do-overs:** every try is recorded with its own id. A do-over of a wrong problem counts like a retry (weighted by round). A do-over of a correct problem is recorded with zero mastery weight. How much a try counts is decided by readers, not by the submitter.
- **Order:** this rework comes first. The practice ledger (uncommitted, `~/projects/soroban-abacus-flashcards-practice`, plan at `apps/web/docs/practice-ledger-plan-of-record.md` there; read-only, not ours) is rebased onto it later. Keep the contracts compatible with that plan's `attempt.answered` event, its `presentation` shape and its session-view fold.
- **The three confirmed bugs ship first** as a small fix on main.
- **Duration:** default chosen by the integrator, not yet confirmed by the owner. The report carries both active time (effective per-try time, no breaks or idle) and wall time; "practice time" means active time.

## Problems, tries, retries, do-overs: today's model

- `ProblemSlot.slotId = crypto.randomUUID()` at plan time (`lib/curriculum/session-planner.ts` createSlot ~2174). A slot also has a position: `partNumber` (typed `1|2|3`) and `index`.
- Every try is appended to `session_plans.results` (JSON `SlotResult[]`, `db/schema/session-plans.ts:247`). A try carries `slotId`, `partNumber`, `slotIndex`, and for retries `epochNumber`, `originalSlotIndex`, `isRetry` and `masteryWeight` (1, 0.5, 0.25, or 0 if wrong).
- Retries: a wrong answer queues the same problem (`RetryItem`, never regenerated) into `retryState[partIndex]` for a retry round at the end of the part. `MAX_RETRY_EPOCHS = 2`, after which the answer is revealed ("divulged").
- Do-overs: the kid taps a finished dot (`SessionProgressIndicator.tsx` ~505: any slot with a result, including slots in the active retry round). The tap gives a flat "linear index", which `PracticeClient.tsx:472` decodes into (partIndex, slotIndex). `recordRedoResult` (`session-planner.ts:1652`) appends `isManualRedo: true` and, if the original was wrong and the do-over is right, removes the item from `pendingRetries` and adds its slot INDEX to `redeemedSlots`.
- **The server never looks anything up by `slotId`.** `recordSlotResult` (`session-planner.ts:1335`) attributes the try from its own cursor: `currentPartIndex`, `currentSlotIndex` and `retryState.currentEpochItems[currentRetryIndex]`. It does not check that the submitted `slotId` or `slotIndex` matches, it has no idempotency, and it does no version check (an unconditional whole-row update).
- The client shows `getCurrentProblemInfo(plan)` (`db/schema/session-plan-helpers.ts:198`). That function skips redeemed items; the server's cursor does not.

### Confirmed bugs (failing tests: `src/test/retry-redo-attribution.test.ts`)

1. A correct do-over of the current retry item makes the next answer be recorded against the redeemed slot: the stored try has `slotId` = slot 1 but `originalSlotIndex` = 0, and slot 1 is shown again.
2. When do-overs redeem every remaining retry item, `getCurrentProblemInfo` returns null while the plan stays `in_progress`: the session is stuck.
3. A duplicate submit with the same `slotId` is recorded twice and skips the next slot.

### Confirmed by reading (no test yet)

4. A do-over of a problem that was answered correctly is not recorded at all (`ActiveSession.tsx` ~1517: "Original correct = pure practice, no recording").
5. Do-over credit: the client sends `isRetry: true, epochNumber: original+1`, but the server overwrites this with `epochNumber: 0, isRetry: false, masteryWeight: 1.0` (`session-planner.ts` ~1690). A do-over gets full credit where the same try in a retry round gets 0.5.
6. Every writer read-modify-writes the whole row. Only `applySessionFlowEvent` compare-and-sets on `flowVersion`, so `recordSlotResult` and `recordRedoResult` can lose concurrent writes.
7. Adult review addresses a try by its array position (`PATCH …/results/[resultIndex]`). Video and metadata routes address problems by `problemNumber`.
8. `SessionSummary.tsx:121-132` "all eventually correct" groups by `originalSlotIndex ?? slotIndex` without `partNumber`, so part 1's slot 0 can hide part 2's slot 0.

## Structure ↔ part coupling (reported, key items spot-checked)

- **The per-answer recorder owns the rhythm.** `recordSlotResult` (`session-planner.ts:1470-1564`) decides end of part (slot count + retry rounds), end of session, and the next `flowState` (`part_transition` / `practicing` / `completed`), bumps `flowVersion`, sets `status`/`completedAt`, and clears `breakStartedAt`/`breakResults`, all outside the flow state machine (`lib/curriculum/session-flow.ts`). It never checks the current `flowState`, so an answer is accepted mid-break.
- **The client decides whether a break runs.** `PracticeClient.tsx:826-829` computes `shouldRunBreak` and sends `PART_TRANSITION_COMPLETED{shouldRunBreak}` to the `flow-events` route, which accepts it (`session-flow.ts:81-112`, confirmed). The server's own `completePartTransition` (`session-planner.ts:1895`) is reachable only from a PATCH action the client hooks don't call. `PART_TRANSITION_STARTED` is never emitted.
- **The part transition is driven by the client:** ActiveSession detects the index change (`ActiveSession.tsx:1124-1159`, local `isInPartTransition`), with a completion fallback at :1117-1121. The retry-round transition (:1171-1191) is a second, parallel transition layer.
- **Position is three things:** `currentPartIndex` + `currentSlotIndex` + `retryState[part]` (during retries `currentSlotIndex` stays parked at the end), plus client copies (`prevPartIndexRef`, `previousPartIndexRef`, `redoState.returnTo*`, broadcast indices).
- **Completion has three signals:** `status`, `flowState === 'completed'` and `completedAt`, each read by different callers.
- **Breaks are one set of columns.** `BREAK_RESULTS_ACKED` nulls `breakSelectedGame`/`breakReason`/`breakResults` (`session-flow.ts` ~184, confirmed), contradicting the "preserve for the song" comment in `recordSlotResult`. The song reads `game_results … limit(1)` with no ordering (`lib/tasks/session-song.ts:201-210`, confirmed), so with two breaks it gets one arbitrary result.
- **Structural screens and events switch on the part-type enum:** PartTransitionScreen (abacus put-away/get-out logic and narration), the `PartTransitionEvent` socket payload, and `SessionPart = {partNumber: 1|2|3, type, format, useAbacus, slots}`.
- **Progress counts have two definitions:** `getCompletedProblemCount` = `results.length` (all tries) versus slot-index arithmetic (`PracticeClient.tsx:278-286`, `ActiveSession.tsx:633-643`).
- **The song trigger** (`hooks/useSessionSongTrigger.ts`) requires the last part, ≥60% of slots completed and ≤180 s remaining from `avgTimePerProblemSeconds`, all slot math.
- `getActiveSessionPlan` (`session-planner.ts:1102-1146`) auto-abandons any session with a slot missing `problem`, so a part without slots would be treated as legacy and abandoned.
- `completeSessionPlanEarly` / `abandonSessionPlan` apply the flow event and then write `status` in a second, non-atomic update.

## Views (reported; observer retry dropping and summary grouping confirmed)

| View | Source | Done count | Accuracy | Duration |
|---|---|---|---|---|
| Share link `app/observe/[token]` | plan row; live part = socket broadcast; OG image = the song's frozen stats | slot arithmetic | from song only, absent without a song | none |
| Live observer (`SessionObserverModal`, `useSessionObserver`, `LiveSessionReportModal`) | the student's socket broadcast (`useSessionBroadcast`), including flowState | slots; live results deduped by problemNumber (drops retries seen live, keeps retries seeded at join) | all tries | `Date.now() - start` (breaks included) |
| Summary (`summary/`, `SessionSummary`, `sessionSummaryUtils`) | plan row | `results.length` | all tries; plus a per-slot "eventually correct" celebration | `completedAt - startedAt` wall time |
| Dashboard list (`getPaginatedSessions` → `toPracticeSession`, `progress-manager.ts:541`) | completed+abandoned plans | `results.length` | all tries | sum of raw `responseTimeMs`, plus a "clean" effective time |
| History route `api/curriculum/[playerId]/sessions/history` | hand-copied `toPracticeSession` without the clean-time fields; no UI caller found | — | — | raw sum |
| MCP `lib/mcp/tools.ts` | `getRecentSessions`; `get_active_session` | `results.length` / slots; `currentProblem` = per-part `results.length + 1` | all tries | wall minutes |
| Song + song share (`lib/session-song/extract-session-stats.ts`, `lib/song-share`) | plan + one `game_results` row; frozen at song time | `results.length` of slots ("13 of 10 problems") | all tries | the PLANNED target minutes |
| SessionPausedModal | plan | excludes retries and redos (the only view that does) | — | — |

Inconsistencies, for a session of 10 problems with 3 wrong and fixed in retries plus a 5-minute break:
- **Done count:** 10/10 (observer) vs 13 (summary, MCP, dashboard) vs "13 of 10" (song share).
- **Accuracy:** 77% next to "all eventually correct".
- **Duration:** about 15 / 8 / 7 / 10 minutes depending on the view.
- **"Completed"** is tested six ways (`completedAt` only, `status='completed'`, completed|abandoned unflagged, `!= deleted && completedAt`, `in_progress && !completedAt`, the student's flowState). An abandoned session with `completedAt` shows "Complete!" on the share link and looks normal on the dashboard and in MCP.
- **The live observer's `session-ended`** is emitted only to the `classroom:`/`player:` rooms (`lib/classroom/socket-emitter.ts:275,328`, confirmed). Observers likely join only `session:<id>` (not confirmed).
- **Song share and OG stats are frozen** at song time and drift after adult edits.

Existing helpers that could be the single source: `getTotalProblemCount`, `getSessionPlanAccuracy` and `getSlotRetryStatus` (part-aware per-slot final outcome) in `session-plan-helpers.ts`; `toPracticeSession`; and `lib/curriculum/timing/effective-time.ts` (`getEffectiveResponseTimeMs`, `classifyAttemptTiming`). Nothing yet computes elapsed time minus breaks, or first-try accuracy.

## Constraints

- **Another session** ("LLM audit, songs on Claude alone") has uncommitted edits in the main checkout (`~/projects/soroban-abacus-flashcards`): `lib/tasks/session-song.ts` and `app/api/admin/songs/route.ts`. Never touch that checkout and never message that session. Expect to rebase over its song work.
- **App rules** (`apps/web/.claude/CLAUDE.md`):
  - React Query for all server state, query keys in `lib/queryKeys.ts`.
  - `createSocket()`, never `io()`.
  - `data-*` attributes on new elements.
  - Never fork, always factor.
  - Implement everywhere.
  - Schema changes only through the `/db-migrate` procedure (`.claude/procedures/database-migrations.md`), never `drizzle-kit push`.
  - Never run `pnpm dev`.
  - Nothing lands until the owner has tested and approved.
- **Owner rules:**
  - No polling or sleep-based race fixes without consulting the owner first.
  - Clean architecture over workarounds.
  - No force-push.
  - Each change lands as one squashable PR the owner merges.
- **Lint hazard:** `npm run pre-commit` fails on a clean tree and its `--write` steps rewrite about 40 unrelated files. Lint only the files you changed, with `npx @biomejs/biome check <files>` (bare `npx biome` is a bogus no-op package), and revert any collateral changes.
- **Tests:** vitest with the in-memory DB harness `src/test/journey-simulator/EphemeralDatabase.ts` (see `src/test/session-targeting-trace.test.ts` for the `vi.mock('@/db')` pattern). Workspace packages must be built once per worktree: `pnpm --filter @soroban/abacus-react --filter @soroban/llm-client --filter @soroban/karaoke-player build`.
