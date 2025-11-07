# Per-Player Stats Architecture & Implementation Plan

## Executive Summary

This document outlines the architecture for tracking game statistics per-player (not per-user). Each local player profile will maintain their own game history, wins, losses, and performance metrics. We'll build a universal framework that any arcade game can use to record results.

**Starting point**: Matching/Memory Lightning game

## Current State Problems

1. ❌ Global `user_stats` table exists but games never update it
2. ❌ `/games` page shows same global stats for all players
3. ❌ No framework for games to save results
4. ❌ Players table has no stats fields

## Architecture Design

### 1. Database Schema

#### New Table: `player_stats`

```sql
CREATE TABLE player_stats (
  player_id TEXT PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,

  -- Aggregate stats
  games_played INTEGER NOT NULL DEFAULT 0,
  total_wins INTEGER NOT NULL DEFAULT 0,
  total_losses INTEGER NOT NULL DEFAULT 0,

  -- Performance metrics
  best_time INTEGER,              -- Best completion time (ms)
  highest_accuracy REAL NOT NULL DEFAULT 0,  -- 0.0 - 1.0

  -- Game preferences
  favorite_game_type TEXT,        -- Most played game

  -- Per-game stats (JSON)
  game_stats TEXT NOT NULL DEFAULT '{}',  -- { "matching": { wins: 5, played: 10 }, ... }

  -- Timestamps
  last_played_at INTEGER,         -- timestamp
  created_at INTEGER NOT NULL,    -- timestamp
  updated_at INTEGER NOT NULL     -- timestamp
);

CREATE INDEX player_stats_last_played_idx ON player_stats(last_played_at);
```

#### Per-Game Stats Structure (JSON)

```typescript
type PerGameStats = {
  [gameName: string]: {
    gamesPlayed: number;
    wins: number;
    losses: number;
    bestTime: number | null;
    highestAccuracy: number;
    averageScore: number;
    lastPlayed: number; // timestamp
  };
};
```

#### Keep `user_stats`?

**Decision**: Deprecate `user_stats` table. All stats are now per-player.

**Reasoning**:

- Users can have multiple players
- Aggregate "user level" stats can be computed by summing player stats
- Simpler mental model: players compete, players have stats
- `/games` page displays players, so showing player stats makes sense

### 2. Universal Game Result Types

**Analysis**: Examined 5 arcade games (Matching, Complement Race, Memory Quiz, Card Sorting, Rithmomachia)
**Key Finding**: Cooperative games need special handling - all players share win/loss!
**See**: `.claude/GAME_STATS_COMPARISON.md` for detailed cross-game analysis

```typescript
// src/lib/arcade/stats/types.ts

/**
 * Standard game result that all arcade games must provide
 *
 * Supports:
 * - 1-N players
 * - Competitive (individual winners)
 * - Cooperative (team wins/losses)
 * - Solo completion
 * - Head-to-head (2-player)
 */
export interface GameResult {
  // Game identification
  gameType: string; // e.g., "matching", "complement-race", "memory-quiz"

  // Player results (for multiplayer, array of results)
  playerResults: PlayerGameResult[];

  // Game metadata
  completedAt: number; // timestamp
  duration: number; // milliseconds

  // Optional game-specific data
  metadata?: {
    // For cooperative games (Memory Quiz, Card Sorting collaborative)
    isTeamVictory?: boolean; // All players share win/loss

    // For specific win conditions (Rithmomachia)
    winCondition?: string; // e.g., "HARMONY", "POINTS", "TIMEOUT"

    // For game modes
    gameMode?: string; // e.g., "solo", "competitive", "cooperative"

    // Extensible for other game-specific info
    [key: string]: unknown;
  };
}

export interface PlayerGameResult {
  playerId: string;

  // Outcome
  won: boolean; // For cooperative: all players have same value
  placement?: number; // 1st, 2nd, 3rd place (for tournaments with 3+ players)

  // Performance
  score?: number;
  accuracy?: number; // 0.0 - 1.0
  completionTime?: number; // milliseconds (player-specific)

  // Game-specific metrics (stored as JSON in DB)
  metrics?: {
    // Matching
    moves?: number;
    matchedPairs?: number;
    difficulty?: number;

    // Complement Race
    streak?: number;
    correctAnswers?: number;
    totalQuestions?: number;

    // Memory Quiz
    correct?: number;
    incorrect?: number;

    // Card Sorting
    exactMatches?: number;
    inversions?: number;
    lcsLength?: number;

    // Rithmomachia
    capturedPieces?: number;
    points?: number;

    // Extensible for future games
    [key: string]: unknown;
  };
}

/**
 * Stats update returned from API
 */
export interface StatsUpdate {
  playerId: string;
  previousStats: PlayerStats;
  newStats: PlayerStats;
  changes: {
    gamesPlayed: number;
    wins: number;
    losses: number;
  };
}

export interface PlayerStats {
  playerId: string;
  gamesPlayed: number;
  totalWins: number;
  totalLosses: number;
  bestTime: number | null;
  highestAccuracy: number;
  favoriteGameType: string | null;
  gameStats: PerGameStats;
  lastPlayedAt: number | null;
  createdAt: number;
  updatedAt: number;
}
```

### 3. API Endpoints

#### POST `/api/player-stats/record-game`

Records a game result and updates player stats.

**Request:**

```typescript
{
  gameResult: GameResult;
}
```

**Response:**

```typescript
{
  success: true,
  updates: StatsUpdate[]  // One per player
}
```

**Logic:**

1. Validate game result structure
2. For each player result:
   - Fetch or create player_stats record
   - Increment games_played
   - Increment wins/losses based on outcome
     - **Special case**: If `metadata.isTeamVictory === true`, all players share win/loss
     - Cooperative games: all win or all lose together
     - Competitive games: individual outcomes
   - Update best_time if improved
   - Update highest_accuracy if improved
   - Update game-specific stats in JSON
   - Update favorite_game_type based on most played
   - Set last_played_at
3. Return updates for all players

**Example pseudo-code**:

```typescript
for (const playerResult of gameResult.playerResults) {
  const stats = await getPlayerStats(playerResult.playerId);

  stats.gamesPlayed++;

  // Handle cooperative games specially
  if (gameResult.metadata?.isTeamVictory !== undefined) {
    // Cooperative: all players share outcome
    if (playerResult.won) {
      stats.totalWins++;
    } else {
      stats.totalLosses++;
    }
  } else {
    // Competitive/Solo: individual outcome
    if (playerResult.won) {
      stats.totalWins++;
    } else {
      stats.totalLosses++;
    }
  }

  // ... rest of stats update
}
```

#### GET `/api/player-stats/:playerId`

Fetch stats for a specific player.

**Response:**

```typescript
{
  stats: PlayerStats;
}
```

#### GET `/api/player-stats`

Fetch stats for all current user's players.

**Response:**

```typescript
{
  playerStats: PlayerStats[]
}
```

### 4. React Hooks

#### `useRecordGameResult()`

Main hook that games use to record results.

```typescript
// src/hooks/useRecordGameResult.ts

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { GameResult, StatsUpdate } from "@/lib/arcade/stats/types";

export function useRecordGameResult() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (gameResult: GameResult): Promise<StatsUpdate[]> => {
      const res = await fetch("/api/player-stats/record-game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameResult }),
      });

      if (!res.ok) throw new Error("Failed to record game result");

      const data = await res.json();
      return data.updates;
    },

    onSuccess: (updates) => {
      // Invalidate player stats queries to trigger refetch
      queryClient.invalidateQueries({ queryKey: ["player-stats"] });

      // Show success feedback (optional)
      console.log("✅ Game result recorded:", updates);
    },

    onError: (error) => {
      console.error("❌ Failed to record game result:", error);
    },
  });
}
```

#### `usePlayerStats(playerId?)`

Fetch stats for a player (or all players if no ID).

```typescript
// src/hooks/usePlayerStats.ts

import { useQuery } from "@tanstack/react-query";
import type { PlayerStats } from "@/lib/arcade/stats/types";

export function usePlayerStats(playerId?: string) {
  return useQuery({
    queryKey: playerId ? ["player-stats", playerId] : ["player-stats"],
    queryFn: async (): Promise<PlayerStats | PlayerStats[]> => {
      const url = playerId
        ? `/api/player-stats/${playerId}`
        : "/api/player-stats";

      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch player stats");

      const data = await res.json();
      return playerId ? data.stats : data.playerStats;
    },
  });
}
```

### 5. Game Integration Pattern

Every arcade game should follow this pattern when completing:

```typescript
// In results phase component (e.g., ResultsPhase.tsx)

import { useRecordGameResult } from '@/hooks/useRecordGameResult'
import type { GameResult } from '@/lib/arcade/stats/types'

export function ResultsPhase() {
  const { state, activePlayers } = useGameContext()
  const { mutate: recordGame, isPending } = useRecordGameResult()

  // Record game result on mount (once)
  useEffect(() => {
    if (state.phase === 'results' && !state.recorded) {
      const gameResult: GameResult = {
        gameType: 'matching',
        completedAt: Date.now(),
        duration: state.gameEndTime - state.gameStartTime,
        playerResults: activePlayers.map(player => ({
          playerId: player.id,
          won: player.id === winnerId,
          score: player.matchCount,
          accuracy: player.matchCount / state.totalPairs,
          completionTime: player.completionTime,
        })),
      }

      recordGame(gameResult, {
        onSuccess: () => {
          // Mark as recorded to prevent duplicates
          setState({ recorded: true })
        }
      })
    }
  }, [state.phase, state.recorded])

  // Show loading state while recording
  if (isPending) {
    return <div>Saving results...</div>
  }

  // Show results UI
  return <div>...</div>
}
```

## Implementation Plan

### Phase 1: Foundation (Database & API)

1. **Create database schema**
   - File: `src/db/schema/player-stats.ts`
   - Define `player_stats` table with Drizzle ORM
   - Add type exports

2. **Generate migration**

   ```bash
   npx drizzle-kit generate:sqlite
   ```

3. **Create type definitions**
   - File: `src/lib/arcade/stats/types.ts`
   - Define `GameResult`, `PlayerGameResult`, `StatsUpdate`, `PlayerStats`

4. **Build API endpoint**
   - File: `src/app/api/player-stats/record-game/route.ts`
   - Implement POST handler with validation
   - Handle per-player stat updates
   - Transaction safety

5. **Build query endpoints**
   - File: `src/app/api/player-stats/route.ts` (GET all)
   - File: `src/app/api/player-stats/[playerId]/route.ts` (GET one)

### Phase 2: React Hooks & Integration

6. **Create React hooks**
   - File: `src/hooks/useRecordGameResult.ts`
   - File: `src/hooks/usePlayerStats.ts`

7. **Update GameModeContext**
   - Expose helper to get player stats map
   - Integrate with usePlayerStats hook

### Phase 3: Matching Game Integration

8. **Analyze matching game completion flow**
   - Find where game completes
   - Identify winner calculation
   - Map state to GameResult format

9. **Integrate stats recording**
   - Add useRecordGameResult to ResultsPhase
   - Build GameResult from game state
   - Handle recording state to prevent duplicates

10. **Test matching game stats**
    - Play solo game, verify stats update
    - Play multiplayer game, verify all players update
    - Check accuracy calculations
    - Check time tracking

### Phase 4: UI Updates

11. **Update /games page**
    - Fetch per-player stats with usePlayerStats
    - Display correct stats for each player card
    - Remove dependency on global user profile

12. **Add stats visualization**
    - Per-game breakdown
    - Win/loss ratio
    - Performance trends

### Phase 5: Documentation & Rollout

13. **Document integration pattern**
    - Create guide for adding stats to other games
    - Code examples
    - Common pitfalls

14. **Roll out to other games**
    - Complement Race
    - Memory Quiz
    - Card Sorting
    - (Future games)

## Data Migration Strategy

### Handling Existing `user_stats`

**Option A: Drop the table**

- Simple, clean break
- No historical data

**Option B: Migrate to player stats**

- For each user with stats, assign to their first/active player
- More complex but preserves history

**Recommendation**: Option A (drop it) since:

- Very new feature, unlikely much data exists
- Cleaner architecture
- Users can rebuild stats by playing

### Migration SQL

```sql
-- Drop old user_stats table
DROP TABLE IF EXISTS user_stats;

-- Create new player_stats table
-- (Drizzle migration will handle this)
```

## Testing Strategy

### Unit Tests

- `GameResult` validation
- Stats calculation logic
- JSON merge for per-game stats
- Favorite game detection

### Integration Tests

- API endpoint: record game, verify DB update
- API endpoint: fetch stats, verify response
- React hook: record game, verify cache invalidation

### E2E Tests

- Play matching game solo, check stats on /games page
- Play matching game multiplayer, verify each player's stats
- Verify stats persist across sessions

## Success Criteria

✅ Player stats save correctly after game completion
✅ Each player maintains separate stats
✅ /games page displays correct per-player stats
✅ Stats survive page refresh
✅ Multiplayer games update all participants
✅ Framework is reusable for other games
✅ No duplicate recordings
✅ Performance acceptable (< 200ms to record)

## Open Questions

1. **Leaderboards?** - Future consideration, need global rankings
2. **Historical games?** - Store individual game records or just aggregates?
3. **Stats reset?** - Should users be able to reset player stats?
4. **Achievements?** - Track milestones? (100 games, 50 wins, etc.)

## File Structure

```
src/
├── db/
│   └── schema/
│       └── player-stats.ts          # NEW: Drizzle schema
├── lib/
│   └── arcade/
│       └── stats/
│           ├── types.ts             # NEW: Type definitions
│           └── utils.ts             # NEW: Helper functions
├── hooks/
│   ├── useRecordGameResult.ts       # NEW: Record game hook
│   └── usePlayerStats.ts            # NEW: Fetch stats hook
├── app/
│   └── api/
│       └── player-stats/
│           ├── route.ts             # NEW: GET all
│           ├── record-game/
│           │   └── route.ts         # NEW: POST record
│           └── [playerId]/
│               └── route.ts         # NEW: GET one
└── arcade-games/
    └── matching/
        └── components/
            └── ResultsPhase.tsx     # MODIFY: Add stats recording

.claude/
└── PER_PLAYER_STATS_ARCHITECTURE.md # THIS FILE
```

## Next Steps

1. Review this plan with user
2. Create database schema and types
3. Build API endpoints
4. Create React hooks
5. Integrate with matching game
6. Test thoroughly
7. Roll out to other games

---

**Document Status**: Draft for review
**Last Updated**: 2025-01-03
**Owner**: Claude Code
