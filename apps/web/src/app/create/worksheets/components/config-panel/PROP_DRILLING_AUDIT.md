# Prop Drilling Audit: SmartModeControls

## Executive Summary

**Current State:** SmartModeControls has significant prop drilling, primarily around:

1. `isDark` - Passed to ALL child components (now can use `useTheme()`)
2. `formState` - Passed to components that only need 1-2 fields
3. `onChange` - Passed to components that only update 1-2 fields

**Key Finding:** We can use `WorksheetConfigContext` much more effectively!

---

## Component Tree & Prop Flow

```
SmartModeControls
├── Props: formState, onChange, isDark
│
├─→ DigitRangeSection
│   ├── digitRange: formState.digitRange          ← EXTRACTED (good)
│   ├── onChange: (digitRange) => onChange({...}) ← WRAPPED (good)
│   └── isDark                                     ❌ USE useTheme()
│
├─→ DifficultyPresetDropdown
│   ├── currentProfile                             ← COMPUTED (ok, specific to this component)
│   ├── isCustom                                   ← COMPUTED (ok, specific to this component)
│   ├── nearestEasier                              ← COMPUTED (ok, specific to this component)
│   ├── nearestHarder                              ← COMPUTED (ok, specific to this component)
│   ├── customDescription                          ← COMPUTED (ok, specific to this component)
│   ├── hoverPreview                               ← LOCAL STATE (ok)
│   └── onChange                                   ✅ ALREADY USES CONTEXT
│
├─→ MakeEasierHarderButtons
│   ├── easierResultBoth                           ← COMPUTED (ok, specific to this component)
│   ├── easierResultChallenge                      ← COMPUTED (ok, specific to this component)
│   ├── easierResultSupport                        ← COMPUTED (ok, specific to this component)
│   ├── harderResultBoth                           ← COMPUTED (ok, specific to this component)
│   ├── harderResultChallenge                      ← COMPUTED (ok, specific to this component)
│   ├── harderResultSupport                        ← COMPUTED (ok, specific to this component)
│   ├── canMakeEasierBoth                          ← COMPUTED (ok, specific to this component)
│   ├── canMakeEasierChallenge                     ← COMPUTED (ok, specific to this component)
│   ├── canMakeEasierSupport                       ← COMPUTED (ok, specific to this component)
│   ├── canMakeHarderBoth                          ← COMPUTED (ok, specific to this component)
│   ├── canMakeHarderChallenge                     ← COMPUTED (ok, specific to this component)
│   ├── canMakeHarderSupport                       ← COMPUTED (ok, specific to this component)
│   ├── onEasier: (mode) => handleDifficultyChange ← WRAPPED (ok)
│   └── onHarder: (mode) => handleDifficultyChange ← WRAPPED (ok)
│
├─→ OverallDifficultySlider
│   ├── currentDifficulty                          ← COMPUTED (ok, specific to this component)
│   └── onChange                                   ✅ ALREADY USES CONTEXT
│
└─→ RegroupingFrequencyPanel
    ├── formState                                  ❌ ENTIRE OBJECT (only uses 2 fields!)
    ├── onChange                                   ❌ ENTIRE FUNCTION (could use context)
    └── isDark                                     ❌ USE useTheme()
```

---

## Detailed Analysis

### ✅ Already Using Context Effectively

**DifficultyPresetDropdown, MakeEasierHarderButtons, OverallDifficultySlider:**

- Use `useWorksheetConfig()` for `operator` and `onChange`
- Use `useTheme()` for `isDark`
- Props are component-specific computed values (good!)

### ❌ Problem #1: DigitRangeSection

**Current Props:**

```typescript
interface DigitRangeSectionProps {
  digitRange: { min: number; max: number } | undefined;
  onChange: (digitRange: { min: number; max: number }) => void;
  isDark?: boolean; // ← Should use useTheme()
}
```

**Recommendation:** Remove `isDark` prop, use `useTheme()` inside component

**Impact:**

- ✅ Removes 1 prop
- ✅ Consistent with other refactored components

---

### ❌ Problem #2: RegroupingFrequencyPanel

**Current Props:**

```typescript
interface RegroupingFrequencyPanelProps {
  formState: WorksheetFormState; // ← ENTIRE OBJECT! Only uses 2 fields
  onChange: (updates: Partial<WorksheetFormState>) => void;
  isDark?: boolean; // ← Should use useTheme()
}
```

**What it actually uses from formState:**

- `formState.pAllStart` - for display
- `formState.pAnyStart` - for display
- (Updates via onChange when sliders change)

**Recommendation:** Refactor to use context

**Option A: Use context directly**

```typescript
export function RegroupingFrequencyPanel() {
  const { formState, onChange } = useWorksheetConfig()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  // All data comes from context, no props needed!
}

// Called from SmartModeControls:
<RegroupingFrequencyPanel />
```

**Option B: Extract only needed values (more explicit)**

```typescript
interface RegroupingFrequencyPanelProps {
  pAllStart: number
  pAnyStart: number
  onChangeRegrouping: (updates: { pAllStart?: number; pAnyStart?: number }) => void
}

export function RegroupingFrequencyPanel({
  pAllStart,
  pAnyStart,
  onChangeRegrouping,
}: RegroupingFrequencyPanelProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  // ...
}

// Called from SmartModeControls:
<RegroupingFrequencyPanel
  pAllStart={formState.pAllStart || 0}
  pAnyStart={formState.pAnyStart || 0.25}
  onChangeRegrouping={onChange}
/>
```

**Recommendation: Option A** - Since RegroupingFrequencyPanel is tightly coupled to worksheet config, using context makes sense.

**Impact:**

- ✅ Removes ALL 3 props from RegroupingFrequencyPanel
- ✅ Consistent with WorksheetConfigContext pattern
- ✅ Simpler call site in SmartModeControls

---

### ❌ Problem #3: SmartModeControls still receives isDark

**Current:**

```typescript
export interface SmartModeControlsProps {
  formState: WorksheetFormState;
  onChange: (updates: Partial<WorksheetFormState>) => void;
  isDark?: boolean; // ← Only used for inline styling in SmartModeControls itself
}
```

**Where isDark is used in SmartModeControls:**

- Line 87: Passed to `<DigitRangeSection isDark={isDark} />`
- Line 96: Inline style: `color: isDark ? 'gray.400' : 'gray.500'`
- Line 313: Inline style: `bg: isDark ? 'blue.950' : 'blue.50'`
- Line 315: Inline style: `borderColor: isDark ? 'blue.800' : 'blue.200'`
- Line 699: Passed to `<RegroupingFrequencyPanel isDark={isDark} />`

**Recommendation:** SmartModeControls should use `useTheme()` directly

```typescript
export function SmartModeControls({
  formState,
  onChange,
}: SmartModeControlsProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  // ... rest of component
}
```

**Impact:**

- ✅ Removes `isDark` from SmartModeControls props
- ✅ No longer passed from ConfigPanel
- ✅ Consistent with using global theme context

---

## Summary of Recommendations

### Immediate Wins (Low Effort, High Impact)

1. **DigitRangeSection**: Remove `isDark` prop, use `useTheme()` ✅
2. **RegroupingFrequencyPanel**: Remove all props, use `useWorksheetConfig()` and `useTheme()` ✅✅✅
3. **SmartModeControls**: Remove `isDark` prop, use `useTheme()` internally ✅

### Before vs After

**Before:**

```typescript
// ConfigPanel
<SmartModeControls formState={formState} onChange={onChange} isDark={isDark} />

// SmartModeControls
<DigitRangeSection digitRange={formState.digitRange} onChange={...} isDark={isDark} />
<RegroupingFrequencyPanel formState={formState} onChange={onChange} isDark={isDark} />
```

**After:**

```typescript
// ConfigPanel
<SmartModeControls formState={formState} onChange={onChange} />

// SmartModeControls (uses useTheme() internally)
<DigitRangeSection digitRange={formState.digitRange} onChange={...} />
<RegroupingFrequencyPanel />
```

### Impact Summary

- **Total props removed:** 5 props across 3 components
- **Components simplified:** 3 (DigitRangeSection, RegroupingFrequencyPanel, SmartModeControls)
- **Consistency:** All components now use `useTheme()` for theme access
- **Maintainability:** Theme changes propagate automatically via context

---

## Considerations

### Why NOT use context for computed values?

Components like **DifficultyPresetDropdown** and **MakeEasierHarderButtons** receive many computed props. Should these use context too?

**Answer: NO - Current approach is correct!**

**Reasons:**

1. **Separation of concerns**: Computation logic stays in parent (SmartModeControls)
2. **Component reusability**: These components could be used with different computation logic
3. **Testability**: Easy to test by passing mock props
4. **Clarity**: Props make dependencies explicit

**Rule of thumb:**

- ✅ **Use context for:** Shared state (formState, onChange), theme (isDark), operator
- ❌ **Don't use context for:** Component-specific computed values, callbacks with logic

### Why RegroupingFrequencyPanel CAN use context?

RegroupingFrequencyPanel is tightly coupled to worksheet configuration and:

- Only exists within worksheet config UI
- Directly reads/writes worksheet state
- Has no reusability requirements
- Simplifies the component hierarchy

This is the exact use case for context!

---

## Next Steps

1. ✅ Refactor DigitRangeSection to use `useTheme()`
2. ✅ Refactor RegroupingFrequencyPanel to use both contexts
3. ✅ Refactor SmartModeControls to use `useTheme()` internally
4. ✅ Remove `isDark` from ConfigPanel → SmartModeControls call
5. ✅ Test all changes
6. ✅ Run pre-commit checks

---

## Files to Modify

1. `/src/app/create/worksheets/addition/components/config-panel/DigitRangeSection.tsx`
2. `/src/app/create/worksheets/addition/components/config-panel/RegroupingFrequencyPanel.tsx`
3. `/src/app/create/worksheets/addition/components/config-panel/SmartModeControls.tsx`
4. `/src/app/create/worksheets/addition/components/ConfigPanel.tsx`
