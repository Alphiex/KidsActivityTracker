# Maintenance Guide

## Overview

This guide covers monitoring, troubleshooting, and maintaining the Kids Activity Tracker in production.

## Daily Operations

### Health Checks

#### API Health
```bash
# Check API status
curl https://kids-activity-api-205843686007.us-central1.run.app/health

# Expected response
{
  "success": true,
  "status": "healthy",
  "timestamp": "2024-08-30T12:00:00Z"
}
```

#### Database Health
```bash
# Check database connection
gcloud sql instances describe kids-activity-db-dev \
  --format="value(state)"

# Check activity count
psql $DATABASE_URL -c "SELECT COUNT(*) FROM \"Activity\" WHERE \"isActive\" = true;"
```

#### Scraper Status
```bash
# Check last scraper run
gcloud run jobs executions list \
  --job=kids-activity-scraper-job \
  --region=us-central1 \
  --limit=1

# View scraper logs
gcloud logging read "resource.type=cloud_run_job \
  AND resource.labels.job_name=kids-activity-scraper-job \
  AND timestamp>=\"$(date -u -d '1 day ago' '+%Y-%m-%dT%H:%M:%S')Z\"" \
  --limit=50
```

### Monitoring Dashboard

#### Key Metrics to Track
- **Activity Count**: Should be ~2,900 for North Vancouver
- **API Response Time**: < 200ms average
- **Scraper Success Rate**: > 95%
- **Database Size**: Monitor growth
- **Error Rate**: < 1%

#### Setting Up Alerts
```bash
# Create alert for API errors
gcloud alpha monitoring policies create \
  --notification-channels=[CHANNEL_ID] \
  --display-name="API Error Rate" \
  --condition="rate(errors) > 0.01"

# Create alert for low activity count
gcloud alpha monitoring policies create \
  --display-name="Low Activity Count" \
  --condition="activity_count < 2000"
```

## Troubleshooting

### Common Issues

#### 1. No Activities Showing in App

**Check Database**
```bash
# Count active activities
psql $DATABASE_URL -c "
  SELECT 
    \"isActive\", 
    COUNT(*) as count,
    MAX(\"updatedAt\") as last_update
  FROM \"Activity\" 
  GROUP BY \"isActive\";
"
```

**Check Scraper**
```bash
# Run scraper manually
gcloud run jobs execute kids-activity-scraper-job --region=us-central1

# Watch execution
gcloud run jobs executions describe [EXECUTION_NAME] \
  --job=kids-activity-scraper-job \
  --region=us-central1
```

**Fix: Reactivate Activities**
```sql
-- If activities were incorrectly marked inactive
UPDATE "Activity" 
SET "isActive" = true 
WHERE "providerId" = '[NVRC_PROVIDER_ID]'
  AND "updatedAt" > NOW() - INTERVAL '7 days';
```

#### 2. API Returns 500 Errors

**Check Logs**
```bash
# View error logs
gcloud logging read "resource.type=cloud_run_revision \
  AND resource.labels.service_name=kids-activity-api \
  AND severity>=ERROR" \
  --limit=20 \
  --format=json
```

**Common Causes**
- Database connection timeout
- Memory limit exceeded
- Missing environment variables

**Fix: Restart Service**
```bash
# Force new deployment
gcloud run services update kids-activity-api \
  --region=us-central1 \
  --clear-env-vars=DUMMY \
  --set-env-vars=DUMMY=1
```

#### 3. Scraper Fails

**Check Browser Issues**
```bash
# View scraper logs
gcloud logging read "resource.type=cloud_run_job \
  AND \"Puppeteer\"" \
  --limit=50
```

**Common Errors**
- `TimeoutError`: Page load timeout
- `Protocol error`: Browser crash
- `Navigation failed`: Site structure changed

**Fix: Update Scraper Image**
```bash
# Rebuild with latest dependencies
cd backend
gcloud builds submit --config deploy/cloudbuild-scraper-enhanced.yaml

# Update job
gcloud run jobs update kids-activity-scraper-job \
  --image=gcr.io/kids-activity-tracker-2024/scraper-enhanced:latest \
  --region=us-central1
```

#### 4. Database Connection Issues

**Check Connection**
```bash
# Test connection
gcloud sql connect kids-activity-db-dev --user=postgres

# Check connection limit
gcloud sql instances describe kids-activity-db-dev \
  --format="value(settings.maxConnections)"
```

**Fix: Reset Connections**
```sql
-- Terminate idle connections
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle'
  AND state_change < NOW() - INTERVAL '10 minutes';
```

### Performance Issues

#### Slow API Response

**Identify Slow Queries**
```sql
-- Find slow queries
SELECT 
  query,
  mean_exec_time,
  calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

**Add Missing Indexes**
```sql
-- Common performance indexes
CREATE INDEX idx_activity_active_category 
  ON "Activity"("isActive", "category");

CREATE INDEX idx_activity_dates 
  ON "Activity"("dateStart", "dateEnd");

CREATE INDEX idx_activity_location 
  ON "Activity"("locationId", "isActive");
```

#### High Memory Usage

**Check Memory**
```bash
# View service memory usage
gcloud run services describe kids-activity-api \
  --region=us-central1 \
  --format="value(spec.template.spec.containers[0].resources.limits.memory)"
```

**Fix: Increase Memory**
```bash
gcloud run services update kids-activity-api \
  --memory=2Gi \
  --region=us-central1
```

## Regular Maintenance

### Weekly Tasks

#### 1. Database Maintenance
```bash
# Vacuum and analyze
psql $DATABASE_URL -c "VACUUM ANALYZE;"

# Check table sizes
psql $DATABASE_URL -c "
  SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
  FROM pg_tables
  WHERE schemaname = 'public'
  ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
"
```

#### 2. Log Cleanup
```bash
# Archive old logs
gcloud logging read "timestamp<\"$(date -u -d '30 days ago' '+%Y-%m-%dT%H:%M:%S')Z\"" \
  --format=json > archive/logs_$(date +%Y%m).json

# Clean up container registry
gcloud container images list-tags \
  gcr.io/kids-activity-tracker-2024/kids-activity-api \
  --filter="timestamp.datetime < '-30d'" \
  --format="get(digest)" | \
  xargs -I {} gcloud container images delete \
  gcr.io/kids-activity-tracker-2024/kids-activity-api@{} --quiet
```

#### 3. Security Updates
```bash
# Check for vulnerabilities
cd backend
npm audit

# Fix vulnerabilities
npm audit fix

# Update dependencies
npm update
```

### Monthly Tasks

#### 1. Database Backup
```bash
# Create backup
gcloud sql backups create \
  --instance=kids-activity-db-dev \
  --description="Monthly backup $(date +%Y-%m)"

# List backups
gcloud sql backups list --instance=kids-activity-db-dev
```

#### 2. Performance Review
```bash
# Generate performance report
node backend/cli.js generate-report --month=$(date +%Y-%m)

# Check growth trends
psql $DATABASE_URL -c "
  SELECT 
    DATE_TRUNC('month', \"createdAt\") as month,
    COUNT(*) as activities_added
  FROM \"Activity\"
  GROUP BY month
  ORDER BY month DESC
  LIMIT 12;
"
```

#### 3. Cost Analysis
```bash
# View monthly costs
gcloud billing accounts list

# Get cost breakdown
gcloud billing budgets list

# Optimize unused resources
gcloud compute instances list --filter="status:TERMINATED"
```

## Disaster Recovery

### Backup Procedures

#### Database Backup
```bash
# Manual backup
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# Restore from backup
psql $DATABASE_URL < backup_20240830.sql
```

#### Configuration Backup
```bash
# Export Cloud Run configuration
gcloud run services export kids-activity-api \
  --region=us-central1 \
  --format=export > api-config.yaml

# Export job configuration  
gcloud run jobs export kids-activity-scraper-job \
  --region=us-central1 \
  --format=export > scraper-config.yaml
```

### Recovery Procedures

#### Complete System Recovery
1. **Restore Database**
```bash
# Create new instance if needed
gcloud sql instances create kids-activity-db-restore \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=us-central1

# Restore from backup
gcloud sql backups restore [BACKUP_ID] \
  --restore-instance=kids-activity-db-restore
```

2. **Redeploy Services**
```bash
# Deploy API
cd backend
gcloud builds submit --config deploy/cloudbuild-api.yaml

# Deploy scraper
gcloud builds submit --config deploy/cloudbuild-scraper-enhanced.yaml
```

3. **Verify System**
```bash
# Test API
curl https://kids-activity-api-205843686007.us-central1.run.app/health

# Run scraper test
gcloud run jobs execute kids-activity-scraper-job \
  --region=us-central1
```

## Scaling Operations

### Preparing for BC Expansion

#### Database Scaling
```bash
# Upgrade database tier
gcloud sql instances patch kids-activity-db-dev \
  --tier=db-n1-standard-1 \
  --cpu=2 \
  --memory=4GB

# Enable high availability
gcloud sql instances patch kids-activity-db-dev \
  --availability-type=REGIONAL
```

#### API Scaling
```bash
# Increase instance limits
gcloud run services update kids-activity-api \
  --min-instances=2 \
  --max-instances=200 \
  --concurrency=100 \
  --region=us-central1
```

#### Add Caching Layer
```bash
# Deploy Redis for caching
gcloud redis instances create kids-activity-cache \
  --size=1 \
  --region=us-central1 \
  --redis-version=redis_6_x
```

## Monitoring Scripts

### Activity Monitor
```bash
#!/bin/bash
# monitor-activities.sh

EXPECTED_MIN=2800
ACTUAL=$(psql $DATABASE_URL -t -c "SELECT COUNT(*) FROM \"Activity\" WHERE \"isActive\" = true;")

if [ $ACTUAL -lt $EXPECTED_MIN ]; then
  echo "WARNING: Only $ACTUAL active activities (expected > $EXPECTED_MIN)"
  # Send alert
  gcloud logging write activity-alert "Low activity count: $ACTUAL" --severity=WARNING
fi
```

### API Health Monitor
```bash
#!/bin/bash
# monitor-api.sh

RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" https://kids-activity-api-205843686007.us-central1.run.app/health)

if [ $RESPONSE -ne 200 ]; then
  echo "API unhealthy: HTTP $RESPONSE"
  # Restart service
  gcloud run services update kids-activity-api --region=us-central1 --no-traffic
fi
```

## CLI Commands Reference

### Database Operations
```bash
# Connect to database
node backend/cli.js db-connect

# Run migrations
node backend/cli.js migrate

# Backup database
node backend/cli.js backup-db

# Restore database
node backend/cli.js restore-db --file=backup.sql
```

### Scraper Operations
```bash
# Run scraper
node backend/cli.js scrape

# Test scraper (dry run)
node backend/cli.js test-scraper

# View scraper status
node backend/cli.js scraper-status

# Fix duplicate activities
node backend/cli.js fix-duplicates
```

### Maintenance Operations
```bash
# Clean old data
node backend/cli.js cleanup --days=90

# Optimize database
node backend/cli.js optimize-db

# Generate reports
node backend/cli.js generate-report

# Fix activity costs
node backend/cli.js fix-costs
```

## Security Maintenance

### Regular Security Tasks

#### Update Dependencies
```bash
# Check for vulnerabilities
npm audit

# Update packages
npm update

# Force update major versions
npx npm-check-updates -u
npm install
```

#### Rotate Secrets
```bash
# Generate new JWT secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Update in Cloud Run
gcloud run services update kids-activity-api \
  --set-env-vars="JWT_SECRET=[NEW_SECRET]" \
  --region=us-central1
```

#### Review Access Logs
```bash
# Check for suspicious activity
gcloud logging read "
  resource.type=cloud_run_revision AND
  httpRequest.status>=400 AND
  httpRequest.status<500
" --limit=100
```

## Support Contacts

### Escalation Path
1. **Level 1**: Check documentation and logs
2. **Level 2**: Restart services
3. **Level 3**: Database recovery
4. **Level 4**: Contact cloud support

### Key Resources
- **GCP Status**: https://status.cloud.google.com
- **Project Console**: https://console.cloud.google.com/home/dashboard?project=kids-activity-tracker-2024
- **API Endpoint**: https://kids-activity-api-205843686007.us-central1.run.app
- **Support Email**: support@kidsactivitytracker.com