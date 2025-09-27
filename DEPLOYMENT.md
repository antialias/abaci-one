# Soroban Abacus Flashcards - Production Deployment System

## Overview

The Soroban Abacus Flashcards application is deployed to production at `https://abaci.one` using a fully automated CI/CD pipeline. The system follows the established NAS deployment pattern with Docker containerization, GitHub Actions for CI/CD, Traefik reverse proxy, Watchtower for auto-updates, and Porkbun DDNS integration.

## Architecture

```
User Request → Cloudflare → abaci.one (DDNS) → Synology NAS → Traefik → Docker Container
```

### Components

1. **Source**: Monorepo with pnpm workspaces and Turborepo
2. **CI/CD**: GitHub Actions with automated Docker builds
3. **Registry**: GitHub Container Registry (ghcr.io)
4. **Deployment**: Synology NAS with Docker Compose
5. **Reverse Proxy**: Traefik with Let's Encrypt SSL
6. **Auto-Updates**: Watchtower (5-minute polling)
7. **DNS**: Porkbun DDNS for dynamic IP updates

## Deployment Process

### 1. Code Push Triggers Build

When code is pushed to the `main` branch:

1. GitHub Actions workflow (`.github/workflows/deploy.yml`) triggers
2. Multi-stage Docker build runs:
   - Install dependencies with pnpm
   - Generate Panda CSS styled-system
   - Build Next.js app with Turborepo
   - Create optimized production image
3. Image pushed to `ghcr.io/antialias/soroban-abacus-flashcards`

### 2. Automatic Deployment

1. **Global Watchtower** (located at `/volume1/homes/antialias/projects/global-services/`) polls GitHub Container Registry every 5 minutes
2. Detects new image version and pulls it
3. Gracefully stops old container and starts new one
4. Traefik automatically routes traffic to new container

**Note**: We use a centralized global Watchtower service that monitors ALL containers across the NAS, rather than project-specific Watchtower instances.

### 3. DNS and SSL

1. Porkbun DDNS keeps `abaci.one` pointing to current NAS IP
2. Traefik handles SSL certificate provisioning via Let's Encrypt
3. Automatic HTTPS redirect and certificate renewal

## File Structure

```
/
├── Dockerfile                           # Multi-stage build configuration
├── .github/workflows/deploy.yml         # CI/CD pipeline
├── apps/web/next.config.js             # Next.js standalone output config
├── nas-deployment/
│   ├── docker-compose.yaml             # Production container orchestration
│   └── .env                            # Environment variables (not committed)
└── DEPLOYMENT.md                       # This documentation
```

## Key Configuration Files

### Dockerfile
- Multi-stage build optimized for monorepo
- pnpm workspace dependency management
- Panda CSS generation step
- Next.js standalone output for optimal Docker deployment
- Proper static file serving configuration

### GitHub Actions Workflow
- Triggers on push to main branch
- Builds and pushes Docker images to ghcr.io
- Uses GitHub Container Registry for hosting
- Simplified build process (no type checking in CI)

### Docker Compose
- Single service deployment
- Traefik labels for reverse proxy routing
- Watchtower compatibility for auto-updates
- Environment variable configuration

### Next.js Configuration
- Standalone output mode for Docker optimization
- Build optimization settings
- Static file serving configuration

## Environment Variables

Required in `nas-deployment/.env`:

```bash
# GitHub Container Registry
GITHUB_TOKEN=<personal_access_token>
GITHUB_USERNAME=<username>

# Application
NODE_ENV=production
```

## NAS Deployment Directory

```
/volume1/homes/antialias/projects/abaci.one/
├── docker-compose.yaml
├── .env
└── logs/
```

## Monitoring and Maintenance

### Checking Deployment Status

```bash
# On NAS
docker-compose ps
docker-compose logs -f app

# GitHub Actions status
gh run list --repo antialias/soroban-abacus-flashcards
```

### Manual Updates

```bash
# Force update (if needed)
docker-compose pull
docker-compose up -d
```

### DNS Status

```bash
# Check DNS resolution
nslookup abaci.one
```

## Troubleshooting

### Common Issues

1. **CSS not loading**: Check static file paths in Dockerfile
2. **DNS not updating**: Verify DDNS configuration in existing updater
3. **Container not starting**: Check environment variables and logs
4. **SSL certificate issues**: Traefik will auto-renew, check Traefik logs

### Build Failures

1. **TypeScript errors**: Review apps/web/src files for type issues
2. **Dependency issues**: Verify workspace dependencies are correctly referenced
3. **Docker build timeout**: Check .dockerignore and build optimization

### Production Issues

1. **Site not accessible**: Check Traefik configuration and DNS
2. **Auto-updates not working**: Verify Watchtower is running
3. **Performance issues**: Monitor container resources

## Security

- Non-root user in Docker container
- Minimal Alpine Linux base image
- GitHub Container Registry with token authentication
- Traefik handles SSL termination
- No sensitive data in committed files

## Dependencies

### External Services
- GitHub (source code and CI/CD)
- GitHub Container Registry (image hosting)
- Porkbun (DNS management)
- Let's Encrypt (SSL certificates)

### Infrastructure
- Synology NAS (hosting)
- Docker and Docker Compose
- Traefik reverse proxy
- **Global Watchtower** (centralized auto-updater for all containers)

## Backup and Recovery

### Container Recovery
```bash
# Stop and remove container
docker-compose down

# Pull latest image
docker-compose pull

# Start fresh container
docker-compose up -d
```

### Configuration Backup
- `docker-compose.yaml` and `.env` files are backed up via NAS snapshots
- Source code is version controlled in GitHub
- Container images stored in GitHub Container Registry

## Performance Optimization

- Next.js standalone output reduces image size
- Multi-stage Docker build minimizes production image
- Panda CSS pre-compilation
- Traefik connection pooling and compression
- Docker layer caching in CI/CD

## Future Improvements

- Health checks in Docker configuration
- Container resource limits
- Monitoring and alerting integration
- Staging environment setup
- Database integration (if needed)

---

*This deployment system provides a production-ready, automated, and maintainable infrastructure for the Soroban Abacus Flashcards application.*