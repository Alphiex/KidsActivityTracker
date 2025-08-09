const puppeteer = require('puppeteer');
const fs = require('fs');

class NVRCDirectAPI {
  constructor(options = {}) {
    this.options = options;
    this.activities = [];
    this.processedIds = new Set();
  }

  async scrape() {
    let browser;
    
    try {
      console.log('🚀 Starting NVRC Direct API Scraper...');
      console.log('📡 This scraper intercepts the actual API calls to get all 1700+ activities');
      
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
          '--disable-extensions'
        ],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
      };
      
      browser = await puppeteer.launch(launchOptions);
      const page = await browser.newPage();
      
      // Enable request interception
      await page.setRequestInterception(true);
      
      // Capture all API responses
      const apiResponses = [];
      
      page.on('request', request => {
        // Log API requests for debugging
        const url = request.url();
        if (url.includes('perfectmind') && 
            (url.includes('search') || url.includes('programs') || 
             url.includes('activities') || url.includes('courses'))) {
          console.log('📡 API Request:', request.method(), url.substring(0, 100));
        }
        request.continue();
      });
      
      page.on('response', async response => {
        const url = response.url();
        const status = response.status();
        
        // Capture responses from PerfectMind API
        if (url.includes('perfectmind.com') && status === 200) {
          try {
            const contentType = response.headers()['content-type'] || '';
            
            if (contentType.includes('application/json')) {
              const data = await response.json();
              
              // Store the response for processing
              apiResponses.push({
                url: url,
                data: data,
                timestamp: new Date().toISOString()
              });
              
              console.log(`✅ Captured API response: ${url.substring(0, 80)}...`);
              
              // Immediately process the data if it contains activities
              this.extractActivitiesFromResponse(data, url);
            }
          } catch (e) {
            // Not JSON or couldn't parse
          }
        }
      });

      // Navigate to PerfectMind widget with parameters to load all activities
      const widgetUrl = 'https://nvrc.perfectmind.com/23734/Clients/BookMe4?widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a&embed=False&redirectedFromEmbededMode=False';
      
      console.log('\n📍 Loading PerfectMind widget to trigger API calls...');
      await page.goto(widgetUrl, {
        waitUntil: 'networkidle0',
        timeout: 120000
      });
      
      await page.waitForTimeout(5000);
      
      // Try to trigger more API calls by interacting with the page
      console.log('\n🔍 Triggering additional API calls...');
      
      // Remove any date filters
      await page.evaluate(() => {
        // Click all reset buttons
        const resetButtons = Array.from(document.querySelectorAll('button, a')).filter(el =>
          el.textContent?.toLowerCase().includes('reset') ||
          el.textContent?.toLowerCase().includes('clear')
        );
        resetButtons.forEach(btn => btn.click());
      });
      
      await page.waitForTimeout(3000);
      
      // Try to load all programs
      await page.evaluate(() => {
        // Click on "All Programs" or similar
        const allButtons = Array.from(document.querySelectorAll('button, a')).filter(el =>
          el.textContent?.toLowerCase().includes('all') ||
          el.textContent?.toLowerCase().includes('view all') ||
          el.textContent?.toLowerCase().includes('show all')
        );
        allButtons.forEach(btn => btn.click());
      });
      
      await page.waitForTimeout(3000);
      
      // Try different search queries to trigger API calls
      const searchQueries = ['', 'swim', 'dance', 'camp', 'fitness', 'arts', 'sports'];
      
      for (const query of searchQueries) {
        try {
          // Find search input
          const searchInput = await page.$('input[type="search"], input[placeholder*="search"], input[name*="search"]');
          if (searchInput) {
            await searchInput.click({ clickCount: 3 }); // Select all
            await searchInput.type(query);
            await page.keyboard.press('Enter');
            console.log(`🔍 Searched for: "${query}"`);
            await page.waitForTimeout(3000);
          }
        } catch (e) {
          // Continue with next query
        }
      }
      
      // Also try navigating through the interface programmatically
      console.log('\n📊 Navigating through program categories...');
      
      // Get all clickable program links
      const programLinks = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a'));
        return links
          .filter(link => {
            const text = link.textContent?.trim() || '';
            const href = link.href || '';
            return text.length > 3 && 
                   !text.includes('Login') && 
                   !href.includes('login') &&
                   (text.includes('Years') || text.includes('Adult') || 
                    text.includes('Youth') || text.includes('Schedule'));
          })
          .map(link => ({
            text: link.textContent?.trim(),
            href: link.href
          }))
          .slice(0, 20); // Limit to first 20
      });
      
      // Click through some program links
      for (const link of programLinks.slice(0, 10)) {
        try {
          console.log(`📂 Clicking: ${link.text}`);
          
          await page.evaluate((linkText) => {
            const link = Array.from(document.querySelectorAll('a'))
              .find(a => a.textContent?.trim() === linkText);
            if (link) link.click();
          }, link.text);
          
          await page.waitForTimeout(3000);
          
          // Go back
          await page.goBack();
          await page.waitForTimeout(2000);
        } catch (e) {
          // Continue with next link
        }
      }
      
      // Process all captured API responses
      console.log(`\n📊 Processing ${apiResponses.length} API responses...`);
      
      // Also extract from final page state
      const pageActivities = await page.evaluate(() => {
        const activities = [];
        
        // Look for any JSON data in the page
        const scripts = Array.from(document.querySelectorAll('script'));
        scripts.forEach(script => {
          const content = script.textContent || '';
          
          // Look for JSON-like structures
          const jsonMatches = content.match(/\{[^{}]*"(id|courseId|programId|name|title)"[^{}]*\}/g);
          if (jsonMatches) {
            jsonMatches.forEach(match => {
              try {
                const data = JSON.parse(match);
                if (data.id || data.courseId || data.name) {
                  activities.push(data);
                }
              } catch (e) {
                // Not valid JSON
              }
            });
          }
        });
        
        // Also look for activities in the DOM
        const elements = Array.from(document.querySelectorAll('*'));
        elements.forEach(el => {
          const text = el.textContent || '';
          if (text.includes('#') && /\d{6}/.test(text) && text.includes('$')) {
            const idMatch = text.match(/#(\d{6})/);
            if (idMatch) {
              activities.push({
                courseId: idMatch[1],
                text: text.substring(0, 200)
              });
            }
          }
        });
        
        return activities;
      });
      
      console.log(`Found ${pageActivities.length} activities in page data`);
      pageActivities.forEach(activity => this.addActivity(activity, 'page_data'));
      
      console.log(`\n✅ Total unique activities found: ${this.activities.length}`);
      
      // Save results
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `nvrc_direct_api_${timestamp}.json`;
      
      const results = {
        timestamp: new Date().toISOString(),
        url: widgetUrl,
        apiResponsesCount: apiResponses.length,
        totalActivities: this.activities.length,
        activities: this.activities,
        apiUrls: apiResponses.map(r => r.url)
      };
      
      fs.writeFileSync(filename, JSON.stringify(results, null, 2));
      console.log(`💾 Results saved to ${filename}`);
      
      return this.activities;
      
    } catch (error) {
      console.error('❌ Scraper error:', error);
      throw error;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  extractActivitiesFromResponse(data, url) {
    if (!data) return;
    
    // Handle arrays
    if (Array.isArray(data)) {
      data.forEach(item => this.extractActivityFromObject(item, url));
      return;
    }
    
    // Handle objects with array properties
    const arrayProps = ['results', 'data', 'items', 'programs', 'activities', 
                       'courses', 'sessions', 'offerings', 'classes'];
    
    for (const prop of arrayProps) {
      if (data[prop] && Array.isArray(data[prop])) {
        console.log(`  📦 Found ${data[prop].length} items in ${prop}`);
        data[prop].forEach(item => this.extractActivityFromObject(item, url));
      }
    }
    
    // Check if the object itself is an activity
    if (data.id || data.courseId || data.programId || data.barcode) {
      this.extractActivityFromObject(data, url);
    }
    
    // Recursively check nested objects
    if (typeof data === 'object') {
      Object.values(data).forEach(value => {
        if (typeof value === 'object' && value !== null) {
          this.extractActivitiesFromResponse(value, url);
        }
      });
    }
  }

  extractActivityFromObject(obj, source) {
    if (!obj || typeof obj !== 'object') return;
    
    // Extract relevant fields
    const id = obj.id || obj.courseId || obj.programId || obj.activityId || 
               obj.barcode || obj.courseNumber || obj.sessionId;
    
    const name = obj.name || obj.title || obj.programName || obj.courseName ||
                 obj.activityName || obj.className || obj.description;
    
    if (id && !this.processedIds.has(id)) {
      this.processedIds.add(id);
      
      const activity = {
        id: String(id),
        courseId: obj.courseId || obj.barcode || obj.courseNumber || null,
        name: name || 'Unknown Activity',
        category: obj.category || obj.categoryName || obj.programType || null,
        subcategory: obj.subcategory || obj.subCategory || null,
        location: obj.location || obj.facility || obj.venue || obj.facilityName || null,
        dates: obj.dates || obj.startDate || obj.schedule || obj.sessionDates || null,
        times: obj.times || obj.time || obj.timeSlot || obj.startTime || null,
        endTime: obj.endTime || null,
        instructor: obj.instructor || obj.instructorName || obj.staff || null,
        price: obj.price || obj.fee || obj.cost || obj.amount || null,
        spotsRemaining: obj.spotsRemaining || obj.availability || obj.openSpots || null,
        totalSpots: obj.totalSpots || obj.capacity || obj.maxCapacity || null,
        ageRange: obj.ageRange || obj.ageGroup || obj.ages || null,
        minAge: obj.minAge || null,
        maxAge: obj.maxAge || null,
        description: obj.description || obj.details || null,
        registrationUrl: obj.registrationUrl || obj.registerLink || obj.enrollLink || null,
        status: obj.status || (obj.spotsRemaining === 0 ? 'full' : 'open'),
        source: source,
        rawData: obj
      };
      
      this.activities.push(activity);
      
      // Also check for nested sessions or offerings
      if (obj.sessions && Array.isArray(obj.sessions)) {
        obj.sessions.forEach(session => {
          this.extractActivityFromObject({
            ...session,
            parentName: name,
            parentId: id
          }, source);
        });
      }
    }
  }

  addActivity(data, source) {
    const id = data.courseId || data.id || `${source}_${this.activities.length}`;
    
    if (!this.processedIds.has(id)) {
      this.processedIds.add(id);
      
      this.activities.push({
        id: id,
        courseId: data.courseId || null,
        name: data.name || data.text?.split('\n')[0] || 'Unknown',
        source: source,
        rawData: data
      });
    }
  }
}

module.exports = NVRCDirectAPI;