const BaseScraper = require('../base/BaseScraper');
const KidsActivityFilter = require('../utils/KidsActivityFilter');
const puppeteer = require('puppeteer');
const crypto = require('crypto');

/**
 * Generate a stable hash for an activity based on its properties.
 * @param {Object} activity - Activity object
 * @returns {String} Stable hash ID
 */
function generateStableActivityId(activity) {
  const key = [
    activity.name || '',
    activity.location || activity.locationName || '',
    activity.startTime || '',
    activity.dateStart || '',
    activity.cost || ''
  ].join('|').toLowerCase().trim();

  const hash = crypto.createHash('md5').update(key).digest('hex').substring(0, 12);
  return `qidigo-${hash}`;
}

/**
 * Platform scraper for Qidigo recreation registration systems
 * URL pattern: qidigo.com/u/{organization}/activities/session
 *
 * Uses Puppeteer to navigate activity categories and extract activity data
 */
class QidigoScraper extends BaseScraper {
  constructor(config) {
    super(config);
    this.platformName = 'Qidigo';

    // Day of week mapping (French)
    this.dayMap = {
      'dimanche': 0, 'lundi': 1, 'mardi': 2, 'mercredi': 3,
      'jeudi': 4, 'vendredi': 5, 'samedi': 6,
      'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3,
      'Thursday': 4, 'Friday': 5, 'Saturday': 6
    };
  }

  /**
   * Main scrape method
   */
  async scrape() {
    const startTime = Date.now();
    this.logProgress(`Starting Qidigo scraper for ${this.config.name}`);

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
   * Use Puppeteer to navigate Qidigo and extract activities
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

      // Navigate to activities page
      const baseUrl = this.config.baseUrl;
      this.logProgress(`Navigating to ${baseUrl}`);

      await page.goto(baseUrl, {
        waitUntil: 'networkidle2',
        timeout: 60000
      });

      // Wait for page to load
      await this.delay(3000);

      // Get all category links
      const categoryLinks = await this.extractCategoryLinks(page);
      this.logProgress(`Found ${categoryLinks.length} activity categories`);

      // Process each category
      for (const category of categoryLinks) {
        try {
          this.logProgress(`Processing category: ${category.name}`);
          const categoryActivities = await this.extractActivitiesFromCategory(page, category);
          activities.push(...categoryActivities);

          // Rate limiting
          await this.delay(this.config.scraperConfig?.rateLimits?.delayBetweenPages || 2000);
        } catch (error) {
          this.logProgress(`Error processing category ${category.name}: ${error.message}`);
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
   * Extract category links from the main activities page
   */
  async extractCategoryLinks(page) {
    return await page.evaluate(() => {
      const links = [];
      // Find activity category cards/links
      const categoryElements = document.querySelectorAll(
        'a[href*="/activity/"], .activity-card a, [class*="activity"] a'
      );

      categoryElements.forEach(el => {
        const href = el.getAttribute('href');
        const name = el.textContent?.trim();

        // Only include category links (not individual activity sessions)
        if (href && name && !links.some(l => l.href === href)) {
          links.push({
            href: href.startsWith('http') ? href : `https://www.qidigo.com${href}`,
            name: name.substring(0, 100)
          });
        }
      });

      return links;
    });
  }

  /**
   * Extract activities from a category page
   */
  async extractActivitiesFromCategory(page, category) {
    const activities = [];

    try {
      await page.goto(category.href, {
        waitUntil: 'networkidle2',
        timeout: 60000
      });

      // Wait for content to load
      await this.delay(2000);

      // Extract activities from the page
      const pageActivities = await page.evaluate((categoryName) => {
        const activities = [];

        // Look for session/activity rows
        const rows = document.querySelectorAll(
          '.session-row, .activity-session, [class*="session"], ' +
          'table tbody tr, .list-item, [class*="schedule"]'
        );

        rows.forEach(row => {
          try {
            // Extract activity details
            const nameEl = row.querySelector('h1, h2, h3, h4, .title, .name, td:first-child');
            const name = nameEl?.textContent?.trim();

            if (!name) return;

            // Extract schedule/dates
            const scheduleEl = row.querySelector('[class*="schedule"], [class*="date"], .time, td:nth-child(2)');
            const schedule = scheduleEl?.textContent?.trim() || '';

            // Extract price
            const priceEl = row.querySelector('[class*="price"], [class*="cost"], .fee, td:nth-child(3)');
            const priceText = priceEl?.textContent?.trim() || '';

            // Extract spots/availability
            const spotsEl = row.querySelector('[class*="spots"], [class*="places"], [class*="availability"]');
            const spotsText = spotsEl?.textContent?.trim() || '';

            // Extract location
            const locationEl = row.querySelector('[class*="location"], [class*="lieu"], .venue');
            const location = locationEl?.textContent?.trim() || '';

            // Extract age range
            const ageEl = row.querySelector('[class*="age"], [class*="clientele"]');
            const ageText = ageEl?.textContent?.trim() || '';

            // Extract link
            const linkEl = row.querySelector('a[href*="session"], a[href*="activity"]');
            const detailUrl = linkEl?.getAttribute('href') || '';

            activities.push({
              name,
              category: categoryName,
              schedule,
              priceText,
              spotsText,
              location,
              ageText,
              detailUrl
            });
          } catch (e) {
            // Skip this row
          }
        });

        // Also check for activity details on the page itself
        const pageTitle = document.querySelector('h1, .activity-title')?.textContent?.trim();
        const pageDescription = document.querySelector('.description, [class*="description"]')?.textContent?.trim();

        if (pageTitle && activities.length === 0) {
          // This might be a single activity page
          const priceEl = document.querySelector('[class*="price"], .cost');
          const scheduleEl = document.querySelector('[class*="schedule"], .dates');
          const ageEl = document.querySelector('[class*="age"], .clientele');

          activities.push({
            name: pageTitle,
            category: categoryName,
            description: pageDescription?.substring(0, 500),
            schedule: scheduleEl?.textContent?.trim() || '',
            priceText: priceEl?.textContent?.trim() || '',
            ageText: ageEl?.textContent?.trim() || '',
            location: '',
            detailUrl: window.location.href
          });
        }

        return activities;
      }, category.name);

      // Process and add activities
      for (const rawActivity of pageActivities) {
        const activity = this.parseRawActivity(rawActivity, category.href);
        if (activity) {
          activities.push(activity);
        }
      }

      this.logProgress(`  Found ${activities.length} activities in ${category.name}`);

    } catch (error) {
      this.logProgress(`Error extracting from ${category.href}: ${error.message}`);
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

      // Parse dates from schedule
      const { dateStart, dateEnd, startTime, endTime, dayOfWeek } = this.parseSchedule(raw.schedule);

      // Parse age range
      const { ageMin, ageMax } = this.parseAgeRange(raw.ageText, raw.name, raw.category);

      // Parse spots
      const { spotsAvailable, totalSpots } = this.parseSpots(raw.spotsText);

      // Generate external ID
      const externalId = generateStableActivityId({
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
        description: raw.description || '',
        schedule: raw.schedule,
        dateStart,
        dateEnd,
        startTime,
        endTime,
        dayOfWeek,
        cost,
        spotsAvailable,
        totalSpots,
        locationName: raw.location || this.config.city || 'Sherbrooke',
        registrationUrl: raw.detailUrl ?
          (raw.detailUrl.startsWith('http') ? raw.detailUrl : `https://www.qidigo.com${raw.detailUrl}`) :
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
    const match = priceText.match(/\$?\s*([\d,]+(?:[.,]\d{2})?)/);
    if (match) {
      return parseFloat(match[1].replace(',', '.'));
    }

    return 0;
  }

  /**
   * Parse schedule text into dates and times
   */
  parseSchedule(scheduleText) {
    const result = {
      dateStart: null,
      dateEnd: null,
      startTime: null,
      endTime: null,
      dayOfWeek: []
    };

    if (!scheduleText) return result;

    // Extract time range like "18h00 - 19h30" or "6:00 PM - 7:30 PM"
    const timeMatch = scheduleText.match(
      /(\d{1,2}[h:]\d{2})\s*[-–à]\s*(\d{1,2}[h:]\d{2})/i
    );

    if (timeMatch) {
      result.startTime = this.normalizeTime(timeMatch[1]);
      result.endTime = this.normalizeTime(timeMatch[2]);
    }

    // Extract days of week
    const days = [];
    for (const [dayName, dayNum] of Object.entries(this.dayMap)) {
      if (new RegExp(dayName, 'i').test(scheduleText)) {
        days.push(dayNum);
      }
    }
    if (days.length > 0) {
      result.dayOfWeek = [...new Set(days)].sort();
    }

    // Try to extract date range
    const dateMatch = scheduleText.match(
      /(\d{1,2}\s+\w+|\w+\s+\d{1,2})\s*[-–au]+\s*(\d{1,2}\s+\w+\s*\d{4}|\w+\s+\d{1,2},?\s*\d{4})/i
    );

    if (dateMatch) {
      try {
        result.dateStart = new Date(dateMatch[1]);
        result.dateEnd = new Date(dateMatch[2]);
      } catch (e) {
        // Continue with null dates
      }
    }

    return result;
  }

  /**
   * Normalize time to HH:MM format
   */
  normalizeTime(timeStr) {
    if (!timeStr) return null;

    // Convert "18h00" to "18:00"
    const normalized = timeStr.replace('h', ':');

    const match = normalized.match(/(\d{1,2}):(\d{2})/);
    if (match) {
      const hours = parseInt(match[1]);
      return `${hours.toString().padStart(2, '0')}:${match[2]}`;
    }

    return null;
  }

  /**
   * Parse age range from text
   */
  parseAgeRange(ageText, name, category) {
    const result = { ageMin: null, ageMax: null };
    const text = `${ageText || ''} ${name || ''} ${category || ''}`;

    // Check for adult-only indicators
    if (/\bAdulte\b|\bAdult\b|18\+|19\+/i.test(text)) {
      result.ageMin = 18;
      result.ageMax = 99;
      return result;
    }

    // Match patterns like "5-12 ans", "6 à 12 ans"
    const rangeMatch = text.match(/(\d+)\s*[-–àto]+\s*(\d+)\s*(?:ans?|years?|yrs?)?/i);
    if (rangeMatch) {
      result.ageMin = parseInt(rangeMatch[1]);
      result.ageMax = parseInt(rangeMatch[2]);
      return result;
    }

    // Match "X ans et plus" or "X years and up"
    const minMatch = text.match(/(\d+)\s*(?:ans?|years?)?\s*(?:et plus|\+|and up)/i);
    if (minMatch) {
      result.ageMin = parseInt(minMatch[1]);
      result.ageMax = 99;
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

    // Match "5/20 places" or "5 sur 20"
    const match = spotsText.match(/(\d+)\s*[/sur]+\s*(\d+)/);
    if (match) {
      result.spotsAvailable = parseInt(match[1]);
      result.totalSpots = parseInt(match[2]);
      return result;
    }

    // Match "5 places"
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
      externalId: activity.externalId || generateStableActivityId(activity),
      name: activity.name || 'Unknown Activity',
      category: activity.category || 'Recreation',
      cost: activity.cost || 0,
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

module.exports = QidigoScraper;
