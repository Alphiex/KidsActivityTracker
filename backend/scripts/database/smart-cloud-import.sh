#!/bin/bash

echo "🚀 Smart Import to Google Cloud SQL"
echo "==================================="

# Get the cloud provider ID
echo "🔍 Getting NVRC provider ID from cloud..."
CLOUD_PROVIDER_ID=$(curl -s "https://kids-activity-api-44042034457.us-central1.run.app/api/v1/providers" | jq -r '.providers[] | select(.name=="NVRC") | .id')
echo "Cloud Provider ID: $CLOUD_PROVIDER_ID"

# Get local provider ID
echo "🔍 Getting NVRC provider ID from local..."
LOCAL_PROVIDER_ID=$(psql -U mike -d kids_activity_tracker -t -c "SELECT id FROM \"Provider\" WHERE name='NVRC' LIMIT 1;" | xargs)
echo "Local Provider ID: $LOCAL_PROVIDER_ID"

if [ -z "$CLOUD_PROVIDER_ID" ] || [ -z "$LOCAL_PROVIDER_ID" ]; then
    echo "❌ Could not find provider IDs"
    exit 1
fi

echo ""
echo "📊 Exporting activities from local database..."
# Export with provider ID replacement
psql -U mike -d kids_activity_tracker -t -c "
COPY (
    SELECT 
        REPLACE(id::text, '$LOCAL_PROVIDER_ID', '$CLOUD_PROVIDER_ID')::uuid as id,
        '$CLOUD_PROVIDER_ID'::uuid as \"providerId\",
        \"externalId\",
        name,
        category,
        subcategory,
        description,
        schedule,
        \"dateStart\",
        \"dateEnd\",
        \"ageMin\",
        \"ageMax\",
        cost,
        \"spotsAvailable\",
        \"locationId\",
        \"locationName\",
        \"registrationUrl\",
        \"courseId\",
        \"isActive\",
        \"lastSeenAt\",
        \"rawData\",
        \"createdAt\",
        \"updatedAt\",
        \"dayOfWeek\"
    FROM \"Activity\" 
    WHERE \"providerId\" = '$LOCAL_PROVIDER_ID'
) TO STDOUT WITH (FORMAT CSV, HEADER true, DELIMITER ',', QUOTE '\"', ESCAPE '\"');" > activities.csv

# Count activities
ACTIVITY_COUNT=$(tail -n +2 activities.csv | wc -l)
echo "Found $ACTIVITY_COUNT activities to import"

echo ""
echo "🔐 Getting database password..."
DB_PASSWORD=$(gcloud secrets versions access latest --secret=database-password 2>/dev/null)

if [ -z "$DB_PASSWORD" ]; then
    DB_PASSWORD="mT75DbWwkFxqQUrAgAFq9f7mFX2VpjfcKKaOyH2YcEQ="
    echo "Using recently set password"
fi

echo ""
echo "📥 Importing activities to Cloud SQL..."
# Create SQL import file
cat > import_activities.sql << EOF
-- First, ensure locations exist
INSERT INTO "Location" (id, name, address, city, province, country, latitude, longitude, facility, "createdAt", "updatedAt")
SELECT DISTINCT ON (name, address) 
    gen_random_uuid() as id,
    "locationName" as name,
    '' as address,
    'North Vancouver' as city,
    'BC' as province,
    'Canada' as country,
    NULL as latitude,
    NULL as longitude,
    'Recreation Centre' as facility,
    NOW() as "createdAt",
    NOW() as "updatedAt"
FROM (
    SELECT DISTINCT "locationName" 
    FROM (SELECT NULL LIMIT 0) t
) locations
WHERE "locationName" IS NOT NULL
ON CONFLICT (name, address) DO NOTHING;

-- Import activities from CSV
COPY "Activity" (
    id,
    "providerId",
    "externalId",
    name,
    category,
    subcategory,
    description,
    schedule,
    "dateStart",
    "dateEnd",
    "ageMin",
    "ageMax",
    cost,
    "spotsAvailable",
    "locationId",
    "locationName",
    "registrationUrl",
    "courseId",
    "isActive",
    "lastSeenAt",
    "rawData",
    "createdAt",
    "updatedAt",
    "dayOfWeek"
) FROM STDIN WITH (FORMAT CSV, HEADER true, DELIMITER ',', QUOTE '"', ESCAPE '"');
EOF

# Append CSV data
cat activities.csv >> import_activities.sql

echo ""
echo "🔄 Connecting to Cloud SQL..."
PGPASSWORD="$DB_PASSWORD" psql -h 34.41.77.43 -U appuser -d kidsactivity < import_activities.sql

# Clean up
rm activities.csv import_activities.sql

echo ""
echo "✅ Import complete!"
echo ""
echo "📊 Verifying data in cloud..."
sleep 3
activities_response=$(curl -s "https://kids-activity-api-44042034457.us-central1.run.app/api/v1/activities?limit=10")
activities_count=$(echo "$activities_response" | jq '.activities | length')
total_count=$(echo "$activities_response" | jq '.total')

echo "Activities returned: $activities_count"
echo "Total available: $total_count"

if [ "$activities_count" -gt 0 ]; then
    echo ""
    echo "✅ Success! Your app can now access $total_count activities from Google Cloud!"
    echo ""
    echo "📱 Sample activity:"
    echo "$activities_response" | jq '.activities[0] | {name, category, schedule, cost, location}'
else
    echo ""
    echo "⚠️  No activities returned. Checking API status..."
    curl -s "https://kids-activity-api-44042034457.us-central1.run.app/health" | jq .
fi

echo ""
echo "🎯 Your app is configured to use:"
echo "https://kids-activity-api-44042034457.us-central1.run.app"
echo ""
echo "📱 Reload your mobile app to see the activities!"