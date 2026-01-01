# Production Architecture Enhancement Plan

## Executive Summary

This document outlines a comprehensive plan to prepare Kids Activity Tracker for production release with:
- Service isolation (API/AI, Scrapers, Website)
- Database rename, performance tuning, and backup strategy
- Custom domain setup (kidsactivitytracker.ca)
- Cost optimization with high availability
- Enhanced CI/CD pipeline

---

## Current State Analysis

### Infrastructure Overview

| Component | Current Configuration | Issues |
|-----------|----------------------|--------|
| **GCP Project** | `kids-activity-tracker-2024` | Name has year suffix |
| **Database Instance** | `kids-activity-db-dev` | "dev" in production name |
| **Database Name** | `kidsactivity` | OK |
| **API Service** | `kids-activity-api` (Cloud Run) | Shared with AI |
| **Scraper** | `kids-activity-scraper-job` (Cloud Run Job) | Same project resources |
| **Website** | `website` (Cloud Run) | Same project resources |
| **Region** | `us-central1` | Good for central US/Canada |

### Current Resource Allocation

| Service | Memory | CPU | Instances | Monthly Est. |
|---------|--------|-----|-----------|--------------|
| API | 2GB | 2 | 0-10 | ~$50-150 |
| Scraper Job | 4GB | 4 | 1 per run | ~$20-40 |
| Website | 512MB | 1 | 0-10 | ~$10-30 |
| Cloud SQL | ? | ? | 1 | ~$50-100 |
| **Total** | | | | **~$130-320/mo** |

### Database Schema Status

✅ **31 tables** with comprehensive indexing
✅ **120+ indexes** already defined
⚠️ Missing AI-specific indexes for recommendation queries

### ⚠️ CRITICAL: Current Database Issues

| Issue | Current | Recommended |
|-------|---------|-------------|
| **Instance Tier** | `db-f1-micro` (0.6GB RAM, shared CPU) | `db-custom-2-8192` (2 vCPU, 8GB RAM) |
| **Disk Size** | 10GB | 50GB+ with auto-increase |
| **Backups** | ❌ **DISABLED** | Daily with 7-day retention |
| **Network Access** | 0.0.0.0/0 (open to ALL) | Private IP only |
| **SSL Required** | ❌ No | ✅ Yes |
| **High Availability** | ❌ No | Regional (2 zones) |

**Risk Assessment**: The current database configuration is **not production-ready**. A single hardware failure could result in complete data loss with no recovery option.

---

## Proposed Architecture

```
                    ┌─────────────────────────────────────────────────────────┐
                    │                    kidsactivitytracker.ca               │
                    └────────────────────────────┬────────────────────────────┘
                                                 │
                              ┌──────────────────┼──────────────────┐
                              │                  │                  │
                              ▼                  ▼                  ▼
                    ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
                    │   api.*.ca      │ │   www.*.ca      │ │  (future)       │
                    │                 │ │                 │ │  admin.*.ca     │
                    └────────┬────────┘ └────────┬────────┘ └─────────────────┘
                             │                   │
                             ▼                   ▼
┌────────────────────────────────────────┐ ┌─────────────────────────────────┐
│       Cloud Run: API + AI Service      │ │   Cloud Run: Website (Next.js)  │
│                                        │ │                                 │
│  kids-activity-api                     │ │   kids-activity-website         │
│  - Express.js + Prisma                 │ │   - Next.js Static/SSR          │
│  - AI Recommendations (LangChain)      │ │   - 512MB / 1 CPU               │
│  - 2GB Memory / 2 CPU                  │ │   - Min: 0, Max: 10             │
│  - Min: 1, Max: 20                     │ │                                 │
│                                        │ │                                 │
└───────────────────┬────────────────────┘ └─────────────────────────────────┘
                    │
                    │  VPC Connector (Private)
                    ▼
┌────────────────────────────────────────┐
│        Cloud SQL: PostgreSQL 15        │
│                                        │
│   Instance: kids-activity-db           │
│   Database: kidsactivity               │
│   - db-custom-2-8192 (2 vCPU, 8GB)    │
│   - 50GB SSD                           │
│   - Private IP only                    │
│   - Automated daily backups            │
│   - Point-in-time recovery (7 days)    │
│                                        │
└────────────────────────────────────────┘
                    ▲
                    │ VPC Connector (Private)
                    │
┌────────────────────────────────────────┐     ┌─────────────────────────────┐
│    Cloud Run Job: Scraper Service      │     │     Cloud Scheduler         │
│                                        │     │                             │
│   kids-activity-scraper                │◄────│   - Daily scrape: 6 AM      │
│   - Puppeteer/Chromium                 │     │   - Critical: every 4 hrs   │
│   - 4GB Memory / 4 CPU                 │     │   - Weekly full scan: Sun   │
│   - Timeout: 30 minutes                │     │                             │
│   - Isolated from API traffic          │     └─────────────────────────────┘
│                                        │
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│         Cloud Memorystore (Redis)      │
│                                        │
│   - Basic tier: 1GB                    │
│   - AI response caching                │
│   - Session caching (future)           │
│   - ~$35/month                         │
│                                        │
└────────────────────────────────────────┘
```

---

## Phase 1: Database Improvements (Week 1)

### 1.1 Create New Production Database Instance

**Current**: `kids-activity-db-dev`
**New**: `kids-activity-db` (remove "dev" suffix)

```bash
# Step 1: Create new production instance
gcloud sql instances create kids-activity-db \
  --database-version=POSTGRES_15 \
  --tier=db-custom-2-8192 \
  --region=us-central1 \
  --storage-type=SSD \
  --storage-size=50GB \
  --storage-auto-increase \
  --availability-type=REGIONAL \
  --backup-start-time=04:00 \
  --enable-bin-log \
  --retained-backups-count=7 \
  --retained-transaction-log-days=7 \
  --network=default \
  --no-assign-ip

# Step 2: Create database
gcloud sql databases create kidsactivity --instance=kids-activity-db

# Step 3: Set password
gcloud sql users set-password postgres \
  --instance=kids-activity-db \
  --password=YOUR_SECURE_PASSWORD
```

### 1.2 Add Missing AI Indexes

Add to `prisma/schema.prisma`:

```prisma
model Activity {
  // ... existing fields ...

  // Add new composite indexes for AI recommendation queries
  @@index([isActive, ageMin, ageMax])               // Age filtering
  @@index([isActive, cost])                          // Price filtering  
  @@index([isActive, dateStart, dateEnd])            // Date range
  @@index([isActive, dayOfWeek])                     // Day of week (array)
  @@index([isActive, spotsAvailable])                // Availability
  @@index([isActive, activityTypeId, ageMin, ageMax]) // Type + age combo
}
```

### 1.3 Configure Automated Backups

| Setting | Value | Purpose |
|---------|-------|---------|
| Daily Backup | 4:00 AM UTC | Full daily backup |
| Retained Backups | 7 days | Recovery window |
| Point-in-Time Recovery | Enabled | Granular recovery |
| Binary Logging | Enabled | Transaction logs |

### 1.4 Database Migration Plan

```bash
# 1. Get database credentials from GCP Secret Manager
export DATABASE_URL=$(gcloud secrets versions access latest --secret=database-url)
DB_HOST=$(gcloud sql instances describe kids-activity-db-dev --format='value(ipAddresses[0].ipAddress)')
DB_PASSWORD=$(echo $DATABASE_URL | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p')

# 2. Export from current instance
PGPASSWORD="$DB_PASSWORD" pg_dump -h "$DB_HOST" -U postgres -d kidsactivity > backup.sql

# 3. Import to new instance (via Cloud SQL Proxy)
cloud_sql_proxy -instances=kids-activity-tracker-2024:us-central1:kids-activity-db=tcp:5433 &
PGPASSWORD="$DB_PASSWORD" psql -h localhost -p 5433 -U postgres -d kidsactivity < backup.sql

# 4. Verify data integrity
PGPASSWORD="$DB_PASSWORD" psql -h localhost -p 5433 -U postgres -d kidsactivity -c "SELECT COUNT(*) FROM \"Activity\";"

# 5. Update secrets with new connection string (if needed)
# gcloud secrets versions add database-url --data-file=-
```

---

## Phase 2: Service Separation (Week 2)

### 2.1 API Service Configuration

Update `server/deploy-backend.sh`:

```bash
# Production API configuration
gcloud run deploy kids-activity-api \
    --image "$IMAGE" \
    --region us-central1 \
    --platform managed \
    --allow-unauthenticated \
    --memory 2Gi \
    --cpu 2 \
    --timeout 300 \
    --concurrency 100 \
    --min-instances 1 \       # Always warm for production
    --max-instances 20 \
    --cpu-throttling \
    --vpc-connector kids-activity-connector \
    --vpc-egress private-ranges-only \
    --set-cloudsql-instances kids-activity-tracker-2024:us-central1:kids-activity-db \
    --set-env-vars "NODE_ENV=production" \
    --set-secrets "DATABASE_URL=database-url:latest,JWT_ACCESS_SECRET=jwt-access-secret:latest,JWT_REFRESH_SECRET=jwt-refresh-secret:latest,OPENAI_API_KEY=openai-api-key:latest,REDIS_URL=redis-url:latest"
```

### 2.2 Scraper Service (Isolated)

The scraper already runs as a Cloud Run Job, which is isolated. Update configuration:

```bash
gcloud run jobs update kids-activity-scraper \
  --region us-central1 \
  --image gcr.io/kids-activity-tracker-2024/kids-activity-scraper:latest \
  --cpu 4 \
  --memory 8Gi \                  # Increase for parallel scraping
  --max-retries 1 \
  --task-timeout 45m \
  --vpc-connector kids-activity-connector \
  --set-cloudsql-instances kids-activity-tracker-2024:us-central1:kids-activity-db \
  --set-env-vars "NODE_ENV=production,HEADLESS=true" \
  --set-secrets "DATABASE_URL=database-url:latest"
```

### 2.3 Website Service (Separate)

Already separate. Optimize configuration:

```bash
gcloud run deploy kids-activity-website \
    --image gcr.io/kids-activity-tracker-2024/website:latest \
    --region us-central1 \
    --platform managed \
    --allow-unauthenticated \
    --memory 512Mi \
    --cpu 1 \
    --min-instances 0 \
    --max-instances 10 \
    --port 3000
```

### 2.4 VPC Connector for Private Database Access

```bash
# Create VPC connector for private Cloud SQL access
gcloud compute networks vpc-access connectors create kids-activity-connector \
    --region us-central1 \
    --range 10.8.0.0/28 \
    --min-instances 2 \
    --max-instances 3
```

---

## Phase 3: Redis Cache (Week 2-3)

### 3.1 Create Memorystore Redis Instance

```bash
gcloud redis instances create kids-activity-cache \
    --size=1 \
    --region=us-central1 \
    --redis-version=redis_7_0 \
    --tier=basic \
    --network=default

# Get the IP
gcloud redis instances describe kids-activity-cache --region=us-central1 --format="value(host)"
```

### 3.2 Create Redis Secret

```bash
# Store Redis URL in Secret Manager
echo "redis://REDIS_IP:6379" | gcloud secrets create redis-url --data-file=-
```

### 3.3 Update API to Use Redis

Already implemented in the AI module. Just need to set `REDIS_URL` environment variable.

---

## Phase 4: Domain & SSL Setup (Week 3)

### 4.1 Domain Structure

| Subdomain | Service | Purpose |
|-----------|---------|---------|
| `kidsactivitytracker.ca` | Website | Main website |
| `www.kidsactivitytracker.ca` | Website | WWW redirect |
| `api.kidsactivitytracker.ca` | API | Mobile app API |
| `admin.kidsactivitytracker.ca` | (future) | Admin portal |

### 4.2 DNS Setup (Google Cloud DNS) ✅ ZONE CREATED

Using the same pattern as murmanspicks.com:
- **Registrar**: Squarespace
- **DNS Provider**: Google Cloud DNS

**Cloud DNS Zone Created:**
```
Zone Name: kidsactivitytracker
DNS Name: kidsactivitytracker.ca.
```

**Nameservers (configure in Squarespace):**
```
ns-cloud-d1.googledomains.com
ns-cloud-d2.googledomains.com
ns-cloud-d3.googledomains.com
ns-cloud-d4.googledomains.com
```

### 4.3 Step-by-Step Setup Instructions

#### Step 1: Update Squarespace Nameservers

1. Log in to **Squarespace** → **Domains** → **kidsactivitytracker.ca**
2. Click **DNS Settings** or **Advanced Settings**
3. Select **Use Custom Nameservers** (or "Use Third-Party DNS")
4. Enter the Google Cloud nameservers:
   - `ns-cloud-d1.googledomains.com`
   - `ns-cloud-d2.googledomains.com`
   - `ns-cloud-d3.googledomains.com`
   - `ns-cloud-d4.googledomains.com`
5. Save and wait 15-30 minutes for propagation

#### Step 2: Verify Domain Ownership with Google

```bash
# Verify domain ownership
gcloud domains verify kidsactivitytracker.ca --project=kids-activity-tracker-2024

# This will open a browser to Google Search Console for verification
# Follow the TXT record verification method
```

After verification, add the TXT record to Cloud DNS:
```bash
gcloud dns record-sets create kidsactivitytracker.ca. \
    --zone=kidsactivitytracker \
    --type=TXT \
    --ttl=300 \
    --rrdatas='"google-site-verification=VERIFICATION_CODE"' \
    --project=kids-activity-tracker-2024
```

#### Step 3: Create Cloud Run Domain Mappings

```bash
# Map API subdomain
gcloud beta run domain-mappings create \
    --service kids-activity-api \
    --domain api.kidsactivitytracker.ca \
    --region us-central1 \
    --project kids-activity-tracker-2024

# Map website (once deployed)
gcloud beta run domain-mappings create \
    --service kids-activity-website \
    --domain kidsactivitytracker.ca \
    --region us-central1 \
    --project kids-activity-tracker-2024

gcloud beta run domain-mappings create \
    --service kids-activity-website \
    --domain www.kidsactivitytracker.ca \
    --region us-central1 \
    --project kids-activity-tracker-2024
```

#### Step 4: Add DNS Records to Cloud DNS

```bash
# Get the Cloud Run IP (Global Anycast IP for Cloud Run)
# Usually: 216.239.32.21, 216.239.34.21, 216.239.36.21, 216.239.38.21

# Add A records for root domain (website)
gcloud dns record-sets create kidsactivitytracker.ca. \
    --zone=kidsactivitytracker \
    --type=A \
    --ttl=300 \
    --rrdatas="216.239.32.21,216.239.34.21,216.239.36.21,216.239.38.21" \
    --project=kids-activity-tracker-2024

# Add CNAME for www
gcloud dns record-sets create www.kidsactivitytracker.ca. \
    --zone=kidsactivitytracker \
    --type=CNAME \
    --ttl=300 \
    --rrdatas="ghs.googlehosted.com." \
    --project=kids-activity-tracker-2024

# Add CNAME for API
gcloud dns record-sets create api.kidsactivitytracker.ca. \
    --zone=kidsactivitytracker \
    --type=CNAME \
    --ttl=300 \
    --rrdatas="ghs.googlehosted.com." \
    --project=kids-activity-tracker-2024
```

#### Step 5: Verify DNS Propagation

```bash
# Check nameservers updated
dig kidsactivitytracker.ca NS +short

# Check A record
dig kidsactivitytracker.ca A +short

# Check API subdomain
dig api.kidsactivitytracker.ca CNAME +short
```

### 4.4 SSL/TLS

Cloud Run automatically provisions and manages SSL certificates for custom domains via Google-managed certificates. No action needed - certificates will be provisioned within 15-30 minutes of DNS propagation.

### 4.5 Update Mobile App Configuration

After domain setup, update the mobile app to use the new API URL:

```typescript
// src/config/api.ts
export const API_BASE_URL = __DEV__ 
  ? 'http://localhost:3000'
  : 'https://api.kidsactivitytracker.ca';
```

---

## Phase 5: CI/CD Enhancement (Week 4)

### 5.1 New Directory Structure

```
.github/
└── workflows/
    ├── api-deploy.yml          # API + AI deployment
    ├── website-deploy.yml      # Website deployment
    ├── scraper-deploy.yml      # Scraper deployment
    └── database-migrate.yml    # Schema migrations
```

### 5.2 API Deployment Workflow

`.github/workflows/api-deploy.yml`:

```yaml
name: Deploy API

on:
  push:
    branches: [main]
    paths:
      - 'server/**'
      - '!server/scrapers/**'
  workflow_dispatch:

env:
  PROJECT_ID: kids-activity-tracker-2024
  REGION: us-central1
  SERVICE: kids-activity-api

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: server/package-lock.json
      - run: cd server && npm ci
      - run: cd server && npm run typecheck
      - run: cd server && npm test

  deploy:
    needs: test
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
    
    steps:
      - uses: actions/checkout@v4
      
      - id: auth
        uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ secrets.WIF_PROVIDER }}
          service_account: ${{ secrets.WIF_SERVICE_ACCOUNT }}
      
      - uses: google-github-actions/setup-gcloud@v2
      
      - name: Build and Push
        run: |
          cd server
          gcloud builds submit --tag gcr.io/$PROJECT_ID/$SERVICE:${{ github.sha }}
      
      - name: Deploy
        run: |
          gcloud run deploy $SERVICE \
            --image gcr.io/$PROJECT_ID/$SERVICE:${{ github.sha }} \
            --region $REGION \
            --platform managed
      
      - name: Health Check
        run: |
          sleep 30
          curl -f https://api.kidsactivitytracker.ca/health
```

### 5.3 Scraper Deployment (Separate)

`.github/workflows/scraper-deploy.yml`:

```yaml
name: Deploy Scraper

on:
  push:
    branches: [main]
    paths:
      - 'server/scrapers/**'
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      # Similar structure, deploys to Cloud Run Job
```

### 5.4 Database Migration Workflow

`.github/workflows/database-migrate.yml`:

```yaml
name: Database Migration

on:
  push:
    branches: [main]
    paths:
      - 'server/prisma/schema.prisma'
      - 'server/prisma/migrations/**'
  workflow_dispatch:

jobs:
  migrate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Cloud SQL Proxy
        run: |
          wget https://dl.google.com/cloudsql/cloud_sql_proxy.linux.amd64 -O cloud_sql_proxy
          chmod +x cloud_sql_proxy
          ./cloud_sql_proxy -instances=${{ secrets.CLOUD_SQL_CONNECTION }}=tcp:5432 &
      
      - name: Run Migrations
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL_PROXY }}
        run: |
          cd server
          npm ci
          npx prisma migrate deploy
```

---

## Phase 6: Monitoring & Alerting (Week 4)

### 6.1 Cloud Monitoring Dashboard

Create custom dashboard with:
- API latency (p50, p95, p99)
- Request count by endpoint
- Error rate
- Database connections
- AI response times
- Cache hit rate

### 6.2 Alerting Policies

```bash
# High error rate alert
gcloud alpha monitoring policies create \
    --display-name="API Error Rate > 5%" \
    --condition-display-name="Error rate" \
    --condition-filter='resource.type="cloud_run_revision" AND metric.type="run.googleapis.com/request_count" AND metric.labels.response_code_class!="2xx"'

# High latency alert
gcloud alpha monitoring policies create \
    --display-name="API Latency > 2s" \
    --condition-display-name="High latency"
```

### 6.3 Uptime Checks

```bash
gcloud monitoring uptime-check-configs create api-health \
    --display-name="API Health Check" \
    --resource-type=uptime-url \
    --http-check-path=/health \
    --monitored-resource-labels="host=api.kidsactivitytracker.ca"
```

---

## Cost Estimates (Monthly)

### Current Architecture

| Service | Est. Cost |
|---------|-----------|
| Cloud Run API (0-10 instances) | $50-150 |
| Cloud Run Website (0-10 instances) | $10-30 |
| Cloud Run Job (scraper) | $20-40 |
| Cloud SQL (unknown tier) | $50-100 |
| **Total** | **$130-320** |

### Proposed Architecture

| Service | Est. Cost | Notes |
|---------|-----------|-------|
| Cloud Run API (1-20 instances) | $80-200 | Min 1 for cold start |
| Cloud Run Website (0-10 instances) | $10-30 | Same |
| Cloud Run Job (scraper) | $20-40 | Same |
| Cloud SQL (db-custom-2-8192) | $100-150 | 2 vCPU, 8GB RAM |
| Memorystore Redis (1GB) | $35 | AI caching |
| VPC Connector | $10 | Private networking |
| Cloud DNS | $0.50 | Domain hosting |
| SSL Certificates | $0 | Included |
| **Total** | **$255-465** |

### Cost Optimization Strategies

1. **Committed Use Discounts**: 1-year commit for Cloud SQL = 25% savings
2. **Right-size after launch**: Monitor actual usage, adjust resources
3. **Scheduled scaling**: Reduce min instances during off-peak hours
4. **AI caching**: Redis reduces OpenAI API calls significantly

---

## Implementation Timeline

| Week | Tasks | Deliverables |
|------|-------|--------------|
| **1** | Database improvements | New instance, backups, indexes |
| **2** | Service separation | VPC connector, private networking |
| **2-3** | Redis setup | AI caching operational |
| **3** | Domain setup | Custom domains, SSL |
| **4** | CI/CD enhancement | GitHub Actions workflows |
| **4** | Monitoring | Dashboards, alerts |

---

## Rollback Plan

### Database Rollback

1. Keep old `kids-activity-db-dev` running during transition
2. Point-in-time recovery available for 7 days
3. Daily backups retained for 7 days

### Service Rollback

```bash
# List revisions
gcloud run revisions list --service kids-activity-api --region us-central1

# Rollback to previous
gcloud run services update-traffic kids-activity-api \
    --to-revisions PREVIOUS_REVISION=100 \
    --region us-central1
```

---

## Pre-Launch Checklist

- [ ] New database instance created and tested
- [ ] All data migrated successfully
- [ ] Automated backups verified
- [ ] VPC connector configured
- [ ] Redis cache operational
- [ ] Custom domains configured
- [ ] SSL certificates provisioned
- [ ] CI/CD pipelines tested
- [ ] Monitoring dashboards created
- [ ] Alerting policies active
- [ ] Load testing completed
- [ ] Security review passed
- [ ] Mobile app updated with new API URL

---

## Next Steps

1. **Review this plan** - Confirm priorities and timeline
2. **Approve budget** - ~$255-465/month proposed
3. **Create new database** - Phase 1
4. **Schedule migration window** - Low-traffic period

---

## Production TODOs (Post-Launch Enhancements)

These items should be implemented once the app goes live and traffic increases:

### High Priority (When traffic exceeds 100 concurrent users)

- [ ] **Redis Caching (~$35/mo)** - Add Memorystore Redis for:
  - City lists caching (rarely change)
  - Popular activity search results (5-10 min TTL)
  - Activity type categories
  - AI recommendation caching
  - Expected improvement: 10-50x faster API responses, 80% less database load
  
  ```bash
  gcloud redis instances create kids-activity-cache \
      --size=1 \
      --region=us-central1 \
      --redis-version=redis_7_0 \
      --tier=basic \
      --network=default
  ```

### Medium Priority (Security Hardening)

- [ ] **Enable Cloud SQL Private IP** - Remove public IP from database
  - Requires: VPC peering with Cloud SQL
  - Benefit: Database only accessible via VPC connector
  
- [ ] **Enable SSL for Database** - Require encrypted connections
  ```bash
  gcloud sql instances patch kids-activity-db-dev --require-ssl
  ```

- [ ] **Restrict API Rate Limits** - Configure per-IP rate limiting

### Low Priority (Cost Optimization)

- [ ] **Committed Use Discounts** - 1-year commit for Cloud SQL (25% savings)
- [ ] **Scheduled Scaling** - Reduce min instances during off-peak hours
- [ ] **Right-size Resources** - Review actual usage after 30 days

### Future Features

- [ ] **Admin Portal** - admin.kidsactivitytracker.ca
- [ ] **CDN Integration** - Cloud CDN for static assets
- [ ] **Multi-region Deployment** - Canada region for lower latency

---

**Document Version**: 1.1
**Created**: December 2025
**Updated**: December 2025
**Author**: AI Assistant
