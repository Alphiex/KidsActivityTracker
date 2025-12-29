const BaseScraper = require('../base/BaseScraper');
const KidsActivityFilter = require('../utils/KidsActivityFilter');
const puppeteer = require('puppeteer');

/**
 * Platform scraper for IC3 recreation systems (Montreal, Gatineau, etc.)
 * URL: loisirs.montreal.ca/IC3/ or similar
 *
 * Uses Puppeteer to trigger search and capture API responses
 * IC3 API at /api/{siteCode}/public/search/ returns comprehensive activity data
 */
class IC3Scraper extends BaseScraper {
  constructor(config) {
    super(config);
    this.platformName = 'IC3';

    // Site code from config (e.g., U5200 for Montreal, U2010 for Gatineau)
    this.siteCode = config.scraperConfig?.siteCode || 'U5200';

    // Day of week mapping (IC3 uses 1-7 for Monday-Sunday based on API)
    this.dayNames = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    // Parallelization settings for large cities (1000+ activities)
    this.CONCURRENT_REQUESTS = config.scraperConfig?.concurrentRequests || 15;
    this.PAGE_SIZE = 20; // IC3 default page size
  }

  /**
   * Main scrape method
   */
  async scrape() {
    const startTime = Date.now();
    this.logProgress(`Starting IC3 scraper`);

    try {
      this.validateConfig();
      const provider = await this.getOrCreateProvider();

      // Fetch activities by triggering search and capturing API
      const rawActivities = await this.fetchActivitiesViaBrowser();

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
    }
  }

  /**
   * Use Puppeteer to load page and capture API responses
   * For large cities (1000+ activities), uses parallel pagination
   */
  async fetchActivitiesViaBrowser() {
    const activities = [];
    const capturedData = [];
    let browser;
    const self = this;

    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
      });

      const page = await browser.newPage();
      await page.setViewport({ width: 1920, height: 1080 });

      // Enable request interception to capture API responses
      await page.setRequestInterception(true);
      page.on('request', request => request.continue());

      // Capture API responses to get record count and first page data
      page.on('response', async response => {
        const url = response.url();
        const contentType = response.headers()['content-type'] || '';

        if (url.includes(self.siteCode) && url.includes('search') && contentType.includes('json')) {
          try {
            const text = await response.text();
            const json = JSON.parse(text);
            if (json.results && Array.isArray(json.results)) {
              capturedData.push(json);
              self.logProgress(`  Captured ${json.results.length} activities (recordCount: ${json.recordCount})`);
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      });

      // Navigate to main page - use networkidle2 (allows 2 ongoing connections) for Angular SPAs
      this.logProgress(`Loading IC3 page: ${this.config.baseUrl}`);
      await page.goto(this.config.baseUrl, {
        waitUntil: 'networkidle2',
        timeout: 120000
      });

      // Wait for Angular app to fully initialize
      this.logProgress('Waiting for Angular app...');
      await new Promise(r => setTimeout(r, this.config.scraperConfig?.initialWaitTime || 8000));

      // Find and click the search button
      this.logProgress('Triggering initial search...');
      const searchClicked = await page.evaluate((siteCode) => {
        // Try multiple selectors for the search button
        const selectors = [
          `#${siteCode.toLowerCase()}_btnSearch`,
          'button[id*="btnSearch"]',
          'input[type="submit"]',
          'button.btn-primary'
        ];

        for (const sel of selectors) {
          const btn = document.querySelector(sel);
          if (btn) {
            const text = btn.textContent?.toLowerCase() || btn.value?.toLowerCase() || '';
            if (text.includes('recherche') || text.includes('search') || sel.includes('btnSearch')) {
              btn.click();
              return { clicked: true, selector: sel, text: text.substring(0, 50) };
            }
          }
        }
        return { clicked: false };
      }, this.siteCode);

      this.logProgress(`  Search clicked: ${searchClicked.clicked} (${searchClicked.selector || 'none'})`);

      // Wait for initial API response to be captured
      await new Promise(r => setTimeout(r, 10000));

      // Get total records from captured API response
      let totalRecords = 0;
      let pageSize = this.PAGE_SIZE;

      if (capturedData.length > 0) {
        totalRecords = capturedData[0].recordCount || 0;
        // Parse first page activities
        for (const item of (capturedData[0].results || [])) {
          const activity = this.parseActivity(item);
          if (activity) activities.push(activity);
        }
      }

      const totalPages = Math.ceil(totalRecords / pageSize);
      const expectedActivities = this.config.metadata?.expectedActivities || 0;

      this.logProgress(`  Total available: ${totalRecords} (${totalPages} pages)`);

      // Use sequential pagination with response capture (most reliable for IC3)
      // The IC3 API requires session context and specific request format
      if (totalRecords > pageSize) {
        this.logProgress(`  Fetching remaining ${totalRecords - activities.length} activities via pagination...`);
        const additionalResults = await this.fetchPagesSequentially(page, totalRecords, capturedData);
        activities.push(...additionalResults);
      }

      // Deduplicate by externalId
      const seen = new Set();
      const unique = activities.filter(a => {
        if (seen.has(a.externalId)) return false;
        seen.add(a.externalId);
        return true;
      });

      this.logProgress(`Fetched ${unique.length} unique activities from IC3 (${totalRecords} available)`);
      return unique;

    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  /**
   * Fetch all pages in parallel using browser fetch API
   * IC3 uses Angular and the API supports skip/take parameters
   */
  async fetchAllPagesParallel(page, totalRecords, pageSize) {
    const activities = [];
    const totalPages = Math.ceil(totalRecords / pageSize);

    // Generate all page offsets
    const offsets = [];
    for (let i = 0; i < totalPages; i++) {
      offsets.push(i * pageSize);
    }

    this.logProgress(`    Fetching ${totalPages} pages with ${this.CONCURRENT_REQUESTS} concurrent requests...`);

    // Process in batches of CONCURRENT_REQUESTS
    for (let batchStart = 0; batchStart < offsets.length; batchStart += this.CONCURRENT_REQUESTS) {
      const batchOffsets = offsets.slice(batchStart, batchStart + this.CONCURRENT_REQUESTS);

      const batchResults = await page.evaluate(async (siteCode, offsetBatch, take) => {
        const results = await Promise.all(offsetBatch.map(async (skip) => {
          try {
            // IC3 Angular API endpoint pattern
            const apiUrl = `/api/${siteCode}/public/search/activity?skip=${skip}&take=${take}`;

            const response = await fetch(apiUrl, {
              method: 'GET',
              headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
              },
              credentials: 'include'
            });

            if (!response.ok) {
              return { success: false, skip, error: response.status };
            }

            const data = await response.json();
            return {
              success: true,
              skip,
              results: data.results || data || [],
              count: (data.results || data || []).length
            };
          } catch (e) {
            return { success: false, skip, error: e.message };
          }
        }));
        return results;
      }, this.siteCode, batchOffsets, pageSize);

      // Process batch results
      for (const result of batchResults) {
        if (result.success && result.results) {
          for (const item of result.results) {
            const activity = this.parseActivity(item);
            if (activity) {
              activities.push(activity);
            }
          }
        }
      }

      // Progress update
      const pagesProcessed = Math.min(batchStart + this.CONCURRENT_REQUESTS, totalPages);
      if (pagesProcessed % 20 === 0 || pagesProcessed >= totalPages) {
        this.logProgress(`    Progress: ${activities.length} activities (${pagesProcessed}/${totalPages} pages)`);
      }

      // Small delay between batches to avoid rate limiting
      if (batchStart + this.CONCURRENT_REQUESTS < offsets.length) {
        await new Promise(r => setTimeout(r, 200));
      }
    }

    return activities;
  }

  /**
   * Sequential pagination - continues from first page, uses shared capturedData
   * The response handler is already set up in fetchActivitiesViaBrowser
   */
  async fetchPagesSequentially(page, totalExpected, capturedData) {
    const activities = [];

    // Paginate through results - response handler already captures data
    const maxPages = this.config.scraperConfig?.maxPages || 100;
    let pageNum = 1;
    const startCount = capturedData.reduce((sum, d) => sum + (d.results?.length || 0), 0);

    while (pageNum < maxPages) {
      const currentCount = capturedData.reduce((sum, d) => sum + (d.results?.length || 0), 0);

      if (currentCount >= totalExpected) {
        this.logProgress(`    All ${currentCount} activities captured`);
        break;
      }

      // Click the "next page" button
      const hasNextPage = await page.evaluate(() => {
        const nextLi = document.querySelector('.pagination-next');
        if (nextLi && !nextLi.classList.contains('disabled')) {
          const anchor = nextLi.querySelector('a');
          if (anchor) {
            anchor.click();
            return true;
          }
        }
        return false;
      });

      if (!hasNextPage) {
        this.logProgress(`    No more pages at ${currentCount} activities`);
        break;
      }

      await new Promise(r => setTimeout(r, 2000));
      pageNum++;

      const newCount = capturedData.reduce((sum, d) => sum + (d.results?.length || 0), 0);
      if (newCount === currentCount) {
        // Wait a bit more and check again
        await new Promise(r => setTimeout(r, 2000));
        const finalCheck = capturedData.reduce((sum, d) => sum + (d.results?.length || 0), 0);
        if (finalCheck === currentCount) {
          this.logProgress(`    No new results on page ${pageNum}`);
          break;
        }
      }

      if (pageNum % 10 === 0) {
        this.logProgress(`    Page ${pageNum}: ${newCount}/${totalExpected} activities`);
      }
    }

    // Parse all captured data (skip first page since already parsed)
    for (let i = 1; i < capturedData.length; i++) {
      for (const item of (capturedData[i].results || [])) {
        const activity = this.parseActivity(item);
        if (activity) {
          activities.push(activity);
        }
      }
    }

    return activities;
  }

  /**
   * Parse a single activity from API response
   */
  parseActivity(item) {
    try {
      const name = item.name || item.description;
      if (!name || name.length < 3) return null;

      // Extract schedule info
      let startTime = null;
      let endTime = null;
      let dayOfWeek = [];

      if (item.activitySchedules && item.activitySchedules.length > 0) {
        const schedule = item.activitySchedules[0];
        startTime = schedule.startTime?.substring(0, 5); // "08:30:00" -> "08:30"
        endTime = schedule.endTime?.substring(0, 5);

        // Collect all days
        dayOfWeek = item.activitySchedules
          .map(s => s.dayOfWeek?.id)
          .filter(d => d !== undefined && d !== null)
          .map(d => this.dayNames[d] || null)
          .filter(d => d !== null);
        dayOfWeek = [...new Set(dayOfWeek)]; // Deduplicate
      }

      // Get location from mainSite or first schedule's facility
      let locationName = item.mainSite?.name || null;
      if (!locationName && item.activitySchedules?.[0]?.facility?.site?.name) {
        locationName = item.activitySchedules[0].facility.site.name;
      }

      // Get borough
      const borough = item.mainSite?.boroughs?.[0]?.name || item.partner?.name || null;

      // Parse dates
      let dateStart = null;
      let dateEnd = null;
      if (item.startDate) {
        dateStart = new Date(item.startDate);
        if (isNaN(dateStart.getTime())) dateStart = null;
      }
      if (item.endDate) {
        dateEnd = new Date(item.endDate);
        if (isNaN(dateEnd.getTime())) dateEnd = null;
      }

      // Registration status mapping
      let registrationStatus = 'Open';
      if (item.registrationStatus === 2) {
        registrationStatus = 'Waitlist';
      } else if (item.registrationStatus === 0) {
        registrationStatus = 'Closed';
      }

      // Can register check
      if (item.canRegister?.value === false) {
        registrationStatus = 'Unavailable';
      }

      return {
        name,
        externalId: `montreal-${item.id}`,
        code: item.codeGroup || item.code,
        category: item.session?.name || 'Montreal Loisirs',
        subcategory: borough,
        description: item.description !== name ? item.description : null,
        dateStart,
        dateEnd,
        startTime,
        endTime,
        dayOfWeek,
        ageMin: item.minAge ?? null,
        ageMax: item.maxAge ?? null,
        cost: item.basePriceWithTaxes || 0,
        locationName,
        borough,
        spotsAvailable: item.maxCapacity > 0 ? item.maxCapacity : null,
        totalSpots: item.maxCapacity || null,
        registrationStatus,
        partner: item.partner?.name,
        session: item.session?.name,
        rawData: item
      };
    } catch (e) {
      this.logProgress(`Error parsing activity: ${e.message}`);
      return null;
    }
  }

  /**
   * Normalize activities to standard format
   */
  async normalizeActivities(activities) {
    return activities.map(activity => {
      return {
        name: activity.name,
        externalId: activity.externalId,
        category: activity.category || 'Montreal Loisirs',
        subcategory: activity.subcategory || null,
        description: activity.description || null,
        dateStart: activity.dateStart,
        dateEnd: activity.dateEnd,
        startTime: activity.startTime,
        endTime: activity.endTime,
        dayOfWeek: activity.dayOfWeek || [],
        schedule: activity.dayOfWeek?.join(', ') || null,
        ageMin: activity.ageMin,
        ageMax: activity.ageMax,
        cost: activity.cost || 0,
        costIncludesTax: true,
        spotsAvailable: activity.spotsAvailable,
        totalSpots: activity.totalSpots,
        registrationStatus: activity.registrationStatus,
        locationName: activity.locationName || activity.borough || null,
        registrationUrl: `${this.config.baseUrl}#/${this.siteCode}/activity/${activity.rawData?.id}`,
        rawData: activity.rawData
      };
    });
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
          platform: 'ic3',
          region: 'Quebec',
          isActive: true,
          scraperConfig: this.config.scraperConfig
        }
      });
      this.logProgress(`Created new provider: ${name}`);
    }

    return provider;
  }
}

module.exports = IC3Scraper;
