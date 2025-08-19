const puppeteer = require('puppeteer');

async function debugContent() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  console.log('🔍 Debugging NVRC content loading...\n');
  
  // Navigate to the find program page
  console.log('📍 Navigating to NVRC find program page...');
  await page.goto('https://www.nvrc.ca/programs-memberships/find-program', {
    waitUntil: 'networkidle0',
    timeout: 60000
  });
  
  // Select age groups
  console.log('\n📋 Selecting age groups...');
  await page.evaluate(() => {
    const ageGroups = ['0 - 6 years, Parent Participation', '0 - 6 years, On My Own', '5 - 13 years, School Age', '10 - 18 years, Youth'];
    ageGroups.forEach(age => {
      const checkbox = Array.from(document.querySelectorAll('input[type="checkbox"]'))
        .find(cb => cb.parentElement?.textContent?.includes(age));
      if (checkbox && !checkbox.checked) checkbox.click();
    });
  });
  
  await new Promise(r => setTimeout(r, 3000));
  
  // Select activities
  console.log('📋 Selecting activities...');
  const activitiesCount = await page.evaluate(() => {
    let count = 0;
    const activityKeywords = ['Swim', 'Camp', 'Sport', 'Art', 'Dance', 'Music', 'Gym', 'Climb', 
                              'Martial', 'Cooking', 'Yoga', 'Tennis', 'Basketball', 'Soccer',
                              'Fitness', 'Spin', 'Strength', 'Cardio', 'Aquatic', 'Leadership'];
    
    const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'));
    checkboxes.forEach(cb => {
      const label = cb.parentElement?.textContent?.trim() || '';
      const isActivity = activityKeywords.some(keyword => 
        label.includes(keyword) && !label.includes('years') && !label.includes('Age')
      );
      if (isActivity && !cb.checked) {
        cb.click();
        count++;
      }
    });
    return count;
  });
  
  console.log(`Selected ${activitiesCount} activities`);
  await new Promise(r => setTimeout(r, 3000));
  
  // Select all locations
  console.log('\n📋 Selecting locations...');
  await page.evaluate(() => {
    const selectAllLabel = Array.from(document.querySelectorAll('label'))
      .find(label => label.textContent?.includes('Select all locations'));
    if (selectAllLabel) {
      const checkbox = selectAllLabel.querySelector('input[type="checkbox"]') ||
                      selectAllLabel.previousElementSibling;
      if (checkbox && !checkbox.checked) checkbox.click();
    }
  });
  
  await new Promise(r => setTimeout(r, 2000));
  
  // Click Show Results
  console.log('📋 Clicking Show Results...');
  await page.evaluate(() => {
    const button = Array.from(document.querySelectorAll('input[type="submit"], button'))
      .find(btn => (btn.value || btn.textContent || '').includes('Show Results'));
    if (button) button.click();
  });
  
  // Wait for navigation
  await Promise.race([
    page.waitForNavigation({ waitUntil: 'networkidle0' }),
    new Promise(resolve => setTimeout(resolve, 15000))
  ]);
  
  await new Promise(r => setTimeout(r, 5000));
  
  // Debug what's on the page
  const pageInfo = await page.evaluate(() => {
    const info = {
      url: window.location.href,
      title: document.title,
      hasIframes: document.querySelectorAll('iframe').length,
      bodyText: document.body.innerText.substring(0, 500),
      activitySelectors: {
        nvrcCategories: document.querySelectorAll('.nvrc-activities-category').length,
        nvrcServices: document.querySelectorAll('.nvrc-activities-service').length,
        nvrcEvents: document.querySelectorAll('.nvrc-activities-events__row').length,
        anyActivityClass: Array.from(document.querySelectorAll('[class*="activity"]')).length,
        anyProgramClass: Array.from(document.querySelectorAll('[class*="program"]')).length
      },
      iframes: Array.from(document.querySelectorAll('iframe')).map(f => ({
        src: f.src || 'no-src',
        id: f.id || 'no-id',
        class: f.className || 'no-class'
      }))
    };
    
    // Check for PerfectMind content
    const perfectMindElements = Array.from(document.querySelectorAll('*')).filter(el => {
      const className = el.className || '';
      const id = el.id || '';
      const src = el.src || '';
      return (typeof className === 'string' && className.includes('perfect')) || 
             (typeof id === 'string' && id.includes('perfect')) ||
             (typeof src === 'string' && src.includes('perfectmind'));
    });
    
    info.perfectMindElements = perfectMindElements.length;
    
    return info;
  });
  
  console.log('\n📊 Page Info:', JSON.stringify(pageInfo, null, 2));
  
  // If there are iframes, check them
  if (pageInfo.hasIframes > 0) {
    console.log('\n🔍 Checking iframes...');
    
    // Navigate directly to the first iframe URL if it's PerfectMind
    const perfectMindIframe = pageInfo.iframes.find(f => f.src.includes('perfectmind'));
    if (perfectMindIframe) {
      console.log(`\n📍 Navigating directly to PerfectMind iframe: ${perfectMindIframe.src}`);
      
      await page.goto(perfectMindIframe.src, {
        waitUntil: 'networkidle0',
        timeout: 60000
      });
      
      await new Promise(r => setTimeout(r, 5000));
      
      const iframeContent = await page.evaluate(() => {
        return {
          url: window.location.href,
          hasActivities: document.body.innerText.includes('$') || 
                        document.body.innerText.includes('Register'),
          nvrcCategories: document.querySelectorAll('.nvrc-activities-category').length,
          nvrcEvents: document.querySelectorAll('.nvrc-activities-events__row').length,
          tableRows: document.querySelectorAll('tr').length,
          links: document.querySelectorAll('a').length,
          bodyTextSample: document.body.innerText.substring(0, 1000)
        };
      });
      
      console.log('\n📊 Iframe Content:', JSON.stringify(iframeContent, null, 2));
    }
  }
  
  await browser.close();
  console.log('\n✅ Debug complete');
}

debugContent().catch(console.error);