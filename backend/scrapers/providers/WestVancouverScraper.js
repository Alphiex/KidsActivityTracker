const ActiveNetworkScraper = require('../platforms/ActiveNetworkScraper');
const DataNormalizer = require('../base/DataNormalizer');

/**
 * West Vancouver-specific scraper that extends the Active Network platform scraper
 * This scraper handles the specific patterns and data extraction for West Vancouver Recreation activities
 */
class WestVancouverScraper extends ActiveNetworkScraper {
  constructor(config) {
    super(config);
    this.providerName = 'West Vancouver Recreation';
  }

  /**
   * Enhanced scraping method that includes West Vancouver-specific features
   * @returns {Promise<{activities: Array, stats: Object, report: String}>}
   */
  async scrape() {
    const startTime = Date.now();
    this.logProgress('Starting West Vancouver Enhanced Scraper');

    try {
      // Use the base Active Network scraper flow
      const baseResult = await super.scrape();

      const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
      this.logProgress(`West Vancouver scraping completed in ${duration} minutes`);

      return baseResult;

    } catch (error) {
      this.handleError(error, 'West Vancouver scrape');
      throw error;
    }
  }

  /**
   * Override Active Network activity extraction to handle West Vancouver-specific patterns
   * @param {Object} page - Puppeteer page
   * @param {Object} category - Category information
   * @returns {Promise<Array>} Enhanced West Vancouver activities
   */
  async extractActivitiesFromActiveNetworkPage(page, category) {
    this.logProgress(`  Extracting activities from West Vancouver ${category.name} page...`);
    
    return await page.evaluate((categoryInfo) => {
      const activities = [];
      
      // West Vancouver specific selectors for Active Network
      const activitySelectors = [
        '.activity-item',
        '.program-item',
        '.course-item',
        'tr.activity-row',
        '.search-result-item',
        '.program-listing',
        // West Vancouver may use custom selectors
        '.westvancouver-activity',
        '.rec-program'
      ];
      
      let activityElements = [];
      
      // Find the right selector that contains activities
      for (const selector of activitySelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          activityElements = Array.from(elements);
          console.log(`Found ${elements.length} activities using selector: ${selector}`);
          break;
        }
      }
      
      // If no specific activity elements found, look for table rows or cards
      if (activityElements.length === 0) {
        console.log('No specific selectors found, trying generic patterns...');
        
        // Try table rows that might contain activity data
        let rows = Array.from(document.querySelectorAll('table tr, tbody tr'));
        activityElements = rows.filter(row => {
          const text = row.textContent || '';
          return text.includes('$') || text.includes('Register') || text.includes('Age') || text.includes('Time');
        });
        
        // Try card-like elements
        if (activityElements.length === 0) {
          const cards = Array.from(document.querySelectorAll('.card, .item, .listing, div[class*="activity"], div[class*="program"]'));
          activityElements = cards.filter(card => {
            const text = card.textContent || '';
            return text.includes('$') || text.includes('Register') || text.includes('Time') || text.includes('Age');
          });
        }
        
        console.log(`Found ${activityElements.length} potential activity elements using generic patterns`);
      }

      // Process each activity element
      activityElements.forEach((element, index) => {
        try {
          const text = element.textContent || '';
          const innerHTML = element.innerHTML || '';
          
          // Skip if this doesn't look like an activity
          if (text.length < 20 || (!text.includes('$') && !text.includes('Register'))) {
            return;
          }
          
          // Extract activity data using West Vancouver patterns
          const activity = {
            // Basic identification
            elementIndex: index,
            category: categoryInfo.name,
            categoryId: categoryInfo.categoryId,
            
            // Raw data for normalization
            rawText: text.trim(),
            rawHTML: innerHTML,
            
            // Extract common fields using West Vancouver patterns
            name: this.extractWestVanActivityName(element, text),
            cost: this.extractWestVanCost(text),
            schedule: this.extractWestVanSchedule(text),
            location: this.extractWestVanLocation(text),
            registrationUrl: this.extractWestVanRegistrationUrl(element),
            
            // West Vancouver specific fields
            ageRange: this.extractWestVanAgeRange(text),
            dates: this.extractWestVanDates(text),
            availability: this.extractWestVanAvailability(text, element),
            instructor: this.extractWestVanInstructor(text),
            description: this.extractWestVanDescription(element, text)
          };
          
          // Only include if we found meaningful data
          if (activity.name && (activity.cost || activity.registrationUrl || activity.schedule)) {
            activities.push(activity);
          }
          
        } catch (error) {
          console.error('Error extracting West Vancouver activity from element:', error);
        }
      });
      
      console.log(`Extracted ${activities.length} activities from West Vancouver ${categoryInfo.name}`);
      return activities;
      
      // Helper functions for West Vancouver-specific extraction
      function extractWestVanActivityName(element, text) {
        // Try different selectors for activity name
        const nameSelectors = ['.activity-name', '.program-title', '.course-title', 'h3', 'h4', '.title', '.name'];
        
        for (const selector of nameSelectors) {
          const nameEl = element.querySelector(selector);
          if (nameEl && nameEl.textContent.trim()) {
            return nameEl.textContent.trim();
          }
        }
        
        // Extract from text patterns - look for title-like text
        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 3);
        if (lines.length > 0) {
          // First line that's not just numbers, dates, or prices
          for (const line of lines) {
            if (!line.match(/^\d+$/) && 
                !line.match(/^\\$/) && 
                !line.match(/^\d{1,2}:\d{2}/) &&
                !line.match(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)/)) {
              return line;
            }
          }
          return lines[0]; // Fallback to first line
        }
        
        return null;
      }
      
      function extractWestVanCost(text) {
        // West Vancouver cost patterns
        const costPatterns = [
          /\\$([0-9,]+\.\d{2})/,  // $75.00
          /\\$([0-9,]+)/,           // $75
          /Cost:\s*\\$([0-9,]+(?:\.\d{2})?)/i,
          /Fee:\s*\\$([0-9,]+(?:\.\d{2})?)/i,
          /Price:\s*\\$([0-9,]+(?:\.\d{2})?)/i
        ];
        
        for (const pattern of costPatterns) {
          const match = text.match(pattern);
          if (match) {
            return parseFloat(match[1].replace(',', ''));
          }
        }
        
        // Handle free activities
        if (text.toLowerCase().includes('free') || text.toLowerCase().includes('no charge')) {
          return 0;
        }
        
        return null;
      }
      
      function extractWestVanSchedule(text) {
        // West Vancouver schedule patterns
        const schedulePatterns = [
          // Day and time combinations
          /([A-Za-z]{3,9}(?:\s*,\s*[A-Za-z]{3,9})*)\s*([0-9]{1,2}:[0-9]{2}\s*[APMapm]{2}\s*[-–]\s*[0-9]{1,2}:[0-9]{2}\s*[APMapm]{2})/,
          // Days with time ranges
          /(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)[^\n]*([0-9]{1,2}:[0-9]{2}[^\n]*[0-9]{1,2}:[0-9]{2})/i,
          // Weekdays pattern
          /Weekdays\s*([0-9]{1,2}:[0-9]{2}[^\n]*)/i,
          // Time ranges without days
          /([0-9]{1,2}:[0-9]{2}\s*[APMapm]{2}\s*[-–]\s*[0-9]{1,2}:[0-9]{2}\s*[APMapm]{2})/
        ];
        
        for (const pattern of schedulePatterns) {
          const match = text.match(pattern);
          if (match) {
            return match[0].trim();
          }
        }
        
        return null;
      }
      
      function extractWestVanLocation(text) {
        // West Vancouver location patterns
        const locationKeywords = [
          'West Vancouver Community Centre',
          'West Vancouver Aquatic Centre', 
          'West Vancouver',
          'Community Centre',
          'Aquatic Centre',
          'Recreation Centre',
          'Centre',
          'Arena',
          'Pool',
          'Field',
          'Park',
          'Gym',
          'Studio'
        ];
        
        for (const keyword of locationKeywords) {
          const pattern = new RegExp(`([^\n]*${keyword.replace(/\s+/g, '\\\s+')}[^\n]*)`, 'i');
          const match = text.match(pattern);
          if (match) {
            return match[1].trim().replace(/\s+/g, ' ');
          }
        }
        
        return null;
      }
      
      function extractWestVanRegistrationUrl(element) {
        const links = element.querySelectorAll('a[href]');
        for (const link of links) {
          const href = link.href;
          const linkText = link.textContent?.toLowerCase() || '';
          
          if (href.includes('register') || 
              href.includes('enroll') || 
              href.includes('signup') || 
              href.includes('booking') ||
              linkText.includes('register') ||
              linkText.includes('sign up') ||
              linkText.includes('book now')) {
            return href;
          }
        }
        
        // Return any link that looks like it could be for registration
        for (const link of links) {
          const href = link.href;
          if (href.includes('activity') || href.includes('program') || href.includes('course')) {
            return href;
          }
        }
        
        return null;
      }
      
      function extractWestVanAgeRange(text) {
        // West Vancouver age range patterns
        const agePatterns = [
          /Age(?:s)?\s*:?\s*(\d+)\s*(?:to|-|–)\s*(\d+)/i,
          /(\d+)\s*[-–]\s*(\d+)\s*(?:years?|yrs?)/i,
          /Ages\s*(\d+)\s*(?:to|-|–)\s*(\d+)/i,
          /\((\d+)-(\d+)\s*(?:years?|yrs?)\)/i
        ];
        
        for (const pattern of agePatterns) {
          const match = text.match(pattern);
          if (match) {
            const min = parseInt(match[1]);
            const max = parseInt(match[2]);
            if (min <= max && min >= 0 && max <= 18) {
              return { min, max };
            }
          }
        }
        
        return null;
      }
      
      function extractWestVanDates(text) {
        // West Vancouver date patterns
        const datePatterns = [
          // Month day ranges
          /([A-Z][a-z]{2,8})\s*(\d{1,2})\s*(?:to|-|–)\s*([A-Z][a-z]{2,8})\s*(\d{1,2})/,
          // Date ranges with years
          /([A-Z][a-z]{2})\s*(\d{1,2}),?\s*(\d{4})\s*(?:to|-|–)\s*([A-Z][a-z]{2})\s*(\d{1,2}),?\s*(\d{4})/,
          // Simple date patterns
          /(\d{1,2}\/\d{1,2}\/\d{4})\s*(?:to|-|–)\s*(\d{1,2}\/\d{1,2}\/\d{4})/
        ];
        
        for (const pattern of datePatterns) {
          const match = text.match(pattern);
          if (match) {
            return match[0].trim();
          }
        }
        
        return null;
      }
      
      function extractWestVanAvailability(text, element) {
        const lowerText = text.toLowerCase();
        
        if (lowerText.includes('full') || lowerText.includes('sold out') || lowerText.includes('waitlist')) {
          return 'Full';
        } else if (lowerText.includes('closed') || lowerText.includes('cancelled')) {
          return 'Closed';
        } else if (lowerText.includes('register') || lowerText.includes('sign up') || lowerText.includes('available')) {
          return 'Open';
        }
        
        // Check if there's a registration link
        const hasRegLink = element.querySelector('a[href*="register"], a[href*="enroll"], a[href*="signup"]');
        if (hasRegLink) {
          return 'Open';
        }
        
        return 'Unknown';
      }
      
      function extractWestVanInstructor(text) {
        // Look for instructor patterns
        const instructorPatterns = [
          /Instructor:\s*([^\n]+)/i,
          /Teacher:\s*([^\n]+)/i,
          /Led by:\s*([^\n]+)/i,
          /with\s+([A-Z][a-z]+\s+[A-Z][a-z]+)/  // "with John Smith"
        ];
        
        for (const pattern of instructorPatterns) {
          const match = text.match(pattern);
          if (match) {
            return match[1].trim();
          }
        }
        
        return null;
      }
      
      function extractWestVanDescription(element, text) {
        // Try to find description elements
        const descSelectors = ['.description', '.details', '.summary', '.info', '.content'];
        
        for (const selector of descSelectors) {
          const descEl = element.querySelector(selector);
          if (descEl && descEl.textContent.trim()) {
            return descEl.textContent.trim();
          }
        }
        
        // Look for longer text blocks that might be descriptions
        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 50);
        if (lines.length > 0) {
          return lines[0]; // Return the first substantial line
        }
        
        return null;
      }
      
    }, category);
  }

  /**
   * Get West Vancouver-specific field mapping that extends the Active Network base mapping
   * @returns {Object} West Vancouver field mapping configuration
   */
  getActiveNetworkFieldMapping() {
    return {
      ...super.getActiveNetworkFieldMapping(),
      // West Vancouver-specific overrides and additions
      name: 'name',
      externalId: { path: 'categoryId', transform: (val, activity) => val || `westvancouver_${activity.name}_${Date.now()}` },
      category: 'category',
      subcategory: 'name',
      description: 'description',
      schedule: 'schedule',
      cost: 'cost',
      registrationUrl: 'registrationUrl',
      locationName: 'location',
      dates: 'dates',
      ageMin: 'ageRange.min',
      ageMax: 'ageRange.max',
      registrationStatus: 'availability',
      instructor: 'instructor'
    };
  }

  /**
   * Get default West Vancouver configuration
   * @returns {Object} West Vancouver configuration
   */
  static getDefaultConfig() {
    return {
      name: 'West Vancouver Recreation',
      code: 'westvanrec',
      platform: 'activenetwork',
      baseUrl: 'https://anc.ca.apm.activecommunities.com/westvanrec',
      scraperConfig: {
        type: 'search',
        entryPoints: [
          '/activity/search'
        ],
        maxAge: 18,
        categoryFiltering: true,
        searchParams: {
          onlineSiteId: 0,
          activity_select_param: 2,
          max_age: 18,
          viewMode: 'list'
        },
        rateLimits: {
          requestsPerMinute: 30,
          concurrentRequests: 3
        },
        timeout: 60000,
        retries: 3
      },
      region: 'West Vancouver',
      isActive: true
    };
  }

  /**
   * Build West Vancouver-specific search URL
   * @param {String} baseUrl - Base URL
   * @param {Object} params - Search parameters
   * @returns {String} Complete search URL
   */
  buildSearchUrl(baseUrl, params) {
    // West Vancouver specific URL building
    const fullBaseUrl = `${this.config.baseUrl}${baseUrl}`;
    return super.buildSearchUrl(fullBaseUrl, params);
  }

  /**
   * Discover West Vancouver activity categories
   * @param {Object} browser - Puppeteer browser
   * @param {String} searchUrl - Search URL
   * @returns {Promise<Array>} Available categories
   */
  async discoverActiveNetworkCategories(browser, searchUrl) {
    const page = await browser.newPage();
    
    try {
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
      await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 60000 });
      
      // Wait longer for West Vancouver's Active Network to load
      await page.waitForSelector('body', { timeout: 30000 });
      await new Promise(resolve => setTimeout(resolve, 5000));

      // West Vancouver specific category discovery
      const categories = await page.evaluate(() => {
        const categories = [];
        
        // West Vancouver specific category selectors
        const categorySelectors = [
          'a[href*="ActivityCategoryID"]',
          'a[href*="category"]',
          '.category-link',
          '.activity-category',
          'nav a',
          '.filter-option a'
        ];
        
        for (const selector of categorySelectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            elements.forEach(el => {
              const href = el.href;
              const text = el.textContent?.trim();
              if (href && text && text.length > 2 && !text.includes('Home') && !text.includes('Back')) {
                const categoryIdMatch = href.match(/ActivityCategoryID=(\d+)/);
                categories.push({
                  name: text,
                  url: href,
                  categoryId: categoryIdMatch ? categoryIdMatch[1] : null
                });
              }
            });
            break;
          }
        }
        
        // If no specific categories found, try main activity categories
        if (categories.length === 0) {
          const defaultCategories = [
            'Arts', 'Camps', 'Sports', 'Aquatics', 'Fitness', 'Recreation'
          ];
          
          defaultCategories.forEach(categoryName => {
            categories.push({
              name: categoryName,
              url: window.location.href,
              categoryId: null
            });
          });
        }
        
        return categories;
      });

      this.logProgress(`Discovered ${categories.length} West Vancouver categories: ${categories.map(c => c.name).join(', ')}`);
      return categories;
      
    } finally {
      await page.close();
    }
  }
}

module.exports = WestVancouverScraper;