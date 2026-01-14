#!/bin/bash
#
# Migration/Manual Deployment Script for Soroban Abacus Flashcards
#
# This script handles:
# 1. Migration from single-container to blue-green setup
# 2. Manual deployments when you don't want to wait for compose-updater
#
# Usage:
#   ./deploy.sh              # Deploy/migrate to blue-green setup
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NAS_HOST="${NAS_HOST:-nas.home.network}"
NAS_PATH="${NAS_PATH:-/volume1/homes/antialias/projects/abaci.one}"
IMAGE="ghcr.io/antialias/soroban-abacus-flashcards"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[deploy]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[deploy]${NC} $1"
}

error() {
    echo -e "${RED}[deploy]${NC} $1" >&2
}

# Run a command on the NAS via SSH
# Synology NAS needs /usr/local/bin in PATH for docker commands
nas_exec() {
    ssh "$NAS_HOST" "export PATH=/usr/local/bin:\$PATH && cd '$NAS_PATH' && $1"
}

# Check if old single-container setup exists
check_needs_migration() {
    if nas_exec "docker ps -a --format '{{.Names}}' | grep -q '^soroban-abacus-flashcards$'"; then
        echo "yes"
    else
        echo "no"
    fi
}

# Migrate from single-container to blue-green setup
migrate_to_blue_green() {
    log "Migrating from single-container to blue-green setup..."

    # Stop old container
    warn "Stopping old container..."
    nas_exec "docker stop soroban-abacus-flashcards 2>/dev/null || true"
    nas_exec "docker rm soroban-abacus-flashcards 2>/dev/null || true"

    log "Migration complete."
}

# Sync deployment files to NAS
sync_files() {
    log "Syncing deployment files to NAS..."

    # Check if blue/green files exist (need to be generated)
    if [[ ! -f "$SCRIPT_DIR/docker-compose.blue.yaml" ]] || [[ ! -f "$SCRIPT_DIR/docker-compose.green.yaml" ]]; then
        warn "Blue/green compose files not found. Generating..."
        if [[ -x "$SCRIPT_DIR/generate-compose.sh" ]]; then
            "$SCRIPT_DIR/generate-compose.sh"
        else
            error "generate-compose.sh not found or not executable"
            error "Run: ./generate-compose.sh (requires yq)"
            exit 1
        fi
    fi

    # Copy all compose files (use -O for legacy SCP protocol - required by Synology NAS)
    scp -O "$SCRIPT_DIR/docker-compose.yaml" "$NAS_HOST:$NAS_PATH/"
    scp -O "$SCRIPT_DIR/docker-compose.blue.yaml" "$NAS_HOST:$NAS_PATH/"
    scp -O "$SCRIPT_DIR/docker-compose.green.yaml" "$NAS_HOST:$NAS_PATH/"

    # NEVER overwrite production .env automatically - it contains secrets
    # Use --sync-env flag to explicitly copy .env (dangerous!)
    if [[ "${SYNC_ENV:-}" == "true" ]]; then
        if [[ -f "$SCRIPT_DIR/.env" ]]; then
            warn "SYNC_ENV=true - copying local .env to NAS (overwrites production secrets!)"
            scp -O "$SCRIPT_DIR/.env" "$NAS_HOST:$NAS_PATH/"
        fi
    else
        log "Keeping existing .env on NAS (use SYNC_ENV=true to overwrite)"
    fi

    # Ensure directories exist
    nas_exec "mkdir -p public data uploads ddns-data"
}

# Main deployment logic
main() {
    log "=========================================="
    log "Deploying abaci.one (Blue-Green)"
    log "=========================================="
    log "NAS host: $NAS_HOST"
    echo ""

    # Sync deployment files
    sync_files
    echo ""

    # Check if we need to migrate from old setup
    local needs_migration
    needs_migration=$(check_needs_migration)
    if [[ "$needs_migration" == "yes" ]]; then
        warn "Detected old single-container setup"
        migrate_to_blue_green
        echo ""
    fi

    # Pull latest image and start containers
    log "Pulling latest image..."
    nas_exec "docker-compose pull"
    echo ""

    log "Starting containers..."
    nas_exec "docker-compose up -d"
    echo ""

    # Wait a moment for containers to start
    log "Waiting for containers to start..."
    sleep 5

    # Check status
    log "Container status:"
    nas_exec "docker ps --format 'table {{.Names}}\t{{.Status}}' | grep -E '(NAMES|abaci)'"
    echo ""

    # Test health endpoint
    log "Testing health endpoint..."
    local health_blue health_green
    health_blue=$(nas_exec "docker exec abaci-blue curl -sf http://localhost:3000/api/health 2>/dev/null && echo 'OK' || echo 'FAIL'")
    health_green=$(nas_exec "docker exec abaci-green curl -sf http://localhost:3000/api/health 2>/dev/null && echo 'OK' || echo 'FAIL'")

    log "  abaci-blue:  $health_blue"
    log "  abaci-green: $health_green"
    echo ""

    log "=========================================="
    log "Deployment complete!"
    log "=========================================="
    log "Site: https://abaci.one"
    log "Health: https://abaci.one/api/health"
    log ""
    log "Both containers are running. Traefik will load balance"
    log "between them based on health checks."
    log "=========================================="
}

# Run main
main "$@"
