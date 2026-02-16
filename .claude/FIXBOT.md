# Fixbot Reference

Fixbot is the automated CI failure → diagnosis → fix PR pipeline. It handles routine CI breaks so the user doesn't have to babysit every build.

**Key design principle:** Fixbot fixes code and opens PRs. Local Claude Code is the operator that reviews, merges, and ensures deployment completes. The user is only pulled in for judgment calls.

## How fixbot works

1. **CI fails on main** → `diagnose-failure.yml` runs a diagnostic agent
2. Diagnostic agent classifies the failure, creates/updates a `[fixbot]` issue with the `fixbot` label
3. The `fixbot` label triggers `fixbot.yml` → fix agent reads the issue, implements a minimal fix, opens a PR on a `fixbot/` branch
4. After 3 failed retries, the diagnostic agent removes the `fixbot` label, adds `needs-human`, and escalates

Implementation lives in `.github/fixbot/`:
- `diagnostic-prompt.md` — instructions for the diagnostic agent
- `fix-prompt.md` — instructions for the fix agent
- `issue-template.md` — template for fixbot issues

## How local Claude Code should interact with fixbot

### "Ensure main is on prod" procedure

When the user says **"ensure main is on prod"**, follow this procedure:

1. **Check current deploy state**: Compare `git rev-parse HEAD` with what's running on prod (check via k8s MCP — look at pod image SHA or revision label on the abaci-app StatefulSet)
2. **Check CI pipeline**: `gh run list --limit 5` — is there a build in progress? Did it fail?
3. **If build failed**: Check `gh issue list --label fixbot --state open` — fixbot is likely already on it
4. **If fixbot PR exists**: Review the PR (`gh pr list --label fixbot`, then `gh pr view <number>`). If it passes checks and the fix looks correct, merge it. If it needs judgment, tell the user what needs review.
5. **If fixbot committed directly to main** (shouldn't happen, but if it did): Push an empty commit to trigger CI: `git commit --allow-empty -m "ci: trigger build after fixbot commit <sha>" && git push`
6. **Monitor**: After merge/push, wait for CI (tests ~5min, build ~13min), then verify pods roll over via k8s MCP
7. **If no fixbot activity and build is failing**: The failure may be too new for fixbot to have acted, or fixbot itself failed. Check `gh run list --workflow "Diagnose CI Failure"` to see if diagnosis ran. If not, investigate manually.

### Identifying fixbot artifacts

- **Issues**: Prefixed `[fixbot]`, labeled `fixbot`
- **PRs**: On `fixbot/` branches, reference fixbot issues
- **Commits by fixbot**: Authored by the GitHub Actions bot in fix PRs

## What NOT to do

- **Don't manually fix CI failures that have open `[fixbot]` issues** — fixbot is handling it. Check issues first before diving into a manual fix.
- **Don't duplicate fixbot's diagnostic work** — if you see a CI failure, check `gh issue list --label fixbot --state open` before investigating.
- **Don't push empty trigger commits** unless fixbot has committed directly to main (a bug that should be rare after the prompt fix).
- **Don't label issues `fixbot`** unless you want fixbot to attempt an automated fix — the label is the trigger.
