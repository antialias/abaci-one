# Worksheet Share Persistence: Implementation Plan

## Problem Statement

The worksheet sharing feature does NOT use the same persistence/loading logic as user session management, leading to potential inconsistencies, missing validation, and schema version mismatches.

## Current Issues

### Issue 1: Share Save - Sends Unfiltered FormState

**Location:** `src/app/create/worksheets/components/PreviewCenter.tsx:83` and `ActionsSidebar.tsx:42`

**What's Wrong:**
```typescript
// WRONG: Sends entire formState (Partial type with possibly invalid/extra fields)
body: JSON.stringify({
  worksheetType: 'addition',
  config: formState,  // ❌ Unfiltered Partial<WorksheetFormState>
})
```

**Why It's Wrong:**
- `formState` is `WorksheetFormState` which is a `Partial` type - may contain undefined/invalid fields
- May include derived state like `rows`, `total`, `date`, `seed` that shouldn't be persisted
- May include temporary UI state that doesn't belong in the config
- Not consistent with auto-save which explicitly extracts only needed fields

**Correct Path Forward:**
Use the same field extraction that `useWorksheetAutoSave.ts` uses - extract exactly the fields that define the worksheet configuration, no more, no less.

---

### Issue 2: Share Save - API Doesn't Validate Input

**Location:** `src/app/api/worksheets/share/route.ts:87`

**What's Wrong:**
```typescript
// WRONG: Blindly serializes whatever config was received
const configJson = serializeAdditionConfig(config)  // ❌ No validation before serialization
```

**Why It's Wrong:**
- `serializeAdditionConfig()` just adds `version: 4` and calls `JSON.stringify()`
- Doesn't validate the incoming config structure
- Doesn't check if required fields are present
- Could save malformed configs to the database

**Correct Path Forward:**
Validate/normalize the config before serialization, or better yet, only accept the specific fields we know are valid (same as settings API).

---

### Issue 3: Share Load - No Validation or Migration

**Location:** `src/app/api/worksheets/share/[id]/route.ts:50`

**What's Wrong:**
```typescript
// WRONG: Just parses JSON with no validation
const config = JSON.parse(share.config)  // ❌ No validation, no migration!
```

**Why It's Wrong:**
- Doesn't use `parseAdditionConfig()` which validates and migrates configs
- If an old version config is stored, it won't be migrated to the current schema
- No validation that the config has required fields
- Could return malformed data that breaks the client

**Compare to User Settings Load:**
```typescript
// CORRECT: User settings use parseAdditionConfig()
const config = parseAdditionConfig(row.config)  // ✅ Validates + migrates!
```

**Correct Path Forward:**
Use `parseAdditionConfig()` to ensure all shared configs are validated and migrated to the current version, exactly like user session loading does.

---

## Solution: Mirror User Session Persistence

### Step 1: Extract Config Fields Helper Function

**Create:** `src/app/create/worksheets/utils/extractConfigFields.ts`

**Purpose:** DRY principle - extract the same fields in auto-save, share save, and settings save

```typescript
import type { WorksheetFormState } from '../types'
import type { AdditionConfigV4 } from '../config-schemas'

/**
 * Extract only the persisted config fields from formState
 * Excludes derived state (rows, total, date, seed)
 *
 * This ensures consistent field extraction across:
 * - Auto-save (useWorksheetAutoSave)
 * - Share creation
 * - Settings API
 */
export function extractConfigFields(
  formState: WorksheetFormState
): Omit<AdditionConfigV4, 'version'> {
  return {
    problemsPerPage: formState.problemsPerPage!,
    cols: formState.cols!,
    pages: formState.pages!,
    orientation: formState.orientation!,
    name: formState.name!,
    digitRange: formState.digitRange!,
    operator: formState.operator!,
    pAnyStart: formState.pAnyStart!,
    pAllStart: formState.pAllStart!,
    interpolate: formState.interpolate!,
    showCarryBoxes: formState.showCarryBoxes,
    showAnswerBoxes: formState.showAnswerBoxes,
    showPlaceValueColors: formState.showPlaceValueColors,
    showProblemNumbers: formState.showProblemNumbers,
    showCellBorder: formState.showCellBorder,
    showTenFrames: formState.showTenFrames,
    showTenFramesForAll: formState.showTenFramesForAll,
    showBorrowNotation: formState.showBorrowNotation,
    showBorrowingHints: formState.showBorrowingHints,
    fontSize: formState.fontSize,
    mode: formState.mode!,
    difficultyProfile: formState.difficultyProfile,
    displayRules: formState.displayRules,
    manualPreset: formState.manualPreset,
  }
}
```

**Why This Approach:**
- Single source of truth for what fields get persisted
- Type-safe - returns the exact type expected by `serializeAdditionConfig()`
- Easy to maintain - only one place to update when adding new persisted fields
- Consistent behavior across all save operations

---

### Step 2: Update useWorksheetAutoSave to Use Helper

**File:** `src/app/create/worksheets/hooks/useWorksheetAutoSave.ts:47-73`

**Before:**
```typescript
// Extract only the fields we want to persist (exclude date, seed, derived state)
const {
  problemsPerPage,
  cols,
  pages,
  // ... 20+ more fields manually listed
} = formState
```

**After:**
```typescript
import { extractConfigFields } from '../utils/extractConfigFields'

// Extract persisted config fields
const config = extractConfigFields(formState)
```

**Why:**
- Reduces code duplication (24 lines → 2 lines)
- Ensures consistency - if we update the helper, auto-save automatically uses the new logic
- More maintainable

---

### Step 3: Update Share Components to Use Helper

**Files:**
- `src/app/create/worksheets/components/PreviewCenter.tsx:72-101`
- `src/app/create/worksheets/components/ActionsSidebar.tsx:33-63`

**Before:**
```typescript
const response = await fetch('/api/worksheets/share', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    worksheetType: 'addition',
    config: formState,  // ❌ Raw formState
  }),
})
```

**After:**
```typescript
import { extractConfigFields } from '../../utils/extractConfigFields'

const response = await fetch('/api/worksheets/share', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    worksheetType: 'addition',
    config: extractConfigFields(formState),  // ✅ Filtered config
  }),
})
```

**Why:**
- Only persists the fields that should be shared
- Excludes derived state and UI-specific state
- Consistent with auto-save behavior

---

### Step 4: Update Share API to Use parseAdditionConfig on Load

**File:** `src/app/api/worksheets/share/[id]/route.ts:49-50`

**Before:**
```typescript
// Parse config JSON
const config = JSON.parse(share.config)  // ❌ No validation!
```

**After:**
```typescript
import { parseAdditionConfig } from '@/app/create/worksheets/config-schemas'

// Parse and validate config (auto-migrates to latest version)
const config = parseAdditionConfig(share.config)  // ✅ Validates + migrates!
```

**Why:**
- **Validation:** Ensures the config has all required fields and correct types
- **Migration:** Old shared configs (v1, v2, v3) automatically migrate to v4
- **Consistency:** Uses the exact same loading logic as user session persistence
- **Safety:** Catches malformed configs early instead of breaking the client

---

### Step 5: Update ShareModal to Use Helper

**File:** `src/app/create/worksheets/components/ShareModal.tsx:30-44`

**Before:**
```typescript
const response = await fetch('/api/worksheets/share', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    worksheetType,
    config,  // ❌ Passed directly from props
  }),
})
```

**After:**
```typescript
import { extractConfigFields } from '../utils/extractConfigFields'

const response = await fetch('/api/worksheets/share', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    worksheetType,
    config: extractConfigFields(config),  // ✅ Filtered config
  }),
})
```

**Why:**
- Same benefits as PreviewCenter/ActionsSidebar
- Ensures all share creation paths use the same logic

---

## Implementation Order

1. ✅ **Create `extractConfigFields` helper** - Foundation for consistent field extraction
2. ✅ **Update `useWorksheetAutoSave`** - Refactor existing code to use helper (proves helper works)
3. ✅ **Update share components** - Apply helper to all share creation paths
4. ✅ **Update share load API** - Add validation/migration using `parseAdditionConfig()`
5. ✅ **Test migration path** - Verify old shared configs load correctly

## Benefits of This Approach

### Consistency
- Share and user session use identical persistence logic
- Single source of truth for what fields get persisted

### Validation
- All configs (shared or personal) go through the same validation
- Old versions automatically migrate to current schema

### Maintainability
- Adding a new persisted field: update helper once, all paths inherit it
- Reduces code duplication from ~100 lines to ~30 lines

### Safety
- Type-safe field extraction
- Validation catches errors before they reach the client
- Migration ensures forward/backward compatibility

## Testing Checklist

After implementation:

- [ ] Create a share with current config → verify it loads correctly
- [ ] Load an old share (if any exist) → verify it migrates to v4
- [ ] Auto-save settings → verify they still load correctly on page refresh
- [ ] Share from different config states (smart/manual/mastery modes)
- [ ] Verify no extra fields are persisted (check database directly)
- [ ] Verify derived state (rows/total/date/seed) are NOT in shared configs
