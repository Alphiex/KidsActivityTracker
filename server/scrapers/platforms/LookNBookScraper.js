/**
 * LookNBook Scraper
 *
 * Scrapes activities from LookNBook/LiveAndPlay recreation registration systems.
 * Used by: Red Deer, Strathcona County, and similar municipalities.
 *
 * These sites use server-rendered HTML with course listings at /public/category/courses
 * No browser automation needed - uses simple HTTP requests with Cheerio parsing.
 */

const cheerio = require('cheerio');
const BaseScraper = require('../base/BaseScraper');

class LookNBookScraper extends BaseScraper {
  constructor(config) {
    super(config);
    this.platformName = 'looknbook';
  }

  /**
   * Main scrape method
   */
  async scrape() {
    const startTime = Date.now();
    this.logProgress('Starting LookNBook scraper');

    try {
      // Get or create provider
      const provider = await this.getOrCreateProvider();

      // Build the courses URL
      const coursesUrl = this.buildCoursesUrl();
      this.logProgress(`Fetching courses from: ${coursesUrl}`);

      // Fetch all pages
      const activities = await this.fetchAllPages(coursesUrl);
      this.logProgress(`Parsed ${activities.length} activities from all pages`);

      // Filter for kids activities if age filter is enabled
      let filteredActivities = activities;
      if (this.config.scraperConfig?.ageFilter?.enabled) {
        const maxAge = this.config.scraperConfig.ageFilter.maxAge || 18;
        filteredActivities = activities.filter(a => {
          // Keep activities where max age is <= filter max age
          // Or if no age is specified, try to detect from title
          if (a.ageMax !== null && a.ageMax !== undefined) {
            return a.ageMax <= maxAge;
          }
          // Check title for age indicators
          return this.isLikelyKidsActivity(a.name);
        });
        this.logProgress(`Filtered to ${filteredActivities.length} kids activities (max age: ${maxAge})`);
      }

      // Normalize activities
      const normalizedActivities = await this.normalizeActivities(filteredActivities);

      // Save to database
      const stats = await this.saveActivitiesToDatabase(normalizedActivities, provider.id);

      const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
      const report = this.generateReport(stats, duration);
      this.logProgress(`Scraping completed in ${duration} minutes`);

      return { activities: normalizedActivities, stats, report };
    } catch (error) {
      this.logProgress(`Error in scrape: ${error.message}`);
      throw error;
    }
  }

  /**
   * Build the URL for the courses page
   */
  buildCoursesUrl() {
    const baseUrl = this.config.baseUrl;
    const entryPoint = this.config.scraperConfig?.entryPoints?.[0] || '/public/category/courses';

    // Handle different URL patterns
    if (entryPoint.includes('/courses')) {
      return `${baseUrl}${entryPoint}`;
    }

    // For category browsing URLs, convert to courses URL
    // e.g., /RedDeer/public/category/browse/PROGRAMS -> /RedDeer/public/category/courses
    const match = entryPoint.match(/^(\/[^/]+\/public\/category)/);
    if (match) {
      return `${baseUrl}${match[1]}/courses`;
    }

    return `${baseUrl}${entryPoint}`;
  }

  /**
   * Fetch all pages of activities with pagination support
   */
  async fetchAllPages(baseCoursesUrl) {
    const allActivities = [];
    let pageNum = 1;
    const maxPages = this.config.scraperConfig?.maxPages || 20;

    while (pageNum <= maxPages) {
      // Build URL with page parameter
      const pageUrl = pageNum === 1
        ? baseCoursesUrl
        : `${baseCoursesUrl}?page=${pageNum}`;

      this.logProgress(`  Fetching page ${pageNum}...`);
      const html = await this.fetchPage(pageUrl);

      if (!html) {
        this.logProgress(`  Failed to fetch page ${pageNum}, stopping`);
        break;
      }

      const activities = this.parseActivities(html);
      this.logProgress(`  Page ${pageNum}: ${activities.length} activities`);

      if (activities.length === 0) {
        // No more activities on this page
        break;
      }

      allActivities.push(...activities);

      // Check if there are more pages
      const $ = cheerio.load(html);
      const hasNextPage = this.hasMorePages($, pageNum);

      if (!hasNextPage) {
        break;
      }

      pageNum++;

      // Rate limiting - wait between page requests
      const delay = this.config.scraperConfig?.rateLimits?.delayBetweenPages || 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    return allActivities;
  }

  /**
   * Check if there are more pages to fetch
   */
  hasMorePages($, currentPage) {
    // Look for pagination links
    const paginationLinks = $('a[href*="page="]');

    // Check for next page link
    let hasNext = false;
    paginationLinks.each((i, el) => {
      const href = $(el).attr('href') || '';
      const match = href.match(/page=(\d+)/);
      if (match) {
        const pageNum = parseInt(match[1], 10);
        if (pageNum > currentPage) {
          hasNext = true;
        }
      }
    });

    // Also check for "Next" text link
    if ($('a:contains("Next")').length > 0) {
      hasNext = true;
    }

    // Check for numbered pagination (1 2 3 4 5 style)
    const pageNumbers = $('a').filter((i, el) => {
      const text = $(el).text().trim();
      return /^\d+$/.test(text) && parseInt(text, 10) > currentPage;
    });

    if (pageNumbers.length > 0) {
      hasNext = true;
    }

    return hasNext;
  }

  /**
   * Fetch page HTML using HTTP request
   */
  async fetchPage(url) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
        timeout: this.config.scraperConfig?.timeout || 60000,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.text();
    } catch (error) {
      this.logProgress(`Failed to fetch ${url}: ${error.message}`);
      return null;
    }
  }

  /**
   * Parse activities from HTML using Cheerio
   */
  parseActivities(html) {
    const $ = cheerio.load(html);
    const activities = [];

    // Find all course cards - they're typically in divs or sections with course info
    // Pattern 1: h4 title followed by course details
    $('h4').each((index, element) => {
      try {
        const $title = $(element);
        const title = $title.text().trim();

        if (!title) return;

        // Get the parent container that holds all course info
        const $container = $title.parent();
        const containerText = $container.text();

        // Extract ID
        const idMatch = containerText.match(/ID:\s*(\d+)/);
        const externalId = idMatch ? idMatch[1] : null;

        if (!externalId) return; // Skip if no ID found

        // Extract Price
        const priceMatch = containerText.match(/Price:\s*\$?([\d,.]+)/);
        const cost = priceMatch ? parseFloat(priceMatch[1].replace(',', '')) : null;

        // Extract Spaces
        const spacesMatch = containerText.match(/Spaces:\s*(\d+)/);
        const spotsAvailable = spacesMatch ? parseInt(spacesMatch[1], 10) : null;

        // Extract Date Range
        const fromMatch = containerText.match(/From:\s*([A-Za-z]+,\s*\d{1,2}-[A-Za-z]+-\d{2,4})/);
        const toMatch = containerText.match(/To:\s*([A-Za-z]+,\s*\d{1,2}-[A-Za-z]+-\d{2,4})/);

        const dateStart = fromMatch ? this.parseLookNBookDate(fromMatch[1]) : null;
        const dateEnd = toMatch ? this.parseLookNBookDate(toMatch[1]) : dateStart;

        // Extract schedule from table
        const schedule = this.extractSchedule($, $container);

        // Extract Location and Venue
        const locationInfo = this.extractLocation($, $container);

        // Extract age range from title
        const ageRange = this.extractAgeFromTitle(title);

        // Build registration URL
        const registrationUrl = `${this.config.baseUrl}${this.getPathPrefix()}/public/course/${externalId}`;

        activities.push({
          name: title,
          externalId: `${this.config.code}-${externalId}`,
          category: this.categorizeActivity(title),
          cost: cost,
          costDisplay: cost !== null ? (cost === 0 ? 'Free' : `$${cost.toFixed(2)}`) : null,
          spotsAvailable: spotsAvailable,
          registrationStatus: spotsAvailable === 0 ? 'Full' : 'Open',
          dateStart: dateStart,
          dateEnd: dateEnd,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          dayOfWeek: schedule.dayOfWeek,
          schedule: schedule.scheduleText,
          locationName: locationInfo.locationName,
          fullAddress: locationInfo.fullAddress,
          ageMin: ageRange.ageMin,
          ageMax: ageRange.ageMax,
          registrationUrl: registrationUrl,
          description: null,
          fullDescription: null,
        });
      } catch (error) {
        // Skip problematic entries
      }
    });

    return activities;
  }

  /**
   * Get the path prefix from config (e.g., /RedDeer or /STRATHCONA)
   */
  getPathPrefix() {
    const entryPoint = this.config.scraperConfig?.entryPoints?.[0] || '';
    const match = entryPoint.match(/^(\/[^/]+)/);
    return match ? match[1] : '';
  }

  /**
   * Parse LookNBook date format (e.g., "Thu, 15-Jan-26")
   */
  parseLookNBookDate(dateStr) {
    try {
      // Remove day name prefix if present
      const cleaned = dateStr.replace(/^[A-Za-z]+,\s*/, '');

      // Parse "15-Jan-26" format
      const match = cleaned.match(/(\d{1,2})-([A-Za-z]+)-(\d{2,4})/);
      if (!match) return null;

      const day = parseInt(match[1], 10);
      const monthStr = match[2];
      const yearStr = match[3];

      const months = {
        'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
        'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
      };

      const month = months[monthStr];
      if (month === undefined) return null;

      // Handle 2-digit years
      let year = parseInt(yearStr, 10);
      if (year < 100) {
        year += year > 50 ? 1900 : 2000;
      }

      const date = new Date(year, month, day);
      return date.toISOString().split('T')[0];
    } catch (error) {
      return null;
    }
  }

  /**
   * Extract schedule information from container
   */
  extractSchedule($, $container) {
    const result = {
      startTime: null,
      endTime: null,
      dayOfWeek: [],
      scheduleText: null
    };

    try {
      // Find table rows with schedule data
      const $table = $container.find('table');
      if ($table.length === 0) {
        // Try to find schedule in text
        const text = $container.text();
        const timeMatch = text.match(/(\d{1,2}:\d{2}\s*(?:AM|PM))\s*(?:-|to)\s*(\d{1,2}:\d{2}\s*(?:AM|PM))/i);
        if (timeMatch) {
          result.startTime = this.normalizeTime(timeMatch[1]);
          result.endTime = this.normalizeTime(timeMatch[2]);
        }
        return result;
      }

      // Parse table for schedule info
      $table.find('tr').each((i, row) => {
        const cells = $(row).find('td');
        if (cells.length >= 3) {
          const day = $(cells[0]).text().trim();
          const start = $(cells[1]).text().trim();
          const end = $(cells[2]).text().trim();

          if (day && !result.dayOfWeek.includes(day)) {
            result.dayOfWeek.push(day);
          }
          if (start && !result.startTime) {
            result.startTime = this.normalizeTime(start);
          }
          if (end && !result.endTime) {
            result.endTime = this.normalizeTime(end);
          }
        }
      });

      if (result.dayOfWeek.length > 0 && result.startTime) {
        result.scheduleText = `${result.dayOfWeek.join(', ')} ${result.startTime}${result.endTime ? ' - ' + result.endTime : ''}`;
      }
    } catch (error) {
      // Return default
    }

    return result;
  }

  /**
   * Extract location information
   */
  extractLocation($, $container) {
    const result = {
      locationName: null,
      fullAddress: null
    };

    try {
      // Look for location in table
      const $table = $container.find('table');
      $table.find('tr').each((i, row) => {
        const cells = $(row).find('td');
        // Location is typically in columns 4-5 (after Day, Start, End, Instructor)
        if (cells.length >= 5) {
          const location = $(cells[4]).text().trim();
          const venue = cells.length > 5 ? $(cells[5]).text().trim() : null;

          if (location && !result.locationName) {
            result.locationName = venue ? `${venue} - ${location}` : location;
          }
        }
      });

      // Also check for Google Maps links
      const $mapLink = $container.find('a[href*="google.com/maps"]');
      if ($mapLink.length > 0) {
        const linkTitle = $mapLink.attr('title') || '';
        const viewMatch = linkTitle.match(/View\s+(.+?)\s+on map/i);
        if (viewMatch && !result.locationName) {
          result.locationName = viewMatch[1];
        }
      }
    } catch (error) {
      // Return default
    }

    return result;
  }

  /**
   * Normalize time to standard format
   */
  normalizeTime(timeStr) {
    if (!timeStr) return null;

    // Clean up the time string
    const cleaned = timeStr.trim().toUpperCase();

    // Already in good format
    if (/^\d{1,2}:\d{2}\s*(AM|PM)$/i.test(cleaned)) {
      return cleaned.toLowerCase();
    }

    // Try to parse
    const match = cleaned.match(/(\d{1,2}):?(\d{2})?\s*(AM|PM)?/i);
    if (!match) return timeStr.toLowerCase();

    let hour = parseInt(match[1], 10);
    const minute = match[2] || '00';
    const period = match[3] || (hour < 12 ? 'AM' : 'PM');

    return `${hour}:${minute} ${period.toLowerCase()}`;
  }

  /**
   * Extract age range from activity title
   */
  extractAgeFromTitle(title) {
    const result = { ageMin: null, ageMax: null };

    // Pattern: "X-Y yrs" or "X-Y years" or "(Xyr-Yyr)" or "(XY-XY)"
    const patterns = [
      /(\d+)\s*-\s*(\d+)\s*(?:yrs?|years?)/i,
      /\((\d+)\s*[yY](?:r|rs|ears?)?\s*-\s*(\d+)\s*[yY](?:r|rs|ears?)?\)/,
      /ages?\s*(\d+)\s*-\s*(\d+)/i,
      /(\d+)\s*(?:yrs?|years?)\s*(?:and\s+(?:up|older|\+))/i,
      /(\d+)\+\s*(?:yrs?|years?)/i,
    ];

    for (const pattern of patterns) {
      const match = title.match(pattern);
      if (match) {
        result.ageMin = parseInt(match[1], 10);
        result.ageMax = match[2] ? parseInt(match[2], 10) : 99;
        break;
      }
    }

    // Check for specific age group keywords
    if (!result.ageMin) {
      if (/toddler|infant/i.test(title)) {
        result.ageMin = 0;
        result.ageMax = 3;
      } else if (/preschool/i.test(title)) {
        result.ageMin = 3;
        result.ageMax = 5;
      } else if (/youth|teen/i.test(title)) {
        result.ageMin = 12;
        result.ageMax = 17;
      } else if (/adult|55\+|senior/i.test(title)) {
        result.ageMin = 18;
        result.ageMax = 99;
      }
    }

    return result;
  }

  /**
   * Check if activity is likely for kids based on title
   */
  isLikelyKidsActivity(title) {
    const kidsPatterns = [
      /\d+-\d+\s*(?:yrs?|years?)/i,
      /toddler|infant|baby|preschool/i,
      /kids?|child(?:ren)?|youth|teen|junior/i,
      /camp/i,
      /family|parent.*child|mom.*tot|dad.*tot/i,
      /learn\s*to\s*(?:skate|swim|ski)/i,
    ];

    const adultPatterns = [
      /^adult\s+/i,
      /55\+|seniors?(?:\s|$)/i,
      /18\+|19\+|21\+/i,
      /adult\s+only/i,
    ];

    // Check if explicitly adult
    for (const pattern of adultPatterns) {
      if (pattern.test(title)) {
        return false;
      }
    }

    // Check if explicitly for kids
    for (const pattern of kidsPatterns) {
      if (pattern.test(title)) {
        return true;
      }
    }

    // Default: include it (might be all-ages)
    return true;
  }

  /**
   * Categorize activity based on title
   */
  categorizeActivity(title) {
    const lowerTitle = title.toLowerCase();

    if (/swim|aqua|pool|diving/i.test(lowerTitle)) return 'Swimming & Aquatics';
    if (/hockey|skating|skate|arena/i.test(lowerTitle)) return 'Hockey & Skating';
    if (/soccer|basketball|volleyball|badminton|tennis|sports?/i.test(lowerTitle)) return 'Team Sports';
    if (/dance|ballet|jazz|hip\s*hop/i.test(lowerTitle)) return 'Dance';
    if (/art|painting|drawing|craft|pottery/i.test(lowerTitle)) return 'Arts & Crafts';
    if (/music|piano|guitar|drum|singing/i.test(lowerTitle)) return 'Music';
    if (/yoga|fitness|gym|workout|exercise/i.test(lowerTitle)) return 'Fitness & Wellness';
    if (/camp/i.test(lowerTitle)) return 'Camps';
    if (/ski|snowboard/i.test(lowerTitle)) return 'Winter Sports';
    if (/martial|karate|taekwondo|judo/i.test(lowerTitle)) return 'Martial Arts';

    return 'General Programs';
  }

  /**
   * Normalize activities to match expected schema
   */
  async normalizeActivities(activities) {
    return activities.map(activity => ({
      ...activity,
      provider: this.config.name,
      providerCode: this.config.code,
      platform: this.platformName,
    }));
  }

  /**
   * Get or create provider in database
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
          platform: this.platformName,
          region: this.config.region || 'Canada',
          isActive: true,
          scraperConfig: this.config.scraperConfig
        }
      });
      this.logProgress(`Created new provider: ${name}`);
    }

    return provider;
  }
}

module.exports = LookNBookScraper;
