#!/bin/bash

# Create deployment package for enhanced scraper

echo "Creating deployment package..."

# Create package directory
PACKAGE_DIR="enhanced-scraper-package"
rm -rf $PACKAGE_DIR
mkdir -p $PACKAGE_DIR/{scrapers,scripts,prisma/migrations,src/services}

# Copy files
cp scrapers/nvrcEnhancedDetailScraper.js $PACKAGE_DIR/scrapers/
cp import-enhanced-activities.js $PACKAGE_DIR/
cp scripts/run-enhanced-scraper.sh $PACKAGE_DIR/scripts/
cp scripts/setup-scraper-cron.sh $PACKAGE_DIR/scripts/
cp prisma/schema.prisma $PACKAGE_DIR/prisma/
cp src/services/activityService.enhanced.updated.ts $PACKAGE_DIR/src/services/activityService.enhanced.ts

# Create migration file
cat > $PACKAGE_DIR/prisma/migrations/migration.sql << 'EOF'
-- Add new fields to Activity table for enhanced details
ALTER TABLE "Activity" 
ADD COLUMN IF NOT EXISTS "registrationStatus" TEXT DEFAULT 'Unknown',
ADD COLUMN IF NOT EXISTS "registrationButtonText" TEXT,
ADD COLUMN IF NOT EXISTS "detailUrl" TEXT,
ADD COLUMN IF NOT EXISTS "fullDescription" TEXT,
ADD COLUMN IF NOT EXISTS "instructor" TEXT,
ADD COLUMN IF NOT EXISTS "prerequisites" TEXT,
ADD COLUMN IF NOT EXISTS "whatToBring" TEXT,
ADD COLUMN IF NOT EXISTS "fullAddress" TEXT,
ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "directRegistrationUrl" TEXT,
ADD COLUMN IF NOT EXISTS "contactInfo" TEXT;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS "Activity_registrationStatus_idx" ON "Activity"("registrationStatus");
CREATE INDEX IF NOT EXISTS "Activity_latitude_longitude_idx" ON "Activity"("latitude", "longitude");
EOF

# Create install script
cat > $PACKAGE_DIR/install.sh << 'EOF'
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
EOF

chmod +x $PACKAGE_DIR/install.sh

# Create archive
tar -czf enhanced-scraper-package.tar.gz $PACKAGE_DIR/

echo "✅ Package created: enhanced-scraper-package.tar.gz"
echo ""
echo "To deploy:"
echo "1. scp enhanced-scraper-package.tar.gz ubuntu@54.213.98.235:/tmp/"
echo "2. ssh ubuntu@54.213.98.235"
echo "3. cd /tmp && tar -xzf enhanced-scraper-package.tar.gz"
echo "4. cd enhanced-scraper-package && ./install.sh"