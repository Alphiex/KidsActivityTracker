const puppeteer = require('puppeteer');

async function debugRacquetball() {
  const browser = await puppeteer.launch({
    headless: false, // Run in non-headless to see what's happening
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  console.log('🔍 Debugging Racquetball & Squash Courts page...\n');
  
  // Navigate to main page
  const mainUrl = 'https://nvrc.perfectmind.com/23734/Clients/BookMe4?widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a';
  await page.goto(mainUrl, { waitUntil: 'networkidle0', timeout: 60000 });
  await new Promise(r => setTimeout(r, 3000));
  
  // Click on Racquetball & Squash Courts
  console.log('Clicking on Racquetball & Squash Courts...');
  const clicked = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a'));
    const target = links.find(a => a.textContent?.trim() === 'Racquetball & Squash Courts');
    if (target) {
      console.log('Found link, clicking...');
      target.click();
      return true;
    }
    return false;
  });
  
  if (!clicked) {
    console.log('Could not find Racquetball & Squash Courts link');
    await browser.close();
    return;
  }
  
  // Wait for navigation
  await new Promise(r => setTimeout(r, 5000));
  
  const newUrl = page.url();
  console.log(`New URL: ${newUrl}`);
  
  // Check page content
  const pageInfo = await page.evaluate(() => {
    const body = document.body?.innerText || '';
    const courseIds = body.match(/#(\d{6})/g) || [];
    
    return {
      url: window.location.href,
      title: document.title,
      courseIdCount: courseIds.length,
      sampleCourseIds: courseIds.slice(0, 10),
      hasPrice: body.includes('$'),
      hasSignUp: body.includes('Sign Up'),
      tableCount: document.querySelectorAll('table').length,
      rowCount: document.querySelectorAll('tr').length,
      // Check for expandable content
      hasShowButtons: Array.from(document.querySelectorAll('*')).some(el => {
        const text = el.textContent?.trim().toLowerCase();
        return text === 'show' || text === 'show more' || text === 'view all';
      }),
      // Get sample table content
      firstTableRows: Array.from(document.querySelectorAll('tr')).slice(0, 5).map(tr => 
        tr.innerText?.substring(0, 100)
      )
    };
  });
  
  console.log('\nPage Info:', JSON.stringify(pageInfo, null, 2));
  
  // Try to expand content if there are "Show" buttons
  if (pageInfo.hasShowButtons) {
    console.log('\nFound expandable content, trying to expand...');
    
    const expanded = await page.evaluate(() => {
      let count = 0;
      const showElements = Array.from(document.querySelectorAll('*')).filter(el => {
        const text = el.textContent?.trim().toLowerCase();
        return (text === 'show' || text === 'show more' || text === 'view all') &&
               el.offsetParent !== null;
      });
      
      showElements.forEach(el => {
        try {
          el.click();
          count++;
        } catch (e) {
          // Continue
        }
      });
      
      return count;
    });
    
    console.log(`Clicked ${expanded} show buttons`);
    
    // Wait and recheck
    await new Promise(r => setTimeout(r, 3000));
    
    const afterExpand = await page.evaluate(() => {
      const body = document.body?.innerText || '';
      const courseIds = body.match(/#(\d{6})/g) || [];
      return {
        courseIdCount: courseIds.length,
        rowCount: document.querySelectorAll('tr').length
      };
    });
    
    console.log(`After expansion: ${afterExpand.courseIdCount} course IDs, ${afterExpand.rowCount} rows`);
  }
  
  // Take screenshot
  await page.screenshot({ path: 'racquetball-debug.png', fullPage: true });
  console.log('\nScreenshot saved as racquetball-debug.png');
  
  await browser.close();
  console.log('\n✅ Debug complete');
}

debugRacquetball().catch(console.error);