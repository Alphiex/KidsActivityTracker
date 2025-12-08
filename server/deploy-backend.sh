#!/bin/bash
# Backend Deployment Script for Kids Activity Tracker
# Usage: ./deploy-backend.sh [--with-secrets]
#
# Options:
#   --with-secrets  Include JWT secrets in deployment (use if container fails to start)

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
NC='\033[0m' # No Color

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

# Step 1: Build and push to Artifact Registry
echo -e "${GREEN}Step 1: Building and pushing to Artifact Registry...${NC}"
gcloud builds submit --tag "$IMAGE" .

# Step 2: Deploy to Cloud Run
echo -e "${GREEN}Step 2: Deploying to Cloud Run...${NC}"

if [ "$1" == "--with-secrets" ]; then
    echo -e "${YELLOW}Including JWT secrets in deployment...${NC}"
    gcloud run deploy $SERVICE_NAME \
        --image "$IMAGE" \
        --region $REGION \
        --platform managed \
        --allow-unauthenticated \
        --memory 2Gi \
        --timeout 300 \
        --update-secrets="JWT_ACCESS_SECRET=jwt-access-secret:latest,JWT_REFRESH_SECRET=jwt-refresh-secret:latest"
else
    gcloud run deploy $SERVICE_NAME \
        --image "$IMAGE" \
        --region $REGION \
        --platform managed \
        --allow-unauthenticated \
        --memory 2Gi \
        --timeout 300
fi

# Step 3: Verify deployment
echo -e "${GREEN}Step 3: Verifying deployment...${NC}"
sleep 5

RESPONSE=$(curl -s "$API_URL/api/v1/activities?limit=1" 2>&1)
if echo "$RESPONSE" | grep -q '"success":true'; then
    echo -e "${GREEN}Deployment successful!${NC}"
    echo ""
    echo "API URL: $API_URL"
    echo ""
    echo "Sample response:"
    echo "$RESPONSE" | head -c 200
    echo "..."
else
    echo -e "${RED}Warning: API verification failed${NC}"
    echo "Response: $RESPONSE"
    echo ""
    echo "Check logs with:"
    echo "  gcloud run services logs read $SERVICE_NAME --region $REGION --limit=30"
    echo ""
    echo "If you see 'JWT_ACCESS_SECRET must be configured', re-run with:"
    echo "  ./deploy-backend.sh --with-secrets"
fi

echo ""
echo -e "${GREEN}=== Deployment Complete ===${NC}"
