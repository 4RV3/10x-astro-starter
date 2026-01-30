#!/bin/bash
set -e

echo "🚀 Starting deployment..."

# Variables
DEPLOY_PATH="/opt/10xcards"
COMPOSE_FILE="docker-compose.production.yml"
CLEAN_DEPLOY=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --clean)
      CLEAN_DEPLOY=true
      shift
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: $0 [--clean]"
      echo "  --clean: Remove all containers and volumes before deployment"
      exit 1
      ;;
  esac
done

# Navigate to deployment directory
cd "$DEPLOY_PATH"

# Clean deployment if requested
if [ "$CLEAN_DEPLOY" = true ]; then
  echo "🧹 Cleaning all containers and volumes..."
  docker compose -f "$COMPOSE_FILE" down -v 2>/dev/null || true
  docker volume ls -q | grep -E '10xcards|supabase' | xargs -r docker volume rm 2>/dev/null || true
  echo "✅ Cleanup complete"
fi

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

# Load environment variables for docker-compose interpolation
echo "🔐 Loading environment variables..."
set -a  # automatically export all variables
source secrets/supabase.env
source secrets/app.env

# URL-encode POSTGRES_PASSWORD for connection strings
# Special characters like / and = need to be encoded
urlencode() {
    local string="$1"
    local strlen=${#string}
    local encoded=""
    local pos c o
    
    for (( pos=0 ; pos<strlen ; pos++ )); do
        c=${string:$pos:1}
        case "$c" in
            [-_.~a-zA-Z0-9] ) o="${c}" ;;
            * ) printf -v o '%%%02x' "'$c"
        esac
        encoded+="${o}"
    done
    echo "${encoded}"
}

# Export URL-encoded version of password for connection strings
export POSTGRES_PASSWORD_ENCODED=$(urlencode "$POSTGRES_PASSWORD")
echo "🔑 URL-encoded database password for connection strings"

# Set DOCKER_IMAGE if not already set (for manual runs)
if [ -z "$DOCKER_IMAGE" ]; then
  # Try to detect from GitHub repository or use default
  if [ -n "$GITHUB_REPOSITORY" ]; then
    DOCKER_IMAGE="ghcr.io/$(echo $GITHUB_REPOSITORY | tr '[:upper:]' '[:lower:]'):latest"
  else
    # Default fallback for manual deployment
    DOCKER_IMAGE="ghcr.io/4rv3/10x-astro-starter:latest"
  fi
  echo "📦 Using Docker image: $DOCKER_IMAGE"
fi

set +a

# Check if there are unhealthy containers from previous deployment
echo "🔍 Checking for unhealthy containers..."
UNHEALTHY=$(docker ps -a --filter "name=10xcards" --filter "health=unhealthy" -q)
if [ -n "$UNHEALTHY" ]; then
  echo "⚠️  Found unhealthy containers from previous deployment"
  echo "🧹 Cleaning up before fresh deployment..."
  docker compose -f "$COMPOSE_FILE" down -v
  docker ps -aq --filter "name=10xcards" | xargs -r docker rm -f 2>/dev/null || true
  echo "✅ Cleanup complete"
fi

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

