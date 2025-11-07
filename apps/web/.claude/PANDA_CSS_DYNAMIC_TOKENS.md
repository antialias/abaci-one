# Panda CSS Dynamic Token Usage

## Problem: Dynamic Color Tokens Not Working

When using Panda CSS, color tokens like `blue.400`, `purple.400`, etc. don't work when used dynamically through variables in the `css()` function.

## Root Cause

Panda CSS's `css()` function requires **static values at build time**. It cannot process dynamic token references like:

```typescript
// ❌ This doesn't work
const color = "blue.400";
css({ color: color }); // Panda can't resolve this at build time
```

The `css()` function performs static analysis during the build process to generate CSS classes. It cannot handle runtime-dynamic token paths.

## Solution: Use the `token()` Function

Panda CSS provides a `token()` function specifically for resolving token paths to their actual values at runtime:

```typescript
import { token } from '../../styled-system/tokens'

// ✅ This works
const stages = [
  { level: '10 Kyu', label: 'Beginner', color: 'colors.green.400' },
  { level: '5 Kyu', label: 'Intermediate', color: 'colors.blue.400' },
  { level: '1 Kyu', label: 'Advanced', color: 'colors.violet.400' },
  { level: 'Dan', label: 'Master', color: 'colors.amber.400' },
] as const

// Use with inline styles, not css()
<div style={{ color: token(stage.color) }}>
```

## Important Notes

1. **Use `as const`**: TypeScript needs the array marked as `const` so the token strings are treated as literal types, not generic strings. The `token()` function expects the `Token` literal type.

2. **Use inline styles**: When using `token()`, apply colors via the `style` prop, not through the `css()` function:

   ```typescript
   // ✅ Correct
   <div style={{ color: token(stage.color) }}>

   // ❌ Won't work
   <div className={css({ color: token(stage.color) })}>
   ```

3. **Static tokens in css()**: For static usage, you CAN use tokens directly in `css()`:
   ```typescript
   // ✅ This works because it's static
   css({ color: "blue.400" });
   ```

## How token() Works

The `token()` function:

- Takes a token path like `"colors.blue.400"`
- Looks it up in the generated token registry (`styled-system/tokens/index.mjs`)
- Returns the actual CSS value (e.g., `"#60a5fa"`)
- Happens at runtime, not build time

## Token Type Definition

The `Token` type is a union of all valid token paths:

```typescript
type Token = "colors.blue.400" | "colors.green.400" | "colors.violet.400" | ...
```

This is defined in `styled-system/tokens/tokens.d.ts`.

## Reference Implementation

See `src/app/page.tsx` lines 404-434 for a working example of dynamic token usage in the "Your Journey" section.
