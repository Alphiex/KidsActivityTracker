# Kids Activity Tracker - Production Infrastructure Documentation

## Last Updated: August 26, 2025

## Table of Contents
1. [Cloud Infrastructure](#cloud-infrastructure)
2. [Database Configuration](#database-configuration)
3. [API Service](#api-service)
4. [Scraper Service](#scraper-service)
5. [Scheduled Jobs](#scheduled-jobs)
6. [Scripts and Tools](#scripts-and-tools)
7. [Monitoring and Maintenance](#monitoring-and-maintenance)
8. [Security Configuration](#security-configuration)

---

## Cloud Infrastructure

### Google Cloud Project
- **Project ID**: `kids-activity-tracker-2024`
- **Project Number**: `205843686007`
- **Region**: `us-central1`
- **Active Account**: `escapenow79@gmail.com`

### Services Used
- Google Cloud Run (API hosting)
- Google Cloud SQL (PostgreSQL database)
- Google Container Registry (Docker images)
- Google Cloud Scheduler (Cron jobs)
- Google Secret Manager (Sensitive data)
- Google Cloud Storage (Backups - if configured)

---

## Database Configuration

### Cloud SQL Instance
- **Instance Name**: `kids-activity-db-dev`
- **Database Engine**: PostgreSQL 15
- **Region**: `us-central1`
- **Tier**: `db-f1-micro` (0.6 GB RAM)
- **Storage**: Auto-resize enabled
- **IP**: `34.42.149.102`

### Database Settings
- **Database Name**: `kidsactivity`
- **Primary User**: `postgres`
- **Password**: Stored in Secret Manager as `DATABASE_URL`
- **Max Connections**: 200
- **Backup**: Daily automated backups (7-day retention)

### Connection String Format
```
postgresql://postgres:[PASSWORD]@34.42.149.102:5432/kidsactivity
```

### Database Schema
- Uses Prisma ORM for schema management
- Schema file: `/prisma/schema.prisma`
- Migrations tracked in `/prisma/migrations/`

### Key Tables
1. **Activity** - Main activity records
2. **Provider** - Activity providers (NVRC, etc.)
3. **Location** - Venue locations
4. **Category** - Age-based categories
5. **ActivityType** - Activity type taxonomy
6. **ActivityCategory** - Junction table for many-to-many relationships
7. **User** - User accounts
8. **Favorite** - User favorites
9. **ActivitySession** - Individual session details

---

## API Service

### Cloud Run Service
- **Service Name**: `kids-activity-api`
- **URL**: `https://kids-activity-api-205843686007.us-central1.run.app`
- **Region**: `us-central1`
- **Container**: `gcr.io/kids-activity-tracker-2024/kids-activity-api:latest`

### API Configuration
- **Memory**: 2 GiB
- **CPU**: 2 vCPUs
- **Timeout**: 3600 seconds (1 hour)
- **Max Instances**: 10
- **Min Instances**: 0 (scales to zero)
- **Concurrency**: 1000 requests per instance
- **Authentication**: Allow unauthenticated

### API Endpoints

#### Activity Endpoints
- `GET /api/v1/activities` - Search and filter activities
  - Query params: `activityType`, `activitySubtype`, `category`, `ageMin`, `ageMax`, `costMax`, `location`, `limit`, `page`
- `GET /api/v1/activities/:id` - Get specific activity
- `GET /api/v1/activities/featured` - Get featured activities

#### Category Endpoints
- `GET /api/v1/categories` - Get all categories
- `GET /api/v1/categories/:code/activities` - Get activities by category

#### Activity Type Endpoints
- `GET /api/v1/activity-types` - Get all activity types with counts
- `GET /api/v1/activity-types/:type/subtypes` - Get subtypes for an activity type

#### User Endpoints
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/login` - User login
- `GET /api/v1/users/:id/favorites` - Get user favorites
- `POST /api/v1/users/:id/favorites` - Add favorite
- `DELETE /api/v1/users/:id/favorites/:activityId` - Remove favorite

### Environment Variables
- `DATABASE_URL` - Database connection string (from Secret Manager)
- `NODE_ENV` - Set to `production`
- `PORT` - Automatically set by Cloud Run

---

## Scraper Service

### Scraper Job Configuration
- **Job Name**: `scraper-detailed-job`
- **Container**: `gcr.io/kids-activity-tracker-2024/scraper-detailed:latest`
- **Type**: Cloud Run Job

### Job Settings
- **Memory**: 2 GiB (can be increased to 4 GiB for heavy scraping)
- **CPU**: 2 vCPUs
- **Task Timeout**: 3600 seconds (1 hour)
- **Max Retries**: 1
- **Parallelism**: 1 (single instance)

### Scraper Components

#### Active Scrapers
1. **nvrcEnhancedParallelScraper.js**
   - Primary NVRC scraper
   - Scrapes ~700+ activities
   - Uses Puppeteer for dynamic content
   - Parallel processing for performance

2. **enhancedActivityMapper.js**
   - Maps raw activities to structured data
   - Detects parent participation requirements
   - Assigns activity types and subtypes
   - Determines age categories

#### Scraper Features
- Automatic detection of parent participation activities
- Age range extraction from activity names
- Activity type categorization
- Duplicate detection and merging
- Session detail extraction
- Registration status tracking

### Running the Scraper Manually
```bash
# Local test
DATABASE_URL="postgresql://..." node scraper-job.js

# Production via Cloud Run Job
gcloud run jobs execute scraper-detailed-job \
  --region=us-central1 \
  --project=kids-activity-tracker-2024
```

---

## Scheduled Jobs

### Cloud Scheduler Jobs

#### Daily Activity Scraper
- **Name**: `daily-activity-scraper`
- **Schedule**: `0 6 * * *` (6:00 AM daily)
- **Target**: Cloud Run Job `scraper-detailed-job`
- **Time Zone**: America/Vancouver

#### Database Cleanup (if configured)
- **Name**: `cleanup-db-connections`
- **Schedule**: `0 * * * *` (Hourly)
- **Script**: `/scripts/cleanup-db-connections.js`
- Terminates idle connections > 15 minutes
- Cleans up stuck transactions

---

## Scripts and Tools

### Deployment Scripts

#### `/deploy-api.sh`
```bash
# Build and deploy API to Cloud Run
docker build --platform linux/amd64 -t gcr.io/kids-activity-tracker-2024/kids-activity-api:latest .
docker push gcr.io/kids-activity-tracker-2024/kids-activity-api:latest
gcloud run deploy kids-activity-api \
  --image gcr.io/kids-activity-tracker-2024/kids-activity-api:latest \
  --region us-central1
```

#### `/deploy-scraper.sh`
```bash
# Build and deploy scraper job
docker build --platform linux/amd64 -t gcr.io/kids-activity-tracker-2024/scraper-detailed:latest .
docker push gcr.io/kids-activity-tracker-2024/scraper-detailed:latest
gcloud run jobs update scraper-detailed-job \
  --image gcr.io/kids-activity-tracker-2024/scraper-detailed:latest \
  --region us-central1
```

### Maintenance Scripts

#### `/scripts/cleanup-db-connections.js`
- Monitors database connections
- Terminates zombie connections (idle > 15 min)
- Logs connection statistics

#### `/fix-parent-categories-production.js`
- Assigns activities to parent participation categories
- Sets requiresParent flags
- Updates ActivityCategory associations

#### `/fix-activity-subtypes.js`
- Fixes generic subtype assignments
- Maps activities to specific subtypes (Ballet, Jazz, etc.)

#### `/comprehensive-activity-mapper-v3.js`
- Enhanced activity mapping logic
- Priority-based categorization
- Parent participation detection

### Migration Scripts

#### Database Migrations
- `/prisma/migrate deploy` - Apply pending migrations
- `/migrate-production-batch.js` - Batch activity updates
- `/populate-activity-categories.js` - Populate junction tables

---

## Monitoring and Maintenance

### Health Checks

#### API Health
```bash
curl https://kids-activity-api-205843686007.us-central1.run.app/health
```

#### Database Connections
```sql
SELECT COUNT(*) as total_connections,
       COUNT(*) FILTER (WHERE state = 'idle') as idle,
       COUNT(*) FILTER (WHERE state = 'active') as active
FROM pg_stat_activity 
WHERE datname = 'kidsactivity';
```

### Logging
- **API Logs**: Cloud Run logs in GCP Console
- **Scraper Logs**: Cloud Run Jobs logs
- **Database Logs**: Cloud SQL logs

### Performance Metrics
- API response times via Cloud Run metrics
- Database connection pool usage
- Scraper execution time and success rate

### Common Maintenance Tasks

#### Clear Zombie Database Connections
```bash
node scripts/cleanup-db-connections.js
```

#### Update Activity Categorization
```bash
DATABASE_URL="..." node comprehensive-activity-mapper-v3.js
```

#### Fix Parent Categories
```bash
DATABASE_URL="..." node fix-parent-categories-production.js
```

#### Run Scraper Manually
```bash
gcloud run jobs execute scraper-detailed-job --region=us-central1
```

---

## Security Configuration

### Secret Management
- **Secret Name**: `DATABASE_URL`
- **Version**: Latest (auto-updated)
- Access granted to Cloud Run service account

### Service Account Permissions
- **Default Service Account**: `205843686007-compute@developer.gserviceaccount.com`
- Permissions:
  - `roles/cloudsql.client` - Database access
  - `roles/secretmanager.secretAccessor` - Secret access
  - `roles/run.invoker` - Invoke Cloud Run services

### Database Security
- **IP Allowlist**: Configured for Cloud Run
- **SSL**: Required for external connections
- **Password Policy**: Strong passwords enforced

### API Security
- CORS configured for allowed domains
- Rate limiting implemented
- Input validation on all endpoints

---

## Troubleshooting

### Common Issues and Solutions

#### 1. Container Build Failures
- Ensure `--platform linux/amd64` flag for Cloud Run compatibility
- Check Dockerfile for missing dependencies

#### 2. Database Connection Issues
- Verify Cloud SQL instance is running
- Check connection pooling limits
- Run connection cleanup script

#### 3. Scraper Failures
- Check Puppeteer/Chromium compatibility
- Increase memory if needed
- Review target website changes

#### 4. API Timeout Issues
- Increase Cloud Run timeout setting
- Optimize database queries
- Implement caching where appropriate

---

## Backup and Recovery

### Database Backups
- Automated daily backups (7-day retention)
- Point-in-time recovery available
- Export to Cloud Storage for long-term storage

### Backup Commands
```bash
# Manual backup
gcloud sql backups create \
  --instance=kids-activity-db-dev \
  --project=kids-activity-tracker-2024

# Export to Cloud Storage
gcloud sql export sql kids-activity-db-dev \
  gs://kids-activity-backups/backup-$(date +%Y%m%d).sql \
  --database=kidsactivity
```

---

## Cost Optimization

### Current Configuration
- Cloud Run scales to zero when idle
- Database uses smallest tier (db-f1-micro)
- Minimal storage usage

### Recommendations
- Monitor usage patterns
- Consider reserved capacity for predictable workloads
- Implement caching to reduce database queries
- Use Cloud CDN for static assets

---

## Contact and Support

- **Project Owner**: Mike
- **Email**: escapenow79@gmail.com
- **Repository**: /Users/mike/Development/KidsActivityTracker

## Important Notes

1. **Always test migrations locally first**
2. **Take database backups before major changes**
3. **Monitor costs regularly in GCP Console**
4. **Keep secrets rotated periodically**
5. **Document any infrastructure changes**

---

*This documentation should be updated whenever infrastructure changes are made.*