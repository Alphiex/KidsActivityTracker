#!/bin/bash
set -e

echo "Deploying Kids Activity Tracker API to Cloud Run..."

gcloud run deploy kids-activity-api \
  --image gcr.io/kids-activity-tracker-2024/kids-activity-api:latest \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --timeout 3600 \
  --max-instances 10 \
  --min-instances 0 \
  --port 3000 \
  --set-env-vars NODE_ENV=production \
  --set-secrets DATABASE_URL=DATABASE_URL:latest \
  --project kids-activity-tracker-2024

echo "API deployment complete!"
echo "Getting service URL..."
gcloud run services describe kids-activity-api --region us-central1 --format="value(status.url)"