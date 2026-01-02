#!/bin/bash

# Deploy Kids Activity Tracker Website to Google Cloud Run
# This script builds and deploys the Next.js website with proper environment configuration

set -e

# Configuration
PROJECT_ID="kids-activity-tracker-2024"
SERVICE_NAME="kids-activity-website"
REGION="us-central1"

# API URL - Use custom domain when available, fallback to Cloud Run URL
API_URL="${API_URL:-https://api.kidsactivitytracker.ca}"
# Fallback if custom domain not set up yet
# API_URL="https://kids-activity-api-4ev6yi22va-uc.a.run.app"

echo "========================================"
echo "Deploying Kids Activity Tracker Website"
echo "========================================"
echo ""
echo "Project:    $PROJECT_ID"
echo "Service:    $SERVICE_NAME"
echo "Region:     $REGION"
echo "API URL:    $API_URL"
echo ""

# Ensure we're in the right project
gcloud config set project $PROJECT_ID

# Navigate to website directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEBSITE_DIR="$SCRIPT_DIR/../../website"
cd "$WEBSITE_DIR"

echo "Building Docker image for AMD64 architecture..."
docker build \
  --platform linux/amd64 \
  --build-arg NEXT_PUBLIC_API_URL="$API_URL" \
  -t gcr.io/$PROJECT_ID/$SERVICE_NAME:latest \
  .

echo ""
echo "Pushing to Google Container Registry..."
docker push gcr.io/$PROJECT_ID/$SERVICE_NAME:latest

echo ""
echo "Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
  --image gcr.io/$PROJECT_ID/$SERVICE_NAME:latest \
  --region $REGION \
  --platform managed \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --port 3000 \
  --project $PROJECT_ID

echo ""
echo "Deployment complete!"
echo ""

# Get the service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region $REGION --format="value(status.url)" --project $PROJECT_ID)
echo "Website URL: $SERVICE_URL"
echo ""

# Check domain mapping status
echo "Checking domain mapping..."
DOMAIN_MAPPINGS=$(gcloud run domain-mappings list --region $REGION --project $PROJECT_ID --format="table(metadata.name,status.url)" 2>/dev/null || echo "No domain mappings found")
echo "$DOMAIN_MAPPINGS"
echo ""

echo "To set up custom domain (kidsactivitytracker.com):"
echo "  gcloud run domain-mappings create --service $SERVICE_NAME --domain kidsactivitytracker.com --region $REGION"
echo "  gcloud run domain-mappings create --service $SERVICE_NAME --domain www.kidsactivitytracker.com --region $REGION"
echo ""
echo "To view logs:"
echo "  gcloud run services logs read $SERVICE_NAME --region $REGION --project $PROJECT_ID"
echo ""
echo "=========================================="
echo "⚠️  IMPORTANT: CORS Configuration"
echo "=========================================="
echo "If this is a new deployment URL, ensure the website URL is added to"
echo "the CORS allowed origins in server/src/server.ts:"
echo ""
echo "  ALLOWED_WEB_ORIGINS = ["
echo "    ..."
echo "    '$SERVICE_URL',"
echo "  ];"
echo ""
echo "Then redeploy the API server:"
echo "  ./scripts/deployment/deploy-api.sh"
echo "=========================================="
