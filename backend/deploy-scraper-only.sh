#!/bin/bash

# Deploy only the scraper code to Cloud Run

set -e

echo "🚀 Deploying Scraper to Cloud Run"
echo "================================="

# Ensure we're in the backend directory
cd "$(dirname "$0")"

# Build the Docker image locally
echo "🔨 Building Docker image..."
docker build -t gcr.io/kids-activity-tracker-2024/kids-activity-scraper:latest .

# Push to Google Container Registry
echo "📤 Pushing to GCR..."
docker push gcr.io/kids-activity-tracker-2024/kids-activity-scraper:latest

# Deploy to Cloud Run (scraper job)
echo "☁️  Deploying scraper to Cloud Run..."
gcloud run deploy kids-activity-scraper \
  --image gcr.io/kids-activity-tracker-2024/kids-activity-scraper:latest \
  --region us-central1 \
  --platform managed \
  --no-allow-unauthenticated \
  --memory 2Gi \
  --timeout 3600 \
  --max-instances 5 \
  --set-env-vars NODE_ENV=production \
  --set-secrets DATABASE_URL=database-url:latest

echo "✅ Scraper deployed successfully!"
echo ""
echo "To run the scraper manually:"
echo "gcloud run jobs execute nvrc-scraper-job --region us-central1"