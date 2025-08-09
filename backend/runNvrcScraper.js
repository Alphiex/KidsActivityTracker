const NVRCPerfectMindScraper = require('./scrapers/nvrcDirectScraper.js');

async function runScraper() {
  console.log('Starting NVRC scraper...');
  
  const scraper = new NVRCPerfectMindScraper({ 
    headless: true 
  });
  
  try {
    const activities = await scraper.scrape();
    console.log('\n=== SCRAPING COMPLETE ===');
    console.log(`Total activities returned: ${activities.length}`);
    
    // Check for saved results file
    const fs = require('fs');
    const files = fs.readdirSync('.').filter(f => f.startsWith('nvrc_perfectmind_'));
    if (files.length > 0) {
      const latestFile = files.sort().pop();
      const results = JSON.parse(fs.readFileSync(latestFile, 'utf8'));
      
      console.log('\n=== SUMMARY FROM RESULTS FILE ===');
      console.log(`Activities found: ${results.activitiesCount}`);
      
      if (results.summary) {
        console.log('\nBy Section:');
        Object.entries(results.summary.bySection).forEach(([section, count]) => {
          console.log(`  ${section}: ${count}`);
        });
        
        console.log('\nBy Availability:');
        Object.entries(results.summary.byAvailability).forEach(([status, count]) => {
          console.log(`  ${status}: ${count}`);
        });
        
        if (results.summary.priceRange.min !== Infinity) {
          console.log(`\nPrice Range: $${results.summary.priceRange.min} - $${results.summary.priceRange.max}`);
        }
      }
      
      if (results.databaseStats) {
        console.log('\n=== DATABASE STATS ===');
        console.log(`Activities created: ${results.databaseStats.created}`);
        console.log(`Activities updated: ${results.databaseStats.updated}`);
        console.log(`Activities removed: ${results.databaseStats.removed}`);
        console.log(`Errors: ${results.databaseStats.errors}`);
      }
    }
    
  } catch (error) {
    console.error('\n=== ERROR ===');
    console.error('Error message:', error.message);
    console.error('Stack trace:', error.stack);
    
    // Check if it's a database error
    if (error.message.includes('connect') || error.message.includes('ECONNREFUSED')) {
      console.error('\nDatabase connection error. Make sure PostgreSQL is running.');
      console.error('Try: brew services start postgresql@14');
    }
  }
  
  process.exit(0);
}

runScraper();