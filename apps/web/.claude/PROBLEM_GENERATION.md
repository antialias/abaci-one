# Problem Generation System - Claude Code Reference

## Quick Reference for AI Development

This document provides quick-reference information about the worksheet problem generation system for Claude Code and developers working on this codebase.

---

## File Locations

### Core Logic
- **`src/app/create/worksheets/problemGenerator.ts`** - All generation algorithms (addition, subtraction, mixed)
- **`src/app/create/worksheets/utils/validateProblemSpace.ts`** - Space estimation and validation
- **`src/app/create/worksheets/PROBLEM_GENERATION_ARCHITECTURE.md`** - Complete technical documentation

### UI Components
- **`components/worksheet-preview/WorksheetPreviewContext.tsx`** - Validation triggering and state
- **`components/worksheet-preview/DuplicateWarningBanner.tsx`** - Warning display UI

---

## Two Generation Strategies

### When to Use Each

```typescript
const estimatedSpace = estimateUniqueProblemSpace(digitRange, pAnyStart, operator)

if (estimatedSpace < 10000) {
  // STRATEGY 1: Generate-All + Shuffle
  // Zero retries, guaranteed coverage, deterministic
} else {
  // STRATEGY 2: Retry-Based
  // Random generation, allows some duplicates after 100 retries
}
```

### Strategy 1: Generate-All (Small Spaces)

**Examples:**
- 1-digit 100% regrouping: 45 unique problems
- 2-digit mixed regrouping: ~4,000 unique problems

**Key behavior:**
```typescript
// Non-interpolate: Shuffle and cycle
problems[0-44] = first shuffle
problems[45-89] = second shuffle (same order)
problems[90+] = third shuffle...

// Interpolate: Sort by difficulty, then cycle maintaining progression
seen.clear() when exhausted // Start new cycle
```

**Location:** `problemGenerator.ts:381-503`

### Strategy 2: Retry-Based (Large Spaces)

**Examples:**
- 3-digit problems: ~400,000 unique problems
- 4-5 digit problems: millions of unique problems

**Key behavior:**
```typescript
let tries = 0
while (tries++ < 100 && !unique) {
  problem = generate()
  if (!seen.has(key)) {
    seen.add(key)
    break
  }
}
// Allow duplicate if still not unique after 100 tries
```

**Location:** `problemGenerator.ts:506-595`

---

## Critical Edge Cases

### 1. Single-Digit 100% Regrouping

**Problem:** Only 45 unique problems exist!

```typescript
// 1-digit addition where a + b >= 10
// a=0: none, a=1: 9 (1+9), a=2: 8 (2+8,2+9), ..., a=9: 1 (9+1)
// Total: 0+9+8+7+6+5+4+3+2+1 = 45
```

**User impact:**
- Requesting 100 problems → 55 duplicates guaranteed
- Warning banner shown: "Single-digit problems (1-9) with 100% regrouping have very few unique combinations!"

**Code:** `validateProblemSpace.ts:56-64` (exact count), `validateProblemSpace.ts:175-179` (warning)

### 2. Mixed Mode with Mastery

**Problem:** Cannot validate combined space with separate configs

```typescript
// Addition skill: {digitRange: {min:2, max:2}, pAnyStart: 0.3}
// Subtraction skill: {digitRange: {min:1, max:2}, pAnyStart: 0.7}
// Combined estimation is complex and potentially misleading
```

**Solution:** Skip validation entirely

```typescript
// WorksheetPreviewContext.tsx:53-56
if (mode === 'mastery' && operator === 'mixed') {
  setWarnings([])
  return
}
```

### 3. Subtraction Multiple Borrowing Impossibility

**Mathematical fact:** 1-2 digit subtraction cannot have 2+ borrows

```typescript
// generateBothBorrow() - problemGenerator.ts:802-804
if (maxDigits <= 2) {
  return generateOnesOnlyBorrow(rand, minDigits, maxDigits) // Fallback
}
```

### 4. Borrowing Across Zeros

**Example:** `1000 - 1` requires 3 borrow operations

```
ones: 0 < 1, borrow from tens
tens: 0 (zero!), borrow from hundreds  (+1 for crossing zero)
hundreds: 0, borrow from thousands     (+1 for crossing zero)
thousands: 1, decrement
Total: 3 borrows
```

**Code:** `countBorrows()` - `problemGenerator.ts:740-782`

---

## Debugging Commands

### Check Server Logs for Generation

```bash
# Look for these log patterns:
[ADD GEN] Starting: 100 problems, digitRange: 1-1, pAnyStart: 1, pAllStart: 0
[ADD GEN] Estimated unique problem space: 45 (requesting 100)
[ADD GEN] Using generate-all + shuffle (space < 10000, interpolate=true)
[ADD GEN] Exhausted all 45 unique problems at position 45. Starting cycle 2.
[ADD GEN] Complete: 100 problems in 8ms (0 retries, generate-all with progressive difficulty, 1 cycles)
```

### Test Problem Space Estimation

```typescript
import { estimateUniqueProblemSpace } from './utils/validateProblemSpace'

// 1-digit 100% regrouping
const space1 = estimateUniqueProblemSpace({min: 1, max: 1}, 1.0, 'addition')
console.log(space1) // Expected: 45

// 2-digit mixed
const space2 = estimateUniqueProblemSpace({min: 2, max: 2}, 0.5, 'addition')
console.log(space2) // Expected: ~4000
```

### Verify Cycling Behavior

```typescript
// Generate 100 problems from 45-problem space
const problems = generateProblems(100, 1.0, 0, false, 12345, {min: 1, max: 1})

// Check that problems 0-44 and 45-89 are identical
const cycle1 = problems.slice(0, 45)
const cycle2 = problems.slice(45, 90)
console.log('Cycles match:',
  cycle1.every((p, i) => p.a === cycle2[i].a && p.b === cycle2[i].b)
) // Expected: true
```

---

## Common Modifications

### Adding a New Difficulty Category

**Current categories:** `non`, `onesOnly`, `both`

**To add a new category:**

1. Add category type to `ProblemCategory` in `types.ts`
2. Create generator function (e.g., `generateThreePlus()`)
3. Update probability sampling in retry-based strategy
4. Update `countRegroupingOperations()` or `countBorrows()` for difficulty scoring
5. Update `generateAllAdditionProblems()` or `generateAllSubtractionProblems()` filtering

### Changing Strategy Threshold

**Current:** 10,000 unique problems

```typescript
const THRESHOLD = 10000
if (estimatedSpace < THRESHOLD) {
  // Generate-all
} else {
  // Retry-based
}
```

**To change:**
- Increase for better uniqueness guarantees (more generate-all usage)
- Decrease for better performance on larger spaces (more retry-based usage)

**Trade-off:** Generate-all is O(n²) enumeration, slow for large spaces

### Adjusting Retry Limit

**Current:** 100 retries per problem

```typescript
let tries = 0
while (tries++ < 100 && !ok) {
  // Generate and check uniqueness
}
```

**To change:**
- Increase for better uniqueness (slower generation)
- Decrease for faster generation (more duplicates)

**Historical note:** Was 3000 retries, reduced to 100 for performance
- 100 problems × 3000 retries = 300,000 iterations (seconds)
- 100 problems × 100 retries = 10,000 iterations (milliseconds)

---

## Problem Space Estimation Formulas

### Exact Counting (1-Digit)

```typescript
// Addition regrouping (a + b >= 10)
for (let a = 0; a <= 9; a++) {
  for (let b = 0; b <= 9; b++) {
    if (a + b >= 10) count++
  }
}
// Result: 45

// Addition non-regrouping
// Result: 100 - 45 = 55
```

### Heuristic Estimation (2+ Digits)

```typescript
numbersPerDigitCount = digits === 1 ? 10 : 9 * 10^(digits-1)

// Addition
pairsForDigits = numbersPerDigitCount * numbersPerDigitCount
regroupFactor = pAnyStart > 0.8 ? 0.45 : pAnyStart > 0.5 ? 0.5 : 0.7
totalSpace += pairsForDigits * regroupFactor

// Subtraction (only minuend >= subtrahend valid)
pairsForDigits = (numbersPerDigitCount * numbersPerDigitCount) / 2
borrowFactor = pAnyStart > 0.8 ? 0.35 : pAnyStart > 0.5 ? 0.5 : 0.7
totalSpace += pairsForDigits * borrowFactor
```

**Why these factors?**
- High regrouping requirement → Fewer valid problems
- Medium regrouping → About half
- Low/mixed → Most problems valid

---

## User Warning Levels

```typescript
const ratio = requestedProblems / estimatedSpace

if (ratio < 0.3) {
  duplicateRisk = 'none' // No warning shown
} else if (ratio < 0.5) {
  duplicateRisk = 'low' // "Some duplicates may occur"
} else if (ratio < 0.8) {
  duplicateRisk = 'medium' // "Expect moderate duplicates" + suggestions
} else if (ratio < 1.5) {
  duplicateRisk = 'high' // "High duplicate risk!" + recommendations
} else {
  duplicateRisk = 'extreme' // "Mostly duplicate problems" + strong warnings
}
```

**Location:** `validateProblemSpace.ts:130-172`

---

## Testing Checklist

When modifying problem generation:

- [ ] Test 1-digit 100% regrouping (45 unique)
- [ ] Test 2-digit mixed (should use generate-all)
- [ ] Test 3-digit (should use retry-based)
- [ ] Test cycling: Request 100 from 45-problem space
- [ ] Test progressive difficulty (interpolate=true)
- [ ] Test constant difficulty (interpolate=false)
- [ ] Test mixed mode (manual)
- [ ] Test mixed mode (mastery with separate configs)
- [ ] Test subtraction borrowing across zeros
- [ ] Test subtraction 2-digit multiple borrowing (should fallback)
- [ ] Verify server logs show correct strategy selection
- [ ] Verify warnings appear at correct thresholds

---

## Related Documentation

- **`PROBLEM_GENERATION_ARCHITECTURE.md`** - Complete technical documentation (read this first for deep understanding)
- **`CONFIG_SCHEMA_GUIDE.md`** - Worksheet configuration schema
- **`SMART_DIFFICULTY_SPEC.md`** - Smart mode difficulty progression
- **`SUBTRACTION_AND_OPERATOR_PLAN.md`** - Subtraction implementation plan

---

## Quick Answers

**Q: Why am I seeing duplicate problems?**
A: Check estimated space vs requested problems. If ratio > 1.0, duplicates are inevitable.

**Q: Why is generation slow?**
A: If using retry-based with constrained space (e.g., 2-digit 100% regrouping), switch to generate-all by increasing THRESHOLD.

**Q: Why does interpolate mode show different problems on second cycle?**
A: By design! It clears the "seen" set to allow re-sampling while maintaining difficulty progression.

**Q: Why is mastery+mixed mode not showing warnings?**
A: Validation is skipped because addition and subtraction have separate configs, making combined estimation complex.

**Q: Can I have 3+ borrows in 2-digit subtraction?**
A: No, mathematically impossible. `generateBothBorrow()` falls back to ones-only for maxDigits ≤ 2.

**Q: How do I test if a configuration will have many duplicates?**
A: Use `validateProblemSpace()` - it returns `duplicateRisk` level and `warnings` array.

**Q: What's the difference between addition and subtraction uniqueness?**
A: Addition is commutative (2+3 = 3+2, same problem). Subtraction is not (5-3 ≠ 3-5, different problems).
