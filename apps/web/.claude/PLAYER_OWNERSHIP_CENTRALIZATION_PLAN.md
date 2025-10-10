# Player Ownership Centralization Plan

## Problem Statement

Player ownership logic is currently scattered across multiple locations in the codebase, leading to bugs and inconsistencies. The same pattern appears in:

1. **Server-side** (`session-manager.ts:232-239`): Builds `playerOwnership` map from database
2. **Client-side** (`RoomMemoryPairsProvider.tsx:370-403`): Builds `playerOwnership` from `roomData.memberPlayers`
3. **UI Components** (`PlayerStatusBar.tsx:31`, `MemoryGrid.tsx:388`): Check `player.userId === viewerId`
4. **Validation** (`MatchingGameValidator.ts:88-102`): Validates player ownership

## Current Implementations

### Server-Side (session-manager.ts)
```typescript
// Lines 232-238
const players = await db.query.players.findMany({
  columns: { id: true, userId: true }
})
playerOwnership = Object.fromEntries(players.map(p => [p.id, p.userId]))
```

### Client-Side (RoomMemoryPairsProvider.tsx)
```typescript
// Lines 370-403
const buildPlayerMetadata = useCallback((playerIds: string[]) => {
  const playerOwnership = new Map<string, string>()
  if (roomData?.memberPlayers) {
    for (const [userId, userPlayers] of Object.entries(roomData.memberPlayers)) {
      for (const player of userPlayers) {
        playerOwnership.set(player.id, userId)
      }
    }
  }
  // ... use playerOwnership to assign correct userId
}, [players, roomData, viewerId])
```

## Centralization Strategy

### Phase 1: Create Shared Utilities Module
**File**: `src/lib/arcade/player-ownership.ts`

Create a module with:
1. **Server-side utility**: `buildPlayerOwnershipMap(roomId?: string)`
   - Fetches from database
   - Returns `Record<playerId, userId>`
   - Used by `session-manager.ts`

2. **Client-side utility**: `buildPlayerOwnershipFromRoomData(roomData)`
   - Builds from `RoomData.memberPlayers`
   - Returns `Map<playerId, userId>` or `Record<playerId, userId>`
   - Used by React components

3. **Shared types**: `PlayerOwnershipMap = Record<string, string>`

4. **Helper functions**:
   - `isPlayerOwnedByUser(playerId, userId, ownershipMap)`
   - `getPlayerOwner(playerId, ownershipMap)`
   - `buildPlayerMetadata(playerIds, ownershipMap, playersMap)` - combines ownership + player data

### Phase 2: Update Server-Side Code
**Files**:
- `src/lib/arcade/session-manager.ts`
- `src/lib/arcade/player-manager.ts`

Changes:
1. Import utilities from `player-ownership.ts`
2. Replace inline ownership building with `buildPlayerOwnershipMap()`
3. Add new function to `player-manager.ts`: `getPlayerOwnershipMap(roomId)`

### Phase 3: Update Client-Side Providers
**Files**:
- `src/app/arcade/matching/context/RoomMemoryPairsProvider.tsx`
- Any other game providers that need this logic

Changes:
1. Import utilities from `player-ownership.ts`
2. Replace `buildPlayerMetadata` with centralized version
3. Use shared helper functions for ownership checks

### Phase 4: Update UI Components
**Files**:
- `src/app/arcade/matching/components/PlayerStatusBar.tsx`
- `src/app/arcade/matching/components/MemoryGrid.tsx`
- `src/components/PageWithNav.tsx`
- `src/contexts/GameModeContext.tsx`

Changes:
1. Use centralized `isPlayerOwnedByUser()` helper
2. Consistent API across all components

### Phase 5: Add to API Endpoints (if needed)
**Files**:
- `src/app/api/arcade/rooms/[roomId]/route.ts`
- Any endpoints that return player data

Changes:
1. Include `playerOwnership` map in API responses where practical
2. Document in API response types

## Benefits

1. **Single Source of Truth**: All ownership logic in one place
2. **Consistency**: Same algorithm server-side and client-side
3. **Testability**: Can unit test ownership logic in isolation
4. **Type Safety**: Shared types across client/server boundary
5. **Maintainability**: Bug fixes only need to be made once
6. **Documentation**: Central location for ownership algorithm docs

## Implementation Order (One Commit Per Phase)

1. ✅ **Commit 1**: Create `src/lib/arcade/player-ownership.ts` with all utilities and tests
2. ✅ **Commit 2**: Update `session-manager.ts` to use new utilities
3. ✅ **Commit 3**: Update `player-manager.ts` to export ownership helper
4. ✅ **Commit 4**: Update `RoomMemoryPairsProvider.tsx` to use utilities
5. ✅ **Commit 5**: Update UI components to use helper functions
6. ✅ **Commit 6**: Update API endpoints to include ownership data (if needed)
7. ✅ **Commit 7**: Add comprehensive integration tests

## Key Design Decisions

### Server vs Client Implementations

**Why separate implementations?**
- Server uses database queries (async)
- Client uses in-memory `RoomData` (sync)
- Different data sources, same logic

**Shared interface:**
```typescript
type PlayerOwnershipMap = Record<string, string> // playerId -> userId

// Server-side (async)
async function buildPlayerOwnershipMap(roomId: string): Promise<PlayerOwnershipMap>

// Client-side (sync)
function buildPlayerOwnershipFromRoomData(
  roomData: RoomData
): PlayerOwnershipMap
```

### Type Consistency

Both return the same structure:
```typescript
{
  "player-id-1": "user-id-1",
  "player-id-2": "user-id-1",
  "player-id-3": "user-id-2"
}
```

This allows validators, helpers, and checks to work identically regardless of source.

## Migration Path

1. Create new module alongside existing code
2. Add tests for new utilities
3. Gradually migrate files one at a time
4. Remove old implementations after migration complete
5. Deprecate old patterns in documentation

## Testing Strategy

1. **Unit tests** for utilities in isolation
2. **Integration tests** for server-side flow
3. **Component tests** for client-side usage
4. **E2E tests** for full multiplayer scenarios

## Documentation

Add to existing docs:
- Update `ARCADE_ARCHITECTURE.md` with new utilities section
- Update `MULTIPLAYER_SYNC_ARCHITECTURE.md` with ownership flow
- Add JSDoc comments to all exported functions
