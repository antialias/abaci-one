# Digit Range

The digit range controls how many digits each number in a problem can have.

## Parameters

### `digitRange.min` (1-5)
Minimum number of digits per operand.

### `digitRange.max` (1-5)
Maximum number of digits per operand.

## Examples

| min | max | Example Problems |
|-----|-----|------------------|
| 1 | 1 | 7 + 5, 9 - 3 |
| 2 | 2 | 47 + 85, 72 - 38 |
| 2 | 3 | 47 + 285, 538 - 72 |
| 3 | 3 | 472 + 385, 841 - 256 |
| 3 | 5 | 472 + 38541, 84123 - 256 |

## Pedagogical Considerations

### Start Small
Begin with 2-digit numbers even if the student can handle larger ones. This:
- Reduces cognitive load while learning regrouping
- Allows focus on the process, not the numbers
- Builds automaticity before scaling up

### When to Increase
Move to larger numbers when the student:
- Is consistently accurate (90%+) with current size
- Shows automaticity (doesn't need to think about each step)
- Expresses boredom with current level

### Mixed Ranges (min ≠ max)
Using different min and max creates variety:
- `{ min: 2, max: 3 }` mixes 2-digit and 3-digit numbers
- Prevents pattern recognition ("all problems look the same")
- More realistic (real-world arithmetic has mixed sizes)

### Large Numbers (4-5 digits)
For 4+ digit numbers:
- Consider keeping `placeValueColors` longer (prevents column confusion)
- May need more columns on the worksheet
- Portrait orientation may work better than landscape

## Common Progressions

### Standard Progression
1. 2-digit (master regrouping concept)
2. 3-digit (extend to more columns)
3. 2-3 digit mixed (build flexibility)
4. 4+ digit (for enrichment or specific needs)

### For Students Struggling with Place Value
1. Start with 1-digit (no alignment needed)
2. Move to 2-digit with `answerBoxes: 'always'`
3. Gradually remove scaffolding before increasing digits

### For Advanced Students
- Can skip 2-digit phase if already proficient
- Jump to 3-digit with appropriate scaffolding
- Use 4-5 digits for challenge problems
