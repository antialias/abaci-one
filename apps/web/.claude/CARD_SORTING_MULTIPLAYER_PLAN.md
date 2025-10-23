# Card Sorting: Multiplayer & Spectator Features Plan

## Overview
Add collaborative and competitive multiplayer modes to the card-sorting game, plus enhanced spectator experience with real-time player indicators.

---

## 1. Core Feature: Player Emoji on Moving Cards

**When any player (including network players) moves a card, show their emoji on it.**

### Data Structure Changes

#### `CardPosition` type enhancement:
```typescript
export interface CardPosition {
  cardId: string
  x: number // % of viewport width (0-100)
  y: number // % of viewport height (0-100)
  rotation: number // degrees (-15 to 15)
  zIndex: number
  draggedByPlayerId?: string // NEW: ID of player currently dragging this card
}
```

### Implementation Details

1. **When starting drag (local player):**
   - Set `draggedByPlayerId` to current player's ID
   - Broadcast position update immediately with this field

2. **During drag:**
   - Continue including `draggedByPlayerId` in position updates
   - Other clients show the emoji overlay

3. **When ending drag:**
   - Clear `draggedByPlayerId` (set to `undefined`)
   - Broadcast final position without this field

4. **Visual indicator:**
   - Show player emoji in top-right corner of card
   - Semi-transparent background circle
   - Small size (24-28px diameter)
   - Positioned absolutely within card container
   - Example styling:
     ```typescript
     {
       position: 'absolute',
       top: '4px',
       right: '4px',
       width: '28px',
       height: '28px',
       borderRadius: '50%',
       background: 'rgba(255, 255, 255, 0.9)',
       display: 'flex',
       alignItems: 'center',
       justifyContent: 'center',
       fontSize: '18px',
       boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
       border: '2px solid rgba(59, 130, 246, 0.6)',
       zIndex: 10
     }
     ```

5. **Access to player metadata:**
   - Need to map `playerId` → `PlayerMetadata`
   - Current state only has single `playerMetadata`
   - For multiplayer, Provider needs to maintain `players: Map<string, PlayerMetadata>`
   - Get from room members data

---

## 2. Spectator Mode UI Enhancements

### 2.1 Spectator Banner
**Top banner that clearly indicates spectator status**

```typescript
<div style={{
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  height: '48px',
  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
  color: 'white',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 24px',
  zIndex: 100,
  boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
}}>
  <div>👀 Spectating: {playerName} {playerEmoji}</div>
  <div>Progress: {cardsPlaced}/{totalCards} cards placed</div>
</div>
```

### 2.2 Educational Mode Toggle
**Allow spectators to see the correct answer (for learning)**

- Toggle button in spectator banner
- When enabled: show faint green checkmarks on correctly positioned cards
- Don't show actual numbers unless player revealed them

### 2.3 Player Stats Sidebar
**Show real-time stats (optional, can collapse)**

- Time elapsed
- Cards placed vs. total
- Number of moves made
- Current accuracy (% of cards in correct relative order)

---

## 3. Collaborative Mode: "Team Sort"

### 3.1 Core Mechanics
- Multiple players share the same board and card set
- Anyone can move any card at any time
- Shared timer and shared score
- Team wins/loses together

### 3.2 State Changes

#### `CardSortingState` additions:
```typescript
export interface CardSortingState extends GameState {
  // ... existing fields ...

  gameMode: 'solo' | 'collaborative' | 'competitive' | 'relay' // NEW
  players: Map<string, PlayerMetadata> // NEW: all active players
  activePlayers: string[] // NEW: players currently in game (not spectators)
}
```

### 3.3 Visual Indicators

1. **Colored cursors for each player:**
   - Show a small colored dot/cursor at other players' pointer positions
   - Color derived from player's emoji or assigned color
   - Update positions via WebSocket (throttled to 30Hz)

2. **Card claiming indicator:**
   - When player starts dragging, show their emoji on card (as per feature #1)
   - Other players see animated emoji bouncing slightly
   - Prevents confusion about who's moving what

3. **Activity feed (optional):**
   - Small toast notifications for key actions
   - "🎭 Bob placed card #3"
   - "🦊 Alice revealed numbers"
   - Auto-dismiss after 3 seconds

### 3.4 New Moves

```typescript
// In CardSortingMove union:
| {
    type: 'JOIN_COLLABORATIVE_GAME'
    playerId: string
    userId: string
    timestamp: number
    data: {
      playerMetadata: PlayerMetadata
    }
  }
| {
    type: 'LEAVE_COLLABORATIVE_GAME'
    playerId: string
    userId: string
    timestamp: number
    data: Record<string, never>
  }
```

### 3.5 Scoring
- Same scoring algorithm but labeled as "Team Score"
- All players see the same results
- Leaderboard entry records all participants

---

## 4. Competitive Mode: "Race Sort"

### 4.1 Core Mechanics
- 2-4 players get the **same** card set
- Each player has their **own separate board**
- Race to finish first OR best score after time limit
- Live leaderboard shows current standings

### 4.2 State Architecture

**Problem:** Current state is single-player only.

**Solution:** Each player needs their own game state, but they're in the same room.

#### Option A: Separate Sessions
- Each competitive player creates their own session
- Room tracks all session IDs
- Client fetches all sessions and displays them
- **Pros:** Minimal changes to game logic
- **Cons:** Complex room management

#### Option B: Multi-Player State (RECOMMENDED)
```typescript
export interface CompetitiveGameState extends GameState {
  gameMode: 'competitive'
  sharedCards: SortingCard[] // Same cards for everyone
  correctOrder: SortingCard[] // Shared answer
  playerBoards: Map<string, PlayerBoard> // Each player's board state
  gameStartTime: number
  gameEndTime: number | null
  winners: string[] // Player IDs who completed, in order
}

export interface PlayerBoard {
  playerId: string
  placedCards: (SortingCard | null)[]
  cardPositions: CardPosition[]
  availableCards: SortingCard[]
  numbersRevealed: boolean
  completedAt: number | null
  scoreBreakdown: ScoreBreakdown | null
}
```

### 4.3 UI Layout

**Split-screen view:**
```
┌─────────────────────────────────────┐
│  Leaderboard (top bar)              │
├──────────────┬──────────────────────┤
│              │                      │
│  Your Board  │   Opponent Preview   │
│  (full size) │   (smaller, ghosted) │
│              │                      │
└──────────────┴──────────────────────┘
```

**Your board:**
- Normal interactive gameplay
- Full size, left side

**Opponent preview(s):**
- Right side (or bottom on mobile)
- Smaller scale (50-70% size)
- Semi-transparent cards
- Shows their real-time positions
- Can toggle between different opponents

**Leaderboard bar:**
```
┌─────────────────────────────────────┐
│ 🥇 Alice (5/8) • 🥈 You (4/8) • ... │
└─────────────────────────────────────┘
```

### 4.4 Spectator View for Competitive
- Can watch all players simultaneously
- Grid layout showing all boards
- Highlight current leader with gold border

---

## 5. Hybrid Mode: "Relay Sort" (Future)

### 5.1 Core Mechanics
- Players take turns (30-60 seconds each)
- Cumulative team score
- Can "pass" turn early
- Strategy: communicate via chat about optimal moves

### 5.2 Turn Management
```typescript
export interface RelayGameState extends GameState {
  gameMode: 'relay'
  turnOrder: string[] // Player IDs
  currentTurnIndex: number
  turnStartTime: number
  turnDuration: number // seconds
  // ... rest similar to collaborative
}
```

---

## 6. Implementation Phases

### Phase 1: Foundation (Do First) ✅
- [x] Add `draggedByPlayerId` to `CardPosition`
- [x] Show player emoji on cards being dragged
- [x] Add `players` map to Provider context
- [x] Fetch room members and map to player metadata

### Phase 2: Spectator Enhancements
- [ ] Spectator banner component
- [ ] Educational mode toggle
- [ ] Stats sidebar (collapsible)

### Phase 3: Collaborative Mode
- [ ] Add `gameMode` to state and config
- [ ] Implement JOIN/LEAVE moves
- [ ] Colored cursor tracking
- [ ] Activity feed notifications
- [ ] Team scoring UI

### Phase 4: Competitive Mode
- [ ] Design multi-player state structure
- [ ] Refactor Provider for per-player boards
- [ ] Split-screen UI layout
- [ ] Live leaderboard
- [ ] Ghost opponent preview
- [ ] Winner determination

### Phase 5: Polish & Testing
- [ ] Mobile responsive layouts
- [ ] Performance optimization (many simultaneous players)
- [ ] Network resilience (handle disconnects)
- [ ] Accessibility (keyboard nav, screen readers)

---

## 7. Technical Considerations

### 7.1 WebSocket Message Frequency
- **Current:** Position updates throttled to 100ms (10Hz)
- **Collaborative:** May need higher frequency for smoothness
- **Recommendation:** 50ms (20Hz) for active drag, 100ms otherwise

### 7.2 State Synchronization
- Use optimistic updates for local player
- Reconcile with server state on conflicts
- Use timestamp-based conflict resolution

### 7.3 Player Disconnection Handling
- Collaborative: Keep their last positions, mark as "disconnected"
- Competitive: Pause their timer, allow rejoin within 60s
- Spectators: Just remove from viewer list

### 7.4 Security & Validation
- Server validates all moves (already done)
- Prevent players from seeing others' moves before they happen
- Rate limit position updates per player

---

## 8. Database Schema Changes

### New Tables

#### `competitive_rounds` (for competitive mode)
```sql
CREATE TABLE competitive_rounds (
  id UUID PRIMARY KEY,
  room_id UUID REFERENCES arcade_rooms(id),
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  card_set JSON, -- The shared cards
  winners JSON -- Array of player IDs in finish order
);
```

#### `player_round_results` (for competitive mode)
```sql
CREATE TABLE player_round_results (
  id UUID PRIMARY KEY,
  round_id UUID REFERENCES competitive_rounds(id),
  player_id UUID,
  score_breakdown JSON,
  completed_at TIMESTAMP,
  final_placement INTEGER -- 1st, 2nd, 3rd, etc.
);
```

---

## 9. Open Questions / Decisions Needed

1. **Collaborative: Card collision handling?**
   - What if two players try to grab the same card simultaneously?
   - Option A: First one wins, second gets error toast
   - Option B: Allow both, last update wins
   - **Recommendation:** Option A for better UX

2. **Competitive: Show opponents' exact positions?**
   - Option A: Full transparency (see everything)
   - Option B: Only show general progress (X/N cards placed)
   - Option C: Ghost view (see positions but semi-transparent)
   - **Recommendation:** Option C

3. **Spectator limit?**
   - Max 10 spectators per game?
   - Performance considerations for broadcasting positions

4. **Replay feature?**
   - Record all position updates for playback?
   - Storage implications?
   - **Recommendation:** Future feature, not in initial scope

---

## 10. Success Metrics

- **Engagement:** % of games played in multiplayer vs. solo
- **Completion rate:** Do multiplayer games finish more/less often?
- **Session duration:** How long do multiplayer games last?
- **Return rate:** Do players come back for multiplayer?
- **Social sharing:** Do players invite friends?

---

## Next Steps

1. Get user approval on overall plan
2. Start with Phase 1 (player emoji on cards)
3. Build spectator UI enhancements (Phase 2)
4. Choose between Collaborative or Competitive for Phase 3/4
5. Iterate based on testing and feedback
