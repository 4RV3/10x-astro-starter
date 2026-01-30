#!/bin/bash

echo "🧹 Cleaning up Docker containers and volumes..."

COMPOSE_FILE="docker-compose.production.yml"

# Stop and remove all containers
echo "🛑 Stopping containers..."
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
  echo "$LEFTOVER_VOLUMES" | xargs docker volume rm 2>/dev/null || true
  echo "✅ Removed leftover volumes"
else
  echo "✅ No leftover volumes found"
fi

# Show current state
echo ""
echo "📊 Current Docker state:"
echo "Containers:"
docker ps -a --filter "name=10xcards" --format "table {{.Names}}\t{{.Status}}" || echo "  (none)"
echo ""
echo "Volumes:"
docker volume ls | grep -E '10xcards|supabase' || echo "  (none)"

echo ""
echo "✨ Cleanup complete!"
echo ""
echo "To deploy fresh, run:"
echo "  ./deploy.sh"
