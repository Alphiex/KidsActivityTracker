# Cloud Deployment Guide

This guide covers deploying the Kids Activity Tracker backend to Google Cloud Platform.

## Current Production Deployment

The backend API is currently deployed and running at:
- **API URL**: https://kids-activity-api-205843686007.us-central1.run.app
- **Monitoring Dashboard**: https://kids-activity-monitoring-205843686007.us-central1.run.app
- **Platform**: Google Cloud Run
- **Database**: Cloud SQL (PostgreSQL)
- **Cache**: Redis (Cloud Memorystore)

## Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐
│   Mobile App    │────▶│  Cloud Run API  │
└─────────────────┘     └────────┬────────┘
                                 │
                    ┌────────────┴────────────┐
                    │                         │
              ┌─────▼─────┐           ┌──────▼──────┐
              │ Cloud SQL │           │   Redis     │
              │(PostgreSQL)│          │(Memorystore)│
              └───────────┘           └─────────────┘
```

## Prerequisites

1. **Google Cloud Account** with billing enabled
2. **Google Cloud CLI** installed ([Install Guide](https://cloud.google.com/sdk/docs/install))
3. **Docker** installed locally
4. **PostgreSQL client** for database operations

## Initial Setup

### 1. Set Up Google Cloud Project

```bash
# Set your project ID
export PROJECT_ID="your-project-id"
export REGION="us-central1"

# Set the project
gcloud config set project $PROJECT_ID

# Enable required APIs
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  sqladmin.googleapis.com \
  secretmanager.googleapis.com \
  redis.googleapis.com
```

### 2. Set Up Cloud SQL (PostgreSQL)

```bash
# Create Cloud SQL instance
gcloud sql instances create kids-activity-db \
  --database-version=POSTGRES_14 \
  --tier=db-f1-micro \
  --region=$REGION \
  --network=default

# Create database
gcloud sql databases create kidsactivitytracker \
  --instance=kids-activity-db

# Create user
gcloud sql users create kidsapp \
  --instance=kids-activity-db \
  --password=YourSecurePassword
```

### 3. Set Up Redis (Optional)

```bash
# Create Redis instance
gcloud redis instances create kids-activity-cache \
  --size=1 \
  --region=$REGION \
  --redis-version=redis_6_x
```

### 4. Set Up Secret Manager

```bash
# Create secrets
echo -n "postgresql://kidsapp:YourSecurePassword@/kidsactivitytracker?host=/cloudsql/$PROJECT_ID:$REGION:kids-activity-db" | \
  gcloud secrets create database-url --data-file=-

echo -n "your-jwt-access-secret" | \
  gcloud secrets create jwt-access-secret --data-file=-

echo -n "your-jwt-refresh-secret" | \
  gcloud secrets create jwt-refresh-secret --data-file=-

echo -n "your-session-secret" | \
  gcloud secrets create session-secret --data-file=-

# Get Redis connection string and add it
REDIS_HOST=$(gcloud redis instances describe kids-activity-cache --region=$REGION --format="value(host)")
echo -n "redis://$REDIS_HOST:6379" | \
  gcloud secrets create redis-url --data-file=-
```

## Deployment Process

### 1. Build and Deploy Using Cloud Build

The project includes a `cloudbuild.yaml` configuration for automated deployment.

```bash
cd backend

# Deploy using Cloud Build
gcloud builds submit --config=cloudbuild.yaml .
```

### 2. Manual Deployment (Alternative)

```bash
# Build Docker image
docker build -t gcr.io/$PROJECT_ID/kids-activity-api .

# Push to Container Registry
docker push gcr.io/$PROJECT_ID/kids-activity-api

# Deploy to Cloud Run
gcloud run deploy kids-activity-api \
  --image gcr.io/$PROJECT_ID/kids-activity-api \
  --region $REGION \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production,PORT=3000 \
  --set-secrets DATABASE_URL=database-url:latest \
  --set-secrets JWT_ACCESS_SECRET=jwt-access-secret:latest \
  --set-secrets JWT_REFRESH_SECRET=jwt-refresh-secret:latest \
  --set-secrets SESSION_SECRET=session-secret:latest \
  --set-secrets REDIS_URL=redis-url:latest \
  --add-cloudsql-instances $PROJECT_ID:$REGION:kids-activity-db \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 1 \
  --max-instances 10
```

### 3. Run Database Migrations

```bash
# Connect to Cloud SQL
gcloud sql connect kids-activity-db --user=kidsapp --database=kidsactivitytracker

# Or use Cloud Run Jobs
gcloud run jobs create migrate-db \
  --image gcr.io/$PROJECT_ID/kids-activity-api \
  --region $REGION \
  --set-secrets DATABASE_URL=database-url:latest \
  --add-cloudsql-instances $PROJECT_ID:$REGION:kids-activity-db \
  --command npm,run,db:migrate:prod \
  --max-retries 3

# Execute the job
gcloud run jobs execute migrate-db --region $REGION
```

### 4. Seed Database (Optional)

```bash
# Create seed job
gcloud run jobs create seed-db \
  --image gcr.io/$PROJECT_ID/kids-activity-api \
  --region $REGION \
  --set-secrets DATABASE_URL=database-url:latest \
  --add-cloudsql-instances $PROJECT_ID:$REGION:kids-activity-db \
  --command npm,run,db:seed \
  --max-retries 1

# Execute the job
gcloud run jobs execute seed-db --region $REGION
```

## Monitoring and Maintenance

### 1. View Logs

```bash
# View API logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=kids-activity-api" \
  --limit 50 \
  --format json

# Stream logs
gcloud alpha logging tail "resource.type=cloud_run_revision AND resource.labels.service_name=kids-activity-api"
```

### 2. Monitor Performance

```bash
# View metrics
gcloud monitoring metrics-descriptors list --filter="metric.type:run.googleapis.com"

# Access monitoring dashboard
echo "https://console.cloud.google.com/run/detail/$REGION/kids-activity-api/metrics"
```

### 3. Database Maintenance

```bash
# Backup database
gcloud sql backups create \
  --instance=kids-activity-db \
  --description="Manual backup $(date +%Y%m%d)"

# List backups
gcloud sql backups list --instance=kids-activity-db
```

## CI/CD Pipeline

### GitHub Actions Setup

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Cloud Run

on:
  push:
    branches: [main]
    paths:
      - 'backend/**'

env:
  PROJECT_ID: ${{ secrets.GCP_PROJECT_ID }}
  REGION: us-central1
  SERVICE: kids-activity-api

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - id: 'auth'
      uses: 'google-github-actions/auth@v1'
      with:
        credentials_json: '${{ secrets.GCP_SA_KEY }}'
    
    - name: 'Set up Cloud SDK'
      uses: 'google-github-actions/setup-gcloud@v1'
    
    - name: 'Build and Deploy'
      run: |
        cd backend
        gcloud builds submit --config=cloudbuild.yaml .
```

## Security Best Practices

1. **Enable Cloud Armor** for DDoS protection
   ```bash
   gcloud compute security-policies create kids-api-policy \
     --description "Security policy for Kids Activity API"
   ```

2. **Set up Identity-Aware Proxy** for admin endpoints
   ```bash
   gcloud iap web enable \
     --resource-type=backend-services \
     --service=kids-activity-api
   ```

3. **Configure CORS** properly in the API
   - Already configured in `backend/src/middleware/cors.ts`

4. **Use least privilege** for service accounts
   ```bash
   gcloud iam service-accounts create kids-api-sa \
     --display-name="Kids Activity API Service Account"
   ```

## Cost Optimization

1. **Set up budget alerts**
   ```bash
   gcloud billing budgets create \
     --billing-account=YOUR_BILLING_ACCOUNT \
     --display-name="Kids Activity Tracker Budget" \
     --budget-amount=50 \
     --threshold-rule=percent=80
   ```

2. **Configure autoscaling**
   - Min instances: 1 (to avoid cold starts)
   - Max instances: 10
   - CPU utilization target: 80%

3. **Use Cloud CDN** for static assets
   ```bash
   gcloud compute backend-services update kids-api-backend \
     --enable-cdn \
     --cache-mode=CACHE_ALL_STATIC
   ```

## Troubleshooting

### API Returns 500 Error
1. Check Cloud Run logs
2. Verify database connection
3. Check secret values are correct

### Database Connection Issues
1. Verify Cloud SQL instance is running
2. Check IAM permissions
3. Ensure Cloud SQL Admin API is enabled

### High Latency
1. Check instance location vs user location
2. Review Cloud Run metrics
3. Consider enabling Cloud CDN
4. Check database query performance

### Authentication Failures
1. Verify JWT secrets are set correctly
2. Check token expiration times
3. Review CORS configuration

## Rollback Procedure

```bash
# List revisions
gcloud run revisions list --service=kids-activity-api --region=$REGION

# Rollback to previous revision
gcloud run services update-traffic kids-activity-api \
  --region=$REGION \
  --to-revisions=kids-activity-api-00001-abc=100
```

## Support

For issues or questions:
1. Check Cloud Run logs
2. Review this documentation
3. Check Google Cloud Status
4. Open an issue on GitHub