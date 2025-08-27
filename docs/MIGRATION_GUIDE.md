# Migration Guide: Moving to kids-activity-tracker Project

This guide will help you migrate from the `murmanspicks` project to a new `kids-activity-tracker` Google Cloud project.

## Prerequisites

1. Install Google Cloud SDK: `brew install google-cloud-sdk` (if not already installed)
2. Ensure you have billing enabled on your Google Cloud account

## Step 1: Create New Google Cloud Project

```bash
# Create the new project
gcloud projects create kids-activity-tracker --name="Kids Activity Tracker"

# Set the project as default
gcloud config set project kids-activity-tracker

# Link billing account (replace BILLING_ACCOUNT_ID with your billing account)
gcloud beta billing projects link kids-activity-tracker --billing-account=BILLING_ACCOUNT_ID

# To find your billing account ID:
gcloud beta billing accounts list
```

## Step 2: Enable Required APIs

```bash
# Enable all required APIs
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  sqladmin.googleapis.com \
  redis.googleapis.com \
  cloudscheduler.googleapis.com \
  secretmanager.googleapis.com \
  compute.googleapis.com \
  artifactregistry.googleapis.com
```

## Step 3: Create Cloud SQL Instance (Minimal for Development)

```bash
# Create a minimal PostgreSQL instance for development
gcloud sql instances create kids-activity-db-dev \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=us-central1 \
  --network=default \
  --no-backup \
  --database-flags=max_connections=25

# Create the database
gcloud sql databases create kidsactivity \
  --instance=kids-activity-db-dev

# Set the postgres user password
gcloud sql users set-password postgres \
  --instance=kids-activity-db-dev \
  --password=YOUR_SECURE_PASSWORD
```

## Step 4: Create Redis Instance (Minimal)

```bash
# Create a minimal Redis instance
gcloud redis instances create kids-activity-redis-dev \
  --size=1 \
  --region=us-central1 \
  --redis-version=redis_7_0 \
  --tier=basic
```

## Step 5: Create Service Account

```bash
# Create service account
gcloud iam service-accounts create kids-activity-cloud-run \
  --display-name="Kids Activity Cloud Run Service Account"

# Grant necessary permissions
gcloud projects add-iam-policy-binding kids-activity-tracker \
  --member="serviceAccount:kids-activity-cloud-run@kids-activity-tracker.iam.gserviceaccount.com" \
  --role="roles/cloudsql.client"

gcloud projects add-iam-policy-binding kids-activity-tracker \
  --member="serviceAccount:kids-activity-cloud-run@kids-activity-tracker.iam.gserviceaccount.com" \
  --role="roles/redis.editor"

gcloud projects add-iam-policy-binding kids-activity-tracker \
  --member="serviceAccount:kids-activity-cloud-run@kids-activity-tracker.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

## Step 6: Create Secrets

```bash
# Get the Cloud SQL connection details
gcloud sql instances describe kids-activity-db-dev

# Create database URL secret (update with your values)
echo -n "postgresql://postgres:YOUR_PASSWORD@/kidsactivity?host=/cloudsql/kids-activity-tracker:us-central1:kids-activity-db-dev" | \
  gcloud secrets create database-url --data-file=-

# Create JWT secrets
echo -n "your-jwt-access-secret-$(openssl rand -hex 32)" | \
  gcloud secrets create jwt-access-secret --data-file=-

echo -n "your-jwt-refresh-secret-$(openssl rand -hex 32)" | \
  gcloud secrets create jwt-refresh-secret --data-file=-

# Create session secret
echo -n "your-session-secret-$(openssl rand -hex 32)" | \
  gcloud secrets create session-secret --data-file=-

# Get Redis host
gcloud redis instances describe kids-activity-redis-dev --region=us-central1

# Create Redis URL secret (update with your Redis host)
echo -n "redis://REDIS_HOST:6379" | \
  gcloud secrets create redis-url --data-file=-
```

## Step 7: Update Configuration Files

### Update `.env` file:
```env
# Development API URL - will be updated after deployment
API_URL=https://kids-activity-api-XXXXX.us-central1.run.app

# Monitoring Dashboard URL - will be updated after deployment
MONITORING_URL=https://kids-activity-monitoring-XXXXX.us-central1.run.app
```

### Update `backend/cloudbuild.yaml`:
Replace `murmanspicks` with `kids-activity-tracker` in all places.

### Update `src/config/api.ts`:
Update the production URL after deployment.

## Step 8: Deploy Backend

```bash
cd backend

# Build and deploy to Cloud Run
gcloud builds submit --config cloudbuild.yaml \
  --substitutions=_SERVICE_NAME=kids-activity-api,_REGION=us-central1

# Note the service URL that's returned
```

## Step 9: Update Frontend Configuration

After deployment, update `src/config/api.ts` with the new Cloud Run URL:

```typescript
// Production - Google Cloud Run deployment
PRODUCTION: 'https://kids-activity-api-XXXXX.us-central1.run.app',
```

## Step 10: Initialize Database

```bash
# Connect to Cloud SQL instance
gcloud sql connect kids-activity-db-dev --user=postgres --database=kidsactivity

# Or run migrations using Prisma
cd backend
npx prisma migrate deploy
```

## Step 11: Set Up Cloud Scheduler (Optional)

```bash
# Create scheduler job for scraping
gcloud scheduler jobs create http kids-activity-scraper \
  --location=us-central1 \
  --schedule="0 * * * *" \
  --uri="https://kids-activity-api-XXXXX.us-central1.run.app/api/v1/scraper/trigger" \
  --http-method=POST \
  --oidc-service-account-email=kids-activity-cloud-run@kids-activity-tracker.iam.gserviceaccount.com
```

## Step 12: Verify Deployment

1. Test the API health endpoint:
```bash
curl https://kids-activity-api-XXXXX.us-central1.run.app/health
```

2. Update and test the mobile app with the new API URL

## Cost Optimization for Development

To minimize costs:

1. **Cloud SQL**: 
   - Using db-f1-micro tier (cheapest)
   - Disabled automatic backups
   - Stop the instance when not in use: `gcloud sql instances patch kids-activity-db-dev --no-activation-policy`

2. **Redis**:
   - Using basic tier with 1GB (cheapest)
   - Delete when not needed: `gcloud redis instances delete kids-activity-redis-dev --region=us-central1`

3. **Cloud Run**:
   - Set min instances to 0 when not actively developing
   - Costs only when requests are made

## Cleanup Old References

After confirming everything works:

1. Update all references in the codebase from old project
2. Update any CI/CD pipelines
3. Update any documentation

## Rollback Plan

If issues occur:
1. The old services in `murmanspicks` remain untouched
2. Simply revert the API URL in the frontend config
3. No data migration needed as we created a fresh database