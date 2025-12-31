const BaseScraper = require('../base/BaseScraper');
const DataNormalizer = require('../base/DataNormalizer');
const KidsActivityFilter = require('../utils/KidsActivityFilter');
const puppeteer = require('puppeteer');

/**
 * Platform scraper for Calgary's REGPROG recreation system
 * URL: liveandplay.calgary.ca/REGPROG
 *
 * Calgary-specific characteristics:
 * - Server-rendered pages with form-based search
 * - Courses page at /public/category/courses
 * - Must click "Search" button to load results
 * - Results displayed in table format
 */
class REGPROGScraper extends BaseScraper {
  constructor(config) {
    super(config);
    this.platformName = 'REGPROG';
    this.extension = null;
    this.CONCURRENCY = 5; // Number of parallel course type requests
  }

  /**
   * Run tasks in batches with proper page allocation
   * Each batch of N tasks runs concurrently, each with its own page
   */
  async runInBatches(items, pagePool, processItem) {
    const results = [];
    const batchSize = pagePool.length;

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchPromises = batch.map((item, idx) => {
        const page = pagePool[idx];
        return processItem(page, item).then(
          result => ({ success: true, result }),
          error => ({ success: false, error })
        );
      });
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Progress update every 5 batches (25 course types)
      if ((i / batchSize + 1) % 5 === 0) {
        const processed = Math.min(i + batchSize, items.length);
        const pct = (processed / items.length * 100).toFixed(0);
        this.logProgress(`    Progress: ${processed}/${items.length} (${pct}%)`);
      }
    }

    return results;
  }

  /**
   * Create a new browser page with standard settings
   */
  async createPage(browser) {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1920, height: 1080 });
    page.setDefaultTimeout(60000);
    page.setDefaultNavigationTimeout(60000);
    return page;
  }

  /**
   * Main scrape method
   */
  async scrape() {
    const startTime = Date.now();
    this.logProgress(`Starting REGPROG scraper`);

    try {
      this.validateConfig();
      const provider = await this.getOrCreateProvider();

      // Extract activities via search
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
   * Extract activities from Calgary
   * Iterates through each month AND course type to bypass pagination limits
   * Uses parallel processing for course types to improve speed
   */
  async extractActivities() {
    const allActivities = [];
    let browser;

    try {
      browser = await puppeteer.launch({
        headless: this.config.scraperConfig.headless !== false,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
      });

      // Create page pool for parallel processing
      const pagePool = [];
      for (let i = 0; i < this.CONCURRENCY; i++) {
        pagePool.push(await this.createPage(browser));
      }
      this.logProgress(`Created ${this.CONCURRENCY} parallel browser pages`);

      const coursesUrl = `${this.config.baseUrl}/public/category/courses`;
      const months = ['January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December'];

      // Get all available course types (using first page from pool)
      const courseTypes = await this.getCourseTypes(pagePool[0], coursesUrl);
      this.logProgress(`Found ${courseTypes.length} course types (using ${this.CONCURRENCY} parallel workers)`);
      this.logProgress(`Scraping Calgary courses by month and course type...`);

      const startTime = Date.now();
      let totalProcessed = 0;

      // Iterate through each month
      for (let i = 0; i < months.length; i++) {
        const month = months[i];
        const monthStart = Date.now();

        try {
          // First try without course type filter (using first page from pool)
          const { activities: monthActivities, hitLimit } = await this.extractActivitiesForMonthWithLimit(
            pagePool[0], coursesUrl, month, null
          );
          allActivities.push(...monthActivities);
          totalProcessed += monthActivities.length;

          // Split by course type for any month that hits the pagination limit
          if (hitLimit && courseTypes.length > 0) {
            this.logProgress(`  ${month} hit limit, splitting by ${courseTypes.length} course types (${this.CONCURRENCY}x parallel)...`);

            // Run course types in batches with proper page allocation
            const results = await this.runInBatches(
              courseTypes,
              pagePool,
              async (page, courseType) => {
                return this.extractActivitiesForMonthWithLimit(
                  page, coursesUrl, month, courseType
                );
              }
            );

            let courseTypeCount = 0;
            let courseTypeActivities = 0;

            for (const result of results) {
              if (result.success && result.result.activities) {
                allActivities.push(...result.result.activities);
                courseTypeActivities += result.result.activities.length;
                courseTypeCount++;
              }
            }

            totalProcessed += courseTypeActivities;
            this.logProgress(`  ${month} course types done: +${courseTypeActivities} activities from ${courseTypeCount} types`);
          }

          // Elapsed time and estimate
          const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
          const monthTime = ((Date.now() - monthStart) / 1000).toFixed(0);
          this.logProgress(`[${i + 1}/12] ${month} complete in ${monthTime}s | Total: ${totalProcessed} activities | Elapsed: ${elapsed}min`);

        } catch (e) {
          this.logProgress(`  ${month}: Error - ${e.message}`);
        }
      }

      // Close all pages
      for (const page of pagePool) {
        await page.close();
      }

      // Deduplicate
      const seen = new Set();
      const unique = allActivities.filter(a => {
        const key = a.courseId || a.externalId || `${a.name}-${a.startDateText}`;
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
   * Get all available course types from the search form
   */
  async getCourseTypes(page, coursesUrl) {
    try {
      await page.goto(coursesUrl, { waitUntil: 'networkidle2', timeout: 60000 });
      await new Promise(resolve => setTimeout(resolve, 2000));

      return await page.evaluate(() => {
        const courseTypes = [];
        const select = document.querySelector('select[name="CourseTypes"]');
        if (select) {
          for (const opt of select.options) {
            if (opt.value && opt.value.length > 10) { // Valid GUIDs are long
              courseTypes.push({ value: opt.value, text: opt.text });
            }
          }
        }
        return courseTypes;
      });
    } catch (e) {
      return [];
    }
  }

  /**
   * Extract activities for a specific month (and optionally course type)
   * Returns both the activities and whether we hit the pagination limit
   */
  async extractActivitiesForMonthWithLimit(page, coursesUrl, month, courseType) {
    const activities = [];
    const PAGE_LIMIT = 25; // Calgary's pagination limit

    await page.goto(coursesUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    // Wait for page to fully load
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Wait for the form to be available
    try {
      await page.waitForSelector('#searchForm', { timeout: 10000 });
    } catch (e) {
      return { activities: [], hitLimit: false };
    }

    // Select the month and optionally course type, then search
    const searchSubmitted = await page.evaluate((targetMonth, targetCourseType) => {
      const form = document.getElementById('searchForm');
      if (!form) return false;

      // Select the month
      const monthSelect = form.querySelector('select[name="StartMonth"]');
      if (monthSelect) {
        for (const opt of monthSelect.options) {
          if (opt.text === targetMonth) {
            opt.selected = true;
            break;
          }
        }
      }

      // Select course type if provided
      if (targetCourseType) {
        const courseSelect = form.querySelector('select[name="CourseTypes"]');
        if (courseSelect) {
          for (const opt of courseSelect.options) {
            if (opt.value === targetCourseType.value) {
              opt.selected = true;
              break;
            }
          }
        }
      }

      // Click search
      const submitBtn = form.querySelector('input[type="submit"]');
      if (submitBtn) {
        submitBtn.click();
        return true;
      }
      return false;
    }, month, courseType);

    if (!searchSubmitted) {
      return { activities, hitLimit: false };
    }

    await new Promise(resolve => setTimeout(resolve, 5000));
    try {
      await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 });
    } catch (e) {
      // May already have navigated
    }
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Extract all pages
    let pageNum = 1;
    let hasMorePages = true;
    let monthTotal = 0;

    while (hasMorePages) {
      try {
        const pageActivities = await this.extractResultsFromPage(page);

        if (pageActivities.length === 0 && pageNum === 1) {
          break;
        }

        // Tag activities
        pageActivities.forEach(a => {
          a.sourceMonth = month;
          if (courseType) a.sourceCourseType = courseType.text;
        });

        activities.push(...pageActivities);
        monthTotal += pageActivities.length;

        // Try to go to next page
        hasMorePages = await this.goToNextPage(page, pageNum);
        if (hasMorePages) {
          pageNum++;
        }
      } catch (e) {
        if (e.message && e.message.includes('detached')) {
          break;
        }
        break;
      }
    }

    const hitLimit = pageNum >= PAGE_LIMIT;
    const label = courseType ? `${month}/${courseType.text.substring(0, 20)}` : month;

    if (monthTotal > 0) {
      this.logProgress(`  ${label}: ${monthTotal} activities (${pageNum} pages)${hitLimit ? ' [LIMIT]' : ''}`);
    }

    return { activities, hitLimit };
  }

  /**
   * Select kids age filter if available
   */
  async selectKidsAgeFilter(page) {
    try {
      return await page.evaluate(() => {
        // Look for age dropdown or checkboxes
        const ageSelects = document.querySelectorAll('select[name*="age" i], select[id*="age" i], #AgeFilter');
        for (const select of ageSelects) {
          const options = select.querySelectorAll('option');
          for (const opt of options) {
            const text = opt.textContent.toLowerCase();
            // Select kids-related options
            if (/child|youth|teen|junior|preschool|0-|1-|2-|3-|4-|5-|6-|7-|8-|9-|10-|11-|12-|13-|14-|15-|16-|17-/.test(text)) {
              select.value = opt.value;
              select.dispatchEvent(new Event('change', { bubbles: true }));
              return true;
            }
          }
        }

        // Look for age checkboxes
        const ageCheckboxes = document.querySelectorAll('input[type="checkbox"][name*="age" i], input[type="checkbox"][id*="age" i]');
        for (const cb of ageCheckboxes) {
          const label = cb.closest('label')?.textContent || document.querySelector(`label[for="${cb.id}"]`)?.textContent || '';
          if (/child|youth|teen|junior|preschool/i.test(label)) {
            cb.checked = true;
            cb.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
          }
        }

        return false;
      });
    } catch (e) {
      return false;
    }
  }

  /**
   * Extract activities from current page results
   * Calgary uses card-based layout with badge elements
   */
  async extractResultsFromPage(page) {
    return page.evaluate(() => {
      const activities = [];

      // Each course is in a div.card.mb-4
      const cards = document.querySelectorAll('div.card.mb-4');

      cards.forEach((card, index) => {
        try {
          // Get course name from .card-title
          const titleEl = card.querySelector('h4.card-title, .card-title');
          const name = titleEl?.textContent?.trim();
          if (!name || name.length < 3) return;

          // Get course ID from .d-id .badge-value
          const courseId = card.querySelector('.d-id .badge-value')?.textContent?.trim();
          // Skip cards without course IDs (like the search form card)
          if (!courseId) return;

          // Get price from .d-price .badge-value
          const priceText = card.querySelector('.d-price .badge-value')?.textContent?.trim();
          const price = priceText ? priceText.replace('$', '').replace(',', '') : null;

          // Get spots from .d-spaces .badge-value
          const spotsText = card.querySelector('.d-spaces .badge-value')?.textContent?.trim();
          const spotsAvailable = spotsText ? parseInt(spotsText) : null;

          // Get dates from .d-start and .d-end
          const startDateText = card.querySelector('.d-start .badge-value')?.textContent?.trim();
          const endDateText = card.querySelector('.d-end .badge-value')?.textContent?.trim();

          // Get schedule from table
          const scheduleRows = card.querySelectorAll('table tbody tr');
          let dayOfWeek = null;
          let startTime = null;
          let endTime = null;
          let locationName = null;
          let venue = null;

          if (scheduleRows.length > 0) {
            const firstRow = scheduleRows[0];
            const cells = firstRow.querySelectorAll('td');
            if (cells.length >= 3) {
              dayOfWeek = cells[0]?.textContent?.trim();
              startTime = cells[1]?.textContent?.trim();
              endTime = cells[2]?.textContent?.trim();

              // Location is in .d-location cell (4th column)
              const locationCell = firstRow.querySelector('td.d-location');
              if (locationCell) {
                // Remove the map link button text
                locationName = locationCell.textContent?.replace(/View.*on map/gi, '').trim();
              }

              // Venue is in .d-venue cell (5th column)
              const venueCell = firstRow.querySelector('td.d-venue');
              if (venueCell) {
                venue = venueCell.textContent?.replace(/View.*on map/gi, '').trim();
              }
            }
          }

          // Get age from data-class-description attribute (contains "Age: X+" or "Age: X-Y")
          const infoBtn = card.querySelector('[data-class-description]');
          const rawDescription = infoBtn?.getAttribute('data-class-description') || '';
          // Strip HTML for cleaner text
          const description = rawDescription.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

          let ageMin = null;
          let ageMax = null;

          // Try multiple patterns for age extraction
          // Pattern 1: Age in name like "(6 - 8 years)" or "(3-5)"
          const nameAgeMatch = name.match(/\((\d+)\s*[-–]\s*(\d+)(?:\s*(?:years?|yrs?|ans))?\)/i);
          // Pattern 2: Age in description like "Age: 6 - 12" or "Age: 6-12"
          const descAgeRangeMatch = description.match(/Age:\s*(\d+)\s*[-–to]+\s*(\d+)/i);
          // Pattern 3: Age in description like "Age: 13+"
          const descAgePlusMatch = description.match(/Age:\s*(\d+)\s*\+/i);
          // Pattern 4: Single age like "Age: 18"
          const descAgeSingleMatch = description.match(/Age:\s*(\d+)(?!\d)/i);

          if (nameAgeMatch) {
            ageMin = parseInt(nameAgeMatch[1]);
            ageMax = parseInt(nameAgeMatch[2]);
          } else if (descAgeRangeMatch) {
            ageMin = parseInt(descAgeRangeMatch[1]);
            ageMax = parseInt(descAgeRangeMatch[2]);
          } else if (descAgePlusMatch) {
            ageMin = parseInt(descAgePlusMatch[1]);
            ageMax = 99; // X+ means X and up
          } else if (descAgeSingleMatch) {
            ageMin = parseInt(descAgeSingleMatch[1]);
            ageMax = 99;
          }

          // Get registration URL
          const bookLink = card.querySelector('a[href*="CourseDetails"]');
          const registrationUrl = bookLink?.href || null;

          // Stable fallback: use name + location hash instead of index + Date.now()
          const stableId = courseId
            ? `calgary-${courseId}`
            : `calgary-${name.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 20)}`;

          activities.push({
            name: name.replace(/\s+/g, ' ').trim(),
            externalId: stableId,
            courseId,
            price,
            startDateText,
            endDateText,
            dayOfWeek,
            startTime,
            endTime,
            locationName: locationName || venue,
            venue,
            spotsAvailable,
            ageMin,
            ageMax,
            description: description.substring(0, 500),
            registrationUrl
          });
        } catch (e) {
          console.error('Error extracting card:', e);
        }
      });

      return activities;
    });
  }

  /**
   * Try alternative selectors for activities
   */
  async extractFromAlternativeSelectors(page) {
    return page.evaluate(() => {
      const activities = [];

      // Look for card-style listings
      const cards = document.querySelectorAll('.course-card, .activity-card, .program-card, [class*="course-item"], [class*="program-item"]');

      cards.forEach((card, index) => {
        const text = card.innerText || '';
        if (text.length < 20) return;

        // Extract name from heading
        let name = null;
        const heading = card.querySelector('h3, h4, h5, .title, .name, strong');
        if (heading) {
          name = heading.textContent?.trim();
        }
        if (!name) {
          const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 3);
          name = lines.find(l => l.length > 5 && l.length < 150 && !l.match(/^\$/));
        }

        if (!name || name.length < 3) return;

        // Extract other fields
        const priceMatch = text.match(/\$\s*([\d,]+(?:\.\d{2})?)/);
        const dateMatch = text.match(/(\w{3}\s+\d{1,2},?\s*\d{4}|\d{1,2}[-\/]\w{3}[-\/]\d{2,4})/);
        const timeMatch = text.match(/(\d{1,2}:\d{2}\s*(?:AM|PM)?)\s*[-–to]+\s*(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i);
        const ageMatch = text.match(/(\d+)\s*[-–to]+\s*(\d+)\s*(?:yrs?|years?)/i);
        const idMatch = text.match(/(?:Course\s*#?|ID:?)\s*(\d{5,})/i) || text.match(/\b(\d{6,})\b/);

        const link = card.querySelector('a')?.href;

        // Stable fallback: use name hash instead of index + Date.now()
        const cleanName = name.replace(/\((\d+)\s*[-–]\s*(\d+)[^)]*\)/g, '').trim();
        const fallbackId = `calgary-${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 20)}`;

        activities.push({
          name: cleanName,
          externalId: idMatch ? `calgary-${idMatch[1]}` : fallbackId,
          courseId: idMatch?.[1] || null,
          price: priceMatch ? priceMatch[1].replace(',', '') : null,
          dateText: dateMatch?.[0] || null,
          timeText: timeMatch ? `${timeMatch[1]} - ${timeMatch[2]}` : null,
          ageMin: ageMatch ? parseInt(ageMatch[1]) : null,
          ageMax: ageMatch ? parseInt(ageMatch[2]) : null,
          registrationUrl: link
        });
      });

      return activities;
    });
  }

  /**
   * Go to next page of results
   * Calgary uses numbered pagination links like 1, 2, 3, 4, 5
   */
  async goToNextPage(page, currentPageNum) {
    try {
      const nextClicked = await page.evaluate((targetPage) => {
        // Calgary has pagination links with page numbers
        const paginationLinks = document.querySelectorAll('a[href*="page="], .pagination a, nav a');

        for (const link of paginationLinks) {
          const text = link.textContent?.trim();
          // Look for the next page number
          if (text === String(targetPage)) {
            link.click();
            return true;
          }
        }

        // Also try finding "Next" style links
        for (const link of paginationLinks) {
          const text = (link.textContent || '').toLowerCase().trim();
          if (text === 'next' || text === '>' || text === '»') {
            link.click();
            return true;
          }
        }

        return false;
      }, currentPageNum + 1);

      if (nextClicked) {
        // Wait for page to load
        await new Promise(resolve => setTimeout(resolve, 3000));
        try {
          await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 });
        } catch (e) {
          // May already have loaded
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      return nextClicked;
    } catch (e) {
      return false;
    }
  }

  /**
   * Normalize activities
   */
  async normalizeActivities(activities) {
    const self = this;
    return activities.map(activity => {
      // Parse dates - Calgary uses "Mon, 12-Jan-26" format
      let dateStart = null;
      let dateEnd = null;

      if (activity.startDateText) {
        dateStart = this.parseCalgaryDate(activity.startDateText);
      }
      if (activity.endDateText) {
        dateEnd = this.parseCalgaryDate(activity.endDateText);
      }

      // For single-day events where only startDate exists, set endDate to startDate
      if (dateStart && !dateEnd) {
        dateEnd = dateStart;
      }

      // Parse time - already in "6:00 PM" format
      const startTime = activity.startTime ? this.normalizeTime(activity.startTime) : null;
      const endTime = activity.endTime ? this.normalizeTime(activity.endTime) : null;

      // Parse cost
      const cost = activity.price ? parseFloat(activity.price) : 0;

      // Build day of week array
      const dayOfWeek = activity.dayOfWeek ? [activity.dayOfWeek] : [];

      // Determine registration status
      let registrationStatus = 'Unknown';
      if (activity.spotsAvailable !== null) {
        if (activity.spotsAvailable > 0) {
          registrationStatus = 'Open';
        } else {
          registrationStatus = 'Full';
        }
      }

      return {
        name: activity.name,
        externalId: activity.externalId,
        category: 'Calgary Recreation',
        subcategory: activity.venue || null,
        description: activity.description || null,
        dateStart,
        dateEnd,
        startTime,
        endTime,
        dayOfWeek,
        schedule: activity.dayOfWeek ? `${activity.dayOfWeek} ${activity.startTime} - ${activity.endTime}` : null,
        ageMin: activity.ageMin,
        ageMax: activity.ageMax,
        cost,
        costIncludesTax: false,
        spotsAvailable: activity.spotsAvailable,
        totalSpots: null,
        registrationStatus,
        locationName: activity.locationName || activity.venue || null,
        registrationUrl: activity.registrationUrl || `${self.config.baseUrl}/public/category/courses`,
        rawData: activity
      };
    });
  }

  /**
   * Parse Calgary date format: "Mon, 12-Jan-26" -> Date
   */
  parseCalgaryDate(dateStr) {
    if (!dateStr) return null;

    try {
      // Format: "Mon, 12-Jan-26" or "12-Jan-26"
      const match = dateStr.match(/(\d{1,2})-(\w{3})-(\d{2,4})/);
      if (match) {
        const day = parseInt(match[1]);
        const monthStr = match[2];
        let year = parseInt(match[3]);

        // Handle 2-digit year
        if (year < 100) {
          year = year + 2000;
        }

        const months = {
          'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
          'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
        };

        const month = months[monthStr];
        if (month !== undefined) {
          return new Date(year, month, day);
        }
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Normalize time from "6:00 PM" to "18:00"
   */
  normalizeTime(timeStr) {
    if (!timeStr) return null;

    try {
      const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
      if (match) {
        let hours = parseInt(match[1]);
        const minutes = match[2];
        const period = match[3]?.toUpperCase();

        if (period === 'PM' && hours !== 12) {
          hours += 12;
        } else if (period === 'AM' && hours === 12) {
          hours = 0;
        }

        return `${hours.toString().padStart(2, '0')}:${minutes}`;
      }
      return timeStr;
    } catch (e) {
      return timeStr;
    }
  }

  /**
   * Get or create Calgary provider
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
          platform: 'regprog',
          region: 'Alberta',
          isActive: true,
          scraperConfig: this.config.scraperConfig
        }
      });
      this.logProgress(`Created new provider: ${name}`);
    }

    return provider;
  }
}

module.exports = REGPROGScraper;
