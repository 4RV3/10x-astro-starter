#!/bin/bash
# Helper script to load environment variables for docker-compose
# Source this script before running docker-compose commands:
#   source ./load-env.sh

# Load secrets
set -a
source secrets/supabase.env 2>/dev/null || true
source secrets/app.env 2>/dev/null || true

# URL-encode function
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

# Export URL-encoded password
if [ -n "$POSTGRES_PASSWORD" ]; then
    export POSTGRES_PASSWORD_ENCODED=$(urlencode "$POSTGRES_PASSWORD")
fi

# Set DOCKER_IMAGE if not already set
if [ -z "$DOCKER_IMAGE" ]; then
  if [ -n "$GITHUB_REPOSITORY" ]; then
    export DOCKER_IMAGE="ghcr.io/$(echo $GITHUB_REPOSITORY | tr '[:upper:]' '[:lower:]'):latest"
  else
    export DOCKER_IMAGE="ghcr.io/4rv3/10x-astro-starter:latest"
  fi
fi

set +a
