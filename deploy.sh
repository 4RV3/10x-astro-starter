#!/bin/bash
set -e

echo "🚀 Starting deployment..."

# Variables
DEPLOY_PATH="/opt/10xcards"
COMPOSE_FILE="docker-compose.production.yml"

# Navigate to deployment directory
cd "$DEPLOY_PATH"

# Check if secrets exist
if [ ! -f "secrets/supabase.env" ] || [ ! -f "secrets/app.env" ]; then
  echo "❌ Error: secrets/supabase.env or secrets/app.env not found!"
  echo "Please create these files with your configuration."
  exit 1
fi

# Pull latest image
echo "📦 Pulling latest Docker image..."
docker compose -f "$COMPOSE_FILE" pull app

# Stop and remove old containers
echo "🛑 Stopping old containers..."
docker compose -f "$COMPOSE_FILE" down

# Start new containers
echo "✅ Starting new containers..."
docker compose -f "$COMPOSE_FILE" up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to be ready..."
sleep 15

# Show status
echo "📊 Container status:"
docker compose -f "$COMPOSE_FILE" ps

# Check app health
echo "🏥 Checking application health..."
if docker compose -f "$COMPOSE_FILE" ps | grep -q "10xcards-app.*Up"; then
  echo "✅ Application is running!"
else
  echo "⚠️  Warning: Application may not be healthy. Check logs:"
  echo "   docker compose -f $COMPOSE_FILE logs app"
fi

# Clean up old images
echo "🧹 Cleaning up old images..."
docker image prune -af --filter "until=24h"

echo "✨ Deployment complete!"
echo "📱 Access your app at: http://localhost:8080"

