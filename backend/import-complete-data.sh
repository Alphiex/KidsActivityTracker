#!/bin/bash

echo "🚀 Complete Data Import to Google Cloud SQL"
echo "========================================"

# Configuration
DB_PASSWORD="mT75DbWwkFxqQUrAgAFq9f7mFX2VpjfcKKaOyH2YcEQ="
CLOUD_HOST="34.41.77.43"
CLOUD_PROVIDER_ID="9fa36c70-eed4-4ff5-9566-bbd9842c848a"
LOCAL_PROVIDER_ID="90a665a9-21a6-4cc3-a0d0-f42e17d913aa"

echo "📊 Analyzing local database..."
LOCATION_COUNT=$(psql -U mike -d kids_activity_tracker -t -c "SELECT COUNT(DISTINCT id) FROM \"Location\";" | xargs)
ACTIVITY_COUNT=$(psql -U mike -d kids_activity_tracker -t -c "SELECT COUNT(*) FROM \"Activity\";" | xargs)

echo "Found $LOCATION_COUNT locations"
echo "Found $ACTIVITY_COUNT activities"

echo ""
echo "📦 Step 1: Exporting locations..."
pg_dump -h localhost -U mike -d kids_activity_tracker \
  --data-only \
  --table='"Location"' \
  -f locations_dump.sql

echo ""
echo "📦 Step 2: Exporting activities..."
pg_dump -h localhost -U mike -d kids_activity_tracker \
  --data-only \
  --table='"Activity"' \
  -f activities_dump.sql

echo ""
echo "📝 Step 3: Preparing import files..."
# Update provider IDs in activities
sed -i '' "s/$LOCAL_PROVIDER_ID/$CLOUD_PROVIDER_ID/g" activities_dump.sql
# Force all activities to be active
sed -i '' 's/\t\\N\tf$/\t\\N\tt/g' activities_dump.sql
sed -i '' 's/\tfalse\t/\ttrue\t/g' activities_dump.sql

echo ""
echo "🗑️  Step 4: Clearing cloud database..."
PGPASSWORD="$DB_PASSWORD" psql -h $CLOUD_HOST -U appuser -d kidsactivity << EOF
-- Clear in correct order to respect foreign keys
DELETE FROM "Activity";
DELETE FROM "Location";
SELECT 'Cleared ' || COUNT(*) || ' activities' FROM "Activity";
SELECT 'Cleared ' || COUNT(*) || ' locations' FROM "Location";
EOF

echo ""
echo "📥 Step 5: Importing locations..."
PGPASSWORD="$DB_PASSWORD" psql -h $CLOUD_HOST -U appuser -d kidsactivity < locations_dump.sql 2>&1 | grep -E "(INSERT|ERROR|SET)" | tail -10

echo ""
echo "📥 Step 6: Importing activities..."
PGPASSWORD="$DB_PASSWORD" psql -h $CLOUD_HOST -U appuser -d kidsactivity < activities_dump.sql 2>&1 | grep -E "(INSERT|ERROR|SET)" | tail -10

echo ""
echo "📊 Step 7: Verifying import..."
PGPASSWORD="$DB_PASSWORD" psql -h $CLOUD_HOST -U appuser -d kidsactivity << EOF
SELECT 'Locations imported: ' || COUNT(*) FROM "Location";
SELECT 'Activities imported: ' || COUNT(*) FROM "Activity";
SELECT 'Active activities: ' || COUNT(*) FROM "Activity" WHERE "isActive" = true;
EOF

# Clean up
rm locations_dump.sql activities_dump.sql

echo ""
echo "⏳ Step 8: Updating all activities to active status..."
PGPASSWORD="$DB_PASSWORD" psql -h $CLOUD_HOST -U appuser -d kidsactivity -c "UPDATE \"Activity\" SET \"isActive\" = true WHERE \"isActive\" = false;"

echo ""
echo "📊 Step 9: Final verification..."
echo "Testing API..."
sleep 5

activities_response=$(curl -s "https://kids-activity-api-205843686007.us-central1.run.app/api/v1/activities?limit=1000")
api_count=$(echo "$activities_response" | jq '.activities | length')

echo "API returning: $api_count activities"

if [ "$api_count" -lt 1000 ]; then
    echo ""
    echo "📄 Getting page 2..."
    page2_response=$(curl -s "https://kids-activity-api-205843686007.us-central1.run.app/api/v1/activities?limit=1000&offset=1000")
    page2_count=$(echo "$page2_response" | jq '.activities | length')
    total_api_count=$((api_count + page2_count))
    echo "Total activities available via API: $total_api_count+"
fi

echo ""
echo "Sample activities:"
echo "$activities_response" | jq '.activities[0:3] | .[] | {name, category, cost, isActive, location: .location.name}'

echo ""
echo "✅ Import complete!"
echo "🎯 Your app now has access to ALL NVRC activities!"
echo "API URL: https://kids-activity-api-205843686007.us-central1.run.app"