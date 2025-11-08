# Production Deployment Guide

This document describes the production deployment infrastructure and procedures for the abaci.one web application.

## Infrastructure Overview

### Production Server

- **Host**: `nas.home.network` (Synology NAS DS923+)
- **Access**: SSH access required
  - Must be connected to network at **730 N. Oak Park Ave**
  - Server is not accessible from external networks
- **Project Directory**: `/volume1/homes/antialias/projects/abaci.one`

### Docker Configuration

This deployment uses **two separate Docker Compose projects**:

1. **soroban-app** (`docker-compose.yaml`)
   - Main web application
   - Container: `soroban-abacus-flashcards`
   - Image: `ghcr.io/antialias/soroban-abacus-flashcards:main`
   - Port: 3000 (internal to Docker network)

2. **soroban-updater** (`docker-compose.updater.yaml`)
   - Automatic update service
   - Container: `compose-updater`
   - Image: `virtualzone/compose-updater:latest`
   - Checks for new images every 5 minutes

**Why separate projects?** If compose-updater was in the same project as the app, running `docker-compose down` would kill itself mid-update. Separate projects prevent this.

### Auto-Deployment with compose-updater

- **compose-updater** monitors and auto-updates containers
- **Update frequency**: Every **5 minutes** (configurable via `INTERVAL=5`)
- Works WITH docker-compose files (respects configuration, volumes, environment variables)
- Automatically cleans up old images (`CLEANUP=1`)
- No manual intervention required for deployments after pushing to main

**Key advantages over Watchtower:**

- Respects docker-compose.yaml configuration
- Re-reads `.env` file on every update
- Can manage multiple docker-compose projects
- Container labels control which containers to watch:
  ```yaml
  labels:
    - "docker-compose-watcher.watch=1"
    - "docker-compose-watcher.dir=/volume1/homes/antialias/projects/abaci.one"
    - "com.centurylinklabs.watchtower.enable=false" # Disables Watchtower for this container
  ```

## Database Management

### Location

- **Database path**: `data/sqlite.db` (relative to project directory)
- **WAL files**: `data/sqlite.db-shm` and `data/sqlite.db-wal`

### Migrations

- **Automatic**: Migrations run on server startup via `server.js`
- **Migration folder**: `./drizzle`
- **Process**:
  1. Server starts
  2. Logs: `🔄 Running database migrations...`
  3. Drizzle migrator runs all pending migrations
  4. Logs: `✅ Migrations complete` (on success)
  5. Logs: `❌ Migration failed: [error]` (on failure, process exits)

### Nuke and Rebuild Database

If you need to completely reset the production database:

```bash
# SSH into the server
ssh nas.home.network

# Navigate to project directory
cd /volume1/homes/antialias/projects/abaci.one

# Stop the container
/usr/local/bin/docker-compose down

# Remove database files
rm -f data/sqlite.db data/sqlite.db-shm data/sqlite.db-wal

# Restart container (migrations will rebuild DB)
/usr/local/bin/docker-compose up -d

# Check logs to verify migration success
/usr/local/bin/docker logs soroban-abacus-flashcards | grep -E '(Migration|Starting)'
```

## CI/CD Pipeline

### GitHub Actions

When code is pushed to `main` branch:

1. **Workflows triggered**:
   - `Build and Deploy` - Builds Docker image and pushes to GHCR
   - `Release` - Manages semantic versioning and releases
   - `Verify Examples` - Runs example tests
   - `Deploy Storybooks to GitHub Pages` - Publishes Storybook

2. **Image build**:
   - Built image is tagged as `main` (also `latest` for compatibility)
   - Pushed to GitHub Container Registry (ghcr.io)
   - Typically completes within 1-2 minutes

3. **Deployment**:
   - compose-updater detects new image (within 5 minutes)
   - Pulls new image
   - Runs `docker-compose down && docker-compose up -d`
   - Cleans up old images
   - Total deployment time: ~5-7 minutes from push to production (15-30 seconds downtime during restart)

## Manual Deployment Procedures

### Force Pull Latest Image

If you need to immediately deploy without waiting for compose-updater's next check cycle:

```bash
# Option 1: Restart compose-updater (triggers immediate check)
ssh nas.home.network "cd /volume1/homes/antialias/projects/abaci.one && docker-compose -f docker-compose.updater.yaml restart"

# Option 2: Manual pull and restart
ssh nas.home.network "cd /volume1/homes/antialias/projects/abaci.one && docker-compose pull && docker-compose up -d"
```

### Check Container Status

```bash
# Check both app and compose-updater
ssh nas.home.network "docker ps | grep -E '(soroban|compose)'"

# Check just the app
ssh nas.home.network "docker ps | grep soroban-abacus-flashcards"
```

### View Logs

```bash
# Application logs - recent
ssh nas.home.network "docker logs --tail 100 soroban-abacus-flashcards"

# Application logs - follow in real-time
ssh nas.home.network "docker logs -f soroban-abacus-flashcards"

# compose-updater logs - see update activity
ssh nas.home.network "docker logs --tail 50 compose-updater"

# compose-updater logs - follow to watch for updates
ssh nas.home.network "docker logs -f compose-updater"

# Search for specific patterns
ssh nas.home.network "docker logs soroban-abacus-flashcards" | grep -i "error"
```

### Restart Container

```bash
# Restart just the app (quick, minimal downtime)
ssh nas.home.network "cd /volume1/homes/antialias/projects/abaci.one && docker-compose restart"

# Full restart (down then up, recreates container)
ssh nas.home.network "cd /volume1/homes/antialias/projects/abaci.one && docker-compose down && docker-compose up -d"

# Restart compose-updater (triggers immediate update check)
ssh nas.home.network "cd /volume1/homes/antialias/projects/abaci.one && docker-compose -f docker-compose.updater.yaml restart"
```

## Checking Deployed Version

Always verify what's actually running in production:

```bash
# Get commit SHA of running container
ssh nas.home.network 'docker inspect soroban-abacus-flashcards --format="{{index .Config.Labels \"org.opencontainers.image.revision\"}}"'

# Compare with current HEAD
git rev-parse HEAD

# Or check via the deployment info modal in the app UI
```

## Troubleshooting

### Common Issues

#### 1. Migration Failures

**Symptom**: Container keeps restarting, logs show migration errors

**Solution**:

1. Check migration files in `drizzle/` directory
2. Verify `drizzle/meta/_journal.json` is up to date
3. If migrations are corrupted, may need to nuke database (see above)

#### 2. Container Not Updating

**Symptom**: Changes pushed but production still shows old code

**Possible causes**:

- GitHub Actions build failed - check workflow status with `gh run list`
- compose-updater not running - check with `docker ps | grep compose-updater`
- compose-updater labels incorrect - check container labels
- Image not pulled - manually pull with `docker-compose pull`

**Debugging**:

```bash
# Check compose-updater is running
ssh nas.home.network "docker ps | grep compose-updater"

# Check compose-updater logs for errors
ssh nas.home.network "docker logs --tail 50 compose-updater"

# Check container labels are correct
ssh nas.home.network "docker inspect soroban-abacus-flashcards" | grep -A3 "docker-compose-watcher"
# Should show:
#   "docker-compose-watcher.watch": "1"
#   "docker-compose-watcher.dir": "/volume1/homes/antialias/projects/abaci.one"
```

**Solution**:

```bash
# Option 1: Restart compose-updater to force immediate check
ssh nas.home.network "cd /volume1/homes/antialias/projects/abaci.one && docker-compose -f docker-compose.updater.yaml restart"

# Option 2: Manual pull and restart
ssh nas.home.network "cd /volume1/homes/antialias/projects/abaci.one && docker-compose pull && docker-compose up -d"
```

#### 3. Missing Database Columns

**Symptom**: Errors like `SqliteError: no such column: "column_name"`

**Cause**: Migration not registered or not run

**Solution**:

1. Verify migration exists in `drizzle/` directory
2. Check migration is registered in `drizzle/meta/_journal.json`
3. If migration is new, restart container to run migrations
4. If migration is malformed, fix it and nuke database

#### 4. API Returns Unexpected Response

**Symptom**: Client shows errors but API appears to work

**Debugging**:

1. Test API directly with curl: `curl -X POST 'https://abaci.one/api/arcade/rooms' -H 'Content-Type: application/json' -d '...'`
2. Check production logs for errors
3. Verify container is running latest image:
   ```bash
   ssh nas.home.network "/usr/local/bin/docker inspect soroban-abacus-flashcards --format '{{.Created}}'"
   ```
4. Compare with commit timestamp: `git log --format="%ci" -1`

## Environment Variables

Production environment variables are stored in `.env` file on the server and loaded via `env_file:` in docker-compose.yaml.

**Critical advantage**: compose-updater re-reads the `.env` file on every update, so environment variable changes are automatically picked up without manual intervention.

Common variables:

- `AUTH_URL` - Base URL (https://abaci.one)
- `AUTH_SECRET` - Random secret for sessions (NEVER share!)
- `AUTH_TRUST_HOST=true` - Required for NextAuth v5
- `DATABASE_URL` - SQLite database path (optional, defaults to `./data/sqlite.db`)

To update environment variables:

```bash
# Edit .env file on NAS
ssh nas.home.network "vi /volume1/homes/antialias/projects/abaci.one/.env"

# Restart compose-updater (will pick up new .env on next cycle)
ssh nas.home.network "cd /volume1/homes/antialias/projects/abaci.one && docker-compose -f docker-compose.updater.yaml restart"
```

## Network Configuration

- **Reverse Proxy**: Traefik
- **HTTPS**: Automatic via Traefik with Let's Encrypt
- **Domain**: abaci.one
- **Exposed Port**: 3000 (internal to Docker network)

## Security Notes

- Production database contains user data and should be handled carefully
- SSH access is restricted to local network only
- Docker container runs with appropriate user permissions
- Secrets are managed via environment variables, not committed to repo
