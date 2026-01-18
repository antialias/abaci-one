# Flowchart Walker System

This directory contains the **interactive flowchart walker** system, which guides users through multi-step math procedures using visual flowcharts.

## Quick Reference: Finding Flowchart Files

**CRITICAL: Mermaid content is NOT always in separate `.mmd` files!**

| Flowchart ID | JSON Definition | Mermaid Content Location |
|--------------|-----------------|--------------------------|
| `subtraction-regrouping` | `definitions/subtraction-regrouping.flow.json` | `definitions/subtraction-regrouping-flowchart.mmd` |
| `fraction-add-sub` | `definitions/fraction-add-sub.flow.json` | **EMBEDDED** in `definitions/index.ts` as `FRACTION_MERMAID` |
| `linear-equations` | `definitions/linear-equations.flow.json` | **EMBEDDED** in `definitions/index.ts` as `LINEAR_EQUATIONS_MERMAID` |

**To find mermaid content for a flowchart:**
1. First check `definitions/index.ts` - look for `const <NAME>_MERMAID = ...`
2. If not embedded, check the `mermaidFile` field in the `.flow.json` file
3. The actual `.mmd` file will be in `definitions/` directory

## Architecture Overview

Each flowchart consists of **two parts**:

### 1. JSON Definition (`.flow.json`)
Defines **behavior and interactivity**:
- Node types (instruction, decision, checkpoint, milestone, terminal)
- Problem input schema (what values users can enter)
- Variables and computed values
- Validation rules and expected answers
- Working problem transformations

### 2. Mermaid Content (`.mmd` or embedded in `index.ts`)
Defines **visual presentation**:
- Node content (title, body text, examples, warnings, checklists)
- Visual layout and styling
- Phase/subgraph organization
- Edge labels and styling

### Why Two Files?
- **Separation of concerns**: Content authors can edit mermaid without touching logic
- **Mermaid compatibility**: Flowcharts render in standard Mermaid viewers
- **Reusability**: Same definition structure across different topics

## Directory Structure

```
lib/flowcharts/
├── README.md              # This file
├── schema.ts              # TypeScript types for all structures
├── parser.ts              # Mermaid file parsing (extracts nodes, edges, phases)
├── loader.ts              # Combines JSON + Mermaid into ExecutableFlowchart
├── evaluator.ts           # Expression evaluation engine
├── constraint-parser.ts   # Parses generation constraints
├── example-generator-client.ts  # Client-side problem generation
├── example-generator.worker.ts  # Web worker for generation
├── index.ts               # Public exports
├── benchmark.ts           # Performance benchmarks
├── __tests__/             # Tests
└── definitions/           # Flowchart definitions
    ├── index.ts           # Registry + EMBEDDED MERMAID CONTENT
    ├── *.flow.json        # JSON behavior definitions
    └── *.mmd              # Standalone mermaid files (if not embedded)
```

## Key Concepts

### Node Types

| Type | Purpose | User Interaction |
|------|---------|------------------|
| `instruction` | Show content | Tap to continue |
| `decision` | Ask yes/no or multiple choice | Tap choice button |
| `checkpoint` | Validate user answer | Enter value, app validates |
| `milestone` | Success marker | Auto-advances (shows emoji briefly) |
| `terminal` | End state | Shows completion screen |

### ExecutableFlowchart

The final merged structure used at runtime:

```typescript
interface ExecutableFlowchart {
  definition: FlowchartDefinition  // From .flow.json
  mermaid: ParsedMermaid           // Parsed from mermaid content
  nodes: Record<string, ExecutableNode>  // Merged nodes
}

interface ExecutableNode {
  id: string
  definition: FlowchartNode    // Behavior from JSON
  content: ParsedNodeContent   // Display content from mermaid
}
```

### Node Content Parsing

Mermaid nodes use special formatting parsed by `parser.ts`:

```mermaid
NODE["<b>Title Here</b><br/>───────<br/>Body text line 1<br/>Body text line 2<br/>📝 Example text<br/>⚠️ Warning text"]
```

Parsed into:
```typescript
{
  title: "Title Here",
  body: ["Body text line 1", "Body text line 2"],
  example: "Example text",
  warning: "Warning text",
  checklist: undefined,
  raw: "..."
}
```

## Data Flow

```
┌─────────────────────┐     ┌─────────────────────┐
│  .flow.json         │     │  Mermaid content    │
│  (behavior)         │     │  (.mmd or embedded) │
└─────────┬───────────┘     └─────────┬───────────┘
          │                           │
          │    loadFlowchart()        │
          └───────────┬───────────────┘
                      │
                      ▼
          ┌───────────────────────┐
          │  ExecutableFlowchart  │
          │  (merged structure)   │
          └───────────┬───────────┘
                      │
                      │  initializeState()
                      ▼
          ┌───────────────────────┐
          │  FlowchartState       │
          │  (runtime state)      │
          └───────────┬───────────┘
                      │
                      │  FlowchartWalker component
                      ▼
          ┌───────────────────────┐
          │  User Interface       │
          └───────────────────────┘
```

## Key Functions

### `definitions/index.ts`
- `getFlowchart(id)` - Get a flowchart by ID (returns definition + mermaid)
- `getFlowchartList()` - Get metadata for all flowcharts
- `FLOWCHARTS` - Registry mapping IDs to definitions

### `loader.ts`
- `loadFlowchart(definition, mermaid)` - Merge JSON and mermaid into ExecutableFlowchart
- `initializeState(flowchart, problemInput)` - Create initial runtime state
- `advanceState(state, nextNode, ...)` - Move to next node
- `validateCheckpoint(flowchart, node, state, input)` - Check user answer
- `isDecisionCorrect(flowchart, node, state, choice)` - Check decision choice
- `formatProblemDisplay(flowchart, problem)` - Format problem for display

### `parser.ts`
- `parseMermaidFile(content)` - Parse mermaid into nodes, edges, phases
- `parseNodeContent(raw)` - Parse node label into structured content
- `getNextNodes(mermaid, nodeId)` - Get successor nodes
- `findNodePhase(mermaid, nodeId)` - Find which phase a node belongs to

### `evaluator.ts`
- `evaluate(expression, context)` - Evaluate math/logic expressions
- Supports: arithmetic, comparisons, boolean logic, ternary, functions (gcd, lcm, floor, etc.)

## Adding a New Flowchart

1. **Create the JSON definition** (`definitions/my-flowchart.flow.json`):
   ```json
   {
     "id": "my-flowchart",
     "title": "My Flowchart",
     "mermaidFile": "my-flowchart.mmd",
     "problemInput": { ... },
     "variables": { ... },
     "entryNode": "START",
     "nodes": { ... }
   }
   ```

2. **Create the mermaid content** - either:
   - Standalone file: `definitions/my-flowchart.mmd`
   - OR embed in `definitions/index.ts` as `const MY_FLOWCHART_MERMAID = \`...\``

3. **Register in `definitions/index.ts`**:
   ```typescript
   import myDefinition from './my-flowchart.flow.json'

   export const FLOWCHARTS = {
     'my-flowchart': {
       definition: myDefinition as FlowchartDefinition,
       mermaid: MY_FLOWCHART_MERMAID,  // or read from .mmd file
       meta: { id: 'my-flowchart', title: '...', ... }
     },
     // ...
   }
   ```

## Debugging Tips

### Finding why a node looks wrong

1. **Find the node ID** - Look at `data-current-node` attribute in browser DevTools
2. **Check the mermaid content** - Look in `definitions/index.ts` for embedded mermaid
3. **Check the JSON definition** - Look in `.flow.json` for node type and behavior
4. **Check the parsed content** - Log `currentNode.content` in FlowchartWalker

### Common issues

| Issue | Likely Cause |
|-------|--------------|
| Node shows only emoji | Mermaid node has no `<b>` title, just emoji like `(("👍"))` |
| Content shows twice | Node content rendered by both container and interaction area |
| Wrong answer marked correct | Check `expected` expression in checkpoint definition |
| Node not advancing | Check `next` field or `edges` in JSON definition |

## Related Components

- `components/flowchart/FlowchartWalker.tsx` - Main walker UI component
- `components/flowchart/FlowchartNodeContent.tsx` - Renders parsed node content
- `components/flowchart/FlowchartDecision.tsx` - Decision button UI
- `components/flowchart/FlowchartCheckpoint.tsx` - Checkpoint input UI
- `components/flowchart/FlowchartPhaseRail.tsx` - Phase progress indicator
- `components/flowchart/DebugStepTimeline.tsx` - Visual debug timeline
- `app/flowchart/page.tsx` - Flowchart picker page
- `app/flowchart/[flowchartId]/page.tsx` - Flowchart walker page
