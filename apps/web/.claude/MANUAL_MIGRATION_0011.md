# Manual Migration: room_game_configs Table

**Date:** 2025-10-15
**Migration:** Create `room_game_configs` table (equivalent to drizzle migration 0011)

## Context

This migration was applied manually using sqlite3 CLI instead of through drizzle-kit's migration system, because the interactive prompt from `drizzle-kit push` cannot be automated in the deployment pipeline.

## What Was Done

### 1. Created Table

```sql
CREATE TABLE IF NOT EXISTS room_game_configs (
  id TEXT PRIMARY KEY NOT NULL,
  room_id TEXT NOT NULL,
  game_name TEXT NOT NULL,
  config TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (room_id) REFERENCES arcade_rooms(id) ON UPDATE NO ACTION ON DELETE CASCADE
);
```

### 2. Created Index

```sql
CREATE UNIQUE INDEX IF NOT EXISTS room_game_idx ON room_game_configs (room_id, game_name);
```

### 3. Migrated Existing Data

Migrated 6000 game configs from the old `arcade_rooms.game_config` column to the new normalized table:

```sql
INSERT OR IGNORE INTO room_game_configs (id, room_id, game_name, config, created_at, updated_at)
SELECT
  lower(hex(randomblob(16))) as id,
  id as room_id,
  game_name,
  game_config as config,
  created_at,
  last_activity as updated_at
FROM arcade_rooms
WHERE game_config IS NOT NULL
  AND game_name IS NOT NULL;
```

**Results:**

- 5991 matching game configs migrated
- 9 memory-quiz game configs migrated
- Total: 6000 configs

## Old vs New Schema

**Old Schema:**

- `arcade_rooms.game_config` (TEXT/JSON) - stored config for currently selected game only
- Config was lost when switching games

**New Schema:**

- `room_game_configs` table - one row per game per room
- Unique constraint on (room_id, game_name)
- Configs persist when switching between games

## Verification

```bash
# Verify table exists
sqlite3 data/sqlite.db ".tables" | grep room_game_configs

# Verify schema
sqlite3 data/sqlite.db ".schema room_game_configs"

# Count migrated data
sqlite3 data/sqlite.db "SELECT COUNT(*) FROM room_game_configs;"
# Expected: 6000

# Check data distribution
sqlite3 data/sqlite.db "SELECT game_name, COUNT(*) FROM room_game_configs GROUP BY game_name;"
# Expected: matching: 5991, memory-quiz: 9
```

## Related Files

This migration supports the refactoring documented in:

- `.claude/GAME_SETTINGS_PERSISTENCE.md` - Architecture documentation
- `src/lib/arcade/game-configs.ts` - Shared config types
- `src/lib/arcade/game-config-helpers.ts` - Database access helpers

## Note on Drizzle Migration Tracking

This migration was NOT recorded in drizzle's `__drizzle_migrations` table because it was applied manually. This is acceptable because:

1. The schema definition exists in code (`src/db/schema/room-game-configs.ts`)
2. The table was created with the exact schema drizzle would generate
3. Future schema changes will go through proper drizzle migrations
4. The `arcade_rooms.game_config` column is preserved for rollback safety

## Rollback Plan

If issues arise, the old system can be restored by:

1. Reverting code changes (game-config-helpers.ts, API routes, validators)
2. The old `game_config` column still exists in `arcade_rooms` table
3. Data is still there (we only read from it, didn't delete it)

The new `room_game_configs` table can be dropped if needed:

```sql
DROP TABLE IF EXISTS room_game_configs;
```

## Future Work

Once this migration is stable in production:

1. Consider dropping the old `arcade_rooms.game_config` column
2. Add this migration to drizzle's migration journal for tracking (optional)
3. Monitor for any issues with settings persistence
