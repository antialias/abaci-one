# Operators

The `operator` setting controls what type of arithmetic problems appear on the worksheet.

## Options

### `addition`
Only addition problems.

```
    47
  + 85
  ────
```

**Scaffolding used:** carryBoxes, answerBoxes, placeValueColors, tenFrames

### `subtraction`
Only subtraction problems.

```
    72
  - 38
  ────
```

**Scaffolding used:** borrowNotation, borrowingHints, answerBoxes, placeValueColors

**Note:** Subtraction uses different scaffolding (borrowNotation/borrowingHints instead of carryBoxes/tenFrames) because the regrouping process is conceptually different.

### `mixed`
Both addition and subtraction problems, randomly interspersed.

**When to use:**
- Student has mastered both operations separately
- Preparing for timed tests or real-world applications
- Building operational flexibility

**Caution:** Mixing operations too early can confuse students who haven't automated each operation independently.

## Pedagogical Sequence

### Traditional Approach
1. **Addition without regrouping** → learn alignment
2. **Addition with regrouping** → learn carrying
3. **Subtraction without regrouping** → learn inverse operation
4. **Subtraction with regrouping** → learn borrowing
5. **Mixed operations** → build flexibility

### Why Addition First?
- Carrying is conceptually simpler than borrowing
- "Making groups of 10" builds on counting knowledge
- Errors are easier to check (count up to verify)

### Why Not Skip Ahead?
Students who learn addition and subtraction together often:
- Confuse carrying and borrowing
- Make sign errors (adding when they should subtract)
- Develop slower automaticity

## Regrouping in Subtraction

Borrowing (subtraction regrouping) is cognitively harder because:
- Requires recognizing "can't do this" situations
- Involves reducing a digit (counterintuitive)
- Changes two columns at once

**Recommendation:** Master addition regrouping to 90%+ accuracy before introducing subtraction regrouping.

## Scaffolding Differences

| Scaffolding | Addition | Subtraction |
|-------------|----------|-------------|
| carryBoxes | ✓ | - |
| tenFrames | ✓ | - |
| borrowNotation | - | ✓ |
| borrowingHints | - | ✓ |
| answerBoxes | ✓ | ✓ |
| placeValueColors | ✓ | ✓ |

When using `mixed` operator, all scaffolding types may appear depending on the specific problem.
