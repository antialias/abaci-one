# Worksheet Config Persistence Architecture

## Overview

This document explains how worksheet configurations are persisted, shared, and restored across the application.

**Key Principle:** We separate **PRIMARY STATE** (what we save) from **DERIVED STATE** (what we calculate).

## Field Categories

### PRIMARY STATE (Persisted)

These fields define the worksheet configuration and MUST be saved:

```typescript
{
  // Structure
  problemsPerPage: number    // How many problems per page (e.g., 20)
  cols: number               // Grid columns (e.g., 4)
  pages: number              // How many pages (e.g., 5)
  orientation: 'portrait' | 'landscape'

  // Problem Space
  digitRange: { min: number, max: number }  // 1-5 digits
  operator: 'addition' | 'subtraction' | 'mixed'

  // Regrouping Distribution
  pAnyStart: number          // Probability of any-column regrouping
  pAllStart: number          // Probability of all-column regrouping
  interpolate: boolean       // Gradual difficulty progression

  // Display Mode (discriminated union)
  mode: 'smart' | 'manual' | 'mastery'

  // Smart Mode Fields
  displayRules?: {           // Conditional per-problem scaffolding
    tenFrames: 'never' | 'sometimes' | 'always'
    carryBoxes: 'never' | 'sometimes' | 'always'
    placeValueColors: 'never' | 'sometimes' | 'always'
    answerBoxes: 'never' | 'sometimes' | 'always'
    problemNumbers: 'never' | 'sometimes' | 'always'
    cellBorders: 'never' | 'sometimes' | 'always'
    borrowNotation: 'never' | 'sometimes' | 'always'
    borrowingHints: 'never' | 'sometimes' | 'always'
  }
  difficultyProfile?: string // Smart mode preset (e.g., 'earlyLearner')

  // Manual Mode Fields
  showCarryBoxes?: boolean
  showAnswerBoxes?: boolean
  showPlaceValueColors?: boolean
  showProblemNumbers?: boolean
  showCellBorder?: boolean
  showTenFrames?: boolean
  showTenFramesForAll?: boolean
  showBorrowNotation?: boolean
  showBorrowingHints?: boolean
  manualPreset?: string      // Manual mode preset

  // Mastery Mode Fields
  currentStepId?: string
  currentAdditionSkillId?: string
  currentSubtractionSkillId?: string

  // Personalization
  name: string               // Student name
  fontSize: number           // Font size in points

  // Reproducibility (CRITICAL for sharing!)
  seed: number               // Random seed
  prngAlgorithm: string      // PRNG algorithm (e.g., 'mulberry32')
}
```

### DERIVED STATE (Calculated)

These fields are calculated from primary state and should NOT be saved:

```typescript
{
  total: number   // = problemsPerPage × pages
  rows: number    // = Math.ceil(problemsPerPage / cols)
}
```

**Why exclude these?**
- They're redundant (can be recalculated)
- Including them creates risk of inconsistency (e.g., `total: 20` but `pages: 100`)
- Primary state is the source of truth

### EPHEMERAL STATE (Not Persisted)

These fields are generated fresh at runtime and should NOT be saved:

```typescript
{
  date: string    // Current date (e.g., "January 15, 2025")
}
```

**Why exclude?**
- Date should reflect when the worksheet is actually generated/printed
- User may generate worksheet days/weeks after creating the config

## Architecture: Blacklist Approach

### File: `src/app/create/worksheets/utils/extractConfigFields.ts`

```typescript
export function extractConfigFields(formState: WorksheetFormState) {
  // Blacklist approach: Exclude only derived/ephemeral fields
  const { rows, total, date, ...persistedFields } = formState

  return {
    ...persistedFields,
    prngAlgorithm: persistedFields.prngAlgorithm ?? 'mulberry32',
  }
}
```

### Why Blacklist Instead of Whitelist?

**Old Approach (FRAGILE):**
```typescript
// Manually list every field - easy to forget new fields!
return {
  problemsPerPage: formState.problemsPerPage,
  cols: formState.cols,
  pages: formState.pages,
  // ... 30+ fields ...
  // Oops, forgot to add the new field! Shared worksheets break!
}
```

**New Approach (ROBUST):**
```typescript
// Automatically include everything except derived fields
const { rows, total, date, ...persistedFields } = formState
return persistedFields
```

**Benefits:**
- ✅ New config fields automatically work in shared worksheets
- ✅ Only need to update if adding new DERIVED fields (rare)
- ✅ Much harder to accidentally break sharing
- ✅ Less maintenance burden

## Persistence Locations

### 1. localStorage (Auto-Save)

**Hook:** `src/hooks/useWorksheetAutoSave.ts`

```typescript
const config = extractConfigFields(formState)
localStorage.setItem('worksheet-addition-config', JSON.stringify(config))
```

**Purpose:** Restore user's work when they return to the page

**Restoration:**
```typescript
const saved = localStorage.getItem('worksheet-addition-config')
const config = saved ? JSON.parse(saved) : defaultConfig
```

### 2. Database (Share Links)

**API Route:** `POST /api/worksheets/share`

```typescript
const config = extractConfigFields(formState)
await db.insert(worksheetShares).values({
  id: shareId,
  worksheetType: 'addition',
  config: JSON.stringify(config),
})
```

**Purpose:** Allow users to share exact worksheet configurations via URL

**Restoration:**
```typescript
const share = await db.query.worksheetShares.findFirst({
  where: eq(worksheetShares.id, shareId)
})
const config = JSON.parse(share.config)
```

### 3. API Settings (User Preferences)

**API Route:** `POST /api/worksheets/settings`

```typescript
const config = extractConfigFields(formState)
await db.insert(worksheetSettings).values({
  userId: session.userId,
  type: 'addition',
  config: JSON.stringify(config),
})
```

**Purpose:** Save user's preferred defaults (future feature)

## State Reconstruction Flow

### When Loading a Shared Worksheet

1. **Fetch share data:**
   ```typescript
   const response = await fetch(`/api/worksheets/share/${shareId}`)
   const { config } = await response.json()
   ```

2. **Pass to validation:**
   ```typescript
   const validation = validateWorksheetConfig(config)
   ```

3. **Validation calculates derived state:**
   ```typescript
   // In validation.ts
   const problemsPerPage = formState.problemsPerPage ?? 20
   const pages = formState.pages ?? 1
   const total = problemsPerPage * pages  // DERIVED!
   const rows = Math.ceil(total / cols)   // DERIVED!
   ```

4. **Return validated config with derived state:**
   ```typescript
   return {
     ...persistedFields,
     total,  // Calculated
     rows,   // Calculated
     date: getDefaultDate(),  // Fresh!
   }
   ```

## Common Bugs and Solutions

### Bug: Shared worksheets show wrong page count

**Cause:** Using `formState.total` as source of truth instead of calculating from `problemsPerPage × pages`

**Fix:**
```typescript
// ❌ WRONG - uses fallback when total is missing
const total = formState.total ?? 20

// ✅ CORRECT - calculate from primary state
const problemsPerPage = formState.problemsPerPage ?? 20
const pages = formState.pages ?? 1
const total = problemsPerPage * pages
```

### Bug: New config field doesn't persist

**Cause (Old):** Forgot to add field to `extractConfigFields` whitelist

**Solution:** Use blacklist approach - new fields automatically work!

### Bug: Shared worksheet generates different problems

**Cause:** Missing `seed` or `prngAlgorithm` in persisted config

**Solution:** `extractConfigFields` always includes these fields:
```typescript
const config = {
  ...persistedFields,
  prngAlgorithm: persistedFields.prngAlgorithm ?? 'mulberry32',
}
```

## Adding New Config Fields

### Checklist

When adding a new config field:

1. **Determine field category:**
   - PRIMARY STATE? → No special handling needed! Blacklist approach handles it automatically
   - DERIVED STATE? → Add to blacklist in `extractConfigFields.ts`
   - EPHEMERAL STATE? → Add to blacklist in `extractConfigFields.ts`

2. **Add to type definitions:**
   ```typescript
   // In config-schemas.ts
   export const additionConfigV4Schema = z.object({
     // ... existing fields ...
     myNewField: z.string().optional(),  // Add new field
   })
   ```

3. **Update validation defaults (if needed):**
   ```typescript
   // In validation.ts
   const myNewField = formState.myNewField ?? 'defaultValue'
   ```

4. **Test the flow:**
   - Create worksheet with new field
   - Save to localStorage
   - Share the worksheet
   - Open share link
   - Verify new field is preserved

### Example: Adding a New Primary Field

```typescript
// 1. Update schema (config-schemas.ts)
export const additionConfigV4Schema = z.object({
  // ... existing fields ...
  headerText: z.string().optional(),  // New field!
})

// 2. Update validation defaults (validation.ts)
const sharedFields = {
  // ... existing fields ...
  headerText: formState.headerText ?? 'Math Practice',
}

// 3. Done! extractConfigFields automatically includes it
```

### Example: Adding a New Derived Field

```typescript
// 1. Update schema (config-schemas.ts)
// (Derived fields don't go in the persisted schema)

// 2. Calculate in validation (validation.ts)
const averageProblemsPerRow = Math.ceil(problemsPerPage / rows)

// 3. Add to blacklist (extractConfigFields.ts)
const { rows, total, date, averageProblemsPerRow, ...persistedFields } = formState
```

## Testing

### Manual Test: Share Link Preservation

1. Create a worksheet with specific config:
   - 100 pages
   - 20 problems per page
   - 3-4 digit problems
   - Smart mode with specific display rules

2. Click "Share" to create share link

3. Open share link in new incognito window

4. Verify ALL config matches:
   - ✅ Total shows 2000 problems (100 × 20)
   - ✅ Page count shows 100
   - ✅ Digit range shows 3-4
   - ✅ Display rules match original
   - ✅ Problems are identical (same seed)

### Automated Test (TODO)

```typescript
describe('extractConfigFields', () => {
  it('excludes derived state', () => {
    const formState = {
      problemsPerPage: 20,
      pages: 5,
      total: 100,  // Should be excluded
      rows: 5,     // Should be excluded
    }

    const config = extractConfigFields(formState)

    expect(config.problemsPerPage).toBe(20)
    expect(config.pages).toBe(5)
    expect(config.total).toBeUndefined()
    expect(config.rows).toBeUndefined()
  })

  it('includes seed and prngAlgorithm', () => {
    const formState = {
      seed: 12345,
      prngAlgorithm: 'mulberry32',
    }

    const config = extractConfigFields(formState)

    expect(config.seed).toBe(12345)
    expect(config.prngAlgorithm).toBe('mulberry32')
  })
})
```

## Related Files

- **`src/app/create/worksheets/utils/extractConfigFields.ts`** - Config extraction logic
- **`src/app/create/worksheets/validation.ts`** - Config validation and derived state calculation
- **`src/app/create/worksheets/types.ts`** - Type definitions (PRIMARY vs DERIVED)
- **`src/app/create/worksheets/config-schemas.ts`** - Zod schemas for validation
- **`src/hooks/useWorksheetAutoSave.ts`** - Auto-save to localStorage
- **`src/app/api/worksheets/share/route.ts`** - Share link creation API
- **`src/app/worksheets/shared/[id]/page.tsx`** - Shared worksheet viewer

## History

### 2025-01: Blacklist Refactor

**Problem:** Multiple incidents where new config fields weren't shared correctly because we forgot to update the extraction whitelist.

**Solution:** Refactored `extractConfigFields` to use blacklist approach (exclude derived fields) instead of whitelist (manually include everything).

**Result:** New config fields now automatically work in shared worksheets without touching extraction code.

### 2025-01: Total Calculation Bug

**Problem:** Shared 100-page worksheets displayed as 4 pages because validation defaulted `total` to 20 instead of calculating from `problemsPerPage × pages`.

**Solution:** Calculate `total` from primary state instead of using fallback:
```typescript
// Before (bug)
const total = formState.total ?? 20

// After (fix)
const total = problemsPerPage * pages
```

**Root Cause:** `extractConfigFields` didn't save `total` (correctly, as it's derived), but validation incorrectly treated it as primary state.
