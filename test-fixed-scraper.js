#!/usr/bin/env node

const { scrapeCourseDetails } = require('./scrapers/nvrcFixedDetailScraper');

async function testFixedScraper() {
  const courseUrl = 'https://nvrc.perfectmind.com/23734/Clients/BookMe4LandingPages/CoursesLandingPage?widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a&redirectedFromEmbededMode=False&courseId=8df45f73-8d06-4dea-ad95-71ed1b744f7c';
  
  console.log('Testing fixed scraper on course 00371053...\n');
  
  try {
    const details = await scrapeCourseDetails(courseUrl);
    
    console.log('=== EXTRACTED DETAILS ===');
    console.log(JSON.stringify(details, null, 2));
    
    // Validate key fields
    console.log('\n=== VALIDATION ===');
    console.log(`✓ Course ID (Site's ID): ${details.courseId} (should be 00371053)`);
    console.log(`✓ Registration Status: ${details.registrationStatus} (should be Open)`);
    console.log(`✓ Dates: ${details.dates} (should be 10/18/25)`);
    console.log(`✓ Spots Available: ${details.spotsAvailable} (should be 11)`);
    console.log(`✓ Cost: $${details.cost} (should be $65.00)`);
    console.log(`✓ Location: ${details.location} (should be Parkgate Community Centre)`);
    console.log(`✓ Description: ${details.fullDescription?.substring(0, 100)}...`);
    console.log(`✓ Sessions: ${details.sessions.length} (should be 1)`);
    console.log(`✓ Required Extras: ${details.requiredExtras.length} (should be 1)`);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testFixedScraper();