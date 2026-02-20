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

Quick rules: Never modify schema directly, never modify deployed migrations, always use `npx drizzle-kit generate --custom`, always add `--> statement-breakpoint` between statements, **always commit entire `drizzle/` directory** (includes meta files required for migration to run).

### Production Dependencies
**NEVER add `tsx`, `ts-node` to `dependencies`.** These belong in `devDependencies` only.

### Styling (Panda CSS)
**This project uses Panda CSS, NOT Tailwind.** See `.claude/reference/panda-css.md`

- Import: `import { css } from '../../styled-system/css'`
- **Gotcha**: `padding: '1 2'` doesn't work - use `padding: '4px 8px'` or `paddingX/paddingY`
- **Fix broken CSS**: Run `/fix-css`

### Nav Height Offset (Fixed-Position AppNavBar)
**The `AppNavBar` is `position: fixed` and overlaps page content.** Every page showing the nav MUST account for its height. How this is handled depends on the code path:

- **`PageWithNav` without `navTitle`** (standard pages like practice, settings, pricing): The component automatically wraps children in a div with `paddingTop: var(--app-nav-height)`. Pages must NEVER add their own nav-height padding — just add content padding (e.g., `paddingTop: '2rem'`), NOT `calc(80px + 2rem)`. For full-viewport-height layouts (`height: 100vh` + `overflow: hidden`), use `height: 'calc(100vh - var(--app-nav-height))'` instead.
- **`PageWithNav` with `navTitle`** (arcade games, guide): Children are rendered WITHOUT automatic padding. These pages use `StandardGameLayout` (which dynamically measures nav height) or the `with-fixed-nav` CSS class.
- **`AppNavBar` used directly** (toys, euclid): Must handle nav offset themselves via `paddingTop: 'var(--app-nav-height)'`.
- **Preview mode**: No nav rendered, no offset needed.

### Socket.IO Connections
**NEVER import `io` from `socket.io-client` directly.** Use `createSocket()` from `@/lib/socket` instead. It provides the correct server path (`/api/socket`). Calling `io()` directly will silently fail to connect.

```typescript
import { createSocket } from '@/lib/socket'
const socket = createSocket({ reconnection: true })
```

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

## Kubernetes Deployment (Argo CD Auto-Updates)

**Production runs on k3s with Argo CD + argocd-image-updater for automatic image deployments.**

- When a new image is pushed to ghcr.io, argocd-image-updater detects it and triggers a rollout
- Do NOT manually trigger `kubectl rollout restart` - Argo CD handles this automatically
- Argo CD runs in the `argocd` namespace

### Debugging Argo CD
```bash
# Check Argo CD image updater logs
kubectl logs -n argocd -l app.kubernetes.io/name=argocd-image-updater --tail=50

# Check Argo CD app status
kubectl get applications -n argocd
```

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
| Background tasks | `.claude/reference/background-tasks.md` |
| TTS audio system | `.claude/reference/tts-audio-system.md` |
| Voice session modes | `.claude/reference/session-modes.md` |
| Number line guided experiences | `.claude/reference/number-line-guided-experiences.md` |
| Feature flags | `.claude/reference/feature-flags.md` |
| Fixbot system | `.claude/FIXBOT.md` |
| Forge JWT for browser testing | `.claude/procedures/forge-jwt-for-testing.md` |

---

## Stripe Test Mode

App uses Stripe test keys locally. To test checkout, use these fake cards:

| Card | Simulates |
|------|-----------|
| `4242 4242 4242 4242` | Successful payment |
| `4000 0000 0000 3220` | 3D Secure required |
| `4000 0000 0000 9995` | Declined |

Use any future expiry, any 3-digit CVC, any 5-digit ZIP.

The verify-on-redirect flow (`/api/billing/checkout/verify`) syncs the subscription locally after Stripe redirects back, so webhooks aren't needed for local dev.

---

## Known Issues

### @soroban/abacus-react TypeScript
TypeScript reports missing exports from `@soroban/abacus-react` but imports work at runtime. Ignore these errors during pre-commit. Known issue, does not block deployment.

### @svg-maps
The @svg-maps packages WORK correctly with dynamic imports. If you see errors, check what else changed.
