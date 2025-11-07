# Matching Pairs Battle - Migration to Modular Game System

**Status**: Planning Phase
**Target Version**: v4.2.0
**Created**: 2025-01-16
**Game Name**: `matching`

---

## Executive Summary

This document outlines the migration plan for **Matching Pairs Battle** (aka Memory Pairs Challenge) from the legacy dual-location architecture to the modern modular game system using the Game SDK.

**Key Complexity Factors**:

- **Dual Location**: Game exists in BOTH `/src/app/arcade/matching/` AND `/src/app/games/matching/`
- **Partial Migration**: RoomMemoryPairsProvider already uses `useArcadeSession` but not in modular format
- **Turn-Based Multiplayer**: More complex than memory-quiz (requires turn validation, player ownership)
- **Rich UI State**: Hover state, animations, mismatch feedback, pause/resume
- **Existing Tests**: Has playerMetadata test that must continue to pass

---

## Current File Structure Analysis

### Location 1: `/src/app/arcade/matching/`

**Components** (4 files):

- `components/GameCard.tsx`
- `components/PlayerStatusBar.tsx`
- `components/ResultsPhase.tsx`
- `components/SetupPhase.tsx`
- `components/EmojiPicker.tsx`
- `components/GamePhase.tsx`
- `components/MemoryPairsGame.tsx`
- `components/__tests__/EmojiPicker.test.tsx`

**Context** (4 files):

- `context/MemoryPairsContext.tsx` - Context definition and hook
- `context/LocalMemoryPairsProvider.tsx` - Local mode provider (DEPRECATED)
- `context/RoomMemoryPairsProvider.tsx` - Room mode provider (PARTIALLY MIGRATED)
- `context/types.ts` - Type definitions
- `context/index.ts` - Re-exports
- `context/__tests__/playerMetadata-userId.test.ts` - Test for player ownership

**Utils** (3 files):

- `utils/cardGeneration.ts` - Card generation logic
- `utils/gameScoring.ts` - Scoring calculations
- `utils/matchValidation.ts` - Match validation logic

**Page**:

- `page.tsx` - Route handler for `/arcade/matching`

### Location 2: `/src/app/games/matching/`

**Components** (6 files - DUPLICATES):

- `components/GameCard.tsx`
- `components/PlayerStatusBar.tsx`
- `components/ResultsPhase.tsx`
- `components/SetupPhase.tsx`
- `components/EmojiPicker.tsx`
- `components/GamePhase.tsx`
- `components/MemoryPairsGame.tsx`
- `components/__tests__/EmojiPicker.test.tsx`
- `components/PlayerStatusBar.stories.tsx` - Storybook story

**Context** (2 files):

- `context/MemoryPairsContext.tsx`
- `context/types.ts`

**Utils** (3 files - DUPLICATES):

- `utils/cardGeneration.ts`
- `utils/gameScoring.ts`
- `utils/matchValidation.ts`

**Page**:

- `page.tsx` - Route handler for `/games/matching` (legacy?)

### Shared Components

- `/src/components/matching/HoverAvatar.tsx` - Networked presence component
- `/src/components/matching/MemoryGrid.tsx` - Grid layout component

### Validator

- `/src/lib/arcade/validation/MatchingGameValidator.ts` - ✅ Already exists and comprehensive (570 lines)

### Configuration

- Already in `GAMES_CONFIG` as `'battle-arena'` (maps to internal name `'matching'`)
- Config type: `MatchingGameConfig` in `/src/lib/arcade/game-configs.ts`

---

## Migration Complexity Assessment

### Complexity: **HIGH** (8/10)

**Reasons**:

1. **Dual Locations**: Must consolidate two separate implementations
2. **Partial Migration**: RoomMemoryPairsProvider uses useArcadeSession but not in modular format
3. **Turn-Based Logic**: Player ownership validation, turn switching
4. **Rich State**: Hover state, animations, pause/resume, mismatch feedback
5. **Large Validator**: 570 lines (vs 350 for memory-quiz)
6. **More Components**: 7 components + 2 shared (vs 7 for memory-quiz)
7. **Tests**: Must maintain playerMetadata test coverage

**Similar To**: Memory Quiz migration (same pattern)

**Unique Challenges**:

- Consolidating duplicate files from two locations
- Deciding which version of duplicates is canonical
- Handling `/games/matching/` route (deprecate or redirect?)
- More complex multiplayer state (turn order, player ownership)

---

## Recommended Migration Approach

### Phase 1: Pre-Migration Audit ✅

**Goal**: Understand current state and identify discrepancies

**Tasks**:

- [x] Map all files in both locations
- [ ] Compare duplicate files to identify differences (e.g., `diff /src/app/arcade/matching/components/GameCard.tsx /src/app/games/matching/components/GameCard.tsx`)
- [ ] Identify which location is canonical (likely `/src/app/arcade/matching/` based on RoomProvider)
- [ ] Verify validator completeness (already done - looks comprehensive)
- [ ] Check for references to `/games/matching/` route

**Deliverables**:

- File comparison report
- Decision: Which duplicate files to keep
- List of files to delete

---

### Phase 2: Create Modular Game Definition

**Goal**: Define game in registry following SDK pattern

**Tasks**:

1. Create `/src/arcade-games/matching/index.ts` with `defineGame()`
2. Register in `/src/lib/arcade/game-registry.ts`
3. Update `/src/lib/arcade/validators.ts` to import from new location
4. Add type inference to `/src/lib/arcade/game-configs.ts`

**Template**:

```typescript
// /src/arcade-games/matching/index.ts
import type { GameManifest, GameConfig } from "@/lib/arcade/game-sdk/types";
import { defineGame } from "@/lib/arcade/game-sdk";
import { MatchingProvider } from "./Provider";
import { MemoryPairsGame } from "./components/MemoryPairsGame";
import { matchingGameValidator } from "./Validator";
import { validateMatchingConfig } from "./config-validation";
import type { MatchingConfig, MatchingState, MatchingMove } from "./types";

const manifest: GameManifest = {
  name: "matching",
  displayName: "Matching Pairs Battle",
  icon: "⚔️",
  description: "Multiplayer memory battle with friends",
  longDescription:
    "Battle friends in epic memory challenges. Match pairs faster than your opponents in this exciting multiplayer experience.",
  maxPlayers: 4,
  difficulty: "Intermediate",
  chips: ["👥 Multiplayer", "🎯 Strategic", "🏆 Competitive"],
  color: "purple",
  gradient: "linear-gradient(135deg, #e9d5ff, #ddd6fe)",
  borderColor: "purple.200",
  available: true,
};

const defaultConfig: MatchingConfig = {
  gameType: "abacus-numeral",
  difficulty: 6,
  turnTimer: 30,
};

export const matchingGame = defineGame<
  MatchingConfig,
  MatchingState,
  MatchingMove
>({
  manifest,
  Provider: MatchingProvider,
  GameComponent: MemoryPairsGame,
  validator: matchingGameValidator,
  defaultConfig,
  validateConfig: validateMatchingConfig,
});
```

**Files Modified**:

- `/src/arcade-games/matching/index.ts` (new)
- `/src/lib/arcade/game-registry.ts` (add import + register)
- `/src/lib/arcade/validators.ts` (update import path)
- `/src/lib/arcade/game-configs.ts` (add type inference)

---

### Phase 3: Move and Update Validator

**Goal**: Move validator to modular game directory

**Tasks**:

1. Move `/src/lib/arcade/validation/MatchingGameValidator.ts` → `/src/arcade-games/matching/Validator.ts`
2. Update imports to use local types from `./types` instead of importing from game-configs (avoid circular deps)
3. Verify all move types are handled
4. Check `getInitialState()` accepts all config fields

**Note**: Validator looks comprehensive already - likely minimal changes needed

**Files Modified**:

- `/src/arcade-games/matching/Validator.ts` (moved)
- Update imports in validator

---

### Phase 4: Consolidate and Move Types

**Goal**: Create SDK-compatible type definitions in modular location

**Tasks**:

1. Compare types from both locations:
   - `/src/app/arcade/matching/context/types.ts`
   - `/src/app/games/matching/context/types.ts`
2. Create `/src/arcade-games/matching/types.ts` with:
   - `MatchingConfig extends GameConfig`
   - `MatchingState` (from MemoryPairsState)
   - `MatchingMove` union type (7 move types: FLIP_CARD, START_GAME, CLEAR_MISMATCH, GO_TO_SETUP, SET_CONFIG, RESUME_GAME, HOVER_CARD)
3. Ensure compatibility with validator expectations
4. Fix any `{}` → `Record<string, never>` warnings

**Move Types**:

```typescript
export interface MatchingConfig extends GameConfig {
  gameType: "abacus-numeral" | "complement-pairs";
  difficulty: 6 | 8 | 12 | 15;
  turnTimer: number;
}

export interface MatchingState {
  // Core game data
  cards: GameCard[];
  gameCards: GameCard[];
  flippedCards: GameCard[];

  // Config
  gameType: "abacus-numeral" | "complement-pairs";
  difficulty: 6 | 8 | 12 | 15;
  turnTimer: number;

  // Progression
  gamePhase: "setup" | "playing" | "results";
  currentPlayer: string;
  matchedPairs: number;
  totalPairs: number;
  moves: number;
  scores: Record<string, number>;
  activePlayers: string[];
  playerMetadata: Record<string, PlayerMetadata>;
  consecutiveMatches: Record<string, number>;

  // Timing
  gameStartTime: number | null;
  gameEndTime: number | null;
  currentMoveStartTime: number | null;
  timerInterval: NodeJS.Timeout | null;

  // UI state
  celebrationAnimations: CelebrationAnimation[];
  isProcessingMove: boolean;
  showMismatchFeedback: boolean;
  lastMatchedPair: [string, string] | null;

  // Pause/Resume
  originalConfig?: {
    gameType: "abacus-numeral" | "complement-pairs";
    difficulty: 6 | 8 | 12 | 15;
    turnTimer: number;
  };
  pausedGamePhase?: "setup" | "playing" | "results";
  pausedGameState?: PausedGameState;

  // Hover state
  playerHovers: Record<string, string | null>;
}

export type MatchingMove =
  | {
      type: "FLIP_CARD";
      playerId: string;
      userId: string;
      data: { cardId: string };
    }
  | {
      type: "START_GAME";
      playerId: string;
      userId: string;
      data: {
        cards: GameCard[];
        activePlayers: string[];
        playerMetadata: Record<string, PlayerMetadata>;
      };
    }
  | {
      type: "CLEAR_MISMATCH";
      playerId: string;
      userId: string;
      data: Record<string, never>;
    }
  | {
      type: "GO_TO_SETUP";
      playerId: string;
      userId: string;
      data: Record<string, never>;
    }
  | {
      type: "SET_CONFIG";
      playerId: string;
      userId: string;
      data: { field: "gameType" | "difficulty" | "turnTimer"; value: any };
    }
  | {
      type: "RESUME_GAME";
      playerId: string;
      userId: string;
      data: Record<string, never>;
    }
  | {
      type: "HOVER_CARD";
      playerId: string;
      userId: string;
      data: { cardId: string | null };
    };
```

**Files Created**:

- `/src/arcade-games/matching/types.ts`

---

### Phase 5: Create Unified Provider

**Goal**: Convert RoomMemoryPairsProvider to modular Provider using SDK

**Tasks**:

1. Copy RoomMemoryPairsProvider as starting point (already uses useArcadeSession)
2. Create `/src/arcade-games/matching/Provider.tsx`
3. Remove dependency on MemoryPairsContext (will export its own hook)
4. Update imports to use local types
5. Ensure all action creators are present:
   - `startGame`
   - `flipCard`
   - `resetGame`
   - `setGameType`
   - `setDifficulty`
   - `setTurnTimer`
   - `goToSetup`
   - `resumeGame`
   - `hoverCard`
6. Verify config persistence (nested under `gameConfig.matching`)
7. Export `useMatching` hook

**Key Changes**:

- Import types from `./types` not from context
- Export hook: `export function useMatching() { return useContext(MatchingContext) }`
- Ensure hooks called before early returns (React rules)

**Files Created**:

- `/src/arcade-games/matching/Provider.tsx`

---

### Phase 6: Consolidate and Move Components

**Goal**: Move components to modular location, choosing canonical versions

**Decision Process** (for each component):

1. If files are identical → pick either (prefer `/src/app/arcade/matching/`)
2. If files differ → manually merge, keeping best of both
3. Update imports to use new Provider: `from '@/arcade-games/matching/Provider'`
4. Fix styled-system import paths (4 levels: `../../../../styled-system/css`)

**Components to Move**:

- GameCard.tsx
- PlayerStatusBar.tsx
- ResultsPhase.tsx
- SetupPhase.tsx
- EmojiPicker.tsx
- GamePhase.tsx
- MemoryPairsGame.tsx

**Shared Components** (leave in place):

- `/src/components/matching/HoverAvatar.tsx`
- `/src/components/matching/MemoryGrid.tsx`

**Tests**:

- Move test to `/src/arcade-games/matching/components/__tests__/EmojiPicker.test.tsx`

**Files Created**:

- `/src/arcade-games/matching/components/*.tsx` (7 files)
- `/src/arcade-games/matching/components/__tests__/EmojiPicker.test.tsx`

---

### Phase 7: Move Utility Functions

**Goal**: Consolidate utils in modular location

**Tasks**:

1. Compare utils from both locations (likely identical)
2. Move to `/src/arcade-games/matching/utils/`
   - `cardGeneration.ts`
   - `gameScoring.ts`
   - `matchValidation.ts`
3. Update imports in components and validator

**Files Created**:

- `/src/arcade-games/matching/utils/*.ts` (3 files)

---

### Phase 8: Update Routes and Clean Up

**Goal**: Update page routes and delete legacy files

**Tasks**:

**Route Updates**:

1. `/src/app/arcade/matching/page.tsx` - Replace with redirect to `/arcade` (local mode deprecated)
2. `/src/app/games/matching/page.tsx` - Replace with redirect to `/arcade` (legacy route)
3. Remove from `GAMES_CONFIG` in `/src/components/GameSelector.tsx`
4. Remove from `GAME_TYPE_TO_NAME` in `/src/app/arcade/room/page.tsx`
5. Update `/src/lib/arcade/validation/types.ts` imports (if referencing old types)

**Delete Legacy Files** (~30 files):

- `/src/app/arcade/matching/components/` (7 files + 1 test)
- `/src/app/arcade/matching/context/` (5 files + 1 test)
- `/src/app/arcade/matching/utils/` (3 files)
- `/src/app/games/matching/components/` (7 files + 1 test + 1 story)
- `/src/app/games/matching/context/` (2 files)
- `/src/app/games/matching/utils/` (3 files)
- `/src/lib/arcade/validation/MatchingGameValidator.ts` (moved)

**Files Modified**:

- `/src/app/arcade/matching/page.tsx` (redirect)
- `/src/app/games/matching/page.tsx` (redirect)
- `/src/components/GameSelector.tsx` (remove from GAMES_CONFIG)
- `/src/app/arcade/room/page.tsx` (remove from GAME_TYPE_TO_NAME)

---

## Testing Checklist

After migration, verify:

- [ ] Type checking passes (`npm run type-check`)
- [ ] Format/lint passes (`npm run pre-commit`)
- [ ] EmojiPicker test passes
- [ ] PlayerMetadata test passes
- [ ] Game loads in room mode
- [ ] Game selector shows one "Matching Pairs Battle" button
- [ ] Settings persist when changed in setup
- [ ] Turn-based gameplay works (only current player can flip)
- [ ] Card matching works (both abacus-numeral and complement-pairs)
- [ ] Pause/Resume works
- [ ] Hover state shows for other players
- [ ] Mismatch feedback displays correctly
- [ ] Results phase calculates scores correctly

---

## Migration Steps Summary

**8 Phases**:

1. ✅ Pre-Migration Audit - Compare duplicate files
2. ⏳ Create Modular Game Definition - Registry + types
3. ⏳ Move and Update Validator - Move to new location
4. ⏳ Consolidate and Move Types - SDK-compatible types
5. ⏳ Create Unified Provider - Room-only provider
6. ⏳ Consolidate and Move Components - Choose canonical versions
7. ⏳ Move Utility Functions - Consolidate utils
8. ⏳ Update Routes and Clean Up - Delete legacy files

**Estimated Effort**: 4-6 hours (larger than memory-quiz due to dual locations and more complexity)

---

## Key Differences from Memory Quiz Migration

1. **Dual Locations**: Must consolidate two separate implementations
2. **More Complex**: Turn-based multiplayer vs cooperative team play
3. **Partial Migration**: RoomProvider already uses useArcadeSession
4. **More Components**: 7 game components + 2 shared
5. **Existing Tests**: Must maintain test coverage
6. **Two Routes**: Both `/arcade/matching` and `/games/matching` exist

---

## Risks and Mitigation

### Risk 1: File Divergence

**Risk**: Duplicate files may have different features/fixes
**Mitigation**: Manually diff each duplicate pair, merge best of both

### Risk 2: Test Breakage

**Risk**: PlayerMetadata test may break during migration
**Mitigation**: Run tests frequently, update test if needed

### Risk 3: Turn Logic Complexity

**Risk**: Player ownership and turn validation is complex
**Mitigation**: Validator already handles this - trust existing logic

### Risk 4: Unknown Dependencies

**Risk**: Other parts of codebase may depend on `/games/matching/`
**Mitigation**: Search for imports before deletion: `grep -r "from.*games/matching" src/`

---

## Post-Migration Verification

After completing all phases:

1. Run full test suite
2. Manual testing:
   - Create room
   - Select "Matching Pairs Battle"
   - Configure settings (verify persistence)
   - Start game with multiple players
   - Play several turns (verify turn order)
   - Pause and resume
   - Complete game (verify results)
3. Verify no duplicate game buttons
4. Check browser console for errors
5. Verify settings load correctly on page refresh

---

## References

- Memory Quiz Migration Plan: `docs/MEMORY_QUIZ_MIGRATION_PLAN.md`
- Game Migration Playbook: `docs/GAME_MIGRATION_PLAYBOOK.md`
- Game SDK Documentation: `.claude/GAME_SDK_DOCUMENTATION.md`
- Settings Persistence: `.claude/GAME_SETTINGS_PERSISTENCE.md`
