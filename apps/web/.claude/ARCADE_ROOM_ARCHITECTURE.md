# Arcade Room Architecture

## Key Discoveries (January 2026)

### 1. One Room Rule (Modal Room Enforcement)

**Users can only be in one room at a time.** When a user creates or joins a new room, they are automatically removed from any previous room.

**Implementation:** `addRoomMember()` in `src/lib/arcade/room-membership.ts` handles this:

```typescript
const autoLeaveResult = await autoLeaveOtherRooms(userId);
// Returns { leftRooms: string[] } with room IDs the user was removed from
```

**Critical Insight:** This auto-leave happens silently on the server. If clients holding references to the old room aren't notified, they'll get 403 errors when trying to update settings or interact with that room.

### 2. Socket Broadcasting for Auto-Leave Events

**Problem We Solved:** When auto-leave happens, ALL clients need to be notified:

- The user who was auto-left (so their UI updates)
- Other members of the old room (so they see the member left)

**Solution:** Both room creation and join endpoints now broadcast `member-left` events:

```typescript
// In room creation and join routes
if (autoLeaveResult?.leftRooms.length > 0) {
  for (const leftRoomId of autoLeaveResult.leftRooms) {
    io.to(`room:${leftRoomId}`).emit("member-left", {
      roomId: leftRoomId,
      userId: viewerId,
      members: updatedMembers,
      memberPlayers: updatedPlayers,
      reason: "auto-left",
    });
  }
}
```

**Files involved:**

- `src/app/api/arcade/rooms/route.ts` (room creation)
- `src/app/api/arcade/rooms/[roomId]/join/route.ts` (room join)

### 3. Idempotent Leave Endpoint

**Problem:** Calling leave on a room you're already not a member of (e.g., after auto-leave) returned 400.

**Solution:** The leave endpoint is now idempotent:

```typescript
// src/app/api/arcade/rooms/[roomId]/leave/route.ts
if (!isMemberOfRoom) {
  return NextResponse.json({ success: true, alreadyLeft: true });
}
```

### 4. React Strict Mode Double-Rendering

**Problem:** Hooks that create resources (like `useGameBreakRoom`) can be called twice in development due to Strict Mode's intentional double-rendering.

**Solution Pattern:**

```typescript
const isCreatingRef = useRef(false);
const hasStartedRef = useRef(false);

useEffect(() => {
  if (hasStartedRef.current || isCreatingRef.current) return;
  hasStartedRef.current = true;
  isCreatingRef.current = true;

  async function initRoom() {
    try {
      const result = await createRoom();
      // Handle result
    } finally {
      isCreatingRef.current = false;
    }
  }

  initRoom();
  // NO cleanup that destroys the resource here - let explicit cleanup() handle it
}, [enabled]);
```

**Key insight:** Don't use `mounted` flags that trigger cleanup during Strict Mode's simulated unmount. Use refs to prevent duplicate creation, and provide an explicit `cleanup()` function for intentional teardown.

---

## Integration: Practice System + Arcade Rooms

### Game Break Flow

The practice system uses arcade rooms for "game breaks" - short play sessions between practice parts.

**Trigger Condition:** Game breaks occur between session parts (abacus → visualization → linear), NOT after a fixed time interval.

**Complete Flow:**

1. **Student completes last problem of Part 1** (e.g., abacus section)
2. **`handleAnswer` in `PracticeClient.tsx`** detects part transition (currentPartIndex increased)
3. If `gameBreakSettings.enabled`, sets `pendingGameBreak = true`
4. **`PartTransitionScreen` appears** ("Put your abacus aside, Mental Math Time!")
   - 7-second countdown, or student clicks Skip
5. **`onPartTransitionComplete` callback** fires when transition screen finishes
6. **`handlePartTransitionComplete`** checks `pendingGameBreak` flag
7. If pending, **`GameBreakScreen` appears** with game selection
8. **`useGameBreakRoom` hook** creates a temporary arcade room
9. Student plays selected arcade game
10. Break ends via: timeout, game finishes (results phase), or "Back to Practice" button
11. **`cleanup()` leaves the room**, practice resumes with Part 2

**Why transition screen first?** The transition messages ("Put your abacus aside") are pedagogically important - they prepare the student mentally and physically for the next part type.

**Key files:**

- `src/app/practice/[studentId]/PracticeClient.tsx` - Orchestrates the flow
- `src/components/practice/PartTransitionScreen.tsx` - Transition messages
- `src/components/practice/GameBreakScreen.tsx` - Game selection/play
- `src/hooks/useGameBreakRoom.ts` - Room lifecycle management

### Room Types (Conceptual)

Currently no explicit distinction, but rooms serve different purposes:

| Use Case    | Created By                  | Lifetime          | Game Selection  |
| ----------- | --------------------------- | ----------------- | --------------- |
| Solo arcade | `/arcade` page auto-creates | Until user leaves | User selects    |
| Multiplayer | User creates, shares code   | Until all leave   | Host selects    |
| Game break  | Practice system             | Duration of break | Student selects |

### Game Completion Detection

The practice system needs to know when a student finishes a game to end the break early. This is done by listening for `gamePhase` transitions.

**Critical Socket Event Distinction:**

| Event           | When Emitted                         | Contains Game State? |
| --------------- | ------------------------------------ | -------------------- |
| `session-state` | Only when client **joins** a session | Yes                  |
| `move-accepted` | After every game move during play    | Yes                  |

**Common Mistake:** Listening only to `session-state` for game completion. This won't work because `session-state` is only sent on join - during gameplay, all state updates come through `move-accepted`.

**Implementation:**

```typescript
// In PracticeGameModeProvider.tsx
// MUST listen to BOTH events to catch game completion
useArcadeSocket({
  onSessionState: handleStateUpdate, // Initial state on join
  onMoveAccepted: handleStateUpdate, // State changes during gameplay
});

function handleStateUpdate(data: { gameState: unknown }) {
  const currentPhase = (data.gameState as { gamePhase?: string })?.gamePhase;

  // Detect transition TO 'results' phase
  if (currentPhase === "results" && previousPhase !== "results") {
    onGameComplete?.(); // End the game break
  }

  previousPhase = currentPhase;
}
```

**Why socket events?**

- Non-invasive: No changes required to existing games
- Centralized: One listener catches all game completions
- Reliable: Socket events are the source of truth for game state

**Games that end naturally:**

Games with a `'results'` phase (matching, memory-quiz, know-your-world) will automatically trigger game completion when they finish.

**Endless games:**

Games without a `'results'` phase (complement-race) will only end via:

- Break timer expiring
- Student clicking "Back to Practice"

This is expected behavior - the practice system handles both cases gracefully.

---

## Known Gaps and Future Improvements

### 1. Centralized Socket Broadcasting

**Current state:** Socket broadcasts for auto-leave are duplicated in room creation and join routes.

**Improvement:** Move broadcasting logic into `room-membership.ts`:

```typescript
// Proposed: addRoomMember handles its own broadcasting
export async function addRoomMember(params, io?: Server) {
  const autoLeaveResult = await autoLeaveOtherRooms(userId);

  // Centralized broadcasting
  if (io && autoLeaveResult.leftRooms.length > 0) {
    await broadcastAutoLeave(io, userId, autoLeaveResult.leftRooms);
  }

  // ... rest of logic
}
```

### 2. Room State Provider

**Current state:** Components fetch room data via `useRoomData()` which polls/caches.

**Improvement:** A unified `RoomProvider` context that:

- Maintains current room state
- Subscribes to socket events
- Auto-updates when auto-left or kicked
- Provides `currentRoom`, `isInRoom`, `leaveRoom()` etc.

### 3. Temporary vs Persistent Rooms

**Current state:** No distinction between temporary (game break) and persistent (multiplayer) rooms.

**Potential improvement:** Room metadata could include:

```typescript
interface Room {
  // ... existing fields
  lifetime: "temporary" | "persistent";
  expiresAt?: Date; // Auto-cleanup for temporary rooms
  parentContext?: {
    type: "practice-break";
    sessionId: string;
  };
}
```

### 4. API Response Consistency

**Current state:** Room creation returns `CreateRoomResult` with `{ room, autoLeave }`.

**Improvement:** All room mutation endpoints could return consistent structure:

```typescript
interface RoomMutationResult {
  room: RoomData;
  autoLeave?: { roomIds: string[] };
  socketEvents?: string[]; // Events that were broadcast
}
```

---

## Debugging Checklist

When debugging room-related issues:

1. **403 on room operations?**
   - Check if user was auto-left from the room
   - Verify socket `member-left` event was received
   - Check `useRoomData()` cache is updated

2. **Duplicate room creation?**
   - Check React Strict Mode double-rendering
   - Verify `isCreatingRef` or similar guard is in place

3. **Stale room state in UI?**
   - Socket connection established?
   - Subscribed to correct room channel (`room:${roomId}`)?
   - React Query cache invalidated?

4. **Leave not working?**
   - Endpoint is idempotent - check `alreadyLeft` in response
   - Verify room ID is correct (not stale reference)

5. **Game completion not detected?**
   - Are you listening to `move-accepted`? (NOT just `session-state`)
   - `session-state` only fires on join, not during gameplay
   - Check if game emits `gamePhase: 'results'` (endless games don't)
   - Verify socket joined the session (`joinSession(viewerId, roomId)`)
