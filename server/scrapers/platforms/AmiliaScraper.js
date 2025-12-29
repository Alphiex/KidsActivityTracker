const BaseScraper = require('../base/BaseScraper');
const KidsActivityFilter = require('../utils/KidsActivityFilter');
const puppeteer = require('puppeteer');
const { generateExternalId } = require('../utils/stableIdGenerator');

/**
 * Generate a stable ID for Amilia activities.
 * Priority: native activityId from page > stable hash (name + location only)
 *
 * @param {Object} activity - Activity object
 * @returns {String} Stable external ID
 */
function generateStableActivityId(activity) {
  // Use the centralized ID generator with Amilia-specific options
  return generateExternalId(activity, {
    platform: 'amilia',
    providerCode: 'am',
    hashPrefix: 'am'
  });
}

/**
 * Platform scraper for Amilia SmartRec recreation registration systems
 * URL pattern: app.amilia.com/store/{locale}/{org}/shop/programs
 *
 * Uses Puppeteer to navigate program categories and extract activity data
 */
class AmiliaScraper extends BaseScraper {
  constructor(config) {
    super(config);
    this.platformName = 'Amilia';

    // Day of week mapping
    this.dayMap = {
      'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3,
      'Thursday': 4, 'Friday': 5, 'Saturday': 6,
      'dimanche': 0, 'lundi': 1, 'mardi': 2, 'mercredi': 3,
      'jeudi': 4, 'vendredi': 5, 'samedi': 6
    };
  }

  /**
   * Main scrape method
   */
  async scrape() {
    const startTime = Date.now();
    this.logProgress(`Starting Amilia scraper for ${this.config.name}`);

    try {
      this.validateConfig();
      const provider = await this.getOrCreateProvider();

      // Fetch activities via browser
      const rawActivities = await this.fetchActivitiesViaBrowser();
      this.logProgress(`Found ${rawActivities.length} raw activities`);

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
   * Get or create the provider in the database
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
   * Use Puppeteer to navigate Amilia and extract activities
   */
  async fetchActivitiesViaBrowser() {
    const activities = [];
    let browser;

    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
      });

      const page = await browser.newPage();
      await page.setViewport({ width: 1920, height: 1080 });

      // Set user agent
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

      // Navigate to programs page
      const baseUrl = this.config.baseUrl;
      this.logProgress(`Navigating to ${baseUrl}`);

      await page.goto(baseUrl, {
        waitUntil: 'networkidle2',
        timeout: 60000
      });

      // Accept cookies if modal appears
      try {
        await page.waitForSelector('button.btn-primary, .cookie-accept, [data-testid="cookie-accept"]', { timeout: 3000 });
        await page.click('button.btn-primary, .cookie-accept, [data-testid="cookie-accept"]');
        await this.delay(1000);
      } catch (e) {
        // No cookie modal, continue
      }

      // Wait for program cards to load
      await page.waitForSelector('.program-card, .card, [class*="program"], a[href*="/shop/programs/"]', { timeout: 30000 });

      // Get all program links
      const programLinks = await page.evaluate(() => {
        const links = [];
        // Find program cards/links
        const programElements = document.querySelectorAll('a[href*="/shop/programs/"]');
        programElements.forEach(el => {
          const href = el.getAttribute('href');
          const title = el.textContent?.trim() || el.querySelector('h2, h3, h4, .title')?.textContent?.trim();
          if (href && !links.some(l => l.href === href)) {
            links.push({ href, title });
          }
        });
        return links;
      });

      this.logProgress(`Found ${programLinks.length} program categories`);

      // Visit each program to extract activities
      for (const program of programLinks) {
        try {
          const programUrl = program.href.startsWith('http')
            ? program.href
            : `https://app.amilia.com${program.href}`;

          this.logProgress(`Processing program: ${program.title || programUrl}`);

          const programActivities = await this.extractActivitiesFromProgram(page, programUrl, program.title);
          activities.push(...programActivities);

          // Rate limiting
          await this.delay(this.config.scraperConfig?.rateLimits?.delayBetweenPages || 2000);

        } catch (error) {
          this.logProgress(`Error processing program ${program.title}: ${error.message}`);
        }
      }

      return activities;

    } catch (error) {
      this.logProgress(`Browser error: ${error.message}`);
      throw error;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  /**
   * Extract activities from a single program page
   */
  async extractActivitiesFromProgram(page, programUrl, programTitle) {
    const activities = [];

    try {
      await page.goto(programUrl, {
        waitUntil: 'networkidle2',
        timeout: 60000
      });

      // Wait for activities to load
      await this.delay(2000);

      // Extract activity data from the page
      const pageActivities = await page.evaluate((category) => {
        const activities = [];

        // Look for activity cards/rows
        const activityElements = document.querySelectorAll(
          '.activity-card, .event-card, [class*="activity"], [class*="event"], ' +
          '.list-group-item, .table tbody tr, [data-activity-id]'
        );

        activityElements.forEach(el => {
          try {
            // Extract activity name
            const nameEl = el.querySelector('h2, h3, h4, h5, .title, .activity-name, .event-name, td:first-child');
            const name = nameEl?.textContent?.trim();

            if (!name) return;

            // Extract dates
            const dateEl = el.querySelector('[class*="date"], .dates, td:nth-child(2)');
            const dateText = dateEl?.textContent?.trim() || '';

            // Extract time
            const timeEl = el.querySelector('[class*="time"], .schedule, td:nth-child(3)');
            const timeText = timeEl?.textContent?.trim() || '';

            // Extract location
            const locationEl = el.querySelector('[class*="location"], .venue, .place, td:nth-child(4)');
            const location = locationEl?.textContent?.trim() || '';

            // Extract price
            const priceEl = el.querySelector('[class*="price"], .cost, .fee, td:nth-child(5)');
            const priceText = priceEl?.textContent?.trim() || '';

            // Extract spots/availability
            const spotsEl = el.querySelector('[class*="spots"], [class*="availability"], .places');
            const spotsText = spotsEl?.textContent?.trim() || '';

            // Extract age range
            const ageEl = el.querySelector('[class*="age"], .age-range');
            const ageText = ageEl?.textContent?.trim() || '';

            // Extract link to details
            const linkEl = el.querySelector('a[href*="activity"], a[href*="event"]') || el.closest('a');
            const detailUrl = linkEl?.getAttribute('href') || '';

            // Extract activity ID from URL or data attribute
            const activityId = el.dataset?.activityId ||
              detailUrl.match(/\/(\d+)/)?.[1] ||
              '';

            activities.push({
              name,
              category,
              dateText,
              timeText,
              location,
              priceText,
              spotsText,
              ageText,
              detailUrl,
              activityId
            });
          } catch (e) {
            // Skip this element
          }
        });

        return activities;
      }, programTitle);

      // Process and add activities
      for (const rawActivity of pageActivities) {
        const activity = this.parseRawActivity(rawActivity, programUrl);
        if (activity) {
          activities.push(activity);
        }
      }

      this.logProgress(`  Found ${activities.length} activities in ${programTitle || 'program'}`);

    } catch (error) {
      this.logProgress(`Error extracting from ${programUrl}: ${error.message}`);
    }

    return activities;
  }

  /**
   * Parse raw activity data into normalized format
   */
  parseRawActivity(raw, sourceUrl) {
    try {
      // Parse price
      const cost = this.parsePrice(raw.priceText);

      // Parse dates
      const { dateStart, dateEnd } = this.parseDates(raw.dateText);

      // Parse time
      const { startTime, endTime, dayOfWeek } = this.parseTime(raw.timeText, raw.dateText);

      // Parse age range
      const { ageMin, ageMax } = this.parseAgeRange(raw.ageText, raw.name);

      // Parse spots
      const { spotsAvailable, totalSpots } = this.parseSpots(raw.spotsText);

      // Generate external ID
      const externalId = raw.activityId || generateStableActivityId({
        name: raw.name,
        locationName: raw.location,
        startTime,
        dateStart: dateStart?.toISOString(),
        cost
      });

      return {
        externalId,
        name: raw.name,
        category: raw.category || 'Recreation',
        description: '',
        dateStart,
        dateEnd,
        startTime,
        endTime,
        dayOfWeek,
        cost,
        spotsAvailable,
        totalSpots,
        locationName: raw.location || this.config.city || 'Unknown',
        registrationUrl: raw.detailUrl ?
          (raw.detailUrl.startsWith('http') ? raw.detailUrl : `https://app.amilia.com${raw.detailUrl}`) :
          sourceUrl,
        ageMin,
        ageMax,
        registrationStatus: spotsAvailable > 0 ? 'Open' : (spotsAvailable === 0 ? 'Full' : 'Unknown')
      };
    } catch (error) {
      this.logProgress(`Error parsing activity: ${error.message}`);
      return null;
    }
  }

  /**
   * Parse price from text
   */
  parsePrice(priceText) {
    if (!priceText) return 0;

    // Handle "Free" or "Gratuit"
    if (/free|gratuit/i.test(priceText)) return 0;

    // Extract number from price text
    const match = priceText.match(/\$?\s*([\d,]+(?:\.\d{2})?)/);
    if (match) {
      return parseFloat(match[1].replace(',', ''));
    }

    return 0;
  }

  /**
   * Parse date range from text
   */
  parseDates(dateText) {
    const result = { dateStart: null, dateEnd: null };

    if (!dateText) return result;

    // Common date patterns
    // "Jan 15 - Mar 20, 2026" or "2026-01-15 - 2026-03-20"
    const rangeMatch = dateText.match(
      /(\w+\s+\d{1,2}|\d{4}-\d{2}-\d{2})\s*[-–to]+\s*(\w+\s+\d{1,2},?\s*\d{4}|\d{4}-\d{2}-\d{2})/i
    );

    if (rangeMatch) {
      try {
        result.dateStart = new Date(rangeMatch[1]);
        result.dateEnd = new Date(rangeMatch[2]);
      } catch (e) {
        // Continue with null dates
      }
    } else {
      // Try single date
      try {
        const date = new Date(dateText);
        if (!isNaN(date.getTime())) {
          result.dateStart = date;
          result.dateEnd = date;
        }
      } catch (e) {
        // Continue with null dates
      }
    }

    return result;
  }

  /**
   * Parse time and day of week from text
   */
  parseTime(timeText, dateText) {
    const result = { startTime: null, endTime: null, dayOfWeek: [] };

    if (!timeText && !dateText) return result;

    const text = `${timeText || ''} ${dateText || ''}`;

    // Extract time range like "9:00 AM - 12:00 PM" or "9h00 - 12h00"
    const timeMatch = text.match(
      /(\d{1,2}[h:]\d{2})\s*(?:AM|PM|am|pm)?\s*[-–to]+\s*(\d{1,2}[h:]\d{2})\s*(?:AM|PM|am|pm)?/i
    );

    if (timeMatch) {
      result.startTime = this.normalizeTime(timeMatch[1]);
      result.endTime = this.normalizeTime(timeMatch[2]);
    }

    // Extract days of week
    const days = [];
    for (const [dayName, dayNum] of Object.entries(this.dayMap)) {
      if (new RegExp(dayName, 'i').test(text)) {
        days.push(dayNum);
      }
    }
    if (days.length > 0) {
      result.dayOfWeek = [...new Set(days)].sort();
    }

    return result;
  }

  /**
   * Normalize time to HH:MM format
   */
  normalizeTime(timeStr) {
    if (!timeStr) return null;

    // Convert "9h00" to "9:00"
    const normalized = timeStr.replace('h', ':');

    // Handle AM/PM
    const isPM = /pm/i.test(timeStr);
    const match = normalized.match(/(\d{1,2}):(\d{2})/);

    if (match) {
      let hours = parseInt(match[1]);
      if (isPM && hours < 12) hours += 12;
      if (!isPM && hours === 12) hours = 0;
      return `${hours.toString().padStart(2, '0')}:${match[2]}`;
    }

    return null;
  }

  /**
   * Parse age range from text
   */
  parseAgeRange(ageText, name) {
    const result = { ageMin: null, ageMax: null };
    const text = `${ageText || ''} ${name || ''}`;

    // Match patterns like "5-12 years", "6 ans et plus", "3 à 5 ans"
    const rangeMatch = text.match(/(\d+)\s*[-–àto]+\s*(\d+)\s*(?:years?|ans?|yrs?)?/i);
    if (rangeMatch) {
      result.ageMin = parseInt(rangeMatch[1]);
      result.ageMax = parseInt(rangeMatch[2]);
      return result;
    }

    // Match "X years and up" or "X ans et plus"
    const minMatch = text.match(/(\d+)\s*(?:years?|ans?)?\s*(?:and up|\+|et plus)/i);
    if (minMatch) {
      result.ageMin = parseInt(minMatch[1]);
      result.ageMax = 18;
      return result;
    }

    // Match "under X" or "moins de X ans"
    const maxMatch = text.match(/(?:under|moins de)\s*(\d+)/i);
    if (maxMatch) {
      result.ageMin = 0;
      result.ageMax = parseInt(maxMatch[1]);
      return result;
    }

    return result;
  }

  /**
   * Parse spots availability from text
   */
  parseSpots(spotsText) {
    const result = { spotsAvailable: null, totalSpots: null };

    if (!spotsText) return result;

    // Match "5/20 spots" or "5 places sur 20"
    const match = spotsText.match(/(\d+)\s*[/sur]+\s*(\d+)/);
    if (match) {
      result.spotsAvailable = parseInt(match[1]);
      result.totalSpots = parseInt(match[2]);
      return result;
    }

    // Match "5 spots available"
    const availMatch = spotsText.match(/(\d+)\s*(?:spots?|places?)/i);
    if (availMatch) {
      result.spotsAvailable = parseInt(availMatch[1]);
    }

    // Check for full/complet
    if (/full|complet/i.test(spotsText)) {
      result.spotsAvailable = 0;
    }

    return result;
  }

  /**
   * Normalize activities for database storage
   */
  async normalizeActivities(activities) {
    // Day number to name mapping
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    return activities.map(activity => ({
      ...activity,
      // Ensure required fields
      externalId: activity.externalId || generateStableActivityId(activity),
      name: activity.name || 'Unknown Activity',
      category: activity.category || 'Recreation',
      cost: activity.cost || 0,
      // Clean up dates
      dateStart: activity.dateStart instanceof Date && !isNaN(activity.dateStart) ? activity.dateStart : null,
      dateEnd: activity.dateEnd instanceof Date && !isNaN(activity.dateEnd) ? activity.dateEnd : null,
      // Convert day numbers to day names for database
      dayOfWeek: Array.isArray(activity.dayOfWeek)
        ? activity.dayOfWeek.map(d => typeof d === 'number' ? dayNames[d] : d).filter(Boolean)
        : []
    }));
  }

  /**
   * Delay helper
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = AmiliaScraper;
