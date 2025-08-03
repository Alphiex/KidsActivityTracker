const puppeteer = require('puppeteer');

async function testSearchOnly() {
  let browser;
  
  try {
    console.log('🚀 Testing NVRC search process only...');
    browser = await puppeteer.launch({
      headless: false,
      slowMo: 100,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900'],
      defaultViewport: null
    });

    const page = await browser.newPage();
    
    page.on('console', msg => {
      if (!msg.text().includes('JQMIGRATE') && !msg.text().includes('Slow network')) {
        console.log('PAGE:', msg.text());
      }
    });

    // Navigate to the find program page
    console.log('\n📍 Navigating to NVRC find program page...');
    await page.goto('https://www.nvrc.ca/programs-memberships/find-program', {
      waitUntil: 'networkidle0',
      timeout: 60000
    });

    await page.waitForSelector('form', { timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 3000));

    // STEP 1: Select age groups
    console.log('\n📋 STEP 1: Selecting age groups...');
    
    const ageGroups = [
      '0 - 6 years, Parent Participation',
      '0 - 6 years, On My Own',
      '5 - 13 years, School Age',
      '10 - 18 years, Youth'
    ];
    
    for (const ageGroup of ageGroups) {
      await page.evaluate((text) => {
        const labels = Array.from(document.querySelectorAll('label'));
        const label = labels.find(l => l.textContent.includes(text));
        if (label) {
          const checkbox = label.querySelector('input[type="checkbox"]') || 
                         document.getElementById(label.getAttribute('for'));
          if (checkbox && !checkbox.checked) {
            checkbox.click();
          }
        }
      }, ageGroup);
      console.log(`  ✓ Selected: ${ageGroup}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 5000));

    // STEP 2: Select all programs
    console.log('\n🎯 STEP 2: Selecting program activities...');
    
    const programsSelected = await page.evaluate(() => {
      let count = 0;
      const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'));
      
      for (const checkbox of checkboxes) {
        const label = checkbox.closest('label') || 
                     document.querySelector(`label[for="${checkbox.id}"]`);
        
        if (label) {
          const text = label.textContent || '';
          if (!text.includes('years') && 
              !text.includes('Select all locations') &&
              text.trim() !== '' &&
              !checkbox.checked) {
            const parent = checkbox.closest('.form-item, .form-checkboxes, fieldset');
            if (parent) {
              const parentText = parent.textContent || '';
              if (parentText.includes('Choose a program') || 
                  parentText.includes('program activity') ||
                  !parentText.includes('Step 1') && 
                  !parentText.includes('Step 3')) {
                checkbox.click();
                count++;
              }
            }
          }
        }
      }
      return count;
    });
    
    console.log(`  ✅ Selected ${programsSelected} program activities`);
    await new Promise(resolve => setTimeout(resolve, 5000));

    // STEP 3: Select all locations
    console.log('\n📍 STEP 3: Selecting all locations...');
    
    const locationSelected = await page.evaluate(() => {
      const labels = Array.from(document.querySelectorAll('label'));
      for (const label of labels) {
        const text = label.textContent || '';
        if (text.toLowerCase().includes('select all locations available')) {
          const checkbox = label.querySelector('input[type="checkbox"]') || 
                         document.getElementById(label.getAttribute('for'));
          if (checkbox && !checkbox.checked) {
            checkbox.click();
            return true;
          }
        }
      }
      return false;
    });
    
    console.log(`  ✅ Selected all locations: ${locationSelected}`);

    // Submit the form
    console.log('\n🔍 Submitting search form...');
    
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('input[type="submit"], button'));
      const showResults = buttons.find(btn => {
        const text = btn.value || btn.textContent || '';
        return text.toLowerCase().includes('show results');
      });
      if (showResults) {
        showResults.click();
      }
    });

    // Wait for results
    console.log('\n⏳ Waiting for results page...');
    await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Check for ActiveCommunities iframe
    console.log('\n🔍 Checking for ActiveCommunities iframe...');
    
    const frames = page.frames();
    let activeCommunitiesFrame = null;
    
    for (const frame of frames) {
      const url = frame.url();
      console.log(`  Frame URL: ${url.substring(0, 80)}...`);
      if (url.includes('activecommunities.com')) {
        activeCommunitiesFrame = frame;
        console.log('  ✅ Found ActiveCommunities iframe!');
      }
    }
    
    if (activeCommunitiesFrame) {
      // Check iframe content
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const iframeInfo = await activeCommunitiesFrame.evaluate(() => {
        const bodyText = document.body.innerText;
        const courseRowsMatch = bodyText.match(/courseRows:\s*(\d+)/);
        const categories = document.querySelectorAll('a[style*="background-color: rgb(0, 123, 193)"]');
        
        return {
          courseCount: courseRowsMatch ? parseInt(courseRowsMatch[1]) : 0,
          categoryCount: categories.length,
          categories: Array.from(categories).map(c => c.textContent.trim()),
          hasSwimming: bodyText.includes('Swimming'),
          hasCamps: bodyText.includes('Camps'),
          bodyPreview: bodyText.substring(0, 300)
        };
      });
      
      console.log('\n📊 ActiveCommunities iframe content:');
      console.log(`  Course count: ${iframeInfo.courseCount}`);
      console.log(`  Categories: ${iframeInfo.categoryCount}`);
      console.log(`  Category names: ${iframeInfo.categories.slice(0, 5).join(', ')}...`);
      
      await page.screenshot({ path: 'search-test-results.png', fullPage: true });
      console.log('\n📸 Screenshot saved as search-test-results.png');
      
      return {
        success: true,
        courseCount: iframeInfo.courseCount,
        categoryCount: iframeInfo.categoryCount
      };
    } else {
      console.log('\n❌ No ActiveCommunities iframe found!');
      console.log('Current URL:', page.url());
      
      await page.screenshot({ path: 'search-test-no-iframe.png', fullPage: true });
      
      return {
        success: false,
        message: 'No ActiveCommunities iframe found'
      };
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    console.log('\n⏸️ Keeping browser open for 10 seconds to inspect...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    if (browser) {
      await browser.close();
    }
  }
}

// Run the test
testSearchOnly()
  .then(result => {
    console.log('\n✅ Test complete!');
    if (result.success) {
      console.log(`Found ${result.courseCount} activities in ${result.categoryCount} categories`);
    } else {
      console.log('Search did not reach the expected results page');
    }
  })
  .catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
  });