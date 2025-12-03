# Know Your World - Architecture Overview

This document provides a high-level overview of the Know Your World game architecture.

## System Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              KNOW YOUR WORLD                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         CLIENT (React)                               │   │
│  │                                                                      │   │
│  │  ┌──────────────┐    ┌──────────────────────────────────────────┐   │   │
│  │  │   Provider   │◄───│              Phase Components             │   │   │
│  │  │  (Context)   │    │                                          │   │   │
│  │  │              │    │  ┌──────────┐ ┌──────────┐ ┌──────────┐  │   │   │
│  │  │ • state      │    │  │  Setup   │ │ Playing  │ │ Results  │  │   │   │
│  │  │ • actions    │    │  │  Phase   │ │  Phase   │ │  Phase   │  │   │   │
│  │  │ • cursors    │    │  └──────────┘ └────┬─────┘ └──────────┘  │   │   │
│  │  │ • settings   │    │                    │                      │   │   │
│  │  └──────┬───────┘    │              ┌─────┴─────┐                │   │   │
│  │         │            │              │           │                │   │   │
│  │         │            │         ┌────▼────┐ ┌────▼────────┐       │   │   │
│  │         │            │         │   Map   │ │  GameInfo   │       │   │   │
│  │         │            │         │Renderer │ │   Panel     │       │   │   │
│  │         │            │         │(5496 ln)│ │  (2090 ln)  │       │   │   │
│  │         │            │         └────┬────┘ └─────────────┘       │   │   │
│  │         │            └──────────────┼────────────────────────────┘   │   │
│  │         │                           │                                │   │
│  │         │            ┌──────────────┼──────────────┐                 │   │
│  │         │            │     Custom Hooks Layer      │                 │   │
│  │         │            │                             │                 │   │
│  │         │            │  useRegionDetection         │                 │   │
│  │         │            │  useMagnifierZoom           │                 │   │
│  │         │            │  useHotColdFeedback         │                 │   │
│  │         │            │  usePointerLock             │                 │   │
│  │         │            │  useDeviceCapabilities      │                 │   │
│  │         │            │  useSpeakHint               │                 │   │
│  │         │            │  useRegionHint              │                 │   │
│  │         │            │  useCelebrationSound        │                 │   │
│  │         │            └──────────────┬──────────────┘                 │   │
│  │         │                           │                                │   │
│  │         │            ┌──────────────┼──────────────┐                 │   │
│  │         │            │      Utilities Layer        │                 │   │
│  │         │            │                             │                 │   │
│  │         │            │  adaptiveZoomSearch.ts      │                 │   │
│  │         │            │  screenPixelRatio.ts        │                 │   │
│  │         │            │  speechSynthesis.ts         │                 │   │
│  │         │            │  celebration.ts             │                 │   │
│  │         │            │  guidanceVisibility.ts      │                 │   │
│  │         │            └─────────────────────────────┘                 │   │
│  │         │                                                            │   │
│  └─────────┼────────────────────────────────────────────────────────────┘   │
│            │                                                                │
│            │  WebSocket (useArcadeSession)                                  │
│            ▼                                                                │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         SERVER (Node.js)                             │   │
│  │                                                                      │   │
│  │  ┌──────────────────────────────────────────────────────────────┐   │   │
│  │  │                      Validator.ts                             │   │   │
│  │  │                                                               │   │   │
│  │  │  • validateMove() - Processes all game moves                  │   │   │
│  │  │  • getInitialState() - Creates new game state                 │   │   │
│  │  │  • Server-side only (no client bundle)                        │   │   │
│  │  │                                                               │   │   │
│  │  │  Move Types:                                                  │   │   │
│  │  │  ├── START_GAME      ├── GIVE_UP                              │   │   │
│  │  │  ├── CLICK_REGION    ├── REQUEST_HINT                         │   │   │
│  │  │  ├── NEXT_ROUND      ├── CONFIRM_LETTER                       │   │   │
│  │  │  ├── END_GAME        ├── SET_MAP/MODE/SIZES/LEVEL/CONTINENT   │   │   │
│  │  │  └── RETURN_TO_SETUP                                          │   │   │
│  │  └──────────────────────────────────────────────────────────────┘   │   │
│  │                                                                      │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         DATA LAYER                                   │   │
│  │                                                                      │   │
│  │  maps.ts (3064 lines)                                               │   │
│  │  ├── WORLD_MAP (256 regions from @svg-maps/world)                   │   │
│  │  ├── USA_MAP (51 regions from @svg-maps/usa)                        │   │
│  │  ├── Region filtering by size/continent                             │   │
│  │  └── Bounding box calculations                                      │   │
│  │                                                                      │   │
│  │  continents.ts - Continent metadata and region assignments          │   │
│  │  customCrops.ts - Custom map viewport crops                         │   │
│  │  mapColors.ts - Color utilities for theming                         │   │
│  │                                                                      │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. User Interaction Flow

```
User clicks region on map
        │
        ▼
MapRenderer.handleRegionClick()
        │
        ▼
Provider.clickRegion(regionId, regionName)
        │
        ▼
useArcadeSession.sendMove({ type: 'CLICK_REGION', ... })
        │
        ▼
WebSocket → Server
        │
        ▼
Validator.validateMove()
        │
        ├── Valid: Returns new state with region marked found
        │
        └── Invalid: Returns error (already found, wrong region, etc.)
        │
        ▼
WebSocket → Client
        │
        ▼
Provider.state updated
        │
        ▼
Components re-render with new state
```

### 2. State Synchronization

All game state flows through the server:

- **Client** sends moves (actions/intents)
- **Server** validates and computes new state
- **Server** broadcasts state to all clients in room
- **Clients** render the authoritative state

This ensures:
- Multiplayer consistency
- Cheat prevention
- Single source of truth

### 3. Cursor Sharing (Multiplayer)

```
User moves mouse/touch
        │
        ▼
MapRenderer detects cursor position in SVG coordinates
        │
        ▼
Provider.sendCursorUpdate(playerId, userId, position, hoveredRegionId)
        │
        ▼
WebSocket broadcasts to room (ephemeral, not persisted)
        │
        ▼
Other clients receive cursor update
        │
        ▼
MapRenderer renders remote cursors with player emoji
```

## Key Architectural Decisions

### 1. Phase-Based State Machine

The game uses discrete phases rather than complex nested states:

| Phase | Component | Purpose |
|-------|-----------|---------|
| `setup` | SetupPhase | Configure game settings |
| `playing` | PlayingPhase | Active gameplay |
| `results` | ResultsPhase | Show scores, play again |

**Rationale**: Simplifies component logic - each phase component only handles its concerns.

### 2. Server-Side Validation

All game logic lives in `Validator.ts`, never on the client.

**Rationale**:
- Prevents cheating in multiplayer
- Single source of truth for game rules
- Easier to add new game modes without client updates

### 3. Hooks for Feature Isolation

Complex features are extracted into custom hooks:

| Hook | Responsibility |
|------|----------------|
| `useRegionDetection` | Hit testing cursor against region paths |
| `useMagnifierZoom` | Zoom state and spring animations |
| `useHotColdFeedback` | Distance-based audio feedback |
| `usePointerLock` | Precision cursor control |

**Rationale**: Keeps MapRenderer focused on rendering, moves logic elsewhere.

### 4. Optimistic UI with Server Authority

- Client applies optimistic updates for responsiveness
- Server is authoritative - client reverts if server rejects
- Cursor sharing is ephemeral (not persisted/validated)

### 5. Assistance Levels vs Difficulty

Two orthogonal axes:

- **Difficulty** (`includeSizes`): Which regions to include (huge/large/medium/small/tiny)
- **Assistance** (`assistanceLevel`): What help features are available (hints, hot/cold, learning mode)

**Rationale**: Allows "easy regions with no help" or "hard regions with lots of help"

## Component Responsibilities

### MapRenderer (5,496 lines) - Refactoring In Progress

Currently handles:
- SVG map rendering
- Region detection (bounding boxes + isPointInFill)
- Magnifier overlay with adaptive zoom
- Pointer lock / precision mode
- Cursor dampening
- D3 force simulation for labels
- Hot/cold visualization
- Hint highlighting
- Celebration overlay
- Debug overlays
- Remote cursor rendering

**TODO**: Extract into feature modules (see [PATTERNS.md](./PATTERNS.md))

### GameInfoPanel (2,090 lines) - Needs Refactoring

Currently handles:
- Region prompt display
- Letter confirmation (learning mode)
- Speech synthesis controls
- Hot/cold feedback display
- Hint button and display
- Give-up voting
- Progress tracking
- Auto-hint/auto-speak toggles

**TODO**: Extract UI sections into components

### Provider (655 lines) - Well-Sized

Handles:
- React Context for game state
- Action dispatchers (sendMove wrappers)
- Cursor sharing coordination
- Settings persistence
- Celebration state

### Validator (806 lines) - Well-Sized

Handles:
- Move validation
- State transitions
- Scoring logic
- Turn order enforcement
- Region queue management

## File Organization

```
know-your-world/
├── index.ts                 # Game export (arcade SDK integration)
├── Provider.tsx             # React Context + actions
├── Validator.ts             # Server-side logic
├── types.ts                 # TypeScript interfaces
│
├── components/              # React components
│   ├── GameComponent.tsx    # Root component (phase router)
│   ├── SetupPhase.tsx       # Setup screen
│   ├── PlayingPhase.tsx     # Game screen (thin router)
│   ├── ResultsPhase.tsx     # Results screen
│   ├── MapRenderer.tsx      # Main map (LARGE - needs refactoring)
│   ├── GameInfoPanel.tsx    # Control panel (LARGE - needs refactoring)
│   └── ...                  # Other UI components
│
├── features/                # Feature modules (NEW - refactoring in progress)
│   ├── shared/              # Shared infrastructure
│   │   ├── types.ts         # Common types (CursorPosition, ViewportInfo, etc.)
│   │   ├── constants.ts     # Shared constants (thresholds, margins)
│   │   ├── viewportUtils.ts # SVG coordinate conversion
│   │   ├── MapRendererContext.tsx  # Shared state context
│   │   └── index.ts         # Public exports
│   │
│   ├── precision/           # Precision mode feature
│   │   ├── types.ts         # Precision-specific types
│   │   ├── usePrecisionMode.ts     # Unified precision hook
│   │   ├── PrecisionModeIndicator.tsx  # Scrim, filter utilities
│   │   └── index.ts         # Public exports
│   │
│   ├── labels/              # Label positioning feature
│   │   ├── types.ts         # Label types
│   │   ├── labelUtils.ts    # Label calculations
│   │   ├── useD3ForceLabels.ts     # D3 force simulation
│   │   ├── LabelLayer.tsx   # Label rendering
│   │   └── index.ts         # Public exports
│   │
│   └── magnifier/           # Magnifier feature (partial)
│       ├── types.ts         # Magnifier types
│       ├── MagnifierCrosshair.tsx  # Crosshair component
│       ├── MagnifierPixelGrid.tsx  # Pixel grid component
│       └── index.ts         # Public exports
│
├── hooks/                   # Custom React hooks
│   ├── useRegionDetection.ts
│   ├── useMagnifierZoom.ts
│   ├── useHotColdFeedback.ts
│   ├── usePointerLock.ts
│   ├── useDeviceCapabilities.ts
│   └── ...
│
├── utils/                   # Pure utility functions
│   ├── adaptiveZoomSearch.ts
│   ├── screenPixelRatio.ts
│   ├── speechSynthesis.ts
│   └── ...
│
├── music/                   # Music system (isolated)
│   ├── MusicContext.tsx
│   ├── useMusicEngine.ts
│   └── presets/
│
├── maps.ts                  # Map data (World, USA)
├── continents.ts            # Continent metadata
├── customCrops.ts           # Map viewport customization
├── mapColors.ts             # Color utilities
├── messages.ts              # Hint text content
│
└── docs/                    # Documentation
    ├── ARCHITECTURE.md      # This file
    ├── FEATURES.md          # Feature inventory
    ├── PATTERNS.md          # Code patterns
    ├── REFACTORING_PLAN.md  # Multi-phase extraction plan
    └── implementation/      # Implementation details
```

## External Dependencies

| Package | Purpose |
|---------|---------|
| `@svg-maps/world` | World map SVG paths |
| `@svg-maps/usa` | USA map SVG paths |
| `d3-force` | Label collision avoidance |
| `@react-spring/web` | Smooth animations |
| `@strudel/core` | Music generation |

## Related Documentation

- [FEATURES.md](./FEATURES.md) - Complete feature inventory
- [PATTERNS.md](./PATTERNS.md) - Code patterns and conventions
- [REFACTORING_PLAN.md](./REFACTORING_PLAN.md) - Multi-phase extraction plan
- [MAGNIFIER_ARCHITECTURE.md](./MAGNIFIER_ARCHITECTURE.md) - Zoom system details
- [PRECISION_CONTROLS.md](./PRECISION_CONTROLS.md) - Cursor dampening details
