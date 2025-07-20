const NVRCScraper = require('./scraper');

async function testScraper() {
  const scraper = new NVRCScraper();
  
  // The query parameters from your URL
  const queryParams = 'programs=Early%20Years%3A%20On%20My%20Own%2FEarly%20Years%3A%20Parent%20Participation&activities=activities_camps%2Factivities_learn_and_play%2Factivities_martial_arts%2Factivities_swimming%2Farts_culture_dance%2Farts_culture_visual_arts&locations=0ca97f73-c2d6-45b9-b9a3-8d3346945ca8%2Fad9f1d30-91c6-4779-a5fd-e0109e69a8d6%2Fe153c19a-14a3-4b81-a121-13f1ec7405fc%2Fffbf31ae-84f3-495b-83d1-1a7f573db3c8%2F1b275d54-b65d-4169-94cd-847d1644ccc7%2F143ff434-0589-4785-9f34-334cfc713c2b%2F9c388e73-ed3c-4f82-85bd-cc6cf0fb0a68%2Ff67610ba-64ff-4176-9f59-81b27a23cbab%2F72be6805-1624-446d-9597-b70401b78293%2Fe5aebf2f-6163-43d8-b780-a90379b62026';

  try {
    console.log('Starting NVRC scraper test...\n');
    
    // First try the detailed scraper to understand the page structure
    console.log('Running detailed page analysis...');
    const pageAnalysis = await scraper.scrapeWithDetails(queryParams);
    
    console.log('\n=== Page Analysis Results ===');
    console.log('Page loaded successfully');
    console.log('jQuery available:', pageAnalysis.hasJQuery);
    console.log('Found data attributes:', pageAnalysis.dataAttributes.length);
    console.log('Found potential containers:', pageAnalysis.programContainers.length);
    
    // Then try the regular scraper
    console.log('\n\nAttempting to scrape programs...');
    const programs = await scraper.scrape(queryParams);
    
    if (programs.length > 0) {
      console.log(`\n=== Found ${programs.length} Programs ===\n`);
      
      // Display first few programs
      programs.slice(0, 3).forEach((program, index) => {
        console.log(`Program ${index + 1}:`);
        console.log(`  Name: ${program.name}`);
        console.log(`  Location: ${program.location}`);
        console.log(`  Date: ${program.dateRange.start} - ${program.dateRange.end}`);
        console.log(`  Price: ${program.price}`);
        console.log(`  Ages: ${program.ageRange}`);
        console.log(`  Spots: ${program.spotsAvailable}`);
        console.log('---');
      });
      
      // Save all results to file
      const fs = require('fs');
      fs.writeFileSync('scraped-programs.json', JSON.stringify(programs, null, 2));
      console.log('\nAll results saved to scraped-programs.json');
    } else {
      console.log('\nNo programs found. The page structure might have changed.');
      console.log('Check page-content.html for the actual page structure.');
    }

  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
testScraper();