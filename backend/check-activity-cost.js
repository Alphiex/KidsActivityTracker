const puppeteer = require('puppeteer');

async function checkActivityCost() {
  const browser = await puppeteer.launch({ 
    headless: false,
    defaultViewport: null 
  });
  
  try {
    const page = await browser.newPage();
    
    // Navigate to the specific activity
    const url = 'https://nvrc.perfectmind.com/23734/Clients/BookMe4LandingPages/CoursesLandingPage?widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a&embed=False&redirectedFromEmbededMode=False&courseId=457aa7be-04c3-4e90-b4dc-788c0d5df5a6';
    console.log('Navigating to:', url);
    
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    
    // Wait for content to load
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Try multiple selectors to find the cost
    const costSelectors = [
      '.price',
      '.cost',
      '.fee',
      '.amount',
      '[class*="price"]',
      '[class*="cost"]',
      '[class*="fee"]',
      '[class*="amount"]',
      'td:contains("$")',
      'span:contains("$")',
      'div:contains("$")',
      'p:contains("$")'
    ];
    
    console.log('\nSearching for cost information...\n');
    
    // Get all text containing dollar signs
    const dollarTexts = await page.evaluate(() => {
      const texts = [];
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );
      
      let node;
      while (node = walker.nextNode()) {
        const text = node.textContent.trim();
        if (text && text.includes('$')) {
          const parent = node.parentElement;
          texts.push({
            text: text,
            tag: parent.tagName,
            className: parent.className,
            id: parent.id,
            path: getPathTo(parent)
          });
        }
      }
      
      function getPathTo(element) {
        if (element.id) return '#' + element.id;
        if (element === document.body) return 'body';
        
        let path = element.tagName.toLowerCase();
        if (element.className) {
          path += '.' + element.className.split(' ').join('.');
        }
        
        const parent = element.parentNode;
        if (parent) {
          return getPathTo(parent) + ' > ' + path;
        }
        return path;
      }
      
      return texts;
    });
    
    console.log('Found', dollarTexts.length, 'elements with dollar signs:\n');
    dollarTexts.forEach((item, index) => {
      console.log(`${index + 1}. Text: "${item.text}"`);
      console.log(`   Tag: ${item.tag}, Class: ${item.className || '(none)'}`);
      console.log(`   Path: ${item.path}`);
      console.log('');
    });
    
    // Also look for the course name to verify we're on the right page
    const courseName = await page.evaluate(() => {
      const h1 = document.querySelector('h1');
      const h2 = document.querySelector('h2');
      const title = document.querySelector('.course-title, .program-title, [class*="title"]');
      return {
        h1: h1 ? h1.textContent.trim() : null,
        h2: h2 ? h2.textContent.trim() : null,
        title: title ? title.textContent.trim() : null
      };
    });
    
    console.log('\nCourse information:');
    console.log('H1:', courseName.h1);
    console.log('H2:', courseName.h2);
    console.log('Title:', courseName.title);
    
    // Take a screenshot
    await page.screenshot({ path: 'activity-cost-debug.png', fullPage: true });
    console.log('\nScreenshot saved as activity-cost-debug.png');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

checkActivityCost();