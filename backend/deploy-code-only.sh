#!/bin/bash

# Simple code deployment script
# This deploys only the code changes without rebuilding Docker images

set -e

echo "🚀 Deploying Code Changes to Cloud Run"
echo "====================================="

# Get the current Cloud Run service
SERVICE_NAME="kids-activity-api"
REGION="us-central1"

echo "📊 Checking current deployment..."
CURRENT_IMAGE=$(gcloud run services describe $SERVICE_NAME --region=$REGION --format="value(spec.template.spec.containers[0].image)")
echo "Current image: $CURRENT_IMAGE"

# Create a temporary directory for the code update
TEMP_DIR=$(mktemp -d)
echo "📦 Preparing code archive..."

# Copy only the necessary files
cp -r scrapers $TEMP_DIR/
cp -r prisma $TEMP_DIR/
cp -r migrations $TEMP_DIR/
cp package*.json $TEMP_DIR/

# Create a tar archive
tar -czf code-update.tar.gz -C $TEMP_DIR .

echo "📤 Uploading code to Cloud Storage..."
BUCKET="gs://kids-activity-tracker-2024-code-updates"
gsutil cp code-update.tar.gz $BUCKET/code-update-$(date +%s).tar.gz

# Clean up
rm -rf $TEMP_DIR code-update.tar.gz

echo "✅ Code uploaded successfully!"
echo ""
echo "⚠️  Note: Since we're using Cloud Run with containers, code changes require rebuilding the Docker image."
echo ""
echo "Next steps:"
echo "1. SSH into a compute instance with the codebase"
echo "2. Pull the latest code changes"
echo "3. Run the scraper manually to test"
echo ""
echo "Alternative: Use Cloud Build with a working Dockerfile:"
echo "  gcloud builds submit --config=cloudbuild-scraper.yaml"