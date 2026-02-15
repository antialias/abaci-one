# Voice Session Mode State Machine

## What is a session mode?

Every voice call goes through distinct phases — greeting, getting to know the child, open conversation, games, explorations, hanging up. Each phase has different needs: different agent instructions and different tools.

A **session mode** packages both `instructions` and `tools` together. When the mode changes, `session.update` atomically swaps what the agent knows and can do. This prevents tool confusion (e.g., the agent calling `evolve_story` mid-game) and keeps prompts focused.

## How the state machine works

### Mode stack (depth 2)

Modes use a simple push/pop stack capped at depth 2:
- `activeModeRef` — the current mode
- `previousModeRef` — saved when entering a nested mode (game/exploration from default/conference)

Three operations:
- `enterMode(dc, newMode, savePrevious?)` — push a new mode, optionally saving the current one
- `exitMode(dc)` — pop back to `previousMode` (or default if none saved)
- `updateSession(dc)` — refresh the current mode (e.g., after speaker change or profile load)

### Call lifecycle

```
answering → familiarizing → default ↔ conference
                              ↕            ↕
                         game / exploration
```

Every mode can transition to `hanging_up`:
```
any mode ──timer expires──→ hanging_up ──hang_up──→ idle
```

## Current modes

### answering
- **Entry**: Call connects (`session.created`)
- **Exit**: After agent's 1st `response.done` → familiarizing (or default if profile pre-loaded)
- **Tools**: `look_at`, `hang_up`
- **Instructions**: Focused greeting — who you are, what you were doing, how to answer

### familiarizing
- **Entry**: Auto after answering (when no profile pre-loaded)
- **Exit**: `identify_caller` completes → default, OR 4th response.done → default (auto)
- **Tools**: `identify_caller` (if players available), `look_at`, `indicate`, `hang_up`
- **Instructions**: Get to know the child, ask their name, match to player list

### default
- **Entry**: After familiarizing, or directly from answering if profile pre-loaded
- **Exit**: Call ends
- **Tools**: All standard tools (request_more_time, hang_up, transfer_call, add_to_call, start_exploration, look_at, evolve_story, start_game, set_number_line_style, indicate)
- **Instructions**: Full `generateNumberPersonality` output

### conference
- **Entry**: `add_to_call` tool
- **Exit**: `removeFromCall` to 1 remaining number
- **Tools**: switch_speaker, add_to_call, look_at, indicate, evolve_story, start_exploration, start_game, hang_up, request_more_time, set_number_line_style
- **Instructions**: `generateConferencePrompt` output

### exploration
- **Entry**: `start_exploration` (constant type)
- **Exit**: Exploration ends (detected via `isExplorationActiveRef`)
- **Tools**: `pause_exploration`, `resume_exploration`, `seek_exploration`, `hang_up`
- **Instructions**: "Stay quiet, narrator is speaking" + playback control guidance

### game
- **Entry**: `start_game` tool
- **Exit**: `end_game` tool
- **Tools**: Session-mode games get their `sessionTools` + `end_game` + `hang_up`. Legacy games get `indicate`, `look_at`, `end_game`, `hang_up`, `request_more_time`
- **Instructions**: Session-mode games use `sessionInstructions`. Legacy games get abbreviated identity + `agentRules`

### hanging_up
- **Entry**: Timer expires (system-initiated, not agent-initiated hang_up)
- **Exit**: Agent calls `hang_up` → cleanup
- **Tools**: `hang_up` only
- **Instructions**: Focused "say goodbye NOW, then hang_up"

## Key files

| File | Purpose |
|------|---------|
| `sessionModes/types.ts` | `ModeId`, `ModeContext`, `RealtimeTool`, `AgentMode` interfaces |
| `sessionModes/tools.ts` | All tool definitions + composed sets per mode |
| `sessionModes/index.ts` | `MODE_MAP` registry + `resolveMode()` helper |
| `sessionModes/*.ts` | Individual mode definitions |
| `useRealtimeVoice.ts` | State machine (activeModeRef, enterMode, exitMode, updateSession) |
| `gameRegistry.ts` | `GameDefinition` with optional session mode fields |

## How to add a new session mode

1. Create `sessionModes/myMode.ts` implementing `AgentMode`:
   ```typescript
   export const myMode: AgentMode = {
     id: 'my_mode', // add to ModeId union in types.ts
     getInstructions: (ctx) => '...',
     getTools: (ctx) => [...],
   }
   ```
2. Add the ID to the `ModeId` union type in `types.ts`
3. Register in `MODE_MAP` in `index.ts`
4. Add transition trigger in `useRealtimeVoice.ts` (call `enterMode`/`exitMode`)
5. If the mode has custom tool handlers, add dispatch in the tool call handler

## How to add a new game with session mode

1. Add `sessionTools`, `sessionInstructions`, and `onToolCall` to your game definition:
   ```typescript
   export const myGame: GameDefinition = {
     id: 'my_game',
     name: 'My Game',
     description: '...',
     agentRules: '...', // still needed for prompt context
     sessionTools: [{ type: 'function', name: 'my_action', ... }],
     sessionInstructions: 'Focused game prompt...',
     onToolCall: (state, toolName, args) => ({ agentMessage: '...', state: newState }),
     onStart: (params) => ({ agentMessage: '...', state: initialState }),
   }
   ```
2. The framework handles everything else:
   - Enters game mode on `start_game` (focused instructions + session tools + end_game + hang_up)
   - Dispatches session tool calls via `onToolCall`
   - Exits game mode on `end_game` (restores previous mode)
   - Legacy `agentRules` are filtered from the main prompt (only included for games without `sessionInstructions`)
