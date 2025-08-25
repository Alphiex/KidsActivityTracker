#!/bin/bash

# Manual deployment script for Kids Activity Tracker API
# This script builds and deploys the API to Google Cloud Run

set -e

echo "🚀 Starting manual deployment of Kids Activity Tracker API"
echo "======================================================="

# Set variables
PROJECT_ID="kids-activity-tracker-2024"
REGION="us-central1"
SERVICE_NAME="kids-activity-api"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

echo "📋 Deployment Configuration:"
echo "  Project: $PROJECT_ID"
echo "  Region: $REGION"
echo "  Service: $SERVICE_NAME"
echo "  Timestamp: $TIMESTAMP"
echo ""

# Build the Docker image locally for amd64/linux platform
echo "🔨 Building Docker image for amd64/linux platform..."
docker build --platform linux/amd64 -t gcr.io/$PROJECT_ID/$SERVICE_NAME:$TIMESTAMP -t gcr.io/$PROJECT_ID/$SERVICE_NAME:latest .

# Push the image to Google Container Registry
echo "📤 Pushing image to Container Registry..."
docker push gcr.io/$PROJECT_ID/$SERVICE_NAME:$TIMESTAMP
docker push gcr.io/$PROJECT_ID/$SERVICE_NAME:latest

# Deploy to Cloud Run
echo "🌐 Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
  --image gcr.io/$PROJECT_ID/$SERVICE_NAME:$TIMESTAMP \
  --region $REGION \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production,FRONTEND_URL=https://kidsactivitytracker.com,BCRYPT_SALT_ROUNDS=12,RATE_LIMIT_WINDOW_MS=900000,RATE_LIMIT_MAX_REQUESTS=100 \
  --set-secrets DATABASE_URL=database-url:latest,REDIS_URL=redis-url:latest,JWT_ACCESS_SECRET=jwt-access-secret:latest,JWT_REFRESH_SECRET=jwt-refresh-secret:latest,SESSION_SECRET=session-secret:latest \
  --min-instances 1 \
  --max-instances 10 \
  --memory 512Mi \
  --cpu 1 \
  --port 3000

# Get the service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region $REGION --format "value(status.url)")

echo ""
echo "✅ Deployment complete!"
echo "📱 API URL: $SERVICE_URL"
echo ""
echo "🧪 Test the deployment:"
echo "  curl $SERVICE_URL/api/health"
echo "  curl $SERVICE_URL/api/v1/locations"