#!/bin/bash
# Backend Deployment Script for Kids Activity Tracker
# Usage: ./deploy-backend.sh [--production]
#
# Options:
#   --production  Deploy with NODE_ENV=production (enables rate limiting)
#   (default)     Deploy with NODE_ENV=development (disables rate limiting for testing)

set -e

PROJECT_ID="kids-activity-tracker-2024"
REGION="us-central1"
SERVICE_NAME="kids-activity-api"
IMAGE="us-central1-docker.pkg.dev/${PROJECT_ID}/cloud-run-source-deploy/${SERVICE_NAME}:latest"
API_URL="https://kids-activity-api-205843686007.us-central1.run.app"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default to development mode
NODE_ENV="development"
if [ "$1" == "--production" ]; then
    NODE_ENV="production"
    echo -e "${YELLOW}Deploying in PRODUCTION mode (rate limiting enabled)${NC}"
else
    echo -e "${BLUE}Deploying in DEVELOPMENT mode (rate limiting disabled)${NC}"
fi

echo ""
echo -e "${YELLOW}=== Kids Activity Tracker Backend Deployment ===${NC}"
echo ""

# Check if we're in the server directory
if [ ! -f "package.json" ] || [ ! -f "Dockerfile" ]; then
    echo -e "${RED}Error: Must be run from the server directory${NC}"
    exit 1
fi

# Check if gcloud is authenticated
if ! gcloud auth list --filter="status:ACTIVE" --format="value(account)" | grep -q "@"; then
    echo -e "${RED}Error: Not authenticated with gcloud. Run 'gcloud auth login'${NC}"
    exit 1
fi

# Verify project
CURRENT_PROJECT=$(gcloud config get-value project 2>/dev/null)
if [ "$CURRENT_PROJECT" != "$PROJECT_ID" ]; then
    echo -e "${YELLOW}Warning: Current project is $CURRENT_PROJECT, expected $PROJECT_ID${NC}"
    echo "Setting project to $PROJECT_ID..."
    gcloud config set project $PROJECT_ID
fi

# Ensure required secrets exist
echo -e "${GREEN}Step 0: Verifying secrets exist...${NC}"

check_or_create_secret() {
    local secret_name=$1
    local env_var_name=$2

    if ! gcloud secrets describe "$secret_name" &>/dev/null; then
        echo -e "${YELLOW}Secret '$secret_name' not found. Creating...${NC}"

        # Try to get value from local .env file
        if [ -f ".env" ]; then
            local value=$(grep "^${env_var_name}=" .env | cut -d'=' -f2-)
            if [ -n "$value" ]; then
                echo "$value" | gcloud secrets create "$secret_name" --replication-policy="automatic" --data-file=-
                echo -e "${GREEN}Created secret '$secret_name' from .env${NC}"
            else
                echo -e "${RED}Error: Cannot find $env_var_name in .env file${NC}"
                echo "Please add $env_var_name to your .env file and try again"
                exit 1
            fi
        else
            echo -e "${RED}Error: No .env file found${NC}"
            exit 1
        fi
    else
        echo -e "${GREEN}✓ Secret '$secret_name' exists${NC}"
    fi
}

check_or_create_secret "database-url" "DATABASE_URL"
check_or_create_secret "jwt-access-secret" "JWT_ACCESS_SECRET"
check_or_create_secret "jwt-refresh-secret" "JWT_REFRESH_SECRET"
check_or_create_secret "openai-api-key" "OPENAI_API_KEY"
check_or_create_secret "FIREBASE_SERVICE_ACCOUNT" "FIREBASE_SERVICE_ACCOUNT"

echo ""

# Step 1: Build and push to Artifact Registry
echo -e "${GREEN}Step 1: Building and pushing to Artifact Registry...${NC}"
gcloud builds submit --tag "$IMAGE" .

# Step 2: Deploy to Cloud Run with ALL secrets and config
echo -e "${GREEN}Step 2: Deploying to Cloud Run...${NC}"
echo -e "${BLUE}Configuring secrets: DATABASE_URL, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, OPENAI_API_KEY, FIREBASE_SERVICE_ACCOUNT${NC}"
echo -e "${BLUE}Environment: NODE_ENV=$NODE_ENV${NC}"

gcloud run deploy $SERVICE_NAME \
    --image "$IMAGE" \
    --region $REGION \
    --platform managed \
    --allow-unauthenticated \
    --memory 2Gi \
    --cpu 2 \
    --timeout 300 \
    --concurrency 100 \
    --min-instances 0 \
    --max-instances 10 \
    --set-env-vars "NODE_ENV=$NODE_ENV" \
    --set-secrets "DATABASE_URL=database-url:latest,JWT_ACCESS_SECRET=jwt-access-secret:latest,JWT_REFRESH_SECRET=jwt-refresh-secret:latest,OPENAI_API_KEY=openai-api-key:latest,FIREBASE_SERVICE_ACCOUNT=FIREBASE_SERVICE_ACCOUNT:latest"

# Step 3: Verify deployment
echo -e "${GREEN}Step 3: Verifying deployment...${NC}"
sleep 5

# Check health endpoint
HEALTH_RESPONSE=$(curl -s "$API_URL/health" 2>&1)
if echo "$HEALTH_RESPONSE" | grep -q '"status":"healthy"'; then
    echo -e "${GREEN}✓ Health check passed${NC}"
else
    echo -e "${RED}✗ Health check failed${NC}"
    echo "Response: $HEALTH_RESPONSE"
fi

# Check AI service
AI_HEALTH=$(curl -s "$API_URL/api/v1/ai/recommendations/health" 2>&1)
if echo "$AI_HEALTH" | grep -q '"status":"healthy"'; then
    echo -e "${GREEN}✓ AI service healthy${NC}"
else
    echo -e "${YELLOW}⚠ AI service status: $(echo "$AI_HEALTH" | grep -o '"status":"[^"]*"')${NC}"
fi

# Check activities endpoint
RESPONSE=$(curl -s "$API_URL/api/v1/activities?limit=1" 2>&1)
if echo "$RESPONSE" | grep -q '"success":true'; then
    echo -e "${GREEN}✓ Activities API working${NC}"
    echo ""
    echo "Sample response:"
    echo "$RESPONSE" | head -c 200
    echo "..."
else
    echo -e "${RED}✗ Activities API check failed${NC}"
    echo "Response: $RESPONSE"
fi

echo ""
echo -e "${GREEN}=== Deployment Complete ===${NC}"
echo ""
echo "API URL: $API_URL"
echo "Environment: $NODE_ENV"
echo ""
echo "Useful commands:"
echo "  View logs:    gcloud run services logs read $SERVICE_NAME --region $REGION --limit=50"
echo "  Describe:     gcloud run services describe $SERVICE_NAME --region $REGION"
echo ""
if [ "$NODE_ENV" == "development" ]; then
    echo -e "${YELLOW}Note: Rate limiting is DISABLED. For production, run:${NC}"
    echo "  ./deploy-backend.sh --production"
fi
