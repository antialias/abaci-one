# Worksheet Config Persistence - Quick Reference

## TL;DR

**When adding a new config field:**
- ✅ **Do nothing special!** The blacklist approach auto-includes new fields
- ✅ Only update if adding a **DERIVED** field (exclude it in `extractConfigFields.ts`)
- ✅ Add defaults in `validation.ts` if needed
- ✅ Test: Create → Share → Open share link → Verify field persists

## Field Categories

```typescript
// PRIMARY STATE (auto-persisted)
problemsPerPage: 20
pages: 5
cols: 4
// ... all other config fields

// DERIVED STATE (excluded from persistence)
total: 100      // = problemsPerPage × pages
rows: 5         // = Math.ceil(problemsPerPage / cols)

// EPHEMERAL STATE (excluded from persistence)
date: "Jan 15"  // Generated fresh at render time
```

## Architecture Files

```
src/app/create/worksheets/
├── utils/
│   └── extractConfigFields.ts    ← Blacklist: excludes rows, total, date
├── validation.ts                 ← Calculates derived state from primary
├── types.ts                      ← Documents field categories
└── README_CONFIG_PERSISTENCE.md  ← This file

.claude/
└── WORKSHEET_CONFIG_PERSISTENCE.md  ← Full architecture doc
```

## Key Functions

### `extractConfigFields(formState)`
**What it does:** Prepares config for saving to localStorage/database
**How it works:** Excludes only `rows`, `total`, `date` (blacklist approach)
**Returns:** Config object with all primary state fields

```typescript
// Usage in ShareModal
const config = extractConfigFields(formState)
await fetch('/api/worksheets/share', {
  method: 'POST',
  body: JSON.stringify({ worksheetType: 'addition', config })
})
```

### `validateWorksheetConfig(formState)`
**What it does:** Validates config and calculates derived state
**How it works:** Calculates `total = problemsPerPage × pages`, `rows = Math.ceil(problemsPerPage / cols)`
**Returns:** Validated config with both primary AND derived state

```typescript
// Usage when loading shared worksheets
const validation = validateWorksheetConfig(loadedConfig)
if (!validation.isValid) {
  console.error('Invalid config:', validation.errors)
}
```

## Common Patterns

### Pattern 1: Adding a New Field

```typescript
// 1. Update schema (config-schemas.ts)
export const additionConfigV4Schema = z.object({
  // ... existing fields
  myNewField: z.string().optional(),
})

// 2. Update validation defaults (validation.ts)
const sharedFields = {
  // ... existing fields
  myNewField: formState.myNewField ?? 'default',
}

// 3. Done! extractConfigFields auto-includes it
```

### Pattern 2: Adding a Derived Field

```typescript
// 1. Calculate in validation.ts
const myDerivedValue = problemsPerPage / cols

// 2. Add to blacklist (extractConfigFields.ts)
const { rows, total, date, myDerivedValue, ...persistedFields } = formState

// 3. Document in types.ts
export type WorksheetFormState = /* ... */ & {
  /** Derived: myDerivedValue = problemsPerPage / cols */
  myDerivedValue?: number
}
```

## Common Bugs

### Bug: "My new field doesn't persist when shared"
**Old Cause:** Forgot to add field to whitelist
**Current:** Should auto-work with blacklist approach!
**Check:** Is the field derived/ephemeral? If yes, should it be excluded?

### Bug: "Shared worksheets show wrong page count"
**Cause:** Using `formState.total` instead of calculating from primary state
**Fix:** Always calculate: `total = problemsPerPage × pages`

```typescript
// ❌ WRONG
const total = formState.total ?? 20

// ✅ CORRECT
const problemsPerPage = formState.problemsPerPage ?? 20
const pages = formState.pages ?? 1
const total = problemsPerPage * pages
```

## Testing Checklist

When adding/modifying config fields:

- [ ] Create worksheet with new field
- [ ] Save config (auto-save triggers)
- [ ] Refresh page
- [ ] Verify field restored from localStorage
- [ ] Click "Share" to create share link
- [ ] Open share link in incognito window
- [ ] Verify field persists in shared worksheet
- [ ] Check console for extraction logs

## Debug Logs

Enable these console logs to debug config persistence:

```typescript
// In extractConfigFields.ts
console.log('[extractConfigFields] Extracted config:', {
  fieldCount: Object.keys(config).length,
  seed: config.seed,
  pages: config.pages,
  problemsPerPage: config.problemsPerPage,
})

// In validation.ts
console.log('[validateWorksheetConfig] PRIMARY → DERIVED state:', {
  problemsPerPage,
  pages,
  total,
  hadTotal: formState.total !== undefined,
})
```

## Related Documentation

- **Full architecture:** `.claude/WORKSHEET_CONFIG_PERSISTENCE.md`
- **Inline docs:** `extractConfigFields.ts`, `validation.ts`, `types.ts`
- **Share creation:** `src/app/api/worksheets/share/route.ts`
- **Share loading:** `src/app/worksheets/shared/[id]/page.tsx`

## Questions?

If you encounter config persistence issues:

1. Check console logs for extraction/validation
2. Verify field category (PRIMARY vs DERIVED vs EPHEMERAL)
3. Read full architecture doc: `.claude/WORKSHEET_CONFIG_PERSISTENCE.md`
4. Check git history for `extractConfigFields.ts` - look for similar fixes
