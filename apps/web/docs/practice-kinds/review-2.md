# Practice kinds plan: review 2 (2026-11-27)

Reviewed: `plan-of-record.md` rev. 2 (`467d4e492`) with the owner's answers (`24f5f60af`), against the code at `c12abd87f` in this worktree. Paths under `apps/web/src/` unless marked.

Counts: 0 blockers, 5 major, 6 minor.

## K0 verdict

**K0 is correct and complete for R2.** Checked what a missing `part_states` entry for an unknown-kind part could break:
- `arithmeticPartStateOf` reads only its own part's entry and falls to `unenteredArithmeticStateOf`, which decides by position alone (`parts/arithmetic/state.ts:70-80, 98-103`): an arithmetic part after the unknown one reads "not started" while the cursor is on or before it, "finished" after. No arithmetic state depends on another part's entry.
- The 6b-0 mixed-pod reason for the move-on entry (`session-plan-normalize.ts:255-260`) is historical: 6b-1 is live on every pod; nothing decodes a legacy cursor any more.
- Every reader that would touch the unknown part guards with `findPartKind` first: `partProgress` and `currentItemOf` in the report (`session-report.ts:364, 391`), `plannedItemCount`/`isPartPlayable` (`registry.ts:38-50`); `observer-report.ts:64` guards `Array.isArray(part?.slots)`; `SESSION_ENDED_EARLY` touches no kind (`session-flow.ts:371-390`); a do-over into the part hits `partKindOf` at `session-planner.ts:1847` before `partStateOf` (500 until K2 makes it 409, as planned). When the K8 image returns, `partStateOf` derives the initial state from the missing entry (`:233`) and the first try writes it.
- The K0 acceptance list is right; add "the report's position while the cursor is on the unknown part has no `currentItem` and 0/0 progress, and the observer page renders" (both hold today, worth pinning).

**The `:1284` pin is the right test but half of it.** See S2: `evidence-query.ts:111` is the same guard on the SQL path.

## Findings

### S1 — The contract puts server-only planning on the object the browser bundle imports
- **Severity:** major
- **Section:** §1.3 `PartKind` (`loadContext?(playerId, now, db: Db)`, `offer`, `plan`), §1.2 (server kind "must not know … the DB"), K4 gate ("`parts/*/server.ts` imports … nothing from `@/db` except types and the `Db` type"), K6a
- **Plan says:** one `PartKind` interface carries the cursor, judge, presentations **and** `loadContext`/`offer`/`plan`; the server registry is "one line" per kind.
- **Evidence:** the server registry is imported by the normalizer (`db/schema/session-plan-normalize.ts:19`), which is imported by client code: `app/practice/[studentId]/PracticeClient.tsx`, `components/practice/PartTransitionScreen.tsx`, `components/practice/hooks/useInteractionPhase.ts`, `components/practice/SessionPlanOverview.tsx`. `arithmetic/server.ts:9-10` is explicitly "Pure (no database, no server-only imports), so the registry can be read on either side". Arithmetic's `loadContext` must call `getPlayerCurriculum`, `getAllSkillMastery`, `getPaceAssessment`, `getRecentSessionResults`, `getLinearReadinessVetoes`, `getFlag` and read `appSettings` (`session-planner.ts:293-308`), all of which import `@/db` at runtime; its `plan` absorbs `buildSessionPartAsync` (`:949-1110`).
- **Failure scenario:** K6a lands; the browser bundle now imports `better-sqlite3` through the registry (build failure or a server-only import error), or the K4 gate forbids `loadContext` from doing anything useful. Either way K6a cannot be built as specified.
- **Fix:** split the contract: `PartKind` (shared, pure: presentations, cursor, items, judge, evidenceOf, describe, presentationOf) in `parts/<kind>/server.ts` as today, and `PartPlanner<Ctx, Part>` (`loadContext`, `offer`, `plan`) in `parts/<kind>/planner.ts`, registered in a server-only `parts/planner-registry.ts` (or the server registry imports both and the normalizer imports a `parts/core-registry.ts`). The bar becomes "one folder, one line in each of three registries"; the K4 folder gate asserts the planner registry is imported only from `generateSessionPlan` and the dev route.

### S2 — R1's twin guard on the SQL path is not pinned or changed
- **Severity:** major
- **Section:** K0 (pin of `:1284`), K1b ("the row filter at `:1284` becomes 'has `evidence` or a `skillsExercised` array'"; "the SQL path and the in-JS path agree")
- **Evidence:** `toBktEvidence` begins `if (!Array.isArray(raw.skillsExercised)) return null` (`lib/curriculum/bkt/evidence-query.ts:111`). K1b names the projection (`:186-217`) and the mode resolution, not this line.
- **Failure scenario:** with K14 every arithmetic row keeps `skillsExercised`, so arithmetic is safe; a read-the-abacus row (K8) has `evidence` and no `skillsExercised`: the in-JS history path admits it, the SQL path drops it, and the dashboard's per-mode chart (SQL) never shows the mode that §5.2 promises. K1b's own acceptance ("the two paths agree on a fixture with … rows") would catch it only if the fixture has a row without `skillsExercised`.
- **Fix:** K0 pins both guards; K1b changes both to "has `evidence` or a `skillsExercised` array"; the agreement fixture includes a row with `evidence` and no `skillsExercised`.

### S3 — `enabled` alone loses the adult's choices against a K5 image
- **Severity:** major
- **Section:** §3.3 K6 row ("New bundle sends `enabled`"; "K5 image reads `enabledParts`; the new bundle's `enabled` has the same three keys")
- **Evidence:** the K5 image reads `enabledParts` from the body (`app/api/curriculum/[playerId]/sessions/plans/route.ts:96`), passes it through the task (`lib/tasks/session-plan.ts:15, 99`), and `generateSessionPlan` defaults a missing `enabledParts` to **all three on** (`session-planner.ts:269-273`). It never reads `enabled`. The same for MCP (`app/api/mcp/route.ts:284` `enabled_parts`).
- **Failure scenario:** during the K6 rolling deploy, or after a rollback to K5 with K6 bundles open, an adult who turned linear off starts a session and gets a linear part.
- **Fix:** the K6 bundle sends `enabled` **and** `enabledParts` (the three keys projected from `enabled`) and `partTimeWeights` as today, for one release; the K6 server prefers `enabled` when present. Same pairing for `start_practice_session`.

### S4 — Envelope-only skips change what readers see one release before the readers move
- **Severity:** major
- **Section:** §3.3 K4 row ("the server fills the top-level arithmetic fields from the plan's slot whatever the body shape"), §3.1 `outcome`, K14
- **Evidence:** today a skip stores `studentAnswer: problem.answer, hadHelp: true, helpTrigger: 'manual'` (`ActiveSession.tsx:1699-1707`). A K4 bundle sends `outcome: 'skipped', answer: null`; "fills from the slot" gives `studentAnswer: null` (or `0`). The readers that show `studentAnswer` (`DetailedProblemCard.tsx:642` "You said {result.studentAnswer}", `AllProblemsSection.tsx:182, 190, 443`, `CompactProblemDisplay.tsx:120-131`, `AttemptHistoryPanel.tsx`, `LiveResultsPanel.tsx`) move to `TryCard`/`describe` only in **K5b**; every open old bundle reads it forever (K14's premise), and §3.1's own "skipped" display heuristic (`answer === problem.answer && !isCorrect`) stops matching.
- **Failure scenario:** between K4 and K5b the history card shows "You said null" (or "You said 0") for a skip instead of the divulged answer; after K5b, old bundles keep showing it that way.
- **Fix:** make K14 explicit: the on-disk legacy shape is frozen **including its quirks**. For `outcome: 'skipped'` the server writes `studentAnswer: problem.answer, hadHelp: true, helpTrigger: 'manual'` exactly as the legacy adapter would, so a K4 row and a K1 row of the same skip are byte-identical at top level (fixture (3) should assert this across both body shapes). `timeout` rows likewise choose their legacy projection before K4.

### S5 — Two owner decisions together make the fourth chip a silent no-op
- **Severity:** major
- **Section:** §7 Q2 (cap 3 kept) and Q3 (adult turns a chip on); §1.3 ("with more kept offers than the cap, the trace names the ones dropped"); K6b
- **Evidence:** `maxParts: 3` drops "the lowest-weight offers" with the reason in the trace only. Weights come from the adult's `partWeights` (`StartPracticeModalContext.tsx:341, 629-630` → `partTimeWeights`, `plans/route.ts:179`); flash anzan's default weight is 0 and the adult sets it; ties with visualization are the normal case. No tie-break rule is stated; nothing in K6b tells the adult that a chip they turned on will not run.
- **Failure scenario:** an adult enables Flash beside the three arithmetic chips, starts a 15-minute session, and gets today's three parts; the Flash chip stays lit. Which of two equal-weight offers is dropped depends on the implementation's sort stability.
- **Fix:** not a re-argument of Q2/Q3: `/offers` returns the cap; the modal greys the (cap+1)th enabled chip with "3 parts per session; lower a weight to swap" (Q8's greyed-with-reason pattern), `compose()` breaks ties by offer order and writes `skipped[].reason: 'over-cap'` so `skipped-parts.ts` shows it on the summary. Pin the tie-break in the `compose()` unit tests.

### S6 — K8's example order is impossible under `order: 'offered'`
- **Severity:** minor
- **Section:** K8 acceptance ("a plan of arithmetic + read_abacus + arithmetic")
- **Evidence:** §1.3: "offers come in kind-registration order then the kind's own order"; `read_abacus` is a second kind, so it is always last. The sequence the test names cannot be composed.
- **Fix:** test `arithmetic (abacus) → arithmetic (linear) → read_abacus`, or add `order` values when interleaving is wanted (its own decision; the owner's hand test "a mixed session" is satisfied either way).

### S7 — K5a-3's replacement needs the plan from `handleAnswer`, which today returns nothing
- **Severity:** minor
- **Section:** K5a-3, §6.14 ("the mutation's resolved value is the new plan"), §1.2 ("write queue hand-off")
- **Evidence:** `PracticeClient.handleAnswer` wraps the queued mutation in an async IIFE that consumes `updatedPlan` and resolves `void` (`app/practice/[studentId]/PracticeClient.tsx:424-455`); `ActiveSession` awaits `onAnswer` for its side effect only (`:1527`). The mutation itself does resolve to the plan (`useSessionPlan.ts:645`). §6.14 says the write queue is unchanged in `PracticeClient`; §1.2 lists "write queue hand-off" under the shell.
- **Fix:** name the one wire-neutral change: `handleAnswer` (or the shell's own enqueue) returns the plan the write resolved to, `null` when the write was dropped behind a failure (then the shell resyncs as today). Also reword the acceptance "the next item appears without advancing the clock": the 500/1500 ms feedback timer is kept, so the test advances exactly that delay and asserts no further tick is needed.

### S8 — `retryRoundsCursor` still exports `match`
- **Severity:** minor
- **Section:** §1.3 shared cursor, line 148: `Pick<PartKind<…>, '… | 'match'>` after `match` was removed from `PartKind` (R9).
- **Fix:** drop `'match'` from the Pick.

### S9 — The K4 folder gate fails on K4's own tree
- **Severity:** minor
- **Section:** K4 ("a new gate asserts no file outside `parts/<kind>/` imports from `parts/<kind>/` except the two registries")
- **Evidence:** `PartTransitionScreen.tsx:15` imports `parts/arithmetic/session-view` until K5b; K3 makes `constants/practiceTypes.ts` "a view over arithmetic's presentations"; §2 lets `components/tutorial/PracticeProblemPlayer.tsx` import arithmetic's views; S1 adds the planner registry and `generateSessionPlan`.
- **Fix:** the gate carries an explicit exemption list that each later phase shrinks (K5b removes `PartTransitionScreen`), with the list itself asserted so a new exemption is a visible diff.

### S10 — `partTimeWeights` is a second typed three-key wire field
- **Severity:** minor
- **Section:** §2, K6, §3.3 K6
- **Evidence:** `plans/route.ts:97, 179`, `lib/tasks/session-plan.ts`, `hooks/useSessionPlan.ts:213` (`{ abacus: number; visualization: number; linear: number }`), derived from `partWeights` at `StartPracticeModalContext.tsx:629-630`. Harmless on a K5 image (an extra key is ignored by `config.partTimeWeights[type]`), but it must widen with `partWeights` or the fourth weight never reaches the composer.
- **Fix:** add the row to §2 (R7 group) and the field to K6's wire line.

### S11 — `autoPause: false` and the #156 capture guard
- **Severity:** minor
- **Section:** §1.3 `Presentation.autoPause`, §5.1
- **Evidence:** the client timing guard caps at the auto-pause threshold (`ActiveSession.tsx:1432-1440`, the comment names "this child's auto-pause threshold"), and the server backstop at the absolute ceiling (`sanitizeResultTiming`). A presentation that opts out of auto-pause still needs a cap.
- **Fix:** one sentence: the guard's threshold is unchanged by `autoPause: false`; only the pause UI is suppressed.

## R1–R19: is each fix real?

| Id | Verdict on the response |
|---|---|
| R1 | Real. K14 + §3.3 "no phase stops writing anything" + fixture (2) through the old bundle's helpers. Incomplete on one line: S2. |
| R2 | Real. K0 as specified closes it; see the K0 verdict for what else was checked. |
| R3 | Real (additive `presentation`). New-bundle readers should read `presentation ?? type` until K5b; implied, not stated. |
| R4 | Real; the starter waits for `plan` in K6a. |
| R5 | Real mechanism (`maxParts`, `breaks`, break minutes in the trace). Its interaction with Q3 is S5. |
| R6 | Real: frozen clock, seeds against it, today-fields projection, `rng` dropped. |
| R7 | Real: eleven rows added; `DashboardClient.tsx:885` in K1b; stories move in K5a-2. One more wire field: S10. |
| R8 | Real on the files named; the planner split (S1) adds a third registry line, not a file outside the folder. |
| R9 | Partial rejection is sound. `Presentation.axes` is data the adapter copies; `Offer.key` must be stable across presentations and matches today's stored `partWeights` keys. The accepted half introduces S1 (`loadContext(db)`) and S8. |
| R10 | Real: `payload: { kind }` on disk, lifted by `payloadOf`; nothing stored twice. |
| R11 | Real: §3.4 is now an adapter with five amendments to file. |
| R12 | Real: poll named, owner asked, K5 split in four. S7 names the one missing step. |
| R13–R18 | Real, each where stated. R16's "one recorder for live tries" is now accurate. |
| R19 | Partial rejection is sound: 8 lines (my "16 sites" counted calls), `:488` not `:486`, `:261` not `:264`; their line numbers verified. |

## Owner decisions that create a defect as written

- **Q2 + Q3** (cap 3, chips off by default and turned on by the adult): S5. The decisions stand; the modal and the trace must make the cap visible.
- **Q5** (legacy writes forever): correct, but it means the legacy projection is frozen with its quirks; S4 says so for skips and timeouts.
- **Q1** (poll replaced by the returned plan): no defect; S7 is the missing step.

## Rev-2 citations spot-checked

All verified at `c12abd87f`: `PracticeConfigClient.tsx:23-28` (`MODES`), `lib/tasks/events.ts:551, 556`, `app/api/mcp/route.ts:284`, `StartPracticeModalContext.tsx:341-353`, `ActiveSession.tsx:1318-1395`, `:1347-1348` (500 / 50), `:1251-1298`, `:1277-1278`, `:1453`, `:1527`, `useSessionPlan.ts:645-648`, `session-planner.ts:595`, `:1284`, `:1289`, `session-plan-normalize.ts:261-276`, `:229-234`, `registry.ts:24-26, 30-34`, `session-flow.ts:530`, `:371-390`, `15343f1cf` (2026-02-24, "Refactor practice submit transition coordination"), `L/src/lib/ledger/events.ts:926-931`, `L/…/folds/attempts.ts:133-141, 189`.

## Fit to build from

- **K0: yes, now**, with S2's second pin added to the same PR (one assertion).
- **K1 onward: yes after S1, S3 and S4 are folded in.** S1 changes §1.2/§1.3 and the K4 gate and K6a's layout but reopens nothing earlier; S3 and S4 are wire-row sentences plus a fixture each. S5–S11 are wording, a test or one sentence each.
