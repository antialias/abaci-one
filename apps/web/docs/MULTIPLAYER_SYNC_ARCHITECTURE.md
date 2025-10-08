# Multiplayer Synchronization Architecture

## Current State: Single-User Multi-Tab Sync

### How it Works

**Client-Side Flow:**

1. User opens game in Tab A and Tab B
2. Both tabs create WebSocket connections via `useArcadeSocket()`
3. Both emit `join-arcade-session` with `userId`
4. Server adds both sockets to `arcade:${userId}` room

**When User Makes a Move (from Tab A):**

```typescript
// Client (Tab A)
sendMove({ type: 'FLIP_CARD', playerId: 'player-1', data: { cardId: 'card-5' } })

// Optimistic update applied locally
state = applyMoveOptimistically(state, move)

// Socket emits to server
socket.emit('game-move', { userId, move })
```

**Server Processing:**

```typescript
// socket-server.ts line 71
socket.on('game-move', async (data) => {
  // Validate move
  const result = await applyGameMove(data.userId, data.move)

  if (result.success) {
    // ✅ Broadcast to ALL tabs of this user
    io.to(`arcade:${data.userId}`).emit('move-accepted', {
      gameState: result.session.gameState,
      version: result.session.version,
      move: data.move
    })
  }
})
```

**Both Tabs Receive Update:**

```typescript
// Client (Tab A and Tab B)
socket.on('move-accepted', (data) => {
  // Update server state
  optimistic.handleMoveAccepted(data.gameState, data.version, data.move)

  // Tab A: Remove from pending queue (was optimistic)
  // Tab B: Just sync with server state (wasn't expecting it)
})
```

### Key Components

1. **`useOptimisticGameState`** - Manages optimistic updates
   - Keeps `serverState` (last confirmed by server)
   - Keeps `pendingMoves[]` (not yet confirmed)
   - Current state = serverState + all pending moves applied

2. **`useArcadeSession`** - Combines socket + optimistic state
   - Connects socket
   - Applies moves optimistically
   - Sends moves to server
   - Handles server responses

3. **Socket Rooms** - Server-side broadcast channels
   - `arcade:${userId}` - All tabs of one user
   - Each socket can be in multiple rooms
   - `io.to(room).emit()` broadcasts to all sockets in that room

4. **Session Storage** - Database
   - One session per user (userId is unique key)
   - Contains `gameState`, `version`, `roomId`
   - Optimistic locking via version number

---

## Required: Room-Based Multi-User Sync

### The Goal

Multiple users in the same room at `/arcade/room` should all see synchronized game state:

- User A (2 tabs): Tab A1, Tab A2
- User B (1 tab): Tab B1
- User C (2 tabs): Tab C1, Tab C2

When User A makes a move in Tab A1:
- **All of User A's tabs** see the move (Tab A1, Tab A2)
- **All of User B's tabs** see the move (Tab B1)
- **All of User C's tabs** see the move (Tab C1, Tab C2)

### The Challenge

Current architecture only broadcasts within one user:
```typescript
// ❌ Only reaches User A's tabs
io.to(`arcade:${userA}`).emit('move-accepted', ...)
```

We need to broadcast to the entire room:
```typescript
// ✅ Reaches all users in the room
io.to(`game:${roomId}`).emit('move-accepted', ...)
```

### The Solution

#### 1. Add Room-Based Game Socket Room

When a user joins `/arcade/room`, they join TWO socket rooms:

```typescript
// socket-server.ts - extend join-arcade-session
socket.on('join-arcade-session', async ({ userId, roomId }) => {
  // Join user's personal room (for multi-tab sync)
  socket.join(`arcade:${userId}`)

  // If this session is part of a room, also join the game room
  if (roomId) {
    socket.join(`game:${roomId}`)
    console.log(`🎮 User ${userId} joined game room ${roomId}`)
  }

  // Send current session state...
})
```

#### 2. Broadcast to Both Rooms

When processing moves for room-based sessions:

```typescript
// socket-server.ts - modify game-move handler
socket.on('game-move', async (data) => {
  const result = await applyGameMove(data.userId, data.move)

  if (result.success && result.session) {
    const moveAcceptedData = {
      gameState: result.session.gameState,
      version: result.session.version,
      move: data.move,
    }

    // Broadcast to user's own tabs (for optimistic update reconciliation)
    io.to(`arcade:${data.userId}`).emit('move-accepted', moveAcceptedData)

    // If this is a room-based session, ALSO broadcast to all room members
    if (result.session.roomId) {
      io.to(`game:${result.session.roomId}`).emit('move-accepted', moveAcceptedData)
      console.log(`📢 Broadcasted move to room ${result.session.roomId}`)
    }
  }
})
```

**Why broadcast to both?**
- `arcade:${userId}` - So the acting user's tabs can reconcile their optimistic updates
- `game:${roomId}` - So all other users in the room receive the update

#### 3. Client Handles Own vs. Other Moves

The client already handles this correctly via optimistic updates:

```typescript
// User A (Tab A1) - Makes move
sendMove({ type: 'FLIP_CARD', ... })
// → Applies optimistically immediately
// → Sends to server
// → Receives move-accepted
// → Reconciles: removes from pending queue

// User B (Tab B1) - Sees move from User A
// → Receives move-accepted (unexpected)
// → Reconciles: clears pending queue, syncs with server state
// → Result: sees User A's move immediately
```

The beauty is that `handleMoveAccepted()` already handles both cases:
- **Own move**: Remove from pending queue
- **Other's move**: Clear pending queue (since server state is now ahead)

#### 4. Pass roomId in join-arcade-session

Client needs to send roomId when joining:

```typescript
// hooks/useArcadeSocket.ts
const joinSession = useCallback((userId: string, roomId?: string) => {
  if (!socket) return
  socket.emit('join-arcade-session', { userId, roomId })
}, [socket])

// hooks/useArcadeSession.ts
useEffect(() => {
  if (connected && autoJoin && userId) {
    // Get roomId from session or room context
    const roomId = getRoomId() // Need to provide this
    joinSession(userId, roomId)
  }
}, [connected, autoJoin, userId, joinSession])
```

---

## Implementation Plan

### Phase 1: Server-Side Changes

**File: `socket-server.ts`**

1. ✅ Accept `roomId` in `join-arcade-session` event
   ```typescript
   socket.on('join-arcade-session', async ({ userId, roomId }) => {
     socket.join(`arcade:${userId}`)

     // Join game room if session is room-based
     if (roomId) {
       socket.join(`game:${roomId}`)
     }

     // Rest of logic...
   })
   ```

2. ✅ Broadcast to room in `game-move` handler
   ```typescript
   if (result.success && result.session) {
     const moveData = {
       gameState: result.session.gameState,
       version: result.session.version,
       move: data.move,
     }

     // Broadcast to user's tabs
     io.to(`arcade:${data.userId}`).emit('move-accepted', moveData)

     // ALSO broadcast to room if room-based session
     if (result.session.roomId) {
       io.to(`game:${result.session.roomId}`).emit('move-accepted', moveData)
     }
   }
   ```

3. ✅ Handle room disconnects
   ```typescript
   socket.on('disconnect', () => {
     // Leave all rooms (handled automatically by socket.io)
     // But log for debugging
     if (currentUserId && currentRoomId) {
       console.log(`User ${currentUserId} left game room ${currentRoomId}`)
     }
   })
   ```

### Phase 2: Client-Side Changes

**File: `hooks/useArcadeSocket.ts`**

1. ✅ Add roomId parameter to joinSession
   ```typescript
   export interface UseArcadeSocketReturn {
     // ... existing
     joinSession: (userId: string, roomId?: string) => void
   }

   const joinSession = useCallback((userId: string, roomId?: string) => {
     if (!socket) return
     socket.emit('join-arcade-session', { userId, roomId })
   }, [socket])
   ```

**File: `hooks/useArcadeSession.ts`**

2. ✅ Accept roomId in options
   ```typescript
   export interface UseArcadeSessionOptions<TState> {
     userId: string
     roomId?: string // NEW
     initialState: TState
     applyMove: (state: TState, move: GameMove) => TState
     // ... rest
   }

   export function useArcadeSession<TState>(options: UseArcadeSessionOptions<TState>) {
     const { userId, roomId, ...optimisticOptions } = options

     // Auto-join with roomId
     useEffect(() => {
       if (connected && autoJoin && userId) {
         joinSession(userId, roomId)
       }
     }, [connected, autoJoin, userId, roomId, joinSession])

     // ... rest
   }
   ```

**File: `app/arcade/matching/context/ArcadeMemoryPairsContext.tsx`**

3. ✅ Get roomId from room data and pass to session
   ```typescript
   import { useRoomData } from '@/hooks/useRoomData'

   export function ArcadeMemoryPairsProvider({ children }: { children: ReactNode }) {
     const { data: viewerId } = useViewerId()
     const { roomData } = useRoomData()

     // Arcade session integration
     const { state, sendMove, ... } = useArcadeSession<MemoryPairsState>({
       userId: viewerId || '',
       roomId: roomData?.id, // NEW - pass room ID
       initialState,
       applyMove: applyMoveOptimistically,
     })

     // ... rest stays the same
   }
   ```

### Phase 3: Testing

1. **Multi-Tab Test (Single User)**
   - Open `/arcade/room` in 2 tabs as User A
   - Make move in Tab 1
   - Verify Tab 2 updates immediately

2. **Multi-User Test (Different Users)**
   - User A opens `/arcade/room` in 1 tab
   - User B opens `/arcade/room` in 1 tab (same room)
   - User A makes move
   - Verify User B sees move immediately

3. **Multi-User Multi-Tab Test**
   - User A: 2 tabs (Tab A1, Tab A2)
   - User B: 2 tabs (Tab B1, Tab B2)
   - User A makes move in Tab A1
   - Verify all 4 tabs update

4. **Rapid Move Test**
   - User A and User B both make moves rapidly
   - Verify no conflicts
   - Verify all moves are processed in order

---

## Edge Cases to Handle

### 1. User Leaves Room Mid-Game

**Current behavior:** Session persists, user can rejoin

**Required behavior:**
- If user leaves room (HTTP POST to `/api/arcade/rooms/[roomId]/leave`):
  - Delete their session
  - Emit `session-ended` to their tabs
  - Other users continue playing

### 2. Version Conflicts

**Already handled** by optimistic locking:
- Each move increments version
- Client tracks server version
- If conflict detected, reconciliation happens automatically

### 3. Session Without Room

**Already handled** by session-manager.ts:
- Sessions without `roomId` are considered orphaned
- They're cleaned up on next access (lines 111-115)

### 4. Multiple Users Same Move

**Handled by server validation:**
- Server processes moves sequentially
- First valid move wins
- Second move gets rejected if it's now invalid
- Client rolls back rejected move

---

## Benefits of This Architecture

1. **Reuses existing optimistic update system**
   - No changes needed to client-side optimistic logic
   - Already handles own vs. others' moves

2. **Minimal changes required**
   - Add `roomId` parameter (3 places)
   - Add one `io.to()` broadcast (1 place)
   - Wire up roomId from context (1 place)

3. **Backward compatible**
   - Non-room sessions still work (roomId is optional)
   - Solo play unaffected

4. **Scalable**
   - Socket.io handles multiple rooms efficiently
   - No N² broadcasting (room-based is O(N))

5. **Already tested pattern**
   - Multi-tab sync proves the broadcast pattern works
   - Just extending to more sockets (different users)

---

## Security Considerations

### 1. Validate Room Membership

Before processing moves, verify user is in the room:

```typescript
// session-manager.ts - in applyGameMove()
const session = await getArcadeSession(userId)

if (session.roomId) {
  // Verify user is a member of this room
  const membership = await getRoomMember(session.roomId, userId)
  if (!membership) {
    return { success: false, error: 'User not in room' }
  }
}
```

### 2. Verify Player Ownership

Ensure users can only make moves for their own players:

```typescript
// Already handled in validator
// move.playerId must be in session.activePlayers
// activePlayers are owned by the userId making the move
```

This is already enforced by how activePlayers are set up in the room.

---

## Performance Considerations

### 1. Broadcasting Overhead

- **Current**: 1 user × N tabs = N broadcasts per move
- **New**: M users × N tabs each = (M×N) broadcasts per move
- **Impact**: Linear with room size, not quadratic
- **Acceptable**: Socket.io is optimized for this

### 2. Database Queries

- No change: Still 1 database write per move
- Session is stored per-user, not per-room
- Room data is separate (cached, not updated per move)

### 3. Memory

- Each socket joins 2 rooms instead of 1
- Negligible: Socket.io uses efficient room data structures

---

## Testing Checklist

### Unit Tests

- [ ] `useArcadeSocket` accepts and passes roomId
- [ ] `useArcadeSession` accepts and passes roomId
- [ ] Server joins `game:${roomId}` room when roomId provided

### Integration Tests

- [ ] Single user, 2 tabs: both tabs sync
- [ ] 2 users, 1 tab each: both users sync
- [ ] 2 users, 2 tabs each: all 4 tabs sync
- [ ] User leaves room: session deleted, others continue
- [ ] Rapid concurrent moves: all processed correctly

### Manual Tests

- [ ] Open room in 2 browsers (different users)
- [ ] Play full game to completion
- [ ] Verify scores sync correctly
- [ ] Verify turn changes sync correctly
- [ ] Verify game completion syncs correctly
