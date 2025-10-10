# Soroban Abacus Flashcards - Terminology Reference

## User vs Player vs Room Member

**CRITICAL**: Do not confuse these three concepts!

### Quick Reference

- **USER** = Identity/account (one per person, identified by `guestId` cookie)
- **PLAYER** = Game avatar/profile (multiple per user, from `players` table)
- **ROOM MEMBER** = USER's participation in a multiplayer room

### Key Rule

**When a USER joins a room, their ACTIVE PLAYERS join the game.**

Example:

- USER "Jane" has 3 players: Alice, Bob, Charlie
- Alice and Bob are active (`isActive: true`)
- When Jane joins a room, Alice and Bob participate in the game
- The `arcade_sessions.activePlayers` array contains `[alice_id, bob_id]`

### Database Schema

```
users (identity)
  ├─ players (avatars/profiles) - where isActive = true
  └─ room_members (room participation)

arcade_sessions
  ├─ userId: references users.id
  ├─ activePlayers: Array<player.id> ← PLAYER IDs, not USER IDs!
  └─ roomId: references arcade_rooms.id
```

### Common Mistakes to Avoid

❌ Using USER ID in `activePlayers` - should be PLAYER IDs
❌ Assuming one USER = one PLAYER - users can have multiple players
❌ Tracking game moves/scores by USER - should track by PLAYER
❌ Confusing room_members.displayName with players.name - different concepts

### Full Documentation

See: `docs/terminology-user-player-room.md` for complete explanation with examples.

## Other Project-Specific Terms

### Arcade vs Games

- **`/games/*`** - Single player or local multiplayer (same device)
- **`/arcade/*`** - Online multiplayer with sessions and rooms

### Session Types

- **Solo Session**: `arcade_sessions.roomId = null`, user playing alone
- **Room Session**: `arcade_sessions.roomId = room_xyz`, shared game state across room members
