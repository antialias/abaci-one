# Scaffolding Options

Scaffolding refers to visual aids on the worksheet that support students learning multi-digit arithmetic. As students gain proficiency, scaffolding is systematically removed.

## Scaffolding Elements

### `carryBoxes`

Small boxes above each column where students write carry digits.

```
      ┌─┐ ┌─┐
      │1│ │ │    ← carry boxes
      └─┘ └─┘
        4   7
      + 8   5
      ─────────
      1 3   2
```

**When useful:** Learning to track carries, preventing "forgotten carries" errors.

### `answerBoxes`

Individual boxes for each digit of the answer, enforcing place value alignment.

```
        4   7
      + 8   5
      ─────────
      ┌─┐ ┌─┐ ┌─┐
      │1│ │3│ │2│  ← answer boxes
      └─┘ └─┘ └─┘
```

**When useful:** Students who misalign digits or have spatial organization difficulties.

### `placeValueColors`

Color-coding by place value: ones (blue), tens (green), hundreds (red), etc.

**When useful:** Reinforcing place value concept, helping visual learners, preventing column confusion.

### `tenFrames`

Visual 10-dot grids showing regrouping concretely.

```
  ●●●●●  ●●●●●     7 + 5 = 12
  ●●○○○  ○○○○○
                   ●●●●●  ●●
                   ●●●●●  ○○  = 10 + 2
```

**When useful:** Building conceptual understanding of why regrouping works.

### `borrowNotation` (subtraction)

Scratch work showing the borrowing process.

```
       3 12        ← shows 4 became 3, 2 became 12
        4  2
      - 1  7
      ──────
        2  5
```

### `borrowingHints` (subtraction)

Visual indicators showing which columns need borrowing.

## Display Rule Values

Each scaffolding element can be set to:

| Value                  | Meaning                                       |
| ---------------------- | --------------------------------------------- |
| `always`               | Show on every problem                         |
| `never`                | Never show                                    |
| `whenRegrouping`       | Show only on problems that require regrouping |
| `whenMultipleRegroups` | Show only on problems with 2+ regroups        |
| `when3PlusDigits`      | Show only for numbers with 3+ digits          |
| `auto`                 | System decides based on mastery data          |

## Scaffolding Progression

The pedagogical principle: **Introduce scaffolding to support learning, then systematically remove it.**

### Level 0: Maximum Support (Beginner)

```
carryBoxes: 'always'
answerBoxes: 'always'
placeValueColors: 'always'
tenFrames: 'always'
```

Student sees all visual aids, even on problems that don't need regrouping. This teaches the structure.

### Level 4-6: Conditional Support (Practice)

```
carryBoxes: 'whenRegrouping'
answerBoxes: 'always'
placeValueColors: 'whenRegrouping'
tenFrames: 'whenRegrouping'
```

Scaffolding appears only when relevant. Student starts internalizing when it's needed.

### Level 8-10: Minimal Support (Advanced)

```
carryBoxes: 'never'
answerBoxes: 'never'
placeValueColors: 'when3PlusDigits'
tenFrames: 'never'
```

Student works independently. Colors only for large numbers where tracking columns is harder.

### Level 12: No Scaffolding (Expert)

```
carryBoxes: 'never'
answerBoxes: 'never'
placeValueColors: 'never'
tenFrames: 'never'
```

Clean worksheet. Student has internalized the process.

## Choosing Scaffolding Levels

**Key insight:** Scaffolding and regrouping difficulty should be balanced.

- High regrouping + High scaffolding = Learning the skill with support
- High regrouping + Low scaffolding = Mastery practice
- Low regrouping + High scaffolding = Not useful (overscaffolding simple problems)
- Low regrouping + Low scaffolding = Also not useful (nothing to scaffold)

The difficulty profiles manage this balance automatically.
