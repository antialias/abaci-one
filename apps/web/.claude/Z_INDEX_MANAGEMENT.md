# Z-Index & Stacking Context Management

## Overview

This document tracks z-index values and stacking contexts across the application to prevent layering conflicts and make reasoning about visual hierarchy easy.

## The Z-Index Constants System

**Location:** `src/constants/zIndex.ts`

All z-index values should be defined in this file and imported where needed:

```typescript
import { Z_INDEX } from "../constants/zIndex";

// Use it like this:
zIndex: Z_INDEX.NAV_BAR;
zIndex: Z_INDEX.MODAL;
zIndex: Z_INDEX.GAME_NAV.HAMBURGER_MENU;
```

## Z-Index Layering Hierarchy

From lowest to highest:

| Layer                      | Range       | Purpose                                          | Examples                                                          |
| -------------------------- | ----------- | ------------------------------------------------ | ----------------------------------------------------------------- |
| **Base Content**           | 0-99        | Default page content, game elements              | Background elements, game tracks, cards                           |
| **Navigation & UI Chrome** | 100-999     | Fixed navigation, sticky headers                 | AppNavBar, page headers                                           |
| **Overlays & Dropdowns**   | 1000-9999   | Tooltips, popovers, dropdowns, tutorial tooltips | Tutorial tooltips (50-100), ConfigForm (50), dropdowns (999-1000) |
| **Modals & Dialogs**       | 10000-19999 | Modal dialogs, confirmation dialogs              | Modal backdrop (10000), Modal content (10001)                     |
| **Top-Level Overlays**     | 20000+      | Toasts, critical notifications                   | Toast notifications (20000)                                       |

## Stacking Context Rules

### What Creates a Stacking Context?

These CSS properties create new stacking contexts (z-index values are relative within them):

1. `position: fixed` or `position: sticky` with z-index
2. `position: absolute` or `position: relative` with z-index
3. `opacity` < 1
4. `transform` (any value)
5. `filter` (any value except none)
6. `isolation: isolate`

### Key Insight

**Z-index values are only compared within the same stacking context!**

If Element A creates a stacking context with `z-index: 1` and Element B is outside that context with `z-index: 999`, Element B will be on top regardless of child z-indexes inside Element A.

### Example

```tsx
// Parent creates stacking context
<div style={{ position: 'relative', zIndex: 1 }}>
  {/* This child's z-index is relative to parent, not global! */}
  <div style={{ position: 'absolute', zIndex: 999999 }}>
    I'm still under elements with zIndex: 2 outside my parent!
  </div>
</div>

<div style={{ position: 'relative', zIndex: 2 }}>
  I'm on top of the z-index: 999999 element above!
</div>
```

## Current Z-Index Audit (2025-10-20)

### ✅ Using Z_INDEX Constants (Good!)

| Component                 | Value                                                | Source                                        |
| ------------------------- | ---------------------------------------------------- | --------------------------------------------- |
| AppNavBar (Panda section) | `Z_INDEX.NAV_BAR` (100)                              | `src/components/AppNavBar.tsx:464`            |
| AppNavBar hamburger       | `Z_INDEX.GAME_NAV.HAMBURGER_MENU` (9999)             | `src/components/AppNavBar.tsx:165`            |
| AbacusDisplayDropdown     | `Z_INDEX.GAME_NAV.HAMBURGER_NESTED_DROPDOWN` (10000) | `src/components/AbacusDisplayDropdown.tsx:99` |

### ⚠️ Hardcoded Z-Index Values (Need Migration)

#### Critical Navigation Issues

| Component                     | Line | Value  | Issue                                                                                        | Fix                                                             |
| ----------------------------- | ---- | ------ | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| **AppNavBar (fixed section)** | 587  | `1000` | ❌ Should use `Z_INDEX.NAV_BAR` (100), but increased to 1000 to fix tutorial tooltip overlap | Define `TUTORIAL_TOOLTIP` in constants, set nav to proper layer |
| AppNavBar (badge)             | 645  | `50`   | Should use constant                                                                          | Add `Z_INDEX.BADGE`                                             |

#### Tutorial System

| Component                        | Line          | Value        | Purpose                                  |
| -------------------------------- | ------------- | ------------ | ---------------------------------------- |
| TutorialPlayer                   | 643           | `50`         | Tooltip container                        |
| Tutorial shared/EditorComponents | 569, 590      | `50`         | Tooltip button                           |
| Tutorial shared/EditorComponents | 612           | `100`        | Dropdown content (must be above tooltip) |
| Tutorial decomposition CSS       | 73            | `50`         | Legacy CSS                               |
| TutorialEditor                   | 65, 812, 2339 | `1000`, `10` | Various overlays                         |

#### Modals & Overlays

| Component       | Line       | Value            | Purpose                                |
| --------------- | ---------- | ---------------- | -------------------------------------- |
| Modal (common)  | 59         | `10000`          | Modal backdrop                         |
| ModerationPanel | 1994, 2009 | `10001`, `10002` | Moderation overlays                    |
| ToastContext    | 171        | `10001`          | Toast notifications (should be 20000!) |
| Join page       | 35         | `10000`          | Join page overlay                      |
| EmojiPicker     | 636        | `10000`          | Emoji picker modal                     |

#### Dropdowns & Popovers

| Component           | Line     | Value           | Purpose           |
| ------------------- | -------- | --------------- | ----------------- |
| FormatSelectField   | 115      | `999`           | Dropdown          |
| DeploymentInfoModal | 37, 55   | `9998`, `9999`  | Info modal layers |
| RoomInfo            | 338, 562 | `9999`, `10000` | Room tooltips     |
| GameTitleMenu       | 119      | `9999`          | Game menu         |
| PlayerTooltip       | 69       | `9999`          | Player tooltip    |

#### Game Elements

| Component                | Line                    | Value                     | Purpose                  |
| ------------------------ | ----------------------- | ------------------------- | ------------------------ |
| Complement Race Game     | Multiple                | `0`, `1`                  | Base game layers         |
| Complement Race Track    | 118, 140, 151           | `10`, `5`, `20`           | Track, AI racers, player |
| Complement Race HUD      | 51, 106, 119, 137, 168  | `10`, `1000`              | HUD elements             |
| GameCountdown            | 58                      | `1000`                    | Countdown overlay        |
| RouteCelebration         | 31                      | `9999`                    | Celebration overlay      |
| Matching GameCard        | 203, 229, 243, 272, 386 | `9`, `10`, `-1`, `8`, `1` | Card layers              |
| Matching PlayerStatusBar | 154, 181, 202           | `10`, `10`, `5`           | Status bars              |

#### Misc UI

| Component              | Line                    | Value                     | Purpose             |
| ---------------------- | ----------------------- | ------------------------- | ------------------- |
| HeroAbacus             | 89, 127, 163            | `10`                      | Hero section layers |
| ChampionArena          | 425, 514, 554, 614      | `10`, `1`, `1`, `10`      | Arena layers        |
| NetworkPlayerIndicator | 118, 145, 169, 192, 275 | `-1`, `2`, `1`, `2`, `10` | Player avatars      |
| ConfigurationForm      | 521, 502                | `50`                      | Config overlays     |

## The Recent Bug: Tutorial Tooltips Over Nav Bar

**Problem:** Tutorial tooltips (z-index: 50, 100) were appearing over the navigation bar.

**Root Cause:**

- Nav bar was using `Z_INDEX.NAV_BAR` = 100 in one place
- But also hardcoded `zIndex: 30` in the fixed positioning section (line 587)
- Tutorial tooltips use hardcoded `zIndex: 50` and `zIndex: 100`
- Since 50 and 100 > 30, tooltips appeared on top

**Temporary Fix:** Increased nav bar's hardcoded value from 30 to 1000

**Proper Fix Needed:**

1. Define tutorial tooltip z-indexes in constants file
2. Update nav bar to consistently use `Z_INDEX.NAV_BAR`
3. Ensure NAV_BAR > TUTORIAL_TOOLTIP in the hierarchy
4. Consider: Should tutorial tooltips be in the 1000-9999 range (overlays) rather than 50-100?

## Guidelines for Choosing Z-Index Values

### 1. **Always Import and Use Z_INDEX Constants**

```typescript
// ✅ Good
import { Z_INDEX } from "../constants/zIndex";
zIndex: Z_INDEX.NAV_BAR;

// ❌ Bad
zIndex: 100; // Magic number!
```

### 2. **Add New Values to Constants File First**

Before using a new z-index value, add it to `src/constants/zIndex.ts`:

```typescript
export const Z_INDEX = {
  // ... existing values ...

  TUTORIAL: {
    TOOLTIP: 500, // Tutorial tooltips (overlays layer)
    DROPDOWN: 600, // Tutorial dropdown (above tooltip)
  },
} as const;
```

### 3. **Choose the Right Layer**

Ask yourself:

- Is this base content? → Use 0-99
- Is this navigation/UI chrome? → Use 100-999
- Is this a dropdown/tooltip/overlay? → Use 1000-9999
- Is this a modal dialog? → Use 10000-19999
- Is this a toast notification? → Use 20000+

### 4. **Understand Your Stacking Context**

Before setting z-index, ask:

- What is my parent's stacking context?
- Am I comparing against siblings or global elements?
- Does my element create a new stacking context?

### 5. **Document Special Cases**

If you must deviate from the constants, document why:

```typescript
// HACK: Needs to be above tutorial tooltips (50) but below modals (10000)
// TODO: Migrate to Z_INDEX.TUTORIAL.TOOLTIP system
zIndex: 100;
```

## Migration Plan

### Phase 1: Update Constants File ✅ TODO

Add missing constants to `src/constants/zIndex.ts`:

```typescript
export const Z_INDEX = {
  // Base content layer (0-99)
  BASE: 0,
  CONTENT: 1,
  HERO_SECTION: 10, // Hero abacus components

  // Game content layers (0-99)
  GAME_CONTENT: {
    TRACK: 0,
    CONTROLS: 1,
    RACER_AI: 5,
    RACER_PLAYER: 10,
    RACER_FLAG: 20,
    HUD: 50,
  },

  // Navigation and UI chrome (100-999)
  NAV_BAR: 1000, // ⚠️ Currently needs to be 1000 due to tutorial tooltips
  STICKY_HEADER: 100,
  BADGE: 50,

  // Overlays and dropdowns (1000-9999)
  TUTORIAL: {
    TOOLTIP: 500, // Tutorial tooltips
    DROPDOWN: 600, // Tutorial dropdowns (must be > tooltip)
    EDITOR: 700, // Tutorial editor
  },
  DROPDOWN: 1000,
  TOOLTIP: 1000,
  POPOVER: 1000,
  CONFIG_FORM: 1000,
  PLAYER_TOOLTIP: 1000,
  GAME_COUNTDOWN: 1000,

  // High overlays (9000-9999)
  CELEBRATION: 9000,
  INFO_MODAL: 9998,

  // Modal and dialog layers (10000-19999)
  MODAL_BACKDROP: 10000,
  MODAL: 10001,
  MODERATION_PANEL: 10001,
  EMOJI_PICKER: 10000,

  // Top-level overlays (20000+)
  TOAST: 20000,

  // Special navigation layers for game pages
  GAME_NAV: {
    HAMBURGER_MENU: 9999,
    HAMBURGER_NESTED_DROPDOWN: 10000,
  },
} as const;
```

### Phase 2: Migrate High-Priority Components

Priority order:

1. **Navigation components** (AppNavBar, etc.) - most critical for user experience
2. **Tutorial system** (TutorialPlayer, tooltips) - currently conflicting
3. **Modals and overlays** - ensure they're always on top
4. **Game HUDs** - ensure proper layering
5. **Everything else**

### Phase 3: Add Linting Rule

Consider adding an ESLint rule to prevent raw z-index numbers:

```javascript
// Warn when zIndex is used with a number literal
'no-magic-numbers': ['warn', {
  ignore: [0, 1, -1],
  ignoreArrayIndexes: true,
  enforceConst: true,
}]
```

## Debugging Z-Index Issues

### Checklist

When elements aren't layering correctly:

1. **Check the value**
   - [ ] What z-index does each element have?
   - [ ] Are they using constants or magic numbers?

2. **Check the stacking context**
   - [ ] What are the parent elements?
   - [ ] Do any parents create stacking contexts? (position + z-index, opacity, transform, etc.)
   - [ ] Are we comparing siblings or elements in different contexts?

3. **Verify the DOM hierarchy**
   - [ ] Use browser DevTools to inspect the DOM tree
   - [ ] Check the "Layers" panel in Chrome DevTools
   - [ ] Look for transforms, opacity, filters on parent elements

4. **Test the fix**
   - [ ] Does the fix work in all scenarios?
   - [ ] Did we introduce new conflicts?
   - [ ] Should we update the constants file?

### DevTools Tips

**Chrome DevTools:**

1. Open DevTools → More Tools → Layers
2. Select an element and see its stacking context
3. View the 3D layer composition

**Firefox DevTools:**

1. Inspector → Layout → scroll to "Z-index"
2. Shows the stacking context parent

## Examples

### Good: Using Constants

```typescript
import { Z_INDEX } from '@/constants/zIndex'

export function MyTooltip() {
  return (
    <div className={css({
      position: 'absolute',
      zIndex: Z_INDEX.TOOLTIP,  // ✅ Clear and maintainable
    })}>
      Tooltip content
    </div>
  )
}
```

### Bad: Magic Numbers

```typescript
export function MyTooltip() {
  return (
    <div className={css({
      position: 'absolute',
      zIndex: 500,  // ❌ Where did 500 come from? How does it relate to other elements?
    })}>
      Tooltip content
    </div>
  )
}
```

### Good: Documenting Stacking Context

```typescript
// Creates a new stacking context for card contents
<div className={css({
  position: 'relative',
  zIndex: Z_INDEX.BASE,
  transform: 'translateZ(0)', // ⚠️ Creates stacking context!
})}>
  {/* Child z-indexes are relative to this context */}
  <div className={css({
    position: 'absolute',
    zIndex: Z_INDEX.CONTENT,  // Relative to parent, not global
  })}>
    Card face
  </div>
</div>
```

## Resources

- [MDN: CSS Stacking Context](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_positioned_layout/Understanding_z-index/Stacking_context)
- [What The Heck, z-index??](https://www.joshwcomeau.com/css/stacking-contexts/) by Josh Comeau
- [Z-Index Playground](https://thirumanikandan.com/posts/learn-z-index-using-a-visualization-tool)

## Last Updated

2025-10-20 - Initial audit and documentation created
