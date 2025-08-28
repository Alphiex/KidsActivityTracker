# Cost Optimization Guide for Development

This guide helps you minimize costs while developing with the kids-activity-tracker project.

## Estimated Monthly Costs (Development Setup)

### Cloud SQL (PostgreSQL)
- **db-f1-micro**: ~$7.67/month (if running 24/7)
- **Cost saving**: Stop when not in use - reduces to ~$0.50/month for storage only

### Redis (Memorystore)
- **1GB Basic tier**: ~$35/month (if running 24/7)
- **Cost saving**: Delete when not needed, recreate when required

### Cloud Run
- **With min instances = 0**: Pay only for actual usage
- **Estimated**: <$1/month for light development use

### Total Monthly Cost
- **Always on**: ~$43/month
- **Optimized (SQL stopped, no Redis)**: ~$1-2/month

## Cost Saving Commands

### Cloud SQL Management

```bash
# Stop Cloud SQL when not developing (saves ~$7/month)
gcloud sql instances patch kids-activity-db-dev --activation-policy=NEVER

# Start Cloud SQL when needed
gcloud sql instances patch kids-activity-db-dev --activation-policy=ALWAYS

# Check instance status
gcloud sql instances describe kids-activity-db-dev --format="value(state)"
```

### Redis Management

```bash
# Delete Redis when not needed (saves $35/month)
gcloud redis instances delete kids-activity-redis-dev --region=us-central1 --quiet

# Recreate Redis when needed
gcloud redis instances create kids-activity-redis-dev \
  --size=1 \
  --region=us-central1 \
  --redis-version=redis_7_0 \
  --tier=basic

# After recreating, update the redis-url secret
REDIS_HOST=$(gcloud redis instances describe kids-activity-redis-dev --region=us-central1 --format="value(host)")
echo -n "redis://$REDIS_HOST:6379" | gcloud secrets versions add redis-url --data-file=-
```

### Cloud Run Management

```bash
# Set minimum instances to 0 (already configured)
gcloud run services update kids-activity-api \
  --region=us-central1 \
  --min-instances=0

# Check current configuration
gcloud run services describe kids-activity-api --region=us-central1
```

## Development Workflow

### Daily Development
1. Start Cloud SQL: `gcloud sql instances patch kids-activity-db-dev --activation-policy=ALWAYS`
2. Develop and test
3. Stop Cloud SQL: `gcloud sql instances patch kids-activity-db-dev --activation-policy=NEVER`

### Occasional Development
1. Keep Cloud SQL stopped
2. Delete Redis if not using job queues
3. Cloud Run will scale to 0 automatically

### Active Development Period
- Keep Cloud SQL running during active development days
- Create Redis only if testing job queues
- Monitor costs: `gcloud billing accounts get-billing-info BILLING_ACCOUNT_ID`

## Cost Monitoring

```bash
# View current month's costs
gcloud billing projects describe kids-activity-tracker

# Set up budget alerts
gcloud billing budgets create \
  --billing-account=BILLING_ACCOUNT_ID \
  --display-name="Kids Activity Dev Budget" \
  --budget-amount=10 \
  --threshold-rule=percent=50 \
  --threshold-rule=percent=90
```

## Alternative: Local Development

For zero cloud costs during development:

1. Use local PostgreSQL:
   ```bash
   brew install postgresql
   brew services start postgresql
   createdb kidsactivity
   ```

2. Use local Redis:
   ```bash
   brew install redis
   brew services start redis
   ```

3. Update backend `.env`:
   ```env
   DATABASE_URL=postgresql://localhost/kidsactivity
   REDIS_URL=redis://localhost:6379
   ```

## Quick Reference

| Service | Always On | Optimized | Stopped/Deleted |
|---------|-----------|-----------|-----------------|
| Cloud SQL | $7.67/mo | $0.50/mo | $0.50/mo (storage) |
| Redis | $35/mo | - | $0/mo |
| Cloud Run | <$1/mo | <$1/mo | $0/mo |
| **Total** | **~$43/mo** | **~$1-2/mo** | **~$0.50/mo** |

## Automation Script

Create `scripts/dev-start.sh`:
```bash
#!/bin/bash
echo "Starting development environment..."
gcloud sql instances patch kids-activity-db-dev --activation-policy=ALWAYS
echo "Cloud SQL started. Remember to stop it when done!"
```

Create `scripts/dev-stop.sh`:
```bash
#!/bin/bash
echo "Stopping development environment..."
gcloud sql instances patch kids-activity-db-dev --activation-policy=NEVER
echo "Cloud SQL stopped. Costs minimized!"
```