# Claude Code Instructions for apps/web

## CRITICAL: Always Check Imports Before Using React Hooks

**MANDATORY: Before using ANY React hook or function, verify it's imported.**

**The Process (EVERY TIME):**

1. Read the imports section at the top of the file (lines 1-20)
2. Check if the hook/function you need is already imported
3. If missing, add it to the import statement IN THE SAME EDIT as your code
4. Do NOT write code that uses a hook without checking imports first

**Common mistakes:**

- ❌ Using `useCallback` without checking if it's imported
- ❌ Using `useMemo` without checking if it's imported
- ❌ Using `useRef` without checking if it's imported
- ✅ Read imports → verify → add if needed → write code

**Why this matters:**

- Missing imports break the app immediately
- User has to reload and loses state
- Wastes time debugging trivial import errors
- Shows lack of attention to detail

**If you forget this, you will:**

- Break the user's development flow
- Lose reproduction state for bugs being debugged
- Annoy the user with preventable errors

## CRITICAL: When Agreeing on a Technical Approach, Actually Implement It Everywhere

**This is a documented failure pattern. Do not repeat it.**

When you agree with the user on a technical approach (e.g., "use getBBox() for bounding box calculation"):

1. **Identify ALL code paths affected** - not just the obvious one
2. **Explicitly verify each code path uses the agreed approach** before saying it's done
3. **When fixes don't work, FIRST verify the agreed approach was actually implemented everywhere** - don't add patches on top of a broken foundation

**The failure pattern:**

- User and Claude agree: "Part 1 and Part 2 should both use method X"
- Claude implements method X for Part 2 (the obvious case)
- Claude leaves Part 1 using the old method Y
- User reports Part 1 is broken
- Claude makes superficial fixes (adjust padding, tweak parameters) instead of realizing Part 1 never used method X
- Cycle repeats until user is frustrated

**What to do instead:**

- Before implementing: "Part 1 will use [exact method], Part 2 will use [exact method]"
- After implementing: Verify BOTH actually use the agreed method
- When debugging: First question should be "did I actually implement what we agreed on everywhere?"

**Why this matters:**

- Users cannot verify every line of code you write
- They trust that when you agree to do something, you actually do it
- Superficial fixes waste everyone's time when the root cause is incomplete implementation

## CRITICAL: Documentation Graph Requirement

**ALL documentation must be reachable from the main README via a linked path.**

When creating new documentation:

1. ✅ Create the document in the appropriate directory
2. ✅ Link it from a parent README that eventually links to root README
3. ✅ Verify the chain: Root README → Area README → Your Document

**Why this matters:**

- Documentation that isn't linked is invisible and will be forgotten
- New developers start at root README and follow links
- Ensures documentation stays discoverable and maintained

**Example chain:**

```
README.md (root)
  → apps/web/src/app/create/worksheets/README.md
    → PROBLEM_GENERATION_ARCHITECTURE.md
    → USER_WARNING_IMPROVEMENTS.md
    → .claude/PROBLEM_GENERATION.md
```

**Invalid:** Creating `/docs/some-feature.md` without linking from anywhere ❌
**Valid:** Creating `/docs/some-feature.md` AND linking from root README ✅

## CRITICAL: Never Directly Modify Database Schema

**NEVER modify the database schema directly (e.g., via sqlite3, manual SQL, or direct ALTER TABLE commands).**

All database schema changes MUST go through the Drizzle migration system:

1. **Modify the schema file** in `src/db/schema/`
2. **Generate a migration** using `npx drizzle-kit generate --custom`
3. **Edit the generated SQL file** with the actual migration statements
4. **Run the migration** using `npm run db:migrate`
5. **Commit both** the schema change AND the migration file

**Why this matters:**

- The migration system tracks which changes have been applied
- Production runs migrations on startup to sync schema with code
- If you modify the DB directly, the migration system doesn't know about it
- When you later create a migration for the "same" change, it becomes a no-op locally but fails on production

**The failure pattern (December 2025):**

1. During development, columns were added directly to local DB (bypassing migrations)
2. Migration 0043 was created but as `SELECT 1;` (no-op) because "columns already exist"
3. Production ran 0043 (no-op), so it never got the columns
4. Production crashed with "no such column: is_paused"
5. Required emergency migration 0044 to fix

**The correct pattern:**

```bash
# 1. Modify schema file
# 2. Generate migration
npx drizzle-kit generate --custom

# 3. Edit the generated SQL file with actual ALTER TABLE statements
# 4. Test locally
npm run db:migrate

# 5. Commit both schema and migration
git add src/db/schema/ drizzle/
git commit -m "feat: add new column"
```

**Never do this:**

```bash
# ❌ WRONG - Direct database modification
sqlite3 data/sqlite.db "ALTER TABLE session_plans ADD COLUMN is_paused INTEGER;"

# ❌ WRONG - Then creating a no-op migration because "column exists"
# drizzle/0043.sql:
# SELECT 1;  -- This does nothing on production!
```

## CRITICAL: Never Modify Migration Files After Deployment

**NEVER modify a migration file after it has been deployed to production.**

Drizzle tracks migrations by name/tag, not by content. Once a migration is recorded in `__drizzle_migrations`, it will NEVER be re-run, even if the file content changes.

### The Failure Pattern (December 2025)

1. Migration 0047 was created and deployed (possibly as a stub or incomplete)
2. Production recorded it in `__drizzle_migrations` as "applied"
3. Developer modified 0047.sql locally with the actual CREATE TABLE statement
4. New deployment saw 0047 was already "applied" → skipped it
5. Production crashed: `SqliteError: no such column: "entry_prompt_expiry_minutes"`
6. Required emergency migration to fix

**This exact pattern has caused THREE production outages:**

- Migration 0043 (December 2025): `is_paused` column missing
- Migration 0047 (December 2025): `entry_prompts` table missing
- Migration 0048 (December 2025): `entry_prompt_expiry_minutes` column missing

### Why This Happens

```
Timeline:
1. Create migration file (empty or stub)     → deployed → recorded as "applied"
2. Modify migration file with real SQL       → deployed → SKIPPED (already "applied")
3. Production crashes                        → missing tables/columns
```

Drizzle's migrator checks: "Is migration 0047 in `__drizzle_migrations`?" → Yes → Skip it.
It does NOT check: "Has the content of 0047.sql changed?"

### The Correct Pattern

**Before committing a migration, ensure it contains the FINAL SQL:**

```bash
# 1. Generate migration
npx drizzle-kit generate --custom

# 2. IMMEDIATELY edit the generated SQL with the actual statements
# DO NOT commit an empty/stub migration!

# 3. Run locally to verify
npm run db:migrate

# 4. Only THEN commit
git add drizzle/
git commit -m "feat: add entry_prompts table"
```

### If You Need to Fix a Deployed Migration

**DO NOT modify the existing migration file.** Instead:

```bash
# Create a NEW migration with the fix
npx drizzle-kit generate --custom
# Name it something like: 0050_fix_missing_entry_prompts.sql

# Add the missing SQL (with IF NOT EXISTS for safety)
CREATE TABLE IF NOT EXISTS `entry_prompts` (...);
# OR for SQLite (which doesn't support IF NOT EXISTS for columns):
# Check if column exists first, or just let it fail silently
```

### Red Flags

If you find yourself:

- Editing a migration file that's already been committed
- Thinking "I'll just update this migration with the correct SQL"
- Seeing "migration already applied" but schema is wrong

**STOP.** Create a NEW migration instead.

### Emergency Fix for Production

If production is down due to missing schema, create a new migration immediately:

```bash
# 1. Generate emergency migration
npx drizzle-kit generate --custom
# Creates: drizzle/0050_emergency_fix.sql

# 2. Add the missing SQL with safety checks
# For tables:
CREATE TABLE IF NOT EXISTS `entry_prompts` (...);

# For columns (SQLite workaround - will error if exists, but migration still records):
ALTER TABLE `classrooms` ADD COLUMN `entry_prompt_expiry_minutes` integer;

# 3. Commit and deploy
git add drizzle/
git commit -m "fix: emergency migration for missing schema"
git push
```

The new migration will run on production startup and fix the schema.

## CRITICAL: @svg-maps ES Module Imports Work Correctly

**The @svg-maps packages (world, usa) USE ES module syntax and this WORKS correctly in production.**

**Historical context:**

- We went through multiple attempts to "fix" ES module import issues
- Tried JSON data files, tried various dynamic import strategies
- **The current implementation (dynamic imports in maps.ts) WORKS in production**
- Games were successfully created and played in production with this approach
- DO NOT try to replace with JSON files or other workarounds

**If you see an error related to @svg-maps:**

- Check what else changed, not the import mechanism
- The imports themselves are NOT the problem
- Look for validator issues, type errors, or other recent changes

## CRITICAL: Production Dependencies

**NEVER add TypeScript execution tools to production dependencies.**

### Forbidden Production Dependencies

The following packages must ONLY be in `devDependencies`, NEVER in `dependencies`:

- ❌ `tsx` - TypeScript execution (only for scripts during development)
- ❌ `ts-node` - TypeScript execution
- ❌ Any TypeScript compiler/executor that runs .ts/.tsx files at runtime

### Why This Matters

1. **Docker Image Size**: These tools add 50-100MB+ to production images
2. **Security**: Running TypeScript at runtime is a security risk
3. **Performance**: Production should run compiled JavaScript, not interpret TypeScript
4. **Architecture**: If you need TypeScript at runtime, the code is in the wrong place

### What To Do Instead

**❌ WRONG - Adding tsx to dependencies to run .ts/.tsx at runtime:**

```json
{
  "dependencies": {
    "tsx": "^4.20.5" // NEVER DO THIS
  }
}
```

**✅ CORRECT - Move code to proper location:**

1. **For Next.js API routes**: Move files to `src/` so Next.js bundles them during build
   - Example: `scripts/generateCalendar.tsx` → `src/utils/calendar/generateCalendar.tsx`
   - Next.js will compile and bundle these during `npm run build`

2. **For standalone scripts**: Keep in `scripts/` and use `tsx` from devDependencies
   - Only run during development/build, never at runtime
   - Scripts can use `tsx` because it's available during build

3. **For server-side TypeScript**: Compile to JavaScript during build
   - Use `tsc` to compile `src/` to `dist/`
   - Production runs the compiled JavaScript from `dist/`

### Historical Context

**We've made this mistake TWICE:**

1. **First time (commit ffae9c1b)**: Added tsx to dependencies for calendar generation scripts
   - **Fix**: Moved scripts to `src/utils/calendar/` so Next.js bundles them

2. **Second time (would have happened again)**: Almost added tsx again for same reason
   - **Learning**: If you're tempted to add tsx to dependencies, the architecture is wrong

### Red Flags

If you find yourself thinking:

- "I need to add tsx to dependencies to run this .ts file in production"
- "This script needs TypeScript at runtime"
- "Production can't import this .tsx file"

**STOP.** The code is in the wrong place. Move it to `src/` for bundling.

### Enforcement

Before modifying `package.json` dependencies:

1. Check if any TypeScript execution tools are being added
2. Ask yourself: "Could this code be in `src/` instead?"
3. If unsure, ask the user before proceeding

## CRITICAL: Code Factoring - Never Fork, Always Factor

**When told to share code between files, NEVER copy/paste. ALWAYS extract to shared utility.**

### The Mistake (Made Multiple Times)

When implementing addition worksheet preview examples, I was told **THREE TIMES** to factor out the problem rendering code:

- "the example should be closely associated in the codebase semantically with the template"
- "just be sure to factor, not fork"
- "we need to be showing exactly what the worksheet template uses"

**What I did wrong:** Copied the Typst problem rendering code from `typstGenerator.ts` to `example/route.ts`

**Why this is wrong:**

- Changes to worksheet layout won't reflect in preview
- Maintaining two copies guarantees they'll drift apart
- Violates DRY (Don't Repeat Yourself)
- The user explicitly said "factor, not fork"

### What To Do Instead

**✅ CORRECT - Extract to shared function:**

1. Create shared function in `typstHelpers.ts`:

   ```typescript
   export function generateProblemBoxFunction(cellSize: number): string {
     // Returns the Typst function definition that both files can use
     return `#let problem-box(problem, index) = { ... }`;
   }
   ```

2. Both `typstGenerator.ts` and `example/route.ts` import and use it:

   ```typescript
   import { generateProblemBoxFunction } from './typstHelpers'

   // In Typst template:
   ${generateProblemBoxFunction(cellSize)}

   // Then call it:
   #problem-box((a: 45, b: 27), 0)
   ```

**❌ WRONG - Copy/paste the code:**

```typescript
// typstGenerator.ts
const template = `#let problem-box = { ... }`; // ← Original

// example/route.ts
const template = `#let problem-box = { ... }`; // ← Copy/paste = FORKED CODE
```

### Red Flags

If you find yourself:

- Copying large blocks of code between files
- Saying "I'll make it match the other file"
- Maintaining "two versions" of the same logic

**STOP.** Extract to a shared utility function.

### Rule of Thumb

When the user says "factor" or "share code" or "use the same template":

1. Find the common code
2. Extract to shared function in appropriate utility file
3. Import and call that function from both places
4. The shared function should be the SINGLE SOURCE OF TRUTH

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

## Blog Post Examples

**REUSABLE PATTERN: Generating single-problem examples for blog posts**

We have a **single-problem example generator** used for both the UI preview and blog post examples. This ensures blog examples use the **exact same rendering** as the live tool.

See `.claude/BLOG_EXAMPLES_PATTERN.md` for complete documentation.

**Quick reference:**

- UI preview API: `src/app/api/create/worksheets/addition/example/route.ts`
- Blog generators: `scripts/generateTenFrameExamples.ts`, `scripts/generateBlogExamples.ts`
- Shared code: `src/app/create/worksheets/addition/typstHelpers.ts`

**Key benefit**: Blog examples stay in sync with actual worksheet rendering. When rendering changes, just re-run the generator scripts.

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

## Merge Conflict Resolution

When encountering Git merge conflicts, refer to:

- **`.claude/MERGE_CONFLICT_RESOLUTION.md`** - Complete guide to intelligent merge conflict resolution
  - How to read diff3-style conflicts (with common ancestor)
  - 5 resolution patterns: Compatible, Redundant, Conflicting, Delete vs Modify, Rename + References
  - Step-by-step analysis workflow
  - zdiff3 modern alternative (cleaner conflict markers)
  - Semantic merge concepts
  - Best practices and anti-patterns
  - Debugging failed resolutions
  - Resolution checklist

**Quick Reference:**

Enable better conflict markers (recommended):

```bash
git config --global merge.conflictstyle zdiff3
```

**diff3 Format:**

```
<<<<<<< HEAD
our changes
||||||| base
common ancestor (original code)
=======
their changes
>>>>>>> branch-name
```

**Resolution Strategy:**

1. Compare OURS vs BASE - what did we change?
2. Compare THEIRS vs BASE - what did they change?
3. Classify: Compatible (keep both), Redundant (choose better), or Conflicting (combine carefully)
4. Apply appropriate resolution pattern
5. Test thoroughly (merge conflicts can create semantic issues that compile but don't work)

**Critical:** Always test merged code even if it type-checks. Conflicts can create runtime bugs.

## Dev Server Management

**CRITICAL: The user manages running the dev server, NOT Claude Code.**

- ❌ DO NOT run `pnpm dev`, `npm run dev`, or `npm start`
- ❌ DO NOT attempt to start, stop, or restart the dev server
- ❌ DO NOT kill processes on port 3000
- ❌ DO NOT use background Bash processes for the dev server
- ✅ Make code changes and let the user restart the server when needed
- ✅ You may run other commands like `npm run type-check`, `npm run lint`, etc.

**The user runs the dev server themselves.** The user will manually start/restart the dev server after you make changes.

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
  bg: "blue.200",
  borderColor: "gray.300",
  color: "brand.600",
});

// Incorrect (Tailwind)
className = "bg-blue-200 border-gray-300 text-brand-600";
```

See `.claude/GAME_THEMES.md` for standardized color theme usage in arcade games.

## Data Attributes for All Elements

**MANDATORY: All new elements MUST have data attributes for easy reference.**

When creating ANY new HTML/JSX element (div, button, section, etc.), add appropriate data attributes:

**Required patterns:**

- `data-component="component-name"` - For top-level component containers
- `data-element="element-name"` - For major UI elements
- `data-section="section-name"` - For page sections
- `data-action="action-name"` - For interactive elements (buttons, links)
- `data-setting="setting-name"` - For game settings/config elements
- `data-status="status-value"` - For status indicators

**Why this matters:**

- Allows easy element selection for testing, debugging, and automation
- Makes it simple to reference elements by name in discussions
- Provides semantic meaning beyond CSS classes
- Enables reliable E2E testing selectors

**Examples:**

```typescript
// Component container
<div data-component="game-board" className={css({...})}>

// Interactive button
<button data-action="start-game" onClick={handleStart}>

// Settings toggle
<div data-setting="sound-enabled">

// Status indicator
<div data-status={isOnline ? 'online' : 'offline'}>
```

**DO NOT:**

- ❌ Skip data attributes on new elements
- ❌ Use generic names like `data-element="div"`
- ❌ Use data attributes for styling (use CSS classes instead)

**DO:**

- ✅ Use descriptive, kebab-case names
- ✅ Add data attributes to ALL significant elements
- ✅ Make names semantic and self-documenting

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

**Server-Side Rendering (CRITICAL):**

`AbacusReact` already supports server-side rendering - it detects SSR and disables animations automatically.

**✅ CORRECT - Use in build scripts:**

```typescript
// scripts/generateAbacusIcons.tsx
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { AbacusReact } from '@soroban/abacus-react'

const svg = renderToStaticMarkup(<AbacusReact value={5} columns={2} />)
// This works! Scripts can use react-dom/server
```

**❌ WRONG - Do NOT use in Next.js route handlers:**

```typescript
// src/app/icon/route.tsx - DON'T DO THIS!
import { renderToStaticMarkup } from 'react-dom/server'  // ❌ Next.js forbids this!
import { AbacusReact } from '@soroban/abacus-react'

export async function GET() {
  const svg = renderToStaticMarkup(<AbacusReact ... />)  // ❌ Will fail!
}
```

**✅ CORRECT - Pre-generate and read in route handlers:**

```typescript
// src/app/icon/route.tsx
import { readFileSync } from "fs";

export async function GET() {
  // Read pre-generated SVG from scripts/generateAbacusIcons.tsx
  const svg = readFileSync("public/icons/day-01.svg", "utf-8");
  return new Response(svg, { headers: { "Content-Type": "image/svg+xml" } });
}
```

**Pattern to follow:**

1. Generate static SVGs using `scripts/generateAbacusIcons.tsx` (uses renderToStaticMarkup)
2. Commit generated SVGs to `public/icons/` or `public/`
3. Route handlers read and serve the pre-generated files
4. Regenerate icons when abacus styling changes

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

## Animation Patterns (React-Spring)

When implementing continuous animations with smoothly-changing speeds (like rotating crosshairs), refer to:

- **`.claude/ANIMATION_PATTERNS.md`** - Spring-for-speed, manual-integration-for-angle pattern
  - Why CSS animation and naive react-spring approaches fail
  - How to decouple speed (spring-animated) from angle (manually integrated)
  - Complete code example with `useSpringValue` and `requestAnimationFrame`
  - Anti-patterns to avoid

**Quick Reference:**

```typescript
// Spring the SPEED, integrate the ANGLE
const rotationSpeed = useSpringValue(0, { config: { tension: 200, friction: 30 } })
const rotationAngle = useSpringValue(0)

// Update speed spring when target changes
useEffect(() => { rotationSpeed.start(targetSpeed) }, [targetSpeed])

// rAF loop integrates angle from speed
useEffect(() => {
  const loop = (now) => {
    const dt = (now - lastTime) / 1000
    rotationAngle.set(rotationAngle.get() + rotationSpeed.get() * dt)
    requestAnimationFrame(loop)
  }
  requestAnimationFrame(loop)
}, [])

// Bind to animated element
<animated.svg style={{ transform: rotationAngle.to(a => `rotate(${a}deg)`) }} />
```

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
import { Z_INDEX } from "@/constants/zIndex";

// ✅ Good
zIndex: Z_INDEX.NAV_BAR;
zIndex: Z_INDEX.MODAL;
zIndex: Z_INDEX.TOOLTIP;

// ❌ Bad - magic numbers!
zIndex: 100;
zIndex: 10000;
zIndex: 500;
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

### Creating Database Migrations

**CRITICAL: NEVER manually create migration SQL files or edit the journal.**

When adding/modifying database schema:

1. **Update the schema file** in `src/db/schema/`:

   ```typescript
   // Example: Add new column to existing table
   export const abacusSettings = sqliteTable("abacus_settings", {
     userId: text("user_id").primaryKey(),
     // ... existing columns ...
     newField: integer("new_field", { mode: "boolean" })
       .notNull()
       .default(false),
   });
   ```

2. **Generate migration using drizzle-kit**:

   ```bash
   npx drizzle-kit generate --custom
   ```

   This creates:
   - A new SQL file in `drizzle/####_name.sql`
   - Updates `drizzle/meta/_journal.json`
   - Creates a snapshot in `drizzle/meta/####_snapshot.json`

3. **Edit the generated SQL file** (it will be empty):

   ```sql
   -- Custom SQL migration file, put your code below! --
   ALTER TABLE `abacus_settings` ADD `new_field` integer DEFAULT 0 NOT NULL;
   ```

4. **Test the migration** on your local database:

   ```bash
   npm run db:migrate
   ```

5. **Verify** the column was added:
   ```bash
   mcp__sqlite__describe_table table_name
   ```

**CRITICAL: Verify migration timestamp order after generation:**

After running `npx drizzle-kit generate --custom`, check `drizzle/meta/_journal.json`:
1. Look at the `"when"` timestamp of the new migration
2. Verify it's GREATER than the previous migration's timestamp
3. If not, manually edit the journal to use a timestamp after the previous one

Example of broken ordering (0057 before 0056):
```json
{ "idx": 56, "when": 1767484800000, "tag": "0056_..." },  // Jan 3
{ "idx": 57, "when": 1767400331475, "tag": "0057_..." }   // Jan 2 - WRONG!
```

Fix by setting 0057's timestamp to be after 0056:
```json
{ "idx": 57, "when": 1767571200000, "tag": "0057_..." }   // Jan 4 - CORRECT
```

**Why this happens:** `drizzle-kit generate` uses current system time, but if previous migrations were manually given future timestamps (common in CI/production scenarios), new migrations can get timestamps that sort incorrectly.

**What NOT to do:**

- ❌ DO NOT manually create SQL files in `drizzle/` without using `drizzle-kit generate`
- ❌ DO NOT manually edit `drizzle/meta/_journal.json` (except to fix timestamp ordering)
- ❌ DO NOT run SQL directly with `sqlite3` command
- ❌ DO NOT use `drizzle-kit generate` without `--custom` flag (it requires interactive prompts)

**Why this matters:**

- Drizzle tracks applied migrations in `__drizzle_migrations` table
- Manual SQL files won't be tracked properly
- Production deployments run `npm run db:migrate` automatically
- Improperly created migrations will fail in production

### CRITICAL: Statement Breakpoints in Migrations

**When a migration contains multiple SQL statements, you MUST add `--> statement-breakpoint` between them.**

Drizzle's better-sqlite3 driver executes statements one at a time. If you have multiple statements without breakpoints, the migration will fail with:

```
RangeError: The supplied SQL string contains more than one statement
```

**✅ CORRECT - Multiple statements with breakpoints:**

```sql
-- Create the table
CREATE TABLE `app_settings` (
  `id` text PRIMARY KEY DEFAULT 'default' NOT NULL,
  `threshold` real DEFAULT 0.3 NOT NULL
);
--> statement-breakpoint

-- Seed default data
INSERT INTO `app_settings` (`id`, `threshold`) VALUES ('default', 0.3);
```

**❌ WRONG - Multiple statements without breakpoint (CAUSES PRODUCTION OUTAGE):**

```sql
CREATE TABLE `app_settings` (...);

-- This will fail!
INSERT INTO `app_settings` ...;
```

**When this applies:**

- CREATE TABLE followed by INSERT (seeding data)
- CREATE TABLE followed by CREATE INDEX
- Any migration with 2+ SQL statements

**Historical context:**

This mistake caused a production outage on 2025-12-18. The app crash-looped because migration 0035 had CREATE TABLE + INSERT without a breakpoint. Always verify migrations with multiple statements have `--> statement-breakpoint` markers.

## Deployment Verification

**CRITICAL: Never assume deployment is complete just because the website is accessible.**

**Deployment System:** The NAS uses `compose-updater` (NOT Watchtower) for automatic deployments. See `.claude/DEPLOYMENT.md` for complete documentation.

When monitoring deployments to production (NAS at abaci.one):

1. **GitHub Actions Success ≠ NAS Deployment**
   - GitHub Actions builds and pushes Docker images to GHCR
   - compose-updater checks for new images every 5 minutes and auto-deploys
   - There is a 5-7 minute delay between GitHub Actions completing and NAS deployment

2. **Always verify the deployed commit:**

   ```bash
   # Check what's actually running on production
   ssh nas.home.network '/usr/local/bin/docker inspect soroban-abacus-flashcards --format="{{index .Config.Labels \"org.opencontainers.image.revision\"}}"'

   # Or check the deployment info modal in the app UI
   # Look for the "Commit" field and compare to current HEAD
   ```

3. **Compare commits explicitly:**

   ```bash
   # Current HEAD
   git rev-parse HEAD

   # If NAS deployed commit doesn't match HEAD, deployment is INCOMPLETE
   ```

4. **Never report "deployed successfully" unless:**
   - ✅ GitHub Actions completed
   - ✅ NAS commit SHA matches origin/main HEAD
   - ✅ Website is accessible AND serving the new code

5. **If commits don't match:**
   - Report the gap clearly: "NAS is X commits behind origin/main"
   - List what features are NOT yet deployed
   - Note that compose-updater should pick it up within 5 minutes

**Force immediate deployment:**

```bash
# Restart compose-updater to trigger immediate check (instead of waiting up to 5 minutes)
ssh nas.home.network "cd /volume1/homes/antialias/projects/abaci.one && docker-compose -f docker-compose.updater.yaml restart"
```

**Common mistake:** Seeing https://abaci.one is online and assuming the new code is deployed. Always verify the commit SHA.

## CRITICAL: React Query - Mutations Must Invalidate Related Queries

**This is a documented failure pattern. Do not repeat it.**

When modifying data that's fetched via React Query, you MUST use React Query mutations that properly invalidate the affected queries. Using plain `fetch()` + `router.refresh()` will NOT update the React Query cache.

### The Failure Pattern

```typescript
// ❌ WRONG - This causes stale UI!
const handleRefreshSkill = useCallback(
  async (skillId: string) => {
    const response = await fetch(`/api/curriculum/${studentId}/skills`, {
      method: "PATCH",
      body: JSON.stringify({ skillId }),
    });
    router.refresh(); // Does NOT invalidate React Query cache!
  },
  [studentId, router],
);
```

**Why this fails:**

- `router.refresh()` triggers a Next.js server re-render
- But React Query maintains its own cache on the client
- The cached data stays stale until the query naturally refetches
- User sees outdated UI until they reload the page

### The Correct Pattern

**Step 1: Check if a mutation hook already exists**

Look in `src/hooks/` for existing mutation hooks:

- `usePlayerCurriculum.ts` - curriculum mutations (`useRefreshSkillRecency`, `useSetMasteredSkills`)
- `useSessionPlan.ts` - session plan mutations
- `useRoomData.ts` - arcade room mutations

**Step 2: Use the existing hook**

```typescript
// ✅ CORRECT - Use the mutation hook
import { useRefreshSkillRecency } from "@/hooks/usePlayerCurriculum";

function MyComponent({ studentId }) {
  const refreshSkillRecency = useRefreshSkillRecency();

  const handleRefreshSkill = useCallback(
    async (skillId: string) => {
      await refreshSkillRecency.mutateAsync({ playerId: studentId, skillId });
    },
    [studentId, refreshSkillRecency],
  );

  // Use mutation state for loading indicators
  const isRefreshing = refreshSkillRecency.isPending
    ? refreshSkillRecency.variables?.skillId
    : null;
}
```

**Step 3: If no hook exists, create one with proper invalidation**

```typescript
// In src/hooks/usePlayerCurriculum.ts
export function useRefreshSkillRecency() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      playerId,
      skillId,
    }: {
      playerId: string;
      skillId: string;
    }) => {
      const response = await api(`curriculum/${playerId}/skills`, {
        method: "PATCH",
        body: JSON.stringify({ skillId }),
      });
      if (!response.ok) throw new Error("Failed to refresh skill");
      return response.json();
    },
    // THIS IS THE CRITICAL PART - invalidate affected queries!
    onSuccess: (_, { playerId }) => {
      queryClient.invalidateQueries({
        queryKey: curriculumKeys.detail(playerId),
      });
    },
  });
}
```

### Query Key Relationships

**Always ensure mutations invalidate the right query keys:**

| Mutation              | Must Invalidate                    |
| --------------------- | ---------------------------------- |
| Skill mastery changes | `curriculumKeys.detail(playerId)`  |
| Session plan updates  | `sessionPlanKeys.active(playerId)` |
| Player settings       | `curriculumKeys.detail(playerId)`  |
| Room settings         | `roomKeys.detail(roomId)`          |

**Query keys are defined in:** `src/lib/queryKeys.ts`

### Red Flags

If you find yourself:

- Using `fetch()` directly in a component for mutations
- Calling `router.refresh()` after a data mutation
- Creating `useState` for loading states instead of using `mutation.isPending`

**STOP.** Look for an existing mutation hook or create one with proper cache invalidation.

### Historical Context

**This exact bug has occurred multiple times:**

1. **SkillsTab "Mark Current" button (2025-12-20)**: Used `fetch` + `router.refresh()` instead of `useRefreshSkillRecency`. Skills list showed stale data until page reload.

2. **Similar patterns exist elsewhere** - always check before adding new mutation logic.

### Checklist Before Writing Mutation Code

1. [ ] Is there already a mutation hook in `src/hooks/`?
2. [ ] Does the mutation invalidate the correct query key?
3. [ ] Am I using `mutation.isPending` instead of manual loading state?
4. [ ] Am I NOT using `router.refresh()` for cache updates?

## Daily Practice System

When working on the curriculum-based daily practice system, refer to:

- **[`docs/DAILY_PRACTICE_SYSTEM.md`](../docs/DAILY_PRACTICE_SYSTEM.md)** - Complete architecture documentation
  - Curriculum structure (Level 1/2/3, phases)
  - Student progress tracking (skill mastery, sessions)
  - Practice session planning (adaptive learning engine)
  - Session health indicators and teacher adjustments
  - Database schema and API endpoints

**Key Files**:

- `src/lib/curriculum/progress-manager.ts` - CRUD operations
- `src/hooks/usePlayerCurriculum.ts` - Client-side state management
- `src/components/practice/` - UI components (StudentSelector, ProgressDashboard)
- `src/app/practice/page.tsx` - Entry point
- `src/app/api/curriculum/[playerId]/` - API routes
- `src/db/schema/player-curriculum.ts`, `player-skill-mastery.ts`, `practice-sessions.ts` - Database schema

## Rithmomachia Game

When working on the Rithmomachia arcade game, refer to:

- **`src/arcade-games/rithmomachia/SPEC.md`** - Complete game specification
  - Official implementation spec v1
  - Board dimensions (8×16), piece types, movement rules
  - Mathematical capture relations (equality, sum, difference, multiple, divisor, product, ratio)
  - Harmony (progression) victory conditions
  - Data models, server protocol, validation logic
  - Test cases and UI/UX suggestions

**Quick Reference:**

- **Board**: 8 rows × 16 columns (A-P, 1-8)
- **Pieces per side**: 25 total (12 Circles, 6 Triangles, 6 Squares, 1 Pyramid)
- **Movement**: Geometric (C=diagonal, T=orthogonal, S=queen, P=king)
- **Captures**: Mathematical relations between piece values
- **Victory**: Harmony (3+ pieces in enemy half forming arithmetic/geometric/harmonic progression), exhaustion, or optional point threshold

**Critical Rules**:

- All piece values are positive integers (use `number`, not `bigint` for game state serialization)
- No jumping - pieces must have clear paths
- Captures require valid mathematical relations (use helper pieces for sum/diff/product/ratio)
- Pyramid pieces have 4 faces - face value must be chosen during relation checks
