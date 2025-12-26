const BaseScraper = require('../base/BaseScraper');
const DataNormalizer = require('../base/DataNormalizer');
const KidsActivityFilter = require('../utils/KidsActivityFilter');
const puppeteer = require('puppeteer');

/**
 * Base platform scraper for LiveAndPlay-style recreation websites
 * Used by Calgary (REGPROG) and Edmonton (COE) recreation systems
 *
 * These platforms share common characteristics:
 * - Category-based browsing structure
 * - Similar HTML structure for activity listings
 * - Course ID and registration URL patterns
 */
class LiveAndPlayScraper extends BaseScraper {
  constructor(config) {
    super(config);
    this.platformName = 'LiveAndPlay';
    this.extension = null;

    // Common selectors across LiveAndPlay platforms
    this.selectors = {
      categoryContainer: '.category-list, .program-categories, [class*="category"]',
      categoryLink: 'a[href*="category"], a[href*="Category"]',
      programCard: '.program-card, .activity-card, .course-item, [class*="program"], [class*="activity"]',
      programName: '.program-title, .activity-name, .course-name, h3, h4',
      programDate: '.program-dates, .activity-dates, .date-range, [class*="date"]',
      programTime: '.program-time, .activity-time, [class*="time"]',
      programAge: '.age-range, .age-restriction, [class*="age"]',
      programCost: '.program-fee, .activity-cost, .price, [class*="fee"], [class*="cost"]',
      programLocation: '.location, .facility, .venue, [class*="location"]',
      programSpots: '.availability, .spots, [class*="spots"], [class*="available"]',
      registerButton: 'a[href*="register"], button[class*="register"], .register-btn',
      pagination: '.pagination, .pager, [class*="pagination"]',
      nextPage: '.next, .pagination-next, a[rel="next"]'
    };

    // Kids section patterns
    this.kidsSectionPatterns = [
      /youth/i, /children/i, /kids/i, /preschool/i, /toddler/i,
      /family/i, /camps?/i, /junior/i, /teen/i, /school\s*age/i,
      /swimming\s*lessons?/i, /skating\s*lessons?/i, /learn\s*to/i
    ];

    // Exclude patterns
    this.excludePatterns = [
      /^adult$/i, /55\+/i, /seniors?$/i, /19\+/i, /18\+/i
    ];
  }

  /**
   * Main scrape method
   */
  async scrape() {
    const startTime = Date.now();
    this.logProgress(`Starting ${this.platformName} scraper`);

    try {
      this.validateConfig();
      const provider = await this.getOrCreateProvider();

      // Discover categories and extract activities
      const rawActivities = await this.extractActivities();

      // Filter to kids activities only
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
   * Extract activities from the platform
   * Override in subclasses for platform-specific logic
   */
  async extractActivities() {
    const activities = [];
    let browser;

    try {
      browser = await this.launchBrowser();
      const page = await browser.newPage();
      await this.setupPage(page);

      // Get browse URL from config
      const browseUrl = this.getBrowseUrl();
      this.logProgress(`Navigating to: ${browseUrl}`);

      await page.goto(browseUrl, {
        waitUntil: 'networkidle2',
        timeout: this.config.scraperConfig.timeout || 60000
      });

      // Wait for page to load
      await this.waitForContent(page);

      // Discover categories
      const categories = await this.discoverCategories(page);
      this.logProgress(`Found ${categories.length} categories`);

      // Filter to kids-relevant categories
      const kidsCategories = categories.filter(cat =>
        !this.excludePatterns.some(p => p.test(cat.name)) &&
        (this.kidsSectionPatterns.some(p => p.test(cat.name)) ||
         !this.excludePatterns.some(p => p.test(cat.name)))
      );
      this.logProgress(`Processing ${kidsCategories.length} kids-relevant categories`);

      // Extract activities from each category
      for (const category of kidsCategories) {
        try {
          const categoryActivities = await this.extractCategoryActivities(browser, category);
          activities.push(...categoryActivities);
          this.logProgress(`  ${category.name}: ${categoryActivities.length} activities`);
        } catch (error) {
          this.logProgress(`  Error in ${category.name}: ${error.message}`);
        }
      }

      this.logProgress(`Total activities extracted: ${activities.length}`);
      return activities;

    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  /**
   * Get the browse URL for category discovery
   * Override in subclasses
   */
  getBrowseUrl() {
    const { baseUrl, scraperConfig } = this.config;
    const entryPoint = scraperConfig.entryPoints?.[0] || '/public/category/browse';
    return entryPoint.startsWith('http') ? entryPoint : `${baseUrl}${entryPoint}`;
  }

  /**
   * Launch browser with standard configuration
   */
  async launchBrowser() {
    return puppeteer.launch({
      headless: this.config.scraperConfig.headless !== false,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
  }

  /**
   * Setup page with user agent and viewport
   */
  async setupPage(page) {
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1920, height: 1080 });
  }

  /**
   * Wait for content to load
   */
  async waitForContent(page) {
    const waitTime = this.config.scraperConfig.initialWaitTime || 5000;
    await new Promise(resolve => setTimeout(resolve, waitTime));

    // Try to wait for category links
    try {
      await page.waitForSelector(this.selectors.categoryLink, { timeout: 10000 });
    } catch (e) {
      this.logProgress('Category links not found with default selector, continuing...');
    }
  }

  /**
   * Discover category links on the page
   * Override in subclasses for platform-specific logic
   */
  async discoverCategories(page) {
    return page.evaluate((selectors) => {
      const categories = [];
      const links = document.querySelectorAll(selectors.categoryLink);

      links.forEach(link => {
        const name = link.textContent?.trim();
        const url = link.href;

        if (name && url && name.length > 0) {
          categories.push({ name, url });
        }
      });

      return categories;
    }, this.selectors);
  }

  /**
   * Extract activities from a single category
   * Override in subclasses for platform-specific logic
   */
  async extractCategoryActivities(browser, category) {
    const activities = [];
    const page = await browser.newPage();
    await this.setupPage(page);

    try {
      await page.goto(category.url, {
        waitUntil: 'networkidle2',
        timeout: this.config.scraperConfig.timeout || 60000
      });

      // Wait for activities to load
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Extract activities from page
      let hasNextPage = true;
      let pageNum = 1;

      while (hasNextPage) {
        const pageActivities = await this.extractActivitiesFromPage(page, category);
        activities.push(...pageActivities);

        // Check for next page
        hasNextPage = await this.goToNextPage(page);
        if (hasNextPage) {
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
   * Extract activities from a single page
   * Override in subclasses for platform-specific selectors
   */
  async extractActivitiesFromPage(page, category) {
    return page.evaluate((selectors, categoryInfo) => {
      const activities = [];
      const cards = document.querySelectorAll(selectors.programCard);

      cards.forEach((card, index) => {
        try {
          const name = card.querySelector(selectors.programName)?.textContent?.trim();
          if (!name) return;

          // Extract various fields
          const dateText = card.querySelector(selectors.programDate)?.textContent?.trim();
          const timeText = card.querySelector(selectors.programTime)?.textContent?.trim();
          const ageText = card.querySelector(selectors.programAge)?.textContent?.trim();
          const costText = card.querySelector(selectors.programCost)?.textContent?.trim();
          const locationText = card.querySelector(selectors.programLocation)?.textContent?.trim();
          const spotsText = card.querySelector(selectors.programSpots)?.textContent?.trim();
          const registerLink = card.querySelector(selectors.registerButton)?.href;

          // Generate external ID
          const externalId = `${categoryInfo.name.toLowerCase().replace(/\s+/g, '-')}-${index}-${Date.now()}`;

          activities.push({
            name,
            externalId,
            category: categoryInfo.name,
            dates: dateText,
            schedule: timeText,
            ageText,
            costText,
            locationName: locationText,
            spotsText,
            registrationUrl: registerLink,
            rawData: {
              dateText,
              timeText,
              ageText,
              costText,
              locationText,
              spotsText
            }
          });
        } catch (e) {
          console.error('Error extracting activity:', e);
        }
      });

      return activities;
    }, this.selectors, { name: category.name, url: category.url });
  }

  /**
   * Navigate to the next page of results
   */
  async goToNextPage(page) {
    try {
      const nextButton = await page.$(this.selectors.nextPage);
      if (nextButton) {
        const isDisabled = await page.evaluate(el => {
          return el.classList.contains('disabled') ||
                 el.getAttribute('aria-disabled') === 'true' ||
                 el.hasAttribute('disabled');
        }, nextButton);

        if (!isDisabled) {
          await nextButton.click();
          await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 });
          return true;
        }
      }
    } catch (e) {
      // No next page or navigation failed
    }
    return false;
  }

  /**
   * Normalize extracted activities to database schema
   */
  async normalizeActivities(activities) {
    return activities.map(activity => {
      // Parse age range
      const ageRange = KidsActivityFilter.extractAgeRange(activity.ageText || activity.name);

      // Parse cost
      const cost = DataNormalizer.normalizeCost(activity.costText);

      // Parse dates (handle undefined)
      const dates = activity.dates ? DataNormalizer.extractDateRange(activity.dates) : null;

      // Parse time
      const timeRange = DataNormalizer.extractTimeRange(activity.schedule);

      // Parse spots
      const spots = this.parseSpots(activity.spotsText);

      return {
        name: activity.name,
        externalId: activity.externalId,
        category: activity.category,
        subcategory: activity.subcategory || null,
        description: activity.description || null,
        dateStart: dates?.start || null,
        dateEnd: dates?.end || null,
        startTime: timeRange?.start || null,
        endTime: timeRange?.end || null,
        dayOfWeek: DataNormalizer.extractDaysFromText(activity.schedule),
        schedule: activity.schedule || null,
        ageMin: ageRange?.min ?? null,
        ageMax: ageRange?.max ?? null,
        cost: cost ?? 0,
        costIncludesTax: true,
        spotsAvailable: spots?.available ?? null,
        totalSpots: spots?.total ?? null,
        registrationStatus: this.parseRegistrationStatus(activity.spotsText, spots),
        locationName: activity.locationName || null,
        registrationUrl: activity.registrationUrl || null,
        rawData: activity.rawData || null
      };
    });
  }

  /**
   * Parse spots available from text
   */
  parseSpots(spotsText) {
    if (!spotsText) return null;

    // Pattern: "5 spots available" or "5/20 spots" or "5 of 20"
    const availableMatch = spotsText.match(/(\d+)\s*(?:spots?\s*)?(?:available|left|remaining)/i);
    if (availableMatch) {
      return { available: parseInt(availableMatch[1], 10), total: null };
    }

    const fractionMatch = spotsText.match(/(\d+)\s*(?:\/|of)\s*(\d+)/i);
    if (fractionMatch) {
      return {
        available: parseInt(fractionMatch[1], 10),
        total: parseInt(fractionMatch[2], 10)
      };
    }

    // Check for full/closed
    if (/full|sold\s*out|no\s*spots|closed/i.test(spotsText)) {
      return { available: 0, total: null };
    }

    return null;
  }

  /**
   * Parse registration status from spots and text
   */
  parseRegistrationStatus(spotsText, spots) {
    if (!spotsText && !spots) return 'Open';

    const text = (spotsText || '').toLowerCase();

    if (/closed|cancelled|canceled/i.test(text)) return 'Closed';
    if (/waitlist|waiting\s*list/i.test(text)) return 'Waitlist';
    if (/full|sold\s*out|no\s*spots/i.test(text)) return 'Full';

    if (spots?.available === 0) return 'Full';
    if (spots?.available && spots.available > 0) return 'Open';

    return 'Open';
  }

  /**
   * Get or create provider in database
   */
  async getOrCreateProvider() {
    const { code, name, baseUrl, platform, region, city } = this.config;

    let provider = await this.prisma.provider.findFirst({
      where: { name }
    });

    if (!provider) {
      provider = await this.prisma.provider.create({
        data: {
          name,
          website: baseUrl,
          platform,
          region: region || city || 'Unknown',
          isActive: true,
          scraperConfig: this.config.scraperConfig
        }
      });
      this.logProgress(`Created new provider: ${name}`);
    }

    return provider;
  }
}

module.exports = LiveAndPlayScraper;
