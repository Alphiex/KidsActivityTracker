# Deployment Guide

## Overview

Kids Activity Tracker is deployed on Google Cloud Platform using serverless infrastructure for scalability as we expand from North Vancouver to all of British Columbia.

## Production Environment

### Google Cloud Project
- **Project ID**: `kids-activity-tracker-2024`
- **Region**: `us-central1`
- **DO NOT USE**: officepools project (deprecated)

### Live Services
- **API**: https://kids-activity-api-205843686007.us-central1.run.app
- **Database**: Cloud SQL `kids-activity-db-dev`
- **Scraper**: Cloud Run Job `kids-activity-scraper-job`

## Deployment Architecture

```
GitHub Repository
       │
       ├── Push to main
       ▼
Cloud Build (CI/CD)
       │
       ├── Build Docker Image
       ├── Run Tests
       ├── Push to Container Registry
       ▼
Cloud Run Deployment
       │
       ├── API Service
       ├── Scraper Job
       └── Database Migrations
```

## Pre-Deployment Checklist

### Before ANY Deployment
- [ ] Verify correct GCP project: `gcloud config get-value project`
- [ ] Run tests locally: `npm test`
- [ ] Check environment variables are set
- [ ] Review changes in git
- [ ] Backup database if schema changes
- [ ] Ensure no test files in deployment

## Deployment Procedures

### 1. Deploy Backend API (Recommended Method)

**IMPORTANT**: Google Container Registry (gcr.io) is deprecated. Use Artifact Registry instead.

```bash
# Navigate to server directory
cd server

# Step 1: Build and push to Artifact Registry
gcloud builds submit \
  --tag us-central1-docker.pkg.dev/kids-activity-tracker-2024/cloud-run-source-deploy/kids-activity-api:latest .

# Step 2: Deploy to Cloud Run (preserves existing secrets)
gcloud run deploy kids-activity-api \
  --image us-central1-docker.pkg.dev/kids-activity-tracker-2024/cloud-run-source-deploy/kids-activity-api:latest \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --memory 2Gi \
  --timeout 300

# Verify deployment
curl https://kids-activity-api-205843686007.us-central1.run.app/api/v1/activities?limit=1

# Check logs
gcloud run services logs read kids-activity-api --region us-central1 --limit=30
```

#### If Container Fails to Start (Missing Secrets)

The server requires JWT secrets. If you see "JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be configured" in logs:

```bash
# Deploy with secrets from Secret Manager
gcloud run deploy kids-activity-api \
  --image us-central1-docker.pkg.dev/kids-activity-tracker-2024/cloud-run-source-deploy/kids-activity-api:latest \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --memory 2Gi \
  --timeout 300 \
  --update-secrets="JWT_ACCESS_SECRET=jwt-access-secret:latest,JWT_REFRESH_SECRET=jwt-refresh-secret:latest"
```

#### Common Deployment Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `Container Registry is deprecated` | Using `gcr.io/` URLs | Switch to Artifact Registry URLs |
| `Cannot update environment variable [X] to string literal` | Env var was set as secret reference | Don't override with `--set-env-vars`, use `--update-secrets` |
| `JWT_ACCESS_SECRET must be configured` | Missing JWT secrets | Add `--update-secrets` flag |
| `Container failed to start` | Check logs for specific error | Run `gcloud run services logs read` |

### Quick Deploy Script

Create `deploy-backend.sh` in the server directory:

```bash
#!/bin/bash
set -e

echo "Building and pushing to Artifact Registry..."
gcloud builds submit \
  --tag us-central1-docker.pkg.dev/kids-activity-tracker-2024/cloud-run-source-deploy/kids-activity-api:latest .

echo "Deploying to Cloud Run..."
gcloud run deploy kids-activity-api \
  --image us-central1-docker.pkg.dev/kids-activity-tracker-2024/cloud-run-source-deploy/kids-activity-api:latest \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --memory 2Gi \
  --timeout 300

echo "Verifying deployment..."
curl -s "https://kids-activity-api-205843686007.us-central1.run.app/api/v1/activities?limit=1" | head -100

echo "Deployment complete!"
```

### Legacy Method (DO NOT USE)

```bash
# DO NOT USE - Container Registry is deprecated
# gcloud builds submit --config deploy/cloudbuild-api.yaml

# Check logs
gcloud logging read "resource.type=cloud_run_revision \
  AND resource.labels.service_name=kids-activity-api" \
  --limit=50
```

### 2. Deploy NVRC Scraper

```bash
# Build scraper image
cd backend
gcloud builds submit --config deploy/cloudbuild-scraper-enhanced.yaml

# Update Cloud Run job
gcloud run jobs update kids-activity-scraper-job \
  --image=gcr.io/kids-activity-tracker-2024/scraper-enhanced:latest \
  --region=us-central1

# Test scraper manually
gcloud run jobs execute kids-activity-scraper-job --region=us-central1

# Check execution status
gcloud run jobs executions list \
  --job=kids-activity-scraper-job \
  --region=us-central1
```

### 3. Database Migrations

```bash
# Generate migration locally
cd backend
npx prisma migrate dev --name migration_name

# Deploy to production
npx prisma migrate deploy

# Or use Cloud Run job
gcloud run jobs execute run-migrations --region=us-central1
```

### 4. Mobile App Deployment

#### iOS (TestFlight)
```bash
cd ios
fastlane beta  # Requires Apple Developer account setup
```

#### Android (Play Store)
```bash
cd android
./gradlew bundleRelease
# Upload AAB to Play Console
```

## Environment Configuration

### Required Environment Variables

#### API Service
| Variable | Type | Description |
|----------|------|-------------|
| `NODE_ENV` | env var | Set to `production` |
| `DATABASE_URL` | **secret** | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` | **secret** | JWT access token signing key |
| `JWT_REFRESH_SECRET` | **secret** | JWT refresh token signing key |
| `PORT` | env var | Default: 3000 (set by Cloud Run) |

#### Scraper Service
```env
NODE_ENV=production
DATABASE_URL=postgresql://[user]:[password]@[host]/kidsactivity
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
```

### Secrets in Google Secret Manager

The following secrets are stored in Secret Manager (NOT as plain env vars):

```bash
# List all secrets
gcloud secrets list

# Current secrets:
# - database-url (DATABASE_URL)
# - jwt-access-secret (JWT_ACCESS_SECRET)
# - jwt-refresh-secret (JWT_REFRESH_SECRET)
# - jwt-secret (legacy, may not be used)
```

### Setting Environment Variables vs Secrets

**IMPORTANT**: Never mix secret references with string literals for the same variable.

```bash
# For plain environment variables
gcloud run services update kids-activity-api \
  --update-env-vars="NODE_ENV=production" \
  --region=us-central1

# For secrets (PREFERRED for sensitive data)
gcloud run services update kids-activity-api \
  --update-secrets="DATABASE_URL=database-url:latest" \
  --region=us-central1

# Check current configuration
gcloud run services describe kids-activity-api \
  --region=us-central1 \
  --format="yaml(spec.template.spec.containers[0].env)"
```

### Creating New Secrets

```bash
# Create a new secret
echo -n "your-secret-value" | gcloud secrets create secret-name --data-file=-

# Update existing secret
echo -n "new-value" | gcloud secrets versions add secret-name --data-file=-

# Grant Cloud Run access to secret
gcloud secrets add-iam-policy-binding secret-name \
  --member="serviceAccount:205843686007-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

## Cloud Build Configuration

### API Deployment (cloudbuild-api.yaml)
```yaml
steps:
  # Build Docker image
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-f', 'deploy/Dockerfile.api', '-t', 'gcr.io/$PROJECT_ID/kids-activity-api', '.']
  
  # Push to Container Registry
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/kids-activity-api']
  
  # Deploy to Cloud Run
  - name: 'gcr.io/cloud-builders/gcloud'
    args:
      - 'run'
      - 'deploy'
      - 'kids-activity-api'
      - '--image=gcr.io/$PROJECT_ID/kids-activity-api'
      - '--region=us-central1'
      - '--platform=managed'
      - '--allow-unauthenticated'

images:
  - 'gcr.io/$PROJECT_ID/kids-activity-api'
```

### Scraper Deployment (cloudbuild-scraper-enhanced.yaml)
```yaml
steps:
  # Build with Puppeteer support
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-f', 'deploy/Dockerfile.scraper', '-t', 'gcr.io/$PROJECT_ID/scraper-enhanced', '.']
  
  # Push image
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/scraper-enhanced']

images:
  - 'gcr.io/$PROJECT_ID/scraper-enhanced'
```

## Infrastructure as Code

### Cloud Scheduler Setup
```bash
# Create scraper schedule (daily at 6 AM UTC)
gcloud scheduler jobs create http kids-activity-scraper-schedule \
  --location=us-central1 \
  --schedule="0 6 * * *" \
  --time-zone="UTC" \
  --uri="https://us-central1-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/kids-activity-tracker-2024/jobs/kids-activity-scraper-job:run" \
  --http-method=POST \
  --oauth-service-account-email=[SERVICE_ACCOUNT_EMAIL]
```

### Cloud SQL Setup
```bash
# Create instance
gcloud sql instances create kids-activity-db-prod \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=us-central1

# Create database
gcloud sql databases create kidsactivity \
  --instance=kids-activity-db-prod

# Set password
gcloud sql users set-password postgres \
  --instance=kids-activity-db-prod \
  --password=[PASSWORD]
```

## Monitoring & Logging

### View Service Logs
```bash
# API logs
gcloud logging read "resource.type=cloud_run_revision \
  AND resource.labels.service_name=kids-activity-api \
  AND severity>=ERROR" \
  --limit=50 \
  --format=json

# Scraper logs
gcloud logging read "resource.type=cloud_run_job \
  AND resource.labels.job_name=kids-activity-scraper-job" \
  --limit=50
```

### Monitor Service Health
```bash
# Check API status
gcloud run services describe kids-activity-api \
  --region=us-central1 \
  --format="value(status.url)"

# Check recent deployments
gcloud run revisions list \
  --service=kids-activity-api \
  --region=us-central1
```

## Rollback Procedures

### Rollback API Service
```bash
# List revisions
gcloud run revisions list \
  --service=kids-activity-api \
  --region=us-central1

# Rollback to previous revision
gcloud run services update-traffic kids-activity-api \
  --to-revisions=[PREVIOUS_REVISION]=100 \
  --region=us-central1
```

### Rollback Database Migration
```bash
# View migration history
npx prisma migrate status

# Create down migration
npx prisma migrate dev --create-only

# Apply rollback
npx prisma migrate deploy
```

## Scaling Configuration

### API Service Scaling
```bash
# Update scaling limits
gcloud run services update kids-activity-api \
  --min-instances=1 \
  --max-instances=100 \
  --region=us-central1

# Set memory and CPU
gcloud run services update kids-activity-api \
  --memory=1Gi \
  --cpu=1 \
  --region=us-central1
```

### Database Scaling (for BC expansion)
```bash
# Upgrade tier when needed
gcloud sql instances patch kids-activity-db-prod \
  --tier=db-n1-standard-1
```

## Cost Optimization

### Current Setup (North Vancouver)
- Cloud Run: ~$5/month (low traffic)
- Cloud SQL: ~$10/month (micro instance)
- Storage: ~$1/month

### Scaling for BC (Projected)
- Cloud Run: ~$50/month (auto-scaling)
- Cloud SQL: ~$100/month (standard instance)
- Storage: ~$10/month

### Cost Controls
```bash
# Set billing alerts
gcloud billing budgets create \
  --billing-account=[BILLING_ACCOUNT] \
  --display-name="Monthly Budget" \
  --budget-amount=200 \
  --threshold-rule=percent=50 \
  --threshold-rule=percent=90
```

## Security Best Practices

1. **Never commit secrets** - Use Secret Manager
2. **Least privilege** - Minimal IAM permissions
3. **Private IPs** - Use VPC connector (future)
4. **SSL only** - Enforced by Cloud Run
5. **Rate limiting** - Implemented in API

## Troubleshooting

### Common Issues

#### API Returns 500 Error
```bash
# Check logs for errors
gcloud logging read "resource.type=cloud_run_revision \
  AND severity>=ERROR" --limit=10

# Verify database connection
gcloud sql instances describe kids-activity-db-prod
```

#### Scraper Timeout
```bash
# Increase timeout
gcloud run jobs update kids-activity-scraper-job \
  --timeout=3600 \
  --region=us-central1
```

#### Out of Memory
```bash
# Increase memory allocation
gcloud run services update kids-activity-api \
  --memory=2Gi \
  --region=us-central1
```

## Deployment Schedule

### Regular Deployments
- **API Updates**: As needed, with testing
- **Scraper Updates**: Weekly maintenance window
- **Database Migrations**: Scheduled maintenance

### Emergency Hotfixes
1. Test fix locally
2. Deploy to staging (if available)
3. Quick production deployment
4. Monitor closely for 30 minutes

## Expansion Readiness (BC-wide)

### Infrastructure Preparation
- [ ] Upgrade Cloud SQL tier
- [ ] Implement caching layer
- [ ] Add CDN for static content
- [ ] Set up multi-region failover
- [ ] Implement queue for scraping jobs

### Monitoring Enhancements
- [ ] Set up Stackdriver dashboards
- [ ] Configure alerting policies
- [ ] Implement SLO monitoring
- [ ] Add custom metrics

## Contact & Support

### Escalation Path
1. Check logs and monitoring
2. Review recent deployments
3. Check GCP status page
4. Contact team lead

### Key Commands Reference
```bash
# Quick health check
curl https://kids-activity-api-205843686007.us-central1.run.app/health

# Force scraper run
gcloud run jobs execute kids-activity-scraper-job --region=us-central1

# View current configuration
gcloud run services describe kids-activity-api --region=us-central1
```