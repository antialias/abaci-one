# Speed Complement Race - Multiplayer Migration Plan

**Status**: Phase 1-8 Complete (70%) - **Multiplayer Visuals Remaining**
**Created**: 2025-10-16
**Updated**: 2025-10-16 (Post-Review)
**Goal**: Migrate Speed Complement Race from standalone single-player game to modular multiplayer arcade room game

**Current State**: ✅ Backend/Server Complete | ⚠️ Frontend Needs Multiplayer UI

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
  style: "practice" | "sprint" | "survival";

  // Question Settings
  mode: "friends5" | "friends10" | "mixed";
  complementDisplay: "number" | "abacus" | "random";

  // Difficulty
  timeoutSetting:
    | "preschool"
    | "kindergarten"
    | "relaxed"
    | "slow"
    | "normal"
    | "fast"
    | "expert";

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
  style: "practice",
  mode: "mixed",
  complementDisplay: "random",
  timeoutSetting: "normal",
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
  getInitialState(config: ComplementRaceGameConfig): GameState;
  getNewQuestion(state: GameState): ComplementQuestion;
  validateAnswer(
    state: GameState,
    playerId: string,
    answer: number,
  ): ValidationResult;
  updatePlayerProgress(
    state: GameState,
    playerId: string,
    correct: boolean,
  ): GameState;
  checkWinCondition(state: GameState): {
    winner: string | null;
    gameOver: boolean;
  };
  updateAIPositions(state: GameState, deltaTime: number): GameState;
  serializeState(state: GameState): SerializedState;
  deserializeState(serialized: SerializedState): GameState;
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
  phase: "waiting" | "countdown" | "playing" | "finished";
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
function getAICount(
  config: ComplementRaceGameConfig,
  humanPlayers: number,
): number {
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
import { ComplementRaceValidator } from "./ComplementRaceValidator";

export const GAME_VALIDATORS = {
  matching: MatchingGameValidator,
  "number-guesser": NumberGuesserValidator,
  "complement-race": ComplementRaceValidator, // ADD THIS
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
  "complement-race": {
    name: "Speed Complement Race",
    fullName: "Speed Complement Race 🏁",
    maxPlayers: 4, // CHANGE FROM 1
    url: "/arcade/complement-race",
    chips: [
      "🤖 AI Opponents",
      "🔥 Speed Challenge",
      "🏆 Three Game Modes",
      "👥 Multiplayer",
    ],
    difficulty: "Intermediate",
    available: true,
  },
};
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

## Phase 8: Testing & Validation ⚠️ PENDING

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

## Phase 9: Multiplayer Visual Features ⚠️ REQUIRED FOR FULL SUPPORT

**Status**: Backend complete, frontend needs multiplayer visualization

**Goal**: Make multiplayer visible to players - currently only local player is shown on screen

### 9.1 Ghost Trains (Sprint Mode) 🚨 HIGH PRIORITY

**File**: `src/app/arcade/complement-race/components/SteamTrainJourney.tsx`

**Current State**: Only the local player's train is rendered

**Required Change**: Render all other players' trains with ghost effect

**Implementation** (Est: 2-3 hours):

```typescript
// In SteamTrainJourney.tsx
import { useComplementRace } from '@/arcade-games/complement-race/Provider'

export function SteamTrainJourney() {
  const { state } = useComplementRace()
  const { localPlayerId } = useArcadeSession()

  // Existing local player train (keep as-is)
  const localPlayer = state.players[localPlayerId]

  return (
    <div className="steam-track">
      {/* Existing local player train - keep full opacity */}
      <Train
        position={localPlayer.position}
        momentum={localPlayer.momentum}
        passengers={localPlayer.claimedPassengers}
        color="blue"
        opacity={1.0}
        isLocalPlayer={true}
      />

      {/* NEW: Ghost trains for other players */}
      {Object.entries(state.players)
        .filter(([playerId]) => playerId !== localPlayerId)
        .map(([playerId, player]) => (
          <GhostTrain
            key={playerId}
            position={player.position}
            color={player.color}
            opacity={0.35}
            name={player.name}
            passengerCount={player.claimedPassengers?.length || 0}
          />
        ))}

      {/* Existing stations and passengers */}
      <Stations />
      <Passengers />
    </div>
  )
}
```

**New Component: GhostTrain**:

```typescript
// src/app/arcade/complement-race/components/GhostTrain.tsx
interface GhostTrainProps {
  position: number // 0-100%
  color: string    // player color
  opacity: number  // 0.35 for ghost effect
  name: string     // player name
  passengerCount: number
}

export function GhostTrain({ position, color, opacity, name, passengerCount }: GhostTrainProps) {
  return (
    <div
      className="ghost-train"
      style={{
        position: 'absolute',
        left: `${position}%`,
        opacity,
        filter: 'blur(1px)', // subtle blur for ghost effect
        transform: 'translateX(-50%)',
      }}
    >
      <div className={css({ fontSize: '2rem' })}>🚂</div>
      <div className={css({
        fontSize: '0.7rem',
        color,
        fontWeight: 'bold'
      })}>
        {name}
        {passengerCount > 0 && ` (${passengerCount}👥)`}
      </div>
    </div>
  )
}
```

**Visual Design**:

- Local player: Full opacity (100%), vibrant colors, clear
- Other players: 30-40% opacity, subtle blur, labeled with name
- Show passenger count on ghost trains
- No collision detection needed (trains pass through each other)

**Checklist**:

- [ ] Create GhostTrain component
- [ ] Update SteamTrainJourney to render all players
- [ ] Test with 2 players (local + 1 ghost)
- [ ] Test with 4 players (local + 3 ghosts)
- [ ] Verify position updates in real-time
- [ ] Verify ghost effect (opacity, blur)

---

### 9.2 Multi-Lane Track (Practice Mode) 🚨 HIGH PRIORITY

**File**: `src/app/arcade/complement-race/components/LinearTrack.tsx`

**Current State**: Single horizontal lane showing only local player

**Required Change**: Stack 2-4 lanes vertically, one per player

**Implementation** (Est: 3-4 hours):

```typescript
// In LinearTrack.tsx
import { useComplementRace } from '@/arcade-games/complement-race/Provider'
import { useArcadeSession } from '@/lib/arcade/game-sdk'

export function LinearTrack() {
  const { state } = useComplementRace()
  const { localPlayerId } = useArcadeSession()

  const players = Object.entries(state.players)
  const laneHeight = 120 // pixels per lane

  return (
    <div className="track-container">
      {players.map(([playerId, player], index) => {
        const isLocalPlayer = playerId === localPlayerId

        return (
          <Lane
            key={playerId}
            yOffset={index * laneHeight}
            isLocalPlayer={isLocalPlayer}
          >
            {/* Player racer */}
            <Racer
              position={player.position}
              color={player.color}
              name={player.name}
              opacity={isLocalPlayer ? 1.0 : 0.35}
              isLocalPlayer={isLocalPlayer}
            />

            {/* Track markers (start/finish) */}
            <StartLine />
            <FinishLine position={state.raceGoal} />

            {/* Progress bar */}
            <ProgressBar
              progress={player.position}
              color={player.color}
            />
          </Lane>
        )
      })}
    </div>
  )
}
```

**New Component: Lane**:

```typescript
// src/app/arcade/complement-race/components/Lane.tsx
interface LaneProps {
  yOffset: number
  isLocalPlayer: boolean
  children: React.ReactNode
}

export function Lane({ yOffset, isLocalPlayer, children }: LaneProps) {
  return (
    <div
      className={css({
        position: 'relative',
        height: '120px',
        width: '100%',
        transform: `translateY(${yOffset}px)`,
        borderBottom: '2px dashed',
        borderColor: isLocalPlayer ? 'blue.500' : 'gray.300',
        backgroundColor: isLocalPlayer ? 'blue.50' : 'gray.50',
        transition: 'all 0.3s ease',
      })}
    >
      {children}
    </div>
  )
}
```

**Layout Design**:

```
┌──────────────────────────────────────────┐
│ 🏁 [========🏃‍♂️=========>      ] Player 1 │  ← Local player (highlighted)
├──────────────────────────────────────────┤
│ 🏁 [=======>🏃‍♀️             ] Player 2 │  ← Ghost (low opacity)
├──────────────────────────────────────────┤
│ 🏁 [===========>🤖           ] AI Bot 1 │  ← AI (low opacity)
├──────────────────────────────────────────┤
│ 🏁 [=====>🏃                 ] Player 3 │  ← Ghost (low opacity)
└──────────────────────────────────────────┘
```

**Features**:

- Each lane is color-coded per player
- Local player's lane has brighter background
- Progress bars show position clearly
- Names/avatars next to each racer
- Smooth position interpolation for animations

**Checklist**:

- [ ] Create Lane component
- [ ] Create Racer component (or update existing)
- [ ] Update LinearTrack to render multiple lanes
- [ ] Test with 2 players
- [ ] Test with 4 players (2 human + 2 AI)
- [ ] Verify position updates synchronized
- [ ] Verify local player lane is emphasized

---

### 9.3 Multiplayer Results Screen 🚨 HIGH PRIORITY

**File**: `src/app/arcade/complement-race/components/GameResults.tsx`

**Current State**: Shows only local player stats

**Required Change**: Show leaderboard with all players

**Implementation** (Est: 1-2 hours):

```typescript
// In GameResults.tsx
import { useComplementRace } from '@/arcade-games/complement-race/Provider'
import { useArcadeSession } from '@/lib/arcade/game-sdk'

export function GameResults() {
  const { state, playAgain } = useComplementRace()
  const { localPlayerId, isMultiplayer } = useArcadeSession()

  // Calculate leaderboard
  const leaderboard = Object.entries(state.players)
    .map(([id, player]) => ({ id, ...player }))
    .sort((a, b) => b.score - a.score)

  const winner = leaderboard[0]
  const localPlayerRank = leaderboard.findIndex(p => p.id === localPlayerId) + 1

  return (
    <div className="results-container">
      {/* Winner Announcement */}
      <div className="winner-banner">
        <h1>🏆 {winner.name} Wins!</h1>
        <p>{winner.score} points</p>
      </div>

      {/* Full Leaderboard */}
      {isMultiplayer && (
        <div className="leaderboard">
          <h2>Final Standings</h2>
          {leaderboard.map((player, index) => (
            <LeaderboardRow
              key={player.id}
              rank={index + 1}
              player={player}
              isLocalPlayer={player.id === localPlayerId}
            />
          ))}
        </div>
      )}

      {/* Local Player Summary */}
      <div className="player-summary">
        <h3>Your Performance</h3>
        <StatCard label="Rank" value={`${localPlayerRank} / ${leaderboard.length}`} />
        <StatCard label="Score" value={state.players[localPlayerId].score} />
        <StatCard label="Accuracy" value={`${calculateAccuracy(state.players[localPlayerId])}%`} />
        <StatCard label="Best Streak" value={state.players[localPlayerId].bestStreak} />
      </div>

      {/* Actions */}
      <div className="actions">
        <Button onClick={playAgain}>Play Again</Button>
        <Button onClick={exitToLobby}>Back to Lobby</Button>
      </div>
    </div>
  )
}
```

**New Component: LeaderboardRow**:

```typescript
interface LeaderboardRowProps {
  rank: number
  player: PlayerState
  isLocalPlayer: boolean
}

export function LeaderboardRow({ rank, player, isLocalPlayer }: LeaderboardRowProps) {
  const medalEmoji = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : ''

  return (
    <div
      className={css({
        display: 'flex',
        alignItems: 'center',
        padding: '1rem',
        backgroundColor: isLocalPlayer ? 'blue.100' : 'white',
        borderLeft: isLocalPlayer ? '4px solid blue.500' : 'none',
        borderRadius: '8px',
        marginBottom: '0.5rem',
      })}
    >
      <div className="rank">{medalEmoji || rank}</div>
      <div className="player-name">{player.name}</div>
      <div className="score">{player.score} pts</div>
      <div className="stats">
        {player.correctAnswers}/{player.totalQuestions} correct
      </div>
    </div>
  )
}
```

**Checklist**:

- [ ] Update GameResults.tsx to show leaderboard
- [ ] Create LeaderboardRow component
- [ ] Add winner announcement
- [ ] Highlight local player in leaderboard
- [ ] Show individual stats per player
- [ ] Test with 2 players
- [ ] Test with 4 players
- [ ] Verify "Play Again" works in multiplayer

---

### 9.4 Visual Lobby/Ready System ⚠️ MEDIUM PRIORITY

**File**: `src/app/arcade/complement-race/components/GameLobby.tsx` (NEW)

**Current State**: Game auto-starts, no visual ready check

**Required Change**: Show lobby with player list and ready indicators

**Implementation** (Est: 2-3 hours):

```typescript
// NEW FILE: src/app/arcade/complement-race/components/GameLobby.tsx
import { useComplementRace } from '@/arcade-games/complement-race/Provider'
import { useArcadeSession } from '@/lib/arcade/game-sdk'

export function GameLobby() {
  const { state, setReady } = useComplementRace()
  const { localPlayerId, isHost } = useArcadeSession()

  const players = Object.entries(state.players)
  const allReady = players.every(([_, p]) => p.isReady)
  const canStart = players.length >= 1 && allReady

  return (
    <div className="lobby-container">
      <h1>Waiting for Players...</h1>

      {/* Player List */}
      <div className="player-list">
        {players.map(([playerId, player]) => (
          <PlayerCard
            key={playerId}
            player={player}
            isLocalPlayer={playerId === localPlayerId}
            isReady={player.isReady}
          />
        ))}

        {/* Empty slots */}
        {Array.from({ length: state.config.maxPlayers - players.length }).map((_, i) => (
          <EmptySlot key={`empty-${i}`} />
        ))}
      </div>

      {/* Ready Toggle */}
      <div className="ready-controls">
        <Button
          onClick={() => setReady(!state.players[localPlayerId].isReady)}
          variant={state.players[localPlayerId].isReady ? 'success' : 'default'}
        >
          {state.players[localPlayerId].isReady ? '✓ Ready' : 'Ready Up'}
        </Button>
      </div>

      {/* Start Game (host only) */}
      {isHost && (
        <div className="host-controls">
          <Button
            onClick={startGame}
            disabled={!canStart}
          >
            {canStart ? 'Start Game' : 'Waiting for all players...'}
          </Button>
        </div>
      )}

      {/* Countdown when starting */}
      {state.gamePhase === 'countdown' && (
        <Countdown seconds={state.countdownSeconds} />
      )}
    </div>
  )
}
```

**Component: PlayerCard**:

```typescript
interface PlayerCardProps {
  player: PlayerState
  isLocalPlayer: boolean
  isReady: boolean
}

export function PlayerCard({ player, isLocalPlayer, isReady }: PlayerCardProps) {
  return (
    <div
      className={css({
        display: 'flex',
        alignItems: 'center',
        padding: '1rem',
        borderRadius: '8px',
        backgroundColor: isLocalPlayer ? 'blue.100' : 'gray.100',
        border: isReady ? '2px solid green.500' : '2px solid gray.300',
      })}
    >
      <Avatar color={player.color} />
      <div className="player-info">
        <div className="name">
          {player.name}
          {isLocalPlayer && ' (You)'}
        </div>
        <div className="status">
          {isReady ? '✓ Ready' : '⏳ Not ready'}
        </div>
      </div>
    </div>
  )
}
```

**Integration**: Update Provider to handle lobby phase

```typescript
// In Provider.tsx - add to context
const setReady = useCallback((ready: boolean) => {
  emitMove({
    type: 'set-ready',
    ready,
  })
}, [emitMove])

return (
  <ComplementRaceContext.Provider value={{
    state,
    // ... other methods
    setReady,
  }}>
    {children}
  </ComplementRaceContext.Provider>
)
```

**Checklist**:

- [ ] Create GameLobby.tsx component
- [ ] Create PlayerCard component
- [ ] Add setReady to Provider context
- [ ] Update Validator to handle 'set-ready' move
- [ ] Show lobby before game starts
- [ ] Test ready/unready toggling
- [ ] Test "Start Game" (host only)
- [ ] Verify countdown before game starts

---

### 9.5 AI Opponents Display ⚠️ MEDIUM PRIORITY

**Current State**: AI opponents defined in types but not populated

**Files to Update**:

1. `src/arcade-games/complement-race/Validator.ts` - AI logic
2. Track components (LinearTrack, SteamTrainJourney) - AI rendering

**Implementation** (Est: 4-6 hours):

#### Step 1: Populate AI Opponents in Validator

```typescript
// In Validator.ts - validateStartGame method
validateStartGame(config: ComplementRaceConfig) {
  const humanPlayerCount = this.activePlayers.length
  const aiCount = config.enableAI
    ? Math.min(config.aiOpponentCount, config.maxPlayers - humanPlayerCount)
    : 0

  // Create AI players
  const aiOpponents: AIOpponent[] = []
  const aiPersonalities = ['speedy', 'steady', 'chaotic']

  for (let i = 0; i < aiCount; i++) {
    const aiId = `ai-${i}`
    aiOpponents.push({
      id: aiId,
      name: `Bot ${i + 1}`,
      color: ['purple', 'orange', 'pink'][i],
      personality: aiPersonalities[i % aiPersonalities.length],
      difficulty: config.timeoutSetting,
    })

    // Add to players map
    state.players[aiId] = {
      id: aiId,
      name: `Bot ${i + 1}`,
      score: 0,
      streak: 0,
      bestStreak: 0,
      position: 0,
      isReady: true, // AI always ready
      correctAnswers: 0,
      totalQuestions: 0,
      isAI: true,
    }
  }

  state.aiOpponents = aiOpponents
  return state
}
```

#### Step 2: Update AI Positions (per frame)

```typescript
// In Validator.ts - new method
updateAIPositions(state: ComplementRaceState, deltaTime: number) {
  state.aiOpponents.forEach((ai) => {
    const aiPlayer = state.players[ai.id]

    // AI answers questions at interval based on difficulty
    const answerInterval = this.getAIAnswerInterval(ai.difficulty, ai.personality)
    const timeSinceLastAnswer = Date.now() - (aiPlayer.lastAnswerTime || 0)

    if (timeSinceLastAnswer > answerInterval) {
      // AI answers question
      const correct = this.shouldAIAnswerCorrectly(ai.personality)

      if (correct) {
        aiPlayer.score += 100
        aiPlayer.streak += 1
        aiPlayer.position += 1
        aiPlayer.correctAnswers += 1
      } else {
        aiPlayer.streak = 0
      }

      aiPlayer.totalQuestions += 1
      aiPlayer.lastAnswerTime = Date.now()

      // Generate new question for AI
      state.currentQuestions[ai.id] = this.generateQuestion(state.config)
    }
  })

  return state
}

// Helper: AI answer timing based on difficulty
private getAIAnswerInterval(difficulty: string, personality: string) {
  const baseInterval = {
    'preschool': 8000,
    'kindergarten': 6000,
    'relaxed': 5000,
    'slow': 4000,
    'normal': 3000,
    'fast': 2000,
    'expert': 1500,
  }[difficulty] || 3000

  // Personality modifiers
  const modifier = {
    'speedy': 0.8,  // 20% faster
    'steady': 1.0,  // Normal
    'chaotic': 0.9 + Math.random() * 0.4, // Random 90-130%
  }[personality] || 1.0

  return baseInterval * modifier
}

// Helper: AI accuracy based on personality
private shouldAIAnswerCorrectly(personality: string): boolean {
  const accuracy = {
    'speedy': 0.85,  // Fast but less accurate
    'steady': 0.95,  // Very accurate
    'chaotic': 0.70, // Unpredictable
  }[personality] || 0.85

  return Math.random() < accuracy
}
```

#### Step 3: Render AI in UI

**Already handled by 9.1 and 9.2** - Since AI opponents are in `state.players`, they'll render automatically as ghost trains/lanes!

**Checklist**:

- [ ] Implement AI population in validateStartGame
- [ ] Implement updateAIPositions logic
- [ ] Add AI answer timing system
- [ ] Add AI personality behaviors
- [ ] Test with 1 human + 2 AI
- [ ] Test with 2 human + 1 AI
- [ ] Verify AI appears in results screen
- [ ] Verify AI doesn't dominate human players

---

### 9.6 Event Feed (Optional Polish)

**Priority**: LOW (nice to have)

**File**: `src/app/arcade/complement-race/components/EventFeed.tsx` (NEW)

**Implementation** (Est: 3-4 hours):

```typescript
// NEW FILE: EventFeed.tsx
interface GameEvent {
  id: string
  type: 'passenger-claimed' | 'passenger-delivered' | 'wrong-answer' | 'overtake'
  playerId: string
  playerName: string
  playerColor: string
  timestamp: number
  data?: any
}

export function EventFeed() {
  const [events, setEvents] = useState<GameEvent[]>([])

  // Listen for game events
  useEffect(() => {
    // Subscribe to validator broadcasts
    socket.on('game:event', (event: GameEvent) => {
      setEvents((prev) => [event, ...prev].slice(0, 10)) // Keep last 10
    })
  }, [])

  return (
    <div className="event-feed">
      {events.map((event) => (
        <EventItem key={event.id} event={event} />
      ))}
    </div>
  )
}
```

**Checklist**:

- [ ] Create EventFeed component
- [ ] Update Validator to emit events
- [ ] Add event types (claim, deliver, overtake)
- [ ] Position feed in UI (corner overlay)
- [ ] Auto-dismiss old events
- [ ] Test with multiple players

---

## Phase 9 Summary

**Total Estimated Time**: 15-20 hours

**Priority Breakdown**:

- 🚨 **HIGH** (8-9 hours): Ghost trains, multi-lane track, results screen
- ⚠️ **MEDIUM** (8-12 hours): Lobby system, AI opponents
- ✅ **LOW** (3-4 hours): Event feed

**Completion Criteria**:

- [ ] Can see all players' trains/positions in real-time
- [ ] Multiplayer leaderboard shows all players
- [ ] Lobby shows player list with ready indicators
- [ ] AI opponents appear and compete
- [ ] All animations smooth with multiple players
- [ ] Zero visual glitches with 4 players

**Once Phase 9 is complete**:

- Multiplayer will be FULLY functional
- Overall implementation: 100% complete
- Ready for Phase 8 (Testing & Validation)

---

## Implementation Order

### ✅ Priority 1: Foundation (COMPLETE)

1. ✓ Define ComplementRaceGameConfig
2. ✓ Disable debug logging
3. ✓ Create ComplementRaceValidator skeleton
4. ✓ Register in modular system

### ✅ Priority 2: Core Multiplayer (COMPLETE)

5. ✓ Implement validator methods
6. ✓ Socket server integration
7. ✓ Create RoomComplementRaceProvider (State Adapter Pattern)
8. ✓ Update arcade room store

### ✅ Priority 3: Basic UI Integration (COMPLETE)

9. ✓ Add navigation bar (PageWithNav)
10. ✓ Update settings UI
11. ✓ Config persistence
12. ✓ Registry integration

### 🚨 Priority 4: Multiplayer Visuals (CRITICAL - NEXT)

13. [ ] Ghost trains (Sprint Mode)
14. [ ] Multi-lane track (Practice Mode)
15. [ ] Multiplayer results screen
16. [ ] Visual lobby with ready checks
17. [ ] AI opponent display

### Priority 5: Testing & Polish (FINAL)

18. [ ] Write tests (unit, integration, E2E)
19. [ ] Manual testing with 2-4 players
20. [ ] Bug fixes
21. [ ] Performance optimization
22. [ ] Event feed (optional)

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

### ✅ Backend & Infrastructure (COMPLETE)

- [x] Complement Race appears in arcade room game selector
- [x] Can create room with complement-race
- [x] Settings persist across page refreshes
- [x] Socket server integration working
- [x] Validator handles all game logic
- [x] Zero TypeScript errors
- [x] Pre-commit checks pass

### ⚠️ Multiplayer Visuals (IN PROGRESS - Phase 9)

- [ ] **Sprint Mode**: Can see other players' trains (ghost effect)
- [ ] **Practice Mode**: Multi-lane track shows all players
- [ ] **Survival Mode**: Circular track with multiple players
- [ ] Real-time position updates visible on screen
- [ ] Multiplayer results screen shows full leaderboard
- [ ] Visual lobby with player list and ready indicators
- [ ] AI opponents visible in all game modes

### Testing & Polish (PENDING)

- [ ] 2-player multiplayer test (all 3 modes)
- [ ] 4-player multiplayer test (all 3 modes)
- [ ] AI + human players test
- [ ] Single-player mode still works (backward compat)
- [ ] All animations and sounds intact
- [ ] No console errors in production
- [ ] Smooth performance with 4 players
- [ ] Event feed for competitive tension (optional)

### Current Status: 70% Complete

**What Works**: Backend, state management, config persistence, navigation
**What's Missing**: Multiplayer visualization (ghost trains, multi-lane tracks, lobby UI)

---

## Next Steps

**Immediate Priority**: Phase 9 - Multiplayer Visual Features

### Quick Wins (Do These First)

1. **Ghost Trains** (2-3 hours) - Make Sprint mode multiplayer visible
2. **Multi-Lane Track** (3-4 hours) - Make Practice mode multiplayer visible
3. **Results Screen** (1-2 hours) - Show full leaderboard

### After Quick Wins

4. **Visual Lobby** (2-3 hours) - Add ready check system
5. **AI Opponents** (4-6 hours) - Populate and display AI players

### Then Testing

6. Manual testing with 2+ players
7. Bug fixes and polish
8. Unit/integration tests
9. Performance optimization

---

**Current State**: Backend is rock-solid. Now we need to make multiplayer **visible** to players! 🎮

**Let's complete multiplayer support! 🚀**
