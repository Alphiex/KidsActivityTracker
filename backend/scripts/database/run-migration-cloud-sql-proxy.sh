#!/bin/bash

echo "🔄 Setting up Cloud SQL Proxy for migration..."

# Check if cloud_sql_proxy is installed
if ! command -v cloud_sql_proxy &> /dev/null; then
    echo "📦 Installing Cloud SQL Proxy..."
    curl -o cloud_sql_proxy https://dl.google.com/cloudsql/cloud_sql_proxy.darwin.amd64
    chmod +x cloud_sql_proxy
    PROXY_PATH="./cloud_sql_proxy"
else
    PROXY_PATH="cloud_sql_proxy"
fi

# Start Cloud SQL Proxy in background
echo "🔄 Starting Cloud SQL Proxy..."
$PROXY_PATH -instances=kids-activity-tracker-2024:us-central1:kidsactivity=tcp:5433 &
PROXY_PID=$!

# Wait for proxy to be ready
sleep 5

# Run migration using local connection
echo "🔄 Running migration through proxy..."
DATABASE_URL="postgresql://postgres:KidsTracker2024!@localhost:5433/kidsactivity" npx prisma migrate deploy

# Kill the proxy
echo "🔄 Stopping Cloud SQL Proxy..."
kill $PROXY_PID

echo "✅ Migration completed!"