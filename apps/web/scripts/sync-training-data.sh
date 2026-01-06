#!/bin/bash
#
# Sync vision training data from production to local devbox
#
# Usage:
#   ./scripts/sync-training-data.sh           # Pull from prod
#   ./scripts/sync-training-data.sh --dry-run # Show what would be synced
#
# Prerequisites:
#   - SSH access to nas.home.network
#   - Production container mounts data/vision-training/collected/

set -euo pipefail

# Configuration
REMOTE_HOST="nas.home.network"
REMOTE_USER="antialias"
REMOTE_PATH="/volume1/homes/antialias/projects/abaci.one/data/vision-training/collected/"
LOCAL_PATH="$(dirname "$0")/../data/vision-training/collected/"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Parse args
DRY_RUN=""
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN="--dry-run"
  echo -e "${YELLOW}DRY RUN MODE - No files will be transferred${NC}"
fi

# Ensure local directory exists
mkdir -p "$LOCAL_PATH"

echo -e "${GREEN}Syncing training data from production...${NC}"
echo "  Remote: ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}"
echo "  Local:  ${LOCAL_PATH}"
echo ""

# Rsync with progress
rsync -avz --progress $DRY_RUN \
  "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}" \
  "${LOCAL_PATH}"

echo ""
echo -e "${GREEN}Done!${NC}"

# Show stats
if [[ -z "$DRY_RUN" ]]; then
  echo ""
  echo "Local training data stats:"
  for digit in 0 1 2 3 4 5 6 7 8 9; do
    count=$(find "${LOCAL_PATH}${digit}" -name "*.png" 2>/dev/null | wc -l | tr -d ' ')
    echo "  Digit $digit: $count images"
  done
  total=$(find "${LOCAL_PATH}" -name "*.png" 2>/dev/null | wc -l | tr -d ' ')
  echo "  Total: $total images"
fi
