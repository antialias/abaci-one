# ConfigPanel.tsx Refactoring Plan

**Status**: Ready to begin
**Safe restore point**: `ab3e5a20` - commit before refactoring starts

## Current State Analysis

**File**: `src/app/create/worksheets/addition/components/ConfigPanel.tsx`
**Total lines**: 2550
**Exports**: 1 main component (`ConfigPanel`) + 3 helper components

### Structure Breakdown

#### Helper Components/Functions (Lines 1-284)
1. **`getScaffoldingSummary()`** (lines 44-99) - Generates human-readable scaffolding summary
2. **`SubOption`** component (lines 112-175) - Reusable nested toggle component
3. **`ToggleOption`** component (lines 185-283) - Reusable toggle option with description

#### Main Component (Lines 285-2550)
**`ConfigPanel`** - Massive 2265-line component with:
- Local state management (lines 287-294)
- Helper functions (lines 296-445)
- Main render with 6 sections:
  1. **Student Name** (lines 450-471)
  2. **Digit Range** section (lines 474-641) - Shared
  3. **Operator Selection** section (lines 643-760) - Shared
  4. **Progressive Difficulty** toggle (lines 766-837) - Shared
  5. **Smart Mode sections** (lines 840-2222):
     - Difficulty controls with preset buttons
     - 2D visualization plot
     - Scaffolding/regrouping sliders
  6. **Manual Mode sections** (lines 2225-2548):
     - Display options toggles
     - Regrouping frequency sliders

### Key Observations

1. **Mode-based conditional rendering**: Smart mode (lines 840-2222) vs Manual mode (lines 2225-2548)
2. **Shared sections**: Student name, digit range, operator selection, progressive difficulty toggle
3. **Complex state management**: Lots of derived state calculations and mode-specific logic
4. **Heavy dependencies**: Uses many difficulty profile functions and constants
5. **Visualization code**: 2D difficulty plot only in smart mode (lines ~1000-2000)

## Proposed Refactoring

### Goals
1. Break monolithic component into focused, testable modules
2. Improve maintainability and readability
3. Preserve all functionality
4. Enable easier future additions

### Extraction Strategy

#### Phase 1: Extract Helper Components to Separate Files

**File**: `src/app/create/worksheets/addition/components/config-panel/ToggleOption.tsx`
- Extract `ToggleOption` component (lines 185-283)
- Extract related types (`ToggleOptionProps`)

**File**: `src/app/create/worksheets/addition/components/config-panel/SubOption.tsx`
- Extract `SubOption` component (lines 112-175)
- Extract related types (`SubOptionProps`)

**File**: `src/app/create/worksheets/addition/components/config-panel/utils.ts`
- Extract `getScaffoldingSummary()` function (lines 44-99)
- Extract other pure helper functions

#### Phase 2: Extract Shared Sections

**File**: `src/app/create/worksheets/addition/components/config-panel/StudentNameInput.tsx`
- Lines 450-471
- Simple controlled input component

**File**: `src/app/create/worksheets/addition/components/config-panel/DigitRangeSection.tsx`
- Lines 474-641
- Digit range min/max selection UI
- Props: `digitRange`, `onChange`

**File**: `src/app/create/worksheets/addition/components/config-panel/OperatorSection.tsx`
- Lines 643-760
- Operator selection (addition/subtraction/mixed)
- Props: `operator`, `onChange`

**File**: `src/app/create/worksheets/addition/components/config-panel/ProgressiveDifficultyToggle.tsx`
- Lines 766-837
- Simple toggle for interpolate setting
- Props: `interpolate`, `onChange`

#### Phase 3: Extract Smart Mode Section

**File**: `src/app/create/worksheets/addition/components/config-panel/SmartModeControls.tsx`
- Lines 840-2222 (~1382 lines)
- All smart mode difficulty controls
- This is still large and should be further broken down:

**Sub-components**:
1. **`DifficultyPresetButtons.tsx`** - Preset difficulty buttons (beginner, early learner, etc.)
2. **`DifficultyVisualization.tsx`** - 2D difficulty plot with hover interactions
3. **`RegroupingSlider.tsx`** - Regrouping frequency slider with level indicator
4. **`ScaffoldingSlider.tsx`** - Scaffolding level slider with summary tooltip

Props for `SmartModeControls`:
```typescript
interface SmartModeControlsProps {
  formState: WorksheetFormState
  onChange: (updates: Partial<WorksheetFormState>) => void
}
```

#### Phase 4: Extract Manual Mode Section

**File**: `src/app/create/worksheets/addition/components/config-panel/ManualModeControls.tsx`
- Lines 2225-2548 (~323 lines)
- All manual mode display and regrouping controls
- Further breakdown:

**Sub-components**:
1. **`DisplayOptionsSection.tsx`** - All display option toggles (lines 2228-2417)
2. **`RegroupingFrequencySection.tsx`** - Manual regrouping sliders (lines 2420-2548)

Props for `ManualModeControls`:
```typescript
interface ManualModeControlsProps {
  formState: WorksheetFormState
  onChange: (updates: Partial<WorksheetFormState>) => void
}
```

#### Phase 5: Simplified Main ConfigPanel

**File**: `src/app/create/worksheets/addition/components/ConfigPanel.tsx` (refactored)
- Orchestrates all sub-components
- Minimal local state (only UI state like `showDebugPlot`, `hoverPoint`)
- Clean conditional rendering for mode-specific sections

**Approximate structure** (~150 lines):
```typescript
export function ConfigPanel({ formState, onChange }: ConfigPanelProps) {
  const [showDebugPlot, setShowDebugPlot] = useState(false)
  const [hoverPoint, setHoverPoint] = useState<{ x: number; y: number } | null>(null)
  const [hoverPreview, setHoverPreview] = useState<...>(null)

  // Mode change handler
  const handleModeChange = (newMode: 'smart' | 'manual') => { ... }

  return (
    <div data-component="config-panel" className={stack({ gap: '3' })}>
      <StudentNameInput value={formState.name} onChange={(name) => onChange({ name })} />

      <DigitRangeSection
        digitRange={formState.digitRange}
        onChange={(digitRange) => onChange({ digitRange })}
      />

      <OperatorSection
        operator={formState.operator}
        onChange={(operator) => onChange({ operator })}
      />

      <ModeSelector currentMode={formState.mode ?? 'smart'} onChange={handleModeChange} />

      <ProgressiveDifficultyToggle
        interpolate={formState.interpolate}
        onChange={(interpolate) => onChange({ interpolate })}
      />

      {(!formState.mode || formState.mode === 'smart') && (
        <SmartModeControls formState={formState} onChange={onChange} />
      )}

      {formState.mode === 'manual' && (
        <ManualModeControls formState={formState} onChange={onChange} />
      )}
    </div>
  )
}
```

## File Structure After Refactoring

```
src/app/create/worksheets/addition/components/
├── ConfigPanel.tsx                      (~150 lines - orchestrator)
├── ModeSelector.tsx                     (existing, already extracted)
├── DisplayOptionsPreview.tsx            (existing, already extracted)
└── config-panel/
    ├── utils.ts                         (pure helper functions)
    ├── ToggleOption.tsx                 (reusable toggle UI)
    ├── SubOption.tsx                    (reusable nested toggle UI)
    ├── StudentNameInput.tsx             (simple input)
    ├── DigitRangeSection.tsx            (~170 lines)
    ├── OperatorSection.tsx              (~120 lines)
    ├── ProgressiveDifficultyToggle.tsx  (~70 lines)
    ├── SmartModeControls.tsx            (~300 lines - orchestrator)
    │   ├── DifficultyPresetButtons.tsx  (~150 lines)
    │   ├── DifficultyVisualization.tsx  (~600 lines)
    │   ├── RegroupingSlider.tsx         (~300 lines)
    │   └── ScaffoldingSlider.tsx        (~300 lines)
    └── ManualModeControls.tsx           (~150 lines - orchestrator)
        ├── DisplayOptionsSection.tsx    (~200 lines)
        └── RegroupingFrequencySection.tsx (~130 lines)
```

## Benefits

1. **Testability**: Each component can be tested in isolation
2. **Readability**: Files are 70-600 lines instead of 2550
3. **Maintainability**: Changes to smart mode don't risk breaking manual mode
4. **Reusability**: Toggle components, sliders can be used elsewhere
5. **Performance**: Potential for React.memo optimization on stable sections
6. **Collaboration**: Multiple developers can work on different sections

## Migration Strategy

**Approach**: Incremental extraction with zero functionality change

1. **Create directory structure** - `config-panel/` subdirectory
2. **Extract helpers first** - utils.ts, ToggleOption, SubOption (low risk)
3. **Extract shared sections** - Student name, digit range, operator, progressive difficulty
4. **Test thoroughly** - Verify UI works identically
5. **Extract mode-specific sections** - Smart mode, then manual mode
6. **Final cleanup** - Simplified main ConfigPanel.tsx
7. **Run pre-commit checks** - Ensure types, format, lint all pass

## Risks and Mitigations

**Risk**: Breaking existing functionality during refactor
- **Mitigation**: Extract one component at a time, test after each step

**Risk**: Props drilling becomes excessive
- **Mitigation**: Keep `formState` and `onChange` at parent level, pass only what's needed

**Risk**: Import path updates needed elsewhere
- **Mitigation**: Main `ConfigPanel` export stays in same location, no external breakage

**Risk**: TypeScript errors from circular dependencies
- **Mitigation**: Keep types in separate files, import only what's needed

## Estimated Effort

- **Phase 1** (Helpers): ~30 minutes
- **Phase 2** (Shared sections): ~1 hour
- **Phase 3** (Smart mode): ~2 hours
- **Phase 4** (Manual mode): ~1 hour
- **Phase 5** (Main refactor): ~30 minutes
- **Testing & refinement**: ~1 hour

**Total**: ~6 hours

## Execution Checklist

### Phase 1: Extract Helper Components ✅ NOT STARTED
- [ ] Create `config-panel/` directory
- [ ] Extract `utils.ts` with `getScaffoldingSummary()`
- [ ] Extract `ToggleOption.tsx`
- [ ] Extract `SubOption.tsx`
- [ ] Update imports in ConfigPanel.tsx
- [ ] Run `npm run pre-commit`
- [ ] Manual test: Verify UI unchanged
- [ ] Commit: "refactor(worksheets): extract ConfigPanel helper components"

### Phase 2: Extract Shared Sections ✅ NOT STARTED
- [ ] Extract `StudentNameInput.tsx`
- [ ] Extract `DigitRangeSection.tsx`
- [ ] Extract `OperatorSection.tsx`
- [ ] Extract `ProgressiveDifficultyToggle.tsx`
- [ ] Update ConfigPanel.tsx to use new components
- [ ] Run `npm run pre-commit`
- [ ] Manual test: Verify all sections work
- [ ] Commit: "refactor(worksheets): extract ConfigPanel shared sections"

### Phase 3: Extract Smart Mode Section ✅ NOT STARTED
- [ ] Extract `SmartModeControls.tsx` (initial, large file)
- [ ] Test smart mode works
- [ ] Extract `DifficultyPresetButtons.tsx`
- [ ] Extract `DifficultyVisualization.tsx`
- [ ] Extract `RegroupingSlider.tsx`
- [ ] Extract `ScaffoldingSlider.tsx`
- [ ] Update SmartModeControls to use sub-components
- [ ] Run `npm run pre-commit`
- [ ] Manual test: Verify smart mode fully functional
- [ ] Commit: "refactor(worksheets): extract smart mode controls"

### Phase 4: Extract Manual Mode Section ✅ NOT STARTED
- [ ] Extract `ManualModeControls.tsx` (orchestrator)
- [ ] Extract `DisplayOptionsSection.tsx`
- [ ] Extract `RegroupingFrequencySection.tsx`
- [ ] Update ManualModeControls to use sub-components
- [ ] Run `npm run pre-commit`
- [ ] Manual test: Verify manual mode fully functional
- [ ] Commit: "refactor(worksheets): extract manual mode controls"

### Phase 5: Finalize Main ConfigPanel ✅ NOT STARTED
- [ ] Simplify main ConfigPanel.tsx to orchestrator
- [ ] Remove all extracted code
- [ ] Verify clean, minimal component (~150 lines)
- [ ] Run `npm run pre-commit`
- [ ] Manual test: Full smoke test of both modes
- [ ] Commit: "refactor(worksheets): finalize ConfigPanel refactoring"

## Notes

- User has manually tested the worksheet system works before refactoring
- All subtraction scaffolding integration is complete and committed
- Safe restore point: `git reset --hard ab3e5a20`
