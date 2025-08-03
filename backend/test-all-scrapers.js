const NVRCNetworkScraper = require('./scrapers/nvrcNetworkScraper');
const NVRCEnhancedScraper = require('./scrapers/nvrcEnhancedScraper');

async function testAllScrapers() {
  console.log('🧪 Testing All NVRC Scrapers...\n');
  console.log('This will test multiple scraping approaches to find the best solution.\n');
  
  const results = {
    network: null,
    enhanced: null
  };
  
  // Test 1: Network Scraper
  console.log('=' .repeat(60));
  console.log('TEST 1: Network Traffic Analysis Scraper');
  console.log('=' .repeat(60));
  
  try {
    const networkScraper = new NVRCNetworkScraper();
    results.network = await networkScraper.scrape();
    
    console.log('\n✅ Network Scraper Results:');
    console.log(`  - API Calls Captured: ${results.network.apiCallsCount}`);
    console.log(`  - API Domains: ${results.network.apiDomains.join(', ')}`);
    console.log(`  - Activities Found: ${results.network.activities.length}`);
    
    if (results.network.apiCalls.length > 0) {
      console.log('\n  Sample API endpoints:');
      const uniqueEndpoints = [...new Set(results.network.apiCalls.map(c => {
        const url = new URL(c.url);
        return url.pathname;
      }))];
      uniqueEndpoints.slice(0, 5).forEach(endpoint => {
        console.log(`    - ${endpoint}`);
      });
    }
  } catch (error) {
    console.error('❌ Network Scraper Error:', error.message);
    results.network = { error: error.message };
  }
  
  // Wait between tests
  console.log('\nWaiting 5 seconds before next test...\n');
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Test 2: Enhanced Scraper
  console.log('=' .repeat(60));
  console.log('TEST 2: Enhanced Iframe Scraper');
  console.log('=' .repeat(60));
  
  try {
    const enhancedScraper = new NVRCEnhancedScraper();
    results.enhanced = await enhancedScraper.scrape();
    
    console.log('\n✅ Enhanced Scraper Results:');
    console.log(`  - Activities Found: ${results.enhanced.activitiesCount}`);
    console.log(`  - Categories Processed: ${results.enhanced.debugInfo.expansionAttempts.length || 0}`);
    console.log(`  - API Calls Logged: ${results.enhanced.debugInfo.apiCalls.length}`);
    
    if (results.enhanced.activities.length > 0) {
      console.log('\n  Sample activities:');
      results.enhanced.activities.slice(0, 5).forEach(activity => {
        const name = activity.name || activity.possibleName || activity.rowText || 'Unknown';
        console.log(`    - ${name.substring(0, 60)}...`);
      });
    }
  } catch (error) {
    console.error('❌ Enhanced Scraper Error:', error.message);
    results.enhanced = { error: error.message };
  }
  
  // Summary
  console.log('\n' + '=' .repeat(60));
  console.log('SUMMARY OF ALL TESTS');
  console.log('=' .repeat(60));
  
  console.log('\n📊 Results Overview:');
  console.log('┌─────────────────┬────────────────┬─────────────┐');
  console.log('│ Scraper         │ Activities     │ Status      │');
  console.log('├─────────────────┼────────────────┼─────────────┤');
  
  const scrapers = [
    { name: 'Network', result: results.network },
    { name: 'Enhanced', result: results.enhanced }
  ];
  
  scrapers.forEach(({ name, result }) => {
    const count = result?.activities?.length || result?.activitiesCount || 0;
    const status = result?.error ? 'Error' : count > 0 ? 'Success' : 'No Data';
    console.log(`│ ${name.padEnd(15)} │ ${count.toString().padEnd(14)} │ ${status.padEnd(11)} │`);
  });
  
  console.log('└─────────────────┴────────────────┴─────────────┘');
  
  // Recommendations
  console.log('\n💡 Recommendations:');
  
  const successfulScrapers = scrapers.filter(s => 
    s.result && !s.result.error && (s.result.activities?.length > 0 || s.result.activitiesCount > 0)
  );
  
  if (successfulScrapers.length === 0) {
    console.log('  ⚠️  No scraper successfully extracted activities.');
    console.log('  Next steps:');
    console.log('  1. Check the screenshots to see what the page looks like');
    console.log('  2. Review API calls in nvrc_api_calls.json');
    console.log('  3. Manually inspect the ActiveCommunities iframe');
    console.log('  4. Consider contacting NVRC for API access');
  } else {
    const bestScraper = successfulScrapers.reduce((best, current) => {
      const bestCount = best.result.activities?.length || best.result.activitiesCount || 0;
      const currentCount = current.result.activities?.length || current.result.activitiesCount || 0;
      return currentCount > bestCount ? current : best;
    });
    
    console.log(`  ✅ Best performing scraper: ${bestScraper.name}`);
    console.log(`  Activities found: ${bestScraper.result.activities?.length || bestScraper.result.activitiesCount}`);
  }
  
  // API Analysis
  if (results.network?.apiCalls?.length > 0) {
    console.log('\n🔍 API Analysis:');
    const acCalls = results.network.apiCalls.filter(c => c.url.includes('activecommunities'));
    if (acCalls.length > 0) {
      console.log(`  Found ${acCalls.length} ActiveCommunities API calls`);
      console.log('  Check nvrc_api_calls.json for potential direct API access');
    }
  }
  
  console.log('\n✅ All tests completed!');
  console.log('\nOutput files created:');
  console.log('  - nvrc_network_*.json (network scraper results)');
  console.log('  - nvrc_enhanced_*.json (enhanced scraper results)');
  console.log('  - nvrc_api_calls.json (captured API endpoints)');
  console.log('  - *.png (screenshots from each scraper)');
}

// Run all tests
testAllScrapers().catch(error => {
  console.error('\n❌ Fatal error running tests:', error);
  process.exit(1);
});