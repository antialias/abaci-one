# Soroban Abacus Flashcards - Production Deployment System

## Overview

The Soroban Abacus Flashcards application is deployed to production at `https://abaci.one` using a blue-green deployment strategy with zero-downtime updates.

## Architecture

```
User Request → Cloudflare → abaci.one (DDNS) → Synology NAS → Traefik → Docker (Blue + Green)
```

### Components

1. **Source**: Monorepo with pnpm workspaces and Turborepo
2. **CI/CD**: GitHub Actions builds and pushes Docker images
3. **Registry**: GitHub Container Registry (ghcr.io)
4. **Auto-Deploy**: compose-updater detects new images
5. **Load Balancing**: Traefik routes to healthy containers
6. **Reverse Proxy**: Traefik with Let's Encrypt SSL
7. **DNS**: Porkbun DDNS for dynamic IP updates

## Blue-Green Deployment

Two containers (`abaci-blue` and `abaci-green`) run simultaneously:

- **Shared resources**: Both containers mount the same data volumes
- **Health checks**: Traefik only routes to healthy containers
- **Zero downtime**: When one container restarts, the other serves traffic
- **Automatic updates**: compose-updater pulls new images and restarts containers

### How It Works

```
1. Push to main branch
   ↓
2. GitHub Actions builds and pushes Docker image to ghcr.io
   ↓
3. compose-updater detects new image (checks every 5 minutes)
   ↓
4. compose-updater restarts containers one at a time
   ↓
5. Traefik health checks ensure traffic only goes to ready containers
```

### Health Check Endpoint

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

## Deployment Process

### Automatic Deployment

When code is pushed to the `main` branch:

1. **Build Phase** (GitHub Actions):
   - Multi-stage Docker build
   - Image pushed to `ghcr.io/antialias/soroban-abacus-flashcards`

2. **Deploy Phase** (compose-updater on NAS):
   - Detects new image within 5 minutes
   - Pulls new image
   - Restarts containers (one at a time)
   - Traefik routes traffic to healthy containers

### Manual Deployment

```bash
# From local machine (with SSH access to NAS)
./nas-deployment/deploy.sh
```

This script handles migration from the old single-container setup to blue-green.

## File Structure

```
/
├── Dockerfile                           # Multi-stage build configuration
├── .github/workflows/deploy.yml         # CI/CD pipeline (build + push)
├── apps/web/
│   └── src/app/api/health/route.ts     # Health check endpoint
├── nas-deployment/
│   ├── docker-compose.yaml             # Blue-green container config
│   ├── deploy.sh                       # Manual deployment/migration script
│   └── .env                            # Environment variables (not committed)
└── DEPLOYMENT.md                       # This documentation
```

## Docker Compose Configuration

Both containers share the same volumes and Traefik service:

```yaml
services:
  blue:
    image: ghcr.io/antialias/soroban-abacus-flashcards:latest
    container_name: abaci-blue
    volumes:
      - ./data:/app/apps/web/data # Shared database
      - ./uploads:/app/uploads # Shared uploads
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
    labels:
      - "traefik.http.services.abaci.loadbalancer.server.port=3000"
      - "traefik.http.services.abaci.loadbalancer.healthcheck.path=/api/health"

  green:
    # Same configuration as blue, shares volumes
```

Traefik automatically load balances between both containers, routing only to healthy ones.

## Monitoring and Maintenance

### Check Deployment Status

```bash
# Check running containers
ssh nas.home.network "docker ps | grep abaci"

# Check health of both containers
curl https://abaci.one/api/health

# Check compose-updater logs
ssh nas.home.network "docker logs --tail 50 compose-updater"
```

### View Logs

```bash
# Blue container logs
ssh nas.home.network "docker logs -f abaci-blue"

# Green container logs
ssh nas.home.network "docker logs -f abaci-green"
```

### Force Immediate Update

```bash
# Restart compose-updater to trigger immediate check
ssh nas.home.network "cd /volume1/homes/antialias/projects/abaci.one && docker-compose -f docker-compose.updater.yaml restart"

# Or manually pull and restart
ssh nas.home.network "cd /volume1/homes/antialias/projects/abaci.one && docker-compose pull && docker-compose up -d"
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
3. Check compose-updater logs for errors

### Both Containers Unhealthy

```bash
# Force restart both
ssh nas.home.network "cd /volume1/homes/antialias/projects/abaci.one && docker-compose restart"
```

## Migration from Single Container

If upgrading from the old single-container setup:

```bash
./nas-deployment/deploy.sh
```

This script will:

1. Stop the old `soroban-abacus-flashcards` container
2. Stop compose-updater temporarily
3. Deploy the new docker-compose.yaml
4. Start both blue and green containers
5. Restart compose-updater

## Security

- Non-root user in Docker container
- Minimal Alpine Linux base image
- GitHub Container Registry with token authentication
- Traefik handles SSL termination
- Health check doesn't expose sensitive data

## Performance

- Zero-downtime deployments via load balancing
- Health checks prevent routing to unhealthy containers
- Both containers share data - no sync needed
- SQLite WAL mode handles concurrent access

---

_Last updated: January 2025_
