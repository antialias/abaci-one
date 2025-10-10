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

# Install Python and build tools for better-sqlite3 (needed at runtime)
RUN apk add --no-cache python3 py3-setuptools make g++

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built Next.js application
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next ./apps/web/.next
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

# Copy server files (compiled from TypeScript)
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/server.js ./apps/web/
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/dist ./apps/web/dist

# Copy database migrations
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/drizzle ./apps/web/drizzle

# Copy node_modules (for dependencies)
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/node_modules ./apps/web/node_modules

# Copy package.json files for module resolution
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/package.json ./apps/web/

# Set up environment
WORKDIR /app/apps/web

# Create data directory for SQLite database
RUN mkdir -p data && chown nextjs:nodejs data

USER nextjs
EXPOSE 3000
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"
ENV NODE_ENV production

# Start the application
CMD ["node", "server.js"]