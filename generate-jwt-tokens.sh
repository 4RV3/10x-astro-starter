#!/bin/bash
# Script to generate Supabase JWT tokens with correct format
# Usage: ./generate-jwt-tokens.sh <your-jwt-secret>

if [ -z "$1" ]; then
  echo "Usage: $0 <JWT_SECRET>"
  echo ""
  echo "Example: $0 'your-super-secret-jwt-token-with-at-least-32-characters'"
  exit 1
fi

JWT_SECRET="$1"

# Check if base64 and openssl are available
if ! command -v openssl &> /dev/null; then
    echo "Error: openssl is required but not installed."
    exit 1
fi

# Function to generate JWT
generate_jwt() {
    local role=$1
    local exp=2534023007  # Year 2050
    local iat=0
    
    # Header
    header='{"alg":"HS256","typ":"JWT"}'
    header_b64=$(echo -n "$header" | base64 | tr -d '=' | tr '/+' '_-' | tr -d '\n')
    
    # Payload with numbers, not strings
    payload="{\"exp\":${exp},\"iat\":${iat},\"iss\":\"supabase\",\"role\":\"${role}\"}"
    payload_b64=$(echo -n "$payload" | base64 | tr -d '=' | tr '/+' '_-' | tr -d '\n')
    
    # Signature
    signature=$(echo -n "${header_b64}.${payload_b64}" | openssl dgst -sha256 -hmac "$JWT_SECRET" -binary | base64 | tr -d '=' | tr '/+' '_-' | tr -d '\n')
    
    # Complete JWT
    echo "${header_b64}.${payload_b64}.${signature}"
}

echo "Generating JWT tokens with secret: ${JWT_SECRET:0:10}..."
echo ""
echo "ANON_KEY=$(generate_jwt 'anon')"
echo "SERVICE_ROLE_KEY=$(generate_jwt 'service_role')"
echo ""
echo "Add these to your secrets/supabase.env file"
