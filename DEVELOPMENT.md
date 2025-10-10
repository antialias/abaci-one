# Development Setup

This document describes how to set up and run the Soroban Flashcard Generator for development.

## Architecture

This is a monorepo with the following structure:

```
.
├── apps/
│   └── web/                 # Next.js web application
├── packages/
│   └── core/
│       └── client/
│           ├── node/        # @soroban/core - Node.js TypeScript bindings
│           └── typescript/  # @soroban/client - TypeScript utilities
└── scripts/                 # Development scripts
```

## Prerequisites

- Node.js 18+
- pnpm 8+
- Python 3.8+
- Typst (for PDF generation)
- qpdf (optional, for PDF optimization)

## Quick Start

1. **Initial Setup**

   ```bash
   pnpm setup
   ```

   This script will:
   - Install all dependencies
   - Build the core packages
   - Set up Panda CSS
   - Run type checks

2. **Development**

   ```bash
   pnpm dev
   ```

   This starts all development servers in parallel using Turborepo.

   The web app will be available at: http://localhost:3000

## Available Scripts

- `pnpm setup` - Full development environment setup
- `pnpm dev` - Start all development servers
- `pnpm build` - Build all packages
- `pnpm type-check` - Run TypeScript checks
- `pnpm lint` - Run linting
- `pnpm test` - Run tests
- `pnpm clean` - Clean build artifacts

## Packages

### @soroban/core

Node.js TypeScript bindings that call the Python generator directly via `child_process`. Located in `packages/core/client/node/`.

### @soroban/web

Next.js web application with beautiful UI built using:

- **Panda CSS** for styling
- **TanStack Form** for form management
- **Radix UI** primitives for accessibility
- **Lucide React** for icons

## Development Notes

1. **TypeScript Bindings**: The web app calls Python directly through TypeScript bindings, not via a FastAPI server.

2. **Styling**: Uses Panda CSS instead of Tailwind. Run `pnpm panda` in the web app to regenerate styles.

3. **Monorepo**: Built packages must be available before the web app can use them. The setup script handles this automatically.

4. **Asset Storage**: Generated files are temporarily stored in memory. In production, use Redis or a database.

## Troubleshooting

**TypeScript errors**: Run `pnpm type-check` to see detailed errors.

**Build issues**: Try `pnpm clean` then `pnpm setup` to rebuild everything.

**Python errors**: Ensure Python 3, Typst, and qpdf are installed and accessible in PATH.
