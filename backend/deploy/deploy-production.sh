#!/bin/bash

# Deploy updated Kids Activity Tracker API to production

set -e

echo "🚀 Deploying Kids Activity Tracker API to production..."
echo "=================================================="

# 1. Build the production image
echo "📦 Building Docker image..."
docker build -f deploy/Dockerfile.simplified -t gcr.io/kids-activity-tracker-2024/kids-activity-api:latest .

# 2. Push to Google Container Registry
echo "☁️ Pushing to Google Container Registry..."
docker push gcr.io/kids-activity-tracker-2024/kids-activity-api:latest

# 3. Deploy to Cloud Run
echo "🚀 Deploying to Cloud Run..."
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
  --add-cloudsql-instances kids-activity-tracker-2024:us-central1:kids-activity-db-dev \
  --set-secrets DATABASE_URL=DATABASE_URL:latest

# 4. Deploy the scraper job with new activity type mapper
echo "📦 Building scraper image..."
docker build -f deploy/Dockerfile.scraper -t gcr.io/kids-activity-tracker-2024/scraper-detailed:latest .

echo "☁️ Pushing scraper image..."
docker push gcr.io/kids-activity-tracker-2024/scraper-detailed:latest

echo "🔧 Updating Cloud Run Job..."
gcloud run jobs update scraper-detailed-job \
  --image=gcr.io/kids-activity-tracker-2024/scraper-detailed:latest \
  --region=us-central1

echo "✅ Deployment complete!"
echo ""
echo "API URL: https://kids-activity-api-205843686007.us-central1.run.app"
echo ""
echo "To test the API:"
echo "curl https://kids-activity-api-205843686007.us-central1.run.app/api/v1/activities?limit=1"
echo ""
echo "To run the scraper manually:"
echo "gcloud run jobs execute scraper-detailed-job --region=us-central1"