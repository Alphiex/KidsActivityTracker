const BaseScraper = require('../base/BaseScraper');
const DataNormalizer = require('../base/DataNormalizer');
const KidsActivityFilter = require('../utils/KidsActivityFilter');
const puppeteer = require('puppeteer');
const { generateStableHash } = require('../utils/stableIdGenerator');

/**
 * Platform scraper for WebTrac recreation systems (by Vermont Systems)
 * URL: leisure.saskatoon.ca/wbwsc/webtracrec.wsc
 *
 * WebTrac-specific characteristics:
 * - Session-based navigation requiring splash page initialization
 * - Form-based search with multiple category types
 * - AJAX updates instead of full page navigation
 * - Activity search at /search.html
 */
class WebTracScraper extends BaseScraper {
  constructor(config) {
    super(config);
    this.platformName = 'WebTrac';
    this.extension = null;

    // WebTrac-specific selectors (discovered via debug)
    this.selectors = {
      form: '#arwebsearch',
      searchButton: '#arwebsearch_buttonsearch',
      resetButton: '#arwebsearch_buttonreset',
      typeDropdown: '#type',
      locationDropdown: '#location',
      daysDropdown: '#daysofweek',
      spotsDropdown: '#spotsavailable',
      resultContainer: '.search-results, .results, [class*="result"]'
    };

    // Kids activity type VALUES (as used in the dropdown) - map to labels
    this.kidsActivityTypes = {
      'Children Rec': 'Children Recreation',
      'Youth Rec': 'Youth Recreation',
      'Preschool Rec': 'Preschool Recreation',
      'Family': 'Family Recreation',
      'Family Fun': 'Family Fun',
      'Arts Culture Recreation': 'Arts, Culture & Recreation',
      'Lifesaving Society': 'Lifesaving Society',
      'Stroke Improvement': 'Stroke Improvement'
    };
  }

  /**
   * Main scrape method
   */
  async scrape() {
    const startTime = Date.now();
    this.logProgress('Starting WebTrac scraper');

    try {
      this.validateConfig();
      const provider = await this.getOrCreateProvider();

      // Extract activities using session-based navigation
      const rawActivities = await this.extractActivities();

      // Filter to kids activities
      const kidsActivities = KidsActivityFilter.filterActivities(rawActivities);
      const filterStats = KidsActivityFilter.getFilterStats(rawActivities, kidsActivities);
      this.logProgress(`Kids filter: ${filterStats.filtered}/${filterStats.original} activities (${filterStats.percentKept}% kept)`);

      // Normalize activities
      const normalizedActivities = await this.normalizeActivities(kidsActivities);

      // Save to database
      const stats = await this.saveActivitiesToDatabase(normalizedActivities, provider.id);

      const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
      const report = this.generateReport(stats, duration);

      this.logProgress(`Scraping completed in ${duration} minutes`);

      return { activities: normalizedActivities, stats, report };

    } catch (error) {
      this.handleError(error, 'scrape');
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Extract activities from WebTrac
   */
  async extractActivities() {
    const activities = [];
    let browser;

    // Get Chrome executable path - use env var, or system Chrome on macOS, or Puppeteer default
    const getChromePath = () => {
      if (process.env.PUPPETEER_EXECUTABLE_PATH) {
        return process.env.PUPPETEER_EXECUTABLE_PATH;
      }
      const macOSChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
      const fs = require('fs');
      if (process.platform === 'darwin' && fs.existsSync(macOSChrome)) {
        return macOSChrome;
      }
      return undefined;
    };

    try {
      browser = await puppeteer.launch({
        headless: this.config.scraperConfig.headless !== false,
        executablePath: getChromePath(),
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
      });

      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      await page.setViewport({ width: 1920, height: 1080 });

      // Set longer default timeout
      page.setDefaultTimeout(60000);
      page.setDefaultNavigationTimeout(60000);

      // Navigate to splash page to initialize session
      const splashUrl = this.getSplashUrl();
      this.logProgress(`Initializing session at: ${splashUrl}`);

      await page.goto(splashUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });

      // Wait for page to fully load
      await this.waitForPageReady(page);

      // Try different search approaches
      // Approach 1: Direct search URL
      const searchUrl = this.getSearchUrl();
      this.logProgress(`Navigating to search: ${searchUrl}`);

      try {
        await page.goto(searchUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 60000
        });
        await this.waitForPageReady(page);
      } catch (e) {
        this.logProgress(`Direct navigation failed, trying alternative: ${e.message}`);
      }

      // Get available activity types
      const activityTypes = await this.getActivityTypes(page);
      this.logProgress(`Found ${activityTypes.length} activity types`);

      // Filter to kids-relevant types
      const kidsTypes = activityTypes.filter(type => this.isKidsType(type));
      this.logProgress(`Processing ${kidsTypes.length} kids activity types`);

      // Try a generic search first (no filters)
      this.logProgress('Performing generic search...');
      const genericResults = await this.performGenericSearch(page);
      activities.push(...genericResults);

      // Then search by each activity type
      for (const activityType of kidsTypes) {
        try {
          // Reset the form before each search
          await this.resetSearchForm(page);

          const typeActivities = await this.searchActivityType(page, activityType);
          activities.push(...typeActivities);
          this.logProgress(`  ${activityType}: ${typeActivities.length} activities`);
        } catch (error) {
          this.logProgress(`  Error searching ${activityType}: ${error.message}`);
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 1500));
      }

      // Deduplicate
      const seen = new Set();
      const unique = activities.filter(a => {
        const key = a.externalId || a.name;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      this.logProgress(`Total unique activities: ${unique.length}`);
      return unique;

    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  /**
   * Wait for page to be ready (handles AJAX loading)
   */
  async waitForPageReady(page, timeout = 10000) {
    try {
      await page.waitForFunction(() => {
        // Check if page is done loading
        return document.readyState === 'complete';
      }, { timeout });

      // Additional wait for any AJAX
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (e) {
      // Timeout is OK, continue
    }
  }

  /**
   * Reset the search form to clear previous filters
   */
  async resetSearchForm(page) {
    try {
      // Use specific reset button ID
      const resetClicked = await page.evaluate((resetSelector) => {
        const resetBtn = document.querySelector(resetSelector);
        if (resetBtn) {
          resetBtn.click();
          return true;
        }

        // Fallback: try clearing selects manually
        const selects = document.querySelectorAll('select[multiple]');
        selects.forEach(select => {
          const options = select.querySelectorAll('option');
          options.forEach(opt => opt.selected = false);
          select.dispatchEvent(new Event('change', { bubbles: true }));
        });

        return false;
      }, this.selectors.resetButton);

      if (resetClicked) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    } catch (e) {
      // Ignore reset errors
    }
  }

  /**
   * Check if activity type is for kids (by value or label)
   */
  isKidsType(typeName) {
    const lowerType = typeName.toLowerCase();

    // Explicitly exclude adult-only types
    if (/\badult\b|senior|55\+|65\+|19\+|21\+/i.test(lowerType)) {
      return false;
    }

    // Include these kid-related keywords
    if (/child|youth|preschool|family|teen|junior|kid|camp/i.test(lowerType)) {
      return true;
    }

    // Check against known kids types (values and labels)
    const allKidsTypes = [
      ...Object.keys(this.kidsActivityTypes),
      ...Object.values(this.kidsActivityTypes)
    ];

    return allKidsTypes.some(kt => {
      const ktLower = kt.toLowerCase();
      return lowerType === ktLower || lowerType.includes(ktLower) || ktLower.includes(lowerType);
    });
  }

  /**
   * Get splash page URL
   */
  getSplashUrl() {
    const { baseUrl, scraperConfig } = this.config;
    const entryPoint = scraperConfig.entryPoints?.[0] || '/splash.html';
    return entryPoint.startsWith('http') ? entryPoint : `${baseUrl}${entryPoint}`;
  }

  /**
   * Get search page URL
   */
  getSearchUrl() {
    const { baseUrl, scraperConfig } = this.config;
    const searchPath = scraperConfig.searchUrl || '/search.html';
    return `${baseUrl}${searchPath}`;
  }

  /**
   * Get available activity types from the search form
   */
  async getActivityTypes(page) {
    return page.evaluate((typeSelector) => {
      const types = [];

      // Use specific type dropdown selector
      const select = document.querySelector(typeSelector);
      if (select) {
        const options = select.querySelectorAll('option');
        options.forEach(option => {
          const value = option.value?.trim();
          const text = option.textContent?.trim();
          if (value && text && value !== '' && text.length > 2 &&
              !text.match(/^(all|any|select|choose|-+|n\/a)/i)) {
            // Return both value and text for easier matching
            types.push({ value, text });
          }
        });
      }

      // Return unique text values
      return types.map(t => t.text);
    }, this.selectors.typeDropdown);
  }

  /**
   * Perform a generic search without filters
   */
  async performGenericSearch(page) {
    const activities = [];

    try {
      // Click search button and wait for navigation
      this.logProgress(`  Clicking search button...`);

      try {
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }),
          page.click(this.selectors.searchButton)
        ]);
      } catch (e) {
        this.logProgress(`  Navigation wait completed: ${e.message}`);
      }

      // Additional wait for results
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Wait for results to appear
      try {
        await page.waitForFunction(() => {
          // Look for result containers or "no results" message
          const resultContainers = document.querySelectorAll('.result-content, .tablecollapsecontainer');
          const noResults = document.body.innerText.includes('Begin Search') ||
                          document.body.innerText.toLowerCase().includes('no activities');
          return resultContainers.length > 0 || noResults;
        }, { timeout: 10000 });
      } catch (e) {
        this.logProgress(`  Waiting for results timed out, continuing anyway`);
      }

      // Extract results
      const results = await this.extractResultsFromPage(page, 'All Activities');
      activities.push(...results);
      this.logProgress(`  Generic search found ${results.length} activities`);
    } catch (e) {
      this.logProgress(`Generic search error: ${e.message}`);
    }

    return activities;
  }

  /**
   * Search for activities of a specific type
   */
  async searchActivityType(page, activityType) {
    const activities = [];

    try {
      // WebTrac uses Vue listitem components - click on them to select
      const typeSelected = await page.evaluate((typeName) => {
        // Find the listitem with matching value
        const items = document.querySelectorAll('.listitem[data-value]');
        for (const item of items) {
          const value = item.dataset.value || '';
          const text = item.textContent?.trim() || '';

          if (value.toLowerCase() === typeName.toLowerCase() ||
              text.toLowerCase() === typeName.toLowerCase() ||
              text.toLowerCase().includes(typeName.toLowerCase())) {
            item.click();
            return text;
          }
        }
        return null;
      }, activityType);

      if (!typeSelected) {
        this.logProgress(`    Could not find type "${activityType}" in dropdown`);
        return activities;
      }

      // Wait for any AJAX triggered by dropdown change
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Click the search button and wait for navigation
      try {
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }),
          page.click(this.selectors.searchButton)
        ]);
      } catch (e) {
        // Navigation may timeout if page updates via AJAX
      }

      // Wait for AJAX results to load
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Wait for results to appear
      try {
        await page.waitForFunction(() => {
          const resultRows = document.querySelectorAll('table tbody tr, .search-result, .result-item');
          const noResults = document.body.innerText.toLowerCase().includes('no activities found');
          return resultRows.length > 0 || noResults;
        }, { timeout: 10000 });
      } catch (e) {
        // No results found for this type, continue
      }

      // Extract results
      const pageActivities = await this.extractResultsFromPage(page, activityType);
      activities.push(...pageActivities);

      // Try pagination
      let pageNum = 1;
      while (pageNum < 5) {
        const hasNext = await this.goToNextPage(page);
        if (!hasNext) break;

        await this.waitForPageReady(page);
        const moreActivities = await this.extractResultsFromPage(page, activityType);

        if (moreActivities.length === 0) break;
        activities.push(...moreActivities);
        pageNum++;
      }

    } catch (error) {
      this.logProgress(`Error in searchActivityType: ${error.message}`);
    }

    return activities;
  }

  /**
   * Extract activity results from current page
   * WebTrac uses .result-content containers with tables for sections
   */
  async extractResultsFromPage(page, activityType) {
    return page.evaluate((typeName) => {
      const activities = [];

      // WebTrac shows results in .result-content containers
      const resultContainers = document.querySelectorAll('.result-content, .tablecollapsecontainer');

      resultContainers.forEach((container, containerIndex) => {
        try {
          // Get the header info
          const header = container.querySelector('.result-header, .tablecollapseheader');
          if (!header) return;

          // Get activity name from h2 > span
          const nameElement = header.querySelector('h2 span');
          const name = nameElement?.textContent?.trim();
          if (!name || name.length < 3) return;

          // Get program code from h2 > em
          const codeElement = header.querySelector('h2 em');
          const programCode = codeElement?.textContent?.trim() || '';

          // Get description (contains age info)
          const descElement = header.querySelector('.result-header__description');
          const description = descElement?.textContent?.trim() || '';

          // Parse age from description (multiple patterns)
          // Pattern 1: "6-9 yrs." or "6-9 years"
          let ageMatch = description.match(/^(\d+)\s*[-–to]+\s*(\d+)\s*(?:yrs?|years?|mos?|months?)/i);
          // Pattern 2: "Ages 6-9" or "Age: 6-9"
          if (!ageMatch) {
            ageMatch = description.match(/ages?\s*:?\s*(\d+)\s*[-–to]+\s*(\d+)/i);
          }
          // Pattern 3: "6+" or "6 and up" or "6 years and up"
          if (!ageMatch) {
            const plusMatch = description.match(/(\d+)\s*\+|(\d+)\s*(?:yrs?|years?)?\s*(?:and up|and older|\& up)/i);
            if (plusMatch) {
              const age = parseInt(plusMatch[1] || plusMatch[2]);
              ageMatch = [null, age, 18]; // Use 18 as max for kids
            }
          }
          // Pattern 4: Look in name for age patterns like "(5-6 yrs)"
          if (!ageMatch && name) {
            ageMatch = name.match(/\((\d+)\s*[-–]\s*(\d+)(?:\s*(?:yrs?|years?))?\)/i);
          }
          const ageMin = ageMatch ? parseInt(ageMatch[1]) : null;
          const ageMax = ageMatch ? parseInt(ageMatch[2]) : null;

          // Get sections from the hidden table
          const table = container.querySelector('table');
          const rows = table?.querySelectorAll('tbody tr') || [];

          if (rows.length === 0) {
            // No sections visible, create one activity from header info
            // Use programCode if available, otherwise create stable hash from name + category
            const stableId = programCode
              ? 'saskatoon-' + programCode
              : 'saskatoon-' + name.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 20);
            activities.push({
              name,
              externalId: stableId,
              programCode,
              category: typeName,
              description,
              ageMin,
              ageMax,
              dateText: null,
              timeText: null,
              locationName: null,
              registrationStatus: 'Unknown', // Use standard field name
              registrationUrl: null
            });
          } else {
            // Extract each section as a separate activity
            rows.forEach((row, rowIndex) => {
              const cells = row.querySelectorAll('td');
              if (cells.length < 5) return;

              // Parse cell data using data-title attributes
              let sectionCode = '';
              let dates = '';
              let times = '';
              let days = '';
              let location = '';
              let availability = '';
              let link = '';

              cells.forEach(cell => {
                const title = cell.getAttribute('data-title') || '';
                let text = cell.textContent?.trim() || '';
                const anchor = cell.querySelector('a');

                switch(title) {
                  case 'Program - Section':
                    sectionCode = text;
                    if (anchor) link = anchor.href;
                    break;
                  case 'Description':
                    // Skip, we have it from header
                    break;
                  case 'Dates':
                    // Clean up date text (remove asterisks, normalize dashes)
                    dates = text.replace(/\*/g, '').replace(/\s+/g, ' ').replace(/-/g, ' - ').replace(/\s+-\s+/g, ' - ').trim();
                    break;
                  case 'Times':
                    // Clean up time text
                    times = text.replace(/\s+/g, ' ').replace(/-/g, ' - ').replace(/\s+-\s+/g, ' - ').trim();
                    break;
                  case 'Days':
                    days = text;
                    break;
                  case 'Location':
                    location = text;
                    break;
                  case 'Availability':
                    availability = text;
                    break;
                }
              });

              // Extract FMID from link for unique ID (PREFERRED - stable native ID)
              const fmidMatch = link?.match(/FMID=(\d+)/);
              const fmid = fmidMatch ? fmidMatch[1] : null;

              // Use FMID if available, otherwise use sectionCode, otherwise use name-based hash
              // NEVER use rowIndex as it changes when order changes!
              let stableId;
              if (fmid) {
                stableId = 'saskatoon-' + fmid;
              } else if (sectionCode) {
                stableId = 'saskatoon-' + sectionCode.replace(/[^a-z0-9-]/gi, '');
              } else {
                // Fallback: use name + location for stable hash
                const fallbackKey = (name + '-' + (location || '')).toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 24);
                stableId = 'saskatoon-' + fallbackKey;
              }

              activities.push({
                name: name + (sectionCode ? ' - ' + sectionCode : ''),
                externalId: stableId,
                programCode: sectionCode || programCode,
                category: typeName,
                description,
                ageMin,
                ageMax,
                dateText: dates,
                timeText: times,
                dayOfWeek: days,
                locationName: location,
                registrationStatus: availability || 'Unknown', // Use standard field name
                registrationUrl: link || null
              });
            });
          }
        } catch (e) {
          console.error('Error extracting result container:', e);
        }
      });

      return activities;
    }, activityType);
  }

  /**
   * Navigate to next page of results
   */
  async goToNextPage(page) {
    try {
      const nextClicked = await page.evaluate(() => {
        // Look for next page link
        const nextLinks = document.querySelectorAll(
          'a.next, a[rel="next"], .pagination a, .paging a, a[title*="Next"]'
        );

        for (const link of nextLinks) {
          const text = link.textContent?.toLowerCase() || '';
          const title = (link.title || '').toLowerCase();

          if ((text.includes('next') || text === '>' || text === '>>') ||
              title.includes('next')) {
            if (!link.classList.contains('disabled') &&
                link.getAttribute('aria-disabled') !== 'true') {
              link.click();
              return true;
            }
          }
        }
        return false;
      });

      if (nextClicked) {
        await this.waitForPageReady(page, 10000);
        return true;
      }
    } catch (e) {
      // No next page
    }
    return false;
  }

  /**
   * Normalize extracted activities
   */
  async normalizeActivities(activities) {
    return activities.map(activity => {
      // Parse dates (format: "01/06/2026 - 03/03/2026" or similar)
      let dateStart = null;
      let dateEnd = null;
      if (activity.dateText) {
        // Match MM/DD/YYYY format
        const dateMatch = activity.dateText.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s*-\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (dateMatch) {
          dateStart = new Date(parseInt(dateMatch[3]), parseInt(dateMatch[1]) - 1, parseInt(dateMatch[2]));
          dateEnd = new Date(parseInt(dateMatch[6]), parseInt(dateMatch[4]) - 1, parseInt(dateMatch[5]));
        } else {
          // Try single date
          const singleMatch = activity.dateText.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
          if (singleMatch) {
            dateStart = new Date(parseInt(singleMatch[3]), parseInt(singleMatch[1]) - 1, parseInt(singleMatch[2]));
            dateEnd = dateStart;
          }
        }
      }

      // Parse time (format: "4:00 pm - 4:45 pm")
      let startTime = null;
      let endTime = null;
      if (activity.timeText) {
        // Match time range pattern
        const timeMatch = activity.timeText.match(/(\d{1,2}:\d{2})\s*(am|pm)?\s*-\s*(\d{1,2}:\d{2})\s*(am|pm)?/i);
        if (timeMatch) {
          startTime = this.parseTime(timeMatch[1], timeMatch[2] || timeMatch[4]);
          endTime = this.parseTime(timeMatch[3], timeMatch[4]);
        }
      }

      // Parse day of week (format: "Tu", "M", "W", etc.)
      let dayOfWeek = [];
      if (activity.dayOfWeek) {
        const dayMap = {
          'Su': 'Sunday', 'M': 'Monday', 'Tu': 'Tuesday', 'W': 'Wednesday',
          'Th': 'Thursday', 'F': 'Friday', 'Sa': 'Saturday'
        };
        const days = activity.dayOfWeek.split(/,\s*|\/\s*/);
        dayOfWeek = days.map(d => dayMap[d.trim()] || d.trim()).filter(d => d);
      }

      // Parse availability status
      // Saskatoon WebTrac shows "Waitlist", "Available", "Full", etc.
      let registrationStatus = 'Unknown';
      let spotsAvailable = null;
      if (activity.availability) {
        const avail = activity.availability.toLowerCase().trim();
        if (avail === 'available' || avail.includes('open')) {
          registrationStatus = 'Open';
          spotsAvailable = 1; // At least 1 spot available
        } else if (avail.includes('waitlist')) {
          registrationStatus = 'Waitlist';
          spotsAvailable = 0;
        } else if (avail.includes('full') || avail.includes('closed')) {
          registrationStatus = 'Full';
          spotsAvailable = 0;
        } else if (avail.includes('unavailable')) {
          registrationStatus = 'Unavailable';
          spotsAvailable = 0;
        } else {
          // Try to extract spots number if present
          const spotsMatch = activity.availability.match(/(\d+)\s*(?:spots?|open|available|left)/i);
          if (spotsMatch) {
            spotsAvailable = parseInt(spotsMatch[1]);
            registrationStatus = spotsAvailable > 0 ? 'Open' : 'Full';
          }
        }
      }

      return {
        name: activity.name,
        externalId: activity.externalId,
        category: activity.category || 'Saskatoon Recreation',
        subcategory: null,
        description: activity.description || null,
        dateStart,
        dateEnd,
        startTime,
        endTime,
        dayOfWeek,
        schedule: activity.timeText || null,
        ageMin: activity.ageMin ?? null,
        ageMax: activity.ageMax ?? null,
        cost: 0, // Cost not shown in search results
        costIncludesTax: true,
        spotsAvailable,
        totalSpots: null,
        registrationStatus,
        locationName: activity.locationName || null,
        registrationUrl: activity.registrationUrl || `${this.config.baseUrl}/search.html`,
        rawData: activity
      };
    });
  }

  /**
   * Parse time string to standard format
   */
  parseTime(timeStr, period) {
    if (!timeStr) return null;

    const [hours, minutes] = timeStr.split(':').map(n => parseInt(n));
    let hour24 = hours;

    if (period) {
      const p = period.toLowerCase();
      if (p === 'pm' && hours < 12) {
        hour24 = hours + 12;
      } else if (p === 'am' && hours === 12) {
        hour24 = 0;
      }
    }

    return `${hour24.toString().padStart(2, '0')}:${(minutes || 0).toString().padStart(2, '0')}`;
  }

  /**
   * Get or create provider
   */
  async getOrCreateProvider() {
    const { name } = this.config;

    let provider = await this.prisma.provider.findFirst({
      where: { name }
    });

    if (!provider) {
      provider = await this.prisma.provider.create({
        data: {
          name: this.config.name,
          website: this.config.baseUrl,
          platform: 'webtrac',
          region: 'Saskatchewan',
          isActive: true,
          scraperConfig: this.config.scraperConfig
        }
      });
      this.logProgress(`Created new provider: ${name}`);
    }

    return provider;
  }
}

module.exports = WebTracScraper;
