# Production Migration Instructions - Activity Types Fix

## Overview
This document contains instructions for deploying the activity types fix to production. This migration will:

1. Create `ActivityType` and `ActivitySubtype` tables
2. Add foreign key columns to the `Activity` table
3. Populate the tables with proper categorization data
4. **Fix the issue where squash activities were appearing under "Swimming & Aquatics" instead of "Racquet Sports"**

## Files Created
- `scripts/deploy-activity-types-migration.sql` - Main migration script
- `scripts/deploy-activity-types-to-production.sh` - Deployment script (requires direct DB access)
- `PRODUCTION_MIGRATION_INSTRUCTIONS.md` - This file

## Option 1: Run Migration via Cloud SQL Console (Recommended)

### Step 1: Access Cloud SQL Console
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Navigate to SQL instances
3. Select project: `kids-activity-tracker-2024`
4. Click on instance: `kids-activity-db-dev`
5. Click "Open Cloud Shell" or use the "Query" tab

### Step 2: Execute Migration
Copy and paste the entire contents of `scripts/deploy-activity-types-migration.sql` into the SQL console and execute it.

### Step 3: Verify Migration
Run these queries to verify the migration was successful:

```sql
-- Check activity types were created
SELECT COUNT(*) as type_count FROM "ActivityType";
-- Should return 22

-- Check activity subtypes were created  
SELECT COUNT(*) as subtype_count FROM "ActivitySubtype";
-- Should return 47

-- Verify squash is correctly categorized under Racquet Sports
SELECT 
    at.name as type_name,
    ast.name as subtype_name
FROM "ActivitySubtype" ast 
JOIN "ActivityType" at ON ast."activityTypeId" = at.id 
WHERE ast.code = 'squash';
-- Should return: "Racquet Sports" | "Squash"
```

## Option 2: Run via gcloud CLI

### Prerequisites
```bash
# Set correct project
gcloud config set project kids-activity-tracker-2024

# Install Cloud SQL Proxy (if not already installed)
gcloud components install cloud_sql_proxy

# Set production password
export PRODUCTION_DB_PASSWORD="your-production-password"
```

### Execute Migration
```bash
# Connect to production database and run migration
gcloud sql connect kids-activity-db-dev --user=postgres --database=kidsactivity
# Then in the psql prompt, run:
\i /path/to/scripts/deploy-activity-types-migration.sql
```

## Option 3: Run Deployment Script (If Direct Access Available)

```bash
# Set production password
export PRODUCTION_DB_PASSWORD="your-production-password"

# Run deployment script
./scripts/deploy-activity-types-to-production.sh
```

## Post-Migration Steps

### 1. Verify API Endpoints
Test the activity types API endpoints:

```bash
# Test activity types endpoint
curl "https://kids-activity-api-205843686007.us-central1.run.app/api/v1/activity-types" | jq '.data | length'
# Should return 22

# Test racquet sports specifically
curl "https://kids-activity-api-205843686007.us-central1.run.app/api/v1/activity-types/racquet-sports" | jq '.activityType.subtypes[] | select(.code == "squash")'
# Should return squash subtype details
```

### 2. Recategorize Existing Activities
If there are existing activities in the database, run the recategorization script:

```bash
# This will update existing activities to use the new type system
DATABASE_URL='postgresql://postgres:password@host:5432/kidsactivity' node scripts/recategorize-all-activities.js
```

### 3. Run Scrapers
Execute the scrapers to populate activities with correct categorization:

```bash
# Run the NVRC scraper
gcloud run jobs execute scraper-detailed-job --region=us-central1
```

### 4. Test Frontend
1. Check that activity types display correctly in the UI
2. Verify that squash activities now appear under "Racquet Sports"
3. Test filtering by activity type and subtype

## Rollback Instructions (If Needed)

If the migration needs to be rolled back:

```sql
-- Drop foreign key constraints
ALTER TABLE "Activity" DROP CONSTRAINT IF EXISTS "Activity_activityTypeId_fkey";
ALTER TABLE "Activity" DROP CONSTRAINT IF EXISTS "Activity_activitySubtypeId_fkey";

-- Remove columns
ALTER TABLE "Activity" DROP COLUMN IF EXISTS "activityTypeId";
ALTER TABLE "Activity" DROP COLUMN IF EXISTS "activitySubtypeId";

-- Drop tables
DROP TABLE IF EXISTS "ActivitySubtype";
DROP TABLE IF EXISTS "ActivityType";
```

## Expected Results

After successful migration:

✅ 22 Activity Types created (Swimming & Aquatics, Team Sports, Racquet Sports, etc.)
✅ 47+ Activity Subtypes created
✅ **Squash is correctly under "Racquet Sports" not "Swimming & Aquatics"**
✅ API endpoints return proper categorization data
✅ Frontend displays correct activity categories
✅ Activity filtering works by type and subtype

## Support

If issues occur during migration:
1. Check the migration script output for specific errors
2. Verify database connectivity
3. Ensure all prerequisite tables exist
4. Check for constraint violations
5. Review the rollback instructions above if needed

## Migration Summary

This migration fixes the fundamental issue with activity categorization in the KidsActivityTracker system. Previously, activities were only categorized by basic category strings, leading to incorrect categorization (like squash under swimming). 

With this migration:
- Activities now have proper type/subtype relationships
- Categorization is consistent and accurate
- The mapping logic correctly identifies activity types
- **Squash activities will appear under "Racquet Sports" where they belong**