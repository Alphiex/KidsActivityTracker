#!/bin/bash

echo "📦 Direct Import to Google Cloud SQL"
echo "==================================="

# Configuration
DB_PASSWORD="mT75DbWwkFxqQUrAgAFq9f7mFX2VpjfcKKaOyH2YcEQ="
CLOUD_HOST="34.41.77.43"

echo "📊 Exporting all activities from local database..."

# Export activities directly from local
pg_dump -h localhost -U mike -d kids_activity_tracker \
  --data-only \
  --table='"Activity"' \
  -f activities_dump.sql

echo "📝 Preparing import..."
# Replace local provider ID with cloud provider ID
sed -i '' 's/90a665a9-21a6-4cc3-a0d0-f42e17d913aa/9fa36c70-eed4-4ff5-9566-bbd9842c848a/g' activities_dump.sql

echo ""
echo "📥 Importing activities to Cloud SQL..."
PGPASSWORD="$DB_PASSWORD" psql -h $CLOUD_HOST -U appuser -d kidsactivity < activities_dump.sql 2>&1 | grep -E "(INSERT|ERROR|COPY)" | head -20

# Get count
echo ""
echo "📊 Checking activity count..."
PGPASSWORD="$DB_PASSWORD" psql -h $CLOUD_HOST -U appuser -d kidsactivity -c "SELECT COUNT(*) as total FROM \"Activity\";"

# Clean up
rm activities_dump.sql

echo ""
echo "⏳ Restarting API to ensure connection pool is fresh..."
gcloud run services update kids-activity-api \
    --region=us-central1 \
    --cpu=1 \
    --memory=1Gi \
    --concurrency=100 \
    --max-instances=10

echo ""
echo "⏳ Waiting for service to restart..."
sleep 20

echo ""
echo "📊 Testing API..."
echo "Health check:"
curl -s "https://kids-activity-api-205843686007.us-central1.run.app/health" | jq .

echo ""
echo "Activities endpoint:"
curl -s "https://kids-activity-api-205843686007.us-central1.run.app/api/v1/activities?limit=3" | jq '.activities[] | {name, category, cost}'

echo ""
echo "✅ Your app should now be able to access activities!"
echo "API URL: https://kids-activity-api-205843686007.us-central1.run.app"