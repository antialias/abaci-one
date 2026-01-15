# Production Deployment Guide

This document describes the production deployment infrastructure and procedures for the abaci.one web application.

## Infrastructure Overview

### Production Server

- **Host**: `nas.home.network` (Synology NAS DS923+)
- **Access**: SSH access required
  - Must be connected to network at **730 N. Oak Park Ave**
  - Server is not accessible from external networks
- **Project Directory**: `/volume1/homes/antialias/projects/abaci.one`

### Deployment Strategy: Blue-Green with Load Balancing

Two containers (`abaci-blue` and `abaci-green`) run simultaneously:

- **Shared resources**: Both containers mount the same data volumes
- **Health checks**: Traefik only routes to healthy containers
- **Zero downtime**: When one container restarts, the other serves traffic
- **Automatic updates**: compose-updater pulls new images and restarts containers

### Auto-Deployment with compose-updater

- **compose-updater** monitors and auto-updates containers
- **Update frequency**: Every **5 minutes** (configurable via `INTERVAL=5`)
- Works WITH docker-compose files (respects configuration, volumes, environment variables)
- Automatically cleans up old images (`CLEANUP=1`)

## Health Check Endpoint

The `/api/health` endpoint verifies container readiness:

```bash
curl https://abaci.one/api/health
```

Response:

```json
{
  "status": "healthy",
  "timestamp": "2025-01-14T12:00:00.000Z",
  "checks": {
    "database": {
      "status": "ok",
      "latencyMs": 2
    }
  }
}
```

- Returns `200 OK` when healthy
- Returns `503 Service Unavailable` when unhealthy
- Traefik uses this to determine if a container should receive traffic

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
  5. Health check passes only after migrations complete

### Nuke and Rebuild Database

If you need to completely reset the production database:

```bash
# SSH into the server
ssh nas.home.network

# Navigate to project directory
cd /volume1/homes/antialias/projects/abaci.one

# Stop both containers
docker stop abaci-blue abaci-green

# Remove database files
rm -f data/sqlite.db data/sqlite.db-shm data/sqlite.db-wal

# Restart containers (migrations will rebuild DB)
docker start abaci-blue abaci-green

# Check logs to verify migration success
docker logs abaci-blue | grep -E '(Migration|Starting)'
```

## CI/CD Pipeline

### GitHub Actions

When code is pushed to `main` branch:

1. **Build and Push job**:
   - Builds Docker image
   - Tags as `main` and `latest`
   - Pushes to GitHub Container Registry (ghcr.io)

2. **Deploy** (compose-updater on NAS):
   - Detects new image within 5 minutes
   - Pulls new image
   - Restarts containers
   - Traefik routes traffic to healthy containers

## Manual Deployment Procedures

### Force Pull Latest Image

```bash
# Option 1: Restart compose-updater (triggers immediate check)
ssh nas.home.network "cd /volume1/homes/antialias/projects/abaci.one && docker-compose -f docker-compose.updater.yaml restart"

# Option 2: Manual pull and restart
ssh nas.home.network "cd /volume1/homes/antialias/projects/abaci.one && docker-compose pull && docker-compose up -d"
```

### Check Container Status

```bash
# Check both containers
ssh nas.home.network "docker ps | grep abaci"

# Check health
curl https://abaci.one/api/health
```

### View Logs

```bash
# Blue container logs
ssh nas.home.network "docker logs --tail 100 abaci-blue"

# Green container logs
ssh nas.home.network "docker logs --tail 100 abaci-green"

# Follow in real-time
ssh nas.home.network "docker logs -f abaci-blue"

# compose-updater logs
ssh nas.home.network "docker logs --tail 50 compose-updater"
```

### Restart Containers

```bash
# Restart both (they restart one at a time, maintaining availability)
ssh nas.home.network "cd /volume1/homes/antialias/projects/abaci.one && docker-compose restart"
```

## Checking Deployed Version

```bash
# Get commit SHA of running containers
ssh nas.home.network 'docker inspect abaci-blue --format="{{index .Config.Labels \"org.opencontainers.image.revision\"}}"'
ssh nas.home.network 'docker inspect abaci-green --format="{{index .Config.Labels \"org.opencontainers.image.revision\"}}"'

# Compare with current HEAD
git rev-parse HEAD
```

## Troubleshooting

### Health Check Failing

1. Check container logs:

   ```bash
   ssh nas.home.network "docker logs abaci-blue"
   ```

2. Test health endpoint manually:

   ```bash
   ssh nas.home.network "docker exec abaci-blue curl -sf http://localhost:3000/api/health"
   ```

3. Check database connectivity

### Container Not Updating

1. Verify GitHub Actions completed successfully
2. Check compose-updater is running:
   ```bash
   ssh nas.home.network "docker ps | grep compose-updater"
   ```
3. Check compose-updater logs for errors:
   ```bash
   ssh nas.home.network "docker logs --tail 50 compose-updater"
   ```

### Both Containers Unhealthy

```bash
# Force restart both
ssh nas.home.network "cd /volume1/homes/antialias/projects/abaci.one && docker-compose restart"
```

### Migration Failures

**Symptom**: Container keeps restarting, logs show migration errors

**Solution**:

1. Check migration files in `drizzle/` directory
2. Verify `drizzle/meta/_journal.json` is up to date
3. If migrations are corrupted, may need to nuke database (see above)

## Environment Variables

Production environment variables are stored in `.env` file on the server and loaded via `env_file:` in docker-compose.yaml.

Common variables:

- `AUTH_URL` - Base URL (https://abaci.one)
- `AUTH_SECRET` - Random secret for sessions (NEVER share!)
- `AUTH_TRUST_HOST=true` - Required for NextAuth v5
- `DATABASE_URL` - SQLite database path (optional, defaults to `./data/sqlite.db`)

To update environment variables:

```bash
# Edit .env file on NAS
ssh nas.home.network "vi /volume1/homes/antialias/projects/abaci.one/.env"

# Restart containers to pick up changes
ssh nas.home.network "cd /volume1/homes/antialias/projects/abaci.one && docker-compose restart"
```

## Network Configuration

- **Reverse Proxy**: Traefik
- **HTTPS**: Automatic via Traefik with Let's Encrypt
- **Domain**: abaci.one
- **Exposed Port**: 3000 (internal to Docker network)
- **Load Balancing**: Traefik routes to both containers, health checks determine eligibility

## Security Notes

- Production database contains user data and should be handled carefully
- SSH access is restricted to local network only
- Docker container runs with appropriate user permissions
- Secrets are managed via environment variables, not committed to repo
- Health check endpoint doesn't expose sensitive data
