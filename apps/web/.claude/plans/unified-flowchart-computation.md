# Unified Flowchart Computation System

## Summary

Transform the flowchart system from "compute everything upfront, walk is cosmetic" to "walk IS the computation". State flows through nodes via transforms, accumulating values until the terminal state becomes the answer.

**No backwards compatibility** - Seeds will be migrated to the new model.

## Key Design Decisions

1. **Transform Ordering**: Within a node's `transform`, later keys CAN reference earlier ones (evaluated in order).
2. **Display Format**: Context-driven (walker uses web, worksheets use typst, tests use text).
3. **Checkpoint Expected**: Uses expressions that reference accumulated state from prior transforms.
4. **History Granularity**: One snapshot per NODE, not per field.
5. **Error Handling**: Transform failures set value to `null`, mark `hasError: true`, continue walking.
6. **No Variables Section**: Remove `variables` from schema - all computation happens in node transforms.
7. **Database-Only**: Flowcharts are loaded exclusively from the database via seeds (per commit 454f93faa).
8. **Single Answer Computation Path**: ALL answer computation goes through `simulateWalk()` - no parallel code paths.

## Architecture Changes

### Current Architecture (Being Replaced)
```
Problem Input → Initialize Variables → Walk (cosmetic) → Terminal
                    ↑
            All computation happens here at init

Answer computed in MULTIPLE places:
- evaluateDisplayAnswer (test validator)
- FlowchartWalker (debug skip)
- worksheet-generator
- example-generator (path complexity)
```

### New Architecture
```
Problem Input → Walk + Transform at each node → Accumulate State → Terminal = Answer
                    ↑
            Computation happens progressively during walk

Answer computed in ONE place:
- simulateWalk() → extractAnswer()
  Used by: walker, worksheets, tests, example generator
```

---

## Transform Placement Strategy

### The Core Principle

**Transforms go on the node where the computation becomes pedagogically relevant.**

Computation happens **at the node where the student encounters that concept**:

```
Node: "What operation is stuck to x?"     ← Transform: isAddition = operation == '+'
  ↓
Node: "Undo the operation"                ← Transform: afterConstant = isAddition ? ...
  ↓
Node: "What is x?"                        ← Transform: answer = afterConstant / coefficient
```

Transforms represent "what we now know" after visiting this node. This mirrors how a student accumulates understanding as they work through the problem.

### Placement Rules by Node Type

| Node Type | When to Add Transform | Example |
|-----------|----------------------|---------|
| **Decision** | Compute values needed to determine which branch | `needsBorrow = onesDigit < subtrahendOnes` |
| **Checkpoint** | Compute the expected answer for validation | `expectedDifference = minuend - subtrahend` |
| **Instruction** | Compute values referenced in instruction content | `lcd = lcm(denom1, denom2)` before "The LCD is {{lcd}}" |
| **Terminal** | Compute final answer if not already computed | `finalAnswer = numerator + '/' + denominator` |
| **Entry Node** | Compute initial derived values from problem input | `totalValue = whole * denom + num` |

### Migration Example: Linear Equations

**Before (variables section - all at once):**
```json
"variables": {
  "isAddition": { "init": "operation == '+'" },
  "isMultiplied": { "init": "coefficient > 1" },
  "afterConstant": { "init": "isAddition ? (equals - constant) : (equals + constant)" },
  "answer": { "init": "afterConstant / coefficient" }
}
```

**After (node transforms - progressive):**
```json
"nodes": {
  "HOWSTUCK": {
    "type": "decision",
    "transform": [
      { "key": "hasConstant", "expr": "constant != 0" }
    ],
    "correctAnswer": "hasConstant",
    "options": [...]
  },
  "MAKEZ": {
    "type": "checkpoint",
    "transform": [
      { "key": "isAddition", "expr": "operation == '+'" },
      { "key": "constantToAdd", "expr": "isAddition ? (0 - constant) : constant" },
      { "key": "afterConstant", "expr": "isAddition ? (equals - constant) : (equals + constant)" }
    ],
    "expected": "constantToAdd",
    "prompt": "What do you do to both sides?"
  },
  "MAKEONE": {
    "type": "checkpoint",
    "transform": [
      { "key": "answer", "expr": "afterConstant / coefficient" }
    ],
    "expected": "coefficient",
    "prompt": "What do you divide both sides by?"
  }
}
```

### LLM Guidance for Transform Placement

The LLM system prompt will include these rules:

1. **Decision nodes MUST have transforms** that compute the values used in `correctAnswer`
2. **Checkpoint nodes SHOULD have transforms** that compute the `expected` value
3. **Transforms execute in order** - later transforms can reference earlier ones in the same node
4. **Don't compute too early** - wait until the node where the value is needed
5. **Don't compute too late** - the value must exist before it's referenced in `expected`, `correctAnswer`, or content templates

---

## Expression Evaluator

### Using the Existing Evaluator

We use the existing custom expression evaluator in `src/lib/flowcharts/evaluator.ts`. It's secure (no JavaScript `eval()`) and already battle-tested.

**Supported syntax:**
```
Field access:    minuend, left.denom, problem.coefficient
Arithmetic:      +, -, *, /, %
Comparison:      ==, !=, <, >, <=, >=
Boolean:         &&, ||, !
Ternary:         condition ? trueValue : falseValue
Functions:       lcm(a,b), gcd(a,b), min(a,b), max(a,b), abs(x), floor(x), ceil(x), mod(a,b)
Literals:        42, "string", true, false, null
String concat:   "x = " + answer (+ with string operand)
```

### EvalContext Interface

```typescript
interface EvalContext {
  problem: Record<string, ProblemValue>   // Problem input (minuend, subtrahend, etc.)
  computed: Record<string, ProblemValue>  // Accumulated transform values
  userState: Record<string, ProblemValue> // User-entered values during walk
  input?: ProblemValue                    // Special: current checkpoint input being validated
}
```

### Transform Execution Model

Transforms execute **in order within a node**, with each result immediately available to subsequent transforms:

```typescript
function applyTransform(state: FlowchartState, node: CompiledNode): FlowchartState {
  const transforms = node.definition.transform || []
  const newValues = { ...state.values }  // Copy accumulated values

  for (const { key, expr } of transforms) {
    const context: EvalContext = {
      problem: state.problem,
      computed: newValues,      // Includes results from earlier transforms in this loop
      userState: state.userState,
    }

    try {
      const result = evaluate(expr, context)  // Uses existing evaluator
      newValues[key] = result                 // Immediately available to next transform
    } catch (error) {
      newValues[key] = null
      // Mark error but continue - don't break the walk
    }
  }

  return { ...state, values: newValues }
}
```

**Example execution:**
```json
"transform": [
  { "key": "isAddition", "expr": "operation == '+'" },
  { "key": "toSubtract", "expr": "isAddition ? constant : (0 - constant)" }
]
```

With `problem = { operation: '+', constant: 5, ... }`:

1. Evaluate `operation == '+'`
   - Context: `{ problem: {...}, computed: {} }`
   - Result: `isAddition = true`

2. Evaluate `isAddition ? constant : (0 - constant)`
   - Context: `{ problem: {...}, computed: { isAddition: true } }`
   - Result: `toSubtract = 5`

### Potential Evaluator Enhancements

The current evaluator should handle most cases. Potential additions if needed:

| Function | Purpose | Example |
|----------|---------|---------|
| `sign(x)` | Return -1, 0, or 1 | `sign(-5) → -1` |
| `round(x, n)` | Round to n decimal places | `round(3.14159, 2) → 3.14` |
| `simplifyFrac(n, d)` | Return simplified [num, denom] | `simplifyFrac(4, 8) → [1, 2]` |

These can be added to `evaluator.ts` if flowcharts need them. For now, we proceed with the existing function set.

---

## AUDIT: Current Answer Computation Locations

The following locations currently compute answers and must all be migrated to use `simulateWalk()`:

### 1. `evaluateDisplayAnswer()` in test-case-validator.ts:151
**Current behavior**: Evaluates `display.answer` expression against computed variables
**Used by**:
- `worksheet-generator.ts:176` - Worksheet answer key
- `WorksheetDebugPanel.tsx:291` - Problem = Answer display on worksheet tab
- `test-case-validator.ts:201,245` - Test case validation

**Migration**: Replace with `simulateWalk() + extractAnswer()`

### 2. `initializeState()` in loader.ts
**Current behavior**: Computes ALL variables upfront at initialization via `variables` section
**Used by**:
- `FlowchartWalker.tsx:87` - Walker initialization
- `example-generator.ts:352,392` - Constraint validation during generation

**Migration**: Remove variable computation from init. State starts with problem input only.

### 3. `createContextFromState()` + `evaluate()` in FlowchartWalker.tsx:374
**Current behavior**: Used in debug skip to compute checkpoint expected values
**Location**: `debugSkipStep` callback

**Migration**: Use `simulateWalk()` to get the terminal state, then read expected values from accumulated state

### 4. `calculatePathComplexity()` in loader.ts
**Current behavior**: Simulates walking to determine path taken (for example generation)
**Used by**:
- `example-generator.ts:658,898` - Path verification during generation

**Migration**: Rename to `simulateWalk()`, make it the canonical answer computation function

### 5. `validateFlowchartConstraints()` in example-generator.ts:337
**Current behavior**: Evaluates variables to check constraints
**Used by**:
- Example generation constraint checking

**Migration**: Use `simulateWalk()` to get state, then check constraints against accumulated values

### 6. `satisfiesPathConstraints()` in example-generator.ts:379
**Current behavior**: Evaluates variables to check path constraints
**Used by**:
- Example generation path validation

**Migration**: Use `simulateWalk()` to verify path taken matches expected path

---

## Schema Changes (schema.ts)

```typescript
// NEW TYPES
interface TransformExpression {
  key: string    // Variable name to create/update
  expr: string   // Expression to evaluate
}

interface DisplayTemplate {
  text: string   // Plain text (for tests, simple display)
  web?: string   // MathML (for browser)
  typst?: string // For PDF worksheets
}

interface AnswerDefinition {
  values: Record<string, string>  // Map answer component names to variable refs (e.g., {"answer": "result"})
  display: DisplayTemplate
}

interface StructuredTestCase {
  name: string
  values: Record<string, ProblemValue>
  expected: Record<string, ProblemValue>  // Primitives, not strings
}

// Snapshot of state at a specific node (for trace visualization)
interface StateSnapshot {
  nodeId: string
  nodeTitle?: string                      // Human-readable node title for display
  values: Record<string, ProblemValue>    // Accumulated values after this node
  transforms: TransformExpression[]       // Transforms that were applied at this node
  workingProblem?: string                 // Working problem display after this node
  timestamp: number
}

// MODIFICATIONS TO EXISTING TYPES
// Add to BaseNode:
transform?: TransformExpression[]

// FlowchartDefinition changes:
// REMOVE: variables: Record<string, VariableDefinition>  // No longer needed
// ADD:
answer: AnswerDefinition  // Required - defines final answer extraction
tests?: StructuredTestCase[]

// FlowchartState changes:
// REMOVE: computed: Record<string, ProblemValue>  // No upfront computation
// ADD:
values: Record<string, ProblemValue>  // Accumulated transform values (starts with problem input)
snapshots: StateSnapshot[]  // History of state at each node visited
hasError: boolean
```

---

## New Feature: Problem Trace with Node Highlighting

### User Experience

When a user expands a problem in the worksheet tab, they see:
1. **Trace Timeline**: A vertical list of steps showing the problem's progression through nodes
2. **Working Problem Evolution**: Each step shows how the working problem changed (e.g., "45 - 27" → "45 - 27 = ?" → "45 - 27 = 18")
3. **Transform Details**: Each step shows transforms applied (e.g., `difference = minuend - subtrahend → 18`)
4. **Node Highlighting**: Hovering over a trace step highlights the corresponding node in the mermaid diagram
5. **State Inspector**: Optional expandable view of full accumulated state at each step

### Trace Step Display Format

Each trace step shows:
```
┌─────────────────────────────────────────────┐
│ ● Node: "Subtract the ones"                 │
│   Working: 45 - 27 → 45 - 27 = ?           │
│   Transform: onesDigit = minuend % 10 → 5   │
│              needsBorrow = onesDigit < ...  │
└─────────────────────────────────────────────┘
```

### Component Structure

```
WorksheetDebugPanel
  └── ProblemCard (expandable)
        ├── Problem Display (collapsed view: "45 - 27 = 18")
        └── ProblemTrace (expanded view)
              ├── TraceTimeline
              │     └── TraceStep[] (vertical list of nodes visited)
              │           ├── Node title badge
              │           ├── Working problem evolution (before → after)
              │           ├── Transform list (key: expr → result)
              │           └── onHover → setHighlightedNodeId(nodeId)
              └── Final Answer display

DebugMermaidDiagram (already exists)
  └── New prop: highlightedNodeId?: string
        - Applies distinct highlight style (cyan border, subtle pulse)
        - Different visual from currentNodeId (amber fill for walker)
        - Cleared when mouse leaves trace area
```

### Mermaid Highlighting Styles

```
currentNodeId (walker progress):    fill:#fbbf24, stroke:#d97706, stroke-width:4px
highlightedNodeId (trace hover):    fill:#e0f7fa, stroke:#00bcd4, stroke-width:3px, stroke-dasharray:5
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/lib/flowcharts/schema.ts` | Remove `variables`, `VariableDefinition`. Add `TransformExpression`, `DisplayTemplate`, `AnswerDefinition`, `StructuredTestCase`, `StateSnapshot`. Update `FlowchartState`. |
| `src/lib/flowcharts/loader.ts` | Rewrite `initializeState()`, add `applyTransform()`, `extractAnswer()`, `simulateWalk()`. Remove variable computation from init. |
| `src/lib/flowcharts/formatting.ts` | Add `interpolateTemplate()` for `{{name}}` and `{{=expr}}` syntax |
| `src/components/flowchart/FlowchartWalker.tsx` | Call `applyTransform()` when advancing nodes, update state management |
| `src/components/flowchart/DebugMermaidDiagram.tsx` | Add `highlightedNodeId` prop with distinct styling |
| `src/components/flowchart/WorksheetDebugPanel.tsx` | Add trace visualization with hover → highlight integration |
| `src/components/flowchart/ProblemTrace.tsx` | **NEW**: Trace visualization component |
| `src/lib/flowchart-workshop/test-case-validator.ts` | Remove `evaluateDisplayAnswer`, use `simulateWalk()` + `extractAnswer()` |
| `src/lib/flowcharts/worksheet-generator.ts` | Use `simulateWalk()` + `extractAnswer()` |
| `src/lib/flowcharts/example-generator.ts` | Use `simulateWalk()` for path calculation and constraint validation |
| `src/lib/flowcharts/doctor.ts` | Remove variable checks, add transform/answer/test validation |
| `src/lib/flowchart-workshop/llm-schemas.ts` | Remove variables from schemas, add transform/answer/tests, rewrite system prompt |
| `src/lib/flowcharts/definitions/index.ts` | Update seed flowcharts to new format |
| `src/lib/flowcharts/definitions/*.flow.json` | Migrate to new format |

---

## Core Functions

### loader.ts - Single Source of Truth for Answer Computation

```typescript
/**
 * Initialize flowchart state - NO variable computation
 * State starts with problem input only, transforms accumulate during walk
 */
function initializeState(flowchart, problemInput): FlowchartState {
  return {
    problem: problemInput,
    values: { ...problemInput },  // Start with input only
    userState: {},
    currentNode: flowchart.definition.entryNode,
    snapshots: [{
      nodeId: 'initial',
      nodeTitle: 'Start',
      values: { ...problemInput },
      transforms: [],
      workingProblem: formatProblemDisplay(flowchart, problemInput),
      timestamp: Date.now(),
    }],
    hasError: false,
    // ...other fields
  }
}

/**
 * Apply node transforms to state
 * Called when advancing to a new node
 */
function applyTransform(
  state: FlowchartState,
  node: CompiledNode,
  flowchart: ExecutableFlowchart
): FlowchartState {
  const transforms = node.definition.transform || []
  const newValues = { ...state.values }
  let hasError = state.hasError

  for (const { key, expr } of transforms) {
    try {
      const context = createContextFromValues(state.problem, newValues, state.userState)
      const result = evaluate(expr, context)
      newValues[key] = result
    } catch (error) {
      newValues[key] = null
      hasError = true
      console.error(`Transform error at ${node.id}.${key}:`, error)
    }
  }

  // Compute working problem update if defined
  let workingProblem = state.workingProblemHistory[state.workingProblemHistory.length - 1]?.value
  if (node.definition.workingProblemUpdate) {
    try {
      const context = createContextFromValues(state.problem, newValues, state.userState)
      workingProblem = evaluate(node.definition.workingProblemUpdate.result, context) as string
    } catch { /* keep previous */ }
  }

  return {
    ...state,
    values: newValues,
    hasError,
    snapshots: [
      ...state.snapshots,
      {
        nodeId: node.id,
        nodeTitle: node.content?.title || node.id,
        values: { ...newValues },
        transforms,
        workingProblem,
        timestamp: Date.now(),
      }
    ],
  }
}

/**
 * CANONICAL FUNCTION: Simulate walking through flowchart to terminal state
 * This is THE way to compute answers - all other code paths use this
 */
function simulateWalk(
  flowchart: ExecutableFlowchart,
  input: Record<string, ProblemValue>
): FlowchartState {
  let state = initializeState(flowchart, input)
  const maxSteps = 100 // Safety limit

  for (let step = 0; step < maxSteps; step++) {
    const node = flowchart.nodes[state.currentNode]
    if (!node) break

    // Apply transforms for this node
    state = applyTransform(state, node, flowchart)

    // Check if terminal
    if (node.definition.type === 'terminal') break

    // Determine next node based on node type and accumulated state
    const nextNodeId = getNextNode(flowchart, state)
    if (!nextNodeId) break

    state = { ...state, currentNode: nextNodeId }
  }

  return state
}

/**
 * Extract final answer from terminal state
 */
function extractAnswer(
  definition: FlowchartDefinition,
  state: FlowchartState
): {
  values: Record<string, ProblemValue>
  display: { text: string, web: string, typst: string }
} {
  const answerDef = definition.answer
  const values: Record<string, ProblemValue> = {}

  // Extract each answer component from accumulated state
  for (const [name, ref] of Object.entries(answerDef.values)) {
    values[name] = state.values[ref] ?? null
  }

  // Interpolate display templates
  return {
    values,
    display: {
      text: interpolateTemplate(answerDef.display.text, state.values),
      web: interpolateTemplate(answerDef.display.web || answerDef.display.text, state.values),
      typst: interpolateTemplate(answerDef.display.typst || answerDef.display.text, state.values),
    }
  }
}
```

---

## Doctor Diagnostics to Add

| Code | Issue |
|------|-------|
| XFORM-001 | Circular reference in transform |
| XFORM-002 | Transform references undefined variable |
| XFORM-003 | Transform expression syntax error |
| ANS-001 | Answer.values references non-computed value |
| ANS-002 | Answer template interpolation error |
| TEST-004 | Test expected keys don't match answer.values keys |

---

## Implementation Sequence with Testing Checkpoints

### Phase 1: Schema & Core Runtime
**Scope: 3 files, ~250 lines**

1. Update `schema.ts`:
   - Remove `variables`, `VariableDefinition`
   - Add `TransformExpression`, `StateSnapshot`, `DisplayTemplate`, `AnswerDefinition`
   - Update `FlowchartState` to use `values` instead of `computed`, add `snapshots`

2. Add `interpolateTemplate()` to `formatting.ts`

3. Rewrite `initializeState()` in `loader.ts`:
   - State starts with problem input only
   - Initialize snapshots array with initial state

4. Add `applyTransform()` to `loader.ts`

5. Add `extractAnswer()` and `simulateWalk()` to `loader.ts` (rename from `calculatePathComplexity`)

**🧪 CHECKPOINT 1: Core Runtime**
```
Manual Testing:
1. Run `npm run pre-commit` - TypeScript should pass
2. Check that existing tests still compile (they may fail at runtime - that's expected)
3. Open any page that doesn't use flowcharts to verify app still runs
```

---

### Phase 2: Walker Integration
**Scope: 1 file, ~80 lines**

6. Modify `FlowchartWalker.tsx`:
   - When advancing to a new node, call `applyTransform()`
   - Update state with new snapshots
   - Update `debugSkipStep` to use accumulated state instead of evaluating expected

**🧪 CHECKPOINT 2: Walker Transforms**
```
Manual Testing:
1. Load a seeded flowchart in the walker (may need to temporarily keep old variables)
2. Walk through a few steps
3. Open browser devtools, check `state.snapshots` is growing
4. Verify working problem still updates correctly
```

---

### Phase 3: Mermaid Highlighting (for Trace Feature)
**Scope: 1 file, ~40 lines**

7. Update `DebugMermaidDiagram.tsx`:
   - Add `highlightedNodeId?: string` prop
   - Apply distinct highlight style (cyan/dashed) different from currentNodeId (amber)
   - Style clears when prop is null/undefined

**🧪 CHECKPOINT 3: Mermaid Highlighting**
```
Manual Testing:
1. Go to workshop page with a generated flowchart
2. Temporarily add: <DebugMermaidDiagram highlightedNodeId="STEP1" ... />
3. EXPECTED: STEP1 node has cyan dashed border
4. Change to highlightedNodeId="STEP2"
5. EXPECTED: STEP2 now highlighted, STEP1 normal
6. Remove hardcoded prop
```

---

### Phase 4: Problem Trace Component
**Scope: 2 files, ~300 lines**

8. Create `src/components/flowchart/ProblemTrace.tsx`:
   - Accept `snapshots: StateSnapshot[]` prop
   - Render vertical timeline with TraceStep components
   - Each step shows: node title, working problem evolution, transforms applied
   - `onHoverStep(nodeId: string | null)` callback for highlighting

9. Update `WorksheetDebugPanel.tsx`:
   - Import ProblemTrace component
   - When problem card expanded, call `simulateWalk()` to get full trace
   - Pass snapshots to ProblemTrace
   - Connect hover callback to lift `highlightedNodeId` state
   - Pass `highlightedNodeId` to DebugMermaidDiagram

**🧪 CHECKPOINT 4: Trace Visualization**
```
Manual Testing:
1. Go to workshop page with a generated flowchart
2. Switch to Worksheet tab
3. Click to expand a problem in the debug panel
4. EXPECTED: See trace timeline with steps
5. EXPECTED: Each step shows:
   - Node title (e.g., "Check if borrow needed")
   - Working problem (e.g., "45 - 27" → "45 - 27 = ?")
   - Transforms (e.g., "needsBorrow = ... → true")
6. Hover over a trace step
7. EXPECTED: Corresponding mermaid node gets cyan highlight
8. Move mouse away
9. EXPECTED: Highlight clears
10. Click different problem, expand it
11. EXPECTED: Different trace for different path
```

---

### Phase 5: Migrate Answer Computation (Single Code Path)
**Scope: 3 files, ~150 lines**

10. Update `test-case-validator.ts`:
    - Remove `evaluateDisplayAnswer()` function
    - Add `validateStructuredTest()` using `simulateWalk()` + `extractAnswer()`
    - Update `validateTestCaseAnswer()` to use new approach

11. Update `worksheet-generator.ts`:
    - Replace `evaluateDisplayAnswer()` call with `simulateWalk()` + `extractAnswer()`
    - Use `display.typst` from extractAnswer for PDF rendering

12. Update `example-generator.ts`:
    - Replace `validateFlowchartConstraints()` internals to use `simulateWalk()`
    - Replace `satisfiesPathConstraints()` to verify path via snapshots
    - Update `calculatePathComplexity` calls to use `simulateWalk()`

**🧪 CHECKPOINT 5: Single Answer Path**
```
Manual Testing:
1. Generate a worksheet PDF
2. EXPECTED: Answers render correctly in answer key
3. Check worksheet tab problem display
4. EXPECTED: Problem = Answer shows correct answers
5. Run test cases on a flowchart
6. EXPECTED: Test validation still works, passes/fails correctly
7. Generate new examples from flowchart
8. EXPECTED: Examples generate correctly for all paths
```

---

### Phase 6: Static Analysis (Doctor)
**Scope: 1 file, ~150 lines**

13. Update `doctor.ts`:
    - Remove variable-related checks (DRV-*, VAR-*)
    - Add transform validation checks (XFORM-001, XFORM-002, XFORM-003)
    - Add answer definition checks (ANS-001, ANS-002)
    - Add test structure check (TEST-004)

**🧪 CHECKPOINT 6: Doctor Diagnostics**
```
Manual Testing:
1. Create/edit a flowchart with intentional errors:
   a. Transform that references undefined variable → XFORM-002
   b. Transform with syntax error → XFORM-003
   c. Answer.values referencing non-computed value → ANS-001
2. EXPECTED: Doctor catches each error with appropriate code
3. Fix the errors
4. EXPECTED: Doctor shows healthy (no warnings)
```

---

### Phase 7: LLM Integration
**Scope: 1 file, ~400 lines**

14. Update Zod schemas in `llm-schemas.ts`:
    - Remove `VariableEntrySchema`
    - Add `TransformEntrySchema` to node schemas
    - Add `AnswerDefinitionSchema` at flowchart level
    - Add `StructuredTestCaseSchema`

15. Rewrite system prompt:
    - Remove variables section documentation
    - Add transform system documentation with examples
    - Add answer definition documentation
    - Update all examples to use new format
    - Emphasize that transforms accumulate during walk

**🧪 CHECKPOINT 7: LLM Generation**
```
Manual Testing:
1. Create new workshop session
2. Enter topic: "adding single digit numbers"
3. Generate flowchart
4. EXPECTED: Generated flowchart has:
   - No "variables" section at top level
   - Nodes with "transform" arrays where computation happens
   - "answer" definition with values and display
   - "tests" array with structured expected values
5. Walk through generated flowchart
6. EXPECTED: Transforms apply correctly, answer is correct
7. Try refining: "add a step to check the work"
8. EXPECTED: Refinement maintains new schema structure
9. Generate a more complex flowchart: "fraction addition with different denominators"
10. EXPECTED: Transforms for LCD calculation spread across appropriate nodes
```

---

### Phase 8: Seed Migration
**Scope: 4 files, ~300 lines**

16. Migrate seed flowcharts:
    - `subtraction-regrouping.flow.json` - Move borrow check to decision node transform
    - `fraction-add-sub.flow.json` - Distribute LCD/GCD across phase nodes
    - `linear-equations.flow.json` - Move afterConstant/answer to checkpoint transforms

17. Update `definitions/index.ts`:
    - Ensure type definitions match new schema
    - Keep mermaid content unchanged

**🧪 CHECKPOINT 8: Seed Migration (COMPREHENSIVE)**
```
Manual Testing for EACH seed flowchart:

subtraction-regrouping:
1. Delete existing from DB (or clear via Seed Manager)
2. Re-seed via Seed Manager
3. Walk through: 45 - 27 (needs borrow)
4. EXPECTED: Trace shows borrow detection transform
5. Walk through: 85 - 42 (no borrow)
6. EXPECTED: Different path taken
7. Generate worksheet, verify answers

fraction-add-sub:
1. Re-seed
2. Walk through: 1/4 + 1/4 (same denom, no simplify)
3. Walk through: 1/3 + 1/6 (different denom)
4. Walk through: 3/4 - 1/4 (same denom, simplify)
5. EXPECTED: Each path shows appropriate transforms
6. Generate worksheet, verify answers

linear-equations:
1. Re-seed
2. Walk through: x + 5 = 12 (addition constant)
3. Walk through: 3x = 15 (multiplication only)
4. EXPECTED: Trace shows operation detection and solution
5. Generate worksheet, verify answers
```

---

## Final Verification Checklist

After all phases complete:

### 1. TypeScript
```bash
npm run pre-commit
```
EXPECTED: Passes with no errors

### 2. Unit Tests
```bash
npm run test -- --testPathPattern="flowchart"
```
EXPECTED: Tests pass (may need fixture updates)

### 3. Answer Computation Audit
Verify NO remaining uses of:
- `evaluateDisplayAnswer` (should be deleted)
- Direct `computed` access for answer computation
- Variable evaluation outside of `simulateWalk`

Search commands:
```bash
grep -r "evaluateDisplayAnswer" src/
grep -r "state.computed" src/
grep -r "context.computed\[" src/
```
EXPECTED: No results (or only in comments/tests)

### 4. Trace Feature
For each seed flowchart:
- Expand problems in worksheet tab
- Verify trace shows meaningful working problem progression
- Verify hover highlighting works
- Verify transforms show expected calculations

### 5. Worksheet Generation
For each seed flowchart:
- Generate PDF worksheet
- Verify problems render correctly
- Verify answer key is correct

### 6. Doctor Validation
- Run doctor on all seeds
- Verify no false positives
- Verify catches intentionally broken flowcharts

### 7. LLM Generation
- Generate 3 different flowcharts via workshop
- Verify all produce valid new-format schemas
- Verify generated flowcharts work end-to-end

---

## Rollback Plan

If issues arise:
1. Seeds are version-controlled in `definitions/` - revert those files
2. Schema changes are isolated to `schema.ts` - revert that file
3. Runtime changes are isolated to `loader.ts` - revert that file
4. Database flowcharts can be re-seeded from reverted definitions

---

## Notes on Backwards Compatibility

**No backwards compatibility is maintained.** This is intentional because:
1. Flowcharts are seeded, not user-generated (yet)
2. The architectural change is fundamental - hybrid support would add complexity
3. Seeds are version-controlled and can be regenerated
4. LLM-generated flowcharts during the transition will need regeneration

All three seed flowcharts will be migrated as part of Phase 8.
