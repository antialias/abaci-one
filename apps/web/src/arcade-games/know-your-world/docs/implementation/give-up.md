# Give Up Feature - Implementation Plan

## Overview

Add a "Give Up" button that allows users to skip a region they can't identify. When clicked:

1. **Flash the region** on the map (3 pulses over ~2 seconds)
2. **Temporarily label** the region with its name
3. **Show magnifier** if the region is small enough to need it
4. **Flash + label in magnifier** as well
5. **Move to next region** after animation completes

## Requirements Analysis

### User Experience

- User clicks "Give Up" in the GameInfoPanel
- Region flashes with a bright/pulsing color (yellow/gold to indicate "reveal")
- Region name appears as a label pointing to the region
- If region is tiny (needs magnifier), magnifier appears centered on that region with same flash/label
- After ~2 seconds, animation ends and game advances to next region
- Player receives no points for given-up regions

### Edge Cases

- Last region: give up ends the game (go to results)
- Turn-based mode: rotate to next player after give up
- Multiplayer: all players see the reveal animation

---

## Implementation Steps

### Step 1: Add Types (`types.ts`)

Add to `KnowYourWorldState`:

```typescript
// Give up reveal state
giveUpReveal: {
  regionId: string
  regionName: string
  needsMagnifier: boolean
  timestamp: number  // For animation timing key
} | null
```

Add new move type:

```typescript
| {
    type: 'GIVE_UP'
    playerId: string
    userId: string
    timestamp: number
    data: {}
  }
```

### Step 2: Server-Side Logic (`Validator.ts`)

Add `validateGiveUp` method:

```typescript
private async validateGiveUp(state: KnowYourWorldState, playerId: string): Promise<ValidationResult> {
  if (state.gamePhase !== 'playing') {
    return { valid: false, error: 'Can only give up during playing phase' }
  }

  if (!state.currentPrompt) {
    return { valid: false, error: 'No region to give up on' }
  }

  // For turn-based: check if it's this player's turn
  if (state.gameMode === 'turn-based' && state.currentPlayer !== playerId) {
    return { valid: false, error: 'Not your turn' }
  }

  // Get region info for the reveal
  const mapData = await getFilteredMapDataLazy(state.selectedMap, state.selectedContinent, state.difficulty)
  const region = mapData.regions.find(r => r.id === state.currentPrompt)

  if (!region) {
    return { valid: false, error: 'Region not found' }
  }

  // TODO: Determine if region needs magnifier (use region size threshold)
  // For now, set needsMagnifier based on whether region is in known small regions list
  // Or we can calculate it client-side since client has the rendered SVG

  const newState: KnowYourWorldState = {
    ...state,
    giveUpReveal: {
      regionId: state.currentPrompt,
      regionName: region.name,
      needsMagnifier: false, // Client will determine this from rendered size
      timestamp: Date.now(),
    },
    // Don't advance yet - wait for ADVANCE_AFTER_GIVE_UP move from client after animation
  }

  return { valid: true, newState }
}
```

Add `validateAdvanceAfterGiveUp` method (called after animation completes):

```typescript
private validateAdvanceAfterGiveUp(state: KnowYourWorldState): ValidationResult {
  if (!state.giveUpReveal) {
    return { valid: false, error: 'No active give up reveal' }
  }

  // Check if all regions are done
  if (state.regionsToFind.length === 0) {
    // Game complete
    return {
      valid: true,
      newState: {
        ...state,
        gamePhase: 'results',
        currentPrompt: null,
        giveUpReveal: null,
        endTime: Date.now(),
      }
    }
  }

  // Move to next region
  const nextPrompt = state.regionsToFind[0]
  const remainingRegions = state.regionsToFind.slice(1)

  // For turn-based, rotate player
  let nextPlayer = state.currentPlayer
  if (state.gameMode === 'turn-based') {
    const currentIndex = state.activePlayers.indexOf(state.currentPlayer)
    const nextIndex = (currentIndex + 1) % state.activePlayers.length
    nextPlayer = state.activePlayers[nextIndex]
  }

  return {
    valid: true,
    newState: {
      ...state,
      currentPrompt: nextPrompt,
      regionsToFind: remainingRegions,
      currentPlayer: nextPlayer,
      giveUpReveal: null,
    }
  }
}
```

**Alternative Design**: Single `GIVE_UP` move that immediately advances, with animation purely client-side:

- Simpler server logic
- Animation is fire-and-forget
- Risk: if user navigates away during animation, they've already lost the region

**Recommended**: Use single move for simplicity. Client shows animation, but state advances immediately.

### Step 3: Client Provider (`Provider.tsx`)

Add `giveUp` action:

```typescript
const giveUp = useCallback(() => {
  sendMove({
    type: "GIVE_UP",
    playerId: state.currentPlayer || activePlayers[0] || "",
    userId: viewerId || "",
    data: {},
  });
}, [viewerId, sendMove, state.currentPlayer, activePlayers]);
```

Add to context value.

### Step 4: UI Button (`GameInfoPanel.tsx`)

Add "Give Up" button below the current prompt:

```tsx
<button
  onClick={giveUp}
  disabled={!!state.giveUpReveal} // Disable during reveal animation
  data-action="give-up"
  className={css({
    padding: "1 2",
    fontSize: "2xs",
    cursor: "pointer",
    bg: isDark ? "yellow.800" : "yellow.100",
    color: isDark ? "yellow.200" : "yellow.800",
    rounded: "sm",
    border: "1px solid",
    borderColor: isDark ? "yellow.600" : "yellow.400",
    fontWeight: "bold",
    transition: "all 0.2s",
    _hover: {
      bg: isDark ? "yellow.700" : "yellow.200",
    },
    _disabled: {
      opacity: 0.5,
      cursor: "not-allowed",
    },
  })}
>
  Give Up
</button>
```

### Step 5: Reveal Animation (`MapRenderer.tsx`)

This is the most complex part. Need to:

#### 5a. Accept `giveUpReveal` prop from PlayingPhase

```typescript
interface MapRendererProps {
  // ... existing props
  giveUpReveal: KnowYourWorldState["giveUpReveal"];
  onGiveUpAnimationComplete: () => void;
}
```

#### 5b. Add animation state and effect

```typescript
const [giveUpFlashProgress, setGiveUpFlashProgress] = useState(0); // 0-1 pulsing

useEffect(() => {
  if (!giveUpReveal) {
    setGiveUpFlashProgress(0);
    return;
  }

  const duration = 2000; // 2 seconds
  const pulses = 3; // Number of full pulses
  const startTime = Date.now();

  const animate = () => {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Create pulsing effect: sin wave for smooth on/off
    const pulseProgress = Math.sin(progress * Math.PI * pulses * 2) * 0.5 + 0.5;
    setGiveUpFlashProgress(pulseProgress);

    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      // Animation complete
      setGiveUpFlashProgress(0);
      onGiveUpAnimationComplete();
    }
  };

  requestAnimationFrame(animate);
}, [giveUpReveal?.timestamp]); // Re-run when timestamp changes
```

#### 5c. Flash the region path

In the region rendering, check if this region is being revealed:

```typescript
const isBeingRevealed = giveUpReveal?.regionId === region.id

const fill = isBeingRevealed
  ? `rgba(255, 215, 0, ${0.3 + giveUpFlashProgress * 0.7})` // Gold flash
  : /* existing fill logic */
```

#### 5d. Show temporary label

When `giveUpReveal` is active:

- Render a label element pointing to the region
- Use existing label positioning infrastructure or create a dedicated one
- Label should be prominent (larger font, contrasting background)

```tsx
{
  giveUpReveal && (
    <RevealLabel
      regionId={giveUpReveal.regionId}
      regionName={giveUpReveal.regionName}
      flashProgress={giveUpFlashProgress}
      svgRef={svgRef}
      isDark={isDark}
    />
  );
}
```

#### 5e. Force magnifier display for small regions

When `giveUpReveal` is active and region needs magnification:

```typescript
// Override magnifier visibility during give up
const shouldShowMagnifier = giveUpReveal
  ? giveUpRevealNeedsMagnifier
  : targetNeedsMagnification && hasSmallRegion;
```

Need to calculate whether the give-up region needs magnification:

```typescript
const [giveUpRevealNeedsMagnifier, setGiveUpRevealNeedsMagnifier] =
  useState(false);

useEffect(() => {
  if (!giveUpReveal || !svgRef.current) {
    setGiveUpRevealNeedsMagnifier(false);
    return;
  }

  const path = svgRef.current.querySelector(
    `path[data-region-id="${giveUpReveal.regionId}"]`,
  );
  if (!path || !(path instanceof SVGGeometryElement)) {
    setGiveUpRevealNeedsMagnifier(false);
    return;
  }

  const bbox = path.getBoundingClientRect();
  const isSmall =
    bbox.width < 15 || bbox.height < 15 || bbox.width * bbox.height < 200;
  setGiveUpRevealNeedsMagnifier(isSmall);
}, [giveUpReveal?.regionId]);
```

#### 5f. Center magnifier on revealed region

When in give-up reveal mode with magnifier:

- Calculate the region's center in screen coordinates
- Position magnifier viewport to center on that region
- Don't track cursor movement during reveal

```typescript
// Calculate center of reveal region for magnifier positioning
const [revealCenterPosition, setRevealCenterPosition] = useState<{
  x: number;
  y: number;
} | null>(null);

useEffect(() => {
  if (
    !giveUpReveal ||
    !giveUpRevealNeedsMagnifier ||
    !svgRef.current ||
    !containerRef.current
  ) {
    setRevealCenterPosition(null);
    return;
  }

  const path = svgRef.current.querySelector(
    `path[data-region-id="${giveUpReveal.regionId}"]`,
  );
  if (!path) return;

  const pathBbox = path.getBoundingClientRect();
  const containerRect = containerRef.current.getBoundingClientRect();

  // Center of region in container coordinates
  const centerX = pathBbox.left + pathBbox.width / 2 - containerRect.left;
  const centerY = pathBbox.top + pathBbox.height / 2 - containerRect.top;

  setRevealCenterPosition({ x: centerX, y: centerY });
}, [giveUpReveal?.regionId, giveUpRevealNeedsMagnifier]);
```

Then use `revealCenterPosition` instead of `cursorPosition` for magnifier view calculations during reveal.

### Step 6: Update PlayingPhase

Pass new props to MapRenderer:

```tsx
<MapRenderer
  // ... existing props
  giveUpReveal={state.giveUpReveal}
  onGiveUpAnimationComplete={() => {
    // Send move to advance after animation
    sendMove({
      type: "ADVANCE_AFTER_GIVE_UP",
      // ...
    });
  }}
/>
```

Or if using single-move design, just let the animation complete without callback.

### Step 7: Storybook Update

Add story for reveal animation state.

---

## Design Decisions

### Single vs Two-Move Design

**Option A: Single GIVE_UP move (recommended)**

- Server immediately advances game state
- Client plays animation while already on "next region" conceptually
- Simpler, no race conditions
- Animation is purely cosmetic

**Option B: Two moves (GIVE_UP then ADVANCE)**

- More accurate state representation
- But adds complexity and timing concerns
- What if client disconnects during animation?

**Decision: Use Option A** - Single move, animation is fire-and-forget.

### Animation Duration

- 2 seconds total
- 3 pulses (on-off-on-off-on-off)
- Gold/yellow color for "reveal" semantics
- Smooth sine wave interpolation

### Label Styling

- Large, bold text
- High contrast background (dark bg in light mode, light bg in dark mode)
- Leader line pointing to region center
- Positioned to avoid overlap with region itself

---

## Files to Modify

1. `types.ts` - Add `giveUpReveal` to state, add `GIVE_UP` move type
2. `Validator.ts` - Add `validateGiveUp` case in switch, implement logic
3. `Provider.tsx` - Add `giveUp` action, expose in context
4. `GameInfoPanel.tsx` - Add "Give Up" button
5. `MapRenderer.tsx` - Add reveal animation, label, magnifier override
6. `PlayingPhase.tsx` - Pass `giveUpReveal` prop
7. `MapRenderer.stories.tsx` - Add story for reveal state

---

## Testing Checklist

- [ ] Give up on normal-sized region (no magnifier)
- [ ] Give up on tiny region (magnifier appears)
- [ ] Give up on last region (game ends)
- [ ] Turn-based mode: give up rotates player
- [ ] Multiplayer: all clients see animation
- [ ] Rapid give-ups don't break animation
- [ ] Button disabled during animation
- [ ] Label positioned correctly
- [ ] Flash color visible in both light/dark themes
