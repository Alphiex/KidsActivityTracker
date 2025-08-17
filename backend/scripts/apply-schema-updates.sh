#!/bin/bash

# Apply Schema Updates Script
# This script applies the necessary schema updates to make the API work

set -e

echo "========================================="
echo "Kids Activity Tracker Schema Update"
echo "========================================="

# Check if we're in the backend directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Must run from backend directory"
    exit 1
fi

# Check if database URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ Error: DATABASE_URL not set"
    echo "Please set DATABASE_URL environment variable"
    echo "Example: export DATABASE_URL=\"postgresql://user:pass@host:port/dbname\""
    exit 1
fi

# Extract database connection details
DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:/]*\).*/\1/p')
DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')
DB_USER=$(echo $DATABASE_URL | sed -n 's/.*\/\/\([^:]*\):.*/\1/p')
DB_PASS=$(echo $DATABASE_URL | sed -n 's/.*\/\/[^:]*:\([^@]*\)@.*/\1/p')

echo "📊 Database: $DB_NAME"
echo "🏠 Host: $DB_HOST"
echo ""

# Function to run SQL file
run_sql() {
    local sql_file=$1
    local description=$2
    
    echo "🔄 $description..."
    
    if [ -f "$sql_file" ]; then
        PGPASSWORD=$DB_PASS psql -h $DB_HOST -p ${DB_PORT:-5432} -U $DB_USER -d $DB_NAME -f "$sql_file" -v ON_ERROR_STOP=1
        
        if [ $? -eq 0 ]; then
            echo "✅ $description completed"
        else
            echo "❌ $description failed"
            exit 1
        fi
    else
        echo "❌ File not found: $sql_file"
        exit 1
    fi
    echo ""
}

# Step 1: Check current schema
echo "Step 1: Checking Current Schema"
echo "--------------------------------"
run_sql "scripts/check-schema.sql" "Schema check"

# Step 2: Apply comprehensive updates
echo "Step 2: Applying Schema Updates"
echo "--------------------------------"
run_sql "scripts/update-schema-comprehensive.sql" "Schema update"

# Step 3: Regenerate Prisma client
echo "Step 3: Regenerating Prisma Client"
echo "-----------------------------------"
npx prisma db pull
npx prisma generate

echo ""
echo "✅ Schema updates completed successfully!"
echo ""
echo "Summary:"
echo "- Added ScrapeJob table for API compatibility"
echo "- Created necessary indexes and constraints"
echo "- Migrated any existing ScraperRun data"
echo "- Updated Prisma schema and client"
echo ""
echo "Next steps:"
echo "1. Restart the API service to use updated schema"
echo "2. Run the scraper manually or wait for cron job"
echo ""