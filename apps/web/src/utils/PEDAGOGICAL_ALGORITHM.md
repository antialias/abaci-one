# Soroban Pedagogical Expansion Algorithm

## Overview
This algorithm generates pedagogical expansions that show how to perform arithmetic operations on a soroban (Japanese abacus) by analyzing physical bead movement constraints.

## Key Principle
The LHS (starting value) is ALREADY on the abacus. The pedagogical expansion only shows how to perform the operation (RHS) to reach the target value.

## Addition Algorithm

### Input
- Current abacus state = LHS value (already displayed)
- Operation to perform = RHS value (the number to add)
- Target = LHS + RHS

### Process
1. **Parse RHS digit by digit from highest place value to lowest**
2. **For each digit D at place value P:**

   **Step A: Try Direct Entry**
   - Attempt to add digit D directly by moving beads at place P
   - If successful, continue to next digit

   **Step B: Try 5's Complement**
   - If direct entry fails, try using heaven bead
   - Replace D with `(5 + (D-5))` if heaven bead available
   - If successful, continue to next digit

   **Step C: Try 10's Complement**
   - If heaven bead already active OR digit still won't fit
   - Add 10 to place value P+1 (next highest place)
   - Subtract `(10 - D)` from place value P
   - Expression: `D = (10 - (10-D))`

   **Step D: Try 100's Complement**
   - If can't add 10 to P+1 (because it shows 9)
   - Add 100 to place value P+2
   - Subtract 90 from place value P+1
   - Subtract `(10 - D)` from place value P

   **Step E: Try 1000's Complement**
   - If can't add 100 to P+2 (because it shows 9)
   - Add 1000 to place value P+3
   - Subtract 900 from place value P+2
   - Subtract 90 from place value P+1
   - Subtract `(10 - D)` from place value P

   **Step F: Continue Pattern**
   - Keep cascading up place values as needed
   - Each level adds the next power of 10 and subtracts appropriate complements

3. **Generate Parenthesized Expressions**
   - Each complement operation becomes a parenthesized replacement
   - Example: `7 = (10 - 3)` for ten's complement
   - Example: `6 = (5 + 1)` for five's complement

4. **Process Left to Right**
   - Continue until entire RHS is processed
   - Each digit gets handled with appropriate complement strategy

## Examples

### Direct Entry
- `4 + 3 = 7` → No complement needed, direct bead movement

### Five's Complement
- `0 + 6 = 0 + (5 + 1) = 6` → Replace 6 with (5 + 1)

### Ten's Complement
- `4 + 7 = 4 + (10 - 3) = 11` → Replace 7 with (10 - 3)

### Multi-Place Processing
- `89 + 25` → Process as `80 + 9 + 20 + 5`
- Handle 20 first (add to tens place), then 5 (add to ones place)

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