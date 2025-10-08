# User vs Player vs Room Member - Terminology Guide

**Critical Distinction**: Users, Players, and Room Members are three different concepts in the system.

## Core Concepts

### 1. **USER** (Identity Layer)
- **Table**: `users`
- **Purpose**: Identity - guest or authenticated account
- **Identified by**: `guestId` (HttpOnly cookie)
- **Retrieved via**: `useViewerId()` hook
- **Scope**: One per browser/account
- **Example**: A person visiting the site

### 2. **PLAYER** (Game Avatar Layer)
- **Table**: `players`
- **Purpose**: Game profiles/avatars that represent a participant in the game
- **Belongs to**: USER (via `userId` FK)
- **Properties**: name, emoji, color, `isActive`
- **Scope**: A USER can have MULTIPLE players (e.g., "Alice 👧", "Bob 👦", "Charlie 🧒")
- **Used in**: All game contexts - both local and online multiplayer
- **Active Players**: Players where `isActive = true` are the ones currently participating

### 3. **ROOM MEMBER** (Room Participation Layer)
- **Table**: `room_members`
- **Purpose**: Tracks a USER's participation in a multiplayer room
- **Identified by**: `userId` (references the guest/user)
- **Properties**: `displayName`, `isCreator`, `isOnline`, `joinedAt`
- **Scope**: One record per USER per room

## How They Work Together

### When a USER joins a room:

1. **Room Member Created**: A `room_members` record is created with the USER's ID
2. **Active Players Join**: The USER's ACTIVE PLAYERS (where `isActive = true`) participate in the game
3. **Arcade Session**: The `arcade_sessions.activePlayers` field contains the PLAYER IDs (from `players` table)

### Example Flow:

```
USER: guest_abc123 (Jane)
  ├─ PLAYER: player_001 (name: "Alice 👧", isActive: true)
  ├─ PLAYER: player_002 (name: "Bob 👦", isActive: true)
  └─ PLAYER: player_003 (name: "Charlie 🧒", isActive: false)

When USER joins ROOM "Math Masters":
  → ROOM_MEMBER created: {userId: "guest_abc123", displayName: "Jane", roomId: "room_xyz"}
  → PLAYERS joining game: ["player_001", "player_002"] (only active ones)
  → ARCADE_SESSION.activePlayers: ["player_001", "player_002"]
```

### Multi-User Room Example:

```
ROOM "Math Masters" (room_xyz):

  ROOM_MEMBER 1:
    userId: guest_abc123 (Jane)
    └─ PLAYERS in game: ["player_001" (Alice), "player_002" (Bob)]

  ROOM_MEMBER 2:
    userId: guest_def456 (Mark)
    └─ PLAYERS in game: ["player_003" (Mario)]

  ROOM_MEMBER 3:
    userId: guest_ghi789 (Sara)
    └─ PLAYERS in game: ["player_004" (Luna), "player_005" (Nova), "player_006" (Star)]

Total PLAYERS in this game: 6 players across 3 users
```

## Database Schema Relationships

```
users (1) ──< (many) players
  │
  └──< (many) room_members
                 │
                 └──< belongs to arcade_rooms

arcade_sessions:
  - userId: references users.id
  - activePlayers: JSON array of player.id values
  - roomId: references arcade_rooms.id (null for solo play)
```

## Implementation Rules

### ✅ Correct Usage

- **Room membership**: Track by USER ID
- **Game participation**: Track by PLAYER IDs
- **Presence/online status**: Track by USER ID (room member)
- **Scores/moves**: Track by PLAYER ID
- **Room creator**: Track by USER ID

### ❌ Common Mistakes

- ❌ Using USER ID where PLAYER ID is needed
- ❌ Assuming one USER = one PLAYER
- ❌ Tracking scores by USER instead of PLAYER
- ❌ Mixing room_members.displayName with players.name

## API Design Patterns

### When a USER joins a room:

```typescript
// 1. Add user as room member
POST /api/arcade/rooms/:roomId/join
Body: {
  userId: string        // USER ID (from useViewerId)
  displayName: string   // Room member display name
}

// 2. System retrieves user's active players
const activePlayers = await db.query.players.findMany({
  where: and(
    eq(players.userId, userId),
    eq(players.isActive, true)
  )
})

// 3. Game starts with those player IDs
const session = {
  userId,
  activePlayers: activePlayers.map(p => p.id), // PLAYER IDs
  roomId
}
```

### Socket Events

```typescript
// User joins room (presence)
socket.emit('join-room', { roomId, userId })

// Player makes a move (game action)
socket.emit('game-move', {
  roomId,
  playerId, // PLAYER ID, not USER ID
  move
})
```

## Summary

- **USER** = Identity/account (one per person)
- **PLAYER** = Game avatar/profile (multiple per user)
- **ROOM MEMBER** = USER's participation in a room
- **When USER joins room** → Their ACTIVE PLAYERS join the game
- **`activePlayers` field** → Array of PLAYER IDs from `players` table
