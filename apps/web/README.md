# Soroban Web Application

Interactive web application for learning soroban (Japanese abacus) calculation with tutorials, practice sessions, and multiplayer arcade games.

## Features

- **Tutorials** - Step-by-step lessons for learning soroban techniques
- **Practice Sessions** - Adaptive practice with progressive help system
- **Arcade Games** - Multiplayer educational games for reinforcement
- **Worksheet Generator** - Create printable math worksheets

## Getting Started

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Run type checks
npm run type-check

# Run all quality checks
npm run pre-commit
```

## Documentation

### Components

| Component | Description |
|-----------|-------------|
| [Decomposition Display](./src/components/decomposition/README.md) | Interactive mathematical decomposition visualization |
| [Worksheet Generator](./src/app/create/worksheets/README.md) | Math worksheet creation with Typst PDF generation |

### Games

| Game | Description |
|------|-------------|
| [Arcade System](./src/arcade-games/README.md) | Modular multiplayer game architecture |
| [Know Your World](./src/arcade-games/know-your-world/README.md) | Geography quiz game |

### Developer Documentation

Located in `.claude/` directory:

- `CLAUDE.md` - Project conventions and guidelines
- `CODE_QUALITY_REGIME.md` - Quality check procedures
- `GAME_SETTINGS_PERSISTENCE.md` - Game config architecture
- `Z_INDEX_MANAGEMENT.md` - Z-index layering system
- `DEPLOYMENT.md` - Deployment and CI/CD

## Project Structure

```
apps/web/
├── src/
│   ├── app/                 # Next.js App Router pages
│   ├── components/          # Shared React components
│   │   ├── decomposition/   # Math decomposition display
│   │   ├── practice/        # Practice session components
│   │   └── tutorial/        # Tutorial player components
│   ├── contexts/            # React context providers
│   ├── arcade-games/        # Multiplayer game implementations
│   ├── hooks/               # Custom React hooks
│   ├── lib/                 # Utilities and libraries
│   └── db/                  # Database schema and queries
├── .claude/                 # Developer documentation
├── public/                  # Static assets
└── styled-system/           # Generated Panda CSS
```

## Technology Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Panda CSS
- **Database**: SQLite with Drizzle ORM
- **Abacus Visualization**: @soroban/abacus-react

## Related Documentation

**Parent**: [Main README](../../README.md) - Complete project overview
**Abacus Component**: [packages/abacus-react](../../packages/abacus-react/README.md) - Abacus visualization library
