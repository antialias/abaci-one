# Subtraction Borrowing Frequency Bug Fix

**Date:** 2025-11-08
**Commit:** `98179fb8`
**Severity:** Critical - Feature completely broken for subtraction worksheets

## User Report

User noticed that even with regrouping frequency cranked up to 100% for all places (pAllStart = 1.0, pAnyStart = 1.0), subtraction worksheets were NOT generating many problems that require borrowing. This affected both:

- Manual mode (direct slider control)
- Smart difficulty mode (preset-based control)

## Root Cause Analysis

### The Bug

The `generateBothBorrow()` function in `problemGenerator.ts` (lines 424-458) used a **naive digit comparison** approach to count borrows:

```typescript
// OLD BUGGY CODE
for (let pos = 0; pos < maxPlaces; pos++) {
  const digitM = getDigit(minuend, pos);
  const digitS = getDigit(subtrahend, pos);

  if (digitM < digitS) {
    borrowCount++;
  }
}

// Need at least 2 borrows
if (borrowCount >= 2) {
  return [minuend, subtrahend];
}
```

### Why This Failed

#### Problem 1: Doesn't Handle Cascading Borrows

Example: `100 - 1`

- Ones: `0 < 1` → naive count = 1
- Tens: `0 < 0` → no increment
- Hundreds: `1 < 0` → no increment
- **Naive count: 1 borrow**

But the **actual subtraction algorithm** requires:

1. Borrow from hundreds to tens (hundreds becomes 0, tens becomes 10)
2. Borrow from tens to ones (tens becomes 9, ones becomes 10)
3. **Actual borrows: 2**

#### Problem 2: Impossible for 2-Digit Numbers

**Mathematical proof**: For 2-digit numbers where `minuend >= subtrahend`:

If `tensM < tensS`, then:

- Minuend = `tensM * 10 + onesM` where `tensM < tensS`
- Subtrahend = `tensS * 10 + onesS`
- Therefore: `minuend < tensS * 10 <= subtrahend`
- **Contradiction!** (violates `minuend >= subtrahend`)

**Result**: There are ZERO 2-digit subtraction problems where both `onesM < onesS` AND `tensM < tensS`.

I verified this empirically:

```bash
# Tested all 4095 valid 2-digit subtractions (10-99 where minuend >= subtrahend)
No borrowing: 2475 problems (60.4%)
Ones-only borrowing: 1620 problems (39.6%)
Both places borrow: 0 problems (0.0%)
```

### Impact on Users

When users set `pAllStart = 100%` with 2-digit subtraction:

1. Generator calculates: `pAll = 1.0, pAny = 1.0, pOnesOnly = 0, pNon = 0`
2. Picks category: `if (rand() < 1.0)` → always picks `'both'`
3. Calls `generateBothBorrow(rand, 2, 2)`
4. Function tries 5000 times to find a problem with `borrowCount >= 2`
5. **Never finds one** (mathematically impossible!)
6. Falls back to hardcoded `[93, 57]` which only has 1 borrow
7. Uniqueness check fails (same fallback every time)
8. After 50 retries, switches to random category
9. Eventually generates random mix of problems, NOT the 100% borrowing user requested

**Result**: User gets ~40% borrowing problems instead of 100%, violating their explicit configuration.

## The Fix

### 1. Correct Borrow Counting (`countBorrows()`)

Added new function that **simulates the actual subtraction algorithm**:

```typescript
function countBorrows(minuend: number, subtrahend: number): number {
  const minuendDigits: number[] = [...] // Extract digits
  let borrowCount = 0

  for (let pos = 0; pos < maxPlaces; pos++) {
    const digitM = minuendDigits[pos]
    const digitS = getDigit(subtrahend, pos)

    if (digitM < digitS) {
      borrowCount++  // Count the borrow operation

      // Find next non-zero digit to borrow from
      let borrowPos = pos + 1
      while (borrowPos < maxPlaces && minuendDigits[borrowPos] === 0) {
        borrowCount++  // Borrowing across zero = additional borrow
        borrowPos++
      }

      // Perform the actual borrow
      minuendDigits[borrowPos]--
      for (let p = borrowPos - 1; p > pos; p--) {
        minuendDigits[p] = 9  // Intermediate zeros become 9
      }
      minuendDigits[pos] += 10
    }
  }

  return borrowCount
}
```

**Test cases**:

- `52 - 17`: 1 borrow ✓
- `100 - 1`: 2 borrows ✓ (hundreds → tens → ones)
- `534 - 178`: 2 borrows ✓ (ones and tens both < subtrahend)
- `1000 - 1`: 3 borrows ✓ (across 3 zeros)

### 2. Handle 2-Digit Impossibility

Updated `generateBothBorrow()` to recognize when 2+ borrows are mathematically impossible:

```typescript
export function generateBothBorrow(
  rand: () => number,
  minDigits: number = 2,
  maxDigits: number = 2,
): [number, number] {
  // For 1-2 digit ranges, 2+ borrows are impossible
  // Fall back to ones-only borrowing (maximum difficulty for 2-digit)
  if (maxDigits <= 2) {
    return generateOnesOnlyBorrow(rand, minDigits, maxDigits);
  }

  // For 3+ digits, use correct borrow counting
  for (let i = 0; i < 5000; i++) {
    // Favor higher digit counts for better chance of 2+ borrows
    const digitsMinuend = randint(Math.max(minDigits, 3), maxDigits, rand);
    const digitsSubtrahend = randint(Math.max(minDigits, 2), maxDigits, rand);
    const minuend = generateNumber(digitsMinuend, rand);
    const subtrahend = generateNumber(digitsSubtrahend, rand);

    if (minuend <= subtrahend) continue;

    const borrowCount = countBorrows(minuend, subtrahend);

    if (borrowCount >= 2) {
      return [minuend, subtrahend];
    }
  }

  // Fallback: guaranteed 2+ borrow problem
  return [534, 178]; // Changed from [93, 57] which only had 1 borrow!
}
```

### 3. Improved Fallback

Changed fallback from `[93, 57]` (1 borrow) to `[534, 178]` (2 borrows).

## Verification

After the fix, with `pAllStart = 100%` and `pAnyStart = 100%`:

**2-digit subtraction**:

- All problems have ones-only borrowing (maximum difficulty possible)
- Expected: ~100% problems with borrowing ✓

**3-digit subtraction**:

- Problems have 2+ actual borrow operations
- Includes cases like:
  - `534 - 178` (ones and tens both borrow)
  - `100 - 23` (borrow across zero in tens)
  - `206 - 189` (cascading borrows)

## Lessons Learned

1. **Simulate, don't approximate**: The naive digit comparison seemed reasonable but missed critical edge cases (cascading borrows)

2. **Verify mathematical constraints**: We assumed 2-digit "both" problems existed without checking

3. **Test boundary conditions**: Should have tested with actual problem generation, not just assumed the logic was correct

4. **Document impossibilities**: Added clear comments about when "both" category is impossible vs. just rare

## Related Code

- `problemGenerator.ts`: Lines 417-514 (countBorrows, generateBothBorrow)
- `generateSubtractionProblems()`: Lines 515-596 (calls generateBothBorrow when pAll > threshold)
- `generateMixedProblems()`: Lines 566-607 (uses generateSubtractionProblems)

## Testing Recommendations

1. **Manual testing**:
   - Set regrouping to 100% in manual mode
   - Generate 2-digit subtraction worksheet
   - Verify all problems require borrowing

2. **Automated testing**:
   - Add unit tests for `countBorrows()` with edge cases
   - Add tests for `generateBothBorrow()` across different digit ranges
   - Verify distribution matches requested probabilities

3. **Visual inspection**:
   - Generate worksheets at various difficulty levels
   - Confirm borrowing frequency matches slider settings
   - Test with digit ranges 1-5

---

**Status**: ✅ Fixed and committed
**User Impact**: High - Core feature now works as designed
**Regression Risk**: Low - Fix is localized to borrow counting logic
