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
4. Only after all checks pass can you:
   - Say the work is "done" or "complete"
   - Mark tasks as finished
   - Create commits
   - Tell the user it's working
5. Push immediately after committing

**Nothing is complete until `npm run pre-commit` passes.**

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
