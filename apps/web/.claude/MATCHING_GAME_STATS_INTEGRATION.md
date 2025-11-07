# Matching Game Stats Integration Guide

## Quick Reference

**Files to modify**: `src/arcade-games/matching/components/ResultsPhase.tsx`

**What we're adding**: Call `useRecordGameResult()` when game completes to save per-player stats.

## Current State Analysis

### ResultsPhase.tsx (lines 9-29)

Already has all the data we need:

```typescript
const { state, resetGame, activePlayers, gameMode, exitSession } =
  useMatching();
const { players: playerMap, activePlayers: activePlayerIds } = useGameMode();

const gameTime =
  state.gameEndTime && state.gameStartTime
    ? state.gameEndTime - state.gameStartTime
    : 0;

const analysis = getPerformanceAnalysis(state);
const multiplayerResult =
  gameMode === "multiplayer"
    ? getMultiplayerWinner(state, activePlayers)
    : null;
```

**Available data:**

- ✅ `state.scores` - scores by player ID
- ✅ `state.gameStartTime`, `state.gameEndTime` - timing
- ✅ `state.matchedPairs`, `state.totalPairs` - completion
- ✅ `state.moves` - total moves
- ✅ `activePlayers` - array of player IDs
- ✅ `multiplayerResult.winners` - who won
- ✅ `analysis.statistics.accuracy` - accuracy percentage

## Implementation Steps

### Step 1: Add state flag to prevent duplicate recording

Add `recorded: boolean` to `MatchingState` type:

```typescript
// src/arcade-games/matching/types.ts (add to MatchingState interface)

export interface MatchingState extends GameState {
  // ... existing fields ...

  // Stats recording
  recorded?: boolean; // ← ADD THIS
}
```

### Step 2: Import the hook in ResultsPhase.tsx

```typescript
// At top of src/arcade-games/matching/components/ResultsPhase.tsx

import { useEffect } from "react"; // ← ADD if not present
import { useRecordGameResult } from "@/hooks/useRecordGameResult";
import type { GameResult } from "@/lib/arcade/stats/types";
```

### Step 3: Call the hook

```typescript
// Inside ResultsPhase component, after existing hooks

export function ResultsPhase() {
  const router = useRouter()
  const { state, resetGame, activePlayers, gameMode, exitSession } = useMatching()
  const { players: playerMap, activePlayers: activePlayerIds } = useGameMode()

  // ← ADD THIS
  const { mutate: recordGame, isPending: isRecording } = useRecordGameResult()

  // ... existing code ...
```

### Step 4: Record game result on mount

Add this useEffect after the hook declarations:

```typescript
// Record game result once when entering results phase
useEffect(() => {
  // Only record if we haven't already
  if (state.phase === "results" && !state.recorded && !isRecording) {
    const gameTime =
      state.gameEndTime && state.gameStartTime
        ? state.gameEndTime - state.gameStartTime
        : 0;

    const analysis = getPerformanceAnalysis(state);
    const multiplayerResult =
      gameMode === "multiplayer"
        ? getMultiplayerWinner(state, activePlayers)
        : null;

    // Build GameResult
    const gameResult: GameResult = {
      gameType:
        state.gameType === "abacus-numeral"
          ? "matching-abacus"
          : "matching-complements",
      completedAt: state.gameEndTime || Date.now(),
      duration: gameTime,

      playerResults: activePlayers.map((playerId) => {
        const score = state.scores[playerId] || 0;
        const won = multiplayerResult
          ? multiplayerResult.winners.includes(playerId)
          : state.matchedPairs === state.totalPairs; // Solo = completed

        // In multiplayer, calculate per-player accuracy from their score
        // In single player, use overall accuracy
        const playerAccuracy =
          gameMode === "multiplayer"
            ? score / state.totalPairs // Their score as fraction of total pairs
            : analysis.statistics.accuracy / 100; // Convert percentage to 0-1

        return {
          playerId,
          won,
          score,
          accuracy: playerAccuracy,
          completionTime: gameTime,
          metrics: {
            moves: state.moves,
            matchedPairs: state.matchedPairs,
            difficulty: state.difficulty,
          },
        };
      }),

      metadata: {
        gameType: state.gameType,
        difficulty: state.difficulty,
        grade: analysis.grade,
        starRating: analysis.starRating,
      },
    };

    // Record to database
    recordGame(gameResult, {
      onSuccess: (updates) => {
        console.log("✅ Stats recorded:", updates);
        // Mark as recorded to prevent duplicate saves
        // Note: This assumes Provider has a way to update state.recorded
        // We'll need to add an action for this
      },
      onError: (error) => {
        console.error("❌ Failed to record stats:", error);
      },
    });
  }
}, [state.phase, state.recorded, isRecording /* ... deps */]);
```

### Step 5: Add loading state UI (optional)

Show a subtle loading indicator while recording:

```typescript
// At the top of the return statement in ResultsPhase

if (isRecording) {
  return (
    <div className={css({
      textAlign: 'center',
      padding: '20px',
    })}>
      <p>Saving results...</p>
    </div>
  )
}
```

Or keep it subtle and just disable buttons:

```typescript
// On the "Play Again" button
<button
  disabled={isRecording}
  className={css({
    // ... styles ...
    opacity: isRecording ? 0.5 : 1,
    cursor: isRecording ? 'not-allowed' : 'pointer',
  })}
  onClick={resetGame}
>
  {isRecording ? '💾 Saving...' : '🎮 Play Again'}
</button>
```

## Provider Changes Needed

The Provider needs an action to mark the game as recorded:

```typescript
// src/arcade-games/matching/Provider.tsx

// Add to the context type
export interface MatchingContextType {
  // ... existing ...
  markAsRecorded: () => void; // ← ADD THIS
}

// Add to the reducer or state update logic
const markAsRecorded = useCallback(() => {
  setState((prev) => ({ ...prev, recorded: true }));
}, []);

// Add to the context value
const contextValue: MatchingContextType = {
  // ... existing ...
  markAsRecorded,
};
```

Then in ResultsPhase useEffect:

```typescript
onSuccess: (updates) => {
  console.log("✅ Stats recorded:", updates);
  markAsRecorded(); // ← Use this instead
};
```

## Testing Checklist

### Solo Game

- [ ] Play a game to completion
- [ ] Check console for "✅ Stats recorded"
- [ ] Refresh page
- [ ] Go to `/games` page
- [ ] Verify player's gamesPlayed incremented
- [ ] Verify player's totalWins incremented (if completed)

### Multiplayer Game

- [ ] Activate 2+ players
- [ ] Play a game to completion
- [ ] Check console for stats for ALL players
- [ ] Go to `/games` page
- [ ] Verify each player's stats updated independently
- [ ] Winner should have +1 win
- [ ] All players should have +1 games played

### Edge Cases

- [ ] Incomplete game (exit early) - should NOT record
- [ ] Play again from results - should NOT duplicate record
- [ ] Network error during save - should show error, not mark as recorded

## Common Issues

### Issue: Stats recorded multiple times

**Cause**: useEffect dependency array missing or incorrect
**Fix**: Ensure `state.recorded` is in deps and checked in condition

### Issue: Can't read property 'id' of undefined

**Cause**: Player not found in playerMap
**Fix**: Add null checks when mapping activePlayers

### Issue: Accuracy is always 100% or 0%

**Cause**: Wrong calculation or unit (percentage vs decimal)
**Fix**: Ensure accuracy is 0.0 - 1.0, not 0-100

### Issue: Single player never "wins"

**Cause**: Wrong win condition for solo mode
**Fix**: Solo player wins if they complete all pairs (`state.matchedPairs === state.totalPairs`)

## Next Steps After Integration

1. ✅ Verify stats save correctly
2. ✅ Update `/games` page to fetch and display per-player stats
3. ✅ Test with different game modes and difficulties
4. 🔄 Repeat this pattern for other arcade games
5. 📊 Add stats visualization/charts (future)

---

**Status**: Ready for implementation
**Blocked by**:

- Database schema (player_stats table)
- API endpoints (/api/player-stats/record-game)
- React hooks (useRecordGameResult)
