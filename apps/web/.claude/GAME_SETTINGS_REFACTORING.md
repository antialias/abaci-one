# Game Settings Persistence - Refactoring Recommendations

## Current Pain Points

1. **Type safety is weak** - Easy to forget to add a setting in one place
2. **Duplication** - Config reading logic duplicated in socket-server.ts for each game
3. **Manual synchronization** - Have to manually keep validator signature, provider, and socket server in sync
4. **Error-prone** - Easy to hardcode values or forget to read from config

## Recommended Refactorings

### 1. Create Shared Config Types (HIGHEST PRIORITY)

**Problem:** Each game's settings are defined in multiple places with no type enforcement

**Solution:** Define a single source of truth for each game's config

```typescript
// src/lib/arcade/game-configs.ts

export interface MatchingGameConfig {
  gameType: "abacus-numeral" | "complement-pairs";
  difficulty: number;
  turnTimer: number;
}

export interface MemoryQuizGameConfig {
  selectedCount: 2 | 5 | 8 | 12 | 15;
  displayTime: number;
  selectedDifficulty: DifficultyLevel;
  playMode: "cooperative" | "competitive";
}

export interface ComplementRaceGameConfig {
  // ... future settings
}

export interface RoomGameConfig {
  matching?: MatchingGameConfig;
  "memory-quiz"?: MemoryQuizGameConfig;
  "complement-race"?: ComplementRaceGameConfig;
}

// Default configs
export const DEFAULT_MATCHING_CONFIG: MatchingGameConfig = {
  gameType: "abacus-numeral",
  difficulty: 6,
  turnTimer: 30,
};

export const DEFAULT_MEMORY_QUIZ_CONFIG: MemoryQuizGameConfig = {
  selectedCount: 5,
  displayTime: 2.0,
  selectedDifficulty: "easy",
  playMode: "cooperative",
};
```

**Benefits:**

- Single source of truth for each game's settings
- TypeScript enforces consistency across codebase
- Easy to see what settings each game has

### 2. Create Config Helper Functions

**Problem:** Config reading logic is duplicated and error-prone

**Solution:** Centralized helper functions with type safety

```typescript
// src/lib/arcade/game-config-helpers.ts

import type { GameName } from "./validation";
import type {
  RoomGameConfig,
  MatchingGameConfig,
  MemoryQuizGameConfig,
} from "./game-configs";
import {
  DEFAULT_MATCHING_CONFIG,
  DEFAULT_MEMORY_QUIZ_CONFIG,
} from "./game-configs";

/**
 * Get game-specific config from room's gameConfig with defaults
 */
export function getGameConfig<T extends GameName>(
  roomGameConfig: RoomGameConfig | null | undefined,
  gameName: T,
): T extends "matching"
  ? MatchingGameConfig
  : T extends "memory-quiz"
    ? MemoryQuizGameConfig
    : never {
  if (!roomGameConfig) {
    return getDefaultGameConfig(gameName) as any;
  }

  const savedConfig = roomGameConfig[gameName];
  if (!savedConfig) {
    return getDefaultGameConfig(gameName) as any;
  }

  // Merge saved config with defaults to handle missing fields
  const defaults = getDefaultGameConfig(gameName);
  return { ...defaults, ...savedConfig } as any;
}

function getDefaultGameConfig(gameName: GameName) {
  switch (gameName) {
    case "matching":
      return DEFAULT_MATCHING_CONFIG;
    case "memory-quiz":
      return DEFAULT_MEMORY_QUIZ_CONFIG;
    case "complement-race":
      // return DEFAULT_COMPLEMENT_RACE_CONFIG
      throw new Error("complement-race config not implemented");
    default:
      throw new Error(`Unknown game: ${gameName}`);
  }
}

/**
 * Update a specific game's config in the room's gameConfig
 */
export function updateGameConfig<T extends GameName>(
  currentRoomConfig: RoomGameConfig | null | undefined,
  gameName: T,
  updates: Partial<
    T extends "matching"
      ? MatchingGameConfig
      : T extends "memory-quiz"
        ? MemoryQuizGameConfig
        : never
  >,
): RoomGameConfig {
  const current = currentRoomConfig || {};
  const gameConfig = current[gameName] || getDefaultGameConfig(gameName);

  return {
    ...current,
    [gameName]: {
      ...gameConfig,
      ...updates,
    },
  };
}
```

**Usage in socket-server.ts:**

```typescript
// BEFORE (error-prone, duplicated)
const memoryQuizConfig = (room.gameConfig as any)?.["memory-quiz"] || {};
initialState = validator.getInitialState({
  selectedCount: memoryQuizConfig.selectedCount || 5,
  displayTime: memoryQuizConfig.displayTime || 2.0,
  selectedDifficulty: memoryQuizConfig.selectedDifficulty || "easy",
  playMode: memoryQuizConfig.playMode || "cooperative",
});

// AFTER (type-safe, concise)
const config = getGameConfig(room.gameConfig, "memory-quiz");
initialState = validator.getInitialState(config);
```

**Usage in RoomMemoryQuizProvider.tsx:**

```typescript
// BEFORE (verbose, error-prone)
const mergedInitialState = useMemo(() => {
  const gameConfig = roomData?.gameConfig as Record<string, any>;
  const savedConfig = gameConfig?.["memory-quiz"];

  return {
    ...initialState,
    selectedCount: savedConfig?.selectedCount ?? initialState.selectedCount,
    displayTime: savedConfig?.displayTime ?? initialState.displayTime,
    selectedDifficulty:
      savedConfig?.selectedDifficulty ?? initialState.selectedDifficulty,
    playMode: savedConfig?.playMode ?? initialState.playMode,
  };
}, [roomData?.gameConfig]);

// AFTER (type-safe, concise)
const mergedInitialState = useMemo(() => {
  const config = getGameConfig(roomData?.gameConfig, "memory-quiz");
  return {
    ...initialState,
    ...config, // Spread config directly - all settings included
  };
}, [roomData?.gameConfig]);
```

**Benefits:**

- No more manual property-by-property merging
- Type-safe
- Defaults handled automatically
- Reusable across codebase

### 3. Enforce Validator Config Type from Game Config

**Problem:** Easy to forget to add a new setting to validator's `getInitialState()` signature

**Solution:** Make validator use the shared config type

```typescript
// src/lib/arcade/validation/MemoryQuizGameValidator.ts

import type { MemoryQuizGameConfig } from "@/lib/arcade/game-configs";

export class MemoryQuizGameValidator {
  // BEFORE: Manual type definition
  // getInitialState(config: {
  //   selectedCount: number
  //   displayTime: number
  //   selectedDifficulty: DifficultyLevel
  //   playMode?: 'cooperative' | 'competitive'
  // }): SorobanQuizState

  // AFTER: Use shared type
  getInitialState(config: MemoryQuizGameConfig): SorobanQuizState {
    return {
      // ...
      selectedCount: config.selectedCount,
      displayTime: config.displayTime,
      selectedDifficulty: config.selectedDifficulty,
      playMode: config.playMode, // TypeScript ensures all fields are handled
      // ...
    };
  }
}
```

**Benefits:**

- If you add a setting to `MemoryQuizGameConfig`, TypeScript forces you to handle it
- Impossible to forget a setting
- Impossible to use wrong type

### 4. Add Exhaustiveness Checking

**Problem:** Easy to miss handling a setting field

**Solution:** Use TypeScript's exhaustiveness checking

```typescript
// src/lib/arcade/validation/MemoryQuizGameValidator.ts

getInitialState(config: MemoryQuizGameConfig): SorobanQuizState {
  // Exhaustiveness check - ensures all config fields are used
  const _exhaustivenessCheck: Record<keyof MemoryQuizGameConfig, boolean> = {
    selectedCount: true,
    displayTime: true,
    selectedDifficulty: true,
    playMode: true,
  }

  return {
    // ... use all config fields
    selectedCount: config.selectedCount,
    displayTime: config.displayTime,
    selectedDifficulty: config.selectedDifficulty,
    playMode: config.playMode,
  }
}
```

If you add a new field to `MemoryQuizGameConfig`, TypeScript will error on `_exhaustivenessCheck` until you add it.

### 5. Validate Config on Save

**Problem:** Invalid config can be saved to database

**Solution:** Add runtime validation

```typescript
// src/lib/arcade/game-config-helpers.ts

export function validateGameConfig(
  gameName: GameName,
  config: any,
): config is MatchingGameConfig | MemoryQuizGameConfig {
  switch (gameName) {
    case "matching":
      return (
        typeof config.gameType === "string" &&
        ["abacus-numeral", "complement-pairs"].includes(config.gameType) &&
        typeof config.difficulty === "number" &&
        config.difficulty > 0 &&
        typeof config.turnTimer === "number" &&
        config.turnTimer > 0
      );

    case "memory-quiz":
      return (
        [2, 5, 8, 12, 15].includes(config.selectedCount) &&
        typeof config.displayTime === "number" &&
        config.displayTime > 0 &&
        ["beginner", "easy", "medium", "hard", "expert"].includes(
          config.selectedDifficulty,
        ) &&
        ["cooperative", "competitive"].includes(config.playMode)
      );

    default:
      return false;
  }
}
```

Use in settings API:

```typescript
// src/app/api/arcade/rooms/[roomId]/settings/route.ts

if (body.gameConfig !== undefined) {
  if (!validateGameConfig(room.gameName, body.gameConfig[room.gameName])) {
    return NextResponse.json({ error: "Invalid game config" }, { status: 400 });
  }
  updateData.gameConfig = body.gameConfig;
}
```

## Schema Refactoring: Separate Table for Game Configs

### Current Problem

All game configs are stored in a single JSON column in `arcade_rooms.gameConfig`:

```json
{
  "matching": { "gameType": "...", "difficulty": 15 },
  "memory-quiz": { "selectedCount": 8, "playMode": "competitive" }
}
```

**Issues:**

- No schema validation
- Inefficient updates (read/parse/modify/serialize entire blob)
- Grows without bounds as more games added
- Can't query or index individual game settings
- No audit trail
- Potential concurrent update race conditions

### Recommended: Separate Table

Create `room_game_configs` table with one row per game per room:

```typescript
// src/db/schema/room-game-configs.ts

export const roomGameConfigs = sqliteTable(
  "room_game_configs",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    roomId: text("room_id")
      .notNull()
      .references(() => arcadeRooms.id, { onDelete: "cascade" }),
    gameName: text("game_name", {
      enum: ["matching", "memory-quiz", "complement-race"],
    }).notNull(),
    config: text("config", { mode: "json" }).notNull(), // Game-specific JSON
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    uniqueRoomGame: uniqueIndex("room_game_idx").on(
      table.roomId,
      table.gameName,
    ),
  }),
);
```

**Benefits:**

- ✅ Smaller rows (only configs for games that have been used)
- ✅ Easier updates (single row, not entire JSON blob)
- ✅ Can track updatedAt per game
- ✅ Better concurrency (no lock contention between games)
- ✅ Foundation for future audit trail

**Migration Strategy:**

1. Create new table
2. Migrate existing data from `arcade_rooms.gameConfig`
3. Update all config read/write code
4. Deploy and test
5. Drop old `gameConfig` column from `arcade_rooms`

See migration SQL below.

## Implementation Priority

### Phase 1: Schema Migration (HIGHEST PRIORITY)

1. **Create new table** - Add `room_game_configs` schema
2. **Create migration** - SQL to migrate existing data
3. **Update helper functions** - Adapt to new table structure
4. **Update all read/write code** - Use new table
5. **Test thoroughly** - Verify all settings persist correctly
6. **Drop old column** - Remove `gameConfig` from `arcade_rooms`

### Phase 2: Type Safety (HIGH)

1. **Create shared config types** (`game-configs.ts`) - Prevents type mismatches
2. **Create helper functions** (`game-config-helpers.ts`) - Now queries new table
3. **Update validators** to use shared types - Enforces consistency

### Phase 3: Compile-Time Safety (MEDIUM)

1. **Add exhaustiveness checking** - Catches missing fields at compile time
2. **Enforce validator config types** - Use shared types

### Phase 4: Runtime Safety (LOW)

1. **Add runtime validation** - Prevents invalid data from being saved

## Detailed Migration SQL

```sql
-- drizzle/migrations/XXXX_split_game_configs.sql

-- Create new table
CREATE TABLE room_game_configs (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES arcade_rooms(id) ON DELETE CASCADE,
  game_name TEXT NOT NULL CHECK(game_name IN ('matching', 'memory-quiz', 'complement-race')),
  config TEXT NOT NULL,  -- JSON
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX room_game_idx ON room_game_configs(room_id, game_name);

-- Migrate existing 'matching' configs
INSERT INTO room_game_configs (id, room_id, game_name, config, created_at, updated_at)
SELECT
  lower(hex(randomblob(16))),
  id,
  'matching',
  json_extract(game_config, '$.matching'),
  created_at,
  last_activity
FROM arcade_rooms
WHERE json_extract(game_config, '$.matching') IS NOT NULL;

-- Migrate existing 'memory-quiz' configs
INSERT INTO room_game_configs (id, room_id, game_name, config, created_at, updated_at)
SELECT
  lower(hex(randomblob(16))),
  id,
  'memory-quiz',
  json_extract(game_config, '$."memory-quiz"'),
  created_at,
  last_activity
FROM arcade_rooms
WHERE json_extract(game_config, '$."memory-quiz"') IS NOT NULL;

-- After testing and verifying all works:
-- ALTER TABLE arcade_rooms DROP COLUMN game_config;
```

## Migration Strategy

### Step-by-Step with Checkpoints

**Checkpoint 1: Schema & Migration**

1. Create `src/db/schema/room-game-configs.ts`
2. Export from `src/db/schema/index.ts`
3. Generate and apply migration
4. Verify data migrated correctly

**Checkpoint 2: Helper Functions**

1. Create shared config types in `src/lib/arcade/game-configs.ts`
2. Create helper functions in `src/lib/arcade/game-config-helpers.ts`
3. Add unit tests for helpers

**Checkpoint 3: Update Config Reads**

1. Update socket-server.ts to read from new table
2. Update RoomMemoryQuizProvider to read from new table
3. Update RoomMemoryPairsProvider to read from new table
4. Test: Load room and verify settings appear

**Checkpoint 4: Update Config Writes**

1. Update useRoomData.ts updateGameConfig to write to new table
2. Update settings API to write to new table
3. Test: Change settings and verify they persist

**Checkpoint 5: Update Validators**

1. Update validators to use shared config types
2. Test: All games work correctly

**Checkpoint 6: Cleanup**

1. Remove old gameConfig column references
2. Drop gameConfig column from arcade_rooms table
3. Final testing of all games

## Benefits Summary

- **Type Safety:** TypeScript enforces consistency across all systems
- **DRY:** Config reading logic not duplicated
- **Maintainability:** Adding a setting requires changes in fewer places
- **Correctness:** Impossible to forget a setting or use wrong type
- **Debugging:** Centralized config logic easier to trace
- **Testing:** Can test config helpers in isolation
