#!/bin/bash

echo "🚀 Migrating Data to Google Cloud SQL"
echo "===================================="

# Check if running locally
if [ -z "$CLOUD_SQL_CONNECTION_NAME" ]; then
    echo "⚠️  Running locally. Setting up Cloud SQL proxy..."
    
    # Get Cloud SQL connection info
    INSTANCE_CONNECTION_NAME="elevated-pod-459203-n5:us-central1:kids-activity-db-prod"
    
    # Check if cloud_sql_proxy is installed
    if ! command -v cloud_sql_proxy &> /dev/null; then
        echo "📦 Installing Cloud SQL Proxy..."
        curl -o cloud_sql_proxy https://dl.google.com/cloudsql/cloud_sql_proxy.darwin.amd64
        chmod +x cloud_sql_proxy
        sudo mv cloud_sql_proxy /usr/local/bin/
    fi
    
    # Start Cloud SQL proxy in background
    echo "🔄 Starting Cloud SQL Proxy..."
    cloud_sql_proxy -instances=$INSTANCE_CONNECTION_NAME=tcp:5433 &
    PROXY_PID=$!
    sleep 5
    
    # Set connection string for proxy
    export DATABASE_URL="postgresql://appuser:$(gcloud secrets versions access latest --secret=database-password)@localhost:5433/kidsactivity?schema=public"
else
    echo "☁️  Running on Cloud Run - using direct connection"
fi

echo ""
echo "📊 Running database migrations..."
npx prisma migrate deploy

echo ""
echo "🔄 Option 1: Trigger fresh scraping job"
echo "This will scrape all activities from NVRC (takes ~3-5 minutes)"
read -p "Do you want to trigger a fresh scrape? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🕷️ Triggering scraper..."
    curl -X POST https://kids-activity-api-44042034457.us-central1.run.app/api/v1/scraper/trigger \
        -H "Content-Type: application/json" \
        -d '{"provider": "NVRC"}'
    echo ""
    echo "✅ Scraper triggered! Check status at:"
    echo "https://kids-activity-api-44042034457.us-central1.run.app/api/v1/scraper/jobs"
fi

echo ""
echo "🔄 Option 2: Copy from local database"
echo "This will export local data and import to Cloud SQL"
read -p "Do you want to copy from local database? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "📦 Exporting local data..."
    
    # Export from local database
    LOCAL_DATABASE_URL="postgresql://mike@localhost:5432/kids_activity_tracker?schema=public"
    
    # Use pg_dump to export data
    PGPASSWORD="" pg_dump -h localhost -p 5432 -U mike -d kids_activity_tracker \
        --data-only \
        --exclude-table="_prisma_migrations" \
        > local_data.sql
    
    echo "📥 Importing to Cloud SQL..."
    # Import to Cloud SQL via proxy
    PGPASSWORD="$(gcloud secrets versions access latest --secret=database-password)" \
        psql -h localhost -p 5433 -U appuser -d kidsactivity < local_data.sql
    
    rm local_data.sql
    echo "✅ Data migration complete!"
fi

# Clean up proxy if we started it
if [ ! -z "$PROXY_PID" ]; then
    echo ""
    echo "🛑 Stopping Cloud SQL Proxy..."
    kill $PROXY_PID
fi

echo ""
echo "📊 Checking activity count in cloud database..."
curl -s "https://kids-activity-api-44042034457.us-central1.run.app/api/v1/activities/stats/summary" | jq .

echo ""
echo "✅ Migration complete!"
echo ""
echo "🎯 Next steps:"
echo "1. Reload your mobile app"
echo "2. The app should now show activities from the cloud database"
echo "3. Monitor logs: gcloud run logs tail kids-activity-api --region=us-central1"