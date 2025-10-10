# Contributing to Soroban Abacus Flashcards

## Commit Message Guidelines

This project uses [Conventional Commits](https://conventionalcommits.org/) for automated versioning and changelog generation.

### Commit Message Format

```
<type>: <description>

[optional body]

[optional footer(s)]
```

### Types

- **feat**: A new feature
- **fix**: A bug fix
- **docs**: Documentation only changes
- **style**: Changes that do not affect the meaning of the code (white-space, formatting, etc)
- **refactor**: A code change that neither fixes a bug nor adds a feature
- **perf**: A code change that improves performance
- **test**: Adding missing tests or correcting existing tests
- **build**: Changes that affect the build system or external dependencies
- **ci**: Changes to our CI configuration files and scripts
- **chore**: Other changes that don't modify src or test files
- **revert**: Reverts a previous commit

### Examples

```bash
feat: add fullscreen support to Memory Quiz game
fix: resolve TypeScript errors across the codebase
docs: update deployment documentation
style: format code with prettier
refactor: extract reusable GameSelector component
perf: optimize abacus rendering performance
test: add unit tests for GameModeContext
build: update dependencies to latest versions
ci: add semantic release workflow
chore: update gitignore for Panda CSS
```

### Breaking Changes

For breaking changes, add `BREAKING CHANGE:` in the footer or append `!` after the type:

```bash
feat!: redesign GameMode API with new interface

BREAKING CHANGE: GameMode context now requires explicit player configuration
```

## Automated Releases

This project uses semantic-release for automated versioning:

- **feat**: Triggers a minor version bump (1.0.0 → 1.1.0)
- **fix**: Triggers a patch version bump (1.0.0 → 1.0.1)
- **BREAKING CHANGE**: Triggers a major version bump (1.0.0 → 2.0.0)

### Package-Specific Publishing

The `@soroban/abacus-react` package has independent versioning and automated npm publishing. Use scoped commits to trigger package releases:

#### NPM Package Release Triggers

```bash
# Minor version bump for new features
feat(abacus-react): add new bead animation system

# Patch version bump for bug fixes
fix(abacus-react): resolve gesture detection issue

# Patch version bump for performance improvements
perf(abacus-react): optimize bead rendering performance

# Major version bump for breaking changes
feat(abacus-react)!: change callback signature
# or
feat(abacus-react): redesign API

BREAKING CHANGE: callback functions now receive different parameters
```

#### Package Release Workflow

1. **Automatic**: Any commit to `main` branch with `(abacus-react)` scope triggers publishing
2. **Dual publishing**: Package is published to both npm and GitHub Packages simultaneously
3. **Manual testing**: From `packages/abacus-react/`, run `pnpm release:dry-run`
4. **Version tags**: Package releases are tagged as `abacus-react-v1.2.3` (separate from monorepo versions)
5. **Authentication**: Requires `NPM_TOKEN` secret for npm and uses `GITHUB_TOKEN` for GitHub Packages

#### Important Notes

- **Package scope required**: Use `feat(abacus-react):` not just `feat:` for package releases
- **Independent versioning**: Package versions are separate from monorepo versions
- **Path filtering**: Only changes in `packages/abacus-react/` directory trigger builds
- **Test requirements**: Package tests must pass before publishing

## Development Workflow

1. Create a feature branch from `main`
2. Make your changes following conventional commit format
3. Push to GitHub - this triggers deployment to staging
4. Create a PR to `main`
5. Merge to `main` triggers:
   - Automated release (if applicable)
   - Production deployment to https://abaci.one
   - Changelog generation

## Getting Started

```bash
# Install dependencies
pnpm install

# Setup development environment
pnpm setup

# Start development server
pnpm dev

# Run tests
pnpm test

# Build for production
pnpm build
```
