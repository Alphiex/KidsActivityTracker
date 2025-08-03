const puppeteer = require('puppeteer');

async function scrapeNVRCWithIframe() {
  const browser = await puppeteer.launch({
    headless: false,
    slowMo: 100,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1440, height: 900 }
  });

  try {
    const page = await browser.newPage();
    
    // Enable console logging
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
    
    console.log('🚀 Starting NVRC iframe-focused scraper...');
    
    // Step 1: Navigate to NVRC
    console.log('\n📍 Step 1: Navigate to NVRC search page...');
    await page.goto('https://www.nvrc.ca/programs-memberships/find-program', {
      waitUntil: 'networkidle0',
      timeout: 60000
    });
    
    console.log('✅ Loaded NVRC page');
    
    // Step 2: Fill out the form completely
    console.log('\n📝 Step 2: Filling out search form...');
    
    // Step 2a: Select kids age groups
    console.log('  👶 Selecting kids age groups...');
    await page.evaluate(() => {
      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      checkboxes.forEach(cb => {
        const label = cb.closest('label') || document.querySelector(`label[for="${cb.id}"]`);
        const text = label ? label.textContent.trim() : '';
        
        if (text.includes('0 - 6 years') || 
            text.includes('5 - 13 years') || 
            text.includes('10 - 18 years')) {
          cb.checked = true;
          console.log('Selected:', text);
        }
      });
    });
    
    // Wait for Step 2 (activities) to appear
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Step 2b: Select all activities
    console.log('  🎯 Selecting all activities...');
    await page.evaluate(() => {
      // Expand activity sections first
      const expandButtons = document.querySelectorAll('button[aria-expanded="false"], a[aria-expanded="false"]');
      expandButtons.forEach(btn => btn.click());
      
      // Wait a bit then select all activity checkboxes
      setTimeout(() => {
        const activityCheckboxes = document.querySelectorAll('#edit-activities input[type="checkbox"], fieldset:nth-of-type(2) input[type="checkbox"]');
        activityCheckboxes.forEach(cb => {
          if (!cb.checked) {
            cb.checked = true;
            console.log('Selected activity:', cb.value || cb.id);
          }
        });
      }, 1000);
    });
    
    // Wait for Step 3 (locations) to appear
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Step 2c: Select all locations
    console.log('  📍 Selecting all locations...');
    await page.evaluate(() => {
      // Look for "Select all locations" checkbox
      const labels = Array.from(document.querySelectorAll('label'));
      const selectAllLabel = labels.find(label => 
        label.textContent.includes('Select all locations')
      );
      
      if (selectAllLabel) {
        const checkbox = selectAllLabel.querySelector('input[type="checkbox"]') || 
                        document.querySelector(`#${selectAllLabel.getAttribute('for')}`);
        if (checkbox && !checkbox.checked) {
          checkbox.click();
          console.log('Selected all locations');
        }
      }
    });
    
    // Wait a bit before submitting
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Step 3: Submit search
    console.log('\n🔍 Step 3: Submit search...');
    const submitButton = await page.$('input[type="submit"][value="Show Results"]');
    if (submitButton) {
      await submitButton.click();
      console.log('✅ Clicked Show Results');
    }
    
    // Wait for results page
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Step 4: Find and analyze iframes
    console.log('\n🖼️ Step 4: Looking for iframes...');
    
    // Get all iframes on the page
    const iframeHandles = await page.$$('iframe');
    console.log(`Found ${iframeHandles.length} iframes on the page`);
    
    // Log each iframe's src
    for (let i = 0; i < iframeHandles.length; i++) {
      const src = await iframeHandles[i].evaluate(el => el.src);
      console.log(`  Iframe ${i}: ${src}`);
    }
    
    // Find ActiveCommunities iframe
    let activeCommunitiesFrame = null;
    const frames = page.frames();
    
    for (const frame of frames) {
      const url = frame.url();
      console.log(`  Frame URL: ${url}`);
      
      if (url.includes('activecommunities.com')) {
        activeCommunitiesFrame = frame;
        console.log('✅ Found ActiveCommunities iframe!');
        break;
      }
    }
    
    if (!activeCommunitiesFrame) {
      console.log('❌ Could not find ActiveCommunities iframe');
      await page.screenshot({ path: 'debug-no-iframe.png', fullPage: true });
      return [];
    }
    
    // Step 5: Work within the iframe
    console.log('\n📊 Step 5: Analyzing iframe content...');
    
    // Wait for iframe content to load
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Get iframe content preview
    const iframeContent = await activeCommunitiesFrame.evaluate(() => {
      return {
        url: window.location.href,
        title: document.title,
        bodyText: document.body.innerText.substring(0, 500),
        hasActivities: document.body.innerText.includes('Swimming') || 
                      document.body.innerText.includes('Camps'),
        elementCounts: {
          links: document.querySelectorAll('a').length,
          divs: document.querySelectorAll('div').length,
          tables: document.querySelectorAll('table').length,
          listItems: document.querySelectorAll('li').length
        }
      };
    });
    
    console.log('Iframe content:', JSON.stringify(iframeContent, null, 2));
    
    // Step 6: Find and click category bars
    console.log('\n🔷 Step 6: Looking for category bars in iframe...');
    
    const categories = await activeCommunitiesFrame.evaluate(() => {
      const foundCategories = [];
      
      // Try multiple selectors for category bars
      const selectors = [
        'a[style*="background-color: rgb(0, 123, 193)"]',
        'a[style*="background: rgb(0, 123, 193)"]',
        '.list-group-item',
        'a.list-group-item',
        '[class*="category"]',
        'a:contains("Swimming")',
        'a:contains("Camps")',
        'a:contains("Dance")'
      ];
      
      selectors.forEach(selector => {
        try {
          const elements = document.querySelectorAll(selector);
          elements.forEach(el => {
            const text = el.textContent.trim();
            if (text && !foundCategories.some(c => c.text === text)) {
              foundCategories.push({
                text: text,
                selector: selector,
                tagName: el.tagName,
                className: el.className,
                hasOnclick: !!el.onclick,
                href: el.href || ''
              });
            }
          });
        } catch (e) {
          // Ignore selector errors
        }
      });
      
      // Also try finding by text content
      const allLinks = document.querySelectorAll('a');
      allLinks.forEach(link => {
        const text = link.textContent.trim();
        if ((text.includes('Swimming') || text.includes('Camps') || 
             text.includes('Dance') || text.includes('Martial Arts')) &&
            text.match(/\d+$/)) { // Has a number at the end
          if (!foundCategories.some(c => c.text === text)) {
            foundCategories.push({
              text: text,
              selector: 'text-based',
              tagName: link.tagName,
              className: link.className,
              hasOnclick: !!link.onclick,
              href: link.href || ''
            });
          }
        }
      });
      
      return foundCategories;
    });
    
    console.log(`Found ${categories.length} categories:`, categories);
    
    // Step 7: Extract activities
    console.log('\n📋 Step 7: Extracting activities...');
    
    const activities = await activeCommunitiesFrame.evaluate(() => {
      const extractedActivities = [];
      
      // Try multiple strategies to find activities
      const activitySelectors = [
        'tr:has(td)',
        '.activity-item',
        '.program-item',
        '.course-item',
        '[class*="activity"]',
        '[class*="program"]',
        '[class*="course"]',
        'li:not(.list-group-item)'
      ];
      
      activitySelectors.forEach(selector => {
        try {
          const elements = document.querySelectorAll(selector);
          elements.forEach(el => {
            const text = el.textContent;
            // Check if this looks like an activity (has cost, dates, etc.)
            if (text && text.includes('$')) {
              extractedActivities.push({
                selector: selector,
                text: text.substring(0, 200),
                hasLink: !!el.querySelector('a')
              });
            }
          });
        } catch (e) {
          // Ignore
        }
      });
      
      return extractedActivities;
    });
    
    console.log(`\n✅ Found ${activities.length} potential activities`);
    if (activities.length > 0) {
      console.log('Sample activities:', activities.slice(0, 3));
    }
    
    // Take a screenshot for debugging
    await page.screenshot({ path: 'debug-iframe-content.png', fullPage: true });
    console.log('📸 Saved debug screenshot');
    
    return activities;
    
  } catch (error) {
    console.error('❌ Error:', error);
    return [];
  } finally {
    await browser.close();
  }
}

// Run the scraper
if (require.main === module) {
  scrapeNVRCWithIframe()
    .then(activities => {
      console.log(`\n🎉 Scraping complete! Found ${activities.length} activities`);
      if (activities.length === 0) {
        console.log('💡 No activities found. Check the debug screenshots and logs above.');
      }
    })
    .catch(error => {
      console.error('Fatal error:', error);
    });
}

module.exports = scrapeNVRCWithIframe;