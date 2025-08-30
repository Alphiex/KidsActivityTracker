#!/bin/bash

# SAFETY CHECK: Ensure we NEVER deploy to wrong project
source ./.gcloud-project-check.sh || exit 1

# Deploy API fixes to production
echo "🚀 Deploying API fixes to production..."

# Double-check we're using the correct project
if [ "$(gcloud config get-value project)" != "kids-activity-tracker-2024" ]; then
    echo "❌ FATAL: Still in wrong project after check!"
    exit 1
fi

# Build the Docker image with the api/server.js and its routes
echo "Building Docker image..."
docker build -t gcr.io/kids-activity-tracker-2024/kids-activity-api:latest .

# Push to Google Container Registry
echo "Pushing to GCR..."
docker push gcr.io/kids-activity-tracker-2024/kids-activity-api:latest

# Deploy to Cloud Run in the correct project
echo "Deploying to Cloud Run..."
gcloud run deploy kids-activity-api \
  --image gcr.io/kids-activity-tracker-2024/kids-activity-api:latest \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --timeout 3600 \
  --max-instances 10 \
  --set-env-vars NODE_ENV=production \
  --set-secrets DATABASE_URL=DATABASE_URL:latest \
  --project kids-activity-tracker-2024

echo "✅ API deployment complete!"
echo "API URL: https://kids-activity-api-205843686007.us-central1.run.app"