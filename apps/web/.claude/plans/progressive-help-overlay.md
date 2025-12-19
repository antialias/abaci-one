# Progressive Help Overlay Feature Plan

## Executive Summary

**What:** When kid enters a prefix sum, show interactive abacus covering completed terms with time-based hint escalation.

**Why:** Makes help discoverable without reading - kid just enters what's on their abacus and help appears.

**Key insight:** We already have all the coaching/decomposition infrastructure extracted. Only need to:

1. Extract bead tooltip positioning from TutorialPlayer
2. Build new overlay component using existing decomposition system
3. Wire up time-based escalation

## Visual Layout

```
        11              ← covered by abacus
      +  1              ← covered by abacus
      +  1              ← covered by abacus
   ┌─────────────────┐
   │  ABACUS: 13→33  │  ← positioned above next term
   └─────────────────┘
      + 20              ← term being added (visible)
      + 10              ← remaining terms (visible)
   ──────────
   … [ 13 ]
```

## Time-Based Escalation

| Time             | What appears                           |
| ---------------- | -------------------------------------- |
| 0s               | Abacus with arrows                     |
| +5s (debug: 1s)  | Coach hint (from decomposition system) |
| +10s (debug: 3s) | Bead tooltip pointing at beads         |

## Shared Infrastructure (Already Exists)

- `generateUnifiedInstructionSequence()` - step/segment data
- `DecompositionProvider` / `DecompositionDisplay` - visual decomposition
- `generateDynamicCoachHint()` - context-aware hints
- `HelpAbacus` - interactive abacus with arrows

## To Extract from TutorialPlayer

- `findTopmostBeadWithArrows()` - bead selection
- `calculateTooltipSide()` - smart collision detection
- `createTooltipTarget()` - overlay target creation

## Files

| File                                                      | Action                           |
| --------------------------------------------------------- | -------------------------------- |
| `src/utils/beadTooltipUtils.ts`                           | CREATE - extracted tooltip utils |
| `src/constants/helpTiming.ts`                             | CREATE - timing config           |
| `src/components/practice/PracticeHelpOverlay.tsx`         | CREATE - main component          |
| `src/components/practice/PracticeHelpOverlay.stories.tsx` | CREATE - stories                 |
| `src/components/practice/HelpAbacus.tsx`                  | MODIFY - add overlays prop       |
| `src/components/practice/ActiveSession.tsx`               | MODIFY - integrate overlay       |
| `src/components/tutorial/TutorialPlayer.tsx`              | MODIFY - use shared utils        |

## Deferred

Positioning challenge (fixed abacus height vs variable prefix terms) - handle in follow-up.
