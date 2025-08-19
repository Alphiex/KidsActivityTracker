const puppeteer = require('puppeteer');
const fs = require('fs');

class NVRCScraper {
  constructor(options = {}) {
    this.options = options;
    this.activities = [];
    this.seenIds = new Set();
    this.processedCategories = new Set();
  }

  async scrape() {
    let browser;
    
    try {
      console.log('🚀 Starting NVRC Scraper...');
      console.log('🎯 Goal: Extract ALL 1700+ activities using PerfectMind widget');
      
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
      
      const mainUrl = 'https://nvrc.perfectmind.com/23734/Clients/BookMe4?widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a';
      
      // Priority categories - these have the most activities
      const priorityCategories = [
        'Racquetball & Squash Courts', // 800+ activities
        'Badminton Courts', // 45+ activities
        'Table Tennis', // 50+ activities
        'Fitness Centre', // 100+ activities
        'Swimming', // 200+ activities (if exists)
        'Swim Schedules', // 55+ activities
        'Open Gym Schedules', // 49+ activities
        'Pickleball Courts', // 22+ activities
        'Tennis Courts', // 50+ activities
        'Birthday Parties', // Variable
        'Camps', // Variable
        'Arts Woodworking (Adult)', // 26+ activities
      ];
      
      console.log('\n📍 Phase 1: Processing high-priority categories...');
      
      // First, navigate to main page and get all links
      await page.goto(mainUrl, { waitUntil: 'networkidle0', timeout: 60000 });
      await this.wait(3000);
      
      // Process priority categories first
      for (const category of priorityCategories) {
        if (this.activities.length >= 1700) {
          console.log('\n🎉 Success! Found 1700+ activities!');
          break;
        }
        
        console.log(`\n📂 Processing priority: ${category}`);
        const found = await this.processCategory(page, category, mainUrl);
        if (!found) {
          console.log(`  ⚠️ Category "${category}" not found on page`);
        }
      }
      
      // If still need more activities, process remaining links
      if (this.activities.length < 1700) {
        console.log('\n📍 Phase 2: Processing remaining categories...');
        
        await page.goto(mainUrl, { waitUntil: 'networkidle0', timeout: 60000 });
        await this.wait(2000);
        
        const allLinks = await page.evaluate(() => {
          const links = Array.from(document.querySelectorAll('a'));
          return links
            .map(a => a.textContent?.trim())
            .filter(text => text && text.length > 2 && !text.includes('Login'));
        });
        
        for (const linkText of allLinks) {
          if (this.activities.length >= 1700) break;
          
          // Skip already processed or non-activity links
          if (this.processedCategories.has(linkText) ||
              linkText.includes('Skip') || 
              linkText.includes('Advanced search') ||
              linkText.includes('Show More') ||
              linkText === 'Register') {
            continue;
          }
          
          console.log(`\n📂 Processing: ${linkText}`);
          await this.processCategory(page, linkText, mainUrl);
        }
      }
      
      console.log(`\n✅ Scraping complete!`);
      console.log(`📊 Total unique activities: ${this.activities.length}`);
      console.log(`📊 Categories processed: ${this.processedCategories.size}`);
      
      // Save results
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `nvrc_activities_${timestamp}.json`;
      
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
  
  async processCategory(page, categoryName, mainUrl) {
    try {
      // Navigate to main page if not already there
      const currentUrl = page.url();
      if (!currentUrl.includes(mainUrl)) {
        await page.goto(mainUrl, { waitUntil: 'networkidle0', timeout: 30000 });
        await this.wait(2000);
      }
      
      // Click the category link
      const clicked = await page.evaluate((text) => {
        const links = Array.from(document.querySelectorAll('a'));
        const target = links.find(a => a.textContent?.trim() === text);
        if (target) {
          target.click();
          return true;
        }
        return false;
      }, categoryName);
      
      if (!clicked) {
        return false;
      }
      
      // Wait for navigation
      await this.wait(3000);
      
      const newUrl = page.url();
      if (newUrl === mainUrl) {
        console.log(`  ⚠️ No navigation occurred for ${categoryName}`);
        return false;
      }
      
      console.log(`  ✅ Navigated to: ${newUrl.substring(0, 80)}...`);
      
      // Try to expand any collapsed content first
      const expanded = await this.expandContent(page);
      if (expanded > 0) {
        console.log(`  ✅ Expanded ${expanded} sections`);
        await this.wait(2000);
      }
      
      // Extract activities
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
              category: categoryName
            });
            added++;
          }
        });
        
        if (added > 0) {
          console.log(`  ➕ Added ${added} new unique activities`);
        }
        
        this.processedCategories.add(categoryName);
        console.log(`  📊 Total activities: ${this.activities.length}`);
      }
      
      // Navigate back to main page for next category
      await page.goto(mainUrl, { waitUntil: 'networkidle0', timeout: 30000 });
      await this.wait(1500);
      
      return true;
      
    } catch (error) {
      console.error(`  ❌ Error processing ${categoryName}: ${error.message}`);
      return false;
    }
  }

  async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  async expandContent(page) {
    try {
      return await page.evaluate(() => {
        let expanded = 0;
        
        // Find all "Show" or expandable elements
        const showElements = Array.from(document.querySelectorAll('*')).filter(el => {
          const text = el.textContent?.trim().toLowerCase();
          return (text === 'show' || text === 'show all' || text === 'show more' || 
                  text === 'view all' || text === 'expand') &&
                 el.offsetParent !== null &&
                 !el.querySelector('*'); // Ensure it's a leaf node
        });
        
        showElements.forEach(el => {
          try {
            el.click();
            expanded++;
          } catch (e) {
            // Continue
          }
        });
        
        return expanded;
      });
    } catch (e) {
      return 0;
    }
  }

  async extractActivities(page) {
    return await page.evaluate(() => {
      const activities = [];
      const body = document.body?.innerText || '';
      const courseIdMatches = body.match(/#(\d{6})/g) || [];
      
      if (courseIdMatches.length > 0) {
        console.log(`Page has ${courseIdMatches.length} course IDs`);
        
        // Extract from table rows with course IDs
        const rows = Array.from(document.querySelectorAll('tr'));
        
        rows.forEach((row) => {
          const text = row.innerText || row.textContent || '';
          const idMatch = text.match(/#(\d{6})/);
          
          if (idMatch) {
            const courseId = idMatch[1];
            const cells = Array.from(row.querySelectorAll('td'));
            
            // Extract activity name
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
            const price = priceMatch ? parseFloat(priceMatch[1].replace(',', '')) : 0;
            
            // Extract location
            let location = null;
            cells.forEach(cell => {
              const cellText = cell.innerText || '';
              if (cellText.match(/Centre|Center|Park|Arena|Pool|Gym|Studio|Library|Community/i) &&
                  !cellText.includes('Sign Up') &&
                  !cellText.includes('$')) {
                location = cellText.trim();
              }
            });
            
            // Extract status
            const isWaitlist = text.includes('Waitlist');
            const isFull = text.includes('Full');
            const status = isFull ? 'full' : isWaitlist ? 'waitlist' : 'available';
            
            if (name && name.length > 3) {
              activities.push({
                courseId: courseId,
                name: name.substring(0, 150),
                price: price,
                location: location,
                status: status,
                provider: 'NVRC'
              });
            }
          }
        });
        
        // Fallback: use all course IDs if no structured data
        if (activities.length === 0) {
          courseIdMatches.forEach((match) => {
            const id = match.replace('#', '');
            activities.push({
              courseId: id,
              name: `Activity ${id}`,
              price: 0,
              location: null,
              status: 'unknown',
              provider: 'NVRC'
            });
          });
        }
      }
      
      return activities;
    });
  }
}

// Export the scraper class
module.exports = NVRCScraper;