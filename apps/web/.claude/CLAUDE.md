# Claude Code Instructions for apps/web

## CRITICAL Behavioral Rules

### React Hook Imports
Before using ANY React hook, verify it's imported. Read imports first (lines 1-20), add missing hooks IN THE SAME EDIT as your code. Missing imports break the app and waste debugging time.

### Implement Everywhere
When agreeing on a technical approach, implement it in ALL affected code paths, not just the obvious one. When fixes don't work, first verify you actually implemented the agreed approach everywhere.

### Documentation Graph
All documentation must be reachable from root README via linked path. Unlinked docs are invisible and forgotten.

## CRITICAL: Database Migrations

**This has caused multiple production outages. Read the full guide.**

Quick rules:
- Never modify schema directly (use migrations)
- Never modify deployed migrations (create new ones)
- Never manually create migration files (use `npx drizzle-kit generate --custom`)
- Always add `--> statement-breakpoint` between multiple SQL statements
- Always verify timestamp ordering after generating

**Full guide:** `.claude/procedures/database-migrations.md`

## @svg-maps Imports

The @svg-maps packages WORK correctly in production with dynamic imports. If you see errors, check what else changed - the import mechanism is NOT the problem.

## CRITICAL: Production Dependencies

**NEVER add `tsx`, `ts-node`, or TypeScript execution tools to `dependencies`.**

These belong in `devDependencies` only. If you need TypeScript at runtime, the code is in the wrong place.

**Fix:** Move the code to `src/` so Next.js bundles it during build, or keep it in `scripts/` (devDependencies are available during build).

## CRITICAL: Code Factoring - Never Fork, Always Factor

**When told to share code between files, NEVER copy/paste. ALWAYS extract to shared utility.**

Red flags that mean you're forking instead of factoring:
- Copying large blocks of code between files
- Maintaining "two versions" of the same logic

**Correct approach:** Extract common code to a shared function that both files import. The shared function is the single source of truth.

## Quality Checks

**Before declaring work complete:** Run `npm run pre-commit` (type-check + format + lint). Do NOT commit until all checks pass with zero errors.

## Blog Post Examples

See `.claude/BLOG_EXAMPLES_PATTERN.md` - uses shared generators to keep blog examples in sync with actual worksheet rendering.

## Workflow

1. Make changes → 2. Run `npm run pre-commit` → 3. Tell user ready for testing → 4. Wait for approval → 5. Commit only when approved

**Never auto-commit.** `pre-commit` verifies code quality, not functionality. User must manually test.

## Dev Server

**User manages the dev server, NOT Claude Code.** Never run `pnpm dev` or `npm start`. User restarts server after your changes.

## Code Quality

See `.claude/CODE_QUALITY_REGIME.md` for complete documentation.

No pre-commit hooks - you (Claude Code) enforce quality before commits. Always run `npm run pre-commit` before committing.

## Merge Conflicts

See `.claude/MERGE_CONFLICT_RESOLUTION.md` for complete guide. Quick strategy: Compare OURS vs BASE, THEIRS vs BASE, classify as Compatible/Redundant/Conflicting. Always test merged code.

## Styling Framework

**CRITICAL: This project uses Panda CSS, NOT Tailwind CSS.**

**See `.claude/reference/panda-css.md` for complete reference (gotchas, dark mode, fixing corrupted styled-system).**

Quick reference:
- Config: `/panda.config.ts`, Generated: `/styled-system/`
- Import: `import { css } from '../../styled-system/css'`
- Tokens: `css({ bg: 'blue.200', color: 'gray.900' })`
- **Gotcha**: `padding: '1 2'` doesn't work - use `padding: '4px 8px'` or `paddingX/paddingY`
- **Fix broken CSS**: Run `/fix-css` or see reference doc

See `.claude/GAME_THEMES.md` for standardized color theme usage in arcade games.

## Data Attributes for All Elements

**MANDATORY: All new elements MUST have data attributes for testing/debugging.**

Patterns: `data-component`, `data-element`, `data-section`, `data-action`, `data-setting`, `data-status`

Example: `<button data-action="start-game">`, `<div data-component="game-board">`

Use descriptive kebab-case names. Never skip data attributes on significant elements.

## Abacus Visualizations

**CRITICAL: Use @soroban/abacus-react for ALL abacus visualizations. Never create custom abacus components.**

**See `.claude/reference/abacus-react.md` for complete reference (SSR patterns, custom styles, examples).**

Quick reference:
- Package: `packages/abacus-react`
- Components: `AbacusReact`, `useAbacusConfig`, `useAbacusDisplay`
- Docs: `packages/abacus-react/README.md`
- **SSR gotcha**: Use build scripts for SVG generation, not Next.js route handlers

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

## Vision Components (Camera, Markers, Calibration)

**CRITICAL: Before creating or modifying any component that uses abacus vision/camera, READ:**

- **`src/components/vision/VISION_COMPONENTS.md`** - Required wiring for marker detection and rectified view
- **`src/lib/vision/recording/README.md`** - Per-problem video recording system (markers, VisionRecorder, metadata)

**Quick checklist for CameraCapture usage:**

```typescript
<CameraCapture
  enableMarkerDetection        // ← REQUIRED for marker detection
  columnCount={columnCount}    // ← REQUIRED for calibration grid
  onCalibrationChange={setCalibration}  // ← REQUIRED to receive calibration
  showRectifiedView            // ← REQUIRED to show perspective-corrected view
/>
```

**If you skip any of these props, marker detection and/or the rectified view will not work.**

## TensorFlow.js Model Debugging (Keras → Browser)

**See `.claude/reference/tensorflow-browser-debugging.md` for complete debugging guide.**

Common issues when Keras model works in Python but fails in browser:
1. **Normalization mismatch** - Check if model has internal Rescaling layer (don't double-normalize)
2. **Quantization corruption** - Export without `--quantize_uint8` flag
3. **Output tensor ordering** - Detect by shape, not index

Key files: `scripts/test_model.py`, `src/lib/vision/columnClassifier.ts`

## Animation Patterns (React-Spring)

**See `.claude/ANIMATION_PATTERNS.md` for continuous animation patterns.**

Key pattern: Spring the SPEED, manually integrate the ANGLE via rAF loop.

## Game Settings Persistence

**See `.claude/GAME_SETTINGS_PERSISTENCE.md` for complete documentation.**

If a setting doesn't persist, check: Provider, Socket Server, and Validator - all three must handle the setting.

## Arcade Room Architecture

**See `.claude/ARCADE_ROOM_ARCHITECTURE.md` for complete documentation.**

Key rule: One Room Rule - users can only be in one room at a time. Creating/joining auto-leaves from previous rooms.

## Z-Index and Stacking Context Management

**See `.claude/Z_INDEX_MANAGEMENT.md` for complete documentation.**

Use `import { Z_INDEX } from "@/constants/zIndex"` - never use magic numbers. Remember: z-index only works within the same stacking context.

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

**See `.claude/procedures/database-migrations.md` for the complete migration workflow.**

Quick reference:
1. Modify schema in `src/db/schema/`
2. Run `npx drizzle-kit generate --custom`
3. Edit the generated SQL file
4. Run `npm run db:migrate`
5. Verify with `mcp__sqlite__describe_table`

The skill covers: never modifying DB directly, timestamp ordering bugs, statement breakpoints, and fixing deployed migrations.

## Deployment Verification

**CRITICAL: Never assume deployment is complete just because the website is accessible.**

**See `.claude/DEPLOYMENT.md` for complete deployment documentation.**

Quick rules:
- GitHub Actions success ≠ NAS deployment (5-7 min delay for compose-updater)
- Always verify NAS commit SHA matches origin/main HEAD before reporting success
- Use the Deployment Info modal (⌘⇧I) or `docker inspect` to check running version

## CRITICAL: React Query - Mutations Must Invalidate Related Queries

**See `.claude/reference/react-query-mutations.md` for complete patterns and examples.**

Quick rules:
- NEVER use `fetch()` + `router.refresh()` for mutations - it won't update React Query cache
- Check `src/hooks/` for existing mutation hooks before writing new ones
- All mutations must call `queryClient.invalidateQueries()` with correct keys
- Use `mutation.isPending` for loading states, not `useState`

Query keys defined in: `src/lib/queryKeys.ts`

## Flowchart Walker System

**See [`src/lib/flowcharts/README.md`](../src/lib/flowcharts/README.md) for complete documentation.**
**See [`.claude/procedures/FLOWCHART_MODIFICATIONS.md`](./procedures/FLOWCHART_MODIFICATIONS.md) for modification patterns.**

**Finding Mermaid content:** Check `definitions/index.ts` first (some flowcharts embed mermaid there), otherwise check `.mmd` file referenced in JSON's `mermaidFile` field.

## Daily Practice System

**See [`docs/DAILY_PRACTICE_SYSTEM.md`](../docs/DAILY_PRACTICE_SYSTEM.md) for complete documentation.**

Key files: `src/lib/curriculum/progress-manager.ts`, `src/hooks/usePlayerCurriculum.ts`, `src/app/practice/`

## Rithmomachia Game

**See `src/arcade-games/rithmomachia/SPEC.md` for complete specification.**

8×16 board, mathematical capture relations, harmony victory conditions. Use `number` not `bigint` for piece values.
