# Claude Code Instructions for apps/web

## MANDATORY: Quality Checks for ALL Work

**BEFORE declaring ANY work complete, fixed, or working**, you MUST run and pass these checks:

### When This Applies

- Before every commit
- Before saying "it's done" or "it's fixed"
- Before marking a task as complete
- Before telling the user something is working
- After any code changes, no matter how small

```bash
npm run pre-commit
```

This single command runs all quality checks in the correct order:

1. `npm run type-check` - TypeScript type checking (must have 0 errors)
2. `npm run format` - Auto-format all code with Biome
3. `npm run lint:fix` - Auto-fix linting issues with Biome + ESLint
4. `npm run lint` - Verify 0 errors, 0 warnings

**DO NOT COMMIT** until all checks pass with zero errors and zero warnings.

## Available Scripts

```bash
npm run type-check    # TypeScript: tsc --noEmit
npm run format        # Biome: format all files
npm run format:check  # Biome: check formatting without fixing
npm run lint          # Biome + ESLint: check for errors/warnings
npm run lint:fix      # Biome + ESLint: auto-fix issues
npm run check         # Biome: full check (format + lint + imports)
npm run pre-commit    # Run all checks (type + format + lint)
```

## Workflow

When asked to make ANY changes:

1. Make your code changes
2. Run `npm run pre-commit`
3. If it fails, fix the issues and run again
4. **STOP - Tell user changes are ready for testing**
5. **WAIT for user to manually test and approve**
6. Only commit/push when user explicitly approves or requests it

**CRITICAL:** Passing `npm run pre-commit` only verifies code quality (TypeScript, linting, formatting). It does NOT verify that features work correctly. Manual testing by the user is REQUIRED before committing.

**Never auto-commit or auto-push after making changes.**

## Details

See `.claude/CODE_QUALITY_REGIME.md` for complete documentation.

## No Pre-Commit Hooks

This project does not use git pre-commit hooks for religious reasons.
You (Claude Code) are responsible for enforcing code quality before commits.

## Quick Reference: package.json Scripts

**Primary workflow:**

```bash
npm run pre-commit  # ← Use this before every commit
```

**Individual checks (if needed):**

```bash
npm run type-check     # TypeScript: tsc --noEmit
npm run format         # Biome: format code (--write)
npm run lint           # Biome + ESLint: check only
npm run lint:fix       # Biome + ESLint: auto-fix
```

**Additional tools:**

```bash
npm run format:check   # Check formatting without changing files
npm run check          # Biome check (format + lint + organize imports)
```

---

**Remember: Always run `npm run pre-commit` before creating commits.**

## Styling Framework

**CRITICAL: This project uses Panda CSS, NOT Tailwind CSS.**

- All styling is done with Panda CSS (`@pandacss/dev`)
- Configuration: `/panda.config.ts`
- Generated system: `/styled-system/`
- Import styles using: `import { css } from '../../styled-system/css'`
- Token syntax: `color: 'blue.200'`, `borderColor: 'gray.300'`, etc.

**Common Mistakes to Avoid:**
- ❌ Don't reference "Tailwind" in code, comments, or documentation
- ❌ Don't use Tailwind utility classes (e.g., `className="bg-blue-500"`)
- ✅ Use Panda CSS `css()` function for all styling
- ✅ Use Panda's token system (defined in `panda.config.ts`)

**Color Tokens:**
```typescript
// Correct (Panda CSS)
css({
  bg: 'blue.200',
  borderColor: 'gray.300',
  color: 'brand.600'
})

// Incorrect (Tailwind)
className="bg-blue-200 border-gray-300 text-brand-600"
```

See `.claude/GAME_THEMES.md` for standardized color theme usage in arcade games.

## Abacus Visualizations

**CRITICAL: This project uses @soroban/abacus-react for all abacus visualizations.**

- All abacus displays MUST use components from `@soroban/abacus-react`
- Package location: `packages/abacus-react`
- Main components: `AbacusReact`, `useAbacusConfig`, `useAbacusDisplay`
- DO NOT create custom abacus visualizations
- DO NOT manually draw abacus columns, beads, or bars

**Common Mistakes to Avoid:**
- ❌ Don't create custom abacus components or SVGs
- ❌ Don't manually render abacus beads or columns
- ✅ Always use `AbacusReact` from `@soroban/abacus-react`
- ✅ Use `useAbacusConfig` for abacus configuration
- ✅ Use `useAbacusDisplay` for reading abacus state

**MANDATORY: Read the Docs Before Customizing**

**ALWAYS read the full README documentation before customizing or styling AbacusReact:**
- Location: `packages/abacus-react/README.md`
- Check homepage implementation: `src/app/page.tsx` (MiniAbacus component)
- Check storybook examples: `src/stories/AbacusReact.*.stories.tsx`

**Key Documentation Points:**
1. **Custom Styles**: Use `fill` (not just `stroke`) for columnPosts and reckoningBar
2. **Props**: Use direct props like `value`, `columns`, `scaleFactor` (not config objects)
3. **Example from Homepage:**
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

**Example Usage:**
```typescript
import { AbacusReact } from '@soroban/abacus-react'

<AbacusReact value={123} columns={5} scaleFactor={1.5} showNumbers={true} />
```

## Known Issues

### @soroban/abacus-react TypeScript Module Resolution

**Issue:** TypeScript reports that `AbacusReact`, `useAbacusConfig`, and other exports do not exist from the `@soroban/abacus-react` package, even though:
- The package builds successfully
- The exports are correctly defined in `dist/index.d.ts`
- The imports work at runtime
- 20+ files across the codebase use these same imports without issue

**Impact:** `npm run type-check` will report errors for any files importing from `@soroban/abacus-react`.

**Workaround:** This is a known pre-existing issue. When running pre-commit checks, TypeScript errors related to `@soroban/abacus-react` imports can be ignored. Focus on:
- New TypeScript errors in your changed files (excluding @soroban/abacus-react imports)
- Format checks
- Lint checks

**Status:** Known issue, does not block development or deployment.

## Game Settings Persistence

When working on arcade room game settings, refer to:

- **`.claude/GAME_SETTINGS_PERSISTENCE.md`** - Complete architecture documentation
  - How settings are stored (nested by game name)
  - Three critical systems that must stay in sync
  - Common bugs and their solutions
  - Debugging checklist
  - Step-by-step guide for adding new settings

- **`.claude/GAME_SETTINGS_REFACTORING.md`** - Recommended improvements
  - Shared config types to prevent inconsistencies
  - Helper functions to reduce duplication
  - Type-safe validation
  - Migration strategy

**Quick Reference:**

Settings are stored as: `gameConfig[gameName][setting]`

Three places must handle settings correctly:
1. **Provider** (`Room{Game}Provider.tsx`) - Merges saved config with defaults
2. **Socket Server** (`socket-server.ts`) - Creates session from saved config
3. **Validator** (`{Game}Validator.ts`) - `getInitialState()` must accept ALL settings

If a setting doesn't persist, check all three locations.

## Z-Index and Stacking Context Management

When working with z-index values or encountering layering issues, refer to:

- **`.claude/Z_INDEX_MANAGEMENT.md`** - Complete z-index documentation
  - Z-index layering hierarchy (0-20000+)
  - Stacking context rules and gotchas
  - Current z-index audit of all components
  - Guidelines for choosing z-index values
  - Migration plan to use constants file
  - Debugging checklist for layering issues

**Quick Reference:**

**ALWAYS use the constants file:**
```typescript
import { Z_INDEX } from '@/constants/zIndex'

// ✅ Good
zIndex: Z_INDEX.NAV_BAR
zIndex: Z_INDEX.MODAL
zIndex: Z_INDEX.TOOLTIP

// ❌ Bad - magic numbers!
zIndex: 100
zIndex: 10000
zIndex: 500
```

**Layering hierarchy:**
- Base content: 0-99
- Navigation/UI chrome: 100-999
- Overlays/dropdowns/tooltips: 1000-9999
- Modals/dialogs: 10000-19999
- Toasts: 20000+

**Critical reminder about stacking contexts:**

Z-index values are only compared within the same stacking context! Elements with `position + zIndex`, `opacity < 1`, `transform`, or `filter` create new stacking contexts where child z-indexes are relative, not global.

Before setting a z-index, always check:
1. What stacking context is this element in?
2. Am I comparing against siblings or global elements?
3. Does my parent create a stacking context?

## Database Access

This project uses SQLite with Drizzle ORM. Database location: `./data/sqlite.db`

**ALWAYS use MCP SQLite tools for database operations:**
- `mcp__sqlite__list_tables` - List all tables
- `mcp__sqlite__describe_table` - Get table schema
- `mcp__sqlite__read_query` - Run SELECT queries
- `mcp__sqlite__write_query` - Run INSERT/UPDATE/DELETE queries
- `mcp__sqlite__create_table` - Create new tables
- **DO NOT use bash `sqlite3` commands** - use the MCP tools instead

**Database Schema:**
- Schema definitions: `src/db/schema/`
- Drizzle config: `drizzle.config.ts`
- Migrations: `drizzle/` directory
