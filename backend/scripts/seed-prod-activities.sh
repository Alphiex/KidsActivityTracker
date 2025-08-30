#!/bin/bash

# Create or update the seed job
gcloud run jobs create seed-activities-job \
  --image=gcr.io/kids-activity-tracker-2024/kids-activity-api:latest \
  --region=us-central1 \
  --parallelism=1 \
  --task-timeout=300 \
  --max-retries=0 \
  --command="node" \
  --args="/app/scripts/seed-activities.js" \
  --set-secrets="DATABASE_URL=database-url:latest" \
  --execute-now \
  --wait \
  || \
gcloud run jobs execute seed-activities-job \
  --region=us-central1 \
  --wait

echo "Activities seeding complete!"