const puppeteer = require('puppeteer');

async function explorePerfectMind() {
  const browser = await puppeteer.launch({ 
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  console.log('🔍 Exploring PerfectMind structure...\n');
  
  // Navigate to PerfectMind
  const url = 'https://nvrc.perfectmind.com/23734/Clients/BookMe4?widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a&embed=False&redirectedFromEmbededMode=False';
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
  
  await page.waitForSelector('body', { timeout: 30000 });
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Take initial screenshot
  await page.screenshot({ path: 'perfectmind-main.png', fullPage: true });
  console.log('📸 Saved main page screenshot');
  
  // Count main navigation links
  const mainLinks = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a'));
    const categorizedLinks = {
      ageGroups: [],
      activities: [],
      other: []
    };
    
    links.forEach(link => {
      const text = link.textContent?.trim() || '';
      const href = link.href || '';
      
      if (text.includes('Years') || text.includes('Age') || text.includes('Adult') || text.includes('Youth')) {
        categorizedLinks.ageGroups.push({ text, href });
      } else if (href.includes('BookMe4') || href.includes('courseId')) {
        categorizedLinks.activities.push({ text, href });
      } else if (text && text.length > 2) {
        categorizedLinks.other.push({ text, href });
      }
    });
    
    return categorizedLinks;
  });
  
  console.log('\n📊 Found links:');
  console.log(`- Age Groups: ${mainLinks.ageGroups.length}`);
  console.log(`- Activities: ${mainLinks.activities.length}`);
  console.log(`- Other: ${mainLinks.other.length}`);
  
  // Click on first age group
  if (mainLinks.ageGroups.length > 0) {
    console.log(`\n👆 Clicking on: ${mainLinks.ageGroups[0].text}`);
    
    await page.evaluate((text) => {
      const link = Array.from(document.querySelectorAll('a')).find(a => a.textContent?.trim() === text);
      if (link) link.click();
    }, mainLinks.ageGroups[0].text);
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    await page.screenshot({ path: 'perfectmind-age-group.png', fullPage: true });
    console.log('📸 Saved age group page screenshot');
    
    // Look for sub-categories or activities
    const pageStructure = await page.evaluate(() => {
      return {
        hasShowButtons: document.querySelectorAll('a:contains("Show"), button:contains("Show")').length,
        hasTables: document.querySelectorAll('table').length,
        hasActivityLinks: document.querySelectorAll('a[href*="courseId"]').length,
        hasExpandables: document.querySelectorAll('[class*="expand"], [class*="collapse"], [class*="accordion"]').length,
        pageText: document.body.innerText.substring(0, 1000)
      };
    });
    
    console.log('\n📄 Page structure:');
    console.log(pageStructure);
    
    // Try to find and click a "Show" button
    const showClicked = await page.evaluate(() => {
      const showLinks = Array.from(document.querySelectorAll('a, span')).filter(el => 
        el.textContent?.trim().toLowerCase() === 'show'
      );
      
      if (showLinks.length > 0) {
        showLinks[0].click();
        return true;
      }
      return false;
    });
    
    if (showClicked) {
      console.log('\n✅ Clicked Show button');
      await new Promise(resolve => setTimeout(resolve, 3000));
      await page.screenshot({ path: 'perfectmind-expanded.png', fullPage: true });
      
      // Count activities after expansion
      const activityCount = await page.evaluate(() => {
        const activities = [];
        
        // Look for Sign Up / Waitlist / Closed buttons
        const actionButtons = Array.from(document.querySelectorAll('a, button')).filter(el => {
          const text = el.textContent?.trim() || '';
          return text.includes('Sign Up') || text.includes('Waitlist') || text.includes('Closed');
        });
        
        // Look for table rows with activity info
        const rows = document.querySelectorAll('tr');
        rows.forEach(row => {
          if (row.textContent?.includes('Sign Up') || 
              row.textContent?.includes('Waitlist') || 
              row.textContent?.includes('Closed')) {
            activities.push(row.textContent?.substring(0, 100));
          }
        });
        
        return {
          actionButtons: actionButtons.length,
          activityRows: activities.length,
          samples: activities.slice(0, 3)
        };
      });
      
      console.log('\n📊 Activities found after expansion:');
      console.log(activityCount);
    }
  }
  
  // Don't close browser - let user explore
  console.log('\n✋ Browser left open for manual exploration...');
  console.log('Press Ctrl+C to exit');
  
  // Keep script running
  await new Promise(() => {});
}

explorePerfectMind().catch(console.error);