#!/usr/bin/env node

const NVRCFixedExtractionScraper = require('./scrapers/nvrcFixedExtraction');

console.log('🚀 Testing NVRC Fixed Extraction Scraper...\n');

const scraper = new NVRCFixedExtractionScraper({
  headless: false  // Run with visible browser for testing
});

scraper.scrape()
  .then(activities => {
    console.log('\n✅ Scraping completed successfully!');
    console.log(`\n📊 Total activities extracted: ${activities.length}`);
    
    // Show summary by section
    const bySection = {};
    activities.forEach(act => {
      bySection[act.section] = (bySection[act.section] || 0) + 1;
    });
    
    console.log('\n📋 Activities by section:');
    Object.entries(bySection).forEach(([section, count]) => {
      console.log(`  - ${section}: ${count} activities`);
    });
    
    // Show extraction methods used
    const byMethod = {};
    activities.forEach(act => {
      byMethod[act.extractionMethod] = (byMethod[act.extractionMethod] || 0) + 1;
    });
    
    console.log('\n🔧 Extraction methods used:');
    Object.entries(byMethod).forEach(([method, count]) => {
      console.log(`  - ${method}: ${count} activities`);
    });
    
    // Show sample activities
    console.log('\n📝 Sample activities:');
    activities.slice(0, 5).forEach((act, idx) => {
      console.log(`\n${idx + 1}. ${act.name}`);
      console.log(`   Section: ${act.section}`);
      console.log(`   Dates: ${act.dates || 'N/A'}`);
      console.log(`   Time: ${act.time || 'N/A'}`);
      console.log(`   Location: ${act.location || 'N/A'}`);
      console.log(`   Price: ${act.price ? '$' + act.price : 'N/A'}`);
      console.log(`   Status: ${act.availability}`);
    });
    
    if (activities.length > 3) {
      console.log('\n✅ SUCCESS: Extracted significantly more than 3 activities!');
    } else {
      console.log('\n⚠️  WARNING: Still extracting 3 or fewer activities.');
    }
  })
  .catch(error => {
    console.error('\n❌ Scraping failed:', error);
    process.exit(1);
  });