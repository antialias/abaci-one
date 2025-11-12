# Resize Handle Tab Requirements

**CRITICAL: DO NOT MAKE THE ENTIRE HANDLE WIDE**

## What the user wants:
- A **thin 8px divider** for the resize handle (full height)
- A **small grab tab** (28px × 64px) that:
  - Is centered vertically on the divider
  - Extends to the RIGHT into the preview pane
  - Has rounded corners on the top-right and bottom-right
  - Has vertical knurled texture (ridges)
  - Is DRAGGABLE

## What NOT to do:
❌ Make the entire PanelResizeHandle 36px wide
❌ Use clip-path to make a wide handle look thin
❌ Use pseudo-elements (_after) that extend outside the parent bounds (they don't participate in drag events)

## The problem:
- PanelResizeHandle only responds to drag events on itself
- Child elements positioned absolutely outside the parent's bounds don't trigger parent drag
- Pseudo-elements extending outside don't work either

## Possible solutions to try:
1. Check if PanelResizeHandle accepts hitAreaMargins prop (from library source)
2. Use a custom drag overlay that forwards events to the handle
3. Accept that the tab is visual-only and keep the 8px handle draggable

## User frustration level: HIGH
- This is the **THIRD TIME** making the handle wide when asked for a small tab
- User explicitly said "FUUUUUCK, no wide drag handles!"
