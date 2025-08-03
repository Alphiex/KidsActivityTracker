const NVRCRealDataScraper = require('./scrapers/nvrcRealDataScraper');

async function testOriginalScraper() {
  console.log('🧪 Testing original NVRC Real Data Scraper...\n');
  
  const scraper = new NVRCRealDataScraper();
  
  try {
    const activities = await scraper.scrape();
    
    console.log(`\n✅ Scraping complete!`);
    console.log(`📊 Found ${activities.length} activities\n`);
    
    if (activities.length > 0) {
      console.log('Sample activities:');
      activities.slice(0, 5).forEach((activity, index) => {
        console.log(`\n${index + 1}. ${activity.name}`);
        console.log(`   Cost: $${activity.cost}`);
        console.log(`   Location: ${activity.location}`);
        console.log(`   Ages: ${activity.ageRange.min}-${activity.ageRange.max}`);
        console.log(`   Schedule: ${activity.schedule}`);
      });
    }
    
    return activities;
    
  } catch (error) {
    console.error('\n❌ Error during scraping:', error.message);
    throw error;
  }
}

// Run the test
testOriginalScraper()
  .then(activities => {
    console.log(`\n🎉 Test successful! Found ${activities.length} activities`);
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });