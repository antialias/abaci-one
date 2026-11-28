# Practice kinds plan: review 1 (2026-11-27)

Reviewed: `plan-of-record.md` rev. 1 at `648336317` on `docs/practice-kinds-plan` (code at `c12abd87f`). Every `path:line` below was read in this worktree; the ledger checkout (`L/`) read-only. Paths are under `apps/web/src/` unless marked.

Counts: 2 blockers, 10 major, 7 minor.

Verdict in one line: the premise holds (the three premise-change citations are accurate; the server-judge, envelope and kind-blind-structure decisions are sound), but the phase schedule does not. Two coexistence holes (R1, R2) must be closed before K1 lands, the K3/K4/K6 order needs one swap (R4), and the composer needs a time budget that counts breaks (R5).

## Blockers

### R1 — Dropping the legacy top-level copies at K5 breaks open old bundles and freezes BKT for new rows
- **Severity:** blocker
- **Section:** §3.3 (K5 row), §3.1 "legacy arithmetic top-level copies, written one release more", K13
- **Plan says:** at K5 the server stops writing `slotId, slotIndex, problem, studentAnswer, skillsExercised, usedOnScreenAbacus` "one release after K2 made every reader envelope-first"; separately (§3.3 last paragraph, §7 Q6) the copies stay "until the owner retires them". The two statements contradict each other, and the first is wrong on the facts.
- **Evidence:**
  - K2 moved no readers. Group b moved in K1b; group c (history, review, browse, observer, MCP errors, song) moves in **K5b**, the same release as the drop. `extract-session-stats.ts` reads `.studentAnswer` (eight patterns per §2), `SessionObserverModal.tsx:477-483`, `tools.ts:817-822`.
  - Old **bundles** cannot be upgraded by a release. `ActiveSession.tsx:1700-1710` and `SessionProgressIndicator.tsx:203, 217, 231` read `r.slotIndex`, `itemSlotIndexOfRow(r)`, `r.problem` on rows to draw the dots and decide a do-over's divulged state; the normalizer every old bundle carries resolves an item by `result.slotId / slotIndex / problem` (`session-plan-normalize.ts:111-118`) and falls to `legacy-item:<n>:undefined` without them.
  - `batchGetRecentSessionResults` drops any row whose `skillsExercised` is not an array (`session-planner.ts:1284`). The plan's K1b row rewrites `:1289` but never names `:1284`.
- **Failure scenario:** a tab opened on the K4 bundle (days old, per D9) is mid-session when K5 deploys. Every try from then on is stored without `slotIndex`/`problem`; the dots show the wrong items, a do-over from a dot targets the wrong slot, and the history panel shows blank answers. Worse and silent: if `:1284` survives in any reader (the MCP leaderboard route, scripts, the journey simulator's `getRecentSessionResults`), every post-K5 try vanishes from mastery history and the kid's readiness stops moving with no error anywhere.
- **Fix:** take the drop out of the phase table entirely; it is an owner decision after a bundle-age window, as §7 Q6 already says. In K1b, list `:1284` explicitly and replace it with "has `evidence` or `skillsExercised`". Add a normalizer fixture: a row with `itemId`+`payload` and no legacy copies must resolve to the same `Try` as one with them (the plan's fixture (2) is this; make it also run through `SessionProgressIndicator`'s helpers, which are the old bundle's readers).

### R2 — A rollback image that does not know a kind cannot finish the part before it
- **Severity:** blocker
- **Section:** §3.3 K7/K8 row ("a rollback target is K3+"), §4 K4 conformance case "an unknown kind after a rollback", §4 K8 acceptance ("409 on record, report 0/0 for that part, end early works")
- **Plan says:** an image without the kind handles a session containing it safely.
- **Evidence:** `partStatesPatch` (`db/schema/session-plan-normalize.ts:264-276`) calls `partKindOf(next)` to write the next part's initial state when the cursor moves into it and no entry exists; `partKindOf` throws for an unknown kind (`parts/registry.ts:30-34`). The flow machine calls it from `TRY_RECORDED` (`session-flow.ts:530`). `part_states` entries are written only at that moment (no `partStates` in `session-planner.ts` at plan creation), so the entry is always absent when the preceding part finishes. `partStateOf` (`:229-234`) also throws for a non-arithmetic unknown kind.
- **Failure scenario:** K8 is rolled back to K7 while a kid is in part 1 (arithmetic) of an `arithmetic → read_abacus → arithmetic` session. The last try of part 1 throws inside the CAS, the route returns 500, the write queue resends once, 500 again; the kid sees "That one didn't save" on every submit and the session cannot move. End-early works (`SESSION_ENDED_EARLY` touches no kind, `:371-390`), but that is the only exit.
- **Fix:** in K3, `partStatesPatch` uses `findPartKind` and writes no entry for an unknown kind (the K8 image, back on, derives the initial state as `partStateOf` already does for a missing entry); `partStateOf` returns `undefined` for an unknown kind instead of throwing. Add the case to the conformance suite: "finish the part before an unknown-kind part" and "end early from inside an unknown-kind part".

## Major

### R3 — Renaming the report's `type` to `presentation` breaks old bundles over the wire
- **Severity:** major
- **Section:** §4 K3 acceptance ("Report snapshot identical except `type` → `presentation`"), §2 row for `session-report.ts`
- **Evidence:** the report crosses the wire (`app/api/curriculum/[playerId]/sessions/plans/[planId]/report/route.ts`, `app/api/observe/[token]/report/route.ts`); `SessionHero.tsx:55-56` reads `part.type` from it to draw the summary chips; `session-report.ts:63, 680` is the field.
- **Failure scenario:** K3 deploys; an open summary tab or an observer link on the K2 bundle refetches the report and shows no part chips.
- **Fix:** additive: `presentation` beside `type` (same value for arithmetic) for one release; the snapshot gains a field rather than renaming one.

### R4 — K4's dev route calls `kind.plan`, which K6 adds
- **Severity:** major (ordering)
- **Section:** §4 K4 scope ("a new `?kind=&presentation=` builds a one-part plan through `kind.plan` with a fixed `rng`"), §4 K6a scope ("its `plan` absorbs `buildSessionPart`…")
- **Evidence:** `plan` and `offer` are not on today's contract (`parts/kind.ts:61-89`); K3 adds `presentations, items, itemOf, describePart, presentationOf`; `plan` first appears in K6a. The dev route today rewrites slots (`app/api/debug/practice-session/route.ts:190-194`).
- **Failure scenario:** K4 cannot be built as written; either it reaches into `buildSessionPartAsync` (reopened in K6) or it waits.
- **Fix:** move the `?kind=&presentation=` half of the dev route into K6a (keep the preset rename and the conformance suite in K4), or swap K4 and K6a. The plan's own argument for K4-before-K5 (the suite guards the shell split) survives either way.

### R5 — The composer has no time budget for breaks
- **Severity:** major
- **Section:** §1.3 composer, §4 K6, §7 Q7 (`minPartMinutes: 2`, `maxParts: null`)
- **Evidence:** a break follows every part transition whenever breaks are enabled (`session-flow.ts:226-255`), each up to `GameBreakSettings.maxDurationMinutes` (default 5, `session-plans.ts:466-470`). Today's fixed three parts bound that at two breaks. `compose()` spends `durationMinutes` on practice minutes only (§1.3 "minutes = durationMinutes × normalizedWeight").
- **Failure scenario:** an adult enables flash anzan and read-the-abacus beside the three arithmetic chips and asks for 12 minutes. Five kept offers at `minPartMinutes: 2` give five parts and four breaks: 12 minutes of practice plus up to 20 of games. The rhythm is intact; the adult's length is not.
- **Fix:** the composer's budget is `durationMinutes − (parts − 1) × breakMinutes` when breaks are on, or `maxParts` defaults to 3 until the owner decides; either is a `ComposerPolicy` field. Record the choice in §7 Q7.

### R6 — The golden-plan test is not achievable as specified
- **Severity:** major
- **Section:** §4 K6 acceptance; §1.3 `plan(spec, ctx, rng)`
- **Evidence:**
  - Time, not only randomness, shapes a plan: `findSkillsNeedingReview` reads `Date.now()` (`session-planner.ts:2332-2345`) to pick review purposes; BKT decay in `compute-bkt.ts` and `skill-metrics.ts` read the clock; the seeded profiles stamp rows relative to the seeding moment (`lib/seed/helpers.ts:72`). Only `Math.random` is named for mocking.
  - "Byte for byte" and "`summary` gains `composition`, `kind`, `presentation`, `label`, `emoji`, `itemCount`" (§3.1) cannot both hold; the compared projection is undefined.
  - `rng` cannot be honoured by arithmetic: problem generation calls `Math.random` at 16 sites in `utils/problemGenerator.ts` (`:446, 486, 986, 1004, 1019, 1025, 1239, 1276`) and ids embed `Date.now()` (`:488`); `intelligentShuffle` at `session-planner.ts:2533`. The dev route's "fixed `rng`" would be a no-op for the one kind that exists.
- **Fix:** freeze `Date.now` (`vi.setSystemTime` or a spy; fake timers would stall the `setTimeout(0)` yield at `:1093`) and seed profiles against the frozen clock; define the snapshot projection as today's fields only and assert the new fields separately; drop `rng` from the contract (document that kinds use `Math.random`, mocked in tests) or thread it later as its own decision.

### R7 — The reader inventory misses files its regex cannot see
- **Severity:** major
- **Section:** §2
- **Evidence:** the grep is case-sensitive on `part\.type`, so `currentPart.type`, `partSummary.type`, `stats.type` and the literal union `'abacus' | 'visualization' | 'linear'` are invisible. Independent grep (`/tmp/pk-review-readers*.txt`) finds, not in §2:
  - `components/practice/ContinueSessionCard.tsx:19-28` and `SessionPausedModal.tsx:26-35` (switch on `part.type`, no default: an unknown presentation renders `undefined`), `partTransitionMessages.ts`, `OfflineSessionModal.tsx:230` (iterates `PRACTICE_TYPES`), `PracticeTimingDisplay.tsx:88`.
  - `lib/curriculum/time-estimation.ts:129-136`: `PART_TYPE_MULTIPLIERS[partType]` is `undefined` for a new type, so the modal's estimate is `NaN` ms.
  - `app/api/curriculum/[playerId]/sessions/plans/route.ts:149-156`: 400 unless one of the three keys is true; a K6 bundle starting a read-the-abacus-only session is refused.
  - `db/schema/player-session-preferences.ts:11`: `partWeights: { abacus; visualization; linear }`, and `StartPracticeModalContext.tsx:340-354` derives `enabledParts` from those weights. The plan's K6b says preferences "store `enabled` by key"; the stored thing is a typed three-key weight map.
  - `app/practice/[studentId]/dashboard/DashboardClient.tsx:885`: `(['abacus', 'visualization', 'linear'] as const).map(...)` names the per-mode chips; §5.1 says flash anzan appears "on the dashboard's per-mode chart" with no edit.
  - `app/admin/practice-config/PracticeConfigClient.tsx` (part weights by three names), `lib/tasks/session-plan.ts:15, 99` (`enabledParts` through the task), `lib/tasks/events.ts`.
  - `app/api/curriculum/[playerId]/sessions/plans/[planId]/reviewTry.ts`, `hooks/useTimingReview.ts`, `lib/curriculum/index.ts`, `lib/seed/index.ts` (`SlotResult` re-exports/readers).
  - Eight stories, including `ActiveSession.stories.tsx` and `DockedMyAbacus.stories.tsx`, which K5a deletes the subject of.
- **Fix:** re-run the inventory with `[pP]art(\?)?\.type`, the union literal, `partWeights`, `enabledParts`, `PRACTICE_TYPES`, `PracticeTypeId`, `SessionPartType`; add the rows; move `time-estimation.ts` and the preferences schema into K6.

### R8 — The two proofs would need edits outside their folders
- **Severity:** major
- **Section:** §5.1, §5.2 "Must not touch"
- **Evidence (flash anzan):** a weight key in `player-session-preferences.ts:11` and the preferences route; a `pacing.perTermMs` per-student preference has no home (same file); `plans/route.ts:149-156` validation; `DashboardClient.tsx:885`; `time-estimation.ts:134`; `PracticeConfigClient.tsx` if its weight is to be tunable. **(read the abacus):** all of the above plus the composer's `itemCount = max(2, floor(minutes·60 / avgTimeSeconds))` (§1.3, from `session-planner.ts:594-598`), where `avgTimeSeconds` is the arithmetic pace assessment, and `avgTimePerProblemSeconds` (a plan column read by `useSessionSongTrigger.ts:66` and the time estimates).
- **Failure scenario:** K7's PR file list, the plan's own proof, carries five files outside the folder; by "the rule behind the rule" that is five §8 entries and a phase, discovered at the end.
- **Fix:** widen `partWeights` to `Record<string, number>` and add `kindPreferences: Record<string, unknown>` in K6b; move the three-key validation into the composer (`NoEligiblePartsError` already exists, `:546-548`); let the dashboard iterate the registry's presentations in K1b (it already iterates `byMode`, `:500-507`); give `Offer` a `secondsPerItem` and let `plan()` own `itemCount`.

### R9 — The contract is overfit to arithmetic in four places and missing five things a third kind needs
- **Severity:** major
- **Section:** §1.3
- **Overfit (remove or narrow):**
  - `OfferContext` names arithmetic's loads (`linearReadiness`, `vetoes`, `comfort`, `paceAssessment`). A facts drill needing its own table edits the host's `Promise.all` (`session-planner.ts:293-308`) and the type. Give each kind `loadContext?(playerId, now)` and pass its result back opaque, as `planInput` already is.
  - `PlanSpec.itemCount` is computed by the composer from arithmetic's pace (R8).
  - `match` duplicates `expectedItem` + `acceptsDoOver`; the recorder can do `expectedItem(...).itemId === submitted.itemId` and `acceptsDoOver` itself. Remove.
  - `describePart` equals `presentationOf(part).{label, emoji}` + `needsPhysicalAbacus(part)`. Keep one.
  - `Presentation.axes` is the ledger adapter's concern; `ItemRef.index` and `Offer.key` are derivable.
- **Missing:**
  - `outcome: 'timeout'` (the ledger has it, `L/docs/...:79`); a timed drill cannot be recorded honestly.
  - Who decides `feedback.showAnswer`? Today `MAX_RETRY_EPOCHS` at `ActiveSession.tsx:1450-1454`; in the shell it would be a constant of one cursor. Needs a kind/cursor method (`feedbackFor(content, state, try)` or `roundsRemaining`).
  - An auto-pause opt-out per presentation (a timed drill must not be auto-paused mid-item; `autoPauseCalculator.ts`).
  - The adaptive hook K5 promises ("appends the next item inside the same CAS write"): `applyTry` returns `State` only and `tryWrite` patches `results` and `partStates` (`session-planner.ts:1472-1481`); no path writes `parts`. Either add `applyTry → { state, content? }` now or drop the promise from K5.
  - `evidenceOf(part, item, t)` needs an `item`, but worksheet and offline tries have none: offline parts carry `slots: []` (`offline-sessions/route.ts:44-52`) and worksheet tries are appended with fresh `slotIndex` (`approve/route.ts:120-126`). Take the payload, not the item.
- **Set-beads check:** `answer: unknown`, `judge`, `AnswerChannel<A>` and `TryCard` carry a bead state; `KindBroadcast.answerText` has no honest value (the kind's `ObserverView` decides, as §6.8 says). Sound.

### R10 — "Nothing grows" is false for the K1–K5 window
- **Severity:** major
- **Section:** §3.1 `payload`
- **Evidence:** `payload.problem` duplicates the top-level `problem` (with its `generationTrace`) in every row while the copies are written; `GeneratedProblem` is the bulk of a row (`session-planner.ts:1232`: "10-50KB per session"). `evidence-query.ts:186-217` and `batchGetRecentSessionResults` (`:1234-1246`) read `results` whole for every BKT computation.
- **Failure scenario:** rows roughly double for several releases; every dashboard, planner and MCP mastery read pays it; with R1 fixed (copies kept indefinitely) it is permanent.
- **Fix:** while the legacy copy is written, `payload` carries `{ kind, usedOnScreenAbacus }` and the normalizer reads `problem` from either place; or `payload.problem` holds `terms/answer/skillsRequired` only and the trace stays where it is.

### R11 — The envelope is not stored "as is" by the ledger
- **Severity:** major
- **Section:** K6 (decision table), §3.4
- **Evidence:** the ledger validator requires `studentAnswer: number | null` and null unless `answered` (`L/src/lib/ledger/events.ts:926-931`); `problem` is required and arithmetic-shaped (`L/docs/...:79`); `isCorrect` is "not stored: it is defined only when the student answered" and derived as `studentAnswer === answer` (`L/src/lib/ledger/folds/attempts.ts:133-141`); `mark_correct` is an `attempt.reviewed` event folded over the attempt, not a flipped field; skills are recomputed from terms when the classifier is stale (`:189`), which an authoritative `evidence.skills` would contradict.
- **Fix:** §3.4 already is the adapter; say so, and list the ledger-plan amendments it needs (widen `studentAnswer`, kind-keyed `item` beside `problem`, a stored verdict for non-arithmetic kinds or a per-kind `judge` in the fold, `outcome: timeout`). File them in the ledger plan's Amendments section, as its rule requires.

### R12 — K5a hides an existing poll and is too big for one PR
- **Severity:** major
- **Section:** §4 K5a; §6.14 ("the two existing UI timers … are pacing, kept")
- **Evidence:** `resolveSubmitAdvanceWithWait` polls every 50 ms for up to 500 ms for the server's next item on the retry path (`ActiveSession.tsx:1343-1388`). §6.14 names two timers; this is a third, and it is the thing the shell's "optimistic advance by running the kind's pure cursor locally" would replace. Replacing it is a behaviour change in a phase marked "client-only, no rollout window"; carrying it puts a poll into generic shell code under a house rule that forbids new ones.
- **Sizing:** K5a deletes `ActiveSession.tsx` (2,431 lines) and `useInteractionPhase.ts` (1,281) and creates the shell, `useTryLifecycle`, `useDigitEntry`, four arithmetic views and the browser registry in one PR.
- **Fix:** decide the poll's fate in §8 before K5 (recommend: the shell predicts with the cursor for first and retry tries alike and never waits; the server's reply resyncs, as it does today on a mismatch). Split K5a: (1) extract `useTryLifecycle`/`useDigitEntry` in place with the test file split, behaviour-identical; (2) move the arithmetic views under `parts/arithmetic/browser/` as file moves; (3) the shell and the deletion.

## Minor

### R13 — "Pre-K1 image ignores the new fields" is wrong
- **Section:** §3.3 K1 row. `withoutServerStamps` returns `...rest` (`session-planner.ts:1409-1428`), so a pre-K1 image **stores** `itemId/outcome/answer/payload/clientVerdict` from a K2 bundle verbatim, as the K2 row concedes for K1. Say "stores unjudged" in both rows.

### R14 — K2 changes two status codes without saying so
- **Section:** §4 K2. The divulged-answer do-over is a plain `Error` → 500 today (`:1853-1868`); through `acceptsDoOver` it becomes 409 `SLOT_MISMATCH`, which `isQuietTryWriteFailure` resyncs silently where today the kid sees a toast (`PracticeClient.tsx:375-392`). Name it as the (welcome) behaviour change it is; same for unknown kind 500 → 409.

### R15 — K1b's `masteryModeOf` precedes the presentations it resolves
- **Section:** §4 K1b files (`parts/presentations.ts`), §4 K3 (`arithmetic/presentations.ts` registers the three). K1b must ship a stopgap identity map and K3 replaces it: a reopened file. Either register the three `Presentation` objects in K1b (small) or resolve mode as `evidence.presentation` itself until K3.

### R16 — Blank worksheet answers and "one recorder"
- **Section:** K7, §3.1 `outcome`. `session-converter.ts:66-67` stores `studentAnswer: parsed.studentAnswer ?? 0` with `isCorrect: false` for a blank; an envelope `answer: 0, outcome: 'answered'` is a lie, and `judge(0)` is true when the answer is 0. Define blanks as `outcome: 'skipped', answer: null`. Also: worksheet approval, offline sessions, seeds and the recency sentinel (`progress-manager.ts:322-335`) write rows without `recordTry`; "one recorder" means one for live tries. Say that.

### R17 — `/offers` on a K5 image
- **Section:** §4 K6b. A K6 bundle against a K5 image gets 404 from `GET …/offers`; the modal's fallback (the three keys) is unspecified.

### R18 — Time estimates are arithmetic's
- **Section:** §5.2, §4 K8. `avgTimePerProblemSeconds` is a plan column from the pace assessment; `useSessionSongTrigger.ts:64-69` and `useSessionTimeEstimate` use it for every part. A read-the-abacus last part misestimates the song moment; an unknown kind's `total === 0` (`:60`) means no song after a rollback. Note it; not a defect of the rhythm.

### R19 — Citation nits
- `useInteractionPhase.ts:29` is `export interface AttemptInput {`; the `GeneratedProblem` field is `:31`. `stub-kind.test.ts:18` is the comment; `SLOT_WORDS` is `:19`. `ActiveSession.tsx:1440` (`isCorrect = answerNum === …`), `:1480`, `:1516-1525`, `:1699-1707`; `session-planner.ts:1289`, `:584, 694, 767, 950`, `:1409-1428`, `:1853-1868`; `session-report-batch.ts:49-60`; `arithmetic/state.ts:165-170`, `:184`; `PartTransitionScreen.tsx:15, 52-53`; `part-gating.ts:44`; `bkt/types.ts:37, 153`; `compute-bkt.ts:153, 308`; `linear-entry-policy.ts:71`; `VisionRecorder.ts:308`; `session-converter.ts:16`; `offline-sessions/route.ts:72`; `evidence-query.ts:154, 186-217` all check out.

## Checked and found sound

- **The three premise changes.** `typeByPartNumber.get(result.partNumber) ?? 'linear'` at `session-planner.ts:1289` (a part with `type` absent is 'linear'); the slim projection reads only `$.slots` (`session-report-batch.ts:49-60`), so a `content` part slims to `slots: []`; `getCurrentProblemInfo → resolveCurrentItem → expectedArithmeticItem(part.slots, …)` indexes `undefined` (`state.ts:124-157, 165-170`) and throws on an old bundle.
- **Server judge parity for every live writer.** The browser's verdict is `parseInt(answer) === problem.answer` (`ActiveSession.tsx:1409, 1440`); `arithmeticKind.judge` is `answer === problem.answer` on the plan's slot (`arithmetic/server.ts:85-88`); the recorder already requires `sameProblem` on terms and answer (`session-plan-helpers.ts:244-253`), so the two problems are the same. The journey simulator (`JourneyRunner.ts:154-168`), seeds (`helpers.ts:49-50, 66-67`) and the worksheet converter (`:66-67`) all set `isCorrect` consistently with `studentAnswer` (seeds' wrong answers are offset by 1–3, never 0). `mark_correct` leaves `answer` alone (`session-review.ts:181-197`), which is why §3.4's "stored verdict" is the right call.
- **The skip heuristic is unambiguous today.** `helpTrigger: 'manual'` is written only by `handleSkip` (`ActiveSession.tsx:1707`) and by the simulator when `hadHelp`, whose wrong answers are `answer + 1` (`JourneyRunner.ts:162, 167`); no other writer sets it, `handleSubmit` never does. Skip happens in any round and never in redo mode (`:1680-1684`).
- **`skillsExercised === problem.skillsRequired` in every live writer** (`ActiveSession.tsx:1479, 1704`; `JourneyRunner.ts:160` via `SimulatedStudent.ts:160`; `helpers.ts:44, 70`; `session-converter.ts:77`), so `evidenceOf` from the content changes no BKT input.
- **Idempotency across action names.** `isRecordedTry` is by `tryId` on the row (`:1451-1453`), inside the CAS; `record`, `record_redo` and a future `record_try` with the same `tryId` on old and new pods produce one row.
- **The rhythm is kind-blind already.** `applyFlowEvent` touches a kind only in `TRY_RECORDED` (`session-flow.ts:513-526`); a break follows every transition when enabled (`:226-255`), unbounded in count; `useSessionSongTrigger` uses `report.parts.length` (`:56`), not 3. `ContinueSessionCard`, `SessionPausedModal`, `PracticeTimingDisplay` degrade to blank emoji, not a crash; `PartTransitionScreen.tsx:53` falls back to "⭐ Next part".
- **`byMode` is an open string map** (`bkt/types.ts:153`, `compute-bkt.ts:308`), and `DashboardClient.tsx:500-507` iterates it; only `:885` names three.
- **`arithmetic/ui.tsx` has zero importers** (verified). `arithmetic/server.ts` imports only types from `@/db` (seed-bundle safe).
- **K2's rollback note** (`...rest` stores unknown fields, so a K1 image stores the superset body's envelope fields verbatim and they equal what it would compute) is correct and honestly stated.
- **The two SQL evidence paths** are correctly identified (`evidence-query.ts:186-217` row projection + `partTypeMap`, `session-planner.ts:1242-1247`); the sentinel row (parts `[]`) resolves to 'linear' on both, as today.
- **Phase order K4 before K5** (conformance suite guards the shell split) and **K6 in parallel with K5** (disjoint files) are right, subject to R4.
