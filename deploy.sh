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

# Validate required environment variables in supabase.env
echo "🔍 Validating secrets..."
REQUIRED_VARS=("POSTGRES_PASSWORD" "JWT_SECRET" "ANON_KEY" "SERVICE_ROLE_KEY")
MISSING_VARS=()

for var in "${REQUIRED_VARS[@]}"; do
  if ! grep -q "^${var}=.\+" secrets/supabase.env || grep -q "^${var}=.*YOUR_.*_HERE" secrets/supabase.env; then
    MISSING_VARS+=("$var")
  fi
done

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
  echo "❌ Error: Missing or placeholder values in secrets/supabase.env:"
  printf '  - %s\n' "${MISSING_VARS[@]}"
  echo ""
  echo "Please update secrets/supabase.env with actual values."
  echo "See secrets/supabase.env.example for reference."
  exit 1
fi

echo "✅ Secrets validated"

# Pull latest image
echo "📦 Pulling latest Docker image..."
docker compose -f "$COMPOSE_FILE" pull app

# Stop and remove old containers
echo "🛑 Stopping old containers..."
docker compose -f "$COMPOSE_FILE" down

# Start new containers
echo "✅ Starting new containers..."
if ! docker compose -f "$COMPOSE_FILE" up -d; then
  echo "❌ Failed to start containers!"
  echo "📋 Checking database logs..."
  docker compose -f "$COMPOSE_FILE" logs db --tail 50
  exit 1
fi

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

