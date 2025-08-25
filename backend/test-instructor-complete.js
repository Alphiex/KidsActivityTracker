#!/usr/bin/env node

const { scrapeCourseDetails } = require('./scrapers/nvrcFixedDetailScraper');

async function testInstructorComplete() {
  console.log('🔍 Testing instructor extraction on multiple activities...\n');
  
  // Test 1: Activity WITH instructor
  console.log('Test 1: Piano Private Lessons (should have instructor: Michael R)');
  const url1 = 'https://nvrc.perfectmind.com/23734/Clients/BookMe4LandingPages/CoursesLandingPage?widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a&redirectedFromEmbededMode=False&courseId=cdf4e1d2-e78a-437f-a30f-7389f87df031';
  
  try {
    const details1 = await scrapeCourseDetails(url1);
    console.log('✅ Course:', details1.name);
    console.log('👤 Instructor:', details1.instructor || '(none)');
    console.log(details1.instructor === 'Michael R' ? '✅ CORRECT!' : '❌ Expected: Michael R');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  console.log('\n---\n');
  
  // Test 2: Activity WITHOUT instructor (description mentions instructors)
  console.log('Test 2: Free Practice Swim Lesson (should have NO instructor)');
  const url2 = 'https://nvrc.perfectmind.com/23734/Clients/BookMe4LandingPages/CoursesLandingPage?widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a&redirectedFromEmbededMode=False&courseId=c415213c-427d-4fc3-976b-c7868ad17ca1';
  
  try {
    const details2 = await scrapeCourseDetails(url2);
    console.log('✅ Course:', details2.name);
    console.log('👤 Instructor:', details2.instructor || '(none)');
    console.log(!details2.instructor ? '✅ CORRECT! (no instructor extracted)' : '❌ Should not have instructor');
    
    if (details2.fullDescription?.includes('instructors')) {
      console.log('ℹ️  Description contains "instructors" but was not extracted as name');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testInstructorComplete();