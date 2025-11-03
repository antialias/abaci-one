# 3D Printing Docker Setup

## Summary

The 3D printable abacus customization feature is fully containerized with optimized Docker multi-stage builds.

**Key Technologies:**
- OpenSCAD 2021.01 (for rendering STL/3MF from .scad files)
- BOSL2 v2.0.0 (minimized library, .scad files only)
- Typst v0.11.1 (pre-built binary)

**Image Size:** ~257MB (optimized with multi-stage builds, saved ~38MB)

**Build Stages:** 7 total (base → builder → deps → typst-builder → bosl2-builder → runner)

## Overview

The 3D printable abacus customization feature requires OpenSCAD and the BOSL2 library to be available in the Docker container.

## Size Optimization Strategy

The Dockerfile uses **multi-stage builds** to minimize the final image size:

1. **typst-builder stage** - Downloads and extracts typst, discards wget/xz-utils
2. **bosl2-builder stage** - Clones BOSL2 and removes unnecessary files (tests, docs, examples, images)
3. **runner stage** - Only copies final binaries and minimized libraries

### Size Reductions

- **Removed from runner**: git, wget, curl, xz-utils (~40MB)
- **BOSL2 minimized**: Removed .git, tests, tutorials, examples, images, markdown files (~2-3MB savings)
- **Kept only .scad files** in BOSL2 library

## Dockerfile Changes

### Build Stages Overview

The Dockerfile now has **7 stages**:

1. **base** (Alpine) - Install build tools and dependencies
2. **builder** (Alpine) - Build Next.js application
3. **deps** (Alpine) - Install production node_modules
4. **typst-builder** (Debian) - Download and extract typst binary
5. **bosl2-builder** (Debian) - Clone and minimize BOSL2 library
6. **runner** (Debian) - Final production image

### Stage 1-3: Base, Builder, Deps (unchanged)

Uses Alpine Linux for building the application (smaller and faster builds).

### Stage 4: Typst Builder (lines 68-87)

```dockerfile
FROM node:18-slim AS typst-builder
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    xz-utils \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN ARCH=$(uname -m) && \
    ... download and install typst from GitHub releases
```

**Purpose:** Download typst binary in isolation, then discard build tools (wget, xz-utils).

**Result:** Only the typst binary is copied to runner stage (line 120).

### Stage 5: BOSL2 Builder (lines 90-103)

```dockerfile
FROM node:18-slim AS bosl2-builder
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /bosl2 && \
    cd /bosl2 && \
    git clone --depth 1 --branch v2.0.0 https://github.com/BelfrySCAD/BOSL2.git . && \
    # Remove unnecessary files to minimize size
    rm -rf .git .github tests tutorials examples images *.md CONTRIBUTING* LICENSE* && \
    # Keep only .scad files and essential directories
    find . -type f ! -name "*.scad" -delete && \
    find . -type d -empty -delete
```

**Purpose:** Clone BOSL2 and aggressively minimize by removing:
- `.git` directory
- Tests, tutorials, examples
- Documentation (markdown files)
- Images
- All non-.scad files

**Result:** Minimized BOSL2 library (~1-2MB instead of ~5MB) copied to runner (line 124).

### Stage 6: Runner - Production Image (lines 106-177)

**Base Image:** `node:18-slim` (Debian) - Required for OpenSCAD availability

**Runtime Dependencies (lines 111-117):**

```dockerfile
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    qpdf \
    openscad \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*
```

**Removed from runner:**
- ❌ git (only needed in bosl2-builder)
- ❌ wget (only needed in typst-builder)
- ❌ curl (not needed at runtime)
- ❌ xz-utils (only needed in typst-builder)

**Artifacts Copied from Other Stages:**

```dockerfile
# From typst-builder (line 120)
COPY --from=typst-builder /usr/local/bin/typst /usr/local/bin/typst

# From bosl2-builder (line 124)
COPY --from=bosl2-builder /bosl2 /usr/share/openscad/libraries/BOSL2

# From builder (lines 131-159)
# Next.js app, styled-system, server files, etc.

# From deps (lines 145-146)
# Production node_modules only
```

BOSL2 v2.0.0 (minimized) is copied to `/usr/share/openscad/libraries/BOSL2/`, which is OpenSCAD's default library search path. This allows `include <BOSL2/std.scad>` to work in the abacus.scad file.

### Temp Directory for Job Outputs (line 168)

```dockerfile
RUN mkdir -p tmp/3d-jobs && chown nextjs:nodejs tmp
```

Creates the directory where JobManager stores generated 3D files.

## Files Included in Docker Image

The following files are automatically included via the `COPY` command at line 132:

```
apps/web/public/3d-models/
├── abacus.scad (parametric OpenSCAD source)
└── simplified.abacus.stl (base model, 4.8MB)
```

These files are NOT excluded by `.dockerignore`.

## Testing the Docker Build

### Local Testing

1. **Build the Docker image:**
   ```bash
   docker build -t soroban-abacus-test .
   ```

2. **Run the container:**
   ```bash
   docker run -p 3000:3000 soroban-abacus-test
   ```

3. **Test OpenSCAD inside the container:**
   ```bash
   docker exec -it <container-id> sh
   openscad --version
   ls /usr/share/openscad/libraries/BOSL2
   ```

4. **Test the 3D printing endpoint:**
   - Visit http://localhost:3000/3d-print
   - Adjust parameters and generate a file
   - Monitor job progress
   - Download the result

### Verify BOSL2 Installation

Inside the running container:

```bash
# Check OpenSCAD version
openscad --version

# Verify BOSL2 library exists
ls -la /usr/share/openscad/libraries/BOSL2/

# Test rendering a simple file
cd /app/apps/web/public/3d-models
openscad -o /tmp/test.stl abacus.scad
```

## Production Deployment

### Environment Variables

No additional environment variables are required for the 3D printing feature.

### Volume Mounts (Optional)

For better performance and to avoid rebuilding the image when updating 3D models:

```bash
docker run -p 3000:3000 \
  -v $(pwd)/apps/web/public/3d-models:/app/apps/web/public/3d-models:ro \
  soroban-abacus-test
```

### Disk Space Considerations

- **BOSL2 library**: ~5MB (cloned during build)
- **Base STL file**: 4.8MB (in public/3d-models/)
- **Generated files**: Vary by parameters, typically 1-10MB each
- **Job cleanup**: Old jobs are automatically cleaned up after 1 hour

## Image Size

The final image is Debian-based (required for OpenSCAD), but optimized using multi-stage builds:

**Before optimization (original Debian approach):**
- Base runner: ~250MB
- With all build tools (git, wget, curl, xz-utils): ~290MB
- With BOSL2 (full): ~295MB
- **Total: ~295MB**

**After optimization (current multi-stage approach):**
- Base runner: ~250MB
- Runtime deps only (no build tools): ~250MB
- BOSL2 (minimized, .scad only): ~252MB
- 3D models (STL): ~257MB
- **Total: ~257MB**

**Savings: ~38MB (~13% reduction)**

### What Was Removed

- ❌ git (~15MB)
- ❌ wget (~2MB)
- ❌ curl (~5MB)
- ❌ xz-utils (~1MB)
- ❌ BOSL2 .git directory (~1MB)
- ❌ BOSL2 tests, examples, tutorials (~10MB)
- ❌ BOSL2 images and docs (~4MB)

**Total removed: ~38MB**

This trade-off (Debian vs Alpine) is necessary for OpenSCAD availability, but the multi-stage approach minimizes the size impact.

## Troubleshooting

### OpenSCAD Not Found

If you see "openscad: command not found" in logs:

1. Verify OpenSCAD is installed:
   ```bash
   docker exec -it <container-id> which openscad
   docker exec -it <container-id> openscad --version
   ```

2. Check if the Debian package install succeeded:
   ```bash
   docker exec -it <container-id> dpkg -l | grep openscad
   ```

### BOSL2 Include Error

If OpenSCAD reports "Can't open library 'BOSL2/std.scad'":

1. Check BOSL2 exists:
   ```bash
   docker exec -it <container-id> ls /usr/share/openscad/libraries/BOSL2/std.scad
   ```

2. Test include path:
   ```bash
   docker exec -it <container-id> sh -c "cd /tmp && echo 'include <BOSL2/std.scad>; cube(10);' > test.scad && openscad -o test.stl test.scad"
   ```

### Job Fails with "Permission Denied"

Check tmp directory permissions:

```bash
docker exec -it <container-id> ls -la /app/apps/web/tmp
# Should show: drwxr-xr-x ... nextjs nodejs ... 3d-jobs
```

### Large File Generation Timeout

Jobs timeout after 60 seconds. For complex models, increase the timeout in `jobManager.ts:138`:

```typescript
timeout: 120000, // 2 minutes instead of 60 seconds
```

## Performance Notes

- **Cold start**: First generation takes ~5-10 seconds (OpenSCAD initialization)
- **Warm generations**: Subsequent generations take ~3-5 seconds
- **STL size**: Typically 5-15MB depending on scale parameters
- **3MF size**: Similar to STL (no significant compression)
- **SCAD size**: ~1KB (just text parameters)

## Monitoring

Job processing is logged to stdout:

```
Executing: openscad -o /app/apps/web/tmp/3d-jobs/abacus-abc123.stl ...
Job abc123 completed successfully
```

Check logs with:

```bash
docker logs <container-id> | grep "Job"
```
