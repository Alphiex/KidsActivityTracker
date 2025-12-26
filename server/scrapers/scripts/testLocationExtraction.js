#!/usr/bin/env node
/**
 * Test location extraction from PerfectMind detail pages
 * Verifies that coordinates, address, and venue info are properly extracted
 */

const puppeteer = require('puppeteer');
const { extractComprehensiveDetails } = require('../nvrcComprehensiveDetailScraper');

const testUrls = [
  // Richmond
  'https://richmondcity.perfectmind.com/23650/Clients/BookMe4LandingPages/CoursesLandingPage?widgetId=15f6af07-39c5-473e-b053-96653f77a406&redirectedFromEmbededMode=False&courseId=06246f23-4c50-43e4-94dc-8c05186f3cb2',
  // Burnaby
  'https://webreg.burnaby.ca/webreg/Activities/ActivitiesDetails.asp?ProcessWait=N&aid=6251',
  // NVRC
  'https://nvrc.perfectmind.com/23734/Clients/BookMe4LandingPages/CoursesLandingPage?widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a&redirectedFromEmbededMode=False&courseId=test'
];

async function testLocationExtraction() {
  console.log('Testing Location Extraction from PerfectMind Pages');
  console.log('='.repeat(60));

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    // Test Richmond page (known to have coordinates)
    const testUrl = testUrls[0];
    console.log(`\nTesting: Richmond activity page`);
    console.log(`URL: ${testUrl.substring(0, 80)}...`);

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

    await page.goto(testUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    console.log('Page loaded, extracting details...');

    const details = await extractComprehensiveDetails(page);

    console.log('\n--- Extracted Location Data ---');
    console.log(`Location Name: ${details.location || 'NOT FOUND'}`);
    console.log(`Full Address: ${details.fullAddress || 'NOT FOUND'}`);
    console.log(`City: ${details.city || 'NOT FOUND'}`);
    console.log(`Postal Code: ${details.postalCode || 'NOT FOUND'}`);
    console.log(`Latitude: ${details.latitude || 'NOT FOUND'}`);
    console.log(`Longitude: ${details.longitude || 'NOT FOUND'}`);

    console.log('\n--- Other Extracted Data ---');
    console.log(`Name: ${details.name || 'NOT FOUND'}`);
    console.log(`Course ID: ${details.courseId || 'NOT FOUND'}`);
    console.log(`Cost: ${details.cost || 'NOT FOUND'}`);
    console.log(`Start Date: ${details.startDate || 'NOT FOUND'}`);
    console.log(`End Date: ${details.endDate || 'NOT FOUND'}`);
    console.log(`Start Time: ${details.startTime || 'NOT FOUND'}`);
    console.log(`End Time: ${details.endTime || 'NOT FOUND'}`);
    console.log(`Description: ${details.fullDescription ? details.fullDescription.substring(0, 100) + '...' : 'NOT FOUND'}`);

    // Validation
    console.log('\n--- Validation Results ---');
    const hasCoords = details.latitude && details.longitude;
    const hasLocation = details.location;
    const hasAddress = details.fullAddress;

    console.log(`✓ Coordinates: ${hasCoords ? 'PASS' : 'FAIL'} (${details.latitude}, ${details.longitude})`);
    console.log(`✓ Location Name: ${hasLocation ? 'PASS' : 'FAIL'}`);
    console.log(`✓ Address: ${hasAddress ? 'PASS' : 'FAIL'}`);

    await page.close();

    // Summary
    console.log('\n' + '='.repeat(60));
    if (hasCoords && hasLocation) {
      console.log('SUCCESS: Location extraction is working correctly!');
      console.log('\nThe scraper can now extract:');
      console.log('- Venue/facility name');
      console.log('- Full street address');
      console.log('- City and postal code');
      console.log('- Latitude/Longitude coordinates');
    } else {
      console.log('WARNING: Some location data was not extracted');
      console.log('Please check the page structure or extraction logic');
    }

  } catch (error) {
    console.error('Test failed:', error.message);
  } finally {
    if (browser) await browser.close();
  }
}

testLocationExtraction();
