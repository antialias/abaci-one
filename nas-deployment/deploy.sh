#!/bin/bash

# Soroban Abacus Flashcards - NAS Deployment Script
# This script deploys the monorepo's apps/web to abaci.one

set -e

NAS_HOST="nas.home.network"
NAS_PATH="/volume1/homes/antialias/projects/abaci.one"
LOCAL_DIR="$(dirname "$0")"

echo "🚀 Deploying Soroban Abacus Flashcards to NAS..."

# Stop existing services
echo "📦 Stopping existing services..."
ssh "$NAS_HOST" "cd '$NAS_PATH' && docker-compose down || true"

# Copy deployment files
echo "📁 Copying deployment files..."
scp "$LOCAL_DIR/docker-compose.yaml" "$NAS_HOST:$NAS_PATH/"
scp "$LOCAL_DIR/.env" "$NAS_HOST:$NAS_PATH/" 2>/dev/null || echo "⚠️  No .env file found locally - using existing on NAS"

# Ensure DDNS config is in place (only if it doesn't exist)
ssh "$NAS_HOST" "mkdir -p '$NAS_PATH/ddns-data'"
scp "$LOCAL_DIR/ddns-data/ddns-config.json" "$NAS_HOST:$NAS_PATH/ddns-data/" 2>/dev/null || echo "ℹ️  Using existing DDNS config"

# Create required directories
echo "📂 Creating required directories..."
ssh "$NAS_HOST" "cd '$NAS_PATH' && mkdir -p public data uploads"

# Pull latest image and start services
echo "🐳 Starting services..."
ssh "$NAS_HOST" "cd '$NAS_PATH' && docker-compose pull && docker-compose up -d"

# Show status
echo "✅ Deployment complete!"
echo ""
echo "🌐 Services:"
echo "  - Soroban Flashcards: https://abaci.one"
echo "  - DDNS Web UI: http://$(ssh "$NAS_HOST" "hostname -I | awk '{print \$1}'"):8000"
echo ""
echo "📊 Check status:"
echo "  ssh $NAS_HOST 'cd $NAS_PATH && docker-compose ps'"
echo ""
echo "📝 View logs:"
echo "  ssh $NAS_HOST 'cd $NAS_PATH && docker-compose logs -f soroban-abacus-flashcards'"