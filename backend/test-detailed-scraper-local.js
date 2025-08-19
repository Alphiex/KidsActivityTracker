const NVRCDetailedRegistrationScraper = require('./scrapers/nvrcDetailedRegistrationScraper');

async function testScraper() {
  console.log('🧪 Testing NVRC Detailed Registration Scraper locally...');
  
  const scraper = new NVRCDetailedRegistrationScraper({
    headless: false, // Show browser for debugging
    detailPageTimeout: 30000
  });
  
  try {
    // Run the scraper with a small test batch
    const results = await scraper.scrape({
      testMode: true,
      maxActivities: 3 // Only scrape first 3 activities for testing
    });
    
    console.log('\n📊 Test Results:');
    console.log(`Total activities found: ${results.activities.length}`);
    console.log(`Activities scraped: ${results.scrapedCount}`);
    console.log(`Activities with sessions: ${results.activitiesWithSessions}`);
    console.log(`Activities with prerequisites: ${results.activitiesWithPrerequisites}`);
    console.log(`Errors: ${results.errors}`);
    
    // Show sample activity details
    if (results.activities.length > 0) {
      console.log('\n📄 Sample activity with enhanced details:');
      const sampleActivity = results.activities.find(a => a.sessions && a.sessions.length > 0) || results.activities[0];
      console.log(JSON.stringify(sampleActivity, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await scraper.close();
  }
}

testScraper();