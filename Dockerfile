# Multi-stage build for Soroban Abacus Flashcards
FROM node:18-alpine AS base

# Install Python and build tools for better-sqlite3
RUN apk add --no-cache python3 py3-setuptools make g++

# Install pnpm and turbo
RUN npm install -g pnpm@9.15.4 turbo@1.10.0

WORKDIR /app

# Copy package files for dependency resolution
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/core/client/node/package.json ./packages/core/client/node/
COPY packages/core/client/typescript/package.json ./packages/core/client/typescript/
COPY packages/abacus-react/package.json ./packages/abacus-react/
COPY packages/templates/package.json ./packages/templates/

# Install dependencies (will use .npmrc with hoisted mode)
RUN pnpm install --frozen-lockfile

# Builder stage
FROM base AS builder
COPY . .

# Generate Panda CSS styled-system before building
RUN cd apps/web && npx @pandacss/dev

# Build using turbo for apps/web and its dependencies
RUN turbo build --filter=@soroban/web

# Production image
FROM node:18-alpine AS runner
WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application from standalone output
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

# Copy node_modules with proper structure for pnpm symlinks
# The standalone output has symlinks that point to ../../../node_modules/.pnpm
# which resolves to /node_modules/.pnpm when CWD is /app
COPY --from=builder --chown=nextjs:nodejs /app/node_modules /node_modules

# Set up environment
USER nextjs
EXPOSE 3000
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# Start the application
CMD ["node", "server.js"]