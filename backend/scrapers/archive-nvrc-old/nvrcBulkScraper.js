const puppeteer = require('puppeteer');
const fs = require('fs');

class NVRCBulkScraper {
  constructor(options = {}) {
    this.options = options;
    this.activities = [];
  }

  async scrape() {
    let browser;
    
    try {
      console.log('🚀 Starting NVRC Bulk Scraper...');
      
      const launchOptions = {
        headless: this.options.headless !== undefined ? this.options.headless : true,
        slowMo: 0,
        args: this.options.args || [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-first-run',
          '--no-zygote',
          '--disable-extensions',
          '--window-size=1920,1080'
        ],
        defaultViewport: null,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
      };
      
      browser = await puppeteer.launch(launchOptions);
      const page = await browser.newPage();
      
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

      // Navigate to the PerfectMind widget
      const widgetUrl = 'https://nvrc.perfectmind.com/23734/Clients/BookMe4?widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a&embed=False&redirectedFromEmbededMode=False';
      console.log('\n📍 Navigating to NVRC PerfectMind widget...');
      await page.goto(widgetUrl, {
        waitUntil: 'networkidle0',
        timeout: 120000
      });

      await page.waitForSelector('body', { timeout: 30000 });
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Strategy: Use the search functionality to get ALL activities
      // First, clear any filters to show all programs
      console.log('\n🔍 Clearing filters to show all activities...');
      
      // Click on "Reset" buttons to clear filters
      await page.evaluate(() => {
        const resetButtons = Array.from(document.querySelectorAll('a, button')).filter(el => 
          el.textContent?.trim().toLowerCase() === 'reset'
        );
        resetButtons.forEach(btn => btn.click());
      });
      
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Look for activities that are already visible on the page
      let visibleActivities = await this.extractVisibleActivities(page, 'All Programs');
      console.log(`\n📊 Found ${visibleActivities.length} activities on main page`);
      this.activities.push(...visibleActivities);

      // Now let's try to load more activities by scrolling
      console.log('\n📜 Scrolling to load more activities...');
      
      let previousHeight = 0;
      let currentHeight = await page.evaluate(() => document.body.scrollHeight);
      let scrollAttempts = 0;
      
      while (previousHeight !== currentHeight && scrollAttempts < 10) {
        previousHeight = currentHeight;
        
        // Scroll to bottom
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Check for "Load More" or "Show More" buttons
        const loadMoreClicked = await page.evaluate(() => {
          const loadMoreButtons = Array.from(document.querySelectorAll('a, button')).filter(el => {
            const text = el.textContent?.trim().toLowerCase();
            return text.includes('show more') || text.includes('load more') || text === 'more';
          });
          
          if (loadMoreButtons.length > 0) {
            loadMoreButtons[0].click();
            return true;
          }
          return false;
        });
        
        if (loadMoreClicked) {
          console.log('  ✅ Clicked "Show More" button');
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
        
        currentHeight = await page.evaluate(() => document.body.scrollHeight);
        scrollAttempts++;
      }

      // Extract all visible activities after scrolling
      visibleActivities = await this.extractVisibleActivities(page, 'All Programs');
      console.log(`\n📊 Total activities after scrolling: ${visibleActivities.length}`);
      
      // Clear previous activities and add all new ones
      this.activities = visibleActivities;

      // Now let's check each date tab to get activities for different dates
      const dateTabs = await page.evaluate(() => {
        const tabs = Array.from(document.querySelectorAll('a, button, li')).filter(el => {
          const text = el.textContent?.trim() || '';
          return text.match(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d+/i);
        });
        
        return tabs.map(tab => ({
          text: tab.textContent?.trim(),
          tagName: tab.tagName
        }));
      });

      console.log(`\n📅 Found ${dateTabs.length} date tabs`);

      // Process first few date tabs
      for (let i = 0; i < Math.min(dateTabs.length, 7); i++) {
        const dateTab = dateTabs[i];
        console.log(`\n📅 Processing date: ${dateTab.text}`);
        
        // Click on the date tab
        const clicked = await page.evaluate((dateText) => {
          const tabs = Array.from(document.querySelectorAll('a, button, li')).filter(el => 
            el.textContent?.trim() === dateText
          );
          
          if (tabs.length > 0) {
            tabs[0].click();
            return true;
          }
          return false;
        }, dateTab.text);
        
        if (clicked) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Extract activities for this date
          const dateActivities = await this.extractVisibleActivities(page, dateTab.text);
          console.log(`  ✅ Found ${dateActivities.length} activities for ${dateTab.text}`);
          
          // Add activities that aren't already in our list (based on courseId)
          const existingCourseIds = new Set(this.activities.filter(a => a.courseId).map(a => a.courseId));
          const newActivities = dateActivities.filter(a => !a.courseId || !existingCourseIds.has(a.courseId));
          
          this.activities.push(...newActivities);
          console.log(`  ➕ Added ${newActivities.length} new unique activities`);
        }
      }

      // Remove duplicates based on courseId
      const uniqueActivities = [];
      const seenCourseIds = new Set();
      const seenNonIdActivities = new Set();
      
      this.activities.forEach(activity => {
        if (activity.courseId && !seenCourseIds.has(activity.courseId)) {
          seenCourseIds.add(activity.courseId);
          uniqueActivities.push(activity);
        } else if (!activity.courseId) {
          // For activities without course IDs, use a combination of fields to detect duplicates
          const key = `${activity.name}_${activity.time}_${activity.location}`;
          if (!seenNonIdActivities.has(key)) {
            seenNonIdActivities.add(key);
            uniqueActivities.push(activity);
          }
        }
      });

      console.log(`\n✅ Total unique activities extracted: ${uniqueActivities.length}`);
      console.log(`📊 Activities with course IDs: ${uniqueActivities.filter(a => a.courseId).length}`);
      
      // Save results
      if (!process.env.PUPPETEER_EXECUTABLE_PATH) {
        try {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const filename = `nvrc_bulk_${timestamp}.json`;
          
          const results = {
            timestamp: new Date().toISOString(),
            url: widgetUrl,
            totalActivities: this.activities.length,
            uniqueActivities: uniqueActivities.length,
            dateTabs: dateTabs.length,
            activities: uniqueActivities
          };
          
          fs.writeFileSync(filename, JSON.stringify(results, null, 2));
          console.log(`💾 Results saved to ${filename}`);
        } catch (err) {
          console.log('💾 Could not save results file');
        }
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

  async extractVisibleActivities(page, context) {
    return await page.evaluate((contextName) => {
      const activities = [];
      const processedTexts = new Set();
      
      // Strategy 1: Look for elements with course IDs
      const elementsWithIds = Array.from(document.querySelectorAll('[id*="3"], [id*="4"], [id*="5"], [id*="6"], [id*="7"]'));
      
      elementsWithIds.forEach((element) => {
        const id = element.id;
        if (id && id.match(/^\d{6}$/)) {
          const text = element.textContent || '';
          
          if (!processedTexts.has(text) && text.length > 20) {
            processedTexts.add(text);
            
            // Extract activity details
            const name = (() => {
              const heading = element.querySelector('h1, h2, h3, h4, h5, h6, strong, b, a');
              if (heading) return heading.textContent?.trim();
              const lines = text.split('\n').filter(l => l.trim());
              return lines[0]?.trim() || 'Unknown Activity';
            })();
            
            const timeMatch = text.match(/(\d{1,2}:\d{2}\s*[ap]\.?m\.?\s*-\s*\d{1,2}:\d{2}\s*[ap]\.?m\.?)/i);
            const time = timeMatch ? timeMatch[1] : null;
            
            const dateMatch = text.match(/((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[^,]*,\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d+)/i);
            const date = dateMatch ? dateMatch[1] : null;
            
            const priceMatch = text.match(/\$([0-9,]+(?:\.\d{2})?)/);
            const price = priceMatch ? parseFloat(priceMatch[1].replace(',', '')) : null;
            
            const locationMatch = text.match(/(?:at\s+)?([^,\n]*(?:Centre|Center|Park|Arena|Pool|Field|Gym|Studio|Library)[^,\n]*)/i);
            const location = locationMatch ? locationMatch[1].trim() : null;
            
            const ageMatch = text.match(/(\d+)\s*[-–]\s*(\d+)\s*yr?s?/i);
            const ageInfo = ageMatch ? `${ageMatch[1]}-${ageMatch[2]} yrs` : null;
            
            let status = 'open';
            if (text.includes('Waitlist')) status = 'waitlist';
            else if (text.includes('Closed') || text.includes('Full')) status = 'closed';
            
            activities.push({
              id: id,
              courseId: id,
              category: contextName,
              name: name,
              location: location,
              date: date,
              time: time,
              ageInfo: ageInfo,
              price: price,
              status: status
            });
          }
        }
      });
      
      // Strategy 2: Look for activity rows in tables
      const rows = Array.from(document.querySelectorAll('tr'));
      
      rows.forEach((row, index) => {
        const text = row.textContent || '';
        
        if (!processedTexts.has(text) && 
            (text.includes('Sign Up') || text.includes('Waitlist') || 
             text.includes('Closed') || text.includes('Register'))) {
          
          processedTexts.add(text);
          
          const cells = Array.from(row.querySelectorAll('td'));
          if (cells.length >= 2) {
            // Extract course ID from various sources
            let courseId = null;
            
            // From row ID
            if (row.id && row.id.match(/\d{6}/)) {
              courseId = row.id.match(/\d{6}/)[0];
            }
            
            // From text (#354436 format)
            const idMatch = text.match(/#(\d{6})/);
            if (idMatch) courseId = idMatch[1];
            
            // From links
            const links = row.querySelectorAll('a');
            links.forEach(link => {
              const href = link.href || '';
              const courseIdMatch = href.match(/courseId=(\d+)/);
              if (courseIdMatch) courseId = courseIdMatch[1];
            });
            
            const name = cells[0]?.textContent?.trim().replace(/#\d+/, '').trim() || 'Unknown Activity';
            
            const timeMatch = text.match(/(\d{1,2}:\d{2}\s*[ap]\.?m\.?\s*-\s*\d{1,2}:\d{2}\s*[ap]\.?m\.?)/i);
            const time = timeMatch ? timeMatch[1] : null;
            
            const dateMatch = text.match(/((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[^,]*,\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d+)/i);
            const date = dateMatch ? dateMatch[1] : null;
            
            let location = null;
            cells.forEach(cell => {
              const cellText = cell.textContent || '';
              if (cellText.match(/Centre|Center|Park|Arena|Pool|Field|Gym|Studio|Library/i) && 
                  !cellText.includes('Sign Up') && !cellText.includes('Register')) {
                location = cellText.trim();
              }
            });
            
            const priceMatch = text.match(/\$([0-9,]+(?:\.\d{2})?)/);
            const price = priceMatch ? parseFloat(priceMatch[1].replace(',', '')) : null;
            
            const ageMatch = text.match(/(\d+)\s*[-–]\s*(\d+)\s*yr?s?/i);
            const ageInfo = ageMatch ? `${ageMatch[1]}-${ageMatch[2]} yrs` : null;
            
            let status = 'open';
            if (text.includes('Waitlist')) status = 'waitlist';
            else if (text.includes('Closed') || text.includes('Full')) status = 'closed';
            
            if (name && name !== 'Unknown Activity' && name.length > 3) {
              activities.push({
                id: courseId || `${contextName}_row_${index}`,
                courseId: courseId,
                category: contextName,
                name: name,
                location: location,
                date: date,
                time: time,
                ageInfo: ageInfo,
                price: price,
                status: status
              });
            }
          }
        }
      });
      
      // Strategy 3: Look for activity containers/cards
      const containers = Array.from(document.querySelectorAll(
        '.program-item, .activity-item, .course-item, [class*="program"], [class*="activity"], [class*="course"]'
      ));
      
      containers.forEach((container, index) => {
        const text = container.textContent || '';
        
        if (!processedTexts.has(text) && text.includes('$') && 
            (text.includes('Register') || text.includes('Sign Up') || text.includes('More Info'))) {
          
          processedTexts.add(text);
          
          const heading = container.querySelector('h1, h2, h3, h4, h5, h6, strong, b, a');
          const name = heading?.textContent?.trim() || text.split('\n')[0].trim();
          
          // Extract course ID
          let courseId = null;
          if (container.id && container.id.match(/\d{6}/)) {
            courseId = container.id.match(/\d{6}/)[0];
          }
          const idMatch = text.match(/#(\d{6})/);
          if (idMatch) courseId = idMatch[1];
          
          const priceMatch = text.match(/\$([0-9,]+(?:\.\d{2})?)/);
          const price = priceMatch ? parseFloat(priceMatch[1].replace(',', '')) : null;
          
          const timeMatch = text.match(/(\d{1,2}:\d{2}\s*[ap]\.?m\.?\s*-\s*\d{1,2}:\d{2}\s*[ap]\.?m\.?)/i);
          const time = timeMatch ? timeMatch[1] : null;
          
          const locationMatch = text.match(/(?:at\s+)?([^,\n]*(?:Centre|Center|Park|Arena|Pool|Field|Gym|Studio|Library)[^,\n]*)/i);
          const location = locationMatch ? locationMatch[1].trim() : null;
          
          if (name && name.length > 3 && price) {
            activities.push({
              id: courseId || `${contextName}_container_${index}`,
              courseId: courseId,
              category: contextName,
              name: name,
              location: location,
              time: time,
              price: price,
              status: 'open'
            });
          }
        }
      });
      
      return activities;
    }, context);
  }
}

module.exports = NVRCBulkScraper;