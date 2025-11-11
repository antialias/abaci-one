# Worksheet Generator Layout Redesign Proposals

## Current State Analysis

The current layout uses a **2-column grid** on desktop:
- **Left column**: ConfigPanel (difficulty settings, scaffolding controls, regrouping frequency)
- **Right column**: OrientationPanel, Generate button, Upload button, WorksheetPreview

**Problems:**
1. Preview is competing for attention with configuration
2. Configuration takes up 50% of the screen width
3. Preview is buried at the bottom of the right column
4. No clear visual hierarchy - everything feels equally important

## Design Goals

1. **Preview is the star** - Large, centered, immediately visible
2. **Controls are accessible** - Still easy to find and use, but not dominating
3. **Progressive disclosure** - Show essential controls, hide advanced options
4. **Responsive** - Works great on mobile too

---

## Proposal 1: "Preview Center Stage" (Recommended)

### Layout Structure

```
┌─────────────────────────────────────────────────────────────┐
│  Header: Worksheet Generator                                 │
└─────────────────────────────────────────────────────────────┘

┌──────────────┬──────────────────────────────┬──────────────┐
│              │                              │              │
│   Sidebar    │      LARGE PREVIEW           │   Sidebar    │
│   (Config)   │      (Center Stage)          │   (Layout)   │
│              │                              │              │
│   Sticky     │   ┌──────────────────────┐   │   Sticky     │
│              │   │                      │   │              │
│              │   │   Worksheet Preview  │   │              │
│              │   │   (Large SVG)        │   │              │
│              │   │                      │   │              │
│              │   │                      │   │              │
│              │   └──────────────────────┘   │              │
│              │                              │              │
│              │   Pagination: ← 1/2 →        │              │
│              │                              │              │
└──────────────┴──────────────────────────────┴──────────────┘
    ~280px              Flexible                  ~280px
```

### Key Features

**Left Sidebar (Configuration):**
- Sticky positioning (stays visible on scroll)
- Collapsible sections with clear headings:
  - 📝 Student Name (always visible)
  - ➕ Operator (always visible)
  - 🎯 Difficulty Method selector (Smart/Mastery - always visible)
  - 📊 Difficulty Controls (collapsed by default)
  - 🎨 Scaffolding Options (collapsed by default)
- Settings auto-save indicator at bottom

**Center (Preview):**
- Maximum width (800-1000px) for optimal readability
- Preview takes up most of vertical space
- Clean pagination controls (if multi-page)
- Subtle info bar: "20 problems (4×5 grid) • Progressive difficulty"

**Right Sidebar (Layout & Actions):**
- Sticky positioning
- Orientation selector (Portrait/Landscape)
- Problems per page dropdown
- Pages selector (1-4)
- Layout options (Problem numbers, Cell borders)
- **Generate PDF** button (prominent, blue)
- **Upload Worksheet** button (purple, secondary)

**Mobile Behavior:**
- Sidebars collapse into top accordion sections
- Preview stays full-width
- Actions become floating bottom bar

### Implementation Notes

```typescript
// Main layout grid
<div className={css({
  display: 'grid',
  gridTemplateColumns: {
    base: '1fr',                    // Mobile: single column
    lg: '280px 1fr 280px'           // Desktop: 3-column
  },
  gap: '6',
  maxW: '1920px',
  mx: 'auto',
  px: '4',
  py: '8',
})}>
  <ConfigSidebar sticky />
  <PreviewCenter />
  <ActionsSidebar sticky />
</div>
```

---

## Proposal 2: "Floating Toolbar"

### Layout Structure

```
┌─────────────────────────────────────────────────────────────┐
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Floating Toolbar (top, transparent bg, blur)          │  │
│  │  [Student] [Difficulty ▾] [Layout ▾] [Generate PDF]  │  │
│  └───────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                    LARGE PREVIEW                            │
│              (Full-width, centered)                         │
│                                                             │
│        ┌────────────────────────────────┐                   │
│        │                                │                   │
│        │   Worksheet Preview            │                   │
│        │                                │                   │
│        │                                │                   │
│        └────────────────────────────────┘                   │
│                                                             │
│              Pagination: ← 1/2 →                            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Key Features

**Floating Toolbar (Top):**
- Fixed/sticky at top when scrolling
- Compact dropdown menus:
  - **Difficulty** dropdown: Difficulty method selector + controls
  - **Layout** dropdown: Orientation, problems per page, scaffolding
- Direct inputs for quick access (student name)
- Generate button always visible

**Preview:**
- Maximum 90% viewport width
- Centered with subtle shadow/border
- Info displayed as subtle overlay on hover
- No competing UI elements

**Advanced Settings:**
- Hidden in dropdowns/modals
- "Advanced settings..." link opens modal

### Pros/Cons

**Pros:**
- Maximum preview visibility
- Clean, minimal interface
- Feels like a "tool" rather than a "form"

**Cons:**
- Dropdowns can hide functionality
- Less discoverable for new users
- Might feel too minimalist

---

## Proposal 3: "Tab-Based Configuration"

### Layout Structure

```
┌─────────────────────────────────────────────────────────────┐
│  Header: Worksheet Generator                                 │
├─────────────────────────────────────────────────────────────┤
│  Tabs: [✏️ Content] [🎨 Layout] [📊 Difficulty]             │
└─────────────────────────────────────────────────────────────┘

┌───────────────────────────┬─────────────────────────────────┐
│                           │                                 │
│    Tab Content Panel      │      LARGE PREVIEW              │
│    (Config for active     │                                 │
│     tab only)             │   ┌─────────────────────────┐   │
│                           │   │                         │   │
│  [Only ~25% width]        │   │   Worksheet Preview     │   │
│                           │   │                         │   │
│                           │   │                         │   │
│                           │   └─────────────────────────┘   │
│                           │                                 │
│  ┌──────────────────────┐ │   Pagination: ← 1/2 →           │
│  │ Generate PDF         │ │                                 │
│  └──────────────────────┘ │                                 │
└───────────────────────────┴─────────────────────────────────┘
        ~25%                          ~75%
```

### Key Features

**Tabs organize settings by category:**
- **✏️ Content**: Student name, operator, difficulty method
- **🎨 Layout**: Orientation, problems per page, scaffolding options
- **📊 Difficulty**: All difficulty controls (smart/mastery/manual presets)

**Benefits:**
- Preview gets 75% of width
- Settings are organized logically
- Reduces visual clutter
- Easy to find related settings

**Drawbacks:**
- Settings are split across tabs (might feel fragmented)
- Can't see all settings at once

---

## Proposal 4: "Side Panel Drawer" (Mobile-First)

### Layout Structure

```
┌─────────────────────────────────────────────────────────────┐
│  [☰ Settings]  Worksheet Generator        [Generate PDF]   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                    FULL-WIDTH PREVIEW                       │
│                                                             │
│           ┌────────────────────────────────┐                │
│           │                                │                │
│           │   Worksheet Preview            │                │
│           │   (Maximum size)               │                │
│           │                                │                │
│           └────────────────────────────────┘                │
│                                                             │
│                 Pagination: ← 1/2 →                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘

         [☰ Click opens side drawer]
┌────────────────┐
│   Settings     │
│   ──────────   │
│                │
│  [All config]  │
│                │
└────────────────┘
```

### Key Features

**Desktop:**
- Preview is full-width (or nearly full-width)
- Settings drawer slides in from left (350px wide)
- Drawer can be toggled open/closed
- Overlay dims preview when drawer is open

**Mobile:**
- Preview is full viewport width
- Settings drawer slides from bottom (modal-like)
- Generate button in header for quick access

### Pros/Cons

**Pros:**
- Maximum preview space
- Works great on mobile
- Settings are completely hidden when not needed

**Cons:**
- Harder to tweak settings while viewing preview
- Not ideal for rapid iteration

---

## Comparison Matrix

| Feature | Proposal 1 (Center Stage) | Proposal 2 (Toolbar) | Proposal 3 (Tabs) | Proposal 4 (Drawer) |
|---------|---------------------------|----------------------|-------------------|---------------------|
| Preview Size | ★★★★☆ (60-65%) | ★★★★★ (90%) | ★★★★★ (75%) | ★★★★★ (95%) |
| Setting Discoverability | ★★★★★ | ★★☆☆☆ | ★★★★☆ | ★★★☆☆ |
| Quick Tweaking | ★★★★★ | ★★★☆☆ | ★★★★☆ | ★★☆☆☆ |
| Clean Design | ★★★★☆ | ★★★★★ | ★★★★☆ | ★★★★★ |
| Mobile Friendly | ★★★☆☆ | ★★★★☆ | ★★★☆☆ | ★★★★★ |
| Implementation Complexity | ★★★☆☆ (Medium) | ★★★★☆ (Medium-Hard) | ★★★☆☆ (Medium) | ★★★★☆ (Medium-Hard) |

---

## Recommendation

**Proposal 1: "Preview Center Stage"** is the best balance:

✅ **Pros:**
- Preview is clearly the focus (60-65% of width)
- All settings remain visible and accessible
- Easy to iterate quickly
- Familiar pattern (sidebar + main content)
- Works reasonably well on mobile
- Moderate implementation complexity

**Why not the others?**
- Proposal 2: Too minimal, hides too much
- Proposal 3: Settings feel fragmented across tabs
- Proposal 4: Makes rapid iteration harder

---

## Next Steps

If you approve Proposal 1, I can:

1. **Refactor AdditionWorksheetClient.tsx** into 3 components:
   - `ConfigSidebar` (left) - collapsible sections
   - `PreviewCenter` (center) - large preview
   - `ActionsSidebar` (right) - layout + actions

2. **Add collapsible sections** using Radix UI Collapsible
   - Smart defaults: Essential settings expanded, advanced collapsed

3. **Implement sticky sidebars** with proper scroll behavior

4. **Responsive breakpoints**:
   - Mobile (< 768px): Stack vertically, sidebars become accordions
   - Tablet (768-1024px): 2-column (preview + single sidebar)
   - Desktop (> 1024px): 3-column layout as shown

Would you like me to proceed with Proposal 1, or would you prefer a different approach?
