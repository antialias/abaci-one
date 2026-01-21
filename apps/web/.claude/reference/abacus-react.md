# Abacus Visualizations Reference

**CRITICAL: This project uses @soroban/abacus-react for all abacus visualizations.**

## Quick Reference

- **Package**: `@soroban/abacus-react` (location: `packages/abacus-react`)
- **Main components**: `AbacusReact`, `useAbacusConfig`, `useAbacusDisplay`
- **Docs**: `packages/abacus-react/README.md`

## Rules

- ✅ Always use `AbacusReact` from `@soroban/abacus-react`
- ✅ Use `useAbacusConfig` for abacus configuration
- ✅ Use `useAbacusDisplay` for reading abacus state
- ❌ Don't create custom abacus components or SVGs
- ❌ Don't manually render abacus beads or columns

## Server-Side Rendering

`AbacusReact` already supports SSR - it detects SSR and disables animations automatically.

### ✅ CORRECT - Use in build scripts:

```typescript
// scripts/generateAbacusIcons.tsx
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { AbacusReact } from '@soroban/abacus-react'

const svg = renderToStaticMarkup(<AbacusReact value={5} columns={2} />)
// This works! Scripts can use react-dom/server
```

### ❌ WRONG - Do NOT use in Next.js route handlers:

```typescript
// src/app/icon/route.tsx - DON'T DO THIS!
import { renderToStaticMarkup } from 'react-dom/server'  // ❌ Next.js forbids this!
import { AbacusReact } from '@soroban/abacus-react'

export async function GET() {
  const svg = renderToStaticMarkup(<AbacusReact ... />)  // ❌ Will fail!
}
```

### ✅ CORRECT - Pre-generate and read in route handlers:

```typescript
// src/app/icon/route.tsx
import { readFileSync } from "fs";

export async function GET() {
  // Read pre-generated SVG from scripts/generateAbacusIcons.tsx
  const svg = readFileSync("public/icons/day-01.svg", "utf-8");
  return new Response(svg, { headers: { "Content-Type": "image/svg+xml" } });
}
```

### Pattern to follow:

1. Generate static SVGs using `scripts/generateAbacusIcons.tsx` (uses renderToStaticMarkup)
2. Commit generated SVGs to `public/icons/` or `public/`
3. Route handlers read and serve the pre-generated files
4. Regenerate icons when abacus styling changes

## Customizing AbacusReact

**ALWAYS read the full README documentation before customizing:**

- Location: `packages/abacus-react/README.md`
- Check homepage implementation: `src/app/page.tsx` (MiniAbacus component)
- Check storybook examples: `src/stories/AbacusReact.*.stories.tsx`

### Key Documentation Points:

1. **Custom Styles**: Use `fill` (not just `stroke`) for columnPosts and reckoningBar
2. **Props**: Use direct props like `value`, `columns`, `scaleFactor` (not config objects)

### Example with Custom Styles:

```typescript
const darkStyles = {
  columnPosts: {
    fill: 'rgba(255, 255, 255, 0.3)',
    stroke: 'rgba(255, 255, 255, 0.2)',
    strokeWidth: 2,
  },
  reckoningBar: {
    fill: 'rgba(255, 255, 255, 0.4)',
    stroke: 'rgba(255, 255, 255, 0.25)',
    strokeWidth: 3,
  },
}

<AbacusReact
  value={123}
  columns={3}
  customStyles={darkStyles}
/>
```

### Basic Usage:

```typescript
import { AbacusReact } from '@soroban/abacus-react'

<AbacusReact value={123} columns={5} scaleFactor={1.5} showNumbers={true} />
```
