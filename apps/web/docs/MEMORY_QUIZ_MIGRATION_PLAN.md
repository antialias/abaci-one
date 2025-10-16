# Memory Quiz Migration Plan

**Game**: Memory Lightning (memory-quiz)
**Date**: 2025-01-16
**Target**: Migrate to Modular Game Platform (Game SDK)

---

## Executive Summary

Migrate the Memory Lightning game from the legacy architecture to the new modular game platform. This game is unique because:
- ✅ Already has a validator (`MemoryQuizGameValidator`)
- ✅ Already uses `useArcadeSession` in room mode
- ❌ Located in `/app/arcade/memory-quiz/` instead of `/arcade-games/`
- ❌ Uses reducer pattern instead of server-driven state
- ❌ Not using Game SDK types and structure

**Complexity**: **Medium-High** (4-6 hours)
**Risk**: Low (validator already exists, well-tested game)

---

## Current Architecture

### File Structure
```
src/app/arcade/memory-quiz/
├── page.tsx                          # Main page (local mode)
├── types.ts                          # State and move types
├── reducer.ts                        # State reducer (local only)
├── context/
│   ├── MemoryQuizContext.tsx         # Context interface
│   ├── LocalMemoryQuizProvider.tsx   # Local (solo) provider
│   └── RoomMemoryQuizProvider.tsx    # Multiplayer provider
└── components/
    ├── MemoryQuizGame.tsx            # Game wrapper component
    ├── SetupPhase.tsx                # Setup/lobby UI
    ├── DisplayPhase.tsx              # Card display phase
    ├── InputPhase.tsx                # Input/guessing phase
    ├── ResultsPhase.tsx              # End game results
    ├── CardGrid.tsx                  # Card display component
    └── ResultsCardGrid.tsx           # Results card display

src/lib/arcade/validation/
└── MemoryQuizGameValidator.ts        # Server validator (✅ exists!)
```

### Important Notes

**⚠️ Local Mode Deprecated**: This migration only supports room mode. All games must be played in a room (even solo play is a single-player room). No local/offline mode code should be included.

### Current State Type (`SorobanQuizState`)
```typescript
interface SorobanQuizState {
  // Core game data
  cards: QuizCard[]
  quizCards: QuizCard[]
  correctAnswers: number[]

  // Game progression
  currentCardIndex: number
  displayTime: number
  selectedCount: 2 | 5 | 8 | 12 | 15
  selectedDifficulty: DifficultyLevel

  // Input system state
  foundNumbers: number[]
  guessesRemaining: number
  currentInput: string
  incorrectGuesses: number

  // Multiplayer state
  activePlayers: string[]
  playerMetadata: Record<string, PlayerMetadata>
  playerScores: Record<string, PlayerScore>
  playMode: 'cooperative' | 'competitive'
  numberFoundBy: Record<number, string>

  // UI state
  gamePhase: 'setup' | 'display' | 'input' | 'results'
  prefixAcceptanceTimeout: NodeJS.Timeout | null
  finishButtonsBound: boolean
  wrongGuessAnimations: Array<{...}>

  // Keyboard state
  hasPhysicalKeyboard: boolean | null
  testingMode: boolean
  showOnScreenKeyboard: boolean
}
```

### Current Move Types
```typescript
type MemoryQuizGameMove =
  | { type: 'START_QUIZ'; data: { numbers: number[], activePlayers, playerMetadata } }
  | { type: 'NEXT_CARD' }
  | { type: 'SHOW_INPUT_PHASE' }
  | { type: 'ACCEPT_NUMBER'; data: { number: number } }
  | { type: 'REJECT_NUMBER' }
  | { type: 'SET_INPUT'; data: { input: string } }
  | { type: 'SHOW_RESULTS' }
  | { type: 'RESET_QUIZ' }
  | { type: 'SET_CONFIG'; data: { field, value } }
```

### Current Config
```typescript
interface MemoryQuizGameConfig {
  selectedCount: 2 | 5 | 8 | 12 | 15
  displayTime: number
  selectedDifficulty: 'beginner' | 'easy' | 'medium' | 'hard' | 'expert'
  playMode: 'cooperative' | 'competitive'
}
```

---

## Target Architecture

### New File Structure
```
src/arcade-games/memory-quiz/           # NEW location
├── index.ts                            # Game definition (defineGame)
├── Validator.ts                        # Move from /lib/arcade/validation/
├── Provider.tsx                        # Single unified provider
├── types.ts                            # State, config, move types
├── game.yaml                           # Manifest (optional)
└── components/
    ├── GameComponent.tsx               # Main game wrapper
    ├── SetupPhase.tsx                  # Setup UI (updated)
    ├── DisplayPhase.tsx                # Display phase (minimal changes)
    ├── InputPhase.tsx                  # Input phase (minimal changes)
    ├── ResultsPhase.tsx                # Results (minimal changes)
    ├── CardGrid.tsx                    # Unchanged
    └── ResultsCardGrid.tsx             # Unchanged
```

### New Provider Pattern
- ✅ Single provider (room mode only)
- ✅ Uses `useArcadeSession` with `roomId` (always provided)
- ✅ Uses Game SDK hooks (`useViewerId`, `useRoomData`, `useGameMode`)
- ✅ All state driven by server validator (no client reducer)
- ✅ All settings persist to room config automatically

---

## Migration Steps

### Phase 1: Preparation (1 hour)
**Goal**: Set up new structure without breaking existing game

1. ✅ Create `/src/arcade-games/memory-quiz/` directory
2. ✅ Copy Validator from `/lib/arcade/validation/` to new location
3. ✅ Update Validator to use Game SDK types if needed
4. ✅ Create `index.ts` stub for game definition
5. ✅ Copy `types.ts` to new location (will be updated)
6. ✅ Document what needs to change in each file

**Verification**: Existing game still works, new directory has scaffold

---

### Phase 2: Create Game Definition (1 hour)
**Goal**: Define the game using `defineGame()` helper

**Steps**:
1. Create `game.yaml` manifest (optional but recommended)
   ```yaml
   name: memory-quiz
   displayName: Memory Lightning
   icon: 🧠
   description: Memorize soroban numbers and recall them
   longDescription: |
     Flash cards with soroban numbers. Memorize them during the display
     phase, then recall and type them during the input phase.
   maxPlayers: 8
   difficulty: Intermediate
   chips:
     - 👥 Multiplayer
     - ⚡ Fast-Paced
     - 🧠 Memory Challenge
   color: blue
   gradient: linear-gradient(135deg, #dbeafe, #bfdbfe)
   borderColor: blue.200
   available: true
   ```

2. Create `index.ts` game definition:
   ```typescript
   import { defineGame } from '@/lib/arcade/game-sdk'
   import type { GameManifest } from '@/lib/arcade/game-sdk'
   import { GameComponent } from './components/GameComponent'
   import { MemoryQuizProvider } from './Provider'
   import type { MemoryQuizConfig, MemoryQuizMove, MemoryQuizState } from './types'
   import { memoryQuizValidator } from './Validator'

   const manifest: GameManifest = {
     name: 'memory-quiz',
     displayName: 'Memory Lightning',
     icon: '🧠',
     // ... (copy from game.yaml or define inline)
   }

   const defaultConfig: MemoryQuizConfig = {
     selectedCount: 5,
     displayTime: 2.0,
     selectedDifficulty: 'easy',
     playMode: 'cooperative',
   }

   function validateMemoryQuizConfig(config: unknown): config is MemoryQuizConfig {
     return (
       typeof config === 'object' &&
       config !== null &&
       'selectedCount' in config &&
       'displayTime' in config &&
       'selectedDifficulty' in config &&
       'playMode' in config &&
       [2, 5, 8, 12, 15].includes((config as any).selectedCount) &&
       typeof (config as any).displayTime === 'number' &&
       (config as any).displayTime > 0 &&
       ['beginner', 'easy', 'medium', 'hard', 'expert'].includes(
         (config as any).selectedDifficulty
       ) &&
       ['cooperative', 'competitive'].includes((config as any).playMode)
     )
   }

   export const memoryQuizGame = defineGame<
     MemoryQuizConfig,
     MemoryQuizState,
     MemoryQuizMove
   >({
     manifest,
     Provider: MemoryQuizProvider,
     GameComponent,
     validator: memoryQuizValidator,
     defaultConfig,
     validateConfig: validateMemoryQuizConfig,
   })
   ```

3. Register game in `game-registry.ts`:
   ```typescript
   import { memoryQuizGame } from '@/arcade-games/memory-quiz'
   registerGame(memoryQuizGame)
   ```

4. Update `validators.ts` to import from new location:
   ```typescript
   import { memoryQuizValidator } from '@/arcade-games/memory-quiz/Validator'
   ```

5. Add type inference to `game-configs.ts`:
   ```typescript
   import type { memoryQuizGame } from '@/arcade-games/memory-quiz'
   export type MemoryQuizGameConfig = InferGameConfig<typeof memoryQuizGame>
   ```

**Verification**: Game definition compiles, validator registered

---

### Phase 3: Update Types (30 minutes)
**Goal**: Ensure types match Game SDK expectations

**Changes to `types.ts`**:
1. Rename `SorobanQuizState` → `MemoryQuizState`
2. Ensure `MemoryQuizState` extends `GameState` from SDK
3. Rename move types to match SDK patterns
4. Export proper config type

**Example**:
```typescript
import type { GameConfig, GameState, GameMove } from '@/lib/arcade/game-sdk'

export interface MemoryQuizConfig extends GameConfig {
  selectedCount: 2 | 5 | 8 | 12 | 15
  displayTime: number
  selectedDifficulty: DifficultyLevel
  playMode: 'cooperative' | 'competitive'
}

export interface MemoryQuizState extends GameState {
  // Core game data
  cards: QuizCard[]
  quizCards: QuizCard[]
  correctAnswers: number[]

  // Game progression
  currentCardIndex: number
  displayTime: number
  selectedCount: number
  selectedDifficulty: DifficultyLevel

  // Input system state
  foundNumbers: number[]
  guessesRemaining: number
  currentInput: string
  incorrectGuesses: number

  // Multiplayer state (from GameState)
  activePlayers: string[]
  playerMetadata: Record<string, PlayerMetadata>

  // Game-specific multiplayer
  playerScores: Record<string, PlayerScore>
  playMode: 'cooperative' | 'competitive'
  numberFoundBy: Record<number, string>

  // UI state
  gamePhase: 'setup' | 'display' | 'input' | 'results'
  prefixAcceptanceTimeout: NodeJS.Timeout | null
  finishButtonsBound: boolean
  wrongGuessAnimations: Array<{...}>

  // Keyboard state
  hasPhysicalKeyboard: boolean | null
  testingMode: boolean
  showOnScreenKeyboard: boolean
}

export type MemoryQuizMove =
  | { type: 'START_QUIZ'; playerId: string; userId: string; timestamp: number; data: {...} }
  | { type: 'NEXT_CARD'; playerId: string; userId: string; timestamp: number; data: {} }
  // ... (ensure all moves have playerId, userId, timestamp)
```

**Key Changes**:
- All moves must have `playerId`, `userId`, `timestamp` (SDK requirement)
- State should include `activePlayers` and `playerMetadata` (SDK standard)
- Use `TEAM_MOVE` for moves where specific player doesn't matter

**Verification**: Types compile, validator accepts move types

---

### Phase 4: Create Provider (2 hours)
**Goal**: Single provider for room mode (only mode supported)

**Key Pattern**:
```typescript
'use client'

import { useCallback, useMemo } from 'react'
import {
  useArcadeSession,
  useGameMode,
  useRoomData,
  useViewerId,
  useUpdateGameConfig,
  buildPlayerMetadata,
} from '@/lib/arcade/game-sdk'
import type { MemoryQuizState, MemoryQuizMove } from './types'

export function MemoryQuizProvider({ children }: { children: ReactNode }) {
  const { data: viewerId } = useViewerId()
  const { roomData } = useRoomData()
  const { activePlayers: activePlayerIds, players } = useGameMode()
  const { mutate: updateGameConfig } = useUpdateGameConfig()

  const activePlayers = Array.from(activePlayerIds)

  // Merge saved config from room
  const initialState = useMemo(() => {
    const gameConfig = roomData?.gameConfig?.['memory-quiz']
    return {
      // ... default state
      displayTime: gameConfig?.displayTime ?? 2.0,
      selectedCount: gameConfig?.selectedCount ?? 5,
      selectedDifficulty: gameConfig?.selectedDifficulty ?? 'easy',
      playMode: gameConfig?.playMode ?? 'cooperative',
      // ... rest of state
    }
  }, [roomData])

  const { state, sendMove, exitSession, lastError, clearError } =
    useArcadeSession<MemoryQuizState>({
      userId: viewerId || '',
      roomId: roomData?.id, // Always provided (room mode only)
      initialState,
      applyMove: (state) => state, // Server handles all updates
    })

  // Action creators
  const startQuiz = useCallback((quizCards: QuizCard[]) => {
    const numbers = quizCards.map(c => c.number)
    const playerMetadata = buildPlayerMetadata(activePlayers, {}, players, viewerId)

    sendMove({
      type: 'START_QUIZ',
      playerId: TEAM_MOVE,
      userId: viewerId || '',
      data: { numbers, quizCards, activePlayers, playerMetadata },
    })
  }, [viewerId, sendMove, activePlayers, players])

  // ... more action creators

  return (
    <MemoryQuizContext.Provider value={{
      state,
      startQuiz,
      // ... all other actions
      lastError,
      clearError,
      exitSession,
    }}>
      {children}
    </MemoryQuizContext.Provider>
  )
}
```

**Key Changes from Current RoomProvider**:
1. ✅ No reducer - server handles all state
2. ✅ Uses SDK hooks exclusively
3. ✅ Simpler action creators (server does the work)
4. ✅ Config persistence via `useUpdateGameConfig`
5. ✅ Always uses roomId (no conditional logic)

**Files to Delete**:
- ❌ `reducer.ts` (no longer needed)
- ❌ `LocalMemoryQuizProvider.tsx` (local mode deprecated)
- ❌ Client-side `applyMoveOptimistically()` (server authoritative)

**Verification**: Provider compiles, context works

---

### Phase 5: Update Components (1 hour)
**Goal**: Update components to use new provider API

**Changes Needed**:
1. **GameComponent.tsx** (new file):
   ```typescript
   'use client'

   import { useRouter } from 'next/navigation'
   import { PageWithNav } from '@/components/PageWithNav'
   import { useMemoryQuiz } from '../Provider'
   import { SetupPhase } from './SetupPhase'
   import { DisplayPhase } from './DisplayPhase'
   import { InputPhase } from './InputPhase'
   import { ResultsPhase } from './ResultsPhase'

   export function GameComponent() {
     const router = useRouter()
     const { state, exitSession } = useMemoryQuiz()

     return (
       <PageWithNav
         navTitle="Memory Lightning"
         navEmoji="🧠"
         emphasizePlayerSelection={state.gamePhase === 'setup'}
         onExitSession={() => {
           exitSession()
           router.push('/arcade')
         }}
       >
         <style dangerouslySetInnerHTML={{ __html: globalAnimations }} />

         {state.gamePhase === 'setup' && <SetupPhase />}
         {state.gamePhase === 'display' && <DisplayPhase />}
         {state.gamePhase === 'input' && <InputPhase key="input-phase" />}
         {state.gamePhase === 'results' && <ResultsPhase />}
       </PageWithNav>
     )
   }
   ```

2. **SetupPhase.tsx**: Update to use action creators instead of dispatch
   ```diff
   - dispatch({ type: 'SET_DIFFICULTY', difficulty: value })
   + setConfig('selectedDifficulty', value)
   ```

3. **DisplayPhase.tsx**: Update to use `nextCard` action
   ```diff
   - dispatch({ type: 'NEXT_CARD' })
   + nextCard()
   ```

4. **InputPhase.tsx**: Update to use `acceptNumber`, `rejectNumber` actions
   ```diff
   - dispatch({ type: 'ACCEPT_NUMBER', number })
   + acceptNumber(number)
   ```

5. **ResultsPhase.tsx**: Update to use `resetGame`, `showResults` actions
   ```diff
   - dispatch({ type: 'RESET_QUIZ' })
   + resetGame()
   ```

**Minimal Changes**:
- Components mostly stay the same
- Replace `dispatch()` calls with action creators
- No other UI changes needed

**Verification**: All phases render, actions work

---

### Phase 6: Update Page Route (15 minutes)
**Goal**: Update page to use new game definition

**New `/app/arcade/memory-quiz/page.tsx`**:
```typescript
'use client'

import { memoryQuizGame } from '@/arcade-games/memory-quiz'

const { Provider, GameComponent } = memoryQuizGame

export default function MemoryQuizPage() {
  return (
    <Provider>
      <GameComponent />
    </Provider>
  )
}
```

**That's it!** The game now uses the modular system.

**Verification**: Game loads and plays end-to-end

---

### Phase 7: Testing (30 minutes)
**Goal**: Verify all functionality works

**Test Cases**:
1. **Solo Play** (single player in room):
   - [ ] Setup phase renders
   - [ ] Can change all settings (count, difficulty, display time, play mode)
   - [ ] Can start quiz
   - [ ] Cards display with timing
   - [ ] Input phase works
   - [ ] Can type and submit answers
   - [ ] Correct/incorrect feedback works
   - [ ] Results phase shows scores
   - [ ] Can play again
   - [ ] Settings persist across page reloads

2. **Multiplayer** (multiple players):
   - [ ] Settings persist across page reloads
   - [ ] All players see same cards
   - [ ] Timing synchronized (room creator controls)
   - [ ] Input from any player works
   - [ ] Scores track correctly per player
   - [ ] Cooperative mode: team score works
   - [ ] Competitive mode: individual scores work
   - [ ] Results show all player scores

3. **Edge Cases**:
   - [ ] Switching games preserves settings
   - [ ] Leaving mid-game doesn't crash
   - [ ] Keyboard detection works
   - [ ] On-screen keyboard toggle works
   - [ ] Wrong guess animations work
   - [ ] Timeout handling works

**Verification**: All tests pass

---

## Breaking Changes

### For Users
- ✅ **None** - Game should work identically

### For Developers
- ❌ Can't use `dispatch()` anymore (use action creators)
- ❌ Can't access reducer (server-driven state only)
- ❌ No local mode support (room mode only)

---

## Rollback Plan

If migration fails:
1. Revert page to use old providers
2. Keep old files in place
3. Remove new `/arcade-games/memory-quiz/` directory
4. Unregister from game registry

**Time to rollback**: 5 minutes

---

## Post-Migration Tasks

1. ✅ Delete old files:
   - `/app/arcade/memory-quiz/reducer.ts` (no longer needed)
   - `/app/arcade/memory-quiz/context/LocalMemoryQuizProvider.tsx` (local mode deprecated)
   - `/app/arcade/memory-quiz/page.tsx` (old local mode page, replaced by arcade page)
   - `/lib/arcade/validation/MemoryQuizGameValidator.ts` (moved to new location)

2. ✅ Update imports across codebase

3. ✅ Add to `ARCHITECTURAL_IMPROVEMENTS.md`:
   - Memory Quiz migrated successfully
   - Now 3 games on modular platform

4. ✅ Run full test suite

---

## Complexity Analysis

### What Makes This Easier
- ✅ Validator already exists and works
- ✅ Already uses `useArcadeSession`
- ✅ Move types mostly match SDK requirements
- ✅ Well-tested, stable game

### What Makes This Harder
- ❌ Complex UI state (keyboard detection, animations)
- ❌ Two-phase gameplay (display, then input)
- ❌ Timing synchronization requirements
- ❌ Local input optimization (doesn't sync every keystroke)

### Estimated Time
- **Fast path** (no issues): 3-4 hours
- **Normal path** (minor fixes): 4-6 hours
- **Slow path** (major issues): 6-8 hours

---

## Success Criteria

1. ✅ Game registered in game registry
2. ✅ Config types inferred from game definition
3. ✅ Single provider for local and room modes
4. ✅ All phases work in both modes
5. ✅ Settings persist in room mode
6. ✅ Multiplayer synchronization works
7. ✅ No TypeScript errors
8. ✅ No lint errors
9. ✅ Pre-commit checks pass
10. ✅ Manual testing confirms all features work

---

## Notes

### UI State Challenges
Memory Quiz has significant UI-only state:
- `wrongGuessAnimations` - visual feedback
- `hasPhysicalKeyboard` - device detection
- `showOnScreenKeyboard` - toggle state
- `prefixAcceptanceTimeout` - timeout handling

**Solution**: These can remain client-only (not synced). They don't affect game logic.

### Input Optimization
Current implementation doesn't sync `currentInput` over network (only final submission).

**Solution**: Keep this pattern. Use local state for input, only sync `ACCEPT_NUMBER`/`REJECT_NUMBER`.

### Timing Synchronization
Room creator controls card timing (NEXT_CARD moves).

**Solution**: Check `isRoomCreator` flag, only creator can advance cards.

---

## References

- Game SDK Documentation: `/src/arcade-games/README.md`
- Example Migration: Number Guesser, Math Sprint
- Architecture Docs: `/docs/ARCHITECTURAL_IMPROVEMENTS.md`
- Validator Registry: `/src/lib/arcade/validators.ts`
- Game Registry: `/src/lib/arcade/game-registry.ts`
