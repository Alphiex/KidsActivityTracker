const BaseScraper = require('../base/BaseScraper');
const DataNormalizer = require('../base/DataNormalizer');
const KidsActivityFilter = require('../utils/KidsActivityFilter');
const puppeteer = require('puppeteer');

/**
 * Platform scraper for Edmonton's COE (City of Edmonton) recreation system
 * URL: movelearnplay.edmonton.ca/COE
 *
 * Edmonton uses the SAME page structure as Calgary REGPROG:
 * - Form #searchForm with submit button
 * - Activities in div.card.mb-4 elements
 * - Badge values: .d-id, .d-price, .d-spaces, .d-start, .d-end
 * - Schedule in table rows
 * - Pagination through numbered links
 * - NOTE: Edmonton does NOT have data-class-description for age (unlike Calgary)
 * - Age data is available on detail pages at /public/booking/CourseDetails/{id}
 */
class COEScraper extends BaseScraper {
  constructor(config) {
    super(config);
    this.platformName = 'COE';
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
        this.logProgress(`      Progress: ${processed}/${items.length} (${pct}%)`);
      }
    }

    return results;
  }

  /**
   * Main scrape method
   */
  async scrape() {
    const startTime = Date.now();
    this.logProgress(`Starting COE scraper`);

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
   * Get all category endpoints to scrape
   * Edmonton has multiple category entry points with different activities
   */
  getCategoryEndpoints() {
    return [
      { name: 'Courses', path: '/public/category/courses', useSearch: true },
      { name: 'Programs', path: '/public/category/browse/PROG', useSearch: true },
      { name: 'Drop-In', path: '/public/category/browse/DROPIN', useSearch: false },
      { name: 'Golf', path: '/public/category/browse/GOLF', useSearch: false },
      { name: 'Zoo Admissions', path: '/public/category/browse/ZOOADMXMAS', useSearch: false },
      { name: 'Muttart', path: '/public/category/browse/MUTTART', useSearch: false },
      { name: 'Outdoor Recreation', path: '/public/category/browse/ODAPDIP', useSearch: false },
      { name: 'Aquatic Day Camps', path: '/public/category/browse/AQUATICPROGDAYCAMP', useSearch: false },
      { name: 'Recreation Memberships', path: '/public/category/browse/RECCENTADD', useSearch: false },
    ];
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
   * Extract activities from Edmonton - all category endpoints
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

      const categories = this.getCategoryEndpoints();
      this.logProgress(`Scraping ${categories.length} category endpoints...`);

      for (const category of categories) {
        try {
          const categoryActivities = await this.extractFromCategory(browser, pagePool, category);
          allActivities.push(...categoryActivities);
          this.logProgress(`  ${category.name}: ${categoryActivities.length} activities`);
        } catch (e) {
          this.logProgress(`  ${category.name}: Error - ${e.message}`);
        }
      }

      // Deduplicate across all categories
      const seen = new Set();
      const unique = allActivities.filter(a => {
        const key = a.courseId || a.externalId || `${a.name}-${a.startDateText}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      this.logProgress(`Total unique activities across all categories: ${unique.length}`);

      // Fetch detail pages to get age data (Edmonton stores age on detail pages)
      this.logProgress('Fetching detail pages for age data...');
      await this.enrichWithDetailPages(unique, pagePool[0]);

      // Close all pages
      for (const page of pagePool) {
        await page.close();
      }

      return unique;

    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  /**
   * Extract activities from a single category endpoint
   * For searchable categories, iterate through each month AND course type to bypass pagination limits
   * Uses parallel processing for course types to improve speed
   */
  async extractFromCategory(browser, pagePool, category) {
    const activities = [];
    const categoryUrl = `${this.config.baseUrl}${category.path}`;

    // For searchable categories, search by month and course type
    if (category.useSearch) {
      // First, get all available course types (using first page from pool)
      const courseTypes = await this.getCourseTypes(pagePool[0], categoryUrl);
      this.logProgress(`  Found ${courseTypes.length} course types (using ${this.CONCURRENCY} parallel workers)`);

      const months = ['January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December'];

      const startTime = Date.now();
      let totalProcessed = 0;

      for (let i = 0; i < months.length; i++) {
        const month = months[i];
        const monthStart = Date.now();

        try {
          // First try without course type filter (using first page from pool)
          const { activities: monthActivities, hitLimit } = await this.extractFromCategoryMonthWithLimit(
            pagePool[0], categoryUrl, category.name, month, null
          );
          activities.push(...monthActivities);
          totalProcessed += monthActivities.length;

          // Split by course type for any month that hits the pagination limit
          if (hitLimit && courseTypes.length > 0) {
            this.logProgress(`    ${month} hit limit, splitting by ${courseTypes.length} course types (${this.CONCURRENCY}x parallel)...`);

            // Run in batches with proper page allocation
            const results = await this.runInBatches(
              courseTypes,
              pagePool,
              async (page, courseType) => {
                return this.extractFromCategoryMonthWithLimit(
                  page, categoryUrl, category.name, month, courseType
                );
              }
            );

            let courseTypeCount = 0;
            let courseTypeActivities = 0;

            for (const result of results) {
              if (result.success && result.result.activities) {
                activities.push(...result.result.activities);
                courseTypeActivities += result.result.activities.length;
                courseTypeCount++;
              }
            }

            totalProcessed += courseTypeActivities;
            this.logProgress(`    ${month} course types done: +${courseTypeActivities} activities from ${courseTypeCount} types`);
          }

          // Elapsed time and estimate
          const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
          const monthTime = ((Date.now() - monthStart) / 1000).toFixed(0);
          this.logProgress(`  [${i + 1}/12] ${month} complete in ${monthTime}s | Total: ${totalProcessed} activities | Elapsed: ${elapsed}min`);

        } catch (e) {
          this.logProgress(`    ${month}: Error - ${e.message}`);
        }
      }
    } else {
      // Non-searchable categories - just browse directly (using first page from pool)
      const browseActivities = await this.extractFromCategoryBrowse(pagePool[0], categoryUrl, category.name);
      activities.push(...browseActivities);
    }

    return activities;
  }

  /**
   * Get all available course types from the search form
   */
  async getCourseTypes(page, categoryUrl) {
    try {
      await page.goto(categoryUrl, { waitUntil: 'networkidle2', timeout: 60000 });
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
   * Extract activities from a category for a specific month (and optionally course type)
   * Returns both the activities and whether we hit the pagination limit
   */
  async extractFromCategoryMonthWithLimit(page, categoryUrl, categoryName, month, courseType) {
    const activities = [];
    const PAGE_LIMIT = 20; // Edmonton's pagination limit

    await page.goto(categoryUrl, {
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
          a.sourceCategory = categoryName;
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
      this.logProgress(`    ${label}: ${monthTotal} activities (${pageNum} pages)${hitLimit ? ' [LIMIT]' : ''}`);
    }

    return { activities, hitLimit };
  }

  /**
   * Extract activities from a non-searchable category (browse mode)
   */
  async extractFromCategoryBrowse(page, categoryUrl, categoryName) {
    const activities = [];

    await page.goto(categoryUrl, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Try waiting for results
    try {
      await page.waitForSelector('#results, div.card.mb-4', { timeout: 15000 });
    } catch (e) {
      // Continue anyway
    }

    // Extract activities with pagination
    let pageNum = 1;
    let hasMorePages = true;

    while (hasMorePages) {
      try {
        const pageActivities = await this.extractResultsFromPage(page);

        if (pageActivities.length === 0 && pageNum === 1) {
          break;
        }

        // Tag activities
        pageActivities.forEach(a => {
          a.sourceCategory = categoryName;
        });

        activities.push(...pageActivities);

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

    return activities;
  }

  /**
   * Extract activities from current page results
   * Edmonton uses same card-based layout as Calgary with badge elements
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

              // Location is in .d-location cell
              const locationCell = firstRow.querySelector('td.d-location');
              if (locationCell) {
                locationName = locationCell.textContent?.replace(/View.*on map/gi, '').trim();
              }

              // Venue is in .d-venue cell
              const venueCell = firstRow.querySelector('td.d-venue');
              if (venueCell) {
                venue = venueCell.textContent?.replace(/View.*on map/gi, '').trim();
              }
            }
          }

          // Edmonton doesn't have data-class-description like Calgary
          // Extract age from activity name patterns
          let ageMin = null;
          let ageMax = null;

          // Pattern 1: "(6 - 8 years)" or "(3-5)" or "(6-12 yrs)"
          const nameAgeMatch = name.match(/\((\d+)\s*[-–]\s*(\d+)(?:\s*(?:years?|yrs?|ans))?\)/i);
          // Pattern 2: "Ages 6-12" in name
          const agesMatch = name.match(/Ages?\s*(\d+)\s*[-–to]+\s*(\d+)/i);
          // Pattern 3: "6+ years" or "12+"
          const agePlusMatch = name.match(/(\d+)\s*\+\s*(?:years?|yrs?)?/i);
          // Pattern 4: "Preschool" typically means 3-5
          const preschoolMatch = name.match(/preschool/i);
          // Pattern 5: "Toddler" typically means 1-3
          const toddlerMatch = name.match(/toddler/i);
          // Pattern 6: "Youth" typically means 10-17
          const youthMatch = name.match(/youth/i);
          // Pattern 7: "Teen" typically means 13-17
          const teenMatch = name.match(/teen/i);

          if (nameAgeMatch) {
            ageMin = parseInt(nameAgeMatch[1]);
            ageMax = parseInt(nameAgeMatch[2]);
          } else if (agesMatch) {
            ageMin = parseInt(agesMatch[1]);
            ageMax = parseInt(agesMatch[2]);
          } else if (agePlusMatch) {
            ageMin = parseInt(agePlusMatch[1]);
            ageMax = 99;
          } else if (preschoolMatch) {
            ageMin = 3;
            ageMax = 5;
          } else if (toddlerMatch) {
            ageMin = 1;
            ageMax = 3;
          } else if (teenMatch) {
            ageMin = 13;
            ageMax = 17;
          } else if (youthMatch) {
            ageMin = 10;
            ageMax = 17;
          }

          // Get registration URL
          const bookLink = card.querySelector('a[href*="CourseDetails"]');
          const registrationUrl = bookLink?.href || null;

          // Get description from card body if available
          const descEl = card.querySelector('.card-text, .description');
          const description = descEl?.textContent?.trim() || null;

          activities.push({
            name: name.replace(/\s+/g, ' ').trim(),
            externalId: courseId ? `edmonton-${courseId}` : `edmonton-${index}-${Date.now()}`,
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
            description,
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
   * Go to next page of results
   * Edmonton uses numbered pagination links like Calgary
   */
  async goToNextPage(page, currentPageNum) {
    try {
      const nextClicked = await page.evaluate((targetPage) => {
        // Look for pagination links with page numbers
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
   * Fetch detail pages to enrich activities with age and description
   * Edmonton stores age info on /public/booking/CourseDetails/{id}
   */
  async enrichWithDetailPages(activities, page) {
    // Fetch detail pages for ALL activities with courseId to get descriptions
    const activitiesToEnrich = activities.filter(a => a.courseId);

    if (activitiesToEnrich.length === 0) {
      this.logProgress('  No activities to enrich');
      return;
    }

    this.logProgress(`  Fetching ${activitiesToEnrich.length} detail pages...`);

    let processed = 0;
    let enriched = 0;
    const batchSize = 10; // Increased batch size since we're using direct fetch

    // Process in batches to avoid overwhelming the server
    for (let i = 0; i < activitiesToEnrich.length; i += batchSize) {
      const batch = activitiesToEnrich.slice(i, i + batchSize);

      await Promise.all(batch.map(async (activity) => {
        try {
          const detailUrl = `${this.config.baseUrl}/public/booking/CourseDetails/${activity.courseId}`;

          // Use Node's native fetch for more reliable requests
          const response = await fetch(detailUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            }
          }).then(res => res.ok ? res.text() : null).catch(() => null);

          if (response) {
            let wasEnriched = false;
            const cleanHtml = response.replace(/\s+/g, ' ');

            // Extract age from the HTML (only if not already set from name)
            // Pattern: Ages</label></td>....<td>....X - Y
            if (activity.ageMin === null) {
              const ageMatch = cleanHtml.match(/Ages<\/label><\/td>\s*<td>\s*(\d+)\s*[-–]\s*(\d+)/i);
              if (ageMatch) {
                activity.ageMin = parseInt(ageMatch[1]);
                activity.ageMax = parseInt(ageMatch[2]);
                wasEnriched = true;
              }
            }

            // Extract Course Type as description (e.g., "Junior Zookeeper Winter Camp (Ages 8-10)")
            // The text is after the </a> tag and before </td>
            if (!activity.description) {
              const courseTypeMatch = cleanHtml.match(/Course Type<\/label><\/td>\s*<td>.*?<\/a>\s*([^<]+)\s*<\/td>/i);
              if (courseTypeMatch) {
                const courseType = courseTypeMatch[1].trim();
                if (courseType && courseType.length > 3) {
                  activity.description = courseType;
                  wasEnriched = true;
                }
              }
            }

            // Also try to get description from Prerequisites
            if (!activity.description) {
              const prereqMatch = response.match(/<strong>Prerequisites:\s*<\/strong>\s*([^<]+)/i);
              if (prereqMatch) {
                activity.description = prereqMatch[1].trim().substring(0, 500);
                wasEnriched = true;
              }
            }

            if (wasEnriched) enriched++;
          }

          processed++;
        } catch (e) {
          // Ignore errors for individual detail pages
        }
      }));

      // Small delay between batches to be respectful to the server
      if (i + batchSize < activitiesToEnrich.length) {
        await new Promise(r => setTimeout(r, 300));
      }

      if ((i + batchSize) % 50 === 0 || i + batchSize >= activitiesToEnrich.length) {
        this.logProgress(`    Processed ${Math.min(i + batchSize, activitiesToEnrich.length)}/${activitiesToEnrich.length} detail pages (${enriched} enriched)`);
      }
    }

    this.logProgress(`  Enriched ${enriched}/${activitiesToEnrich.length} activities with additional data`);
  }

  /**
   * Normalize activities
   */
  async normalizeActivities(activities) {
    const self = this;
    return activities.map(activity => {
      // Parse dates - Edmonton uses same "Mon, 12-Jan-26" format as Calgary
      let dateStart = null;
      let dateEnd = null;

      if (activity.startDateText) {
        dateStart = this.parseEdmontonDate(activity.startDateText);
      }
      if (activity.endDateText) {
        dateEnd = this.parseEdmontonDate(activity.endDateText);
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
        category: 'Edmonton Recreation',
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
   * Parse Edmonton date format: "Mon, 12-Jan-26" -> Date
   */
  parseEdmontonDate(dateStr) {
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
   * Get or create Edmonton provider
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
          platform: 'coe',
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

module.exports = COEScraper;
