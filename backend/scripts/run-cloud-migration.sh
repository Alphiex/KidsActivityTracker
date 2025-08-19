#!/bin/bash

echo "🔄 Running database migration for sessions and prerequisites..."

# Run migration via Cloud SQL proxy
gcloud run jobs execute run-migration \
  --region=us-central1 \
  --wait \
  --command="node scripts/run-sessions-migration.js"

echo "✅ Migration completed"