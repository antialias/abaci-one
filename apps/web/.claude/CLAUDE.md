# Claude Code Instructions for apps/web

## MANDATORY: Pre-Commit Quality Checks

**BEFORE EVERY COMMIT**, you MUST run and pass these checks:

```bash
npm run pre-commit
```

This command runs:
1. `tsc --noEmit` - Type checking (must have 0 errors)
2. `npm run format` - Auto-format all code
3. `npm run lint:fix` - Auto-fix lint issues
4. `npm run lint` - Verify 0 errors, 0 warnings

**DO NOT COMMIT** until all checks pass with zero errors and zero warnings.

## Workflow

When asked to make changes and commit:

1. Make your code changes
2. Run `npm run pre-commit`
3. If it fails, fix the issues and run again
4. Only create commits after all checks pass
5. Push immediately after committing

## Details

See `.claude/CODE_QUALITY_REGIME.md` for complete documentation.

## No Pre-Commit Hooks

This project does not use git pre-commit hooks for religious reasons.
You (Claude Code) are responsible for enforcing code quality before commits.

## Key Scripts

- `npm run pre-commit` - Run all quality checks (use before every commit)
- `npm run type-check` - TypeScript type checking
- `npm run format` - Format code with Biome
- `npm run lint` - Check linting
- `npm run lint:fix` - Fix linting issues automatically

---

**Remember: Always run `npm run pre-commit` before creating commits.**
