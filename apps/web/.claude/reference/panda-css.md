# Panda CSS Reference

This project uses **Panda CSS**, NOT Tailwind CSS.

## Quick Reference

- **Package**: `@pandacss/dev`
- **Config**: `/panda.config.ts`
- **Generated system**: `/styled-system/`
- **Import**: `import { css } from '../../styled-system/css'`

## Token Syntax

```typescript
// Correct (Panda CSS)
css({
  bg: "blue.200",
  borderColor: "gray.300",
  color: "brand.600",
});

// Incorrect (Tailwind)
className = "bg-blue-200 border-gray-300 text-brand-600";
```

## Common Gotchas

### 1. Padding/Margin Shorthand

**Token values do NOT work with multi-value shorthand strings.**

```typescript
// ❌ WRONG - tokens in shorthand string don't work
css({ padding: '1 2' })        // This does nothing!
css({ margin: '2 4' })         // This does nothing!

// ✅ CORRECT - use CSS values with units
css({ padding: '4px 8px' })    // Works
css({ margin: '8px 16px' })    // Works

// ✅ CORRECT - use separate token properties
css({ paddingX: '2', paddingY: '1' })  // Works
css({ marginX: '4', marginY: '2' })    // Works
```

**Why:** Panda CSS tokens only work with individual properties. The shorthand syntax accepts standard CSS values (with units), not token references.

### 2. Color Scale Limitation

Panda CSS default preset only has shades 50-900. There is no `950` shade.

```typescript
// ❌ WRONG - 950 doesn't exist
css({ color: 'gray.950' })  // No effect

// ✅ CORRECT - use 900 or raw values
css({ color: 'gray.900' })
css({ color: '#0a0a0a' })
```

### 3. Dark Mode Colors

For custom dark mode colors, use raw rgba/hex values:

```typescript
const colors = {
  healthy: {
    bg: { base: 'green.100', _dark: 'rgba(34, 197, 94, 0.25)' },
    color: { base: 'green.700', _dark: '#86efac' },
  },
}
```

## Fixing Corrupted styled-system

**Trigger:** CSS appears broken, styles aren't applying, build fails with styled-system errors.

**Cause:** Prettier or formatters modified the generated files.

**Fix:**

```bash
# 1. Delete the corrupted styled-system
rm -rf apps/web/styled-system

# 2. Regenerate it
cd apps/web && pnpm panda codegen

# 3. Clear Next.js cache (if build errors persist)
rm -rf apps/web/.next

# 4. Rebuild
pnpm build
```

**Prevention:** The repo has a `.prettierignore` at the root that excludes `**/styled-system/**`. If this file is missing or incomplete, prettier will corrupt the generated files when running `pnpm format`.

**Also available as skill:** Run `/fix-css` to automatically fix corrupted styled-system.

## See Also

- `.claude/GAME_THEMES.md` - Standardized color theme usage in arcade games
- `/panda.config.ts` - Custom tokens and theme configuration
