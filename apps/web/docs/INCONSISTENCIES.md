# Current Implementation vs Correct Design - Inconsistencies

## ❌ Inconsistency 1: Room Join Doesn't Fetch Active Players

**Current Code** (`/api/arcade/rooms/:roomId/join`):
```typescript
// Only creates room_member record with userId
const member = await addRoomMember({
  roomId,
  userId: viewerId,  // ✅ Correct: USER ID
  displayName,
  isCreator: false,
})
// ❌ Missing: Does not fetch user's active players
```

**Should Be**:
```typescript
// 1. Create room member
const member = await addRoomMember({ ... })

// 2. Fetch user's active players
const activePlayers = await db.query.players.findMany({
  where: and(
    eq(players.userId, viewerId),
    eq(players.isActive, true)
  )
})

// 3. Return both member and their active players
return { member, activePlayers }
```

---

## ❌ Inconsistency 2: Socket Events Use USER ID Instead of PLAYER ID

**Current Code** (`socket-server.ts`):
```typescript
socket.on('join-room', ({ roomId, userId }) => {
  // Uses USER ID for presence
  await setMemberOnline(roomId, userId, true)
  socket.emit('room-joined', { members })
})

socket.on('room-game-move', ({ roomId, userId, move }) => {
  // ❌ Wrong: Uses USER ID for game moves
  // Should use PLAYER ID
})
```

**Should Be**:
```typescript
socket.on('join-room', ({ roomId, userId }) => {
  // ✅ Correct: Use USER ID for room presence
  await setMemberOnline(roomId, userId, true)

  // ❌ Missing: Should also fetch and broadcast active players
  const activePlayers = await getActivePlayers(userId)
  socket.emit('room-joined', { members, activePlayers })
})

socket.on('room-game-move', ({ roomId, playerId, move }) => {
  // ✅ Correct: Use PLAYER ID for game actions
  // Validate that playerId belongs to a member in this room
})
```

---

## ❌ Inconsistency 3: Room Member Interface Missing Player Association

**Current Code** (`room_members` table):
```typescript
interface RoomMember {
  id: string
  roomId: string
  userId: string       // ✅ Correct: USER ID
  displayName: string
  isCreator: boolean
  // ❌ Missing: No link to user's players
}
```

**Need to Add** (runtime association, not DB schema):
```typescript
interface RoomMemberWithPlayers {
  member: RoomMember
  activePlayers: Player[]  // The user's active players
}
```

---

## ❌ Inconsistency 4: Client UI Shows Room Members, Not Players

**Current Code** (`/arcade/rooms/[roomId]/page.tsx`):
```typescript
// Shows room members (users)
{members.map((member) => (
  <div key={member.id}>
    {member.displayName} {/* USER's display name */}
  </div>
))}

// ❌ Missing: Should show the PLAYERS that will participate
```

**Should Show**:
```typescript
{members.map((member) => (
  <div key={member.id}>
    <div>{member.displayName} (Room Member)</div>
    <div>Players:
      {member.activePlayers.map(player => (
        <span key={player.id}>{player.emoji} {player.name}</span>
      ))}
    </div>
  </div>
))}
```

---

## Summary of Required Changes

### Phase 1: Backend - Player Fetching
1. ✅ `room_members` table correctly uses USER ID (no change needed)
2. ❌ `/api/arcade/rooms/:roomId/join` - Fetch and return active players
3. ❌ `/api/arcade/rooms/:roomId` GET - Include active players in response
4. ❌ Create helper: `getActivePlayers(userId) => Player[]`

### Phase 2: Socket Layer - Player Association
1. ❌ `join-room` event - Broadcast active players to room
2. ❌ `room-game-move` event - Accept PLAYER ID, not USER ID
3. ❌ Validate PLAYER ID belongs to a room member

### Phase 3: Frontend - Player Display
1. ❌ Room lobby - Show each member's active players
2. ❌ Game setup - Use PLAYER IDs for `activePlayers` array
3. ❌ Move/action events - Send PLAYER ID

### Phase 4: Game Integration
1. ❌ When room game starts, collect all PLAYER IDs from all members
2. ❌ Arcade session `activePlayers` should contain all room PLAYER IDs
3. ❌ Game state tracks scores/moves by PLAYER ID, not USER ID

---

## Test Scenarios

### Scenario 1: Single Player Per User
```
USER Jane (guest_123)
  └─ PLAYER Alice (active)

Joins room → Room shows "Jane: Alice 👧"
Game starts → activePlayers: ["alice_id"]
```

### Scenario 2: Multiple Players Per User
```
USER Jane (guest_123)
  ├─ PLAYER Alice (active)
  └─ PLAYER Bob (active)

Joins room → Room shows "Jane: Alice 👧, Bob 👦"
Game starts → activePlayers: ["alice_id", "bob_id"]
```

### Scenario 3: Multi-User Room
```
USER Jane
  └─ PLAYER Alice, Bob (active)

USER Mark
  └─ PLAYER Mario (active)

USER Sara
  └─ PLAYER Luna, Nova, Star (active)

Room shows:
  - Jane: Alice 👧, Bob 👦
  - Mark: Mario 🍄
  - Sara: Luna 🌙, Nova ✨, Star ⭐

Game starts → activePlayers: [alice, bob, mario, luna, nova, star]
Total: 6 players across 3 users
```
