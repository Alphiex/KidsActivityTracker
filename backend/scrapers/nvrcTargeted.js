const puppeteer = require('puppeteer');
const fs = require('fs');

class NVRCTargeted {
  constructor(options = {}) {
    this.options = options;
    this.activities = [];
    this.seenIds = new Set();
  }

  async scrape() {
    let browser;
    
    try {
      console.log('🚀 Starting NVRC Targeted Scraper...');
      console.log('🎯 Goal: Extract 1700+ activities by targeting high-value pages directly');
      
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
      
      // Based on our analysis, these URLs contain the most activities
      const targetUrls = [
        // HIGHEST PRIORITY - Known to have 800+ activities
        { url: 'https://nvrc.perfectmind.com/23734/Clients/BookMe4BookingPages/BookingCoursesPage?calendarId=2b11fa66-0224-49f1-a0e4-9a0c968c2d43&widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a', name: 'Racquetball & Squash Courts', expected: 800 },
        
        // HIGH PRIORITY - Swimming programs (200+ activities)
        { url: 'https://nvrc.perfectmind.com/23734/Clients/BookMe4BookingPages/BookingCoursesPage?calendarId=fca5a3ca-8b77-47dc-856d-7d96e96c5a6e&widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a', name: 'Swimming', expected: 200 },
        { url: 'https://nvrc.perfectmind.com/23734/Clients/BookMe4BookingPages/BookingCoursesPage?calendarId=d6f27f67-c21f-4cf5-b3ba-53f1b17fe69f&widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a', name: 'Swimming Programs', expected: 150 },
        
        // MEDIUM PRIORITY - Fitness and courts (100+ activities each)
        { url: 'https://nvrc.perfectmind.com/23734/Clients/BookMe4BookingPages/BookingCoursesPage?calendarId=ba5b8dc8-39a6-41f0-adb5-2b2e52bb5b1f&widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a', name: 'Fitness Centre', expected: 100 },
        { url: 'https://nvrc.perfectmind.com/23734/Clients/BookMe4BookingPages/BookingCoursesPage?calendarId=5154b55f-6147-43c4-9a96-1659f8e89cfc&widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a', name: 'Badminton Courts', expected: 45 },
        { url: 'https://nvrc.perfectmind.com/23734/Clients/BookMe4BookingPages/BookingCoursesPage?calendarId=09551e5e-7aea-4a71-9d15-bbca721fc9d4&widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a', name: 'Table Tennis', expected: 50 },
        { url: 'https://nvrc.perfectmind.com/23734/Clients/BookMe4BookingPages/BookingCoursesPage?calendarId=bc73b5e5-e6a0-4c2f-abe0-08b43afc4b11&widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a', name: 'Pickleball Courts', expected: 25 },
        { url: 'https://nvrc.perfectmind.com/23734/Clients/BookMe4BookingPages/BookingCoursesPage?calendarId=82508b9b-51ca-4c27-8a67-2c7cb5f8a972&widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a', name: 'Tennis Courts', expected: 50 },
        
        // CAMPS AND YOUTH (100+ activities)
        { url: 'https://nvrc.perfectmind.com/23734/Clients/BookMe4BookingPages/BookingCoursesPage?calendarId=b72a5c50-8daf-490f-8357-d983e889c0ba&widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a', name: 'Camps', expected: 100 },
        { url: 'https://nvrc.perfectmind.com/23734/Clients/BookMe4BookingPages/BookingCoursesPage?calendarId=00f5b7f8-d91b-40f7-b7f0-4e3d63ad6b62&widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a', name: 'Youth Services', expected: 50 },
        
        // ARTS PROGRAMS (50+ activities)
        { url: 'https://nvrc.perfectmind.com/23734/Clients/BookMe4BookingPages/BookingCoursesPage?calendarId=2b8b4f88-50fb-45dd-91f0-9f0819363cd7&widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a', name: 'Arts Dance', expected: 30 },
        { url: 'https://nvrc.perfectmind.com/23734/Clients/BookMe4BookingPages/BookingCoursesPage?calendarId=f7de8db8-8c20-4709-9e2e-39e973ac6a81&widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a', name: 'Arts Woodworking', expected: 30 },
        { url: 'https://nvrc.perfectmind.com/23734/Clients/BookMe4BookingPages/BookingCoursesPage?calendarId=d693fa52-eb4b-4d0e-9fc7-5c96e14dd2a7&widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a', name: 'Pottery Studio', expected: 30 },
        
        // FITNESS CLASSES
        { url: 'https://nvrc.perfectmind.com/23734/Clients/BookMe4BookingPages/BookingCoursesPage?calendarId=f6c13a5f-ce70-457f-acc0-5f0d95d32f47&widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a', name: 'Fitness Classes', expected: 50 },
        
        // SPECIAL PROGRAMS
        { url: 'https://nvrc.perfectmind.com/23734/Clients/BookMe4BookingPages/BookingCoursesPage?calendarId=fcf6a6f8-eda7-48fa-bcd5-7ddccb93a5a6&widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a', name: 'Birthday Parties', expected: 30 },
        { url: 'https://nvrc.perfectmind.com/23734/Clients/BookMe4BookingPages/BookingCoursesPage?calendarId=84b7c5e9-7e1f-4c16-9d8e-bfa2de0e0d52&widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a', name: 'Private Lessons', expected: 30 },
        
        // Additional program pages
        { url: 'https://nvrc.perfectmind.com/23734/Clients/BookMe4BookingPages/BookingCoursesPage?calendarId=e5c14b83-2e21-4ba9-9e72-c891b99bbdce&widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a', name: 'Adult Programs', expected: 30 },
        { url: 'https://nvrc.perfectmind.com/23734/Clients/BookMe4BookingPages/BookingCoursesPage?calendarId=2c1be512-7344-4b07-8e42-39e9b6b56a9e&widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a', name: 'Child & Family', expected: 30 },
        { url: 'https://nvrc.perfectmind.com/23734/Clients/BookMe4BookingPages/BookingCoursesPage?calendarId=3503e7bc-a6a6-418f-ba61-d926c5c8f49e&widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a', name: 'Sports', expected: 30 }
      ];
      
      let totalExpected = 0;
      
      // Process each URL directly
      for (const target of targetUrls) {
        if (this.activities.length >= 1700) {
          console.log('\n🎉 Success! Found 1700+ activities!');
          break;
        }
        
        console.log(`\n📂 Processing ${target.name} (expecting ~${target.expected} activities)...`);
        totalExpected += target.expected;
        
        try {
          await page.goto(target.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
          await this.wait(3000);
          
          // Check if page has activities
          const hasActivities = await page.evaluate(() => {
            const text = document.body.innerText || '';
            return text.includes('$') || text.includes('Sign Up') || text.includes('Register');
          });
          
          if (hasActivities) {
            // Look for "Show" buttons to expand content
            const expanded = await this.expandAllSections(page);
            if (expanded > 0) {
              console.log(`  ✅ Expanded ${expanded} sections`);
              await this.wait(2000);
            }
            
            // Extract activities
            const activities = await this.extractActivities(page, target.name);
            console.log(`  ✅ Found ${activities.length} activities`);
            
            // Check for pagination or date navigation
            const hasMore = await this.checkForMoreContent(page);
            if (hasMore) {
              console.log(`  📍 Processing additional pages/dates...`);
              await this.processAdditionalContent(page, target.name);
            }
          } else {
            console.log(`  ⚠️ No activities found on this page`);
          }
          
          console.log(`  📊 Total activities so far: ${this.activities.length}`);
          console.log(`  📊 Expected total so far: ${totalExpected}`);
          
        } catch (error) {
          console.error(`  ❌ Error: ${error.message}`);
        }
      }
      
      console.log(`\n✅ Scraping complete!`);
      console.log(`📊 Total unique activities: ${this.activities.length}`);
      
      // Save results
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `nvrc_targeted_${timestamp}.json`;
      
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
          return (text === 'show' || text === 'show all' || text === 'show more' || text === 'view all') &&
                 el.offsetParent !== null &&
                 !el.querySelector('*');
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

  async checkForMoreContent(page) {
    return await page.evaluate(() => {
      // Check for pagination
      const hasPageNumbers = Array.from(document.querySelectorAll('a, button')).some(el => {
        const text = el.textContent?.trim() || '';
        return /^\d+$/.test(text) || text === 'Next' || text === '>';
      });
      
      // Check for date navigation
      const hasDateNav = Array.from(document.querySelectorAll('*')).some(el => {
        const text = el.textContent?.trim() || '';
        return /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)/.test(text) && text.length < 20;
      });
      
      return hasPageNumbers || hasDateNav;
    });
  }

  async processAdditionalContent(page, category) {
    // Try to click "Next" or page numbers
    for (let i = 0; i < 5; i++) { // Process up to 5 additional pages
      const clicked = await page.evaluate(() => {
        // Try "Next" button
        const nextBtn = Array.from(document.querySelectorAll('a, button')).find(el => {
          const text = el.textContent?.trim() || '';
          return text === 'Next' || text === '>' || text === (i + 2).toString();
        });
        
        if (nextBtn) {
          nextBtn.click();
          return true;
        }
        return false;
      });
      
      if (clicked) {
        await this.wait(2000);
        const activities = await this.extractActivities(page, `${category} - Page ${i + 2}`);
        console.log(`    Found ${activities.length} more activities`);
      } else {
        break;
      }
    }
  }

  async extractActivities(page, category) {
    const pageActivities = await page.evaluate(() => {
      const results = [];
      const seen = new Set();
      
      // Extract from table rows
      const rows = Array.from(document.querySelectorAll('tr'));
      
      rows.forEach((row, index) => {
        const text = row.innerText || row.textContent || '';
        
        if (!seen.has(text) && text.length > 20 && text.length < 1000) {
          const hasPrice = text.includes('$');
          const hasAction = text.includes('Sign Up') || text.includes('Register') || 
                           text.includes('Waitlist') || text.includes('Full');
          
          if (hasPrice || hasAction) {
            seen.add(text);
            
            const cells = Array.from(row.querySelectorAll('td'));
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
      
      // Also check for activity containers
      if (results.length === 0) {
        const containers = Array.from(document.querySelectorAll('div[class*="course"], div[class*="program"], div[class*="activity"]'));
        
        containers.forEach((container, index) => {
          const text = container.innerText || '';
          if (!seen.has(text) && text.includes('$')) {
            seen.add(text);
            
            const lines = text.split('\n').filter(l => l.trim());
            const name = lines[0] || 'Unknown';
            const priceMatch = text.match(/\$([0-9,]+(?:\.\d{2})?)/);
            
            results.push({
              id: `container_${index}`,
              name: name.substring(0, 150),
              price: priceMatch ? priceMatch[1] : null
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
  const scraper = new NVRCTargeted({ headless: true });
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

module.exports = NVRCTargeted;