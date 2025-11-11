# Hybrid Layout Plan: Proposals 1 + 3 (with Mobile Drawer Path)

## Design Overview

Combine **Proposal 1's sidebar structure** with **Proposal 3's tab organization**, architected so we can easily add **Proposal 4's drawer** for mobile later.

## Desktop Layout (≥1024px)

```
┌─────────────────────────────────────────────────────────────┐
│  Header: Worksheet Generator                                 │
└─────────────────────────────────────────────────────────────┘

┌──────────────┬──────────────────────────────┬──────────────┐
│              │                              │              │
│   Config     │      LARGE PREVIEW           │   Actions    │
│   Sidebar    │      (Center Stage)          │   Sidebar    │
│              │                              │              │
│ ┌──────────┐ │   ┌──────────────────────┐   │ ┌──────────┐ │
│ │ TABS:    │ │   │                      │   │ │ Layout   │ │
│ │ Content  │ │   │   Worksheet Preview  │   │ │ Controls │ │
│ │ Layout   │ │   │   (Large SVG)        │   │ │          │ │
│ │ Scaffolding│   │                      │   │ │ Actions  │ │
│ │ Difficulty│ │   │                      │   │ │          │ │
│ └──────────┘ │   └──────────────────────┘   │ └──────────┘ │
│              │                              │              │
│ [Tab Panel]  │   Pagination: ← 1/2 →        │              │
│ Content for  │                              │              │
│ active tab   │                              │              │
│              │                              │              │
│ Sticky       │                              │   Sticky     │
└──────────────┴──────────────────────────────┴──────────────┘
    ~300px              Flexible                  ~280px
```

## Tablet Layout (768-1023px)

```
┌─────────────────────────────────────────────────────────────┐
│  Header: Worksheet Generator                                 │
└─────────────────────────────────────────────────────────────┘

┌──────────────────┬──────────────────────────────────────────┐
│                  │                                          │
│   Config Sidebar │      LARGE PREVIEW                       │
│   (Combined)     │                                          │
│                  │   ┌──────────────────────────────────┐   │
│ ┌──────────────┐ │   │                                  │   │
│ │ TABS         │ │   │   Worksheet Preview              │   │
│ │ All tabs     │ │   │                                  │   │
│ └──────────────┘ │   │                                  │   │
│                  │   └──────────────────────────────────┘   │
│ [Tab Panel]      │                                          │
│ + Actions        │   Pagination: ← 1/2 →                    │
│                  │                                          │
└──────────────────┴──────────────────────────────────────────┘
    ~320px                     Flexible
```

## Mobile Layout (<768px) - Phase 1 (Accordion)

```
┌─────────────────────────────────────────────────────────────┐
│  Header: Worksheet Generator                  [Generate PDF]│
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  ▼ Content (Student, Operator, Difficulty Method)           │
│  ▶ Layout (Orientation, Problems/Page)                      │
│  ▶ Scaffolding (Answer Boxes, Colors, etc.)                 │
│  ▶ Difficulty Controls (Presets, Sliders)                   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                    FULL-WIDTH PREVIEW                       │
│                                                             │
│           ┌────────────────────────────────┐                │
│           │   Worksheet Preview            │                │
│           │                                │                │
│           └────────────────────────────────┘                │
│                                                             │
│                 Pagination: ← 1/2 →                         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  [Generate PDF]              [Upload Worksheet]             │
└─────────────────────────────────────────────────────────────┘
```

## Mobile Layout (<768px) - Phase 2 (Drawer) [Future]

```
┌─────────────────────────────────────────────────────────────┐
│  [☰ Settings]  Worksheet Generator        [Generate PDF]   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                    FULL-WIDTH PREVIEW                       │
│           ┌────────────────────────────────┐                │
│           │   Worksheet Preview            │                │
│           │                                │                │
│           └────────────────────────────────┘                │
│                 Pagination: ← 1/2 →                         │
└─────────────────────────────────────────────────────────────┘

         [Drawer slides from left when ☰ clicked]
┌────────────────┐
│   Settings     │
│                │
│  [Tabs]        │
│  [Tab Panel]   │
│  [Actions]     │
└────────────────┘
```

---

## Component Architecture

### High-Level Structure

```
AdditionWorksheetClient
├─ Header (Desktop: full-width, Mobile: with menu button)
├─ ConfigSidebar (Desktop/Tablet: visible, Mobile: hidden/drawer)
│  ├─ TabNavigation
│  └─ TabContent (switches based on active tab)
│     ├─ ContentTab
│     ├─ LayoutTab
│     ├─ ScaffoldingTab
│     └─ DifficultyTab
├─ PreviewCenter (always visible, responsive width)
│  ├─ WorksheetPreview
│  └─ Pagination
└─ ActionsSidebar (Desktop: sidebar, Tablet/Mobile: merged into ConfigSidebar or bottom)
   ├─ OrientationPanel (simplified)
   ├─ GenerateButton
   └─ UploadButton
```

### Key Components

#### 1. `ConfigSidebar.tsx`
```typescript
interface ConfigSidebarProps {
  formState: WorksheetFormState
  onChange: (updates: Partial<WorksheetFormState>) => void
  mode: 'sidebar' | 'drawer' | 'accordion'  // ← Architecture for future drawer
}

export function ConfigSidebar({ formState, onChange, mode }: ConfigSidebarProps) {
  const [activeTab, setActiveTab] = useState('content')

  // Mode switching logic
  if (mode === 'drawer') {
    return <DrawerContainer>{/* Tabs + Content */}</DrawerContainer>
  }
  if (mode === 'accordion') {
    return <AccordionContainer>{/* Tabs as accordions */}</AccordionContainer>
  }

  // Default sidebar mode
  return (
    <div className={sidebarStyles}>
      <TabNavigation activeTab={activeTab} onChange={setActiveTab} />
      <TabContent activeTab={activeTab} formState={formState} onChange={onChange} />
    </div>
  )
}
```

#### 2. Tab Organization

**Tab 1: Content** (Always most important)
- Student Name
- Operator Selector (Addition/Subtraction/Mixed)
- Difficulty Method Selector (Smart/Mastery)
- Progressive Difficulty Toggle

**Tab 2: Layout** (Moved from right sidebar)
- Orientation (Portrait/Landscape)
- Problems per Page
- Pages (1-4)
- Layout Options (Problem Numbers, Cell Borders)

**Tab 3: Scaffolding** (Pedagogical tools)
- All Always / Minimal buttons
- Answer Boxes thermometer
- Place Value Colors thermometer
- Carry/Borrow Boxes thermometer
- Borrowed 10s Box thermometer (subtraction)
- Borrowing Hints thermometer (subtraction)
- Ten-Frames thermometer

**Tab 4: Difficulty** (Method-specific controls)
- Smart Mode: Difficulty preset dropdown, easier/harder buttons, difficulty slider
- Mastery Mode: Skill selector
- Manual Mode: Digit range, regrouping frequency

#### 3. `TabNavigation.tsx`
```typescript
const tabs = [
  { id: 'content', label: 'Content', icon: '✏️', alwaysShow: true },
  { id: 'layout', label: 'Layout', icon: '📐', alwaysShow: true },
  { id: 'scaffolding', label: 'Scaffolding', icon: '🎨', alwaysShow: false },
  { id: 'difficulty', label: 'Difficulty', icon: '📊', alwaysShow: false },
]

// Desktop: Vertical tabs on left side
// Mobile accordion: Tabs become accordion headers
// Mobile drawer: Horizontal tabs at top of drawer
```

#### 4. Responsive Mode Logic
```typescript
function useLayoutMode() {
  const [mode, setMode] = useState<'sidebar' | 'drawer' | 'accordion'>('sidebar')

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth
      if (width >= 1024) setMode('sidebar')      // Desktop: sidebar
      else if (width >= 768) setMode('sidebar')  // Tablet: sidebar (narrower)
      else setMode('accordion')                  // Mobile Phase 1: accordion
      // Future: else setMode('drawer')          // Mobile Phase 2: drawer
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return mode
}
```

---

## Implementation Plan

### Phase 1: Desktop + Tablet + Mobile Accordion (This PR)

**Step 1: Create Tab Components**
- [ ] `TabNavigation.tsx` - Tab buttons (vertical for desktop, accordion for mobile)
- [ ] `ContentTab.tsx` - Student name, operator, difficulty method, progressive toggle
- [ ] `LayoutTab.tsx` - Orientation, problems per page, pages, layout options
- [ ] `ScaffoldingTab.tsx` - All scaffolding thermometers
- [ ] `DifficultyTab.tsx` - Difficulty presets, sliders, controls

**Step 2: Create Sidebar Container**
- [ ] `ConfigSidebar.tsx` - Container with mode switching logic
- [ ] Sticky positioning for desktop/tablet
- [ ] Accordion mode for mobile (<768px)

**Step 3: Reorganize Main Layout**
- [ ] Update `AdditionWorksheetClient.tsx` to use 3-column grid
- [ ] Move OrientationPanel controls into LayoutTab
- [ ] Move scaffolding controls into ScaffoldingTab
- [ ] Keep actions (Generate, Upload) in right sidebar (desktop) or bottom (mobile)

**Step 4: Responsive Breakpoints**
- [ ] Desktop (≥1024px): 3-column (config | preview | actions)
- [ ] Tablet (768-1023px): 2-column (config+actions | preview)
- [ ] Mobile (<768px): 1-column stack (accordion → preview → actions)

**Step 5: Polish**
- [ ] Smooth transitions between tabs
- [ ] Active tab indicator
- [ ] Settings auto-save indicator at bottom of sidebar
- [ ] Keyboard navigation (Arrow keys to switch tabs)

### Phase 2: Mobile Drawer (Future PR)

**When to implement:**
- After user testing shows mobile accordion feels cramped
- When we want to maximize mobile preview space

**What changes:**
```typescript
// Just change one line in useLayoutMode():
else setMode('drawer')  // Instead of 'accordion'
```

**Additional components needed:**
- [ ] `DrawerContainer.tsx` - Slide-out drawer with overlay
- [ ] `MobileHeader.tsx` - Header with hamburger menu button
- [ ] Drawer animations (slide in/out)
- [ ] Overlay click-to-close

**Drawer reuses existing components:**
- TabNavigation (switches to horizontal layout)
- All Tab components (unchanged)
- Actions (moved into drawer footer)

---

## Benefits of This Architecture

✅ **Desktop:** Tabs organize settings logically, preview stays large (60-65% width)
✅ **Tablet:** Still usable with narrower sidebar
✅ **Mobile Phase 1:** Accordion keeps everything accessible without drawer complexity
✅ **Mobile Phase 2:** Easy upgrade path to drawer (just change mode logic)
✅ **Code Reuse:** All tab components work in sidebar, accordion, AND drawer modes
✅ **Progressive Enhancement:** Can ship Phase 1 quickly, add Phase 2 later

---

## File Structure

```
src/app/create/worksheets/addition/components/
├── AdditionWorksheetClient.tsx (updated: 3-column grid)
├── ConfigSidebar.tsx (new: mode-aware container)
├── PreviewCenter.tsx (new: extracted preview + pagination)
├── ActionsSidebar.tsx (new: generate + upload buttons)
│
├── config-sidebar/
│   ├── TabNavigation.tsx (new: vertical/horizontal tabs)
│   ├── ContentTab.tsx (new: student, operator, method)
│   ├── LayoutTab.tsx (new: orientation, problems, pages)
│   ├── ScaffoldingTab.tsx (new: all thermometers)
│   └── DifficultyTab.tsx (new: presets, sliders)
│
├── config-panel/ (existing components - mostly unchanged)
│   ├── DifficultyPresetDropdown.tsx
│   ├── MakeEasierHarderButtons.tsx
│   ├── OverallDifficultySlider.tsx
│   ├── DigitRangeSection.tsx
│   ├── RegroupingFrequencyPanel.tsx
│   ├── RuleThermometer.tsx
│   └── ...
│
└── mobile/ (future Phase 2)
    ├── DrawerContainer.tsx
    └── MobileHeader.tsx
```

---

## Next Steps

Ready to implement Phase 1? I'll:

1. Create the tab components (ContentTab, LayoutTab, ScaffoldingTab, DifficultyTab)
2. Create ConfigSidebar with mode switching
3. Extract PreviewCenter and ActionsSidebar
4. Update AdditionWorksheetClient to use new 3-column grid
5. Add responsive breakpoints
6. Test on desktop, tablet, and mobile

Should I proceed?
