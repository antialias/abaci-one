# Arcade Setup Pattern

## Overview

This document describes the **standard synchronized setup pattern** for arcade games. Following this pattern ensures that:

1. ✅ **Setup is synchronized** - All room members see the same setup screen and config changes in real-time
2. ✅ **No local state hacks** - Configuration lives entirely in session state, no React state merging
3. ✅ **Optimistic updates** - Config changes feel instant with client-side prediction
4. ✅ **Consistent pattern** - All games follow the same architecture

**Reference Implementation**: `src/app/arcade/matching/*` (Matching game)

---

## Core Concept

Setup configuration is **game state**, not UI state. Configuration changes are **moves** that are validated, synchronized, and can be made by any room member.

### Key Principles

1. **Game state includes configuration** during ALL phases (setup, playing, results)
2. **No local React state** for configuration - use session state directly
3. **Standard move types** that all games should implement
4. **Setup phase is collaborative** - any room member can configure the game

---

## Required Move Types

Every arcade game must support these standard moves:

### 1. `GO_TO_SETUP`

Transitions game to setup phase, allowing reconfiguration.

```typescript
{
  type: 'GO_TO_SETUP',
  playerId: string,
  data: {}
}
```

**Behavior:**
- Can be called from any phase (setup, playing, results)
- Sets `gamePhase: 'setup'`
- Resets game progression (scores, cards, etc.)
- Preserves configuration (players can modify it)
- Synchronized across all room members

### 2. `SET_CONFIG`

Updates a configuration field during setup phase.

```typescript
{
  type: 'SET_CONFIG',
  playerId: string,
  data: {
    field: string,  // Config field name
    value: any      // New value
  }
}
```

**Behavior:**
- Only allowed during setup phase
- Validates field name and value
- Updates immediately with optimistic update
- Synchronized across all room members

### 3. `START_GAME`

Starts the game with current configuration.

```typescript
{
  type: 'START_GAME',
  playerId: string,
  data: {
    activePlayers: string[],
    playerMetadata: { [playerId: string]: PlayerMetadata },
    // ... game-specific initial data
  }
}
```

**Behavior:**
- Only allowed during setup phase
- Uses current session state configuration
- Initializes game-specific state
- Sets `gamePhase: 'playing'`

---

## Implementation Checklist

### 1. Update Validation Types

Add move types to your game's validation types:

```typescript
// src/lib/arcade/validation/types.ts

export interface YourGameGoToSetupMove extends GameMove {
  type: 'GO_TO_SETUP'
  data: Record<string, never>
}

export interface YourGameSetConfigMove extends GameMove {
  type: 'SET_CONFIG'
  data: {
    field: 'configField1' | 'configField2' | 'configField3'
    value: any
  }
}

export type YourGameMove =
  | YourGameStartGameMove
  | YourGameGoToSetupMove
  | YourGameSetConfigMove
  | ... // other game-specific moves
```

### 2. Implement Validators

Add validators for setup moves in your game's validator class:

```typescript
// src/lib/arcade/validation/YourGameValidator.ts

export class YourGameValidator implements GameValidator<YourGameState, YourGameMove> {
  validateMove(state, move, context) {
    switch (move.type) {
      case 'GO_TO_SETUP':
        return this.validateGoToSetup(state)

      case 'SET_CONFIG':
        return this.validateSetConfig(state, move.data.field, move.data.value)

      case 'START_GAME':
        return this.validateStartGame(state, move.data)

      // ... other moves
    }
  }

  private validateGoToSetup(state: YourGameState): ValidationResult {
    return {
      valid: true,
      newState: {
        ...state,
        gamePhase: 'setup',
        // Reset game progression, preserve configuration
        // ... reset scores, game data, etc.
      },
    }
  }

  private validateSetConfig(
    state: YourGameState,
    field: string,
    value: any
  ): ValidationResult {
    // Only during setup
    if (state.gamePhase !== 'setup') {
      return { valid: false, error: 'Cannot change config outside setup' }
    }

    // Validate field-specific values
    switch (field) {
      case 'configField1':
        if (!isValidValue(value)) {
          return { valid: false, error: 'Invalid value' }
        }
        break
      // ... validate other fields
    }

    return {
      valid: true,
      newState: { ...state, [field]: value },
    }
  }

  private validateStartGame(state: YourGameState, data: any): ValidationResult {
    if (state.gamePhase !== 'setup') {
      return { valid: false, error: 'Can only start from setup' }
    }

    // Use current state configuration to initialize game
    const initialGameData = initializeYourGame(state.configField1, state.configField2)

    return {
      valid: true,
      newState: {
        ...state,
        gamePhase: 'playing',
        ...initialGameData,
      },
    }
  }
}
```

### 3. Add Optimistic Updates

Update `applyMoveOptimistically` in your providers:

```typescript
// src/app/arcade/your-game/context/YourGameProvider.tsx

function applyMoveOptimistically(state: YourGameState, move: GameMove): YourGameState {
  switch (move.type) {
    case 'GO_TO_SETUP':
      return {
        ...state,
        gamePhase: 'setup',
        // Reset game state, preserve config
      }

    case 'SET_CONFIG':
      const { field, value } = move.data
      return {
        ...state,
        [field]: value,
      }

    case 'START_GAME':
      return {
        ...state,
        gamePhase: 'playing',
        // ... initialize game data from move
      }

    // ... other moves
  }
}
```

### 4. Remove Local State from Providers

**❌ OLD PATTERN (Don't do this):**

```typescript
// DON'T: Local React state for configuration
const [localDifficulty, setLocalDifficulty] = useState(6)

// DON'T: Merge hack
const effectiveState = state.gamePhase === 'setup'
  ? { ...state, difficulty: localDifficulty }
  : state

// DON'T: Direct setter
const setDifficulty = (value) => setLocalDifficulty(value)
```

**✅ NEW PATTERN (Do this):**

```typescript
// DO: Use session state directly
const { state, sendMove } = useArcadeSession(...)

// DO: Send move for config changes
const setDifficulty = useCallback((value) => {
  const playerId = activePlayers[0] || ''
  sendMove({
    type: 'SET_CONFIG',
    playerId,
    data: { field: 'difficulty', value },
  })
}, [activePlayers, sendMove])

// DO: Use state directly (no merging!)
const contextValue = { state: { ...state, gameMode }, ... }
```

### 5. Update Action Creators

All configuration actions should send moves:

```typescript
export function YourGameProvider({ children }) {
  const { state, sendMove } = useArcadeSession(...)

  const setConfigField = useCallback((value) => {
    const playerId = activePlayers[0] || ''
    sendMove({
      type: 'SET_CONFIG',
      playerId,
      data: { field: 'configField', value },
    })
  }, [activePlayers, sendMove])

  const goToSetup = useCallback(() => {
    const playerId = activePlayers[0] || state.currentPlayer || ''
    sendMove({
      type: 'GO_TO_SETUP',
      playerId,
      data: {},
    })
  }, [activePlayers, state.currentPlayer, sendMove])

  const startGame = useCallback(() => {
    // Use current session state config (not local state!)
    const initialData = initializeGame(state.config1, state.config2)

    const playerId = activePlayers[0]
    sendMove({
      type: 'START_GAME',
      playerId,
      data: {
        ...initialData,
        activePlayers,
        playerMetadata: capturePlayerMetadata(players, activePlayers),
      },
    })
  }, [state.config1, state.config2, activePlayers, sendMove])

  return <YourGameContext.Provider value={...} />
}
```

---

## Benefits of This Pattern

### 1. **Synchronized Setup**
- User A clicks "Setup" → All room members see setup screen
- User B changes difficulty → All room members see the change
- User A clicks "Start" → All room members start playing

### 2. **No Special Cases**
- Setup works like gameplay (moves + validation)
- No conditional logic based on phase
- No React state merging hacks

### 3. **Easy to Extend**
- New games copy the same pattern
- Well-documented and tested
- Consistent developer experience

### 4. **Optimistic Updates**
- Config changes feel instant
- Client-side prediction + server validation
- Rollback on validation failure

---

## Testing Checklist

When implementing this pattern, test these scenarios:

### Local Mode
- [ ] Click setup button during game → returns to setup
- [ ] Change config fields → updates immediately
- [ ] Start game → uses current config

### Room Mode (Multi-User)
- [ ] User A clicks setup → User B sees setup screen
- [ ] User A changes difficulty → User B sees change in real-time
- [ ] User B changes game type → User A sees change in real-time
- [ ] User A starts game → Both users see game with same config

### Edge Cases
- [ ] Change config rapidly → no race conditions
- [ ] User with 0 players can see/modify setup
- [ ] Setup → Play → Setup preserves last config
- [ ] Invalid config values are rejected by validator

---

## Migration Guide

If you have an existing game using local state, follow these steps:

### Step 1: Add Move Types
Add `GO_TO_SETUP` and `SET_CONFIG` to your validation types.

### Step 2: Implement Validators
Add validators for the new moves in your game validator class.

### Step 3: Add Optimistic Updates
Update `applyMoveOptimistically` to handle the new moves.

### Step 4: Remove Local State
1. Delete all `useState` calls for configuration
2. Delete the `effectiveState` merging logic
3. Update action creators to send moves instead

### Step 5: Test
Run through the testing checklist above.

---

## Reference Implementation

See the Matching game for a complete reference implementation:

- **Types**: `src/lib/arcade/validation/types.ts`
- **Validator**: `src/lib/arcade/validation/MatchingGameValidator.ts`
- **Provider**: `src/app/arcade/matching/context/RoomMemoryPairsProvider.tsx`
- **Optimistic Updates**: `applyMoveOptimistically` function in provider

Look for comments marked with:
- `// STANDARD ARCADE PATTERN: GO_TO_SETUP`
- `// STANDARD ARCADE PATTERN: SET_CONFIG`
- `// NO LOCAL STATE`
- `// NO MORE effectiveState merging!`

---

## Questions?

If something is unclear or you encounter issues implementing this pattern, refer to the Matching game implementation or update this document with clarifications.
