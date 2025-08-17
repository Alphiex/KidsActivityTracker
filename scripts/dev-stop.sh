#!/bin/bash

# Stop development environment to minimize costs
echo "🛑 Stopping Kids Activity Tracker development environment..."

# Set project
gcloud config set project kids-activity-tracker 2>/dev/null

# Stop Cloud SQL
echo "Stopping Cloud SQL instance to save costs..."
gcloud sql instances patch kids-activity-db-dev --activation-policy=NEVER

# Get status
STATUS=$(gcloud sql instances describe kids-activity-db-dev --format="value(state)")
echo "✅ Cloud SQL status: $STATUS"

# Show cost savings
echo ""
echo "💰 Cost Savings:"
echo "   - Cloud SQL: Saving ~$7/month while stopped"
echo "   - Cloud Run: Already scales to 0 when not in use"
echo ""
echo "💡 Tip: To save additional $35/month, delete Redis with:"
echo "   gcloud redis instances delete kids-activity-redis-dev --region=us-central1 --quiet"
echo ""
echo "✅ Development environment stopped - costs minimized!"