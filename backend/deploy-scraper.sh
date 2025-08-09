#!/bin/bash

echo "🚀 NVRC Parallel Scraper Deployment Script"
echo "========================================="

# Check if running on cloud server
if [ -n "$PUPPETEER_EXECUTABLE_PATH" ]; then
    echo "✅ Running on cloud server (Puppeteer executable detected)"
else
    echo "⚠️  Running locally (no Puppeteer executable path set)"
fi

# Set environment variables
export NODE_ENV=production
export MAX_CONCURRENCY=5  # Increase for cloud server

# Ensure database is accessible
echo ""
echo "📊 Checking database connection..."
node -e "
const { PrismaClient } = require('./generated/prisma');
const prisma = new PrismaClient();
prisma.provider.count()
  .then(count => console.log('✅ Database connected. Providers:', count))
  .catch(err => { console.error('❌ Database error:', err.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
" || exit 1

# Create logs directory if it doesn't exist
mkdir -p logs

# Run the scraper with logging
echo ""
echo "🏃 Starting parallel scraper..."
echo "Max concurrency: $MAX_CONCURRENCY"
echo "Headless mode: true"
echo ""

# Run scraper and capture output
LOG_FILE="logs/nvrc_scraper_$(date +%Y%m%d_%H%M%S).log"
node runParallelScraper.js 2>&1 | tee "$LOG_FILE"

# Check exit status
if [ ${PIPESTATUS[0]} -eq 0 ]; then
    echo ""
    echo "✅ Scraping completed successfully!"
    echo "📄 Log saved to: $LOG_FILE"
    
    # Display report files
    echo ""
    echo "📊 Generated reports:"
    ls -la nvrc_scraper_report_*.txt | tail -1
    ls -la nvrc_parallel_results_*.json | tail -1
    
    # Show summary from report
    REPORT_FILE=$(ls -t nvrc_scraper_report_*.txt | head -1)
    if [ -f "$REPORT_FILE" ]; then
        echo ""
        echo "📋 Report Summary:"
        echo "=================="
        head -20 "$REPORT_FILE"
        echo ""
        echo "(See full report in $REPORT_FILE)"
    fi
else
    echo ""
    echo "❌ Scraping failed!"
    echo "Check log file: $LOG_FILE"
    exit 1
fi