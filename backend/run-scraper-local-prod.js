#!/usr/bin/env node

// Set environment variables
process.env.DATABASE_URL = 'postgresql://postgres:KidsTracker2024@localhost:5434/kidsactivity';
process.env.NODE_ENV = 'production';
process.env.HEADLESS = 'true';

// Import the scraper
const NVRCEnhancedParallelScraper = require('./scrapers/nvrcEnhancedParallelScraper');

async function runScraper() {
  console.log('🚀 Running NVRC Enhanced Parallel Scraper locally with production database...');
  console.log('📊 This will update all activities with correct cost information.\n');
  
  const scraper = new NVRCEnhancedParallelScraper({
    headless: true,
    maxConcurrency: 2 // Use lower concurrency for local run
  });
  
  try {
    await scraper.scrape();
    console.log('\n✅ Scraping completed successfully!');
  } catch (error) {
    console.error('\n❌ Scraping failed:', error);
    process.exit(1);
  }
}

runScraper();