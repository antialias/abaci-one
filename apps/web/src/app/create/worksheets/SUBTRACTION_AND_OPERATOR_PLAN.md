# Subtraction Support and Operator Selection Plan

## Overview

Add support for subtraction problems and allow users to choose between addition, subtraction, or mixed operations on worksheets.

## Phase 1: Operator Selection UI

### UI Component Location

`src/app/create/worksheets/addition/components/ConfigPanel.tsx`

### New Setting: `operator`

Add operator selector control in the Basic Settings section, right after the digit range slider.

**Type Definition:**

```typescript
// types.ts
export type WorksheetOperator = "addition" | "subtraction" | "mixed";

export interface WorksheetFormState {
  // ... existing fields
  operator: WorksheetOperator; // NEW
}
```

**Default Value:** `'addition'` (backward compatible)

**UI Design:**

```tsx
{
  /* Operator Selection */
}
<div className={stack({ gap: "2" })}>
  <label className={css({ fontSize: "sm", fontWeight: "semibold" })}>
    {t("config.operator.label")}
  </label>

  <div className={hstack({ gap: "2" })}>
    <Button
      variant={formState.operator === "addition" ? "primary" : "secondary"}
      onClick={() => onChange({ operator: "addition" })}
    >
      Addition Only (+)
    </Button>

    <Button
      variant={formState.operator === "subtraction" ? "primary" : "secondary"}
      onClick={() => onChange({ operator: "subtraction" })}
    >
      Subtraction Only (−)
    </Button>

    <Button
      variant={formState.operator === "mixed" ? "primary" : "secondary"}
      onClick={() => onChange({ operator: "mixed" })}
    >
      Mixed (+/−)
    </Button>
  </div>

  <p className={css({ fontSize: "xs", color: "gray.600" })}>
    {formState.operator === "mixed"
      ? "Problems will randomly use addition or subtraction"
      : formState.operator === "addition"
        ? "All problems will be addition"
        : "All problems will be subtraction"}
  </p>
</div>;
```

**Considerations:**

- When operator is 'subtraction' or 'mixed', ensure minuend ≥ subtrahend (no negative answers)
- Update `difficultyProfiles.ts` if needed to account for subtraction difficulty
- Mixed mode: Should alternate or randomize? → **Randomize** for variety

---

## Phase 2: Subtraction Problem Generation

### File: `problemGenerator.ts`

**New Function:**

```typescript
export interface SubtractionProblem {
  minuend: number;
  subtrahend: number;
  operator: "-";
}

/**
 * Generate subtraction problems ensuring minuend ≥ subtrahend (no negatives)
 */
export function generateSubtractionProblems(
  count: number,
  digitRange: { min: number; max: number },
  pAnyBorrow: number, // Probability any place needs borrowing
  pAllBorrow: number, // Probability all places need borrowing
  interpolate: boolean,
  seed: number,
): SubtractionProblem[];
```

**Key Constraints:**

1. `minuend ≥ subtrahend` (prevent negative results)
2. `minuend > 0` (no zero minuends)
3. Both numbers within digit range
4. Control borrowing probability similar to carry probability for addition

**Borrowing Detection:**

```typescript
function requiresBorrowing(minuend: number, subtrahend: number): boolean {
  let m = minuend;
  let s = subtrahend;

  while (m > 0 || s > 0) {
    const mDigit = m % 10;
    const sDigit = s % 10;

    if (mDigit < sDigit) return true;

    m = Math.floor(m / 10);
    s = Math.floor(s / 10);
  }

  return false;
}
```

**Mixed Mode Generation:**

```typescript
export function generateMixedProblems(
  count: number,
  digitRange: { min: number; max: number },
  pAnyRegroup: number, // Probability any place needs regrouping (carry OR borrow)
  pAllRegroup: number, // Probability all places need regrouping
  interpolate: boolean,
  seed: number,
): (AdditionProblem | SubtractionProblem)[] {
  const rng = seedrandom(seed.toString());
  const problems: (AdditionProblem | SubtractionProblem)[] = [];

  for (let i = 0; i < count; i++) {
    const useAddition = rng() < 0.5; // 50/50 mix

    if (useAddition) {
      // Generate addition problem
    } else {
      // Generate subtraction problem
    }
  }

  return problems;
}
```

---

## Phase 3: Subtraction Typst Rendering

### File: `typstHelpers.ts`

**New Function:**

```typescript
export function generateSubtractionProblemStackFunction(
  cellSize: number,
  maxDigits: number = 3,
): string;
```

**Typst Function Signature:**

```typst
#let subtraction-problem-stack(
  minuend,           // e.g., 52
  subtrahend,        // e.g., 17
  index-or-none,     // Problem number or none
  show-borrows,      // Show borrow boxes
  show-answers,      // Show answer boxes
  show-colors,       // Show place value colors
  show-ten-frames,   // Show ten-frame visualization
  show-numbers       // Show problem numbers
) = {
  // Implementation
}
```

### Key Differences from Addition

**1. Borrow Boxes (instead of Carry Boxes)**

Position: Above the minuend row

Visual:

- Top triangle: Source place value color (giving the 10)
- Bottom triangle: Destination place value color (receiving the 10)
- Direction: RIGHT to LEFT (opposite of addition)

Example for 52 - 17:

```
[Borrow boxes]     [  ] [B1→0]
[Minuend]          [ 5] [ 2]
[Subtrahend]     − [ 1] [ 7]
[Line]           ----------
[Answer boxes]     [A1] [A0]
```

**2. Actual Digits Calculation**

```typst
// Extract minuend and subtrahend digits
let minuend-digits = ()
let subtrahend-digits = ()
// ... extraction loop (same as addition)

// Find highest non-zero positions
let minuend-highest = 0
let subtrahend-highest = 0
// ... detection loop

// Calculate difference
let difference = minuend - subtrahend

// Find highest non-zero digit in difference
let diff-highest = 0
let temp-diff = difference
for i in range(0, max-extraction) {
  if calc.rem(temp-diff, 10) > 0 { diff-highest = i }
  temp-diff = calc.floor(temp-diff / 10)
}

// Grid size based on MINUEND (not difference)
// But answer boxes only show up to diff-highest
let grid-digits = calc.max(minuend-highest, subtrahend-highest) + 1
let answer-digits = diff-highest + 1  // Can be less than grid-digits!
```

**3. Borrow Detection**

```typst
let borrow-places = ()
let needs-borrow-from = () // Track which place borrowed FROM

for i in range(0, grid-digits) {
  let m-digit = minuend-digits.at(i)
  let s-digit = subtrahend-digits.at(i)

  // Check if this place needs a borrow
  if m-digit < s-digit {
    borrow-places.push(i)

    // Mark that we borrowed FROM i+1
    if i + 1 < grid-digits {
      needs-borrow-from.push(i + 1)
    }
  }
}
```

**4. Borrow Boxes Row**

```typst
// Borrow boxes row (shows borrows FROM higher TO lower)
[], // Empty cell for operator column
..for i in range(0, grid-digits).rev() {
  let shows-borrow = show-borrows and (i in needs-borrow-from)

  if shows-borrow {
    // This place borrowed FROM to give to i-1
    let source-color = place-colors.at(i)      // This place (giving)
    let dest-color = place-colors.at(i - 1)    // Lower place (receiving)

    if show-colors {
      (box(width: cellSizeIn, height: cellSizeIn)[
        #diagonal-split-box(cellSizeIn, source-color, dest-color)
      ],)
    } else {
      (box(width: cellSizeIn, height: cellSizeIn, stroke: 0.5pt)[],)
    }
  } else {
    (box(width: cellSizeIn, height: cellSizeIn)[
      #v(cellSizeIn)
    ],)
  }
},
```

**5. Ten-Frames for Borrowing**

Show ten-frames for places where borrowing occurs.

Visual concept for ones place of 52 - 17:

- Need to compute: (2 + 10) - 7 = 5
- Top frame: Show 10 (borrowed from tens)
- Bottom frame: Show the 5 filled dots (result after borrowing)

```typst
..if show-ten-frames {
  let regrouping-places = borrow-places  // Places that needed borrowing

  if regrouping-places.len() > 0 {
    (
      [], // Empty cell for operator column
      ..for i in range(0, grid-digits).rev() {
        let shows-frame = show-ten-frames-for-all or (i in regrouping-places)

        if shows-frame {
          // Show borrowed amount and result
          let m-digit = minuend-digits.at(i)
          let s-digit = subtrahend-digits.at(i)
          let borrowed-value = m-digit + 10
          let result = borrowed-value - s-digit

          // Top frame: 10 (borrowed)
          // Bottom frame: result
          let top-color = if i + 1 < grid-digits { place-colors.at(i + 1) } else { color-none }
          let bottom-color = place-colors.at(i)

          (box(width: cellSizeIn, height: cellSizeIn * 0.8)[
            #align(center + top)[
              #ten-frames-stacked(
                cellSizeIn * 0.90,
                if show-colors { top-color } else { color-none },
                if show-colors { bottom-color } else { color-none }
              )
            ]
            #place(top, line(length: cellSizeIn * 0.90, stroke: heavy-stroke))
          ],)
        } else {
          (v(cellSizeIn * 0.8),)
        }
      },
    )
  } else {
    ()
  }
}
```

**6. Answer Boxes (hide leading zeros in difference)**

```typst
// Answer boxes row
[], // Empty cell for operator column
..for i in range(0, grid-digits).rev() {
  let place-color = place-colors.at(i)
  let fill-color = if show-colors { place-color } else { color-none }

  // Only show answer box if within actual answer digits
  let shows-answer = show-answers and i < answer-digits

  if shows-answer {
    (box(width: cellSizeIn, height: cellSizeIn, stroke: 0.5pt, fill: fill-color)[],)
  } else {
    // No answer box for leading zero positions
    (box(width: cellSizeIn, height: cellSizeIn)[
      #v(cellSizeIn)
    ],)
  }
},
```

**7. Operator Symbol**

Change the operator cell from "+" to "−":

```typst
// Subtrahend row with − sign
box(width: cellSizeIn, height: cellSizeIn)[
  #align(center + horizon)[
    #text(size: cellSizePt * 0.8)[−]  // Use minus sign, not hyphen
  ]
],
```

---

## Phase 4: Update typstGenerator.ts

### Unified Problem Type

```typescript
// types.ts
export type WorksheetProblem = AdditionProblem | SubtractionProblem;

export interface AdditionProblem {
  a: number;
  b: number;
  operator: "+";
  // Display flags added by enrichment
  showCarryBoxes?: boolean;
  showAnswerBoxes?: boolean;
  showPlaceValueColors?: boolean;
  showTenFrames?: boolean;
  showProblemNumbers?: boolean;
  showCellBorder?: boolean;
}

export interface SubtractionProblem {
  minuend: number;
  subtrahend: number;
  operator: "−"; // Use proper minus sign
  // Display flags added by enrichment
  showBorrowBoxes?: boolean;
  showAnswerBoxes?: boolean;
  showPlaceValueColors?: boolean;
  showTenFrames?: boolean;
  showProblemNumbers?: boolean;
  showCellBorder?: boolean;
}
```

### Update generatePageTypst

```typescript
function generatePageTypst(
  config: WorksheetConfig,
  pageProblems: WorksheetProblem[], // Can be addition or subtraction
  problemOffset: number,
  rowsPerPage: number,
): string {
  // Enrich problems based on operator type
  const enrichedProblems = pageProblems.map((p, index) => {
    if (p.operator === "+") {
      // Addition enrichment (existing logic)
      if (config.mode === "smart") {
        const meta = analyzeProblem(p.a, p.b);
        const displayOptions = resolveDisplayForProblem(
          config.displayRules,
          meta,
        );
        return { ...p, ...displayOptions };
      } else {
        return {
          ...p,
          showCarryBoxes: config.showCarryBoxes,
          showAnswerBoxes: config.showAnswerBoxes,
          // ... etc
        };
      }
    } else {
      // Subtraction enrichment (NEW)
      if (config.mode === "smart") {
        const meta = analyzeSubtractionProblem(p.minuend, p.subtrahend);
        const displayOptions = resolveDisplayForProblem(
          config.displayRules,
          meta,
        );
        return {
          ...p,
          showBorrowBoxes: displayOptions.showCarryBoxes, // Map carry → borrow
          showAnswerBoxes: displayOptions.showAnswerBoxes,
          // ... etc
        };
      } else {
        return {
          ...p,
          showBorrowBoxes: config.showCarryBoxes, // Use same setting
          showAnswerBoxes: config.showAnswerBoxes,
          // ... etc
        };
      }
    }
  });

  // Generate Typst with correct function calls
  const problemsTypst = enrichedProblems
    .map((p) => {
      if (p.operator === "+") {
        return `  (operator: "+", a: ${p.a}, b: ${p.b}, showCarryBoxes: ${p.showCarryBoxes}, ...),`;
      } else {
        return `  (operator: "-", minuend: ${p.minuend}, subtrahend: ${p.subtrahend}, showBorrowBoxes: ${p.showBorrowBoxes}, ...),`;
      }
    })
    .join("\n");

  // In Typst template:
  return String.raw`
    // ... setup

    ${generateTypstHelpers(cellSize)}
    ${generateProblemStackFunction(cellSize, maxDigits)}
    ${generateSubtractionProblemStackFunction(cellSize, maxDigits)}

    #let problem-box(problem, index) = {
      if problem.operator == "+" {
        problem-stack(
          problem.a,
          problem.b,
          index,
          problem.showCarryBoxes,
          problem.showAnswerBoxes,
          // ... etc
        )
      } else {
        subtraction-problem-stack(
          problem.minuend,
          problem.subtrahend,
          index,
          problem.showBorrowBoxes,
          problem.showAnswerBoxes,
          // ... etc
        )
      }
    }

    // ... rest of template
  `;
}
```

---

## Phase 5: Problem Analysis for Subtraction

### File: `problemAnalysis.ts`

**New Function:**

```typescript
export interface SubtractionProblemMeta {
  minuend: number;
  subtrahend: number;
  digitsMinuend: number;
  digitsSubtrahend: number;
  maxDigits: number;
  difference: number;
  digitsDifference: number;
  requiresBorrowing: boolean;
  borrowCount: number;
  borrowPlaces: Array<
    "ones" | "tens" | "hundreds" | "thousands" | "ten-thousands"
  >;
}

export function analyzeSubtractionProblem(
  minuend: number,
  subtrahend: number,
): SubtractionProblemMeta {
  const digitsMinuend = Math.floor(Math.log10(minuend)) + 1;
  const digitsSubtrahend = Math.floor(Math.log10(subtrahend)) + 1;
  const maxDigits = Math.max(digitsMinuend, digitsSubtrahend);
  const difference = minuend - subtrahend;
  const digitsDifference =
    difference === 0 ? 1 : Math.floor(Math.log10(difference)) + 1;

  // Detect borrowing
  const borrowPlaces: SubtractionProblemMeta["borrowPlaces"] = [];
  let m = minuend;
  let s = subtrahend;
  let placeNames: SubtractionProblemMeta["borrowPlaces"][number][] = [
    "ones",
    "tens",
    "hundreds",
    "thousands",
    "ten-thousands",
  ];

  let placeIndex = 0;
  while (m > 0 || s > 0) {
    const mDigit = m % 10;
    const sDigit = s % 10;

    if (mDigit < sDigit) {
      borrowPlaces.push(placeNames[placeIndex]);
    }

    m = Math.floor(m / 10);
    s = Math.floor(s / 10);
    placeIndex++;
  }

  return {
    minuend,
    subtrahend,
    digitsMinuend,
    digitsSubtrahend,
    maxDigits,
    difference,
    digitsDifference,
    requiresBorrowing: borrowPlaces.length > 0,
    borrowCount: borrowPlaces.length,
    borrowPlaces,
  };
}
```

---

## Phase 6: Display Rules for Subtraction

### File: `displayRules.ts`

**Update resolveDisplayForProblem:**

```typescript
export function resolveDisplayForProblem(
  rules: DisplayRules,
  meta: ProblemMeta | SubtractionProblemMeta,
): DisplayOptions {
  // Detect problem type
  const isSubtraction = "minuend" in meta;
  const requiresRegrouping = isSubtraction
    ? meta.requiresBorrowing
    : meta.requiresRegrouping;

  // Borrow boxes / Carry boxes
  const showCarryBoxes =
    rules.carryBoxes === "always" ||
    (rules.carryBoxes === "whenRegrouping" && requiresRegrouping);

  // ... rest of resolution logic (same for both operations)

  return {
    showCarryBoxes, // For subtraction, this means "show borrow boxes"
    showAnswerBoxes,
    showPlaceValueColors,
    showTenFrames,
    showProblemNumbers,
    showCellBorder,
  };
}
```

**Note:** We reuse `showCarryBoxes` flag for both operations. The rendering functions interpret it as "show carry boxes" for addition and "show borrow boxes" for subtraction.

---

## Phase 7: Auto-Save and Persistence

### Update `useWorksheetAutoSave.ts`

Add `operator` to persisted fields:

```typescript
const {
  // ... existing fields
  operator, // NEW
} = formState;

const response = await fetch("/api/worksheets/settings", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    type: worksheetType,
    config: {
      // ... existing fields
      operator, // NEW
    },
  }),
});
```

---

## Phase 8: Preview and Example Routes

### Update `/api/create/worksheets/addition/preview`

```typescript
// Support operator field in config
const problems =
  config.operator === "addition"
    ? generateProblems(/* ... */)
    : config.operator === "subtraction"
      ? generateSubtractionProblems(/* ... */)
      : generateMixedProblems(/* ... */);
```

### Update `/api/create/worksheets/addition/example`

Add operator selection for display options preview:

```typescript
interface ExampleRequest {
  // ... existing fields
  operator?: "addition" | "subtraction"; // NEW
}

function generateExampleTypst(config: ExampleRequest): string {
  const operator = config.operator || "addition";

  // Generate appropriate problem type
  if (operator === "addition") {
    // ... existing addition logic
  } else {
    // Generate subtraction problem
    const minuend = config.addend1 ?? 52;
    const subtrahend = config.addend2 ?? 17;

    return String.raw`
      // ... setup
      ${generateSubtractionProblemStackFunction(cellSize, 3)}

      #let minuend = ${minuend}
      #let subtrahend = ${subtrahend}

      #align(center + horizon)[
        #subtraction-problem-stack(
          minuend,
          subtrahend,
          if show-numbers { 0 } else { none },
          show-carries,  // Interpreted as show-borrows for subtraction
          show-answers,
          show-colors,
          show-ten-frames,
          show-numbers
        )
      ]
    `;
  }
}
```

---

## Phase 9: UI Updates for Display Options Preview

### Update `DisplayOptionsPreview.tsx`

Add operator selector to preview component:

```tsx
export function DisplayOptionsPreview({
  formState,
}: DisplayOptionsPreviewProps) {
  // Local state for operands
  const [operands, setOperands] = useState([45, 27]);
  const [operator, setOperator] = useState<"addition" | "subtraction">(
    formState.operator === "subtraction" ? "subtraction" : "addition",
  );

  // Sync with formState.operator changes
  useEffect(() => {
    if (
      formState.operator === "subtraction" ||
      formState.operator === "addition"
    ) {
      setOperator(formState.operator);
    }
  }, [formState.operator]);

  const [debouncedOptions, setDebouncedOptions] = useState({
    // ... existing fields
    operator, // NEW
  });

  return (
    <div data-component="display-options-preview">
      <div className={hstack({ gap: "2", align: "center" })}>
        <div>Preview</div>

        {/* Operator toggle (only show if formState is mixed) */}
        {formState.operator === "mixed" && (
          <div className={hstack({ gap: "1" })}>
            <button
              onClick={() => setOperator("addition")}
              className={operator === "addition" ? "active" : ""}
            >
              +
            </button>
            <button
              onClick={() => setOperator("subtraction")}
              className={operator === "subtraction" ? "active" : ""}
            >
              −
            </button>
          </div>
        )}

        <MathSentence
          operands={operands}
          operator={operator === "addition" ? "+" : "−"}
          onChange={setOperands}
        />
      </div>

      {/* SVG preview */}
    </div>
  );
}
```

---

## Phase 10: Validation Updates

### File: `validation.ts`

Add operator validation:

```typescript
export const worksheetConfigSchema = z.object({
  // ... existing fields
  operator: z.enum(["addition", "subtraction", "mixed"]).default("addition"),
});
```

Ensure subtraction constraints:

```typescript
if (config.operator === "subtraction" || config.operator === "mixed") {
  // Validate that we can generate valid subtraction problems
  // (minuend ≥ subtrahend within digit range)
}
```

---

## Testing Strategy

### Unit Tests

1. **Problem Generation:**
   - `generateSubtractionProblems()` always produces minuend ≥ subtrahend
   - Borrowing probability controls work correctly
   - Mixed mode produces 50/50 distribution

2. **Problem Analysis:**
   - `analyzeSubtractionProblem()` correctly detects borrowing
   - Handles edge cases (100-99=1, 1000-1=999, etc.)

3. **Display Rules:**
   - Smart mode correctly applies conditional scaffolding for subtraction
   - Borrow detection works for all place values

### Integration Tests

1. **Typst Rendering:**
   - Subtraction problems render with correct operator (−)
   - Borrow boxes appear in correct positions
   - Answer boxes hide leading zeros correctly
   - Ten-frames show borrowing visualization

2. **Preview:**
   - Display options preview works for subtraction
   - Changing operator updates preview correctly
   - Mixed mode shows both addition and subtraction examples

### Manual Testing Scenarios

1. **Simple subtraction (no borrowing):** 85 - 32
2. **Single borrow:** 52 - 17
3. **Multiple borrows:** 534 - 178
4. **Borrow from zero:** 301 - 89
5. **Chain borrowing:** 1000 - 1
6. **Result with leading zeros hidden:** 100 - 99 = 1
7. **Large numbers:** 99999 - 12345
8. **Mixed worksheet:** Alternating + and −

---

## Migration Path

### Backward Compatibility

1. Existing worksheets default to `operator: 'addition'`
2. All existing UI works unchanged (addition only)
3. New operator selector is opt-in

### Database Migration

If storing worksheet templates:

```sql
ALTER TABLE worksheet_settings
ADD COLUMN operator VARCHAR(20) DEFAULT 'addition';
```

---

## Implementation Order

1. ✅ **Phase 1:** Add operator UI selector (ConfigPanel.tsx)
2. ✅ **Phase 2:** Generate subtraction problems (problemGenerator.ts)
3. ✅ **Phase 3:** Analyze subtraction problems (problemAnalysis.ts)
4. ✅ **Phase 4:** Render subtraction in Typst (typstHelpers.ts)
5. ✅ **Phase 5:** Update typstGenerator.ts for unified rendering
6. ✅ **Phase 6:** Update display rules for subtraction
7. ✅ **Phase 7:** Auto-save operator setting
8. ✅ **Phase 8:** Update preview/example routes
9. ✅ **Phase 9:** Update DisplayOptionsPreview component
10. ✅ **Phase 10:** Validation and testing

---

## Open Questions

1. **Negative results:** Should we allow worksheets with negative answers? (Probably not for elementary level)
2. **Zero borrowing:** How to visualize 100-100=0? Show single 0 in answer row?
3. **Ten-frame content for borrowing:** Show borrowed 10 + minuend digit, or show the result after subtraction?
4. **Mixed mode distribution:** Should it be exactly 50/50, or allow user to specify the ratio?
5. **Difficulty profiles:** Do we need separate difficulty profiles for subtraction vs addition?

---

## Notes

- Use proper minus sign (−, U+2212) not hyphen (-) in UI and Typst
- Reuse as much addition infrastructure as possible (smart mode, display rules, etc.)
- Keep the same visual language (colors, ten-frames, scaffolding) for consistency
- Consider renaming the folder from `addition/` to `arithmetic/` in the future
