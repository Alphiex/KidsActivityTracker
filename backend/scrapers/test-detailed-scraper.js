const NVRCDetailedRegistrationScraper = require('./nvrcDetailedRegistrationScraper');

async function testDetailedScraper() {
  console.log('🧪 Testing NVRC Detailed Registration Scraper...\n');
  
  const scraper = new NVRCDetailedRegistrationScraper({
    headless: false, // Set to false to see browser
    maxRetries: 3,
    detailPageTimeout: 30000
  });
  
  try {
    const result = await scraper.scrape();
    
    console.log('\n📊 Scraping Results:');
    console.log(`Total activities scraped: ${result.count}`);
    console.log(`Results saved to: ${result.filename}`);
    
    // Show examples of activities with multiple sessions
    const multiSessionActivities = result.activities.filter(a => a.hasMultipleSessions);
    console.log(`\n🗓️  Activities with multiple sessions: ${multiSessionActivities.length}`);
    
    if (multiSessionActivities.length > 0) {
      console.log('\nExample multi-session activity:');
      const example = multiSessionActivities[0];
      console.log(`- Name: ${example.name}`);
      console.log(`- Course ID: ${example.courseId}`);
      console.log(`- Sessions: ${example.sessionCount}`);
      if (example.sessions) {
        example.sessions.forEach((session, i) => {
          console.log(`  Session ${i + 1}: ${session.date} • ${session.startTime} - ${session.endTime}`);
        });
      }
    }
    
    // Show examples of activities with prerequisites
    const prereqActivities = result.activities.filter(a => a.hasPrerequisites);
    console.log(`\n📚 Activities with prerequisites: ${prereqActivities.length}`);
    
    if (prereqActivities.length > 0) {
      console.log('\nExample activity with prerequisites:');
      const example = prereqActivities[0];
      console.log(`- Name: ${example.name}`);
      console.log(`- Course ID: ${example.courseId}`);
      if (example.prerequisites) {
        example.prerequisites.forEach((prereq, i) => {
          console.log(`  Prerequisite ${i + 1}: ${prereq.name}`);
          if (prereq.url) console.log(`    URL: ${prereq.url}`);
        });
      }
    }
    
    // Show activities with enhanced data
    const enhancedActivities = result.activities.filter(a => 
      a.instructor || a.fullDescription || a.whatToBring
    );
    console.log(`\n✨ Activities with enhanced details: ${enhancedActivities.length}`);
    
    if (enhancedActivities.length > 0) {
      console.log('\nExample enhanced activity:');
      const example = enhancedActivities[0];
      console.log(`- Name: ${example.name}`);
      if (example.instructor) console.log(`- Instructor: ${example.instructor}`);
      if (example.fullDescription) console.log(`- Full description available: ${example.fullDescription.substring(0, 100)}...`);
      if (example.whatToBring) console.log(`- What to bring: ${example.whatToBring}`);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testDetailedScraper()
  .then(() => {
    console.log('\n✅ Test completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Test error:', error);
    process.exit(1);
  });