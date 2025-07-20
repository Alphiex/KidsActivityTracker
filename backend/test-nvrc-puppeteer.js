#!/usr/bin/env node

const NVRCPuppeteerScraper = require('./scrapers/nvrcPuppeteer');

async function testScraper() {
  console.log('🧪 Testing NVRC Puppeteer Scraper...\n');
  
  const scraper = new NVRCPuppeteerScraper();
  
  try {
    console.log('Starting scrape...');
    const startTime = Date.now();
    
    const camps = await scraper.scrape();
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log(`\n✅ Scraping completed in ${duration} seconds`);
    console.log(`📊 Found ${camps.length} programs\n`);
    
    if (camps.length > 0) {
      console.log('Sample programs found:');
      console.log('='.repeat(80));
      
      // Show first 3 camps
      camps.slice(0, 3).forEach((camp, index) => {
        console.log(`\n${index + 1}. ${camp.name || 'Unnamed Program'}`);
        console.log(`   Provider: ${camp.provider}`);
        console.log(`   Location: ${camp.location.name || 'No location'}`);
        console.log(`   Cost: $${camp.cost}`);
        console.log(`   Age Range: ${camp.ageRange.min}-${camp.ageRange.max} years`);
        console.log(`   Date: ${new Date(camp.dateRange.start).toLocaleDateString()} - ${new Date(camp.dateRange.end).toLocaleDateString()}`);
        console.log(`   Time: ${camp.schedule.startTime} - ${camp.schedule.endTime}`);
        console.log(`   Activities: ${camp.activityType.join(', ')}`);
        if (camp.description) {
          console.log(`   Description: ${camp.description.substring(0, 100)}...`);
        }
      });
      
      console.log('\n' + '='.repeat(80));
      
      // Show activity type distribution
      const activityCounts = {};
      camps.forEach(camp => {
        camp.activityType.forEach(activity => {
          activityCounts[activity] = (activityCounts[activity] || 0) + 1;
        });
      });
      
      console.log('\nActivity Type Distribution:');
      Object.entries(activityCounts).forEach(([activity, count]) => {
        console.log(`   ${activity}: ${count} programs`);
      });
    }
    
    console.log('\n📸 Screenshots saved:');
    console.log('   - nvrc-step0.png (initial page)');
    console.log('   - nvrc-step1.png (after age selection)');
    console.log('   - nvrc-step2.png (after activity selection)');
    console.log('   - nvrc-step3.png (after location selection)');
    console.log('   - nvrc-results.png (results page)');
    
  } catch (error) {
    console.error('\n❌ Error during scraping:', error.message);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  }
}

// Run the test
testScraper().then(() => {
  console.log('\n✅ Test completed successfully!');
  process.exit(0);
}).catch(err => {
  console.error('\n❌ Test failed:', err);
  process.exit(1);
});