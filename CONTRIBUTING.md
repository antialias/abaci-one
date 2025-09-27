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