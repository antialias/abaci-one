# Arcade Game System

A modular, plugin-based architecture for building multiplayer arcade games with real-time synchronization.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Game SDK](#game-sdk)
- [Creating a New Game](#creating-a-new-game)
- [File Structure](#file-structure)
- [Examples](#examples)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

---

## Overview

### Goals

1. **Modularity**: Each game is self-contained and independently deployable
2. **Type Safety**: Full TypeScript support with compile-time validation
3. **Real-time Sync**: Built-in multiplayer support via WebSocket
4. **Optimistic Updates**: Instant client feedback with server validation
5. **Consistent UX**: Shared navigation, player management, and room features

### Key Features

- **Plugin Architecture**: Games register themselves with a central registry
- **Stable SDK API**: Games only import from `@/lib/arcade/game-sdk`
- **Server-side Validation**: All moves validated server-side with client rollback
- **Automatic State Sync**: Multi-client synchronization handled automatically
- **Turn Indicators**: Built-in UI for showing active player
- **Error Handling**: Standardized error feedback to users

---

## Architecture

### Key Improvements

**✨ Phase 3: Type Inference (January 2025)**

Config types are now **automatically inferred** from game definitions for modern games. No more manual type definitions!

```typescript
// Before Phase 3: Manual type definition
export interface NumberGuesserGameConfig {
  minNumber: number;
  maxNumber: number;
  roundsToWin: number;
}

// After Phase 3: Inferred from game definition
export type NumberGuesserGameConfig = InferGameConfig<typeof numberGuesserGame>;
```

**Benefits**:

- Add a game → Config types automatically available system-wide
- Single source of truth (the game definition)
- Eliminates 10-15 lines of boilerplate per game

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                  Validator Registry                          │
│  - Server-side validators (isomorphic)                      │
│  - Single source of truth for game names                    │
│  - Auto-derived GameName type                               │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     Game Registry                            │
│  - Client-side game definitions                             │
│  - React components (Provider, GameComponent)               │
│  - Provides game discovery                                  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      Game SDK                                │
│  - Stable API surface for games                             │
│  - React hooks (useArcadeSession, useRoomData, etc.)        │
│  - Type definitions and utilities                           │
│  - defineGame() helper                                      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   Individual Games                           │
│  number-guesser/                                            │
│    ├── index.ts          (Game definition + validation)     │
│    ├── Validator.ts      (Server validation logic)          │
│    ├── Provider.tsx      (Client state management)          │
│    ├── GameComponent.tsx (Main UI)                          │
│    ├── types.ts          (TypeScript types)                 │
│    └── components/       (Phase UIs)                        │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   Type System (NEW)                          │
│  - Config types inferred from game definitions              │
│  - GameConfigByName auto-derived                            │
│  - RoomGameConfig auto-derived                              │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

```
User Action → Provider (sendMove)
              ↓
        useArcadeSession
              ↓
        Optimistic Update (instant UI feedback)
              ↓
        WebSocket → Server
              ↓
        Validator.validateMove()
              ↓
        ✓ Valid: State Update → Broadcast
        ✗ Invalid: Reject → Client Rollback
              ↓
        Client receives validated state
```

---

## Game SDK

### Core API Surface

```typescript
import {
  // Types
  type GameDefinition,
  type GameValidator,
  type GameState,
  type GameMove,
  type GameConfig,
  type ValidationResult,

  // React Hooks
  useArcadeSession,
  useRoomData,
  useGameMode,
  useViewerId,
  useUpdateGameConfig,

  // Utilities
  defineGame,
  buildPlayerMetadata,
} from "@/lib/arcade/game-sdk";
```

### Key Concepts

#### GameDefinition

Complete description of a game:

```typescript
interface GameDefinition<TConfig, TState, TMove> {
  manifest: GameManifest; // Display info, max players, etc.
  Provider: GameProviderComponent; // React context provider
  GameComponent: GameComponent; // Main UI component
  validator: GameValidator; // Server-side validation
  defaultConfig: TConfig; // Default game settings
  validateConfig?: (config: unknown) => config is TConfig; // Runtime config validation
}
```

**Key Concept**: The `defaultConfig` property serves as the source of truth for config types. TypeScript can infer the config type from `typeof game.defaultConfig`, eliminating the need for manual type definitions in `game-configs.ts`.

#### GameState

The complete game state that's synchronized across all clients:

```typescript
interface GameState {
  gamePhase: string; // Current phase (setup, playing, results)
  activePlayers: string[]; // Array of player IDs
  playerMetadata: Record<string, PlayerMeta>; // Player info (name, emoji, etc.)
  // ... game-specific state
}
```

#### GameMove

Actions that players take, validated server-side:

```typescript
interface GameMove {
  type: string; // Move type (e.g., 'FLIP_CARD', 'MAKE_GUESS')
  playerId: string; // Player making the move
  userId: string; // User ID (for authentication)
  timestamp: number; // Client timestamp
  data: Record<string, unknown>; // Move-specific payload
}
```

#### GameValidator

Server-side validation logic:

```typescript
interface GameValidator<TState, TMove> {
  validateMove(state: TState, move: TMove): ValidationResult;
  isGameComplete(state: TState): boolean;
  getInitialState(config: unknown): TState;
}
```

---

## Creating a New Game

### Step 1: Create Game Directory

```bash
mkdir -p src/arcade-games/my-game/components
```

### Step 2: Define Types (`types.ts`)

```typescript
import type { GameConfig, GameMove, GameState } from "@/lib/arcade/game-sdk";

// Game configuration (persisted to database)
export interface MyGameConfig extends GameConfig {
  difficulty: number;
  timer: number;
}

// Game state (synchronized across clients)
export interface MyGameState extends GameState {
  gamePhase: "setup" | "playing" | "results";
  activePlayers: string[];
  playerMetadata: Record<string, PlayerMetadata>;
  currentPlayer: string;
  score: Record<string, number>;
  // ... your game-specific state
}

// Move types
export type MyGameMove =
  | {
      type: "START_GAME";
      playerId: string;
      userId: string;
      timestamp: number;
      data: { activePlayers: string[] };
    }
  | {
      type: "MAKE_MOVE";
      playerId: string;
      userId: string;
      timestamp: number;
      data: {
        /* move data */
      };
    }
  | {
      type: "END_GAME";
      playerId: string;
      userId: string;
      timestamp: number;
      data: {};
    };
```

### Step 3: Create Validator (`Validator.ts`)

```typescript
import type { GameValidator, ValidationResult } from "@/lib/arcade/game-sdk";
import type { MyGameState, MyGameMove } from "./types";

export class MyGameValidator implements GameValidator<MyGameState, MyGameMove> {
  validateMove(state: MyGameState, move: MyGameMove): ValidationResult {
    switch (move.type) {
      case "START_GAME":
        return this.validateStartGame(state, move.data.activePlayers);
      case "MAKE_MOVE":
        return this.validateMakeMove(state, move.playerId, move.data);
      default:
        return { valid: false, error: "Unknown move type" };
    }
  }

  private validateStartGame(
    state: MyGameState,
    activePlayers: string[],
  ): ValidationResult {
    if (activePlayers.length < 2) {
      return { valid: false, error: "Need at least 2 players" };
    }

    const newState: MyGameState = {
      ...state,
      gamePhase: "playing",
      activePlayers,
      currentPlayer: activePlayers[0],
      score: activePlayers.reduce((acc, p) => ({ ...acc, [p]: 0 }), {}),
    };

    return { valid: true, newState };
  }

  // ... more validation methods

  isGameComplete(state: MyGameState): boolean {
    return state.gamePhase === "results";
  }

  getInitialState(config: unknown): MyGameState {
    const { difficulty, timer } = config as MyGameConfig;
    return {
      difficulty,
      timer,
      gamePhase: "setup",
      activePlayers: [],
      playerMetadata: {},
      currentPlayer: "",
      score: {},
    };
  }
}

export const myGameValidator = new MyGameValidator();
```

### Step 4: Create Provider (`Provider.tsx`)

```typescript
'use client'

import { createContext, useCallback, useContext, useMemo } from 'react'
import {
  type GameMove,
  buildPlayerMetadata,
  useArcadeSession,
  useGameMode,
  useRoomData,
  useViewerId,
} from '@/lib/arcade/game-sdk'
import type { MyGameState } from './types'

interface MyGameContextValue {
  state: MyGameState
  lastError: string | null
  startGame: () => void
  makeMove: (data: any) => void
  clearError: () => void
  exitSession: () => void
}

const MyGameContext = createContext<MyGameContextValue | null>(null)

export function useMyGame() {
  const context = useContext(MyGameContext)
  if (!context) throw new Error('useMyGame must be used within MyGameProvider')
  return context
}

export function MyGameProvider({ children }: { children: React.ReactNode }) {
  const { data: viewerId } = useViewerId()
  const { roomData } = useRoomData()
  const { activePlayers: activePlayerIds, players } = useGameMode()

  // Get active players as array (keep Set iteration order to match UI display)
  const activePlayers = Array.from(activePlayerIds)

  const initialState = useMemo(() => ({
    difficulty: 1,
    timer: 30,
    gamePhase: 'setup' as const,
    activePlayers: [],
    playerMetadata: {},
    currentPlayer: '',
    score: {},
  }), [])

  const { state, sendMove, exitSession, lastError, clearError } =
    useArcadeSession<MyGameState>({
      userId: viewerId || '',
      roomId: roomData?.id,
      initialState,
      applyMove: (state, move) => state, // Server handles all updates
    })

  const startGame = useCallback(() => {
    const playerMetadata = buildPlayerMetadata(activePlayers, {}, players, viewerId)

    sendMove({
      type: 'START_GAME',
      playerId: activePlayers[0],
      userId: viewerId || '',
      data: { activePlayers, playerMetadata },
    })
  }, [activePlayers, players, viewerId, sendMove])

  const makeMove = useCallback((data: any) => {
    sendMove({
      type: 'MAKE_MOVE',
      playerId: state.currentPlayer,
      userId: viewerId || '',
      data,
    })
  }, [state.currentPlayer, viewerId, sendMove])

  return (
    <MyGameContext.Provider value={{
      state,
      lastError,
      startGame,
      makeMove,
      clearError,
      exitSession,
    }}>
      {children}
    </MyGameContext.Provider>
  )
}
```

### Step 5: Create Game Component (`GameComponent.tsx`)

```typescript
'use client'

import { useRouter } from 'next/navigation'
import { PageWithNav } from '@/components/PageWithNav'
import { useMyGame } from '../Provider'
import { SetupPhase } from './SetupPhase'
import { PlayingPhase } from './PlayingPhase'
import { ResultsPhase } from './ResultsPhase'

export function GameComponent() {
  const router = useRouter()
  const { state, exitSession } = useMyGame()

  // Determine whose turn it is for the turn indicator
  const currentPlayerId = state.gamePhase === 'playing' ? state.currentPlayer : undefined

  return (
    <PageWithNav
      navTitle="My Game"
      navEmoji="🎮"
      emphasizePlayerSelection={state.gamePhase === 'setup'}
      currentPlayerId={currentPlayerId}
      playerScores={state.score}
      onExitSession={() => {
        exitSession()
        router.push('/arcade')
      }}
    >
      {state.gamePhase === 'setup' && <SetupPhase />}
      {state.gamePhase === 'playing' && <PlayingPhase />}
      {state.gamePhase === 'results' && <ResultsPhase />}
    </PageWithNav>
  )
}
```

### Step 6: Define Game (`index.ts`)

```typescript
import { defineGame } from "@/lib/arcade/game-sdk";
import type { GameManifest } from "@/lib/arcade/game-sdk";
import { GameComponent } from "./components/GameComponent";
import { MyGameProvider } from "./Provider";
import type { MyGameConfig, MyGameMove, MyGameState } from "./types";
import { myGameValidator } from "./Validator";

const manifest: GameManifest = {
  name: "my-game",
  displayName: "My Awesome Game",
  icon: "🎮",
  description: "A fun multiplayer game",
  longDescription: "Detailed description of gameplay...",
  maxPlayers: 4,
  difficulty: "Beginner",
  chips: ["👥 Multiplayer", "🎲 Turn-Based"],
  color: "blue",
  gradient: "linear-gradient(135deg, #bfdbfe, #93c5fd)",
  borderColor: "blue.200",
  available: true,
};

const defaultConfig: MyGameConfig = {
  difficulty: 1,
  timer: 30,
};

// Runtime config validation (optional but recommended)
function validateMyGameConfig(config: unknown): config is MyGameConfig {
  return (
    typeof config === "object" &&
    config !== null &&
    "difficulty" in config &&
    "timer" in config &&
    typeof config.difficulty === "number" &&
    typeof config.timer === "number" &&
    config.difficulty >= 1 &&
    config.timer >= 10
  );
}

export const myGame = defineGame<MyGameConfig, MyGameState, MyGameMove>({
  manifest,
  Provider: MyGameProvider,
  GameComponent,
  validator: myGameValidator,
  defaultConfig,
  validateConfig: validateMyGameConfig, // Self-contained validation
});
```

**Phase 3 Benefit**: After defining your game, the config type will be automatically inferred in `game-configs.ts`. You don't need to manually add type definitions - just add a type-only import and use `InferGameConfig<typeof myGame>`.

### Step 7: Register Game

#### 7a. Register Validator (Server-Side)

Add your validator to the unified registry in `src/lib/arcade/validators.ts`:

```typescript
import { myGameValidator } from "@/arcade-games/my-game/Validator";

export const validatorRegistry = {
  matching: matchingGameValidator,
  "memory-quiz": memoryQuizGameValidator,
  "number-guesser": numberGuesserValidator,
  "my-game": myGameValidator, // Add your game here!
  // GameName type will auto-update from these keys
} as const;
```

**Why**: The validator registry is isomorphic (runs on both client and server) and serves as the single source of truth for all game validators. Adding your validator here automatically:

- Makes it available for server-side move validation
- Updates the `GameName` type (no manual type updates needed!)
- Enables your game for multiplayer rooms

#### 7b. Register Game Definition (Client-Side)

Add to `src/lib/arcade/game-registry.ts`:

```typescript
import { myGame } from "@/arcade-games/my-game";

registerGame(myGame);
```

**Why**: The game registry is client-only and connects your game's UI components (Provider, GameComponent) with the arcade system. Registration happens on client init and verifies that your validator is also registered server-side.

**Verification**: When you register a game, the registry will warn you if:

- ⚠️ The validator is missing from `validators.ts`
- ⚠️ The validator instance doesn't match (different imports)

**Important**: Both steps are required for a working game. The validator registry handles server logic, while the game registry handles client UI.

#### 7c. Add Config Type Inference (Optional but Recommended)

Update `src/lib/arcade/game-configs.ts` to infer your game's config type:

```typescript
// Add type-only import (won't load React components)
import type { myGame } from "@/arcade-games/my-game";

// Utility type (already defined)
type InferGameConfig<T> = T extends { defaultConfig: infer Config }
  ? Config
  : never;

// Infer your config type
export type MyGameConfig = InferGameConfig<typeof myGame>;

// Add to GameConfigByName
export type GameConfigByName = {
  // ... other games
  "my-game": MyGameConfig; // TypeScript infers the type automatically!
};

// RoomGameConfig is auto-derived from GameConfigByName
export type RoomGameConfig = {
  [K in keyof GameConfigByName]?: GameConfigByName[K];
};

// Add default config constant
export const DEFAULT_MY_GAME_CONFIG: MyGameConfig = {
  difficulty: 1,
  timer: 30,
};
```

**Benefits**:

- Config type automatically matches your game definition
- No manual type definition needed
- Single source of truth (your game's `defaultConfig`)
- TypeScript will error if you reference undefined properties

**Note**: You still need to manually add the default config constant. This is a small amount of duplication but necessary for server-side code that can't import the full game definition.

---

## File Structure

```
src/arcade-games/my-game/
├── index.ts                 # Game definition and export
├── Validator.ts             # Server-side move validation
├── Provider.tsx             # Client state management
├── GameComponent.tsx        # Main UI wrapper
├── types.ts                 # TypeScript type definitions
└── components/
    ├── SetupPhase.tsx       # Setup/lobby UI
    ├── PlayingPhase.tsx     # Main gameplay UI
    └── ResultsPhase.tsx     # End game/scores UI
```

### File Responsibilities

| File                | Purpose                     | Runs On         |
| ------------------- | --------------------------- | --------------- |
| `index.ts`          | Game registration           | Both            |
| `Validator.ts`      | Move validation, game logic | **Server only** |
| `Provider.tsx`      | State management, API calls | Client only     |
| `GameComponent.tsx` | Navigation, phase routing   | Client only     |
| `types.ts`          | Shared type definitions     | Both            |
| `components/*`      | UI for each game phase      | Client only     |

---

## Examples

### Number Guesser (Turn-Based)

See `src/arcade-games/number-guesser/` for a complete example of:

- Turn-based gameplay (chooser → guessers)
- Player rotation logic
- Round management
- Score tracking
- Hot/cold feedback system
- Error handling and user feedback

**Key Patterns:**

- Setting `currentPlayerId` for turn indicators
- Rotating turns in validator
- Handling round vs. game completion
- Type coercion for JSON-serialized numbers

---

## Best Practices

### 1. Player Ordering Consistency

**Problem**: Sets don't guarantee order, causing mismatch between UI and game logic.

**Solution**: Use `Array.from(activePlayerIds)` without sorting in both UI and game logic.

```typescript
// In Provider
const activePlayers = Array.from(activePlayerIds); // NO .sort()

// In Validator
const newState = {
  ...state,
  currentPlayer: activePlayers[0], // First in Set order = first in UI
};
```

### 2. Type Coercion for Numbers

**Problem**: WebSocket JSON serialization converts numbers to strings.

**Solution**: Explicitly coerce in validator:

```typescript
validateMove(state: MyGameState, move: MyGameMove): ValidationResult {
  switch (move.type) {
    case 'MAKE_GUESS':
      return this.validateGuess(state, Number(move.data.guess)) // Coerce!
  }
}
```

### 3. Error Feedback

**Problem**: Users don't see why their moves were rejected.

**Solution**: Use `lastError` from `useArcadeSession`:

```typescript
const { state, lastError, clearError } = useArcadeSession(...)

// Auto-dismiss after 5 seconds
useEffect(() => {
  if (lastError) {
    const timeout = setTimeout(() => clearError(), 5000)
    return () => clearTimeout(timeout)
  }
}, [lastError, clearError])

// Show in UI
{lastError && (
  <div className="error-banner">
    <div>⚠️ Move Rejected</div>
    <div>{lastError}</div>
    <button onClick={clearError}>Dismiss</button>
  </div>
)}
```

### 4. Turn Indicators

**Problem**: Players don't know whose turn it is.

**Solution**: Pass `currentPlayerId` to `PageWithNav`:

```typescript
<PageWithNav
  currentPlayerId={state.currentPlayer}
  playerScores={state.scores}
>
```

### 5. Server-Only Logic

**Problem**: Client can cheat by modifying local state.

**Solution**: All game logic in validator, client uses `applyMove: (state) => state`:

```typescript
// ❌ BAD: Client calculates winner
const { state, sendMove } = useArcadeSession({
  applyMove: (state, move) => {
    if (move.type === "SCORE") {
      return { ...state, winner: calculateWinner(state) }; // Cheatable!
    }
  },
});

// ✅ GOOD: Server calculates everything
const { state, sendMove } = useArcadeSession({
  applyMove: (state, move) => state, // Client just waits for server
});
```

### 6. Phase Management

Use discriminated union for type-safe phase rendering:

```typescript
type GamePhase = 'setup' | 'playing' | 'results'

interface MyGameState {
  gamePhase: GamePhase
  // ...
}

// In GameComponent
{state.gamePhase === 'setup' && <SetupPhase />}
{state.gamePhase === 'playing' && <PlayingPhase />}
{state.gamePhase === 'results' && <ResultsPhase />}
```

---

## Troubleshooting

### "Player not found" errors

**Cause**: Player IDs from `useGameMode()` don't match server state.

**Fix**: Always use `buildPlayerMetadata()` helper:

```typescript
const playerMetadata = buildPlayerMetadata(
  activePlayers,
  {},
  players,
  viewerId,
);
```

### Turn indicator not showing

**Cause**: `currentPlayerId` not passed or doesn't match player IDs in UI.

**Fix**: Verify player order matches between game state and `activePlayerIds`:

```typescript
// Both should use same source without sorting
const activePlayers = Array.from(activePlayerIds); // Provider
const activePlayerList = Array.from(activePlayers); // PageWithNav
```

### Moves rejected with type errors

**Cause**: JSON serialization converts numbers to strings.

**Fix**: Add `Number()` coercion in validator:

```typescript
case 'SET_VALUE':
  return this.validateValue(state, Number(move.data.value))
```

### State not syncing across clients

**Cause**: Not using `useArcadeSession` correctly.

**Fix**: Ensure `roomId` is passed:

```typescript
const { state, sendMove } = useArcadeSession({
  userId: viewerId || "",
  roomId: roomData?.id, // Required for room sync!
  initialState,
  applyMove: (state) => state,
});
```

### Game not appearing in selector

**Cause**: Not registered or `available: false`.

**Fix**:

1. Add to `game-registry.ts`: `registerGame(myGame)`
2. Set `available: true` in manifest
3. Verify no console errors on import

### Config changes not taking effect

**Cause**: State sync timing - validator uses old state while config is being updated.

**Context**: When you change game config (e.g., min/max numbers), there's a brief window where:

1. Client updates config in database
2. Config change hasn't propagated to server state yet
3. Moves are validated against old state

**Fix**: Ensure config changes trigger state reset or are applied atomically:

```typescript
// When changing config, also update initialState
const setConfig = useCallback(
  (field, value) => {
    sendMove({ type: "SET_CONFIG", data: { field, value } });

    // Persist to database for next session
    if (roomData?.id) {
      updateGameConfig({
        roomId: roomData.id,
        gameConfig: {
          ...roomData.gameConfig,
          "my-game": { ...currentConfig, [field]: value },
        },
      });
    }
  },
  [sendMove, updateGameConfig, roomData],
);
```

**Best Practice**: Make config changes only during setup phase, before game starts.

### Debugging validation errors

**Problem**: Moves rejected but unclear why (especially type-related issues).

**Solution**: Add debug logging in validator:

```typescript
private validateGuess(state: State, guess: number): ValidationResult {
  // Debug logging
  console.log('[MyGame] Validating guess:', {
    guess,
    guessType: typeof guess,           // Check if it's a string!
    min: state.minNumber,
    minType: typeof state.minNumber,
    max: state.maxNumber,
    maxType: typeof state.maxNumber,
  })

  if (guess < state.minNumber || guess > state.maxNumber) {
    return { valid: false, error: `Guess must be between ${state.minNumber} and ${state.maxNumber}` }
  }

  // ... rest of validation
}
```

**What to check:**

1. **Browser console**: Look for `[ArcadeSession] Move rejected by server:` messages
2. **Server logs**: Check validator console.log output for types and values
3. **Type mismatches**: Numbers becoming strings is the #1 issue
4. **State sync**: Is the validator using the state you expect?

**Common debugging workflow:**

1. Move rejected → Check browser console for error message
2. Error unclear → Add console.log to validator
3. Restart server → See debug output when move is made
4. Compare expected vs. actual values/types
5. Add `Number()` coercion if types don't match

---

## Resources

- **Game SDK**: `src/lib/arcade/game-sdk/`
- **Registry**: `src/lib/arcade/game-registry.ts`
- **Example Game**: `src/arcade-games/number-guesser/`
- **Validation Types**: `src/lib/arcade/validation/types.ts`

---

## FAQ

**Q: Can I use external libraries in my game?**
A: Yes, but install them in the workspace package.json. Games should be self-contained.

**Q: How do I add game configuration that persists?**
A: Use `useUpdateGameConfig()` to save to room:

```typescript
const { mutate: updateGameConfig } = useUpdateGameConfig();

updateGameConfig({
  roomId: roomData.id,
  gameConfig: {
    ...roomData.gameConfig,
    "my-game": { difficulty: 5 },
  },
});
```

**Q: Can I have asymmetric player roles?**
A: Yes! See Number Guesser's chooser/guesser pattern.

**Q: How do I handle real-time timers?**
A: Store `startTime` in state, use client-side countdown, server validates elapsed time.

**Q: What's the difference between `playerId` and `userId`?**
A: `userId` is the user account, `playerId` is the avatar/character in the game. One user can control multiple players.
