const NVRCEnhancedParallelScraper = require('./scrapers/nvrcEnhancedParallelScraperFixed');
const { PrismaClient } = require('./generated/prisma');

async function runScraper() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL
      }
    }
  });

  try {
    console.log('🚀 Starting NVRC Enhanced Scraper Job...');
    console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'production'}`);
    
    // Initialize scraper with production settings
    const isProduction = process.env.NODE_ENV === 'production';
    const scraper = new NVRCEnhancedParallelScraper({
      headless: isProduction ? 'new' : false,
      maxConcurrency: isProduction ? 2 : 3, // Lower concurrency in production to avoid memory issues
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',
        '--window-size=1920,1080'
      ]
    });
    
    console.log('🔍 Starting scraping process...');
    const result = await scraper.scrape();
    
    console.log(`\n✅ Scraping complete!`);
    console.log(`   - Total activities found: ${result.activities.length}`);
    console.log(`   - New activities: ${result.stats.created}`);
    console.log(`   - Updated activities: ${result.stats.updated}`);
    console.log(`   - Removed activities: ${result.stats.removed}`);
    console.log(`   - Errors: ${result.stats.errors}`);
    console.log(`⏰ Completed at: ${new Date().toISOString()}`);
    
    // Exit with appropriate code
    process.exit(result.stats.errors > result.activities.length / 2 ? 1 : 0);
    
  } catch (error) {
    console.error('❌ Scraper job failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the scraper
runScraper().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});