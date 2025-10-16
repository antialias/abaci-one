# Speed Complement Race - Multiplayer Migration Plan

**Status**: In Progress
**Created**: 2025-10-16
**Goal**: Migrate Speed Complement Race from standalone single-player game to modular multiplayer arcade room game

---

## Overview

Speed Complement Race is currently a sophisticated single-player game with three modes (Practice, Sprint, Survival). This plan outlines the migration to the modular arcade room system to support:

- Multiplayer gameplay (up to 4 players)
- Room-based configuration persistence
- Socket-based real-time synchronization
- Consistent architecture with other arcade games

---

## Current State Analysis

### What We Have
- ✅ Complex single-player game with 3 modes
- ✅ Advanced adaptive difficulty system
- ✅ AI opponent system with personalities
- ✅ Rich UI components and animations
- ✅ Comprehensive state management (useReducer + Context)
- ✅ 8 specialized custom hooks
- ✅ Sound effects and visual feedback

### What's Missing
- ❌ Multiplayer support (max players: 1)
- ❌ Socket integration
- ❌ Validator registration in modular system
- ❌ Persistent configuration (uses placeholder config)
- ❌ Room-based settings
- ❌ Real-time state synchronization
- ⚠️ Debug logging enabled in production

---

## Architecture Goals

### Target Architecture

```
Arcade Room System
  ↓
Socket Server (socket-server.ts)
  ↓
Validator (ComplementRaceValidator.ts)
  ↓
Provider (RoomComplementRaceProvider.tsx) → merges saved config with defaults
  ↓
Game Components (existing UI)
```

### Key Principles
1. **Preserve existing gameplay** - Keep all three modes working
2. **Maintain UI/UX quality** - All animations, sounds, visuals stay intact
3. **Support both single and multiplayer** - AI opponents + human players
4. **Follow existing patterns** - Use matching-game and number-guesser as reference
5. **Type safety** - Comprehensive TypeScript coverage

---

## Migration Phases

## Phase 1: Configuration & Type System ✓

### 1.1 Define ComplementRaceGameConfig
**File**: `src/lib/game-configs.ts`

```typescript
export interface ComplementRaceGameConfig {
  // Game Style (which mode)
  style: 'practice' | 'sprint' | 'survival';

  // Question Settings
  mode: 'friends5' | 'friends10' | 'mixed';
  complementDisplay: 'number' | 'abacus' | 'random';

  // Difficulty
  timeoutSetting: 'preschool' | 'kindergarten' | 'relaxed' | 'slow' | 'normal' | 'fast' | 'expert';

  // AI Settings
  enableAI: boolean;
  aiOpponentCount: number; // 0-2 for multiplayer, 2 for single-player

  // Multiplayer Settings
  maxPlayers: number; // 1-4
  competitiveMode: boolean; // true = race against each other, false = collaborative

  // Sprint Mode Specific
  routeDuration: number; // seconds per route (default 60)
  enablePassengers: boolean;

  // Practice/Survival Mode Specific
  raceGoal: number; // questions to win (default 20)
}

export const DEFAULT_COMPLEMENT_RACE_CONFIG: ComplementRaceGameConfig = {
  style: 'practice',
  mode: 'mixed',
  complementDisplay: 'random',
  timeoutSetting: 'normal',
  enableAI: true,
  aiOpponentCount: 2,
  maxPlayers: 1,
  competitiveMode: true,
  routeDuration: 60,
  enablePassengers: true,
  raceGoal: 20,
};
```

### 1.2 Disable Debug Logging
**File**: `src/app/arcade/complement-race/hooks/useSteamJourney.ts`

Change:
```typescript
const DEBUG_PASSENGER_BOARDING = false; // was true
```

---

## Phase 2: Validator Implementation ✓

### 2.1 Create ComplementRaceValidator
**File**: `src/lib/validators/ComplementRaceValidator.ts`

**Responsibilities**:
- Validate player answers
- Generate questions
- Manage game state
- Handle scoring
- Synchronize multiplayer state

**Key Methods**:
```typescript
class ComplementRaceValidator {
  getInitialState(config: ComplementRaceGameConfig): GameState
  getNewQuestion(state: GameState): ComplementQuestion
  validateAnswer(state: GameState, playerId: string, answer: number): ValidationResult
  updatePlayerProgress(state: GameState, playerId: string, correct: boolean): GameState
  checkWinCondition(state: GameState): { winner: string | null, gameOver: boolean }
  updateAIPositions(state: GameState, deltaTime: number): GameState
  serializeState(state: GameState): SerializedState
  deserializeState(serialized: SerializedState): GameState
}
```

**State Structure**:
```typescript
interface MultiplayerGameState {
  // Configuration
  config: ComplementRaceGameConfig;

  // Players
  players: Map<playerId, PlayerState>;

  // Current Question (shared in competitive, individual in practice)
  currentQuestions: Map<playerId, ComplementQuestion>;

  // AI Opponents
  aiRacers: AIRacer[];

  // Sprint Mode State
  sprint: {
    momentum: Map<playerId, number>;
    trainPosition: Map<playerId, number>;
    passengers: Passenger[];
    currentRoute: number;
    elapsedTime: number;
  } | null;

  // Race Progress
  progress: Map<playerId, number>; // 0-100% or lap count

  // Game Status
  phase: 'waiting' | 'countdown' | 'playing' | 'finished';
  winner: string | null;
  startTime: number | null;

  // Difficulty Tracking (per player)
  difficultyTrackers: Map<playerId, DifficultyTracker>;
}

interface PlayerState {
  id: string;
  name: string;
  score: number;
  streak: number;
  bestStreak: number;
  correctAnswers: number;
  totalQuestions: number;
  position: number; // track position
  isReady: boolean;
}
```

---

## Phase 3: Socket Server Integration ✓

### 3.1 Register Game Handler
**File**: `src/services/socket-server.ts`

Add to game session management:
```typescript
case 'complement-race':
  validator = new ComplementRaceValidator();
  break;
```

### 3.2 Socket Events

**Client → Server**:
- `game:answer` - Submit answer for current question
- `game:ready` - Player ready to start
- `game:settings-change` - Update game config (host only)

**Server → Client**:
- `game:state-update` - Full state sync
- `game:question-new` - New question generated
- `game:answer-result` - Answer validation result
- `game:player-progress` - Player moved/scored
- `game:ai-update` - AI positions updated
- `game:game-over` - Game finished with winner

### 3.3 Real-time Synchronization Strategy

**State Updates**:
- Full state broadcast every 200ms (AI updates)
- Instant broadcasts on player actions (answers, ready status)
- Delta compression for large states (sprint mode passengers)

**Race Condition Handling**:
- Server is source of truth
- Client predictions for smooth animations
- Rollback on server correction

---

## Phase 4: Room Provider & Configuration ✓

### 4.1 Create RoomComplementRaceProvider
**File**: `src/app/arcade/complement-race/context/RoomComplementRaceProvider.tsx`

Similar to existing `ComplementRaceProvider` but:
- Accepts `roomCode` prop
- Loads saved config from arcade room state
- Merges saved config with defaults
- Emits socket events on state changes
- Listens for socket events to update state

```typescript
export function RoomComplementRaceProvider({
  roomCode,
  children
}: {
  roomCode: string;
  children: React.ReactNode;
}) {
  // Load saved config
  const savedConfig = useArcadeRoom((state) =>
    state.games['complement-race']?.config as ComplementRaceGameConfig
  );

  // Merge with defaults
  const config = useMemo(() => ({
    ...DEFAULT_COMPLEMENT_RACE_CONFIG,
    ...savedConfig,
  }), [savedConfig]);

  // Initialize state with config
  const [state, dispatch] = useReducer(gameReducer, getInitialState(config));

  // Socket integration
  useSocketSync(roomCode, state, dispatch);

  return (
    <ComplementRaceContext.Provider value={{ state, dispatch }}>
      {children}
    </ComplementRaceContext.Provider>
  );
}
```

### 4.2 Update Arcade Room Store
**File**: `src/app/arcade/stores/arcade-room-store.ts`

Ensure complement-race config is saved:
```typescript
updateGameConfig: (gameName: string, config: Partial<GameConfig>) => {
  set((state) => {
    const game = state.games[gameName];
    if (game) {
      game.config = { ...game.config, ...config };
    }
  });
},
```

---

## Phase 5: Multiplayer Game Logic ✓

### 5.1 Sprint Mode: "Passenger Rush" - Shared Universe Design

**Core Concept**: ONE railroad with ONE set of passengers. Players compete to pick them up and deliver them first.

#### Shared Game Board
- All players see the SAME track with SAME stations
- 6-8 passengers spawn per route at various stations
- Once a player picks up a passenger, it disappears for EVERYONE
- Real competition for limited resources

#### Visual Design: Ghost Trains
```
Your train: 🚂🟦 Full opacity (100%), prominent
Other players: 🚂🟢🟡🟣 Low opacity (30-40%), "ghost" effect

Benefits:
- See your position clearly
- Track opponents without visual clutter
- Classic racing game pattern (ghost racers)
- No collision confusion
```

#### Gameplay Mechanics

**Movement**:
- Answer complement questions to build momentum
- Correct answer → +15 momentum → train speed increases
- Each player has independent momentum/speed
- Trains can pass through each other (no collision)

**Pickup Rules**:
```typescript
When train reaches station (within 5% position):
  IF passenger waiting at station:
    ✅ First player to arrive claims passenger
    📢 Broadcast: "🟦 Player 1 picked up 👨‍💼 Bob!"
    🚫 Passenger removed from board (no longer available)
  ELSE:
    ⏭️ Train passes through empty station
```

**Delivery Rules**:
```typescript
When train with passenger reaches destination station:
  ✅ Auto-deliver
  🎯 Award points: 10 (normal) or 20 (urgent)
  🚃 Free up car for next passenger
  📢 Broadcast: "🟦 Player 1 delivered 👨‍💼 Bob! +10pts"
```

**Capacity**:
- Each train: 3 passenger cars = max 3 concurrent passengers
- Must deliver before picking up more
- Strategic choice: quick nearby delivery vs. valuable long-distance

**Resource Competition**:
- 6-8 passengers per route
- 4 players competing
- Not enough for everyone to get all passengers
- Creates natural urgency and strategy

#### Win Conditions (Host Configurable)

**Route-based** (default):
- Play 3 routes (3 minutes)
- Most passengers delivered wins
- Tiebreaker: total points

**Score-based**:
- First to 100 points
- Urgent passengers (20pts) are strategic targets

**Time-based**:
- 5-minute session
- Most deliveries at time limit

### 5.2 Practice/Survival Mode Multiplayer

**Practice Mode**: Linear race track with multiple lanes
- 2-4 horizontal lanes stacked vertically
- Each player in their own lane
- AI opponents fill remaining lanes (optional)
- Same questions for all players simultaneously
- First correct answer gets position boost + bonus points
- First to 20 questions wins

**Survival Mode**: Circular track with lap counting
- Players race on shared circular track
- Lap counter instead of finish line
- Infinite laps, timed rounds
- Most laps in 5 minutes wins

### 5.3 Practice Mode: Simultaneous Questions

**Question Flow**:
```
1. Same question appears for all players: "7 + ? = 10"
2. Players race to answer (optional: show "🤔" indicator)
3. First CORRECT answer:
   - Advances 1 full position
   - Gets +100 base + +50 "first" bonus
4. Other correct answers:
   - Advance 0.5 positions
   - Get +100 base (no bonus)
5. Wrong answers:
   - Momentum penalty (-10)
   - No position change
6. Next question after 3 seconds OR when all answer
```

**Strategic Tension**:
- Rush to be first (more reward) vs. take time to be accurate
- See opponents' progress in real-time
- Dramatic overtaking moments

### 5.4 AI Opponent Scaling

```typescript
function getAICount(config: ComplementRaceGameConfig, humanPlayers: number): number {
  if (!config.enableAI) return 0;

  const totalRacers = humanPlayers + config.aiOpponentCount;
  const maxRacers = 4; // UI limitation

  return Math.min(config.aiOpponentCount, maxRacers - humanPlayers);
}
```

**AI Behavior in Multiplayer**:
- Optional (host configurable)
- Fill empty lanes in practice/survival modes
- Act as ghost trains in sprint mode
- Same speech bubble personalities
- Adaptive difficulty (don't dominate human players)

### 5.5 Live Updates & Broadcasts

**Event Feed** (shown to all players):
```
• 🟦 Player 1 delivered 👨‍💼 Bob! +10 pts
• 🟢 Player 2 picked up 👩‍🎓 Alice at Hillside
• 🟡 Player 3 answered incorrectly! -10 momentum
• 🟣 Player 4 took the lead! 🏆
```

**Tension Moments** (sprint mode):
```
When 2+ players approach same station:
"🚨 Race for passenger at Riverside!"
"🟦 You: 3% away"
"🟢 Player 2: 5% away"

Result:
"🟦 Player 1 got there first! 👨‍💼 claimed!"
```

**Scoreboard** (always visible):
```
🏆 LEADERBOARD:
1. 🟣 Player 4: 4 delivered (50 pts)
2. 🟦 Player 1: 3 delivered (40 pts)
3. 🟢 Player 2: 2 delivered (30 pts)
4. 🟡 Player 3: 1 delivered (10 pts)
```

---

## Phase 6: UI Updates for Multiplayer ✓

### 6.1 Track Visualization Updates

**Practice/Survival Mode**:
- Stack up to 4 player tracks vertically
- Show player names/avatars
- Color-code each player's lane
- Show AI opponents in separate lanes

**Sprint Mode**:
- Show multiple trains on same track OR
- Picture-in-picture mini views OR
- Leaderboard overlay with positions

### 6.2 Settings UI

**Add to GameControls.tsx**:
- Max Players selector (1-4)
- Enable AI toggle
- AI Opponent Count (0-2)
- Competitive vs Collaborative toggle

### 6.3 Lobby/Waiting Room

**Add GameLobby.tsx phase**:
- Show connected players
- Ready check system
- Host can change settings
- Countdown when all ready

### 6.4 Results Screen Updates

**Show multiplayer results**:
- Leaderboard with all player scores
- Individual stats per player
- Replay button (returns to lobby)
- "Play Again" resets with same players

---

## Phase 7: Registry & Routing ✓

### 7.1 Update Game Registry
**File**: `src/lib/validators/index.ts`

```typescript
import { ComplementRaceValidator } from './ComplementRaceValidator';

export const GAME_VALIDATORS = {
  'matching': MatchingGameValidator,
  'number-guesser': NumberGuesserValidator,
  'complement-race': ComplementRaceValidator, // ADD THIS
} as const;
```

### 7.2 Update Game Config
**File**: `src/lib/game-configs.ts`

```typescript
export type GameConfig =
  | MatchingGameConfig
  | NumberGuesserConfig
  | ComplementRaceGameConfig; // ADD THIS
```

### 7.3 Update GameSelector
**File**: `src/components/GameSelector.tsx`

```typescript
GAMES_CONFIG = {
  'complement-race': {
    name: 'Speed Complement Race',
    fullName: 'Speed Complement Race 🏁',
    maxPlayers: 4, // CHANGE FROM 1
    url: '/arcade/complement-race',
    chips: ['🤖 AI Opponents', '🔥 Speed Challenge', '🏆 Three Game Modes', '👥 Multiplayer'],
    difficulty: 'Intermediate',
    available: true,
  }
}
```

### 7.4 Update Routing
**File**: `src/app/arcade/complement-race/page.tsx`

Add room-based routing:
```typescript
// Support both standalone and room-based play
export default function ComplementRacePage({
  searchParams,
}: {
  searchParams: { room?: string };
}) {
  const roomCode = searchParams.room;

  return (
    <PageWithNav>
      {roomCode ? (
        <RoomComplementRaceProvider roomCode={roomCode}>
          <ComplementRaceGame />
        </RoomComplementRaceProvider>
      ) : (
        <ComplementRaceProvider>
          <ComplementRaceGame />
        </ComplementRaceProvider>
      )}
    </PageWithNav>
  );
}
```

---

## Phase 8: Testing & Validation ✓

### 8.1 Unit Tests
- [ ] ComplementRaceValidator logic
- [ ] Question generation
- [ ] Answer validation
- [ ] Win condition detection
- [ ] AI position updates

### 8.2 Integration Tests
- [ ] Socket event flow
- [ ] State synchronization
- [ ] Room configuration persistence
- [ ] Multi-player race logic

### 8.3 E2E Tests
- [ ] Single-player mode (backward compatibility)
- [ ] Multiplayer with 2 players
- [ ] Multiplayer with 4 players
- [ ] AI opponent behavior
- [ ] All three game modes (practice, sprint, survival)
- [ ] Settings persistence across sessions

### 8.4 Manual Testing Checklist
- [ ] Create room with complement-race
- [ ] Join with multiple clients
- [ ] Change settings (host only)
- [ ] Start game with countdown
- [ ] Answer questions simultaneously
- [ ] Verify real-time position updates
- [ ] Complete game and see results
- [ ] Play again functionality
- [ ] AI opponent behavior correct
- [ ] Sprint mode passengers work
- [ ] Sound effects play correctly
- [ ] Animations smooth
- [ ] No console errors

---

## Implementation Order

### Priority 1: Foundation (Days 1-2)
1. ✓ Define ComplementRaceGameConfig
2. ✓ Disable debug logging
3. ✓ Create ComplementRaceValidator skeleton
4. ✓ Register in modular system

### Priority 2: Core Multiplayer (Days 3-5)
5. ✓ Implement validator methods
6. ✓ Socket server integration
7. ✓ Create RoomComplementRaceProvider
8. ✓ Update arcade room store

### Priority 3: UI Updates (Days 6-8)
9. ✓ Add lobby/waiting phase
10. ✓ Update track visualization for multiplayer
11. ✓ Update settings UI
12. ✓ Update results screen

### Priority 4: Polish & Test (Days 9-10)
13. ✓ Write tests
14. ✓ Manual testing
15. ✓ Bug fixes
16. ✓ Performance optimization

---

## Risk Mitigation

### Risk 1: Breaking Existing Single-Player
**Mitigation**: Keep existing Provider, add new RoomProvider, support both paths

### Risk 2: Complex Sprint Mode State Sync
**Mitigation**: Start with Practice mode, add Sprint later, use delta compression

### Risk 3: Performance with 4 Players
**Mitigation**: Optimize rendering, use React.memo, throttle updates, profile early

### Risk 4: AI + Multiplayer Complexity
**Mitigation**: Make AI optional, test with AI disabled first, add AI last

---

## Reference Games

Use these as architectural reference:
- **Matching Game** (`src/lib/validators/MatchingGameValidator.ts`) - Room config, socket integration
- **Number Guesser** (`src/lib/validators/NumberGuesserValidator.ts`) - Turn-based logic
- **Game Settings Docs** (`.claude/GAME_SETTINGS_PERSISTENCE.md`) - Config patterns

---

## Success Criteria

- [ ] Complement Race appears in arcade room game selector
- [ ] Can create room with complement-race
- [ ] Multiple players can join and see each other
- [ ] Settings persist across page refreshes
- [ ] Real-time race progress updates work
- [ ] All three modes work in multiplayer
- [ ] AI opponents work with human players
- [ ] Single-player mode still works (backward compat)
- [ ] All animations and sounds intact
- [ ] Zero TypeScript errors
- [ ] Pre-commit checks pass
- [ ] No console errors in production

---

## Next Steps

1. Start with Phase 1: Configuration & Types
2. Move to Phase 2: Validator skeleton
3. Test each phase before moving to next
4. Deploy to staging environment early
5. Get user feedback on multiplayer mechanics

---

**Let's ship it! 🚀**
