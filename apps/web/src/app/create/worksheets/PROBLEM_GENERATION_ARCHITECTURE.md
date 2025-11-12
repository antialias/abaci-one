# Problem Generation Architecture

## Overview

This document describes the complete architecture for generating addition, subtraction, and mixed worksheets with configurable difficulty and uniqueness constraints.

## Table of Contents

1. [Core Concepts](#core-concepts)
2. [Generation Strategies](#generation-strategies)
3. [Problem Space Estimation](#problem-space-estimation)
4. [Edge Cases](#edge-cases)
5. [Performance Considerations](#performance-considerations)
6. [User-Facing Warnings](#user-facing-warnings)

---

## Core Concepts

### Problem Types

**Addition Problems**
- Two addends: `a + b = ?`
- Regrouping ("carrying"): When column sum ≥ 10
- Categories:
  - **Non-regrouping**: No carries in any column (e.g., 23 + 45)
  - **Ones-only**: Carry from ones to tens only (e.g., 27 + 58)
  - **Multiple regrouping**: Carries in 2+ columns (e.g., 67 + 48)

**Subtraction Problems**
- Minuend - Subtrahend: `a - b = ?` where `a >= b`
- Borrowing ("regrouping"): When minuend digit < subtrahend digit
- Categories:
  - **Non-borrowing**: No borrows needed (e.g., 89 - 34)
  - **Ones-only**: Borrow in ones place only (e.g., 52 - 17)
  - **Multiple borrowing**: Borrows in 2+ positions (e.g., 534 - 178)

**Mixed Problems**
- Two modes:
  - **Manual mode**: 50/50 random mix using same constraints for both operators
  - **Mastery mode**: Separate skill-based configs for addition and subtraction

### Difficulty Parameters

**pAnyStart** (0.0 - 1.0)
- Probability that ANY regrouping/borrowing occurs
- `0.0` = No regrouping/borrowing allowed
- `1.0` = ALL problems must have regrouping/borrowing
- `0.5` = Mixed (about half the problems will have regrouping/borrowing)

**pAllStart** (0.0 - 1.0)
- Probability of MULTIPLE regrouping/borrowing operations
- Must be ≤ pAnyStart
- Only meaningful when `pAnyStart > 0`

**interpolate** (boolean)
- `false` = All problems at same difficulty (uses pAnyStart as constant)
- `true` = Progressive difficulty from easy to hard
  - Early problems: `pAny = pAnyStart × 0.0`
  - Late problems: `pAny = pAnyStart × 1.0`

**digitRange** (`{min: 1-5, max: 1-5}`)
- Range of digits for each operand
- `{min: 1, max: 1}` = Single-digit problems (0-9 for addition, 1-9 for subtraction)
- `{min: 2, max: 2}` = Two-digit problems (10-99)
- `{min: 1, max: 3}` = Mixed 1-3 digit problems

---

## Generation Strategies

The system uses **two different strategies** based on problem space size:

### Strategy 1: Generate-All + Shuffle (Small Spaces)

**When used:** Estimated unique problems < 10,000

**Process:**
1. **Enumerate all valid problems** within constraints
   - For addition: All pairs `(a, b)` in digit range matching regrouping requirements
   - For subtraction: All pairs `(m, s)` where `m ≥ s` matching borrowing requirements
2. **Filter by difficulty constraints**
   - `pAnyStart = 1.0` → Keep only regrouping/borrowing problems
   - `pAnyStart = 0.0` → Keep only non-regrouping/non-borrowing problems
   - `0.0 < pAnyStart < 1.0` → Keep all problems (will sample later)
3. **Handle interpolation**
   - **If interpolate = false**: Shuffle deterministically, take first N problems
   - **If interpolate = true**: Sort by difficulty (carry/borrow count), sample based on difficulty curve

**Cycling behavior** (when requesting > available):
- **Non-interpolate**: Repeat shuffled sequence indefinitely
  - Problems 0-44: First shuffle
  - Problems 45-89: Second shuffle (same order)
  - Problems 90+: Third shuffle, etc.
- **Interpolate**: Clear "seen" set after exhausting all unique problems, maintain difficulty curve
  - Each cycle: Easy→Medium→Hard progression
  - Cycle boundary logged: `"Exhausted all 45 unique problems at position 45. Starting cycle 2"`

**Advantages:**
- **Zero retries** - No random generation needed
- **Guaranteed coverage** - Every unique problem appears once before repeating
- **Deterministic** - Same seed always produces same worksheet

**Code location:** `problemGenerator.ts:365-470`

### Strategy 2: Retry-Based Generation (Large Spaces)

**When used:** Estimated unique problems ≥ 10,000

**Process:**
1. **For each problem position** (i = 0 to total-1):
   - Calculate difficulty fraction: `frac = i / (total - 1)` (0.0 → 1.0)
   - Interpolate difficulty: `pAny = pAnyStart × frac` (if interpolate=true)
   - Sample problem category based on probabilities
   - Generate random problem in that category
   - Retry up to 100 times if duplicate
   - If still duplicate after 100 tries, allow it (prevents infinite loops)

**Uniqueness tracking:**
- Addition: Key = `"min(a,b)+max(a,b)"` (commutative)
- Subtraction: Key = `"minuend-subtrahend"` (not commutative)

**Retry limits:**
- Old limit: 3000 retries per problem (millions of iterations for large worksheets!)
- New limit: 100 retries per problem (allow some duplicates to prevent performance issues)

**Why allow duplicates?**
- For constrained spaces (e.g., 100 problems from 2-digit 100% regrouping), uniqueness is impossible
- Better to have a few duplicates than hang for minutes generating one worksheet
- Duplicates are rare in practice for large spaces

**Code location:** `problemGenerator.ts:473-557`

---

## Problem Space Estimation

### Purpose
Estimate how many unique problems exist given constraints to:
1. Choose generation strategy (enumerate vs retry)
2. Warn users about duplicate risk
3. Display problem space in UI

### Exact Counting (Small Spaces)

**1-digit addition (0-9):**
- Total pairs: 10 × 10 = 100
- Regrouping pairs: 45 (where a + b ≥ 10)
  - Calculation: `sum from a=0 to 9 of (9-a+1 if a+b≥10 else 0)`
  - a=0: none, a=1: 9, a=2: 8, ..., a=9: 1
  - Total: 0+9+8+7+6+5+4+3+2+1 = 45
- Non-regrouping: 100 - 45 = 55

**1-digit subtraction (0-9):**
- Valid pairs: 55 (where m ≥ s, including 0-0)
- Borrowing: ~36 (where m < s at ones place)
- Non-borrowing: ~19

**2-digit addition (10-99):**
- Total pairs: 90 × 90 = 8,100
- Use generate-all for exact count based on pAnyStart

### Heuristic Estimation (Large Spaces)

For digit ranges ≥ 2-digit or mixed ranges:

```typescript
numbersPerDigitCount = digits === 1 ? 10 : 9 × 10^(digits-1)

// Addition
pairsForDigits = numbersPerDigitCount × numbersPerDigitCount
regroupFactor = pAnyStart > 0.8 ? 0.45 : pAnyStart > 0.5 ? 0.5 : 0.7
totalSpace += pairsForDigits × regroupFactor

// Subtraction
pairsForDigits = (numbersPerDigitCount × numbersPerDigitCount) / 2  // Only m ≥ s
borrowFactor = pAnyStart > 0.8 ? 0.35 : pAnyStart > 0.5 ? 0.5 : 0.7
totalSpace += pairsForDigits × borrowFactor
```

**Why these factors?**
- High regrouping requirement (pAnyStart > 0.8) → Fewer valid problems
- Medium regrouping (pAnyStart > 0.5) → About half the space
- Low regrouping → Most problems are valid

**Code location:** `utils/validateProblemSpace.ts:18-104`

---

## Edge Cases

### 1. Single-Digit High Regrouping (CRITICAL)

**Problem:** 1-digit addition with 100% regrouping
**Space size:** Only 45 unique problems!

**User impact:**
- Requesting 100 problems → 55 duplicates guaranteed
- Warning banner: "Single-digit problems (1-9) with 100% regrouping have very few unique combinations!"

**Mitigation:**
- Clear warning in UI
- Suggest increasing digit range to 2
- Suggestion: Reduce to 1 page (20 problems) or lower regrouping to 50%

**Code:** `validateProblemSpace.ts:175-179`

### 2. Mixed Mode with Mastery

**Problem:** Addition and subtraction use different skill configs
**Space estimation:** Cannot easily estimate combined space

**Solution:**
- Skip validation entirely for `mode=mastery && operator=mixed`
- Code: `WorksheetPreviewContext.tsx:53-56`

**Reason:** Each operator has its own digitRange, pAnyStart, making combined estimation complex and potentially misleading

### 3. Subtraction Multiple Borrowing Impossibility

**Problem:** 1-2 digit subtraction cannot have 2+ borrows

**Mathematical proof:**
- 1-digit: Only 1 column, max 1 borrow
- 2-digit: Max minuend = 99, if ones requires borrow, tens can only have 0-1 borrows

**Solution:**
- `generateBothBorrow()` falls back to `generateOnesOnlyBorrow()` when `maxDigits ≤ 2`
- Code: `problemGenerator.ts:802-804`

### 4. Borrowing Across Zeros

**Problem:** `1000 - 1` requires 3 borrows (hundreds→tens→ones)

**Counting logic:**
```typescript
100 - 1:
  ones: 0 < 1, borrow from tens
  tens: 0 (zero!), borrow from hundreds  // +1 borrow for crossing zero
  hundreds: 1, decrement to 0
  Total: 2 borrows (ones + crossing zero)

1000 - 1:
  ones: 0 < 1, borrow from tens
  tens: 0, borrow from hundreds           // +1 borrow
  hundreds: 0, borrow from thousands      // +1 borrow
  thousands: 1, decrement to 0
  Total: 3 borrows
```

**Code:** `problemGenerator.ts:740-782` (`countBorrows` function)

### 5. Duplicate Detection

**Addition is commutative:**
- `23 + 45` = `45 + 23` → Same problem
- Key: `"min(a,b)+max(a,b)"` = `"23+45"`

**Subtraction is NOT:**
- `45 - 23` ≠ `23 - 45`
- Key: `"45-23"` (order matters)

**Mixed mode:**
- `23 + 45` and `45 - 23` are considered different (different operators)

---

## Performance Considerations

### Strategy Selection Threshold

**Why 10,000?**
- Generate-all is O(n²) where n = numbers in range
- For 2-digit: 90² = 8,100 pairs (under threshold) → Use generate-all
- For 3-digit: 900² = 810,000 pairs (over threshold) → Use retry-based
- Enumeration is fast for < 10K, slow for > 100K

### Retry Limit Reduction

**Old:** 3000 retries per problem
**New:** 100 retries per problem

**Why reduced?**
- 100-problem worksheet × 3000 retries = 300,000 iterations (seconds to generate)
- 100-problem worksheet × 100 retries = 10,000 iterations (milliseconds to generate)
- For large problem spaces, duplicates are rare anyway
- For small problem spaces, we use generate-all (zero retries)

**When duplicates occur:**
- Constrained space + retry strategy = Some duplicates allowed
- Example: 2-digit 100% regrouping, 500 problems requested
  - Unique space: ~3,700 problems
  - After 3,700 unique: Retries start failing, duplicates appear
  - Alternative: Use generate-all + cycle (better!)

### Logging

**Addition generation:**
```
[ADD GEN] Starting: 100 problems, digitRange: 1-1, pAnyStart: 1, pAllStart: 0
[ADD GEN] Estimated unique problem space: 45 (requesting 100)
[ADD GEN] Using generate-all + shuffle (space < 10000, interpolate=true)
[ADD GEN] Generated 45 unique problems
[ADD GEN] Sorting problems by difficulty for progressive difficulty
[ADD GEN] Exhausted all 45 unique problems at position 45. Starting cycle 2.
[ADD GEN] Complete: 100 problems in 8ms (0 retries, generate-all with progressive difficulty, 1 cycles)
```

**Subtraction generation:**
```
[SUB GEN] Starting: 50 problems, digitRange: 2-2, pAnyBorrow: 0.5, pAllBorrow: 0
[SUB GEN] Estimated unique problem space: 4050 (requesting 50)
[SUB GEN] Using generate-all + shuffle (space < 10000)
[SUB GEN] Generated 4050 unique problems
[SUB GEN] Complete: 50 problems in 112ms (0 retries, generate-all method)
```

**Mixed mastery generation:**
```
[MASTERY MIXED] Generating 100 mixed problems (50/50 split)...
[MASTERY MIXED] Step 1: Generating 50 addition problems...
[ADD GEN] Starting: 50 problems, digitRange: 2-2, pAnyStart: 0.3, pAllStart: 0
[MASTERY MIXED] Step 1: ✓ Generated 50 addition problems in 45ms
[MASTERY MIXED] Step 2: Generating 50 subtraction problems...
[SUB GEN] Starting: 50 problems, digitRange: 1-2, pAnyBorrow: 0.7, pAllBorrow: 0
[MASTERY MIXED] Step 2: ✓ Generated 50 subtraction problems in 23ms
[MASTERY MIXED] Step 3: Shuffling 100 problems...
[MASTERY MIXED] Step 3: ✓ Shuffled in 0ms
```

---

## User-Facing Warnings

### Current Implementation

**Where shown:** `DuplicateWarningBanner` component (preview pane, centered)

**Trigger conditions:**
- `duplicateRisk !== 'none'` (ratio ≥ 0.3)
- Not dismissed by user
- Not in mastery + mixed mode

**Warning levels:**

**Low risk** (0.3 ≤ ratio < 0.5):
```
You're requesting 50 problems, but only ~45 unique problems are possible
with these constraints. Some duplicates may occur.
```

**Medium risk** (0.5 ≤ ratio < 0.8):
```
Warning: Only ~45 unique problems possible, but you're requesting 100.
Expect moderate duplicates.

Suggestion: Reduce pages to 1 or increase digit range to 3
```

**High risk** (0.8 ≤ ratio < 1.5):
```
High duplicate risk! Only ~45 unique problems possible for 100 requested.

Recommendations:
  • Reduce to 1 pages (50% of available space)
  • Increase digit range to 2-2
  • Lower regrouping probability from 100% to 50%
```

**Extreme risk** (ratio ≥ 1.5):
```
Extreme duplicate risk! Requesting 200 problems but only ~45 unique problems exist.

This configuration will produce mostly duplicate problems.

Strong recommendations:
  • Reduce to 1 pages maximum
  • OR increase digit range from 1-1 to 1-2
  • OR reduce regrouping requirement from 100%
```

**Special case - Single digit:**
```
Single-digit problems (1-9) with 100% regrouping have very few unique combinations!
```

### Suggested Improvements

**1. Show in Config Panel (Proactive)**
- Display estimated problem space next to pages/problemsPerPage sliders
- Live update as user adjusts settings
- Color-coded indicator: Green (plenty), Yellow (tight), Red (insufficient)

**2. Smart Mode Suggestions**
- When user selects high pages + constrained digit range:
  - "This configuration has limited unique problems. Consider using Smart Mode for auto-scaled difficulty."

**3. Download-Time Warning (Last Chance)**
- If user dismisses warning and clicks Download with extreme risk:
  - Modal: "Are you sure? This will produce mostly duplicates. Continue anyway?"

**4. Mixed Mode Validation**
- Currently skipped for mastery+mixed
- Could estimate: `additionSpace / 2 + subtractionSpace / 2` (rough approximation)
- Or: "Mixed mastery mode - problem space not validated"

**5. Tooltip on Regrouping Slider**
- "100% regrouping with 1-digit problems severely limits unique combinations (only 45 possible)"
- Show when `digitRange.max === 1 && pAnyStart > 0.8`

---

## Code Organization

### Main Files

**`problemGenerator.ts`** (1,130 lines)
- All problem generation logic (addition, subtraction, mixed)
- Generate-all vs retry strategy selection
- Regrouping/borrowing counting
- Deterministic PRNG (Mulberry32)
- Mixed mode (manual and mastery)

**`utils/validateProblemSpace.ts`** (200 lines)
- Problem space estimation
- Duplicate risk calculation
- Warning message generation
- Validation logic

**`components/worksheet-preview/WorksheetPreviewContext.tsx`** (85 lines)
- Validation triggering on config changes
- Warning state management
- Dismiss state tracking

**`components/worksheet-preview/DuplicateWarningBanner.tsx`** (147 lines)
- Warning UI display
- Collapsible details
- Dismiss button

### Key Functions

**Addition:**
- `generateProblems()` - Main entry point
- `generateAllAdditionProblems()` - Enumerate all valid problems
- `generateNonRegroup()` - No carries
- `generateOnesOnly()` - Carry in ones only
- `generateBoth()` - Multiple carries
- `countRegroupingOperations()` - Difficulty scoring

**Subtraction:**
- `generateSubtractionProblems()` - Main entry point
- `generateAllSubtractionProblems()` - Enumerate all valid problems
- `generateNonBorrow()` - No borrows
- `generateOnesOnlyBorrow()` - Borrow in ones only
- `generateBothBorrow()` - Multiple borrows
- `countBorrows()` - Simulate subtraction algorithm

**Mixed:**
- `generateMixedProblems()` - Manual mode 50/50 split
- `generateMasteryMixedProblems()` - Separate skill-based configs

**Validation:**
- `estimateUniqueProblemSpace()` - Exact or heuristic estimation
- `validateProblemSpace()` - Duplicate risk analysis

---

## Testing Considerations

### Unit Tests Needed

**Problem space estimation:**
- 1-digit addition: Exactly 45 regrouping, 55 non-regrouping
- 1-digit subtraction: Validate borrow counts
- Mixed mode: Validate combined space estimation

**Generation strategy selection:**
- Verify generate-all used for spaces < 10K
- Verify retry-based used for spaces ≥ 10K

**Cycling behavior:**
- Request 100 problems from 45-problem space
- Verify first 45 are unique
- Verify next 45 repeat the sequence (non-interpolate)
- Verify progressive difficulty maintained across cycles (interpolate)

**Edge cases:**
- Single-digit 100% regrouping
- Subtraction multiple borrows with 2-digit max
- Borrowing across zeros (1000 - 1)
- Mixed mastery mode (skip validation)

### Integration Tests

**End-to-end worksheet generation:**
1. Configure: 1-digit, 100% regrouping, 100 problems
2. Generate worksheet
3. Verify warning shown
4. Verify 45 unique problems + 55 repeats
5. Download PDF, verify renders correctly

---

## Future Improvements

### 1. Better Duplicate Handling for Interpolate Mode

**Current:** Clears "seen" set and restarts cycle
**Better:** Shuffle the sorted array between cycles to get different difficulty ordering

### 2. Subtraction Generate-All Missing Interpolate

**Current:** Subtraction doesn't support generate-all + interpolate
**Code:** `subtractionGenerator.ts:863` has `&& !interpolate` check
**Fix:** Implement same difficulty sorting as addition

### 3. More Granular Difficulty Levels

**Current:** 3 categories (non, onesOnly, both)
**Better:** Score by exact carry/borrow count (0, 1, 2, 3+) for finer difficulty curve

### 4. Problem Space Caching

**Current:** Re-estimates on every config change
**Better:** Cache estimated spaces for common configurations

### 5. User Education

**Current:** Technical warnings with math jargon
**Better:** Simpler language, visual indicators, examples

---

## Glossary

**Regrouping (Addition):** Carrying a value to the next place value when column sum ≥ 10

**Borrowing (Subtraction):** Taking from a higher place value when minuend digit < subtrahend digit

**Problem Space:** The set of all unique problems possible given constraints

**Generate-All:** Strategy that enumerates all valid problems upfront, then shuffles

**Retry-Based:** Strategy that randomly generates problems and retries on duplicates

**Interpolation:** Gradual difficulty increase from start to end of worksheet

**Cycle:** Repetition of the entire problem set when requesting more problems than exist

**pAnyStart:** Target probability that any regrouping/borrowing occurs

**pAllStart:** Target probability of multiple regrouping/borrowing operations

**Commutative:** Order doesn't matter (addition: 2+3 = 3+2)

**Non-commutative:** Order matters (subtraction: 5-3 ≠ 3-5)
