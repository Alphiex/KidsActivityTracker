const puppeteer = require('puppeteer');
const fs = require('fs');

class NVRCRobust {
  constructor(options = {}) {
    this.options = options;
    this.activities = [];
    this.seenIds = new Set();
  }

  async scrape() {
    let browser;
    
    try {
      console.log('🚀 Starting NVRC Robust Scraper...');
      console.log('🎯 Goal: Extract ALL 1700+ activities using robust navigation');
      
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
      
      // Step 1: Get all program links from main page
      console.log('\n📍 Step 1: Collecting all program links...');
      await page.goto(mainUrl, { waitUntil: 'networkidle0', timeout: 60000 });
      await this.wait(3000);
      
      const programData = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a'));
        const programs = [];
        
        links.forEach((link, index) => {
          const text = link.textContent?.trim() || '';
          if (text && text.length > 2 && !text.includes('Login')) {
            // Store the index so we can find it again
            programs.push({
              text: text,
              index: index
            });
          }
        });
        
        return programs;
      });
      
      console.log(`Found ${programData.length} program links`);
      
      // Step 2: Process each program systematically
      console.log('\n📍 Step 2: Processing each program...');
      
      for (let i = 0; i < programData.length; i++) {
        const program = programData[i];
        
        // Skip non-program links
        if (program.text.includes('Show More') || 
            program.text.includes('Advanced search') ||
            program.text.includes('Skip') ||
            program.text.includes('Register') && program.text.length < 10) {
          continue;
        }
        
        console.log(`\n📂 [${i + 1}/${programData.length}] Processing: ${program.text}`);
        
        try {
          // Always start from main page for consistency
          await page.goto(mainUrl, { waitUntil: 'networkidle0', timeout: 30000 });
          await this.wait(2000);
          
          // Click the link by index
          const navigationPromise = page.waitForNavigation({ 
            waitUntil: 'networkidle0', 
            timeout: 10000 
          }).catch(() => null);
          
          const clicked = await page.evaluate((index) => {
            const links = Array.from(document.querySelectorAll('a'));
            if (links[index]) {
              links[index].click();
              return true;
            }
            return false;
          }, program.index);
          
          if (!clicked) {
            console.log(`  ⚠️ Could not click link`);
            continue;
          }
          
          // Wait for navigation or timeout
          await navigationPromise;
          await this.wait(2000);
          
          // Check if we navigated
          const currentUrl = page.url();
          if (currentUrl === mainUrl) {
            console.log(`  ⚠️ No navigation occurred`);
            continue;
          }
          
          console.log(`  ✅ Navigated to: ${currentUrl.substring(0, 80)}...`);
          
          // Extract activities from this page
          const activities = await this.extractAllActivities(page, program.text);
          console.log(`  ✅ Found ${activities.length} activities`);
          
          // Check for "Show" buttons and expand
          const expanded = await this.expandAllSections(page);
          if (expanded > 0) {
            console.log(`  ✅ Expanded ${expanded} sections`);
            const moreActivities = await this.extractAllActivities(page, program.text);
            console.log(`  ✅ Found ${moreActivities.length} more activities after expansion`);
          }
          
          console.log(`  📊 Total activities so far: ${this.activities.length}`);
          
          // Stop if we have enough
          if (this.activities.length >= 1700) {
            console.log('\n🎉 Success! Found 1700+ activities!');
            break;
          }
          
        } catch (error) {
          console.error(`  ❌ Error: ${error.message}`);
        }
      }
      
      // Step 3: If still need more, try direct URLs
      if (this.activities.length < 1700) {
        console.log('\n📍 Step 3: Trying direct calendar URLs...');
        await this.tryKnownUrls(page);
      }
      
      console.log(`\n✅ Scraping complete!`);
      console.log(`📊 Total unique activities: ${this.activities.length}`);
      
      // Save results
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `nvrc_robust_${timestamp}.json`;
      
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

  async expandAllSections(page) {
    try {
      return await page.evaluate(() => {
        let expanded = 0;
        
        // Find all "Show" elements
        const showElements = Array.from(document.querySelectorAll('*')).filter(el => {
          const text = el.textContent?.trim().toLowerCase();
          return (text === 'show' || text === 'show all' || text === 'show more') &&
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

  async extractAllActivities(page, category) {
    const pageActivities = await page.evaluate(() => {
      const results = [];
      const seen = new Set();
      
      // Method 1: Extract from tables
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
            const timeMatch = text.match(/(\d{1,2}:\d{2}\s*[ap]\.?m\.?\s*-\s*\d{1,2}:\d{2}\s*[ap]\.?m\.?)/i);
            
            let name = '';
            if (cells.length > 0) {
              name = cells[0].innerText?.trim() || '';
            }
            if (!name) {
              const lines = text.split('\n').filter(l => l.trim());
              name = lines[0] || '';
            }
            name = name.replace(/#\d+/, '').trim();
            
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
            
            if (name && name.length > 3 && name !== 'Course') {
              results.push({
                id: idMatch ? idMatch[1] : `row_${index}`,
                courseId: idMatch ? idMatch[1] : null,
                name: name.substring(0, 150),
                price: priceMatch ? priceMatch[1] : null,
                time: timeMatch ? timeMatch[1] : null,
                location: location,
                rawText: text.substring(0, 300)
              });
            }
          }
        }
      });
      
      // Method 2: Look for activity containers
      if (results.length === 0) {
        const containers = Array.from(document.querySelectorAll('div, section, article, li'));
        
        containers.forEach((container, index) => {
          const text = container.innerText || container.textContent || '';
          
          if (!seen.has(text) && 
              text.length > 30 && 
              text.length < 500 &&
              (text.includes('$') || text.includes('Register'))) {
            
            seen.add(text);
            
            const lines = text.split('\n').filter(l => l.trim());
            const name = lines[0] || 'Unknown';
            
            const priceMatch = text.match(/\$([0-9,]+(?:\.\d{2})?)/);
            const idMatch = text.match(/#(\d{6})/);
            
            results.push({
              id: idMatch ? idMatch[1] : `container_${index}`,
              courseId: idMatch ? idMatch[1] : null,
              name: name.substring(0, 150),
              price: priceMatch ? priceMatch[1] : null,
              rawText: text.substring(0, 300)
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

  async tryKnownUrls(page) {
    // Known working calendar URLs from our testing
    const knownUrls = [
      // Schedules
      'https://nvrc.perfectmind.com/23734/Clients/BookMe4BookingPages/Classes?calendarId=ac98512e-5adf-4555-97b1-d7d76492dd5f&widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a', // Art Studio
      'https://nvrc.perfectmind.com/23734/Clients/BookMe4BookingPages/Classes?calendarId=ae8005d5-2f4f-44cd-9ebb-ed077f609dfc&widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a', // North Shore
      'https://nvrc.perfectmind.com/23734/Clients/BookMe4BookingPages/Classes?calendarId=d313e7d8-0d72-4e0b-92c5-98d8017ab64e&widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a', // Open Gym
      'https://nvrc.perfectmind.com/23734/Clients/BookMe4BookingPages/Classes?calendarId=002670b7-9d8e-464c-8e2e-aa4a44e20408&widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a', // Parkgate
      'https://nvrc.perfectmind.com/23734/Clients/BookMe4BookingPages/Classes?calendarId=fabf60eb-7cf3-40c3-8004-79e50fdc6db0&widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a', // Swim
      // Program pages
      'https://nvrc.perfectmind.com/23734/Clients/BookMe4BookingPages/BookingCoursesPage?calendarId=2b8b4f88-50fb-45dd-91f0-9f0819363cd7&widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a', // Arts Dance
      'https://nvrc.perfectmind.com/23734/Clients/BookMe4BookingPages/BookingCoursesPage?calendarId=fca5a3ca-8b77-47dc-856d-7d96e96c5a6e&widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a', // Swimming
    ];
    
    for (const url of knownUrls) {
      if (this.activities.length >= 1700) break;
      
      console.log(`  📍 Trying: ${url.substring(0, 80)}...`);
      
      try {
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
        await this.wait(2000);
        
        const activities = await this.extractAllActivities(page, 'Direct URL');
        console.log(`    Found ${activities.length} activities`);
        
        // Try expanding
        const expanded = await this.expandAllSections(page);
        if (expanded > 0) {
          const moreActivities = await this.extractAllActivities(page, 'Direct URL - Expanded');
          console.log(`    Found ${moreActivities.length} more after expansion`);
        }
        
      } catch (e) {
        console.log(`    ⚠️ Failed: ${e.message}`);
      }
    }
  }
}

// Run if called directly
if (require.main === module) {
  const scraper = new NVRCRobust({ headless: true });
  scraper.scrape()
    .then(activities => {
      console.log(`\n✅ Done! Found ${activities.length} activities`);
      if (activities.length > 0) {
        console.log('\nFirst 10 activities:');
        activities.slice(0, 10).forEach((a, i) => {
          console.log(`${i+1}. ${a.name}`);
          if (a.price) console.log(`   Price: $${a.price}`);
          if (a.location) console.log(`   Location: ${a.location}`);
          if (a.courseId) console.log(`   Course ID: ${a.courseId}`);
        });
      }
    })
    .catch(console.error);
}

module.exports = NVRCRobust;