# SlotId-Required Migration Plan

**Owner:** Thomas
**Pairs with:** the `feat(session): make slotId required` commit (this PLAN.md is committed alongside it; the backfill script is **not committed** — it lives only in the operator's working tree as a throw-away)
**Risk:** Medium — backfills ~182 of 264 prod rows including 12+ in-progress sessions. Safe via per-row optimistic concurrency.

---

## Why this exists

The schema change in `apps/web/src/db/schema/session-plans.ts` flips `slotId?: string` → `slotId: string` on three types:

- `ProblemSlot` (in `session_plans.parts[].slots[]`)
- `SlotResult` (in `session_plans.results[]`)
- `RetryItem` (in `session_plans.retry_state.{partIdx}.{pendingRetries,currentEpochItems}[]`)

Downstream consumers (`VisionRecorder`, `BroadcastState`, `ProblemMetadata`) now treat `slotId` as required. Reads of pre-migration rows would surface `undefined` in fields typed as `string` and may break the broadcast/vision pipeline.

**Prod scope (measured 2026-04-29 morning):**

| Location | Items missing slotId |
| --- | ---: |
| `parts[].slots[]` | 2,823 |
| `results[]` | 2,121 |
| `retry_state` retry items | 12 |
| **Distinct rows needing UPDATE** | **182** of 264 |

Drift is real: this number was 169 the day prior. Currently-shipped code writes some new rows without slotId, ~13/day. The plan accounts for this with a mop-up sweep after the deploy.

---

## Strategy

1. **Pre-deploy backfill** — operator runs the throw-away script from their MacBook, port-forwarded to in-cluster libsql. Brings missing-slotId count to zero.
2. **Push the slotId-required commit** to main. CI + build + Argo CD rollout takes ~20–25 min.
3. **Post-rollout mop-up backfill** — operator re-runs the same script to clean up any rows written by old pods during the rollout window. New pods write proper slotIds, so candidate count converges to zero.
4. Tear down port-forward.

The script is **idempotent** — only rows with at least one `IS NULL` slotId are selected; once filled, they no longer match. Per-row UPDATE is guarded by `WHERE id = ? AND parts = ? AND results = ? AND COALESCE(retry_state, '') = COALESCE(?, '')`. If any column changed since SELECT (e.g. a live session wrote), the UPDATE matches 0 rows and the script reports it; re-runs converge.

---

## Why the script is throw-away

- It's specifically for the slotId backfill — not a reusable migration tool.
- Once the slotId-required code is deployed, no new rows can be created without slotId, so the script has no future use.
- Committing it would imply we want it in long-term version control alongside the migration `drizzle/` files. We don't.

The operator keeps the script locally during execution; deletes after sign-off.

---

## Pre-flight checklist

- [ ] On VPN (or otherwise able to reach `192.168.86.37` for kubectl).
- [ ] Working tree has the slotId-required code changes staged but not pushed.
- [ ] Backfill script `apps/web/scripts/backfill-slot-ids.mjs` exists locally (gitignored / untracked).
- [ ] No deploy currently in flight: `gh run list -R antialias/abaci-one --workflow "Build and Deploy" --limit 1` shows last run completed.
- [ ] Quick smoke check that prod scope is roughly what we expect:
  ```bash
  ./scripts/prod-query.sh "SELECT COUNT(DISTINCT sp.id) AS rows FROM session_plans sp, json_each(sp.parts) part, json_each(json_extract(part.value, '\$.slots')) slot WHERE json_extract(slot.value, '\$.slotId') IS NULL"
  ```
  Expected: ~180–200.

---

## Execution

### Step 0 — Open the libsql tunnel

In a dedicated terminal that stays open through Step 7:

```bash
kubectl port-forward -n abaci svc/libsql 18080:8080
```

Use port 18080 to avoid colliding with anything local on 8080.

In a second terminal, sanity-check connectivity:

```bash
curl -sf -X POST http://127.0.0.1:18080/v2/pipeline \
  -H "Content-Type: application/json" \
  -d '{"requests":[{"type":"execute","stmt":{"sql":"SELECT COUNT(*) FROM session_plans"}}]}' \
  | grep -o '"value":"[0-9]*"'
```

Expected: `"value":"264"` (or whatever the current row count is).

### Step 1 — Pre-deploy dry-run

```bash
cd apps/web
DATABASE_URL=http://127.0.0.1:18080 node scripts/backfill-slot-ids.mjs --dry-run
```

**Expected output:**

- `Candidate rows: 180-200`
- `Slot IDs added: ~2823`
- `Result IDs added: ~2121`
- `Retry IDs added: ~12`
- `Orphan results (fabricated): ~21` (legacy sessions where results outlived their slot)
- `Orphan retry items (fabricated): 0`

**Stop and investigate** if numbers diverge wildly or any error is printed.

### Step 2 — Pre-deploy real run

```bash
DATABASE_URL=http://127.0.0.1:18080 node scripts/backfill-slot-ids.mjs
```

**Expected:** `Rows updated` ≈ candidate count, exit 0.

If exit code is 2 (`rowsSkippedConcurrent > 0`): a live in-progress session wrote between our SELECT and UPDATE. Re-run Step 2 — re-fetched candidates exclude already-clean rows, so we converge in a few re-runs.

### Step 3 — Verify near-zero remaining

```bash
DATABASE_URL=http://127.0.0.1:18080 node scripts/backfill-slot-ids.mjs --dry-run
```

**Required:** `Candidate rows: 0–5`. A handful of fresh rows written by current pods between Step 2 and now is acceptable; we'll catch them in Step 6. **Do not push the schema change in Step 4 if this is more than ~10**, which would suggest a write storm; investigate.

### Step 4 — Push the schema change

In a third terminal (port-forward terminal stays open):

```bash
git add <the 22 slotId-required files> apps/web/scripts/backfill-slot-ids.PLAN.md
git commit -m "feat(session): make slotId required on SlotResult/RetryItem; thread through broadcast and vision

Flips slotId? -> slotId: string on ProblemSlot, SlotResult, RetryItem.
Threads slotId through BroadcastState, sendProblemMarker(), VisionRecorder
problem-shown events, and ProblemMetadata so vision recordings correlate
1:1 to the specific problem slot they capture.

Vision recorder now uses marker-supplied problem data instead of stale
practice state.

Existing prod data was backfilled prior to this commit using the throw-away
script described in apps/web/scripts/backfill-slot-ids.PLAN.md."
git push origin main
```

The PLAN.md is committed; the `.mjs` script is not.

### Step 5 — Watch the deploy

```bash
gh run watch -R antialias/abaci-one
```

Stay on this until both **Unit Test Coverage** and **Build and Deploy** show success — roughly 20–25 minutes total. Then watch the rollout:

```bash
# Wait until all 3 abaci-app replicas are on the new image hash
kubectl get pods -n abaci -l app=abaci-app -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.containers[0].image}{"\n"}{end}'
```

All three should report the same image SHA, distinct from the pre-Step-4 SHA.

Confirm via build-info:

```bash
curl -sf https://abaci.one/api/build-info | grep commit
```

Expected: `commit` matches the SHA you pushed in Step 4.

### Step 6 — Mop-up backfill

The 3-minute Argo CD rollout window is the sole period in which old pods could have written new rows without slotId. Once the new pods are fully rolled, no further drift occurs.

```bash
DATABASE_URL=http://127.0.0.1:18080 node scripts/backfill-slot-ids.mjs --dry-run
```

**Expected:** `Candidate rows: 0–10` (small number from rollout window). If non-zero:

```bash
DATABASE_URL=http://127.0.0.1:18080 node scripts/backfill-slot-ids.mjs
```

Re-run dry-run until `Candidate rows: 0`.

### Step 7 — Tear down + clean up

In the port-forward terminal: `Ctrl-C`.

```bash
rm apps/web/scripts/backfill-slot-ids.mjs
```

(The PLAN.md remains in the repo as the audit trail.)

---

## Coordination summary

```
[Local terminal 1: port-forward]  steady all the way through
   |
[Local terminal 2: backfill ops] - dry-run --> real --> verify
   |                                                       |
   |                                            (push code in terminal 3)
   |                                                       |
   |                                            (~22 min CI+build+roll)
   |                                                       |
   '-------- mop-up dry-run --> real --> verify <----------'
                                                           |
                                                       tear down
```

Three terminals. The operator (you) drives terminals 2 and 3 sequentially. There is no parallel work to coordinate with anyone else.

---

## Contingencies (what to do when something breaks mid-flight)

**Guiding principle:** abaci.one has live users. Until Step 4, prod is running unchanged code. Backfilled slotIds are *forward-compatible* — currently-shipped code reads `slotId?` and is fine with the field being present. So **stopping mid-backfill is always safe**. The rule is "stop and inspect" before any aggressive recovery move.

### Quick triage — first thing to do when something goes wrong

```bash
# Are users impacted right now?
kubectl logs -n abaci -l app=abaci-app --tail=200 --since=2m | grep -iE "error|slotId|undefined" | head -30

# Are the pods healthy?
kubectl get pods -n abaci -l app=abaci-app

# Is the latest sample of session_plans data internally consistent?
./scripts/prod-query.sh "SELECT id, length(parts) AS p, length(results) AS r FROM session_plans ORDER BY created_at DESC LIMIT 3"
```

If users are unaffected and pods are healthy: you have time. Diagnose properly before acting.

### Failure mode A — port-forward dies mid-run

**Symptom:** `ECONNREFUSED`, `socket hang up`, or hang.

**State:** every row's UPDATE is atomic on libsql; previously-fixed rows are committed. Some rows still have missing slotIds.

**Fix:**
1. Re-run port-forward in T1: `kubectl port-forward -n abaci svc/libsql 18080:8080`
2. Re-run Step 2 in T2. The script's idempotency picks up where it left off.

### Failure mode B — single row fails with `RESPONSE_TOO_LARGE` or similar libsql error

**Symptom:** mid-run, `LibsqlError: RESPONSE_TOO_LARGE` from the per-row SELECT or the UPDATE.

**State:** rows iterated up to that point are committed. The crashing row and all subsequent are unprocessed.

**Diagnosis:** the script logs each row's id when `--verbose` is set; without verbose, identify the offender via:

```bash
./scripts/prod-query.sh "SELECT id, length(parts) AS parts_len, length(results) AS results_len, length(retry_state) AS retry_len FROM session_plans WHERE id IN (<candidate id list>) ORDER BY length(parts) + length(results) + COALESCE(length(retry_state), 0) DESC LIMIT 5"
```

**Fix options:**

- **Skip the offender, continue with the rest.** Edit the script's candidate query to add `AND id != '<offender>'`, re-run. Note the skipped id.
- **The offender is a real session in active use.** Check `status` and `played_id`. If in-progress and bloated: this row was probably going to break the new code anyway. Decide whether to pause that session via teacher control before continuing, or to leave it for the post-deploy mop-up.

**Do not** try to "shrink" the row by editing JSON content; that risks user data.

### Failure mode C — the same rows keep being skipped for "concurrent write" on every re-run

**Symptom:** Step 2 exits 2 repeatedly with the same `rowsSkippedConcurrent > 0`. Re-runs don't converge.

**State:** one or more in-progress sessions are writing fast enough that our UPDATE always races and loses.

**Diagnosis:**

```bash
# Find the noisy session
./scripts/prod-query.sh "SELECT id, status, started_at FROM session_plans WHERE id = '<one of the skipped ids>'"
```

**Fix options:**

- **Wait it out.** A normal session writes once per ~5 sec (problem submit). Re-run after a couple minutes; the chance of repeated collision drops fast.
- **Pause the session** (teacher control, sets `is_paused = true`). Re-run.
- **Last resort: skip during pre-deploy.** Note the id, exclude it via `--skip-id` (would need a small script edit). Step 6 mop-up will catch it post-deploy when fewer users are active.

### Failure mode D — script crashes with a JS error mid-run

**Symptom:** unhandled exception, stack trace from the script.

**State:** rows completed before the crash are committed; everything after is unprocessed.

**Fix:**
1. Capture the stack trace and the row id (printed via `--verbose`) where it crashed.
2. Fix the script. The most likely class of bug is malformed JSON in some row that `safeParse` doesn't handle (e.g., triple-encoded, or a null where we expected an object). Add a guard, re-run.
3. **Do not push the schema change** until the entire backfill completes cleanly.

### Failure mode E — pod logs show new errors *during* the backfill

**Symptom:** Step 1/2 in progress; meanwhile pod logs sprout errors that weren't there before.

**Why this could happen:** current shipped code reads `slot.slotId` as `string | undefined`. Once we backfill, the field is always defined. If any current code path branches on `slotId === undefined` to do something different, we just changed its behavior in prod.

**Diagnosis:**
```bash
# Compare error rate before/after
kubectl logs -n abaci -l app=abaci-app --since=10m | grep -iE "error" | wc -l
```

**Fix:**
- **If error rate spikes meaningfully:** STOP the backfill (Ctrl-C). The data already updated is fine. Investigate the error: `kubectl logs ... | grep -iE "slotId|undefined" -A 5 -B 2`. We picked the wrong moment or the wrong assumption.
- **If errors are sporadic and unrelated:** continue.

### Failure mode F — Step 4 push fails CI

**Symptom:** `gh run watch` shows red on Unit Test Coverage or Build and Deploy.

**State:** prod still running pre-Step-4 code. Backfill is complete and harmless.

**Fix:** standard "fix CI" workflow. The backfill doesn't need to be redone; it's already in.

### Failure mode G — Step 5 deploy rolls out and pods crash-loop

**Symptom:** new pods report `CrashLoopBackOff`. Old pods continue serving.

**Diagnosis:**
```bash
kubectl logs -n abaci <new-pod-name> --previous --tail=100
```

**Fix path 1: roll back the deploy.**
```bash
git revert <step-4-sha>
git push origin main
# Argo CD rolls back to pre-step-4 image on next sync (~2 min after image-updater detects)
```
The backfilled data is forward-compatible — old code keeps running fine on it.

**Fix path 2: forward-fix.** If the issue is small (e.g., one consumer of slotId we missed), patch and push. Argo CD rolls forward. Pre-existing pods keep traffic until new ones are healthy.

### Failure mode H — Step 5 deploy rolls partially, mixed-version cluster

**Symptom:** 1-2 of 3 pods on new image, others stuck.

**State:** sticky-session cookie keeps users on the same pod, so a given user sees a consistent version. New writes from new pods include slotId; old pods' writes don't.

**Fix:**
- Wait. Argo CD usually finishes the rollout in ~2-3 min.
- If stuck >5 min: `kubectl describe pod <stuck>` → identify root cause (probe failure, OOM, etc.) → forward-fix or roll back.
- The mop-up in Step 6 handles any old-pod writes from this window.

### Failure mode I — Step 6 mop-up shows lots of new candidates

**Symptom:** dry-run after deploy shows >20 candidate rows.

**Implication:** old pods kept writing without slotId for longer than expected (e.g., slow rollout, or our schema-change code didn't actually start writing slotId everywhere it should).

**Diagnosis:**
```bash
# Are these new (post-Step-2) rows or old rows the script missed?
./scripts/prod-query.sh "SELECT id, status, created_at FROM session_plans WHERE id IN (<candidate ids>) ORDER BY created_at DESC LIMIT 10"
```

If `created_at` is post-Step-2: rollout-window drift, normal. Run mop-up.

If `created_at` is older: there's a bug in the script's candidate detection, or rows were missed. Investigate before doing anything else.

### Worst-case escape hatches

If something genuinely goes off the rails:

- **`kubectl scale deployment abaci-app -n abaci --replicas=0`** stops all traffic to the app instantly. Brings the site down — only use if data integrity is at active risk and triage isn't fast enough.
- **Restore from libsql backup.** Confirm the backup exists and is recent:
  ```bash
  # libsql replication state
  kubectl exec -n abaci deployment/libsql -- ls -la /var/lib/libsql/
  ```
  Restoring is a separate runbook; don't attempt without coordination.
- **Undo a UUID backfill we wish we hadn't done.** There is no row-level undo (the original `null` is gone). If a specific row's fabricated UUIDs are wrong (e.g., we paired a result to the wrong slot), we'd need a separate one-shot to recompute — but the script's pairing logic is deterministic by `(partNumber, slotIndex)`, so the only "wrong" pairings are the orphan-fabricated ones, which by definition had no correct pairing to begin with.

---

## Rollback

The backfilled data is forward-compatible with both the old (`slotId?`) and new (`slotId`) types. So:

- **Aborting before Step 4 push**: data is partially backfilled but every row is internally consistent. Old code running in prod is unaffected by added slotIds; it ignores them or treats them as the optional field they were.
- **Step 5 deploy regresses**: revert the push commit and let Argo CD re-roll:
  ```bash
  git revert <step 4 sha>
  git push origin main
  ```
  Or for an immediate roll-back: `kubectl rollout undo deployment/abaci-app -n abaci` (Argo CD will re-roll on next push, so still revert the commit).

There is no scenario where a successful Step 2 followed by a failed Step 5 leaves data in a corrupt state.

---

## Sign-off criteria

- ✅ Step 6 dry-run prints `Candidate rows: 0`.
- ✅ Step 5 deploy completes successfully, all 3 pods on new SHA.
- ✅ Pod logs over 5 minutes post-rollout show no slotId-related errors:
  ```bash
  kubectl logs -n abaci -l app=abaci-app --tail=500 --since=5m | grep -iE "slotId|undefined|error"
  ```
- ✅ One in-progress prod session renders without error (manual spot-check).

When all four are green, this migration is done. Delete the local `.mjs` script.
