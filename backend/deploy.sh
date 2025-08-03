#!/bin/bash

# Deploy script for Kids Activity Tracker Backend

set -e

PROJECT_ID="elevated-pod-459203-n5"
REGION="us-central1"
SERVICE_NAME="kids-activity-api"
MONITORING_SERVICE="kids-activity-monitoring"

echo "🚀 Starting deployment to Google Cloud Platform..."

# Build and push API Docker image
echo "📦 Building API Docker image..."
gcloud builds submit --tag gcr.io/$PROJECT_ID/$SERVICE_NAME:latest .

# Build and push Monitoring Docker image
echo "📦 Building Monitoring Docker image..."
gcloud builds submit --tag gcr.io/$PROJECT_ID/$MONITORING_SERVICE:latest -f Dockerfile.monitoring .

# Deploy API to Cloud Run
echo "🌐 Deploying API to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
  --image gcr.io/$PROJECT_ID/$SERVICE_NAME:latest \
  --region $REGION \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production,SCRAPE_INTERVAL_HOURS=1 \
  --min-instances 1 \
  --max-instances 10 \
  --memory 1Gi \
  --cpu 1 \
  --port 3000

# Deploy Monitoring Dashboard to Cloud Run
echo "📊 Deploying Monitoring Dashboard to Cloud Run..."
gcloud run deploy $MONITORING_SERVICE \
  --image gcr.io/$PROJECT_ID/$MONITORING_SERVICE:latest \
  --region $REGION \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production \
  --min-instances 0 \
  --max-instances 5 \
  --memory 512Mi \
  --cpu 1 \
  --port 3001

# Get service URLs
API_URL=$(gcloud run services describe $SERVICE_NAME --region $REGION --format "value(status.url)")
MONITORING_URL=$(gcloud run services describe $MONITORING_SERVICE --region $REGION --format "value(status.url)")

echo "✅ Deployment complete!"
echo "📱 API URL: $API_URL"
echo "📊 Monitoring URL: $MONITORING_URL"
echo ""
echo "⚠️  Note: You still need to:"
echo "1. Set up the database connection in Secret Manager"
echo "2. Run database migrations"
echo "3. Configure Cloud Scheduler for automated scraping"