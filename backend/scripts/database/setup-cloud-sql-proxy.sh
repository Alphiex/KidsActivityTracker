#!/bin/bash

echo "🔧 Setting up Cloud SQL Proxy for data import"
echo "============================================="

INSTANCE_CONNECTION_NAME="elevated-pod-459203-n5:us-central1:kids-activity-db-prod"

# Check if cloud_sql_proxy is installed
if ! command -v cloud-sql-proxy &> /dev/null; then
    echo "📦 Installing Cloud SQL Proxy..."
    
    # Detect OS
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.11.4/cloud-sql-proxy.darwin.amd64
    else
        # Linux
        curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.11.4/cloud-sql-proxy.linux.amd64
    fi
    
    chmod +x cloud-sql-proxy
    sudo mv cloud-sql-proxy /usr/local/bin/
fi

echo ""
echo "🚀 Starting Cloud SQL Proxy..."
echo "This will allow secure connection to Cloud SQL without exposing it to the internet"
echo ""

# Start proxy in background
cloud-sql-proxy --port=5433 $INSTANCE_CONNECTION_NAME &
PROXY_PID=$!

echo "Proxy PID: $PROXY_PID"
echo "Waiting for proxy to start..."
sleep 5

echo ""
echo "✅ Cloud SQL Proxy started on port 5433"
echo ""
echo "📊 Now you can connect to Cloud SQL locally:"
echo "psql -h localhost -p 5433 -U appuser -d kidsactivity"
echo ""
echo "🔑 To get the database password:"
echo "gcloud sql users list --instance=kids-activity-db-prod"
echo ""
echo "Or reset the password:"
echo "gcloud sql users set-password appuser --instance=kids-activity-db-prod"
echo ""
echo "🛑 To stop the proxy when done:"
echo "kill $PROXY_PID"
echo ""
echo "📦 To import data through the proxy:"
echo "PGPASSWORD=yourpassword psql -h localhost -p 5433 -U appuser -d kidsactivity < your_data.sql"