const NVRCStepByStepScraper = require('./scrapers/nvrcStepByStepScraper');

async function testScraper() {
  console.log('🧪 Testing NVRC Step-by-Step Scraper...\n');
  
  const scraper = new NVRCStepByStepScraper();
  
  try {
    const startTime = Date.now();
    const camps = await scraper.scrape();
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log(`\n✅ Scraping completed in ${duration} seconds`);
    console.log(`📊 Found ${camps.length} programs\n`);
    
    if (camps.length > 0) {
      console.log('Sample programs:');
      console.log('='.repeat(80));
      
      camps.slice(0, 5).forEach((camp, index) => {
        console.log(`\n${index + 1}. ${camp.name || 'Unnamed Program'}`);
        console.log(`   ID: ${camp.id}`);
        console.log(`   Cost: $${camp.cost}`);
        console.log(`   Location: ${camp.location.name || 'Not specified'}`);
        console.log(`   Date: ${new Date(camp.dateRange.start).toLocaleDateString()} - ${new Date(camp.dateRange.end).toLocaleDateString()}`);
        console.log(`   Time: ${camp.schedule.startTime || 'N/A'} - ${camp.schedule.endTime || 'N/A'}`);
        console.log(`   Activities: ${camp.activityType.join(', ')}`);
      });
      
      console.log('\n' + '='.repeat(80));
    }
    
    console.log('\n📸 Screenshots saved:');
    console.log('   - nvrc-0-initial.png');
    console.log('   - nvrc-1-step1-complete.png');
    console.log('   - nvrc-2-step2-complete.png');
    console.log('   - nvrc-3-step3-complete.png');
    console.log('   - nvrc-4-results.png');
    console.log('   - nvrc-results-content.html');
    
    return camps;
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    throw error;
  }
}

testScraper()
  .then(camps => {
    console.log('\n✅ Test completed successfully!');
    if (camps.length === 0) {
      console.log('\n⚠️  No programs found. Check the screenshots to debug the issue.');
    }
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Test failed:', err);
    process.exit(1);
  });