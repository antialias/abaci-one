# Multi-stage build for Soroban Abacus Flashcards
FROM node:20-alpine AS base

# Install Python, build tools for better-sqlite3, and canvas native dependencies
# canvas is an optional dep of jsdom (used by vitest) and requires cairo/pango
RUN apk add --no-cache \
    python3 \
    py3-setuptools \
    make \
    g++ \
    pkgconfig \
    cairo-dev \
    pango-dev \
    libjpeg-turbo-dev \
    giflib-dev \
    librsvg-dev \
    pixman-dev

# Install pnpm and turbo
RUN npm install -g pnpm@9.15.4 turbo@1.10.0

WORKDIR /app

# Copy package files for dependency resolution
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/core/client/node/package.json ./packages/core/client/node/
COPY packages/abacus-react/package.json ./packages/abacus-react/
COPY packages/templates/package.json ./packages/templates/
COPY packages/llm-client/package.json ./packages/llm-client/

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
# Increase Node.js heap size to avoid OOM during Next.js build
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN turbo build --filter=@soroban/web

# Production dependencies stage - install only runtime dependencies
# IMPORTANT: Must use same base as runner stage for binary compatibility (better-sqlite3)
FROM node:20-slim AS deps
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
COPY packages/llm-client/package.json ./packages/llm-client/

# Install ONLY production dependencies
RUN pnpm install --frozen-lockfile --prod

# Typst builder stage - download and prepare typst binary
FROM node:20-slim AS typst-builder
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
    TYPST_VERSION="v0.13.0" && \
    wget -q "https://github.com/typst/typst/releases/download/${TYPST_VERSION}/typst-${TYPST_ARCH}.tar.xz" && \
    tar -xf "typst-${TYPST_ARCH}.tar.xz" && \
    mv "typst-${TYPST_ARCH}/typst" /usr/local/bin/typst && \
    chmod +x /usr/local/bin/typst

# Production image
FROM node:20-slim AS runner
WORKDIR /app

# Build argument to enable LiteFS for distributed SQLite
ARG ENABLE_LITEFS=false

# Install ONLY runtime dependencies (no build tools)
# python3-venv is needed for creating virtual environments for ML training
# ffmpeg is needed for encoding vision recording frames to MP4
# fuse3 and sqlite3 are needed for LiteFS
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    qpdf \
    ca-certificates \
    ffmpeg \
    fuse3 \
    sqlite3 \
    && rm -rf /var/lib/apt/lists/*

# Copy LiteFS binary (only used when ENABLE_LITEFS=true)
COPY --from=flyio/litefs:0.5 /usr/local/bin/litefs /usr/local/bin/litefs

# Copy typst binary from typst-builder stage
COPY --from=typst-builder /usr/local/bin/typst /usr/local/bin/typst

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy built Next.js application
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next ./apps/web/.next
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

# Copy blog content (markdown files)
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/content ./apps/web/content

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

# Copy ML training scripts (for vision model training)
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/scripts/train-column-classifier ./apps/web/scripts/train-column-classifier

# Install Python dependencies for flashcard generation
RUN pip3 install --no-cache-dir --break-system-packages -r packages/core/requirements.txt

# Copy package.json files for module resolution
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/package.json ./apps/web/

# Set up environment
WORKDIR /app/apps/web

# Create data directory for SQLite database, uploads, and vision training
RUN mkdir -p data/uploads data/vision-training/collected data/vision-training/.venv && chown -R nextjs:nodejs data

# Copy LiteFS configuration (used when LITEFS_ENABLED=true at runtime)
COPY --chown=nextjs:nodejs apps/web/litefs.yml ./litefs.yml

# Create LiteFS directories (used when running with LiteFS)
RUN mkdir -p /litefs /var/lib/litefs && chown -R nextjs:nodejs /litefs /var/lib/litefs

# Note: When running with LiteFS, the container must run as root (for FUSE mount)
# and use the litefs mount command as entrypoint. The app will run as nextjs via exec.
# Without LiteFS, run as nextjs user directly.
USER nextjs
EXPOSE 3000
# LiteFS proxy listens on 8080, app on 3000
EXPOSE 8080
ENV PORT=3000
# Note: Don't set HOSTNAME here - LiteFS needs the pod's actual hostname
ENV NODE_ENV=production

# Default: run without LiteFS (for local dev and Docker Compose)
# For k8s with LiteFS: override with command "litefs mount" and run as root
CMD ["node", "server.js"]
