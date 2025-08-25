const puppeteer = require('puppeteer');
const { extractComprehensiveDetails } = require('./scrapers/nvrcFixedDetailScraper');

async function testScrapeActivity() {
  const browser = await puppeteer.launch({ 
    headless: false,
    defaultViewport: null 
  });
  
  try {
    const page = await browser.newPage();
    
    // Navigate to the specific activity
    const url = 'https://nvrc.perfectmind.com/23734/Clients/BookMe4LandingPages/CoursesLandingPage?widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a&embed=False&redirectedFromEmbededMode=False&courseId=457aa7be-04c3-4e90-b4dc-788c0d5df5a6';
    console.log('Navigating to:', url);
    
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    
    // Extract comprehensive details
    console.log('\nExtracting activity details...');
    const details = await extractComprehensiveDetails(page);
    
    console.log('\n=== Activity Details ===');
    console.log('Name:', details.name);
    console.log('Course ID (from page):', details.courseId);  // This should be 00369211
    console.log('Internal Course ID (from URL):', details.internalCourseId); // This is the UUID
    console.log('Cost:', details.cost);
    console.log('Cost includes tax:', details.costIncludesTax);
    console.log('Tax amount:', details.taxAmount);
    console.log('Dates:', details.dates);
    console.log('Start Date:', details.startDate);
    console.log('End Date:', details.endDate);
    console.log('Start Time:', details.startTime);
    console.log('End Time:', details.endTime);
    console.log('Location:', details.location);
    console.log('Facility:', details.facility);
    console.log('Spots Available:', details.spotsAvailable);
    console.log('Total Spots:', details.totalSpots);
    console.log('Registration Status:', details.registrationStatus);
    console.log('Instructor:', details.instructor);
    console.log('Prerequisites:', details.prerequisites);
    console.log('Sessions:', details.sessions?.length || 0);
    
    // Take a screenshot
    await page.screenshot({ path: 'activity-detail-test.png', fullPage: true });
    console.log('\nScreenshot saved as activity-detail-test.png');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

testScrapeActivity();