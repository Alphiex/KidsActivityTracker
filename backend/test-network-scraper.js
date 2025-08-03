const NVRCNetworkScraper = require('./scrapers/nvrcNetworkScraper');

async function testNetworkScraper() {
  console.log('🧪 Testing NVRC Network Scraper...\n');
  
  const scraper = new NVRCNetworkScraper();
  
  try {
    const results = await scraper.scrape();
    
    console.log('\n📊 Test Results:');
    console.log('================');
    console.log(`API Calls Captured: ${results.apiCallsCount}`);
    console.log(`API Domains: ${results.apiDomains.join(', ')}`);
    console.log(`Activities Found: ${results.activities.length}`);
    
    // Analyze the API calls
    if (results.apiCalls.length > 0) {
      console.log('\n🔍 Sample API Calls:');
      results.apiCalls.slice(0, 5).forEach((call, index) => {
        console.log(`\n${index + 1}. ${call.method} ${call.url.substring(0, 80)}...`);
        if (call.postData) {
          console.log(`   POST Data: ${call.postData.substring(0, 100)}...`);
        }
      });
    }
    
    console.log('\n✅ Test completed successfully!');
    console.log('Check the following files for detailed results:');
    console.log('  - nvrc_api_calls.json (all captured API calls)');
    console.log('  - nvrc_network_analysis.json (analysis summary)');
    console.log('  - api_response_*.json (individual API responses)');
    console.log('  - nvrc_network_scraper_final.png (final screenshot)');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testNetworkScraper();