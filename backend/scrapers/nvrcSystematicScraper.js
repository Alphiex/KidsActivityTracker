const puppeteer = require('puppeteer');
const fs = require('fs');

class NVRCSystematicScraper {
  constructor(options = {}) {
    this.options = options;
    this.activities = [];
    this.processedUrls = new Set();
  }

  async scrape() {
    let browser;
    
    try {
      console.log('🚀 Starting NVRC Systematic Scraper...');
      console.log('📋 Following the exact flow from the screenshots');
      
      const launchOptions = {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-extensions',
          '--disable-blink-features=AutomationControlled',
          '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        ],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
      };
      
      browser = await puppeteer.launch(launchOptions);
      const page = await browser.newPage();
      
      // Stealth mode settings
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', {
          get: () => false,
        });
      });

      // Navigate to the exact URL from screenshot
      const targetUrl = 'https://nvrc.perfectmind.com/23734/Clients/BookMe4?widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a&embed=False&redirectedFromEmbededMode=False';
      console.log('\n📍 Step 1: Navigating to NVRC PerfectMind widget...');
      
      await page.goto(targetUrl, {
        waitUntil: 'networkidle2',
        timeout: 120000
      });
      
      // Wait for the page to stabilize
      await page.waitForTimeout(10000);
      
      console.log('✅ Page loaded');
      
      // Step 2: Look for the main categories as shown in screenshot
      console.log('\n📍 Step 2: Finding program categories...');
      
      const mainCategories = [
        'All Ages & Family',
        'Early Years: On My Own',
        'Early Years: Parent Participation', 
        'School Age',
        'Youth',
        'Adult'
      ];
      
      // Process each main category
      for (const category of mainCategories) {
        console.log(`\n📂 Processing category: ${category}`);
        
        try {
          // Look for the category in the page
          const categoryFound = await page.evaluate((cat) => {
            const elements = Array.from(document.querySelectorAll('*'));
            const element = elements.find(el => 
              el.textContent?.trim() === cat || 
              el.innerText?.trim() === cat
            );
            return element ? true : false;
          }, category);
          
          if (!categoryFound) {
            console.log(`  ⚠️ Category "${category}" not found on page`);
            continue;
          }
          
          // Click on the category
          await page.evaluate((cat) => {
            const elements = Array.from(document.querySelectorAll('*'));
            const element = elements.find(el => 
              el.textContent?.trim() === cat || 
              el.innerText?.trim() === cat
            );
            if (element) {
              // Try different click methods
              if (element.click) {
                element.click();
              } else if (element.parentElement && element.parentElement.click) {
                element.parentElement.click();
              }
            }
          }, category);
          
          console.log(`  ✅ Clicked on ${category}`);
          await page.waitForTimeout(5000);
          
          // Step 3: Extract sub-categories or programs
          const programs = await page.evaluate(() => {
            const programElements = [];
            
            // Look for program links (like "Arts Dance", "Arts Music", etc.)
            const links = Array.from(document.querySelectorAll('a'));
            links.forEach(link => {
              const text = link.textContent?.trim() || '';
              const href = link.href || '';
              
              // Program names typically include these keywords
              if (text && (
                text.includes('Arts') || text.includes('Sports') || 
                text.includes('Swimming') || text.includes('Fitness') ||
                text.includes('Camps') || text.includes('Skating') ||
                text.includes('Martial') || text.includes('Private Lessons')
              )) {
                programElements.push({
                  text: text,
                  href: href
                });
              }
            });
            
            return programElements;
          });
          
          console.log(`  📋 Found ${programs.length} programs in ${category}`);
          
          // Process each program
          for (const program of programs.slice(0, 5)) { // Limit for testing
            console.log(`    📍 Opening program: ${program.text}`);
            
            try {
              // Click on the program
              await page.evaluate((progText) => {
                const link = Array.from(document.querySelectorAll('a'))
                  .find(a => a.textContent?.trim() === progText);
                if (link) link.click();
              }, program.text);
              
              await page.waitForTimeout(4000);
              
              // Step 4: Look for date tabs (as shown in screenshot)
              const dateTabs = await page.evaluate(() => {
                const dates = [];
                const elements = Array.from(document.querySelectorAll('*'));
                
                elements.forEach(el => {
                  const text = el.textContent?.trim() || '';
                  // Match date patterns like "Tue Aug 6th"
                  if (text.match(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d+/)) {
                    dates.push(text);
                  }
                });
                
                return [...new Set(dates)]; // Remove duplicates
              });
              
              console.log(`      📅 Found ${dateTabs.length} date tabs`);
              
              // Process first few dates
              for (const dateTab of dateTabs.slice(0, 3)) {
                console.log(`        📅 Processing ${dateTab}`);
                
                // Click on the date
                await page.evaluate((date) => {
                  const elements = Array.from(document.querySelectorAll('*'));
                  const element = elements.find(el => 
                    el.textContent?.trim() === date
                  );
                  if (element) element.click();
                }, dateTab);
                
                await page.waitForTimeout(3000);
                
                // Extract activities for this date
                const activities = await this.extractActivitiesFromPage(page, `${category} > ${program.text} > ${dateTab}`);
                console.log(`          ✅ Found ${activities.length} activities`);
                
                this.activities.push(...activities);
              }
              
              // Go back to category page
              await page.goBack();
              await page.waitForTimeout(3000);
              
            } catch (e) {
              console.error(`    ❌ Error processing program ${program.text}:`, e.message);
            }
          }
          
          // Go back to main page
          await page.goto(targetUrl, { waitUntil: 'networkidle2' });
          await page.waitForTimeout(5000);
          
        } catch (error) {
          console.error(`  ❌ Error processing category ${category}:`, error.message);
        }
      }
      
      // Deduplicate activities
      const uniqueActivities = this.deduplicateActivities();
      
      console.log(`\n✅ Scraping complete!`);
      console.log(`📊 Total activities found: ${this.activities.length}`);
      console.log(`📊 Unique activities: ${uniqueActivities.length}`);
      
      // Save results
      if (!process.env.PUPPETEER_EXECUTABLE_PATH) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `nvrc_systematic_${timestamp}.json`;
        
        fs.writeFileSync(filename, JSON.stringify({
          timestamp: new Date().toISOString(),
          url: targetUrl,
          totalActivities: this.activities.length,
          uniqueActivities: uniqueActivities.length,
          activities: uniqueActivities
        }, null, 2));
        
        console.log(`💾 Results saved to ${filename}`);
      }
      
      return uniqueActivities;
      
    } catch (error) {
      console.error('❌ Scraper error:', error);
      throw error;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  async extractActivitiesFromPage(page, context) {
    return await page.evaluate((ctx) => {
      const activities = [];
      
      // Based on screenshot, activities are in table rows
      const rows = Array.from(document.querySelectorAll('tr'));
      
      rows.forEach((row, index) => {
        const text = row.innerText || row.textContent || '';
        
        // Skip header rows
        if (text.includes('Course') && text.includes('Time')) return;
        
        // Look for activity indicators
        if (text.includes('$') || text.includes('Sign Up') || text.includes('Waitlist')) {
          const cells = Array.from(row.querySelectorAll('td'));
          
          if (cells.length >= 3) {
            // Extract course ID (format: #354436)
            const courseIdMatch = text.match(/#(\d{6})/);
            
            // First cell usually has course name
            let courseName = cells[0]?.textContent?.trim() || '';
            courseName = courseName.replace(/#\d+/, '').trim();
            
            // Extract other details from row text
            const timeMatch = text.match(/(\d{1,2}:\d{2}\s*[ap]m\s*-\s*\d{1,2}:\d{2}\s*[ap]m)/i);
            const priceMatch = text.match(/\$([0-9,]+(?:\.\d{2})?)/);
            
            // Find location (usually contains words like Centre, Pool, etc.)
            let location = null;
            cells.forEach(cell => {
              const cellText = cell.textContent || '';
              if (cellText.match(/Centre|Center|Pool|Arena|Gym|Studio|Park|Library/i)) {
                location = cellText.trim();
              }
            });
            
            // Status (Sign Up, Waitlist, Closed)
            let status = 'open';
            if (text.includes('Waitlist')) status = 'waitlist';
            else if (text.includes('Closed') || text.includes('Full')) status = 'closed';
            
            activities.push({
              id: courseIdMatch ? courseIdMatch[1] : `${ctx}_${index}`,
              courseId: courseIdMatch ? courseIdMatch[1] : null,
              name: courseName,
              category: ctx,
              time: timeMatch ? timeMatch[1] : null,
              location: location,
              price: priceMatch ? parseFloat(priceMatch[1].replace(',', '')) : null,
              status: status,
              rawText: text.substring(0, 200)
            });
          }
        }
      });
      
      return activities;
    }, context);
  }

  deduplicateActivities() {
    const uniqueMap = new Map();
    
    this.activities.forEach(activity => {
      const key = activity.courseId || `${activity.name}_${activity.time}_${activity.location}`;
      
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, activity);
      }
    });
    
    return Array.from(uniqueMap.values());
  }
}

module.exports = NVRCSystematicScraper;