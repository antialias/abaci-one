# 🎮 Arcade Room System - Complete Technical Plan

**Date:** 2025-01-06
**Status:** Ready for Implementation

## Executive Summary

Transform the current singleton arcade session into a multi-room system where users can create, manage, and share public game rooms. Rooms are URL-addressable, support guest users, have configurable TTL, and give creators full moderation control.

---

## 1. Core Requirements

### Room Features

- ✅ **Public by default** - All rooms visible in public lobby
- ✅ **No capacity limits** - Unlimited players per room
- ✅ **Configurable TTL** - Rooms expire based on inactivity (similar to existing session TTL)
- ✅ **URL-addressable** - Direct links to join rooms (`/arcade/rooms/{roomId}`)
- ✅ **Guest access** - Unauthenticated users can join with temp guest IDs
- ✅ **Anyone can create** - No authentication required to create rooms
- ✅ **Creator moderation** - Only room creator can kick, lock, or delete room

---

## 2. Database Schema

### New Tables

```typescript
// arcade_rooms table
interface ArcadeRoom {
  id: string; // UUID - primary key
  code: string; // 6-char join code (e.g., "ABC123") - unique
  name: string; // User-defined room name (max 50 chars)

  // Creator info
  createdBy: string; // User/guest ID of creator
  creatorName: string; // Display name at creation time
  createdAt: Date;

  // Lifecycle
  lastActivity: Date; // Updated on any room activity
  ttlMinutes: number; // Time to live in minutes (default: 60)
  isLocked: boolean; // Creator can lock room (no new joins)

  // Game configuration
  gameName: string; // 'matching', 'complement-race', etc.
  gameConfig: JSON; // Game-specific settings (difficulty, etc.)

  // Current state
  status: "lobby" | "playing" | "finished";
  currentSessionId: string | null; // FK to arcade_sessions (when game active)

  // Metadata
  totalGamesPlayed: number; // Track room usage
}

// room_members table
interface RoomMember {
  id: string; // UUID - primary key
  roomId: string; // FK to arcade_rooms - indexed
  userId: string; // User/guest ID - indexed
  displayName: string; // Name shown in room
  isCreator: boolean; // True for room creator
  joinedAt: Date;
  lastSeen: Date; // Updated on any activity
  isOnline: boolean; // Currently connected via socket
}

// Modify existing: arcade_sessions
interface ArcadeSession {
  id: string;
  userId: string;
  // ... existing fields
  roomId: string | null; // FK to arcade_rooms (null for solo play)
  // When roomId is set, session is shared across room members
}
```

### Indexes

```sql
CREATE INDEX idx_rooms_code ON arcade_rooms(code);
CREATE INDEX idx_rooms_status ON arcade_rooms(status);
CREATE INDEX idx_rooms_last_activity ON arcade_rooms(lastActivity);
CREATE INDEX idx_room_members_room_id ON room_members(roomId);
CREATE INDEX idx_room_members_user_id ON room_members(userId);
CREATE INDEX idx_room_members_online ON room_members(isOnline) WHERE isOnline = true;
```

---

## 3. API Endpoints

### Room CRUD (`/api/arcade/rooms`)

```typescript
// Create room
POST /api/arcade/rooms
Body: {
  name: string              // Room name
  gameName: string          // Which game
  gameConfig?: object       // Game settings
  ttlMinutes?: number       // Default: 60
  creatorName: string       // Display name
}
Response: {
  room: ArcadeRoom
  joinUrl: string           // Full URL to share
}

// Get room details
GET /api/arcade/rooms/:roomId
Response: {
  room: ArcadeRoom
  members: RoomMember[]
  canModerate: boolean      // True if requester is creator
}

// Update room (creator only)
PATCH /api/arcade/rooms/:roomId
Body: {
  name?: string
  isLocked?: boolean
  ttlMinutes?: number
}
Response: { room: ArcadeRoom }

// Delete room (creator only)
DELETE /api/arcade/rooms/:roomId
Response: { success: boolean }

// Join room by code
GET /api/arcade/rooms/join/:code
Response: {
  roomId: string
  redirectUrl: string
}
```

### Room Discovery

```typescript
// Public room lobby (list all active rooms)
GET /api/arcade/rooms/lobby
Query: {
  gameName?: string         // Filter by game
  status?: string           // Filter by status
  limit?: number            // Default: 50
  offset?: number
}
Response: {
  rooms: Array<{
    id: string
    name: string
    code: string
    gameName: string
    status: string
    memberCount: number
    createdAt: Date
    creatorName: string
  }>
  total: number
}

// Get user's rooms (all rooms user has joined)
GET /api/arcade/rooms/my-rooms
Query: { userId: string }
Response: {
  rooms: Array<RoomWithMemberInfo>
}
```

### Room Membership

```typescript
// Join room
POST /api/arcade/rooms/:roomId/join
Body: {
  userId: string            // User or guest ID
  displayName: string
}
Response: {
  member: RoomMember
  room: ArcadeRoom
}

// Leave room
POST /api/arcade/rooms/:roomId/leave
Body: { userId: string }
Response: { success: boolean }

// Get members
GET /api/arcade/rooms/:roomId/members
Response: {
  members: RoomMember[]
  onlineCount: number
}

// Kick member (creator only)
DELETE /api/arcade/rooms/:roomId/members/:userId
Response: { success: boolean }
```

### Room Game Session

```typescript
// Start game in room
POST /api/arcade/rooms/:roomId/start-game
Body: {
  initiatedBy: string       // Must be room member
  activePlayers: string[]   // Subset of room members
}
Response: {
  sessionId: string
  gameState: any
}

// End game (return to lobby)
POST /api/arcade/rooms/:roomId/end-game
Body: { initiatedBy: string }
Response: { success: boolean }
```

---

## 4. WebSocket Protocol

### Socket.IO Room Namespacing

```typescript
// Join room's socket.io room
socket.emit('join-room', {
  roomId: string
  userId: string
})

// Leave room
socket.emit('leave-room', {
  roomId: string
  userId: string
})

// Update member presence
socket.emit('update-presence', {
  roomId: string
  userId: string
  isOnline: boolean
})
```

### Server → Client Events (room-scoped broadcasts)

```typescript
// Room state changes
socket.on('room-updated', {
  room: ArcadeRoom
})

// Member events
socket.on('member-joined', {
  member: RoomMember
  memberCount: number
})

socket.on('member-left', {
  userId: string
  memberCount: number
})

socket.on('member-kicked', {
  kickedUserId: string
  reason: string
})

socket.on('members-updated', {
  members: RoomMember[]
})

// Game session events
socket.on('game-starting', {
  sessionId: string
  activePlayers: string[]
})

socket.on('game-ended', {
  results: any
})

// Room lifecycle
socket.on('room-locked', {
  isLocked: boolean
})

socket.on('room-deleted', {
  reason: string
})

// Existing game moves (now room-scoped)
socket.on('game-move', { roomId, userId, move })
socket.on('move-accepted', { roomId, gameState, version })
socket.on('move-rejected', { roomId, error })
```

---

## 5. URL Structure & Routing

### New Routes

```typescript
/arcade/rooms                           // Public room lobby (list all rooms)
/arcade/rooms/create                    // Create room modal/page
/arcade/rooms/:roomId                   // Room lobby (pre-game)
/arcade/rooms/:roomId/matching          // Game with room context
/arcade/rooms/:roomId/complement-race   // Another game
/arcade/join/:code                      // Short link: redirects to room

// Existing routes (backward compatible)
/arcade                                 // My rooms + quick play
/arcade/matching                        // Solo play (no room)
```

### Navigation Flow

```
User Journey A: Create Room
1. /arcade → Click "Create Room"
2. /arcade/rooms/create → Fill form, submit
3. /arcade/rooms/{roomId} → Room lobby, share link
4. Click "Start Game" → /arcade/rooms/{roomId}/matching

User Journey B: Join via Link
1. Receive link: example.com/arcade/rooms/{roomId}
2. Opens lobby, automatically joins
3. Wait for game start or click ready

User Journey C: Join via Code
1. /arcade → Click "Join Room", enter ABC123
2. Resolves code → /arcade/rooms/{roomId}
3. Join and wait

User Journey D: Browse Lobby
1. /arcade/rooms → See public room list
2. Click room → /arcade/rooms/{roomId}
3. Join and play
```

---

## 6. UI Components Architecture

### Component Hierarchy

```
/src/components/arcade/rooms/
├── RoomLobbyBrowser.tsx           // Public room list (/arcade/rooms)
│   ├── RoomCard.tsx               // Individual room preview
│   └── RoomFilters.tsx            // Filter by game, status
│
├── RoomLobby.tsx                  // Pre-game lobby (/arcade/rooms/:roomId)
│   ├── RoomHeader.tsx             // Room name, code, share button
│   ├── RoomMemberList.tsx         // Online members
│   ├── RoomSettings.tsx           // Creator-only settings
│   └── RoomActions.tsx            // Start game, leave, etc.
│
├── CreateRoomDialog.tsx           // Room creation modal
│   ├── GameSelector.tsx           // Choose game type
│   ├── RoomNameInput.tsx          // Name the room
│   └── AdvancedSettings.tsx       // TTL, etc.
│
├── JoinRoomDialog.tsx             // Join by code modal
├── RoomContextIndicator.tsx       // Shows room info during game
│   └── RoomMemberAvatars.tsx      // Small member list
│
└── RoomModeration.tsx             // Creator controls (kick, lock, delete)
```

### Navigation Updates

```typescript
// Update GameContextNav.tsx
interface GameContextNavProps {
  // ... existing props
  roomContext?: {
    roomId: string;
    roomName: string;
    roomCode: string;
    memberCount: number;
    isCreator: boolean;
  };
}

// Shows in nav during room gameplay:
// [🏠 Friday Night (ABC123) • 5 players ▼]
```

---

## 7. State Management

### New Hooks

```typescript
// useArcadeRoom.ts - Room state and membership
export function useArcadeRoom(roomId: string) {
  return {
    room: ArcadeRoom | null
    members: RoomMember[]
    isCreator: boolean
    isOnline: boolean
    joinRoom: (displayName: string) => Promise<void>
    leaveRoom: () => Promise<void>
    updateRoom: (updates: Partial<ArcadeRoom>) => Promise<void>
    deleteRoom: () => Promise<void>
    kickMember: (userId: string) => Promise<void>
    startGame: (activePlayers: string[]) => Promise<void>
    endGame: () => Promise<void>
  }
}

// useRoomMembers.ts - Real-time member presence
export function useRoomMembers(roomId: string) {
  return {
    members: RoomMember[]
    onlineMembers: RoomMember[]
    onlineCount: number
    updatePresence: (isOnline: boolean) => void
  }
}

// useRoomLobby.ts - Public room discovery
export function useRoomLobby(filters?: RoomFilters) {
  return {
    rooms: RoomPreview[]
    loading: boolean
    refresh: () => void
    loadMore: () => void
  }
}

// Update useArcadeSession.ts
export function useArcadeSession<TState>(options: {
  userId: string
  roomId?: string  // NEW: optional room context
  // ... existing options
}) {
  // If roomId provided, session is room-scoped
  // All moves broadcast to room members
}
```

---

## 8. Server Implementation

### New Files

```
/src/lib/arcade/
├── room-manager.ts              # Core room operations
│   ├── createRoom()
│   ├── getRoomById()
│   ├── updateRoom()
│   ├── deleteRoom()
│   ├── getRoomByCode()
│   └── getPublicRooms()
│
├── room-membership.ts           # Member management
│   ├── joinRoom()
│   ├── leaveRoom()
│   ├── kickMember()
│   ├── getRoomMembers()
│   └── updateMemberPresence()
│
├── room-validation.ts           # Access control
│   ├── canModerateRoom()
│   ├── canJoinRoom()
│   ├── canStartGame()
│   └── validateRoomName()
│
├── room-ttl.ts                  # TTL management (reuse existing pattern)
│   ├── scheduleRoomCleanup()
│   ├── updateRoomActivity()
│   └── cleanupExpiredRooms()
│
└── session-manager.ts           # Update for room support
    └── createArcadeSession() - accept roomId param
```

### Socket Server Updates

```typescript
// socket-server.ts modifications

io.on("connection", (socket) => {
  // Join room (socket.io namespace)
  socket.on("join-room", async ({ roomId, userId }) => {
    // Validate membership
    const member = await getRoomMember(roomId, userId);
    if (!member) {
      socket.emit("room-error", { error: "Not a room member" });
      return;
    }

    // Join socket.io room
    socket.join(`room:${roomId}`);

    // Update presence
    await updateMemberPresence(roomId, userId, true);

    // Broadcast to room
    io.to(`room:${roomId}`).emit("member-joined", { member });

    // Send current state
    const room = await getRoomById(roomId);
    const members = await getRoomMembers(roomId);
    socket.emit("room-state", { room, members });
  });

  // Leave room
  socket.on("leave-room", async ({ roomId, userId }) => {
    socket.leave(`room:${roomId}`);
    await updateMemberPresence(roomId, userId, false);
    io.to(`room:${roomId}`).emit("member-left", { userId });
  });

  // Game moves (room-scoped)
  socket.on("game-move", async ({ roomId, userId, move }) => {
    // Validate room membership
    const member = await getRoomMember(roomId, userId);
    if (!member) return;

    // Apply move to room's session
    const result = await applyGameMove(userId, move, roomId);

    if (result.success) {
      // Broadcast to all room members
      io.to(`room:${roomId}`).emit("move-accepted", {
        gameState: result.session.gameState,
        version: result.session.version,
        move,
      });
    }
  });

  // Disconnect handling
  socket.on("disconnect", () => {
    // Update presence for all rooms user was in
    updateAllUserPresence(userId, false);
  });
});
```

---

## 9. Guest User System

### Guest ID Generation

```typescript
// /src/lib/guest-id.ts

export function generateGuestId(): string {
  // Format: guest_{timestamp}_{random}
  // Example: guest_1704556800000_a3f2e1
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `guest_${timestamp}_${random}`;
}

export function isGuestId(userId: string): boolean {
  return userId.startsWith("guest_");
}

export function getGuestDisplayName(guestId: string): string {
  // Generate friendly name like "Guest 1234"
  const hash = guestId.split("_")[2];
  const num = parseInt(hash, 36) % 10000;
  return `Guest ${num}`;
}
```

### Guest Session Storage

```typescript
// Store guest ID in localStorage
const GUEST_ID_KEY = "soroban_guest_id";

export function getOrCreateGuestId(): string {
  let guestId = localStorage.getItem(GUEST_ID_KEY);
  if (!guestId) {
    guestId = generateGuestId();
    localStorage.setItem(GUEST_ID_KEY, guestId);
  }
  return guestId;
}
```

---

## 10. TTL Implementation

### Reuse Existing Session TTL Pattern

```typescript
// room-ttl.ts

const DEFAULT_ROOM_TTL_MINUTES = 60;

// Cleanup job (run every 5 minutes)
setInterval(
  async () => {
    await cleanupExpiredRooms();
  },
  5 * 60 * 1000,
);

async function cleanupExpiredRooms() {
  const now = new Date();

  // Find expired rooms
  const expiredRooms = await db.query(`
    SELECT id FROM arcade_rooms
    WHERE status != 'playing'
    AND lastActivity < NOW() - INTERVAL '1 minute' * ttlMinutes
  `);

  for (const room of expiredRooms) {
    // Notify members
    io.to(`room:${room.id}`).emit("room-deleted", {
      reason: "Room expired due to inactivity",
    });

    // Delete room and members
    await deleteRoom(room.id);
  }
}

// Update activity on any room action
export async function touchRoom(roomId: string) {
  await db.query(
    `
    UPDATE arcade_rooms
    SET lastActivity = NOW()
    WHERE id = $1
  `,
    [roomId],
  );
}
```

---

## 11. Room Code Generation

```typescript
// /src/lib/arcade/room-code.ts

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // No ambiguous chars
const CODE_LENGTH = 6;

export async function generateUniqueRoomCode(): Promise<string> {
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    const code = generateCode();
    const existing = await getRoomByCode(code);
    if (!existing) return code;
    attempts++;
  }

  throw new Error("Failed to generate unique room code");
}

function generateCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    const idx = Math.floor(Math.random() * CODE_CHARS.length);
    code += CODE_CHARS[idx];
  }
  return code;
}
```

---

## 12. Migration Plan

### Phase 1: Database & API Foundation (Day 1-2)

1. Create database tables and indexes
2. Implement room-manager.ts and room-membership.ts
3. Build API endpoints
4. Add room-code generation
5. Implement TTL cleanup
6. Write unit tests

### Phase 2: Socket.IO Integration (Day 2-3)

1. Update socket-server.ts for room namespacing
2. Implement room-scoped broadcasts
3. Add presence tracking
4. Update session-manager.ts for roomId support
5. Test multi-user room sessions

### Phase 3: Guest User System (Day 3)

1. Implement guest ID generation
2. Add guest user hooks
3. Update auth flow for optional guest access
4. Test guest join/leave flow

### Phase 4: UI Components (Day 4-5)

1. Build CreateRoomDialog
2. Build RoomLobby component
3. Build RoomLobbyBrowser (public lobby)
4. Add RoomContextIndicator to nav
5. Wire up all hooks

### Phase 5: Routes & Navigation (Day 5-6)

1. Create /arcade/rooms routes
2. Update arcade home for room access
3. Add room selector to nav
4. Implement join-by-code flow
5. Add share room functionality

### Phase 6: Testing & Polish (Day 6-7)

1. E2E tests for room creation/join
2. Multi-user gameplay tests
3. TTL and cleanup tests
4. Guest user flow tests
5. Performance testing
6. UI polish and error states

---

## 13. Backward Compatibility

### Solo Play Preserved

- Existing `/arcade/matching` routes work unchanged
- `roomId = null` for solo sessions
- No breaking changes to `useArcadeSession`
- All current functionality remains intact

### Migration Strategy

- Add `roomId` column to `arcade_sessions` (nullable)
- Existing sessions have `roomId = null`
- New room-based sessions have `roomId` populated
- Session logic checks: `if (roomId) { /* room mode */ }`

---

## 14. Security Considerations

### Room Access

- ✅ Validate room membership before allowing game moves
- ✅ Check `isCreator` flag for moderation actions
- ✅ Prevent joining locked rooms
- ✅ Rate limit room creation per IP/user
- ✅ Sanitize room names (max length, no XSS)

### Guest Users

- ✅ Guest IDs stored client-side only (localStorage)
- ✅ No sensitive data in guest profiles
- ✅ Guest names sanitized
- ✅ Rate limit guest actions
- ✅ Allow authenticated users to "claim" guest activity

### Room Moderation

- ✅ Only creator can kick/lock/delete
- ✅ Kicked users cannot rejoin unless creator unlocks
- ✅ Room deletion clears all associated data
- ✅ Audit log for moderation actions

---

## 15. Testing Strategy

### Unit Tests

- Room CRUD operations
- Member join/leave logic
- Code generation uniqueness
- TTL cleanup
- Guest ID generation
- Access control validation

### Integration Tests

- Full room creation → join → play → leave flow
- Multi-user concurrent gameplay
- Socket.IO room broadcasts
- Session synchronization across tabs
- TTL expiration and cleanup

### E2E Tests (Playwright)

- Create room → share link → join as guest
- Browse lobby → join room → play game
- Creator kicks member
- Room locks and unlock
- Room TTL expiration

### Load Tests

- 100+ concurrent rooms
- 10+ players per room
- Rapid join/leave cycles
- Socket.IO message throughput

---

## 16. Performance Optimizations

### Database

- Index on `room_members.roomId` for fast member queries
- Index on `arcade_rooms.code` for quick code lookups
- Index on `room_members.isOnline` for presence queries
- Partition `arcade_rooms` by `createdAt` for TTL cleanup

### Caching

- Cache active room list (1-minute TTL)
- Cache room member counts
- Redis pub/sub for cross-server socket broadcasts (future)

### Socket.IO

- Use socket.io rooms for efficient broadcasting
- Batch presence updates (debounce member online status)
- Compress socket messages for large game states

---

## 17. Future Enhancements (Post-MVP)

1. **Room Templates** - Save room configurations
2. **Private Rooms** - Invite-only with passwords
3. **Room Chat** - Text chat in lobby
4. **Spectator Mode** - Watch games without playing
5. **Room History** - Past games and stats
6. **Tournament Brackets** - Multi-round competitions
7. **Room Search** - Search by name/tag
8. **Room Tags** - Categorize rooms
9. **Friend Integration** - Invite friends directly
10. **Room Analytics** - Popular times, average players, etc.

---

## 18. Open Questions / Decisions Needed

1. **Room Name Validation** - Max length? Profanity filter?
2. **Default TTL** - 60 minutes good default?
3. **Code Reuse** - Can codes be reused after room expires?
4. **Member Limit** - Even though unlimited, warn at certain threshold?
5. **Lobby Pagination** - How many rooms to show initially?

---

## 19. Success Metrics

- ✅ Users can create and join rooms
- ✅ Guest users can participate without auth
- ✅ Multi-user gameplay synchronized across all room members
- ✅ Room creators can moderate effectively
- ✅ Rooms expire correctly based on TTL
- ✅ Public lobby shows active rooms
- ✅ No regressions in solo play mode
- ✅ All tests passing (unit, integration, e2e)

---

## 20. Dependencies

### Existing Systems to Leverage

- ✅ Current arcade session management
- ✅ Existing WebSocket infrastructure (socket-server.ts)
- ✅ Database setup (PostgreSQL)
- ✅ Guest player system (from GameModeContext)

### New Dependencies (if needed)

- None! All can be built with existing stack

---

## Implementation Checklist

- [ ] Create database migration
- [ ] Implement room-manager.ts
- [ ] Implement room-membership.ts
- [ ] Build API endpoints
- [ ] Add room code generation
- [ ] Update socket-server.ts
- [ ] Implement guest ID system
- [ ] Build CreateRoomDialog
- [ ] Build RoomLobby component
- [ ] Build RoomLobbyBrowser
- [ ] Add room routes
- [ ] Update navigation
- [ ] Write unit tests
- [ ] Write integration tests
- [ ] Write e2e tests
- [ ] Documentation
- [ ] Deploy

---

**Ready to implement! 🚀**
