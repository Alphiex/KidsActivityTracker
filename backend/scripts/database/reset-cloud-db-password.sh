#!/bin/bash

echo "🔐 Resetting Cloud SQL Database Password"
echo "========================================"

INSTANCE_NAME="kids-activity-db-prod"
DB_USER="appuser"
NEW_PASSWORD=$(openssl rand -base64 32)

echo "🔄 Setting new password for user '$DB_USER'..."
gcloud sql users set-password $DB_USER \
    --instance=$INSTANCE_NAME \
    --password="$NEW_PASSWORD"

echo ""
echo "✅ Password reset complete!"
echo ""
echo "📝 New password: $NEW_PASSWORD"
echo "(Save this password securely!)"
echo ""

echo "🔄 Updating Secret Manager..."
echo -n "$NEW_PASSWORD" | gcloud secrets create database-password --data-file=- 2>/dev/null || \
echo -n "$NEW_PASSWORD" | gcloud secrets versions add database-password --data-file=-

echo ""
echo "📊 Now importing data to Cloud SQL..."
echo "Exporting from local database..."
pg_dump -h localhost -U mike -d kids_activity_tracker \
  --data-only \
  --table='"Provider"' \
  --table='"Location"' \
  --table='"Activity"' \
  -f local_activities.sql

echo ""
echo "Importing to Cloud SQL (using public IP)..."
PGPASSWORD="$NEW_PASSWORD" psql -h 34.41.77.43 -U appuser -d kidsactivity < local_activities.sql

rm local_activities.sql

echo ""
echo "✅ Import complete!"
echo ""
echo "🔄 Restarting Cloud Run service to pick up new password..."
gcloud run services update kids-activity-api \
    --region=us-central1 \
    --update-secrets=DATABASE_URL=database-url:latest

echo ""
echo "⏳ Waiting for service to restart..."
sleep 10

echo ""
echo "📊 Verifying data in cloud..."
activities_count=$(curl -s "https://kids-activity-api-205843686007.us-central1.run.app/api/v1/activities?limit=1" | jq '.activities | length')
echo "Activities in cloud: $activities_count"

if [ "$activities_count" -gt 0 ]; then
    echo ""
    echo "✅ Success! Your app can now access activities from Google Cloud!"
    echo ""
    echo "📱 The app is configured to use:"
    echo "https://kids-activity-api-205843686007.us-central1.run.app"
else
    echo ""
    echo "⚠️  No activities found. The API might need a moment to restart."
    echo "Try checking again in a minute."
fi