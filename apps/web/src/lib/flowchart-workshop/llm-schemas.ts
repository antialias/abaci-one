/**
 * Zod schemas and prompts for LLM-powered flowchart generation
 *
 * This module provides:
 * - Zod schemas for validating LLM outputs
 * - System prompts with examples of existing flowcharts
 * - Reference documentation for flowchart structure
 *
 * @module flowchart-workshop/llm-schemas
 */

import { z } from 'zod'

// =============================================================================
// Zod Schemas for LLM Output
// =============================================================================

/**
 * Schema for a single field in the problem input
 * Note: Using .nullable() instead of .optional() for OpenAI structured output compatibility
 * Note: Using discriminated union with 'type' as discriminator
 */
export const FieldSchema = z.discriminatedUnion('type', [
  z.object({
    name: z.string().describe('Variable name used in expressions (e.g., "topNum", "bottomDenom")'),
    type: z.literal('integer'),
    label: z.string().nullable().describe('Human-readable label shown in UI'),
    min: z.number().nullable().describe('Minimum allowed value'),
    max: z.number().nullable().describe('Maximum allowed value'),
    default: z.number().nullable().describe('Default value if not specified'),
  }),
  z.object({
    name: z.string().describe('Variable name used in expressions'),
    type: z.literal('number'),
    label: z.string().nullable().describe('Human-readable label shown in UI'),
    min: z.number().nullable().describe('Minimum allowed value'),
    max: z.number().nullable().describe('Maximum allowed value'),
    default: z.number().nullable().describe('Default value if not specified'),
    step: z.number().nullable().describe('Step increment for decimal values'),
  }),
  z.object({
    name: z.string().describe('Variable name used in expressions'),
    type: z.literal('choice'),
    label: z.string().nullable().describe('Human-readable label shown in UI'),
    options: z.array(z.string()).describe('List of valid choices'),
    default: z.string().nullable().describe('Default selected option'),
  }),
  z.object({
    name: z.string().describe('Variable name prefix (creates whole, num, denom fields)'),
    type: z.literal('mixed-number'),
    label: z.string().nullable().describe('Human-readable label shown in UI'),
  }),
])

/**
 * Schema for an example value (key-value pair for OpenAI compatibility)
 */
export const ExampleValueSchema = z.object({
  key: z.string().describe('Field name matching a field in the schema'),
  value: z
    .union([z.number(), z.string(), z.boolean()])
    .describe('The example value for this field'),
})

/**
 * Schema for problem input configuration
 * Note: examples.values uses array of {key, value} pairs instead of Record for OpenAI compatibility
 */
export const ProblemInputSchema = z.object({
  schema: z.string().describe('Unique identifier for this problem schema'),
  fields: z.array(FieldSchema).describe('Input fields that define the problem'),
  validation: z
    .string()
    .nullable()
    .describe('Expression that must be true for valid problems (e.g., "top > bottom")'),
  examples: z
    .array(
      z.object({
        name: z.string().describe('Name of this example (e.g., "Basic borrowing")'),
        description: z
          .string()
          .nullable()
          .describe('Description of what this example demonstrates'),
        values: z.array(ExampleValueSchema).describe('Field values for this example'),
      })
    )
    .nullable()
    .describe('Example problems with specific values'),
})

/**
 * Schema for a variable definition (with name for array format)
 */
export const VariableEntrySchema = z.object({
  name: z.string().describe('Variable name (e.g., "topOnes", "needsBorrow")'),
  init: z
    .string()
    .describe('Expression to compute initial value (e.g., "top % 10", "topOnes < bottomOnes")'),
})

/**
 * Schema for a string key-value pair (for OpenAI compatibility)
 */
export const StringKeyValueSchema = z.object({
  key: z.string().describe('Key name'),
  value: z.string().describe('Value (often an expression)'),
})

/**
 * Schema for a decision option
 */
export const DecisionOptionSchema = z.object({
  label: z.string().describe('Text shown on the button (e.g., "Yes! Top is bigger")'),
  value: z.string().describe('Unique identifier for this option (e.g., "direct", "borrow")'),
  next: z.string().describe('Node ID to navigate to when selected'),
  pathLabel: z
    .string()
    .nullable()
    .describe(
      'REQUIRED: Short (2-6 char) DESCRIPTIVE label for path enumeration. Use meaningful words like "BORROW", "DIRECT", "SAME", "DIFF", "MULT", "GCD" - NOT generic "YES"/"NO". These appear in example grid column headers.'
    ),
  gridLabel: z
    .string()
    .nullable()
    .describe(
      'More descriptive label for examples UI where space allows (e.g., "Same denominators", "Use GCD method"). Shows clearer explanations than the abbreviated pathLabel on flowchart edges.'
    ),
})

/**
 * Schema for working problem update
 */
export const WorkingProblemUpdateSchema = z.object({
  result: z.string().describe('Expression for the new working problem state'),
  label: z.string().describe('Human-readable description of what changed'),
})

/**
 * Schema for a flowchart node
 * Note: Using discriminatedUnion with 'type' for OpenAI compatibility
 */
export const FlowchartNodeSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('instruction'),
    advance: z.literal('tap').describe('User taps "I did it" to advance'),
    next: z.string().nullable().describe('Node ID to navigate to next'),
    workingProblemUpdate: WorkingProblemUpdateSchema.nullable().describe(
      'Optional update to working problem display'
    ),
  }),
  z.object({
    type: z.literal('decision'),
    options: z.array(DecisionOptionSchema).describe('Available choices for the user'),
    correctAnswer: z
      .string()
      .nullable()
      .describe('Expression evaluating to the correct option value'),
    skipIf: z.string().nullable().describe('Expression - if true, skip this node'),
    skipTo: z.string().nullable().describe('Node ID to skip to when skipIf is true'),
    excludeFromExampleStructure: z
      .boolean()
      .nullable()
      .describe(
        'If true, exclude from path enumeration in example grid. Use for verification/confirmation decisions that do not represent meaningfully different problem types.'
      ),
  }),
  z.object({
    type: z.literal('checkpoint'),
    prompt: z.string().describe('Question or prompt shown to user'),
    inputType: z.enum(['number', 'text', 'two-numbers']).describe('Type of input field(s) to show'),
    expected: z
      .union([z.string(), z.array(z.string())])
      .describe(
        'Expression for expected answer (string), or array of 2 expressions for two-numbers'
      ),
    inputLabels: z
      .array(z.string())
      .nullable()
      .describe('Array of 2 labels for two-numbers input type'),
    orderMatters: z.boolean().nullable().describe('For two-numbers, whether order matters'),
    stateUpdate: z
      .array(StringKeyValueSchema)
      .nullable()
      .describe('Variables to update when checkpoint passes'),
    tolerance: z
      .number()
      .nullable()
      .describe('Allowed difference from expected for numeric answers'),
    next: z.string().nullable().describe('Node ID to navigate to after correct answer'),
    workingProblemUpdate: WorkingProblemUpdateSchema.nullable().describe(
      'Optional update to working problem display'
    ),
    skipIf: z.string().nullable().describe('Expression - if true, skip this node'),
    skipTo: z.string().nullable().describe('Node ID to skip to when skipIf is true'),
    excludeSkipFromPaths: z
      .boolean()
      .nullable()
      .describe('If true, skip path not included in enumeration'),
  }),
  z.object({
    type: z.literal('milestone'),
    next: z.string().describe('Node ID to navigate to next'),
  }),
  z.object({
    type: z.literal('embellishment'),
    next: z.string().describe('Node ID to navigate to next'),
  }),
  z.object({
    type: z.literal('terminal'),
    celebration: z.boolean().nullable().describe('Whether to show celebration animation'),
  }),
])

/**
 * Schema for a node entry (with id for array format)
 */
export const NodeEntrySchema = z.object({
  id: z.string().describe('Unique node ID (e.g., "START", "COMPARE", "CHECK1")'),
  node: FlowchartNodeSchema.describe('The node definition'),
})

/**
 * Schema for an edge entry
 */
export const EdgeEntrySchema = z.object({
  from: z.string().describe('Source node ID'),
  to: z.array(z.string()).describe('Target node ID(s)'),
})

/**
 * Schema for preferred values entry
 */
export const PreferredEntrySchema = z.object({
  key: z.string().describe('Field name from problemInput'),
  values: z
    .union([z.array(z.number()), z.array(z.string())])
    .describe('Preferred values for problem generation'),
})

/**
 * Schema for the full flowchart definition
 * Note: Using arrays instead of records for OpenAI structured output compatibility
 */
export const FlowchartDefinitionSchema = z.object({
  id: z.string().describe('Unique identifier for this flowchart (e.g., "subtraction-regrouping")'),
  title: z.string().describe('Human-readable title (e.g., "Subtraction with Regrouping")'),
  mermaidFile: z.string().describe('Filename for mermaid content (e.g., "flowchart.mmd")'),
  problemInput: ProblemInputSchema.describe('Schema for problem inputs'),
  variables: z.array(VariableEntrySchema).describe('Computed variables derived from inputs'),
  entryNode: z.string().describe('ID of the first node to display'),
  nodes: z.array(NodeEntrySchema).describe('All nodes in the flowchart'),
  edges: z.array(EdgeEntrySchema).nullable().describe('Optional explicit edge definitions'),
  workingProblem: z
    .object({
      initial: z.string().describe('Expression for initial working problem display'),
    })
    .nullable()
    .describe('Working problem display configuration'),
  generation: z
    .object({
      target: z.string().nullable().describe('Target variable for problem generation'),
      derived: z
        .array(StringKeyValueSchema)
        .nullable()
        .describe('Derived values computed during generation'),
      preferred: z
        .array(PreferredEntrySchema)
        .describe(
          'REQUIRED: Arrays of pedagogically nice values for each input field. The system picks from these to generate diverse examples that hit different flowchart paths.'
        ),
    })
    .describe(
      'REQUIRED: Problem generation configuration. Without this, example generation will fail.'
    ),
  constraints: z
    .array(StringKeyValueSchema)
    .nullable()
    .describe('Additional constraints for problem generation'),
  display: z
    .object({
      problem: z
        .string()
        .nullable()
        .describe(
          'REQUIRED: Math-style expression for problem display. Use operators not prose: "top + \' − \' + bottom" renders as "52 − 27". For fractions: "num1 + \'/\' + denom1" renders properly. Keep SHORT - appears in compact grid cells.'
        ),
    })
    .nullable()
    .describe('Display configuration for examples and problem selection UI'),
})

/**
 * Schema for the complete LLM generation output
 */
export const GeneratedFlowchartSchema = z.object({
  definition: FlowchartDefinitionSchema.describe('The complete flowchart definition'),
  mermaidContent: z
    .string()
    .describe(
      'Mermaid diagram content (flowchart TB with subgraphs). CRITICAL: Circle nodes (embellishments) MUST contain an emoji like (("😊")) or (("🎉")), NEVER empty (("")) which causes parse errors.'
    ),
  title: z.string().describe('Short title for the flowchart'),
  description: z.string().describe('One-sentence description of what this flowchart teaches'),
  emoji: z
    .string()
    .describe(
      'A single emoji that best represents the math topic (e.g., "➕" for addition, "➖" for subtraction, "✖️" for multiplication, "➗" for division, "📐" for geometry, "📊" for data/graphing, "🔢" for general number operations, "⚖️" for equations/balance, "🎯" for problem-solving)'
    ),
  difficulty: z.enum(['Beginner', 'Intermediate', 'Advanced']).describe('Target skill level'),
  notes: z
    .array(z.string())
    .describe(
      'User-facing notes for teachers/parents: pedagogical tips, suggestions for how to use this with students, or important things to know about the topic. Do NOT include implementation details, node IDs, or technical information.'
    ),
  debugNotes: z
    .array(z.string())
    .nullable()
    .describe(
      'Technical/implementation notes for debugging: what changed internally, node ID mappings, schema format details, etc. Not shown to users.'
    ),
})

/**
 * Schema for the LLM refinement output
 */
export const RefinementResultSchema = z.object({
  updatedDefinition: FlowchartDefinitionSchema.describe('The modified flowchart definition'),
  updatedMermaidContent: z
    .string()
    .describe(
      'The modified Mermaid diagram content. CRITICAL: Circle nodes (embellishments) MUST contain an emoji like (("😊")) or (("🎉")), NEVER empty (("")) which causes parse errors.'
    ),
  updatedEmoji: z
    .string()
    .nullable()
    .describe(
      'Updated emoji if the topic changed significantly, otherwise null to keep the existing emoji'
    ),
  changesSummary: z
    .string()
    .describe(
      'User-facing summary of what was changed, written for teachers/parents. Focus on pedagogical impact, not technical details.'
    ),
  notes: z
    .array(z.string())
    .describe(
      'User-facing notes for teachers/parents: pedagogical tips, suggestions, or important things to know. Do NOT include implementation details, node IDs, or technical information.'
    ),
  debugNotes: z
    .array(z.string())
    .nullable()
    .describe(
      'Technical/implementation notes for debugging: what changed internally, node ID mappings, schema format details, etc. Not shown to users.'
    ),
})

// =============================================================================
// Transformation Functions (LLM output → Internal format)
// =============================================================================

/**
 * Convert LLM output (array-based) to internal FlowchartDefinition (record-based)
 * OpenAI structured outputs require arrays instead of records, so we need to convert.
 */
export function transformLLMDefinitionToInternal(
  llmDef: z.infer<typeof FlowchartDefinitionSchema>
): import('../flowcharts/schema').FlowchartDefinition {
  // Convert variables array to record
  const variables: Record<string, { init: string }> = {}
  for (const v of llmDef.variables) {
    variables[v.name] = { init: v.init }
  }

  // Convert nodes array to record
  const nodes: Record<string, import('../flowcharts/schema').FlowchartNode> = {}
  for (const n of llmDef.nodes) {
    // Transform the node from LLM format to internal format
    const llmNode = n.node
    let internalNode: import('../flowcharts/schema').FlowchartNode

    switch (llmNode.type) {
      case 'instruction':
        internalNode = {
          type: 'instruction',
          advance: 'tap',
          next: llmNode.next ?? undefined,
          workingProblemUpdate: llmNode.workingProblemUpdate ?? undefined,
        }
        break
      case 'decision':
        internalNode = {
          type: 'decision',
          options: llmNode.options.map((o) => ({
            label: o.label,
            value: o.value,
            next: o.next,
            pathLabel: o.pathLabel ?? undefined,
            gridLabel: o.gridLabel ?? undefined,
          })),
          correctAnswer: llmNode.correctAnswer ?? undefined,
          skipIf: llmNode.skipIf ?? undefined,
          skipTo: llmNode.skipTo ?? undefined,
          excludeFromExampleStructure: llmNode.excludeFromExampleStructure ?? undefined,
        }
        break
      case 'checkpoint': {
        // Convert array to tuple for expected (internal format uses [string, string] for two-numbers)
        let expectedValue: string | [string, string]
        if (Array.isArray(llmNode.expected)) {
          expectedValue = [llmNode.expected[0] ?? '', llmNode.expected[1] ?? ''] as [string, string]
        } else {
          expectedValue = llmNode.expected
        }
        // Convert array to tuple for inputLabels
        const inputLabelsValue: [string, string] | undefined = llmNode.inputLabels
          ? ([llmNode.inputLabels[0] ?? 'First', llmNode.inputLabels[1] ?? 'Second'] as [
              string,
              string,
            ])
          : undefined
        internalNode = {
          type: 'checkpoint',
          prompt: llmNode.prompt,
          inputType: llmNode.inputType,
          expected: expectedValue,
          inputLabels: inputLabelsValue,
          orderMatters: llmNode.orderMatters ?? undefined,
          stateUpdate: llmNode.stateUpdate
            ? Object.fromEntries(llmNode.stateUpdate.map((s) => [s.key, s.value]))
            : undefined,
          tolerance: llmNode.tolerance ?? undefined,
          next: llmNode.next ?? undefined,
          workingProblemUpdate: llmNode.workingProblemUpdate ?? undefined,
          skipIf: llmNode.skipIf ?? undefined,
          skipTo: llmNode.skipTo ?? undefined,
          excludeSkipFromPaths: llmNode.excludeSkipFromPaths ?? undefined,
        }
        break
      }
      case 'milestone':
        internalNode = {
          type: 'milestone',
          next: llmNode.next,
        }
        break
      case 'embellishment':
        internalNode = {
          type: 'embellishment',
          next: llmNode.next,
        }
        break
      case 'terminal':
        internalNode = {
          type: 'terminal',
          celebration: llmNode.celebration ?? undefined,
        }
        break
    }
    nodes[n.id] = internalNode
  }

  // Convert edges array to record
  let edges: Record<string, string[]> | undefined
  if (llmDef.edges) {
    edges = {}
    for (const e of llmDef.edges) {
      edges[e.from] = e.to
    }
  }

  // Convert examples values array to record
  const examples = llmDef.problemInput.examples?.map((ex) => ({
    name: ex.name,
    description: ex.description ?? undefined,
    values: Object.fromEntries(ex.values.map((v) => [v.key, v.value])),
  }))

  // Convert generation config
  let generation: import('../flowcharts/schema').GenerationConfig | undefined
  if (llmDef.generation) {
    generation = {
      target: llmDef.generation.target ?? undefined,
      derived: llmDef.generation.derived
        ? Object.fromEntries(llmDef.generation.derived.map((d) => [d.key, d.value]))
        : undefined,
      preferred: llmDef.generation.preferred
        ? Object.fromEntries(llmDef.generation.preferred.map((p) => [p.key, p.values]))
        : undefined,
    }
  }

  // Convert constraints
  let constraints: Record<string, string> | undefined
  if (llmDef.constraints) {
    constraints = Object.fromEntries(llmDef.constraints.map((c) => [c.key, c.value]))
  }

  // Convert fields - handle nullable → optional
  const fields = llmDef.problemInput.fields.map((f) => {
    const base = {
      name: f.name,
      label: f.label ?? undefined,
    }
    switch (f.type) {
      case 'integer':
        return {
          ...base,
          type: 'integer' as const,
          min: f.min ?? undefined,
          max: f.max ?? undefined,
          default: f.default ?? undefined,
        }
      case 'number':
        return {
          ...base,
          type: 'number' as const,
          min: f.min ?? undefined,
          max: f.max ?? undefined,
          default: f.default ?? undefined,
          step: f.step ?? undefined,
        }
      case 'choice':
        return {
          ...base,
          type: 'choice' as const,
          options: f.options,
          default: f.default ?? undefined,
        }
      case 'mixed-number':
        return {
          ...base,
          type: 'mixed-number' as const,
        }
    }
  })

  return {
    id: llmDef.id,
    title: llmDef.title,
    mermaidFile: llmDef.mermaidFile,
    problemInput: {
      schema: llmDef.problemInput.schema,
      fields,
      validation: llmDef.problemInput.validation ?? undefined,
      examples,
    },
    variables,
    entryNode: llmDef.entryNode,
    nodes,
    edges,
    workingProblem: llmDef.workingProblem ?? undefined,
    generation,
    constraints,
    display: llmDef.display ? { problem: llmDef.display.problem ?? undefined } : undefined,
  }
}

// =============================================================================
// System Prompts
// =============================================================================

/**
 * Get the system prompt for flowchart generation
 */
export function getGenerationSystemPrompt(): string {
  return `You are an expert math educator and instructional designer. Your task is to create interactive math flowcharts that guide students through problem-solving procedures.

## Flowchart Architecture

Each flowchart consists of TWO parts that work together:

1. **Definition (JSON)**: Contains the logic, variables, validation rules, and node behavior
2. **Mermaid Content**: Contains the visual presentation, node text, and phase groupings

## Node Types

| Type | Purpose | User Action |
|------|---------|-------------|
| \`instruction\` | Show content | Tap "I did it" to continue |
| \`decision\` | Yes/No or multiple choice | Tap option to route |
| \`checkpoint\` | Validate user's answer | Enter value, system checks |
| \`milestone\` | Success marker | Auto-advances after brief display |
| \`embellishment\` | Decorative emoji moment | Auto-advances with animation |
| \`terminal\` | End state | Shows completion |

## Expression Syntax

Expressions are used in \`expected\`, \`correctAnswer\`, \`skipIf\`, and variable \`init\` fields.

**Operators**: +, -, *, /, %, ==, !=, <, >, <=, >=, &&, ||, !
**Functions**: floor(), ceil(), abs(), gcd(), lcm(), min(), max()
**Conditionals**: condition ? trueValue : falseValue

**Examples**:
- \`topNum >= bottomNum\` - Compare two values
- \`floor(answer / 10)\` - Get tens digit
- \`gcd(num, denom) == 1\` - Check if fraction is simplified

## Problem Input Fields

Fields define what values the teacher/system provides for each problem:
- \`integer\`: Whole numbers with optional min/max
- \`number\`: Decimal numbers with optional step
- \`choice\`: Selection from options (e.g., operation type)
- \`mixed-number\`: Fraction with whole, numerator, denominator

## Variables

Computed at problem start from input values. Use expressions to derive useful values.

## ⚠️ CRITICAL: Mermaid Layout Rules

**ALWAYS use this layout pattern. No exceptions.**

\`\`\`mermaid
flowchart TB                              <-- PHASES STACK VERTICALLY
    subgraph PHASE1["<b>1. 🔍 PHASE</b>"]
        direction LR                      <-- CONTENTS FLOW HORIZONTALLY
        ...
    end
    subgraph PHASE2["<b>2. ✨ PHASE</b>"]
        direction LR                      <-- CONTENTS FLOW HORIZONTALLY
        ...
    end
    PHASE1 --> PHASE2                     <-- CONNECT PHASES AT THE END
\`\`\`

**The three layout rules:**
1. \`flowchart TB\` at top level → phases stack top-to-bottom
2. \`direction LR\` inside each subgraph → contents flow left-to-right
3. **NO cross-phase node connections** → only connect phases to phases at the end

**DO NOT** create links between nodes in different phases:
- ❌ \`CHECK1 --> PHASE3\` (skip link from Phase 1 node to Phase 3)
- ❌ \`RETRY --> PHASE2\` (backward link from Phase 3 node to Phase 2)
- ✅ \`PHASE1 --> PHASE2\` (phase-to-phase connection at the end)

**If you need skip logic**, put the decision INSIDE the destination phase.

## Writing Style: Cue + Details

**CRITICAL:** Each instruction box needs TWO layers:

1. **CUE TITLE** (bold, top) - A short, memorable phrase they can glance at
2. **DIVIDER LINE** - Visual separator (use \`───────\`)
3. **DETAILED INSTRUCTIONS** - Full explanation in simple words

If they remember the step, the title is enough. If they're stuck, the details are right there.

**Box Structure Pattern:**
\`\`\`
["<b>🔢 CUE TITLE</b><br/>───────────<br/>Detailed instructions<br/>in simple words"]
\`\`\`

**❌ BAD (too terse):**
\`\`\`
["Whole ↓1<br/>Top + Denom"]
\`\`\`

**✅ GOOD (cue + details):**
\`\`\`
["<b>🏦 BORROW!</b><br/>─────────<br/>1. Whole number<br/>GOES DOWN by 1<br/>2. ADD the bottom<br/>to the top"]
\`\`\`

## Language Rules

- Use simple words (bottom, top, NOT denominator, numerator)
- Write like you're explaining to a 7-year-old
- Be explicit - say exactly what to do, not shorthand
- Use numbered steps for sequences (1. Do this, 2. Then this)

## Advanced Patterns

### WHY Boxes
Add explanatory boxes that connect to methods they already know:
\`\`\`
STEP_B --> WHY_BOX["💡 <b>WHY?</b> Because 2/2 = 1<br/>You're multiplying by 1!"]
\`\`\`

### Reminder Boxes for Prerequisites
Add warning boxes at phase starts for steps that depend on prior work:
\`\`\`
REMIND["⚠️ <b>BOTTOMS MUST MATCH FIRST!</b><br/>─────────────────────<br/>Did you do Step 1?"]
REMIND --> NEXT_STEP
\`\`\`

### Error Callouts
Add explicit warnings for common mistakes inline:
\`\`\`
"Add the <b>MATCHING BOTTOM</b><br/>to the top (not the old one!)"
\`\`\`

### Phase Exit Checklists
Add a ✅ READY CHECK box at the end of complex phases:
\`\`\`
READY1 --> CHECK1["<b>✅ READY CHECK</b><br/>──────────────<br/>☐ Both bottoms are<br/>   the SAME number"]
\`\`\`

## Node Shapes (use these exact formats)

- Instruction: \`NODE["Text<br/>More text"]\` (square brackets)
- Decision: \`NODE{"Question?"}\` (curly braces)
- Embellishment: \`NODE(("😊"))\` (double parentheses for circle) - MUST contain an emoji
- Terminal: \`NODE(["🎉 Done!"])\` (stadium shape)
- Milestone: \`NODE(["✅ Success!"])\` (stadium shape)

**CRITICAL for circle nodes (embellishments):**
- ✅ CORRECT: \`NODE(("😊"))\` or \`NODE(("🎉"))\` (contains emoji)
- ❌ WRONG: \`NODE((""))\` (empty string causes parse error!)

## Emoji Usage

Make it fun! Use emojis in:
- Phase titles: \`1. 🔍 PHASE NAME\`
- Cue titles: \`👀 LOOK AT BOTTOMS\`, \`🔢 CALCULATE\`
- Decision outcomes: \`😎\` (easy path), \`😱\` (uh oh), \`💪\` (you got this)
- Checkpoints: \`👍\`, \`✓\`
- Final node: \`🎉 DONE!\`

## Color Coding Convention

| Element | Fill Color | Border Color | Meaning |
|---------|------------|--------------|---------|
| Phase 1 (setup) | \`#e3f2fd\` light blue | \`#1976d2\` | Preparation steps |
| Phase 2 (decisions) | \`#fff8e1\` light yellow | \`#f9a825\` | Decision points |
| Phase 3 (execute) | \`#e8f5e9\` light green | \`#388e3c\` | Do the work |
| Decision diamonds | \`#fffde7\` yellow | \`#fbc02d\` | Questions to ask |
| Warning steps | \`#ffcdd2\` light red | \`#b71c1c\` | Easy to mess up! |
| Success checkpoints | \`#81c784\` green | \`#388e3c\` | Ready to proceed |

**Styling syntax:**
- Style format: \`style NODEID fill:#color,stroke:#color\`
- Example: \`style START fill:#10b981,stroke:#059669\`
- Place style directives AFTER all node definitions

## Mermaid Init Config

Start the mermaid file with theme configuration:
\`\`\`
%%{init: {'theme': 'base', 'themeVariables': { 'fontSize': '18px', 'primaryColor': '#e3f2fd', 'primaryTextColor': '#1a1a1a', 'primaryBorderColor': '#90caf9', 'lineColor': '#444444'}, 'flowchart': {'curve': 'basis', 'nodeSpacing': 25, 'rankSpacing': 40, 'padding': 15}}}%%
\`\`\`

## Text Rules

- Line breaks: use \`<br/>\` (not \\n)
- Bold: \`<b>text</b>\`
- Dividers: \`───────────\` (unicode box drawing)
- NO special characters except emoji
- NO unquoted text with special chars

## CRITICAL: Generation Config (REQUIRED)

Every flowchart MUST include a \`generation\` config with \`preferred\` values. Without this, the system cannot generate example problems and will show "No examples could be generated."

The system generates examples by:
1. Enumerating all possible paths through the flowchart (based on decision nodes)
2. For each path, picking from \`preferred\` values that satisfy the path's constraints
3. Tracing through the flowchart to verify the example takes the expected path

### Required Structure

\`\`\`json
{
  "generation": {
    "preferred": [
      { "key": "fieldName1", "values": [1, 2, 3, 5, 7, 10] },
      { "key": "fieldName2", "values": [2, 3, 4, 5, 6, 8, 10, 12] }
    ],
    "derived": [
      { "key": "computedField", "value": "expression using fieldName1, fieldName2" }
    ]
  }
}
\`\`\`

### Field Descriptions

**\`preferred\` (REQUIRED)**: For EACH input field in \`problemInput.fields\`, provide an array of pedagogically nice values:
- Use "friendly" numbers students find easy to work with
- Include enough variety to cover different difficulty levels
- For fractions: denominators like [2, 3, 4, 5, 6, 8, 10, 12], numerators [1, 2, 3, 5, 7]
- For integers: values that exercise different paths (e.g., values that do/don't require borrowing)

**\`derived\` (optional)**: Computed values needed during example generation. Use the same expression syntax as variables. Common examples:
- \`{ "key": "lcd", "value": "lcm(denom_a, denom_b)" }\`
- \`{ "key": "answer", "value": "top - bottom" }\`

### Example for Fraction Addition/Subtraction

\`\`\`json
{
  "generation": {
    "preferred": [
      { "key": "leftNum", "values": [1, 2, 3, 5, 7] },
      { "key": "leftDenom", "values": [2, 3, 4, 5, 6, 8, 10, 12] },
      { "key": "rightNum", "values": [1, 2, 3, 5, 7] },
      { "key": "rightDenom", "values": [2, 3, 4, 5, 6, 8, 10, 12] },
      { "key": "op", "values": ["+", "−"] }
    ],
    "derived": [
      { "key": "lcd", "value": "lcm(leftDenom, rightDenom)" }
    ]
  }
}
\`\`\`

### Example for Two-Digit Subtraction

\`\`\`json
{
  "generation": {
    "preferred": [
      { "key": "top", "values": [32, 41, 52, 63, 74, 85, 93, 50, 60, 70] },
      { "key": "bottom", "values": [14, 17, 25, 28, 36, 47, 19, 23, 38] }
    ]
  }
}
\`\`\`

The values should include numbers that:
- Sometimes require borrowing (top ones < bottom ones)
- Sometimes don't require borrowing (top ones >= bottom ones)

## Decision Labels and Example Grid

Decision nodes appear in the example grid UI, where each column represents a unique path through the flowchart. Good labels make the grid readable and meaningful.

### pathLabel vs gridLabel

- **pathLabel**: Short label (2-6 chars) shown on flowchart edges AND concatenated in grid column headers. Must be terse because multiple decisions get combined (e.g., "DIFF GCD ×" = three decisions).
- **gridLabel**: More descriptive label for the examples UI where space allows (e.g., "Same denominators", "Use GCD method"). This lets you show clearer explanations in the examples than the abbreviated flowchart labels.

### Best Practices for pathLabel

**❌ WRONG - Generic YES/NO labels:**
\`\`\`json
{
  "options": [
    { "label": "Yes", "value": "yes", "next": "...", "pathLabel": "YES", "gridLabel": null },
    { "label": "No", "value": "no", "next": "...", "pathLabel": "NO", "gridLabel": null }
  ]
}
\`\`\`
Result: Grid columns show "YES, NO YES, NO YES" - confusing!

**✅ CORRECT - Descriptive labels that reflect the decision:**
\`\`\`json
{
  "options": [
    { "label": "Same denominators!", "value": "same", "next": "...", "pathLabel": "SAME", "gridLabel": "Same denom" },
    { "label": "Different denominators", "value": "diff", "next": "...", "pathLabel": "DIFF", "gridLabel": "Different" }
  ]
}
\`\`\`
Result: Grid columns show "SAME", "DIFF GCD", "DIFF MULT" - meaningful!

**Label guidelines:**
- Use SHORT, MEANINGFUL words that describe the outcome
- Subtraction: "BORROW" vs "NO BORROW" (not YES/NO)
- Fractions: "SAME" vs "DIFF", "MULT" vs "GCD"
- Equations: "POS" vs "NEG", "×" vs "÷"
- Keep pathLabel under 6 characters when possible

### excludeFromExampleStructure

Some decision nodes are just verification steps that don't meaningfully split the problem space. Mark these with \`excludeFromExampleStructure: true\` to keep the example grid clean.

**When to use:**
- Verification questions ("Did you get the right answer?")
- Error-checking branches that loop back
- Decisions that don't represent fundamentally different problem types

**Example:**
\`\`\`json
{
  "id": "VERIFY",
  "node": {
    "type": "decision",
    "excludeFromExampleStructure": true,
    "options": [
      { "label": "Yes, looks right!", "value": "yes", "next": "DONE", "pathLabel": "✓", "gridLabel": null },
      { "label": "Let me check again", "value": "no", "next": "REVIEW", "pathLabel": "↩", "gridLabel": null }
    ]
  }
}
\`\`\`

## Display Configuration

The \`display.problem\` expression controls how problems appear in example grids and selection UI.

### Writing display.problem Expressions

**❌ WRONG - Verbose text (renders poorly):**
\`\`\`json
{
  "display": {
    "problem": "'Find the LCD for ' + num1 + '/' + denom1 + ' and ' + num2 + '/' + denom2"
  }
}
\`\`\`
Result: "FindtheLCDfor3/4and5/6" (spaces stripped by MathDisplay)

**✅ CORRECT - Math-style expressions:**
\`\`\`json
{
  "display": {
    "problem": "num1 + '/' + denom1 + ' , ' + num2 + '/' + denom2"
  }
}
\`\`\`
Result: "3/4 , 5/6" (fractions render properly with MathML)

**Guidelines:**
- Use math operators and notation, not English prose
- Fractions: \`"a + '/' + b"\` renders as proper fraction with MathML
- Separate items with \`" , "\` (space-comma-space)
- For subtraction: \`"top + ' − ' + bottom"\` (use proper minus sign −)
- Keep it SHORT - examples appear in compact grid cells

**Common patterns:**
- Two-digit subtraction: \`"top + ' − ' + bottom"\`
- Fraction operations: \`"num1 + '/' + denom1 + ' + ' + num2 + '/' + denom2"\`
- LCD problems: \`"denom1 + ' , ' + denom2"\`
- Equations: \`"coef + 'x = ' + result"\`

## Key Principles

1. **Kid-friendly language**: Use simple words, emoji, visual metaphors
2. **Clear phases**: Group related steps into named phases
3. **Checkpoints for key calculations**: Validate important intermediate results
4. **Decision points**: Let students practice identifying which path to take
5. **Encouraging embellishments**: Use emoji milestones between phases
6. **Complete paths**: Every path must reach a terminal node

## Output Format

Return a JSON object with:
- \`definition\`: The complete FlowchartDefinition object
- \`mermaidContent\`: The Mermaid diagram string
- \`title\`: Short title for the flowchart
- \`description\`: One-sentence description
- \`difficulty\`: "Beginner", "Intermediate", or "Advanced"
- \`notes\`: Array of user-facing notes for teachers/parents (pedagogical tips, how to use with students, topic insights). NO technical/implementation details!
- \`debugNotes\`: Array of technical notes (node IDs, schema changes, implementation details). Not shown to users.`
}

/**
 * Get an example flowchart for the LLM to learn from
 * Note: Uses array-based format for OpenAI structured output compatibility
 */
export function getSubtractionExample(): string {
  return `## Example: Subtraction with Regrouping

**Definition excerpt** (note: uses arrays instead of records for OpenAI compatibility):
\`\`\`json
{
  "id": "subtraction-regrouping",
  "title": "Subtraction with Regrouping",
  "mermaidFile": "flowchart.mmd",
  "problemInput": {
    "schema": "two-digit-subtraction",
    "fields": [
      { "name": "top", "type": "integer", "min": 10, "max": 99, "label": "Top number", "default": null },
      { "name": "bottom", "type": "integer", "min": 10, "max": 99, "label": "Bottom number", "default": null }
    ],
    "validation": "top > bottom",
    "examples": [
      {
        "name": "Basic borrowing",
        "description": "Simple case requiring one borrow",
        "values": [
          { "key": "top", "value": 52 },
          { "key": "bottom", "value": 27 }
        ]
      }
    ]
  },
  "variables": [
    { "name": "topOnes", "init": "top % 10" },
    { "name": "bottomOnes", "init": "bottom % 10" },
    { "name": "needsBorrow", "init": "topOnes < bottomOnes" },
    { "name": "answer", "init": "top - bottom" }
  ],
  "entryNode": "START",
  "nodes": [
    { "id": "START", "node": { "type": "instruction", "advance": "tap", "next": "COMPARE", "workingProblemUpdate": null } },
    { "id": "COMPARE", "node": {
      "type": "decision",
      "correctAnswer": "needsBorrow ? 'borrow' : 'direct'",
      "skipIf": null,
      "skipTo": null,
      "excludeFromExampleStructure": null,
      "options": [
        { "label": "Yes! Top is bigger", "value": "direct", "next": "HAPPY", "pathLabel": "DIRECT", "gridLabel": "No borrowing" },
        { "label": "No! Need to borrow", "value": "borrow", "next": "SAD", "pathLabel": "BORROW", "gridLabel": "With borrowing" }
      ]
    }},
    { "id": "HAPPY", "node": { "type": "embellishment", "next": "CHECK1" } },
    { "id": "SAD", "node": { "type": "embellishment", "next": "CHECK1B" } },
    { "id": "CHECK1", "node": { "type": "instruction", "advance": "tap", "next": "NEEDIT", "workingProblemUpdate": null } },
    { "id": "CHECK1B", "node": { "type": "instruction", "advance": "tap", "next": "NEEDIT", "workingProblemUpdate": null } },
    { "id": "NEEDIT", "node": {
      "type": "decision",
      "skipIf": "!needsBorrow",
      "skipTo": "CHECK2",
      "excludeFromExampleStructure": null,
      "correctAnswer": null,
      "options": [
        { "label": "Yes, skip borrowing!", "value": "skip", "next": "SKIP", "pathLabel": null, "gridLabel": null },
        { "label": "No, need to borrow", "value": "borrow", "next": "TENS", "pathLabel": null, "gridLabel": null }
      ]
    }},
    { "id": "DONE", "node": { "type": "terminal", "celebration": true } }
  ],
  "edges": null,
  "workingProblem": null,
  "generation": {
    "target": "answer",
    "preferred": [
      { "key": "top", "values": [32, 41, 52, 63, 74, 85, 93] },
      { "key": "bottom", "values": [14, 17, 25, 28, 36, 47] }
    ],
    "derived": null
  },
  "constraints": null,
  "display": {
    "problem": "top + ' − ' + bottom"
  }
}
\`\`\`

**Complete Mermaid example** (with cue+details style and proper layout):
\`\`\`mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'fontSize': '18px', 'primaryColor': '#e3f2fd', 'primaryTextColor': '#1a1a1a'}, 'flowchart': {'curve': 'basis', 'nodeSpacing': 25, 'rankSpacing': 40}}}%%
flowchart TB
    subgraph PHASE1["<b>1. 👀 LOOK AT THE ONES</b>"]
        direction LR
        START["<b>🔢 COMPARE ONES</b><br/>───────────<br/>Look at the ONES place<br/>Is the top bigger<br/>than the bottom?"]
        START --> COMPARE{"<b>Top ones ≥<br/>bottom ones?</b>"}
        COMPARE -->|"DIRECT"| HAPPY(("😊"))
        COMPARE -->|"BORROW"| SAD(("😢"))
    end

    subgraph PHASE2["<b>2. ✏️ DO THE WORK</b>"]
        direction LR
        HAPPY --> CHECK1["<b>✏️ SUBTRACT ONES</b><br/>───────────<br/>Top ones − bottom ones<br/>Write it in the ones place"]
        SAD --> BORROW["<b>🏦 BORROW!</b><br/>───────────<br/>1. Cross out tens, write −1<br/>2. Add 10 to the ones<br/>3. NOW subtract"]
        BORROW --> CHECK1
        CHECK1 --> MILESTONE1(["✅ Ones done!"])
    end

    subgraph PHASE3["<b>3. 🎯 FINISH UP</b>"]
        direction LR
        MILESTONE1 --> CHECK2["<b>✏️ SUBTRACT TENS</b><br/>───────────<br/>Top tens − bottom tens<br/>Write it in the tens place"]
        CHECK2 --> DONE(["🎉 All done!"])
    end

    PHASE1 --> PHASE2
    PHASE2 --> PHASE3

    style START fill:#e3f2fd,stroke:#1976d2
    style COMPARE fill:#fffde7,stroke:#fbc02d
    style BORROW fill:#ffcdd2,stroke:#b71c1c
    style DONE fill:#81c784,stroke:#388e3c
\`\`\`

**CRITICAL style syntax - node ID is REQUIRED:**
- ✅ CORRECT: \`style START fill:#10b981\`
- ❌ WRONG: \`style fill:#10b981\` (missing node ID - causes parse error!)

**IMPORTANT format notes**:
- \`variables\` is an ARRAY of { name, init } objects, NOT a record/object
- \`nodes\` is an ARRAY of { id, node } objects, NOT a record/object
- \`examples.values\` is an ARRAY of { key, value } pairs, NOT a record/object
- All nullable fields must be explicitly set to null if not used
- Node IDs match between definition and mermaid
- Emoji and visual formatting make it engaging
- Phases group related steps
- Variables compute derived values for validation`
}

/**
 * Get the refinement system prompt
 */
export function getRefinementSystemPrompt(): string {
  return `You are an expert math educator helping a teacher refine their interactive math flowchart.

You will receive:
1. The current flowchart definition (JSON)
2. The current mermaid content
3. The teacher's refinement request
4. History of previous refinements

Your task is to modify the flowchart according to the teacher's request while:
- Maintaining valid flowchart structure
- Keeping node IDs consistent between definition and mermaid
- Preserving the teaching approach unless explicitly asked to change it
- Adding helpful notes about what changed

## Important Rules

1. **Node ID consistency**: If you add a node in the definition, add it to mermaid too
2. **Path completeness**: Every path must still reach a terminal node
3. **Expression validity**: All expressions must use valid syntax
4. **Preserve working features**: Don't break what's already working
5. **Circle node content**: Embellishment nodes using \`(())\` syntax MUST contain an emoji like \`(("😊"))\` or \`(("🎉"))\`, NEVER empty \`((""))\` (causes parse error)
6. **Generation config required**: The \`generation.preferred\` field MUST contain arrays of pedagogically nice values for each input field. Without this, example generation fails.
7. **Descriptive pathLabels**: Use meaningful labels like "BORROW"/"DIRECT", "SAME"/"DIFF", not generic "YES"/"NO"
8. **display.problem**: Use math-style expressions (e.g., \`"top + ' − ' + bottom"\`), not verbose text
9. **excludeFromExampleStructure**: Mark verification/confirmation decisions with this flag to keep example grids clean

## Output Format

Return a JSON object with:
- \`updatedDefinition\`: The complete modified FlowchartDefinition
- \`updatedMermaidContent\`: The complete modified Mermaid content
- \`changesSummary\`: User-facing summary of changes (pedagogical impact, not technical details)
- \`notes\`: Array of user-facing notes for teachers/parents (pedagogical tips, suggestions). NO technical/implementation details!
- \`debugNotes\`: Array of technical notes (node IDs, what changed internally). Not shown to users.`
}
