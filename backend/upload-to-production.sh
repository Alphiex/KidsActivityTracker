#!/bin/bash

# Set the DATABASE_URL to production
export DATABASE_URL="$PRODUCTION_DATABASE_URL"

# Run the upload script
echo "🚀 Uploading 1700 activities to production database..."
node upload-scraped-data.js