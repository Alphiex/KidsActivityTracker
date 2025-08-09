const NVRCParallelScraper = require('./scrapers/nvrcParallelScraper.js');

async function runParallelScraper() {
  console.log('🚀 Starting NVRC Parallel Scraper...\n');
  console.log('📅 Date:', new Date().toISOString());
  console.log('🖥️  Environment:', process.env.NODE_ENV || 'development');
  console.log('🔧 Max Concurrency:', process.env.MAX_CONCURRENCY || 3);
  
  const scraper = new NVRCParallelScraper({ 
    headless: true,
    maxConcurrency: parseInt(process.env.MAX_CONCURRENCY || '3')
  });
  
  try {
    const result = await scraper.scrape();
    
    console.log('\n=== SCRAPING COMPLETED ===');
    console.log('Check the generated report files for detailed information.');
    
    process.exit(0);
  } catch (error) {
    console.error('\n=== SCRAPING FAILED ===');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run the scraper
runParallelScraper();