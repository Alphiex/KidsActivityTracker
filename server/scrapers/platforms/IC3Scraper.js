const BaseScraper = require('../base/BaseScraper');
const KidsActivityFilter = require('../utils/KidsActivityFilter');
const puppeteer = require('puppeteer');

/**
 * Platform scraper for Montreal's IC3 recreation system
 * URL: loisirs.montreal.ca/IC3/
 *
 * Uses Puppeteer to trigger search and capture API responses
 * IC3 API at /api/U5200/public/search/ returns comprehensive activity data
 */
class IC3Scraper extends BaseScraper {
  constructor(config) {
    super(config);
    this.platformName = 'IC3';

    // Day of week mapping (IC3 uses 1-7 for Monday-Sunday based on API)
    this.dayNames = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
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

      // Enable request interception to capture POST responses
      await page.setRequestInterception(true);
      page.on('request', request => request.continue());

      // Intercept ALL responses and log them
      page.on('response', async response => {
        const url = response.url();
        const contentType = response.headers()['content-type'] || '';

        // Check for any U5200 search API response
        if (url.includes('U5200') && url.includes('search') && contentType.includes('json')) {
          try {
            const text = await response.text();
            const json = JSON.parse(text);
            if (json.results && Array.isArray(json.results)) {
              capturedData.push(json);
              self.logProgress(`  Captured ${json.results.length} activities (recordCount: ${json.recordCount})`);
            }
          } catch (e) {
            // Ignore
          }
        }
      });

      // Navigate to main page
      this.logProgress('Loading Montreal IC3 page...');
      await page.goto(this.config.baseUrl, {
        waitUntil: 'networkidle0',
        timeout: 90000
      });

      // Wait for Angular app to fully initialize
      this.logProgress('Waiting for Angular app...');
      await new Promise(r => setTimeout(r, 8000));

      // Find and click the search button
      this.logProgress('Triggering search...');
      const searchClicked = await page.evaluate(() => {
        // Try multiple selectors for the search button
        const selectors = [
          '#u2010_btnSearch',
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
      });

      this.logProgress(`  Search clicked: ${searchClicked.clicked} (${searchClicked.selector || 'none'})`);

      // Wait for initial API response
      await new Promise(r => setTimeout(r, 8000));

      // Navigate through result pages to get all activities
      let totalExpected = 0;
      if (capturedData.length > 0) {
        totalExpected = capturedData[0].recordCount || 0;
        this.logProgress(`  Total available: ${totalExpected}`);
      }

      // Paginate through results using Angular pagination
      // Montreal IC3 uses .pagination-next a for the next page button
      const maxPages = this.config.scraperConfig?.maxPages || 30;
      let pageNum = 1;

      while (pageNum < maxPages) {
        const currentCount = capturedData.reduce((sum, d) => sum + (d.results?.length || 0), 0);
        this.logProgress(`  Page ${pageNum}: ${currentCount}/${totalExpected} activities captured`);

        if (currentCount >= totalExpected) {
          break;
        }

        // Click the "next page" button
        const hasNextPage = await page.evaluate(() => {
          // Angular pagination uses .pagination-next li with a child anchor
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
          this.logProgress(`  No more pages available`);
          break;
        }

        // Wait for API response
        await new Promise(r => setTimeout(r, 3000));
        pageNum++;

        // Check if we got new results
        const newCount = capturedData.reduce((sum, d) => sum + (d.results?.length || 0), 0);
        if (newCount === currentCount) {
          // No new results after clicking next
          this.logProgress(`  No new results on page ${pageNum}`);
          break;
        }
      }

      // If we captured data, parse it
      this.logProgress(`Processing ${capturedData.length} API responses...`);
      for (const data of capturedData) {
        for (const item of (data.results || [])) {
          const activity = this.parseActivity(item);
          if (activity) {
            activities.push(activity);
          }
        }
      }

      // Deduplicate by externalId
      const seen = new Set();
      const unique = activities.filter(a => {
        if (seen.has(a.externalId)) return false;
        seen.add(a.externalId);
        return true;
      });

      this.logProgress(`Fetched ${unique.length} unique activities from IC3 (${totalExpected} available)`);
      return unique;

    } finally {
      if (browser) {
        await browser.close();
      }
    }
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
        registrationUrl: `${this.config.baseUrl}#/U5200/activity/${activity.rawData?.id}`,
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
