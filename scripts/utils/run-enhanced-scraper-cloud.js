#!/usr/bin/env node

// Cloud Run job entry point for enhanced scraper
const NVRCEnhancedParallelScraper = require('./scrapers/nvrcEnhancedParallelScraper');

async function runEnhancedScraper() {
  console.log('🚀 Starting Enhanced NVRC Scraper in Cloud Run...');
  console.log('📅 Date:', new Date().toISOString());
  console.log('🔧 Environment:', process.env.NODE_ENV);
  
  const scraper = new NVRCEnhancedParallelScraper({
    headless: true,
    maxConcurrency: 5,  // Use 5 parallel browsers
    timeout: 20 * 60 * 1000  // 20 minutes timeout
  });
  
  try {
    await scraper.scrape();
    console.log('✅ Scraping completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Scraping failed:', error);
    process.exit(1);
  }
}

// Run the scraper
runEnhancedScraper();