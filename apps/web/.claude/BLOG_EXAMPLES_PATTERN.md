# Blog Post Example Generation Pattern

## Overview

We have a **reusable pattern for generating single-problem worksheet examples** for blog posts. This ensures blog post examples use the **exact same rendering code** as the live UI preview, maintaining perfect consistency between documentation and the actual tool.

## The Pattern

### 1. Single Source of Truth

**Location**: `src/app/api/create/worksheets/addition/example/route.ts`

This API route contains the `generateExampleTypst()` function that:
- Takes display options (showCarryBoxes, showTenFrames, etc.)
- Takes specific addends (addend1, addend2)
- Generates a single compact problem using the same Typst helpers as full worksheets
- Compiles to SVG

### 2. Blog Post Generator Scripts

**Pattern**: Copy the `generateExampleTypst()` logic into a script that:
1. Imports `generateTypstHelpers` and `generateProblemStackFunction` from `typstHelpers.ts`
2. Defines examples with specific problems and display options
3. Generates Typst source for each example
4. Compiles to SVG using `typst compile`
5. Saves to `public/blog/[post-name]/`

### 3. Existing Examples

**Ten-frames blog post**:
- Script: `scripts/generateTenFrameExamples.ts`
- Output: `public/blog/ten-frame-examples/`
- Usage: Shows same problem (47 + 38) with/without ten-frames
- Blog post: `content/blog/ten-frames-for-regrouping.md`

**Difficulty progression blog post**:
- Script: `scripts/generateBlogExamples.ts`
- Output: `public/blog/difficulty-examples/`
- Usage: Shows same regrouping level with different scaffolding
- Blog post: `content/blog/beyond-easy-and-hard.md`

## Why This Pattern Matters

### Benefits

1. **Consistency**: Blog examples use the exact same rendering as the live tool
2. **Single Source of Truth**: One set of Typst helpers for both UI and docs
3. **Easy Updates**: When worksheet rendering changes, re-run scripts to update examples
4. **Specific Examples**: Can choose exact problems that demonstrate specific features
5. **Version Control**: Static SVGs committed to repo, no runtime generation needed

### Anti-Pattern (Don't Do This)

❌ **Don't** manually create example SVGs in a design tool
❌ **Don't** screenshot the live UI (inconsistent sizing, quality)
❌ **Don't** duplicate the Typst rendering logic in separate files
❌ **Don't** use the full worksheet generator for blog examples (creates 2x2 grids)

## How to Create New Blog Examples

### Step 1: Create Generator Script

```typescript
// scripts/generateYourFeatureExamples.ts
import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import {
  generateTypstHelpers,
  generateProblemStackFunction,
} from '../src/app/create/worksheets/addition/typstHelpers'

const outputDir = path.join(process.cwd(), 'public', 'blog', 'your-feature-examples')
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true })
}

interface ExampleOptions {
  showCarryBoxes?: boolean
  showAnswerBoxes?: boolean
  showPlaceValueColors?: boolean
  showTenFrames?: boolean
  showProblemNumbers?: boolean
  fontSize?: number
  addend1: number
  addend2: number
}

function generateExampleTypst(config: ExampleOptions): string {
  const a = config.addend1
  const b = config.addend2
  const fontSize = config.fontSize || 16
  const cellSize = 0.45 // Larger than UI preview (0.35) for blog readability

  const showCarries = config.showCarryBoxes ?? false
  const showAnswers = config.showAnswerBoxes ?? false
  const showColors = config.showPlaceValueColors ?? false
  const showNumbers = config.showProblemNumbers ?? false
  const showTenFrames = config.showTenFrames ?? false

  return String.raw`
#set page(width: auto, height: auto, margin: 12pt, fill: white)
#set text(size: ${fontSize}pt, font: "New Computer Modern Math")

#let heavy-stroke = 0.8pt
#let show-ten-frames-for-all = false

${generateTypstHelpers(cellSize)}
${generateProblemStackFunction(cellSize)}

#let a = ${a}
#let b = ${b}
#let aT = calc.floor(calc.rem(a, 100) / 10)
#let aO = calc.rem(a, 10)
#let bT = calc.floor(calc.rem(b, 100) / 10)
#let bO = calc.rem(b, 10)

#align(center + horizon)[
  #problem-stack(
    a, b, aT, aO, bT, bO,
    ${showNumbers ? '0' : 'none'},
    ${showCarries},
    ${showAnswers},
    ${showColors},
    ${showTenFrames},
    ${showNumbers}
  )
]
`
}

const examples = [
  {
    filename: 'example-1.svg',
    description: 'Your feature demonstrated',
    options: {
      addend1: 47,
      addend2: 38,
      showCarryBoxes: true,
      showAnswerBoxes: true,
      showPlaceValueColors: true,
      showTenFrames: true,
      showProblemNumbers: true,
    },
  },
  // Add more examples...
] as const

for (const example of examples) {
  const typstSource = generateExampleTypst(example.options)
  const svg = execSync('typst compile --format svg - -', {
    input: typstSource,
    encoding: 'utf8',
    maxBuffer: 2 * 1024 * 1024,
  })
  fs.writeFileSync(path.join(outputDir, example.filename), svg, 'utf-8')
}
```

### Step 2: Run Generator

```bash
npx tsx scripts/generateYourFeatureExamples.ts
```

### Step 3: Use in Blog Post

```markdown
---
title: "Your Feature Title"
---

## Feature Overview

![Example showing feature](/blog/your-feature-examples/example-1.svg)
*Caption explaining what the example demonstrates.*
```

## Tips for Good Examples

### Problem Selection

- **Choose problems that require the feature**: For ten-frames, use 7+8=15 (requires regrouping)
- **Use simple, clear numbers**: 47 + 38 is better than 387 + 694 for demonstrating basics
- **Show edge cases when relevant**: Double regrouping (57 + 68) shows ten-frames in both columns

### Display Options

- **Minimize non-essential scaffolding**: Turn off unrelated features to focus attention
- **Use consistent options across related examples**: Same colors, same carry boxes, etc.
- **Consider cell size**: Blog examples use 0.45in vs UI preview 0.35in for readability

### File Organization

- **One directory per blog post**: `public/blog/[post-slug]/`
- **Descriptive filenames**: `with-ten-frames.svg`, not `example1.svg`
- **Keep generator script**: Document what examples show and why

## Maintenance

### When to Regenerate Examples

- ✅ When `generateProblemStackFunction()` changes (new rendering logic)
- ✅ When `generateTypstHelpers()` changes (new visual styling)
- ✅ When Typst compiler updates (may affect rendering)
- ❌ When blog post text changes (examples are independent)

### Updating All Examples

```bash
# Regenerate all blog examples
npx tsx scripts/generateBlogExamples.ts
npx tsx scripts/generateTenFrameExamples.ts
# Add more as needed
```

## Reference Implementation

See `scripts/generateTenFrameExamples.ts` for a complete, documented example of this pattern.

Key features demonstrated:
- Clear header documentation explaining the pattern
- Reusable `generateExampleTypst()` function
- Declarative example definitions
- Helpful inline comments explaining problem choices
- Error handling for Typst compilation
