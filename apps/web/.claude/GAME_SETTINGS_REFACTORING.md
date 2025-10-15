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

export interface ComplementRaceGameConfig {
  // ... future settings
}

export interface RoomGameConfig {
  matching?: MatchingGameConfig
  'memory-quiz'?: MemoryQuizGameConfig
  'complement-race'?: ComplementRaceGameConfig
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

**Benefits:**
- Single source of truth for each game's settings
- TypeScript enforces consistency across codebase
- Easy to see what settings each game has

### 2. Create Config Helper Functions

**Problem:** Config reading logic is duplicated and error-prone

**Solution:** Centralized helper functions with type safety

```typescript
// src/lib/arcade/game-config-helpers.ts

import type { GameName } from './validation'
import type { RoomGameConfig, MatchingGameConfig, MemoryQuizGameConfig } from './game-configs'
import { DEFAULT_MATCHING_CONFIG, DEFAULT_MEMORY_QUIZ_CONFIG } from './game-configs'

/**
 * Get game-specific config from room's gameConfig with defaults
 */
export function getGameConfig<T extends GameName>(
  roomGameConfig: RoomGameConfig | null | undefined,
  gameName: T
): T extends 'matching'
  ? MatchingGameConfig
  : T extends 'memory-quiz'
  ? MemoryQuizGameConfig
  : never {

  if (!roomGameConfig) {
    return getDefaultGameConfig(gameName) as any
  }

  const savedConfig = roomGameConfig[gameName]
  if (!savedConfig) {
    return getDefaultGameConfig(gameName) as any
  }

  // Merge saved config with defaults to handle missing fields
  const defaults = getDefaultGameConfig(gameName)
  return { ...defaults, ...savedConfig } as any
}

function getDefaultGameConfig(gameName: GameName) {
  switch (gameName) {
    case 'matching':
      return DEFAULT_MATCHING_CONFIG
    case 'memory-quiz':
      return DEFAULT_MEMORY_QUIZ_CONFIG
    case 'complement-race':
      // return DEFAULT_COMPLEMENT_RACE_CONFIG
      throw new Error('complement-race config not implemented')
    default:
      throw new Error(`Unknown game: ${gameName}`)
  }
}

/**
 * Update a specific game's config in the room's gameConfig
 */
export function updateGameConfig<T extends GameName>(
  currentRoomConfig: RoomGameConfig | null | undefined,
  gameName: T,
  updates: Partial<T extends 'matching' ? MatchingGameConfig : T extends 'memory-quiz' ? MemoryQuizGameConfig : never>
): RoomGameConfig {
  const current = currentRoomConfig || {}
  const gameConfig = current[gameName] || getDefaultGameConfig(gameName)

  return {
    ...current,
    [gameName]: {
      ...gameConfig,
      ...updates,
    },
  }
}
```

**Usage in socket-server.ts:**
```typescript
// BEFORE (error-prone, duplicated)
const memoryQuizConfig = (room.gameConfig as any)?.['memory-quiz'] || {}
initialState = validator.getInitialState({
  selectedCount: memoryQuizConfig.selectedCount || 5,
  displayTime: memoryQuizConfig.displayTime || 2.0,
  selectedDifficulty: memoryQuizConfig.selectedDifficulty || 'easy',
  playMode: memoryQuizConfig.playMode || 'cooperative',
})

// AFTER (type-safe, concise)
const config = getGameConfig(room.gameConfig, 'memory-quiz')
initialState = validator.getInitialState(config)
```

**Usage in RoomMemoryQuizProvider.tsx:**
```typescript
// BEFORE (verbose, error-prone)
const mergedInitialState = useMemo(() => {
  const gameConfig = roomData?.gameConfig as Record<string, any>
  const savedConfig = gameConfig?.['memory-quiz']

  return {
    ...initialState,
    selectedCount: savedConfig?.selectedCount ?? initialState.selectedCount,
    displayTime: savedConfig?.displayTime ?? initialState.displayTime,
    selectedDifficulty: savedConfig?.selectedDifficulty ?? initialState.selectedDifficulty,
    playMode: savedConfig?.playMode ?? initialState.playMode,
  }
}, [roomData?.gameConfig])

// AFTER (type-safe, concise)
const mergedInitialState = useMemo(() => {
  const config = getGameConfig(roomData?.gameConfig, 'memory-quiz')
  return {
    ...initialState,
    ...config,  // Spread config directly - all settings included
  }
}, [roomData?.gameConfig])
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

import type { MemoryQuizGameConfig } from '@/lib/arcade/game-configs'

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
      playMode: config.playMode,  // TypeScript ensures all fields are handled
      // ...
    }
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
  config: any
): config is MatchingGameConfig | MemoryQuizGameConfig {
  switch (gameName) {
    case 'matching':
      return (
        typeof config.gameType === 'string' &&
        ['abacus-numeral', 'complement-pairs'].includes(config.gameType) &&
        typeof config.difficulty === 'number' &&
        config.difficulty > 0 &&
        typeof config.turnTimer === 'number' &&
        config.turnTimer > 0
      )

    case 'memory-quiz':
      return (
        [2, 5, 8, 12, 15].includes(config.selectedCount) &&
        typeof config.displayTime === 'number' &&
        config.displayTime > 0 &&
        ['beginner', 'easy', 'medium', 'hard', 'expert'].includes(config.selectedDifficulty) &&
        ['cooperative', 'competitive'].includes(config.playMode)
      )

    default:
      return false
  }
}
```

Use in settings API:
```typescript
// src/app/api/arcade/rooms/[roomId]/settings/route.ts

if (body.gameConfig !== undefined) {
  if (!validateGameConfig(room.gameName, body.gameConfig[room.gameName])) {
    return NextResponse.json({ error: 'Invalid game config' }, { status: 400 })
  }
  updateData.gameConfig = body.gameConfig
}
```

## Implementation Priority

1. **HIGH:** Create shared config types (`game-configs.ts`) - Prevents type mismatches
2. **HIGH:** Create helper functions (`game-config-helpers.ts`) - Reduces duplication
3. **MEDIUM:** Update validators to use shared types - Enforces consistency
4. **MEDIUM:** Add exhaustiveness checking - Catches missing fields at compile time
5. **LOW:** Add runtime validation - Prevents invalid data from being saved

## Migration Strategy

1. Create new files without modifying existing code
2. Add shared types and helpers
3. Migrate validators one at a time
4. Migrate providers one at a time
5. Migrate socket server
6. Remove old inline config reading logic
7. Add runtime validation last (optional)

## Benefits Summary

- **Type Safety:** TypeScript enforces consistency across all systems
- **DRY:** Config reading logic not duplicated
- **Maintainability:** Adding a setting requires changes in fewer places
- **Correctness:** Impossible to forget a setting or use wrong type
- **Debugging:** Centralized config logic easier to trace
- **Testing:** Can test config helpers in isolation
