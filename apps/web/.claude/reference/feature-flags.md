# Feature Flags

Global on/off toggles with optional JSON config, managed via admin UI at `/admin/feature-flags`. Supports per-user overrides for testing features with individual accounts and role-based gating to restrict flags by auth role.

## Server-Side (API routes, server components, server actions)

```typescript
import { isEnabled, getFlag, getFlagConfig } from '@/lib/feature-flags'

// Simple boolean check (returns false if flag doesn't exist)
if (await isEnabled('billing.enabled')) {
  // billing is on
}

// With a custom default (returns true if flag doesn't exist)
const showBeta = await isEnabled('beta.new_dashboard', true)

// Per-user override check — override takes precedence over global
if (await isEnabled('billing.enabled', { userId: session.user.id })) {
  // billing is on for THIS user (even if globally off)
}

// Get full flag (enabled + parsed config), null if missing
const flag = await getFlag('billing.free_tier_limits')
// flag: { enabled: boolean, config: unknown } | null

// With user override
const flag = await getFlag('billing.free_tier_limits', { userId })

// Get typed config with a default
const limits = await getFlagConfig('billing.free_tier_limits', {
  maxStudents: 1,
  historyLimit: 5,
})
// limits is typed as the default's type
```

**Caching:** All flag reads use an in-memory cache (30s TTL). Mutations (via admin API) invalidate the cache locally and publish to Redis so other replicas invalidate too. You don't need to worry about stale reads in hot paths — 30s is the worst case. Per-user overrides query the DB directly (no cache) since they're low-volume admin operations.

## Client-Side (React components)

```typescript
import { useFeatureFlag, useFeatureFlags } from '@/hooks/useFeatureFlag'

// Single flag — most common usage
function MyComponent() {
  const { enabled, config } = useFeatureFlag('billing.enabled')

  if (!enabled) return <FreeVersionUI />
  return <PaidVersionUI config={config} />
}

// All flags at once (for dashboards or conditional rendering of many features)
function FeatureGatedApp() {
  const { flags } = useFeatureFlags()

  if (flags['experimental.dark_mode']?.enabled) {
    // ...
  }
}
```

**No extra API request.** Flags are prefetched server-side in the root layout (`src/app/layout.tsx`) and hydrated into the React Query cache via `HydrationBoundary`. The prefetch is session-aware — logged-in users get their per-user overrides merged in. When `useFeatureFlag` runs on the client, the data is already in the cache — no fetch, no loading state, no flash. React Query will silently revalidate in the background after 60s stale time.

**Re-render efficiency:** `useFeatureFlag` uses `select` + `structuralSharing` so components only re-render when their specific flag's `enabled` or `config` values actually change — not when other flags change or a background refetch returns identical data.

## Per-User Overrides

Override the global flag value for specific users. Useful for testing features (e.g., billing) with your own account before enabling globally.

**How it works:**
- When evaluating a flag, if a `userId` is provided, the system checks `feature_flag_overrides` first
- If an override exists for that user+flag, the override's `enabled` value is used
- Override config takes precedence; if override config is null, the global config is inherited
- The public `/api/feature-flags` endpoint is session-aware: logged-in users get overrides merged
- The root layout prefetch also uses the session, so hydrated data reflects overrides

**Admin UI:** Expand any flag in `/admin/feature-flags` to see the "Per-User Overrides" section. Enter a user email to add an override.

**Admin API:**

```
GET /api/admin/feature-flags/[key]/overrides        — list overrides for a flag
PUT /api/admin/feature-flags/[key]/overrides         — set override (body: { email, enabled, config? })
DELETE /api/admin/feature-flags/[key]/overrides/[userId] — remove override
```

**Server-side override CRUD:**

```typescript
import { setOverride, deleteOverride, getOverridesForFlag } from '@/lib/feature-flags'

await setOverride('billing.enabled', userId, { enabled: true })
await deleteOverride('billing.enabled', userId)
const overrides = await getOverridesForFlag('billing.enabled')
```

## Role-Based Gating

Restrict which auth roles can see a flag as enabled. When `allowedRoles` is set, only users with a listed role see the flag — it's excluded from `getAllFlags` and evaluates as disabled for unlisted roles.

**Roles:** `guest` (not logged in), `user` (logged in), `admin` (admin email list).

**Database:** `allowed_roles` column on `feature_flags` — `null` (default, all roles) or JSON array like `["admin"]` or `["user","admin"]`.

**Server-side usage:**

```typescript
// Role-aware check — pass userRole from withAuth context
if (await isEnabled('admin.dashboard', { userId, userRole: 'admin' })) {
  // only visible to admins
}

// getFlag also supports userRole
const flag = await getFlag('beta.feature', { userId, userRole })

// getAllFlags filters by role
const flags = await getAllFlags(userId, userRole)
```

**How it works:**
- `allowedRoles: null` — flag visible to everyone (backward compatible default)
- `allowedRoles: ["admin"]` — only admins see the flag; guests and users get it excluded/disabled
- `allowedRoles: ["user", "admin"]` — guests excluded
- Per-user overrides only apply if the user's role is in the allowlist
- The public `/api/feature-flags` endpoint passes `userRole` from `withAuth` context
- The root layout computes `userRole` from session and passes it to `getAllFlags`
- Admin GET (`/api/admin/feature-flags`) returns all flags unfiltered — admins always see metadata

**Admin UI:** Create and edit forms have role checkboxes (Guest / User / Admin). All unchecked = null (all roles). Role badges appear next to the flag key in the table when `allowedRoles` is set.

**Admin API:**

```
POST /api/admin/feature-flags
{ "key": "admin.tool", "enabled": true, "allowedRoles": ["admin"] }

PATCH /api/admin/feature-flags/[key]
{ "allowedRoles": ["user", "admin"] }  // restrict to logged-in users
{ "allowedRoles": null }                // remove restriction
```

## Creating Flags

Flags are created via the admin UI or the admin API:

```
POST /api/admin/feature-flags
{ "key": "billing.enabled", "enabled": false, "description": "Master billing switch" }
```

Keys must be lowercase dot-namespaced identifiers: `billing.enabled`, `beta.new_dashboard`, etc.

Config is optional JSON attached to a flag — use it for structured data like limits, percentages, or variant definitions:

```
POST /api/admin/feature-flags
{
  "key": "billing.free_tier_limits",
  "enabled": false,
  "config": "{\"maxStudents\":1,\"historyLimit\":5}",
  "description": "Free tier feature limits"
}
```

## Seeding New Flags

**Every new feature flag must be seeded via a database migration.** This ensures the flag exists in all environments (dev, staging, production) without manual steps.

### How to seed a flag

1. Create the feature code gated behind `isEnabled('your-flag.key')`
2. Generate a migration: `npx drizzle-kit generate --custom --name=seed-your-flag`
3. Write the seed SQL:

```sql
INSERT OR IGNORE INTO `feature_flags` (`key`, `enabled`, `description`, `created_at`, `updated_at`)
VALUES ('your-flag.key', 0, 'Human-readable description of what this flag controls', strftime('%s', 'now'), strftime('%s', 'now'));
```

4. Fix timestamp ordering in `drizzle/meta/_journal.json` if needed (see database migrations doc)
5. Run `pnpm db:migrate` to apply locally
6. Commit the migration along with your feature code

### Why migrations?

- **Automatic:** Runs via the PreSync migration job in Argo CD — zero manual steps on deploy
- **Version controlled:** Flag creation is tied to the PR that adds the feature
- **Idempotent:** `INSERT OR IGNORE` is safe to re-run
- **Disabled by default:** Flag ships as `enabled=0` — flip it on via admin UI when ready to launch

### After deploy

- **Local dev:** Enable with `mcp__sqlite__write_query`: `UPDATE feature_flags SET enabled=1 WHERE key='your-flag.key'`
- **Production:** Enable via admin UI at `/admin/feature-flags` or per-user override for staged rollout
- **Rollback:** Disable the flag in admin UI — no deploy needed

### Example: session-song.enabled

```
-- Migration 0112: seed-session-song-flag.sql
INSERT OR IGNORE INTO `feature_flags` (`key`, `enabled`, `description`, `created_at`, `updated_at`)
VALUES ('session-song.enabled', 0, 'AI-generated celebration songs for practice sessions (requires family tier)', strftime('%s', 'now'), strftime('%s', 'now'));
```

Shipped disabled. Enable for yourself first via per-user override, test, then enable globally.

## Conventions

- **Namespace with dots:** `billing.enabled`, `billing.free_tier_limits`, `beta.new_editor`
- **Default to disabled:** New flags should be created with `enabled: false`
- **Seed via migration:** Every flag gets an `INSERT OR IGNORE` migration so it exists in all environments automatically
- **Use `isEnabled()` server-side, `useFeatureFlag()` client-side** — don't fetch flags manually
- **Don't cache flag results in component state** — the hooks handle caching
- **Gate at the boundary:** Check the flag once at the top of a route handler or component, not deep in utility functions
- **Use overrides for testing:** Enable a flag for yourself first, test, then enable globally

## Admin API

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `GET /api/feature-flags` | GET | guest | Bulk fetch (session-aware, merges overrides) |
| `GET /api/admin/feature-flags` | GET | admin | List with full metadata |
| `POST /api/admin/feature-flags` | POST | admin | Create flag |
| `PATCH /api/admin/feature-flags/[key]` | PATCH | admin | Update flag |
| `DELETE /api/admin/feature-flags/[key]` | DELETE | admin | Delete flag |
| `GET /api/admin/feature-flags/[key]/overrides` | GET | admin | List overrides for a flag |
| `PUT /api/admin/feature-flags/[key]/overrides` | PUT | admin | Set per-user override |
| `DELETE /api/admin/feature-flags/[key]/overrides/[userId]` | DELETE | admin | Remove override |

## Files

| File | Purpose |
|------|---------|
| `src/db/schema/feature-flags.ts` | Drizzle schema (global flags) |
| `src/db/schema/feature-flag-overrides.ts` | Drizzle schema (per-user overrides) |
| `src/lib/feature-flags.ts` | Server-side library (cache + Redis invalidation + override evaluation) |
| `src/hooks/useFeatureFlag.ts` | Client-side React Query hooks |
| `src/app/api/feature-flags/route.ts` | Public GET endpoint (session-aware) |
| `src/app/api/admin/feature-flags/route.ts` | Admin GET + POST |
| `src/app/api/admin/feature-flags/[key]/route.ts` | Admin PATCH + DELETE |
| `src/app/api/admin/feature-flags/[key]/overrides/route.ts` | Admin override GET + PUT |
| `src/app/api/admin/feature-flags/[key]/overrides/[userId]/route.ts` | Admin override DELETE |
| `src/app/admin/feature-flags/FeatureFlagsClient.tsx` | Admin UI (with overrides management) |
