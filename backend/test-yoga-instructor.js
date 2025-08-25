#!/usr/bin/env node

const { scrapeCourseDetails } = require('./scrapers/nvrcFixedDetailScraper');

async function testYogaInstructor() {
  console.log('🔍 Testing Yoga Yin activity with instructor...\n');
  
  // From the screenshot URL
  const url = 'https://nvrc.perfectmind.com/23734/Clients/BookMe4LandingPages/CoursesLandingPage?widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a&redirectedFromEmbededMode=False&courseId=1a5cf1d0-d8f6-46e9-932e-af030096ec63';
  
  try {
    const details = await scrapeCourseDetails(url);
    console.log('✅ Course Name:', details.name);
    console.log('📋 Course ID:', details.courseId);
    console.log('👤 Instructor:', details.instructor || '(none found)');
    console.log('📝 Description:', details.fullDescription?.substring(0, 200) + '...');
    
    if (details.instructor) {
      console.log('\n✅ Successfully extracted instructor name!');
    } else {
      console.log('\n⚠️  No instructor found - may need to check the page structure');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testYogaInstructor();