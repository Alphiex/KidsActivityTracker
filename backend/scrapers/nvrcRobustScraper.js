const puppeteer = require('puppeteer');
const fs = require('fs');

class NVRCRobustScraper {
  constructor() {
    this.activities = [];
    this.debugLog = [];
  }

  log(message) {
    const timestamp = new Date().toISOString();
    console.log(message);
    this.debugLog.push({ timestamp, message });
  }

  async scrape() {
    let browser;
    
    try {
      this.log('🚀 Starting NVRC Robust Scraper...');
      
      browser = await puppeteer.launch({
        headless: false,
        slowMo: 100,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900'],
        defaultViewport: null
      });

      const page = await browser.newPage();
      
      // Set longer timeout
      page.setDefaultTimeout(60000);
      
      // Enable console logging
      page.on('console', msg => {
        if (msg.type() === 'log' && !msg.text().includes('JQMIGRATE')) {
          this.log(`PAGE: ${msg.text()}`);
        }
      });

      // Navigate to NVRC
      this.log('\n📍 Step 1: Navigate to NVRC...');
      await page.goto('https://www.nvrc.ca/programs-memberships/find-program', {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });
      
      // Wait for form to be ready
      await page.waitForSelector('form', { timeout: 30000 });
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Fill form
      this.log('\n📝 Step 2: Filling search form...');
      
      // Select all checkboxes
      await page.evaluate(() => {
        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        let count = 0;
        checkboxes.forEach(cb => {
          if (!cb.checked) {
            cb.checked = true;
            count++;
          }
        });
        console.log(`Checked ${count} checkboxes`);
      });
      
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Submit form - don't wait for navigation
      this.log('\n🔍 Step 3: Submit search...');
      
      // Click submit without waiting for navigation
      await page.evaluate(() => {
        const submitBtn = document.querySelector('input[value="Show Results"]');
        if (submitBtn) {
          submitBtn.click();
          console.log('Clicked Show Results button');
        }
      });
      
      // Wait for iframe to appear instead of navigation
      this.log('⏳ Waiting for ActiveCommunities iframe...');
      
      let iframeFound = false;
      for (let attempt = 0; attempt < 20; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const iframes = await page.$$('iframe');
        for (const iframe of iframes) {
          const src = await iframe.evaluate(el => el.src).catch(() => '');
          if (src.includes('activecommunities')) {
            iframeFound = true;
            this.log('✅ Found ActiveCommunities iframe!');
            break;
          }
        }
        
        if (iframeFound) break;
        this.log(`  Waiting for iframe... attempt ${attempt + 1}/20`);
      }
      
      if (!iframeFound) {
        throw new Error('Could not find ActiveCommunities iframe after 20 attempts');
      }

      // Get iframe handle
      const iframeElement = await page.$('iframe[src*="activecommunities"]');
      const frame = await iframeElement.contentFrame();
      
      // Wait for iframe content to load
      this.log('⏳ Waiting for iframe content...');
      await frame.waitForFunction(
        () => {
          const body = document.body.innerText;
          return body.includes('courseRows') || body.includes('Swimming') || body.includes('Camps');
        },
        { timeout: 30000 }
      );

      // Get initial stats
      const stats = await frame.evaluate(() => {
        const bodyText = document.body.innerText;
        const courseRowsMatch = bodyText.match(/courseRows:\s*(\d+)/);
        const categories = document.querySelectorAll('a[style*="background-color: rgb(0, 123, 193)"]');
        
        return {
          courseCount: courseRowsMatch ? parseInt(courseRowsMatch[1]) : 0,
          categoryCount: categories.length,
          hasContent: bodyText.includes('Swimming') || bodyText.includes('Camps')
        };
      });
      
      this.log(`\n📊 Found ${stats.courseCount} activities in ${stats.categoryCount} categories`);

      // Extract activities using multiple strategies
      this.log('\n🔄 Starting activity extraction...');
      
      // Strategy 1: Try to expand all categories at once
      this.log('\n📂 Strategy 1: Expand all categories...');
      const expandedCount = await frame.evaluate(() => {
        let count = 0;
        const categoryLinks = document.querySelectorAll('a[style*="background-color: rgb(0, 123, 193)"]');
        
        categoryLinks.forEach((link, index) => {
          setTimeout(() => {
            link.click();
            console.log(`Clicked category: ${link.textContent.trim()}`);
          }, index * 500);
          count++;
        });
        
        return count;
      });
      
      this.log(`  Clicked ${expandedCount} categories`);
      
      // Wait for expansions
      await new Promise(resolve => setTimeout(resolve, expandedCount * 500 + 3000));

      // Strategy 2: Look for all activity data
      this.log('\n📋 Strategy 2: Extract all visible activities...');
      
      const extractedData = await frame.evaluate(() => {
        const results = {
          tableRows: [],
          listItems: [],
          divBlocks: [],
          links: []
        };
        
        // Extract from tables
        document.querySelectorAll('tr').forEach((row, index) => {
          const text = row.textContent;
          if (text.includes('$') && !text.includes('Price') && !text.includes('Category')) {
            const cells = Array.from(row.querySelectorAll('td')).map(td => td.textContent.trim());
            if (cells.length > 0) {
              results.tableRows.push({
                index,
                cells,
                text: text.substring(0, 300)
              });
            }
          }
        });
        
        // Extract from lists
        document.querySelectorAll('li').forEach((item, index) => {
          const text = item.textContent;
          if (text.includes('$') && text.length > 30) {
            results.listItems.push({
              index,
              text: text.substring(0, 300)
            });
          }
        });
        
        // Extract from divs
        document.querySelectorAll('div').forEach((div, index) => {
          const text = div.textContent;
          if (text.includes('$') && (text.includes('Register') || text.includes('Add to Cart')) &&
              text.length > 50 && text.length < 500) {
            results.divBlocks.push({
              index,
              text: text.substring(0, 300)
            });
          }
        });
        
        // Get all links that might be activities
        document.querySelectorAll('a').forEach(link => {
          const text = link.textContent.trim();
          if (text && !text.match(/\d+$/) && text.length > 3 &&
              !text.includes('Category') && !text.includes('Back')) {
            results.links.push(text);
          }
        });
        
        return results;
      });
      
      this.log(`  Found ${extractedData.tableRows.length} table rows with activities`);
      this.log(`  Found ${extractedData.listItems.length} list items with activities`);
      this.log(`  Found ${extractedData.divBlocks.length} div blocks with activities`);
      this.log(`  Found ${extractedData.links.length} potential activity links`);

      // Strategy 3: Click individual categories one by one
      if (extractedData.tableRows.length < 100) {
        this.log('\n📂 Strategy 3: Process categories individually...');
        
        // Re-collapse all categories first
        await frame.evaluate(() => {
          const categoryLinks = document.querySelectorAll('a[style*="background-color: rgb(0, 123, 193)"]');
          categoryLinks.forEach(link => link.click());
        });
        
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Get category list
        const categories = await frame.evaluate(() => {
          return Array.from(document.querySelectorAll('a[style*="background-color: rgb(0, 123, 193)"]'))
            .map(link => link.textContent.trim());
        });
        
        // Process each category
        for (let i = 0; i < Math.min(categories.length, 5); i++) {
          const categoryName = categories[i];
          this.log(`\n🔷 Processing category: ${categoryName}`);
          
          // Click category
          await frame.evaluate((catName) => {
            const links = document.querySelectorAll('a');
            for (const link of links) {
              if (link.textContent.trim() === catName) {
                link.click();
                break;
              }
            }
          }, categoryName);
          
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Look for subcategories
          const subcategories = await frame.evaluate(() => {
            const subs = [];
            const links = document.querySelectorAll('a');
            
            links.forEach(link => {
              const text = link.textContent.trim();
              if (!text.match(/\d+$/) && text.length > 3 &&
                  !['Category', 'Back', 'Next', 'Previous'].includes(text)) {
                subs.push(text);
              }
            });
            
            return [...new Set(subs)];
          });
          
          this.log(`  Found ${subcategories.length} subcategories`);
          
          // Extract activities from expanded category
          const categoryActivities = await frame.evaluate((catName) => {
            const activities = [];
            
            document.querySelectorAll('tr').forEach(row => {
              if (row.textContent.includes('$')) {
                const cells = Array.from(row.querySelectorAll('td')).map(td => td.textContent.trim());
                if (cells.length >= 2) {
                  activities.push({
                    category: catName,
                    cells: cells,
                    text: row.textContent.trim()
                  });
                }
              }
            });
            
            return activities;
          }, categoryName);
          
          this.log(`  Extracted ${categoryActivities.length} activities from ${categoryName}`);
          
          // Add to results
          categoryActivities.forEach(act => {
            extractedData.tableRows.push(act);
          });
          
          // Collapse category
          await frame.evaluate((catName) => {
            const links = document.querySelectorAll('a');
            for (const link of links) {
              if (link.textContent.trim() === catName) {
                link.click();
                break;
              }
            }
          }, categoryName);
          
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Process all extracted data into activities
      this.log('\n🔄 Processing extracted data...');
      
      const processedActivities = [];
      const seenActivities = new Set();
      
      // Process table rows
      extractedData.tableRows.forEach((row, index) => {
        if (row.cells && row.cells.length >= 2) {
          const activity = {
            id: `nvrc_table_${index}`,
            name: row.cells[0] || 'Unknown',
            schedule: row.cells[1] || '',
            cost: row.cells[2] || '',
            location: row.cells[3] || '',
            spots: row.cells[4] || '',
            category: row.category || '',
            type: 'table-row',
            provider: 'NVRC'
          };
          
          const key = `${activity.name}_${activity.schedule}_${activity.cost}`;
          if (!seenActivities.has(key) && activity.name !== 'Unknown' && activity.cost) {
            seenActivities.add(key);
            processedActivities.push(activity);
          }
        }
      });
      
      // Process list items
      extractedData.listItems.forEach((item, index) => {
        const costMatch = item.text.match(/\$[\d,]+\.?\d*/);
        if (costMatch) {
          const activity = {
            id: `nvrc_list_${index}`,
            name: item.text.split('$')[0].trim(),
            cost: costMatch[0],
            fullText: item.text,
            type: 'list-item',
            provider: 'NVRC'
          };
          
          const key = `${activity.name}_${activity.cost}`;
          if (!seenActivities.has(key) && activity.name.length > 3) {
            seenActivities.add(key);
            processedActivities.push(activity);
          }
        }
      });
      
      this.log(`\n✅ Total unique activities extracted: ${processedActivities.length}`);
      
      // Save results
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const results = {
        timestamp: new Date().toISOString(),
        stats: {
          expectedCount: stats.courseCount,
          extractedCount: processedActivities.length,
          completeness: `${Math.round((processedActivities.length / stats.courseCount) * 100)}%`,
          extractionMethods: {
            tableRows: extractedData.tableRows.length,
            listItems: extractedData.listItems.length,
            divBlocks: extractedData.divBlocks.length
          }
        },
        activities: processedActivities,
        debugLog: this.debugLog
      };
      
      const filename = `nvrc_robust_${timestamp}.json`;
      fs.writeFileSync(filename, JSON.stringify(results, null, 2));
      this.log(`\n💾 Results saved to ${filename}`);
      
      // Take screenshot
      await page.screenshot({ 
        path: `nvrc_robust_${timestamp}.png`, 
        fullPage: true 
      });
      
      // If we didn't get enough activities, save debug info
      if (processedActivities.length < stats.courseCount * 0.5) {
        this.log('\n⚠️ Less than 50% of activities extracted. Saving debug information...');
        
        const debugInfo = {
          pageUrl: page.url(),
          iframeSrc: await iframeElement.evaluate(el => el.src),
          frameContent: await frame.content(),
          extractedData: extractedData
        };
        
        fs.writeFileSync(`nvrc_debug_${timestamp}.json`, JSON.stringify(debugInfo, null, 2));
        this.log(`Debug info saved to nvrc_debug_${timestamp}.json`);
      }
      
      return results;
      
    } catch (error) {
      this.log(`\n❌ Error: ${error.message}`);
      throw error;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }
}

// Run if called directly
if (require.main === module) {
  const scraper = new NVRCRobustScraper();
  scraper.scrape()
    .then(results => {
      console.log('\n🎉 Scraping complete!');
      console.log(`Expected activities: ${results.stats.expectedCount}`);
      console.log(`Extracted activities: ${results.stats.extractedCount}`);
      console.log(`Completeness: ${results.stats.completeness}`);
      
      if (results.activities.length > 0) {
        console.log('\nSample activities:');
        results.activities.slice(0, 5).forEach(act => {
          console.log(`  - ${act.name} | ${act.cost} | ${act.schedule || 'N/A'}`);
        });
      }
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = NVRCRobustScraper;