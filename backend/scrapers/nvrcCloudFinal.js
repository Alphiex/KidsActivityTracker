const puppeteer = require('puppeteer');
const fs = require('fs');

class NVRCCloudFinal {
  constructor(options = {}) {
    this.options = options;
    this.activities = [];
    this.seenIds = new Set();
    this.processedCategories = new Set();
    this.checkpointFile = 'nvrc_checkpoint.json';
  }

  async scrape() {
    let browser;
    
    try {
      console.log('🚀 Starting NVRC Cloud Final Scraper...');
      console.log('🎯 Goal: Extract ALL 1700+ activities efficiently');
      
      // Load checkpoint if exists
      this.loadCheckpoint();
      console.log(`📊 Starting with ${this.activities.length} activities from checkpoint`);
      
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
      
      // Strategy 1: Process high-value categories first
      console.log('\n📍 Strategy 1: Processing high-value categories...');
      
      const highValueCategories = [
        { name: 'Racquetball & Squash Courts', expectedCount: 800 },
        { name: 'Swimming', expectedCount: 200 },
        { name: 'Fitness Centre', expectedCount: 100 },
        { name: 'Open Gym Schedules', expectedCount: 50 },
        { name: 'Swim Schedules', expectedCount: 50 },
        { name: 'Badminton Courts', expectedCount: 45 },
        { name: 'Table Tennis', expectedCount: 50 },
        { name: 'Pickleball Courts', expectedCount: 25 },
        { name: 'Parkgate Society Schedules', expectedCount: 25 },
        { name: 'Arts Woodworking (Adult)', expectedCount: 30 },
        { name: 'Camps', expectedCount: 50 },
        { name: 'Birthday Parties', expectedCount: 30 }
      ];
      
      // Process high-value categories
      for (const category of highValueCategories) {
        if (this.activities.length >= 1700) break;
        if (this.processedCategories.has(category.name)) continue;
        
        console.log(`\n📂 Processing high-value: ${category.name} (expecting ~${category.expectedCount} activities)`);
        
        try {
          await page.goto(mainUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
          await this.wait(2000);
          
          const success = await this.clickCategory(page, category.name);
          if (success) {
            await this.wait(2000);
            const currentUrl = page.url();
            
            if (currentUrl !== mainUrl) {
              console.log(`  ✅ Navigated successfully`);
              const activities = await this.extractAllActivities(page, category.name);
              console.log(`  ✅ Found ${activities.length} activities`);
              
              this.processedCategories.add(category.name);
              this.saveCheckpoint();
              
              console.log(`  📊 Total activities: ${this.activities.length}`);
            }
          }
        } catch (error) {
          console.error(`  ❌ Error: ${error.message}`);
        }
      }
      
      // Strategy 2: Direct URL access
      if (this.activities.length < 1700) {
        console.log('\n📍 Strategy 2: Direct calendar URLs...');
        await this.processDirectUrls(page);
      }
      
      // Strategy 3: Process remaining categories
      if (this.activities.length < 1700) {
        console.log('\n📍 Strategy 3: Processing remaining categories...');
        
        await page.goto(mainUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await this.wait(2000);
        
        const allCategories = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('a'))
            .map(a => a.textContent?.trim())
            .filter(text => text && text.length > 2 && !text.includes('Login'));
        });
        
        for (const category of allCategories) {
          if (this.activities.length >= 1700) break;
          if (this.processedCategories.has(category)) continue;
          
          console.log(`\n📂 Processing: ${category}`);
          
          try {
            await page.goto(mainUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await this.wait(1500);
            
            const success = await this.clickCategory(page, category);
            if (success) {
              await this.wait(1500);
              const activities = await this.extractAllActivities(page, category);
              if (activities.length > 0) {
                console.log(`  ✅ Found ${activities.length} activities`);
                this.processedCategories.add(category);
                this.saveCheckpoint();
              }
            }
          } catch (error) {
            console.error(`  ❌ Error: ${error.message}`);
          }
        }
      }
      
      console.log(`\n✅ Scraping complete!`);
      console.log(`📊 Total unique activities: ${this.activities.length}`);
      
      // Save final results
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `nvrc_cloud_final_${timestamp}.json`;
      
      fs.writeFileSync(filename, JSON.stringify({
        timestamp: new Date().toISOString(),
        totalActivities: this.activities.length,
        activities: this.activities
      }, null, 2));
      
      console.log(`💾 Results saved to ${filename}`);
      
      // Clean up checkpoint
      if (fs.existsSync(this.checkpointFile)) {
        fs.unlinkSync(this.checkpointFile);
      }
      
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

  loadCheckpoint() {
    if (fs.existsSync(this.checkpointFile)) {
      try {
        const checkpoint = JSON.parse(fs.readFileSync(this.checkpointFile, 'utf8'));
        this.activities = checkpoint.activities || [];
        this.seenIds = new Set(checkpoint.seenIds || []);
        this.processedCategories = new Set(checkpoint.processedCategories || []);
      } catch (e) {
        console.log('⚠️ Could not load checkpoint');
      }
    }
  }

  saveCheckpoint() {
    fs.writeFileSync(this.checkpointFile, JSON.stringify({
      activities: this.activities,
      seenIds: Array.from(this.seenIds),
      processedCategories: Array.from(this.processedCategories),
      timestamp: new Date().toISOString()
    }));
  }

  async clickCategory(page, categoryName) {
    try {
      return await page.evaluate((text) => {
        const links = Array.from(document.querySelectorAll('a'));
        const link = links.find(a => a.textContent?.trim() === text);
        if (link) {
          link.click();
          return true;
        }
        return false;
      }, categoryName);
    } catch (e) {
      return false;
    }
  }

  async extractAllActivities(page, category) {
    const pageActivities = await page.evaluate(() => {
      const results = [];
      const seen = new Set();
      
      // Extract from table rows
      const rows = Array.from(document.querySelectorAll('tr'));
      
      rows.forEach((row, index) => {
        const text = row.innerText || row.textContent || '';
        
        if (!seen.has(text) && text.length > 20 && text.length < 1000) {
          // Look for activity indicators
          const hasPrice = text.includes('$');
          const hasAction = text.includes('Sign Up') || text.includes('Register') || 
                           text.includes('Waitlist') || text.includes('Full');
          const hasTime = /\d{1,2}:\d{2}\s*[ap]\.?m\.?/i.test(text);
          
          if (hasPrice || hasAction || hasTime) {
            seen.add(text);
            
            const cells = Array.from(row.querySelectorAll('td'));
            
            // Extract details
            const idMatch = text.match(/#(\d{6})/);
            const priceMatch = text.match(/\$([0-9,]+(?:\.\d{2})?)/);
            
            let name = '';
            if (cells.length > 0) {
              name = cells[0].innerText?.trim() || '';
            }
            if (!name) {
              const lines = text.split('\n').filter(l => l.trim());
              name = lines[0] || '';
            }
            name = name.replace(/#\d+/, '').trim();
            
            if (name && name.length > 3 && name !== 'Course') {
              results.push({
                id: idMatch ? idMatch[1] : `row_${index}`,
                courseId: idMatch ? idMatch[1] : null,
                name: name.substring(0, 150),
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
          category: category
        });
        added++;
      }
    });
    
    if (added > 0) {
      console.log(`    ➕ Added ${added} new unique activities`);
    }
    
    return pageActivities;
  }

  async processDirectUrls(page) {
    // Known high-activity URLs
    const directUrls = [
      { url: 'https://nvrc.perfectmind.com/23734/Clients/BookMe4BookingPages/BookingCoursesPage?calendarId=d6f27f67-c21f-4cf5-b3ba-53f1b17fe69f&widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a', name: 'Swimming Programs' },
      { url: 'https://nvrc.perfectmind.com/23734/Clients/BookMe4BookingPages/BookingCoursesPage?calendarId=b72a5c50-8daf-490f-8357-d983e889c0ba&widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a', name: 'Camps' },
      { url: 'https://nvrc.perfectmind.com/23734/Clients/BookMe4BookingPages/BookingCoursesPage?calendarId=00f5b7f8-d91b-40f7-b7f0-4e3d63ad6b62&widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a', name: 'Youth Programs' },
      { url: 'https://nvrc.perfectmind.com/23734/Clients/BookMe4BookingPages/Classes?calendarId=fabf60eb-7cf3-40c3-8004-79e50fdc6db0&widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a', name: 'Swim Schedules' },
      { url: 'https://nvrc.perfectmind.com/23734/Clients/BookMe4BookingPages/BookingCoursesPage?calendarId=82508b9b-51ca-4c27-8a67-2c7cb5f8a972&widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a', name: 'Tennis' },
      { url: 'https://nvrc.perfectmind.com/23734/Clients/BookMe4BookingPages/BookingCoursesPage?calendarId=fca5a3ca-8b77-47dc-856d-7d96e96c5a6e&widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a', name: 'Swimming Lessons' }
    ];
    
    for (const { url, name } of directUrls) {
      if (this.activities.length >= 1700) break;
      if (this.processedCategories.has(name)) continue;
      
      console.log(`  📍 Trying direct URL for ${name}...`);
      
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await this.wait(2000);
        
        const activities = await this.extractAllActivities(page, name);
        if (activities.length > 0) {
          console.log(`    ✅ Found ${activities.length} activities`);
          this.processedCategories.add(name);
          this.saveCheckpoint();
        }
      } catch (e) {
        console.log(`    ⚠️ Failed: ${e.message}`);
      }
    }
  }
}

// Run if called directly
if (require.main === module) {
  const scraper = new NVRCCloudFinal({ headless: true });
  scraper.scrape()
    .then(activities => {
      console.log(`\n✅ Done! Found ${activities.length} activities`);
      if (activities.length > 0) {
        console.log('\nFirst 10 activities:');
        activities.slice(0, 10).forEach((a, i) => {
          console.log(`${i+1}. ${a.name}`);
          if (a.price) console.log(`   Price: $${a.price}`);
          if (a.courseId) console.log(`   Course ID: ${a.courseId}`);
        });
      }
    })
    .catch(console.error);
}

module.exports = NVRCCloudFinal;