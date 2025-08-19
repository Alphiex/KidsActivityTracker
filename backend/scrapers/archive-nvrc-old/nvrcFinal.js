const puppeteer = require('puppeteer');
const fs = require('fs');

class NVRCFinal {
  constructor(options = {}) {
    this.options = options;
    this.activities = [];
    this.seenIds = new Set();
  }

  async scrape() {
    let browser;
    
    try {
      console.log('🚀 Starting NVRC Final Scraper...');
      console.log('🎯 Goal: Extract ALL 1700+ activities');
      
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
      
      // Start at the main widget page
      const mainUrl = 'https://nvrc.perfectmind.com/23734/Clients/BookMe4?widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a';
      
      console.log('\n📍 Loading main page...');
      await page.goto(mainUrl, { waitUntil: 'networkidle0', timeout: 60000 });
      await this.wait(3000);
      
      // Get all program links (they have empty hrefs but have text)
      console.log('\n🔍 Finding all program categories...');
      const programLinks = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a'));
        const programs = [];
        
        links.forEach(link => {
          const text = link.textContent?.trim() || '';
          
          // Include program-like links
          if (text && 
              text.length > 2 &&
              !text.includes('Login') &&
              !text.includes('Skip') &&
              !text.includes('Advanced search') &&
              !text.includes('Show More')) {
            
            // Check if it's likely a program link
            const isProgram = 
              text.includes('Schedule') ||
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
              text.includes('Martial') ||
              text.includes('Private') ||
              text.includes('Pottery') ||
              text.includes('Tennis') ||
              text.includes('Skating') ||
              text.includes('Gym') ||
              text.includes('Studio');
            
            programs.push({
              text: text,
              isProgram: isProgram
            });
          }
        });
        
        // Remove duplicates and sort by relevance
        const seen = new Set();
        return programs
          .filter(p => {
            if (seen.has(p.text)) return false;
            seen.add(p.text);
            return true;
          })
          .sort((a, b) => b.isProgram - a.isProgram);
      });
      
      console.log(`Found ${programLinks.length} potential program links`);
      
      // Process each program link
      for (let i = 0; i < programLinks.length; i++) {
        const program = programLinks[i];
        
        console.log(`\n📂 [${i + 1}/${programLinks.length}] Processing: ${program.text}`);
        
        try {
          // Click the link by text
          const clicked = await page.evaluate((text) => {
            const links = Array.from(document.querySelectorAll('a'));
            const link = links.find(a => a.textContent?.trim() === text);
            
            if (link) {
              // Try multiple methods to trigger the click
              try {
                link.click();
                return true;
              } catch (e1) {
                try {
                  const event = new MouseEvent('click', {
                    bubbles: true,
                    cancelable: true,
                    view: window
                  });
                  link.dispatchEvent(event);
                  return true;
                } catch (e2) {
                  return false;
                }
              }
            }
            return false;
          }, program.text);
          
          if (!clicked) {
            console.log(`  ⚠️ Could not click ${program.text}`);
            continue;
          }
          
          // Wait for navigation/content change
          await this.wait(3000);
          
          // Check if we navigated to a new page
          const currentUrl = page.url();
          const hasNavigated = currentUrl !== mainUrl;
          
          if (hasNavigated) {
            console.log(`  ✅ Navigated to: ${currentUrl.substring(0, 80)}...`);
          } else {
            console.log(`  ⚠️ No navigation occurred, checking for dynamic content...`);
          }
          
          // Check if this page has activities
          const pageInfo = await page.evaluate(() => {
            return {
              url: window.location.href,
              hasActivities: document.body.innerText.includes('$') || 
                           document.body.innerText.includes('Sign Up') ||
                           document.body.innerText.includes('Register'),
              rowCount: document.querySelectorAll('tr').length,
              linkCount: document.querySelectorAll('a').length
            };
          });
          
          console.log(`  📊 Page info:`, pageInfo);
          
          if (pageInfo.hasActivities || pageInfo.rowCount > 5) {
            // Expand all content
            await this.expandContent(page);
            
            // Extract activities
            const activities = await this.extractActivities(page, program.text);
            console.log(`  ✅ Found ${activities.length} activities`);
            
            // Process date navigation if present
            await this.processDateNav(page, program.text);
          } else {
            console.log(`  ⏭️ No activities on this page`);
          }
          
          // Navigate back to main page if we moved away
          if (hasNavigated) {
            await page.goto(mainUrl, { waitUntil: 'networkidle0', timeout: 60000 });
            await this.wait(2000);
          }
          
          console.log(`  📊 Total activities so far: ${this.activities.length}`);
          
          // Stop if we have enough
          if (this.activities.length >= 1700) {
            console.log('\n🎉 Success! Found 1700+ activities!');
            break;
          }
          
        } catch (error) {
          console.error(`  ❌ Error processing ${program.text}:`, error.message);
          
          // Try to recover
          try {
            await page.goto(mainUrl, { waitUntil: 'networkidle0', timeout: 60000 });
            await this.wait(2000);
          } catch (e) {
            console.error('  ❌ Failed to recover');
          }
        }
      }
      
      // If still not enough activities, try direct navigation to known URLs
      if (this.activities.length < 1700) {
        console.log('\n📍 Trying direct navigation to activity pages...');
        await this.tryDirectUrls(page);
      }
      
      console.log(`\n✅ Scraping complete!`);
      console.log(`📊 Total unique activities: ${this.activities.length}`);
      
      // Save results
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `nvrc_final_${timestamp}.json`;
      
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

  async expandContent(page) {
    try {
      // Click all "Show" buttons
      const expanded = await page.evaluate(() => {
        let count = 0;
        const elements = Array.from(document.querySelectorAll('*')).filter(el => {
          const text = el.textContent?.trim().toLowerCase();
          return (text === 'show' || text === 'show all' || text === 'show more') &&
                 el.offsetParent !== null;
        });
        
        elements.forEach(el => {
          try {
            el.click();
            count++;
          } catch (e) {
            // Continue
          }
        });
        
        return count;
      });
      
      if (expanded > 0) {
        console.log(`  ✅ Expanded ${expanded} sections`);
        await this.wait(1500);
      }
    } catch (e) {
      // Continue
    }
  }

  async processDateNav(page, category) {
    try {
      // Find date navigation
      const dates = await page.evaluate(() => {
        const dateElements = [];
        const elements = Array.from(document.querySelectorAll('a, button, span'));
        
        elements.forEach(el => {
          const text = el.textContent?.trim() || '';
          if (/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun).*\d+/.test(text) && 
              text.length < 20) {
            dateElements.push(text);
          }
        });
        
        return [...new Set(dateElements)];
      });
      
      if (dates.length > 0) {
        console.log(`  📅 Found ${dates.length} date tabs`);
        
        for (const date of dates.slice(0, 7)) {
          console.log(`    📅 Processing ${date}`);
          
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
            await this.wait(2000);
            const activities = await this.extractActivities(page, `${category} - ${date}`);
            console.log(`      Found ${activities.length} activities`);
          }
        }
      }
    } catch (e) {
      console.log(`    ⚠️ Error processing dates:`, e.message);
    }
  }

  async extractActivities(page, context) {
    const pageActivities = await page.evaluate(() => {
      const results = [];
      const seen = new Set();
      
      // Extract from table rows
      const rows = Array.from(document.querySelectorAll('tr'));
      
      rows.forEach((row, index) => {
        const text = row.innerText || row.textContent || '';
        
        if (!seen.has(text) && text.length > 20) {
          if (text.includes('$') || 
              text.includes('Sign Up') || 
              text.includes('Register') ||
              text.includes('Waitlist') ||
              text.includes('Full') ||
              text.includes('Closed')) {
            
            seen.add(text);
            
            const cells = Array.from(row.querySelectorAll('td'));
            
            // Extract details
            const idMatch = text.match(/#(\d{6})/);
            const courseId = idMatch ? idMatch[1] : null;
            
            let name = '';
            if (cells.length > 0) {
              name = cells[0].innerText?.trim() || '';
            }
            if (!name) {
              const lines = text.split('\n').filter(l => l.trim());
              name = lines[0] || '';
            }
            name = name.replace(/#\d+/, '').trim();
            
            const priceMatch = text.match(/\$([0-9,]+(?:\.\d{2})?)/);
            const price = priceMatch ? priceMatch[1] : null;
            
            const timeMatch = text.match(/(\d{1,2}:\d{2}\s*[ap]\.?m\.?\s*-\s*\d{1,2}:\d{2}\s*[ap]\.?m\.?)/i);
            const time = timeMatch ? timeMatch[1] : null;
            
            let location = null;
            cells.forEach(cell => {
              const cellText = cell.innerText || '';
              if (cellText.match(/Centre|Center|Park|Arena|Pool|Gym|Studio|Library|Community/i) &&
                  !cellText.includes('Sign Up')) {
                location = cellText.trim();
              }
            });
            
            let status = 'open';
            if (text.includes('Waitlist')) status = 'waitlist';
            else if (text.includes('Full') || text.includes('Closed')) status = 'closed';
            
            if (name && name.length > 3 && name !== 'Course') {
              results.push({
                id: courseId || `row_${index}`,
                courseId: courseId,
                name: name,
                price: price,
                time: time,
                location: location,
                status: status
              });
            }
          }
        }
      });
      
      // Also try to extract from any container
      if (results.length === 0) {
        const containers = Array.from(document.querySelectorAll('div, section, article'));
        
        containers.forEach((container, index) => {
          const text = container.innerText || '';
          
          if (!seen.has(text) && 
              text.length > 30 && 
              text.length < 500 &&
              text.includes('$')) {
            
            seen.add(text);
            
            const lines = text.split('\n').filter(l => l.trim());
            const name = lines[0] || 'Unknown';
            
            const priceMatch = text.match(/\$([0-9,]+(?:\.\d{2})?)/);
            const idMatch = text.match(/#(\d{6})/);
            
            results.push({
              id: idMatch ? idMatch[1] : `container_${index}`,
              courseId: idMatch ? idMatch[1] : null,
              name: name,
              price: priceMatch ? priceMatch[1] : null
            });
          }
        });
      }
      
      return results;
    });
    
    // Add unique activities
    pageActivities.forEach(activity => {
      const id = activity.courseId || activity.id;
      if (!this.seenIds.has(id)) {
        this.seenIds.add(id);
        this.activities.push({
          ...activity,
          category: context
        });
      }
    });
    
    return pageActivities;
  }

  async tryDirectUrls(page) {
    console.log('  🔍 Trying known activity URLs...');
    
    // Known calendar IDs from debug output
    const calendarUrls = [
      'https://nvrc.perfectmind.com/23734/Clients/BookMe4BookingPages/Classes?calendarId=ac98512e-5adf-4555-97b1-d7d76492dd5f&widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a', // Art Studio
      'https://nvrc.perfectmind.com/23734/Clients/BookMe4BookingPages/Classes?calendarId=443499b3-3e7d-454d-acae-4e02474fef9f&widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a', // Fitness Studio
      'https://nvrc.perfectmind.com/23734/Clients/BookMe4BookingPages/Classes?calendarId=ae8005d5-2f4f-44cd-9ebb-ed077f609dfc&widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a', // North Shore
      'https://nvrc.perfectmind.com/23734/Clients/BookMe4BookingPages/Classes?calendarId=d313e7d8-0d72-4e0b-92c5-98d8017ab64e&widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a', // Open Gym
      'https://nvrc.perfectmind.com/23734/Clients/BookMe4BookingPages/Classes?calendarId=002670b7-9d8e-464c-8e2e-aa4a44e20408&widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a'  // Parkgate
    ];
    
    for (const url of calendarUrls) {
      if (this.activities.length >= 1700) break;
      
      console.log(`    Trying: ${url.substring(0, 80)}...`);
      
      try {
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
        await this.wait(2000);
        
        const activities = await this.extractActivities(page, 'Direct URL');
        console.log(`    Found ${activities.length} activities`);
        
      } catch (e) {
        console.log(`    ⚠️ Failed:`, e.message);
      }
    }
  }
}

// Run if called directly
if (require.main === module) {
  const scraper = new NVRCFinal({ headless: true });
  scraper.scrape()
    .then(activities => {
      console.log(`\n✅ Done! Found ${activities.length} activities`);
    })
    .catch(console.error);
}

module.exports = NVRCFinal;