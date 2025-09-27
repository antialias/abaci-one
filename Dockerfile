# Multi-stage build for Soroban Abacus Flashcards
FROM node:18-alpine AS base

# Install pnpm and turbo
RUN npm install -g pnpm@8.0.0 turbo@1.10.0

WORKDIR /app

# Copy package files for dependency resolution
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/abacus-react/package.json ./packages/abacus-react/
COPY packages/templates/package.json ./packages/templates/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Builder stage
FROM base AS builder
COPY . .

# Build using turbo for apps/web and its dependencies
RUN turbo build --filter=@soroban/web

# Production image
FROM node:18-alpine AS runner
WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./public

# Set up environment
USER nextjs
EXPOSE 3000
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# Start the application
CMD ["node", "apps/web/server.js"]