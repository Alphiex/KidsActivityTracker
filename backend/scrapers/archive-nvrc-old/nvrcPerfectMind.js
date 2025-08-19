const puppeteer = require('puppeteer');
const fs = require('fs');

class NVRCPerfectMindScraper {
  constructor(options = {}) {
    this.options = options;
    this.activities = [];
    this.seenIds = new Set();
    this.processedCategories = new Set();
  }

  async scrape() {
    let browser;
    
    try {
      console.log('🚀 Starting NVRC PerfectMind Scraper...');
      console.log('🎯 Goal: Extract ALL 1700+ activities by clicking through all links');
      
      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-first-run',
          '--no-zygote',
          '--single-process'
        ],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
      });
      
      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      // Use the PerfectMind widget URL as specified
      const mainUrl = 'https://nvrc.perfectmind.com/23734/Clients/BookMe4?widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a';
      
      console.log('\n📍 Navigating to PerfectMind widget...');
      await page.goto(mainUrl, { waitUntil: 'networkidle0', timeout: 60000 });
      await this.wait(3000);
      
      // Get all clickable links
      console.log('\n🔍 Finding all clickable links...');
      const allLinks = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a'));
        return links
          .map(a => a.textContent?.trim())
          .filter(text => text && text.length > 2 && !text.includes('Login'));
      });
      
      console.log(`Found ${allLinks.length} total links`);
      
      // Process each link
      for (let i = 0; i < allLinks.length; i++) {
        const linkText = allLinks[i];
        
        // Skip non-activity links
        if (linkText.includes('Skip') || 
            linkText.includes('Advanced search') ||
            linkText.includes('Show More') ||
            linkText === 'Register') {
          continue;
        }
        
        if (this.processedCategories.has(linkText)) continue;
        
        console.log(`\n📂 [${i + 1}/${allLinks.length}] Processing: ${linkText}`);
        
        try {
          // Always navigate back to main page first
          await page.goto(mainUrl, { waitUntil: 'networkidle0', timeout: 30000 });
          await this.wait(2000);
          
          // Click the link
          const clicked = await page.evaluate((text) => {
            const links = Array.from(document.querySelectorAll('a'));
            const target = links.find(a => a.textContent?.trim() === text);
            if (target) {
              console.log('Clicking:', text);
              target.click();
              return true;
            }
            return false;
          }, linkText);
          
          if (!clicked) {
            console.log(`  ⚠️ Could not click ${linkText}`);
            continue;
          }
          
          // Wait for navigation
          await this.wait(3000);
          
          const currentUrl = page.url();
          if (currentUrl === mainUrl) {
            console.log(`  ⚠️ No navigation occurred`);
            continue;
          }
          
          console.log(`  ✅ Navigated to: ${currentUrl.substring(0, 80)}...`);
          
          // Extract activities from this page
          const pageActivities = await this.extractActivities(page);
          
          if (pageActivities.length > 0) {
            console.log(`  ✅ Found ${pageActivities.length} activities`);
            
            // Add unique activities
            let added = 0;
            pageActivities.forEach(activity => {
              const id = activity.courseId;
              if (!this.seenIds.has(id)) {
                this.seenIds.add(id);
                this.activities.push({
                  ...activity,
                  category: linkText
                });
                added++;
              }
            });
            
            if (added > 0) {
              console.log(`  ➕ Added ${added} new unique activities`);
            }
            
            this.processedCategories.add(linkText);
            console.log(`  📊 Total activities: ${this.activities.length}`);
          }
          
          // Stop if we have enough
          if (this.activities.length >= 1700) {
            console.log('\n🎉 Success! Found 1700+ activities!');
            break;
          }
          
        } catch (error) {
          console.error(`  ❌ Error: ${error.message}`);
        }
      }
      
      console.log(`\n✅ Scraping complete!`);
      console.log(`📊 Total unique activities: ${this.activities.length}`);
      console.log(`📊 Categories processed: ${this.processedCategories.size}`);
      
      // Save results
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `nvrc_perfectmind_${timestamp}.json`;
      
      fs.writeFileSync(filename, JSON.stringify({
        timestamp: new Date().toISOString(),
        totalActivities: this.activities.length,
        categoriesProcessed: Array.from(this.processedCategories),
        activities: this.activities
      }, null, 2));
      
      console.log(`💾 Results saved to ${filename}`);
      
      return this.activities;
      
    } catch (error) {
      console.error('❌ Error:', error);
      throw error;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async extractActivities(page) {
    return await page.evaluate(() => {
      const activities = [];
      
      // Look for course IDs in the page - this is the most reliable indicator
      const body = document.body?.innerText || '';
      const courseIdMatches = body.match(/#(\d{6})/g) || [];
      
      if (courseIdMatches.length > 0) {
        console.log(`Found ${courseIdMatches.length} course IDs on this page`);
        
        // Extract structured data from table rows
        const rows = Array.from(document.querySelectorAll('tr'));
        
        rows.forEach((row) => {
          const text = row.innerText || row.textContent || '';
          const idMatch = text.match(/#(\d{6})/);
          
          if (idMatch) {
            const courseId = idMatch[1];
            const cells = Array.from(row.querySelectorAll('td'));
            
            // Extract name (usually first cell or from text)
            let name = '';
            if (cells.length > 0) {
              name = cells[0].innerText?.trim() || '';
            }
            if (!name || name.length < 5) {
              const lines = text.split('\n').filter(l => l.trim());
              name = lines.find(l => l.length > 10 && !l.includes('$') && !l.includes('#')) || lines[0] || '';
            }
            name = name.replace(/#\d+/, '').trim();
            
            // Extract price
            const priceMatch = text.match(/\$([0-9,]+(?:\.\d{2})?)/);
            const price = priceMatch ? priceMatch[1] : null;
            
            // Extract other details
            const hasSignUp = text.includes('Sign Up');
            const hasRegister = text.includes('Register');
            const isWaitlist = text.includes('Waitlist');
            const isFull = text.includes('Full');
            
            if (name && name.length > 3) {
              activities.push({
                courseId: courseId,
                name: name.substring(0, 150),
                price: price,
                status: isFull ? 'full' : isWaitlist ? 'waitlist' : 'available',
                hasRegistration: hasSignUp || hasRegister
              });
            }
          }
        });
        
        // If no structured data found, just use course IDs
        if (activities.length === 0) {
          courseIdMatches.forEach((match) => {
            const id = match.replace('#', '');
            activities.push({
              courseId: id,
              name: `Activity ${id}`,
              price: null,
              status: 'unknown'
            });
          });
        }
      }
      
      return activities;
    });
  }
}

// Run if called directly
if (require.main === module) {
  const scraper = new NVRCPerfectMindScraper({ headless: true });
  scraper.scrape()
    .then(activities => {
      console.log(`\n✅ Done! Found ${activities.length} activities`);
      if (activities.length > 0) {
        console.log('\nFirst 10 activities:');
        activities.slice(0, 10).forEach((a, i) => {
          console.log(`${i+1}. ${a.name} (ID: ${a.courseId})`);
          if (a.price) console.log(`   Price: $${a.price}`);
          console.log(`   Status: ${a.status}`);
        });
      }
    })
    .catch(console.error);
}

module.exports = NVRCPerfectMindScraper;