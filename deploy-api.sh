#!/bin/bash

# Deploy Kids Activity Tracker API to Google Cloud Run

set -e

echo "🚀 Deploying Kids Activity Tracker API to production..."
echo "=================================================="

# Set project
PROJECT_ID="kids-activity-tracker-2024"
SERVICE_NAME="kids-activity-api"
REGION="us-central1"

# Ensure we're in the right project
gcloud config set project $PROJECT_ID

# Build and push the Docker image
echo "📦 Building Docker image for AMD64 architecture..."
cd server
docker build --platform linux/amd64 -t gcr.io/$PROJECT_ID/$SERVICE_NAME:latest .

echo "☁️ Pushing to Google Container Registry..."
docker push gcr.io/$PROJECT_ID/$SERVICE_NAME:latest

echo "🚀 Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
  --image gcr.io/$PROJECT_ID/$SERVICE_NAME:latest \
  --region $REGION \
  --platform managed \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --timeout 3600 \
  --max-instances 10 \
  --min-instances 0 \
  --port 3000 \
  --set-env-vars NODE_ENV=production \
  --add-cloudsql-instances $PROJECT_ID:$REGION:kids-activity-db-dev \
  --set-secrets DATABASE_URL=DATABASE_URL:latest \
  --project $PROJECT_ID

echo "✅ Deployment complete!"
echo ""

# Get the service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region $REGION --format="value(status.url)" --project $PROJECT_ID)
echo "API URL: $SERVICE_URL"
echo ""
echo "To test the API:"
echo "curl $SERVICE_URL/api/activities/search -H 'Content-Type: application/json' -d '{\"page\":1,\"perPage\":5}'"
echo ""
echo "To view logs:"
echo "gcloud run services logs read $SERVICE_NAME --region $REGION --project $PROJECT_ID"