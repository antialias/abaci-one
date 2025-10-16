# Architecture Quality Audit #2

**Date**: 2025-10-16
**Context**: After implementing Number Guesser (turn-based) and starting Math Sprint (free-for-all)
**Goal**: Assess if the system is truly modular or if there's too much boilerplate

---

## Executive Summary

**Status**: ⚠️ **Good Foundation, But Boilerplate Issues**

The unified validator registry successfully solved the dual registration problem. However, implementing a second game revealed **significant boilerplate** and **database schema coupling** that violate the modular architecture goals.

**Grade**: **B-** (Down from B+ after implementation testing)

---

## Issues Found

### 🚨 Issue #1: Database Schema Coupling (CRITICAL)

**Problem**: The `room_game_configs` table schema hard-codes game names, preventing true modularity.

**Evidence**:
```typescript
// db/schema/room-game-configs.ts
gameName: text('game_name').$type<'matching' | 'memory-quiz' | 'number-guesser' | 'complement-race'>()
```

When adding 'math-sprint':
```
Type '"math-sprint"' is not assignable to type '"matching" | "memory-quiz" | "number-guesser" | "complement-race"'
```

**Impact**:
- ❌ Must manually update database schema for every new game
- ❌ TypeScript errors force schema migration
- ❌ Breaks "just register and go" promise
- ❌ Requires database migration for each game

**Root Cause**: The schema uses a union type instead of a string with runtime validation.

**Fix Required**: Change schema to accept any string, validate against registry at runtime.

---

### ⚠️ Issue #2: game-config-helpers.ts Boilerplate

**Problem**: Three switch statements must be updated for every new game:

1. `getDefaultGameConfig()` - add case
2. Import default config constant
3. `validateGameConfig()` - add validation logic

**Example** (from Math Sprint):
```typescript
// Must add to imports
import { DEFAULT_MATH_SPRINT_CONFIG } from './game-configs'

// Must add case to switch #1
case 'math-sprint':
  return DEFAULT_MATH_SPRINT_CONFIG

// Must add case to switch #2
case 'math-sprint':
  return (
    typeof config === 'object' &&
    config !== null &&
    ['easy', 'medium', 'hard'].includes(config.difficulty) &&
    // ... 10+ lines of validation
  )
```

**Impact**:
- ⏱️ 5-10 minutes of boilerplate per game
- 🐛 Easy to forget a switch case
- 📝 Repetitive validation logic

**Better Approach**: Config defaults and validation should be part of the game definition.

---

### ⚠️ Issue #3: game-configs.ts Boilerplate

**Problem**: Must update 4 places in game-configs.ts:

1. Import types from game
2. Define `XGameConfig` interface
3. Add to `GameConfigByName` union
4. Add to `RoomGameConfig` interface
5. Create `DEFAULT_X_CONFIG` constant

**Example** (from Math Sprint):
```typescript
// 1. Import
import type { Difficulty as MathSprintDifficulty } from '@/arcade-games/math-sprint/types'

// 2. Interface
export interface MathSprintGameConfig {
  difficulty: MathSprintDifficulty
  questionsPerRound: number
  timePerQuestion: number
}

// 3. Add to union
export type GameConfigByName = {
  'math-sprint': MathSprintGameConfig
  // ...
}

// 4. Add to RoomGameConfig
export interface RoomGameConfig {
  'math-sprint'?: MathSprintGameConfig
  // ...
}

// 5. Default constant
export const DEFAULT_MATH_SPRINT_CONFIG: MathSprintGameConfig = {
  difficulty: 'medium',
  questionsPerRound: 10,
  timePerQuestion: 30,
}
```

**Impact**:
- ⏱️ 10-15 lines of boilerplate per game
- 🐛 Easy to forget one of the 5 updates
- 🔄 Repeating type information (already in game definition)

**Better Approach**: Game config types should be inferred from game definitions.

---

### 📊 Issue #4: High Boilerplate Ratio

**Files Required Per Game**:

| Category | Files | Purpose |
|----------|-------|---------|
| **Game Code** | 7 files | types.ts, Validator.ts, Provider.tsx, index.ts, 3x components |
| **Registration** | 2 files | validators.ts, game-registry.ts |
| **Config** | 2 files | game-configs.ts, game-config-helpers.ts |
| **Database** | 1 file | schema migration |
| **Total** | **12 files** | For one game! |

**Lines of Boilerplate** (non-game-logic):
- game-configs.ts: ~15 lines
- game-config-helpers.ts: ~25 lines
- validators.ts: ~2 lines
- game-registry.ts: ~2 lines
- **Total: ~44 lines of pure boilerplate per game**

**Comparison**:
- Number Guesser: ~500 lines of actual game logic
- Boilerplate: ~44 lines (8.8% overhead) ✅ Acceptable
- But spread across 4 different files ⚠️ Developer friction

---

## Positive Aspects

### ✅ What Works Well

1. **SDK Abstraction**
   - `useArcadeSession` is clean and reusable
   - `buildPlayerMetadata` helper reduces duplication
   - Hook-based API is intuitive

2. **Provider Pattern**
   - Consistent across games
   - Clear separation of concerns
   - Easy to understand

3. **Component Structure**
   - SetupPhase, PlayingPhase, ResultsPhase pattern is clear
   - GameComponent wrapper is simple
   - PageWithNav integration is seamless

4. **Unified Validator Registry**
   - Single source of truth for validators ✅
   - Auto-derived GameName type ✅
   - Type-safe validator access ✅

5. **Error Feedback**
   - lastError/clearError pattern works well
   - Auto-dismiss UX is good
   - Consistent error handling

---

## Comparison: Number Guesser vs. Math Sprint

### Similarities (Good!)
- ✅ Same file structure
- ✅ Same SDK usage patterns
- ✅ Same Provider pattern
- ✅ Same component phases

### Differences (Revealing!)
- Math Sprint uses TEAM_MOVE (no turn owner)
- Math Sprint has server-generated questions
- Database schema didn't support Math Sprint name

**Key Insight**: The SDK handles different game types well (turn-based vs. free-for-all), but infrastructure (database, config system) is rigid.

---

## Developer Experience Score

### Time to Add a Game

| Task | Time | Notes |
|------|------|-------|
| Write game logic | 2-4 hours | Validator, state management, components |
| Registration boilerplate | 15-20 min | 4 files to update |
| Database migration | 10-15 min | Schema update, migration file |
| Debugging type errors | 10-30 min | Database schema mismatches |
| **Total** | **3-5 hours** | For a simple game |

### Pain Points

1. **Database Schema** ⚠️ Critical blocker
   - Must update schema for each game
   - Requires migration
   - TypeScript errors are confusing

2. **Config System** ⚠️ Medium friction
   - 5 places to update in game-configs.ts
   - Easy to miss one
   - Repetitive type definitions

3. **Helper Functions** ⚠️ Low friction
   - Switch statements in game-config-helpers.ts
   - Not hard, just tedious

### What Developers Like

1. ✅ SDK is intuitive
2. ✅ Pattern is consistent
3. ✅ Error messages are clear (once you know where to look)
4. ✅ Documentation is comprehensive

---

## Architectural Recommendations

### Critical (Before Adding More Games)

**1. Fix Database Schema Coupling**

**Current**:
```typescript
gameName: text('game_name').$type<'matching' | 'memory-quiz' | 'number-guesser' | 'complement-race'>()
```

**Recommended**:
```typescript
// Accept any string, validate at runtime
gameName: text('game_name').$type<string>().notNull()

// Runtime validation in helper functions
export function validateGameName(gameName: string): gameName is GameName {
  return hasValidator(gameName)
}
```

**Benefits**:
- ✅ No schema migration per game
- ✅ Works with auto-derived GameName
- ✅ Runtime validation is sufficient

---

**2. Infer Config Types from Game Definitions**

**Current** (manual):
```typescript
// In game-configs.ts
export interface MathSprintGameConfig { ... }
export const DEFAULT_MATH_SPRINT_CONFIG = { ... }

// In game definition
const defaultConfig: MathSprintGameConfig = { ... }
```

**Recommended**:
```typescript
// In game definition (single source of truth)
export const mathSprintGame = defineGame({
  defaultConfig: {
    difficulty: 'medium',
    questionsPerRound: 10,
    timePerQuestion: 30,
  },
  validator: mathSprintValidator,
  // ...
})

// Auto-infer types
type MathSprintConfig = typeof mathSprintGame.defaultConfig
```

**Benefits**:
- ✅ No duplication
- ✅ Single source of truth
- ✅ Type inference handles it

---

**3. Move Config Validation to Game Definition**

**Current** (switch statement in helper):
```typescript
function validateGameConfig(gameName: GameName, config: any): boolean {
  switch (gameName) {
    case 'math-sprint':
      return /* 15 lines of validation */
  }
}
```

**Recommended**:
```typescript
// In game definition
export const mathSprintGame = defineGame({
  defaultConfig: { ... },
  validateConfig: (config: any): config is MathSprintConfig => {
    return /* validation logic */
  },
  // ...
})

// In helper (generic)
export function validateGameConfig(gameName: GameName, config: any): boolean {
  const game = getGame(gameName)
  return game?.validateConfig?.(config) ?? true
}
```

**Benefits**:
- ✅ No switch statement
- ✅ Validation lives with game
- ✅ One place to update

---

### Medium Priority

**4. Create CLI Tool for Game Generation**

```bash
npm run create-game math-sprint "Math Sprint" "🧮"
```

Generates:
- File structure
- Boilerplate code
- Registration entries
- Types

**Benefits**:
- ✅ Eliminates manual boilerplate
- ✅ Consistent structure
- ✅ Reduces errors

---

**5. Add Runtime Registry Validation**

On app start, verify:
- ✅ All games in registry have validators
- ✅ All validators have games
- ✅ No orphaned configs
- ✅ All game names are unique

```typescript
function validateRegistries() {
  const games = getAllGames()
  const validators = getRegisteredGameNames()

  for (const game of games) {
    if (!validators.includes(game.manifest.name)) {
      throw new Error(`Game ${game.manifest.name} has no validator!`)
    }
  }
}
```

---

## Updated Compliance Table

| Intention | Status | Notes |
|-----------|--------|-------|
| Modularity | ⚠️ Partial | Validators unified, but database/config not modular |
| Self-registration | ✅ Pass | Two registration points (validator + game), both clear |
| Type safety | ⚠️ Partial | Types work, but database schema breaks for new games |
| No core changes | ⚠️ Partial | Must update 4 files + database schema |
| Drop-in games | ❌ Fail | Database migration required |
| Stable SDK API | ✅ Pass | SDK is excellent |
| Clear patterns | ✅ Pass | Patterns are consistent |
| Low boilerplate | ⚠️ Partial | SDK usage is clean, registration is verbose |

**Overall Grade**: **B-** (Was B+, downgraded after implementation testing)

---

## Summary

### What We Learned

✅ **The Good**:
- SDK design is solid
- Unified validator registry works
- Pattern is consistent and learnable
- Number Guesser proves the concept

⚠️ **The Not-So-Good**:
- Database schema couples to game names (critical blocker)
- Config system has too much boilerplate
- 12 files touched per game is high

❌ **The Bad**:
- Can't truly "drop in" a game without schema migration
- Config types are duplicated
- Helper switch statements are tedious

### Verdict

The system **works** and is **usable**, but falls short of "modular architecture" goals due to:
1. Database schema hard-coding
2. Config system boilerplate
3. Required schema migrations

**Recommendation**:
1. **Option A (Quick Fix)**: Document the 12-file checklist, live with boilerplate for now
2. **Option B (Proper Fix)**: Implement Critical recommendations 1-3 before adding Math Sprint

**My Recommendation**: Option A for now (get Math Sprint working), then Option B as a refactoring sprint.

---

## Next Steps

1. ✅ Document "Adding a Game" checklist (12 files)
2. 🔴 Fix database schema to accept any game name
3. 🟡 Test Math Sprint with current architecture
4. 🟡 Evaluate if boilerplate is acceptable in practice
5. 🟢 Consider config system refactoring for later

