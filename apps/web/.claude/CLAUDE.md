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

This command runs:
1. `tsc --noEmit` - Type checking (must have 0 errors)
2. `npm run format` - Auto-format all code
3. `npm run lint:fix` - Auto-fix lint issues
4. `npm run lint` - Verify 0 errors, 0 warnings

**DO NOT COMMIT** until all checks pass with zero errors and zero warnings.

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

## Key Scripts

- `npm run pre-commit` - Run all quality checks (use before every commit)
- `npm run type-check` - TypeScript type checking
- `npm run format` - Format code with Biome
- `npm run lint` - Check linting
- `npm run lint:fix` - Fix linting issues automatically

---

**Remember: Always run `npm run pre-commit` before creating commits.**
