#!/usr/bin/env node

const { scrapeCourseDetails } = require('./scrapers/nvrcFixedDetailScraper');

async function testSpecificCourse() {
  const courseUrl = 'https://nvrc.perfectmind.com/23734/Clients/BookMe4LandingPages/CoursesLandingPage?widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a&redirectedFromEmbededMode=False&courseId=7669efca-3a7d-4a01-8908-389432db6817';
  
  console.log('Testing course:', courseUrl);
  console.log('\nFetching details...\n');
  
  try {
    const details = await scrapeCourseDetails(courseUrl);
    
    console.log('📊 Extracted Details:');
    console.log('=====================================');
    console.log('Name:', details.name);
    console.log('Course ID:', details.courseId);
    console.log('Internal ID:', details.internalCourseId);
    console.log('\n💰 Cost Information:');
    console.log('Cost:', details.cost);
    console.log('Cost Includes Tax:', details.costIncludesTax);
    console.log('Tax Amount:', details.taxAmount);
    console.log('\n📅 Dates:');
    console.log('Dates:', details.dates);
    console.log('Start Date:', details.startDate);
    console.log('End Date:', details.endDate);
    console.log('Registration Status:', details.registrationStatus);
    console.log('\n📍 Location:');
    console.log('Location:', details.location);
    console.log('Facility:', details.facility);
    console.log('\n👥 Availability:');
    console.log('Spots Available:', details.spotsAvailable);
    console.log('Total Spots:', details.totalSpots);
    
    if (details.requiredExtras && details.requiredExtras.length > 0) {
      console.log('\n📚 Required Extras:');
      details.requiredExtras.forEach(extra => {
        console.log(`  - ${extra.name}: ${extra.cost}`);
      });
    }
    
    console.log('\n=====================================');
    console.log('✅ Course scraping successful!');
    
  } catch (error) {
    console.error('❌ Error scraping course:', error);
  }
}

testSpecificCourse();