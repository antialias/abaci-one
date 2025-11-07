# Game Migration Playbook

**Version**: 1.0
**Last Updated**: 2025-01-16
**For**: Migrating legacy arcade games to the Modular Game Platform

---

## Overview

This playbook provides step-by-step instructions for migrating a legacy arcade game to the new modular game system. Follow these steps in order to ensure a smooth, low-risk migration.

**⚠️ Important**: Local mode is deprecated. All games must operate in room mode only (even solo play is a single-player room).

**Estimated Time**: 4-8 hours per game (varies by complexity)

---

## Prerequisites

Before starting, ensure:

- [ ] You understand the Game SDK architecture (`/src/arcade-games/README.md`)
- [ ] You've read `ARCHITECTURAL_IMPROVEMENTS.md`
- [ ] The game is currently working in production
- [ ] You have a test plan for the game

---

## Phase 1: Analysis (30-60 minutes)

### Step 1.1: Document Current Architecture

Create a migration plan document (`docs/[GAME_NAME]_MIGRATION_PLAN.md`) with:

**Current File Structure**:

```
List all files the game currently uses:
- State types
- Move types
- Providers (local, room, unified?)
- Components
- Validator (if exists)
- Page routes
```

**Current State Shape**:

```typescript
// Document the current state interface
interface CurrentGameState {
  // List all fields
  // Mark which are UI-only vs game logic
  // Identify multiplayer fields
}
```

**Current Move Types**:

```typescript
// Document all move types
type CurrentGameMove =
  | { type: 'MOVE_1', ... }
  | { type: 'MOVE_2', ... }
```

**Current Config**:

```typescript
// Document game configuration
interface CurrentGameConfig {
  // List all settings
}
```

### Step 1.2: Identify Validator Status

**Check if validator exists**:

```bash
grep -r "YourGameValidator" src/lib/arcade/validation/
```

**Status**:

- ✅ **Validator exists**: Migration is easier (skip validator creation)
- ❌ **No validator**: Need to create one (add 2-3 hours)

### Step 1.3: Assess Current Provider Pattern

**Which pattern does the game use?**

- **Reducer Pattern**: Has `reducer.ts`, uses `useReducer`, dispatches actions
- **ArcadeSession Pattern**: Uses `useArcadeSession`, sends moves
- **Hybrid**: Uses both (uh oh)

**How many providers?**

- **Single Provider**: One provider (room mode only)
- **Dual Providers**: Separate `LocalProvider.tsx` and `RoomProvider.tsx` (both will be replaced)

**Note**: All providers will be replaced with a single room-mode provider.

### Step 1.4: Identify Complexity Factors

Rate each factor (Low/Medium/High):

- [ ] **UI State Complexity**: Animations, keyboard state, timeouts
- [ ] **Timing Requirements**: Card sequences, turn timers, synchronization
- [ ] **Input Handling**: Real-time input, debouncing, local optimization
- [ ] **Multiplayer Scoring**: Cooperative vs competitive modes, player attribution
- [ ] **Configuration Persistence**: Settings saved per room/game

**Complexity Score**:

- 0-2 High: **Easy** (2-4 hours)
- 3-4 High: **Medium** (4-6 hours)
- 5+ High: **Hard** (6-8+ hours)

---

## Phase 2: Preparation (1 hour)

### Step 2.1: Create New Directory Structure

```bash
mkdir -p src/arcade-games/[game-name]
mkdir -p src/arcade-games/[game-name]/components
```

**Directory structure**:

```
src/arcade-games/[game-name]/
├── index.ts              # Game definition (will create)
├── Validator.ts          # Move existing or create new
├── Provider.tsx          # Unified provider (will create)
├── types.ts              # Copy and update
├── game.yaml             # Optional manifest
└── components/
    ├── GameComponent.tsx # Main wrapper (will create)
    ├── SetupPhase.tsx    # Copy and update
    ├── PlayingPhase.tsx  # Copy and update
    └── ResultsPhase.tsx  # Copy and update
```

### Step 2.2: Copy Validator

**If validator exists**:

```bash
cp src/lib/arcade/validation/[Game]Validator.ts \
   src/arcade-games/[game-name]/Validator.ts
```

**Update imports** in the validator:

```diff
- import type { SomeOldType } from '@/app/arcade/[game]'
+ import type { SomeNewType } from './types'
```

**If validator doesn't exist**: See Appendix A for validator creation guide.

### Step 2.3: Copy Types

```bash
cp src/app/arcade/[game-name]/types.ts \
   src/arcade-games/[game-name]/types.ts
```

**Note**: You'll update these types in Phase 3.

### Step 2.4: Document Migration Checklist

In your migration plan, add:

```markdown
## Migration Checklist

- [ ] Phase 1: Analysis complete
- [ ] Phase 2: Preparation complete
- [ ] Phase 3: Game definition created
- [ ] Phase 4: Types updated
- [ ] Phase 5: Provider created
- [ ] Phase 6: Components updated
- [ ] Phase 7: Page route updated
- [ ] Phase 8: Testing complete
- [ ] Phase 9: Cleanup done
```

---

## Phase 3: Game Definition (1 hour)

### Step 3.1: Create Manifest

**Option A: YAML file** (recommended):

```yaml
# src/arcade-games/[game-name]/game.yaml
name: game-name
displayName: Game Display Name
icon: 🎮
description: Short one-line description
longDescription: |
  Longer description explaining gameplay,
  rules, and what makes the game fun.
maxPlayers: 8
difficulty: Beginner | Intermediate | Advanced
chips:
  - 👥 Multiplayer
  - ⚡ Fast-Paced
  - 🧠 Mental Challenge
color: blue | purple | orange | green
gradient: linear-gradient(135deg, #color1, #color2)
borderColor: blue.200
available: true
```

**Option B: Inline object**:

```typescript
const manifest: GameManifest = {
  name: "game-name",
  displayName: "Game Display Name",
  // ... all fields from above
};
```

### Step 3.2: Define Default Config

```typescript
const defaultConfig: YourGameConfig = {
  setting1: defaultValue1,
  setting2: defaultValue2,
  // ... all game settings with sensible defaults
};
```

### Step 3.3: Create Config Validator

```typescript
function validateYourGameConfig(config: unknown): config is YourGameConfig {
  return (
    typeof config === "object" &&
    config !== null &&
    // Check each field exists
    "setting1" in config &&
    "setting2" in config &&
    // Validate each field's type and value
    typeof (config as any).setting1 === "string" &&
    typeof (config as any).setting2 === "number" &&
    // Validate constraints
    (config as any).setting2 >= 1 &&
    (config as any).setting2 <= 100
  );
}
```

### Step 3.4: Create Game Definition

```typescript
// src/arcade-games/[game-name]/index.ts
import { defineGame } from "@/lib/arcade/game-sdk";
import type { GameManifest } from "@/lib/arcade/game-sdk";
import { GameComponent } from "./components/GameComponent";
import { YourGameProvider } from "./Provider";
import type { YourGameConfig, YourGameMove, YourGameState } from "./types";
import { yourGameValidator } from "./Validator";

const manifest: GameManifest = {
  // ... manifest from Step 3.1
};

const defaultConfig: YourGameConfig = {
  // ... config from Step 3.2
};

function validateYourGameConfig(config: unknown): config is YourGameConfig {
  // ... validator from Step 3.3
}

export const yourGame = defineGame<YourGameConfig, YourGameState, YourGameMove>(
  {
    manifest,
    Provider: YourGameProvider,
    GameComponent,
    validator: yourGameValidator,
    defaultConfig,
    validateConfig: validateYourGameConfig,
  },
);
```

### Step 3.5: Register Game

**In `src/lib/arcade/game-registry.ts`**:

```typescript
import { yourGame } from "@/arcade-games/[game-name]";

registerGame(yourGame);
```

**In `src/lib/arcade/validators.ts`**:

```typescript
import { yourGameValidator } from "@/arcade-games/[game-name]/Validator";

export const validatorRegistry = {
  // ... other games
  "game-name": yourGameValidator,
} as const;
```

### Step 3.6: Add Type Inference

**In `src/lib/arcade/game-configs.ts`**:

```typescript
// Add type-only import
import type { yourGame } from "@/arcade-games/[game-name]";

// Infer config type
export type YourGameConfig = InferGameConfig<typeof yourGame>;

// Add to GameConfigByName
export type GameConfigByName = {
  // ... other games
  "game-name": YourGameConfig;
};

// Add default config constant
export const DEFAULT_YOUR_GAME_CONFIG: YourGameConfig = {
  setting1: defaultValue1,
  setting2: defaultValue2,
};
```

---

## Phase 4: Update Types (30 minutes)

### Step 4.1: Update State Interface

```typescript
// src/arcade-games/[game-name]/types.ts
import type { GameConfig, GameState, GameMove } from "@/lib/arcade/game-sdk";

export interface YourGameConfig extends GameConfig {
  setting1: string;
  setting2: number;
  // ... all game settings
}

export interface YourGameState extends GameState {
  // Game-specific fields
  gamePhase: "setup" | "playing" | "results";

  // Multiplayer fields (from GameState)
  activePlayers: string[];
  playerMetadata: Record<string, PlayerMetadata>;

  // Your game's custom fields
  score: Record<string, number>;
  // ...
}
```

### Step 4.2: Update Move Types

**Ensure all moves have required fields**:

```typescript
export type YourGameMove =
  | {
      type: "START_GAME";
      playerId: string; // Required
      userId: string; // Required
      timestamp: number; // Added by SDK
      data: {
        activePlayers: string[];
        playerMetadata: Record<string, any>;
      };
    }
  | {
      type: "MAKE_MOVE";
      playerId: string;
      userId: string;
      timestamp: number;
      data: {
        // Move-specific data
      };
    };
```

**Key Requirements**:

- ✅ Every move must have: `playerId`, `userId`, `timestamp`, `data`
- ✅ Use `TEAM_MOVE` constant for moves where specific player doesn't matter
- ✅ `data` is always an object (never primitive)

### Step 4.3: Export Types

```typescript
export type { PlayerMetadata } from "@/lib/arcade/player-ownership.client";
// ... any other needed types
```

---

## Phase 5: Create Provider (2 hours)

### Step 5.1: Provider Template (Room Mode Only)

```typescript
// src/arcade-games/[game-name]/Provider.tsx
'use client'

import { createContext, useCallback, useContext, useMemo } from 'react'
import {
  useArcadeSession,
  useGameMode,
  useRoomData,
  useViewerId,
  useUpdateGameConfig,
  buildPlayerMetadata,
  TEAM_MOVE,
} from '@/lib/arcade/game-sdk'
import type { YourGameState, YourGameMove } from './types'

// Context interface
interface YourGameContextValue {
  state: YourGameState
  lastError: string | null
  clearError: () => void
  exitSession: () => void

  // Game-specific actions
  startGame: () => void
  makeMove: (data: any) => void
  // ... all your game's actions
}

const YourGameContext = createContext<YourGameContextValue | null>(null)

export function useYourGame() {
  const context = useContext(YourGameContext)
  if (!context) throw new Error('useYourGame must be used within YourGameProvider')
  return context
}

export function YourGameProvider({ children }: { children: React.ReactNode }) {
  const { data: viewerId } = useViewerId()
  const { roomData } = useRoomData()
  const { activePlayers: activePlayerIds, players } = useGameMode()
  const { mutate: updateGameConfig } = useUpdateGameConfig()

  const activePlayers = Array.from(activePlayerIds)

  // Merge saved config from room
  const initialState = useMemo(() => {
    const gameConfig = roomData?.gameConfig?.['game-name']
    return {
      // Default state
      gamePhase: 'setup' as const,
      activePlayers: [],
      playerMetadata: {},
      score: {},
      // ... your default state

      // Override with saved config from room
      setting1: gameConfig?.setting1 ?? defaultValue1,
      setting2: gameConfig?.setting2 ?? defaultValue2,
    }
  }, [roomData])

  const { state, sendMove, exitSession, lastError, clearError } =
    useArcadeSession<YourGameState>({
      userId: viewerId || '',
      roomId: roomData?.id, // Always provided (room mode only)
      initialState,
      applyMove: (state) => state, // Server handles all state updates
    })

  // Action: Start Game
  const startGame = useCallback(() => {
    const playerMetadata = buildPlayerMetadata(activePlayers, {}, players, viewerId)

    sendMove({
      type: 'START_GAME',
      playerId: activePlayers[0], // Or TEAM_MOVE
      userId: viewerId || '',
      data: { activePlayers, playerMetadata },
    })
  }, [activePlayers, players, viewerId, sendMove])

  // Action: Make Move
  const makeMove = useCallback((data: any) => {
    sendMove({
      type: 'MAKE_MOVE',
      playerId: state.currentPlayer, // Or TEAM_MOVE
      userId: viewerId || '',
      data,
    })
  }, [state.currentPlayer, viewerId, sendMove])

  // ... more action creators

  return (
    <YourGameContext.Provider value={{
      state,
      lastError,
      clearError,
      exitSession,
      startGame,
      makeMove,
      // ... all actions
    }}>
      {children}
    </YourGameContext.Provider>
  )
}
```

### Step 5.2: Handle Config Persistence

For any setting that should persist:

```typescript
const setConfig = useCallback(
  (field: keyof YourGameConfig, value: any) => {
    // Send move to update state immediately
    sendMove({
      type: "SET_CONFIG",
      playerId: TEAM_MOVE,
      userId: viewerId || "",
      data: { field, value },
    });

    // Persist to database (always - room mode only)
    if (roomData?.id) {
      const currentGameConfig =
        (roomData.gameConfig as Record<string, any>) || {};
      const currentConfig =
        (currentGameConfig["game-name"] as Record<string, any>) || {};

      updateGameConfig({
        roomId: roomData.id,
        gameConfig: {
          ...currentGameConfig,
          "game-name": {
            ...currentConfig,
            [field]: value,
          },
        },
      });
    }
  },
  [viewerId, sendMove, roomData, updateGameConfig],
);
```

### Step 5.3: Handle Local-Only State

For UI state that doesn't need network sync:

```typescript
// Example: Input field that updates every keystroke
const [localInput, setLocalInput] = useState("");

// Merge with network state
const mergedState = {
  ...state,
  currentInput: localInput, // Override with local value
};

// Only send to network when submitting
const submitAnswer = useCallback(
  (answer: string) => {
    sendMove({
      type: "SUBMIT_ANSWER",
      playerId: state.currentPlayer,
      userId: viewerId || "",
      data: { answer },
    });
    setLocalInput(""); // Clear local state
  },
  [state.currentPlayer, viewerId, sendMove],
);
```

---

## Phase 6: Update Components (1 hour)

### Step 6.1: Create GameComponent

```typescript
// src/arcade-games/[game-name]/components/GameComponent.tsx
'use client'

import { useRouter } from 'next/navigation'
import { PageWithNav } from '@/components/PageWithNav'
import { useYourGame } from '../Provider'
import { SetupPhase } from './SetupPhase'
import { PlayingPhase } from './PlayingPhase'
import { ResultsPhase } from './ResultsPhase'

export function GameComponent() {
  const router = useRouter()
  const { state, exitSession } = useYourGame()

  // Determine current player for turn indicator (if turn-based)
  const currentPlayerId = state.gamePhase === 'playing' ? state.currentPlayer : undefined

  return (
    <PageWithNav
      navTitle="Your Game Name"
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

### Step 6.2: Update Phase Components

**Pattern for each component**:

```typescript
import { useYourGame } from '../Provider'

export function YourPhase() {
  const { state, actionName1, actionName2 } = useYourGame()

  // Replace dispatch() calls with action creators
  // Before: dispatch({ type: 'SOME_ACTION', data })
  // After:  actionName1(data)

  return (
    // ... JSX (mostly unchanged)
  )
}
```

**Common Changes**:

```diff
- const { state, dispatch } = useYourGame()
+ const { state, actionName } = useYourGame()

- dispatch({ type: 'START_GAME' })
+ startGame()

- dispatch({ type: 'MAKE_MOVE', data: { value } })
+ makeMove({ value })

- dispatch({ type: 'SET_CONFIG', field, value })
+ setConfig(field, value)
```

### Step 6.3: Handle Error Display

Add error banner to appropriate phase(s):

```typescript
const { lastError, clearError } = useYourGame()

{lastError && (
  <div className="error-banner">
    <span>⚠️ {lastError}</span>
    <button onClick={clearError}>Dismiss</button>
  </div>
)}
```

---

## Phase 7: Update Page Route (15 minutes)

### Step 7.1: Update Arcade Page

```typescript
// src/app/arcade/[game-name]/page.tsx
'use client'

import { yourGame } from '@/arcade-games/[game-name]'

const { Provider, GameComponent } = yourGame

export default function YourGamePage() {
  return (
    <Provider>
      <GameComponent />
    </Provider>
  )
}
```

**That's it!** The game is now on the modular platform.

### Step 7.2: Update Game Selector (if needed)

Check if `GameSelector.tsx` needs updates. It should automatically pick up registered games from the registry.

---

## Phase 8: Testing (1 hour)

### Step 8.1: Solo Play Testing

Test all functionality with a single player in a room:

- [ ] **Setup Phase**
  - [ ] All settings render correctly
  - [ ] Can change all settings
  - [ ] Settings have sensible defaults
  - [ ] Settings persist across page reloads
  - [ ] Can start game

- [ ] **Playing Phase**
  - [ ] Game progresses correctly
  - [ ] All moves work
  - [ ] Scoring works
  - [ ] Turn indicators work (if turn-based)
  - [ ] Animations work
  - [ ] Input handling works

- [ ] **Results Phase**
  - [ ] Scores display correctly
  - [ ] Can play again
  - [ ] Can exit game

### Step 8.2: Multiplayer Testing

Test with multiple players:

- [ ] **Settings Persistence**
  - [ ] Settings save when changed
  - [ ] Settings persist across page reloads
  - [ ] Settings don't leak across games

- [ ] **Synchronization**
  - [ ] All players see same state
  - [ ] Moves from any player work
  - [ ] Turn indicators work (if turn-based)
  - [ ] Timing is synchronized

- [ ] **Scoring**
  - [ ] Player attribution works
  - [ ] Scores track correctly per player
  - [ ] Multiplayer modes work (if applicable)

### Step 8.3: Edge Case Testing

- [ ] **Navigation**
  - [ ] Can exit mid-game
  - [ ] Can switch games
  - [ ] Settings preserved when returning

- [ ] **Error Handling**
  - [ ] Invalid moves rejected gracefully
  - [ ] Network errors handled
  - [ ] Server validation errors shown

### Step 8.4: Pre-Commit Checks

```bash
npm run pre-commit
```

**Must pass**:

- [ ] TypeScript compilation (0 errors)
- [ ] Format check (all files formatted)
- [ ] Lint check (0 errors, 0 warnings)

---

## Phase 9: Cleanup (30 minutes)

### Step 9.1: Delete Old Files

```bash
# If reducer pattern was used
rm src/app/arcade/[game-name]/reducer.ts

# Delete any local mode providers (deprecated)
rm src/app/arcade/[game-name]/context/LocalProvider.tsx
rm src/app/arcade/[game-name]/context/Local*Provider.tsx

# If dual providers were used
rm src/app/arcade/[game-name]/context/RoomProvider.tsx

# Delete old local mode page (if exists)
rm src/app/games/[game-name]/page.tsx

# If validator was moved
rm src/lib/arcade/validation/[Game]Validator.ts
```

**Note**: Only the arcade version (`/app/arcade/[game-name]/page.tsx`) should remain, using the new modular game definition.

### Step 9.2: Update Documentation

**In `ARCHITECTURAL_IMPROVEMENTS.md`**:

```markdown
### Migrated Games

- ✅ Number Guesser (v4.0.0)
- ✅ Math Sprint (v4.0.1)
- ✅ Memory Quiz (v4.1.0) - Completed 2025-01-16
```

**In your migration plan**:

```markdown
## Migration Complete ✅

**Date Completed**: YYYY-MM-DD
**Final Commit**: [commit hash]
**Testing**: All tests passed
**Status**: Live in production
```

### Step 9.3: Commit Migration

```bash
git add -A
git commit -m "feat(arcade): migrate [game-name] to modular platform

Migrates [game-name] from legacy architecture to modular game SDK.

Changes:
- Moved from /app/arcade/[game-name] to /arcade-games/[game-name]
- Created game definition with defineGame()
- Unified provider for local and room modes
- Added config validation
- Updated all components to use SDK patterns

Closes #[issue-number]

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

git push
```

---

## Troubleshooting

### Issue: TypeScript errors after migration

**Symptom**: Lots of type errors in components

**Solution**:

1. Check that move types include `playerId`, `userId`, `timestamp`
2. Verify state extends `GameState` from SDK
3. Update component imports to use new provider location

### Issue: State not syncing across players

**Symptom**: Players see different states

**Solution**:

1. Verify `roomId` is passed to `useArcadeSession` (should always be present)
2. Check validator is handling moves correctly
3. Ensure `applyMove` returns state (doesn't mutate)
4. Verify room actually has a roomId (not undefined)

### Issue: Settings not persisting

**Symptom**: Settings reset on page reload

**Solution**:

1. Check `useUpdateGameConfig` is called in `setConfig`
2. Verify config is scoped by game name: `gameConfig['game-name']`
3. Ensure `initialState` useMemo depends on `roomData`

### Issue: Moves rejected with "Unknown move type"

**Symptom**: Validator rejects all moves

**Solution**:

1. Check move type strings match validator switch cases
2. Verify validator is registered correctly
3. Check move structure includes all required fields

### Issue: Components crash on mount

**Symptom**: useContext errors or null reference errors

**Solution**:

1. Verify Provider wraps all components
2. Check context exports match usage
3. Ensure hooks are called within Provider

---

## Appendix A: Creating a Validator

If your game doesn't have a validator, create one:

```typescript
// src/arcade-games/[game-name]/Validator.ts
import type { GameValidator, ValidationResult } from "@/lib/arcade/game-sdk";
import type { YourGameState, YourGameMove } from "./types";

export class YourGameValidator
  implements GameValidator<YourGameState, YourGameMove>
{
  validateMove(
    state: YourGameState,
    move: YourGameMove,
    context?: { userId?: string },
  ): ValidationResult {
    switch (move.type) {
      case "START_GAME":
        return this.validateStartGame(state, move.data);

      case "MAKE_MOVE":
        return this.validateMakeMove(state, move.playerId, move.data);

      // ... handle each move type

      default:
        return { valid: false, error: "Unknown move type" };
    }
  }

  private validateStartGame(state: YourGameState, data: any): ValidationResult {
    // Check preconditions
    if (state.gamePhase !== "setup") {
      return { valid: false, error: "Can only start from setup phase" };
    }

    // Create new state
    const newState: YourGameState = {
      ...state,
      gamePhase: "playing",
      activePlayers: data.activePlayers || [],
      playerMetadata: data.playerMetadata || {},
      // ... initialize game state
    };

    return { valid: true, newState };
  }

  // ... more validation methods

  isGameComplete(state: YourGameState): boolean {
    return state.gamePhase === "results";
  }

  getInitialState(config: YourGameConfig): YourGameState {
    return {
      gamePhase: "setup",
      activePlayers: [],
      playerMetadata: {},
      // ... all initial state from config
    };
  }
}

export const yourGameValidator = new YourGameValidator();
```

**Key Principles**:

1. ✅ Validator is authoritative (client is display only)
2. ✅ Always return new state (never mutate)
3. ✅ Validate all preconditions before state changes
4. ✅ Return clear error messages for invalid moves
5. ✅ Handle all edge cases

---

## Appendix B: Common Patterns

### Pattern: Turn-Based Games

```typescript
// Validator
if (move.playerId !== state.currentPlayer) {
  return { valid: false, error: "Not your turn" };
}

// After valid move, rotate turn
const nextPlayerIndex = (currentIndex + 1) % state.activePlayers.length;
const newState = {
  ...state,
  currentPlayer: state.activePlayers[nextPlayerIndex],
};
```

### Pattern: Team Moves

```typescript
// Use TEAM_MOVE for moves where any player can act
sendMove({
  type: "SUBMIT_ANSWER",
  playerId: TEAM_MOVE, // Not attributed to specific player
  userId: viewerId || "",
  data: { answer },
});
```

### Pattern: Timed Actions

```typescript
// Store timestamp in state, check elapsed time
const elapsedTime = Date.now() - state.startTime;
if (elapsedTime > state.timeLimit) {
  return { valid: false, error: "Time expired" };
}
```

### Pattern: Scoring by User

```typescript
// Track scores by userId (not playerId) for multi-character games
const newScores = { ...state.scores };
if (move.userId) {
  newScores[move.userId] = (newScores[move.userId] || 0) + points;
}
```

---

## Summary Checklist

Use this as a final verification before declaring migration complete:

### Code Quality

- [ ] TypeScript compiles with 0 errors
- [ ] Linter passes with 0 errors, 0 warnings
- [ ] Formatter has been run
- [ ] No console errors in browser
- [ ] No console warnings in terminal

### Architecture

- [ ] Game definition created with `defineGame()`
- [ ] Validator implements `GameValidator` interface
- [ ] Provider uses SDK hooks exclusively
- [ ] Types extend SDK base types
- [ ] Config validation function exists

### Registration

- [ ] Game registered in `game-registry.ts`
- [ ] Validator registered in `validators.ts`
- [ ] Config type inferred in `game-configs.ts`
- [ ] Default config constant added

### Functionality

- [ ] All game phases work in local mode
- [ ] All game phases work in room mode
- [ ] Settings persist in room mode
- [ ] Multiplayer synchronization works
- [ ] Scoring tracks correctly
- [ ] Can exit and re-enter game

### Documentation

- [ ] Migration plan created
- [ ] Breaking changes documented
- [ ] Testing results recorded
- [ ] Commit messages are clear

---

## Conclusion

You've now successfully migrated a game to the modular platform! 🎉

The game is now:

- ✅ Self-contained in `/arcade-games/[game-name]/`
- ✅ Using the Game SDK for all functionality
- ✅ Room mode only (no local mode code)
- ✅ Automatically type-checked
- ✅ Validated server-side
- ✅ Settings always persist to room config
- ✅ Easier to maintain and extend

**Next Steps**:

1. Monitor game in production for any issues
2. Consider adding game-specific settings
3. Migrate the next legacy game!

---

**Questions or issues?** Refer to:

- Game SDK Docs: `/src/arcade-games/README.md`
- Architecture Docs: `/docs/ARCHITECTURAL_IMPROVEMENTS.md`
- Example Games: Number Guesser, Math Sprint, Memory Quiz
