# Deployment Troubleshooting Guide

## Quick Cleanup Commands

### If deployment fails with unhealthy containers:

**Option 1: Use the cleanup script**
```bash
cd /opt/10xcards
chmod +x cleanup.sh
./cleanup.sh
```

**Option 2: Use deploy with --clean flag**
```bash
cd /opt/10xcards
./deploy.sh --clean
```

**Option 3: Manual cleanup**
```bash
cd /opt/10xcards

# Stop all containers
docker compose -f docker-compose.production.yml down

# Remove containers AND volumes (fresh start)
docker compose -f docker-compose.production.yml down -v

# Remove any leftover volumes
docker volume ls | grep -E '10xcards|supabase'
docker volume rm $(docker volume ls -q | grep -E '10xcards|supabase')
```

## Common Issues

### 1. Containers are "unhealthy"

**Symptoms:**
- `dependency failed to start: container 10xcards-XXX-1 is unhealthy`

**Solution:**
```bash
# Check logs of unhealthy container
docker compose -f docker-compose.production.yml logs <service-name> --tail 100

# Example: check auth logs
docker compose -f docker-compose.production.yml logs auth --tail 100

# If unclear, do a clean deploy
./deploy.sh --clean
```

### 2. Database says "directory appears to contain a database"

**Symptoms:**
- `PostgreSQL Database directory appears to contain a database; Skipping initialization`
- But init scripts need to run

**Solution:**
```bash
# Must remove volumes to re-initialize database
./cleanup.sh
./deploy.sh
```

### 3. Environment variables not loaded

**Symptoms:**
- `The "POSTGRES_PASSWORD" variable is not set. Defaulting to a blank string.`

**Solution:**
```bash
cd /opt/10xcards

# Verify files exist and have content
cat secrets/supabase.env
cat secrets/app.env

# Re-run deployment (deploy.sh loads these automatically)
./deploy.sh
```

### 4. Old failed containers blocking new deployment

**Symptoms:**
- Ports already in use
- Container name conflicts

**Solution:**
```bash
# Quick fix: clean everything
./cleanup.sh

# Or manually
docker ps -a | grep 10xcards
docker rm -f $(docker ps -aq --filter "name=10xcards")
```

## Useful Debug Commands

```bash
# Check all container status
docker compose -f docker-compose.production.yml ps

# Check all container logs
docker compose -f docker-compose.production.yml logs --tail 50

# Check specific service logs
docker compose -f docker-compose.production.yml logs db --tail 100
docker compose -f docker-compose.production.yml logs auth --tail 100
docker compose -f docker-compose.production.yml logs app --tail 100

# Follow logs in real-time
docker compose -f docker-compose.production.yml logs -f app

# Check volumes
docker volume ls

# Check networks
docker network ls | grep 10xcards

# Inspect container details
docker inspect 10xcards-app

# Check if application is responding
curl http://localhost:8080
curl http://localhost:54321/health
```

## Force Fresh Start (Nuclear Option)

If nothing else works:

```bash
cd /opt/10xcards

# Stop everything
docker compose -f docker-compose.production.yml down -v

# Remove ALL Docker resources (dangerous - only if you know what you're doing)
# docker system prune -a --volumes  # DON'T run this if you have other Docker projects!

# Clean up specific to this project
docker volume rm $(docker volume ls -q | grep -E '10xcards|supabase') 2>/dev/null || true

# Re-deploy fresh
./deploy.sh
```

## CI/CD Pipeline Failures

If the GitHub Actions pipeline fails:

1. **Check the logs** in GitHub Actions
2. **Fix the issue** (usually in code or config)
3. **Push changes** - pipeline will re-run automatically
4. **Manual cleanup on VPS** (if needed):
   ```bash
   ssh -p 10129 erntoto@srv26.mikr.us
   cd /opt/10xcards
   ./cleanup.sh
   ```

## Getting Help

If you're stuck, gather this info:

```bash
cd /opt/10xcards

# Get full logs
docker compose -f docker-compose.production.yml logs > /tmp/docker-logs.txt

# Get container status
docker compose -f docker-compose.production.yml ps > /tmp/docker-status.txt

# Get volumes
docker volume ls > /tmp/docker-volumes.txt

# Share these files for debugging
```
