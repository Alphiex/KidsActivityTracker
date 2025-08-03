const puppeteer = require('puppeteer');

async function checkForIframe() {
  let browser;
  
  try {
    console.log('🔍 Checking NVRC results page for iframe...');
    browser = await puppeteer.launch({
      headless: false,
      slowMo: 100,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900'],
      defaultViewport: null
    });

    const page = await browser.newPage();
    
    // Use the same search process
    await page.goto('https://www.nvrc.ca/programs-memberships/find-program', {
      waitUntil: 'networkidle0',
      timeout: 60000
    });

    await page.waitForSelector('form', { timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Select kids age groups
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
    }
    
    // Wait for activities
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Select all activities
    await page.evaluate(() => {
      const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'));
      checkboxes.forEach(cb => {
        const label = cb.closest('label') || document.querySelector(`label[for="${cb.id}"]`);
        if (label) {
          const text = label.textContent || '';
          if (!text.includes('years') && !text.includes('Senior') && !text.includes('Adult') &&
              !text.includes('Select all locations') && text.trim() !== '' && !cb.checked) {
            cb.click();
          }
        }
      });
    });
    
    // Wait for locations
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Select all locations
    await page.evaluate(() => {
      const labels = Array.from(document.querySelectorAll('label'));
      for (const label of labels) {
        const text = label.textContent || '';
        if (text.toLowerCase().includes('select all locations available')) {
          const checkbox = label.querySelector('input[type="checkbox"]') || 
                         document.getElementById(label.getAttribute('for'));
          if (checkbox && !checkbox.checked) {
            checkbox.click();
          }
        }
      }
    });
    
    // Submit form
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
    console.log('⏳ Waiting for results...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Check for iframes
    console.log('\n🔍 Checking for iframes...');
    
    const iframeInfo = await page.evaluate(() => {
      const iframes = document.querySelectorAll('iframe');
      return {
        count: iframes.length,
        sources: Array.from(iframes).map(iframe => ({
          src: iframe.src,
          id: iframe.id,
          className: iframe.className,
          width: iframe.width,
          height: iframe.height
        }))
      };
    });
    
    console.log(`\nFound ${iframeInfo.count} iframes:`);
    iframeInfo.sources.forEach((iframe, i) => {
      console.log(`\nIframe ${i + 1}:`);
      console.log(`  src: ${iframe.src}`);
      console.log(`  id: ${iframe.id}`);
      console.log(`  class: ${iframe.className}`);
      console.log(`  size: ${iframe.width}x${iframe.height}`);
    });
    
    // Check all frames
    const frames = page.frames();
    console.log(`\n📄 Total frames: ${frames.length}`);
    
    for (const frame of frames) {
      const url = frame.url();
      console.log(`\nFrame URL: ${url}`);
      
      if (url.includes('activecommunities')) {
        console.log('✅ Found ActiveCommunities frame!');
        
        // Wait for content
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        try {
          const frameContent = await frame.evaluate(() => {
            const body = document.body.innerText;
            return {
              hasCoursRows: body.includes('courseRows'),
              courseRowsMatch: body.match(/courseRows:\s*(\d+)/),
              hasCategories: body.includes('Swimming') || body.includes('Camps'),
              bodyLength: body.length,
              preview: body.substring(0, 500)
            };
          });
          
          console.log('\nActiveCommunities frame content:');
          console.log(frameContent);
          
          if (frameContent.courseRowsMatch) {
            console.log(`\n✅ Found ${frameContent.courseRowsMatch[1]} activities in iframe!`);
          }
        } catch (e) {
          console.error('Error reading frame content:', e.message);
        }
      }
    }
    
    // Check page content
    const pageContent = await page.evaluate(() => {
      const body = document.body.innerText;
      return {
        hasCourseRows: body.includes('courseRows'),
        courseRowsMatch: body.match(/courseRows:\s*(\d+)/),
        hasViewMore: body.includes('View More') || body.includes('Load More'),
        hasPagination: document.querySelector('.pagination, .pager, [class*="page"]') !== null,
        resultsCount: document.querySelectorAll('[id*="course"], [class*="activity"], [class*="program"]').length
      };
    });
    
    console.log('\n📊 Page content analysis:');
    console.log(pageContent);
    
    await page.screenshot({ path: 'iframe-check.png', fullPage: true });
    console.log('\n📸 Screenshot saved as iframe-check.png');
    
    console.log('\n⏸️ Keeping browser open for 10 seconds...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

checkForIframe();