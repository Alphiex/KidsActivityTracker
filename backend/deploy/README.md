# Deployment Guide for Google Cloud Platform

This guide walks through deploying the Kids Activity Tracker backend to Google Cloud Platform.

## Prerequisites

1. Google Cloud Platform account with billing enabled
2. `gcloud` CLI installed and authenticated
3. `terraform` installed (for infrastructure provisioning)
4. Docker installed locally

## Architecture

The deployment consists of:
- **Cloud Run**: API server and monitoring dashboard (serverless containers)
- **Cloud SQL**: PostgreSQL database for activity data
- **Memorystore Redis**: Job queue for scraping tasks
- **Cloud Scheduler**: Triggers hourly scraping jobs
- **Secret Manager**: Stores sensitive configuration

## Deployment Steps

### 1. Set up GCP Project

```bash
# Set your project ID
export PROJECT_ID=your-project-id
gcloud config set project $PROJECT_ID

# Enable required APIs
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable sqladmin.googleapis.com
gcloud services enable redis.googleapis.com
gcloud services enable cloudscheduler.googleapis.com
gcloud services enable secretmanager.googleapis.com
```

### 2. Deploy Infrastructure with Terraform

```bash
cd terraform

# Initialize Terraform
terraform init

# Create terraform.tfvars with your project ID
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your project_id

# Plan the deployment
terraform plan

# Apply the infrastructure
terraform apply
```

### 3. Run Database Migrations

```bash
# Get database connection string from Terraform output
export DATABASE_URL=$(terraform output -raw database_url)

# Run migrations
cd ../
npx prisma migrate deploy

# Seed initial data
npx prisma db seed
```

### 4. Build and Deploy with Cloud Build

```bash
# Submit build
gcloud builds submit --config=cloudbuild.yaml .
```

### 5. Configure Custom Domain (Optional)

```bash
# Map custom domain to Cloud Run service
gcloud run domain-mappings create \
  --service=kids-activity-api \
  --domain=api.yourdomain.com \
  --region=us-central1
```

## Environment Variables

The following environment variables are configured:

- `NODE_ENV`: Set to "production"
- `DATABASE_URL`: PostgreSQL connection string (from Secret Manager)
- `REDIS_URL`: Redis connection string (from Secret Manager)
- `SCRAPE_INTERVAL_HOURS`: Set via Cloud Scheduler (1 hour)

## Monitoring

1. **Cloud Run Logs**: 
   ```bash
   gcloud run logs read --service=kids-activity-api
   ```

2. **Monitoring Dashboard**: 
   Access at `https://kids-activity-monitoring-[project-id].a.run.app`

3. **Cloud SQL Metrics**: 
   View in GCP Console under SQL instances

## Scaling Configuration

Default settings:
- **API Server**: 1-10 instances, 512MB RAM, 1 CPU
- **Monitoring**: 0-5 instances, 256MB RAM, 0.5 CPU
- **Database**: db-f1-micro (upgradeable for production)
- **Redis**: 1GB BASIC tier

## Cost Optimization

1. Cloud Run scales to zero when not in use
2. Use Cloud Scheduler to control scraping frequency
3. Consider using Cloud SQL proxy for local development
4. Enable VPC connector for private communication

## Security Best Practices

1. Use Secret Manager for all sensitive data
2. Enable Cloud SQL IAM authentication
3. Restrict Cloud Run to authenticated requests only
4. Use VPC Service Controls for additional security
5. Enable Cloud Armor for DDoS protection

## Backup and Recovery

1. Cloud SQL automatic backups are enabled (daily at 3 AM)
2. Point-in-time recovery enabled (7-day retention)
3. Export data regularly to Cloud Storage:
   ```bash
   gcloud sql export csv [INSTANCE_NAME] gs://[BUCKET_NAME]/backup.csv \
     --database=kidsactivity --query="SELECT * FROM Activity"
   ```

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
   - Check Cloud SQL instance is running
   - Verify authorized networks include Cloud Run
   - Check Secret Manager permissions

2. **Redis Connection Errors**
   - Ensure VPC connector is configured
   - Check Redis instance status

3. **Scraping Job Failures**
   - Check Cloud Scheduler logs
   - Verify service account permissions
   - Check Cloud Run service logs

### Debug Commands

```bash
# Check service status
gcloud run services describe kids-activity-api --region=us-central1

# View recent logs
gcloud run logs read --service=kids-activity-api --limit=50

# Check database connectivity
gcloud sql connect kids-activity-db-production --user=appuser

# View scheduled jobs
gcloud scheduler jobs list --location=us-central1
```

## CI/CD Pipeline

The `cloudbuild.yaml` automatically:
1. Builds Docker images
2. Pushes to Container Registry
3. Deploys to Cloud Run
4. Updates environment variables

Trigger builds on git push:
```bash
gcloud builds triggers create github \
  --repo-name=KidsActivityTracker \
  --repo-owner=your-github-username \
  --branch-pattern="^main$" \
  --build-config=backend/cloudbuild.yaml
```