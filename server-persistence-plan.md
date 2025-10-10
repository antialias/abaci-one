# Server Persistence Migration Plan

**Greenfield Strategy**: Fast failure, no fallbacks, no backwards compatibility.

## Current localStorage Data (TO BE DELETED)

**1. Player Data** (`soroban-players-v2`):

- Multiple player profiles with UUID-based IDs
- Name, emoji, color, creation timestamp
- Active/inactive status
- Activation order

**2. User Stats** (`soroban-user-stats`):

- Games played, total wins
- Favorite game type
- Best time, highest accuracy

**3. Legacy V1 Data** (`soroban-memory-pairs-profile`):

- Old indexed player system

## Testing Strategy

**Three-Layer Approach:**

1. **Unit Tests**: Pure functions, utilities, schema validation
2. **E2E Tests**: Full user flows with happydom (vitest)
3. **User Tests**: Manual verification of critical paths

**Fast Failure**: Tests fail immediately on any localStorage usage, missing session, or schema violation.

---

## Migration Plan: localStorage → Server Database

### Phase 1: Foundation Setup

**Checkpoint 1.1: Database & Auth Infrastructure**

- Install dependencies (drizzle-orm, drizzle-kit, better-sqlite3, next-auth@beta, jose)
- Configure Drizzle with SQLite
- Set up schema file structure
- Create initial migration for guest sessions table

**Unit Tests**:

- `drizzle.config.test.ts`: Validate config loads correctly
- `schema.test.ts`: Validate schema definitions (types, constraints)
- `migrations.test.ts`: Can run/rollback migrations

**E2E Tests**:

- `database-connection.test.ts`: Connect to DB, run simple query
- `migrations-e2e.test.ts`: Fresh DB → run all migrations → verify schema

**User Tests**:

- ✅ Run `pnpm db:migrate` successfully
- ✅ Inspect DB file with sqlite3 CLI, verify tables exist
- ✅ Run migration twice (should be idempotent)

---

**Checkpoint 1.2: Guest Session System**

- Implement guest token middleware (HttpOnly cookies)
- Set up NextAuth v5 with JWT strategy
- Create guest provider
- Add session type extensions

**Unit Tests**:

- `guest-token.test.ts`: Create/verify tokens, handle expiry, reject invalid
- `auth-config.test.ts`: Validate NextAuth config shape

**E2E Tests**:

- `middleware.test.ts`: First request sets guest cookie, subsequent requests preserve it
- `auth-session.test.ts`: Guest session creation, upgrade flow simulation
- `jwt-callbacks.test.ts`: JWT callback carries guestId on upgrade

**User Tests**:

- ✅ Open app in browser, verify `__Host-guest` cookie exists (DevTools)
- ✅ Cookie is HttpOnly, Secure, SameSite=Lax
- ✅ Refresh page, same cookie value persists
- ✅ Clear cookies, new guest token generated on next visit

### Phase 2: Schema & API Design

**Checkpoint 2.1: Database Schema**

- Create schema for:
  - `users` table (guest + future full users)
  - `players` table (with userId foreign key)
  - `user_stats` table (with userId foreign key)
- Generate and run migrations

**Unit Tests**:

- `schema/users.test.ts`: Validate users table constraints, defaults
- `schema/players.test.ts`: Validate players table, foreign key behavior
- `schema/user-stats.test.ts`: Validate stats table, cascading deletes
- `schema-relations.test.ts`: Join queries work correctly

**E2E Tests**:

- `schema-crud.test.ts`: Insert/update/delete for all tables
- `schema-constraints.test.ts`: Foreign key violations throw, unique constraints work
- `seed-data.test.ts`: Can seed realistic test data

**User Tests**:

- ✅ Insert test user, verify with sqlite3 CLI
- ✅ Insert player with invalid userId, verify FK constraint fails
- ✅ Delete user, verify cascade deletes players/stats

---

**Checkpoint 2.2: API Routes**

- Create `/api/players` endpoints (GET, POST, PUT, DELETE)
- Create `/api/user-stats` endpoints (GET, PUT)
- Create `/api/players/[id]` endpoints
- Add auth middleware to verify guest tokens

**Unit Tests**:

- `api/players/route.test.ts`: Handler logic (GET, POST, PUT, DELETE)
- `api/user-stats/route.test.ts`: Handler logic (GET, PUT)
- `middleware/auth.test.ts`: Auth middleware extracts userId correctly, rejects invalid tokens

**E2E Tests**:

- `api/players.e2e.test.ts`: Full CRUD flow with authenticated requests
- `api/user-stats.e2e.test.ts`: Update stats, verify persistence
- `api/auth-rejection.e2e.test.ts`: Requests without session return 401
- `api/data-isolation.e2e.test.ts`: User A can't access User B's data

**User Tests**:

- ✅ `curl -X GET /api/players` with valid session → 200 + data
- ✅ `curl -X GET /api/players` without session → 401
- ✅ `curl -X POST /api/players` → creates player, verify in DB
- ✅ `curl -X DELETE /api/players/[id]` → deletes player
- ✅ Open two browsers (different sessions), verify data isolation

### Phase 3: React Query Integration

**Checkpoint 3.1: Query Hooks**

- Create `useUserPlayers()` query hook
- Create `useUserStats()` query hook
- Create player mutation hooks (add/update/remove/setActive)
- Create stats mutation hooks

**Unit Tests**:

- `hooks/useUserPlayers.test.ts`: Query hook returns correct data structure
- `hooks/useUserStats.test.ts`: Stats hook returns correct data
- `hooks/mutations.test.ts`: Mutation hooks have correct types, invalidation keys

**E2E Tests**:

- `hooks/players-query.e2e.test.ts`: Hook fetches from API, updates on mutation
- `hooks/stats-query.e2e.test.ts`: Stats updates persist and refetch
- `hooks/cache-invalidation.e2e.test.ts`: Mutations invalidate correct queries
- `hooks/error-handling.e2e.test.ts`: Network errors surface correctly

**User Tests**:

- ✅ Open React DevTools, verify queries show in cache
- ✅ Trigger mutation, verify loading state → success → cache update
- ✅ Go offline, verify queries use cached data
- ✅ Trigger mutation offline, verify error handling

---

**Checkpoint 3.2: Context Rewrite**

- **DELETE** all localStorage read/write code from contexts
- **DELETE** `loadPlayerStorage()`, `savePlayerStorage()` and migration utilities
- **DELETE** V1 compatibility code
- Rewrite `GameModeContext` to use React Query hooks only
- Rewrite `UserProfileContext` to use React Query hooks only

**Unit Tests**:

- `contexts/GameModeContext.test.tsx`: Context provides correct values
- `contexts/UserProfileContext.test.tsx`: Context provides correct values
- `no-localstorage.test.ts`: Grep codebase, fail if localStorage found

**E2E Tests**:

- `contexts/game-mode-flow.e2e.test.tsx`: Add/remove/activate players via context
- `contexts/user-profile-flow.e2e.test.tsx`: Update stats via context
- `contexts/multi-user.e2e.test.tsx`: Multiple sessions maintain separate data
- `contexts/missing-session.e2e.test.tsx`: Throws clear error if no session

**User Tests**:

- ✅ Create new player in UI, verify in DB immediately
- ✅ Update player name, verify persistence
- ✅ Activate/deactivate players, verify state in DB
- ✅ Play game, verify stats update in DB
- ✅ Open DevTools Storage, verify NO localStorage entries
- ✅ Refresh page, verify all state loads from server

### Phase 4: Final Cleanup

**Checkpoint 4.1: Remove Dead Code**

- Delete `src/lib/playerMigration.ts` entirely
- Remove all localStorage constants and references
- Remove all `typeof window !== 'undefined'` localStorage checks
- Remove `isInitialized` state pattern from contexts

**Unit Tests**:

- `dead-code-detection.test.ts`: Grep for localStorage, fail if found
- `dead-code-detection.test.ts`: Grep for playerMigration imports, fail if found
- `dead-code-detection.test.ts`: Grep for STORAGE_KEY constants, fail if found

**E2E Tests**:

- `full-app-flow.e2e.test.tsx`: Complete user journey without localStorage
- `regression.e2e.test.tsx`: All existing test scenarios still pass

**User Tests**:

- ✅ Run `git grep localStorage src/` → no results
- ✅ Run `git grep playerMigration src/` → no results
- ✅ Run full test suite → all green
- ✅ Build production bundle, verify no localStorage in output

---

**Checkpoint 4.2: Add Safeguards**

- Add ESLint rule to prevent localStorage usage
- Add type guards to ensure session exists before API calls
- Throw clear errors if session is missing

**Unit Tests**:

- `eslint-config.test.ts`: Verify localStorage rule is active
- `type-guards.test.ts`: Session type guards work correctly

**E2E Tests**:

- `safeguards.e2e.test.ts`: Attempting API call without session throws expected error
- `error-messages.e2e.test.ts`: Error messages are clear and actionable

**User Tests**:

- ✅ Add `localStorage.setItem()` to code → ESLint error appears
- ✅ Try to bypass type guards → TypeScript compilation fails
- ✅ Run type check → passes
- ✅ Trigger API error → verify error message is helpful

### Phase 5: Polish & Optimization

**Checkpoint 5.1: Optimistic Updates**

- Add optimistic updates to all mutations
- Proper error handling and rollback
- Loading states

**Unit Tests**:

- `optimistic-updates.test.ts`: Optimistic update logic is correct
- `rollback.test.ts`: Failed mutations rollback correctly

**E2E Tests**:

- `optimistic-ui.e2e.test.tsx`: UI updates immediately on mutation
- `optimistic-rollback.e2e.test.tsx`: Network failure triggers rollback
- `loading-states.e2e.test.tsx`: Loading indicators appear/disappear correctly
- `error-recovery.e2e.test.tsx`: User can retry failed operations

**User Tests**:

- ✅ Click "Add Player", verify instant UI update
- ✅ Simulate network failure (DevTools), verify rollback
- ✅ Verify loading spinners appear during async operations
- ✅ Trigger error, verify error message and retry button

---

**Checkpoint 5.2: Performance**

- Add database indexes
- Implement query prefetching where beneficial
- Optimize bundle size

**Unit Tests**:

- `indexes.test.ts`: Verify indexes exist on foreign keys
- `query-performance.test.ts`: Query execution time is acceptable

**E2E Tests**:

- `prefetching.e2e.test.tsx`: Prefetched queries load instantly
- `bundle-size.e2e.test.ts`: Bundle size within acceptable limits
- `performance.e2e.test.tsx`: Time to interactive < 2s

**User Tests**:

- ✅ Run Lighthouse audit → Performance score > 90
- ✅ Test with slow 3G → app remains usable
- ✅ Verify bundle size < 500kb (gzipped)
- ✅ Profile DB queries, verify no N+1 issues
- ✅ Test with 100+ players, verify no slowdown

## Drizzle Schema & Migration Setup

### File Structure

```
apps/web/
├── drizzle.config.ts           # Drizzle Kit configuration
├── drizzle/                    # Generated migrations directory
│   ├── 0000_initial_schema.sql
│   ├── 0001_add_players.sql
│   └── meta/                   # Migration metadata
├── src/
│   ├── db/
│   │   ├── index.ts           # Database client & connection
│   │   ├── schema/            # Schema definitions (source of truth)
│   │   │   ├── users.ts
│   │   │   ├── players.ts
│   │   │   ├── user-stats.ts
│   │   │   └── index.ts       # Re-export all schemas
│   │   └── migrate.ts         # Migration runner for production
│   └── lib/
│       └── db.ts              # Singleton db instance for app
```

### Drizzle Configuration (`drizzle.config.ts`)

```typescript
import type { Config } from "drizzle-kit";

export default {
  schema: "./src/db/schema/index.ts", // Source of truth
  out: "./drizzle", // Migration output directory
  driver: "better-sqlite3",
  dbCredentials: {
    url: process.env.DATABASE_URL || "./data/sqlite.db",
  },
  verbose: true,
  strict: true,
} satisfies Config;
```

### Schema Definition Pattern

Each table gets its own file in `src/db/schema/`:

**users.ts**:

```typescript
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createId } from "@paralleldrive/cuid2";

export const users = sqliteTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  guestId: text("guest_id").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  upgradedAt: integer("upgraded_at", { mode: "timestamp" }),
  email: text("email").unique(),
  name: text("name"),
});
```

**players.ts**:

```typescript
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { users } from "./users";
import { createId } from "@paralleldrive/cuid2";

export const players = sqliteTable("players", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  emoji: text("emoji").notNull(),
  color: text("color").notNull(),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Index for fast lookups by userId
export const playersByUserIdIdx = index("players_user_id_idx").on(
  players.userId,
);
```

**user-stats.ts**:

```typescript
import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { users } from "./users";

export const userStats = sqliteTable("user_stats", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  gamesPlayed: integer("games_played").notNull().default(0),
  totalWins: integer("total_wins").notNull().default(0),
  favoriteGameType: text("favorite_game_type", {
    enum: ["abacus-numeral", "complement-pairs"],
  }),
  bestTime: integer("best_time"),
  highestAccuracy: real("highest_accuracy").notNull().default(0),
});
```

### Database Client Setup (`src/db/index.ts`)

```typescript
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

const sqlite = new Database(process.env.DATABASE_URL || "./data/sqlite.db");

// Enable foreign keys (SQLite requires explicit enable)
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
export { schema };
```

### Migration Workflow

**1. Generate Migration** (after schema changes):

```bash
pnpm drizzle-kit generate:sqlite
```

This diffs `src/db/schema/*.ts` against existing migrations and generates new SQL in `drizzle/`.

**2. Apply Migration** (development):

```bash
pnpm drizzle-kit push:sqlite
```

Or use the migration runner:

```bash
pnpm db:migrate
```

**3. Migration Runner** (`src/db/migrate.ts`):

```typescript
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { db } from "./index";

// Run all pending migrations
migrate(db, { migrationsFolder: "./drizzle" });

console.log("✅ Migrations complete");
```

**4. Package.json Scripts**:

```json
{
  "scripts": {
    "db:generate": "drizzle-kit generate:sqlite",
    "db:migrate": "tsx src/db/migrate.ts",
    "db:push": "drizzle-kit push:sqlite",
    "db:studio": "drizzle-kit studio",
    "db:drop": "drizzle-kit drop"
  }
}
```

### Migration Strategy

**Development Flow**:

1. Modify schema files in `src/db/schema/`
2. Run `pnpm db:generate` → creates migration SQL
3. Review generated SQL in `drizzle/NNNN_*.sql`
4. Run `pnpm db:migrate` → applies migration
5. Test with `pnpm db:studio` (visual DB browser)

**Production Flow**:

1. Migrations are committed to git
2. On deploy, run `pnpm db:migrate` before starting server
3. Application code never runs before migrations complete

**Rollback Strategy**:

- Drizzle doesn't auto-generate down migrations
- For critical rollbacks: manually write inverse SQL
- Better approach: forward-only migrations with careful planning
- Test migrations in staging before production

### Testing Migrations

**Unit Tests** verify schema correctness:

```typescript
import { describe, it, expect } from "vitest";
import { users, players, userStats } from "@/db/schema";

describe("Schema validation", () => {
  it("users table has correct structure", () => {
    expect(users.id).toBeDefined();
    expect(users.guestId).toBeDefined();
  });

  it("players table has foreign key to users", () => {
    expect(players.userId.references).toBeDefined();
  });
});
```

**E2E Tests** verify migrations work:

```typescript
import { describe, it, beforeEach, expect } from "vitest";
import Database from "better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { drizzle } from "drizzle-orm/better-sqlite3";

describe("Migrations", () => {
  beforeEach(() => {
    // Fresh in-memory DB for each test
    const sqlite = new Database(":memory:");
    const db = drizzle(sqlite);
    migrate(db, { migrationsFolder: "./drizzle" });
  });

  it("applies all migrations successfully", () => {
    // If we get here, migrations worked
    expect(true).toBe(true);
  });

  it("creates all expected tables", () => {
    const tables = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all();

    expect(tables).toContainEqual({ name: "users" });
    expect(tables).toContainEqual({ name: "players" });
    expect(tables).toContainEqual({ name: "user_stats" });
  });
});
```

### Why This Setup

**Drizzle Kit Benefits**:

- Type-safe schema definitions
- Automatic migration generation
- Diffs are smart (only generates what changed)
- SQL is readable and reviewable
- Studio for visual DB inspection

**SQLite Benefits**:

- Single file database (easy backup/restore)
- Zero configuration
- Fast for read-heavy workloads
- Perfect for < 100k users
- Easy to migrate to Turso/LibSQL later if needed

**Migration Philosophy**:

- Schema files are source of truth
- Generated SQL is committed to git
- Migrations are immutable once deployed
- Always forward (no down migrations)
- Test migrations before deploy

---

## Key Architecture Decisions

**Database**: SQLite via better-sqlite3 (simple, file-based, perfect for this use case)

**Schema Pattern**:

```
users (id, guestId, createdAt, upgradedAt?)
  ↓ 1:many
players (id, userId, name, emoji, color, isActive, createdAt)

users
  ↓ 1:1
user_stats (userId, gamesPlayed, totalWins, ...)
```

**Session Flow**:

1. Middleware creates guest cookie on first visit
2. NextAuth JWT contains guest ID
3. All API routes verify session and scope to userId
4. Future: Guest can upgrade to full account, data migrates automatically

**Fast Failure Philosophy**:

- No localStorage fallbacks
- No gradual migration
- No V1 compatibility
- Hard cutover at each checkpoint
- TypeScript ensures session is always checked
- Clear error messages if auth fails
- ESLint prevents localStorage usage

**Why This Approach**:

- No localStorage = works across devices/browsers when upgraded
- Stateless sessions = no session DB writes
- Guest-first = zero friction, can play immediately
- Clean upgrade path = preserve data when user creates account
- React Query = optimal caching, mutations, invalidation
- Fast failure = issues surface immediately during development
