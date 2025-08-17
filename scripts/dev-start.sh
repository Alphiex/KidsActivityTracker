#!/bin/bash

# Start development environment
echo "🚀 Starting Kids Activity Tracker development environment..."

# Set project
gcloud config set project kids-activity-tracker 2>/dev/null

# Start Cloud SQL
echo "Starting Cloud SQL instance..."
gcloud sql instances patch kids-activity-db-dev --activation-policy=ALWAYS

# Get status
STATUS=$(gcloud sql instances describe kids-activity-db-dev --format="value(state)")
echo "✅ Cloud SQL status: $STATUS"

# Check Redis
echo ""
echo "Checking Redis instance..."
REDIS_STATUS=$(gcloud redis instances describe kids-activity-redis-dev --region=us-central1 --format="value(state)" 2>/dev/null || echo "NOT_FOUND")

if [ "$REDIS_STATUS" = "NOT_FOUND" ]; then
    echo "⚠️  Redis instance not found. Create it with:"
    echo "   gcloud redis instances create kids-activity-redis-dev --size=1 --region=us-central1 --redis-version=redis_7_0 --tier=basic"
else
    echo "✅ Redis status: $REDIS_STATUS"
fi

# Show service URL
echo ""
echo "📡 API Service URL:"
gcloud run services describe kids-activity-api --region=us-central1 --format="value(status.url)" 2>/dev/null || echo "Service not deployed yet"

echo ""
echo "🏁 Development environment ready!"
echo "💰 Remember to run ./scripts/dev-stop.sh when done to minimize costs"