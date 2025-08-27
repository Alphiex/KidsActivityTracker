const puppeteer = require('puppeteer');
const { extractComprehensiveDetails } = require('./scrapers/nvrcComprehensiveDetailScraper');

async function debugCourseDates() {
  const browser = await puppeteer.launch({ 
    headless: false, // Show browser for debugging
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // Navigate to the specific course
    const url = 'https://nvrc.perfectmind.com/23734/Clients/BookMe4LandingPages/CoursesLandingPage?widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a&redirectedFromEmbededMode=False&courseId=d06dc4e5-0fff-4f44-9218-3b35985be6e3';
    
    console.log('Navigating to course page...');
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Wait for content
    await page.waitForSelector('.event-info-column, .bm-course-primary-content', { timeout: 10000 });
    
    // Extract raw HTML to see what we're working with
    const eventInfoHTML = await page.evaluate(() => {
      const eventInfo = document.querySelector('.event-info-column');
      return eventInfo ? eventInfo.innerHTML : 'No event-info-column found';
    });
    
    console.log('\n=== Event Info HTML ===');
    console.log(eventInfoHTML.substring(0, 1000));
    
    // Try to extract dates directly
    const dates = await page.evaluate(() => {
      const results = {
        labelTexts: [],
        dateMatches: []
      };
      
      // Get all label texts
      const labels = document.querySelectorAll('.event-info-column label');
      labels.forEach(label => {
        const text = label.textContent.trim();
        results.labelTexts.push(text);
        
        // Try to match date pattern
        const dateMatch = text.match(/(\d{1,2}\/\d{2}\/\d{2})\s*-\s*(\d{1,2}\/\d{2}\/\d{2})/);
        if (dateMatch) {
          results.dateMatches.push({
            fullMatch: dateMatch[0],
            startDate: dateMatch[1],
            endDate: dateMatch[2]
          });
        }
      });
      
      return results;
    });
    
    console.log('\n=== Label Texts ===');
    dates.labelTexts.forEach((text, i) => {
      console.log(`${i + 1}. "${text}"`);
    });
    
    console.log('\n=== Date Matches ===');
    if (dates.dateMatches.length > 0) {
      dates.dateMatches.forEach(match => {
        console.log(`Found: ${match.fullMatch}`);
        console.log(`  Start: ${match.startDate}`);
        console.log(`  End: ${match.endDate}`);
      });
    } else {
      console.log('No date matches found with pattern /(\d{1,2}\/\d{2}\/\d{2})\s*-\s*(\d{1,2}\/\d{2}\/\d{2})/');
    }
    
    // Now test the comprehensive extractor
    console.log('\n=== Testing extractComprehensiveDetails ===');
    const details = await extractComprehensiveDetails(page);
    console.log('startDate:', details.startDate);
    console.log('endDate:', details.endDate);
    console.log('dates field:', details.dates);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

debugCourseDates();