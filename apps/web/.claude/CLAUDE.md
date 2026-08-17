# Claude Code Instructions for apps/web

## Workflow

1. Make changes → 2. Run `npm run pre-commit` → 3. Tell user ready for testing → 4. Wait for approval → 5. Commit only when approved

**Never auto-commit.** User must manually test before committing.

**Dev server:** User manages it, NOT Claude Code. Never run `pnpm dev` or `npm start`. **Dev server runs on port 3000** — do not assume 3002 or any other port.

### E2E Tests (Playwright)
- **Use `npx @playwright/test test`**, NOT `npx playwright test` — the monorepo has both packages and the wrong binary causes version conflicts
- **Always pass `BASE_URL=http://localhost:3000`** to skip playwright's webServer auto-start
- **Check existing DB state before writing tests** — use `mcp__sqlite__read_query` to understand what data already exists (e.g., seed students, existing sessions). Don't assume a clean database.
- **Prefer archiving over deleting** for test cleanup — FK constraints make hard deletes fail silently. The `isArchived` flag excludes records from enforcement checks without breaking referential integrity.
- **Tests sharing mutable state (same user account) must run serially** — use `test.describe.configure({ mode: 'serial' })`

---

## Critical Technical Rules

### Identity Model (Viewer / Guest / User)
**Every visitor has a user ID — even guests.** The identity system has three tiers:

| Tier | `getViewer()` | `getUserId()` | Has DB user record | Has NextAuth session |
|------|--------------|---------------|-------------------|---------------------|
| Authenticated | `{ kind: 'user', session }` | Returns `session.user.id` | Yes | Yes |
| Guest | `{ kind: 'guest', guestId }` | **Creates a user record** and returns its ID | Yes (auto-created) | No |
| Unknown | `{ kind: 'unknown' }` | Throws | No | No |

**Critical rules:**
- `getUserId()` returns a valid UUID for **both** authenticated users and guests. NEVER use it to check if someone is "logged in".
- To check if someone is truly authenticated (not a guest), use `getViewer()` and check `kind === 'user'`.
- `withAuth()` in API routes provides `userRole` — `'guest'` vs `'user'` vs `'admin'`. Use this to distinguish auth level server-side.
- `!!userId` is NOT an authentication check. Guests have user IDs.
- When a component needs to behave differently for guests vs authenticated users (e.g., showing an email input vs one-click action), the server page should use `getViewer()` and only pass `userId` for `kind === 'user'`.

### Database Migrations
**Has caused multiple production outages.** See `.claude/procedures/database-migrations.md`

**NEVER run `drizzle-kit push`.** It applies schema changes to the local DB without creating migration records, so the next `pnpm dev` crashes trying to re-apply migrations that already exist. Always use the `/db-migrate` skill for all schema changes — no exceptions, no "quick iteration" shortcuts.

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

### Storybook
Global decorators are in `.storybook/preview.tsx`. It wraps all stories with: `SessionProvider` (next-auth), `QueryClientProvider`, `ThemeProvider`, `NextIntlClientProvider`, `AbacusDisplayProvider`. If a component needs a provider not in that list, add a story-level decorator or add it to the global preview.

**`AppNavBar` contains multiple sub-components internally** (e.g., `HamburgerMenu` is defined inside `AppNavBar.tsx`, not in a separate file). If a stack trace references a function name, search the *importing file's* imports, not just files matching that function name.

---

## Database Access

**Local dev:** SQLite + Drizzle ORM at `./data/sqlite.db`. Use MCP tools: `mcp__sqlite__read_query`, `mcp__sqlite__write_query`, `mcp__sqlite__describe_table`. Do NOT use bash `sqlite3` commands.

**Production:** libsql server in-cluster (NOT a local file). Use `./scripts/prod-query.sh "SQL"` or see `infra/terraform/CLAUDE.md` → "Production Database Access" for programmatic access via Kubernetes MCP.

---

## Kubernetes Deployment

Production runs on k3s with Argo CD + argocd-image-updater — new images pushed to ghcr.io deploy automatically. **Do NOT manually `kubectl rollout restart`** (Argo CD handles it) and **never add `imagePullSecrets`/registry credentials** (the package is public; expired creds cause a 403 instead of anonymous fallback). Full details — CI/CD flow, ghcr registry rules, Argo CD debugging, PreSync stuck-sync fix — live in `infra/terraform/CLAUDE.md` → Deployment Workflow.

---

## Blog System

Posts live at `apps/web/content/blog/{slug}.md` with YAML frontmatter.

**To write a post:** use `/write-blog-post` — it covers the full workflow.

**Quick reference:**
- Required frontmatter: `title`, `description`, `author`, `publishedAt`, `updatedAt`, `tags`
- Hero types: `component` (pre-built React), `generated` (AI image), `storybook` (screenshot), `html` (raw HTML file)
- Hero components: `ten-frames`, `multi-digit`, `subtraction-scaffolding`, `blame-distribution`, `difficulty-plot-mastery`, `readiness-all-variants`, `vision-before-after`, `vision-showcase`
- Inline embeds: `<!-- EMBED: id "desc" -->` marker in markdown + `content/blog/embeds/{slug}.json` config
- Embed types: `component` (from inline registry) or `html` (file at `content/blog/embed-html/{slug}/{id}.html`)
- HTML embed files (especially worksheet previews) are populated via the admin snapshot capture tool, NOT by hand
- Admin panel: `/admin/blog-images` — manages hero images, prompts, crop, Storybook capture, HTML editors, embed configs
- Registries: `src/lib/blog/heroComponentRegistry.tsx`, `src/lib/blog/inlineComponentRegistry.tsx`

## Euclid's Elements Interactive (Toys)

Interactive compass-and-straightedge exploration of Euclid's Elements Book I. Inspired by Byrne's 1847 color-coded edition.

**Reference files** (READ THESE before working on the Euclid toy — they contain the full text of Book I so you don't need to re-fetch it):
- `apps/web/src/components/toys/euclid/reference/book1-foundations.md` — All 23 definitions, 5 postulates, 5 common notions with commentary
- `apps/web/src/components/toys/euclid/reference/book1-propositions.md` — All 48 propositions: statements, types (construction/theorem), proof summaries, dependencies
- `apps/web/src/components/toys/euclid/reference/book1-dependency-graph.md` — Machine-readable DAG of proposition dependencies, thematic groupings, parallel postulate boundary
- `apps/web/src/components/toys/euclid/reference/pedagogy-and-design.md` — Byrne-inspired design notes, color palette, interaction model, data structures, progression tracks
- `apps/web/src/components/toys/euclid/reference/authoring-guide.md` — Step-by-step guide for implementing new propositions: geometry, tutorials, exploration narration, draggable points, testing
- `apps/web/src/components/toys/euclid/reference/architecture.md` — Recipe system, adapters, ghost/ceremony pipeline, rendering architecture, dual authoring patterns

**Architecture decision:** New toy at `toys/euclid/`, NOT an extension of the coordinate plane. Reuses shared infrastructure (Canvas 2D + RAF loop, coordinate conversions, collision detection, hit testing) but has its own construction-oriented interaction model. Uses `@flatten-js/core` for intersection computation.

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
