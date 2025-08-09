const puppeteer = require('puppeteer');
const fs = require('fs');

class NVRCWorking {
  constructor(options = {}) {
    this.options = options;
    this.activities = [];
    this.seenIds = new Set();
    this.processedCategories = new Set();
  }

  async scrape() {
    let browser;
    
    try {
      console.log('🚀 Starting NVRC Working Scraper...');
      console.log('🎯 Goal: Extract ALL 1700+ activities using navigation approach');
      
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
      
      // Priority categories based on expected activity count
      const priorityCategories = [
        'Racquetball & Squash Courts', // 800+ activities
        'Swimming', // 200+ activities
        'Fitness Centre', // 100+ activities
        'Open Gym Schedules', // 50 activities
        'Swim Schedules', // 55 activities
        'Badminton Courts', // 45 activities
        'Table Tennis', // 50 activities
        'Tennis Courts', // 50 activities
        'Pickleball Courts', // 25 activities
        'Camps', // 100+ activities
        'Birthday Parties', // 30 activities
        'Private Lessons', // 30 activities
        'Arts Woodworking', // 30 activities
        'Arts Dance', // 30 activities
        'Pottery Studio', // 30 activities
        'Youth Services', // 50 activities
        'Child & Family', // 30 activities
        'Sports', // 30 activities
        'Fitness Classes' // 50 activities
      ];
      
      // Process priority categories first
      console.log('\n📍 Phase 1: Processing high-priority categories...');
      
      for (const category of priorityCategories) {
        if (this.activities.length >= 1700) {
          console.log('\n🎉 Success! Found 1700+ activities!');
          break;
        }
        
        if (this.processedCategories.has(category)) continue;
        
        console.log(`\n📂 Processing: ${category}`);
        
        try {
          // Always navigate to main page first
          await page.goto(mainUrl, { waitUntil: 'networkidle0', timeout: 30000 });
          await this.wait(2000);
          
          // Click on the category
          const clicked = await page.evaluate((categoryName) => {
            const links = Array.from(document.querySelectorAll('a'));
            const target = links.find(a => a.textContent?.trim() === categoryName);
            if (target) {
              target.click();
              return true;
            }
            return false;
          }, category);
          
          if (!clicked) {
            console.log(`  ⚠️ Could not find/click ${category}`);
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
          
          // Extract activities
          const activities = await this.extractActivities(page, category);
          console.log(`  ✅ Found ${activities.length} activities`);
          
          this.processedCategories.add(category);
          console.log(`  📊 Total activities: ${this.activities.length}`);
          
        } catch (error) {
          console.error(`  ❌ Error: ${error.message}`);
        }
      }
      
      // Phase 2: Process all remaining categories if needed
      if (this.activities.length < 1700) {
        console.log('\n📍 Phase 2: Processing remaining categories...');
        
        await page.goto(mainUrl, { waitUntil: 'networkidle0', timeout: 30000 });
        await this.wait(2000);
        
        const allCategories = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('a'))
            .map(a => a.textContent?.trim())
            .filter(text => text && 
                   text.length > 2 && 
                   !text.includes('Login') &&
                   !text.includes('Skip') &&
                   !text.includes('Advanced search') &&
                   !text.includes('Show More') &&
                   !text.includes('Register') &&
                   (text.includes('Schedule') || 
                    text.includes('Arts') || 
                    text.includes('Sports') || 
                    text.includes('Fitness') || 
                    text.includes('Swimming') || 
                    text.includes('Dance') || 
                    text.includes('Youth') || 
                    text.includes('Adult') || 
                    text.includes('Family') || 
                    text.includes('Child') || 
                    text.includes('Camp') || 
                    text.includes('Court') || 
                    text.includes('Tennis') || 
                    text.includes('Program')));
        });
        
        console.log(`Found ${allCategories.length} total categories`);
        
        for (const category of allCategories) {
          if (this.activities.length >= 1700) break;
          if (this.processedCategories.has(category)) continue;
          
          console.log(`\n📂 Processing: ${category}`);
          
          try {
            await page.goto(mainUrl, { waitUntil: 'networkidle0', timeout: 30000 });
            await this.wait(1500);
            
            const clicked = await page.evaluate((categoryName) => {
              const links = Array.from(document.querySelectorAll('a'));
              const target = links.find(a => a.textContent?.trim() === categoryName);
              if (target) {
                target.click();
                return true;
              }
              return false;
            }, category);
            
            if (clicked) {
              await this.wait(2000);
              const activities = await this.extractActivities(page, category);
              if (activities.length > 0) {
                console.log(`  ✅ Found ${activities.length} activities`);
                this.processedCategories.add(category);
              }
            }
          } catch (error) {
            console.error(`  ❌ Error: ${error.message}`);
          }
        }
      }
      
      console.log(`\n✅ Scraping complete!`);
      console.log(`📊 Total unique activities: ${this.activities.length}`);
      console.log(`📊 Categories processed: ${this.processedCategories.size}`);
      
      // Save results
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `nvrc_working_${timestamp}.json`;
      
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

  async extractActivities(page, category) {
    const pageActivities = await page.evaluate(() => {
      const results = [];
      const seen = new Set();
      
      // Method 1: Look for course IDs in the page
      const body = document.body?.innerText || '';
      const courseIdMatches = body.match(/#(\d{6})/g) || [];
      
      // Method 2: Extract from table rows
      const rows = Array.from(document.querySelectorAll('tr'));
      
      rows.forEach((row, index) => {
        const text = row.innerText || row.textContent || '';
        
        if (!seen.has(text) && text.length > 20 && text.length < 1000) {
          const hasPrice = text.includes('$');
          const hasAction = text.includes('Sign Up') || text.includes('Register') || 
                           text.includes('Waitlist') || text.includes('Full');
          const idMatch = text.match(/#(\d{6})/);
          
          if ((hasPrice || hasAction || idMatch) && !text.includes('Filter')) {
            seen.add(text);
            
            const cells = Array.from(row.querySelectorAll('td'));
            const priceMatch = text.match(/\$([0-9,]+(?:\.\d{2})?)/);
            
            let name = '';
            if (cells.length > 0) {
              name = cells[0].innerText?.trim() || '';
            }
            if (!name || name.length < 5) {
              const lines = text.split('\n').filter(l => l.trim());
              name = lines.find(l => l.length > 10 && !l.includes('$') && !l.includes('#')) || lines[0] || '';
            }
            name = name.replace(/#\d+/, '').trim();
            
            if (name && name.length > 3 && !name.includes('Course')) {
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
      
      // Method 3: If no rows found, try to extract from course ID matches
      if (results.length === 0 && courseIdMatches.length > 0) {
        courseIdMatches.forEach((match, index) => {
          const id = match.replace('#', '');
          if (!seen.has(id)) {
            seen.add(id);
            results.push({
              id: id,
              courseId: id,
              name: `Activity ${id}`,
              price: null
            });
          }
        });
      }
      
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
}

// Run if called directly
if (require.main === module) {
  const scraper = new NVRCWorking({ headless: true });
  scraper.scrape()
    .then(activities => {
      console.log(`\n✅ Done! Found ${activities.length} activities`);
      if (activities.length > 0) {
        console.log('\nFirst 10 activities:');
        activities.slice(0, 10).forEach((a, i) => {
          console.log(`${i+1}. ${a.name} (ID: ${a.courseId || a.id})`);
          if (a.price) console.log(`   Price: $${a.price}`);
        });
      }
    })
    .catch(console.error);
}

module.exports = NVRCWorking;