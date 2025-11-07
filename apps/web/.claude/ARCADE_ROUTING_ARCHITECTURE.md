# Arcade Routing Architecture - Complete Overview

## 1. Current /arcade Page

**File:** `/Users/antialias/projects/soroban-abacus-flashcards/apps/web/src/app/arcade/page.tsx` (lines 1-129)

**Purpose:** The main arcade landing page - displays the "Champion Arena"

**Key Components:**

- `ArcadeContent()` - Renders the main arcade interface
  - Uses `EnhancedChampionArena` component which contains `GameSelector`
  - The `GameSelector` displays all available games as cards
  - `GameSelector` includes both legacy games and registry games

**Current Flow:**

1. User navigates to `/arcade`
2. Page renders `FullscreenProvider` wrapper
3. Displays `PageWithNav` with title "🏟️ Champion Arena"
4. Content area shows `EnhancedChampionArena` → `GameSelector`
5. `GameSelector` renders `GameCard` components for each game
6. When user clicks a game card, `GameCard` calls `router.push(config.url)`
7. For registry games, `config.url` is `/arcade/room?game={gameName}`
8. For legacy games, URL would be direct to their page

**State Management:**

- `GameModeContext` provides player selection (emoji, name, color)
- `PageWithNav` wraps content and provides mini-nav with:
  - Active player list
  - Add player button
  - Game mode indicator (single/battle/tournament)
  - Exit session handler

## 2. Current /arcade/room Page

**File:** `/Users/antialias/projects/soroban-abacus-flashcards/apps/web/src/app/arcade/room/page.tsx` (lines 1-359)

**Purpose:** "Magical place" that shows either a game OR the game chooser, driven by room state

**Three States:**

### State 1: Loading

- Shows "Loading room..." message
- Waits for `useRoomData()` hook to resolve

### State 2: Game Selection UI (when `!roomData.gameName`)

- Shows large game selection buttons
- User clicks to select a game
- Calls `setRoomGame()` mutation to save selection to room
- Invokes `handleGameSelect()` which:
  1. Checks if game exists in registry via `hasGame(gameType)`
  2. If registry game: calls `setRoomGame({roomId, gameName: gameType})`
  3. If legacy game: maps to internal name via `GAME_TYPE_TO_NAME`, then calls `setRoomGame()`
  4. Game selection is persisted to the room database

### State 3: Game Display (when `roomData.gameName` is set)

- Checks game registry first via `hasGame(roomData.gameName)`
- If registry game:
  - Gets game definition via `getGame(roomData.gameName)`
  - Renders: `<Provider><GameComponent /></Provider>`
  - Provider and GameComponent come from game registry definition
- If legacy game:
  - Switch statement with TODO for individual games
  - Currently only shows "Game not yet supported"

**Key Hook:**

- `useRoomData()` - Fetches current room from API and subscribes to socket updates
  - Returns `roomData` with fields: `id`, `name`, `code`, `gameName`, `gameConfig`, `members`, `memberPlayers`
  - Also returns `isLoading` boolean

**Navigation Flow:**

1. User navigates to `/arcade`
2. `GameCard` onClick calls `router.push('/arcade/room?game={gameName}')`
3. User arrives at `/arcade/room`
4. If NOT in a room yet: Shows error with link back to `/arcade`
5. If in room but no game selected: Shows game selection UI
6. If game selected: Loads and displays game

## 3. The "Mini App Nav" - GameContextNav Component

**File:** `/Users/antialias/projects/soroban-abacus-flashcards/apps/web/src/components/nav/GameContextNav.tsx` (lines 1-372)

**What It Is:**
The "mini app nav" is actually a sophisticated component within the `PageWithNav` wrapper that intelligently shows different UI based on context:

**Components & Props:**

- `navTitle` - Current page title (e.g., "Champion Arena", "Choose Game", "Speed Complement Race")
- `navEmoji` - Icon emoji for current page
- `gameMode` - Computed from active player count: 'none' | 'single' | 'battle' | 'tournament'
- `activePlayers` - Array of selected players
- `inactivePlayers` - Array of available but unselected players
- `shouldEmphasize` - Boolean to emphasize player selection
- `showFullscreenSelection` - Boolean to show fullscreen mode for player selection
- `roomInfo` - Optional arcade room data (roomId, roomName, gameName, playerCount, joinCode)
- `networkPlayers` - Remote players from room members

**Three Display Modes:**

### Mode 1: Fullscreen Player Selection

- When `showFullscreenSelection === true`
- Displays:
  - Large title with emoji
  - Game mode indicator
  - Fullscreen player selection UI
  - Shows all inactive players for selection

### Mode 2: Solo Mode (NOT in room)

- When `roomInfo` is undefined
- Shows:
  - **Game Title Section** (left side):
    - `GameTitleMenu` with game title and emoji
    - Menu options: Setup, New Game, Quit
    - `GameModeIndicator`
  - **Player Section** (right side):
    - `ActivePlayersList` - shows selected players
    - `AddPlayerButton` - add more players

### Mode 3: Room Mode (IN a room)

- When `roomInfo` is defined
- Shows:
  - **Hidden:** Game title section (display: none)
  - **Room Info Pane** (left side):
    - `RoomInfo` component with room details
    - Game mode indicator with color/emoji
    - Room name, player count, join code
    - `NetworkPlayerIndicator` components for remote players
  - **Player Section** (may be hidden):
    - Shows local active players
    - Add player button (for local players only)

**Key Sub-Components:**

- `GameTitleMenu` - Menu for game options (setup, new game, quit)
- `GameModeIndicator` - Shows 🎯 Solo, ⚔️ Battle, 🏆 Tournament, 👥 Select
- `RoomInfo` - Displays room metadata
- `NetworkPlayerIndicator` - Shows remote players with scores/streaks
- `ActivePlayersList` - List of selected players
- `AddPlayerButton` - Button to add more players with popover
- `FullscreenPlayerSelection` - Large player picker for fullscreen mode
- `PendingInvitations` - Banner for room invitations

**State Management:**

- Lifted from `PageWithNav` to preserve state across remounts:
  - `showPopover` / `setShowPopover` - AddPlayerButton popover state
  - `activeTab` / `setActiveTab` - 'add' or 'invite' tab selection

## 4. Navigation Flow

### Flow 1: Solo Player → Game Selection → Room Creation → Game Start

```
/arcade (Champion Arena)
  ↓ [Select players - updates GameModeContext]
  ↓ [Click game card - GameCard.onClick → router.push]
/arcade/room (if not in room, shows game selector)
  ↓ [Select game - calls setRoomGame mutation]
  ↓ [Room created, gameName saved to roomData]
  ↓ [useRoomData refetch updates roomData.gameName]
/arcade/room (now displays the game)
  ↓ [Game Provider and Component render]
```

### Flow 2: Multiplayer - Room Invitation

```
User A: Creates room via Champion Arena
User B: Receives invitation
User B: Joins room via /arcade/room
User B: Sees same game selection (if set) or game selector (if not set)
```

### Flow 3: Exit Game

```
/arcade/room (in-game)
  ↓ [Click "Quit" or "Exit Session" in GameContextNav]
  ↓ [onExitSession callback → router.push('/arcade')]
/arcade (back to champion arena)
  ↓ Player selection reset by GameModeContext
```

## 5. Game Chooser / Game Selection System

**File:** `/Users/antialias/projects/soroban-abacus-flashcards/apps/web/src/components/GameSelector.tsx` (lines 1-112)

**How It Works:**

1. `GameSelector` component gets all games from both sources:
   - Legacy `GAMES_CONFIG` (currently empty)
   - Registry games via `getAllGames()`

2. For each game, creates `GameCard` component with configuration including `url` field

3. Game Cards rendered in 2-column grid (responsive)

4. When card clicked:
   - `GameCard` checks `activePlayerCount` against game's `maxPlayers`
   - If valid: calls `router.push(config.url)` - client-side navigation via Next.js
   - If invalid: blocks navigation with warning

**Two Game Systems:**

### Registry Games (NEW - Modular)

- Location: `/Users/antialias/projects/soroban-abacus-flashcards/apps/web/src/arcade-games/`
- File: `/Users/antialias/projects/soroban-abacus-flashcards/apps/web/src/lib/arcade/game-registry.ts`
- Examples: `complement-race`, `memory-quiz`, `matching`
- Each game has: `manifest` (metadata), `Provider` (context), `GameComponent` (UI)
- Games registered globally via `registerGame()` function

### Legacy Games (OLD)

- Location: Directly in `/app/arcade/` directory
- Examples: `/app/arcade/complement-race/page.tsx`
- Currently, only complement-race is partially migrated
- Direct URL structure: `/arcade/{gameName}/page.tsx`

**Game Config Structure (for display):**

```javascript
{
  name: string,              // Display name
  fullName?: string,         // Longer name for detailed view
  description: string,       // Short description
  longDescription?: string,  // Detailed description
  icon: emoji,              // Game icon emoji
  gradient: css gradient,   // Background gradient
  borderColor: css color,   // Border color for availability
  maxPlayers: number,       // Player limit for validation
  chips?: string[],         // Feature labels
  color?: 'green'|'purple'|'blue', // Color theme
  difficulty?: string,      // Difficulty level
  available: boolean,       // Is game available
}
```

## 6. Key Components Summary

### PageWithNav - Main Layout Wrapper

**File:** `/Users/antialias/projects/soroban-abacus-flashcards/apps/web/src/components/PageWithNav.tsx` (lines 1-192)

**Responsibilities:**

- Wraps all game/arcade pages
- Manages GameContextNav state (mini-nav)
- Handles player configuration dialog
- Shows moderation notifications
- Renders top navigation bar via `AppNavBar`

**Key Props:**

- `navTitle` - Passed to GameContextNav
- `navEmoji` - Passed to GameContextNav
- `gameName` - Internal game name for API
- `emphasizePlayerSelection` - Highlight player controls
- `onExitSession` - Callback when user exits
- `onSetup`, `onNewGame` - Game-specific callbacks
- `children` - Page content

### AppNavBar - Top Navigation Bar

**File:** `/Users/antialias/projects/soroban-abacus-flashcards/apps/web/src/components/AppNavBar.tsx` (lines 1-625)

**Variants:**

- `full` - Standard navigation (default for non-game pages)
- `minimal` - Game navigation (auto-selected for `/arcade` and `/games`)

**Minimal Nav Features:**

- Hamburger menu (left) with:
  - Site navigation (Home, Create, Guide, Games)
  - Controls (Fullscreen, Exit Arcade)
  - Abacus style dropdown
- Centered game context (navSlot)
- Fullscreen indicator badge

### EnhancedChampionArena - Main Arcade Display

**File:** `/Users/antialias/projects/soroban-abacus-flashcards/apps/web/src/components/EnhancedChampionArena.tsx` (lines 1-40)

**Responsibilities:**

- Container for game selector
- Full-height flex layout
- Passes configuration to `GameSelector`

### GameSelector - Game Grid

**File:** `/Users/antialias/projects/soroban-abacus-flashcards/apps/web/src/components/GameSelector.tsx` (lines 1-112)

**Responsibilities:**

- Fetches all games from registry
- Arranges in responsive grid
- Shows header "🎮 Available Games"
- Renders GameCard for each game

### GameCard - Individual Game Button

**File:** `/Users/antialias/projects/soroban-abacus-flashcards/apps/web/src/components/GameCard.tsx` (lines 1-241)

**Responsibilities:**

- Displays game with icon, name, description
- Shows feature chips and player count indicator
- Validates player count against game requirements
- Handles click to navigate to game
- Two variants: compact and detailed

## 7. State Management

### GameModeContext

**File:** `/Users/antialias/projects/soroban-abacus-flashcards/apps/web/src/contexts/GameModeContext.tsx` (lines 1-325)

**Manages:**

- Local players (Map<string, Player>)
- Active players (Set<string>)
- Game mode (computed from active player count)
- Player CRUD operations (add, update, remove)

**Key Features:**

- Fetches players from user's local DB via `useUserPlayers()`
- Creates 4 default players if none exist
- When in room: merges room members' players (marked as isLocal: false)
- Syncs to room members via `notifyRoomOfPlayerUpdate()`

**Computed Values:**

- `activePlayerCount` - Size of activePlayers set
- `gameMode`:
  - 1 player → 'single'
  - 2 players → 'battle'
  - 3+ players → 'tournament'

### useRoomData Hook

**File:** `/Users/antialias/projects/soroban-abacus-flashcards/apps/web/src/hooks/useRoomData.ts` (lines 1-450+)

**Manages:**

- Current room fetching via TanStack Query
- Socket.io real-time updates
- Room state (members, players, game name)
- Moderation events (kicked, banned, invitations)

**Key Operations:**

- `fetchCurrentRoom()` - GET `/api/arcade/rooms/current`
- `createRoomApi()` - POST `/api/arcade/rooms`
- `joinRoomApi()` - POST `/api/arcade/rooms/{id}/join`
- `leaveRoomApi()` - POST `/api/arcade/rooms/{id}/leave`
- `setRoomGame()` - Updates room's gameName and gameConfig

**Socket Events:**

- `join-user-channel` - Personal notifications
- `join-room` - Subscribe to room updates
- `room-joined` - Refresh when entering room
- `member-joined` - When player joins
- `member-left` - When player leaves
- `room-players-updated` - When players change
- Moderation events (kicked, banned, etc.)

## 8. Routing Summary

**Current URL Structure:**

```
/                          → Home page (Soroban Generator)
/create                    → Create flashcards
/guide                     → Tutorial guide
/games                     → Games library (external game pages)
/arcade                    → Champion Arena (main landing with game selector)
/arcade/room               → Active game display or game selection UI
/arcade/room?game={name}   → Query param for game selection (optional)
/arcade/complement-race    → OLD: Direct complement-race page (legacy)
/arcade/complement-race/practice  → Complement-race practice mode
/arcade/complement-race/sprint    → Complement-race sprint mode
/arcade/complement-race/survival  → Complement-race survival mode
/arcade/memory-quiz        → Memory quiz game page (legacy structure)
```

**Query Parameters:**

- `/arcade/room?game={gameName}` - Optional game selection (parsed by GameCard)

## 9. Key Differences: /arcade vs /arcade/room

| Aspect                | /arcade                     | /arcade/room                                      |
| --------------------- | --------------------------- | ------------------------------------------------- |
| **Purpose**           | Game selection hub          | Active game display or selection within room      |
| **Displays**          | GameSelector with all games | Selected game OR game selector if no game in room |
| **Room Context**      | Optional (can start solo)   | Usually in a room (fetches via useRoomData)       |
| **Navigation**        | Click game → /arcade/room   | Click game → Saves to room → Displays game        |
| **GameContextNav**    | Shows player selector       | Shows room info when joined                       |
| **Player State**      | Local only                  | Local + remote (room members)                     |
| **Exit Button**       | Usually hidden              | Shows "Exit Session" to return to /arcade         |
| **Socket Connection** | Optional                    | Always connected (in room)                        |
| **Page Transition**   | User controls               | Driven by room state updates                      |

## 10. Planning the Merge (/arcade/room → /arcade)

**Challenges to Consider:**

1. **URL Consolidation:**
   - `/arcade/room` would become a sub-path or handled by `/arcade` with state
   - Query param `?game={name}` could drive game selection
   - Current: `/arcade/room?game=complement-race`
   - Could become: `/arcade?game=complement-race&mode=play`

2. **Route Disambiguation:**
   - `/arcade` needs to handle: game selection display, game display, game loading
   - Same page different modes based on state
   - Or: Sub-routes like `/arcade/select`, `/arcade/play`

3. **State Layering:**
   - Local game mode (solo player, GameModeContext)
   - Room state (multiplayer, useRoomData)
   - Both need to coexist

4. **Navigation Preservation:**
   - Currently: `GameCard` → `router.push('/arcade/room?game=X')`
   - After merge: Would need new logic
   - Fullscreen state must persist (uses Next.js router, not reload)

5. **PageWithNav Behavior:**
   - Mini-nav shows game selection UI vs room info
   - Currently determined by `roomInfo` presence
   - After merge: Need same logic but one route

6. **Game Display:**
   - Currently: `/arcade/room` fetches game from registry
   - New: `/arcade` would need same game registry lookup
   - Game Provider/Component rendering must work identically

**Merge Strategy Options:**

### Option A: Single Route with Modes

```
/arcade
├── Mode: browse (default, show GameSelector)
├── Mode: select (game selected, show GameSelector for confirmation)
└── Mode: play (in-game, show game display)
```

### Option B: Sub-routes

```
/arcade
├── /arcade (selector)
├── /arcade/play (game display)
└── /arcade/configure (player config)
```

### Option C: Query-Parameter Driven

```
/arcade
├── /arcade (default - selector)
├── /arcade?game=X (game loading)
└── /arcade?game=X&playing=true (in-game)
```

**Recommendation:** Option C (Query-driven) is closest to current architecture and requires minimal changes to existing logic.
