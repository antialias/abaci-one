# Soroban Pedagogical Expansion Algorithm

## Overview

This algorithm generates pedagogical expansions that show how to perform arithmetic operations on a soroban (Japanese abacus) by analyzing physical bead movement constraints and current abacus state.

## Key Principle

The LHS (starting value) is ALREADY on the abacus. The pedagogical expansion only shows how to perform the operation (addend/RHS) to reach the target value.

## Addition Algorithm

### Setup

- Abacus shows LHS value (already displayed)
- RHS is the addend (number to add)
- Leave an extra blank rod on the left to absorb carries
- Target = LHS + RHS

### Process - Left to Right Processing

For each digit at place P from most-significant to least-significant:

1. **Setup for Place P**
   - Let `d` = RHS digit at place P. If `d = 0`, continue to next place.
   - Let `a` = current digit showing at place P (0–9)

2. **Decision: Direct Addition vs 10's Complement**
   - **If `a + d ≤ 9` (no carry needed):** Add within place P
   - **If `a + d ≥ 10` (carry needed):** Use 10's complement

3. **Case A: Direct Addition at Place P (a + d ≤ 9)**

   **For d ≤ 4:**
   - If you can push `d` lower beads: do it directly
   - Else (not enough lower capacity, upper bead is up): Use 5's complement:
     - Add 5 (activate upper bead)
     - Subtract `(5 - d)` (remove lower beads)
     - Expression: `d ≡ (+5) − (5 − d)`

   **For d ≥ 5:**
   - Activate the upper bead (it must be up in Case A) and push `d − 5` lowers.
   - **Always fits:** Case A gives `d ≤ 9 − a`, hence `d − 5 ≤ 4 − a`.

4. **Case B: 10's Complement (a + d ≥ 10)**

   **Ripple-Carry Process:**
   - Find the nearest higher non-9 place value
   - Increment that place by 1
   - Set any intervening 9s to 0

   **Subtraction at Place P:**
   - Let `s = 10 - d`
   - Subtract `s` at place P by raising lower beads and (if down) the upper bead
   - **No borrow needed at P:** Since `a + d ≥ 10`, we have `a ≥ 10 - d = s`, so subtraction is always physically possible

   **Expression:** `d ≡ (+10) − (10 − d)` (realize +10 via ripple‑carry)

5. **Continue to Next Place**
   - Move to next place value to the right
   - Repeat process

### Invariant

After finishing each place, every rod shows a single decimal digit (0–9), and the abacus equals LHS + the processed prefix of RHS.

## Worked Examples

### Example 1: 268 + 795 = 1063

```
Start: 2|6|8
Hundreds (7): a=2, d=7, a+d=9 ≤ 9 → Direct addition (5+2 lowers)
  Result: 9|6|8
Tens (9): a=6, d=9, a+d=15 ≥ 10 → 10's complement
  Ripple-carry: hundreds=9 → set to 0, increment thousands → 1|0|6|8
  Subtract (10-9)=1 from tens: 6-1=5 → 1|0|5|8
Ones (5): a=8, d=5, a+d=13 ≥ 10 → 10's complement
  Carry: tens 5→6
  Subtract (10-5)=5 from ones: 8-5=3
Result: 1|0|6|3 = 1063
```

### Example 2: 999 + 1 = 1000

```
Start: 9|9|9
Ones (1): a=9, d=1, a+d=10 ≥ 10 → 10's complement
  Ripple-carry across 9s: increment thousands to 1, clear hundreds and tens to 0
  Subtract (10-1)=9 from ones: 9-9=0
Result: 1|0|0|0 = 1000
```

### Example 3: 4 + 3 = 7 (5's Complement)

```
Start: 4 (upper up, 4 lowers down)
Ones (3): a=4, d=3, a+d=7 ≤ 9 → But can't push 3 more lowers (max is 4 lowers total)
  Use 5's complement: 3 = (5 - 2)
  Drop upper bead (+5), raise 2 lowers (-2)
Result: 7 (upper down, 2 lowers down) = 7
```

### Example 4: 7 + 8 = 15 (10's Complement)

```
Start: 7 (upper down, 2 lowers down)
Ones (8): a=7, d=8, a+d=15 ≥ 10 → 10's complement
  Ripple-carry: increment tens by 1
  Subtract s = 10 - d = 2 at ones: 7 - 2 = 5 (no borrow needed, s ≤ a)
Result: tens +1, ones = 5 → 15
```

## Subtraction Algorithm

**TODO: Implement in separate sprint**

- Similar logic but with borrowing instead of carrying
- Will use complement patterns for subtraction operations

## Implementation Notes

### State Tracking

- Must track current bead positions for each place value
- Earth beads: 0-4 active per place
- Heaven bead: 0-1 active per place
- Maximum value per place: 9

### Room Checking

- Before any bead movement, verify physical space available
- Earth beads: check if adding N beads exceeds 4 total
- Heaven bead: check if already activated
- Place value: check if adding would exceed 9

### Expression Generation

- Each complement becomes a parenthesized sub-expression
- Maintain mathematical correctness: original = replacement
- Show pedagogical value of the decomposition

## Critical Success Factors

1. **Always start with LHS already on abacus**
2. **Process RHS systematically from highest to lowest place value**
3. **Use appropriate complement when direct entry impossible**
4. **Generate meaningful parenthesized expressions**
5. **Ensure mathematical correctness of all replacements**

---

**NOTE TO SELF:** This is the correct algorithm understanding. Reference this if we get disconnected or confused during implementation!
