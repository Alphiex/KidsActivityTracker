const puppeteer = require('puppeteer');

async function debugPages() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  console.log('🔍 Debugging NVRC pages to understand structure...\n');
  
  // Test a few different approaches
  const testUrls = [
    // Main widget URL
    { 
      url: 'https://nvrc.perfectmind.com/23734/Clients/BookMe4?widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a',
      name: 'Main Widget Page'
    },
    // Direct calendar URL that worked before
    {
      url: 'https://nvrc.perfectmind.com/23734/Clients/BookMe4BookingPages/Classes?calendarId=2b11fa66-0224-49f1-a0e4-9a0c968c2d43&widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a',
      name: 'Racquetball & Squash Courts (Direct)'
    },
    // Alternative approach - no widget ID
    {
      url: 'https://nvrc.perfectmind.com/23734/Clients/BookMe4BookingPages/BookingCoursesPage?calendarId=2b11fa66-0224-49f1-a0e4-9a0c968c2d43',
      name: 'Racquetball & Squash Courts (No Widget)'
    }
  ];
  
  for (const test of testUrls) {
    console.log(`\n📍 Testing: ${test.name}`);
    console.log(`URL: ${test.url}`);
    
    try {
      await page.goto(test.url, { waitUntil: 'networkidle0', timeout: 30000 });
      await new Promise(r => setTimeout(r, 3000));
      
      const pageInfo = await page.evaluate(() => {
        const body = document.body?.innerText || '';
        const hasActivities = body.includes('$') || body.includes('Sign Up') || body.includes('Register');
        const tableRows = document.querySelectorAll('tr').length;
        const links = document.querySelectorAll('a').length;
        
        // Look for course IDs
        const courseIdMatches = body.match(/#\d{6}/g) || [];
        
        // Get sample content
        const firstRows = Array.from(document.querySelectorAll('tr')).slice(0, 3).map(row => 
          row.innerText?.substring(0, 100) || ''
        );
        
        // Check for iframes
        const iframes = Array.from(document.querySelectorAll('iframe')).map(f => ({
          src: f.src?.substring(0, 100) || '',
          id: f.id || 'no-id'
        }));
        
        // Check for specific elements
        const hasCalendar = !!document.querySelector('[class*="calendar"]');
        const hasSchedule = !!document.querySelector('[class*="schedule"]');
        const hasCourse = !!document.querySelector('[class*="course"]');
        
        return {
          title: document.title,
          hasActivities,
          tableRows,
          links,
          courseIdCount: courseIdMatches.length,
          sampleCourseIds: courseIdMatches.slice(0, 5),
          firstRows,
          iframes,
          hasCalendar,
          hasSchedule,
          hasCourse,
          bodyLength: body.length
        };
      });
      
      console.log('Page info:', JSON.stringify(pageInfo, null, 2));
      
      // If we found course IDs, let's try to click on them
      if (pageInfo.courseIdCount > 0) {
        console.log(`\n✅ Found ${pageInfo.courseIdCount} course IDs! This page has activities.`);
        
        // Try to expand any collapsed sections
        const expanded = await page.evaluate(() => {
          let count = 0;
          const expandables = Array.from(document.querySelectorAll('[class*="expand"], [class*="show"], [class*="more"]'));
          expandables.forEach(el => {
            if (el.offsetParent && (el.tagName === 'A' || el.tagName === 'BUTTON')) {
              el.click();
              count++;
            }
          });
          return count;
        });
        
        if (expanded > 0) {
          console.log(`Expanded ${expanded} sections`);
          await new Promise(r => setTimeout(r, 2000));
          
          // Re-count activities
          const afterExpand = await page.evaluate(() => {
            const body = document.body?.innerText || '';
            const courseIdMatches = body.match(/#\d{6}/g) || [];
            return courseIdMatches.length;
          });
          
          console.log(`After expansion: ${afterExpand} course IDs`);
        }
      }
      
    } catch (error) {
      console.error(`Error: ${error.message}`);
    }
  }
  
  // Now let's try the navigation approach from main page
  console.log('\n\n📍 Testing navigation from main page...');
  
  await page.goto('https://nvrc.perfectmind.com/23734/Clients/BookMe4?widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a', 
    { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));
  
  // Try to click on "Racquetball & Squash Courts"
  console.log('Attempting to click on "Racquetball & Squash Courts"...');
  
  const clicked = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a'));
    const target = links.find(a => a.textContent?.includes('Racquetball & Squash Courts'));
    if (target) {
      console.log('Found link:', target.textContent);
      target.click();
      return true;
    }
    return false;
  });
  
  if (clicked) {
    console.log('Clicked! Waiting for navigation...');
    await new Promise(r => setTimeout(r, 5000));
    
    const newUrl = page.url();
    console.log(`New URL: ${newUrl}`);
    
    const activities = await page.evaluate(() => {
      const body = document.body?.innerText || '';
      const courseIdMatches = body.match(/#\d{6}/g) || [];
      return {
        courseIdCount: courseIdMatches.length,
        sampleIds: courseIdMatches.slice(0, 10)
      };
    });
    
    console.log(`Found ${activities.courseIdCount} activities after navigation`);
    if (activities.sampleIds.length > 0) {
      console.log('Sample IDs:', activities.sampleIds);
    }
  }
  
  await browser.close();
  console.log('\n✅ Debug complete');
}

debugPages().catch(console.error);