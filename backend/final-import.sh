#!/bin/bash

echo "🚀 Final Import to Google Cloud SQL"
echo "==================================="

# Configuration
CLOUD_PROVIDER_ID="9fa36c70-eed4-4ff5-9566-bbd9842c848a"
LOCAL_PROVIDER_ID="90a665a9-21a6-4cc3-a0d0-f42e17d913aa"
DB_PASSWORD="mT75DbWwkFxqQUrAgAFq9f7mFX2VpjfcKKaOyH2YcEQ="
CLOUD_HOST="34.41.77.43"

echo "📊 Exporting activities from local database..."
echo "Provider mapping: $LOCAL_PROVIDER_ID -> $CLOUD_PROVIDER_ID"

# First export locations
echo "Exporting locations..."
psql -U mike -d kids_activity_tracker -c "\
COPY (
    SELECT DISTINCT ON (name) 
        gen_random_uuid() as id,
        name,
        COALESCE(address, '') as address,
        COALESCE(city, 'North Vancouver') as city,
        COALESCE(province, 'BC') as province,
        COALESCE(country, 'Canada') as country,
        latitude,
        longitude,
        COALESCE(facility, 'Recreation Centre') as facility,
        NOW() as \"createdAt\",
        NOW() as \"updatedAt\"
    FROM \"Location\"
    WHERE name IS NOT NULL
) TO STDOUT WITH CSV HEADER;" > locations.csv

# Export activities with corrected provider ID
echo "Exporting activities..."
psql -U mike -d kids_activity_tracker -c "\
COPY (
    SELECT 
        gen_random_uuid() as id,
        '$CLOUD_PROVIDER_ID'::uuid as \"providerId\",
        \"externalId\",
        name,
        COALESCE(category, 'General') as category,
        subcategory,
        description,
        schedule,
        \"dateStart\",
        \"dateEnd\",
        \"ageMin\",
        \"ageMax\",
        cost,
        \"spotsAvailable\",
        NULL as \"locationId\",
        \"locationName\",
        \"registrationUrl\",
        \"courseId\",
        \"isActive\",
        \"lastSeenAt\",
        \"rawData\",
        NOW() as \"createdAt\",
        NOW() as \"updatedAt\",
        \"dayOfWeek\"
    FROM \"Activity\" 
    WHERE \"providerId\" = '$LOCAL_PROVIDER_ID'
    AND name IS NOT NULL
) TO STDOUT WITH CSV HEADER;" > activities.csv

LOCATION_COUNT=$(tail -n +2 locations.csv | wc -l)
ACTIVITY_COUNT=$(tail -n +2 activities.csv | wc -l)
echo "Found $LOCATION_COUNT locations and $ACTIVITY_COUNT activities"

echo ""
echo "📥 Importing to Cloud SQL..."

# Import locations first
echo "Importing locations..."
PGPASSWORD="$DB_PASSWORD" psql -h $CLOUD_HOST -U appuser -d kidsactivity << EOF
-- Import locations
CREATE TEMP TABLE temp_locations (LIKE "Location" INCLUDING ALL);
\COPY temp_locations FROM 'locations.csv' WITH CSV HEADER;

INSERT INTO "Location" 
SELECT * FROM temp_locations
ON CONFLICT (name, address) DO UPDATE SET
    city = EXCLUDED.city,
    province = EXCLUDED.province,
    "updatedAt" = NOW();

DROP TABLE temp_locations;
EOF

# Import activities
echo "Importing activities..."
PGPASSWORD="$DB_PASSWORD" psql -h $CLOUD_HOST -U appuser -d kidsactivity << EOF
-- Import activities
CREATE TEMP TABLE temp_activities (LIKE "Activity" INCLUDING ALL);
\COPY temp_activities FROM 'activities.csv' WITH CSV HEADER;

-- Update location IDs
UPDATE temp_activities ta
SET "locationId" = l.id
FROM "Location" l
WHERE ta."locationName" = l.name
AND ta."locationName" IS NOT NULL;

-- Insert activities
INSERT INTO "Activity" 
SELECT * FROM temp_activities
ON CONFLICT DO NOTHING;

DROP TABLE temp_activities;

-- Report results
SELECT COUNT(*) as total_activities FROM "Activity";
EOF

# Clean up
rm locations.csv activities.csv

echo ""
echo "✅ Import complete!"
echo ""
echo "⏳ Waiting for API to pick up changes..."
sleep 15

echo ""
echo "📊 Verifying data through API..."
activities_response=$(curl -s "https://kids-activity-api-44042034457.us-central1.run.app/api/v1/activities?limit=5")
echo "$activities_response" | jq '.'

echo ""
echo "🎯 Your app is now connected to Google Cloud!"
echo "API URL: https://kids-activity-api-44042034457.us-central1.run.app"
echo ""
echo "📱 Reload your mobile app to see the activities!"