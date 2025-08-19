require('dotenv').config({ path: '.env.production' });

const NVRCEnhancedParallelScraper = require('./scrapers/nvrcEnhancedParallelScraper');
const { PrismaClient } = require('./generated/prisma');

async function runScraper() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL
      }
    }
  });

  // Set a timeout to prevent hanging (20 minutes)
  const timeoutId = setTimeout(() => {
    console.error('⏰ Scraper timed out after 20 minutes');
    process.exit(1);
  }, 20 * 60 * 1000);

  try {
    console.log('🚀 Starting NVRC Enhanced Scraper Job...');
    console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
    console.log(`🌍 Environment: production`);
    console.log(`📊 Database: ${process.env.DATABASE_URL ? 'Connected' : 'Not connected'}`);
    
    // Initialize scraper with increased parallel processing
    const scraper = new NVRCEnhancedParallelScraper({
      headless: 'new',
      maxConcurrency: 5, // Increased from 2 to 5 for faster processing
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
    
    console.log('🔍 Starting scraping process with increased parallelism...');
    console.log('⚡ Max concurrent browsers: 5');
    console.log('⏱️  Timeout: 20 minutes');
    
    const result = await scraper.scrape();
    
    // Clear the timeout since we completed successfully
    clearTimeout(timeoutId);
    
    console.log(`\n✅ Scraping complete!`);
    console.log(`   - Total activities found: ${result.activities.length}`);
    console.log(`   - New activities: ${result.stats.created}`);
    console.log(`   - Updated activities: ${result.stats.updated}`);
    console.log(`   - Unchanged activities: ${result.stats.unchanged || 0}`);
    console.log(`   - Removed activities: ${result.stats.removed}`);
    console.log(`   - Errors: ${result.stats.errors}`);
    console.log(`⏰ Completed at: ${new Date().toISOString()}`);
    
    // Show sample of updated activities
    if (result.stats.changedActivities && result.stats.changedActivities.length > 0) {
      console.log('\n📝 Sample of updated activities:');
      result.stats.changedActivities.slice(0, 5).forEach((activity, i) => {
        console.log(`   ${i + 1}. ${activity.name}`);
        activity.changes.slice(0, 3).forEach(change => {
          console.log(`      - ${change.field}: "${change.oldValue}" → "${change.newValue}"`);
        });
      });
    }
    
    // Exit with appropriate code
    process.exit(result.stats.errors > result.activities.length / 2 ? 1 : 0);
    
  } catch (error) {
    console.error('❌ Scraper job failed:', error);
    clearTimeout(timeoutId);
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