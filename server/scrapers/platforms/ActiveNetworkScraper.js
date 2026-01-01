const BaseScraper = require('../base/BaseScraper');
const DataNormalizer = require('../base/DataNormalizer');
const puppeteer = require('puppeteer');
const { generateExternalId, extractNativeId } = require('../utils/stableIdGenerator');

/**
 * Generate a stable ID for Active Network activities.
 * Priority: native ID from URL/page > stable hash (name + location only)
 *
 * @param {Object} activity - Activity object
 * @returns {String} Stable external ID
 */
function generateStableActivityId(activity) {
  // Use the centralized ID generator with Active Network-specific options
  return generateExternalId(activity, {
    platform: 'activenetwork',
    providerCode: 'an',
    hashPrefix: 'an'
  });
}

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

      // Enhance with location data from detail pages
      const enhancedActivities = await this.enhanceWithLocationData(rawActivities);

      // Normalize the data
      const normalizedActivities = await this.normalizeActivities(enhancedActivities);

      // Save to database - use batch method for large datasets (500+ activities)
      const stats = normalizedActivities.length >= 500
        ? await this.saveActivitiesToDatabaseBatch(normalizedActivities, provider.id)
        : await this.saveActivitiesToDatabase(normalizedActivities, provider.id);

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
        protocolTimeout: 600000, // 10 minutes for large sites like Vancouver
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
    let activities = [];

    try {
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
      await page.setViewport({ width: 1920, height: 1080 });
      await page.goto(category.url, { waitUntil: 'networkidle2', timeout: 90000 });

      // Wait longer for JavaScript-heavy ActiveNet to render
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Wait for activity cards to appear
      try {
        await page.waitForSelector('.card.activity-card, .activity-card', { timeout: 15000 });
      } catch (e) {
        this.logProgress(`  Warning: No activity cards found for ${category.name}`);
      }

      // Check total results from page
      const totalResults = await page.evaluate(() => {
        const text = document.body.innerText;
        // Try multiple patterns to find the total
        const patterns = [
          /Found\s+([\d,]+)/i,
          /([\d,]+)\s*results?/i,
          /([\d,]+)\s*activities?/i
        ];
        for (const pattern of patterns) {
          const match = text.match(pattern);
          if (match) {
            return parseInt(match[1].replace(/,/g, ''));
          }
        }
        return null;
      });

      this.logProgress(`  Total results on page: ${totalResults || 'unknown'}`);

      // Get the maximum activities to load from config (no default limit)
      const maxActivities = this.config.scraperConfig.maxActivities || Infinity;

      // For large cities (1000+ activities) or when total is unknown, prefer API extraction
      // This is faster and more reliable than scroll-based extraction
      const useAPIDirectly = (totalResults && totalResults >= 500) ||
                            (this.config.metadata?.expectedActivities >= 1000) ||
                            (this.config.metadata?.population >= 500000);

      if (useAPIDirectly) {
        this.logProgress(`  Using direct API extraction for large dataset`);
        activities = await this.extractActivitiesViaAPI(page, category, maxActivities);
      } else {
        // For smaller cities, try scroll-based extraction first
        const scrollActivities = await this.scrollAndExtractBatched(page, category, maxActivities);
        activities.push(...scrollActivities);

        this.logProgress(`  Scroll extraction: ${activities.length} activities`);

        // If we got significantly fewer than expected, fall back to API
        if (totalResults && activities.length < totalResults * 0.5) {
          this.logProgress(`  Falling back to API (scroll got ${activities.length}/${totalResults})`);
          activities = await this.extractActivitiesViaAPI(page, category, maxActivities);
        }
      }

      this.logProgress(`  Extracted ${activities.length} total activities from ${category.name}`);

    } finally {
      await page.close();
    }

    return activities;
  }

  /**
   * Extract activities using direct API calls with pagination
   * Uses full URL with credentials for proper session handling
   * @param {Object} page - Puppeteer page (already loaded with session)
   * @param {Object} category - Category information
   * @param {Number} maxActivities - Maximum activities to fetch
   * @returns {Promise<Array>} Extracted activities
   */
  async extractActivitiesViaAPI(page, category, maxActivities) {
    const { searchParams, ageFilter } = this.config.scraperConfig;
    const maxAge = ageFilter?.maxAge || 18;
    const baseUrl = this.config.baseUrl;

    // Build the full API URL
    const apiUrl = `${baseUrl}/rest/activities/list?locale=en-US`;

    // First, get the total count
    this.logProgress(`    Fetching activity count from API...`);
    const initialResult = await page.evaluate(async (apiUrl, maxAge, searchParams) => {
      try {
        const pageInfo = JSON.stringify({
          order_by: 'Date range',
          page_number: 1,
          total_records_per_page: 20
        });

        const response = await fetch(apiUrl, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            'page_info': pageInfo
          },
          body: JSON.stringify({
            activity_search_pattern: {
              skills: [],
              time_after_str: '',
              days_of_week: searchParams?.days_of_week || '0000000',
              activity_select_param: searchParams?.activity_select_param || 2,
              center_ids: [],
              time_before_str: '',
              open_spots: null,
              activity_id: null,
              activity_category_ids: [],
              date_before: '',
              min_age: null,
              date_after: '',
              activity_type_ids: [],
              site_ids: [],
              for_map: false,
              geographic_area_ids: [],
              season_ids: [],
              activity_department_ids: [],
              activity_other_category_ids: [],
              child_season_ids: [],
              activity_keyword: '',
              instructor_ids: [],
              max_age: maxAge,
              custom_price_from: '',
              custom_price_to: ''
            },
            activity_transfer_pattern: {}
          })
        });

        const data = await response.json();
        return {
          success: true,
          totalRecords: data.headers?.page_info?.total_records || 0,
          totalPages: data.headers?.page_info?.total_page || 0,
          items: data.body?.activity_items || []
        };
      } catch (e) {
        return { success: false, error: e.message };
      }
    }, apiUrl, maxAge, searchParams);

    if (!initialResult.success) {
      this.logProgress(`    API error: ${initialResult.error}`);
      return [];
    }

    const totalRecords = initialResult.totalRecords;
    const totalPages = initialResult.totalPages;
    const effectiveMax = Math.min(maxActivities, totalRecords);
    const pagesToFetch = Math.min(Math.ceil(effectiveMax / 20), totalPages);

    this.logProgress(`    Found ${totalRecords} total activities (${totalPages} pages), fetching up to ${effectiveMax}`);

    // For large datasets (1000+ activities), use parallel fetching
    if (totalRecords >= 1000) {
      return await this.extractActivitiesViaAPIParallel(page, category, apiUrl, maxAge, searchParams, pagesToFetch, initialResult.items);
    }

    // For smaller datasets, use sequential fetching
    return await this.extractActivitiesViaAPISequential(page, category, apiUrl, maxAge, searchParams, pagesToFetch, initialResult.items, effectiveMax);
  }

  /**
   * Extract activities using parallel API pagination
   * Used for large cities with 1000+ activities
   * @param {Object} page - Puppeteer page
   * @param {Object} category - Category information
   * @param {String} apiUrl - Full API URL
   * @param {Number} maxAge - Max age filter
   * @param {Object} searchParams - Search parameters
   * @param {Number} totalPages - Total pages to fetch
   * @param {Array} firstPageItems - Items from first page (already fetched)
   * @returns {Promise<Array>} All activities
   */
  async extractActivitiesViaAPIParallel(page, category, apiUrl, maxAge, searchParams, totalPages, firstPageItems) {
    // Reduce concurrency for very large datasets to prevent browser crashes
    // Toronto has 700+ pages which was causing "Connection closed" errors
    const CONCURRENT_REQUESTS = totalPages > 500 ? 5 : totalPages > 200 ? 8 : 10;
    const allActivities = [];
    const seenIds = new Set();

    // Add first page items
    for (const item of firstPageItems) {
      if (!seenIds.has(item.id)) {
        seenIds.add(item.id);
        allActivities.push(this.convertAPIItemToActivity(item, category));
      }
    }

    this.logProgress(`    Using parallel fetching with ${CONCURRENT_REQUESTS} concurrent requests`);

    // Create batches of page numbers
    const pageNumbers = [];
    for (let i = 2; i <= totalPages; i++) {
      pageNumbers.push(i);
    }

    // Process in batches
    for (let batchStart = 0; batchStart < pageNumbers.length; batchStart += CONCURRENT_REQUESTS) {
      const batch = pageNumbers.slice(batchStart, batchStart + CONCURRENT_REQUESTS);

      const batchResults = await page.evaluate(async (apiUrl, maxAge, searchParams, pageNums) => {
        const results = await Promise.all(pageNums.map(async (pageNum) => {
          try {
            const pageInfo = JSON.stringify({
              order_by: 'Date range',
              page_number: pageNum,
              total_records_per_page: 20
            });

            const response = await fetch(apiUrl, {
              method: 'POST',
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                'page_info': pageInfo
              },
              body: JSON.stringify({
                activity_search_pattern: {
                  max_age: maxAge,
                  activity_select_param: searchParams?.activity_select_param || 2
                },
                activity_transfer_pattern: {}
              })
            });

            const data = await response.json();
            return { success: true, pageNum, items: data.body?.activity_items || [] };
          } catch (e) {
            return { success: false, pageNum, error: e.message };
          }
        }));
        return results;
      }, apiUrl, maxAge, searchParams, batch);

      // Process batch results
      for (const result of batchResults) {
        if (result.success && result.items) {
          for (const item of result.items) {
            if (!seenIds.has(item.id)) {
              seenIds.add(item.id);
              allActivities.push(this.convertAPIItemToActivity(item, category));
            }
          }
        }
      }

      // Log progress every 50 pages
      const pagesProcessed = Math.min(batchStart + CONCURRENT_REQUESTS, pageNumbers.length) + 1;
      if (pagesProcessed % 50 === 0 || batchStart + CONCURRENT_REQUESTS >= pageNumbers.length) {
        this.logProgress(`    Progress: ${allActivities.length} activities (${pagesProcessed}/${totalPages} pages)`);
      }

      // Small delay between batches to avoid rate limiting
      // Longer delay for very large datasets to prevent memory issues
      const batchDelay = totalPages > 500 ? 500 : totalPages > 200 ? 300 : 200;
      await new Promise(resolve => setTimeout(resolve, batchDelay));
    }

    this.logProgress(`    Parallel fetch complete: ${allActivities.length} total activities`);
    return allActivities;
  }

  /**
   * Extract activities using sequential API pagination
   * Used for smaller cities with <1000 activities
   * @param {Object} page - Puppeteer page
   * @param {Object} category - Category information
   * @param {String} apiUrl - Full API URL
   * @param {Number} maxAge - Max age filter
   * @param {Object} searchParams - Search parameters
   * @param {Number} maxPages - Maximum pages to fetch
   * @param {Array} firstPageItems - Items from first page
   * @param {Number} maxActivities - Maximum activities to fetch
   * @returns {Promise<Array>} All activities
   */
  async extractActivitiesViaAPISequential(page, category, apiUrl, maxAge, searchParams, maxPages, firstPageItems, maxActivities) {
    const activities = [];
    const seenIds = new Set();

    // Add first page items
    for (const item of firstPageItems) {
      if (!seenIds.has(item.id)) {
        seenIds.add(item.id);
        activities.push(this.convertAPIItemToActivity(item, category));
      }
    }

    let pageNum = 2;
    while (pageNum <= maxPages && activities.length < maxActivities) {
      const result = await page.evaluate(async (apiUrl, maxAge, searchParams, pageNum) => {
        try {
          const pageInfo = JSON.stringify({
            order_by: 'Date range',
            page_number: pageNum,
            total_records_per_page: 20
          });

          const response = await fetch(apiUrl, {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'X-Requested-With': 'XMLHttpRequest',
              'page_info': pageInfo
            },
            body: JSON.stringify({
              activity_search_pattern: {
                max_age: maxAge,
                activity_select_param: searchParams?.activity_select_param || 2
              },
              activity_transfer_pattern: {}
            })
          });

          const data = await response.json();
          return { success: true, items: data.body?.activity_items || [] };
        } catch (e) {
          return { success: false, error: e.message };
        }
      }, apiUrl, maxAge, searchParams, pageNum);

      if (!result.success || result.items.length === 0) {
        break;
      }

      for (const item of result.items) {
        if (!seenIds.has(item.id)) {
          seenIds.add(item.id);
          activities.push(this.convertAPIItemToActivity(item, category));
        }
      }

      if (pageNum % 20 === 0) {
        this.logProgress(`    Sequential fetch: ${activities.length} activities (page ${pageNum})`);
      }

      pageNum++;
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return activities;
  }

  /**
   * Convert API response item to activity format
   * @param {Object} item - API response item
   * @param {Object} category - Category information
   * @returns {Object} Activity object
   */
  convertAPIItemToActivity(item, category) {
    // Handle location - can be string or object with label
    const locationName = typeof item.location === 'object'
      ? item.location?.label
      : item.location;

    // Handle cost - search_from_price or parse from fee object
    let cost = null;
    if (item.search_from_price !== null && item.search_from_price !== undefined) {
      cost = parseFloat(item.search_from_price);
    } else {
      cost = this.parseAPICost(item.fee);
    }

    // Handle description
    const description = item.desc || item.description || null;

    // Extract courseId from detail URL - the numeric ID at the end (e.g., /205255?)
    // This is the activity ID in ActiveNetwork's system
    const urlCourseId = item.detail_url?.match(/\/(\d+)(?:\?|$)/)?.[1];

    // Determine registration status from multiple sources
    const registrationStatus = this.determineAPIRegistrationStatus(item);

    // Override spotsAvailable to 0 if status is Full/Waitlist
    // (API's total_open might include waitlist spots which is misleading)
    let spotsAvailable = item.total_open ?? null;
    if (registrationStatus === 'Full' || registrationStatus === 'Waitlist' || registrationStatus === 'Closed') {
      spotsAvailable = 0;
    }

    return {
      name: item.name,
      externalId: String(item.id || item.number),
      courseId: urlCourseId || String(item.id || item.number || ''),
      category: category.name,
      cost: cost,
      description: description,
      registrationUrl: item.detail_url,
      schedule: item.time_range,
      startTime: this.parseAPITime(item.time_range_landing_page, 'start'),
      endTime: this.parseAPITime(item.time_range_landing_page, 'end'),
      dayOfWeek: item.days_of_week?.split(',').map(d => d.trim()) || [],
      dateStartStr: item.date_range_start,
      dateEndStr: item.date_range_end,
      dates: item.date_range,
      locationName: locationName,
      ageMin: item.age_min_year || null,
      ageMax: item.age_max_year || null,
      ageRange: item.age_description,
      spotsAvailable: spotsAvailable,
      availability: registrationStatus,
      registrationStatus: registrationStatus
    };
  }

  /**
   * Determine registration status from API response item
   * Checks multiple fields in priority order
   * @param {Object} item - API response item
   * @returns {String} Registration status
   */
  determineAPIRegistrationStatus(item) {
    // Priority 1: Check urgent_message for status description
    const urgentStatus = item.urgent_message?.status_description?.toLowerCase() || '';
    if (urgentStatus) {
      // Check waitlist before full (e.g., "FULL - Waitlist Available")
      if (urgentStatus.includes('waitlist') || urgentStatus.includes('waiting')) {
        return 'Waitlist';
      }
      if (urgentStatus.includes('full') || urgentStatus.includes('sold out')) {
        return 'Full';
      }
      if (urgentStatus.includes('closed') || urgentStatus.includes('ended')) {
        return 'Closed';
      }
      if (urgentStatus.includes('cancel')) {
        return 'Cancelled';
      }
      if (urgentStatus.includes('register') || urgentStatus.includes('open') || urgentStatus.includes('enroll')) {
        return 'Open';
      }
    }

    // Priority 2: Check corner_mark (visual status badge) - MORE RELIABLE than total_open
    // The corner_mark shows "Full", "Waitlist", "X spots left" etc. and indicates actual status
    // even when total_open > 0 (which might be waitlist spots)
    const cornerMark = item.corner_mark?.toLowerCase() || '';
    if (cornerMark) {
      if (cornerMark.includes('waitlist') || cornerMark.includes('waiting')) return 'Waitlist';
      if (cornerMark.includes('full')) return 'Full';
      if (cornerMark.includes('closed')) return 'Closed';
      // Only return Open if corner_mark explicitly shows availability
      if (cornerMark.includes('space') || cornerMark.includes('spot') || cornerMark.includes('opening')) return 'Open';
    }

    // Priority 3: Check other status fields (before total_open)
    const statusFields = [
      item.status,
      item.activity_status,
      item.registration_status,
      item.availability_status
    ];

    for (const status of statusFields) {
      if (status) {
        const statusLower = String(status).toLowerCase();
        if (statusLower.includes('waitlist') || statusLower.includes('waiting')) {
          return 'Waitlist';
        }
        if (statusLower.includes('full') || statusLower.includes('sold')) {
          return 'Full';
        }
        if (statusLower.includes('closed') || statusLower.includes('ended')) {
          return 'Closed';
        }
        if (statusLower.includes('open') || statusLower.includes('available') || statusLower.includes('register')) {
          return 'Open';
        }
      }
    }

    // Priority 4: Check total_open spots (as fallback)
    // NOTE: total_open might include waitlist spots, so check waitlist FIRST
    if (item.total_open !== null && item.total_open !== undefined) {
      // IMPORTANT: Check waitlist BEFORE checking total_open > 0
      // because total_open can include waitlist spots which is misleading
      if (item.is_waitlist_enabled || item.waitlist_enabled) {
        return 'Waitlist';
      }
      if (item.total_open > 0) {
        return 'Open';
      }
      return 'Full';
    }

    // Priority 5: If activity has a valid date range in the future, assume Open
    // This is a reasonable default for activities without explicit status
    if (item.date_range_end) {
      try {
        const endDate = new Date(item.date_range_end);
        if (endDate > new Date()) {
          return 'Open';
        }
      } catch (e) {
        // Ignore date parsing errors
      }
    }

    // Default: Unknown (only if we truly can't determine)
    return 'Unknown';
  }

  /**
   * Parse cost from API fee field
   * Handles both string and object formats
   */
  parseAPICost(fee) {
    if (!fee) return null;

    // If fee is an object, get the label
    const feeStr = typeof fee === 'object' ? (fee.label || '') : String(fee);

    // "View fee details" means we need to get cost from detail page
    if (feeStr === 'View fee details' || !feeStr) {
      return null;
    }

    // Check for free activities
    if (/\bfree\b/i.test(feeStr) || /\bno\s*(?:fee|cost|charge)\b/i.test(feeStr)) {
      return 0;
    }

    // Extract dollar amount
    const match = feeStr.match(/\$?([0-9,]+(?:\.\d{2})?)/);
    return match ? parseFloat(match[1].replace(',', '')) : null;
  }

  /**
   * Parse time from API time range (e.g., "9:30 AM - 11:30 AM")
   */
  parseAPITime(timeRange, type) {
    if (!timeRange) return null;
    const parts = timeRange.split('-').map(p => p.trim());
    return type === 'start' ? parts[0] : parts[1];
  }

  /**
   * Scroll and extract activities in batches to prevent timeout on large sites
   * This combines scrolling with incremental extraction to handle 10K+ activities
   * @param {Object} page - Puppeteer page
   * @param {Object} category - Category information
   * @param {Number} maxActivities - Maximum number of activities to load
   * @returns {Promise<Array>} Extracted activities
   */
  async scrollAndExtractBatched(page, category, maxActivities = Infinity) {
    this.logProgress('  Scrolling and extracting activities in batches...');

    const allActivities = [];
    let lastExtractedIndex = 0;
    let previousCount = 0;
    let sameCountIterations = 0;
    const maxSameCount = 5;
    const batchSize = 500; // Extract every 500 new activities

    while (sameCountIterations < maxSameCount) {
      // Get current activity count
      const currentCount = await page.evaluate(() => {
        return document.querySelectorAll('.card.activity-card').length;
      });

      if (currentCount >= maxActivities) {
        this.logProgress(`  Reached max activities limit: ${currentCount}`);
        break;
      }

      if (currentCount === previousCount) {
        sameCountIterations++;
      } else {
        sameCountIterations = 0;
        if (currentCount % 100 === 0 || currentCount - previousCount > 50) {
          this.logProgress(`    Loaded ${currentCount} activities so far...`);
        }
      }

      // Extract batch when we have enough new activities
      if (currentCount - lastExtractedIndex >= batchSize) {
        this.logProgress(`    Extracting batch: activities ${lastExtractedIndex} to ${currentCount}...`);
        const batchActivities = await this.extractActivityBatch(page, category, lastExtractedIndex, currentCount);
        allActivities.push(...batchActivities);
        lastExtractedIndex = currentCount;
        this.logProgress(`    Batch extracted. Total so far: ${allActivities.length}`);
      }

      previousCount = currentCount;

      // Scroll to bottom to trigger infinite scroll
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });

      // Wait for new content to load
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Check if the load-more element is still active
      const isLoading = await page.evaluate(() => {
        const loadMore = document.querySelector('.load-more .an-loading-more');
        return loadMore && loadMore.offsetParent !== null;
      });

      if (!isLoading && sameCountIterations >= 2) {
        break;
      }
    }

    // Extract any remaining activities
    const finalCount = await page.evaluate(() => {
      return document.querySelectorAll('.card.activity-card').length;
    });

    if (finalCount > lastExtractedIndex) {
      this.logProgress(`    Extracting final batch: activities ${lastExtractedIndex} to ${finalCount}...`);
      const finalBatch = await this.extractActivityBatch(page, category, lastExtractedIndex, finalCount);
      allActivities.push(...finalBatch);
    }

    this.logProgress(`  Finished: extracted ${allActivities.length} activities total`);

    // Scroll back to top
    await page.evaluate(() => window.scrollTo(0, 0));
    await new Promise(resolve => setTimeout(resolve, 1000));

    return allActivities;
  }

  /**
   * Extract a batch of activities by index range
   * @param {Object} page - Puppeteer page
   * @param {Object} category - Category information
   * @param {Number} startIndex - Starting index
   * @param {Number} endIndex - Ending index
   * @returns {Promise<Array>} Extracted activities
   */
  async extractActivityBatch(page, category, startIndex, endIndex) {
    return await page.evaluate((categoryInfo, start, end) => {
      const activities = [];
      const elements = document.querySelectorAll('.card.activity-card');

      // Only process elements in the specified range
      for (let i = start; i < Math.min(end, elements.length); i++) {
        const element = elements[i];
        try {
          const text = element.textContent || '';

          // Parse schedule into components
          const scheduleData = parseSchedule(text);
          const ageRange = extractAgeRange(text);
          const dateData = parseDates(text);

          const activity = {
            elementIndex: i,
            category: categoryInfo.name,
            categoryId: categoryInfo.categoryId,
            rawText: text,
            name: extractActivityName(element),
            externalId: extractActivityId(element),
            cost: extractCost(element, text),
            schedule: scheduleData.raw,
            dayOfWeek: scheduleData.days,
            startTime: scheduleData.startTime,
            endTime: scheduleData.endTime,
            location: extractLocation(element, text),
            locationName: extractLocation(element, text),
            registrationUrl: extractRegistrationUrl(element),
            ageRange: ageRange,
            ageMin: ageRange?.min || null,
            ageMax: ageRange?.max || null,
            dates: dateData.raw,
            dateStartStr: dateData.startStr,
            dateEndStr: dateData.endStr,
            availability: extractAvailability(element, text),
            registrationStatus: extractAvailability(element, text),
            spotsAvailable: extractSpotsAvailable(element, text)
          };

          // Override spotsAvailable to 0 if status is Full/Waitlist
          const status = activity.registrationStatus?.toLowerCase();
          if (status === 'full' || status === 'waitlist' || status === 'closed') {
            activity.spotsAvailable = 0;
          }

          if (activity.name) {
            activities.push(activity);
          }
        } catch (error) {
          console.error('Error extracting activity:', error);
        }
      }

      return activities;

      // Helper functions (same as extractActivitiesFromActiveNetworkPage)
      function extractActivityName(element) {
        const nameSelectors = [
          '.activity-card-info__name-link a span',
          '.activity-card-info__name-link a',
          '.activity-card-info__name span',
          '.activity-card-info__name',
          '.activity-name',
          '.program-title',
          'h3',
          'h4',
          '.title'
        ];
        for (const selector of nameSelectors) {
          const nameEl = element.querySelector(selector);
          if (nameEl && nameEl.textContent.trim()) {
            return nameEl.textContent.trim();
          }
        }
        return null;
      }

      function extractActivityId(element) {
        const link = element.querySelector('.activity-card-info__name-link a, a[href*="Activity"]');
        if (link) {
          const href = link.href || '';
          const match = href.match(/\/(\d+)(?:\?|$)/);
          if (match) return match[1];
        }
        const text = element.textContent || '';
        const idMatch = text.match(/#(\d+)/);
        return idMatch ? idMatch[1] : null;
      }

      function extractCost(element, text) {
        // First check the fee element (most reliable)
        const feeEl = element.querySelector('.activity-card__fee, [class*="fee"], [class*="price"]');
        if (feeEl) {
          const feeText = feeEl.textContent || '';
          // Check for "Free" in fee element specifically
          if (/\bfree\b/i.test(feeText)) {
            return 0;
          }
          const costMatch = feeText.match(/\$([0-9,]+(?:\.\d{2})?)/);
          if (costMatch) {
            return parseFloat(costMatch[1].replace(',', ''));
          }
        }

        // Check for free activities in text (but not "free parking" etc)
        if (/\bfree\b/i.test(text) && !/\bfree\s+(?:parking|wifi|access)/i.test(text)) {
          // Make sure there's no actual dollar amount
          const costMatch = text.match(/\$([0-9,]+(?:\.\d{2})?)/);
          if (costMatch) {
            const amount = parseFloat(costMatch[1].replace(',', ''));
            if (amount > 0) return amount;
          }
          return 0;
        }

        // Check for "no fee/cost/charge"
        if (/\bno\s*(?:fee|cost|charge)\b/i.test(text)) {
          return 0;
        }

        // Fallback to dollar amount in text
        const costMatch = text.match(/\$([0-9,]+(?:\.\d{2})?)/);
        return costMatch ? parseFloat(costMatch[1].replace(',', '')) : null;
      }

      function extractSchedule(text) {
        const schedulePatterns = [
          /([A-Za-z]{3,9}(?:\s*,\s*[A-Za-z]{3,9})*)\s*([0-9]{1,2}:[0-9]{2}\s*[APMapm]{2}\s*-\s*[0-9]{1,2}:[0-9]{2}\s*[APMapm]{2})/,
          /(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)[^\n]*[0-9]{1,2}:[0-9]{2}/i,
          /([MTWFS][a-z]{0,2})\s+(\d{1,2}:\d{2}\s*(?:am|pm)?\s*-\s*\d{1,2}:\d{2}\s*(?:am|pm)?)/i
        ];
        for (const pattern of schedulePatterns) {
          const match = text.match(pattern);
          if (match) return match[0];
        }
        return null;
      }

      function extractLocation(element, text) {
        // Helper to clean and validate location string
        function cleanLocation(loc) {
          if (!loc) return null;
          loc = loc.trim();
          // Reject if contains garbage patterns
          const garbagePatterns = [
            /View sub-activities/i,
            /Expand the view/i,
            /see individual dates/i,
            /\d{1,2}:\d{2}\s*(AM|PM)/i,  // Contains time
            /January|February|March|April|May|June|July|August|September|October|November|December/i,
            /^\s*empty\s*$/i,
            /^es and times/i,
            /^ion\s/i,
            /^ional\s/i,
            /^rol\s/i
          ];
          for (const pattern of garbagePatterns) {
            if (pattern.test(loc)) return null;
          }
          // Must be reasonable length
          if (loc.length < 3 || loc.length > 100) return null;
          return loc;
        }

        const locationEl = element.querySelector('[class*="location"], [class*="facility"], [class*="venue"]');
        if (locationEl) {
          const cleaned = cleanLocation(locationEl.textContent);
          if (cleaned) return cleaned;
        }
        const locationKeywords = ['Centre', 'Center', 'Park', 'Arena', 'Pool', 'Field', 'Gym', 'Community', 'Recreation'];
        for (const keyword of locationKeywords) {
          const match = text.match(new RegExp(`([^\\n/]*${keyword}[^\\n/]*)`, 'i'));
          if (match) {
            const cleaned = cleanLocation(match[1]);
            if (cleaned) return cleaned;
          }
        }
        return null;
      }

      function extractRegistrationUrl(element) {
        const link = element.querySelector('.activity-card-info__name-link a, a[href*="Activity"]');
        if (link) return link.href;
        const links = element.querySelectorAll('a[href]');
        for (const l of links) {
          const href = l.href;
          if (href && (href.includes('Activity') || href.includes('register') || href.includes('enroll'))) {
            return href;
          }
        }
        return null;
      }

      function extractAgeRange(text) {
        // Helper to parse age strings like "5y 11m 4w" or "5 yrs" to years
        const parseAgeToYears = (ageStr) => {
          if (!ageStr) return null;
          // Handle "Xy Ym Ww" format (e.g., "5y 11m 4w")
          const complexMatch = ageStr.match(/(\d+)y(?:\s*(\d+)m)?(?:\s*(\d+)w)?/i);
          if (complexMatch) {
            const years = parseInt(complexMatch[1]) || 0;
            const months = parseInt(complexMatch[2]) || 0;
            // Round up: 5y 11m = 6 years for max, 5 years for min
            return years + (months > 6 ? 1 : 0);
          }
          // Handle simple "X yrs" or "X years" or just "X"
          const simpleMatch = ageStr.match(/(\d+)/);
          return simpleMatch ? parseInt(simpleMatch[1]) : null;
        };

        // Pattern 1: "Age at least X but less than Y" (St. John's style)
        const atLeastMatch = text.match(/Age\s+at\s+least\s+([\d\w\s]+?)\s+but\s+less\s+than\s+([\d\w\s]+)/i);
        if (atLeastMatch) {
          const min = parseAgeToYears(atLeastMatch[1]);
          const max = parseAgeToYears(atLeastMatch[2]);
          if (min !== null || max !== null) {
            return { min: min || 0, max: max || 99 };
          }
        }

        // Pattern 2: "Age less than X" (max only)
        const lessThanMatch = text.match(/Age\s+less\s+than\s+([\d\w\s]+?)(?:\s|\/|$)/i);
        if (lessThanMatch) {
          const max = parseAgeToYears(lessThanMatch[1]);
          if (max !== null && max < 99) {
            return { min: 0, max };
          }
        }

        // Pattern 3: "Age at least X" (min only)
        const atLeastOnlyMatch = text.match(/Age\s+at\s+least\s+([\d\w\s]+?)(?:\s+yrs|\s|\/|$)/i);
        if (atLeastOnlyMatch && !atLeastMatch) {
          const min = parseAgeToYears(atLeastOnlyMatch[1]);
          if (min !== null) {
            return { min, max: 99 };
          }
        }

        // Original patterns as fallback
        const agePatterns = [
          /(\d+)\s*(?:to|-|–)\s*(\d+)\s*(?:yrs?|years?)/i,
          /(\d+)\s*(?:yrs?|years?)\s*\+/i,
          /(?:Age|Ages?)\s*:?\s*(\d+)\s*(?:to|-|–)\s*(\d+)/i
        ];
        for (const pattern of agePatterns) {
          const match = text.match(pattern);
          if (match) {
            if (match[2]) return { min: parseInt(match[1]), max: parseInt(match[2]) };
            return { min: parseInt(match[1]), max: 99 };
          }
        }
        return null;
      }

      function extractDates(text) {
        const datePatterns = [
          /(\w{3}\s+\d{1,2})\s*-\s*(\w{3}\s+\d{1,2}(?:,?\s*\d{4})?)/,
          /(\d{1,2}\/\d{1,2}\/\d{4})\s*-\s*(\d{1,2}\/\d{1,2}\/\d{4})/,
          /([A-Za-z]+\s+\d{1,2},?\s*\d{4})/
        ];
        for (const pattern of datePatterns) {
          const match = text.match(pattern);
          if (match) return match[0];
        }
        return null;
      }

      function extractAvailability(element, text) {
        const statusEl = element.querySelector('[class*="status"], [class*="availability"]');
        if (statusEl) return statusEl.textContent.trim();
        const lowerText = text.toLowerCase();
        // IMPORTANT: Check waitlist BEFORE full because "Full - Waitlist available" should be Waitlist
        if (lowerText.includes('waitlist') || lowerText.includes('waiting list')) return 'Waitlist';
        if (lowerText.includes('sold out') || lowerText.includes('full')) return 'Full';
        if (lowerText.includes('closed') || lowerText.includes('cancelled')) return 'Closed';
        // Check for various "Open" indicators
        if (lowerText.includes('register') || lowerText.includes('available') ||
            lowerText.includes('enroll') || lowerText.includes('sign up') ||
            lowerText.match(/openings?\s*\d+/) || lowerText.match(/\d+\s*openings?/)) {
          return 'Open';
        }
        // If we have spots available info, assume Open
        const spotsMatch = text.match(/(\d+)\s*spots?\s*(?:left|available|remaining)/i);
        if (spotsMatch && parseInt(spotsMatch[1]) > 0) return 'Open';
        return 'Unknown';
      }

      function extractSpotsAvailable(element, text) {
        const spotsMatch = text.match(/(\d+)\s*spots?\s*(?:left|available|remaining)/i);
        return spotsMatch ? parseInt(spotsMatch[1]) : null;
      }

      function parseSchedule(text) {
        const result = { raw: null, days: [], startTime: null, endTime: null };

        // Day mapping
        const dayMap = {
          'mon': 'Mon', 'monday': 'Mon',
          'tue': 'Tue', 'tuesday': 'Tue', 'tues': 'Tue',
          'wed': 'Wed', 'wednesday': 'Wed',
          'thu': 'Thu', 'thursday': 'Thu', 'thur': 'Thu', 'thurs': 'Thu',
          'fri': 'Fri', 'friday': 'Fri',
          'sat': 'Sat', 'saturday': 'Sat',
          'sun': 'Sun', 'sunday': 'Sun'
        };

        // Pattern 1: "Weekdays 9:00 AM - 4:00 PM" or "Weekdays9:00 AM..."
        const weekdaysMatch = text.match(/Weekdays?\s*(\d{1,2}:\d{2}\s*(?:AM|PM))\s*-\s*(\d{1,2}:\d{2}\s*(?:AM|PM))/i);
        if (weekdaysMatch) {
          result.raw = weekdaysMatch[0];
          result.days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
          result.startTime = weekdaysMatch[1].toUpperCase().replace(/\s+/g, ' ');
          result.endTime = weekdaysMatch[2].toUpperCase().replace(/\s+/g, ' ');
          return result;
        }

        // Pattern 2: "Mon, Wed 9:00 AM - 10:00 AM" or "Saturday 10:00 AM - 11:00 AM"
        const scheduleMatch = text.match(/((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)(?:[,\s]*(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday))*)\s*(\d{1,2}:\d{2}\s*(?:AM|PM))\s*-\s*(\d{1,2}:\d{2}\s*(?:AM|PM))/i);
        if (scheduleMatch) {
          result.raw = scheduleMatch[0];
          const dayStr = scheduleMatch[1].toLowerCase();
          const dayMatches = dayStr.match(/(mon|tue|wed|thu|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/gi);
          if (dayMatches) {
            result.days = [...new Set(dayMatches.map(d => dayMap[d.toLowerCase()] || d))];
          }
          result.startTime = scheduleMatch[2].toUpperCase().replace(/\s+/g, ' ');
          result.endTime = scheduleMatch[3].toUpperCase().replace(/\s+/g, ' ');
          return result;
        }

        // Pattern 3: Just time range "9:30am - 12:00pm"
        const timeMatch = text.match(/(\d{1,2}:\d{2})\s*(am|pm)\s*[-–—]\s*(\d{1,2}:\d{2})\s*(am|pm)/i);
        if (timeMatch) {
          result.raw = timeMatch[0];
          result.startTime = `${timeMatch[1]} ${timeMatch[2].toUpperCase()}`;
          result.endTime = `${timeMatch[3]} ${timeMatch[4].toUpperCase()}`;
        }

        // Extract days separately if not found above
        if (result.days.length === 0) {
          const lowerText = text.toLowerCase();
          Object.entries(dayMap).forEach(([pattern, abbrev]) => {
            if (lowerText.includes(pattern) && !result.days.includes(abbrev)) {
              result.days.push(abbrev);
            }
          });
        }

        return result;
      }

      function parseDates(text) {
        const result = { raw: null, startStr: null, endStr: null };

        // Pattern 0: "January 6, 2025 to January 6, 2026" (full month names with "to" separator)
        // ActiveNetwork list pages use this format
        const fullMonthToMatch = text.match(/([A-Z][a-z]+\s+\d{1,2},?\s*\d{4})\s+to\s+([A-Z][a-z]+\s+\d{1,2},?\s*\d{4})/i);
        if (fullMonthToMatch) {
          result.raw = fullMonthToMatch[0];
          result.startStr = fullMonthToMatch[1];
          result.endStr = fullMonthToMatch[2];
          return result;
        }

        // Pattern 1: "Jan 6 - Mar 24, 2025" or "Jan 6, 2025 - Mar 24, 2025"
        const dateRangeMatch = text.match(/([A-Z][a-z]{2}\s+\d{1,2}(?:,?\s*\d{4})?)\s*[-–—]\s*([A-Z][a-z]{2}\s+\d{1,2}(?:,?\s*\d{4})?)/);
        if (dateRangeMatch) {
          result.raw = dateRangeMatch[0];
          result.startStr = dateRangeMatch[1];
          result.endStr = dateRangeMatch[2];
          return result;
        }

        // Pattern 1b: "22 Feb 2026 - 19 Apr 2026" (DD Mon YYYY format used by Ottawa, etc.)
        const ddMonYYYYMatch = text.match(/(\d{1,2})\s+([A-Z][a-z]{2})\s+(\d{4})\s*[-–—]\s*(\d{1,2})\s+([A-Z][a-z]{2})\s+(\d{4})/);
        if (ddMonYYYYMatch) {
          result.raw = ddMonYYYYMatch[0];
          // Convert to "Mon DD, YYYY" format for consistent parsing
          result.startStr = `${ddMonYYYYMatch[2]} ${ddMonYYYYMatch[1]}, ${ddMonYYYYMatch[3]}`;
          result.endStr = `${ddMonYYYYMatch[5]} ${ddMonYYYYMatch[4]}, ${ddMonYYYYMatch[6]}`;
          return result;
        }

        // Pattern 2: "01/06/25 - 03/24/25"
        const numDateMatch = text.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})\s*[-–—]\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/);
        if (numDateMatch) {
          result.raw = numDateMatch[0];
          result.startStr = numDateMatch[1];
          result.endStr = numDateMatch[2];
          return result;
        }

        // Pattern 3: Single date "January 6, 2025"
        const singleDateMatch = text.match(/([A-Z][a-z]+\s+\d{1,2},?\s*\d{4})/);
        if (singleDateMatch) {
          result.raw = singleDateMatch[0];
          result.startStr = singleDateMatch[1];
          result.endStr = singleDateMatch[1];
        }

        return result;
      }
    }, category, startIndex, endIndex);
  }

  /**
   * Scroll down the page to load all lazy-loaded content
   * ActiveNet uses infinite scroll with .load-more element that triggers loading
   * @param {Object} page - Puppeteer page
   * @param {Number} maxActivities - Maximum number of activities to load (to prevent endless scrolling)
   */
  async scrollToLoadAll(page, maxActivities = Infinity) {
    this.logProgress('  Scrolling to load activities (infinite scroll)...');

    let previousCount = 0;
    let sameCountIterations = 0;
    const maxSameCount = 5; // Stop if count doesn't change for 5 iterations

    while (sameCountIterations < maxSameCount) {
      // Get current activity count
      const currentCount = await page.evaluate(() => {
        return document.querySelectorAll('.card.activity-card').length;
      });

      if (currentCount >= maxActivities) {
        this.logProgress(`  Reached max activities limit: ${currentCount}`);
        break;
      }

      if (currentCount === previousCount) {
        sameCountIterations++;
      } else {
        sameCountIterations = 0;
        if (currentCount % 100 === 0 || currentCount - previousCount > 50) {
          this.logProgress(`    Loaded ${currentCount} activities so far...`);
        }
      }

      previousCount = currentCount;

      // Scroll to bottom to trigger infinite scroll
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });

      // Wait for new content to load
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Check if the load-more element is still active
      const isLoading = await page.evaluate(() => {
        const loadMore = document.querySelector('.load-more .an-loading-more');
        return loadMore && loadMore.offsetParent !== null;
      });

      if (!isLoading && sameCountIterations >= 2) {
        // No loading indicator and count stable - we're done
        break;
      }
    }

    const finalCount = await page.evaluate(() => {
      return document.querySelectorAll('.card.activity-card').length;
    });

    this.logProgress(`  Finished loading: ${finalCount} activities`);

    // Scroll back to top
    await page.evaluate(() => window.scrollTo(0, 0));
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  /**
   * Extract activities from Active Network activity listing page
   * Uses the modern ActiveNet card-based layout with .card.activity-card elements
   * @param {Object} page - Puppeteer page
   * @param {Object} category - Category information
   * @returns {Promise<Array>} Extracted activities
   */
  async extractActivitiesFromActiveNetworkPage(page, category) {
    return await page.evaluate((categoryInfo) => {
      const activities = [];

      // Modern ActiveNet uses .card.activity-card for activity cards
      const activitySelectors = [
        '.card.activity-card',
        '.activity-card',
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

          // Extract activity data using ActiveNet-specific selectors
          const activity = {
            elementIndex: index,
            category: categoryInfo.name,
            categoryId: categoryInfo.categoryId,
            rawText: text,

            // Extract using ActiveNet-specific structure
            name: extractActivityName(element),
            externalId: extractActivityId(element),
            cost: extractCost(element, text),
            schedule: extractSchedule(text),
            location: extractLocation(element, text),
            registrationUrl: extractRegistrationUrl(element),
            ageRange: extractAgeRange(text),
            dates: extractDates(text),
            availability: extractAvailability(element, text),
            spotsAvailable: extractSpotsAvailable(element, text)
          };

          // Add registrationStatus for consistency
          activity.registrationStatus = activity.availability;

          // Override spotsAvailable to 0 if status is Full/Waitlist
          const status = activity.availability?.toLowerCase();
          if (status === 'full' || status === 'waitlist' || status === 'closed') {
            activity.spotsAvailable = 0;
          }

          // Only include if we found meaningful data
          if (activity.name) {
            activities.push(activity);
          }

        } catch (error) {
          console.error('Error extracting activity from element:', error);
        }
      });

      return activities;

      // Helper functions for extraction - updated for ActiveNet structure
      function extractActivityName(element) {
        // ActiveNet uses .activity-card-info__name-link a span for activity name
        const nameSelectors = [
          '.activity-card-info__name-link a span',
          '.activity-card-info__name-link a',
          '.activity-card-info__name span',
          '.activity-card-info__name',
          '.activity-name',
          '.program-title',
          'h3',
          'h4',
          '.title'
        ];

        for (const selector of nameSelectors) {
          const nameEl = element.querySelector(selector);
          if (nameEl && nameEl.textContent.trim()) {
            return nameEl.textContent.trim();
          }
        }

        return null;
      }

      function extractActivityId(element) {
        // Extract activity ID from the link URL
        const link = element.querySelector('.activity-card-info__name-link a, a[href*="Activity"]');
        if (link) {
          const href = link.href || '';
          // URLs like /Activity_Search/group-fitness-fit-fellas-tue-thur/179589
          const match = href.match(/\/(\d+)(?:\?|$)/);
          if (match) {
            return match[1];
          }
        }

        // Also look for activity number in text like #147563
        const text = element.textContent || '';
        const idMatch = text.match(/#(\d+)/);
        if (idMatch) {
          return idMatch[1];
        }

        return null;
      }

      function extractCost(element, text) {
        // First check the fee element (most reliable)
        const feeEl = element.querySelector('.activity-card__fee, [class*="fee"], [class*="price"]');
        if (feeEl) {
          const feeText = feeEl.textContent || '';
          // Check for "Free" in fee element specifically
          if (/\bfree\b/i.test(feeText)) {
            return 0;
          }
          const costMatch = feeText.match(/\$([0-9,]+(?:\.\d{2})?)/);
          if (costMatch) {
            return parseFloat(costMatch[1].replace(',', ''));
          }
        }

        // Check for free activities in text (but not "free parking" etc)
        if (/\bfree\b/i.test(text) && !/\bfree\s+(?:parking|wifi|access)/i.test(text)) {
          // Make sure there's no actual dollar amount
          const costMatch = text.match(/\$([0-9,]+(?:\.\d{2})?)/);
          if (costMatch) {
            const amount = parseFloat(costMatch[1].replace(',', ''));
            if (amount > 0) return amount;
          }
          return 0;
        }

        // Check for "no fee/cost/charge"
        if (/\bno\s*(?:fee|cost|charge)\b/i.test(text)) {
          return 0;
        }

        // Fallback to dollar amount in text
        const costMatch = text.match(/\$([0-9,]+(?:\.\d{2})?)/);
        return costMatch ? parseFloat(costMatch[1].replace(',', '')) : null;
      }

      function extractSchedule(text) {
        // Look for day/time patterns
        const schedulePatterns = [
          /([A-Za-z]{3,9}(?:\s*,\s*[A-Za-z]{3,9})*)\s*([0-9]{1,2}:[0-9]{2}\s*[APMapm]{2}\s*-\s*[0-9]{1,2}:[0-9]{2}\s*[APMapm]{2})/,
          /(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)[^\n]*[0-9]{1,2}:[0-9]{2}/i,
          /([MTWFS][a-z]{0,2})\s+(\d{1,2}:\d{2}\s*(?:am|pm)?\s*-\s*\d{1,2}:\d{2}\s*(?:am|pm)?)/i
        ];

        for (const pattern of schedulePatterns) {
          const match = text.match(pattern);
          if (match) {
            return match[0];
          }
        }

        return null;
      }

      function extractLocation(element, text) {
        // Helper to clean and validate location string
        function cleanLocation(loc) {
          if (!loc) return null;
          loc = loc.trim();
          // Reject if contains garbage patterns
          const garbagePatterns = [
            /View sub-activities/i,
            /Expand the view/i,
            /see individual dates/i,
            /\d{1,2}:\d{2}\s*(AM|PM)/i,  // Contains time
            /January|February|March|April|May|June|July|August|September|October|November|December/i,
            /^\s*empty\s*$/i,
            /^es and times/i,
            /^ion\s/i,
            /^ional\s/i,
            /^rol\s/i
          ];
          for (const pattern of garbagePatterns) {
            if (pattern.test(loc)) return null;
          }
          // Must be reasonable length
          if (loc.length < 3 || loc.length > 100) return null;
          return loc;
        }

        // Look for location in specific element first
        const locationEl = element.querySelector('[class*="location"], [class*="facility"], [class*="venue"]');
        if (locationEl) {
          const cleaned = cleanLocation(locationEl.textContent);
          if (cleaned) return cleaned;
        }

        // Look for location patterns in text
        const locationKeywords = ['Centre', 'Center', 'Park', 'Arena', 'Pool', 'Field', 'Gym', 'Community', 'Recreation'];
        for (const keyword of locationKeywords) {
          const match = text.match(new RegExp(`([^\\n/]*${keyword}[^\\n/]*)`, 'i'));
          if (match) {
            const cleaned = cleanLocation(match[1]);
            if (cleaned) return cleaned;
          }
        }
        return null;
      }

      function extractRegistrationUrl(element) {
        // Get the main activity link
        const link = element.querySelector('.activity-card-info__name-link a, a[href*="Activity"]');
        if (link) {
          return link.href;
        }

        // Fallback to any register link
        const links = element.querySelectorAll('a[href]');
        for (const l of links) {
          const href = l.href;
          if (href && (href.includes('Activity') || href.includes('register') || href.includes('enroll'))) {
            return href;
          }
        }
        return null;
      }

      function extractAgeRange(text) {
        // Helper to parse age strings like "5y 11m 4w" or "5 yrs" to years
        const parseAgeToYears = (ageStr) => {
          if (!ageStr) return null;
          // Handle "Xy Ym Ww" format (e.g., "5y 11m 4w")
          const complexMatch = ageStr.match(/(\d+)y(?:\s*(\d+)m)?(?:\s*(\d+)w)?/i);
          if (complexMatch) {
            const years = parseInt(complexMatch[1]) || 0;
            const months = parseInt(complexMatch[2]) || 0;
            return years + (months > 6 ? 1 : 0);
          }
          const simpleMatch = ageStr.match(/(\d+)/);
          return simpleMatch ? parseInt(simpleMatch[1]) : null;
        };

        // Pattern 1: "Age at least X but less than Y" (St. John's style)
        const atLeastMatch = text.match(/Age\s+at\s+least\s+([\d\w\s]+?)\s+but\s+less\s+than\s+([\d\w\s]+)/i);
        if (atLeastMatch) {
          const min = parseAgeToYears(atLeastMatch[1]);
          const max = parseAgeToYears(atLeastMatch[2]);
          if (min !== null || max !== null) {
            return { min: min || 0, max: max || 99 };
          }
        }

        // Pattern 2: "Age less than X" (max only)
        const lessThanMatch = text.match(/Age\s+less\s+than\s+([\d\w\s]+?)(?:\s|\/|$)/i);
        if (lessThanMatch) {
          const max = parseAgeToYears(lessThanMatch[1]);
          if (max !== null && max < 99) {
            return { min: 0, max };
          }
        }

        // ActiveNet shows ages like "5 yrs +" or "6-12 yrs"
        const agePatterns = [
          /(\d+)\s*(?:to|-|–)\s*(\d+)\s*(?:yrs?|years?)/i,
          /(\d+)\s*(?:yrs?|years?)\s*\+/i,
          /(?:Age|Ages?)\s*:?\s*(\d+)\s*(?:to|-|–)\s*(\d+)/i
        ];

        for (const pattern of agePatterns) {
          const match = text.match(pattern);
          if (match) {
            if (match[2]) {
              return {
                min: parseInt(match[1]),
                max: parseInt(match[2])
              };
            } else {
              // "X yrs +" format
              return {
                min: parseInt(match[1]),
                max: 99
              };
            }
          }
        }
        return null;
      }

      function extractDates(text) {
        // Look for date ranges like "Jan 6 - Mar 24" or "Jan 6, 2025 - Mar 24, 2025"
        const datePatterns = [
          /([A-Z][a-z]{2}\s+\d{1,2}(?:,?\s*\d{4})?)\s*(?:to|-|–)\s*([A-Z][a-z]{2}\s+\d{1,2}(?:,?\s*\d{4})?)/,
          /(\d{1,2}\/\d{1,2}\/\d{2,4})\s*(?:to|-|–)\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/
        ];

        for (const pattern of datePatterns) {
          const match = text.match(pattern);
          if (match) {
            return `${match[1]} - ${match[2]}`;
          }
        }

        // DD Mon YYYY format like "22 Feb 2026 - 19 Apr 2026" (Ottawa, etc.)
        const ddMonYYYYMatch = text.match(/(\d{1,2})\s+([A-Z][a-z]{2})\s+(\d{4})\s*(?:to|-|–)\s*(\d{1,2})\s+([A-Z][a-z]{2})\s+(\d{4})/);
        if (ddMonYYYYMatch) {
          // Convert to "Mon DD, YYYY" format
          return `${ddMonYYYYMatch[2]} ${ddMonYYYYMatch[1]}, ${ddMonYYYYMatch[3]} - ${ddMonYYYYMatch[5]} ${ddMonYYYYMatch[4]}, ${ddMonYYYYMatch[6]}`;
        }
        return null;
      }

      function extractAvailability(element, text) {
        // Check corner mark element
        const cornerMark = element.querySelector('.activity-card__cornerMark');
        if (cornerMark) {
          const markText = cornerMark.textContent.toLowerCase();
          // Check waitlist before full because "Full - Waitlist available" should be waitlist
          if (markText.includes('waitlist') || markText.includes('waiting list')) return 'Waitlist';
          if (markText.includes('full')) return 'Full';
          if (markText.includes('closed')) return 'Closed';
          if (markText.includes('space') || markText.includes('left')) return 'Open';
        }

        const lowerText = text.toLowerCase();
        // Check waitlist before full because "Full - Waitlist available" should be waitlist
        if (lowerText.includes('waitlist') || lowerText.includes('waiting list')) {
          return 'Waitlist';
        } else if (lowerText.includes('full') || lowerText.includes('sold out')) {
          return 'Full';
        } else if (lowerText.includes('closed') || lowerText.includes('cancelled')) {
          return 'Closed';
        } else if (lowerText.includes('space') || lowerText.includes('opening') || lowerText.includes('available') ||
                   lowerText.includes('enroll') || lowerText.includes('register') || lowerText.includes('sign up')) {
          return 'Open';
        }
        return 'Unknown';
      }

      function extractSpotsAvailable(element, text) {
        // Look for patterns like "3 space(s) left" or "Openings: 5"
        const spotsMatch = text.match(/(\d+)\s*(?:space|opening|spot)/i);
        if (spotsMatch) {
          return parseInt(spotsMatch[1]);
        }
        return null;
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
      externalId: { path: 'externalId', transform: (val, raw) => val || generateStableActivityId(raw) },
      category: 'category',
      subcategory: 'name',
      description: 'description',
      fullDescription: 'fullDescription',
      schedule: 'schedule',
      cost: 'cost',
      registrationUrl: 'registrationUrl',
      locationName: { path: 'locationName', transform: (val, raw) => val || raw?.location },
      dates: { path: 'dates', transform: (val, raw) => {
        if (val) return val;
        // Extract dates from rawText if not set (e.g., "January 6, 2026 to March 10, 2026")
        if (raw?.rawText) {
          const dateMatch = raw.rawText.match(/([A-Za-z]+\s+\d{1,2},?\s*\d{4})\s*to\s*([A-Za-z]+\s+\d{1,2},?\s*\d{4})/i);
          if (dateMatch) return `${dateMatch[1]} to ${dateMatch[2]}`;
        }
        return null;
      }},
      dateStart: { path: 'dateStart', transform: (val, raw) => {
        if (val) return val;
        // Extract start date from rawText
        if (raw?.rawText) {
          const dateMatch = raw.rawText.match(/([A-Za-z]+\s+\d{1,2},?\s*\d{4})\s*to/i);
          if (dateMatch) return dateMatch[1];
        }
        return null;
      }},
      dateEnd: { path: 'dateEnd', transform: (val, raw) => {
        if (val) return val;
        // Extract end date from rawText
        if (raw?.rawText) {
          const dateMatch = raw.rawText.match(/to\s*([A-Za-z]+\s+\d{1,2},?\s*\d{4})/i);
          if (dateMatch) return dateMatch[1];
        }
        return null;
      }},
      ageMin: { path: 'ageMin', transform: (val, raw) => val || raw?.ageRange?.min },
      ageMax: { path: 'ageMax', transform: (val, raw) => val || raw?.ageRange?.max },
      registrationStatus: { path: 'registrationStatus', transform: (val, raw) => {
        // First try explicit status fields
        if (val && val !== 'Unknown') return val;
        if (raw?.availability && raw.availability !== 'Unknown') return raw.availability;

        // Extract from rawText if available
        if (raw?.rawText) {
          const lowerText = raw.rawText.toLowerCase();
          // Check waitlist/full FIRST - includes "waiting list" with space
          if (lowerText.includes('waitlist') || lowerText.includes('waiting list')) return 'Waitlist';
          if (lowerText.includes('sold out') || /\bfull\b/.test(lowerText)) return 'Full';
          if (lowerText.includes('closed') || lowerText.includes('cancelled')) return 'Closed';
          // Check for open indicators
          if (lowerText.match(/openings?\s*\d+/) || lowerText.match(/\d+\s*openings?/) ||
              lowerText.includes('enroll') || lowerText.includes('register now') ||
              lowerText.includes('sign up') || lowerText.includes('available')) {
            return 'Open';
          }
        }

        // NOTE: Do NOT assume Open based on spotsAvailable > 0
        // because spotsAvailable might include waitlist spots
        // Only return Open if we have explicit indicators above

        return 'Unknown';
      }},
      registrationDate: 'registrationDate',
      spotsAvailable: 'spotsAvailable',
      latitude: 'latitude',
      longitude: 'longitude',
      fullAddress: 'fullAddress',
      dayOfWeek: { path: 'dayOfWeek', transform: (val, raw) => {
        if (val && val.length > 0) return val;
        // Extract day of week from schedule if not set
        if (raw?.schedule) {
          const dayMatch = raw.schedule.match(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)/i);
          if (dayMatch) {
            const dayMap = { 'Mon': 'Monday', 'Tue': 'Tuesday', 'Wed': 'Wednesday', 'Thu': 'Thursday', 'Fri': 'Friday', 'Sat': 'Saturday', 'Sun': 'Sunday' };
            return [dayMap[dayMatch[1]] || dayMatch[1]];
          }
        }
        return [];
      }},
      startTime: { path: 'startTime', transform: (val, raw) => {
        if (val) return val;
        // Extract start time from schedule if not set (e.g., "Tue 7:00 PM - 7:30 PM")
        if (raw?.schedule) {
          const timeMatch = raw.schedule.match(/(\d{1,2}:\d{2}\s*(?:AM|PM))\s*[-–]\s*(\d{1,2}:\d{2}\s*(?:AM|PM))/i);
          if (timeMatch) return timeMatch[1];
        }
        return null;
      }},
      endTime: { path: 'endTime', transform: (val, raw) => {
        if (val) return val;
        // Extract end time from schedule if not set
        if (raw?.schedule) {
          const timeMatch = raw.schedule.match(/(\d{1,2}:\d{2}\s*(?:AM|PM))\s*[-–]\s*(\d{1,2}:\d{2}\s*(?:AM|PM))/i);
          if (timeMatch) return timeMatch[2];
        }
        return null;
      }},
      instructor: 'instructor',
      sessionCount: 'sessionCount',
      hasMultipleSessions: 'hasMultipleSessions',
      // Additional fields
      whatToBring: 'whatToBring',
      prerequisites: 'prerequisites',
      hasPrerequisites: 'hasPrerequisites',
      courseDetails: 'courseDetails',
      contactInfo: 'contactInfo'
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

  /**
   * Enhance activities with ALL detail data from detail pages
   * Active Network stores comprehensive activity info on detail pages including:
   * dates, times, location, description, instructor, sessions, etc.
   * @param {Array} activities - Raw activities
   * @returns {Array} - Activities with complete data
   */
  async enhanceWithLocationData(activities) {
    const fetchDetails = this.config.scraperConfig.fetchDetailPages !== false;

    if (!fetchDetails) {
      this.logProgress('Detail page fetching disabled, skipping enhancement');
      return activities;
    }

    // Only fetch details for activities with registration URLs
    const activitiesWithUrls = activities.filter(a => a.registrationUrl);

    if (activitiesWithUrls.length === 0) {
      this.logProgress('No activities with registration URLs to enhance');
      return activities;
    }

    this.logProgress(`Enhancing ${activitiesWithUrls.length} activities with detail page data...`);

    let browser;
    try {
      browser = await puppeteer.launch({
        headless: this.config.scraperConfig.headless !== false,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
      });

      const batchSize = 10; // Increased for better parallelization (1000+ activities)
      let enhanced = 0;
      let withDates = 0;
      let withTimes = 0;
      let withLocation = 0;

      for (let i = 0; i < activitiesWithUrls.length; i += batchSize) {
        const batch = activitiesWithUrls.slice(i, i + batchSize);
        const progress = ((i / activitiesWithUrls.length) * 100).toFixed(0);
        this.logProgress(`  Processing detail batch ${Math.floor(i/batchSize)+1}/${Math.ceil(activitiesWithUrls.length/batchSize)} (${progress}%)`);

        const batchResults = await Promise.all(
          batch.map(async (activity) => {
            const page = await browser.newPage();
            try {
              await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
              await page.goto(activity.registrationUrl, { waitUntil: 'networkidle2', timeout: 45000 });

              // Wait for page content to fully render (reduced for faster processing)
              await new Promise(r => setTimeout(r, 2000));

              // === CLICK "VIEW FEE DETAILS" BUTTON IF PRESENT ===
              // Many ActiveNetwork sites hide the actual cost behind this button
              try {
                // First try CSS selectors that might work
                let feeDetailsButton = await page.$('a[href*="fee"], .fee-details-link, [data-action="view-fees"], .view-fee-btn');

                if (!feeDetailsButton) {
                  // Try text-based search for "View fee" or "Fee details" buttons/links
                  const clickables = await page.$$('a, button, [role="button"]');
                  for (const el of clickables) {
                    const text = await el.evaluate(node => node.textContent?.toLowerCase() || '');
                    if (text.includes('view fee') || text.includes('fee details') || text.includes('fee information')) {
                      feeDetailsButton = el;
                      break;
                    }
                  }
                }

                if (feeDetailsButton) {
                  await feeDetailsButton.click();
                  await new Promise(r => setTimeout(r, 1500)); // Wait for fee modal/content to load
                }
              } catch (feeErr) {
                // Fee details button not found or click failed - continue with extraction
              }

              // Extract comprehensive data from Active Network detail page
              const detailData = await page.evaluate(() => {
                const data = {};
                const pageText = document.body.innerText;
                const pageHtml = document.documentElement.outerHTML;

                // === DATES ===
                // Look for date range like "Jan 10, 2026 - Mar 21, 2026" or "Jul 27, 2026 - Jul 31, 2026"
                const dateRangeMatch = pageText.match(/([A-Z][a-z]{2}\s+\d{1,2},?\s*\d{4})\s*-\s*([A-Z][a-z]{2}\s+\d{1,2},?\s*\d{4})/);
                if (dateRangeMatch) {
                  data.dateStartStr = dateRangeMatch[1];
                  data.dateEndStr = dateRangeMatch[2];
                }

                // Also handle DD Mon YYYY format like "22 Feb 2026 - 19 Apr 2026" (used by Ottawa, etc.)
                if (!data.dateStartStr) {
                  const ddMonYYYYMatch = pageText.match(/(\d{1,2})\s+([A-Z][a-z]{2})\s+(\d{4})\s*-\s*(\d{1,2})\s+([A-Z][a-z]{2})\s+(\d{4})/);
                  if (ddMonYYYYMatch) {
                    // Convert to "Mon DD, YYYY" format for consistent parsing
                    data.dateStartStr = `${ddMonYYYYMatch[2]} ${ddMonYYYYMatch[1]}, ${ddMonYYYYMatch[3]}`;
                    data.dateEndStr = `${ddMonYYYYMatch[5]} ${ddMonYYYYMatch[4]}, ${ddMonYYYYMatch[6]}`;
                  }
                }

                // === DAY OF WEEK & TIMES ===
                // ActiveNet format: "Weekdays9:00 AM - 4:00 PM" or "Mon, Wed9:00 AM - 10:00 AM" (no space before time)
                // Also handles: "Saturday10:00 AM - 11:00 AM"

                // First try to find "Weekdays" which means Mon-Fri
                const weekdaysMatch = pageText.match(/Weekdays?\s*(\d{1,2}:\d{2}\s*(?:AM|PM))\s*-\s*(\d{1,2}:\d{2}\s*(?:AM|PM))/i);
                if (weekdaysMatch) {
                  data.dayOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
                  data.startTime = weekdaysMatch[1];
                  data.endTime = weekdaysMatch[2];
                } else {
                  // Try specific day patterns like "Mon, Wed9:00 AM" or "Saturday10:00 AM"
                  const scheduleMatch = pageText.match(/((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)(?:,?\s*(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday))*)\s*(\d{1,2}:\d{2}\s*(?:AM|PM))\s*-\s*(\d{1,2}:\d{2}\s*(?:AM|PM))/i);
                  if (scheduleMatch) {
                    // Extract days from the matched string
                    const dayStr = scheduleMatch[1];
                    const dayMatches = dayStr.match(/(Mon|Tue|Wed|Thu|Fri|Sat|Sun|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/gi);
                    if (dayMatches) {
                      data.dayOfWeek = [...new Set(dayMatches.map(d => {
                        const dayMap = {
                          'mon': 'Monday', 'monday': 'Monday',
                          'tue': 'Tuesday', 'tuesday': 'Tuesday',
                          'wed': 'Wednesday', 'wednesday': 'Wednesday',
                          'thu': 'Thursday', 'thursday': 'Thursday',
                          'fri': 'Friday', 'friday': 'Friday',
                          'sat': 'Saturday', 'saturday': 'Saturday',
                          'sun': 'Sunday', 'sunday': 'Sunday'
                        };
                        return dayMap[d.toLowerCase()] || d;
                      }))];
                    }
                    data.startTime = scheduleMatch[2];
                    data.endTime = scheduleMatch[3];
                  }
                }

                // === COURSE ID / ACTIVITY NUMBER ===
                // ActiveNet shows activity number in various formats:
                // - "#124026" near the season/session name
                // - "Activity number\n#143741" (Ottawa format)
                const courseIdPatterns = [
                  /Activity\s*number\s*\n\s*#?(\d{5,10})/i,
                  /#(\d{5,10})/
                ];
                for (const pattern of courseIdPatterns) {
                  const match = pageText.match(pattern);
                  if (match) {
                    data.courseId = match[1];
                    break;
                  }
                }

                // === LOCATION/FACILITY ===
                // ActiveNet shows location in format: "2026 Community Centre - Winter - 2026 Winter Strathcona|#586453"
                // Extract the community centre name (last part before |#)
                const centreMatch = pageText.match(/(?:Winter|Summer|Spring|Fall)\s+(\d{4}\s+)?(?:Winter|Summer|Spring|Fall)?\s*([A-Za-z][A-Za-z\s-]+?)(?:\|#|\n|$)/i);
                if (centreMatch) {
                  // Clean up the match - remove trailing whitespace and year prefix
                  let locationName = (centreMatch[2] || '').trim();
                  // Remove any trailing year if present
                  locationName = locationName.replace(/\s*\d{4}\s*$/, '').trim();
                  if (locationName && locationName.length > 2) {
                    data.locationName = locationName;
                  }
                }

                // Also try to get the room/facility (e.g., "Games Room", "Gymnasium")
                // These appear on their own line after the dates
                const roomMatch = pageText.match(/\n([A-Za-z][A-Za-z\s]+(?:Room|Gymnasium|Pool|Arena|Field|Court|Studio|Hall|Rink|Centre|Center))\n/);
                if (roomMatch) {
                  data.facility = roomMatch[1].trim();
                  // If we didn't find a location name, use the facility
                  if (!data.locationName) {
                    data.locationName = data.facility;
                  }
                }

                // Fallback: look for standard community centre patterns
                if (!data.locationName) {
                  const fallbackMatch = pageText.match(/([A-Za-z][A-Za-z\s-]+(?:Community Centre|Recreation Centre|Civic Centre|Community Center|Rec Centre))/i);
                  if (fallbackMatch) {
                    data.locationName = fallbackMatch[1].trim();
                  }
                }

                // === AGE RANGE ===
                // First check for "All ages" pattern
                const allAgesMatch = pageText.match(/\bAll\s*ages?\b/i);
                if (allAgesMatch) {
                  data.ageMin = 0;
                  data.ageMax = 99;
                  data.ageText = 'All ages';
                } else {
                  // Look for "Age at least X yrs but less than Y" or "X to Y yrs"
                  const ageMatch1 = pageText.match(/Age\s+(?:at\s+least\s+)?(\d+)\s*(?:yrs?|years?)?\s*(?:but\s+less\s+than|to|-)\s*(\d+)/i);
                  const ageMatch2 = pageText.match(/(\d+)\s*(?:to|-)\s*(\d+)\s*(?:yrs?|years?)/i);
                  const ageMatch3 = pageText.match(/(\d+)\s*(?:yrs?|years?)\s*\+/i);

                  if (ageMatch1) {
                    data.ageMin = parseInt(ageMatch1[1]);
                    data.ageMax = parseInt(ageMatch1[2]);
                  } else if (ageMatch2) {
                    data.ageMin = parseInt(ageMatch2[1]);
                    data.ageMax = parseInt(ageMatch2[2]);
                  } else if (ageMatch3) {
                    data.ageMin = parseInt(ageMatch3[1]);
                    data.ageMax = 99;
                  }
                }

                // === COST ===
                // Check for free activities first
                if (/\bFree\b/i.test(pageText) && !/\bFree\s+(?:parking|wifi|access)/i.test(pageText)) {
                  // Make sure "Free" refers to the activity cost, not amenities
                  // Look for "Free" near enrollment/registration buttons
                  const freeMatch = pageText.match(/(?:Enroll|Register|Price|Fee|Cost)[^\n]*\bFree\b|\bFree\b[^\n]*(?:Enroll|Register)/i);
                  if (freeMatch || /^\s*Free\s*$/im.test(pageText)) {
                    data.cost = 0;
                  }
                }
                // Look for fee/cost - usually in "View fee details" section or near "$XX.XX"
                if (data.cost === undefined) {
                  const costMatches = pageText.match(/\$(\d+(?:,\d{3})*(?:\.\d{2})?)/g);
                  if (costMatches) {
                    // Find the largest fee (usually the program fee, not admin fee)
                    const fees = costMatches.map(c => parseFloat(c.replace(/[$,]/g, '')));
                    data.cost = Math.max(...fees);
                  }
                }

                // === DESCRIPTION ===
                // Look for description section - extract full description
                const descMatch = pageText.match(/Description\s*\n\s*(.+?)(?=\n\s*(?:Keyboard|Activity meeting|Instructor|More Information|What to Bring|Requirements|Prerequisites))/s);
                if (descMatch) {
                  data.description = descMatch[1].trim().substring(0, 500); // Short description
                  data.fullDescription = descMatch[1].trim().substring(0, 5000); // Full description
                }

                // === WHAT TO BRING ===
                const whatToBringMatch = pageText.match(/(?:What to Bring|Bring|Equipment Required|Items to Bring)\s*[:\n]\s*(.+?)(?=\n\s*(?:Description|Instructor|More Information|Registration|$))/si);
                if (whatToBringMatch) {
                  data.whatToBring = whatToBringMatch[1].trim().substring(0, 1000);
                }

                // === PREREQUISITES ===
                const prereqMatch = pageText.match(/(?:Prerequisites?|Requirements?|Required Skills?)\s*[:\n]\s*(.+?)(?=\n\s*(?:Description|Instructor|More Information|Registration|What to Bring|$))/si);
                if (prereqMatch) {
                  data.prerequisites = prereqMatch[1].trim().substring(0, 1000);
                  data.hasPrerequisites = true;
                }

                // === COURSE DETAILS / NOTES ===
                const notesMatch = pageText.match(/(?:Notes?|Additional Information|Course Details?|Important Information)\s*[:\n]\s*(.+?)(?=\n\s*(?:Description|Instructor|Registration|What to Bring|Prerequisites|$))/si);
                if (notesMatch) {
                  data.courseDetails = notesMatch[1].trim().substring(0, 2000);
                }

                // === CONTACT INFO ===
                const contactMatch = pageText.match(/(?:Contact|Questions\?|For more information)\s*[:\n]?\s*(.+?)(?=\n\s*(?:Description|Instructor|Registration|$))/si);
                if (contactMatch) {
                  // Extract email or phone if present
                  const emailMatch = contactMatch[1].match(/[\w.-]+@[\w.-]+\.\w+/);
                  const phoneMatch = contactMatch[1].match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
                  if (emailMatch || phoneMatch) {
                    data.contactInfo = contactMatch[1].trim().substring(0, 500);
                  }
                }

                // === INSTRUCTOR / SUPERVISOR / COACH ===
                // Try multiple field names as different sites use different terminology
                // Various formats:
                // "Instructor\t\tSupervisor Library Programs" (tab-separated in table)
                // "Supervisor\nRenaud Demers" (newline-separated)
                // "Instructor: John Smith"
                // Note: Some sites use "Supervisor X" as the actual instructor name
                const instructorPatterns = [
                  // Label followed by value (tabs/spaces)
                  /(?:^|\n)Instructor[:\s\t]+([^\n]+)/im,
                  /(?:^|\n)Supervisor[:\s\t]+([^\n]+)/im,
                  /(?:^|\n)Coach[:\s\t]+([^\n]+)/im,
                  /(?:^|\n)Leader[:\s\t]+([^\n]+)/im,
                  /(?:^|\n)Facilitator[:\s\t]+([^\n]+)/im,
                  /(?:^|\n)Teacher[:\s\t]+([^\n]+)/im,
                  /(?:^|\n)Staff[:\s\t]+(?!only|meeting|office)([^\n]+)/im,
                  // "Supervisor X" as a name (e.g., "Supervisor Aquatics", "Supervisor Library Programs")
                  /\b(Supervisor\s+[A-Z][a-zA-Z\s]+(?:Programs?|Services?|Aquatics?|Recreation|Community))\b/
                ];
                for (const pattern of instructorPatterns) {
                  const match = pageText.match(pattern);
                  if (match && match[1].trim()) {
                    // Skip generic values like "TBD", "Staff", location names
                    const value = match[1].trim();
                    if (!/^(TBD|TBA|N\/A|Staff)$/i.test(value) &&
                        !/^(Recreation\s*Centre|Community\s*Centre|Civic\s*Centre)$/i.test(value) &&
                        value.length > 2 && value.length < 100) {
                      data.instructor = value;
                      break;
                    }
                  }
                }

                // === NUMBER OF SESSIONS ===
                // Various formats across ActiveNetwork sites:
                // Ottawa: "Number of sessions\n9"
                // Toronto: "Number of sessions    9" (tab/spaces in table)
                // Generic: "10 sessions", "Sessions: 10", "10 meeting dates"
                const sessionPatterns = [
                  /Number of sessions\s+(\d+)/i,
                  /(\d+)\s+sessions?\b/i,
                  /Sessions?\s*[:\-]?\s*(\d+)/i,
                  /(\d+)\s+meeting dates?/i,
                  /(\d+)\s+classes?\b/i,
                  /(\d+)\s+weeks?\b/i
                ];
                for (const pattern of sessionPatterns) {
                  const sessionsMatch = pageText.match(pattern);
                  if (sessionsMatch) {
                    data.sessionCount = parseInt(sessionsMatch[1]);
                    break;
                  }
                }

                // === REGISTRATION STATUS ===
                // Check waitlist patterns BEFORE full because page may show both
                // e.g., "Full" in header + "Waiting List registration is open" below
                const statusPatterns = [
                  { pattern: /Full\s*\+?\s*Waiting\s*List/i, status: 'Waitlist' },
                  { pattern: /Waiting\s*List\s*registration\s*is\s*open/i, status: 'Waitlist' },
                  { pattern: /\+\s*Waiting\s*List/i, status: 'Waitlist' },  // "+ Waiting List" button
                  { pattern: /Waiting\s*List/i, status: 'Waitlist' },
                  { pattern: /\bFull\b/i, status: 'Full' },
                  { pattern: /Register\s*Now/i, status: 'Open' },
                  { pattern: /Enroll\s*Now/i, status: 'Open' },  // West Vancouver uses "Enroll Now"
                  { pattern: /\d+\s*openings?\s*remaining/i, status: 'Open' },  // "3 openings remaining"
                  { pattern: /Open\s*for\s*Registration/i, status: 'Open' },
                  { pattern: /Registration\s*Closed/i, status: 'Closed' },
                  { pattern: /Cancelled/i, status: 'Cancelled' }
                ];

                for (const { pattern, status } of statusPatterns) {
                  if (pattern.test(pageText)) {
                    data.registrationStatus = status;
                    break;
                  }
                }

                // === REGISTRATION DATES ===
                // Different formats across ActiveNetwork sites:
                // Ottawa: "Members 18 Nov 2025 9:00 PM to 4 Jan 2026 6:00 AM"
                // Toronto: "Members    From Dec 3, 2025 7:00 AM" (tab-separated table)
                const regDatePatterns = [
                  // Ottawa format: "DD Mon YYYY H:MM AM/PM to DD Mon YYYY H:MM AM/PM"
                  /(?:Members?|Residents?|Non-members?|Public)\s+(\d{1,2}\s+[A-Z][a-z]{2}\s+\d{4}\s+\d{1,2}:\d{2}\s*(?:AM|PM))\s+to\s+(\d{1,2}\s+[A-Z][a-z]{2}\s+\d{4}\s+\d{1,2}:\d{2}\s*(?:AM|PM))/i,
                  // Toronto format: "Members    From Dec 3, 2025 7:00 AM"
                  /(?:Members?|Residents?)\s+From\s+([A-Z][a-z]{2}\s+\d{1,2},?\s+\d{4}\s+\d{1,2}:\d{2}\s*(?:AM|PM))/i,
                  // "From Mon DD, YYYY H:MM AM" format (generic)
                  /Registration\s*dates?\s*\n?\s*From\s+([A-Z][a-z]{2}\s+\d{1,2},?\s*\d{4}\s*\d{1,2}:\d{2}\s*(?:AM|PM))/i,
                  // "Registration: Mon DD - Mon DD, YYYY"
                  /Registration[:\s]+([A-Z][a-z]{2}\s+\d{1,2})\s*[-–]\s*([A-Z][a-z]{2}\s+\d{1,2},?\s*\d{4})/i,
                  // Simple "Registration opens Mon DD, YYYY"
                  /Registration\s+opens?\s*:?\s*([A-Z][a-z]{2}\s+\d{1,2},?\s*\d{4})/i
                ];

                for (const pattern of regDatePatterns) {
                  const match = pageText.match(pattern);
                  if (match) {
                    if (match[2]) {
                      // Has both start and end date
                      data.registrationStartDateStr = match[1];
                      data.registrationEndDateStr = match[2];
                    } else {
                      data.registrationDateStr = match[1];
                    }
                    break;
                  }
                }

                // === COORDINATES FROM MAP ===
                // Try Google Maps iframe
                const mapIframe = document.querySelector('iframe[src*="maps"]');
                if (mapIframe) {
                  const src = mapIframe.getAttribute('src') || '';
                  const coordMatch = src.match(/[?&](?:q|center|ll)=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
                  if (coordMatch) {
                    data.latitude = parseFloat(coordMatch[1]);
                    data.longitude = parseFloat(coordMatch[2]);
                  }
                }

                // Try data attributes
                const mapElements = document.querySelectorAll('[data-lat], [data-latitude], [data-lng], [data-longitude]');
                for (const el of mapElements) {
                  const lat = el.getAttribute('data-lat') || el.getAttribute('data-latitude');
                  const lng = el.getAttribute('data-lng') || el.getAttribute('data-longitude');
                  if (lat && lng) {
                    data.latitude = parseFloat(lat);
                    data.longitude = parseFloat(lng);
                    break;
                  }
                }

                // Try JSON in page
                const latMatch = pageHtml.match(/["'](?:latitude|lat)["']\s*:\s*(-?\d+\.\d+)/i);
                const lngMatch = pageHtml.match(/["'](?:longitude|lng|lon)["']\s*:\s*(-?\d+\.\d+)/i);
                if (latMatch && lngMatch && !data.latitude) {
                  data.latitude = parseFloat(latMatch[1]);
                  data.longitude = parseFloat(lngMatch[1]);
                }

                return data;
              });

              await page.close();

              // Parse dates
              const parseDate = (dateStr) => {
                if (!dateStr) return null;
                try {
                  const date = new Date(dateStr);
                  return isNaN(date.getTime()) ? null : date;
                } catch {
                  return null;
                }
              };

              // Normalize time format to "HH:MM am/pm"
              const normalizeTime = (timeStr) => {
                if (!timeStr) return null;
                return timeStr.toLowerCase().replace(/\s+/g, ' ').trim();
              };

              // Parse dates for duration check
              const startDate = parseDate(detailData.dateStartStr) || activity.dateStart;
              const endDate = parseDate(detailData.dateEndStr) || activity.dateEnd;

              // Detect membership/pass activities:
              // - Long duration (60+ days) with no specific time = membership/pass
              // - Keywords in name like "program", "membership", "pass", "annual"
              const isMembershipActivity = (() => {
                const hasNoTime = !detailData.startTime && !activity.startTime;
                if (!hasNoTime) return false;

                // Check duration (60+ days suggests membership/pass)
                if (startDate && endDate) {
                  const durationDays = (endDate - startDate) / (1000 * 60 * 60 * 24);
                  if (durationDays >= 60) return true;
                }

                // Check for membership keywords in name or description
                const name = (activity.name || '').toLowerCase();
                const desc = (detailData.description || activity.description || '').toLowerCase();
                const membershipKeywords = ['membership', 'annual', 'season pass', 'players program', 'golf program'];
                return membershipKeywords.some(kw => name.includes(kw) || desc.includes(kw));
              })();

              // For membership activities, set sensible defaults
              let finalStartTime = normalizeTime(detailData.startTime) || activity.startTime;
              let finalEndTime = normalizeTime(detailData.endTime) || activity.endTime;
              let finalDayOfWeek = detailData.dayOfWeek || activity.dayOfWeek || [];

              if (isMembershipActivity) {
                // Set flexible schedule for memberships/passes
                finalStartTime = finalStartTime || 'Flexible';
                finalEndTime = finalEndTime || 'Flexible';
                if (finalDayOfWeek.length === 0) {
                  finalDayOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                }
              }

              // === FALLBACK: Extract day from activity name ===
              // Some activities have day in name like "(THU)" or "(MON/WED)"
              if (finalDayOfWeek.length === 0 && activity.name) {
                const nameMatch = activity.name.match(/\(([A-Za-z]{3}(?:\/[A-Za-z]{3})*)\)/i);
                if (nameMatch) {
                  const dayMap = {
                    'mon': 'Mon', 'tue': 'Tue', 'wed': 'Wed', 'thu': 'Thu',
                    'fri': 'Fri', 'sat': 'Sat', 'sun': 'Sun'
                  };
                  const daysInName = nameMatch[1].toLowerCase().split('/');
                  finalDayOfWeek = daysInName.map(d => dayMap[d]).filter(Boolean);
                }
              }

              // === FALLBACK: Age from activity name or description ===
              let finalAgeMin = detailData.ageMin ?? activity.ageMin;
              let finalAgeMax = detailData.ageMax ?? activity.ageMax;

              // Check for "All ages" in all available text fields
              const allText = `${activity.name || ''} ${detailData.description || ''} ${activity.description || ''} ${activity.ageText || ''} ${activity.category || ''} ${detailData.ageText || ''}`.toLowerCase();
              if ((allText.includes('all ages') || allText.includes('all-ages')) && finalAgeMin === null && finalAgeMax === null) {
                finalAgeMin = 0;
                finalAgeMax = 99;
              }

              // Extract ages from name like "AGES 8+" or "AGES 6-10" or "(ALL AGES)"
              if (finalAgeMin === null || finalAgeMax === null) {
                const allAgesMatch = activity.name?.match(/\(all\s*ages?\)/i);
                const ageRangeMatch = activity.name?.match(/ages?\s*(\d+)\s*[-–to]\s*(\d+)/i);
                const agePlusMatch = activity.name?.match(/ages?\s*(\d+)\s*\+/i);
                if (allAgesMatch) {
                  finalAgeMin = 0;
                  finalAgeMax = 99;
                } else if (ageRangeMatch) {
                  finalAgeMin = finalAgeMin ?? parseInt(ageRangeMatch[1]);
                  finalAgeMax = finalAgeMax ?? parseInt(ageRangeMatch[2]);
                } else if (agePlusMatch) {
                  finalAgeMin = finalAgeMin ?? parseInt(agePlusMatch[1]);
                  finalAgeMax = finalAgeMax ?? 99;
                }
              }

              // === FALLBACK: Activities with days but no times ===
              // If we have days of week but no times, set "Varies" to indicate flexible timing
              if (!finalStartTime && finalDayOfWeek.length > 0) {
                finalStartTime = 'Varies';
                finalEndTime = 'Varies';
              }

              // === FALLBACK: Single-day events with no time ===
              // If dateStart === dateEnd and no time, it's an event - set "Event" time
              if (!finalStartTime && startDate && endDate) {
                const isSameDay = startDate.toDateString() === endDate.toDateString();
                if (isSameDay) {
                  finalStartTime = 'Event';
                  finalEndTime = 'Event';
                }
              }

              // Determine final registration status and spots
              const finalStatus = detailData.registrationStatus || activity.registrationStatus || 'Unknown';

              // Override spotsAvailable based on status - if Full/Waitlist, spots should be 0
              let finalSpotsAvailable = activity.spotsAvailable;
              if (finalStatus === 'Full' || finalStatus === 'Waitlist' || finalStatus === 'Closed') {
                finalSpotsAvailable = 0;
              } else if (finalStatus === 'Open' && finalSpotsAvailable === null) {
                // Keep null if unknown, but mark as Open
              }

              // Merge detail data with activity
              return {
                ...activity,
                // Course ID (numeric activity number from detail page)
                courseId: detailData.courseId || activity.courseId,
                // Dates
                dateStart: startDate,
                dateEnd: endDate,
                // Times
                startTime: finalStartTime,
                endTime: finalEndTime,
                // Days
                dayOfWeek: finalDayOfWeek,
                // Location
                locationName: detailData.locationName || activity.location || activity.locationName,
                latitude: detailData.latitude || activity.latitude,
                longitude: detailData.longitude || activity.longitude,
                // Age
                ageMin: finalAgeMin,
                ageMax: finalAgeMax,
                // Cost (use ?? to preserve $0 for free activities, null for unknown)
                cost: detailData.cost ?? activity.cost ?? null,
                // Description (short and full)
                description: detailData.description || activity.description,
                fullDescription: detailData.fullDescription || activity.fullDescription,
                // What to Bring
                whatToBring: detailData.whatToBring || activity.whatToBring,
                // Prerequisites
                prerequisites: detailData.prerequisites || activity.prerequisites,
                hasPrerequisites: detailData.hasPrerequisites || activity.hasPrerequisites || false,
                // Course Details / Notes
                courseDetails: detailData.courseDetails || activity.courseDetails,
                // Contact Info
                contactInfo: detailData.contactInfo || activity.contactInfo,
                // Instructor / Supervisor / Coach
                instructor: detailData.instructor || activity.instructor,
                // Sessions
                sessionCount: detailData.sessionCount || activity.sessionCount || 0,
                hasMultipleSessions: (detailData.sessionCount || 0) > 1,
                // Registration Status and Availability
                registrationStatus: finalStatus,
                spotsAvailable: finalSpotsAvailable,
                // Registration Dates (when registration opens/closes)
                registrationDate: parseDate(detailData.registrationStartDateStr) || parseDate(detailData.registrationDateStr) || activity.registrationDate,
                registrationEndDate: parseDate(detailData.registrationEndDateStr) || activity.registrationEndDate
              };
            } catch (error) {
              await page.close();
              return activity; // Return original on error
            }
          })
        );

        // Update activities in original array
        batchResults.forEach(result => {
          const idx = activities.findIndex(a => a.registrationUrl === result.registrationUrl);
          if (idx >= 0) {
            activities[idx] = result;
            enhanced++;
            if (result.dateStart) withDates++;
            if (result.startTime) withTimes++;
            if (result.locationName) withLocation++;
          }
        });

        // Rate limit between batches
        await new Promise(r => setTimeout(r, 1500));
      }

      this.logProgress(`Detail enhancement complete:`);
      this.logProgress(`  - ${enhanced} activities processed`);
      this.logProgress(`  - ${withDates} with dates`);
      this.logProgress(`  - ${withTimes} with times`);
      this.logProgress(`  - ${withLocation} with location`);
    } finally {
      if (browser) await browser.close();
    }

    return activities;
  }
}

module.exports = ActiveNetworkScraper;