#!/bin/bash

# Setup Google Cloud Scheduler for automated scraping
# This script creates a scheduled job to run the scraper periodically

set -e

PROJECT_ID="kids-activity-tracker-2024"
REGION="us-central1"
SERVICE_URL="https://kids-activity-api-205843686007.us-central1.run.app"

echo "========================================="
echo "Setting up Cloud Scheduler for Scraping"
echo "========================================="

# Enable Cloud Scheduler API
echo "🔧 Enabling Cloud Scheduler API..."
gcloud services enable cloudscheduler.googleapis.com --project=$PROJECT_ID

# Create service account for scheduler
echo "👤 Creating service account for scheduler..."
gcloud iam service-accounts create scraper-scheduler \
  --display-name="Scraper Scheduler Service Account" \
  --project=$PROJECT_ID || echo "Service account already exists"

# Grant Cloud Run invoker role
echo "🔑 Granting permissions..."
gcloud run services add-iam-policy-binding kids-activity-api \
  --member="serviceAccount:scraper-scheduler@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/run.invoker" \
  --region=$REGION \
  --project=$PROJECT_ID || true

# Create scheduler job
echo "⏰ Creating scheduler job..."

# Delete existing job if it exists
gcloud scheduler jobs delete scraper-job \
  --location=$REGION \
  --project=$PROJECT_ID \
  --quiet || true

# Create new job to run every 6 hours
gcloud scheduler jobs create http scraper-job \
  --location=$REGION \
  --schedule="0 */6 * * *" \
  --http-method=POST \
  --uri="$SERVICE_URL/api/v1/scraper/trigger" \
  --headers="Content-Type=application/json" \
  --message-body='{"providerId":"7023bd59-82ea-4a0d-92fc-99f9ef92f60e"}' \
  --oidc-service-account-email="scraper-scheduler@$PROJECT_ID.iam.gserviceaccount.com" \
  --oidc-token-audience="$SERVICE_URL" \
  --time-zone="America/Vancouver" \
  --attempt-deadline="30m" \
  --project=$PROJECT_ID

echo ""
echo "✅ Cloud Scheduler setup complete!"
echo ""
echo "Schedule: Every 6 hours"
echo "Target: $SERVICE_URL/api/v1/scraper/trigger"
echo "Provider: NVRC (7023bd59-82ea-4a0d-92fc-99f9ef92f60e)"
echo ""
echo "To manually trigger the job:"
echo "gcloud scheduler jobs run scraper-job --location=$REGION --project=$PROJECT_ID"
echo ""
echo "To view job status:"
echo "gcloud scheduler jobs describe scraper-job --location=$REGION --project=$PROJECT_ID"
echo ""