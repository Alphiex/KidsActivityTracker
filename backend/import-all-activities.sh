#!/bin/bash

echo "🚀 Importing ALL NVRC Activities to Google Cloud"
echo "=============================================="

# Configuration
DB_PASSWORD="mT75DbWwkFxqQUrAgAFq9f7mFX2VpjfcKKaOyH2YcEQ="
CLOUD_HOST="34.41.77.43"
CLOUD_PROVIDER_ID="9fa36c70-eed4-4ff5-9566-bbd9842c848a"

echo "📊 Counting activities in local database..."
LOCAL_COUNT=$(psql -U mike -d kids_activity_tracker -t -c "SELECT COUNT(*) FROM \"Activity\";" | xargs)
echo "Found $LOCAL_COUNT activities in local database"

echo ""
echo "📊 Current activities in cloud..."
CLOUD_COUNT=$(PGPASSWORD="$DB_PASSWORD" psql -h $CLOUD_HOST -U appuser -d kidsactivity -t -c "SELECT COUNT(*) FROM \"Activity\";" | xargs)
echo "Found $CLOUD_COUNT activities in cloud database"

echo ""
echo "📦 Exporting ALL activities from local database..."

# Export with corrected provider ID and forced active status
pg_dump -h localhost -U mike -d kids_activity_tracker \
  --data-only \
  --table='"Activity"' \
  -f activities_dump.sql

# Replace provider ID and set all activities as active
echo "📝 Preparing import file..."
sed -i '' "s/90a665a9-21a6-4cc3-a0d0-f42e17d913aa/$CLOUD_PROVIDER_ID/g" activities_dump.sql
sed -i '' "s/\tisActive\tf\t/\tisActive\tt\t/g" activities_dump.sql
sed -i '' "s/\tisActive\tfalse\t/\tisActive\ttrue\t/g" activities_dump.sql

echo ""
echo "🗑️  Clearing existing activities in cloud..."
PGPASSWORD="$DB_PASSWORD" psql -h $CLOUD_HOST -U appuser -d kidsactivity -c "DELETE FROM \"Activity\";"

echo ""
echo "📥 Importing ALL activities to Cloud SQL..."
PGPASSWORD="$DB_PASSWORD" psql -h $CLOUD_HOST -U appuser -d kidsactivity < activities_dump.sql

# Get final count
echo ""
echo "📊 Verifying import..."
FINAL_COUNT=$(PGPASSWORD="$DB_PASSWORD" psql -h $CLOUD_HOST -U appuser -d kidsactivity -t -c "SELECT COUNT(*) FROM \"Activity\";" | xargs)
ACTIVE_COUNT=$(PGPASSWORD="$DB_PASSWORD" psql -h $CLOUD_HOST -U appuser -d kidsactivity -t -c "SELECT COUNT(*) FROM \"Activity\" WHERE \"isActive\" = true;" | xargs)

echo "Total activities imported: $FINAL_COUNT"
echo "Active activities: $ACTIVE_COUNT"

# Clean up
rm activities_dump.sql

echo ""
echo "⏳ Restarting API to refresh connection pool..."
gcloud run services update kids-activity-api \
    --region=us-central1 \
    --no-traffic

echo ""
echo "⏳ Waiting for service to restart..."
sleep 20

echo ""
echo "📊 Testing API..."
echo "Health check:"
curl -s "https://kids-activity-api-205843686007.us-central1.run.app/health" | jq .

echo ""
echo "Activity count from API:"
activities_response=$(curl -s "https://kids-activity-api-205843686007.us-central1.run.app/api/v1/activities?limit=1000")
api_count=$(echo "$activities_response" | jq '.activities | length')
echo "API returning: $api_count activities"

echo ""
echo "Sample activities:"
echo "$activities_response" | jq '.activities[0:3] | .[] | {name, category, cost, isActive}'

echo ""
echo "✅ Import complete!"
echo "🎯 Your app now has access to $FINAL_COUNT NVRC activities!"
echo "API URL: https://kids-activity-api-205843686007.us-central1.run.app"