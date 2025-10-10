# Automated Workflows for Claude

This file documents automated workflows that Claude should be aware of when working on this project.

## NPM Package Publishing

### @soroban/abacus-react Package

**Status**: ✅ Fully configured and ready for automated publishing to npm

**How to trigger a release**:

```bash
# Minor version bump (new features)
git commit -m "feat(abacus-react): add new bead animation system"

# Patch version bump (bug fixes)
git commit -m "fix(abacus-react): resolve gesture detection issue"

# Patch version bump (performance)
git commit -m "perf(abacus-react): optimize bead rendering"

# Major version bump (breaking changes)
git commit -m "feat(abacus-react)!: change callback signature"
```

**Key Requirements**:

- Must use `(abacus-react)` scope in commit message
- Changes must be in `packages/abacus-react/` directory
- NPM_TOKEN secret must be configured in GitHub repository settings

**Workflow Details**:

- **File**: `.github/workflows/publish-abacus-react.yml`
- **Triggers**: Push to main branch with changes in `packages/abacus-react/`
- **Steps**: Install deps → Build package → Run tests → Configure dual auth → Semantic release → Publish to npm + GitHub Packages
- **Versioning**: Independent from monorepo (uses tags like `abacus-react-v1.2.3`)
- **Publishing**: Dual publishing to both npm and GitHub Packages simultaneously

**Current Status**:

- ✅ Workflow configured for dual publishing
- ✅ Semantic release setup for both registries
- ✅ Package build/test passing
- ✅ GitHub Packages authentication configured (uses GITHUB_TOKEN)
- ⏸️ Awaiting NPM_TOKEN secret for actual npm publishing

**What Claude should do**:
When making changes to the abacus-react package:

1. Use the proper commit format with `(abacus-react)` scope
2. Remember this will trigger automatic npm publishing
3. Ensure changes are meaningful enough for a version bump
4. Reference this workflow in explanations to users

## Storybook Deployment

**Status**: ✅ Fully functional

**Trigger**: Any push to main branch
**Output**: https://antialias.github.io/soroban-abacus-flashcards/

- Web app Storybook: `/web/`
- Abacus React component Storybook: `/abacus-react/`

## Semantic Release (Monorepo)

**Status**: ✅ Configured to exclude abacus-react scope

**Workflow**: Regular commits without `(abacus-react)` scope trigger monorepo releases
**Versioning**: Affects root package.json version and creates GitHub releases

## Claude Guidelines

1. **Always check commit scope**: When working on abacus-react, use `(abacus-react)` scope
2. **Be intentional**: Package releases are permanent - ensure changes warrant a version bump
3. **Documentation**: Point users to CONTRIBUTING.md for full details
4. **Status awareness**: Remember NPM_TOKEN is required for actual publishing
5. **Testing**: Package tests must pass before publishing (currently has workaround for vitest config issue)

## Quick Reference

| Action                       | Commit Format                      | Result                      |
| ---------------------------- | ---------------------------------- | --------------------------- |
| Add abacus-react feature     | `feat(abacus-react): description`  | npm minor version bump      |
| Fix abacus-react bug         | `fix(abacus-react): description`   | npm patch version bump      |
| Breaking abacus-react change | `feat(abacus-react)!: description` | npm major version bump      |
| Regular monorepo feature     | `feat: description`                | monorepo minor version bump |
| Regular monorepo fix         | `fix: description`                 | monorepo patch version bump |

## Files to Reference

- `CONTRIBUTING.md` - Full contributor guidelines
- `packages/abacus-react/README.md` - Package-specific documentation
- `.github/workflows/publish-abacus-react.yml` - Publishing workflow
- `packages/abacus-react/.releaserc.json` - Semantic release config
