#!/bin/bash
set -e

echo "Deploying Kids Activity Tracker Scraper as Cloud Run Job..."

# Delete existing job if it exists
gcloud run jobs delete kids-activity-scraper-job --region us-central1 --quiet 2>/dev/null || true

# Create the Cloud Run job
gcloud run jobs create kids-activity-scraper-job \
  --image gcr.io/kids-activity-tracker-2024/kids-activity-scraper:latest \
  --region us-central1 \
  --memory 4Gi \
  --cpu 4 \
  --task-timeout 7200 \
  --max-retries 1 \
  --set-env-vars NODE_ENV=production,HEADLESS=true \
  --set-secrets DATABASE_URL=DATABASE_URL:latest \
  --project kids-activity-tracker-2024

echo "Scraper job deployment complete!"

# Set up scheduled execution (daily at 6 AM)
echo "Setting up Cloud Scheduler for daily execution..."

gcloud scheduler jobs create run kids-activity-scraper-schedule \
  --location us-central1 \
  --schedule "0 6 * * *" \
  --uri "https://us-central1-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/kids-activity-tracker-2024/jobs/kids-activity-scraper-job:run" \
  --http-method POST \
  --oauth-service-account-email 205843686007-compute@developer.gserviceaccount.com \
  --project kids-activity-tracker-2024 2>/dev/null || \
gcloud scheduler jobs update run kids-activity-scraper-schedule \
  --location us-central1 \
  --schedule "0 6 * * *" \
  --uri "https://us-central1-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/kids-activity-tracker-2024/jobs/kids-activity-scraper-job:run" \
  --http-method POST \
  --oauth-service-account-email 205843686007-compute@developer.gserviceaccount.com \
  --project kids-activity-tracker-2024

echo "Cloud Scheduler configured for daily execution at 6 AM"