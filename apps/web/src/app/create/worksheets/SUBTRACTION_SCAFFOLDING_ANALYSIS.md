# Subtraction Scaffolding Analysis & Smart Difficulty Integration

## Current State

### Subtraction-Specific Scaffolding Options

We have **two new subtraction-specific scaffolding options**:

1. **`showBorrowNotation`** (Manual mode only, line 332)
   - Shows dotted scratch boxes to the left of minuend digits that need borrowing
   - Visual space for students to write modified digit values (e.g., "12" when borrowing from tens to ones)
   - Background color comes from the place value being borrowed FROM

2. **`showBorrowingHints`** (Manual mode only, line 333)
   - Shows visual hints with arrows pointing to where students should write borrowed values
   - Displays "n-1" hints showing what to write in the borrow-from place
   - Includes curved arrows with arrowheads for clear visual guidance

### Current Integration Status

**✅ Works in Manual Mode:**

- Both options available in manual mode schema (config-schemas.ts:332-333)
- Both options properly passed to Typst rendering (typstGenerator.ts:114-115, 225-226)
- Defaults: `showBorrowNotation: true`, `showBorrowingHints: false`

**❌ NOT Available in Smart Mode:**

- Smart mode explicitly sets both to `false` (typstGenerator.ts:88-89)
- Comments say: "Smart mode doesn't have borrow notation (yet)"
- No conditional rules for these options in `DisplayRules` interface

## Gaps & Issues

### 1. **No Smart Mode Integration** ⚠️ CRITICAL

The subtraction scaffolding is **completely absent from smart difficulty mode**. This means:

- ❌ Smart mode worksheets never show borrow notation boxes
- ❌ Smart mode worksheets never show borrowing hints
- ❌ No way to progressively fade these scaffolds based on problem difficulty
- ❌ Subtraction problems in smart mode have LESS scaffolding than addition problems

**Impact:** Smart mode is less useful for subtraction than for addition. Teachers using smart mode for subtraction get NO subtraction-specific scaffolding, making it harder for students to learn borrowing.

### 2. **Missing Display Rules**

The `DisplayRules` interface (displayRules.ts:14-21) only includes:

- `carryBoxes` (addition-focused)
- `answerBoxes`
- `placeValueColors`
- `tenFrames` (works for both, but addition-named)
- `problemNumbers`
- `cellBorders`

**Missing:**

- `borrowNotation` - Conditional rules for scratch boxes
- `borrowingHints` - Conditional rules for visual hints

### 3. **Problem Analysis is Good** ✅

`SubtractionProblemMeta` (problemAnalysis.ts:84-95) properly tracks:

- `requiresBorrowing: boolean`
- `borrowCount: number`
- `borrowPlaces: PlaceValue[]`

This gives us the data we need to make smart decisions about when to show scaffolding.

### 4. **Rule Evaluation Works** ✅

The `evaluateRule()` function (displayRules.ts:36-57) already handles both addition and subtraction:

- Line 45-48: Maps `requiresRegrouping` (addition) OR `requiresBorrowing` (subtraction)
- Line 50-52: Maps `regroupCount` (addition) OR `borrowCount` (subtraction)

So the **infrastructure is ready** - we just need to add the rules.

## Recommendations

### Phase 1: Add Display Rules for Subtraction Scaffolding

**1. Extend `DisplayRules` interface:**

```typescript
// displayRules.ts
export interface DisplayRules {
  carryBoxes: RuleMode;
  answerBoxes: RuleMode;
  placeValueColors: RuleMode;
  tenFrames: RuleMode;
  problemNumbers: RuleMode;
  cellBorders: RuleMode;
  borrowNotation: RuleMode; // NEW: Scratch boxes for borrowing work
  borrowingHints: RuleMode; // NEW: Visual hints (arrows, "n-1")
}
```

**2. Update `ResolvedDisplayOptions`:**

```typescript
// displayRules.ts
export interface ResolvedDisplayOptions {
  showCarryBoxes: boolean;
  showAnswerBoxes: boolean;
  showPlaceValueColors: boolean;
  showTenFrames: boolean;
  showProblemNumbers: boolean;
  showCellBorder: boolean;
  showBorrowNotation: boolean; // NEW
  showBorrowingHints: boolean; // NEW
}
```

**3. Update `resolveDisplayForProblem()`:**

```typescript
// displayRules.ts (line 70-77)
const resolved = {
  showCarryBoxes: evaluateRule(rules.carryBoxes, problem),
  showAnswerBoxes: evaluateRule(rules.answerBoxes, problem),
  showPlaceValueColors: evaluateRule(rules.placeValueColors, problem),
  showTenFrames: evaluateRule(rules.tenFrames, problem),
  showProblemNumbers: evaluateRule(rules.problemNumbers, problem),
  showCellBorder: evaluateRule(rules.cellBorders, problem),
  showBorrowNotation: evaluateRule(rules.borrowNotation, problem), // NEW
  showBorrowingHints: evaluateRule(rules.borrowingHints, problem), // NEW
};
```

### Phase 2: Update Config Schemas

**1. Add to Smart Mode schema:**

```typescript
// config-schemas.ts (additionConfigV4SmartSchema, line 271-314)
displayRules: z.object({
  carryBoxes: z.enum([...]),
  answerBoxes: z.enum([...]),
  placeValueColors: z.enum([...]),
  tenFrames: z.enum([...]),
  problemNumbers: z.enum([...]),
  cellBorders: z.enum([...]),
  borrowNotation: z.enum([      // NEW
    'always',
    'never',
    'whenRegrouping',           // When any borrowing needed
    'whenMultipleRegroups',     // When 2+ borrows
    'when3PlusDigits',
  ]),
  borrowingHints: z.enum([      // NEW
    'always',
    'never',
    'whenRegrouping',
    'whenMultipleRegroups',
    'when3PlusDigits',
  ]),
}),
```

**2. Update default config:**

```typescript
// config-schemas.ts (defaultAdditionConfig, line 375-382)
displayRules: {
  carryBoxes: 'whenRegrouping',
  answerBoxes: 'always',
  placeValueColors: 'always',
  tenFrames: 'whenRegrouping',
  problemNumbers: 'always',
  cellBorders: 'always',
  borrowNotation: 'whenRegrouping',    // NEW: Show when borrowing needed
  borrowingHints: 'never',             // NEW: Advanced feature, default off
},
```

### Phase 3: Update Scaffolding Progression

Add subtraction scaffolding to the pedagogical progression:

```typescript
// difficultyProfiles.ts (SCAFFOLDING_PROGRESSION)
export const SCAFFOLDING_PROGRESSION: DisplayRules[] = [
  // Level 0: Maximum scaffolding
  {
    carryBoxes: "always",
    answerBoxes: "always",
    placeValueColors: "always",
    tenFrames: "always",
    problemNumbers: "always",
    cellBorders: "always",
    borrowNotation: "always", // NEW: Always show scratch boxes
    borrowingHints: "always", // NEW: Always show hints
  },

  // Level 1: Carry/borrow boxes become conditional
  {
    carryBoxes: "whenRegrouping",
    borrowNotation: "whenRegrouping", // NEW: Only when borrowing
    borrowingHints: "always", // Still show hints
    // ... rest
  },

  // Level 2: Hints become conditional
  {
    carryBoxes: "whenRegrouping",
    borrowNotation: "whenRegrouping",
    borrowingHints: "whenRegrouping", // NEW: Only when borrowing
    // ... rest
  },

  // Level 3-5: Keep both at whenRegrouping
  // ... (intermediate levels)

  // Level 6: Hints become more conditional
  {
    borrowNotation: "whenRegrouping",
    borrowingHints: "whenMultipleRegroups", // NEW: Only complex problems
    // ... rest
  },

  // Level 7+: Remove hints, keep notation
  {
    borrowNotation: "whenRegrouping",
    borrowingHints: "never", // NEW: No hints
    // ... rest
  },

  // Level 10+: Remove all subtraction scaffolding
  {
    borrowNotation: "never",
    borrowingHints: "never",
    // ... rest
  },
];
```

### Phase 4: Update Typst Generator

**Remove hardcoded false values:**

```typescript
// typstGenerator.ts (line 88-89)
// BEFORE:
showBorrowNotation: false, // Smart mode doesn't have borrow notation (yet)
showBorrowingHints: false, // Smart mode doesn't have borrowing hints (yet)

// AFTER:
showBorrowNotation: displayOptions.showBorrowNotation,  // Use resolved value
showBorrowingHints: displayOptions.showBorrowingHints,  // Use resolved value
```

### Phase 5: Update UI Components

**1. Add controls in ConfigPanel** (if using smart mode):

- Add "Borrow Notation" dropdown (always/never/whenBorrowing/etc.)
- Add "Borrowing Hints" dropdown (always/never/whenBorrowing/etc.)
- Only show when `operator` is 'subtraction' or 'mixed'

**2. Add preview in DisplayOptionsPreview:**

- Show subtraction example with borrow notation enabled
- Show subtraction example with borrowing hints enabled

## Pedagogical Rationale

### Why This Progression Makes Sense

1. **Early Learners (Levels 0-2):**
   - Show ALL scaffolding including hints with arrows
   - Students need maximum support to understand borrowing concept
   - Visual hints show "where to write what"

2. **Intermediate (Levels 3-6):**
   - Fade hints to only show when borrowing happens
   - Keep scratch boxes for all borrowing problems
   - Students understand concept but need workspace

3. **Advanced (Levels 7-9):**
   - Remove hints entirely (students know the pattern)
   - Keep scratch boxes for multi-borrow problems
   - Only show aids for complex problems

4. **Mastery (Level 10+):**
   - No subtraction-specific scaffolding
   - Students work problems independently
   - Standard worksheet format

### Parallel with Addition

This mirrors the addition progression:

- Carry boxes fade from "always" → "whenRegrouping" → "whenMultipleRegroups" → "never"
- Borrow notation should follow the same path
- Borrowing hints are MORE specific than carry boxes (like ten-frames), so fade faster

## Implementation Priority

**High Priority:**

1. ✅ Add `borrowNotation` and `borrowingHints` to `DisplayRules` interface
2. ✅ Update schemas to include these rules in smart mode
3. ✅ Remove hardcoded `false` values in typstGenerator
4. ✅ Add to default config with sensible defaults

**Medium Priority:** 5. ✅ Update scaffolding progression 6. ✅ Add to difficulty profiles (earlyLearner, intermediate, etc.)

**Lower Priority:** 7. ⚠️ Update UI components (ConfigPanel, DisplayOptionsPreview) 8. ⚠️ Update documentation/help text

## Migration Strategy

**Good news:** This is backward compatible!

- **Manual mode** already has these options, no migration needed
- **Smart mode V4** doesn't have these options yet, so adding them is purely additive
- **Default values** will make existing configs work without changes:
  - `borrowNotation: 'whenRegrouping'` - reasonable default
  - `borrowingHints: 'never'` - conservative default (advanced feature)

**No schema version bump needed** - V4 smart mode can be extended with optional fields.

## Testing Checklist

After implementation:

- [ ] Manual mode subtraction worksheets still show borrow notation
- [ ] Manual mode can toggle borrowing hints on/off
- [ ] Smart mode subtraction worksheets show borrow notation based on rules
- [ ] Smart mode subtraction worksheets show hints based on rules
- [ ] Addition worksheets unaffected (no regression)
- [ ] Mixed worksheets apply correct rules per problem
- [ ] Early learner profile shows max scaffolding for subtraction
- [ ] Advanced profile shows minimal scaffolding for subtraction
- [ ] Preview correctly shows/hides features based on rules
- [ ] Saved configs load correctly with new fields

## Summary

**Current Status:** Subtraction scaffolding exists but is **manual-only**. Smart mode ignores these features entirely.

**Key Problem:** Smart difficulty mode is less effective for subtraction than addition because it lacks subtraction-specific scaffolding rules.

**Solution:** Extend the existing display rules system to include `borrowNotation` and `borrowingHints` as conditional options, following the same pedagogical progression as addition scaffolding.

**Effort:** Medium (2-3 hours)

- Schema updates: 30 min
- Display rules updates: 30 min
- Scaffolding progression: 1 hour
- UI updates: 1-2 hours
- Testing: 1 hour

**Impact:** High - Makes smart mode equally effective for subtraction as it is for addition.
