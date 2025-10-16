# Arcade Game Architecture

> **Design Philosophy**: Modular, type-safe, multiplayer-first game development with real-time synchronization

---

## Table of Contents

- [Design Goals](#design-goals)
- [Architecture Overview](#architecture-overview)
- [Core Concepts](#core-concepts)
- [Implementation Details](#implementation-details)
- [Design Decisions](#design-decisions)
- [Lessons Learned](#lessons-learned)
- [Future Improvements](#future-improvements)

---

## Design Goals

### Primary Goals

1. **Modularity**
   - Each game is a self-contained module
   - Games can be added/removed without affecting the core system
   - No tight coupling between games and infrastructure

2. **Type Safety**
   - Full TypeScript support throughout the stack
   - Compile-time validation of game definitions
   - Type-safe move validation and state management

3. **Multiplayer-First**
   - Real-time state synchronization via WebSocket
   - Optimistic updates for instant feedback
   - Server-authoritative validation to prevent cheating

4. **Developer Experience**
   - Simple, intuitive API for game creators
   - Minimal boilerplate
   - Clear separation of concerns
   - Comprehensive error messages

5. **Consistency**
   - Shared navigation and UI components
   - Standardized player management
   - Common error handling patterns
   - Unified room/lobby experience

### Non-Goals

- Supporting non-multiplayer games (use existing game routes for that)
- Backwards compatibility with old game implementations
- Supporting games outside the monorepo

---

## Architecture Overview

### System Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                         │
│  - GameSelector (game discovery)                            │
│  - Room management                                          │
│  - Player management                                        │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   Registry Layer                             │
│  - Game registration                                        │
│  - Game discovery (getGame, getAllGames)                    │
│  - Manifest validation                                      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      SDK Layer                               │
│  - Stable API surface                                       │
│  - React hooks (useArcadeSession, etc.)                     │
│  - Type definitions                                         │
│  - Utilities (buildPlayerMetadata, etc.)                    │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   Game Layer                                 │
│  Individual games (number-guesser, math-sprint, etc.)      │
│  Each game: Validator + Provider + Components + Types      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                Infrastructure Layer                          │
│  - WebSocket (useArcadeSocket)                              │
│  - Optimistic state (useOptimisticGameState)                │
│  - Database (room data, player data)                        │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow: Move Execution

```
1. User clicks button
   │
   ▼
2. Provider calls sendMove()
   │
   ▼
3. useArcadeSession
   ├─→ Apply optimistically (instant UI update)
   └─→ Send via WebSocket to server
   │
   ▼
4. Server validates move
   │
   ├─→ VALID:
   │   ├─→ Apply to server state
   │   ├─→ Increment version
   │   ├─→ Broadcast to all clients
   │   └─→ Client: Remove from pending, confirm state
   │
   └─→ INVALID:
       ├─→ Send rejection message
       └─→ Client: Rollback optimistic state, show error
```

---

## Core Concepts

### 1. Game Definition

A game is defined by five core pieces:

```typescript
interface GameDefinition<TConfig, TState, TMove> {
  manifest: GameManifest          // Display metadata
  Provider: GameProviderComponent // React context provider
  GameComponent: GameComponent    // Main UI component
  validator: GameValidator        // Server validation logic
  defaultConfig: TConfig          // Default settings
}
```

**Why this structure?**
- `manifest`: Declarative metadata for discovery and UI
- `Provider`: Encapsulates all game logic and state management
- `GameComponent`: Pure UI component, no business logic
- `validator`: Server-authoritative validation prevents cheating
- `defaultConfig`: Sensible defaults, can be overridden per-room

### 2. Validator (Server-Side)

The validator is the **source of truth** for game logic.

```typescript
interface GameValidator<TState, TMove> {
  validateMove(state: TState, move: TMove): ValidationResult
  isGameComplete(state: TState): boolean
  getInitialState(config: unknown): TState
}
```

**Key Principles:**
- **Pure functions**: No side effects, no I/O
- **Deterministic**: Same input → same output
- **Complete game logic**: All rules enforced here
- **Returns new state**: Immutable state updates

**Why server-side?**
- Prevents cheating (client can't fake moves)
- Single source of truth (no client/server divergence)
- Easier debugging (all logic in one place)
- Can add server-only features (analytics, anti-cheat)

### 3. Provider (Client-Side)

The provider manages client state and provides a clean API.

```typescript
interface GameContextValue {
  state: GameState           // Current game state
  lastError: string | null   // Last validation error
  startGame: () => void      // Action creators
  makeMove: (data) => void   // ...
  clearError: () => void
  exitSession: () => void
}
```

**Responsibilities:**
- Wrap `useArcadeSession` with game-specific actions
- Build player metadata from game mode context
- Provide clean, typed API to components
- Handle room config persistence

**Anti-Pattern:** Don't put game logic here. The provider is a **thin wrapper** around the SDK.

### 4. Optimistic Updates

The system uses **optimistic UI** for instant feedback:

1. User makes a move → UI updates immediately
2. Move sent to server for validation
3. Server validates:
   - ✓ Valid → Confirm optimistic state
   - ✗ Invalid → Rollback and show error

**Why optimistic updates?**
- Instant feedback (no perceived latency)
- Better UX for fast-paced games
- Handles network issues gracefully

**Tradeoff:**
- More complex state management
- Need rollback logic
- Potential for flashing/jumpy UI on rollback

**When NOT to use:**
- High-stakes actions (payments, permanent changes)
- Actions with irreversible side effects
- When server latency is acceptable

### 5. State Synchronization

State is synchronized across all clients in a room:

```
Client A makes move → Server validates → Broadcast to all clients
  ├─→ Client A: Confirm optimistic update
  ├─→ Client B: Apply server state
  └─→ Client C: Apply server state
```

**Conflict Resolution:**
- Server state is **always authoritative**
- Version numbers prevent out-of-order updates
- Pending moves are reapplied after server sync

---

## Implementation Details

### SDK Design

The SDK provides a **stable API surface** that games import from:

```typescript
// ✅ GOOD: Import from SDK
import { useArcadeSession, type GameDefinition } from '@/lib/arcade/game-sdk'

// ❌ BAD: Import internal implementation
import { useArcadeSocket } from '@/hooks/useArcadeSocket'
```

**Why?**
- **Stability**: Internal APIs can change, SDK stays stable
- **Discoverability**: One place to find all game APIs
- **Encapsulation**: Hide implementation details
- **Documentation**: SDK is the "public API" to document

**SDK Exports:**

```typescript
// Types
export type { GameDefinition, GameValidator, GameState, GameMove, ... }

// React Hooks
export { useArcadeSession, useRoomData, useGameMode, useViewerId }

// Utilities
export { defineGame, buildPlayerMetadata, loadManifest }
```

### Registry Pattern

Games register themselves on module load:

```typescript
// game-registry.ts
const registry = new Map<string, GameDefinition>()

export function registerGame(game: GameDefinition) {
  registry.set(game.manifest.name, game)
}

export function getGame(name: string) {
  return registry.get(name)
}

// At bottom of file
import { numberGuesserGame } from '@/arcade-games/number-guesser'
registerGame(numberGuesserGame)
```

**Why self-registration?**
- No central "game list" to maintain
- Games are automatically discovered
- Import errors are caught at module load time
- Easy to enable/disable games (comment out registration)

**Alternative Considered:** Auto-discovery via file system

```typescript
// ❌ Rejected: Magic, fragile, breaks with bundlers
const games = import.meta.glob('../arcade-games/*/index.ts')
```

### Player Metadata

Player metadata is built from multiple sources:

```typescript
function buildPlayerMetadata(
  playerIds: string[],
  existingMetadata: Record<string, unknown>,
  playerMap: Map<string, Player>,
  viewerId?: string
): Record<string, PlayerMetadata>
```

**Sources:**
1. `playerIds`: Which players are active
2. `existingMetadata`: Carry over existing data (for reconnects)
3. `playerMap`: Player details (name, emoji, color, userId)
4. `viewerId`: Current user (for ownership checks)

**Why so complex?**
- Players can be local or remote (in rooms)
- Need to preserve data across state updates
- Must map player IDs to user IDs for permissions
- Support for guest players vs. authenticated users

### Move Validation Flow

```typescript
// 1. Client sends move
sendMove({
  type: 'MAKE_GUESS',
  playerId: 'player-123',
  userId: 'user-456',
  timestamp: Date.now(),
  data: { guess: 42 }
})

// 2. Optimistic update (client-side)
const optimisticState = applyMove(currentState, move)
setOptimisticState(optimisticState)

// 3. Server validates
const result = validator.validateMove(serverState, move)

// 4a. Valid → Broadcast new state
if (result.valid) {
  serverState = result.newState
  version++
  broadcastToAllClients({ gameState: serverState, version })
}

// 4b. Invalid → Send rejection
else {
  sendToClient({ error: result.error, move })
}

// 5. Client handles response
// Valid: Confirm optimistic state, remove from pending
// Invalid: Rollback optimistic state, show error
```

**Key Points:**
- Optimistic update happens **before** server response
- Server is **authoritative** (client state can be overwritten)
- Version numbers prevent stale updates
- Rejected moves trigger error UI

---

## Design Decisions

### Decision: Server-Authoritative Validation

**Choice:** All game logic runs on server, client is "dumb"

**Rationale:**
- Prevents cheating (client can't manipulate state)
- Single source of truth (no client/server divergence)
- Easier testing (one codebase for game logic)
- Can add server-side features (analytics, matchmaking)

**Tradeoff:**
- ➕ Secure, consistent, easier to maintain
- ➖ Network latency affects UX (mitigated by optimistic updates)
- ➖ Can't play offline

**Alternative Considered:** Client-side validation + server verification
- Rejected: Duplicate logic, potential for divergence

### Decision: Optimistic Updates

**Choice:** Apply moves immediately, rollback on rejection

**Rationale:**
- Instant feedback (no perceived latency)
- Better UX for turn-based games
- Handles network issues gracefully

**Tradeoff:**
- ➕ Feels instant, smooth UX
- ➖ More complex state management
- ➖ Potential for jarring rollbacks

**When to disable:** High-stakes actions (payments, permanent bans)

### Decision: TypeScript Everywhere

**Choice:** Full TypeScript on client and server

**Rationale:**
- Compile-time validation catches bugs early
- Better IDE support (autocomplete, refactoring)
- Self-documenting code (types as documentation)
- Easier refactoring (compiler catches breakages)

**Tradeoff:**
- ➕ Fewer runtime errors, better DX
- ➖ Slower initial development (must define types)
- ➖ Learning curve for new developers

**Alternative Considered:** JavaScript with JSDoc
- Rejected: JSDoc is not type-safe, easy to drift

### Decision: React Context for State

**Choice:** Each game has a Provider that wraps game logic

**Rationale:**
- Natural React pattern
- Easy to compose (Provider wraps GameComponent)
- No prop drilling
- Easy to test (can provide mock context)

**Tradeoff:**
- ➕ Clean component APIs, easy to understand
- ➖ Can't use context outside React tree
- ➖ Re-renders if not memoized carefully

**Alternative Considered:** Zustand/Redux
- Rejected: Overkill for game-specific state, harder to isolate per-game

### Decision: Phase-Based UI

**Choice:** Each game has distinct phases (setup, playing, results)

**Rationale:**
- Clear separation of concerns
- Easy to understand game flow
- Each phase is independently testable
- Natural mapping to game states

**Tradeoff:**
- ➕ Organized, predictable
- ➖ Some duplication (multiple components)
- ➖ Can't have overlapping phases

**Pattern:**

```typescript
{state.gamePhase === 'setup' && <SetupPhase />}
{state.gamePhase === 'playing' && <PlayingPhase />}
{state.gamePhase === 'results' && <ResultsPhase />}
```

### Decision: Player Order from Set Iteration

**Choice:** Don't sort player arrays, use Set iteration order

**Rationale:**
- Set order is consistent within a session
- Matches UI display order (PageWithNav uses same Set)
- Avoids alphabetical bias (first player isn't always "AAA")

**Tradeoff:**
- ➕ UI and game logic always match
- ➖ Order is not predictable across sessions
- ➖ Different players see different orders (based on join time)

**Why not sort?**
- Creates mismatch: UI shows Set order, game uses sorted order
- Causes "skipping first player" bug (discovered in Number Guesser)

### Decision: No Optimistic Logic in Provider

**Choice:** Provider's `applyMove` just returns current state

```typescript
const { state, sendMove } = useArcadeSession({
  applyMove: (state, move) => state // Don't apply, wait for server
})
```

**Rationale:**
- Keeps client logic minimal (less code to maintain)
- Prevents client/server logic divergence
- Server is authoritative (no client-side cheats)

**Tradeoff:**
- ➕ Simple, secure
- ➖ Slightly slower UX (wait for server)

**When to use client-side `applyMove`:**
- Very fast-paced games (60fps animations)
- Purely cosmetic updates (particles, sounds)
- Never for game logic (scoring, winning, etc.)

---

## Lessons Learned

### From Number Guesser Implementation

#### 1. Type Coercion is Critical

**Problem:** WebSocket/JSON serialization converts numbers to strings.

```typescript
// Client sends
sendMove({ data: { guess: 42 } })

// Server receives
move.data.guess === "42" // String! 😱
```

**Solution:** Explicit coercion in validator

```typescript
validateMove(state, move) {
  case 'MAKE_GUESS':
    return this.validateGuess(state, Number(move.data.guess))
}
```

**Lesson:** Always coerce types from `move.data` in validator.

**Symptom Observed:** User reported "first guess always rejected, second guess always correct" which was caused by:
- First guess: `"42" < 1` evaluates to `false` (string comparison)
- Validator thinks it's valid, calculates distance as `NaN`
- `NaN === 0` is false, so guess is "wrong"
- Second guess: `"50" < 1` also evaluates oddly, but `Math.abs("50" - 42)` coerces correctly
- The behavior was unpredictable due to mixed type coercion

**Root Cause:** String comparison operators (`<`, `>`) have weird behavior with string numbers.

#### 2. Player Ordering Must Be Consistent

**Problem:** Set iteration order differed from sorted order, causing "skipped player" bug.

**Root Cause:**
- UI used `Array.from(Set)` → Set iteration order
- Game used `Array.from(Set).sort()` → Alphabetical order
- Leftmost UI player ≠ First game player

**Solution:** Remove `.sort()` everywhere, use raw Set order.

**Lesson:** Player order must be identical in UI and game logic.

#### 3. Error Feedback is Essential

**Problem:** Moves rejected silently, users confused.

**Solution:** `lastError` state with auto-dismiss UI.

```typescript
const { lastError, clearError } = useArcadeSession()

{lastError && (
  <ErrorBanner message={lastError} onDismiss={clearError} />
)}
```

**Lesson:** Always surface validation errors to users.

#### 4. Turn Indicators Improve UX

**Problem:** Players didn't know whose turn it was.

**Solution:** `currentPlayerId` prop to `PageWithNav`.

```typescript
<PageWithNav
  currentPlayerId={state.currentPlayer}
  playerScores={state.scores}
>
```

**Lesson:** Visual feedback for turn-based games is critical.

#### 5. Round vs. Game Completion

**Problem:** Validator checked `!state.winner` for next round, but winner is only set when game ends.

**Root Cause:** Confused "round complete" (someone guessed) with "game complete" (someone won).

**Solution:** Check if last guess was correct:

```typescript
const roundComplete = state.guesses.length > 0 &&
  state.guesses[state.guesses.length - 1].distance === 0
```

**Lesson:** Be precise about what "complete" means (round vs. game).

#### 6. Debug Logging is Invaluable

**Problem:** Type issues caused subtle bugs (always correct guess).

**Solution:** Add logging in validator:

```typescript
console.log('[NumberGuesser] Validating guess:', {
  guess,
  guessType: typeof guess,
  secretNumber: state.secretNumber,
  secretNumberType: typeof state.secretNumber,
  distance: Math.abs(guess - state.secretNumber)
})
```

**Lesson:** Log types and values during development.

---

## Future Improvements

### 1. Automated Testing

**Current State:** Manual testing only

**Proposal:**
- Unit tests for validators (pure functions, easy to test)
- Integration tests for Provider + useArcadeSession
- E2E tests for full game flows (Playwright)

**Example:**

```typescript
describe('NumberGuesserValidator', () => {
  it('should reject out-of-bounds guess', () => {
    const validator = new NumberGuesserValidator()
    const state = { minNumber: 1, maxNumber: 100, ... }
    const move = { type: 'MAKE_GUESS', data: { guess: 200 } }

    const result = validator.validateMove(state, move)

    expect(result.valid).toBe(false)
    expect(result.error).toContain('must be between')
  })
})
```

### 2. Move History / Replay

**Current State:** No move history

**Proposal:**
- Store all moves in database
- Allow "replay" of games
- Enable undo/redo (for certain games)
- Analytics on player behavior

**Schema:**

```typescript
interface GameSession {
  id: string
  roomId: string
  gameType: string
  moves: GameMove[]
  finalState: GameState
  startTime: number
  endTime: number
}
```

### 3. Game Analytics

**Current State:** No analytics

**Proposal:**
- Track game completions, durations, winners
- Player skill ratings (Elo, TrueSkill)
- Popular games dashboard
- A/B testing for game variants

### 4. Spectator Mode

**Current State:** Only active players can view game

**Proposal:**
- Allow non-players to watch
- Spectators can't send moves (read-only)
- Show spectator count in room

**Implementation:**

```typescript
interface RoomMember {
  userId: string
  role: 'player' | 'spectator' | 'host'
}
```

### 5. Game Variants

**Current State:** One config per game

**Proposal:**
- Preset variants (Easy, Medium, Hard)
- Custom rules per room
- "House rules" feature

**Example:**

```typescript
const variants = {
  beginner: { minNumber: 1, maxNumber: 20, roundsToWin: 1 },
  standard: { minNumber: 1, maxNumber: 100, roundsToWin: 3 },
  expert: { minNumber: 1, maxNumber: 1000, roundsToWin: 5 },
}
```

### 6. Tournaments / Brackets

**Current State:** Single-room games only

**Proposal:**
- Multi-round tournaments
- Bracket generation
- Leaderboards

### 7. Game Mod Support

**Current State:** Games are hard-coded

**Proposal:**
- Load games from external bundles
- Community-created games
- Sandboxed execution (Deno, WASM)

**Challenges:**
- Security (untrusted code)
- Type safety (dynamic loading)
- Versioning (breaking changes)

### 8. Voice/Video Chat

**Current State:** Text chat only (if implemented)

**Proposal:**
- WebRTC voice/video
- Per-room channels
- Mute/kick controls

---

## Appendix: Key Files Reference

| Path | Purpose |
|------|---------|
| `src/lib/arcade/game-sdk/index.ts` | SDK exports (public API) |
| `src/lib/arcade/game-registry.ts` | Game registration |
| `src/lib/arcade/manifest-schema.ts` | Manifest validation |
| `src/hooks/useArcadeSession.ts` | Session management hook |
| `src/hooks/useArcadeSocket.ts` | WebSocket connection |
| `src/hooks/useOptimisticGameState.ts` | Optimistic state management |
| `src/contexts/GameModeContext.tsx` | Player management |
| `src/components/PageWithNav.tsx` | Game navigation wrapper |
| `src/arcade-games/number-guesser/` | Example game implementation |

---

## Related Documentation

- [Game Development Guide](../arcade-games/README.md) - Step-by-step guide to creating games
- [API Reference](./arcade-game-api-reference.md) - Complete SDK API documentation (TODO)
- [Deployment Guide](./arcade-game-deployment.md) - How to deploy new games (TODO)

---

*Last Updated: 2025-10-15*
