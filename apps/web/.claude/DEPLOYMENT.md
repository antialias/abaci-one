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
- **Docker binary**: `/usr/local/bin/docker`
- **Docker Compose binary**: `/usr/local/bin/docker-compose`
- **Container name**: `soroban-abacus-flashcards`
- **Image**: `ghcr.io/antialias/soroban-abacus-flashcards:latest`

### Auto-Deployment
- **Watchtower** monitors and auto-updates containers
- **Update frequency**: Every **5 minutes**
- Watchtower pulls latest images and restarts containers automatically
- No manual intervention required for deployments after pushing to main

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
   - Built image is tagged as `latest`
   - Pushed to GitHub Container Registry (ghcr.io)
   - Typically completes within 1-2 minutes

3. **Deployment**:
   - Watchtower detects new image (within 5 minutes)
   - Pulls latest image
   - Recreates and restarts container
   - Total deployment time: ~5-7 minutes from push to production

## Manual Deployment Procedures

### Force Pull Latest Image
If you need to immediately deploy without waiting for Watchtower:

```bash
ssh nas.home.network "cd /volume1/homes/antialias/projects/abaci.one && /usr/local/bin/docker-compose pull && /usr/local/bin/docker-compose up -d"
```

### Check Container Status
```bash
ssh nas.home.network "/usr/local/bin/docker ps | grep -E '(soroban|abaci)'"
```

### View Logs
```bash
# Recent logs
ssh nas.home.network "/usr/local/bin/docker logs --tail 100 soroban-abacus-flashcards"

# Follow logs in real-time
ssh nas.home.network "/usr/local/bin/docker logs -f soroban-abacus-flashcards"

# Search for specific patterns
ssh nas.home.network "/usr/local/bin/docker logs soroban-abacus-flashcards" | grep -i "error"
```

### Restart Container
```bash
ssh nas.home.network "cd /volume1/homes/antialias/projects/abaci.one && /usr/local/bin/docker-compose restart"
```

## Deployment Script

The project includes a deployment script at `nas-deployment/deploy.sh` for manual deployments.

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
- Watchtower not running - check with `docker ps | grep watchtower`
- Image not pulled - manually pull with `docker-compose pull`

**Solution**:
```bash
# Force pull and restart
ssh nas.home.network "cd /volume1/homes/antialias/projects/abaci.one && /usr/local/bin/docker-compose pull && /usr/local/bin/docker-compose up -d"
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

Production environment variables are configured in the docker-compose.yml file on the server. Common variables:

- `NEXT_PUBLIC_URL` - Base URL for the application
- `DATABASE_URL` - SQLite database path
- Additional variables may be set in `.env.production` or docker-compose.yml

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
