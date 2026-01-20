# Flowchart Walker Modification Skill

This document captures patterns and lessons learned from modifying the flowchart walker system, specifically from the fraction addition/subtraction sprint where we:

- Split a single "calculate" step into separate numerator, denominator, and whole number checkpoints
- Added conditional skipping for optional steps
- Fixed grid dimension stability issues

## Architecture Overview

Each flowchart has **two parts** that must stay in sync:

| Part            | Location                                     | Purpose                                              |
| --------------- | -------------------------------------------- | ---------------------------------------------------- |
| JSON definition | `definitions/*.flow.json`                    | Node types, validation logic, variables, constraints |
| Mermaid content | `definitions/index.ts` (embedded) or `*.mmd` | Visual presentation, node text, phases               |

**Critical**: Many flowcharts embed Mermaid content in `definitions/index.ts` as constants (e.g., `FRACTION_MERMAID`, `LINEAR_EQUATIONS_MERMAID`). Always check there first before looking for `.mmd` files.

## Adding a New Checkpoint Node

### Step 1: Add Variables (if needed)

In the JSON definition's `variables` section, add computed values the checkpoint will use:

```json
"variables": {
  "existingVar": { "init": "someExpression" },
  "newVar": { "init": "leftNum + rightNum" },
  "conditionalVar": { "init": "condition ? valueIfTrue : valueIfFalse" }
}
```

**Expression syntax**: Uses JavaScript-like expressions with access to:

- Problem input fields (e.g., `leftNum`, `rightDenom`, `op`)
- Other computed variables
- Built-in functions: `gcd()`, `lcm()`, `abs()`, `floor()`, `ceil()`, `min()`, `max()`

### Step 2: Add the Checkpoint Node

In the JSON definition's `nodes` section:

```json
"NEW_CHECKPOINT": {
  "type": "checkpoint",
  "prompt": "What's the answer?",
  "inputType": "number",
  "expected": "variableName",
  "workingProblemUpdate": {
    "result": "expression for new working problem display",
    "label": "Description of what changed"
  }
}
```

**Checkpoint input types**:

- `"number"` - Single numeric input
- `"text"` - Text input
- `"two-numbers"` - Two inputs with `inputLabels: ["First", "Second"]` and `orderMatters: boolean`

### Step 3: Update Edges

In the JSON definition's `edges` section, wire up the new node:

```json
"edges": {
  "PREVIOUS_NODE": ["NEW_CHECKPOINT"],
  "NEW_CHECKPOINT": ["NEXT_NODE"]
}
```

### Step 4: Add Mermaid Content

Find where the Mermaid content lives (usually `definitions/index.ts`) and add the node:

```
NEW_CHECKPOINT["<b>🔢 CHECKPOINT TITLE</b>
───────────
Instructions for the user
go here"]
```

**Mermaid node format**:

- `[" ... "]` for rounded rectangle (checkpoint/instruction)
- `{" ... "}` for diamond (decision)
- First line in `<b>...</b>` becomes the title
- Subsequent lines become body text

### Step 5: Add to Phase (if applicable)

In the Mermaid content, ensure the node is in the correct subgraph:

```
subgraph phase3["3. 🎯 DO THE MATH!"]
  EXISTING_NODE
  NEW_CHECKPOINT
end
```

## Adding Conditional Skip (skipIf)

For checkpoints that should be skipped under certain conditions:

```json
"OPTIONAL_CHECKPOINT": {
  "type": "checkpoint",
  "prompt": "What's the whole number?",
  "inputType": "number",
  "expected": "resultWhole",
  "skipIf": "!hasWholeNumbers",
  "skipTo": "NEXT_NODE_WHEN_SKIPPED",
  "excludeSkipFromPaths": true
}
```

### The `excludeSkipFromPaths` Flag

**Critical for grid stability**: By default, a checkpoint with `skipIf` creates TWO paths in path enumeration (skip path and non-skip path), which affects example grid dimensions.

| Flag Value        | Behavior                                  | Use When                                                                |
| ----------------- | ----------------------------------------- | ----------------------------------------------------------------------- |
| `false` (default) | skipIf creates branching paths            | The skip represents a **structural difference** in problem types        |
| `true`            | skipIf is runtime-only, no path branching | The skip is an **optional step** that doesn't define problem categories |

**Example**: CALC_WHOLE uses `excludeSkipFromPaths: true` because whether a problem has whole numbers is incidental - it doesn't define a fundamentally different problem type for the grid.

## Understanding Path Enumeration and Grid Dimensions

The example picker grid dimensions come from **decision nodes with `pathLabel`** options:

```json
"DECISION_NODE": {
  "type": "decision",
  "correctAnswer": "someCondition",
  "options": [
    {
      "label": "YES ✓",
      "value": "yes",
      "next": "PATH_A",
      "pathLabel": "Same",        // Used for path concatenation
      "gridLabel": "Same denominators"  // Used for grid headers
    },
    {
      "label": "NO",
      "value": "no",
      "next": "PATH_B",
      "pathLabel": "Diff",
      "gridLabel": "Different denominators"
    }
  ]
}
```

**How grid dimensions are determined**:

1. `enumerateAllPaths()` walks all possible paths through the flowchart
2. Each path collects `pathLabel` values from decision nodes
3. Unique combinations of decisions define grid rows/columns
4. The `gridLabel` values become human-readable headers

**What affects grid stability**:

- Decision nodes with `pathLabel` options → YES, defines grid structure
- Checkpoint nodes (normal) → NO, just increments step count
- Checkpoint nodes with `skipIf` and `excludeSkipFromPaths: false` → YES, creates path branches
- Checkpoint nodes with `skipIf` and `excludeSkipFromPaths: true` → NO, runtime only

## Common Patterns

### Pattern: Breaking One Step into Multiple Inputs

**Before**: Single "I did it" instruction node
**After**: Multiple checkpoint nodes for each input

```json
// Before
"CALCULATE": {
  "type": "instruction",
  "advance": "tap"
}

// After
"CALC_NUMERATOR": {
  "type": "checkpoint",
  "prompt": "What's the numerator?",
  "inputType": "number",
  "expected": "rawResultNum"
},
"CALC_DENOMINATOR": {
  "type": "checkpoint",
  "prompt": "What's the denominator?",
  "inputType": "number",
  "expected": "lcd",
  "workingProblemUpdate": {
    "result": "rawResultNum + '/' + lcd",
    "label": "Calculated fraction"
  }
}
```

### Pattern: Optional Step Based on Problem Values

```json
"OPTIONAL_STEP": {
  "type": "checkpoint",
  "prompt": "...",
  "inputType": "number",
  "expected": "someVar",
  "skipIf": "!conditionForShowing",
  "skipTo": "NEXT_AFTER_SKIP",
  "excludeSkipFromPaths": true  // Don't affect grid dimensions
}
```

### Pattern: Working Problem Evolution

Track how the problem transforms through the solution:

```json
"workingProblem": {
  "initial": "(leftWhole > 0 ? (leftWhole + ' ') : '') + leftNum + '/' + leftDenom + ' ' + op + ' ' + ..."
}
```

Then update it at key checkpoints:

```json
"workingProblemUpdate": {
  "result": "newExpression",
  "label": "What operation was performed"
}
```

## Debugging Tips

### Grid Dimensions Unstable

1. Check if any checkpoint has `skipIf` without `excludeSkipFromPaths: true`
2. Increase example generation count (in `generateExamplesForStructure`, currently 1050)
3. Verify decision nodes have consistent `pathLabel` values

### Checkpoint Not Appearing

1. Check the `skipIf` condition - is it evaluating correctly?
2. Verify edges connect to the node
3. Check Mermaid content has the node defined

### Wrong Expected Value

1. Check variable initialization expressions
2. Use the DEBUG panel to see computed values
3. Test with known problem values

## Files Reference

| File                                           | Purpose                                 |
| ---------------------------------------------- | --------------------------------------- |
| `src/lib/flowcharts/schema.ts`                 | TypeScript types for all node types     |
| `src/lib/flowcharts/loader.ts`                 | Merges JSON + Mermaid, path enumeration |
| `src/lib/flowcharts/evaluator.ts`              | Expression evaluation engine            |
| `src/lib/flowcharts/definitions/index.ts`      | Registry + embedded Mermaid content     |
| `src/lib/flowcharts/definitions/*.flow.json`   | JSON behavior definitions               |
| `src/components/flowchart/FlowchartWalker.tsx` | Main UI component                       |

## Checklist for Flowchart Modifications

- [ ] Added necessary variables in JSON `variables` section
- [ ] Added node definition in JSON `nodes` section
- [ ] Updated JSON `edges` to wire up the node
- [ ] Added Mermaid content for the node (check `index.ts` first!)
- [ ] Added node to correct phase subgraph in Mermaid
- [ ] If using `skipIf`, decided on `excludeSkipFromPaths` value
- [ ] Tested with problems that exercise the new path
- [ ] Verified grid dimensions are stable (roll dice multiple times)
- [ ] Run `npm run pre-commit` to verify no type errors
