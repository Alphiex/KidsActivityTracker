#!/bin/bash

# NVRC Enhanced Detail Scraper Runner Script
# This script runs the enhanced scraper that captures all activity details including
# registration status, detail pages, and signup URLs

echo "🚀 Starting NVRC Enhanced Detail Scraper..."
echo "================================================"

# Set working directory
cd /home/ubuntu/KidsActivityTracker/backend

# Check if node modules are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Check if Puppeteer is properly installed
if [ ! -d "node_modules/puppeteer/.local-chromium" ] && [ -z "$PUPPETEER_EXECUTABLE_PATH" ]; then
    echo "🌐 Installing Chromium for Puppeteer..."
    node node_modules/puppeteer/install.js
fi

# Run migrations if needed
echo "🗄️  Running database migrations..."
npx prisma migrate deploy

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npx prisma generate

# Set environment variables
export NODE_ENV=production
export HEADLESS=true

# Create logs directory if it doesn't exist
mkdir -p logs

# Run the enhanced scraper
echo ""
echo "🕷️  Running enhanced scraper..."
echo "This will:"
echo "  - Fetch all activities from NVRC"
echo "  - Capture registration status (Open/Closed/WaitList)"
echo "  - Visit detail pages for additional information"
echo "  - Extract direct signup URLs"
echo "  - Save enhanced data with all details"
echo ""

# Run with error handling and logging
node scrapers/nvrcEnhancedDetailScraper.js 2>&1 | tee logs/enhanced-scraper-$(date +%Y%m%d-%H%M%S).log

# Check if scraper succeeded
if [ ${PIPESTATUS[0]} -eq 0 ]; then
    echo ""
    echo "✅ Scraper completed successfully!"
    
    # Find the most recent activity file
    LATEST_FILE=$(ls -t nvrc_enhanced_activities_*.json 2>/dev/null | head -1)
    
    if [ -n "$LATEST_FILE" ]; then
        echo "📁 Activity file created: $LATEST_FILE"
        
        # Count activities
        ACTIVITY_COUNT=$(grep -o '"id":' "$LATEST_FILE" | wc -l)
        echo "📊 Total activities scraped: $ACTIVITY_COUNT"
        
        # Check if we got 4000+ activities
        if [ $ACTIVITY_COUNT -lt 4000 ]; then
            echo "⚠️  Warning: Expected 4000+ activities but only got $ACTIVITY_COUNT"
        else
            echo "✅ Successfully scraped 4000+ activities!"
        fi
        
        # Import to database
        echo ""
        echo "💾 Importing activities to database..."
        node import-enhanced-activities.js "$LATEST_FILE"
        
        if [ $? -eq 0 ]; then
            echo "✅ Import completed successfully!"
            
            # Archive the JSON file
            mkdir -p data/archive
            mv "$LATEST_FILE" data/archive/
            echo "📦 Activity file archived to data/archive/"
        else
            echo "❌ Import failed!"
            exit 1
        fi
    else
        echo "❌ No activity file was created!"
        exit 1
    fi
else
    echo ""
    echo "❌ Scraper failed!"
    echo "Check logs for details: logs/"
    exit 1
fi

echo ""
echo "🎉 Enhanced scraping process completed!"
echo "================================================"