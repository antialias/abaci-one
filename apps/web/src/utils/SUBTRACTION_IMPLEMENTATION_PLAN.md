# Subtraction Implementation Plan for `unifiedStepGenerator.ts`

> **Related Documentation:** See [UNIFIED_STEP_GENERATOR_ARCHITECTURE.md](./UNIFIED_STEP_GENERATOR_ARCHITECTURE.md) for complete system documentation including data structures, integration points, and extension guides.

## Overview

This document outlines the implementation plan for adding subtraction support to the unified step generator. The goal is to generate pedagogically correct decomposition, English instructions, bead movements, and readable explanations for subtraction operations on the soroban.

## Current State

- **Addition**: Fully implemented with Direct, FiveComplement, TenComplement, and Cascade rules
- **Subtraction**: Throws `Error('Subtraction not implemented yet')` at line 705-708
- **Existing Infrastructure**:
  - Skill definitions exist (`fiveComplementsSub`, `tenComplementsSub`)
  - `analyzeSubtractionStepSkills()` in problemGenerator.ts works
  - `generateInstructionFromTerm()` already handles negative terms
  - `calculateBeadChanges()` works symmetrically for add/remove

---

## Soroban Subtraction Fundamentals

### The Three Cases

When subtracting digit `d` from current digit `a` at place P:

1. **Direct Subtraction** (`a ≥ d`): Remove beads directly
2. **Five's Complement Subtraction** (`a ≥ d` but earth beads insufficient): Use `-5 + (5-d)`
3. **Ten's Borrow** (`a < d`): Borrow from higher place, then subtract

### Key Difference from Addition

| Addition                            | Subtraction                                 |
| ----------------------------------- | ------------------------------------------- |
| Carry **forward** (to higher place) | Borrow **from** higher place                |
| `+10 - (10-d)` at current place     | `-10` from next place, then work at current |
| Cascade when next place is **9**    | Cascade when next place is **0**            |

---

## Decision Tree for Subtraction

```
processSubtractionDigitAtPlace(digit, placeValue, currentDigitAtPlace, currentState):

  a = currentDigitAtPlace  (what the abacus shows at this place)
  d = digit to subtract
  L = earth beads active (0-4)
  U = heaven bead active (0 or 1)

  IF a >= d:  ─────────────────────────────────────────────────────────
    │ Can subtract without borrowing
    │
    ├─► IF d <= 4:
    │     │
    │     ├─► IF L >= d:
    │     │     → DIRECT: Remove d earth beads
    │     │     Term: "-{d * 10^P}"
    │     │
    │     └─► ELSE (L < d, but a >= d means heaven is active):
    │           → FIVE_COMPLEMENT_SUB: Deactivate heaven, add back (5-d)
    │           Terms: "-{5 * 10^P}", "+{(5-d) * 10^P}"
    │           Example: 7-4: have 5+2, remove 5, add 1 → 3
    │
    ├─► IF d == 5:
    │     → DIRECT: Deactivate heaven bead
    │     Term: "-{5 * 10^P}"
    │
    └─► IF d >= 6:
          → DIRECT: Deactivate heaven + remove (d-5) earth beads
          Terms: "-{5 * 10^P}", "-{(d-5) * 10^P}"
          OR single term: "-{d * 10^P}"

  ELSE (a < d):  ──────────────────────────────────────────────────────
    │ Need to borrow from higher place
    │
    │ borrowAmount = d - a  (how much we're short)
    │ nextPlaceDigit = digit at (P+1)
    │
    ├─► IF nextPlaceDigit > 0:
    │     → SIMPLE_BORROW: Subtract 1 from next place, add 10 here
    │     Step 1: "-{10^(P+1)}"  (borrow)
    │     Step 2: Process (a+10) - d at current place (may use complements)
    │
    └─► ELSE (nextPlaceDigit == 0):
          → CASCADE_BORROW: Find first non-zero place, borrow through
          Operations:
            1. Subtract 1 from first non-zero higher place
            2. Set all intermediate zeros to 9
            3. Add 10 to current place for subtraction

          Example: 1000 - 1
            - Subtract 1 from thousands: 1→0
            - Hundreds 0→9, Tens 0→9, Ones 0→9+1=10
            - Subtract 1 from ones: 10→9
            Result: 999
```

---

## Implementation Plan

### Phase 1: Core Subtraction Functions

#### 1.1 Modify `generateDecompositionTerms()` (Lines 694-822)

Replace the error throw with subtraction handling:

```typescript
if (addend < 0) {
  return generateSubtractionDecompositionTerms(
    startValue,
    targetValue,
    toState,
  );
}
```

#### 1.2 New Function: `generateSubtractionDecompositionTerms()`

```typescript
function generateSubtractionDecompositionTerms(
  startValue: number,
  targetValue: number,
  toState: (n: number) => AbacusState,
): {
  terms: string[];
  segmentsPlan: SegmentDraft[];
  decompositionSteps: DecompositionStep[];
};
```

**Algorithm:**

1. Calculate `subtrahend = startValue - targetValue` (positive number)
2. Process digit-by-digit from **right to left** (ones first)
   - Unlike addition which goes left-to-right, subtraction must track borrows
3. For each digit, call `processSubtractionDigitAtPlace()`
4. Track `pendingBorrow` flag for cascade borrows

**Why right-to-left?** Borrowing propagates leftward, so we need to know if lower places needed to borrow before processing higher places.

Actually, let me reconsider... The current addition goes left-to-right. For consistency and because we're decomposing the subtrahend (the amount being subtracted), we could also go left-to-right BUT track when we'll need to borrow.

**Alternative approach:** Pre-scan to identify borrow points, then process left-to-right like addition.

#### 1.3 New Function: `processDirectSubtraction()`

Mirror of `processDirectAddition()`:

```typescript
function processDirectSubtraction(
  digit: number,
  placeValue: number,
  currentState: AbacusState,
  toState: (n: number) => AbacusState,
  baseProvenance: TermProvenance,
): { steps: DecompositionStep[]; newValue: number; newState: AbacusState };
```

**Cases:**

- `d <= 4, L >= d`: Remove earth beads directly
- `d <= 4, L < d, U == 1`: Five's complement (-5, +remainder)
- `d == 5, U == 1`: Remove heaven bead
- `d >= 6, U == 1`: Remove heaven + earth beads

#### 1.4 New Function: `processTensBorrow()`

```typescript
function processTensBorrow(
  digit: number,
  placeValue: number,
  currentState: AbacusState,
  toState: (n: number) => AbacusState,
  baseProvenance: TermProvenance,
): { steps: DecompositionStep[]; newValue: number; newState: AbacusState };
```

**Algorithm:**

1. Check next place digit
2. If > 0: Simple borrow
3. If == 0: Cascade borrow (find first non-zero)

#### 1.5 New Function: `generateCascadeBorrowSteps()`

```typescript
function generateCascadeBorrowSteps(
  currentValue: number,
  startPlace: number,
  digitToSubtract: number,
  baseProvenance: TermProvenance,
  groupId: string,
): DecompositionStep[];
```

---

### Phase 2: Segment Decision Classification

#### 2.1 New Pedagogical Rules

Add to `PedagogicalRule` type:

```typescript
export type PedagogicalRule =
  | "Direct"
  | "FiveComplement"
  | "TenComplement"
  | "Cascade"
  // New for subtraction:
  | "DirectSub"
  | "FiveComplementSub"
  | "TenBorrow"
  | "CascadeBorrow";
```

**Or** reuse existing rules with context flag. The existing rules are:

- `Direct` - works for both add/sub
- `FiveComplement` - could work for both (context determines +5-n vs -5+n)
- `TenComplement` / `TenBorrow` - these are conceptually different

**Recommendation:** Keep existing rules, add operation context to segments.

#### 2.2 Update `determineSegmentDecisions()`

Add subtraction pattern detection:

```typescript
// Detect subtraction patterns
const hasNegativeFive = negatives.some(v => v === 5 * 10**place)
const hasPositiveAfterNegative = /* ... */

if (hasNegativeFive && positives.length > 0) {
  // Five's complement subtraction: -5 + n
  return [{ rule: 'FiveComplement', conditions: [...], explanation: [...] }]
}
```

---

### Phase 3: Readable Generation

#### 3.1 Update `generateSegmentReadable()`

Add subtraction-specific titles and summaries:

```typescript
// Detect if this is a subtraction segment
const isSubtraction = steps.some((s) => s.operation.startsWith("-"));

if (isSubtraction) {
  // Generate subtraction-specific readable content
  title =
    rule === "Direct"
      ? `Subtract ${digit} — ${placeName}`
      : rule === "FiveComplement"
        ? `Break down 5 — ${placeName}`
        : rule === "TenBorrow"
          ? hasCascade
            ? `Borrow (cascade) — ${placeName}`
            : `Borrow 10 — ${placeName}`
          : `Strategy — ${placeName}`;
}
```

#### 3.2 Subtraction-specific summaries

```typescript
// Direct subtraction
summary = `Remove ${digit} from the ${placeName}. ${
  digit <= 4
    ? `Take away ${digit} earth bead${digit > 1 ? "s" : ""}.`
    : digit === 5
      ? "Deactivate the heaven bead."
      : `Deactivate heaven bead and remove ${digit - 5} earth bead${digit > 6 ? "s" : ""}.`
}`;

// Five's complement subtraction
summary = `Subtract ${digit} from the ${placeName}. Not enough earth beads to remove directly, so deactivate the heaven bead (−5) and add back ${5 - digit} (that's −5 + ${5 - digit} = −${digit}).`;

// Ten's borrow
summary = `Subtract ${digit} from the ${placeName}, but we only have ${currentDigit}. Borrow 10 from ${nextPlaceName}, giving us ${currentDigit + 10}. Now subtract ${digit} to get ${currentDigit + 10 - digit}.`;
```

---

### Phase 4: Instruction Generation

#### 4.1 Verify `generateInstructionFromTerm()` Coverage

Current implementation (lines 1127-1175) already handles:

- `-1` to `-4`: "remove N earth beads"
- `-5`: "deactivate heaven bead"
- `-6` to `-9`: "deactivate heaven bead and remove N earth beads"
- `-10`, `-100`, etc.: "remove 1 from [place]"

**May need additions for:**

- Multi-digit subtraction terms
- Combined operations in single term

#### 4.2 Update `generateStepInstruction()`

Should work as-is since it uses bead movement directions ('activate'/'deactivate').

---

### Phase 5: Full Decomposition String

#### 5.1 Update `buildFullDecompositionWithPositions()`

Handle negative difference:

```typescript
if (difference < 0) {
  // Format as: "startValue - |difference| = startValue - decomposition = targetValue"
  // Example: "17 - 8 = 17 - (10 - 2) = 9"
  leftSide = `${startValue} - ${Math.abs(difference)} = ${startValue} - `;
}
```

---

## Test Cases

### Direct Subtraction

- `5 - 2 = 3` (remove 2 earth beads)
- `7 - 5 = 2` (deactivate heaven bead)
- `9 - 7 = 2` (deactivate heaven, remove 2 earth)

### Five's Complement Subtraction

- `7 - 4 = 3` (have 5+2, need to remove 4; -5+1)
- `6 - 3 = 3` (have 5+1, need to remove 3; -5+2)

### Simple Borrow

- `12 - 5 = 7` (borrow from tens)
- `23 - 8 = 15` (borrow from tens)

### Cascade Borrow

- `100 - 1 = 99` (cascade through two zeros)
- `1000 - 1 = 999` (cascade through three zeros)
- `1000 - 999 = 1` (massive cascade)

### Multi-digit Subtraction

- `45 - 23 = 22` (no borrowing needed)
- `52 - 27 = 25` (borrow in ones place)
- `503 - 247 = 256` (mixed borrowing)

---

## Risk Areas

1. **Right-to-left vs Left-to-right processing**
   - Addition processes high-to-low (left-to-right)
   - Subtraction traditionally processes low-to-high for borrowing
   - Need to reconcile these approaches

2. **Provenance tracking**
   - Subtrahend digits map to operations differently than addend
   - Borrow operations don't map cleanly to single digits

3. **Cascade borrow complexity**
   - Multiple intermediate steps
   - Potential for very long decompositions

4. **UI consistency**
   - Ensure subtraction segments display correctly
   - Decomposition string formatting

---

## Implementation Order

1. **Phase 1.1-1.2**: Basic infrastructure (route to subtraction, skeleton functions)
2. **Phase 1.3**: Direct subtraction (simplest case)
3. **Phase 5**: Decomposition string for subtraction
4. **Test**: Verify direct subtraction works end-to-end
5. **Phase 1.4**: Simple borrow (no cascade)
6. **Test**: Verify simple borrow works
7. **Phase 1.5**: Cascade borrow
8. **Test**: Verify cascade works
9. **Phase 2-3**: Segment decisions and readables
10. **Phase 4**: Verify instructions
11. **Full integration testing**

---

## Design Decisions (Resolved)

### 1. Processing Order: Left-to-right (high to low place) ✅

**Decision:** Process subtraction left-to-right, same as addition.

**Rationale:** The right-to-left convention is only for pencil-paper arithmetic to avoid changing higher digits already written. On the abacus, we can always modify any column, so processing order doesn't matter mathematically. Left-to-right maintains consistency with addition and reads naturally.

### 2. Pedagogical Rules: Align with existing SkillSet ✅

**Decision:** Use skill IDs that match `src/types/tutorial.ts` SkillSet structure.

The existing skills are:

- **basic**: `directSubtraction`, `heavenBeadSubtraction`, `simpleCombinationsSub`
- **fiveComplementsSub**: `-4=-5+1`, `-3=-5+2`, `-2=-5+3`, `-1=-5+4`
- **tenComplementsSub**: `-9=+1-10`, `-8=+2-10`, `-7=+3-10`, etc.

The `PedagogicalRule` type can stay the same (`Direct`, `FiveComplement`, `TenComplement`, `Cascade`) with operation context determining the specific skill extraction.

### 3. Decomposition String Format: Addition of negative terms ✅

**Decision:** `17 - 8 = 17 + (-10 + 2) = 9`

**Rationale:** This format:

- Is consistent with how the system internally represents operations
- Uses signed terms that match bead movements directly
- Groups complement operations clearly in parentheses

### 4. Five's Complement Notation: Addition of negatives ✅

**Decision:** `(-5 + 1)` for five's complement subtraction

**Example:** `7 - 4 = 7 + (-5 + 1) = 3`

**Rationale:** This directly maps to bead movements:

- `-5` = deactivate heaven bead
- `+1` = activate earth bead

---

## Appendix: Worked Examples

### Example 1: 7 - 4 = 3 (Five's Complement Subtraction)

**Initial state:** 7 = heaven(5) + earth(2)
**Goal:** Subtract 4
**Skill:** `fiveComplementsSub['-4=-5+1']`

**Decision:**

- a = 7, d = 4
- a >= d ✓ (no borrow needed)
- d = 4, earth beads L = 2
- L < d, so can't remove 4 earth beads directly
- Heaven is active, so use five's complement

**Steps:**

1. Deactivate heaven bead: -5 (state: 2)
2. Add back (5-4)=1 earth bead: +1 (state: 3)

**Decomposition:** `7 - 4 = 7 + (-5 + 1) = 3`

### Example 2: 12 - 5 = 7 (Simple Ten's Borrow)

**Initial state:** 12 = tens(1) + earth(2)
**Goal:** Subtract 5
**Skill:** `tenComplementsSub['-5=+5-10']`

**Decision at ones place:**

- a = 2, d = 5
- a < d, need to borrow from tens
- tens = 1 ≠ 0, so simple borrow (no cascade)

**Steps:**

1. Borrow from tens: -10 (state: 2)
2. Add complement to ones: +5 (state: 7)

**Decomposition:** `12 - 5 = 12 + (-10 + 5) = 7`

### Example 3: 100 - 1 = 99 (Cascade Borrow)

**Initial state:** 100 = hundreds(1)
**Goal:** Subtract 1
**Skills:** `tenComplementsSub['-1=+9-10']` + Cascade

**Decision at ones place (processing left-to-right):**

- At hundreds: digit to subtract = 0, skip
- At tens: digit to subtract = 0, skip
- At ones: digit to subtract = 1
  - a = 0, d = 1
  - a < d, need to borrow
  - tens = 0, cascade required
  - Find first non-zero: hundreds = 1

**Steps:**

1. Borrow from hundreds: -100
2. Fill tens with 9: +90
3. Add 10 to ones (completing the borrow): +10
4. Subtract 1 from ones: -1

**Decomposition:** `100 - 1 = 100 + (-100 + 90 + 10 - 1) = 99`

Or grouped by operation:
`100 - 1 = 100 + (-100 + 90 + 9) = 99`

**Net check:** -100 + 90 + 10 - 1 = -1 ✓

### Example 4: 52 - 27 = 25 (Multi-digit with mixed operations)

**Initial state:** 52 = tens(5) + earth(2)
**Goal:** Subtract 27

**Processing left-to-right (tens first, then ones):**

**Tens place:** subtract 2

- a = 5, d = 2
- a >= d ✓, direct subtraction
- Terms: `-20`

**Ones place:** subtract 7

- a = 2, d = 7
- a < d, need to borrow from tens
- tens = 3 ≠ 0, simple borrow
- Skill: `tenComplementsSub['-7=+3-10']`
- Terms: `-10`, `+3`

**Full decomposition:** `52 - 27 = 52 + (-20) + (-10 + 3) = 25`
