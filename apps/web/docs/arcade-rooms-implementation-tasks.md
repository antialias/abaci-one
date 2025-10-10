# Arcade Rooms Implementation Task List

This is the detailed implementation task list for the arcade rooms feature. Use this to restore the TodoWrite list if the session is interrupted.

## Phase 1: Database & API Foundation

- [ ] Phase 1.1: Create database migration for arcade_rooms and room_members tables
- [ ] Phase 1.2: Implement room-manager.ts with CRUD operations (create, get, update, delete)
- [ ] Phase 1.3: Implement room-membership.ts for member management
- [ ] Phase 1.4: Build API endpoints for room CRUD (/api/arcade/rooms/\*)
- [ ] Phase 1.5: Add room code generation utility
- [ ] Phase 1.6: Implement TTL cleanup system for rooms

### Testing Checkpoint 1

- [ ] TESTING CHECKPOINT 1: Write unit tests for all room manager functions
- [ ] TESTING CHECKPOINT 1: Write unit tests for room membership functions
- [ ] TESTING CHECKPOINT 1: Write API endpoint tests for room CRUD operations
- [ ] TESTING CHECKPOINT 1: Manual testing of room creation, joining, and TTL cleanup

## Phase 2: Socket.IO Integration

- [ ] Phase 2.1: Update socket-server.ts for room namespacing
- [ ] Phase 2.2: Implement room-scoped broadcasts in socket handlers
- [ ] Phase 2.3: Add presence tracking for room members
- [ ] Phase 2.4: Update session-manager.ts to support roomId
- [ ] Phase 2.5: Update game state sync to respect room boundaries

### Testing Checkpoint 2

- [ ] TESTING CHECKPOINT 2: Write integration tests for multi-user room sessions
- [ ] TESTING CHECKPOINT 2: Write tests for room-scoped broadcasts
- [ ] TESTING CHECKPOINT 2: Manual testing of multi-tab synchronization within rooms
- [ ] TESTING CHECKPOINT 2: Verify backward compatibility with solo play (no roomId)

## Phase 3: Guest User System

- [ ] Phase 3.1: Implement guest ID generation and storage
- [ ] Phase 3.2: Create useGuestUser hook for guest authentication
- [ ] Phase 3.3: Update auth flow to support optional guest access
- [ ] Phase 3.4: Update API endpoints to accept guest user IDs

### Testing Checkpoint 3

- [ ] TESTING CHECKPOINT 3: Write unit tests for guest ID system
- [ ] TESTING CHECKPOINT 3: Manual testing of guest join flow
- [ ] TESTING CHECKPOINT 3: Test guest user persistence across page refreshes

## Phase 4: UI Components

- [ ] Phase 4.1: Build CreateRoomDialog component with form validation
- [ ] Phase 4.2: Build RoomLobby component showing current room state
- [ ] Phase 4.3: Build RoomLobbyBrowser for public room discovery
- [ ] Phase 4.4: Add RoomContextIndicator to navigation bar
- [ ] Phase 4.5: Wire up useRoom and useRoomMembership hooks
- [ ] Phase 4.6: Implement player selection UI when joining room

### Testing Checkpoint 4

- [ ] TESTING CHECKPOINT 4: Write component unit tests for all room UI components
- [ ] TESTING CHECKPOINT 4: Manual UI testing of room creation flow
- [ ] TESTING CHECKPOINT 4: Manual UI testing of room browser and filtering
- [ ] TESTING CHECKPOINT 4: Test player selection flow when joining rooms

## Phase 5: Routes & Navigation

- [ ] Phase 5.1: Create /arcade/rooms route structure
- [ ] Phase 5.2: Create /arcade/rooms/:roomId route with room lobby
- [ ] Phase 5.3: Create /arcade/rooms/:roomId/:game routes for in-room gameplay
- [ ] Phase 5.4: Update arcade home to include room access entry points
- [ ] Phase 5.5: Add room selector/switcher to navigation
- [ ] Phase 5.6: Implement join-by-code flow with code input dialog
- [ ] Phase 5.7: Add share room functionality (copy link, share code)

### Testing Checkpoint 5

- [ ] TESTING CHECKPOINT 5: Write E2E tests for room creation navigation flow
- [ ] TESTING CHECKPOINT 5: Write E2E tests for join-by-URL flow
- [ ] TESTING CHECKPOINT 5: Write E2E tests for join-by-code flow
- [ ] TESTING CHECKPOINT 5: Manual testing of room navigation across different states

## Phase 6: Final Testing & Polish

- [ ] Phase 6.1: Write E2E tests for complete room creation and join flow
- [ ] Phase 6.2: Write E2E tests for multi-user gameplay in rooms
- [ ] Phase 6.3: Write tests for TTL expiration and cleanup behavior
- [ ] Phase 6.4: Write E2E tests for guest user complete flow
- [ ] Phase 6.5: Write tests for room creator permissions (kick, lock, delete)
- [ ] Phase 6.6: Performance testing with multiple concurrent rooms
- [ ] Phase 6.7: Performance testing with many users in single room
- [ ] Phase 6.8: Add error states and loading states to all UI components
- [ ] Phase 6.9: Add user feedback toasts for room operations
- [ ] Phase 6.10: Final manual user testing of complete room system
- [ ] Phase 6.11: Cross-browser testing (Chrome, Firefox, Safari)
- [ ] Phase 6.12: Mobile responsiveness testing for room UI

---

## Notes

- Total: 62 tasks across 6 phases
- 20 dedicated testing tasks (32% of total)
- Reference: `/Users/antialias/projects/soroban-abacus-flashcards/apps/web/docs/arcade-rooms-technical-plan.md`

## Restoring TodoWrite

To restore this list to TodoWrite format, convert each task to:

```json
{
  "content": "Task description",
  "status": "pending|in_progress|completed",
  "activeForm": "Present continuous form (e.g., 'Creating...')"
}
```
