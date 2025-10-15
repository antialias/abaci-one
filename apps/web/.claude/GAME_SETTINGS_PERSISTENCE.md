# Game Settings Persistence Architecture

## Overview

Game settings in room mode persist across game switches using a normalized database schema. Settings for each game are stored in a dedicated `room_game_configs` table with one row per game per room.

## Database Schema

Settings are stored in the `room_game_configs` table:

```sql
CREATE TABLE room_game_configs (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES arcade_rooms(id) ON DELETE CASCADE,
  game_name TEXT NOT NULL CHECK(game_name IN ('matching', 'memory-quiz', 'complement-race')),
  config TEXT NOT NULL,  -- JSON
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(room_id, game_name)
);
```

**Benefits:**
- ✅ Type-safe config access with shared types
- ✅ Smaller rows (only configs for games that have been used)
- ✅ Easier updates (single row vs entire JSON blob)
- ✅ Better concurrency (no lock contention between games)
- ✅ Foundation for per-game audit trail
- ✅ Can query/index individual game settings

**Example Row:**
```json
{
  "id": "clxyz123",
  "room_id": "room_abc",
  "game_name": "memory-quiz",
  "config": {
    "selectedCount": 8,
    "displayTime": 3.0,
    "selectedDifficulty": "medium",
    "playMode": "competitive"
  },
  "created_at": 1234567890,
  "updated_at": 1234567890
}
```

## Shared Type System

All game configs are defined in `src/lib/arcade/game-configs.ts`:

```typescript
// Shared config types (single source of truth)
export interface MatchingGameConfig {
  gameType: 'abacus-numeral' | 'complement-pairs'
  difficulty: number
  turnTimer: number
}

export interface MemoryQuizGameConfig {
  selectedCount: 2 | 5 | 8 | 12 | 15
  displayTime: number
  selectedDifficulty: DifficultyLevel
  playMode: 'cooperative' | 'competitive'
}

// Default configs
export const DEFAULT_MATCHING_CONFIG: MatchingGameConfig = {
  gameType: 'abacus-numeral',
  difficulty: 6,
  turnTimer: 30,
}

export const DEFAULT_MEMORY_QUIZ_CONFIG: MemoryQuizGameConfig = {
  selectedCount: 5,
  displayTime: 2.0,
  selectedDifficulty: 'easy',
  playMode: 'cooperative',
}
```

**Why This Matters:**
- TypeScript enforces that validators, helpers, and API routes all use the same types
- Adding a new setting requires changes in only ONE place (the type definition)
- Impossible to forget a setting or use wrong type

## Critical Components

Settings persistence requires coordination between FOUR systems:

### 1. Helper Functions
**Location:** `src/lib/arcade/game-config-helpers.ts`

**Responsibilities:**
- Read/write game configs from `room_game_configs` table
- Provide type-safe access with automatic defaults
- Validate configs at runtime

**Key Functions:**
```typescript
// Get config with defaults (type-safe)
const config = await getGameConfig(roomId, 'memory-quiz')
// Returns: MemoryQuizGameConfig

// Set/update config (upsert)
await setGameConfig(roomId, 'memory-quiz', {
  playMode: 'competitive',
  selectedCount: 8,
})

// Get all game configs for a room
const allConfigs = await getAllGameConfigs(roomId)
// Returns: { matching?: MatchingGameConfig, 'memory-quiz'?: MemoryQuizGameConfig }
```

### 2. API Routes
**Location:**
- `src/app/api/arcade/rooms/current/route.ts` (read)
- `src/app/api/arcade/rooms/[roomId]/settings/route.ts` (write)

**Responsibilities:**
- Aggregate game configs from database
- Return them to client in `room.gameConfig`
- Write config updates to `room_game_configs` table

**Read Example:** `GET /api/arcade/rooms/current`
```typescript
const gameConfig = await getAllGameConfigs(roomId)

return NextResponse.json({
  room: {
    ...room,
    gameConfig, // Aggregated from room_game_configs table
  },
  members,
  memberPlayers,
})
```

**Write Example:** `PATCH /api/arcade/rooms/[roomId]/settings`
```typescript
if (body.gameConfig !== undefined) {
  // body.gameConfig: { matching: {...}, memory-quiz: {...} }
  for (const [gameName, config] of Object.entries(body.gameConfig)) {
    await setGameConfig(roomId, gameName, config)
  }
}
```

### 3. Socket Server (Session Creation)
**Location:** `src/socket-server.ts:70-90`

**Responsibilities:**
- Create initial arcade session when user joins room
- Read saved settings using `getGameConfig()` helper
- Pass settings to validator's `getInitialState()`

**Example:**
```typescript
const room = await getRoomById(roomId)
const validator = getValidator(room.gameName as GameName)

// Get config from database (type-safe, includes defaults)
const gameConfig = await getGameConfig(roomId, room.gameName as GameName)

// Pass to validator (types match automatically)
const initialState = validator.getInitialState(gameConfig)

await createArcadeSession({ userId, gameName, initialState, roomId })
```

**Key Point:** No more manual config extraction or default fallbacks!

### 4. Game Validators
**Location:** `src/lib/arcade/validation/*Validator.ts`

**Responsibilities:**
- Define `getInitialState()` method with shared config type
- Create initial game state from config
- TypeScript enforces all settings are handled

**Example:** `MemoryQuizGameValidator.ts`
```typescript
import type { MemoryQuizGameConfig } from '@/lib/arcade/game-configs'

class MemoryQuizGameValidator {
  getInitialState(config: MemoryQuizGameConfig): SorobanQuizState {
    return {
      selectedCount: config.selectedCount,
      displayTime: config.displayTime,
      selectedDifficulty: config.selectedDifficulty,
      playMode: config.playMode,  // TypeScript ensures this field exists!
      // ...other state
    }
  }
}
```

### 5. Client Providers (Unchanged)
**Location:** `src/app/arcade/{game}/context/Room{Game}Provider.tsx`

**Responsibilities:**
- Read settings from `roomData.gameConfig[gameName]`
- Merge with `initialState` defaults
- Works transparently with new backend structure

**Example:** `RoomMemoryQuizProvider.tsx:211-233`
```typescript
const mergedInitialState = useMemo(() => {
  const gameConfig = roomData?.gameConfig as Record<string, any>
  const savedConfig = gameConfig?.['memory-quiz']

  if (!savedConfig) {
    return initialState
  }

  return {
    ...initialState,
    selectedCount: savedConfig.selectedCount ?? initialState.selectedCount,
    displayTime: savedConfig.displayTime ?? initialState.displayTime,
    selectedDifficulty: savedConfig.selectedDifficulty ?? initialState.selectedDifficulty,
    playMode: savedConfig.playMode ?? initialState.playMode,
  }
}, [roomData?.gameConfig])
```

## Common Bugs and Solutions

### Bug #1: Settings Not Persisting
**Symptom:** Settings reset to defaults after game switch

**Root Cause:** One of the following:
1. API route not writing to `room_game_configs` table
2. Helper function not being used correctly
3. Validator not using shared config type

**Solution:** Verify the data flow:
```bash
# 1. Check database write
SELECT * FROM room_game_configs WHERE room_id = '...';

# 2. Check API logs for setGameConfig() calls
# Look for: [GameConfig] Updated {game} config for room {roomId}

# 3. Check socket server logs for getGameConfig() calls
# Look for: [join-arcade-session] Got validator for: {game}

# 4. Check validator signature matches shared type
# MemoryQuizGameValidator.getInitialState(config: MemoryQuizGameConfig)
```

### Bug #2: TypeScript Errors About Missing Fields
**Symptom:** `Property '{field}' is missing in type ...`

**Root Cause:** Validator's `getInitialState()` signature doesn't match shared config type

**Solution:** Import and use the shared config type:
```typescript
// ❌ WRONG
getInitialState(config: {
  selectedCount: number
  displayTime: number
  // Missing playMode!
}): SorobanQuizState

// ✅ CORRECT
import type { MemoryQuizGameConfig } from '@/lib/arcade/game-configs'

getInitialState(config: MemoryQuizGameConfig): SorobanQuizState
```

### Bug #3: Settings Wiped When Returning to Game Selection
**Symptom:** Settings reset when going back to game selection

**Root Cause:** Sending `gameConfig: null` in PATCH request

**Solution:** Only send `gameName: null`, don't touch gameConfig:
```typescript
// ❌ WRONG
body: JSON.stringify({ gameName: null, gameConfig: null })

// ✅ CORRECT
body: JSON.stringify({ gameName: null })
```

## Debugging Checklist

When a setting doesn't persist:

1. **Check database:**
   - Query `room_game_configs` table
   - Verify row exists for room + game
   - Verify JSON config has correct structure

2. **Check API write path:**
   - `/api/arcade/rooms/[roomId]/settings` logs
   - Verify `setGameConfig()` is called
   - Check for errors in console

3. **Check API read path:**
   - `/api/arcade/rooms/current` logs
   - Verify `getAllGameConfigs()` returns data
   - Check `room.gameConfig` in response

4. **Check socket server:**
   - `socket-server.ts` logs for `getGameConfig()`
   - Verify config passed to validator
   - Check `initialState` has correct values

5. **Check validator:**
   - Signature uses shared config type
   - All config fields used (not hardcoded)
   - Add logging to see received config

## Adding a New Setting

To add a new setting to an existing game:

1. **Update the shared config type** (`game-configs.ts`):
```typescript
export interface MemoryQuizGameConfig {
  selectedCount: 2 | 5 | 8 | 12 | 15
  displayTime: number
  selectedDifficulty: DifficultyLevel
  playMode: 'cooperative' | 'competitive'
  newSetting: string  // ← Add here
}

export const DEFAULT_MEMORY_QUIZ_CONFIG: MemoryQuizGameConfig = {
  selectedCount: 5,
  displayTime: 2.0,
  selectedDifficulty: 'easy',
  playMode: 'cooperative',
  newSetting: 'default',  // ← Add default
}
```

2. **TypeScript will now enforce:**
   - ✅ Validator must accept `newSetting` (compile error if missing)
   - ✅ Helper functions will include it automatically
   - ✅ Client providers will need to handle it

3. **Update the validator** (`*Validator.ts`):
```typescript
getInitialState(config: MemoryQuizGameConfig): SorobanQuizState {
  return {
    // ...
    newSetting: config.newSetting,  // TypeScript enforces this
  }
}
```

4. **Update the UI** to expose the new setting
   - No changes needed to API routes or helper functions!
   - They automatically handle any field in the config type

## Testing Settings Persistence

Manual test procedure:

1. Join a room and select a game
2. Change each setting to a non-default value
3. Go back to game selection (gameName becomes null)
4. Select the same game again
5. **Verify ALL settings retained their values**

**Expected behavior:** All settings should be exactly as you left them.

## Migration Notes

**Old Schema:**
- Settings stored in `arcade_rooms.game_config` JSON column
- Config stored directly for currently selected game only
- Config lost when switching games

**New Schema:**
- Settings stored in `room_game_configs` table
- One row per game per room
- Unique constraint on (room_id, game_name)
- Configs persist when switching between games

**Migration:** See `.claude/MANUAL_MIGRATION_0011.md` for complete details

**Summary:**
- Manual migration applied on 2025-10-15
- Created `room_game_configs` table via sqlite3 CLI
- Migrated 6000 existing configs (5991 matching, 9 memory-quiz)
- Table created directly instead of through drizzle migration system

**Rollback Plan:**
- Old `game_config` column still exists in `arcade_rooms` table
- Old data preserved (was only read, not deleted)
- Can revert to reading from old column if needed
- New table can be dropped: `DROP TABLE room_game_configs`

## Architecture Benefits

**Type Safety:**
- Single source of truth for config types
- TypeScript enforces consistency everywhere
- Impossible to forget a setting

**DRY (Don't Repeat Yourself):**
- No duplicated default values
- No manual config extraction
- No manual merging with defaults

**Maintainability:**
- Adding a setting touches fewer places
- Clear separation of concerns
- Easier to trace data flow

**Performance:**
- Smaller database rows
- Better query performance
- Less network payload

**Correctness:**
- Runtime validation available
- Database constraints (unique index)
- Impossible to create duplicate configs
