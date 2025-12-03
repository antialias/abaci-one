# Interaction State Machine Design

## Current Problem: Implicit States via Boolean Combinations

MapRenderer currently tracks interaction state via 9+ independent booleans:

```typescript
showMagnifier / magnifierState.isVisible  // magnifier visible
isMagnifierDragging                        // touch dragging inside magnifier
isPinching                                 // pinch gesture on magnifier
isMagnifierExpanded                        // magnifier fills leftover area
isMobileMapDragging                        // touch dragging on main map
mobileMapDragTriggeredMagnifier            // magnifier was shown via mobile drag
isDesktopMapDragging                       // mouse dragging on main map
pointerLocked                              // pointer lock active (precision mode)
isReleasingPointerLock                     // animating out of pointer lock
```

This creates 2^9 = 512 theoretical combinations, but only ~12 are valid. The code checks validity via compound conditionals scattered throughout handlers.

## Proposed State Machine

### States

```
IDLE
├── No interaction active
├── Cursor not visible (desktop) or no touch (mobile)
└── Entry: Reset all interaction state

HOVERING (desktop only)
├── Mouse over map
├── Cursor visible, magnifier hidden
└── Entry: Show cursor overlay

MAGNIFIER_VISIBLE
├── Magnifier shown, normal interaction
├── Can transition to precision mode (desktop) or panning (mobile)
└── Entry: Show magnifier with fade-in

MAGNIFIER_PANNING (mobile only)
├── Single-finger drag inside magnifier
├── Updates cursor position within magnifier
└── Entry: Pause zoom animations

MAGNIFIER_PINCHING (mobile only)
├── Two-finger pinch on magnifier
├── Adjusts zoom level
└── Entry: Record pinch start distance and zoom

MAGNIFIER_EXPANDED (mobile only)
├── Magnifier fills available space
├── Higher zoom capability
└── Entry: Animate to expanded size

MAP_PANNING_MOBILE
├── Touch drag on main map (not magnifier)
├── Magnifier follows finger, shows selection UI
└── Entry: Show magnifier, track touch position

MAP_PANNING_DESKTOP
├── Middle mouse button drag on map
├── For accessibility/alternative navigation
└── Entry: Change cursor to grab

PRECISION_MODE (desktop only)
├── Pointer locked for fine movement
├── Dampened cursor movement, escape animations
└── Entry: Request pointer lock, show precision UI

RELEASING_PRECISION (desktop only)
├── Animating cursor back after precision mode exit
├── Brief transition state
└── Exit: Release pointer lock, restore normal cursor
```

### State Transitions

```
                    ┌──────────────────────────────────────────────┐
                    │                    IDLE                       │
                    └────────────┬─────────────────────────────────┘
                                 │
            ┌────────────────────┼────────────────────┐
            │ mouse enter        │ touch start        │
            ▼                    │                    ▼
    ┌───────────────┐            │           ┌────────────────────┐
    │   HOVERING    │            │           │  MAP_PANNING_MOBILE│
    │   (desktop)   │            │           │  (if drag detected)│
    └───────┬───────┘            │           └──────────┬─────────┘
            │                    │                      │
            │ small region       │                      │ touch end
            │ detected           │                      │ (keep magnifier)
            ▼                    │                      ▼
    ┌───────────────┐            │           ┌────────────────────┐
    │  MAGNIFIER    │◄───────────┘           │   MAGNIFIER        │
    │   VISIBLE     │                        │   VISIBLE          │
    └───────┬───────┘                        └──────────┬─────────┘
            │                                           │
    ┌───────┼───────────────────────────────────────────┤
    │       │                                           │
    │       │ click precision    touch magnifier        │ pinch start
    │       │ button             (1 finger)             │
    │       ▼                    ▼                      ▼
    │ ┌───────────────┐  ┌────────────────┐  ┌────────────────────┐
    │ │  PRECISION    │  │   MAGNIFIER    │  │    MAGNIFIER       │
    │ │    MODE       │  │   PANNING      │  │    PINCHING        │
    │ └───────┬───────┘  └────────────────┘  └────────────────────┘
    │         │                                         │
    │         │ escape boundary                         │ zoom past
    │         ▼                                         │ threshold
    │ ┌───────────────┐                                 ▼
    │ │  RELEASING    │                        ┌────────────────────┐
    │ │  PRECISION    │                        │    MAGNIFIER       │
    │ └───────┬───────┘                        │    EXPANDED        │
    │         │                                └────────────────────┘
    │         │ animation done
    └─────────┴──────────────────────────────────────────┐
                                                         │
                              tap outside / dismiss      │
                              ▼                          │
                    ┌────────────────────────────────────┘
                    │                    IDLE
                    └──────────────────────────────────────
```

### Context (Shared Data)

```typescript
interface InteractionContext {
  // Cursor position (container coordinates)
  cursorPosition: { x: number; y: number } | null

  // Zoom state
  currentZoom: number
  targetZoom: number

  // Magnifier position (for animations)
  magnifierTop: number
  magnifierLeft: number

  // Touch tracking
  touchStart: { x: number; y: number } | null
  pinchStartDistance: number | null
  pinchStartZoom: number | null

  // Precision mode tracking
  initialCapturePosition: { x: number; y: number } | null
  movementMultiplier: number

  // Cursor visual state
  cursorSquish: { x: number; y: number }

  // Mobile-specific
  dragTriggeredMagnifier: boolean  // For showing Select button
}
```

### Events

```typescript
type InteractionEvent =
  // Mouse events (desktop)
  | { type: 'MOUSE_ENTER' }
  | { type: 'MOUSE_LEAVE' }
  | { type: 'MOUSE_MOVE'; position: { x: number; y: number }; movement: { dx: number; dy: number } }
  | { type: 'MOUSE_DOWN'; button: 'left' | 'middle' | 'right' }
  | { type: 'MOUSE_UP' }
  | { type: 'CLICK'; position: { x: number; y: number } }

  // Touch events (mobile)
  | { type: 'TOUCH_START'; touches: TouchPoint[]; target: 'map' | 'magnifier' }
  | { type: 'TOUCH_MOVE'; touches: TouchPoint[]; target: 'map' | 'magnifier' }
  | { type: 'TOUCH_END'; target: 'map' | 'magnifier' }

  // Precision mode
  | { type: 'REQUEST_PRECISION' }
  | { type: 'EXIT_PRECISION' }
  | { type: 'PRECISION_ESCAPE_BOUNDARY' }
  | { type: 'RELEASE_ANIMATION_DONE' }

  // Magnifier
  | { type: 'SHOW_MAGNIFIER' }
  | { type: 'DISMISS_MAGNIFIER' }
  | { type: 'EXPAND_MAGNIFIER' }
  | { type: 'COLLAPSE_MAGNIFIER' }

  // Region
  | { type: 'REGION_SELECTED'; regionId: string }
  | { type: 'SMALL_REGION_DETECTED'; size: number }
  | { type: 'ZOOM_THRESHOLD_REACHED' }
```

## Implementation Plan

### Phase 1: Create State Machine Hook
1. Define types (State, Event, Context)
2. Implement `useInteractionStateMachine` hook using `useReducer`
3. Export state and dispatch function

### Phase 2: Wire Up Event Dispatching
1. Replace direct state mutations in handlers with event dispatches
2. Mouse handlers dispatch MOUSE_* events
3. Touch handlers dispatch TOUCH_* events

### Phase 3: Derive UI State from Machine State
1. Replace boolean checks with state comparisons
2. `showMagnifier` → `state.matches('MAGNIFIER_*')`
3. `pointerLocked` → `state === 'PRECISION_MODE'`

### Phase 4: Extract Handler Logic
1. Move event handling logic into state machine actions
2. Handlers become thin event dispatchers
3. Coordinate calculations move to machine actions

## Benefits

1. **Explicit Valid States**: Only ~12 states instead of 512 boolean combinations
2. **Centralized Transitions**: All state changes in one place
3. **Easier Testing**: Test state transitions independently
4. **Self-Documenting**: State names describe what's happening
5. **Impossible States Impossible**: Can't be `isPinching && isMagnifierDragging`
