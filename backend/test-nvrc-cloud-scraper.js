const NVRCCloudScraper = require('./scrapers/nvrcCloudScraper');
const fs = require('fs');

async function testScraper() {
  console.log('🧪 Testing NVRC Cloud Scraper in headless mode...\n');
  
  const scraper = new NVRCCloudScraper({ headless: true });
  
  try {
    const activities = await scraper.scrape();
    
    console.log('\n📊 SCRAPING RESULTS:');
    console.log(`   Total activities found: ${activities.length}`);
    
    // Group activities by category and subcategory
    const categories = {};
    activities.forEach(activity => {
      if (!categories[activity.category]) {
        categories[activity.category] = {};
      }
      if (!categories[activity.category][activity.subcategory]) {
        categories[activity.category][activity.subcategory] = [];
      }
      categories[activity.category][activity.subcategory].push(activity);
    });
    
    console.log('\n📋 ACTIVITIES BY CATEGORY:');
    Object.keys(categories).sort().forEach(category => {
      console.log(`\n${category}:`);
      Object.keys(categories[category]).sort().forEach(subcategory => {
        console.log(`  ${subcategory}: ${categories[category][subcategory].length} activities`);
      });
    });
    
    // Save detailed results
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `nvrc_test_results_${timestamp}.json`;
    
    const results = {
      timestamp: new Date().toISOString(),
      totalActivities: activities.length,
      categorySummary: Object.keys(categories).map(cat => ({
        category: cat,
        subcategories: Object.keys(categories[cat]).map(sub => ({
          name: sub,
          count: categories[cat][sub].length
        }))
      })),
      sampleActivities: activities.slice(0, 10)
    };
    
    fs.writeFileSync(filename, JSON.stringify(results, null, 2));
    console.log(`\n💾 Detailed results saved to: ${filename}`);
    
  } catch (error) {
    console.error('\n❌ Error during scraping:', error);
    process.exit(1);
  }
}

testScraper().catch(console.error);