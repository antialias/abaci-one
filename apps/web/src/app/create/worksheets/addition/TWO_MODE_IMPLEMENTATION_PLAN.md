# Two-Mode System - Implementation Plan

## Overview

This document breaks down the implementation into small, incremental steps that can be tested independently.

**Estimated effort:** 8-12 hours
**Risk:** Medium (touches core config system)
**Strategy:** Implement in phases, test thoroughly at each step

---

## Phase 1: Foundation (2-3 hours)

### Step 1.1: Create Manual Mode Presets File ✅

**File:** `src/app/create/worksheets/addition/manualModePresets.ts`
**Complexity:** Low
**Dependencies:** None

```typescript
export interface ManualModePreset {
  name: string
  label: string
  description: string
  showCarryBoxes: boolean
  showAnswerBoxes: boolean
  showPlaceValueColors: boolean
  showTenFrames: boolean
  showProblemNumbers: boolean
  showCellBorder: boolean
  showTenFramesForAll: boolean
}

export const MANUAL_MODE_PRESETS = { ... }
```

**Test:** Import and verify presets are accessible

###

Step 1.2: Add V3 Schema to config-schemas.ts
**File:** `src/app/create/worksheets/config-schemas.ts`
**Complexity:** Medium
**Dependencies:** None

Add after additionConfigV2Schema (line ~121):

- Define `additionConfigV3SmartSchema`
- Define `additionConfigV3ManualSchema`
- Create `additionConfigV3Schema = z.discriminatedUnion('mode', [smart, manual])`
- Add to union: `additionConfigSchema = z.discriminatedUnion('version', [v1, v2, v3])`

**Test:**

- Import schemas and verify Zod parsing works
- Test discriminated union catches invalid combos

### Step 1.3: Add V2→V3 Migration Function

**File:** `src/app/create/worksheets/config-schemas.ts`
**Complexity:** Medium
**Dependencies:** Step 1.2

Add migration logic:

```typescript
function migrateAdditionV2toV3(v2: AdditionConfigV2): AdditionConfigV3 {
  if (v2.difficultyProfile) {
    // Has preset → Smart mode
    return { version: 3, mode: 'smart', ...v2 }
  } else {
    // No preset → Manual mode
    return {
      version: 3,
      mode: 'manual',
      // Convert displayRules to booleans
      ...
    }
  }
}
```

Update `migrateAdditionConfig()` to handle case 3

**Test:**

- Unit test V2 smart config → V3 smart
- Unit test V2 manual config → V3 manual
- Verify no data loss

---

## Phase 2: Types & Validation (1-2 hours)

### Step 2.1: Update WorksheetConfig Type

**File:** `src/app/create/worksheets/addition/types.ts`
**Complexity:** Low
**Dependencies:** Phase 1

Change `WorksheetConfig` to support V3:

```typescript
export type WorksheetConfig = AdditionConfigV3 & {
  // Derived state
  total: number
  rows: number
  date: string
  seed: number
  page: { wIn: number; hIn: number }
  margins: { ... }
}
```

**Test:** Check that types compile

### Step 2.2: Update Validation Function

**File:** `src/app/create/worksheets/addition/validation.ts`
**Complexity:** Medium
**Dependencies:** Step 2.1

Update `validateWorksheetConfig()`:

- Accept `WorksheetFormState` that can have either mode
- Determine mode from formState
- Branch validation logic based on mode
- Build correct WorksheetConfig with mode

**Test:**

- Validate smart mode config
- Validate manual mode config
- Verify errors caught correctly

---

## Phase 3: Generation Logic (1-2 hours)

### Step 3.1: Update typstGenerator for Mode Awareness

**File:** `src/app/create/worksheets/addition/typstGenerator.ts`
**Complexity:** Medium
**Dependencies:** Phase 2

In `generatePageTypst()`:

```typescript
if (config.mode === "smart") {
  // Per-problem conditional display
  enrichedProblems = pageProblems.map((p) => {
    const meta = analyzeProblem(p.a, p.b);
    const displayOptions = resolveDisplayForProblem(config.displayRules, meta);
    return { ...p, ...displayOptions };
  });
} else {
  // Uniform display
  enrichedProblems = pageProblems.map((p) => ({
    ...p,
    showCarryBoxes: config.showCarryBoxes,
    showAnswerBoxes: config.showAnswerBoxes,
    // ... etc
  }));
}
```

**Test:**

- Generate worksheet in smart mode
- Generate worksheet in manual mode
- Compare outputs visually

---

## Phase 4: UI - Mode Selector (2-3 hours)

### Step 4.1: Create ModeSelector Component

**File:** `src/app/create/worksheets/addition/components/ModeSelector.tsx`
**Complexity:** Medium
**Dependencies:** None (pure UI)

Create component:

```typescript
interface ModeSelectorProps {
  currentMode: "smart" | "manual";
  onChange: (mode: "smart" | "manual") => void;
}

export function ModeSelector({ currentMode, onChange }: ModeSelectorProps) {
  // Radio buttons or segmented control
  // Icons + descriptions
  // Confirmation dialog if switching would lose data
}
```

**Test:**

- Render in Storybook
- Test mode switching
- Test confirmation dialog

### Step 4.2: Add ModeSelector to ConfigPanel

**File:** `src/app/create/worksheets/addition/components/ConfigPanel.tsx`
**Complexity:** Low
**Dependencies:** Step 4.1

Add at top of ConfigPanel (before Difficulty Level section):

```typescript
<ModeSelector
  currentMode={formState.mode ?? 'smart'}
  onChange={handleModeChange}
/>
```

Implement `handleModeChange()`:

- Show confirmation if switching would change settings
- Convert settings to new mode
- Call `onChange()`

**Test:**

- Switch modes and verify UI updates
- Verify confirmation dialog shows

---

## Phase 5: UI - Conditional Sections (2-3 hours)

### Step 5.1: Add Manual Mode Preset Buttons

**File:** `src/app/create/worksheets/addition/components/ConfigPanel.tsx`
**Complexity:** Low
**Dependencies:** Step 1.1

Add new section (shown only in manual mode):

```typescript
{formState.mode === 'manual' && (
  <div>
    <h3>Manual Presets</h3>
    {Object.values(MANUAL_MODE_PRESETS).map(preset => (
      <PresetButton
        key={preset.name}
        preset={preset}
        isSelected={...}
        onClick={() => applyManualPreset(preset)}
      />
    ))}
  </div>
)}
```

**Test:**

- Click preset buttons
- Verify display options update

### Step 5.2: Make Sections Conditional on Mode

**File:** `src/app/create/worksheets/addition/components/ConfigPanel.tsx`
**Complexity:** Low
**Dependencies:** Step 4.2

Wrap sections in conditionals:

```typescript
{/* Smart mode only */}
{formState.mode === 'smart' && (
  <DifficultyLevelSection ... />
)}

{/* Manual mode only - now active */}
{formState.mode === 'manual' && (
  <DisplayOptionsSection ... />
)}

{/* Shared - always visible */}
<RegroupingFrequencySection ... />
```

**Test:**

- Switch modes
- Verify correct sections show/hide

### Step 5.3: Add "Copy to Manual Mode" Button

**File:** `src/app/create/worksheets/addition/components/ConfigPanel.tsx`
**Complexity:** Low
**Dependencies:** Step 5.2

Add button in Smart mode section:

```typescript
{formState.mode === 'smart' && (
  <button onClick={handleCopyToManual}>
    Copy to Manual Mode
  </button>
)}
```

Implement `handleCopyToManual()`:

- Convert current displayRules to booleans
- Switch to manual mode
- Apply converted settings

**Test:**

- Click button from various smart presets
- Verify manual toggles match smart behavior

---

## Phase 6: Settings Persistence (1 hour)

### Step 6.1: Update Database Queries

**File:** Check where settings are saved/loaded
**Complexity:** Low
**Dependencies:** All previous

Update save/load to handle V3 configs:

- Migration happens automatically via `migrateAdditionConfig()`
- Just ensure we're saving complete V3 configs

**Test:**

- Save smart mode config
- Reload page, verify mode preserved
- Save manual mode config
- Reload page, verify mode preserved

---

## Phase 7: Testing & Polish (1-2 hours)

### Step 7.1: Manual Testing Checklist

- [ ] Default new worksheet → Smart mode, Early Learner preset
- [ ] Select Beginner preset → Worksheet generates correctly
- [ ] Click "Make Harder" → Difficulty increases
- [ ] Click "Make Easier" → Difficulty decreases
- [ ] Switch to Manual mode → Display Options appear
- [ ] Toggle display options → Preview updates
- [ ] Select "Assessment Mode" preset → All toggles update
- [ ] Switch back to Smart mode → Difficulty Level returns
- [ ] Click "Copy to Manual Mode" from Intermediate → Manual toggles match
- [ ] Save settings → Reload → Settings preserved
- [ ] Test V1 config migration → Becomes manual mode
- [ ] Test V2 smart config migration → Becomes smart mode
- [ ] Test V2 manual config migration → Becomes manual mode

### Step 7.2: Run Quality Checks

```bash
npm run pre-commit
```

Fix any TypeScript/lint errors

### Step 7.3: Create Commits

One commit per phase:

- Phase 1: "feat(worksheets): add V3 schema with mode discrimination"
- Phase 2: "feat(worksheets): update validation for two-mode system"
- Phase 3: "feat(worksheets): add mode-aware worksheet generation"
- Phase 4: "feat(worksheets): add mode selector UI"
- Phase 5: "feat(worksheets): add manual mode presets and conditional sections"
- Phase 6: "feat(worksheets): update settings persistence for V3"
- Phase 7: "docs(worksheets): update documentation for two-mode system"

---

## Rollback Plan

If issues are discovered:

1. **Revert last commit** if problem in latest phase
2. **Feature flag** - Add `ENABLE_TWO_MODE_SYSTEM` env var to hide new UI
3. **Migration fallback** - Ensure V1/V2 configs still work even if V3 has issues
4. **Database rollback** - User settings can be migrated back to V2 if needed

---

## Post-Launch Tasks

- [ ] Monitor usage metrics (smart vs manual mode adoption)
- [ ] Gather teacher feedback on mode clarity
- [ ] Consider adding mode-specific help documentation
- [ ] A/B test default mode for new users
- [ ] Consider adding "Hybrid" mode if requested

---

## Success Metrics

- [ ] All existing V1/V2 configs migrate cleanly
- [ ] No data loss during migration
- [ ] Both modes generate correct worksheets
- [ ] Mode switching works smoothly
- [ ] Settings persist correctly
- [ ] No regression in smart difficulty system
- [ ] Manual mode provides clear value for teachers

---

## Risk Mitigation

**Risk:** Breaking existing worksheets
**Mitigation:** Comprehensive migration tests, feature flag

**Risk:** Confusing UI for teachers
**Mitigation:** Clear labels, confirmation dialogs, tooltips

**Risk:** Settings conflicts between modes
**Mitigation:** Discriminated union prevents invalid states

**Risk:** Performance regression
**Mitigation:** Mode check is O(1), no perf impact expected
