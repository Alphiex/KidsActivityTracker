const NVRCInteractiveScraper = require('./scrapers/nvrcInteractiveScraper');

async function testInteractiveScraper() {
  console.log('🧪 Testing NVRC Interactive Scraper...\n');
  console.log('This test will:');
  console.log('1. Navigate to NVRC find-program page');
  console.log('2. Select age groups for kids');
  console.log('3. Select activities (if available)');
  console.log('4. Select all locations');
  console.log('5. Click Show Results');
  console.log('6. Wait for JavaScript to load results');
  console.log('7. Click + buttons to get registration URLs');
  console.log('\n⏱️  This may take 30-60 seconds...\n');
  
  const scraper = new NVRCInteractiveScraper();
  
  try {
    const startTime = Date.now();
    const camps = await scraper.scrape();
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log(`\n✅ Scraping completed in ${duration} seconds`);
    console.log(`📊 Found ${camps.length} programs\n`);
    
    if (camps.length > 0) {
      console.log('First 5 programs with registration URLs:');
      console.log('='.repeat(80));
      
      const campsWithUrls = camps.filter(c => c.registrationUrl && c.registrationUrl !== 'https://www.nvrc.ca/register');
      
      campsWithUrls.slice(0, 5).forEach((camp, index) => {
        console.log(`\n${index + 1}. ${camp.name}`);
        console.log(`   ID: ${camp.id}`);
        console.log(`   Cost: $${camp.cost}`);
        console.log(`   Location: ${camp.location.name}`);
        console.log(`   Time: ${camp.schedule.days.join(', ')} ${camp.schedule.startTime}-${camp.schedule.endTime}`);
        console.log(`   Dates: ${new Date(camp.dateRange.start).toLocaleDateString()} - ${new Date(camp.dateRange.end).toLocaleDateString()}`);
        console.log(`   📎 Registration: ${camp.registrationUrl}`);
      });
      
      console.log('\n' + '='.repeat(80));
      console.log(`\nTotal programs with registration URLs: ${campsWithUrls.length}`);
      
      // Save to file for inspection
      const fs = require('fs');
      fs.writeFileSync('scraped-camps.json', JSON.stringify(camps, null, 2));
      console.log('\n💾 Full results saved to scraped-camps.json');
    }
    
    return camps;
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    throw error;
  }
}

// Run the test
testInteractiveScraper()
  .then(camps => {
    console.log('\n✅ Test completed successfully!');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Test failed:', err);
    process.exit(1);
  });