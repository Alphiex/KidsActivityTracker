const puppeteer = require('puppeteer');

async function debugCostScraping() {
  const browser = await puppeteer.launch({ 
    headless: false,
    defaultViewport: null 
  });
  
  try {
    const page = await browser.newPage();
    
    // First navigate to NVRC search page
    console.log('Navigating to NVRC search page...');
    await page.goto('https://www.nvrc.ca/programs-memberships/find-program', { 
      waitUntil: 'networkidle2',
      timeout: 60000 
    });
    
    // Wait for and click on "Racquet Sports"
    await page.waitForSelector('.pm-activity-category-selector', { timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('Looking for Racquet Sports category...');
    const categoryClicked = await page.evaluate(() => {
      const categories = document.querySelectorAll('.pm-activity-category-selector .category-item');
      for (const cat of categories) {
        if (cat.textContent.includes('Racquet Sports')) {
          cat.click();
          return true;
        }
      }
      return false;
    });
    
    if (!categoryClicked) {
      console.log('Could not find Racquet Sports category');
      return;
    }
    
    console.log('Clicked Racquet Sports category');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Look for the specific activity
    console.log('Searching for National Tournament Team activities...');
    
    const activities = await page.evaluate(() => {
      const rows = document.querySelectorAll('.events-table tr.events-row');
      const results = [];
      
      rows.forEach(row => {
        const name = row.querySelector('.events-row__title a')?.textContent?.trim();
        if (name && name.includes('National Tournament Team')) {
          const courseId = row.querySelector('.events-row__barcode')?.textContent?.trim();
          const costElement = row.querySelector('.events-row__cost');
          
          results.push({
            name: name,
            courseId: courseId,
            costText: costElement?.textContent?.trim(),
            costHTML: costElement?.innerHTML,
            costOuterHTML: costElement?.outerHTML
          });
        }
      });
      
      return results;
    });
    
    console.log('\nFound', activities.length, 'National Tournament Team activities:\n');
    activities.forEach((activity, index) => {
      console.log(`${index + 1}. ${activity.name}`);
      console.log(`   Course ID: ${activity.courseId}`);
      console.log(`   Cost Text: "${activity.costText}"`);
      console.log(`   Cost HTML: ${activity.costHTML}`);
      console.log(`   Cost Outer HTML: ${activity.costOuterHTML}`);
      console.log('');
    });
    
    // Also check what's in the entire cost column
    console.log('\nChecking all cost values on the page:');
    const allCosts = await page.evaluate(() => {
      const costs = document.querySelectorAll('.events-row__cost');
      return Array.from(costs).map(el => ({
        text: el.textContent.trim(),
        html: el.innerHTML.trim()
      })).slice(0, 10); // First 10
    });
    
    allCosts.forEach((cost, index) => {
      console.log(`Cost ${index + 1}: "${cost.text}" (HTML: ${cost.html})`);
    });
    
    // Take a screenshot
    await page.screenshot({ path: 'cost-column-debug.png', fullPage: false });
    console.log('\nScreenshot saved as cost-column-debug.png');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

debugCostScraping();