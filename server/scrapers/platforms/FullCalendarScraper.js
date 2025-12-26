const BaseScraper = require('../base/BaseScraper');
const DataNormalizer = require('../base/DataNormalizer');
const puppeteer = require('puppeteer');

/**
 * Platform scraper for FullCalendar/CivicWeb-based community calendars
 * Handles calendar-based event extraction
 * Used by: Lions Bay, Anmore (and similar small community sites)
 */
class FullCalendarScraper extends BaseScraper {
  constructor(config) {
    super(config);
    this.platformName = 'FullCalendar';
  }

  /**
   * Main scraping method for FullCalendar platforms
   * @returns {Promise<{activities: Array, stats: Object, report: String}>}
   */
  async scrape() {
    const startTime = Date.now();
    this.logProgress('Starting FullCalendar scraper');

    try {
      // Validate configuration
      this.validateConfig();

      // Get provider record
      const provider = await this.getOrCreateProvider();

      // Extract activities from calendar
      const rawActivities = await this.extractCalendarActivities();

      // Normalize the data
      const normalizedActivities = await this.normalizeActivities(rawActivities);

      // Filter for children's activities only (age 0-18)
      const filteredActivities = this.filterByAge(normalizedActivities);

      // Save to database
      const stats = await this.saveActivitiesToDatabase(filteredActivities, provider.id);

      // Generate report
      const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
      const report = this.generateReport(stats, duration);

      this.logProgress(`Scraping completed in ${duration} minutes`);

      return {
        activities: filteredActivities,
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
   * Filter activities to only include children's activities (age 0-18)
   */
  filterByAge(activities) {
    const { ageFilter } = this.config.scraperConfig;

    if (!ageFilter || !ageFilter.enabled) {
      return activities;
    }

    const minAge = ageFilter.minAge || 0;
    const maxAge = ageFilter.maxAge || 18;

    return activities.filter(activity => {
      // If no age info, check if title/description suggests kids activity
      if (activity.ageMin === null && activity.ageMax === null) {
        const text = `${activity.name} ${activity.description || ''}`.toLowerCase();
        const kidsPatterns = /kid|child|youth|teen|family|parent|baby|toddler|preschool|camp|lesson|class/i;
        const adultPatterns = /adult\s*only|19\+|21\+|seniors?\s*only|55\+/i;

        // Include if it matches kids patterns and doesn't match adult patterns
        return kidsPatterns.test(text) && !adultPatterns.test(text);
      }

      // Check if age range overlaps with target range
      const activityMin = activity.ageMin || 0;
      const activityMax = activity.ageMax || 99;

      return activityMin <= maxAge && activityMax >= minAge;
    });
  }

  /**
   * Extract activities from FullCalendar
   * @returns {Promise<Array>} Raw activity data
   */
  async extractCalendarActivities() {
    const activities = [];
    const { entryPoints } = this.config.scraperConfig;
    const monthsToScrape = this.config.scraperConfig.monthsToScrape || 6;

    let browser;
    try {
      browser = await puppeteer.launch({
        headless: this.config.scraperConfig.headless !== false,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage'
        ]
      });

      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
      await page.setViewport({ width: 1920, height: 1080 });

      // Navigate to calendar page
      const calendarUrl = `${this.config.baseUrl}${entryPoints[0]}`;
      this.logProgress(`Loading calendar: ${calendarUrl}`);

      await page.goto(calendarUrl, { waitUntil: 'networkidle2', timeout: 60000 });
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Wait for calendar to render
      try {
        await page.waitForSelector('.fc-event, .fc-daygrid-event, .calendar-event, .event', { timeout: 15000 });
      } catch (e) {
        this.logProgress('Calendar events not found with standard selectors, trying alternatives...');
      }

      // Collect events from multiple months
      const seenUrls = new Set();

      for (let month = 0; month < monthsToScrape; month++) {
        this.logProgress(`Scraping month ${month + 1}/${monthsToScrape}`);

        // Extract events from current month view
        const monthEvents = await this.extractEventsFromPage(page);

        for (const event of monthEvents) {
          if (event.url && !seenUrls.has(event.url)) {
            seenUrls.add(event.url);
            activities.push(event);
          } else if (!event.url && event.name) {
            // Events without URLs - use name as dedup key
            const key = `${event.name}-${event.startDate}`;
            if (!seenUrls.has(key)) {
              seenUrls.add(key);
              activities.push(event);
            }
          }
        }

        this.logProgress(`  Found ${monthEvents.length} events this month (${activities.length} total unique)`);

        // Navigate to next month
        if (month < monthsToScrape - 1) {
          const navigated = await this.navigateToNextMonth(page);
          if (!navigated) {
            this.logProgress('Could not navigate to next month, stopping');
            break;
          }
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }

      // Optionally fetch details for each event
      if (this.config.scraperConfig.fetchDetails !== false) {
        const eventsWithUrls = activities.filter(e => e.url);
        this.logProgress(`Fetching details for ${eventsWithUrls.length} events with URLs`);

        for (let i = 0; i < eventsWithUrls.length; i++) {
          const event = eventsWithUrls[i];
          try {
            const details = await this.fetchEventDetails(page, event.url);
            Object.assign(event, details);

            if ((i + 1) % 10 === 0) {
              this.logProgress(`  Processed ${i + 1}/${eventsWithUrls.length} event details`);
            }

            // Rate limit
            await new Promise(resolve => setTimeout(resolve, 1000));
          } catch (error) {
            this.handleError(error, `fetching details for ${event.name}`);
          }
        }
      }

    } finally {
      if (browser) await browser.close();
    }

    this.logProgress(`Total activities extracted: ${activities.length}`);
    return activities;
  }

  /**
   * Extract events from current calendar page
   */
  async extractEventsFromPage(page) {
    return await page.evaluate(() => {
      const events = [];

      // Try multiple selectors for different FullCalendar versions and CivicWeb
      const eventSelectors = [
        '.fc-event',
        '.fc-daygrid-event',
        '.fc-list-item',
        '.calendar-event',
        '.event-item',
        '.vevent',
        'a[class*="event"]',
        '[data-event]'
      ];

      let eventElements = [];
      for (const selector of eventSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          eventElements = Array.from(elements);
          break;
        }
      }

      // Fallback: look for links with event-like structure
      if (eventElements.length === 0) {
        const links = document.querySelectorAll('a');
        eventElements = Array.from(links).filter(link => {
          const href = link.href || '';
          const text = link.textContent || '';
          return (href.includes('event') || href.includes('calendar')) &&
                 text.length > 3 && text.length < 200;
        });
      }

      eventElements.forEach((el, index) => {
        try {
          const event = {
            index: index
          };

          // Get event title
          const titleEl = el.querySelector('.fc-event-title, .fc-title, .event-title, .title, h3, h4');
          event.name = titleEl?.textContent?.trim() || el.textContent?.trim().substring(0, 100);

          // Get event URL
          if (el.tagName === 'A') {
            event.url = el.href;
          } else {
            const link = el.querySelector('a');
            event.url = link?.href;
          }

          // Get event time/date from data attributes
          event.startDate = el.dataset?.start || el.dataset?.date;
          event.endDate = el.dataset?.end;

          // Try to get time from title or aria-label
          const timeText = el.getAttribute('aria-label') || '';
          const timeMatch = timeText.match(/(\d{1,2}:\d{2})\s*(am|pm)?/i);
          if (timeMatch) {
            event.startTime = timeMatch[0];
          }

          // Only add if we have a name
          if (event.name && event.name.length > 2) {
            events.push(event);
          }
        } catch (e) {
          console.error('Error extracting event:', e);
        }
      });

      return events;
    });
  }

  /**
   * Navigate to next month in calendar
   */
  async navigateToNextMonth(page) {
    try {
      // Try multiple selectors for next button
      const nextButtonSelectors = [
        '.fc-next-button',
        '.fc-button-next',
        'button[title="Next"]',
        'button[aria-label="Next"]',
        '.calendar-next',
        '.next-month',
        'a[class*="next"]',
        'button[class*="next"]'
      ];

      for (const selector of nextButtonSelectors) {
        const clicked = await page.evaluate((sel) => {
          const btn = document.querySelector(sel);
          if (btn && !btn.disabled) {
            btn.click();
            return true;
          }
          return false;
        }, selector);

        if (clicked) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          return true;
        }
      }

      return false;
    } catch (error) {
      this.logProgress(`Navigation error: ${error.message}`);
      return false;
    }
  }

  /**
   * Fetch detailed event information from event page
   */
  async fetchEventDetails(page, url) {
    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise(resolve => setTimeout(resolve, 2000));

      return await page.evaluate(() => {
        const details = {};
        const pageText = document.body.innerText;

        // Get description
        const descSelectors = [
          '.event-description',
          '.description',
          '.entry-content',
          '.event-content',
          'article p',
          '.content p',
          '.event-details p',
          '.event-body'
        ];

        for (const selector of descSelectors) {
          const el = document.querySelector(selector);
          if (el && el.textContent.trim().length > 20) {
            details.description = el.textContent.trim().substring(0, 1000);
            break;
          }
        }

        // Get location - clean up common prefixes
        const locSelectors = [
          '.event-location',
          '.location',
          '[class*="location"]',
          '.venue'
        ];

        for (const selector of locSelectors) {
          const el = document.querySelector(selector);
          if (el) {
            let loc = el.textContent.trim();
            // Remove common prefixes
            loc = loc.replace(/^(where|location|venue)\s*:?\s*/i, '');
            details.location = loc;
            break;
          }
        }

        // Fallback: extract location from text
        if (!details.location) {
          const locMatch = pageText.match(/(?:location|venue|where)\s*:?\s*([^\n]+)/i);
          if (locMatch) {
            details.location = locMatch[1].trim().replace(/^:?\s*/, '');
          }
        }

        // Get date/time - look for multiple patterns
        const dateSelectors = [
          '.event-date',
          '.date',
          'time',
          '[class*="date"]',
          '.event-time',
          '.when'
        ];

        let dateText = '';
        for (const selector of dateSelectors) {
          const el = document.querySelector(selector);
          if (el) {
            dateText = el.textContent.trim();
            break;
          }
        }

        // Fallback: extract date/time from text
        if (!dateText) {
          const whenMatch = pageText.match(/(?:when|date|time)\s*:?\s*([^\n]+)/i);
          if (whenMatch) {
            dateText = whenMatch[1].trim();
          }
        }

        // Parse date text for dates and times
        if (dateText) {
          details.dateText = dateText;

          // Try to extract date: "January 15, 2025" or "Jan 15" or "12/15/2025"
          const datePatterns = [
            /(\d{1,2}\/\d{1,2}\/\d{4})/,
            /(\d{4}-\d{2}-\d{2})/,
            /((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:,?\s+\d{4})?)/i,
            /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}(?:,?\s+\d{4})?)/i
          ];

          for (const pattern of datePatterns) {
            const match = dateText.match(pattern);
            if (match) {
              details.startDate = match[1];
              break;
            }
          }

          // Try to extract time: "9:00 AM - 10:00 AM" or "9am-10am"
          const timeMatch = dateText.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*[-–to]+\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
          if (timeMatch) {
            details.startTime = timeMatch[1].trim().toUpperCase();
            details.endTime = timeMatch[2].trim().toUpperCase();
          } else {
            // Single time
            const singleTimeMatch = dateText.match(/(\d{1,2}:\d{2}\s*(?:am|pm))/i);
            if (singleTimeMatch) {
              details.startTime = singleTimeMatch[1].trim().toUpperCase();
            }
          }

          // Try to extract day of week
          const dayMatch = dateText.match(/((?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)s?)/i);
          if (dayMatch) {
            const dayMap = {
              'monday': 'Mon', 'tuesday': 'Tue', 'wednesday': 'Wed',
              'thursday': 'Thu', 'friday': 'Fri', 'saturday': 'Sat', 'sunday': 'Sun',
              'mondays': 'Mon', 'tuesdays': 'Tue', 'wednesdays': 'Wed',
              'thursdays': 'Thu', 'fridays': 'Fri', 'saturdays': 'Sat', 'sundays': 'Sun'
            };
            details.dayOfWeek = [dayMap[dayMatch[1].toLowerCase()] || dayMatch[1].substring(0, 3)];
          }
        }

        // Get price/cost
        const priceMatch = pageText.match(/\$\s*([\d,.]+)/);
        if (priceMatch) {
          details.price = priceMatch[0];
        }

        // Check for registration link
        const regLink = document.querySelector('a[href*="register"], a[href*="signup"], a[href*="book"]');
        if (regLink) {
          details.registrationUrl = regLink.href;
        }

        // Get age information - multiple patterns
        const agePatterns = [
          /ages?\s*:?\s*(\d+)\s*[-–to]+\s*(\d+)/i,
          /(\d+)\s*(?:to|[-–])\s*(\d+)\s*(?:years?|yrs?)/i,
          /for\s+(?:ages?\s+)?(\d+)\s*[-–to]+\s*(\d+)/i
        ];

        for (const pattern of agePatterns) {
          const ageMatch = pageText.match(pattern);
          if (ageMatch) {
            details.ageMin = parseInt(ageMatch[1]);
            details.ageMax = parseInt(ageMatch[2]);
            break;
          }
        }

        return details;
      });
    } catch (error) {
      this.handleError(error, `fetchEventDetails ${url}`);
      return {};
    }
  }

  /**
   * Normalize FullCalendar activities
   */
  async normalizeActivities(rawActivities) {
    const fieldMapping = this.getFieldMapping();
    const normalized = [];

    for (const rawActivity of rawActivities) {
      try {
        // Generate external ID from URL or name+date
        if (!rawActivity.externalId) {
          if (rawActivity.url) {
            const urlParts = rawActivity.url.split('/');
            rawActivity.externalId = urlParts[urlParts.length - 1] || rawActivity.url;
          } else {
            rawActivity.externalId = `${rawActivity.name}-${rawActivity.startDate || 'nodate'}`.replace(/[^a-zA-Z0-9]/g, '-');
          }
        }

        const normalizedActivity = DataNormalizer.normalizeActivity(
          rawActivity,
          fieldMapping,
          this.config
        );

        // Validate the normalized data
        const validation = this.validateActivityData(normalizedActivity);
        if (validation.isValid || validation.warnings.length > 0) {
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
   * Get field mapping for FullCalendar platform
   */
  getFieldMapping() {
    return {
      name: 'name',
      externalId: { path: 'externalId', transform: (val, raw) => val || `fullcalendar-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` },
      category: { path: 'category', transform: (val, raw) => val || 'Community Event' },
      subcategory: 'name',
      description: 'description',
      fullDescription: 'description',
      dateStart: 'startDate',
      dateEnd: { path: 'endDate', transform: (val, raw) => val || raw.startDate },
      startTime: 'startTime',
      endTime: 'endTime',
      dayOfWeek: { path: 'dayOfWeek', transform: (val, raw) => {
        // Derive day of week from startDate if not provided
        if (val && Array.isArray(val) && val.length > 0) return val;
        if (raw.startDate) {
          try {
            const date = new Date(raw.startDate);
            if (!isNaN(date.getTime())) {
              const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
              return [days[date.getDay()]];
            }
          } catch (e) {}
        }
        return [];
      }},
      cost: { path: 'price', transform: (val) => {
        if (!val) return 0;
        if (typeof val === 'number') return val;
        const match = String(val).match(/\$?\s*([\d,.]+)/);
        return match ? parseFloat(match[1].replace(',', '')) : 0;
      }},
      registrationUrl: ['registrationUrl', 'url'],
      locationName: 'location',
      ageMin: 'ageMin',
      ageMax: 'ageMax',
      registrationStatus: { path: 'registrationStatus', transform: (val, raw) => {
        if (val) return val;
        // Derive from text if available
        const text = `${raw.name || ''} ${raw.description || ''}`.toLowerCase();
        if (text.includes('full') || text.includes('sold out')) return 'Full';
        if (text.includes('cancelled') || text.includes('canceled')) return 'Cancelled';
        if (text.includes('waitlist')) return 'Waitlist';
        return 'Open';
      }}
    };
  }

  /**
   * Get or create provider record
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

module.exports = FullCalendarScraper;
