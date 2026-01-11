#!/bin/bash
# Setup Cloud Scheduler jobs for staggered scraper execution
# Run this script to create/update all scheduler jobs

set -e

PROJECT="kids-activity-tracker-2024"
REGION="us-central1"
SERVICE_ACCOUNT="205843686007-compute@developer.gserviceaccount.com"

echo "Setting up Cloud Scheduler jobs for Kids Activity Tracker"
echo "=========================================================="
echo ""

# Function to create a Cloud Run job for a specific tier/batch
create_run_job() {
  local job_name=$1
  local tier=$2
  local batch=$3

  echo "Creating Cloud Run job: $job_name"

  # Build the command args
  local cmd_args="node,scrapers/scripts/runAllScrapers.js,$tier"
  if [ "$batch" != "all" ]; then
    cmd_args="$cmd_args,$batch"
  fi

  # Delete existing job if it exists
  gcloud run jobs delete "$job_name" \
    --project="$PROJECT" \
    --region="$REGION" \
    --quiet 2>/dev/null || true

  # Create the job with specific tier/batch args
  gcloud run jobs create "$job_name" \
    --project="$PROJECT" \
    --region="$REGION" \
    --image="gcr.io/${PROJECT}/kids-activity-scraper:latest" \
    --cpu=4 \
    --memory=4Gi \
    --max-retries=1 \
    --task-timeout=30m \
    --set-env-vars="NODE_ENV=production,HEADLESS=true" \
    --set-secrets="DATABASE_URL=database-url:latest" \
    --command="node" \
    --args="scrapers/scripts/runAllScrapers.js,$tier${batch:+,$batch}"

  echo "  ✓ Created"
}

# Function to create or update a scheduler job
create_scheduler() {
  local name=$1
  local schedule=$2
  local job_name=$3
  local description=$4

  echo "Creating scheduler: $name -> $job_name"
  echo "  Schedule: $schedule"

  # Delete existing scheduler job if it exists
  gcloud scheduler jobs delete "$name" \
    --project="$PROJECT" \
    --location="$REGION" \
    --quiet 2>/dev/null || true

  # Create the scheduler job to trigger Cloud Run job
  gcloud scheduler jobs create http "$name" \
    --project="$PROJECT" \
    --location="$REGION" \
    --schedule="$schedule" \
    --uri="https://${REGION}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${PROJECT}/jobs/${job_name}:run" \
    --http-method=POST \
    --oauth-service-account-email="$SERVICE_ACCOUNT" \
    --description="$description" \
    --time-zone="UTC" \
    --attempt-deadline="30m"

  echo "  ✓ Created"
  echo ""
}

echo "Deleting old unified scheduler..."
gcloud scheduler jobs delete "kids-activity-scraper-schedule" \
  --project="$PROJECT" \
  --location="$REGION" \
  --quiet 2>/dev/null || true

echo ""
echo "Creating Cloud Run Jobs for each tier/batch..."
echo "==============================================="

# Create jobs for each tier/batch combination
# Critical tier - 6 batches
for batch in 0 1 2 3 4 5; do
  create_run_job "scraper-critical-b${batch}" "critical" "$batch"
done

# Standard tier - 10 batches (47 providers / 5 per batch)
for batch in 0 1 2 3 4 5 6 7 8 9; do
  create_run_job "scraper-standard-b${batch}" "standard" "$batch"
done

# High tier - 1 batch (all)
create_run_job "scraper-high" "high" ""

# Low tier - 1 batch (all)
create_run_job "scraper-low" "low" ""

echo ""
echo "Creating CRITICAL tier schedulers (weekly, 6 batches)..."
echo "========================================================="

# Critical Tier - Run once per week on Sunday, staggered every 30 min starting 06:00 UTC
create_scheduler "sched-critical-b0" "0 6 * * 0"   "scraper-critical-b0" "Critical tier batch 0, weekly"
create_scheduler "sched-critical-b1" "30 6 * * 0"  "scraper-critical-b1" "Critical tier batch 1, weekly"
create_scheduler "sched-critical-b2" "0 7 * * 0"   "scraper-critical-b2" "Critical tier batch 2, weekly"
create_scheduler "sched-critical-b3" "30 7 * * 0"  "scraper-critical-b3" "Critical tier batch 3, weekly"
create_scheduler "sched-critical-b4" "0 8 * * 0"   "scraper-critical-b4" "Critical tier batch 4, weekly"
create_scheduler "sched-critical-b5" "30 8 * * 0"  "scraper-critical-b5" "Critical tier batch 5, weekly"

echo ""
echo "Creating STANDARD tier schedulers (weekly, 10 batches)..."
echo "=========================================================="

# Standard Tier - Run once per week on Sunday, staggered every 30 min starting 09:00 UTC
create_scheduler "sched-standard-b0" "0 9 * * 0"   "scraper-standard-b0" "Standard tier batch 0, weekly"
create_scheduler "sched-standard-b1" "30 9 * * 0"  "scraper-standard-b1" "Standard tier batch 1, weekly"
create_scheduler "sched-standard-b2" "0 10 * * 0"  "scraper-standard-b2" "Standard tier batch 2, weekly"
create_scheduler "sched-standard-b3" "30 10 * * 0" "scraper-standard-b3" "Standard tier batch 3, weekly"
create_scheduler "sched-standard-b4" "0 11 * * 0"  "scraper-standard-b4" "Standard tier batch 4, weekly"
create_scheduler "sched-standard-b5" "30 11 * * 0" "scraper-standard-b5" "Standard tier batch 5, weekly"
create_scheduler "sched-standard-b6" "0 12 * * 0"  "scraper-standard-b6" "Standard tier batch 6, weekly"
create_scheduler "sched-standard-b7" "30 12 * * 0" "scraper-standard-b7" "Standard tier batch 7, weekly"
create_scheduler "sched-standard-b8" "0 13 * * 0"  "scraper-standard-b8" "Standard tier batch 8, weekly"
create_scheduler "sched-standard-b9" "30 13 * * 0" "scraper-standard-b9" "Standard tier batch 9, weekly"

echo ""
echo "Creating HIGH tier scheduler (weekly)..."
echo "========================================="

create_scheduler "sched-high" "0 14 * * 0" "scraper-high" "High tier (Surrey), weekly"

echo ""
echo "Creating LOW tier scheduler (weekly)..."
echo "========================================"

create_scheduler "sched-low" "0 15 * * 0" "scraper-low" "Low tier (small communities), weekly"

echo ""
echo "=========================================="
echo "Setup complete!"
echo ""
echo "Total Cloud Run jobs: 18"
echo "  Critical: 6 (one per batch)"
echo "  Standard: 10 (one per batch)"
echo "  High: 1"
echo "  Low: 1"
echo ""
echo "Total scheduler jobs: 18 (weekly)"
echo "  Critical: 6 (6 batches × 1 run/week)"
echo "  Standard: 10 (10 batches × 1 run/week)"
echo "  High: 1 (1 × 1 run/week)"
echo "  Low: 1 (1 × 1 run/week)"
echo ""
echo "Schedule: Every Sunday, staggered 06:00-15:00 UTC"
echo ""
echo "View all jobs:"
echo "  gcloud run jobs list --project=$PROJECT --region=$REGION"
echo "  gcloud scheduler jobs list --project=$PROJECT --location=$REGION"
