const BaseScraper = require('../base/BaseScraper');
const DataNormalizer = require('../base/DataNormalizer');
const puppeteer = require('puppeteer');

/**
 * Platform scraper for Active Network-based recreation websites
 * Handles category-based navigation and search result parsing
 * common to Active Network systems
 */
class ActiveNetworkScraper extends BaseScraper {
  constructor(config) {
    super(config);
    this.platformName = 'Active Network';
  }

  /**
   * Main scraping method for Active Network platforms
   * @returns {Promise<{activities: Array, stats: Object, report: String}>}
   */
  async scrape() {
    const startTime = Date.now();
    this.logProgress('Starting Active Network scraper');

    try {
      // Validate configuration
      this.validateConfig();
      this.validateActiveNetworkConfig();

      // Get provider record
      const provider = await this.getOrCreateProvider();
      
      // Extract activities using Active Network-specific methods
      const rawActivities = await this.extractActiveNetworkActivities();
      
      // Normalize the data
      const normalizedActivities = await this.normalizeActivities(rawActivities);
      
      // Save to database
      const stats = await this.saveActivitiesToDatabase(normalizedActivities, provider.id);
      
      // Generate report
      const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
      const report = this.generateReport(stats, duration);
      
      this.logProgress(`Scraping completed in ${duration} minutes`);
      
      return {
        activities: normalizedActivities,
        stats: stats,
        report: report
      };

    } catch (error) {
      this.handleError(error, 'scrape');
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Validate Active Network-specific configuration
   */
  validateActiveNetworkConfig() {
    const scraperConfig = this.config.scraperConfig;
    
    if (!scraperConfig) {
      throw new Error('scraperConfig is required for Active Network scraper');
    }

    if (scraperConfig.type !== 'search') {
      throw new Error('Active Network scraper requires scraperConfig.type = "search"');
    }

    if (!scraperConfig.searchParams) {
      throw new Error('Active Network scraper requires scraperConfig.searchParams');
    }
  }

  /**
   * Extract activities using Active Network search and category navigation
   * @returns {Promise<Array>} Raw activity data
   */
  async extractActiveNetworkActivities() {
    const activities = [];
    const { entryPoints, maxAge = 18, searchParams } = this.config.scraperConfig;
    
    if (!entryPoints || entryPoints.length === 0) {
      throw new Error('No entry points configured for Active Network scraper');
    }

    // Build search URL with kids filter
    // Build the full URL - handle relative paths
    const entryUrl = entryPoints[0].startsWith('http') ? entryPoints[0] : `${this.config.baseUrl}${entryPoints[0]}`;
    const searchUrl = this.buildSearchUrl(entryUrl, { ...searchParams, max_age: maxAge });
    
    this.logProgress(`Starting extraction from: ${searchUrl}`);

    let browser;
    try {
      browser = await puppeteer.launch({
        headless: this.config.scraperConfig.headless !== false,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--window-size=1920,1080'
        ]
      });

      // First, discover activity categories
      const categories = await this.discoverActiveNetworkCategories(browser, searchUrl);
      
      this.logProgress(`Found ${categories.length} activity categories`);

      // Process each category
      for (const category of categories) {
        try {
          this.logProgress(`Processing category: ${category.name}`);
          const categoryActivities = await this.extractCategoryActivities(browser, category);
          activities.push(...categoryActivities);
          this.logProgress(`  ✅ Found ${categoryActivities.length} activities in ${category.name}`);
        } catch (error) {
          this.handleError(error, `processing category ${category.name}`);
        }
      }

    } finally {
      if (browser) await browser.close();
    }

    this.logProgress(`Total activities extracted: ${activities.length}`);
    return activities;
  }

  /**
   * Build search URL with parameters
   * @param {String} baseUrl - Base search URL
   * @param {Object} params - Search parameters
   * @returns {String} Complete search URL
   */
  buildSearchUrl(baseUrl, params) {
    if (baseUrl.includes('?')) {
      // URL already has parameters
      const urlParts = baseUrl.split('?');
      const existingParams = new URLSearchParams(urlParts[1]);
      
      // Add new parameters
      Object.entries(params).forEach(([key, value]) => {
        existingParams.set(key, value);
      });
      
      return `${urlParts[0]}?${existingParams.toString()}`;
    } else {
      // Add parameters to URL
      const searchParams = new URLSearchParams(params);
      return `${baseUrl}?${searchParams.toString()}`;
    }
  }

  /**
   * Discover available activity categories from Active Network site
   * @param {Object} browser - Puppeteer browser
   * @param {String} searchUrl - Search URL
   * @returns {Promise<Array>} Available categories
   */
  async discoverActiveNetworkCategories(browser, searchUrl) {
    const page = await browser.newPage();
    
    try {
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
      await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 60000 });
      
      // Wait for the page to load and render
      await page.waitForSelector('body', { timeout: 30000 });
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Try to find category navigation or filters
      const categories = await page.evaluate(() => {
        const categories = [];
        
        // Look for category links or filters
        const categorySelectors = [
          'a[href*="ActivityCategoryID"]',
          '.category-filter a',
          '.activity-category a',
          'nav a[href*="category"]',
          '.filter-category a'
        ];
        
        for (const selector of categorySelectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            elements.forEach(el => {
              const href = el.href;
              const text = el.textContent?.trim();
              if (href && text && text.length > 2) {
                // Extract category ID if present
                const categoryIdMatch = href.match(/ActivityCategoryID=(\d+)/);
                categories.push({
                  name: text,
                  url: href,
                  categoryId: categoryIdMatch ? categoryIdMatch[1] : null
                });
              }
            });
            break; // Found categories, don't need to try other selectors
          }
        }
        
        // If no categories found, create a default search
        if (categories.length === 0) {
          categories.push({
            name: 'All Activities',
            url: window.location.href,
            categoryId: null
          });
        }
        
        return categories;
      });

      return categories;
      
    } finally {
      await page.close();
    }
  }

  /**
   * Extract activities from a specific category
   * @param {Object} browser - Puppeteer browser
   * @param {Object} category - Category information
   * @returns {Promise<Array>} Activities from this category
   */
  async extractCategoryActivities(browser, category) {
    const page = await browser.newPage();
    const activities = [];
    
    try {
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
      await page.goto(category.url, { waitUntil: 'networkidle2', timeout: 60000 });
      
      // Wait for activity listings to load
      await page.waitForSelector('body', { timeout: 30000 });
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Handle pagination if present
      let hasMorePages = true;
      let pageNum = 1;

      while (hasMorePages) {
        this.logProgress(`  Processing page ${pageNum} of ${category.name}`);
        
        // Extract activities from current page
        const pageActivities = await this.extractActivitiesFromActiveNetworkPage(page, category);
        activities.push(...pageActivities);
        
        // Check if there's a next page
        hasMorePages = await this.navigateToNextPage(page);
        if (hasMorePages) {
          pageNum++;
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      
    } finally {
      await page.close();
    }

    return activities;
  }

  /**
   * Extract activities from Active Network activity listing page
   * @param {Object} page - Puppeteer page
   * @param {Object} category - Category information
   * @returns {Promise<Array>} Extracted activities
   */
  async extractActivitiesFromActiveNetworkPage(page, category) {
    return await page.evaluate((categoryInfo) => {
      const activities = [];
      
      // Active Network typically uses these patterns for activity listings
      const activitySelectors = [
        '.activity-item',
        '.activity-listing',
        '.program-item',
        'tr.activity-row',
        '.search-result-item'
      ];
      
      let activityElements = [];
      
      // Find the right selector that contains activities
      for (const selector of activitySelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          activityElements = Array.from(elements);
          break;
        }
      }
      
      // If no specific activity elements found, look for table rows or list items
      if (activityElements.length === 0) {
        // Try table rows that might contain activity data
        const rows = Array.from(document.querySelectorAll('table tr, tbody tr'));
        activityElements = rows.filter(row => {
          const text = row.textContent || '';
          return text.includes('$') || text.includes('Register') || text.includes('Age');
        });
      }

      activityElements.forEach((element, index) => {
        try {
          const text = element.textContent || '';
          const innerHTML = element.innerHTML || '';
          
          // Extract activity data using common patterns
          const activity = {
            // Basic identification
            elementIndex: index,
            category: categoryInfo.name,
            categoryId: categoryInfo.categoryId,
            
            // Raw data for normalization
            rawText: text,
            rawHTML: innerHTML,
            
            // Try to extract common fields
            name: this.extractActivityName(element, text),
            cost: this.extractCost(text),
            schedule: this.extractSchedule(text),
            location: this.extractLocation(text),
            registrationUrl: this.extractRegistrationUrl(element),
            
            // Additional fields that might be present
            ageRange: this.extractAgeRange(text),
            dates: this.extractDates(text),
            availability: this.extractAvailability(text)
          };
          
          // Only include if we found meaningful data
          if (activity.name || activity.cost || activity.registrationUrl) {
            activities.push(activity);
          }
          
        } catch (error) {
          console.error('Error extracting activity from element:', error);
        }
      });
      
      return activities;
      
      // Helper functions for extraction
      function extractActivityName(element, text) {
        // Try different selectors for activity name
        const nameSelectors = ['.activity-name', '.program-title', 'h3', 'h4', '.title'];
        
        for (const selector of nameSelectors) {
          const nameEl = element.querySelector(selector);
          if (nameEl && nameEl.textContent.trim()) {
            return nameEl.textContent.trim();
          }
        }
        
        // Extract from text patterns
        const lines = text.split('\\n').map(l => l.trim()).filter(l => l);
        if (lines.length > 0) {
          return lines[0]; // First non-empty line often contains the name
        }
        
        return null;
      }
      
      function extractCost(text) {
        const costMatch = text.match(/\\$([0-9,]+(?:\\.\\d{2})?)/);
        return costMatch ? costMatch[1] : null;
      }
      
      function extractSchedule(text) {
        // Look for day/time patterns
        const schedulePatterns = [
          /([A-Za-z]{3,9}(?:\\s*,\\s*[A-Za-z]{3,9})*)\\s*([0-9]{1,2}:[0-9]{2}\\s*[APMapm]{2}\\s*-\\s*[0-9]{1,2}:[0-9]{2}\\s*[APMapm]{2})/,
          /(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)[^\\n]*[0-9]{1,2}:[0-9]{2}/i
        ];
        
        for (const pattern of schedulePatterns) {
          const match = text.match(pattern);
          if (match) {
            return match[0];
          }
        }
        
        return null;
      }
      
      function extractLocation(text) {
        // Look for location patterns
        const locationKeywords = ['Centre', 'Center', 'Park', 'Arena', 'Pool', 'Field', 'Gym'];
        for (const keyword of locationKeywords) {
          const match = text.match(new RegExp(`([^\\n]*${keyword}[^\\n]*)`, 'i'));
          if (match) {
            return match[1].trim();
          }
        }
        return null;
      }
      
      function extractRegistrationUrl(element) {
        const links = element.querySelectorAll('a[href]');
        for (const link of links) {
          const href = link.href;
          if (href.includes('register') || href.includes('enroll') || href.includes('signup')) {
            return href;
          }
        }
        return null;
      }
      
      function extractAgeRange(text) {
        const ageMatch = text.match(/(?:Age|Ages?)\\s*:?\\s*(\\d+)\\s*(?:to|-|–)\\s*(\\d+)/i);
        if (ageMatch) {
          return {
            min: parseInt(ageMatch[1]),
            max: parseInt(ageMatch[2])
          };
        }
        return null;
      }
      
      function extractDates(text) {
        // Look for date ranges
        const dateMatch = text.match(/([A-Z][a-z]{2}\\s+\\d{1,2})\\s*(?:to|-|–)\\s*([A-Z][a-z]{2}\\s+\\d{1,2})/);
        if (dateMatch) {
          return `${dateMatch[1]} - ${dateMatch[2]}`;
        }
        return null;
      }
      
      function extractAvailability(text) {
        if (text.toLowerCase().includes('full') || text.toLowerCase().includes('sold out')) {
          return 'Full';
        } else if (text.toLowerCase().includes('register') || text.toLowerCase().includes('sign up')) {
          return 'Open';
        } else if (text.toLowerCase().includes('closed')) {
          return 'Closed';
        }
        return 'Unknown';
      }
      
    }, category);
  }

  /**
   * Navigate to next page if pagination exists
   * @param {Object} page - Puppeteer page
   * @returns {Promise<Boolean>} True if navigated to next page
   */
  async navigateToNextPage(page) {
    try {
      // Look for next page links or buttons
      const nextPageSelectors = [
        'a[aria-label="Next"]',
        '.next-page',
        '.pagination-next',
        'a:contains("Next")',
        '[data-page="next"]'
      ];

      for (const selector of nextPageSelectors) {
        const nextButton = await page.$(selector);
        if (nextButton) {
          const isDisabled = await nextButton.evaluate(el => 
            el.disabled || el.classList.contains('disabled') || el.getAttribute('aria-disabled') === 'true'
          );
          
          if (!isDisabled) {
            await nextButton.click();
            await page.waitForTimeout(2000);
            return true;
          }
        }
      }
      
      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Normalize Active Network activities using the base normalizer
   * @param {Array} rawActivities - Raw activities from extraction
   * @returns {Promise<Array>} Normalized activities
   */
  async normalizeActivities(rawActivities) {
    const fieldMapping = this.getActiveNetworkFieldMapping();
    const normalized = [];

    for (const rawActivity of rawActivities) {
      try {
        const normalizedActivity = DataNormalizer.normalizeActivity(
          rawActivity,
          fieldMapping,
          this.config
        );
        
        // Validate the normalized data
        const validation = this.validateActivityData(normalizedActivity);
        if (validation.isValid) {
          normalized.push(normalizedActivity);
        } else {
          this.logProgress(`Invalid activity data for ${rawActivity.name}: ${validation.errors.join(', ')}`);
        }
      } catch (error) {
        this.handleError(error, `normalizing activity ${rawActivity.name}`);
      }
    }

    this.logProgress(`Normalized ${normalized.length}/${rawActivities.length} activities`);
    return normalized;
  }

  /**
   * Get field mapping configuration for Active Network platform
   * @returns {Object} Field mapping configuration
   */
  getActiveNetworkFieldMapping() {
    return {
      name: 'name',
      externalId: { path: 'categoryId', transform: (val) => val || 'generated' },
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
      registrationStatus: 'availability'
    };
  }

  /**
   * Get or create provider record
   * @returns {Promise<Object>} Provider record
   */
  async getOrCreateProvider() {
    let provider = await this.prisma.provider.findFirst({
      where: { name: this.config.name }
    });

    if (!provider) {
      provider = await this.prisma.provider.create({
        data: {
          name: this.config.name,
          website: this.config.baseUrl,
          platform: this.config.platform,
          region: this.config.region,
          scraperConfig: this.config.scraperConfig,
          isActive: true
        }
      });
      this.logProgress(`Created new provider: ${provider.name}`);
    }

    return provider;
  }
}

module.exports = ActiveNetworkScraper;