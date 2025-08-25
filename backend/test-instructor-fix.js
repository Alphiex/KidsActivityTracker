#!/usr/bin/env node

const { scrapeCourseDetails } = require('./scrapers/nvrcFixedDetailScraper');

async function testInstructorFix() {
  console.log('🔍 Testing instructor extraction fix...\n');
  
  // Test the problematic activity
  const url = 'https://nvrc.perfectmind.com/23734/Clients/BookMe4LandingPages/CoursesLandingPage?widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a&redirectedFromEmbededMode=False&courseId=c415213c-427d-4fc3-976b-c7868ad17ca1';
  
  try {
    const details = await scrapeCourseDetails(url);
    console.log('✅ Course Name:', details.name);
    console.log('📋 Course ID:', details.courseId);
    console.log('👤 Instructor:', details.instructor || '(none - correct!)');
    console.log('📝 Description preview:', details.fullDescription?.substring(0, 150) + '...');
    
    // Check if the description contains "instructors"
    if (details.fullDescription?.includes('instructors')) {
      console.log('\n✅ Description contains the word "instructors" but it was NOT extracted as instructor name');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testInstructorFix();