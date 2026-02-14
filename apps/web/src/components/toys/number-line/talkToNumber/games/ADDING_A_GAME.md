# Adding a New Number Line Game

## Quick Start (3 steps)

### 1. Create the game definition

Create a new file in `games/` (e.g. `games/myGame.ts`):

```typescript
import type { GameDefinition, GameStartResult } from '../gameRegistry'

export const myGame: GameDefinition = {
  id: 'my_game',
  name: 'My Game',
  description: 'One-line description for the agent tool picker.',

  // Rules injected into the agent's prompt when this game is active.
  // Keep it focused — the agent reads this mid-conversation.
  agentRules:
    'Rule 1. Rule 2. Rule 3.',

  // Set true if the visual layer should send proximity zone updates
  // to the agent (like find_number does). Most games won't need this.
  needsProximityUpdates: false,

  // Validate start params. Throw to reject with an error message.
  onStart(params: Record<string, unknown>): GameStartResult {
    // validate params...
    return {
      agentMessage: 'Game started! Here is context for the agent...',
    }
  },
}
```

### 2. Register it

In `gameRegistry.ts`, import and add to the `GAMES` array:

```typescript
import { myGame } from './games/myGame'

export const GAMES: GameDefinition[] = [
  findNumberGame,
  myGame,        // <-- add here
]
```

That's it for the voice layer. The `start_game` tool, dispatching, prompt
injection, and `end_game` are all handled automatically.

### 3. Wire visual layer (if needed)

If your game needs a visual overlay or state in NumberLine.tsx, add cases
to the generic game callbacks:

```typescript
// In NumberLine.tsx — handleVoiceGameStart
const handleVoiceGameStart = useCallback((gameId: string, params: Record<string, unknown>) => {
  if (gameId === 'find_number') { ... }
  if (gameId === 'my_game') {
    // Set up visual state for your game
  }
}, [])

// In NumberLine.tsx — handleVoiceGameEnd
const handleVoiceGameEnd = useCallback((gameId: string) => {
  if (gameId === 'find_number') { ... }
  if (gameId === 'my_game') {
    // Tear down visual state
  }
}, [])
```

## What you get for free

| Feature | How it works |
|---------|-------------|
| `start_game` tool | Auto-generated from `GAMES` array. Agent sees all games and their descriptions. |
| `end_game` tool | Generic — works for any game. Tracks active game, prevents double-start. |
| Agent prompt | `buildToolGuide()` in `generateNumberPersonality.ts` lists all games and their `agentRules`. |
| Error handling | Invalid `game_id`, already-active game, failed `onStart` validation — all handled. |

## GameDefinition fields

| Field | Required | Purpose |
|-------|----------|---------|
| `id` | yes | Unique string used in `start_game` tool calls |
| `name` | yes | Human-readable name (shown in agent messages) |
| `description` | yes | One-liner for the `start_game` tool description |
| `agentRules` | yes | Rules injected into agent prompt during gameplay |
| `needsProximityUpdates` | no | If true, NumberLine sends proximity zone updates to agent |
| `onStart` | no | Validate params + return agent message. Throw to reject. |

## Tips

- **Keep `agentRules` concise.** The agent reads this mid-conversation. Focus on behavioral rules (what to say, what not to say), not implementation details.
- **Keep `description` action-oriented.** The agent uses this to decide when to start a game. "Challenge the child to estimate..." is better than "A game about estimation."
- **Params go through `start_game`'s `parameters` schema.** If your game needs custom params beyond `game_id`, add them to the `start_game` tool definition in `route.ts`. They arrive as `params` in both `onStart()` and `onGameStart()`.
- **Visual state lives in NumberLine.tsx**, not in the game definition. The registry handles voice-layer concerns; the visual layer dispatches by `gameId`.
