#!/bin/bash

# SAFETY CHECK: Ensure we NEVER deploy to wrong project
source ./.gcloud-project-check.sh || exit 1

# Deploy fixed scraper to production
echo "🚀 Deploying fixed scraper to production..."

# Build the Docker image with the fixed scraper
echo "Building scraper Docker image..."
docker build -f Dockerfile.scraper -t gcr.io/kids-activity-tracker-2024/scraper-detailed:latest . || \
docker build -t gcr.io/kids-activity-tracker-2024/scraper-detailed:latest .

# Push to Google Container Registry
echo "Pushing to GCR..."
docker push gcr.io/kids-activity-tracker-2024/scraper-detailed:latest

# Update the Cloud Run Job with the new image
echo "Updating Cloud Run Job..."
gcloud run jobs update scraper-detailed-job \
  --image=gcr.io/kids-activity-tracker-2024/scraper-detailed:latest \
  --region=us-central1

echo "✅ Scraper deployment complete!"
echo "The scraper will now check courseId to prevent duplicates"