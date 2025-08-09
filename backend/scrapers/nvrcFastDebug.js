const puppeteer = require('puppeteer');
const fs = require('fs');

class NVRCFastDebug {
  constructor(options = {}) {
    this.options = options;
    this.activities = [];
    this.seenIds = new Set();
  }

  async scrape() {
    let browser;
    
    try {
      console.log('🚀 Starting NVRC Fast Debug Scraper...');
      
      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu'
        ],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
      });
      
      const page = await browser.newPage();
      
      // Go directly to the widget
      const url = 'https://nvrc.perfectmind.com/23734/Clients/BookMe4?widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a';
      
      console.log('📍 Loading page...');
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      
      // Wait a bit for dynamic content
      await new Promise(r => setTimeout(r, 5000));
      
      // Debug: Check what's on the page
      const pageInfo = await page.evaluate(() => {
        const info = {
          title: document.title,
          url: window.location.href,
          bodyText: document.body.innerText.substring(0, 500),
          linkCount: document.querySelectorAll('a').length,
          tableCount: document.querySelectorAll('table').length,
          rowCount: document.querySelectorAll('tr').length,
          hasPrices: document.body.innerText.includes('$'),
          hasSignUp: document.body.innerText.includes('Sign Up') || document.body.innerText.includes('Register')
        };
        return info;
      });
      
      console.log('📊 Page info:', pageInfo);
      
      // Try to extract any activities visible
      console.log('\n🔍 Extracting activities...');
      
      const activities = await page.evaluate(() => {
        const results = [];
        const seen = new Set();
        
        // Method 1: Look for anything with a price
        const allText = document.body.innerText;
        const lines = allText.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          
          if (line.includes('$') && !seen.has(line)) {
            seen.add(line);
            
            // Look at surrounding lines for context
            const prevLine = i > 0 ? lines[i-1] : '';
            const nextLine = i < lines.length - 1 ? lines[i+1] : '';
            
            const priceMatch = line.match(/\$([0-9,]+(?:\.\d{2})?)/);
            const price = priceMatch ? priceMatch[1] : null;
            
            // Assume previous line might be the name
            const name = prevLine || line.split('$')[0].trim() || 'Unknown';
            
            results.push({
              id: `price_${i}`,
              name: name.substring(0, 100),
              price: price,
              context: `${prevLine}\n${line}\n${nextLine}`.substring(0, 200)
            });
          }
        }
        
        // Method 2: Look for table rows
        const rows = Array.from(document.querySelectorAll('tr'));
        rows.forEach((row, idx) => {
          const text = row.innerText || '';
          if (text.length > 10 && !seen.has(text)) {
            seen.add(text);
            
            const cells = Array.from(row.querySelectorAll('td'));
            if (cells.length >= 2) {
              results.push({
                id: `row_${idx}`,
                name: cells[0]?.innerText?.trim() || 'Unknown',
                text: text.substring(0, 200),
                cellCount: cells.length
              });
            }
          }
        });
        
        // Method 3: Look for links that might be activities
        const links = Array.from(document.querySelectorAll('a'));
        links.forEach((link, idx) => {
          const text = link.innerText || '';
          const href = link.href || '';
          
          if (text.length > 5 && 
              !text.includes('Login') && 
              !text.includes('Reset') &&
              !seen.has(text)) {
            seen.add(text);
            
            results.push({
              id: `link_${idx}`,
              name: text,
              href: href.substring(0, 100),
              isProgram: /schedule|program|activity|class|course/i.test(text + href)
            });
          }
        });
        
        return results;
      });
      
      console.log(`✅ Found ${activities.length} potential activities`);
      
      // Show sample
      if (activities.length > 0) {
        console.log('\nSample activities:');
        activities.slice(0, 10).forEach((a, i) => {
          console.log(`${i+1}. ${a.name} (ID: ${a.id})`);
          if (a.price) console.log(`   Price: $${a.price}`);
          if (a.context) console.log(`   Context: ${a.context.replace(/\n/g, ' | ')}`);
        });
      }
      
      // Try clicking on a few links to see what happens
      console.log('\n🔍 Trying to navigate to program pages...');
      
      const programLinks = activities.filter(a => a.isProgram).slice(0, 5);
      
      for (const link of programLinks) {
        try {
          console.log(`\n📂 Clicking on: ${link.name}`);
          
          const clicked = await page.evaluate((linkText) => {
            const link = Array.from(document.querySelectorAll('a'))
              .find(a => a.innerText?.trim() === linkText);
            if (link) {
              link.click();
              return true;
            }
            return false;
          }, link.name);
          
          if (clicked) {
            await new Promise(r => setTimeout(r, 3000));
            
            // Check what changed
            const newInfo = await page.evaluate(() => ({
              url: window.location.href,
              rowCount: document.querySelectorAll('tr').length,
              hasPrices: document.body.innerText.includes('$')
            }));
            
            console.log('  New page info:', newInfo);
            
            // Extract from this page
            const pageActivities = await page.evaluate(() => {
              const results = [];
              const rows = Array.from(document.querySelectorAll('tr'));
              
              rows.forEach((row, idx) => {
                const text = row.innerText || '';
                if (text.includes('$') || text.includes('Sign Up')) {
                  results.push({
                    id: `page_row_${idx}`,
                    text: text.substring(0, 150)
                  });
                }
              });
              
              return results;
            });
            
            console.log(`  Found ${pageActivities.length} activities on this page`);
            
            // Go back
            await page.goBack();
            await new Promise(r => setTimeout(r, 2000));
          }
          
        } catch (e) {
          console.error('  Error:', e.message);
        }
      }
      
      return activities;
      
    } catch (error) {
      console.error('❌ Error:', error);
      throw error;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }
}

// Run it
if (require.main === module) {
  const scraper = new NVRCFastDebug({ headless: true });
  scraper.scrape()
    .then(activities => {
      console.log(`\n✅ Scraping complete! Found ${activities.length} items`);
    })
    .catch(console.error);
}

module.exports = NVRCFastDebug;