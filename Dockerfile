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
COPY packages/abacus-react/package.json ./packages/abacus-react/
COPY packages/templates/package.json ./packages/templates/

# Install ALL dependencies for build stage
RUN pnpm install --frozen-lockfile

# Builder stage
FROM base AS builder

# Accept git information as build arguments
ARG GIT_COMMIT
ARG GIT_COMMIT_SHORT
ARG GIT_BRANCH
ARG GIT_TAG
ARG GIT_DIRTY

# Set as environment variables for build scripts
ENV GIT_COMMIT=${GIT_COMMIT}
ENV GIT_COMMIT_SHORT=${GIT_COMMIT_SHORT}
ENV GIT_BRANCH=${GIT_BRANCH}
ENV GIT_TAG=${GIT_TAG}
ENV GIT_DIRTY=${GIT_DIRTY}

COPY . .

# Generate Panda CSS styled-system before building
RUN cd apps/web && npx @pandacss/dev

# Build using turbo for apps/web and its dependencies
RUN turbo build --filter=@soroban/web

# Production dependencies stage - install only runtime dependencies
# IMPORTANT: Must use same base as runner stage for binary compatibility (better-sqlite3)
FROM node:18-slim AS deps
WORKDIR /app

# Install build tools temporarily for better-sqlite3 installation
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm
RUN npm install -g pnpm@9.15.4

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
COPY packages/core/client/node/package.json ./packages/core/client/node/
COPY packages/abacus-react/package.json ./packages/abacus-react/
COPY packages/templates/package.json ./packages/templates/

# Install ONLY production dependencies
RUN pnpm install --frozen-lockfile --prod

# Typst builder stage - download and prepare typst binary
FROM node:18-slim AS typst-builder
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    xz-utils \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN ARCH=$(uname -m) && \
    if [ "$ARCH" = "x86_64" ]; then \
        TYPST_ARCH="x86_64-unknown-linux-musl"; \
    elif [ "$ARCH" = "aarch64" ]; then \
        TYPST_ARCH="aarch64-unknown-linux-musl"; \
    else \
        echo "Unsupported architecture: $ARCH" && exit 1; \
    fi && \
    TYPST_VERSION="v0.11.1" && \
    wget -q "https://github.com/typst/typst/releases/download/${TYPST_VERSION}/typst-${TYPST_ARCH}.tar.xz" && \
    tar -xf "typst-${TYPST_ARCH}.tar.xz" && \
    mv "typst-${TYPST_ARCH}/typst" /usr/local/bin/typst && \
    chmod +x /usr/local/bin/typst

# BOSL2 builder stage - clone and minimize the library
FROM node:18-slim AS bosl2-builder
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /bosl2 && \
    cd /bosl2 && \
    git clone --depth 1 https://github.com/BelfrySCAD/BOSL2.git . && \
    # Remove unnecessary files to minimize size
    rm -rf .git .github tests tutorials examples images *.md CONTRIBUTING* LICENSE* && \
    # Keep only .scad files and essential directories
    find . -type f ! -name "*.scad" -delete && \
    find . -type d -empty -delete

# Production image - Using Debian base for OpenSCAD availability
FROM node:18-slim AS runner
WORKDIR /app

# Install ONLY runtime dependencies (no build tools)
# Using Debian because OpenSCAD is not available in Alpine repos
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    qpdf \
    openscad \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy typst binary from typst-builder stage
COPY --from=typst-builder /usr/local/bin/typst /usr/local/bin/typst

# Copy minimized BOSL2 library from bosl2-builder stage
RUN mkdir -p /usr/share/openscad/libraries
COPY --from=bosl2-builder /bosl2 /usr/share/openscad/libraries/BOSL2

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy built Next.js application
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next ./apps/web/.next
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

# Copy Panda CSS generated styles
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/styled-system ./apps/web/styled-system

# Copy server files (compiled from TypeScript)
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/server.js ./apps/web/
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/dist ./apps/web/dist

# Copy database migrations
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/drizzle ./apps/web/drizzle

# Copy PRODUCTION node_modules only (no dev dependencies)
COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=deps --chown=nextjs:nodejs /app/apps/web/node_modules ./apps/web/node_modules

# Copy core package (needed for Python flashcard generation scripts)
COPY --from=builder --chown=nextjs:nodejs /app/packages/core ./packages/core

# Copy templates package (needed for Typst templates)
COPY --from=builder --chown=nextjs:nodejs /app/packages/templates ./packages/templates

# Copy abacus-react package (needed for calendar generation scripts)
COPY --from=builder --chown=nextjs:nodejs /app/packages/abacus-react ./packages/abacus-react

# Install Python dependencies for flashcard generation
RUN pip3 install --no-cache-dir --break-system-packages -r packages/core/requirements.txt

# Copy package.json files for module resolution
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/package.json ./apps/web/

# Set up environment
WORKDIR /app/apps/web

# Create data directory for SQLite database
RUN mkdir -p data && chown nextjs:nodejs data

# Create tmp directory for 3D job outputs
RUN mkdir -p tmp/3d-jobs && chown nextjs:nodejs tmp

USER nextjs
EXPOSE 3000
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"
ENV NODE_ENV production

# Start the application
CMD ["node", "server.js"]
