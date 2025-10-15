# Game Settings Persistence Architecture

## Overview

Game settings in room mode persist across game switches using a nested gameConfig structure. This document describes the architecture and common pitfalls.

## Data Structure

Settings are stored in the `arcadeRooms` table's `gameConfig` column with this structure:

```typescript
{
  "matching": {
    "gameType": "complement-pairs",
    "difficulty": 15,
    "turnTimer": 60
  },
  "memory-quiz": {
    "selectedCount": 8,
    "displayTime": 3.0,
    "selectedDifficulty": "medium",
    "playMode": "competitive"
  }
}
```

**Key Points:**
- Settings are **nested by game name** (`matching`, `memory-quiz`, etc.)
- Each game has its own isolated settings object
- This allows switching games without losing settings

## Critical Components

Settings persistence requires coordination between THREE systems:

### 1. Client-Side Provider
**Location:** `src/app/arcade/{game}/context/Room{Game}Provider.tsx`

**Responsibilities:**
- Load saved settings from `roomData.gameConfig[gameName]`
- Merge saved settings with `initialState` defaults
- Save settings changes to database via `updateGameConfig`

**Example:** `RoomMemoryQuizProvider.tsx:211-247`
```typescript
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
```

### 2. Socket Server (Session Creation)
**Location:** `src/socket-server.ts:86-125`

**Responsibilities:**
- Create initial arcade session when user joins room
- Read saved settings from `room.gameConfig[gameName]`
- Pass settings to validator's `getInitialState()`

**Example:** `socket-server.ts:94-110`
```typescript
const memoryQuizConfig = (room.gameConfig as any)?.['memory-quiz'] || {}
initialState = validator.getInitialState({
  selectedCount: memoryQuizConfig.selectedCount || 5,
  displayTime: memoryQuizConfig.displayTime || 2.0,
  selectedDifficulty: memoryQuizConfig.selectedDifficulty || 'easy',
  playMode: memoryQuizConfig.playMode || 'cooperative',
})
```

### 3. Game Validator
**Location:** `src/lib/arcade/validation/{Game}Validator.ts`

**Responsibilities:**
- Define `getInitialState()` method that creates initial game state
- Accept ALL game settings as parameters
- Use provided values or fall back to defaults

**Example:** `MemoryQuizGameValidator.ts:404-442`
```typescript
getInitialState(config: {
  selectedCount: number
  displayTime: number
  selectedDifficulty: DifficultyLevel
  playMode?: 'cooperative' | 'competitive'  // ← Must include ALL settings!
}): SorobanQuizState {
  return {
    // ...
    selectedCount: config.selectedCount,
    displayTime: config.displayTime,
    selectedDifficulty: config.selectedDifficulty,
    playMode: config.playMode || 'cooperative',  // ← Use config value!
  }
}
```

## Common Bugs and Solutions

### Bug #1: Settings Wiped When Returning to Game Selection

**Symptom:** Settings reset to defaults after going back to game selection

**Root Cause:** `clearRoomGameApi` was sending `gameConfig: null`

**Solution:** Only send `gameName: null`, don't send `gameConfig` at all
```typescript
// ❌ WRONG
body: JSON.stringify({ gameName: null, gameConfig: null })

// ✅ CORRECT
body: JSON.stringify({ gameName: null })
```

**Fixed in:** `useRoomData.ts:638-654`

### Bug #2: Settings Not Loaded from Database

**Symptom:** Session always uses default settings, ignoring saved values

**Root Cause:** Socket server reading from wrong level of nesting

**Example Problem:**
```typescript
// ❌ WRONG - reads from root level
const gameType = room.gameConfig.gameType  // undefined!

// ✅ CORRECT - reads from nested game config
const matchingConfig = room.gameConfig.matching
const gameType = matchingConfig.gameType
```

**Fixed in:** `socket-server.ts:86-125`

### Bug #3: Validator Ignores Setting

**Symptom:** Specific setting always resets to default (e.g., playMode always "cooperative")

**Root Cause:** Validator's `getInitialState()` config parameter missing the setting

**How to Diagnose:**
1. Check validator's `getInitialState()` TypeScript signature
2. Ensure ALL game settings are included as parameters
3. Ensure settings use `config.{setting}` not hardcoded values

**Example Problem:**
```typescript
// ❌ WRONG - playMode not in config type
getInitialState(config: {
  selectedCount: number
  displayTime: number
  selectedDifficulty: DifficultyLevel
}): SorobanQuizState {
  return {
    playMode: 'cooperative',  // ← Hardcoded!
  }
}

// ✅ CORRECT - playMode in config type and used
getInitialState(config: {
  selectedCount: number
  displayTime: number
  selectedDifficulty: DifficultyLevel
  playMode?: 'cooperative' | 'competitive'
}): SorobanQuizState {
  return {
    playMode: config.playMode || 'cooperative',  // ← Uses config!
  }
}
```

**Fixed in:** `MemoryQuizGameValidator.ts:404-442`

## Debugging Checklist

When a setting doesn't persist:

1. **Check database:**
   - Add logging in `/api/arcade/rooms/[roomId]/settings/route.ts`
   - Verify setting is saved to `gameConfig[gameName]`

2. **Check socket server:**
   - Add logging in `socket-server.ts` join-arcade-session handler
   - Verify `room.gameConfig[gameName].{setting}` is read correctly
   - Verify setting is passed to `validator.getInitialState()`
   - Verify `initialState.{setting}` has correct value after getInitialState()

3. **Check validator:**
   - Verify `getInitialState()` config parameter includes the setting
   - Verify setting uses `config.{setting}` not a hardcoded value
   - Add logging to see what config is received and what state is returned

4. **Check client provider:**
   - Add logging in `Room{Game}Provider.tsx` mergedInitialState useMemo
   - Verify `roomData.gameConfig[gameName].{setting}` is read correctly
   - Verify merged state includes the saved value

## Adding a New Setting

To add a new setting to an existing game:

1. **Update the game's state type** (`types.ts`)
2. **Update the Provider** (`Room{Game}Provider.tsx`):
   - Add to `mergedInitialState` useMemo
   - Add to `setConfig` function
   - Add to `updateGameConfig` call
3. **Update the Validator** (`{Game}Validator.ts`):
   - Add to `getInitialState()` config parameter type
   - Add to returned state object, using `config.{setting}`
   - Add validation case in `validateSetConfig()`
4. **Update Socket Server** (`socket-server.ts`):
   - Add to `{game}Config` extraction
   - Add to `getInitialState()` call
5. **Update the UI component** to expose the setting

## Testing Settings Persistence

Manual test procedure:

1. Join a room and select a game
2. Change each setting to a non-default value
3. Go back to game selection (gameName becomes null)
4. Select the same game again
5. Verify ALL settings retained their values

**Expected behavior:** All settings should be exactly as you left them.

## Refactoring Recommendations

See next section for suggested improvements to prevent these bugs.
