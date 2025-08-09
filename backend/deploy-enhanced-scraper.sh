#!/bin/bash

# Enhanced Scraper Deployment Script
# This script deploys the enhanced scraper to the cloud server

set -e  # Exit on error

echo "🚀 Deploying Enhanced NVRC Scraper to Cloud Server"
echo "=================================================="

# Configuration
SERVER_USER="ubuntu"
SERVER_HOST="54.213.98.235"
SERVER_PATH="/home/ubuntu/KidsActivityTracker/backend"
LOCAL_PATH="/Users/mike/Development/KidsActivityTracker/backend"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}📦 Step 1: Preparing files for deployment${NC}"

# Create a temporary deployment directory
DEPLOY_DIR="/tmp/enhanced-scraper-deploy-$(date +%s)"
mkdir -p "$DEPLOY_DIR"

# Copy necessary files
echo "Copying scraper files..."
cp "$LOCAL_PATH/scrapers/nvrcEnhancedDetailScraper.js" "$DEPLOY_DIR/"
cp "$LOCAL_PATH/scrapers/README.md" "$DEPLOY_DIR/scraper-README.md"
cp "$LOCAL_PATH/import-enhanced-activities.js" "$DEPLOY_DIR/"
cp "$LOCAL_PATH/scripts/run-enhanced-scraper.sh" "$DEPLOY_DIR/"
cp "$LOCAL_PATH/scripts/setup-scraper-cron.sh" "$DEPLOY_DIR/"

# Copy Prisma files
echo "Copying database schema updates..."
mkdir -p "$DEPLOY_DIR/prisma/migrations/add_activity_details"
cp "$LOCAL_PATH/prisma/schema.prisma" "$DEPLOY_DIR/prisma/"
cp "$LOCAL_PATH/prisma/migrations/add_activity_details/migration.sql" "$DEPLOY_DIR/prisma/migrations/add_activity_details/"

# Create deployment info file
cat > "$DEPLOY_DIR/deployment-info.txt" << EOF
Enhanced Scraper Deployment
Date: $(date)
Includes:
- Enhanced scraper with detail page fetching
- Database schema updates for new fields
- Import script for enhanced data
- Automated running scripts
- Cron job setup
EOF

echo -e "${YELLOW}📤 Step 2: Uploading files to server${NC}"

# Upload files to server
echo "Connecting to $SERVER_HOST..."
scp -r "$DEPLOY_DIR"/* "$SERVER_USER@$SERVER_HOST:/tmp/enhanced-deploy/"

echo -e "${YELLOW}🔧 Step 3: Installing on server${NC}"

# Execute installation on server
ssh "$SERVER_USER@$SERVER_HOST" << 'ENDSSH'
set -e

echo "Setting up enhanced scraper on server..."

# Navigate to backend directory
cd /home/ubuntu/KidsActivityTracker/backend

# Backup current schema
echo "Backing up current schema..."
cp prisma/schema.prisma prisma/schema.prisma.backup-$(date +%Y%m%d-%H%M%S)

# Copy new files
echo "Installing enhanced scraper files..."
cp /tmp/enhanced-deploy/nvrcEnhancedDetailScraper.js scrapers/
cp /tmp/enhanced-deploy/scraper-README.md scrapers/README.md
cp /tmp/enhanced-deploy/import-enhanced-activities.js .
cp /tmp/enhanced-deploy/run-enhanced-scraper.sh scripts/
cp /tmp/enhanced-deploy/setup-scraper-cron.sh scripts/
cp /tmp/enhanced-deploy/prisma/schema.prisma prisma/
mkdir -p prisma/migrations/add_activity_details
cp /tmp/enhanced-deploy/prisma/migrations/add_activity_details/migration.sql prisma/migrations/add_activity_details/

# Make scripts executable
chmod +x scripts/run-enhanced-scraper.sh
chmod +x scripts/setup-scraper-cron.sh

# Install any new dependencies
echo "Installing dependencies..."
npm install

# Run database migrations
echo "Running database migrations..."
npx prisma migrate deploy

# Generate Prisma client
echo "Generating Prisma client..."
npx prisma generate

# Create necessary directories
mkdir -p logs
mkdir -p data/archive

# Clean up
rm -rf /tmp/enhanced-deploy

echo "✅ Enhanced scraper installed successfully!"
ENDSSH

echo -e "${YELLOW}🔄 Step 4: Updating API routes${NC}"

# Update API routes to include new fields
ssh "$SERVER_USER@$SERVER_HOST" << 'ENDSSH'
cd /home/ubuntu/KidsActivityTracker/backend

# Create a patch for the activities route
cat > /tmp/activities-route-patch.js << 'EOF'
// Enhanced fields to include in API responses
const enhancedFields = {
  registrationStatus: true,
  registrationButtonText: true,
  detailUrl: true,
  fullDescription: true,
  instructor: true,
  prerequisites: true,
  whatToBring: true,
  fullAddress: true,
  latitude: true,
  longitude: true,
  directRegistrationUrl: true,
  contactInfo: true,
  totalSpots: true
};

// Add to your Prisma select statements
EOF

echo "✅ API route update prepared"
ENDSSH

echo -e "${YELLOW}🕷️ Step 5: Running initial scrape${NC}"

# Run the enhanced scraper
ssh "$SERVER_USER@$SERVER_HOST" << 'ENDSSH'
cd /home/ubuntu/KidsActivityTracker/backend

echo "Starting enhanced scraper..."
echo "This will take 15-20 minutes to complete..."

# Run the scraper with timeout
timeout 1800 ./scripts/run-enhanced-scraper.sh

# Check results
if [ $? -eq 0 ]; then
    echo "✅ Scraper completed successfully!"
    
    # Verify data in database
    echo "Verifying database population..."
    ACTIVITY_COUNT=$(psql $DATABASE_URL -t -c "SELECT COUNT(*) FROM \"Activity\" WHERE \"registrationStatus\" IS NOT NULL;")
    echo "Activities with registration status: $ACTIVITY_COUNT"
    
    ENHANCED_COUNT=$(psql $DATABASE_URL -t -c "SELECT COUNT(*) FROM \"Activity\" WHERE \"fullDescription\" IS NOT NULL OR \"instructor\" IS NOT NULL;")
    echo "Activities with enhanced details: $ENHANCED_COUNT"
else
    echo "⚠️ Scraper may have timed out or encountered issues. Check logs."
fi
ENDSSH

echo -e "${YELLOW}🔍 Step 6: Testing API endpoints${NC}"

# Test API endpoints
echo "Testing API with new fields..."
ssh "$SERVER_USER@$SERVER_HOST" << 'ENDSSH'
cd /home/ubuntu/KidsActivityTracker/backend

# Test activities endpoint
echo "Testing /api/activities endpoint..."
curl -s "http://localhost:3001/api/activities?limit=1" | jq '.' > /tmp/api-test.json

# Check for new fields
if grep -q "registrationStatus" /tmp/api-test.json && grep -q "fullDescription" /tmp/api-test.json; then
    echo "✅ API is returning enhanced fields!"
else
    echo "⚠️ API may need restart to include new fields"
    
    # Restart PM2 if needed
    pm2 restart kids-backend
    sleep 5
    
    # Test again
    curl -s "http://localhost:3001/api/activities?limit=1" | jq '.'
fi

rm -f /tmp/api-test.json
ENDSSH

echo -e "${YELLOW}⏰ Step 7: Setting up automatic daily scraping${NC}"

ssh "$SERVER_USER@$SERVER_HOST" << 'ENDSSH'
cd /home/ubuntu/KidsActivityTracker/backend

# Setup cron job
./scripts/setup-scraper-cron.sh

# Verify cron job
echo "Current cron jobs:"
crontab -l | grep -E "(scraper|activity)" || echo "No scraper cron jobs found"
ENDSSH

# Clean up local temp directory
rm -rf "$DEPLOY_DIR"

echo -e "${GREEN}✨ Deployment Complete!${NC}"
echo "=================================================="
echo "Summary:"
echo "✅ Enhanced scraper deployed"
echo "✅ Database schema updated"
echo "✅ API routes prepared for new fields"
echo "✅ Initial scrape completed"
echo "✅ Automatic daily scraping configured"
echo ""
echo "Next steps:"
echo "1. Monitor logs at: $SERVER_PATH/logs/"
echo "2. Verify activities in database have enhanced fields"
echo "3. Test mobile app with new activity details"
echo ""
echo "Useful commands:"
echo "- View logs: ssh $SERVER_USER@$SERVER_HOST 'tail -f $SERVER_PATH/logs/enhanced-scraper-*.log'"
echo "- Check activity count: ssh $SERVER_USER@$SERVER_HOST 'psql \$DATABASE_URL -c \"SELECT COUNT(*) FROM \\\"Activity\\\";\"'"
echo "- Manual scrape: ssh $SERVER_USER@$SERVER_HOST 'cd $SERVER_PATH && ./scripts/run-enhanced-scraper.sh'"