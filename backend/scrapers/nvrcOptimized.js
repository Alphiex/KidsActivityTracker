const puppeteer = require('puppeteer');
const fs = require('fs');

class NVRCOptimized {
  constructor(options = {}) {
    this.options = options;
    this.activities = [];
    this.seenIds = new Set();
    this.processedUrls = new Set();
  }

  async scrape() {
    let browser;
    
    try {
      console.log('🚀 Starting NVRC Optimized Scraper...');
      console.log('🎯 Goal: Extract ALL 1700+ activities efficiently');
      
      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-extensions'
        ],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
      });
      
      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      // Enable request interception to track URLs
      await page.setRequestInterception(true);
      page.on('request', request => {
        request.continue();
      });
      
      // Start at the main widget page
      const mainUrl = 'https://nvrc.perfectmind.com/23734/Clients/BookMe4?widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a';
      
      console.log('\n📍 Loading main page...');
      await page.goto(mainUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await this.wait(2000);
      
      // Strategy 1: Click on all main categories first
      console.log('\n📍 Strategy 1: Processing main schedule categories...');
      
      const scheduleCategories = [
        'Art Studio Schedules',
        'Fitness Studio Workout Schedules',
        'Indoor Playtime (Parent Participation)',
        'North Shore Neighbourhood House Schedules',
        'Open Gym Schedules',
        'Parkgate Society Schedules',
        'Skate Schedules',
        'Swim Schedules',
        'Youth Services Schedules'
      ];
      
      for (const category of scheduleCategories) {
        await this.processCategory(page, category, mainUrl);
      }
      
      console.log(`\n📊 After schedules: ${this.activities.length} activities`);
      
      // Strategy 2: Process program categories
      if (this.activities.length < 1700) {
        console.log('\n📍 Strategy 2: Processing program categories...');
        
        const programCategories = await page.evaluate(() => {
          const links = Array.from(document.querySelectorAll('a'));
          return links
            .map(a => a.textContent?.trim())
            .filter(text => text && 
                   (text.includes('Arts') || text.includes('Sports') || 
                    text.includes('Fitness') || text.includes('Swimming') ||
                    text.includes('Dance') || text.includes('Camps') ||
                    text.includes('Youth') || text.includes('Adult') ||
                    text.includes('Child') || text.includes('Family')) &&
                   !text.includes('Schedule'))
            .filter((v, i, a) => a.indexOf(v) === i); // Remove duplicates
        });
        
        console.log(`Found ${programCategories.length} program categories`);
        
        // Process in batches for efficiency
        const batchSize = 10;
        for (let i = 0; i < programCategories.length && this.activities.length < 1700; i += batchSize) {
          const batch = programCategories.slice(i, i + batchSize);
          console.log(`\n📦 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(programCategories.length/batchSize)}`);
          
          for (const category of batch) {
            await this.processCategory(page, category, mainUrl);
            
            if (this.activities.length >= 1700) {
              console.log('\n🎉 Success! Found 1700+ activities!');
              break;
            }
          }
        }
      }
      
      // Strategy 3: Direct URL access to known calendars
      if (this.activities.length < 1700) {
        console.log('\n📍 Strategy 3: Direct calendar access...');
        await this.processDirectUrls(page);
      }
      
      console.log(`\n✅ Scraping complete!`);
      console.log(`📊 Total unique activities: ${this.activities.length}`);
      
      // Save results
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `nvrc_optimized_${timestamp}.json`;
      
      fs.writeFileSync(filename, JSON.stringify({
        timestamp: new Date().toISOString(),
        totalActivities: this.activities.length,
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

  async processCategory(page, category, mainUrl) {
    try {
      console.log(`  📂 Processing: ${category}`);
      
      // Check if we're on the main page
      if (page.url() !== mainUrl) {
        await page.goto(mainUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await this.wait(1000);
      }
      
      // Click the category
      const clicked = await page.evaluate((text) => {
        const link = Array.from(document.querySelectorAll('a'))
          .find(a => a.textContent?.trim() === text);
        if (link) {
          link.click();
          return true;
        }
        return false;
      }, category);
      
      if (!clicked) {
        console.log(`    ⚠️ Could not click ${category}`);
        return;
      }
      
      // Wait for navigation
      await this.wait(2000);
      
      const currentUrl = page.url();
      
      // Skip if we've already processed this URL
      if (this.processedUrls.has(currentUrl)) {
        console.log(`    ⏭️ Already processed this URL`);
        return;
      }
      
      this.processedUrls.add(currentUrl);
      
      // Quick check if page has content
      const hasContent = await page.evaluate(() => {
        return document.querySelectorAll('tr').length > 5 ||
               document.body.innerText.includes('$') ||
               document.body.innerText.includes('Sign Up');
      });
      
      if (!hasContent) {
        console.log(`    ⏭️ No activities found`);
        return;
      }
      
      // Extract activities
      const activities = await this.extractActivities(page, category);
      console.log(`    ✅ Found ${activities.length} activities`);
      
      // Quick check for date navigation
      const hasDates = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('*')).some(el => {
          const text = el.textContent?.trim() || '';
          return /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun).*\d+/.test(text) && text.length < 20;
        });
      });
      
      if (hasDates && activities.length < 50) {
        // Only process dates if we didn't find many activities
        await this.processDateNav(page, category);
      }
      
    } catch (error) {
      console.error(`    ❌ Error: ${error.message}`);
    }
  }

  async processDateNav(page, category) {
    try {
      const dates = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a, button, span'))
          .filter(el => {
            const text = el.textContent?.trim() || '';
            return /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun).*\d+/.test(text) && text.length < 20;
          })
          .map(el => el.textContent?.trim())
          .filter((v, i, a) => a.indexOf(v) === i)
          .slice(0, 3); // Just first 3 dates
      });
      
      for (const date of dates) {
        const clicked = await page.evaluate((dateText) => {
          const el = Array.from(document.querySelectorAll('a, button, span'))
            .find(e => e.textContent?.trim() === dateText);
          if (el) {
            el.click();
            return true;
          }
          return false;
        }, date);
        
        if (clicked) {
          await this.wait(1000);
          await this.extractActivities(page, `${category} - ${date}`);
        }
      }
    } catch (e) {
      // Continue
    }
  }

  async extractActivities(page, context) {
    const pageActivities = await page.evaluate(() => {
      const results = [];
      const seen = new Set();
      
      // Fast extraction from table rows
      const rows = Array.from(document.querySelectorAll('tr'));
      
      rows.forEach((row, index) => {
        const text = row.innerText || row.textContent || '';
        
        if (!seen.has(text) && text.length > 20 && text.length < 1000) {
          if (text.includes('$') || text.includes('Sign Up') || text.includes('Register')) {
            seen.add(text);
            
            const cells = Array.from(row.querySelectorAll('td'));
            const idMatch = text.match(/#(\d{6})/);
            const priceMatch = text.match(/\$([0-9,]+(?:\.\d{2})?)/);
            
            let name = cells[0]?.innerText?.trim() || text.split('\n')[0] || '';
            name = name.replace(/#\d+/, '').trim();
            
            if (name && name.length > 3 && name !== 'Course') {
              results.push({
                id: idMatch ? idMatch[1] : `row_${index}`,
                courseId: idMatch ? idMatch[1] : null,
                name: name.substring(0, 100),
                price: priceMatch ? priceMatch[1] : null
              });
            }
          }
        }
      });
      
      return results;
    });
    
    // Add unique activities
    let added = 0;
    pageActivities.forEach(activity => {
      const id = activity.courseId || activity.id;
      if (!this.seenIds.has(id)) {
        this.seenIds.add(id);
        this.activities.push({
          ...activity,
          category: context
        });
        added++;
      }
    });
    
    if (added > 0) {
      console.log(`      ➕ Added ${added} new activities (Total: ${this.activities.length})`);
    }
    
    return pageActivities;
  }

  async processDirectUrls(page) {
    console.log('  🔍 Accessing calendar URLs directly...');
    
    // Base URL pattern
    const baseUrl = 'https://nvrc.perfectmind.com/23734/Clients/BookMe4BookingPages/';
    const widgetParam = 'widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a';
    
    // Try different endpoints
    const endpoints = [
      'Classes',
      'BookingCoursesPage',
      'Courses',
      'Programs'
    ];
    
    // Generate calendar IDs (common patterns)
    const calendarPatterns = [
      'Classes?calendarId=',
      'BookingCoursesPage?calendarId='
    ];
    
    let attempts = 0;
    const maxAttempts = 20;
    
    for (const pattern of calendarPatterns) {
      for (const endpoint of endpoints) {
        if (this.activities.length >= 1700 || attempts >= maxAttempts) break;
        
        // Try with a generated calendar ID
        const url = `${baseUrl}${pattern}00000000-0000-0000-0000-000000000001&${widgetParam}`;
        
        try {
          attempts++;
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
          await this.wait(1000);
          
          const hasActivities = await page.evaluate(() => {
            return document.querySelectorAll('tr').length > 5;
          });
          
          if (hasActivities) {
            const activities = await this.extractActivities(page, 'Direct URL');
            console.log(`    Found ${activities.length} activities at ${url.substring(0, 60)}...`);
          }
          
        } catch (e) {
          // Continue
        }
      }
    }
  }
}

// Run if called directly
if (require.main === module) {
  const scraper = new NVRCOptimized({ headless: true });
  scraper.scrape()
    .then(activities => {
      console.log(`\n✅ Done! Found ${activities.length} activities`);
      if (activities.length > 0) {
        console.log('\nSample activities:');
        activities.slice(0, 5).forEach((a, i) => {
          console.log(`${i+1}. ${a.name} (ID: ${a.courseId || a.id})`);
        });
      }
    })
    .catch(console.error);
}

module.exports = NVRCOptimized;