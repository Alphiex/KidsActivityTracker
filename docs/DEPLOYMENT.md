# Deployment Guide

Deployment procedures for Kids Activity Tracker on Google Cloud Platform.

## Overview

| | |
|---|---|
| **Project ID** | `kids-activity-tracker-2024` |
| **Region** | `us-central1` |
| **API URL** | `https://kids-activity-api-205843686007.us-central1.run.app` |
| **Database** | Cloud SQL `kids-activity-db-dev` |
| **Scraper** | Cloud Run Job `kids-activity-scraper-job` |

## Architecture

```
GitHub Repository
       │
       ├── Push to main
       ▼
Cloud Build (CI/CD)
       │
       ├── Build Docker Image
       ├── Run Tests
       ├── Push to Artifact Registry
       ▼
Cloud Run Deployment
       │
       ├── API Service (auto-scaling)
       ├── Scraper Job (scheduled)
       └── Database Migrations
```

## Pre-Deployment Checklist

- [ ] Verify GCP project: `gcloud config get-value project`
- [ ] Run tests locally: `npm test`
- [ ] Run lint: `npm run lint`
- [ ] Run typecheck: `npm run typecheck`
- [ ] Check environment variables
- [ ] Review git changes
- [ ] Backup database (if schema changes)

## API Deployment

### Using Deploy Script

```bash
./scripts/deployment/deploy-api.sh
```

### Manual Deployment

```bash
# 1. Build and push Docker image
gcloud builds submit --tag us-central1-docker.pkg.dev/kids-activity-tracker-2024/cloud-run-source-deploy/kids-activity-api

# 2. Deploy to Cloud Run
gcloud run deploy kids-activity-api \
  --image us-central1-docker.pkg.dev/kids-activity-tracker-2024/cloud-run-source-deploy/kids-activity-api \
  --region us-central1 \
  --memory 2Gi \
  --allow-unauthenticated \
  --set-env-vars "NODE_ENV=production"
```

### Environment Variables

Set in Cloud Run console or via CLI:

```bash
gcloud run services update kids-activity-api \
  --region us-central1 \
  --set-env-vars "DATABASE_URL=postgresql://..." \
  --set-env-vars "JWT_SECRET=..." \
  --set-env-vars "JWT_REFRESH_SECRET=..."
```

## Database Deployment

### Run Migrations

```bash
cd server

# Development
npx prisma migrate dev

# Production
npx prisma migrate deploy
```

### Direct Database Access

```bash
PGPASSWORD='PASSWORD' psql -h 34.42.149.102 -U postgres -d kidsactivity
```

### Schema Changes

1. Update `prisma/schema.prisma`
2. Create migration: `npx prisma migrate dev --name description`
3. Test locally
4. Deploy: `npx prisma migrate deploy`

## Scraper Deployment

### Update Scraper Job

```bash
# Build scraper image
gcloud builds submit --tag gcr.io/kids-activity-tracker-2024/scraper-enhanced:latest ./server/scrapers

# Update job
gcloud run jobs update kids-activity-scraper-job \
  --region us-central1 \
  --image gcr.io/kids-activity-tracker-2024/scraper-enhanced:latest \
  --memory 2Gi \
  --task-timeout 1800
```

### Manual Execution

```bash
# Run scraper
gcloud run jobs execute kids-activity-scraper-job --region=us-central1

# Check status
gcloud run jobs executions list \
  --job=kids-activity-scraper-job \
  --region=us-central1

# View logs
gcloud run jobs executions logs \
  --job=kids-activity-scraper-job \
  --region=us-central1
```

## iOS App Deployment

### TestFlight Deployment

```bash
./scripts/ios/deploy-testflight.sh
```

### App Store Build

```bash
# 1. Build archive
./scripts/ios/build-archive.sh

# 2. Upload via Xcode Organizer or Transporter app
```

### Version Management

Update in `ios/KidsActivityTracker/Info.plist`:
- `CFBundleShortVersionString` - Version (1.2.0)
- `CFBundleVersion` - Build number (42)

## Monitoring

### Health Check

```bash
curl https://kids-activity-api-205843686007.us-central1.run.app/health
```

### View Logs

```bash
# API logs
gcloud run services logs read kids-activity-api \
  --region us-central1 \
  --limit 100

# Scraper logs
gcloud run jobs executions logs \
  --job kids-activity-scraper-job \
  --region us-central1
```

### Cloud Run Dashboard

View in Google Cloud Console:
- Cloud Run > Services > kids-activity-api
- Metrics: Request count, latency, errors
- Revisions: Traffic splitting, rollbacks

## Rollback Procedures

### API Rollback

```bash
# List revisions
gcloud run revisions list --service kids-activity-api --region us-central1

# Rollback to previous revision
gcloud run services update-traffic kids-activity-api \
  --region us-central1 \
  --to-revisions PREVIOUS_REVISION=100
```

### Database Rollback

```bash
# View migration history
npx prisma migrate status

# Rollback (manual SQL required for production)
# Always backup before schema changes
```

## Secrets Management

### Current Setup

Environment variables set directly in Cloud Run.

### Recommended: Secret Manager

```bash
# Create secret
gcloud secrets create jwt-secret --data-file=./jwt-secret.txt

# Grant access
gcloud secrets add-iam-policy-binding jwt-secret \
  --member serviceAccount:SERVICE_ACCOUNT \
  --role roles/secretmanager.secretAccessor

# Use in Cloud Run
gcloud run services update kids-activity-api \
  --set-secrets "JWT_SECRET=jwt-secret:latest"
```

## Scaling Configuration

### Current Settings

| Service | Min Instances | Max Instances | Memory |
|---------|--------------|---------------|--------|
| API | 0 | 100 | 2GB |
| Scraper | 1 (per job) | 1 | 2GB |

### Adjust Scaling

```bash
gcloud run services update kids-activity-api \
  --region us-central1 \
  --min-instances 1 \
  --max-instances 50 \
  --memory 2Gi \
  --cpu 2
```

## Cost Optimization

| Strategy | Implementation |
|----------|----------------|
| Auto-scaling to zero | Min instances = 0 |
| Right-sized memory | 2GB based on usage |
| Efficient queries | Database indexes |
| Request caching | Future: Redis layer |

## Troubleshooting Deployments

### Build Failures

```bash
# View build logs
gcloud builds list --limit 5
gcloud builds log BUILD_ID
```

### Deployment Failures

```bash
# Check service status
gcloud run services describe kids-activity-api --region us-central1

# View recent errors
gcloud run services logs read kids-activity-api \
  --region us-central1 \
  --limit 50 \
  --filter "severity>=ERROR"
```

### Database Connection Issues

1. Verify Cloud SQL instance is running
2. Check IP allowlist includes Cloud Run
3. Verify connection string format
4. Test with `psql` directly

---

**Document Version**: 4.0
**Last Updated**: December 2025
