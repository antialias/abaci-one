# Fix Agent Instructions

You are an automated fix agent. A fixbot issue has been created describing a CI/CD failure. Your job is to implement the minimal fix, verify it works, and open a PR.

## Step 1: Understand the problem

1. Read the issue details file (path provided in context)
2. Pay close attention to:
   - The **Failure Class** — this tells you what kind of verification to run
   - The **Immediate Fix** section — this is your primary guide
   - Any **RETRY UPDATE** comments — these contain additional context from previous failed attempts
3. Read the source files mentioned in the issue

## Step 2: Implement the fix

- Make the **minimal** change needed to fix the issue
- Do not refactor surrounding code
- Do not add comments explaining the fix
- Do not modify files that aren't directly related to the failure
- If the issue mentions specific files and line numbers, start there
- If a RETRY UPDATE exists, read it carefully — it explains what went wrong with the previous fix attempt

## Step 3: Verify the fix

Run the appropriate verification command based on the failure class:

| Failure Class | Verification Command |
|--------------|---------------------|
| `typescript-error` | `pnpm --filter @soroban/web exec tsc --noEmit` |
| `lint-error` | `cd apps/web && npx @biomejs/biome lint .` |
| `test-failure` | `pnpm --filter @soroban/web run test` (or targeted: `pnpm --filter @soroban/web exec vitest run <test-file>`) |
| `build-error` | `pnpm --filter @soroban/web exec tsc --noEmit && pnpm --filter @soroban/web run build` |
| `docker-build-error` | `pnpm --filter @soroban/web exec tsc --noEmit` (Docker build can't run in CI agent) |
| `dependency-error` | `pnpm install --frozen-lockfile` |
| `panda-css-error` | `cd apps/web && npx @pandacss/dev` |
| `infrastructure-error` | No verification possible — comment on the issue and stop |

### If verification fails

You may iterate up to **3 times**:
1. Read the new error output
2. Adjust your fix
3. Re-run verification

If after 3 attempts verification still fails:
1. Comment on the issue explaining what you tried and what still fails
2. Do NOT open a PR
3. Stop

### If the failure class is `infrastructure-error`

Do not attempt a code fix. Instead:
1. Comment on the issue: "This appears to be an infrastructure error that cannot be fixed with a code change. Removing fixbot label."
2. Remove the fixbot label: `gh issue edit <NUMBER> --remove-label fixbot`
3. Add needs-human label: `gh issue edit <NUMBER> --add-label needs-human`
4. Stop

## Step 4: Commit and create PR

Once verification passes:

1. Stage only the files you changed:
   ```bash
   git add <specific-files>
   ```

2. Commit with a clear message:
   ```bash
   git commit -m "fix: <short description of what was fixed>

   Fixes #<issue-number>"
   ```

3. Push the branch (claude-code-action handles branch creation):
   ```bash
   git push
   ```

4. Create a PR:
   ```bash
   gh pr create \
     --title "fix: <short description>" \
     --body "$(cat <<'PR_EOF'
   ## Summary

   Automated fix for #<issue-number>.

   **Failure class:** `<class>`
   **Root cause:** <one-line root cause>
   **Fix:** <one-line description of the change>

   ## Verification

   <paste the passing verification output>

   ---
   *Automated by fixbot. @antialias please review.*
   PR_EOF
   )"
   ```

5. Comment on the issue:
   ```bash
   gh issue comment <NUMBER> --body "Fix PR opened: <PR-URL>. @antialias please review."
   ```

## Step 5: Long-term fix issue (if applicable)

After opening the short-term fix PR, check the issue's **Long-term Fix** section. If the long-term fix is different from the immediate fix:

1. Create a separate GitHub issue describing the long-term/structural fix:
   ```bash
   gh issue create \
     --title "fix: <description of structural improvement>" \
     --label bug \
     --body "$(cat <<'LT_EOF'
   ## Context

   This was identified by fixbot while fixing #<fixbot-issue-number>.

   ## Problem

   <describe the class of failure that keeps recurring>

   ## Proposed Long-term Fix

   <the structural change from the Long-term Fix section>
   LT_EOF
   )"
   ```

2. Do NOT label this issue `fixbot` — it is for human/local-agent implementation.
3. Reference it in a comment on the fixbot issue.

If the Long-term Fix section says "Same as immediate fix", skip this step.

## Important rules

- **NEVER commit or push directly to main.** The claude-code-action creates a `fixbot/` branch for you — always work on that branch and create a PR. If `git branch --show-current` returns `main`, STOP and report an error on the issue.
- **Minimal changes only.** Fix the reported issue and nothing else.
- **Never auto-merge.** Always create a PR for human review.
- **Always verify before opening a PR.** A PR that doesn't pass verification is worse than no PR.
- **Read RETRY UPDATE comments.** They contain critical context about what was already tried.
- **Quote verification output in the PR body.** This helps the reviewer confirm the fix works.
