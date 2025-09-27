# NAS Deployment for Soroban Abacus Flashcards

This directory contains the deployment configuration for running the Soroban Abacus Flashcards (`apps/web`) on your NAS at `abaci.one`.

## Quick Deployment

After pushing code changes to trigger the GitHub Actions build:

```bash
# From the project root
./nas-deployment/deploy.sh
```

## Manual Deployment

1. **Copy files to NAS:**
   ```bash
   scp nas-deployment/docker-compose.yaml nas.home.network:/volume1/homes/antialias/projects/abaci.one/
   scp nas-deployment/.env nas.home.network:/volume1/homes/antialias/projects/abaci.one/
   ```

2. **Deploy:**
   ```bash
   ssh nas.home.network "cd /volume1/homes/antialias/projects/abaci.one && docker-compose up -d"
   ```

## Services

- **Soroban Flashcards**: Main Next.js app at `https://abaci.one`
- **DDNS Updater**: Keeps Porkbun DNS updated with current WAN IP
- **Watchtower**: Auto-updates containers every 5 minutes when new images are pushed

## Configuration

### Environment Variables
Copy `.env.example` to `.env` and customize as needed.

### DDNS Configuration
The Porkbun DDNS configuration is in `ddns-data/ddns-config.json` and handles:
- Domain: `abaci.one`
- Provider: Porkbun
- Auto IP detection via ipinfo.io
- TTL: 300 seconds

### Traefik Integration
- Automatic HTTPS via Let's Encrypt
- HTTP → HTTPS redirect
- HSTS headers for security

## Monitoring

- **Container status**: `ssh nas.home.network 'cd /volume1/homes/antialias/projects/abaci.one && docker-compose ps'`
- **Application logs**: `ssh nas.home.network 'cd /volume1/homes/antialias/projects/abaci.one && docker-compose logs -f soroban-abacus-flashcards'`
- **DDNS web UI**: `http://[NAS-IP]:8000`

## Architecture

```
GitHub Actions → ghcr.io/antialias/soroban-abacus-flashcards:latest
                 ↓
NAS → docker-compose → Traefik → abaci.one
      ↓
      Watchtower (auto-update every 5min)
      DDNS (Porkbun IP sync)
```

## Files

- `docker-compose.yaml`: Main deployment configuration
- `deploy.sh`: Automated deployment script
- `.env.example`: Environment variables template
- `ddns-data/ddns-config.json`: Porkbun DDNS configuration
- `README.md`: This file