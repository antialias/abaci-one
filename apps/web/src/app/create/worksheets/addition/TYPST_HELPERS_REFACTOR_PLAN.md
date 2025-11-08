# typstHelpers.ts Refactoring Plan

## Problem Statement

The `typstHelpers.ts` file has grown to **793 lines** and contains massive template literal strings that make it difficult to:

1. **Edit accurately** - String matching for edits is error-prone due to nested template expressions
2. **Navigate** - Hard to find specific sections within large Typst functions
3. **Test** - Cannot easily unit test individual Typst rendering logic
4. **Maintain** - Changes require careful attention to bracket matching and string escaping

## Current Structure

```typescript
typstHelpers.ts (793 lines)
├── generateTypstHelpers(cellSize)              ~75 lines
├── generateProblemStackFunction(cellSize)      ~235 lines  ⚠️ LARGE
├── generateSubtractionProblemStackFunction()   ~360 lines  ⚠️ VERY LARGE
└── generateProblemTypst() [DEPRECATED]         ~90 lines
```

### Pain Points

1. **`generateSubtractionProblemStackFunction` is 360 lines** of dense Typst template
   - Contains nested conditionals for: borrowing hints, place value colors, ten-frames, etc.
   - Difficult to locate specific features (e.g., arrow rendering at line ~467)
   - Hard to edit without breaking bracket matching

2. **Template literal hell** - Mixing TypeScript and Typst syntax:

   ```typescript
   `#if show-colors {
     box[#diagonal-split-box(${cellSize}, ...)]  // TypeScript interpolation
   } else {
     box[...]
   }`;
   ```

3. **Duplicate code** between addition and subtraction functions
   - Both have similar grid structures, cell rendering, answer boxes
   - Borrow boxes (subtraction) vs. Carry boxes (addition) have parallel logic

## Refactoring Strategy

### Phase 1: Extract Typst Components to Separate Files (High Priority)

**Goal**: Break large functions into smaller, composable Typst templates.

Create new files:

```
typstHelpers/
├── index.ts                      # Re-exports everything
├── shared/
│   ├── colors.ts                 # Color constants
│   ├── helpers.ts                # ten-frames, diagonal-split-box
│   └── types.ts                  # TypeScript types
├── addition/
│   ├── carryBoxes.ts             # Carry box row rendering
│   ├── addendRows.ts             # Addend row rendering
│   ├── answerRow.ts              # Answer box row rendering
│   └── problemStack.ts           # Main problem-stack function
└── subtraction/
    ├── borrowBoxes.ts            # Borrow box row rendering (with hints/arrows)
    ├── minuendRow.ts             # Minuend row rendering
    ├── subtrahendRow.ts          # Subtrahend row rendering
    ├── answerRow.ts              # Answer box row rendering (shared?)
    └── problemStack.ts           # Main subtraction-problem-stack function
```

**Benefits**:

- Each file is 50-150 lines instead of 350+
- Easier to locate and edit specific features
- Can share common components (answer rows, cell rendering)
- Better separation of concerns

### Phase 2: Extract Reusable Typst Snippets (Medium Priority)

**Goal**: Create helper functions for frequently duplicated Typst patterns.

```typescript
// Example: Render a cell with optional color and stroke
export function generateCellBox(
  cellSize: number,
  options: { showColor: boolean; showStroke: boolean },
): string {
  const stroke = options.showStroke ? ", stroke: 0.5pt" : "";
  return `box(width: ${cellSize}in, height: ${cellSize}in${stroke})`;
}

// Example: Render place() helper
export function generatePlaceBlock(
  position: string,
  dx: number,
  dy: number,
  content: string,
): string {
  return `#place(
    ${position},
    dx: ${dx}in,
    dy: ${dy}in,
    ${content}
  )`;
}
```

**Benefits**:

- Reduces duplication
- Consistent formatting across all Typst generation
- Easier to change common patterns (e.g., cell styling)

### Phase 3: Add Unit Tests (Medium Priority)

**Goal**: Test individual Typst generators in isolation.

```typescript
// tests/typstHelpers/borrowBoxes.test.ts
describe("generateBorrowBoxes", () => {
  it("renders arrow when showBorrowingHints is true", () => {
    const typst = generateBorrowBoxes({ showBorrowingHints: true });
    expect(typst).toContain("path(");
    expect(typst).toContain("[▼]");
  });

  it("does not use place value colors (fixed per design)", () => {
    const typst = generateBorrowBoxes({ showPlaceValueColors: true });
    expect(typst).not.toContain("diagonal-split-box");
    expect(typst).toContain("stroke: 0.5pt");
  });
});
```

**Benefits**:

- Catch regressions when editing Typst templates
- Document expected behavior
- Faster feedback than manual worksheet generation

### Phase 4: Centralize Magic Numbers (Low Priority)

**Goal**: Extract hardcoded values to named constants.

```typescript
// typstHelpers/constants.ts
export const TYPST_CONSTANTS = {
  CELL_STROKE_WIDTH: 0.5,
  TEN_FRAME_STROKE_WIDTH: 0.8,
  TEN_FRAME_CELL_STROKE_WIDTH: 0.4,
  ARROW_STROKE_WIDTH: 1.5,

  // Positioning offsets
  ARROW_START_DX: 0.9,
  ARROW_START_DY: 0.15,
  ARROWHEAD_DX: 0.96,
  ARROWHEAD_DY: 0.62,

  // Sizing
  HINT_TEXT_SIZE_FACTOR: 0.25,
  ARROWHEAD_SIZE_FACTOR: 0.35,
} as const;
```

**Benefits**:

- Easier to adjust visual parameters
- Self-documenting code
- Reduces magic number proliferation

## Implementation Plan

### Step 1: Create Directory Structure

```bash
mkdir -p src/app/create/worksheets/addition/typstHelpers/{shared,addition,subtraction}
touch src/app/create/worksheets/addition/typstHelpers/index.ts
```

### Step 2: Extract Shared Components (Week 1)

1. Move `color-*` definitions to `shared/colors.ts`
2. Move `ten-frames-stacked`, `diagonal-split-box` to `shared/helpers.ts`
3. Create `shared/types.ts` for TypeScript interfaces

### Step 3: Split Subtraction Function (Week 1-2)

1. Extract borrow box rendering to `subtraction/borrowBoxes.ts`
   - Keep arrow rendering self-contained
   - Document the "no place value colors" decision
2. Extract minuend row to `subtraction/minuendRow.ts`
3. Extract subtrahend row to `subtraction/subtrahendRow.ts`
4. Extract answer row to `subtraction/answerRow.ts` (or share with addition?)
5. Refactor `generateSubtractionProblemStackFunction` to compose these pieces

### Step 4: Split Addition Function (Week 2)

1. Extract carry box rendering to `addition/carryBoxes.ts`
2. Extract addend rows to `addition/addendRows.ts`
3. Extract answer row to `addition/answerRow.ts`
4. Refactor `generateProblemStackFunction` to compose these pieces

### Step 5: Update Imports (Week 2)

1. Update `typstGenerator.ts` to import from new structure
2. Update `example/route.ts` to import from new structure
3. Ensure all existing consumers work unchanged (backward compatibility)

### Step 6: Add Tests (Week 3)

1. Add unit tests for each extracted component
2. Add integration tests for full problem stack generation
3. Verify output matches current worksheets byte-for-byte

## Migration Strategy

### Backward Compatibility

**Option A: Maintain Old Exports**

- Keep `typstHelpers.ts` as a facade that re-exports from new structure
- Consumers don't need to change imports immediately
- Can gradually migrate to new imports

**Option B: Update All Consumers**

- Change all imports to use new structure immediately
- More disruptive but cleaner

**Recommendation**: Option A - maintain backward compatibility during migration.

```typescript
// typstHelpers.ts (old file becomes facade)
export * from "./typstHelpers/index";

// typstHelpers/index.ts (new entry point)
export { generateTypstHelpers } from "./shared/helpers";
export { generateProblemStackFunction } from "./addition/problemStack";
export { generateSubtractionProblemStackFunction } from "./subtraction/problemStack";
```

### Validation

After each refactoring step:

1. ✅ Run `npm run type-check` - no new errors
2. ✅ Run `npm run lint` - no new warnings
3. ✅ Generate test worksheet - byte-for-byte match with current output
4. ✅ Visual inspection - worksheets look identical

## Success Criteria

- [ ] No file exceeds 200 lines
- [ ] Each component has a single, clear responsibility
- [ ] Adding new features (e.g., new display option) only requires editing 1-2 files
- [ ] All tests pass
- [ ] Generated worksheets are byte-for-byte identical to current output

## Timeline

- **Week 1**: Extract shared components + split subtraction function
- **Week 2**: Split addition function + update imports
- **Week 3**: Add tests + documentation

Total estimated effort: **3 weeks** (can be done incrementally)

## Risk Mitigation

1. **Breaking changes**: Maintain backward compatibility via facade pattern
2. **Output differences**: Validate byte-for-byte match after each step
3. **Merge conflicts**: Work in feature branch, frequent small PRs
4. **Lost context**: Document decisions (e.g., "no place value colors in borrow boxes")

## Future Enhancements

After initial refactoring:

1. **Template system**: Consider using a proper Typst template engine
2. **Visual regression testing**: Screenshot comparison for worksheets
3. **Configuration builder**: Type-safe builders for worksheet generation
4. **Shared answer row**: Unify addition/subtraction answer box rendering
