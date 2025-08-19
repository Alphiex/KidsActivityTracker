# Manual Migration Steps for ActivitySession and ActivityPrerequisite Tables

Since we're having connection issues, here are the manual steps to complete the migration:

## Option 1: Using Google Cloud Console

1. Go to Google Cloud Console: https://console.cloud.google.com
2. Navigate to SQL > kids-activity-tracker-2024:us-central1:kidsactivity
3. Click on "Connect using Cloud Shell"
4. Run the following SQL commands:

```sql
-- Create ActivitySession table
CREATE TABLE IF NOT EXISTS "ActivitySession" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "activityId" TEXT NOT NULL,
    "sessionNumber" INTEGER,
    "date" TEXT,
    "startTime" TEXT,
    "endTime" TEXT,
    "location" TEXT,
    "instructor" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActivitySession_pkey" PRIMARY KEY ("id")
);

-- Create ActivityPrerequisite table
CREATE TABLE IF NOT EXISTS "ActivityPrerequisite" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "activityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "url" TEXT,
    "courseId" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActivityPrerequisite_pkey" PRIMARY KEY ("id")
);

-- Add foreign key constraints
ALTER TABLE "ActivitySession" ADD CONSTRAINT "ActivitySession_activityId_fkey" 
    FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ActivityPrerequisite" ADD CONSTRAINT "ActivityPrerequisite_activityId_fkey" 
    FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create indexes
CREATE INDEX "ActivitySession_activityId_idx" ON "ActivitySession"("activityId");
CREATE INDEX "ActivitySession_date_idx" ON "ActivitySession"("date");
CREATE INDEX "ActivityPrerequisite_activityId_idx" ON "ActivityPrerequisite"("activityId");

-- Add new fields to Activity table
ALTER TABLE "Activity" ADD COLUMN IF NOT EXISTS "hasMultipleSessions" BOOLEAN DEFAULT false;
ALTER TABLE "Activity" ADD COLUMN IF NOT EXISTS "sessionCount" INTEGER DEFAULT 0;
ALTER TABLE "Activity" ADD COLUMN IF NOT EXISTS "hasPrerequisites" BOOLEAN DEFAULT false;
```

## Option 2: Using gcloud SQL proxy locally

1. Install Cloud SQL Proxy:
```bash
curl -o cloud_sql_proxy https://dl.google.com/cloudsql/cloud_sql_proxy.darwin.amd64
chmod +x cloud_sql_proxy
```

2. Start the proxy:
```bash
./cloud_sql_proxy -instances=kids-activity-tracker-2024:us-central1:kidsactivity=tcp:5433
```

3. In another terminal, run:
```bash
psql "postgresql://postgres:KidsTracker2024!@localhost:5433/kidsactivity" -f migration.sql
```

## Option 3: Deploy and run the detailed scraper

The new detailed scraper will work with the existing schema and store enhanced data in JSON fields until the migration is complete.

1. Deploy the scraper:
```bash
cd /Users/mike/Development/KidsActivityTracker/backend
gcloud builds submit --config cloudbuild-scraper.yaml
```

2. Run the scraper manually:
```bash
gcloud run jobs execute scraper-detailed-job --region=us-central1 --wait
```

## Next Steps After Migration

1. Verify tables were created:
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('ActivitySession', 'ActivityPrerequisite');
```

2. Run the detailed scraper to populate the new tables
3. Update the frontend to display the enhanced data