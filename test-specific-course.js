#!/usr/bin/env node

// Test specific course scraping
const puppeteer = require('puppeteer');

async function testSpecificCourse() {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1200, height: 800 }
  });

  try {
    const page = await browser.newPage();
    
    // Navigate to the specific course page
    const courseUrl = 'https://nvrc.perfectmind.com/23734/Clients/BookMe4LandingPages/CoursesLandingPage?widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a&redirectedFromEmbededMode=False&courseId=8df45f73-8d06-4dea-ad95-71ed1b744f7c';
    console.log('Navigating to course page...');
    await page.goto(courseUrl, { waitUntil: 'networkidle0' });
    
    // Wait for content to load - try multiple selectors
    try {
      await page.waitForSelector('.bm-widget-container, .course-detail, body', { timeout: 10000 });
    } catch (e) {
      console.log('Proceeding without specific selector...');
    }
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Extract all text content from the page
    const pageContent = await page.evaluate(() => {
      return document.body.innerText;
    });
    
    console.log('\n=== PAGE CONTENT ===');
    console.log(pageContent);
    
    // Try to extract specific fields
    const courseData = await page.evaluate(() => {
      const data = {};
      
      // Get course name
      const nameEl = document.querySelector('.bm-pm-course-detail-name, .course-name, h1, h2');
      data.name = nameEl ? nameEl.textContent.trim() : 'Not found';
      
      // Get all text that might contain course info
      const allText = document.body.innerText;
      
      // Extract Course ID
      const courseIdMatch = allText.match(/Course\s*ID[:\s]*(\d+)/i);
      data.courseId = courseIdMatch ? courseIdMatch[1] : 'Not found';
      
      // Extract spots
      const spotsMatch = allText.match(/(\d+)\s*spot\(s\)\s*left/i);
      data.spotsAvailable = spotsMatch ? spotsMatch[1] : 'Not found';
      
      // Extract registration status
      if (allText.includes('Register')) {
        data.registrationStatus = 'Open';
      } else if (allText.includes('Waitlist') || allText.includes('Wait list')) {
        data.registrationStatus = 'Waitlist';
      } else if (allText.includes('Closed') || allText.includes('Full')) {
        data.registrationStatus = 'Closed';
      } else {
        data.registrationStatus = 'Unknown';
      }
      
      // Extract dates
      const dateMatch = allText.match(/Date[:\s]*([^\n]+)/i);
      data.dates = dateMatch ? dateMatch[1].trim() : 'Not found';
      
      // Extract time
      const timeMatch = allText.match(/Time[:\s]*([^\n]+)/i);
      data.time = timeMatch ? timeMatch[1].trim() : 'Not found';
      
      // Extract fees
      const feesMatch = allText.match(/Course Fees[:\s]*\$([0-9.]+)/i);
      data.fees = feesMatch ? feesMatch[1] : 'Not found';
      
      // Extract description
      const detailsMatch = allText.match(/Details[:\s]*([^]+?)(?:Location|Course ID|$)/i);
      data.description = detailsMatch ? detailsMatch[1].trim() : 'Not found';
      
      // Extract location
      const locationMatch = allText.match(/Location[:\s]*([^\n]+)/i);
      data.location = locationMatch ? locationMatch[1].trim() : 'Not found';
      
      // Get all course details sections
      const sections = document.querySelectorAll('.bm-pm-course-detail-section, .course-section, [class*="detail"]');
      data.sectionsFound = sections.length;
      
      return data;
    });
    
    console.log('\n=== EXTRACTED DATA ===');
    console.log(JSON.stringify(courseData, null, 2));
    
    // Look for specific elements
    const elements = await page.evaluate(() => {
      const results = {};
      
      // Find registration button
      const regButton = document.querySelector('[data-bm-pm-course-register-button], button[class*="register"], a[href*="register"]');
      results.registrationButton = regButton ? regButton.textContent.trim() : 'Not found';
      
      // Find spots element
      const spotsEl = document.querySelector('[class*="spots"], [class*="availability"]');
      results.spotsElement = spotsEl ? spotsEl.textContent.trim() : 'Not found';
      
      // Find all data attributes
      const dataElements = document.querySelectorAll('[data-course-id], [data-spots], [data-status]');
      results.dataAttributes = Array.from(dataElements).map(el => ({
        tag: el.tagName,
        class: el.className,
        data: Object.keys(el.dataset).reduce((acc, key) => {
          acc[key] = el.dataset[key];
          return acc;
        }, {}),
        text: el.textContent.trim().substring(0, 50)
      }));
      
      return results;
    });
    
    console.log('\n=== ELEMENT SEARCH ===');
    console.log(JSON.stringify(elements, null, 2));
    
    // Take a screenshot
    await page.screenshot({ path: 'course-00371053-page.png', fullPage: true });
    console.log('\nScreenshot saved as course-00371053-page.png');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

testSpecificCourse();