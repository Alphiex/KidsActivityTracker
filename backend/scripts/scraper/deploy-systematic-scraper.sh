#!/bin/bash

# Deploy NVRC Systematic Scraper to Google Cloud Run

echo "🚀 Deploying NVRC Systematic Scraper to Cloud Run..."

# Set variables
PROJECT_ID="kids-activity-tracker-43734"
REGION="us-central1"
SERVICE_NAME="nvrc-systematic-scraper"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

# Build the Docker image
echo "🔨 Building Docker image..."
docker build -f Dockerfile.systematic -t ${IMAGE_NAME} .

# Push to Google Container Registry
echo "📤 Pushing image to GCR..."
docker push ${IMAGE_NAME}

# Deploy to Cloud Run as a Job
echo "🚀 Deploying to Cloud Run Jobs..."
gcloud run jobs create ${SERVICE_NAME} \
  --image ${IMAGE_NAME} \
  --region ${REGION} \
  --memory 2Gi \
  --cpu 2 \
  --timeout 30m \
  --max-retries 1 \
  --parallelism 1 \
  --task-timeout 30m \
  --set-env-vars "NODE_ENV=production" \
  --project ${PROJECT_ID}

# Create a schedule (daily at 3 AM)
echo "⏰ Creating schedule..."
gcloud scheduler jobs create http ${SERVICE_NAME}-schedule \
  --location ${REGION} \
  --schedule "0 3 * * *" \
  --uri "https://${REGION}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${PROJECT_ID}/jobs/${SERVICE_NAME}:run" \
  --http-method POST \
  --oidc-service-account-email "${PROJECT_ID}-compute@developer.gserviceaccount.com" \
  --project ${PROJECT_ID}

echo "✅ Deployment complete!"
echo ""
echo "To run the job manually:"
echo "gcloud run jobs execute ${SERVICE_NAME} --region ${REGION}"
echo ""
echo "To view logs:"
echo "gcloud logging read \"resource.type=cloud_run_job AND resource.labels.job_name=${SERVICE_NAME}\" --limit 50"