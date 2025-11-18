# Operator-Specific Settings Architecture

**Status:** ⚠️ Current Implementation (Needs Refactoring)
**Complexity Level:** High - Easy to overlook when making changes
**Urgency:** High - More operators coming soon (multiplication, division, fractions, etc.)

## Overview

Mixed mastery mode uses **operator-specific settings** that override global settings. This hidden complexity has caused bugs and will become increasingly problematic as we add more operators.

**Current operators:**
- Addition
- Subtraction

**Planned operators:**
- Multiplication
- Division
- Fractions
- Decimals
- Mixed operations

## The Problem

### Current Architecture

When `mode === 'mastery' && operator === 'mixed'`, the system uses operator-specific overrides:

```typescript
// Global settings (apply to single-operator mode)
displayRules: DisplayRules

// Operator-specific overrides (mastery+mixed mode only)
additionDisplayRules?: DisplayRules
subtractionDisplayRules?: DisplayRules
```

**Settings that are operator-specific in mixed mode:**
1. **Display Rules** - Scaffolding (answer boxes, carry boxes, ten frames, etc.)
2. **Digit Range** - Number of digits per operator
3. **Regrouping Config** - pAnyStart, pAllStart, interpolate
4. **Current Skill** - Tracks progress separately per operator

### Why This Is Problematic

1. **Hidden Complexity**
   - Not obvious from config schema which fields have operator-specific variants
   - Easy to forget when updating UI components
   - No clear pattern for when to use global vs operator-specific

2. **Code Duplication**
   - Every UI component that modifies settings needs conditional logic
   - Example: ScaffoldingTab must check `mode === 'mastery' && operator === 'mixed'`
   - Same logic repeated across multiple components

3. **Bug Prone**
   - Recent bug: Scaffolding changes ignored in mixed mode (fixed in commit 40389f39)
   - Root cause: ScaffoldingTab only updated global `displayRules`, not operator-specific
   - Will happen again with new operators unless we refactor

4. **Scaling Problem**
   - Currently 2 operators → 2 optional override fields
   - With 6 operators → 6 optional override fields per setting
   - Exponential complexity as operators grow

### Concrete Example: The Bug We Just Fixed

**User Action:** In mastery+mixed mode, change answer boxes from "always" → "never"

**Expected:** Both addition AND subtraction problems hide answer boxes

**What Happened:**
1. ScaffoldingTab updated `displayRules` (global)
2. Typst generator checked for operator-specific rules first:
   ```typescript
   if (p.operator === 'add' && config.additionDisplayRules) {
     rulesForProblem = config.additionDisplayRules // ← Still has old value!
   }
   ```
3. User's change ignored because old operator-specific rules took precedence

**Fix Required:**
```typescript
// In ScaffoldingTab - must update ALL three fields
if (isMasteryMixed) {
  onChange({
    displayRules: newRules,           // Global
    additionDisplayRules: newRules,   // Operator-specific
    subtractionDisplayRules: newRules // Operator-specific
  })
}
```

## Current Implementation Details

### Config Schema

```typescript
// V4 Mastery Mode Schema
export const additionConfigV4MasteryModeSchema = z.object({
  mode: z.literal('mastery'),

  // Global display rules
  displayRules: displayRulesSchema,

  // Operator-specific overrides (mixed mode only)
  additionDisplayRules: displayRulesSchema.optional(),
  subtractionDisplayRules: displayRulesSchema.optional(),

  // Skill tracking (always operator-specific in mastery)
  currentAdditionSkillId: z.string().optional(),
  currentSubtractionSkillId: z.string().optional(),
})
```

### Components That Need Special Handling

1. **ScaffoldingTab** ✅ Fixed (commit 40389f39)
   - Updates all operator-specific display rules when in mixed mode

2. **ContentTab** ⚠️ Needs Review
   - Controls operator selection and digit range
   - May need operator-specific digit range handling

3. **DifficultyTab** ⚠️ Needs Review
   - Controls regrouping probabilities
   - May need operator-specific regrouping config

4. **MasteryModePanel** ✅ Already correct
   - Manages skill selection per operator
   - Already operator-aware

### Code Locations

**Schema Definition:**
- `src/app/create/worksheets/config-schemas.ts` (lines 536-650)

**Typst Generation:**
- `src/app/create/worksheets/typstGenerator.ts` (lines 69-80)
- Checks for operator-specific display rules

**Problem Generation:**
- `src/app/create/worksheets/generatePreview.ts` (lines 89-150)
- Uses skill-specific configs for mixed mode

**UI Components:**
- `src/app/create/worksheets/components/config-sidebar/ScaffoldingTab.tsx`
- `src/app/create/worksheets/components/config-sidebar/ContentTab.tsx`
- `src/app/create/worksheets/components/config-sidebar/DifficultyTab.tsx`

## Refactoring Plan

### Phase 1: Documentation & Audit (Immediate)

**Goals:**
- Document current behavior (this file)
- Audit all components for operator-specific handling
- Create test cases for mixed mode settings

**Tasks:**
- [x] Document architecture in this file
- [ ] Audit ContentTab for operator-specific handling
- [ ] Audit DifficultyTab for operator-specific handling
- [ ] Add integration tests for mixed mode settings
- [ ] Link this doc from main README

### Phase 2: Unified Config Model (Before Adding New Operators)

**Goals:**
- Replace optional operator-specific fields with structured model
- Make operator-specificity explicit in schema
- Single source of truth for which settings are operator-specific

**Proposed Schema:**

```typescript
// BEFORE (Current - Implicit)
interface MasteryConfig {
  displayRules: DisplayRules
  additionDisplayRules?: DisplayRules  // Hidden override
  subtractionDisplayRules?: DisplayRules  // Hidden override
}

// AFTER (Proposed - Explicit)
interface MasteryConfig {
  operatorMode: 'single' | 'mixed'

  // Single operator mode
  singleOperatorSettings?: {
    operator: 'addition' | 'subtraction'
    displayRules: DisplayRules
    digitRange: DigitRange
    regroupingConfig: RegroupingConfig
  }

  // Mixed operator mode
  mixedOperatorSettings?: {
    operators: {
      addition: OperatorSettings
      subtraction: OperatorSettings
      multiplication?: OperatorSettings  // Future
      division?: OperatorSettings        // Future
    }
  }
}

interface OperatorSettings {
  enabled: boolean
  displayRules: DisplayRules
  digitRange: DigitRange
  regroupingConfig: RegroupingConfig
  currentSkillId?: string
}
```

**Benefits:**
- Clear separation between single and mixed modes
- Easy to add new operators (just add to `operators` object)
- No hidden overrides - structure makes it obvious
- Type-safe access to operator-specific settings

**Migration Strategy:**
1. Add new schema alongside old (dual-write)
2. Update components to read from new schema
3. Add migration from V4 → V5
4. Deprecate old operator-specific fields

### Phase 3: UI Clarity (With Phase 2)

**Goals:**
- Make it visually obvious when settings are operator-specific
- Show which operator settings apply to
- Allow easy bulk updates ("Apply to All Operators")

**Proposed UI Changes:**

1. **Scaffolding Tab - Mixed Mode View:**
   ```
   ┌─ Scaffolding ─────────────────┐
   │ Mode: Mixed (Addition + Sub)  │
   │                               │
   │ ┌─ Addition Settings ────┐   │
   │ │ Answer Boxes: Always   │   │
   │ │ Carry Boxes: Never     │   │
   │ └────────────────────────┘   │
   │                               │
   │ ┌─ Subtraction Settings ─┐   │
   │ │ Answer Boxes: Never    │   │
   │ │ Borrow Notation: Always│   │
   │ └────────────────────────┘   │
   │                               │
   │ [Apply Same to All Ops] [↓]  │
   └───────────────────────────────┘
   ```

2. **Visual Indicators:**
   - Operator icon badges (➕ ➖ ✖️ ➗) next to settings
   - Different background colors per operator
   - Clear "Mixed Mode" banner at top

3. **Bulk Actions:**
   - "Apply to All Operators" button
   - "Copy from Addition to Subtraction" action
   - "Reset to Skill Defaults" per operator

### Phase 4: Validation & Testing (Ongoing)

**Test Coverage:**

1. **Unit Tests**
   ```typescript
   describe('Mixed Mode Settings', () => {
     it('updates all operator-specific rules when scaffolding changes', () => {
       // Test that ScaffoldingTab updates addition AND subtraction rules
     })

     it('preserves operator-specific rules during migrations', () => {
       // Test V4→V5 migration keeps operator settings
     })
   })
   ```

2. **Integration Tests**
   ```typescript
   describe('Mixed Mode Preview', () => {
     it('uses correct display rules per operator in preview', () => {
       // Set different rules for addition vs subtraction
       // Verify preview shows correct scaffolding per problem type
     })
   })
   ```

3. **E2E Tests**
   ```typescript
   describe('Mixed Mode User Flow', () => {
     it('allows independent scaffolding per operator', () => {
       // User sets addition with answer boxes, subtraction without
       // Download PDF and verify both operators rendered correctly
     })
   })
   ```

## Adding New Operators

### Current Process (Before Refactoring)

⚠️ **High Risk of Bugs** - Easy to miss steps

1. Add operator to schema enum
2. Add `{operator}DisplayRules?: DisplayRules` field
3. Update every component that modifies display rules:
   - ScaffoldingTab ✅
   - ContentTab ⚠️
   - DifficultyTab ⚠️
   - Any other settings tabs
4. Update Typst generator to check for operator-specific rules
5. Update problem generator to handle new operator
6. Update migrations to preserve new operator fields
7. Add tests for new operator

**Miss any step → Settings silently ignored (like our recent bug)**

### Future Process (After Refactoring)

✅ **Type-Safe & Explicit**

1. Add operator to `OperatorType` enum:
   ```typescript
   type OperatorType = 'addition' | 'subtraction' | 'multiplication'
   ```

2. Schema automatically supports it:
   ```typescript
   mixedOperatorSettings: {
     operators: {
       multiplication: OperatorSettings  // Just add this
     }
   }
   ```

3. UI components automatically show new operator (data-driven)
4. Type system enforces all operator-specific settings are handled
5. Tests automatically cover new operator via parameterized tests

## Migration Checklist

Before adding any new operator, complete these refactoring phases:

- [ ] Phase 1: Documentation & Audit
  - [ ] Document current architecture (this file)
  - [ ] Audit all components
  - [ ] Add integration tests
  - [ ] Link from main README

- [ ] Phase 2: Unified Config Model
  - [ ] Design new schema structure
  - [ ] Implement V4→V5 migration
  - [ ] Update components to use new schema
  - [ ] Deprecate old operator-specific fields

- [ ] Phase 3: UI Clarity
  - [ ] Design mixed mode UI mockups
  - [ ] Implement operator-specific views
  - [ ] Add bulk action buttons
  - [ ] User testing for clarity

- [ ] Phase 4: Validation & Testing
  - [ ] Unit tests for settings updates
  - [ ] Integration tests for mixed mode
  - [ ] E2E tests for user flows
  - [ ] Performance testing with 6+ operators

## Related Documentation

- [Config Schema Guide](./CONFIG_SCHEMA_GUIDE.md) - Full config schema documentation
- [Mastery System Plan](./MASTERY_SYSTEM_PLAN.md) - Overall mastery system architecture
- [Problem Generation Architecture](./PROBLEM_GENERATION_ARCHITECTURE.md) - How problems are generated
- [Subtraction and Operator Plan](./SUBTRACTION_AND_OPERATOR_PLAN.md) - Original operator support plan

## Recent Changes

- **2025-01-17**: Fixed scaffolding settings ignored in mastery+mixed mode (commit 40389f39)
- **2025-01-17**: Created this documentation to prevent future bugs
