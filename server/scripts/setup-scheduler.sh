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
    --attempt-deadline="35m"

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

# Standard tier - 4 batches
for batch in 0 1 2 3; do
  create_run_job "scraper-standard-b${batch}" "standard" "$batch"
done

# High tier - 1 batch (all)
create_run_job "scraper-high" "high" ""

# Low tier - 1 batch (all)
create_run_job "scraper-low" "low" ""

echo ""
echo "Creating CRITICAL tier schedulers (3x daily, 6 batches)..."
echo "==========================================================="

# Critical Tier - Run 1 (06:00-08:30 UTC = 22:00-00:30 PST previous day)
create_scheduler "sched-critical-b0-r1" "0 6 * * *"   "scraper-critical-b0" "Critical tier batch 0, run 1"
create_scheduler "sched-critical-b1-r1" "30 6 * * *"  "scraper-critical-b1" "Critical tier batch 1, run 1"
create_scheduler "sched-critical-b2-r1" "0 7 * * *"   "scraper-critical-b2" "Critical tier batch 2, run 1"
create_scheduler "sched-critical-b3-r1" "30 7 * * *"  "scraper-critical-b3" "Critical tier batch 3, run 1"
create_scheduler "sched-critical-b4-r1" "0 8 * * *"   "scraper-critical-b4" "Critical tier batch 4, run 1"
create_scheduler "sched-critical-b5-r1" "30 8 * * *"  "scraper-critical-b5" "Critical tier batch 5, run 1"

# Critical Tier - Run 2 (14:00-16:30 UTC = 06:00-08:30 PST)
create_scheduler "sched-critical-b0-r2" "0 14 * * *"  "scraper-critical-b0" "Critical tier batch 0, run 2"
create_scheduler "sched-critical-b1-r2" "30 14 * * *" "scraper-critical-b1" "Critical tier batch 1, run 2"
create_scheduler "sched-critical-b2-r2" "0 15 * * *"  "scraper-critical-b2" "Critical tier batch 2, run 2"
create_scheduler "sched-critical-b3-r2" "30 15 * * *" "scraper-critical-b3" "Critical tier batch 3, run 2"
create_scheduler "sched-critical-b4-r2" "0 16 * * *"  "scraper-critical-b4" "Critical tier batch 4, run 2"
create_scheduler "sched-critical-b5-r2" "30 16 * * *" "scraper-critical-b5" "Critical tier batch 5, run 2"

# Critical Tier - Run 3 (22:00-00:30 UTC = 14:00-16:30 PST)
create_scheduler "sched-critical-b0-r3" "0 22 * * *"  "scraper-critical-b0" "Critical tier batch 0, run 3"
create_scheduler "sched-critical-b1-r3" "30 22 * * *" "scraper-critical-b1" "Critical tier batch 1, run 3"
create_scheduler "sched-critical-b2-r3" "0 23 * * *"  "scraper-critical-b2" "Critical tier batch 2, run 3"
create_scheduler "sched-critical-b3-r3" "30 23 * * *" "scraper-critical-b3" "Critical tier batch 3, run 3"
create_scheduler "sched-critical-b4-r3" "0 0 * * *"   "scraper-critical-b4" "Critical tier batch 4, run 3"
create_scheduler "sched-critical-b5-r3" "30 0 * * *"  "scraper-critical-b5" "Critical tier batch 5, run 3"

echo ""
echo "Creating STANDARD tier schedulers (2x daily, 4 batches)..."
echo "==========================================================="

# Standard Tier - Run 1 (10:00-11:30 UTC = 02:00-03:30 PST)
create_scheduler "sched-standard-b0-r1" "0 10 * * *"  "scraper-standard-b0" "Standard tier batch 0, run 1"
create_scheduler "sched-standard-b1-r1" "30 10 * * *" "scraper-standard-b1" "Standard tier batch 1, run 1"
create_scheduler "sched-standard-b2-r1" "0 11 * * *"  "scraper-standard-b2" "Standard tier batch 2, run 1"
create_scheduler "sched-standard-b3-r1" "30 11 * * *" "scraper-standard-b3" "Standard tier batch 3, run 1"

# Standard Tier - Run 2 (18:00-19:30 UTC = 10:00-11:30 PST)
create_scheduler "sched-standard-b0-r2" "0 18 * * *"  "scraper-standard-b0" "Standard tier batch 0, run 2"
create_scheduler "sched-standard-b1-r2" "30 18 * * *" "scraper-standard-b1" "Standard tier batch 1, run 2"
create_scheduler "sched-standard-b2-r2" "0 19 * * *"  "scraper-standard-b2" "Standard tier batch 2, run 2"
create_scheduler "sched-standard-b3-r2" "30 19 * * *" "scraper-standard-b3" "Standard tier batch 3, run 2"

echo ""
echo "Creating HIGH tier scheduler (3x daily)..."
echo "==========================================="

create_scheduler "sched-high-r1" "0 5 * * *"  "scraper-high" "High tier (Surrey), run 1"
create_scheduler "sched-high-r2" "0 13 * * *" "scraper-high" "High tier (Surrey), run 2"
create_scheduler "sched-high-r3" "0 21 * * *" "scraper-high" "High tier (Surrey), run 3"

echo ""
echo "Creating LOW tier scheduler (1x daily)..."
echo "=========================================="

create_scheduler "sched-low-r1" "0 4 * * *" "scraper-low" "Low tier (small communities), daily"

echo ""
echo "=========================================="
echo "Setup complete!"
echo ""
echo "Total Cloud Run jobs: 12"
echo "  Critical: 6 (one per batch)"
echo "  Standard: 4 (one per batch)"
echo "  High: 1"
echo "  Low: 1"
echo ""
echo "Total scheduler jobs: 30"
echo "  Critical: 18 (6 batches × 3 runs/day)"
echo "  Standard: 8 (4 batches × 2 runs/day)"
echo "  High: 3 (1 × 3 runs/day)"
echo "  Low: 1 (1 × 1 run/day)"
echo ""
echo "View all jobs:"
echo "  gcloud run jobs list --project=$PROJECT --region=$REGION"
echo "  gcloud scheduler jobs list --project=$PROJECT --location=$REGION"
