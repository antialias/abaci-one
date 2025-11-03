# Cross-Game Stats Analysis & Universal Data Model

## Overview

This document analyzes ALL arcade games to ensure our `GameResult` type works universally.

## Games Analyzed

1. ✅ **Matching** (Memory Pairs)
2. ✅ **Complement Race** (Math race game)
3. ✅ **Memory Quiz** (Number memory game)
4. ✅ **Card Sorting** (Sort abacus cards)
5. ✅ **Rithmomachia** (Strategic board game)
6. 🔍 **YJS Demo** (Multiplayer demo - skipping for now)

---

## Per-Game Analysis

### 1. Matching (Memory Pairs)

**Game Type**: Memory/Pattern Matching
**Players**: 1-N (competitive multiplayer)
**How to Win**: Most pairs matched (multiplayer) OR complete all pairs (solo)

**Data Tracked**:
```typescript
{
  scores: { [playerId]: matchCount }
  moves: number
  matchedPairs: number
  totalPairs: number
  gameTime: milliseconds
  accuracy: percentage (matchedPairs / moves * 100)
  grade: 'A+' | 'A' | 'B+' | ...
  starRating: 1-5
}
```

**Winner Determination**:
- Solo: completed = won
- Multiplayer: highest score wins

**Fits GameResult?** ✅
```typescript
{
  gameType: 'matching',
  duration: gameTime,
  playerResults: [{
    playerId,
    won: isWinner,
    score: matchCount,
    accuracy: 0.0-1.0,
    metrics: { moves, matchedPairs, difficulty }
  }]
}
```

---

### 2. Complement Race

**Game Type**: Racing/Quiz hybrid
**Players**: 1-N (competitive race)
**How to Win**: Highest score OR reach finish line first (depending on mode)

**Data Tracked**:
```typescript
{
  players: {
    [playerId]: {
      score: number
      streak: number
      bestStreak: number
      correctAnswers: number
      totalQuestions: number
      position: 0-100% (for practice/survival)
      deliveredPassengers: number (sprint mode)
    }
  }
  gameTime: milliseconds
  winner: playerId | null
  leaderboard: [{ playerId, score, rank }]
}
```

**Winner Determination**:
- Practice/Survival: reach 100% position
- Sprint: highest score (delivered passengers)

**Fits GameResult?** ✅
```typescript
{
  gameType: 'complement-race',
  duration: gameTime,
  playerResults: [{
    playerId,
    won: winnerId === playerId,
    score: player.score,
    accuracy: player.correctAnswers / player.totalQuestions,
    placement: leaderboard rank,
    metrics: {
      streak: player.bestStreak,
      correctAnswers: player.correctAnswers,
      totalQuestions: player.totalQuestions
    }
  }]
}
```

---

### 3. Memory Quiz

**Game Type**: Memory/Recall
**Players**: 1-N (cooperative OR competitive)
**How to Win**:
- Cooperative: team finds all numbers
- Competitive: most correct answers

**Data Tracked**:
```typescript
{
  playerScores: {
    [playerId]: { correct: number, incorrect: number }
  }
  foundNumbers: number[]
  correctAnswers: number[]
  selectedCount: 2 | 5 | 8 | 12 | 15
  playMode: 'cooperative' | 'competitive'
  gameTime: milliseconds
}
```

**Winner Determination**:
- Cooperative: ALL found = team wins
- Competitive: highest correct count wins

**Fits GameResult?** ✅ **BUT needs special handling for cooperative**
```typescript
{
  gameType: 'memory-quiz',
  duration: gameTime,
  playerResults: [{
    playerId,
    won: playMode === 'cooperative'
      ? foundAll  // All players win or lose together
      : hasHighestScore,  // Individual winner
    score: playerScores[playerId].correct,
    accuracy: correct / (correct + incorrect),
    metrics: {
      correct: playerScores[playerId].correct,
      incorrect: playerScores[playerId].incorrect,
      difficulty: selectedCount
    }
  }],
  metadata: {
    playMode: 'cooperative' | 'competitive',
    isTeamVictory: boolean  // ← IMPORTANT for cooperative games
  }
}
```

**NEW INSIGHT**: Cooperative games need special handling - all players share win/loss!

---

### 4. Card Sorting

**Game Type**: Sorting/Puzzle
**Players**: 1-N (solo, collaborative, competitive, relay)
**How to Win**:
- Solo: achieve high score (0-100)
- Collaborative: team achieves score
- Competitive: highest individual score
- Relay: TBD (not fully implemented)

**Data Tracked**:
```typescript
{
  scoreBreakdown: {
    finalScore: 0-100
    exactMatches: number
    lcsLength: number // Longest common subsequence
    inversions: number // Out-of-order pairs
    relativeOrderScore: 0-100
    exactPositionScore: 0-100
    inversionScore: 0-100
    elapsedTime: seconds
  }
  gameMode: 'solo' | 'collaborative' | 'competitive' | 'relay'
}
```

**Winner Determination**:
- Solo/Collaborative: score > threshold (e.g., 70+)
- Competitive: highest score

**Fits GameResult?** ✅ **Similar to Memory Quiz**
```typescript
{
  gameType: 'card-sorting',
  duration: elapsedTime * 1000,
  playerResults: [{
    playerId,
    won: gameMode === 'collaborative'
      ? scoreBreakdown.finalScore >= 70  // Team threshold
      : hasHighestScore,
    score: scoreBreakdown.finalScore,
    accuracy: scoreBreakdown.exactMatches / cardCount,
    metrics: {
      exactMatches: scoreBreakdown.exactMatches,
      inversions: scoreBreakdown.inversions,
      lcsLength: scoreBreakdown.lcsLength
    }
  }],
  metadata: {
    gameMode,
    isTeamVictory: gameMode === 'collaborative'
  }
}
```

---

### 5. Rithmomachia

**Game Type**: Strategic board game (2-player only)
**Players**: Exactly 2 (White vs Black)
**How to Win**: Multiple victory conditions (harmony, points, exhaustion, resignation)

**Data Tracked**:
```typescript
{
  winner: 'W' | 'B' | null
  winCondition: 'HARMONY' | 'EXHAUSTION' | 'RESIGNATION' | 'POINTS' | ...
  capturedPieces: { W: Piece[], B: Piece[] }
  pointsCaptured: { W: number, B: number }
  history: MoveRecord[]
  gameTime: milliseconds (computed from history)
}
```

**Winner Determination**:
- Specific win condition triggered
- No draws (or rare)

**Fits GameResult?** ✅ **Needs win condition metadata**
```typescript
{
  gameType: 'rithmomachia',
  duration: gameTime,
  playerResults: [
    {
      playerId: whitePlayerId,
      won: winner === 'W',
      score: capturedPieces.W.length,  // or pointsCaptured.W
      metrics: {
        capturedPieces: capturedPieces.W.length,
        points: pointsCaptured?.W || 0,
        moves: history.filter(m => m.color === 'W').length
      }
    },
    {
      playerId: blackPlayerId,
      won: winner === 'B',
      score: capturedPieces.B.length,
      metrics: {
        capturedPieces: capturedPieces.B.length,
        points: pointsCaptured?.B || 0,
        moves: history.filter(m => m.color === 'B').length
      }
    }
  ],
  metadata: {
    winCondition: 'HARMONY' | 'POINTS' | ...
  }
}
```

---

## Cross-Game Patterns Identified

### Pattern 1: Competitive (Most Common)
**Games**: Matching (multiplayer), Complement Race, Memory Quiz (competitive), Card Sorting (competitive)

**Characteristics**:
- Each player has their own score
- Winner = highest score
- Players track individually

**Stats to track per player**:
- games_played ++
- wins ++ (if winner)
- losses ++ (if not winner)
- best_time (if faster)
- highest_accuracy (if better)

---

### Pattern 2: Cooperative (Team-Based)
**Games**: Memory Quiz (cooperative), Card Sorting (collaborative)

**Characteristics**:
- All players share outcome
- Team wins or loses together
- Individual contributions still tracked

**Stats to track per player**:
- games_played ++
- wins ++ (if TEAM won) ← Key difference
- losses ++ (if TEAM lost)
- Individual metrics still tracked (correct answers, etc.)

**CRITICAL**: Check `metadata.isTeamVictory` to determine if all players get same win/loss!

---

### Pattern 3: Head-to-Head (Exactly 2 Players)
**Games**: Rithmomachia

**Characteristics**:
- Always 2 players
- One wins, one loses (rare draws)
- Different win conditions

**Stats to track per player**:
- games_played ++
- wins ++ (winner only)
- losses ++ (loser only)
- Game-specific metrics (captures, harmonies)

---

### Pattern 4: Solo Completion
**Games**: Matching (solo), Complement Race (practice), Memory Quiz (solo), Card Sorting (solo)

**Characteristics**:
- Single player
- Win = completion or threshold
- Compete against self/time

**Stats to track**:
- games_played ++
- wins ++ (if completed/threshold met)
- losses ++ (if failed/gave up)
- best_time, highest_accuracy

---

## Refined Universal Data Model

### GameResult Type (UPDATED)

```typescript
export interface GameResult {
  // Game identification
  gameType: string  // e.g., "matching", "complement-race", etc.

  // Player results (supports 1-N players)
  playerResults: PlayerGameResult[]

  // Timing
  completedAt: number  // timestamp
  duration: number     // milliseconds

  // Optional game-specific data
  metadata?: {
    // For cooperative games
    isTeamVictory?: boolean  // ← NEW: all players share win/loss

    // For specific win conditions
    winCondition?: string  // e.g., "HARMONY", "POINTS", "TIMEOUT"

    // For game modes
    gameMode?: string  // e.g., "solo", "competitive", "cooperative"

    // Any other game-specific info
    [key: string]: unknown
  }
}

export interface PlayerGameResult {
  playerId: string

  // Outcome
  won: boolean  // For cooperative: all players same value
  placement?: number  // 1st, 2nd, 3rd (for competitive with >2 players)

  // Performance
  score?: number
  accuracy?: number  // 0.0 - 1.0
  completionTime?: number  // milliseconds (player-specific time)

  // Game-specific metrics (optional, stored as JSON in DB)
  metrics?: {
    // Matching
    moves?: number
    matchedPairs?: number
    difficulty?: number

    // Complement Race
    streak?: number
    correctAnswers?: number
    totalQuestions?: number

    // Memory Quiz
    correct?: number
    incorrect?: number

    // Card Sorting
    exactMatches?: number
    inversions?: number
    lcsLength?: number

    // Rithmomachia
    capturedPieces?: number
    points?: number

    // Extensible for future games
    [key: string]: unknown
  }
}
```

---

## Stats Recording Logic (UPDATED)

### For Each Player in GameResult

```typescript
// Fetch player stats
const stats = await getPlayerStats(playerId)

// Always increment
stats.gamesPlayed++

// Handle wins/losses based on game type
if (gameResult.metadata?.isTeamVictory !== undefined) {
  // COOPERATIVE: All players share outcome
  if (playerResult.won) {
    stats.totalWins++
  } else {
    stats.totalLosses++
  }
} else {
  // COMPETITIVE/SOLO: Individual outcome
  if (playerResult.won) {
    stats.totalWins++
  } else {
    stats.totalLosses++
  }
}

// Update performance metrics
if (playerResult.completionTime && (
  !stats.bestTime || playerResult.completionTime < stats.bestTime
)) {
  stats.bestTime = playerResult.completionTime
}

if (playerResult.accuracy && playerResult.accuracy > stats.highestAccuracy) {
  stats.highestAccuracy = playerResult.accuracy
}

// Update per-game stats (JSON)
stats.gameStats[gameResult.gameType] = {
  gamesPlayed: (stats.gameStats[gameResult.gameType]?.gamesPlayed || 0) + 1,
  wins: (stats.gameStats[gameResult.gameType]?.wins || 0) + (playerResult.won ? 1 : 0),
  // ... other game-specific aggregates
}

// Update favorite game type (most played)
stats.favoriteGameType = getMostPlayedGame(stats.gameStats)

// Update timestamps
stats.lastPlayedAt = gameResult.completedAt
stats.updatedAt = Date.now()
```

---

## Database Schema (CONFIRMED)

No changes needed from original design! The `metrics` JSON field handles game-specific data perfectly.

```sql
CREATE TABLE player_stats (
  player_id TEXT PRIMARY KEY,

  -- Aggregates
  games_played INTEGER NOT NULL DEFAULT 0,
  total_wins INTEGER NOT NULL DEFAULT 0,
  total_losses INTEGER NOT NULL DEFAULT 0,

  -- Performance
  best_time INTEGER,
  highest_accuracy REAL NOT NULL DEFAULT 0,

  -- Per-game breakdown (JSON)
  game_stats TEXT NOT NULL DEFAULT '{}',

  -- Meta
  favorite_game_type TEXT,
  last_played_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

---

## Key Insights & Design Decisions

### 1. Cooperative Games Need Special Flag
**Problem**: Memory Quiz (cooperative) and Card Sorting (collaborative) - all players share win/loss.

**Solution**: Add `metadata.isTeamVictory: boolean` to `GameResult`. When `true`, recording logic gives ALL players the same win/loss.

### 2. Flexible Metrics Field
**Problem**: Each game tracks different metrics (moves, streak, inversions, etc.).

**Solution**: `PlayerGameResult.metrics` is an open object. Store game-specific data here, saved as JSON in DB.

### 3. Placement for Tournaments
**Problem**: 3+ player games need to track ranking (1st, 2nd, 3rd).

**Solution**: `PlayerGameResult.placement` field. Useful for leaderboards.

### 4. Win Conditions Matter
**Problem**: Rithmomachia has multiple win conditions (harmony, points, etc.).

**Solution**: `metadata.winCondition` stores how the game was won. Useful for achievements/stats breakdown.

### 5. Score is Optional
**Problem**: Not all games have scores (e.g., Rithmomachia can win by harmony without points enabled).

**Solution**: Make `score` optional. Use `won` as primary outcome indicator.

---

## Testing Matrix

### Scenarios to Test

| Game | Mode | Players | Expected Outcome |
|------|------|---------|------------------|
| Matching | Solo | 1 | Player wins if completed |
| Matching | Competitive | 2+ | Winner = highest score, others lose |
| Complement Race | Sprint | 2+ | Winner = highest score |
| Memory Quiz | Cooperative | 2+ | ALL win or ALL lose (team) |
| Memory Quiz | Competitive | 2+ | Winner = most correct |
| Card Sorting | Solo | 1 | Win if score >= 70 |
| Card Sorting | Collaborative | 2+ | ALL win or ALL lose (team) |
| Card Sorting | Competitive | 2+ | Winner = highest score |
| Rithmomachia | PvP | 2 | One wins (by condition), one loses |

---

## Conclusion

✅ **Universal `GameResult` type CONFIRMED to work for all games**

**Key Requirements**:
1. Support 1-N players (flexible array)
2. Support cooperative games (isTeamVictory flag)
3. Support game-specific metrics (open metrics object)
4. Support multiple win conditions (winCondition metadata)
5. Track both individual AND team performance

**Next Steps**:
1. Update `.claude/PER_PLAYER_STATS_ARCHITECTURE.md` with refined types
2. Implement database schema
3. Build API endpoints
4. Create React hooks
5. Integrate with each game (starting with Matching)

---

**Status**: ✅ Complete cross-game analysis
**Result**: GameResult type is universal and robust
**Date**: 2025-01-03
