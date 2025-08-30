#!/bin/bash

# Quick deploy script using pre-built Docker image with just updated JS files

echo "🚀 Quick Deploy - Kids Activity Tracker API"
echo "=========================================="

# Build only the JavaScript
echo "📦 Building TypeScript..."
npm run build

# Create a temporary directory for deployment files
echo "📁 Preparing deployment files..."
TEMP_DIR=$(mktemp -d)
cp -r dist/* $TEMP_DIR/
cp -r generated $TEMP_DIR/
cp -r utils $TEMP_DIR/
cp -r scrapers $TEMP_DIR/
cp package*.json $TEMP_DIR/
cp -r prisma $TEMP_DIR/

# Create a simple deployment archive
echo "📦 Creating deployment archive..."
cd $TEMP_DIR
tar czf /tmp/api-update.tar.gz .
cd -

echo "✅ Deployment archive ready at /tmp/api-update.tar.gz"

# Use existing image and just update the code
echo "🐳 Using existing Docker image and updating code..."
docker run -d \
  --name api-temp \
  gcr.io/kids-activity-tracker-2024/kids-activity-api:latest \
  sleep 3600

# Copy new files to container
docker cp /tmp/api-update.tar.gz api-temp:/app/
docker exec api-temp tar xzf /app/api-update.tar.gz -C /app/

# Commit the changes
docker commit api-temp gcr.io/kids-activity-tracker-2024/kids-activity-api:latest

# Clean up
docker stop api-temp
docker rm api-temp
rm -rf $TEMP_DIR
rm /tmp/api-update.tar.gz

echo "☁️ Pushing to registry..."
docker push gcr.io/kids-activity-tracker-2024/kids-activity-api:latest

echo "🚀 Deploying to Cloud Run..."
gcloud run deploy kids-activity-api \
  --image gcr.io/kids-activity-tracker-2024/kids-activity-api:latest \
  --region us-central1 \
  --platform managed

echo "✅ Quick deploy complete!"