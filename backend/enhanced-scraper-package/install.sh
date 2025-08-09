#!/bin/bash

echo "Installing Enhanced Scraper..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "Error: Must run from backend directory"
    exit 1
fi

# Backup existing files
echo "Backing up existing files..."
[ -f "prisma/schema.prisma" ] && cp prisma/schema.prisma prisma/schema.prisma.backup-$(date +%Y%m%d-%H%M%S)
[ -f "src/services/activityService.enhanced.ts" ] && cp src/services/activityService.enhanced.ts src/services/activityService.enhanced.ts.backup

# Copy files
echo "Copying enhanced scraper files..."
cp -r scrapers/* ../scrapers/
cp import-enhanced-activities.js ../
cp -r scripts/* ../scripts/
cp prisma/schema.prisma ../prisma/
cp src/services/activityService.enhanced.ts ../src/services/

# Create migration
echo "Creating migration..."
MIGRATION_NAME="20250809$(date +%H%M%S)_add_activity_details"
mkdir -p ../prisma/migrations/$MIGRATION_NAME
cp prisma/migrations/migration.sql ../prisma/migrations/$MIGRATION_NAME/

# Make scripts executable
chmod +x ../scripts/run-enhanced-scraper.sh
chmod +x ../scripts/setup-scraper-cron.sh

# Create directories
mkdir -p ../logs ../data/archive

echo "✅ Files installed. Next steps:"
echo "1. Run: npm install"
echo "2. Run: npx prisma migrate deploy"
echo "3. Run: npx prisma generate"
echo "4. Run: pm2 restart kids-backend"
echo "5. Run: ./scripts/run-enhanced-scraper.sh"
