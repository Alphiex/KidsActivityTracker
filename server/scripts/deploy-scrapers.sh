#!/bin/bash
# Deploy scrapers to Google Cloud Run and set up scheduler
set -e

PROJECT="kids-activity-tracker-2024"
REGION="us-central1"
IMAGE="gcr.io/${PROJECT}/kids-activity-scraper:latest"

echo "=========================================="
echo "Deploying Kids Activity Scraper to Cloud"
echo "=========================================="
echo ""

# Change to server directory
cd "$(dirname "$0")/.."

echo "Step 1: Building Docker image..."
echo "================================="
docker build -f scrapers/Dockerfile -t "$IMAGE" .

echo ""
echo "Step 2: Pushing to Container Registry..."
echo "========================================="
docker push "$IMAGE"

echo ""
echo "Step 3: Updating Cloud Run Job..."
echo "=================================="
gcloud run jobs update kids-activity-scraper-job \
  --project="$PROJECT" \
  --region="$REGION" \
  --image="$IMAGE" \
  --cpu=4 \
  --memory=4Gi \
  --max-retries=1 \
  --task-timeout=30m \
  --set-env-vars="NODE_ENV=production,HEADLESS=true" \
  --set-secrets="DATABASE_URL=database-url:latest"

echo ""
echo "Step 4: Setting up Cloud Scheduler..."
echo "======================================"
./scripts/setup-scheduler.sh

echo ""
echo "=========================================="
echo "Deployment Complete!"
echo "=========================================="
echo ""
echo "To test manually:"
echo "  gcloud run jobs execute kids-activity-scraper-job --project=$PROJECT --region=$REGION"
echo ""
echo "To test a specific tier:"
echo "  gcloud run jobs execute kids-activity-scraper-job --project=$PROJECT --region=$REGION --args='critical,0'"
