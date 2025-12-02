# Know Your World - Code Patterns

This document defines the code patterns and conventions for the Know Your World game. Follow these patterns when adding new features or refactoring existing code.

## Table of Contents

1. [Component Size Limits](#component-size-limits)
2. [Feature Module Pattern](#feature-module-pattern)
3. [Hook Patterns](#hook-patterns)
4. [State Management Patterns](#state-management-patterns)
5. [Testing Patterns](#testing-patterns)
6. [File Organization](#file-organization)
7. [Import Order](#import-order)
8. [Naming Conventions](#naming-conventions)

---

## Component Size Limits

### Rules

| Limit | Lines | Action |
|-------|-------|--------|
| **Hard limit** | 500 | Must split |
| **Soft limit** | 300 | Consider extraction |
| **Ideal** | < 200 | Preferred |

### Current Violations

| File | Lines | Status |
|------|-------|--------|
| `MapRenderer.tsx` | 6,285 | Needs refactoring (Phase 3) |
| `GameInfoPanel.tsx` | 2,090 | Needs refactoring (Phase 3) |
| `DrillDownMapSelector.tsx` | 1,717 | Needs refactoring |

### How to Split Large Components

1. **Identify cohesive features** (e.g., magnifier, labels, cursors)
2. **Extract to feature module** (see below)
3. **Keep parent as coordinator** that composes features
4. **Pass minimal props** between components

---

## Feature Module Pattern

### Structure

When a feature is cohesive and has multiple files (component, hook, utils, types), organize as a feature module:

```
features/
└── magnifier/
    ├── index.ts              # Public exports
    ├── MagnifierOverlay.tsx  # Main component
    ├── useMagnifierZoom.ts   # State hook
    ├── adaptiveZoomSearch.ts # Algorithm
    ├── types.ts              # Types (if feature-specific)
    └── __tests__/
        ├── MagnifierOverlay.test.tsx
        ├── useMagnifierZoom.test.ts
        └── adaptiveZoomSearch.test.ts
```

### Export Pattern

```typescript
// features/magnifier/index.ts
export { MagnifierOverlay } from './MagnifierOverlay'
export { useMagnifierZoom } from './useMagnifierZoom'
export type { MagnifierConfig, ZoomState } from './types'
```

### Usage

```typescript
// In parent component
import { MagnifierOverlay, useMagnifierZoom } from './features/magnifier'

function MapRenderer() {
  const magnifier = useMagnifierZoom(config)

  return (
    <div>
      <svg>...</svg>
      <MagnifierOverlay {...magnifier} />
    </div>
  )
}
```

### Candidate Features for Extraction

| Feature | Current Location | Priority |
|---------|------------------|----------|
| Magnifier | MapRenderer.tsx | High |
| Labels | MapRenderer.tsx | High |
| Precision Controls | MapRenderer.tsx | Medium |
| Hot/Cold | hooks/ + MapRenderer | Medium |
| Celebration | components/ + utils/ | Low |
| Letter Confirmation | GameInfoPanel.tsx | Medium |
| Speech Controls | GameInfoPanel.tsx | Low |

---

## Hook Patterns

### Custom Hook Structure

```typescript
// hooks/useFeatureName.ts

interface UseFeatureNameParams {
  // Required configuration
  requiredParam: string
  // Optional with defaults
  optionalParam?: number
}

interface UseFeatureNameReturn {
  // State
  currentValue: string
  isActive: boolean
  // Actions
  doSomething: () => void
  reset: () => void
}

export function useFeatureName({
  requiredParam,
  optionalParam = 100,
}: UseFeatureNameParams): UseFeatureNameReturn {
  // State
  const [currentValue, setCurrentValue] = useState('')

  // Refs for non-reactive values
  const timerRef = useRef<number | null>(null)

  // Callbacks (stable references)
  const doSomething = useCallback(() => {
    // Implementation
  }, [requiredParam])

  const reset = useCallback(() => {
    setCurrentValue('')
  }, [])

  // Effects
  useEffect(() => {
    // Setup/cleanup
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return {
    currentValue,
    isActive: currentValue !== '',
    doSomething,
    reset,
  }
}
```

### Hook Composition Pattern

When a component needs many hooks, create a composition hook:

```typescript
// hooks/useMapInteraction.ts

interface UseMapInteractionParams {
  regions: Region[]
  targetRegion: string | null
  assistanceLevel: AssistanceLevel
  // ... other config
}

export function useMapInteraction(params: UseMapInteractionParams) {
  // Compose multiple hooks
  const detection = useRegionDetection(params.regions)
  const magnifier = useMagnifierZoom({ regions: params.regions })
  const hotCold = useHotColdFeedback({
    targetRegionId: params.targetRegion,
    enabled: params.assistanceLevel !== 'none',
    // ...
  })
  const pointer = usePointerLock()

  // Combine into unified interface
  return {
    // Detection
    hoveredRegion: detection.hoveredRegion,
    detectRegion: detection.detectRegion,

    // Magnifier
    magnifierState: magnifier.state,
    showMagnifier: magnifier.shouldShow,

    // Hot/cold
    hotColdFeedback: hotCold.lastFeedbackType,
    checkHotCold: hotCold.checkPosition,

    // Precision
    isPointerLocked: pointer.isLocked,
    requestPointerLock: pointer.request,
  }
}
```

### Hook Dependencies

- Hooks should only depend on other hooks, never on components
- Hooks should not import from `Provider.tsx` (use parameters instead)
- Hooks can depend on utility functions

---

## State Management Patterns

### Context Pattern

```typescript
// Provider.tsx

interface ContextValue {
  // Server-synced state (read-only to components)
  state: GameState

  // Actions (mutate via server)
  doAction: (params: ActionParams) => void

  // Local UI state (not synced)
  localState: LocalState
  setLocalState: (state: LocalState) => void
}

const Context = createContext<ContextValue | null>(null)

export function useGameContext() {
  const context = useContext(Context)
  if (!context) {
    throw new Error('Must be used within Provider')
  }
  return context
}
```

### Server State vs Local State

| State Type | Where | Persistence | Multiplayer Sync |
|------------|-------|-------------|------------------|
| Game state | `state.*` | Server DB | Yes |
| UI preferences | `controlsState` | localStorage | No |
| Ephemeral UI | `useState` | None | No |
| Cursors | `otherPlayerCursors` | None | Yes (ephemeral) |

### Action Pattern

```typescript
// All game mutations go through moves
const clickRegion = useCallback((regionId: string, regionName: string) => {
  sendMove({
    type: 'CLICK_REGION',
    playerId: state.currentPlayer,
    userId: viewerId,
    data: { regionId, regionName },
  })
}, [sendMove, state.currentPlayer, viewerId])
```

---

## Testing Patterns

### Co-located Tests

Tests live next to the code they test:

```
features/magnifier/
├── useMagnifierZoom.ts
├── adaptiveZoomSearch.ts
└── __tests__/
    ├── useMagnifierZoom.test.ts
    └── adaptiveZoomSearch.test.ts
```

### Unit Test Pattern

```typescript
// __tests__/adaptiveZoomSearch.test.ts
import { describe, it, expect } from 'vitest'
import { findOptimalZoom } from '../adaptiveZoomSearch'

describe('findOptimalZoom', () => {
  it('returns minimum zoom when no small regions', () => {
    const result = findOptimalZoom({
      regions: [{ width: 100, height: 100 }],
      minZoom: 8,
    })
    expect(result).toBe(8)
  })

  it('increases zoom for tiny regions', () => {
    const result = findOptimalZoom({
      regions: [{ width: 1, height: 1 }],
      minZoom: 8,
    })
    expect(result).toBeGreaterThan(20)
  })
})
```

### Hook Test Pattern

```typescript
// __tests__/useMagnifierZoom.test.ts
import { renderHook, act } from '@testing-library/react'
import { useMagnifierZoom } from '../useMagnifierZoom'

describe('useMagnifierZoom', () => {
  it('starts with default zoom', () => {
    const { result } = renderHook(() => useMagnifierZoom({ minZoom: 8 }))
    expect(result.current.zoom).toBe(8)
  })

  it('updates zoom when regions change', () => {
    const { result, rerender } = renderHook(
      ({ regions }) => useMagnifierZoom({ regions, minZoom: 8 }),
      { initialProps: { regions: [] } }
    )

    act(() => {
      rerender({ regions: [{ width: 1, height: 1 }] })
    })

    expect(result.current.zoom).toBeGreaterThan(8)
  })
})
```

### Component Test Pattern

```typescript
// __tests__/MagnifierOverlay.test.tsx
import { render, screen } from '@testing-library/react'
import { MagnifierOverlay } from '../MagnifierOverlay'

describe('MagnifierOverlay', () => {
  it('renders when visible', () => {
    render(<MagnifierOverlay visible={true} zoom={10} position={{ x: 100, y: 100 }} />)
    expect(screen.getByTestId('magnifier-overlay')).toBeInTheDocument()
  })

  it('does not render when not visible', () => {
    render(<MagnifierOverlay visible={false} zoom={10} position={{ x: 100, y: 100 }} />)
    expect(screen.queryByTestId('magnifier-overlay')).not.toBeInTheDocument()
  })
})
```

---

## File Organization

### Directory Structure

```
know-your-world/
├── index.ts                    # Game export
├── Provider.tsx                # Context provider
├── Validator.ts                # Server logic
├── types.ts                    # Shared types
│
├── components/                 # React components
│   ├── GameComponent.tsx       # Root (phase router)
│   ├── SetupPhase.tsx
│   ├── PlayingPhase.tsx
│   ├── ResultsPhase.tsx
│   ├── MapRenderer.tsx         # (to be split into features/)
│   ├── GameInfoPanel.tsx       # (to be split into features/)
│   └── __tests__/
│
├── hooks/                      # Shared hooks (not feature-specific)
│   ├── useDeviceCapabilities.ts
│   └── __tests__/
│
├── features/                   # Feature modules (NEW)
│   ├── magnifier/
│   ├── labels/
│   ├── precision-controls/
│   ├── hot-cold/
│   └── celebration/
│
├── utils/                      # Pure utility functions
│   ├── screenPixelRatio.ts
│   └── __tests__/
│
├── music/                      # Music system (isolated feature)
│   ├── MusicContext.tsx
│   └── presets/
│
├── data/                       # Static data (NEW - extract from maps.ts)
│   ├── world.ts
│   ├── usa.ts
│   └── continents.ts
│
└── docs/                       # Documentation
    ├── ARCHITECTURE.md
    ├── FEATURES.md
    ├── PATTERNS.md
    └── implementation/
```

---

## Import Order

Follow this order in all files:

```typescript
// 1. React/Next.js
import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

// 2. External packages
import { useSpring, animated } from '@react-spring/web'
import * as d3 from 'd3-force'

// 3. Internal SDK/lib imports
import { useArcadeSession } from '@/lib/arcade/game-sdk'

// 4. Context/Provider imports
import { useKnowYourWorld } from '../Provider'

// 5. Feature imports
import { MagnifierOverlay } from '../features/magnifier'

// 6. Hook imports
import { useDeviceCapabilities } from '../hooks/useDeviceCapabilities'

// 7. Utility imports
import { calculateZoom } from '../utils/screenPixelRatio'

// 8. Component imports (siblings/children)
import { CelebrationOverlay } from './CelebrationOverlay'

// 9. Type imports (always last, with `type` keyword)
import type { Region, GameState } from '../types'
```

---

## Naming Conventions

### Files

| Type | Convention | Example |
|------|------------|---------|
| Component | PascalCase | `MapRenderer.tsx` |
| Hook | camelCase with `use` prefix | `useMagnifierZoom.ts` |
| Utility | camelCase | `screenPixelRatio.ts` |
| Types | camelCase or PascalCase | `types.ts` |
| Test | Same name + `.test` | `useMagnifierZoom.test.ts` |
| Stories | Same name + `.stories` | `MapRenderer.stories.tsx` |

### Functions

| Type | Convention | Example |
|------|------------|---------|
| Component | PascalCase | `function MapRenderer()` |
| Hook | camelCase with `use` | `function useMagnifierZoom()` |
| Event handler | `handle` + Event | `handleRegionClick` |
| Callback prop | `on` + Action | `onRegionClick` |
| Boolean getter | `is`/`has`/`should` | `isVisible`, `hasHint` |
| Utility | camelCase | `calculateOptimalZoom` |

### Types

| Type | Convention | Example |
|------|------------|---------|
| Interface | PascalCase | `interface RegionData {}` |
| Type alias | PascalCase | `type AssistanceLevel = ...` |
| Props | ComponentName + `Props` | `interface MapRendererProps {}` |
| State | Descriptive | `interface MagnifierState {}` |
| Return type | Hook + `Return` | `interface UseMagnifierReturn {}` |

### Constants

```typescript
// SCREAMING_SNAKE_CASE for true constants
const MAX_ZOOM = 60
const DEFAULT_COOLDOWN_MS = 1200

// Regular camelCase for configuration objects
const defaultConfig = {
  minZoom: 8,
  maxZoom: 60,
}
```

---

## Debug Pattern

### Debug Overlays

Extract debug UI into separate components:

```typescript
// features/magnifier/MagnifierDebug.tsx
export function MagnifierDebug({ state }: { state: MagnifierState }) {
  return (
    <div data-element="magnifier-debug-panel" style={debugPanelStyle}>
      <div>Zoom: {state.zoom.toFixed(1)}x</div>
      <div>Visible: {state.isVisible ? 'Yes' : 'No'}</div>
      {/* ... */}
    </div>
  )
}

// Usage in parent (only when debug enabled)
{isVisualDebugEnabled && <MagnifierDebug state={magnifier} />}
```

### Data Attributes

All significant elements should have data attributes:

```typescript
<div
  data-component="magnifier-overlay"
  data-element="zoom-indicator"
  data-status={isActive ? 'active' : 'inactive'}
>
```

---

## Migration Strategy

When refactoring existing code to follow these patterns:

1. **Don't break functionality** - All changes must preserve behavior
2. **One feature at a time** - Extract one module, verify, then continue
3. **Add tests first** - Write tests for current behavior before refactoring
4. **Update imports gradually** - Keep old exports working during migration
5. **Document changes** - Update this file as patterns evolve

### Refactoring Checklist

- [ ] Write tests for existing behavior
- [ ] Create feature module structure
- [ ] Move code to new location
- [ ] Update imports in parent
- [ ] Verify all tests pass
- [ ] Remove old code
- [ ] Update documentation
