// Run NVRC Parallel Scraper - Designed for 3000+ activities with concurrent processing
const NVRCParallelScraper = require('../scrapers/nvrcParallelScraper');

async function runParallelScraper() {
  console.log('====================================');
  console.log('NVRC Parallel Scraper');
  console.log('====================================');
  console.log('Features:');
  console.log('- Concurrent processing with multiple browsers');
  console.log('- Processes sections in parallel');
  console.log('- Direct database integration');
  console.log('- Target: 3000+ activities');
  console.log('');
  
  try {
    // Initialize scraper with high concurrency
    const scraper = new NVRCParallelScraper({
      headless: true,
      maxConcurrency: 5 // Increase parallel browsers for faster scraping
    });
    
    console.log('Starting parallel scraping with 5 concurrent browsers...');
    console.log('');
    
    // Run the scraper
    const startTime = Date.now();
    const result = await scraper.scrape();
    const duration = Math.round((Date.now() - startTime) / 1000 / 60);
    
    console.log('');
    console.log('====================================');
    console.log('Scraping Complete!');
    console.log('====================================');
    console.log(`Duration: ${duration} minutes`);
    console.log('');
    
    // The scraper handles database updates internally
    // Check final results
    if (scraper.activities && scraper.activities.length > 0) {
      console.log(`✅ Successfully scraped ${scraper.activities.length} activities`);
      if (scraper.activities.length >= 3000) {
        console.log('🎯 Target of 3000+ activities achieved!');
      } else {
        console.log(`⚠️ Below target: ${scraper.activities.length}/3000 activities`);
      }
    }
    
    return result;
    
  } catch (error) {
    console.error('❌ Scraper failed:', error);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Set up Cloud SQL proxy connection if needed
if (process.env.USE_CLOUD_SQL_PROXY) {
  process.env.DATABASE_URL = "postgresql://postgres:KidsActivity2024!@localhost:5433/kidsactivity";
}

// Run the scraper
runParallelScraper()
  .then(() => {
    console.log('✅ Process completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Process failed:', error);
    process.exit(1);
  });