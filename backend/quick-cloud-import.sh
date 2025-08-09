#!/bin/bash

echo "📦 Quick Import to Google Cloud SQL"
echo "==================================="

# Configuration
CLOUD_INSTANCE="elevated-pod-459203-n5:us-central1:kids-activity-db-prod"
LOCAL_DB="kids_activity_tracker"
CLOUD_DB="kidsactivity"

echo "📊 Exporting activities from local database..."
pg_dump -h localhost -U mike -d $LOCAL_DB \
  --data-only \
  --table='"Provider"' \
  --table='"Location"' \
  --table='"Activity"' \
  --table='"_prisma_migrations"' \
  -f local_activities.sql

echo ""
echo "☁️  Importing to Cloud SQL..."
echo "This will prompt for the cloud database password."
echo "Getting password from Secret Manager..."

# Get password from Secret Manager
DB_PASSWORD=$(gcloud secrets versions access latest --secret=database-password 2>/dev/null)

if [ -z "$DB_PASSWORD" ]; then
    echo "⚠️  Could not get password from Secret Manager"
    echo "Please enter the database password manually:"
    read -s DB_PASSWORD
fi

# Use Cloud SQL public IP directly
CLOUD_SQL_IP="34.41.77.43"

echo ""
echo "📥 Importing data to Cloud SQL..."
PGPASSWORD="$DB_PASSWORD" psql -h $CLOUD_SQL_IP -U appuser -d $CLOUD_DB < local_activities.sql

# Clean up
rm local_activities.sql

echo ""
echo "✅ Import complete!"
echo ""
echo "📊 Verifying data in cloud..."
curl -s "https://kids-activity-api-44042034457.us-central1.run.app/api/v1/activities?limit=5" | jq '.activities | length'

echo ""
echo "🎯 Your app is now configured to use:"
echo "API URL: https://kids-activity-api-44042034457.us-central1.run.app"
echo ""
echo "📱 Reload your mobile app to see the activities!"