# Arcade System Architecture

## Overview

The arcade system supports two distinct game modes that must remain completely isolated:

1. **Local Play** - Games without network synchronization (single-player OR local multiplayer)
2. **Room-Based Play** - Networked games with real-time synchronization across room members

---

## 1. Core Terminology

| Term | Definition | Storage |
|------|------------|---------|
| **USER** | Identity (guest or authenticated account) | Retrieved via `useViewerId()`, one per browser/account |
| **PLAYER** | Game avatar/profile (e.g., "Alice") | `players` table, many per USER |
| **ACTIVE PLAYERS** | PLAYERS with `isActive = true` | These actually participate in games |
| **ROOM MEMBER** | A USER's participation in a multiplayer room | `room_members` table |
| **SPECTATOR** | Room member watching without participating | No active PLAYERS in current game |

**Key Relationships:**
- Session ownership: Tracked by USER ID
- Game actions: Performed by PLAYER ID
- Move validation: Server checks PLAYER belongs to requesting USER
- `arcade_sessions.activePlayers` - Array of PLAYER IDs (only `isActive = true`)

---

## 2. Game Synchronization Modes

### Local Play (No Network Sync)

```typescript
useArcadeSession({
  userId: viewerId,
  roomId: undefined,  // Explicitly undefined - no network sync
  ...
})
```

- State lives only in current browser tab
- CAN have multiple ACTIVE PLAYERS (local multiplayer / hot-potato)
- Session key = `userId`

### Room-Based Play (Network Sync)

```typescript
useArcadeSession({
  userId: viewerId,
  roomId: roomData?.id,  // Enables network sync
  ...
})
```

- Syncs game state across all room members via WebSocket
- Non-playing members become SPECTATORS automatically
- Session key = `roomId`

---

## 3. Provider Architecture

**Always use separate providers** - one for local, one for room-based play.

```typescript
// context/LocalGameProvider.tsx
export function LocalGameProvider({ children }) {
  const { data: viewerId } = useViewerId()
  const { activePlayers } = useGameMode()
  // NEVER fetch room data for local play

  const { state, sendMove } = useArcadeSession({
    userId: viewerId || '',
    roomId: undefined,  // No network sync
    ...
  })
}

// context/RoomGameProvider.tsx
export function RoomGameProvider({ children }) {
  const { data: viewerId } = useViewerId()
  const { roomData } = useRoomData()
  const { activePlayers } = useGameMode()

  const { state, sendMove } = useArcadeSession({
    userId: viewerId || '',
    roomId: roomData?.id,  // Network sync enabled
    ...
  })
}
```

---

## 4. Room Management

### One Room Rule

**Users can only be in one room at a time.** Creating/joining a room auto-removes from previous rooms.

**Implementation:** `addRoomMember()` in `src/lib/arcade/room-membership.ts`

### Socket Broadcasting for Auto-Leave

Both room creation and join endpoints broadcast `member-left` events:
```typescript
if (autoLeaveResult?.leftRooms.length > 0) {
  for (const leftRoomId of autoLeaveResult.leftRooms) {
    io.to(`room:${leftRoomId}`).emit('member-left', {
      roomId: leftRoomId,
      userId: viewerId,
      reason: 'auto-left',
    })
  }
}
```

### Idempotent Leave

The leave endpoint returns success even if user already left.

### React Strict Mode Handling

For hooks that create resources, prevent double-creation:
```typescript
const isCreatingRef = useRef(false)
const hasStartedRef = useRef(false)

useEffect(() => {
  if (hasStartedRef.current || isCreatingRef.current) return
  hasStartedRef.current = true
  isCreatingRef.current = true
  // ... create room
}, [enabled])
```

---

## 5. Spectator Mode

Any room member without active PLAYERS becomes a spectator automatically.

```typescript
const localPlayerId = useMemo(() => {
  return Array.from(activePlayers).find((id) => {
    const player = players.get(id)
    return player?.isLocal !== false
  })
}, [activePlayers, players])

// Actions check if local player exists
const startGame = useCallback(() => {
  if (!localPlayerId) return  // Spectators cannot interact
  sendMove({ type: 'START_GAME', playerId: localPlayerId, ... })
}, [localPlayerId, sendMove])
```

---

## 6. Synchronized Setup Pattern

Setup configuration is **game state**, not UI state. Configuration changes are **moves**.

### Required Move Types

| Move | Purpose | When Allowed |
|------|---------|--------------|
| `GO_TO_SETUP` | Return to setup phase | Any phase |
| `SET_CONFIG` | Update a config field | Setup phase only |
| `START_GAME` | Start with current config | Setup phase only |

### Implementation

```typescript
// ❌ WRONG - local state for config
const [localDifficulty, setLocalDifficulty] = useState(6)

// ✅ CORRECT - config changes are moves
const setDifficulty = useCallback((value) => {
  sendMove({ type: 'SET_CONFIG', playerId, data: { field: 'difficulty', value } })
}, [sendMove])
```

---

## 7. Routing Architecture

### URL Structure

```
/arcade                    → Champion Arena (game selector)
/arcade/room               → Active game or game selection UI
/arcade/room?game={name}   → Query param for game selection
/arcade/{game-name}        → Legacy direct game pages
```

### /arcade/room Page States

1. **Loading** - Waiting for `useRoomData()` to resolve
2. **Game Selection** - When `!roomData.gameName`, shows game selector
3. **Game Display** - Renders game from registry

---

## 8. Game Completion Detection

For practice system integration, listen to BOTH socket events:

```typescript
useArcadeSocket({
  onSessionState: handleStateUpdate,  // Initial state
  onMoveAccepted: handleStateUpdate,  // State changes during play
})

function handleStateUpdate(data: { gameState: unknown }) {
  const currentPhase = (data.gameState as { gamePhase?: string })?.gamePhase
  if (currentPhase === 'results' && previousPhase !== 'results') {
    onGameComplete?.()
  }
}
```

**Common mistake:** Listening only to `session-state` won't detect game completion.

---

## 9. Error Handling

```typescript
<ArcadeErrorProvider>
  <ArcadeErrorBoundary>
    <YourGameProvider>
      <YourGameComponent />
    </YourGameProvider>
  </ArcadeErrorBoundary>
</ArcadeErrorProvider>

// Use in components
const { addError } = useArcadeError()
addError('User-friendly message', 'Technical details...')
```

`useArcadeSocket` auto-shows toasts for connection errors, disconnections, and move rejections.

---

## 10. Common Mistakes

| Mistake | Fix |
|---------|-----|
| Room sync leaks into local play | Use separate providers, `roomId: undefined` for local |
| Using USER ID for game actions | Use PLAYER ID from game state |
| Using all players instead of active | Filter by `isActive = true` |
| Thinking multiplayer = networked | Check `roomId` for network sync, not player count |

---

## 11. Debugging Checklists

### Room Issues

| Symptom | Check |
|---------|-------|
| 403 on room operations | User auto-left? Socket `member-left` received? |
| Duplicate room creation | React Strict Mode? `isCreatingRef` guard? |
| Stale room state | Socket connected? Query cache invalidated? |
| Game completion not detected | Listening to `move-accepted`? |

### Setup Sync Issues

| Symptom | Check |
|---------|-------|
| Config not syncing | Using `SET_CONFIG` move? Local state leaking? |
| Config lost on start | `START_GAME` using session state config? |

---

## 12. New Game Checklist

- [ ] Create separate `LocalGameProvider` and `RoomGameProvider`
- [ ] Local provider: `roomId: undefined`, never calls `useRoomData()`
- [ ] Room provider: `roomId: roomData?.id`
- [ ] Implement `GO_TO_SETUP`, `SET_CONFIG`, `START_GAME` moves
- [ ] Use PLAYER IDs (not USER IDs) for moves
- [ ] Check `!localPlayerId` before allowing moves (spectator safety)
- [ ] Wrap page with `ArcadeErrorProvider` and `ArcadeErrorBoundary`

---

## 13. Key Files

### Hooks
- `src/hooks/useArcadeSession.ts` - Session management
- `src/hooks/useArcadeSocket.ts` - WebSocket sync
- `src/hooks/useRoomData.ts` - Room fetching
- `src/hooks/useViewerId.ts` - Current USER ID

### Contexts
- `src/contexts/GameModeContext.tsx` - Active PLAYER info
- `src/contexts/ArcadeErrorContext.tsx` - Error management

### Server
- `src/lib/arcade/room-membership.ts` - Room membership logic
- `src/lib/arcade/validation/` - Game validators
- `src/lib/arcade/game-registry.ts` - Game registry

### Reference Implementation
- `src/app/arcade/matching/` - Complete example
