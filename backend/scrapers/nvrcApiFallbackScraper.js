const puppeteer = require('puppeteer');
const fs = require('fs');

class NVRCApiFallbackScraper {
  constructor(options = {}) {
    this.options = options;
  }

  async scrape() {
    let browser;
    
    try {
      console.log('🚀 Starting NVRC API Fallback Scraper...');
      
      // First, try the normal scraping approach
      const launchOptions = {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-first-run',
          '--no-zygote',
          '--disable-extensions',
          '--window-size=1920,1080'
        ],
        defaultViewport: { width: 1920, height: 1080 },
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
      };
      
      browser = await puppeteer.launch(launchOptions);
      const page = await browser.newPage();
      
      // Try a direct API approach first
      console.log('🔍 Attempting direct API approach...');
      
      // The NVRC site likely has an API endpoint that returns activities
      // Let's intercept network requests to find it
      const apiResponses = [];
      
      page.on('response', async response => {
        const url = response.url();
        if (url.includes('perfectmind') || url.includes('activities') || url.includes('programs')) {
          try {
            const contentType = response.headers()['content-type'];
            if (contentType && contentType.includes('application/json')) {
              const data = await response.json();
              apiResponses.push({ url, data });
              console.log(`📡 Found API response: ${url}`);
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      });
      
      // Navigate to the results page with all filters applied
      const resultsUrl = 'https://www.nvrc.ca/programs-memberships/find-program/results?' +
        'programs=Early%20Years%3A%20On%20My%20Own%2FEarly%20Years%3A%20Parent%20Participation%2FSchool%20Age%2FYouth&' +
        'activities=fitness_movement_fitness_dance%2Ffitness_spin%2Ffitness_strength_cardio%2Ffitness_yoga%2F' +
        'activities_aquatic_leadership%2Factivities_camps%2Factivities_certifications_and_leadership%2F' +
        'activities_cooking%2Factivities_early_years_playtime%2Factivities_kids_night_out%2F' +
        'activities_learn_and_play%2Factivities_martial_arts%2Factivities_skating%2Factivities_swimming%2F' +
        'sports_climbing%2Fsports_gymnastics%2Fsports_multisport%2Fsports_racquet_sports%2Fsports_team_sports%2F' +
        'arts_culture_dance%2Farts_culture_music%2Farts_culture_pottery%2Farts_culture_visual_arts&' +
        'locations=all';
      
      console.log('📍 Navigating directly to results page...');
      await page.goto(resultsUrl, {
        waitUntil: 'networkidle0',
        timeout: 120000
      });
      
      // Wait for potential API calls
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      // Check if we captured any API responses
      if (apiResponses.length > 0) {
        console.log(`✅ Captured ${apiResponses.length} API responses`);
        
        // Try to extract activities from API responses
        const activities = [];
        for (const response of apiResponses) {
          if (response.data && Array.isArray(response.data)) {
            activities.push(...response.data);
          } else if (response.data && response.data.activities) {
            activities.push(...response.data.activities);
          } else if (response.data && response.data.programs) {
            activities.push(...response.data.programs);
          }
        }
        
        if (activities.length > 0) {
          console.log(`✅ Extracted ${activities.length} activities from API`);
          return this.normalizeActivities(activities);
        }
      }
      
      // Fallback: Try different selectors
      console.log('🔍 Trying alternative extraction methods...');
      
      const activities = await page.evaluate(() => {
        const results = [];
        
        // Try multiple selector strategies
        const selectors = [
          '.nvrc-activities-events__row',
          '[class*="events-row"]',
          '[class*="activity-row"]',
          '[class*="program-item"]',
          '.program-listing',
          'tr[data-program-id]',
          'div[data-activity-id]'
        ];
        
        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            console.log(`Found ${elements.length} elements with selector: ${selector}`);
            
            elements.forEach(el => {
              const activity = {
                name: el.querySelector('a')?.textContent?.trim() || 
                      el.querySelector('[class*="title"]')?.textContent?.trim() ||
                      el.querySelector('h3')?.textContent?.trim() ||
                      'Unknown Activity',
                registrationUrl: el.querySelector('a[href*="BookMe4"]')?.href ||
                                el.querySelector('a[href*="perfectmind"]')?.href ||
                                '',
                category: 'Unknown',
                provider: 'NVRC'
              };
              
              if (activity.name !== 'Unknown Activity') {
                results.push(activity);
              }
            });
          }
        }
        
        // If still no results, look for any links to perfectmind
        if (results.length === 0) {
          const links = Array.from(document.querySelectorAll('a[href*="perfectmind"], a[href*="BookMe4"]'));
          links.forEach(link => {
            results.push({
              name: link.textContent?.trim() || 'Unknown Activity',
              registrationUrl: link.href,
              category: 'Unknown',
              provider: 'NVRC'
            });
          });
        }
        
        return results;
      });
      
      console.log(`✅ Extracted ${activities.length} activities using fallback methods`);
      
      // If we still have no activities, return a maintenance message
      if (activities.length === 0) {
        console.log('⚠️  No activities found - site may have changed or be unavailable');
        return [{
          id: 'NVRC_MAINTENANCE',
          name: 'NVRC Site Temporarily Unavailable',
          category: 'System',
          description: 'The NVRC website structure has changed or is temporarily unavailable. Manual update required.',
          provider: 'NVRC',
          isActive: false
        }];
      }
      
      return this.normalizeActivities(activities);
      
    } catch (error) {
      console.error('❌ Scraper error:', error);
      throw error;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }
  
  normalizeActivities(rawActivities) {
    return rawActivities.map((activity, index) => {
      const id = activity.id || 
                activity.courseId || 
                activity.programId ||
                `NVRC_${activity.name}_${index}`.replace(/\s+/g, '_');
      
      return {
        id,
        name: activity.name || activity.title || 'Unknown Activity',
        category: activity.category || activity.programType || 'Unknown',
        subcategory: activity.subcategory || activity.subType || null,
        description: activity.description || activity.details || null,
        location: activity.location || activity.facility || null,
        registrationUrl: activity.registrationUrl || activity.url || null,
        courseId: activity.courseId || activity.barcode || null,
        provider: 'NVRC',
        scrapedAt: new Date().toISOString()
      };
    });
  }
}

module.exports = NVRCApiFallbackScraper;