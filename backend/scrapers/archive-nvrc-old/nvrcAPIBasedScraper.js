const puppeteer = require('puppeteer');
const fs = require('fs');

class NVRCAPIBasedScraper {
  constructor(options = {}) {
    this.options = options;
    this.activities = [];
  }

  async scrape() {
    let browser;
    
    try {
      console.log('🚀 Starting NVRC API-Based Scraper...');
      console.log('📡 This scraper intercepts API calls to get all activities');
      
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
      
      // Set up request interception to capture API responses
      await page.setRequestInterception(true);
      
      const apiResponses = [];
      
      page.on('request', request => {
        request.continue();
      });
      
      page.on('response', async response => {
        const url = response.url();
        
        // Look for API calls that might contain activity data
        if (url.includes('perfectmind.com') && 
            (url.includes('BookMe4') || url.includes('api') || 
             url.includes('search') || url.includes('programs') ||
             url.includes('activities') || url.includes('courses'))) {
          
          try {
            const contentType = response.headers()['content-type'];
            if (contentType && contentType.includes('application/json')) {
              const data = await response.json();
              apiResponses.push({
                url: url,
                data: data,
                status: response.status()
              });
              console.log(`📡 Captured API response from: ${url.substring(0, 80)}...`);
            }
          } catch (e) {
            // Not JSON or couldn't parse
          }
        }
      });
      
      await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

      // Navigate to the PerfectMind widget
      const widgetUrl = 'https://nvrc.perfectmind.com/23734/Clients/BookMe4?widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a&embed=False&redirectedFromEmbededMode=False';
      console.log('\n📍 Navigating to NVRC PerfectMind widget...');
      
      await page.goto(widgetUrl, {
        waitUntil: ['load', 'domcontentloaded', 'networkidle0'],
        timeout: 120000
      });
      
      // Wait for dynamic content
      await page.waitForTimeout(10000);
      
      // Try to trigger more API calls by interacting with the page
      console.log('\n🖱️ Interacting with page to trigger API calls...');
      
      // Click on various elements to trigger data loading
      const clickTargets = [
        'All Programs',
        'Show More',
        'View All',
        'Load More',
        'Search',
        'Apply Filters'
      ];
      
      for (const target of clickTargets) {
        try {
          const clicked = await page.evaluate((text) => {
            const elements = Array.from(document.querySelectorAll('a, button, span'));
            const element = elements.find(el => 
              el.textContent?.toLowerCase().includes(text.toLowerCase())
            );
            if (element) {
              element.click();
              return true;
            }
            return false;
          }, target);
          
          if (clicked) {
            console.log(`  ✅ Clicked "${target}"`);
            await page.waitForTimeout(3000);
          }
        } catch (e) {
          // Continue with next target
        }
      }
      
      // Also try to remove date filters to see all activities
      try {
        await page.evaluate(() => {
          // Click on any "Reset" buttons in filters
          const resetButtons = Array.from(document.querySelectorAll('a, button')).filter(el => 
            el.textContent?.toLowerCase().includes('reset')
          );
          resetButtons.forEach(btn => btn.click());
        });
        await page.waitForTimeout(3000);
      } catch (e) {
        // Continue
      }
      
      // Process captured API responses
      console.log(`\n📊 Processing ${apiResponses.length} API responses...`);
      
      for (const response of apiResponses) {
        this.extractActivitiesFromAPIResponse(response.data, response.url);
      }
      
      // Also extract from the final page state
      console.log('\n🔍 Extracting from final page state...');
      
      const pageActivities = await page.evaluate(() => {
        const activities = [];
        
        // Look for any structured data on the page
        const scripts = Array.from(document.querySelectorAll('script'));
        for (const script of scripts) {
          const content = script.textContent || '';
          
          // Look for JSON data in scripts
          if (content.includes('activities') || content.includes('programs') || content.includes('courses')) {
            try {
              // Try to find JSON objects in the script
              const jsonMatches = content.match(/\{[^{}]*\}/g);
              if (jsonMatches) {
                jsonMatches.forEach(match => {
                  try {
                    const data = JSON.parse(match);
                    if (data.id || data.courseId || data.programId) {
                      activities.push(data);
                    }
                  } catch (e) {
                    // Not valid JSON
                  }
                });
              }
            } catch (e) {
              // Continue
            }
          }
        }
        
        // Also look for data attributes
        const elementsWithData = Array.from(document.querySelectorAll('[data-course-id], [data-program-id], [data-activity-id]'));
        elementsWithData.forEach(el => {
          const courseId = el.getAttribute('data-course-id') || 
                          el.getAttribute('data-program-id') || 
                          el.getAttribute('data-activity-id');
          if (courseId) {
            activities.push({
              id: courseId,
              name: el.textContent?.trim() || 'Unknown',
              element: el.tagName
            });
          }
        });
        
        return activities;
      });
      
      console.log(`  ✅ Found ${pageActivities.length} activities in page data`);
      this.activities.push(...pageActivities);
      
      // Deduplicate
      const uniqueActivities = this.deduplicateActivities();
      
      console.log(`\n✅ Total unique activities found: ${uniqueActivities.length}`);
      
      // Save results
      if (!process.env.PUPPETEER_EXECUTABLE_PATH) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `nvrc_api_based_${timestamp}.json`;
        
        fs.writeFileSync(filename, JSON.stringify({
          timestamp: new Date().toISOString(),
          url: widgetUrl,
          apiResponsesCount: apiResponses.length,
          totalActivities: uniqueActivities.length,
          activities: uniqueActivities,
          apiUrls: apiResponses.map(r => r.url)
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

  extractActivitiesFromAPIResponse(data, url) {
    // Handle different API response formats
    if (!data) return;
    
    // If it's an array
    if (Array.isArray(data)) {
      data.forEach(item => this.extractActivityFromObject(item, url));
    }
    
    // If it has a results/data/items property
    const arrayProps = ['results', 'data', 'items', 'programs', 'activities', 'courses'];
    for (const prop of arrayProps) {
      if (data[prop] && Array.isArray(data[prop])) {
        data[prop].forEach(item => this.extractActivityFromObject(item, url));
      }
    }
    
    // If it looks like an activity itself
    if (data.id || data.courseId || data.programId || data.name) {
      this.extractActivityFromObject(data, url);
    }
    
    // Recursively check nested objects
    if (typeof data === 'object') {
      Object.values(data).forEach(value => {
        if (typeof value === 'object') {
          this.extractActivitiesFromAPIResponse(value, url);
        }
      });
    }
  }

  extractActivityFromObject(obj, source) {
    if (!obj || typeof obj !== 'object') return;
    
    // Look for activity-like properties
    const id = obj.id || obj.courseId || obj.programId || obj.activityId;
    const name = obj.name || obj.title || obj.programName || obj.courseName;
    
    if (id || name) {
      this.activities.push({
        id: id || `api_${this.activities.length}`,
        courseId: obj.courseId || obj.barcode || null,
        name: name || 'Unknown Activity',
        category: obj.category || obj.categoryName || null,
        location: obj.location || obj.facility || obj.venue || null,
        dates: obj.dates || obj.startDate || obj.schedule || null,
        times: obj.times || obj.time || obj.timeSlot || null,
        price: obj.price || obj.fee || obj.cost || null,
        instructor: obj.instructor || obj.staff || null,
        spotsRemaining: obj.spotsRemaining || obj.availability || null,
        ageRange: obj.ageRange || obj.ageGroup || null,
        description: obj.description || null,
        registrationUrl: obj.registrationUrl || obj.registerLink || null,
        source: source
      });
    }
  }

  deduplicateActivities() {
    const uniqueMap = new Map();
    
    this.activities.forEach(activity => {
      const key = activity.courseId || activity.id || `${activity.name}_${activity.location}`;
      
      if (!uniqueMap.has(key) || 
          (uniqueMap.get(key).source && activity.source && activity.source.includes('api'))) {
        // Prefer activities from API responses
        uniqueMap.set(key, activity);
      }
    });
    
    return Array.from(uniqueMap.values());
  }
}

module.exports = NVRCAPIBasedScraper;