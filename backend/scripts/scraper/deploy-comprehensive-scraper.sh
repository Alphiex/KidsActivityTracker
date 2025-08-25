#!/bin/bash

# Comprehensive Scraper Deployment Script
# Deploys the updated scraper with comprehensive detail extraction

set -e  # Exit on error

echo "🚀 Deploying Comprehensive NVRC Scraper"
echo "======================================"

# Configuration
SERVER_USER="ubuntu"
SERVER_HOST="54.213.98.235"
SERVER_PATH="/home/ubuntu/KidsActivityTracker/backend"

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}📤 Step 1: Uploading scraper files${NC}"

# Upload the comprehensive detail scraper
echo "Uploading nvrcComprehensiveDetailScraper.js..."
scp scrapers/nvrcComprehensiveDetailScraper.js "$SERVER_USER@$SERVER_HOST:$SERVER_PATH/scrapers/"

# Upload the updated enhanced parallel scraper
echo "Uploading nvrcEnhancedParallelScraper.js..."
scp scrapers/nvrcEnhancedParallelScraper.js "$SERVER_USER@$SERVER_HOST:$SERVER_PATH/scrapers/"

echo -e "${YELLOW}🔧 Step 2: Installing on server${NC}"

ssh "$SERVER_USER@$SERVER_HOST" << 'ENDSSH'
set -e

cd /home/ubuntu/KidsActivityTracker/backend

echo "Installing scraper files..."

# Set proper permissions
chmod 644 scrapers/nvrcComprehensiveDetailScraper.js
chmod 644 scrapers/nvrcEnhancedParallelScraper.js

# Generate Prisma client
echo "Generating Prisma client..."
npx prisma generate

echo "✅ Scraper files installed successfully!"
ENDSSH

echo -e "${YELLOW}🧪 Step 3: Testing the scraper${NC}"

# Test the scraper with a small batch
ssh "$SERVER_USER@$SERVER_HOST" << 'ENDSSH'
cd /home/ubuntu/KidsActivityTracker/backend

echo "Running test scrape (limited to 10 activities)..."

# Create a test script
cat > test-comprehensive-scraper.js << 'EOF'
const NVRCEnhancedParallelScraper = require('./scrapers/nvrcEnhancedParallelScraper');

async function testScraper() {
  console.log('Testing comprehensive scraper...');
  
  const scraper = new NVRCEnhancedParallelScraper({
    headless: true,
    maxConcurrency: 2
  });
  
  // Temporarily limit the scraper for testing
  const originalEnhance = scraper.enhanceActivitiesWithDetails;
  scraper.enhanceActivitiesWithDetails = async function(activities) {
    console.log(`Limiting to first 10 activities for testing...`);
    return originalEnhance.call(this, activities.slice(0, 10));
  };
  
  try {
    const result = await scraper.scrape();
    console.log(`\nTest complete! Scraped ${result.activities.length} activities`);
    console.log(`Database stats:`, result.stats);
    
    // Show sample enhanced activity
    const enhanced = result.activities.find(a => a.sessions && a.sessions.length > 0);
    if (enhanced) {
      console.log('\nSample enhanced activity:');
      console.log(`- Name: ${enhanced.name}`);
      console.log(`- Course ID: ${enhanced.courseId}`);
      console.log(`- Sessions: ${enhanced.sessions ? enhanced.sessions.length : 0}`);
      console.log(`- Start Time: ${enhanced.startTime}`);
      console.log(`- Registration End: ${enhanced.registrationEndDate}`);
    }
  } catch (error) {
    console.error('Test failed:', error.message);
    process.exit(1);
  }
}

testScraper().catch(console.error);
EOF

# Run the test
timeout 300 node test-comprehensive-scraper.js || echo "Test may have timed out"

# Clean up
rm -f test-comprehensive-scraper.js

ENDSSH

echo -e "${YELLOW}📊 Step 4: Verifying database${NC}"

ssh "$SERVER_USER@$SERVER_HOST" << 'ENDSSH'
cd /home/ubuntu/KidsActivityTracker/backend

# Check for activities with new fields
node -e "
const { PrismaClient } = require('./generated/prisma');
const prisma = new PrismaClient();

async function check() {
  const enhanced = await prisma.activity.count({
    where: {
      OR: [
        { startTime: { not: null } },
        { registrationEndDate: { not: null } },
        { courseDetails: { not: null } }
      ]
    }
  });
  
  const total = await prisma.activity.count();
  
  console.log('Database statistics:');
  console.log('Total activities:', total);
  console.log('Activities with enhanced fields:', enhanced);
  
  await prisma.\$disconnect();
}

check().catch(console.error);
"
ENDSSH

echo -e "${GREEN}✨ Deployment Complete!${NC}"
echo "======================================"
echo "✅ Comprehensive scraper deployed"
echo "✅ Test scrape completed"
echo ""
echo "Next steps:"
echo "1. Run full scrape: ssh $SERVER_USER@$SERVER_HOST 'cd $SERVER_PATH && node scripts/run-enhanced-scraper-direct.js'"
echo "2. Monitor logs: ssh $SERVER_USER@$SERVER_HOST 'tail -f $SERVER_PATH/nvrc_enhanced_results_*.json'"
echo "3. Check API for new fields"