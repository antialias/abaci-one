# Claude Code Instructions for apps/web

## Critical Behavioral Rules

### React Hook Imports
Before using ANY React hook, verify it's imported. Read imports first (lines 1-20), add missing hooks IN THE SAME EDIT as your code. Missing imports break the app.

### Implement Everywhere
When agreeing on a technical approach, implement it in ALL affected code paths. When fixes don't work, first verify you actually implemented the agreed approach everywhere.

### Documentation Graph
All documentation must be reachable from root README via linked path. Unlinked docs are invisible.

### Code Factoring
**Never fork, always factor.** When sharing code between files, extract to shared utility - never copy/paste.

---

## Workflow

1. Make changes → 2. Run `npm run pre-commit` → 3. Tell user ready for testing → 4. Wait for approval → 5. Commit only when approved

**Never auto-commit.** User must manually test before committing.

**Dev server:** User manages it, NOT Claude Code. Never run `pnpm dev` or `npm start`.

---

## Critical Technical Rules

### Database Migrations
**Has caused multiple production outages.** See `.claude/procedures/database-migrations.md`

Quick rules: Never modify schema directly, never modify deployed migrations, always use `npx drizzle-kit generate --custom`, always add `--> statement-breakpoint` between statements.

### Production Dependencies
**NEVER add `tsx`, `ts-node` to `dependencies`.** These belong in `devDependencies` only.

### Styling (Panda CSS)
**This project uses Panda CSS, NOT Tailwind.** See `.claude/reference/panda-css.md`

- Import: `import { css } from '../../styled-system/css'`
- **Gotcha**: `padding: '1 2'` doesn't work - use `padding: '4px 8px'` or `paddingX/paddingY`
- **Fix broken CSS**: Run `/fix-css`

### Data Attributes
All new elements MUST have data attributes: `data-component`, `data-element`, `data-action`, etc.

### React Query (Server State Management)
**This app uses React Query for ALL server state.** See `.claude/reference/react-query-mutations.md`

**Golden Rules:**
1. **NEVER use `fetch()` directly in components** - Use React Query hooks
2. **NEVER use `router.refresh()` after mutations** - Invalidate queries instead
3. **NEVER use `useState` for server data** - Use `useQuery` or `useSuspenseQuery`
4. **ALWAYS check `src/hooks/` first** - A hook likely already exists
5. **ALWAYS add query keys to `src/lib/queryKeys.ts`** - Enables proper cache invalidation

**Quick patterns:**
- Fetching: `useQuery` or custom hook from `src/hooks/`
- Mutations: `useMutation` with `onSuccess` invalidation
- Loading states: `query.isLoading` or `mutation.isPending` (not `useState`)
- Cache refresh: `queryClient.invalidateQueries({ queryKey: ... })`

---

## Database Access

SQLite + Drizzle ORM. Location: `./data/sqlite.db`

**Use MCP tools:** `mcp__sqlite__read_query`, `mcp__sqlite__write_query`, `mcp__sqlite__describe_table`

**DO NOT use bash `sqlite3` commands.**

---

## Kubernetes Deployment (Keel Auto-Updates)

**Production runs on k3s with Keel for automatic image updates.**

### Keel Annotation Placement (CRITICAL)
Keel annotations MUST be on the **workload metadata**, NOT the pod template:

```hcl
# CORRECT - on StatefulSet/Deployment metadata
resource "kubernetes_stateful_set" "app" {
  metadata {
    annotations = {
      "keel.sh/policy" = "force"
      "keel.sh/trigger" = "poll"
      "keel.sh/pollSchedule" = "@every 2m"
    }
  }
}

# WRONG - on pod template (Keel ignores these)
spec {
  template {
    metadata {
      annotations = { ... }  # Keel won't see these!
    }
  }
}
```

### Keel Namespace Watching
Keel must watch all namespaces (not just its own). Verify with:
```bash
kubectl get deployment keel -n keel -o jsonpath='{.spec.template.spec.containers[0].env}' | jq .
```
`NAMESPACE` should be empty or unset. If set to "keel", it only watches the keel namespace.

### Debugging Keel
```bash
# Check if Keel sees your workload
kubectl logs -n keel -l app=keel | grep -i "watch\|poll\|digest"

# Should see: "new watch tag digest job added"
# If not: annotations are wrong or namespace issue

# Check for DNS issues
kubectl logs -n keel -l app=keel | grep -i "error"
```

### LiteFS Replica Migrations
Replicas are read-only. server.js checks `LITEFS_CANDIDATE` env var and skips migrations on replicas. If pods crash with "read only replica" error, this check is missing.

---

## Reference Docs (Read When Relevant)

| Topic | Doc |
|-------|-----|
| Arcade system | `.claude/ARCADE_SYSTEM.md` |
| Panda CSS | `.claude/reference/panda-css.md` |
| React Query (queries, mutations, cache) | `.claude/reference/react-query-mutations.md` |
| Database migrations | `.claude/procedures/database-migrations.md` |
| Merge conflicts | `.claude/procedures/merge-conflicts.md` |
| Flowchart modifications | `.claude/procedures/FLOWCHART_MODIFICATIONS.md` |
| Abacus visualizations | `.claude/reference/abacus-react.md` |
| TensorFlow.js debugging | `.claude/reference/tensorflow-browser-debugging.md` |
| Deployment | `.claude/DEPLOYMENT.md` |
| Z-index management | `.claude/Z_INDEX_MANAGEMENT.md` |
| Game settings persistence | `.claude/GAME_SETTINGS_PERSISTENCE.md` |
| Animation patterns | `.claude/ANIMATION_PATTERNS.md` |
| Vision components | `src/components/vision/VISION_COMPONENTS.md` |
| Flowchart system | `src/lib/flowcharts/README.md` |
| Daily practice | `docs/DAILY_PRACTICE_SYSTEM.md` |

---

## Known Issues

### @soroban/abacus-react TypeScript
TypeScript reports missing exports from `@soroban/abacus-react` but imports work at runtime. Ignore these errors during pre-commit. Known issue, does not block deployment.

### @svg-maps
The @svg-maps packages WORK correctly with dynamic imports. If you see errors, check what else changed.
