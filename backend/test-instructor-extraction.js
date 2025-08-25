#!/usr/bin/env node

const { scrapeCourseDetails } = require('./scrapers/nvrcFixedDetailScraper');

async function testInstructorExtraction() {
  console.log('🔍 Testing instructor extraction fix...\n');
  
  // Test case 1: Activity with no instructor (00392687)
  console.log('Test 1: Activity 00392687 (should have NO instructor)');
  const url1 = 'https://nvrc.perfectmind.com/23734/Clients/BookMe4LandingPages/CoursesLandingPage?widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a&courseId=9c0bf4e7-5dc2-47a6-85e2-2babb39f2ec6';
  
  try {
    const details1 = await scrapeCourseDetails(url1);
    console.log('✅ Course Name:', details1.name);
    console.log('📋 Instructor:', details1.instructor || '(none)');
    console.log('📝 Description:', details1.fullDescription?.substring(0, 100) + '...');
    console.log('');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  // Test case 2: Activity with actual instructor (from the screenshot)
  console.log('Test 2: Yoga Yin activity (should have instructor: Artemis C)');
  const url2 = 'https://nvrc.perfectmind.com/23734/Clients/BookMe4LandingPages/CoursesLandingPage?widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a&courseId=00365235';
  
  try {
    const details2 = await scrapeCourseDetails(url2);
    console.log('✅ Course Name:', details2.name);
    console.log('📋 Instructor:', details2.instructor || '(none)');
    console.log('📝 Description:', details2.fullDescription?.substring(0, 100) + '...');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testInstructorExtraction();