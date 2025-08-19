const puppeteer = require('puppeteer');
const fs = require('fs');

class NVRCCloudOptimized {
  constructor(options = {}) {
    this.options = options;
    this.activities = [];
  }

  async scrape() {
    let browser;
    
    try {
      console.log('🚀 Starting NVRC Cloud-Optimized Scraper...');
      console.log('🌐 Using direct API approach for cloud compatibility');
      
      const launchOptions = {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=IsolateOrigins,site-per-process',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-extensions'
        ],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
      };
      
      browser = await puppeteer.launch(launchOptions);
      const page = await browser.newPage();
      
      // Set a more complete user agent
      await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      // Enable JavaScript
      await page.setJavaScriptEnabled(true);
      
      // Set viewport
      await page.setViewport({ width: 1920, height: 1080 });

      // Strategy: Go directly to the PerfectMind search results
      // This URL shows all programs with all filters applied
      const searchUrl = 'https://nvrc.perfectmind.com/23734/Clients/BookMe4?widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a&embed=False';
      
      console.log('\n📍 Navigating to NVRC PerfectMind search...');
      
      // Navigate with multiple wait conditions
      const response = await page.goto(searchUrl, {
        waitUntil: ['load', 'domcontentloaded', 'networkidle0', 'networkidle2'],
        timeout: 120000
      });
      
      console.log('📄 Page response:', response.status());
      
      // Wait for the page to fully load
      console.log('⏳ Waiting for dynamic content...');
      await page.waitForTimeout(15000); // Give it 15 seconds to load everything
      
      // Try to click on "All Programs" to ensure we see everything
      try {
        await page.evaluate(() => {
          // Click on any element that says "All Programs"
          const elements = Array.from(document.querySelectorAll('*'));
          const allProgramsElement = elements.find(el => 
            el.textContent?.trim() === 'All Programs' || 
            el.textContent?.trim() === 'ALL PROGRAMS'
          );
          if (allProgramsElement) {
            allProgramsElement.click();
            return true;
          }
          return false;
        });
        
        await page.waitForTimeout(5000);
      } catch (e) {
        console.log('Could not click All Programs');
      }

      // Extract all activity data from the page
      console.log('\n🔍 Extracting activity data...');
      
      const pageData = await page.evaluate(() => {
        const data = {
          activities: [],
          debugInfo: {
            url: window.location.href,
            title: document.title,
            bodyLength: document.body.innerText.length,
            hasIframes: document.querySelectorAll('iframe').length,
            linkCount: document.querySelectorAll('a').length,
            tableCount: document.querySelectorAll('table').length,
            divCount: document.querySelectorAll('div').length
          }
        };
        
        // Strategy 1: Find all elements that might contain activities
        const allElements = Array.from(document.querySelectorAll('*'));
        const processedTexts = new Set();
        
        allElements.forEach((element, index) => {
          const text = element.innerText || element.textContent || '';
          
          // Skip if too short or already processed
          if (text.length < 30 || processedTexts.has(text)) return;
          
          // Look for activity indicators
          const hasPrice = text.includes('$');
          const hasTime = /\d{1,2}:\d{2}\s*[ap]\.?m\.?/i.test(text);
          const hasDate = /(Mon|Tue|Wed|Thu|Fri|Sat|Sun).*\d+/i.test(text);
          const hasLocation = /(Centre|Center|Park|Arena|Pool|Gym|Studio|Library)/i.test(text);
          const hasRegistration = /(Register|Sign Up|Waitlist|Full|Closed)/i.test(text);
          const hasCourseId = /#\d{5,6}/.test(text);
          
          // If it looks like an activity
          if ((hasPrice || hasTime || hasCourseId) && (hasRegistration || hasLocation)) {
            processedTexts.add(text);
            
            // Extract details
            const courseIdMatch = text.match(/#(\d{5,6})/);
            const priceMatch = text.match(/\$([0-9,]+(?:\.\d{2})?)/);
            const timeMatch = text.match(/(\d{1,2}:\d{2}\s*[ap]\.?m\.?\s*-\s*\d{1,2}:\d{2}\s*[ap]\.?m\.?)/i);
            const dateMatch = text.match(/((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[^,]*,?\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)?\s*\d+)/i);
            const locationMatch = text.match(/(?:at\s+)?([^,\n]*(?:Centre|Center|Park|Arena|Pool|Gym|Studio|Library)[^,\n]*)/i);
            
            // Get activity name (usually first line or heading)
            let name = 'Unknown Activity';
            const heading = element.querySelector('h1, h2, h3, h4, h5, h6, strong, b, a');
            if (heading) {
              name = heading.textContent?.trim() || name;
            } else {
              const lines = text.split('\n').filter(l => l.trim());
              if (lines.length > 0) {
                name = lines[0].trim().replace(/#\d+/, '').trim();
              }
            }
            
            data.activities.push({
              id: courseIdMatch ? courseIdMatch[1] : `activity_${index}`,
              courseId: courseIdMatch ? courseIdMatch[1] : null,
              name: name,
              price: priceMatch ? parseFloat(priceMatch[1].replace(',', '')) : null,
              time: timeMatch ? timeMatch[1] : null,
              date: dateMatch ? dateMatch[1] : null,
              location: locationMatch ? locationMatch[1].trim() : null,
              text: text.substring(0, 200),
              elementTag: element.tagName,
              elementId: element.id || null
            });
          }
        });
        
        // Strategy 2: Look specifically for table rows (common in PerfectMind)
        const rows = Array.from(document.querySelectorAll('tr'));
        rows.forEach((row, index) => {
          const text = row.innerText || row.textContent || '';
          if (processedTexts.has(text) || text.length < 30) return;
          
          const cells = Array.from(row.querySelectorAll('td'));
          if (cells.length >= 2 && (text.includes('$') || text.includes('Register'))) {
            processedTexts.add(text);
            
            const courseIdMatch = text.match(/#(\d{5,6})/);
            const name = cells[0]?.textContent?.trim().replace(/#\d+/, '').trim() || 'Unknown';
            
            data.activities.push({
              id: courseIdMatch ? courseIdMatch[1] : `row_${index}`,
              courseId: courseIdMatch ? courseIdMatch[1] : null,
              name: name,
              text: text.substring(0, 200),
              elementTag: 'TR',
              source: 'table_row'
            });
          }
        });
        
        return data;
      });
      
      console.log('📊 Debug info:', pageData.debugInfo);
      console.log(`✅ Found ${pageData.activities.length} potential activities`);
      
      // If we didn't find many activities, try alternative approaches
      if (pageData.activities.length < 100) {
        console.log('\n🔍 Trying alternative extraction methods...');
        
        // Try to find and click on category links
        const categoryLinks = await page.evaluate(() => {
          const links = Array.from(document.querySelectorAll('a'));
          return links
            .filter(link => {
              const text = link.textContent?.trim() || '';
              return text.length > 3 && 
                     (text.includes('Schedule') || text.includes('Years') || 
                      text.includes('Adult') || text.includes('Youth')) &&
                     !text.includes('Login');
            })
            .map(link => link.textContent?.trim())
            .slice(0, 10); // Just first 10 for testing
        });
        
        console.log(`Found ${categoryLinks.length} category links:`, categoryLinks);
        
        // Process a few categories
        for (const category of categoryLinks.slice(0, 3)) {
          try {
            console.log(`\n📂 Clicking on: ${category}`);
            
            await page.evaluate((cat) => {
              const link = Array.from(document.querySelectorAll('a'))
                .find(a => a.textContent?.trim() === cat);
              if (link) link.click();
            }, category);
            
            await page.waitForTimeout(5000);
            
            // Extract from this page
            const categoryData = await page.evaluate(() => {
              const activities = [];
              const elements = Array.from(document.querySelectorAll('*'));
              
              elements.forEach((el, i) => {
                const text = el.innerText || el.textContent || '';
                if (text.includes('$') && text.length > 30 && text.length < 500) {
                  activities.push({
                    id: `cat_${i}`,
                    text: text.substring(0, 200)
                  });
                }
              });
              
              return activities;
            });
            
            console.log(`  Found ${categoryData.length} activities in ${category}`);
            pageData.activities.push(...categoryData);
            
          } catch (e) {
            console.error(`  Error processing ${category}:`, e.message);
          }
        }
      }
      
      // Deduplicate
      const uniqueActivities = [];
      const seen = new Set();
      
      pageData.activities.forEach(activity => {
        const key = activity.courseId || activity.text?.substring(0, 50) || activity.id;
        if (!seen.has(key)) {
          seen.add(key);
          uniqueActivities.push(activity);
        }
      });
      
      console.log(`\n✅ Total unique activities found: ${uniqueActivities.length}`);
      
      // Save results
      if (!process.env.PUPPETEER_EXECUTABLE_PATH) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `nvrc_cloud_${timestamp}.json`;
        
        fs.writeFileSync(filename, JSON.stringify({
          timestamp: new Date().toISOString(),
          url: searchUrl,
          debugInfo: pageData.debugInfo,
          totalActivities: uniqueActivities.length,
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
}

module.exports = NVRCCloudOptimized;