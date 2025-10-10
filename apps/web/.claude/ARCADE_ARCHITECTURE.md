# Arcade Game Architecture

## Overview

The arcade system supports two distinct game modes that must remain completely isolated from each other:

1. **Local Play** - Games without network synchronization (can be single-player OR local multiplayer)
2. **Room-Based Play** - Networked games with real-time synchronization across room members

## Core Terminology

Following `docs/terminology-user-player-room.md`:

- **USER** - Identity (guest or authenticated account), retrieved via `useViewerId()`, one per browser/account
- **PLAYER** - Game avatar/profile (e.g., "Alice 👧", "Bob 👦"), stored in `players` table
- **PLAYER ROSTER** - All PLAYERS belonging to a USER (can have many)
- **ACTIVE PLAYERS** - PLAYERS where `isActive = true` - these are the ones that actually participate in games
- **ROOM MEMBER** - A USER's participation in a multiplayer room (tracked in `room_members` table)

**Important:** A USER can have many PLAYERS in their roster, but only the ACTIVE PLAYERS (where `isActive = true`) participate in games. This enables "hot-potato" style local multiplayer where multiple people share the same device. This is LOCAL play (not networked), even though multiple PLAYERS participate.

In arcade sessions:

- `arcade_sessions.userId` - The USER who owns the session
- `arcade_sessions.activePlayers` - Array of PLAYER IDs (only active players with `isActive = true`)
- `arcade_sessions.roomId` - If present, the room ID for networked play (references `arcade_rooms.id`)

## Critical Architectural Requirements

### 1. Mode Isolation (MUST ENFORCE)

**Local Play** (`/arcade/[game-name]`)

- MUST NOT sync game state across the network
- MUST NOT use room data, even if the USER is currently a member of an active room
- MUST create isolated, per-USER game sessions
- Game state lives only in the current browser tab/session
- CAN have multiple ACTIVE PLAYERS from the same USER (local multiplayer / hot-potato)
- State is NOT shared across the network, only within the browser session

**Room-Based Play** (`/arcade/room`)

- MUST sync game state across all room members via network
- MUST use the USER's current active room
- MUST coordinate moves via server WebSocket
- Game state is shared across all ACTIVE PLAYERS from all USERS in the room
- When a PLAYER makes a move, all room members see it in real-time
- CAN ALSO have multiple ACTIVE PLAYERS per USER (networked + local multiplayer combined)

### 2. Room ID Usage Rules

```typescript
// ❌ WRONG: Always checking for room data
const { roomData } = useRoomData();
useArcadeSession({ roomId: roomData?.id }) < // This causes the bug!
  // ✅ CORRECT: Explicit mode control via separate providers
  LocalMemoryPairsProvider >
  {
    /* Never passes roomId */
  } <
  RoomMemoryPairsProvider >
  {
    /* Always passes roomId */
  };
```

**Key principle:** The presence of a `roomId` parameter in `useArcadeSession` determines synchronization behavior:

- `roomId` present → room-wide network sync enabled (room-based play)
- `roomId` undefined → local play only (no network sync)

### 3. Composition Over Flags (PREFERRED APPROACH)

**✅ Option 1: Separate Providers (CLEAREST - USE THIS)**

Create two distinct provider components:

```typescript
// context/LocalMemoryPairsProvider.tsx
export function LocalMemoryPairsProvider({ children }) {
  const { data: viewerId } = useViewerId();
  const { activePlayers } = useGameMode(); // Gets active players (isActive = true)
  // NEVER fetch room data for local play

  const { state, sendMove } = useArcadeSession<MemoryPairsState>({
    userId: viewerId || "",
    roomId: undefined, // Explicitly undefined - no network sync
    initialState,
    applyMove: applyMoveOptimistically,
  });

  // ... rest of provider logic
  // Note: activePlayers contains only PLAYERS with isActive = true
}

// context/RoomMemoryPairsProvider.tsx
export function RoomMemoryPairsProvider({ children }) {
  const { data: viewerId } = useViewerId();
  const { roomData } = useRoomData(); // OK to fetch for room-based play
  const { activePlayers } = useGameMode(); // Gets active players (isActive = true)

  const { state, sendMove } = useArcadeSession<MemoryPairsState>({
    userId: viewerId || "",
    roomId: roomData?.id, // Pass roomId for network sync
    initialState,
    applyMove: applyMoveOptimistically,
  });

  // ... rest of provider logic
}
```

Then use them explicitly:

```typescript
// /arcade/matching/page.tsx (Local Play)
export default function MatchingPage() {
  return (
    <ArcadeGuardedPage>
      <LocalMemoryPairsProvider>
        <MemoryPairsGame />
      </LocalMemoryPairsProvider>
    </ArcadeGuardedPage>
  )
}

// /arcade/room/page.tsx (Room-Based Play)
export default function RoomPage() {
  // ... room validation logic
  if (roomData.gameName === 'matching') {
    return (
      <RoomMemoryPairsProvider>
        <MemoryPairsGame />
      </RoomMemoryPairsProvider>
    )
  }
}
```

**Benefits of separate providers:**

- Compile-time safety - impossible to mix modes
- Clear intent - any developer can see which mode at a glance
- No runtime conditionals needed
- Easier to test - each provider tests separately

**❌ Avoid:** Runtime flag checking scattered throughout code

```typescript
// Anti-pattern: Too many conditionals
if (isRoomBased) { ... } else { ... }
```

### 4. How Synchronization Works

#### Local Play Flow

```
USER Action → useArcadeSession (roomId: undefined)
           → WebSocket emit('join-arcade-session', { userId })
           → Server creates isolated session for userId
           → Session key = userId
           → session.activePlayers = USER's active player IDs (isActive = true)
           → State changes only affect this USER's browser tabs

Note: Multiple ACTIVE PLAYERS from same USER can participate (local multiplayer),
      but state is NEVER synced across network
```

#### Room-Based Play Flow

```
USER Action (on behalf of PLAYER)
         → useArcadeSession (roomId: 'room_xyz')
         → WebSocket emit('join-arcade-session', { userId, roomId })
         → Server creates/joins shared session for roomId
         → session.activePlayers = ALL active players from ALL room members
         → Socket joins TWO rooms: `arcade:${userId}` AND `game:${roomId}`
         → PLAYER makes move
         → Server validates PLAYER ownership (is this PLAYER owned by this USER?)
         → State changes broadcast to:
            - arcade:${userId} - All tabs of this USER (for optimistic reconciliation)
            - game:${roomId} - All USERS in the room (for network sync)

Note: Each USER can still have multiple ACTIVE PLAYERS (local + networked multiplayer)
```

The server-side logic uses `roomId` to determine session scope:

- No `roomId`: Session key = `userId` (isolated to USER's browser)
- With `roomId`: Session key = `roomId` (shared across all room members)

See `docs/MULTIPLAYER_SYNC_ARCHITECTURE.md` for detailed socket room mechanics.

### 5. USER vs PLAYER in Game Logic

**Important distinction:**

- **Session ownership**: Tracked by USER ID (`useViewerId()`)
- **Player roster**: All PLAYERS for a USER (can be many)
- **Active players**: PLAYERS with `isActive = true` (these join the game)
- **Game actions**: Performed by PLAYER ID (from `players` table)
- **Move validation**: Server checks that PLAYER ID belongs to the requesting USER
- **Local multiplayer**: One USER with multiple ACTIVE PLAYERS (hot-potato style, same device)
- **Networked multiplayer**: Multiple USERS, each with their own ACTIVE PLAYERS, in a room

```typescript
// ✅ Correct: USER owns session, ACTIVE PLAYERS participate
const { data: viewerId } = useViewerId(); // USER ID
const { activePlayers } = useGameMode(); // ACTIVE PLAYER IDs (isActive = true)

// activePlayers might be [player_001, player_002]
// even though USER has 5 total PLAYERS in their roster

const { state, sendMove } = useArcadeSession({
  userId: viewerId, // Session owned by USER
  roomId: undefined, // Local play (or roomData?.id for room-based)
  // ...
});

// When PLAYER flips card:
sendMove({
  type: "FLIP_CARD",
  playerId: currentPlayerId, // PLAYER ID from activePlayers
  data: { cardId: "..." },
});
```

**Example Scenarios:**

1. **Single-player local game:**
   - USER: "guest_abc"
   - Player roster: ["player_001" (active), "player_002" (inactive), "player_003" (inactive)]
   - Active PLAYERS in game: ["player_001"]
   - Mode: Local play (no roomId)

2. **Local multiplayer (hot-potato):**
   - USER: "guest_abc"
   - Player roster: ["player_001" (active), "player_002" (active), "player_003" (active), "player_004" (inactive)]
   - Active PLAYERS in game: ["player_001", "player_002", "player_003"] (3 kids sharing device)
   - Mode: Local play (no roomId)
   - Game rotates turns between the 3 active PLAYERS, but NO network sync

3. **Room-based networked play:**
   - USER A: "guest_abc"
     - Player roster: 5 total PLAYERS
     - Active PLAYERS: ["player_001", "player_002"]
   - USER B: "guest_def"
     - Player roster: 3 total PLAYERS
     - Active PLAYERS: ["player_003"]
   - Mode: Room-based play (roomId: "room_xyz")
   - Total PLAYERS in game: 3 (player_001, player_002, player_003)
   - All 3 synced across network

4. **Room-based + local multiplayer combined:**
   - USER A: "guest_abc" with 3 active PLAYERS (3 kids at Device A)
   - USER B: "guest_def" with 2 active PLAYERS (2 kids at Device B)
   - Mode: Room-based play (roomId: "room_xyz")
   - 5 total active PLAYERS across 2 devices, all synced over network

## Common Mistakes to Avoid

### Mistake 1: Conditional Room Usage

```typescript
// ❌ BAD: Room sync leaks into local play
const { roomData } = useRoomData();
useArcadeSession({
  roomId: roomData?.id, // Local play will sync if USER is in a room!
});
```

### Mistake 2: Shared Components Without Mode Context

```typescript
// ❌ BAD: Same provider used for both modes
export default function LocalGamePage() {
  return <GameProvider><Game /></GameProvider>  // Which mode?
}
```

### Mistake 3: Confusing "multiplayer" with "networked"

```typescript
// ❌ BAD: Thinking multiple PLAYERS means room-based
if (activePlayers.length > 1) {
  // Must be room-based!  WRONG!
  // Could be local multiplayer (hot-potato style)
}

// ✅ CORRECT: Check for roomId to determine network sync
const isNetworked = !!roomId;
const isLocalMultiplayer = activePlayers.length > 1 && !roomId;
```

### Mistake 4: Using all PLAYERS instead of only active ones

```typescript
// ❌ BAD: Including inactive players
const allPlayers = await db.query.players.findMany({
  where: eq(players.userId, userId),
});

// ✅ CORRECT: Only active players join the game
const activePlayers = await db.query.players.findMany({
  where: and(eq(players.userId, userId), eq(players.isActive, true)),
});
```

### Mistake 5: Mixing USER ID and PLAYER ID

```typescript
// ❌ BAD: Using USER ID for game actions
sendMove({
  type: "FLIP_CARD",
  playerId: viewerId, // WRONG! viewerId is USER ID, not PLAYER ID
  data: { cardId: "..." },
});

// ✅ CORRECT: Use PLAYER ID from game state
sendMove({
  type: "FLIP_CARD",
  playerId: state.currentPlayer, // PLAYER ID from activePlayers
  data: { cardId: "..." },
});
```

### Mistake 6: Server-Side Ambiguity

```typescript
// ❌ BAD: Server can't distinguish intent
socket.on("join-arcade-session", ({ userId, roomId }) => {
  // If roomId exists, did USER want local or room-based play?
  // This happens when provider always passes roomData?.id
});
```

## Testing Requirements

Tests MUST verify mode isolation:

### Local Play Tests

```typescript
it("should NOT sync state when USER is in a room but playing locally", async () => {
  // Setup: USER is a member of an active room
  // Action: USER navigates to /arcade/matching
  // Assert: Game state is NOT shared with other room members
  // Assert: Other room members' actions do NOT affect this game
});

it("should create isolated sessions for concurrent local games", () => {
  // Setup: Two USERS who are members of the same room
  // Action: Both navigate to /arcade/matching separately
  // Assert: Each has independent game state
  // Assert: USER A's moves do NOT appear in USER B's game
});

it("should support local multiplayer without network sync", () => {
  // Setup: USER with 3 active PLAYERS in roster (hot-potato style)
  // Action: USER plays at /arcade/matching with the 3 active PLAYERS
  // Assert: All 3 active PLAYERS participate in the same session
  // Assert: Inactive PLAYERS do NOT participate
  // Assert: State is NOT synced across network
  // Assert: Game rotates turns between active PLAYERS locally
});

it("should only include active players in game", () => {
  // Setup: USER has 5 PLAYERS in roster, but only 2 are active
  // Action: USER starts a local game
  // Assert: Only the 2 active PLAYERS are in activePlayers array
  // Assert: Inactive PLAYERS are not included
});

it("should sync across USER tabs but not across network", () => {
  // Setup: USER opens /arcade/matching in 2 browser tabs
  // Action: PLAYER makes move in Tab 1
  // Assert: Tab 2 sees the move (multi-tab sync)
  // Assert: Other USERS do NOT see the move (no network sync)
});
```

### Room-Based Play Tests

```typescript
it("should sync state across all room members", async () => {
  // Setup: Two USERS are members of the same room
  // Action: USER A's PLAYER flips card at /arcade/room
  // Assert: USER B sees the card flip in real-time
});

it("should sync across multiple active PLAYERS from multiple USERS", () => {
  // Setup: USER A has 2 active PLAYERS, USER B has 1 active PLAYER in same room
  // Action: USER A's PLAYER 1 makes move
  // Assert: All 3 PLAYERS see the move (networked)
});

it("should only include active players in room games", () => {
  // Setup: USER A (5 PLAYERS, 2 active), USER B (3 PLAYERS, 1 active) join room
  // Action: Game starts
  // Assert: session.activePlayers = [userA_player1, userA_player2, userB_player1]
  // Assert: Inactive PLAYERS are NOT included
});

it("should handle combined local + networked multiplayer", () => {
  // Setup: USER A (3 active PLAYERS), USER B (2 active PLAYERS) in same room
  // Action: Any PLAYER makes a move
  // Assert: All 5 active PLAYERS see the move across both devices
});

it("should fail gracefully when no room exists", () => {
  // Setup: USER is not a member of any room
  // Action: Navigate to /arcade/room
  // Assert: Shows "No active room" message
  // Assert: Does not create a session
});

it("should validate PLAYER ownership", async () => {
  // Setup: USER A in room with active PLAYER 'alice'
  // Action: USER A attempts move for PLAYER 'bob' (owned by USER B)
  // Assert: Server rejects the move
  // Assert: Error indicates unauthorized PLAYER
});
```

## Implementation Checklist

When adding a new game or modifying existing ones:

- [ ] Create separate `LocalGameProvider` and `RoomGameProvider` components
- [ ] Local provider never calls `useRoomData()`
- [ ] Local provider passes `roomId: undefined` to `useArcadeSession`
- [ ] Room provider calls `useRoomData()` and passes `roomId: roomData?.id`
- [ ] Both providers use `useGameMode()` to get active players
- [ ] Local play page uses `LocalGameProvider`
- [ ] `/arcade/room` page uses `RoomGameProvider`
- [ ] Game components correctly use PLAYER IDs (not USER IDs) for moves
- [ ] Game supports multiple active PLAYERS from same USER (local multiplayer)
- [ ] Inactive PLAYERS are never included in game sessions
- [ ] Tests verify mode isolation (local doesn't network sync, room-based does)
- [ ] Tests verify PLAYER ownership validation
- [ ] Tests verify only active PLAYERS participate
- [ ] Tests verify local multiplayer works (multiple active PLAYERS, one USER)
- [ ] Documentation updated if behavior changes

## File Organization

```
src/app/arcade/
├── [game-name]/                    # Local play games
│   ├── page.tsx                   # Uses LocalGameProvider
│   └── context/
│       ├── LocalGameProvider.tsx  # roomId: undefined
│       └── RoomGameProvider.tsx   # roomId: roomData?.id
├── room/                           # Room-based play
│   └── page.tsx                   # Uses RoomGameProvider
└── ...
```

## Architecture Decision Records

### Why separate providers instead of auto-detect from route?

While we could detect mode based on the route (`/arcade/room` vs `/arcade/matching`), separate providers are clearer and prevent accidental misuse. Future developers can immediately see the intent, and the type system can enforce correctness.

### Why being in a room doesn't mean all games sync?

A USER being a room member does NOT mean all their games should network sync. They should be able to play local games while remaining in a room for future room-based sessions. Mode is determined by the page they're on, not their room membership status.

### Why not use a single shared provider with mode props?

We tried that. It led to the current bug where local play accidentally synced with rooms. Separate providers make the distinction compile-time safe rather than runtime conditional, and eliminate the possibility of accidentally passing `roomId` when we shouldn't.

### Why do we track sessions by USER but moves by PLAYER?

- **Sessions** are per-USER because each USER can have their own game session
- **Moves** are per-PLAYER because PLAYERS are the game avatars that score points
- **Only active PLAYERS** (isActive = true) participate in games
- This allows:
  - One USER with multiple active PLAYERS (local multiplayer / hot-potato)
  - Multiple USERS in one room (networked play)
  - Combined: Multiple USERS each with multiple active PLAYERS (local + networked)
  - Proper ownership validation (server checks USER owns PLAYER)
  - PLAYERS can be toggled active/inactive without deleting them

### Why use "local" vs "room-based" instead of "solo" vs "multiplayer"?

- **"Solo"** is misleading - a USER can have multiple active PLAYERS in local play (hot-potato style)
- **"Multiplayer"** is ambiguous - it could mean local multiplayer OR networked multiplayer
- **"Local play"** clearly means: no network sync (but can have multiple active PLAYERS)
- **"Room-based play"** clearly means: network sync across room members

## Related Files

- `src/hooks/useArcadeSession.ts` - Session management with optional roomId
- `src/hooks/useArcadeSocket.ts` - WebSocket connection with sync logic (socket rooms: `arcade:${userId}` and `game:${roomId}`)
- `src/hooks/useRoomData.ts` - Fetches USER's current room membership
- `src/hooks/useViewerId.ts` - Retrieves current USER ID
- `src/contexts/GameModeContext.tsx` - Provides active PLAYER information
- `src/app/arcade/matching/context/ArcadeMemoryPairsContext.tsx` - Game context (needs refactoring to separate providers)
- `src/app/arcade/matching/page.tsx` - Local play entry point
- `src/app/arcade/room/page.tsx` - Room-based play entry point
- `docs/terminology-user-player-room.md` - Terminology guide (USER/PLAYER/MEMBER)
- `docs/MULTIPLAYER_SYNC_ARCHITECTURE.md` - Technical details of room-based sync

## Version History

- **2025-10-09**: Initial documentation
  - Issue identified: Local play was syncing with rooms over network
  - Root cause: Same provider always fetched `roomData` and passed `roomId` to `useArcadeSession`
  - Solution: Separate providers for local vs room-based play
  - Terminology clarification: "local" vs "room-based" (not "solo" vs "multiplayer")
  - Active players: Only PLAYERS with `isActive = true` participate in games
