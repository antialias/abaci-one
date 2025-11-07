# Two-Mode Worksheet System Design

## Overview

Split the worksheet generator into two distinct modes:

1. **Smart Difficulty Mode** (Current V2 system)
   - Uses 2D difficulty space (regrouping × scaffolding)
   - Conditional display rules (`whenRegrouping`, `whenMultipleRegroups`, etc.)
   - Per-problem intelligent scaffolding
   - Pedagogically-constrained navigation
   - **Target users**: Teachers using research-backed progressive difficulty

2. **Manual Control Mode** (Enhanced V1 system)
   - Direct boolean toggles for all display options
   - Uniform display across all problems
   - Simple always/never choices
   - Full teacher control without pedagogical constraints
   - **Target users**: Teachers who want complete control or have specific requirements

---

## Architecture

### 1. Data Model (V3 Schema)

```typescript
// New V3 schema adds a mode discriminator
export const additionConfigV3Schema = z.discriminatedUnion('mode', [
  // Smart Difficulty Mode
  z.object({
    version: z.literal(3),
    mode: z.literal('smart'),

    // Core worksheet settings (shared)
    problemsPerPage: z.number().int().min(1).max(100),
    cols: z.number().int().min(1).max(10),
    pages: z.number().int().min(1).max(20),
    orientation: z.enum(['portrait', 'landscape']),
    name: z.string(),
    fontSize: z.number().int().min(8).max(32),

    // Regrouping probabilities
    pAnyStart: z.number().min(0).max(1),
    pAllStart: z.number().min(0).max(1),
    interpolate: z.boolean(),

    // Smart mode: Conditional display rules
    displayRules: z.object({
      carryBoxes: z.enum(['always', 'never', 'whenRegrouping', 'whenMultipleRegroups', 'when3PlusDigits']),
      answerBoxes: z.enum(['always', 'never', 'whenRegrouping', 'whenMultipleRegroups', 'when3PlusDigits']),
      placeValueColors: z.enum(['always', 'never', 'whenRegrouping', 'whenMultipleRegroups', 'when3PlusDigits']),
      tenFrames: z.enum(['always', 'never', 'whenRegrouping', 'whenMultipleRegroups', 'when3PlusDigits']),
      problemNumbers: z.enum(['always', 'never', 'whenRegrouping', 'whenMultipleRegroups', 'when3PlusDigits']),
      cellBorders: z.enum(['always', 'never', 'whenRegrouping', 'whenMultipleRegroups', 'when3PlusDigits']),
    }),

    // Optional: Which preset is selected (or undefined for custom)
    difficultyProfile?: z.string(),

    // Manual mode fields must be undefined
    showCarryBoxes: z.undefined(),
    showAnswerBoxes: z.undefined(),
    showPlaceValueColors: z.undefined(),
    showTenFrames: z.undefined(),
    showProblemNumbers: z.undefined(),
    showCellBorder: z.undefined(),
  }),

  // Manual Control Mode
  z.object({
    version: z.literal(3),
    mode: z.literal('manual'),

    // Core worksheet settings (shared)
    problemsPerPage: z.number().int().min(1).max(100),
    cols: z.number().int().min(1).max(10),
    pages: z.number().int().min(1).max(20),
    orientation: z.enum(['portrait', 'landscape']),
    name: z.string(),
    fontSize: z.number().int().min(8).max(32),

    // Regrouping probabilities
    pAnyStart: z.number().min(0).max(1),
    pAllStart: z.number().min(0).max(1),
    interpolate: z.boolean(),

    // Manual mode: Simple boolean toggles
    showCarryBoxes: z.boolean(),
    showAnswerBoxes: z.boolean(),
    showPlaceValueColors: z.boolean(),
    showTenFrames: z.boolean(),
    showProblemNumbers: z.boolean(),
    showCellBorder: z.boolean(),
    showTenFramesForAll: z.boolean(),

    // Smart mode fields must be undefined
    displayRules: z.undefined(),
    difficultyProfile: z.undefined(),
  }),
])
```

---

### 2. Migration Strategy

```typescript
// V2 → V3 Migration
function migrateAdditionV2toV3(v2: AdditionConfigV2): AdditionConfigV3 {
  // If user has a difficultyProfile set, they're using smart mode
  if (v2.difficultyProfile) {
    return {
      version: 3,
      mode: 'smart',
      ...v2,
      // Ensure manual fields are undefined
      showCarryBoxes: undefined,
      showAnswerBoxes: undefined,
      showPlaceValueColors: undefined,
      showTenFrames: undefined,
      showProblemNumbers: undefined,
      showCellBorder: undefined,
    }
  }

  // Otherwise, migrate to manual mode
  // Convert displayRules to boolean flags
  return {
    version: 3,
    mode: 'manual',
    problemsPerPage: v2.problemsPerPage,
    cols: v2.cols,
    pages: v2.pages,
    orientation: v2.orientation,
    name: v2.name,
    fontSize: v2.fontSize,
    pAnyStart: v2.pAnyStart,
    pAllStart: v2.pAllStart,
    interpolate: v2.interpolate,

    // Convert displayRules to booleans
    showCarryBoxes: v2.displayRules.carryBoxes === 'always',
    showAnswerBoxes: v2.displayRules.answerBoxes === 'always',
    showPlaceValueColors: v2.displayRules.placeValueColors === 'always',
    showTenFrames: v2.displayRules.tenFrames === 'always',
    showProblemNumbers: v2.displayRules.problemNumbers === 'always',
    showCellBorder: v2.displayRules.cellBorders === 'always',
    showTenFramesForAll: false, // Not tracked in V2

    // Undefined smart mode fields
    displayRules: undefined,
    difficultyProfile: undefined,
  }
}
```

---

### 3. Worksheet Generation Logic

```typescript
// In typstGenerator.ts
function generatePageTypst(config: WorksheetConfig, pageProblems: AdditionProblem[], ...): string {
  let enrichedProblems: EnrichedProblem[]

  if (config.mode === 'smart') {
    // Smart mode: Per-problem conditional display
    enrichedProblems = pageProblems.map(p => {
      const meta = analyzeProblem(p.a, p.b)
      const displayOptions = resolveDisplayForProblem(config.displayRules, meta)
      return { ...p, ...displayOptions }
    })
  } else {
    // Manual mode: Uniform display across all problems
    enrichedProblems = pageProblems.map(p => ({
      ...p,
      showCarryBoxes: config.showCarryBoxes,
      showAnswerBoxes: config.showAnswerBoxes,
      showPlaceValueColors: config.showPlaceValueColors,
      showTenFrames: config.showTenFrames,
      showProblemNumbers: config.showProblemNumbers,
      showCellBorder: config.showCellBorder,
    }))
  }

  // Rest of generation is the same...
}
```

---

### 4. UI Design

#### Mode Selector (Top of ConfigPanel)

```
┌─────────────────────────────────────────────────────────┐
│  Worksheet Mode                                         │
│  ┌────────────────────┐  ┌────────────────────┐       │
│  │ 🎯 Smart Difficulty│  │ 🎛️ Manual Control  │       │
│  │ Research-backed    │  │ Full control over  │       │
│  │ progressive        │  │ all display        │       │
│  │ difficulty         │  │ options            │       │
│  └────────────────────┘  └────────────────────┘       │
└─────────────────────────────────────────────────────────┘
```

**Implementation:**
- Radio buttons or segmented control
- Changing modes shows confirmation dialog if settings would be lost
- Switching from Smart → Manual: Convert current displayRules to closest boolean equivalent
- Switching from Manual → Smart: Default to "Early Learner" preset

#### Smart Difficulty Mode UI

Shows current UI:
- Difficulty Level section (with preset buttons, 2D graph, make harder/easier)
- Display Options section **HIDDEN** (controlled by difficulty preset)

#### Manual Control Mode UI

- Difficulty Level section **HIDDEN** (no presets in manual mode)
- Display Options section **VISIBLE AND ACTIVE** (direct control)
- Regrouping Frequency section (pAnyStart/pAllStart sliders) - SHARED with Smart mode

#### Alternative: Tabbed Interface

```
┌─────────────────────────────────────────────────────────┐
│  [Smart Difficulty] [Manual Control]                   │
│                                                         │
│  Content specific to selected tab...                   │
└─────────────────────────────────────────────────────────┘
```

---

### 5. Settings Persistence

```typescript
// In database schema
interface WorksheetSettings {
  userId: string
  worksheetType: 'addition' | 'subtraction' // etc

  // Store V3 config with mode
  config: AdditionConfigV3

  // Track which mode user prefers (for new worksheets)
  preferredMode: 'smart' | 'manual'

  updatedAt: Date
}
```

**Behavior:**
- Load user's last config (migrates V1/V2 → V3 automatically)
- Remember which mode they were in
- Default new users to 'smart' mode

---

### 6. User-Facing Copy

#### Smart Difficulty Mode

**Heading:** "Smart Difficulty - Research-Backed Progressive Learning"

**Description:**
> Let the system intelligently adjust scaffolding based on each problem's complexity.
> Scaffolds like carry boxes and ten-frames appear only when needed, gradually
> fading as students build confidence.

**Use when:**
- Following research-backed pedagogical progression
- Working with students at different skill levels
- Want automatic scaffolding that adapts to problem complexity

#### Manual Control Mode

**Heading:** "Manual Control - Full Display Customization"

**Description:**
> Take complete control over which visual aids appear on your worksheets.
> All problems will show the same scaffolding - perfect for targeted practice
> or specific classroom needs.

**Use when:**
- Need consistent display across all problems
- Have specific curriculum requirements
- Want predictable worksheets for assessment

---

### 7. Implementation Checklist

**Phase 1: Data Model**
- [ ] Create V3 schema with discriminated union
- [ ] Write V2→V3 migration function
- [ ] Update `validateWorksheetConfig()` to handle both modes
- [ ] Add mode to TypeScript types
- [ ] Write tests for migration

**Phase 2: Generation Logic**
- [ ] Update `typstGenerator.ts` to check mode
- [ ] Keep `resolveDisplayForProblem()` for smart mode
- [ ] Add uniform display logic for manual mode
- [ ] Ensure both paths produce valid Typst

**Phase 3: UI - Mode Selector**
- [ ] Add mode selector at top of ConfigPanel
- [ ] Implement mode switching logic
- [ ] Add confirmation dialog when switching modes
- [ ] Provide sensible defaults when switching

**Phase 4: UI - Conditional Sections**
- [ ] Hide/show Difficulty Level based on mode
- [ ] Hide/show Display Options based on mode
- [ ] Update Display Options to be read-only in smart mode (or hidden)
- [ ] Ensure Regrouping Frequency is shared

**Phase 5: Settings Persistence**
- [ ] Update database schema to store mode
- [ ] Update save/load logic to preserve mode
- [ ] Add `preferredMode` tracking
- [ ] Test settings persistence

**Phase 6: Polish & Testing**
- [ ] Add tooltips/help text explaining modes
- [ ] Test all migration paths (V1→V3, V2→V3)
- [ ] Test mode switching in both directions
- [ ] Ensure preview updates correctly in both modes
- [ ] Update documentation

---

## Benefits of This Design

### ✅ Preserves Both Systems
- Smart mode keeps the pedagogically-sound 2D difficulty system
- Manual mode preserves simple teacher control

### ✅ Clear Separation of Concerns
- No more conflicts between preset rules and manual overrides
- Each mode has its own dedicated UI
- Impossible to be in an inconsistent state

### ✅ Backward Compatible
- V1 configs → Manual mode (what they're used to)
- V2 configs with presets → Smart mode
- V2 configs without presets → Manual mode

### ✅ Future-Proof
- Easy to add new modes (e.g., "Template Library" mode)
- Clear migration path if we deprecate old versions
- Discriminated union catches type errors at compile time

### ✅ User-Friendly
- Teachers explicitly choose their workflow
- No hidden magic or surprising behavior
- Clear mental model: "Am I using presets or toggles?"

---

## Decisions on Open Questions ✅

1. **Should regrouping frequency (pAnyStart/pAllStart) be shared between modes?**
   - ✅ **YES** - Both modes share regrouping frequency controls
   - In Smart mode: Presets set default values, but user can override
   - In Manual mode: Direct slider control
   - Regrouping Frequency section always visible in both modes

2. **Should Manual mode have presets too?**
   - ✅ **YES** - Add Manual mode presets:
     - "Full Scaffolding" - All aids on
     - "Minimal Scaffolding" - Only problem numbers + cell borders
     - "Assessment Mode" - Only problem numbers (clean for testing)
     - "Ten-Frames Focus" - All aids + ten-frames enabled
   - Makes Manual mode easier to use for teachers

3. **What should the default mode be for new users?**
   - ✅ **Smart mode** - Showcase the research-backed system
   - Can track usage metrics to adjust later

4. **Should we allow converting a Smart preset to Manual for tweaking?**
   - ✅ **YES** - Add "Copy to Manual Mode" button
   - Converts current displayRules to closest boolean equivalents
   - Allows teachers to start with Smart preset then fine-tune

## Manual Mode Presets

Add preset buttons in Manual mode similar to Smart mode presets:

```typescript
export const MANUAL_MODE_PRESETS = {
  fullScaffolding: {
    name: 'fullScaffolding',
    label: 'Full Scaffolding',
    description: 'All visual aids enabled for maximum support',
    showCarryBoxes: true,
    showAnswerBoxes: true,
    showPlaceValueColors: true,
    showTenFrames: false, // Off by default, can enable separately
    showProblemNumbers: true,
    showCellBorder: true,
    showTenFramesForAll: false,
  },

  minimalScaffolding: {
    name: 'minimalScaffolding',
    label: 'Minimal Scaffolding',
    description: 'Basic structure only - for students building independence',
    showCarryBoxes: false,
    showAnswerBoxes: false,
    showPlaceValueColors: false,
    showTenFrames: false,
    showProblemNumbers: true,
    showCellBorder: true,
    showTenFramesForAll: false,
  },

  assessmentMode: {
    name: 'assessmentMode',
    label: 'Assessment Mode',
    description: 'Clean layout for testing - minimal visual aids',
    showCarryBoxes: false,
    showAnswerBoxes: false,
    showPlaceValueColors: false,
    showTenFrames: false,
    showProblemNumbers: true,
    showCellBorder: false,
    showTenFramesForAll: false,
  },

  tenFramesFocus: {
    name: 'tenFramesFocus',
    label: 'Ten-Frames Focus',
    description: 'All aids plus ten-frames for concrete visualization',
    showCarryBoxes: true,
    showAnswerBoxes: true,
    showPlaceValueColors: true,
    showTenFrames: true,
    showProblemNumbers: true,
    showCellBorder: true,
    showTenFramesForAll: false,
  },
} as const
```

---

## Migration Timeline

**Immediate (V3):**
- Implement discriminated union
- Add mode selector
- Keep both systems working

**Future (V4+):**
- Could deprecate one mode if usage data shows clear preference
- Could add "Hybrid" mode that allows manual overrides on smart presets
- Could add template library for common manual configurations

---

## Example User Flows

### Flow 1: New Teacher (Smart Mode)

1. Opens worksheet generator (defaults to Smart mode)
2. Sees "Difficulty Level" section with preset buttons
3. Clicks "Beginner" → Full scaffolding, no regrouping
4. Clicks "Make Harder" a few times → Gradually increases difficulty
5. Generates worksheet
6. Settings auto-saved with `mode: 'smart'`

### Flow 2: Experienced Teacher (Manual Mode)

1. Opens worksheet generator
2. Switches to "Manual Control" mode
3. Sees familiar "Display Options" checkboxes
4. Unchecks "Carry Boxes" and "Answer Boxes"
5. Sets pAnyStart to 0.9 (mostly regrouping problems)
6. Generates worksheet
7. Settings auto-saved with `mode: 'manual'`

### Flow 3: Teacher Switching Modes

1. Currently in Smart mode at "Intermediate" preset
2. Clicks "Manual Control" mode
3. Sees dialog: "Switch to Manual mode? Your Smart Difficulty settings will be converted to fixed display options."
4. Confirms → Current displayRules converted to booleans
5. Now has direct control over all toggles

---

## Success Criteria

- [ ] Teachers can choose between modes without confusion
- [ ] No conflicts between Smart presets and Manual toggles
- [ ] All existing V1/V2 configs migrate cleanly
- [ ] UI clearly shows which mode is active
- [ ] Settings persist correctly across sessions
- [ ] Both modes produce correct worksheets
- [ ] Documentation clearly explains when to use each mode
