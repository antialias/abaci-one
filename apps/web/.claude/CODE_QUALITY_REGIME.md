# Code Quality Regime

**MANDATORY**: Before declaring ANY work complete, fixed, or working, Claude MUST run these checks and fix all issues.

## Definition of "Done"

Work is NOT complete until:

- ✅ All TypeScript errors are fixed (0 errors)
- ✅ All code is formatted with Biome
- ✅ All linting passes (0 errors, 0 warnings)
- ✅ `npm run pre-commit` exits successfully

**Until these checks pass, the work is considered incomplete.**

## Quality Check Checklist (Always Required)

Run these before:

- Committing code
- Saying work is "done" or "complete"
- Marking tasks as finished
- Telling the user something is "working" or "fixed"

Run these commands in order. All must pass with 0 errors and 0 warnings:

```bash
# 1. Type check
npm run type-check

# 2. Format code
npm run format

# 3. Lint and fix
npm run lint:fix

# 4. Verify clean state
npm run lint && npm run type-check
```

## Quick Command (Run All Checks)

```bash
npm run pre-commit
```

**What it does:**

```json
"pre-commit": "npm run type-check && npm run format && npm run lint:fix && npm run lint"
```

This single command runs:

1. `npm run type-check` → `tsc --noEmit` (TypeScript errors)
2. `npm run format` → `npx @biomejs/biome format . --write` (auto-format)
3. `npm run lint:fix` → `npx @biomejs/biome lint . --write && npx eslint . --fix` (auto-fix)
4. `npm run lint` → `npx @biomejs/biome lint . && npx eslint .` (verify clean)

Fails fast if any step fails.

## The Regime Rules

### 1. TypeScript Errors: ZERO TOLERANCE

- Run `npm run type-check` before every commit
- Fix ALL TypeScript errors
- No `@ts-ignore` or `@ts-expect-error` without explicit justification

### 2. Formatting: AUTOMATIC

- Run `npm run format` before every commit
- Biome handles all formatting automatically
- Never commit unformatted code

### 3. Linting: ZERO ERRORS, ZERO WARNINGS

- Run `npm run lint:fix` to auto-fix issues
- Then run `npm run lint` to verify 0 errors, 0 warnings
- Fix any remaining issues manually

### 4. Commit Order

1. Make code changes
2. Run `npm run pre-commit`
3. If any check fails, fix and repeat
4. Only commit when all checks pass
5. Push immediately after commit

## Why No Pre-Commit Hooks?

This project intentionally avoids pre-commit hooks due to religious constraints.
Instead, Claude Code is responsible for enforcing this regime through:

1. **This documentation** - Always visible and reference-able
2. **Package.json scripts** - Easy to run checks
3. **Session persistence** - This file lives in `.claude/` and is read by every session

## For Claude Code Sessions

**READ THIS FILE AT THE START OF EVERY SESSION WHERE YOU WILL COMMIT CODE**

When asked to commit:

1. Check if you've run `npm run pre-commit` (or all 4 steps individually)
2. If not, STOP and run the checks first
3. Fix all issues before proceeding with the commit
4. Only create commits when all checks pass

## Complete Scripts Reference

From `apps/web/package.json`:

```json
{
  "scripts": {
    "type-check": "tsc --noEmit",
    "format": "npx @biomejs/biome format . --write",
    "format:check": "npx @biomejs/biome format .",
    "lint": "npx @biomejs/biome lint . && npx eslint .",
    "lint:fix": "npx @biomejs/biome lint . --write && npx eslint . --fix",
    "check": "npx @biomejs/biome check .",
    "pre-commit": "npm run type-check && npm run format && npm run lint:fix && npm run lint"
  }
}
```

**Tools used:**

- TypeScript: `tsc --noEmit` (type checking only, no output)
- Biome: Fast formatter + linter (Rust-based, 10-100x faster than Prettier)
- ESLint: React Hooks rules only (`rules-of-hooks` validation)

## Emergency Override

If you absolutely MUST commit with failing checks:

1. Document WHY in the commit message
2. Create a follow-up task to fix the issues
3. Only use for emergency hotfixes

## Verification

After following this regime, you should see:

```
✓ Type check passed (0 errors)
✓ Formatting applied
✓ Linting passed (0 errors, 0 warnings)
✓ Ready to commit
```

---

**This regime is non-negotiable. Every commit must pass these checks.**
