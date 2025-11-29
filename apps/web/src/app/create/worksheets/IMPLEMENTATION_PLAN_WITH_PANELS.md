# Implementation Plan: Using react-resizable-panels

## Leveraging Existing Package

We're already using **`react-resizable-panels`** (v3.0.6) in Rithmomachia, so we can use it for the worksheet generator layout!

### Benefits

✅ **User-resizable sidebars** - Users can adjust panel widths to their preference
✅ **Persisted sizes** - Panel sizes save to localStorage automatically
✅ **Collapsible panels** - Can collapse sidebars completely
✅ **Smooth animations** - Built-in smooth resizing
✅ **Mobile responsive** - Can hide panels on mobile
✅ **Already installed** - No new dependencies!

---

## Desktop Layout with react-resizable-panels

```tsx
<PanelGroup direction="horizontal" autoSaveId="worksheet-layout">
  {/* Left Sidebar: Configuration */}
  <Panel
    defaultSize={20} // 20% of width
    minSize={15} // Min 15%
    maxSize={35} // Max 35%
    collapsible={true} // Can collapse completely
  >
    <ConfigSidebar />
  </Panel>
  <PanelResizeHandle /> {/* Drag handle */}
  {/* Center: Preview */}
  <Panel
    defaultSize={60} // 60% of width
    minSize={40} // Min 40% (preview needs space)
  >
    <PreviewCenter />
  </Panel>
  <PanelResizeHandle /> {/* Drag handle */}
  {/* Right Sidebar: Actions */}
  <Panel
    defaultSize={20} // 20% of width
    minSize={15} // Min 15%
    maxSize={30} // Max 30%
    collapsible={true} // Can collapse completely
  >
    <ActionsSidebar />
  </Panel>
</PanelGroup>
```

### Visual with Resize Handles

```
┌──────────────┃──────────────────────────────┃──────────────┐
│              ┃                              ┃              │
│   Config     ┃      LARGE PREVIEW           ┃   Actions    │
│   Sidebar    ┃      (Resizable!)            ┃   Sidebar    │
│              ┃                              ┃              │
│ ┌──────────┐ ┃   ┌──────────────────────┐   ┃ ┌──────────┐ │
│ │ TABS:    │ ┃   │                      │   ┃ │ Layout   │ │
│ │ Content  │ ┃   │   Preview resizes    │   ┃ │ Controls │ │
│ │ Layout   │ ┃   │   when you drag      │   ┃ │          │ │
│ │ Scaffolding ┃   │   the handles! ⟷     │   ┃ │ Actions  │ │
│ │ Difficulty│ ┃   │                      │   ┃ │          │ │
│ └──────────┘ ┃   └──────────────────────┘   ┃ └──────────┘ │
│              ┃                              ┃              │
└──────────────┃──────────────────────────────┃──────────────┘
    15-35%     ┃         40-70%                ┃   15-30%
            Resize                          Resize
            Handle                          Handle
```

---

## Responsive Behavior

### Desktop (≥1024px): 3 Panels

```tsx
<PanelGroup direction="horizontal" autoSaveId="worksheet-layout-desktop">
  <Panel defaultSize={20}>Config</Panel>
  <PanelResizeHandle />
  <Panel defaultSize={60}>Preview</Panel>
  <PanelResizeHandle />
  <Panel defaultSize={20}>Actions</Panel>
</PanelGroup>
```

### Tablet (768-1023px): 2 Panels (Merge Actions into Config)

```tsx
<PanelGroup direction="horizontal" autoSaveId="worksheet-layout-tablet">
  <Panel defaultSize={30}>Config + Actions (tabs)</Panel>
  <PanelResizeHandle />
  <Panel defaultSize={70}>Preview</Panel>
</PanelGroup>
```

### Mobile (<768px): No Panels (Stack Vertically)

```tsx
{
  /* No PanelGroup on mobile - just stack */
}
<div className={stack({ gap: "4" })}>
  <ConfigAccordion /> {/* Accordions instead of tabs */}
  <PreviewCenter />
  <ActionsBar />
</div>;
```

---

## Enhanced Component Architecture

### 1. `AdditionWorksheetClient.tsx` (Updated)

```tsx
export function AdditionWorksheetClient({
  initialSettings,
  initialPreview,
}: AdditionWorksheetClientProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const [viewportWidth, setViewportWidth] = useState(0)

  // Track viewport width for responsive behavior
  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth)
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const { formState, debouncedFormState, updateFormState } = useWorksheetState(initialSettings)
  const { status, error, generate, reset } = useWorksheetGeneration()
  const { isSaving, lastSaved } = useWorksheetAutoSave(formState, 'addition')

  // Desktop: 3 panels
  if (viewportWidth >= 1024) {
    return (
      <PageWithNav navTitle="Worksheet Generator" navEmoji="📝">
        <div className={css({ minHeight: '100vh', bg: isDark ? 'gray.900' : 'gray.50', p: '4' })}>
          <PanelGroup
            direction="horizontal"
            autoSaveId="worksheet-layout-desktop"
            className={css({ height: 'calc(100vh - 120px)' })}
          >
            {/* Left: Config Sidebar with Tabs */}
            <Panel defaultSize={22} minSize={15} maxSize={35} collapsible>
              <ConfigSidebar
                formState={formState}
                onChange={updateFormState}
                isSaving={isSaving}
                lastSaved={lastSaved}
              />
            </Panel>

            <PanelResizeHandle className={resizeHandleStyles(isDark)} />

            {/* Center: Preview */}
            <Panel defaultSize={56} minSize={40}>
              <PreviewCenter
                formState={debouncedFormState}
                initialPreview={initialPreview}
              />
            </Panel>

            <PanelResizeHandle className={resizeHandleStyles(isDark)} />

            {/* Right: Actions Sidebar */}
            <Panel defaultSize={22} minSize={15} maxSize={30} collapsible>
              <ActionsSidebar
                formState={formState}
                onChange={updateFormState}
                onGenerate={() => generate({ ...formState, date: getDefaultDate() })}
                status={status}
              />
            </Panel>
          </PanelGroup>

          <GenerationErrorDisplay error={error} visible={status === 'error'} onRetry={reset} />
        </div>
      </PageWithNav>
    )
  }

  // Tablet: 2 panels (Config+Actions merged)
  if (viewportWidth >= 768) {
    return (
      <PageWithNav navTitle="Worksheet Generator" navEmoji="📝">
        <div className={css({ minHeight: '100vh', bg: isDark ? 'gray.900' : 'gray.50', p: '4' })}>
          <PanelGroup
            direction="horizontal"
            autoSaveId="worksheet-layout-tablet"
            className={css({ height: 'calc(100vh - 120px)' })}
          >
            {/* Left: Config + Actions (combined) */}
            <Panel defaultSize={35} minSize={25} maxSize={45} collapsible>
              <ConfigSidebar
                formState={formState}
                onChange={updateFormState}
                includeActions  {/* Adds actions tab */}
                onGenerate={() => generate({ ...formState, date: getDefaultDate() })}
                status={status}
              />
            </Panel>

            <PanelResizeHandle className={resizeHandleStyles(isDark)} />

            {/* Right: Preview */}
            <Panel defaultSize={65} minSize={55}>
              <PreviewCenter
                formState={debouncedFormState}
                initialPreview={initialPreview}
              />
            </Panel>
          </PanelGroup>

          <GenerationErrorDisplay error={error} visible={status === 'error'} onRetry={reset} />
        </div>
      </PageWithNav>
    )
  }

  // Mobile: No panels, vertical stack
  return (
    <PageWithNav navTitle="Worksheet Generator" navEmoji="📝">
      <div className={css({ minHeight: '100vh', bg: isDark ? 'gray.900' : 'gray.50', p: '4' })}>
        <div className={stack({ gap: '4' })}>
          <ConfigAccordion formState={formState} onChange={updateFormState} />
          <PreviewCenter formState={debouncedFormState} initialPreview={initialPreview} />
          <ActionsBar
            onGenerate={() => generate({ ...formState, date: getDefaultDate() })}
            status={status}
          />
        </div>
        <GenerationErrorDisplay error={error} visible={status === 'error'} onRetry={reset} />
      </div>
    </PageWithNav>
  )
}
```

### 2. Resize Handle Styles

```tsx
function resizeHandleStyles(isDark: boolean) {
  return css({
    width: "8px",
    bg: isDark ? "gray.700" : "gray.200",
    position: "relative",
    cursor: "col-resize",
    transition: "background 0.2s",
    _hover: {
      bg: isDark ? "brand.600" : "brand.400",
    },
    _active: {
      bg: "brand.500",
    },
    // Visual indicator (3 dots)
    _before: {
      content: '""',
      position: "absolute",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      width: "3px",
      height: "20px",
      bg: isDark ? "gray.500" : "gray.400",
      borderRadius: "full",
      boxShadow: isDark
        ? "0 -8px 0 0 gray.500, 0 8px 0 0 gray.500"
        : "0 -8px 0 0 gray.400, 0 8px 0 0 gray.400",
    },
  });
}
```

---

## Additional Features Enabled by react-resizable-panels

### 1. Collapse Buttons

```tsx
// In ConfigSidebar header
<button
  onClick={() => {
    // Collapse/expand the panel
    panelRef.current?.collapse();
  }}
  className={css({
    /* ... */
  })}
>
  {isCollapsed ? "▶" : "◀"} {!isCollapsed && "Collapse"}
</button>
```

### 2. Keyboard Shortcuts

```tsx
// In AdditionWorksheetClient
useEffect(() => {
  const handleKeyPress = (e: KeyboardEvent) => {
    if (e.ctrlKey && e.key === "[") {
      leftPanelRef.current?.collapse();
    }
    if (e.ctrlKey && e.key === "]") {
      rightPanelRef.current?.collapse();
    }
  };
  window.addEventListener("keydown", handleKeyPress);
  return () => window.removeEventListener("keydown", handleKeyPress);
}, []);
```

### 3. Size Presets

```tsx
// Quick layout buttons
<div className={hstack({ gap: "2" })}>
  <button onClick={() => setPanelSizes([20, 60, 20])}>Balanced</button>
  <button onClick={() => setPanelSizes([15, 70, 15])}>Preview Focus</button>
  <button onClick={() => setPanelSizes([30, 50, 20])}>Config Focus</button>
</div>
```

---

## Updated Implementation Checklist

### Phase 1: Desktop + Tablet with Resizable Panels

**Step 1: Create Tab Components** (Same as before)

- [ ] `TabNavigation.tsx`
- [ ] `ContentTab.tsx`
- [ ] `LayoutTab.tsx`
- [ ] `ScaffoldingTab.tsx`
- [ ] `DifficultyTab.tsx`

**Step 2: Create Panel Containers**

- [ ] `ConfigSidebar.tsx` - With tabs, collapsible sections, settings indicator
- [ ] `PreviewCenter.tsx` - Preview with pagination
- [ ] `ActionsSidebar.tsx` - Layout controls + action buttons
- [ ] `resizeHandleStyles.ts` - Shared resize handle styles

**Step 3: Update Main Layout**

- [ ] Update `AdditionWorksheetClient.tsx` to use `PanelGroup`
- [ ] Add viewport width tracking for responsive behavior
- [ ] Implement 3-panel layout (desktop)
- [ ] Implement 2-panel layout (tablet)
- [ ] Implement vertical stack (mobile)

**Step 4: Polish**

- [ ] Add collapse buttons to panel headers
- [ ] Smooth transitions between tabs
- [ ] Active tab indicator
- [ ] Keyboard shortcuts (Ctrl+[ / Ctrl+])
- [ ] Size persistence with `autoSaveId`

**Step 5: Mobile Accordion** (If not using panels)

- [ ] `ConfigAccordion.tsx` - Accordion mode for mobile
- [ ] `ActionsBar.tsx` - Bottom action bar for mobile

### Phase 2: Mobile Drawer (Future)

- [ ] `DrawerContainer.tsx` - Slide-out drawer
- [ ] `MobileHeader.tsx` - Header with hamburger menu
- [ ] Replace accordion with drawer on mobile

---

## Advantages Over Plain CSS Grid

| Feature             | CSS Grid | react-resizable-panels |
| ------------------- | -------- | ---------------------- |
| Fixed layout        | ✅       | ✅                     |
| User-resizable      | ❌       | ✅                     |
| Persist sizes       | ❌       | ✅ (localStorage)      |
| Collapsible         | Manual   | ✅ (built-in)          |
| Smooth animations   | Manual   | ✅ (built-in)          |
| Drag handles        | Manual   | ✅ (built-in)          |
| Min/max constraints | Manual   | ✅ (declarative)       |
| Accessibility       | Manual   | ✅ (ARIA labels)       |

---

## File Structure (Updated)

```
src/app/create/worksheets/addition/components/
├── AdditionWorksheetClient.tsx (updated: uses PanelGroup)
├── ConfigSidebar.tsx (new: left panel with tabs)
├── PreviewCenter.tsx (new: center panel)
├── ActionsSidebar.tsx (new: right panel)
├── ConfigAccordion.tsx (new: mobile accordion)
├── ActionsBar.tsx (new: mobile bottom bar)
│
├── config-sidebar/
│   ├── TabNavigation.tsx
│   ├── ContentTab.tsx
│   ├── LayoutTab.tsx
│   ├── ScaffoldingTab.tsx
│   └── DifficultyTab.tsx
│
└── styles/
    └── resizeHandleStyles.ts (new: shared resize handle styles)
```

---

## Example from Rithmomachia (Reference)

Your existing usage in Rithmomachia:

```tsx
<PanelGroup direction="horizontal">
  <Panel defaultSize={35} minSize={20} maxSize={50}>
    <PlayingGuideModal ... />
  </Panel>
  <PanelResizeHandle />
  <Panel minSize={50}>
    {gameContent}
  </Panel>
</PanelGroup>
```

We'll use a similar pattern but with 3 panels instead of 2!

---

## Ready to Implement?

Using `react-resizable-panels` gives us:

- ✅ **Professional resizable UI** out of the box
- ✅ **Faster implementation** (no custom resize logic)
- ✅ **Better UX** (users can customize their layout)
- ✅ **Already installed** (no new dependencies)

Should I proceed with this approach?
