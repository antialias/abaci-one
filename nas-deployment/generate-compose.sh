#!/bin/bash
#
# Generate docker-compose.blue.yaml and docker-compose.green.yaml
# from the main docker-compose.yaml
#
# compose-updater needs separate files to restart containers independently.
# This script extracts each service into its own file.
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Check for yq
if ! command -v yq &> /dev/null; then
    echo "Error: yq is required but not installed."
    echo "Install with: brew install yq"
    exit 1
fi

echo "Generating docker-compose.blue.yaml..."
yq eval --yaml-fix-merge-anchor-to-spec '
  explode(.) |
  {
    "version": .version,
    "services": {"blue": .services.blue},
    "networks": .networks
  }
' docker-compose.yaml | yq 'del(.services.blue.depends_on)' > docker-compose.blue.yaml

echo "Generating docker-compose.green.yaml..."
yq eval --yaml-fix-merge-anchor-to-spec '
  explode(.) |
  {
    "version": .version,
    "services": {"green": .services.green},
    "networks": .networks
  }
' docker-compose.yaml | yq 'del(.services.green.depends_on)' > docker-compose.green.yaml

echo "Done!"
echo ""
echo "Generated files:"
ls -la docker-compose.blue.yaml docker-compose.green.yaml
echo ""
echo "Verify no secrets were included:"
grep -l "sk-" docker-compose.*.yaml 2>/dev/null && echo "WARNING: Found secrets!" || echo "OK - no secrets found"
