#!/bin/bash

echo "🧹 Cleaning up Docker containers and volumes..."

COMPOSE_FILE="docker-compose.production.yml"

# Load environment variables if available
if [ -f "secrets/supabase.env" ]; then
  set -a
  source secrets/supabase.env 2>/dev/null || true
  source secrets/app.env 2>/dev/null || true
  export DOCKER_IMAGE="${DOCKER_IMAGE:-ghcr.io/4rv3/10x-astro-starter:latest}"
  set +a
fi

# Force stop all 10xcards containers (even if compose file has issues)
echo "🛑 Force stopping all containers..."
docker ps -aq --filter "name=10xcards" | xargs -r docker stop 2>/dev/null || true
docker ps -aq --filter "name=10xcards" | xargs -r docker rm -f 2>/dev/null || true

# Stop and remove via compose (if possible)
docker compose -f "$COMPOSE_FILE" down 2>/dev/null || true

# Remove volumes
echo "🗑️  Removing volumes..."
docker compose -f "$COMPOSE_FILE" down -v 2>/dev/null || true

# Clean up any remaining 10xcards or supabase volumes
echo "🔍 Checking for leftover volumes..."
LEFTOVER_VOLUMES=$(docker volume ls -q | grep -E '10xcards|supabase' || true)

if [ -n "$LEFTOVER_VOLUMES" ]; then
  echo "Found leftover volumes:"
  echo "$LEFTOVER_VOLUMES" | sed 's/^/  - /'
  echo "Removing..."
  echo "$LEFTOVER_VOLUMES" | xargs docker volume rm -f 2>/dev/null || true
  echo "✅ Removed leftover volumes"
else
  echo "✅ No leftover volumes found"
fi

# Show current state
echo ""
echo "📊 Current Docker state:"
echo "Containers:"
docker ps -a --filter "name=10xcards" --format "table {{.Names}}\t{{.Status}}" 2>/dev/null || echo "  (none)"
echo ""
echo "Volumes:"
docker volume ls | grep -E '10xcards|supabase' 2>/dev/null || echo "  (none)"

echo ""
echo "✨ Cleanup complete!"
echo ""
echo "To deploy fresh, run:"
echo "  ./deploy.sh"
