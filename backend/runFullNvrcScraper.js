const NVRCPerfectMindScraper = require('./scrapers/nvrcDirectScraperFixed.js');

async function runFullScraper() {
  console.log('🚀 Running FULL NVRC scraper...\n');
  
  const scraper = new NVRCPerfectMindScraper({ 
    headless: true 
  });
  
  try {
    const startTime = Date.now();
    const activities = await scraper.scrape();
    const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    
    console.log('\n=== FINAL RESULTS ===');
    console.log(`Total activities scraped: ${activities.length}`);
    console.log(`Time taken: ${duration} minutes`);
    
    // Check for saved results file
    const fs = require('fs');
    const files = fs.readdirSync('.').filter(f => f.startsWith('nvrc_perfectmind_') && f.endsWith('.json'));
    if (files.length > 0) {
      const latestFile = files.sort().pop();
      const results = JSON.parse(fs.readFileSync(latestFile, 'utf8'));
      
      if (results.summary) {
        console.log('\n=== ACTIVITIES BY SECTION ===');
        Object.entries(results.summary.bySection).forEach(([section, count]) => {
          console.log(`${section}: ${count}`);
        });
        
        console.log('\n=== ACTIVITIES BY STATUS ===');
        Object.entries(results.summary.byAvailability || {}).forEach(([status, count]) => {
          console.log(`${status}: ${count}`);
        });
        
        console.log('\n=== ACTIVITIES BY TYPE ===');
        Object.entries(results.summary.byActivityType || {}).forEach(([type, count]) => {
          console.log(`${type}: ${count}`);
        });
        
        if (results.summary.priceRange && results.summary.priceRange.min !== Infinity) {
          console.log(`\n=== PRICE RANGE ===`);
          console.log(`$${results.summary.priceRange.min} - $${results.summary.priceRange.max}`);
        }
        
        console.log('\n=== AGE RANGES ===');
        if (results.summary.ageRanges) {
          results.summary.ageRanges.forEach(range => console.log(range));
        }
      }
      
      if (results.databaseStats) {
        console.log('\n=== DATABASE OPERATIONS ===');
        console.log(`Activities created: ${results.databaseStats.created}`);
        console.log(`Activities updated: ${results.databaseStats.updated}`);
        console.log(`Activities removed: ${results.databaseStats.removed}`);
        if (results.databaseStats.errors > 0) {
          console.log(`Errors: ${results.databaseStats.errors}`);
        }
      }
      
      // Sample activities with URLs
      console.log('\n=== SAMPLE ACTIVITIES WITH URLS ===');
      const withUrls = results.activities.filter(a => a.registrationUrl);
      console.log(`Activities with registration URLs: ${withUrls.length}/${results.activities.length}`);
      
      withUrls.slice(0, 5).forEach((activity, idx) => {
        console.log(`\n${idx + 1}. ${activity.name || 'Unnamed'}`);
        console.log(`   Section: ${activity.section}`);
        console.log(`   Type: ${activity.activityType}`);
        if (activity.price) console.log(`   Price: $${activity.price}`);
        console.log(`   Status: ${activity.availability}`);
        console.log(`   URL: ${activity.registrationUrl ? '✓' : '✗'}`);
      });
    }
    
  } catch (error) {
    console.error('\n=== ERROR ===');
    console.error('Error message:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

runFullScraper();