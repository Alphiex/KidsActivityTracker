const BaseScraper = require('../base/BaseScraper');
const DataNormalizer = require('../base/DataNormalizer');
const puppeteer = require('puppeteer');

/**
 * Platform scraper for Intelligenz Solutions-based recreation websites
 * Handles form-based search and category navigation patterns
 * Used by: Pitt Meadows (pittfitandfun.ca)
 */
class IntelligenzScraper extends BaseScraper {
  constructor(config) {
    super(config);
    this.platformName = 'Intelligenz Solutions';
  }

  /**
   * Main scraping method for Intelligenz platforms
   * @returns {Promise<{activities: Array, stats: Object, report: String}>}
   */
  async scrape() {
    const startTime = Date.now();
    this.logProgress('Starting Intelligenz Solutions scraper');

    try {
      // Validate configuration
      this.validateConfig();
      this.validateIntelligenzConfig();

      // Get provider record
      const provider = await this.getOrCreateProvider();

      // Extract activities using Intelligenz-specific methods
      const rawActivities = await this.extractIntelligenzActivities();

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
   * @param {Array} activities - Activities to filter
   * @returns {Array} Filtered activities
   */
  filterByAge(activities) {
    const { ageFilter } = this.config.scraperConfig;

    if (!ageFilter || !ageFilter.enabled) {
      return activities;
    }

    const minAge = ageFilter.minAge || 0;
    const maxAge = ageFilter.maxAge || 18;

    return activities.filter(activity => {
      // If no age info, include it (will be manually reviewed)
      if (activity.ageMin === null && activity.ageMax === null) {
        return true;
      }

      // Check if age range overlaps with target range
      const activityMin = activity.ageMin || 0;
      const activityMax = activity.ageMax || 99;

      // Activity is for kids if its range overlaps with 0-18
      return activityMin <= maxAge && activityMax >= minAge;
    });
  }

  /**
   * Validate Intelligenz-specific configuration
   */
  validateIntelligenzConfig() {
    const scraperConfig = this.config.scraperConfig;

    if (!scraperConfig) {
      throw new Error('scraperConfig is required for Intelligenz scraper');
    }

    if (scraperConfig.type !== 'search') {
      throw new Error('Intelligenz scraper requires scraperConfig.type = "search"');
    }

    if (!scraperConfig.entryPoints || scraperConfig.entryPoints.length === 0) {
      throw new Error('Intelligenz scraper requires scraperConfig.entryPoints');
    }
  }

  /**
   * Extract activities using Intelligenz - supports both category links and form search
   * @returns {Promise<Array>} Raw activity data
   */
  async extractIntelligenzActivities() {
    const activities = [];
    const { entryPoints } = this.config.scraperConfig;
    // Track visited URLs to prevent infinite recursion
    this.visitedUrls = new Set();

    let browser;
    try {
      browser = await puppeteer.launch({
        headless: this.config.scraperConfig.headless !== false,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--window-size=1920,1080'
        ]
      });

      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

      // Build category age mapping from config
      this.categoryAgeMap = {};
      if (this.config.scraperConfig.kidsCategories) {
        for (const cat of this.config.scraperConfig.kidsCategories) {
          this.categoryAgeMap[cat.code.toLowerCase()] = {
            ageMin: cat.ageMin,
            ageMax: cat.ageMax,
            name: cat.name
          };
        }
      }

      // Process each entry point (supports multiple category URLs)
      for (const entryPoint of entryPoints) {
        const searchUrl = `${this.config.baseUrl}${entryPoint}`;

        // Skip if already visited
        if (this.visitedUrls.has(searchUrl)) {
          this.logProgress(`Skipping already visited: ${searchUrl}`);
          continue;
        }
        this.visitedUrls.add(searchUrl);

        // Extract category code from entry point URL to get age range
        const categoryCode = this.extractCategoryCode(entryPoint);
        const categoryInfo = categoryCode ? this.categoryAgeMap[categoryCode.toLowerCase()] : null;

        this.logProgress(`Starting extraction from: ${searchUrl}${categoryInfo ? ` (${categoryInfo.name})` : ''}`);

        await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 60000 });
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Check if this is an activity listing page or a category page
        const pageType = await this.detectPageType(page);
        this.logProgress(`Page type detected: ${pageType}`);

        if (pageType === 'activity-listing') {
          // Direct activity listing - extract activities with detail page visits
          const entryInfo = { name: entryPoint, ...categoryInfo };
          const pageActivities = await this.extractActivitiesWithDetails(browser, page, entryInfo);
          activities.push(...pageActivities);
        } else if (pageType === 'button-navigation') {
          // Info panel with navigation buttons - discover and follow all links
          this.logProgress('Found button navigation page, discovering all browse links...');
          const subcategories = await this.discoverSubcategories(page);
          this.logProgress(`Found ${subcategories.length} navigation links`);

          for (const subcat of subcategories) {
            if (this.visitedUrls.has(subcat.url)) {
              continue;
            }
            try {
              const subcatCode = this.extractCategoryCode(subcat.url);
              const subcatAgeInfo = subcatCode ? this.categoryAgeMap[subcatCode.toLowerCase()] : null;
              const subcatWithAge = {
                ...subcat,
                ageMin: subcatAgeInfo?.ageMin ?? categoryInfo?.ageMin,
                ageMax: subcatAgeInfo?.ageMax ?? categoryInfo?.ageMax
              };

              this.logProgress(`Processing nav link: ${subcat.name}`);
              const subcatActivities = await this.extractFromSubcategory(browser, subcatWithAge);
              if (subcatActivities.length > 0) {
                this.logProgress(`  Found ${subcatActivities.length} activities in ${subcat.name}`);
                activities.push(...subcatActivities);
              }
            } catch (error) {
              this.handleError(error, `processing nav link ${subcat.name}`);
            }
          }
        } else if (pageType === 'search-form') {
          // Search form page (Lethbridge-style) - need to click Search button first
          this.logProgress('Found search form page, clicking Search button...');
          const searchClicked = await this.clickSearchButton(page);

          if (searchClicked) {
            // Check if we now have CourseDetails links after clicking search
            const newPageType = await this.detectPageType(page);
            this.logProgress(`After search click, page type: ${newPageType}`);

            if (newPageType === 'activity-listing') {
              const entryInfo = { name: entryPoint, ...categoryInfo };
              const pageActivities = await this.extractActivitiesWithDetails(browser, page, entryInfo);
              activities.push(...pageActivities);
            } else {
              // Fallback - try course type dropdown search
              const courseTypes = await this.discoverCourseTypes(page);
              this.logProgress(`Found ${courseTypes.length} course types in dropdown`);

              for (const courseType of courseTypes) {
                try {
                  this.logProgress(`Searching course type: ${courseType.name}`);
                  await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 60000 });
                  await new Promise(resolve => setTimeout(resolve, 2000));

                  const searchResults = await this.searchByCourseType(page, courseType);
                  if (searchResults.length > 0) {
                    this.logProgress(`  Found ${searchResults.length} activities in ${courseType.name}`);
                    activities.push(...searchResults);
                  }
                } catch (error) {
                  this.handleError(error, `searching course type ${courseType.name}`);
                }
              }
            }
          }
        } else if (pageType === 'category-listing') {
          // Category page - navigate to subcategories
          const subcategories = await this.discoverSubcategories(page);
          this.logProgress(`Found ${subcategories.length} subcategories`);

          for (const subcat of subcategories) {
            // Skip if already visited
            if (this.visitedUrls.has(subcat.url)) {
              this.logProgress(`Skipping already visited subcategory: ${subcat.name}`);
              continue;
            }

            try {
              // Get age info from subcategory URL if available, otherwise inherit from parent
              const subcatCode = this.extractCategoryCode(subcat.url);
              const subcatAgeInfo = subcatCode ? this.categoryAgeMap[subcatCode.toLowerCase()] : null;
              // Inherit parent's age info if subcategory doesn't have its own
              const subcatWithAge = {
                ...subcat,
                ageMin: subcatAgeInfo?.ageMin ?? categoryInfo?.ageMin,
                ageMax: subcatAgeInfo?.ageMax ?? categoryInfo?.ageMax
              };

              this.logProgress(`Processing subcategory: ${subcat.name}`);
              const subcatActivities = await this.extractFromSubcategory(browser, subcatWithAge);
              if (subcatActivities.length > 0) {
                this.logProgress(`  Found ${subcatActivities.length} activities in ${subcat.name}`);
                activities.push(...subcatActivities);
              }
            } catch (error) {
              this.handleError(error, `processing subcategory ${subcat.name}`);
            }
          }
        } else {
          // Try course type dropdown search
          const courseTypes = await this.discoverCourseTypes(page);
          this.logProgress(`Found ${courseTypes.length} course types in dropdown`);

          if (courseTypes.length > 0) {
            for (const courseType of courseTypes) {
              try {
                this.logProgress(`Searching course type: ${courseType.name}`);
                await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 60000 });
                await new Promise(resolve => setTimeout(resolve, 2000));

                const searchResults = await this.searchByCourseType(page, courseType);
                if (searchResults.length > 0) {
                  this.logProgress(`  Found ${searchResults.length} activities in ${courseType.name}`);
                  activities.push(...searchResults);
                }
              } catch (error) {
                this.handleError(error, `searching course type ${courseType.name}`);
              }
            }
          } else {
            // Last fallback - category links
            const categoryLinks = await this.discoverCategoryLinks(page);
            this.logProgress(`Found ${categoryLinks.length} category links (fallback)`);

            for (const category of categoryLinks) {
              try {
                this.logProgress(`Processing category: ${category.name}`);
                const categoryActivities = await this.extractFromCategoryLink(browser, category);
                if (categoryActivities.length > 0) {
                  this.logProgress(`  Found ${categoryActivities.length} activities in ${category.name}`);
                  activities.push(...categoryActivities);
                }
              } catch (error) {
                this.handleError(error, `processing category ${category.name}`);
              }
            }
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
   * Detect the type of page we're on
   * @param {Object} page - Puppeteer page
   * @returns {Promise<string>} 'activity-listing', 'category-listing', 'button-navigation', or 'search-form'
   */
  async detectPageType(page) {
    return await page.evaluate(() => {
      // Check for activity cards with ID/Price badges (Kelowna style)
      const activityCards = document.querySelectorAll('.card');
      let hasActivityCards = false;
      activityCards.forEach(card => {
        const text = card.textContent || '';
        if (text.includes('ID:') && text.includes('Price:')) {
          hasActivityCards = true;
        }
      });
      if (hasActivityCards) return 'activity-listing';

      // Check for CourseDetails links (indicates activity listing)
      const courseDetailsLinks = document.querySelectorAll('a[href*="CourseDetails"]');
      if (courseDetailsLinks.length > 0) return 'activity-listing';

      // Check for course result panels
      const coursePanels = document.querySelectorAll('.panel.course-results, .course-panel, .course-results');
      if (coursePanels.length > 0) return 'activity-listing';

      // IMPORTANT: Check for search form BEFORE category links
      // Lethbridge-style pages have a #CourseTypes dropdown AND browse links,
      // but need the Search button clicked to show actual courses
      const dropdown = document.querySelector('#CourseTypes, select[name="CourseTypes"]');
      const searchBtn = Array.from(document.querySelectorAll('button, input[type="submit"], .btn')).find(b => {
        const text = (b.textContent || b.value || '').trim().toLowerCase();
        return text === 'search';
      });
      // If we have a course types dropdown and a search button, it's a search form page
      if (dropdown && searchBtn) return 'search-form';

      // Check for subcategory cards (category page)
      const subcatCards = document.querySelectorAll('.card a[href*="/browse/"]');
      if (subcatCards.length > 0) return 'category-listing';

      // Check for info panel with navigation buttons (Lethbridge style)
      // These pages have an info panel and buttons that navigate to session lists
      const infoPanel = document.querySelector('.panel-info, .info-panel, .category-info');
      const navButtons = document.querySelectorAll('a.btn[href*="/browse/"], a.btn-primary[href*="category"], button[onclick*="browse"]');
      if (infoPanel || navButtons.length > 0) {
        // Check if there are also browse links we can follow
        const browseLinks = document.querySelectorAll('a[href*="/browse/"]');
        if (browseLinks.length > 0) return 'button-navigation';
      }

      // Check for links that go to sessions/offerings
      const sessionLinks = document.querySelectorAll('a[href*="Session"], a[href*="session"], a[href*="Offering"]');
      if (sessionLinks.length > 0) return 'activity-listing';

      // Check for course type dropdown without search button (fallback)
      if (dropdown) return 'search-form';

      // Check for any clickable category elements
      const categoryLinks = document.querySelectorAll('a[href*="category"], a[href*="browse"]');
      if (categoryLinks.length > 0) return 'category-listing';

      return 'unknown';
    });
  }

  /**
   * Click the Search button to load results on a search-form page
   * @param {Object} page - Puppeteer page
   * @returns {Promise<boolean>} Whether search was clicked successfully
   */
  async clickSearchButton(page) {
    const clicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], .btn'));
      const searchBtn = buttons.find(b => {
        const text = (b.textContent || b.value || '').trim().toLowerCase();
        return text === 'search';
      });
      if (searchBtn) {
        searchBtn.click();
        return true;
      }
      // Try form submit
      const form = document.querySelector('#searchForm, form[action*="courses"]');
      if (form) {
        const submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
        if (submitBtn) {
          submitBtn.click();
          return true;
        }
      }
      return false;
    });

    if (clicked) {
      // Wait for results to load
      await new Promise(r => setTimeout(r, 5000));
    }
    return clicked;
  }

  /**
   * Discover subcategories on a category page
   * @param {Object} page - Puppeteer page
   * @returns {Promise<Array>} Subcategory links
   */
  async discoverSubcategories(page) {
    return await page.evaluate(() => {
      const subcategories = [];
      const seen = new Set();

      // Look for category cards with browse links
      const cards = document.querySelectorAll('.card');
      cards.forEach(card => {
        const link = card.querySelector('a[href*="/browse/"]');
        const titleEl = card.querySelector('h2, h3, h4, .card-title');
        if (link && titleEl) {
          const href = link.href;
          const name = titleEl.textContent?.trim();
          if (href && name && !seen.has(href)) {
            // Skip if it looks like an adult category
            const nameLower = name.toLowerCase();
            if (!nameLower.includes('adult') && !nameLower.includes('55+') && !nameLower.includes('senior')) {
              seen.add(href);
              subcategories.push({ url: href, name });
            }
          }
        }
      });

      // Also look for direct browse links
      const browseLinks = document.querySelectorAll('a[href*="/browse/"]');
      browseLinks.forEach(link => {
        const href = link.href;
        const name = link.textContent?.trim();
        if (href && name && name.length > 2 && !seen.has(href)) {
          const nameLower = name.toLowerCase();
          if (!nameLower.includes('adult') && !nameLower.includes('55+') &&
              !nameLower.includes('senior') && !nameLower.includes('browse program')) {
            seen.add(href);
            subcategories.push({ url: href, name });
          }
        }
      });

      return subcategories;
    });
  }

  /**
   * Extract activities from a subcategory, navigating deeper if needed
   * @param {Object} browser - Puppeteer browser
   * @param {Object} subcategory - Subcategory info
   * @param {number} depth - Current recursion depth (default 0)
   * @returns {Promise<Array>} Activities
   */
  async extractFromSubcategory(browser, subcategory, depth = 0) {
    const activities = [];
    // Allow config to override max depth (default 3 for reasonable performance)
    const MAX_DEPTH = this.config.scraperConfig?.maxDepth || 3;

    // Mark this URL as visited
    this.visitedUrls.add(subcategory.url);

    // Prevent too deep recursion
    if (depth > MAX_DEPTH) {
      this.logProgress(`Max depth (${MAX_DEPTH}) reached at: ${subcategory.name}`);
      return activities;
    }

    const page = await browser.newPage();

    try {
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
      await page.goto(subcategory.url, { waitUntil: 'networkidle2', timeout: 60000 });
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Check if this page has actual activities or more subcategories
      const pageType = await this.detectPageType(page);

      if (pageType === 'activity-listing') {
        // Extract activities with detail pages
        const pageActivities = await this.extractActivitiesWithDetails(browser, page, subcategory);
        activities.push(...pageActivities);
      } else if (pageType === 'search-form') {
        // Search form page - click Search button to load results
        this.logProgress(`  Found search form in ${subcategory.name}, clicking Search...`);
        const searchClicked = await this.clickSearchButton(page);

        if (searchClicked) {
          const newPageType = await this.detectPageType(page);
          if (newPageType === 'activity-listing') {
            const pageActivities = await this.extractActivitiesWithDetails(browser, page, subcategory);
            activities.push(...pageActivities);
          } else {
            // Fallback
            const directActivities = await this.extractActivitiesFromPage(page, subcategory);
            activities.push(...directActivities);
          }
        }
      } else if (pageType === 'category-listing') {
        // Go one level deeper
        const deeperSubcats = await this.discoverSubcategories(page);

        // Filter out already visited URLs
        const unvisitedSubcats = deeperSubcats.filter(subcat => !this.visitedUrls.has(subcat.url));
        this.logProgress(`  Found ${deeperSubcats.length} subcategories, ${unvisitedSubcats.length} unvisited (depth ${depth})`);

        for (const deepSubcat of unvisitedSubcats) {
          try {
            // Inherit age info from parent subcategory
            const deepSubcatWithAge = {
              ...deepSubcat,
              ageMin: subcategory.ageMin,
              ageMax: subcategory.ageMax
            };
            const deepActivities = await this.extractFromSubcategory(browser, deepSubcatWithAge, depth + 1);
            activities.push(...deepActivities);
          } catch (error) {
            this.handleError(error, `processing deep subcategory ${deepSubcat.name}`);
          }
        }
      } else {
        // Try direct extraction
        const directActivities = await this.extractActivitiesFromPage(page, subcategory);
        activities.push(...directActivities);
      }
    } finally {
      await page.close();
    }

    return activities;
  }

  /**
   * Extract activities from a page, visiting detail pages for full data
   * @param {Object} browser - Puppeteer browser
   * @param {Object} page - Current page
   * @param {Object} category - Category info
   * @returns {Promise<Array>} Activities with full details
   */
  async extractActivitiesWithDetails(browser, page, category) {
    const activities = [];
    const processedIds = new Set();

    // First, try to extract from card-based layout (Kelowna style)
    const cardActivities = await this.extractFromCards(page, category);
    if (cardActivities.length > 0) {
      this.logProgress(`  Extracted ${cardActivities.length} activities from cards`);

      // Check if we should enrich with detail page data (for descriptions, dates, ages)
      if (this.config.scraperConfig.fetchDetailPages) {
        // Count activities that need enrichment (missing dates, description, or age)
        const needsEnrichment = cardActivities.filter(a =>
          a.registrationUrl && (!a.description || !a.startDate || !a.ageMin)
        );

        if (needsEnrichment.length > 0) {
          this.logProgress(`  Enriching ${needsEnrichment.length}/${cardActivities.length} activities with detail page data...`);
          for (let i = 0; i < cardActivities.length; i++) {
            const activity = cardActivities[i];
            if (activity.registrationUrl && (!activity.description || !activity.startDate || !activity.ageMin)) {
              try {
                const enriched = await this.fetchDescriptionFromDetailPage(page, activity.registrationUrl);
                if (enriched.description && !activity.description) {
                  activity.description = enriched.description;
                }
                if (enriched.ageMin && !activity.ageMin) {
                  activity.ageMin = enriched.ageMin;
                  activity.ageMax = enriched.ageMax;
                }
                // Add date enrichment
                if (enriched.startDate && !activity.startDate) {
                  activity.startDate = enriched.startDate;
                }
                if (enriched.endDate && !activity.endDate) {
                  activity.endDate = enriched.endDate;
                }
                // Rate limiting
                await new Promise(r => setTimeout(r, 500));
                if ((i + 1) % 20 === 0) {
                  this.logProgress(`    Enriched ${i + 1}/${cardActivities.length} activities`);
                }
              } catch (err) {
                // Continue without enrichment if detail page fails
              }
            }
          }
        }
      }

      activities.push(...cardActivities);
      return activities;
    }

    // Otherwise, collect detail URLs and visit each
    let hasMorePages = true;
    let pageNum = 1;
    const maxPages = 20;
    const allDetailUrls = [];

    while (hasMorePages && pageNum <= maxPages) {
      const detailUrls = await this.extractDetailUrls(page);
      for (const url of detailUrls) {
        if (!processedIds.has(url)) {
          processedIds.add(url);
          allDetailUrls.push(url);
        }
      }
      this.logProgress(`    Page ${pageNum}: Found ${detailUrls.length} activity links (total: ${allDetailUrls.length})`);

      hasMorePages = await this.navigateToNextPage(page);
      if (hasMorePages) {
        pageNum++;
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Visit each detail page
    if (allDetailUrls.length > 0) {
      this.logProgress(`  Visiting ${allDetailUrls.length} detail pages...`);
      for (let i = 0; i < allDetailUrls.length; i++) {
        try {
          const activity = await this.extractFromDetailPage(page, allDetailUrls[i], category);
          if (activity && activity.name) {
            activities.push(activity);
          }
          // Progress log every 10 activities
          if ((i + 1) % 10 === 0) {
            this.logProgress(`    Processed ${i + 1}/${allDetailUrls.length} detail pages`);
          }
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          this.handleError(error, `extracting from ${allDetailUrls[i]}`);
        }
      }
    }

    return activities;
  }

  /**
   * Extract activities from card-based layout (Kelowna style)
   * @param {Object} page - Puppeteer page
   * @param {Object} category - Category info
   * @returns {Promise<Array>} Activities
   */
  async extractFromCards(page, category) {
    return await page.evaluate((categoryInfo) => {
      const activities = [];
      const cards = document.querySelectorAll('.card');

      cards.forEach(card => {
        const text = card.textContent || '';

        // Only process cards that have activity data (ID and Price badges)
        if (!text.includes('ID:') || !text.includes('Price:')) {
          return;
        }

        try {
          const activity = {
            courseType: categoryInfo.name
          };

          // Extract title
          const titleEl = card.querySelector('h2, h3, .card-title');
          activity.name = titleEl?.textContent?.trim() || '';

          // Skip if name looks like a category
          if (!activity.name || activity.name.length < 3) return;

          // Extract ID
          const idMatch = text.match(/ID:\s*(\d+)/);
          if (idMatch) {
            activity.courseId = idMatch[1];
          }

          // Extract price
          const priceMatch = text.match(/Price:\s*\$?([\d,.]+)/);
          if (priceMatch) {
            activity.price = '$' + priceMatch[1];
          }

          // Extract spaces (availability)
          const spacesMatch = text.match(/Spaces:\s*(\d+)/);
          if (spacesMatch) {
            activity.spacesLeft = spacesMatch[1];
            activity.availability = parseInt(spacesMatch[1]) > 0 ? 'Open' : 'Full';
          }

          // Extract dates - look for "From:" and "To:" patterns
          // Multiple formats: "Wed, January 15, 2025", "Wed, 10-Dec-25", "10-Dec-25"
          const datePatterns = [
            // "Wed, 10-Dec-25" or "Wed, 10-Dec-2025" (DD-Mon-YY/YYYY)
            /From:\s*(?:[A-Za-z]+,?\s*)?(\d{1,2}[-/][A-Za-z]{3}[-/]\d{2,4})/i,
            // "Wed, January 15, 2025" (Day, Month DD, YYYY)
            /From:\s*([A-Za-z]+,?\s*[A-Za-z]+\s+\d+,?\s*\d{4})/i,
            // "January 15, 2025" (Month DD, YYYY)
            /From:\s*([A-Za-z]+\s+\d+,?\s*\d{4})/i
          ];
          const toDatePatterns = [
            /To:\s*(?:[A-Za-z]+,?\s*)?(\d{1,2}[-/][A-Za-z]{3}[-/]\d{2,4})/i,
            /To:\s*([A-Za-z]+,?\s*[A-Za-z]+\s+\d+,?\s*\d{4})/i,
            /To:\s*([A-Za-z]+\s+\d+,?\s*\d{4})/i
          ];

          for (const pattern of datePatterns) {
            const match = text.match(pattern);
            if (match) {
              activity.startDate = match[1];
              break;
            }
          }
          for (const pattern of toDatePatterns) {
            const match = text.match(pattern);
            if (match) {
              activity.endDate = match[1];
              break;
            }
          }

          // Extract schedule from table
          const table = card.querySelector('table');
          if (table) {
            const rows = table.querySelectorAll('tbody tr, tr');
            activity.daysOfWeek = [];

            // Valid day names to look for
            const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
                               'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

            rows.forEach(row => {
              const cells = row.querySelectorAll('td');
              // Skip header rows (rows with th elements or first cell is "Day")
              if (cells.length >= 3 && !row.querySelector('th')) {
                const day = cells[0]?.textContent?.trim();
                const start = cells[1]?.textContent?.trim();
                const end = cells[2]?.textContent?.trim();
                const instructor = cells[3]?.textContent?.trim();
                const location = cells[4]?.textContent?.trim();
                const venue = cells[5]?.textContent?.trim();

                // Check if this is a valid day (not the header "Day")
                const dayLower = day?.toLowerCase() || '';
                const isValidDay = validDays.some(d => dayLower === d || dayLower.startsWith(d));

                if (day && isValidDay) {
                  if (!activity.daysOfWeek.includes(day)) {
                    activity.daysOfWeek.push(day);
                  }
                }
                if (start && start.includes(':') && !activity.startTime) {
                  activity.startTime = start;
                }
                if (end && end.includes(':') && !activity.endTime) {
                  activity.endTime = end;
                }
                if (instructor && instructor.length > 1 && !activity.instructor) {
                  activity.instructor = instructor;
                }
                if (location && location.length > 1 && !activity.location) {
                  activity.location = location;
                }
                if (venue && venue.length > 1 && !activity.venue) {
                  activity.venue = venue;
                }
              }
            });
          }

          // Extract registration URL - look for any link with course/register/details
          const regLink = card.querySelector('a[href*="register"], a[href*="Register"], a.btn-primary, a[href*="Course"], a[href*="course"], a[href*="Details"], a[href*="browse"]');
          if (regLink) {
            activity.registrationUrl = regLink.href;
          }

          // Extract age info from text (look for patterns like "Ages 6-12", "Age: 4-7")
          const agePatterns = [
            /Ages?\s*:?\s*(\d+)\s*[-–to]+\s*(\d+)/i,
            /\((\d+)\s*[-–]\s*(\d+)\s*(?:yrs?|years?)?\)/i,
            /(\d+)\s*[-–]\s*(\d+)\s*(?:yrs?|years?)/i
          ];
          for (const pattern of agePatterns) {
            const ageMatch = text.match(pattern);
            if (ageMatch) {
              activity.ageMin = parseInt(ageMatch[1]);
              activity.ageMax = parseInt(ageMatch[2]);
              break;
            }
          }

          // Try to infer age from activity name first
          if (!activity.ageMin) {
            const nameLower = activity.name.toLowerCase();
            // Keywords that suggest specific age ranges
            if (nameLower.includes('tot') || nameLower.includes('baby') || nameLower.includes('infant')) {
              activity.ageMin = 0;
              activity.ageMax = 3;
            } else if (nameLower.includes('preschool') || nameLower.includes('pre-school') || nameLower.includes('toddler')) {
              activity.ageMin = 2;
              activity.ageMax = 5;
            } else if (nameLower.includes('kindergarten') || nameLower.includes('kinder')) {
              activity.ageMin = 4;
              activity.ageMax = 6;
            } else if (nameLower.includes('youth') || nameLower.includes('pre-teen') || nameLower.includes('preteen')) {
              activity.ageMin = 10;
              activity.ageMax = 14;
            } else if (nameLower.includes('teen') && !nameLower.includes('pre')) {
              activity.ageMin = 13;
              activity.ageMax = 18;
            } else if (nameLower.includes('beginner') || nameLower.includes('level 1') || nameLower.includes('intro')) {
              // Generic beginners - use category age if available
            }
          }

          // Fall back to category age range from config if still no age
          if (!activity.ageMin && categoryInfo.ageMin !== undefined) {
            activity.ageMin = categoryInfo.ageMin;
            activity.ageMax = categoryInfo.ageMax;
          }

          // Fall back to category name inference
          if (!activity.ageMin && categoryInfo.name) {
            const catName = categoryInfo.name.toLowerCase();
            if (catName.includes('6 + under') || catName.includes('6+under') || catName.includes('preschool')) {
              activity.ageMin = 0;
              activity.ageMax = 6;
            } else if (catName.includes('6 + up') || catName.includes('6+up') || catName.includes('6 and up')) {
              activity.ageMin = 6;
              activity.ageMax = 12;
            } else if (catName.includes('teen')) {
              activity.ageMin = 13;
              activity.ageMax = 18;
            } else if (catName.includes('child') || catName.includes('kids')) {
              activity.ageMin = 5;
              activity.ageMax = 12;
            } else if (catName.includes('youth')) {
              activity.ageMin = 10;
              activity.ageMax = 18;
            } else if (catName.includes('parent') || catName.includes('tot') || catName.includes('baby') || catName.includes('infant')) {
              activity.ageMin = 0;
              activity.ageMax = 5;
            } else if (catName.includes('swim') || catName.includes('aqua')) {
              // Swimming programs often cover all kids
              activity.ageMin = 0;
              activity.ageMax = 18;
            }
          }

          // Extract description - first paragraph or card body text
          const descEl = card.querySelector('.card-body p, .card-text, p');
          if (descEl) {
            const desc = descEl.textContent?.trim();
            if (desc && desc.length > 10 && !desc.includes('ID:') && !desc.includes('Price:')) {
              activity.description = desc.substring(0, 500);
            }
          }

          // Only add if we have essential data
          if (activity.name && activity.courseId) {
            activities.push(activity);
          }
        } catch (err) {
          console.error('Error extracting from card:', err);
        }
      });

      return activities;
    }, category);
  }

  /**
   * Discover category links for children's programs
   * @param {Object} page - Puppeteer page
   * @returns {Promise<Array>} Category links
   */
  async discoverCategoryLinks(page) {
    return await page.evaluate(() => {
      const categories = [];
      const childCategoryPatterns = [
        /preschool/i, /child/i, /youth/i, /teen/i, /parent.*tot/i,
        /skating/i, /after.*school/i, /camp/i, /birthday/i
      ];

      const links = document.querySelectorAll('a[href*="category"], a[href*="browse"]');
      links.forEach(link => {
        const text = link.textContent?.trim() || '';
        const href = link.href || '';

        // Check if this is a child-related category
        const isChildCategory = childCategoryPatterns.some(pattern => pattern.test(text));

        if (isChildCategory && href && !categories.find(c => c.url === href)) {
          categories.push({
            name: text,
            url: href
          });
        }
      });

      return categories;
    });
  }

  /**
   * Extract activities from a category link
   * @param {Object} browser - Puppeteer browser
   * @param {Object} category - Category info
   * @returns {Promise<Array>} Activities
   */
  async extractFromCategoryLink(browser, category) {
    const activities = [];
    const page = await browser.newPage();

    try {
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
      await page.goto(category.url, { waitUntil: 'networkidle2', timeout: 60000 });
      await new Promise(resolve => setTimeout(resolve, 4000));

      // Handle pagination
      let hasMorePages = true;
      let pageNum = 1;
      const maxPages = 10;

      while (hasMorePages && pageNum <= maxPages) {
        const pageActivities = await this.extractActivitiesFromPage(page, { name: category.name });
        activities.push(...pageActivities);

        hasMorePages = await this.navigateToNextPage(page);
        if (hasMorePages) {
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
   * Discover available course types from the search form
   * IMPORTANT: Get ALL course types, not just filtered ones.
   * We filter by actual age data later, not by category name.
   * @param {Object} page - Puppeteer page
   * @returns {Promise<Array>} Available course types
   */
  async discoverCourseTypes(page) {
    // Wait for the course type dropdown to be present and have options
    try {
      await page.waitForSelector('#CourseTypes, select[name="CourseTypes"], select.list-box', { timeout: 10000 });
      // Additional wait for options to populate
      await page.waitForFunction(() => {
        const select = document.querySelector('#CourseTypes, select[name="CourseTypes"], select.list-box');
        return select && select.options && select.options.length > 1;
      }, { timeout: 10000 });
    } catch (e) {
      this.logProgress('Course type dropdown not found or not populated');
    }

    return await page.evaluate(() => {
      const courseTypes = [];

      // Look for course type dropdown - Intelligenz uses #CourseTypes
      const selectors = [
        '#CourseTypes',
        '#courseTypes',
        '#courseType',
        'select[name="CourseTypes"]',
        'select[name="courseType"]',
        'select[name="category"]',
        '#category',
        'select.course-type',
        'select.list-box'
      ];

      let select = null;
      for (const selector of selectors) {
        select = document.querySelector(selector);
        if (select && select.tagName === 'SELECT') break;
      }

      if (select && select.tagName === 'SELECT') {
        const options = Array.from(select.options);
        options.forEach(option => {
          if (option.value && option.text && !option.disabled) {
            // Skip obvious adult-only categories
            const text = option.text.toLowerCase();
            const isAdultOnly =
              text.includes('55+') ||
              text.includes('seniors only') ||
              text.includes('older adult') ||
              text.includes('wine') ||
              text.includes('beer');

            // Include all categories EXCEPT explicitly adult-only ones
            // Children's activities can be in ANY category (Dance, Sports, Arts, etc.)
            // Age filtering happens later based on actual activity age data
            if (!isAdultOnly) {
              courseTypes.push({
                value: option.value,
                name: option.text.trim()
              });
            }
          }
        });
      }

      return courseTypes;
    });
  }

  /**
   * Search for activities by course type
   * @param {Object} page - Puppeteer page
   * @param {Object} courseType - Course type to search
   * @returns {Promise<Array>} Activities found
   */
  async searchByCourseType(page, courseType) {
    const activities = [];

    try {
      // Select course type - Intelligenz uses #CourseTypes (may be multi-select)
      const selectSuccess = await page.evaluate((courseTypeValue) => {
        const selectors = [
          '#CourseTypes',
          '#courseTypes',
          '#courseType',
          'select[name="CourseTypes"]',
          'select[name="courseType"]',
          'select[name="category"]',
          '#category'
        ];

        for (const selector of selectors) {
          const select = document.querySelector(selector);
          if (select && select.tagName === 'SELECT') {
            // Handle both single and multi-select dropdowns
            if (select.multiple) {
              // For multi-select: deselect all first, then select the target option
              Array.from(select.options).forEach(opt => opt.selected = false);
              const targetOption = Array.from(select.options).find(opt => opt.value === courseTypeValue);
              if (targetOption) {
                targetOption.selected = true;
              }
            } else {
              // For single-select: just set the value
              select.value = courseTypeValue;
            }
            select.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
          }
        }
        return false;
      }, courseType.value);

      if (!selectSuccess) {
        this.logProgress(`  Could not select course type: ${courseType.name}`);
        return activities;
      }

      // Click search/submit button
      const submitted = await page.evaluate(() => {
        // Look for submit buttons with "Search" text
        const submitButtons = document.querySelectorAll('input[type="submit"], button[type="submit"]');
        for (const btn of submitButtons) {
          const text = (btn.value || btn.textContent || '').toLowerCase();
          if (text.includes('search')) {
            btn.click();
            return true;
          }
        }
        // Fallback to first submit button
        if (submitButtons.length > 0) {
          submitButtons[0].click();
          return true;
        }
        return false;
      });

      if (!submitted) {
        // Try pressing enter instead
        await page.keyboard.press('Enter');
      }

      // Wait for results to load
      await new Promise(resolve => setTimeout(resolve, 4000));

      // Handle pagination and collect Book button URLs
      let hasMorePages = true;
      let pageNum = 1;
      const maxPages = 20; // Increased to handle more pages
      const allDetailUrls = [];

      while (hasMorePages && pageNum <= maxPages) {
        // Extract Book button URLs from current page
        const detailUrls = await this.extractDetailUrls(page);
        allDetailUrls.push(...detailUrls);
        this.logProgress(`    Page ${pageNum}: Found ${detailUrls.length} activity links`);

        // Check for next page
        hasMorePages = await this.navigateToNextPage(page);
        if (hasMorePages) {
          pageNum++;
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      // Now visit each CourseDetails page to get full activity info
      this.logProgress(`    Visiting ${allDetailUrls.length} detail pages for ${courseType.name}`);
      for (const url of allDetailUrls) {
        try {
          const detailActivity = await this.extractFromDetailPage(page, url, courseType);
          if (detailActivity) {
            activities.push(detailActivity);
          }
          // Rate limiting between detail page visits
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          this.handleError(error, `extracting detail from ${url}`);
        }
      }

    } catch (error) {
      this.handleError(error, `searchByCourseType ${courseType.name}`);
    }

    return activities;
  }

  /**
   * Extract Book button URLs from search results page
   * @param {Object} page - Puppeteer page
   * @returns {Promise<Array>} Array of CourseDetails URLs
   */
  async extractDetailUrls(page) {
    return await page.evaluate(() => {
      const urls = [];

      // Look for Book buttons - they link to CourseDetails pages
      const bookButtons = document.querySelectorAll('a.btn-primary[href*="CourseDetails"], a[href*="CourseDetails"]');
      bookButtons.forEach(btn => {
        const href = btn.href;
        if (href && !urls.includes(href)) {
          urls.push(href);
        }
      });

      return urls;
    });
  }

  /**
   * Extract full activity details from CourseDetails page
   * @param {Object} page - Puppeteer page
   * @param {string} url - CourseDetails URL
   * @param {Object} courseType - Course type info
   * @returns {Promise<Object>} Activity data
   */
  async extractFromDetailPage(page, url, courseType) {
    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise(resolve => setTimeout(resolve, 2000));

      const activity = await page.evaluate((courseTypeInfo, pageUrl) => {
        const data = {
          courseType: courseTypeInfo.name,
          registrationUrl: pageUrl
        };

        // Get title from h1 or panel heading
        const titleEl = document.querySelector('h1, h2, .panel-heading h3, .course-title');
        if (titleEl) {
          let title = titleEl.textContent.trim();
          // Remove "Course: 12345 - " prefix if present
          title = title.replace(/^Course:\s*\d+\s*-\s*/, '');
          data.name = title;
        }

        // Get description - first paragraph after heading
        const panels = document.querySelectorAll('.panel-body');
        for (const panel of panels) {
          const firstP = panel.querySelector('p');
          if (firstP && firstP.textContent.trim().length > 20) {
            data.description = firstP.textContent.trim();
            break;
          }
        }

        // Also try to get description from page text
        if (!data.description) {
          const pageText = document.body.innerText;
          const descMatch = pageText.match(/(?:Description|About)[:\s]+([^\n]{30,300})/i);
          if (descMatch) {
            data.description = descMatch[1].trim();
          }
        }

        // Extract from table rows (label: value format)
        const rows = document.querySelectorAll('table.table tr, table tr');
        rows.forEach(row => {
          const cells = row.querySelectorAll('td');
          if (cells.length >= 2) {
            const labelCell = cells[0];
            const valueCell = cells[cells.length - 1];
            const label = labelCell.querySelector('label');
            const labelText = (label ? label.textContent : labelCell.textContent).trim().toLowerCase();
            const value = valueCell.textContent.trim();

            if (labelText.includes('age')) {
              const ageMatch = value.match(/(\d+)\s*[-–]\s*(\d+(?:\.\d+)?)/);
              if (ageMatch) {
                data.ageMin = parseInt(ageMatch[1]);
                data.ageMax = Math.ceil(parseFloat(ageMatch[2]));
              }
            } else if (labelText.includes('start date') || labelText === 'from') {
              data.startDate = value;
            } else if (labelText.includes('end date') || labelText === 'to') {
              data.endDate = value;
            } else if (labelText.includes('spaces') || labelText.includes('available')) {
              data.spacesLeft = value;
              data.availability = value === '0' ? 'Full' : 'Open';
            } else if (labelText.includes('waitlist')) {
              data.waitlistAvailable = value.toLowerCase() === 'yes';
            }
          }
        });

        // Try to extract age from full page text if not found
        if (!data.ageMin) {
          const pageText = document.body.innerText;
          const agePatterns = [
            /Ages?\s*[:\s]*(\d+)\s*[-–]\s*(\d+(?:\.\d+)?)/i,
            /\((\d+)\s*[-–]\s*(\d+)\s*(?:yrs?|years?|months?)?\)/i,
            /for\s+(?:ages?\s+)?(\d+)\s*[-–]\s*(\d+)/i
          ];
          for (const pattern of agePatterns) {
            const match = pageText.match(pattern);
            if (match) {
              data.ageMin = parseInt(match[1]);
              data.ageMax = Math.ceil(parseFloat(match[2]));
              break;
            }
          }
        }

        // Infer age from activity name if still not found
        if (!data.ageMin && data.name) {
          const nameLower = data.name.toLowerCase();
          if (nameLower.includes('tot') || nameLower.includes('baby') || nameLower.includes('infant')) {
            data.ageMin = 0;
            data.ageMax = 3;
          } else if (nameLower.includes('preschool') || nameLower.includes('toddler')) {
            data.ageMin = 2;
            data.ageMax = 5;
          } else if (nameLower.includes('parent') && (nameLower.includes('tot') || nameLower.includes('child'))) {
            data.ageMin = 0;
            data.ageMax = 5;
          } else if (nameLower.includes('teen') && !nameLower.includes('pre')) {
            data.ageMin = 13;
            data.ageMax = 18;
          } else if (nameLower.includes('youth')) {
            data.ageMin = 10;
            data.ageMax = 18;
          } else if (nameLower.includes('child') || nameLower.includes('kid')) {
            data.ageMin = 5;
            data.ageMax = 12;
          }
        }

        // Infer age from course type category if still not found
        if (!data.ageMin && courseTypeInfo.name) {
          const catLower = courseTypeInfo.name.toLowerCase();
          if (catLower.includes('swimming') || catLower.includes('swim')) {
            data.ageMin = 0;
            data.ageMax = 18;
          } else if (catLower.includes('camp')) {
            data.ageMin = 4;
            data.ageMax = 14;
          } else if (catLower.includes('family') || catLower.includes('parented')) {
            data.ageMin = 0;
            data.ageMax = 5;
          } else if (catLower.includes('preschool')) {
            data.ageMin = 2;
            data.ageMax = 5;
          } else if (catLower.includes('child')) {
            data.ageMin = 5;
            data.ageMax = 12;
          } else if (catLower.includes('youth')) {
            data.ageMin = 10;
            data.ageMax = 18;
          }
        }

        // Extract schedule from nested table
        const scheduleTable = document.querySelector('table.table-striped');
        if (scheduleTable) {
          const scheduleRows = scheduleTable.querySelectorAll('tbody tr');
          scheduleRows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 4) {
              if (!data.daysOfWeek) data.daysOfWeek = [];
              const day = cells[0]?.textContent?.trim();
              if (day && !data.daysOfWeek.includes(day)) {
                data.daysOfWeek.push(day);
              }
              if (!data.startTime) {
                data.startTime = cells[1]?.textContent?.trim();
              }
              if (!data.endTime) {
                data.endTime = cells[2]?.textContent?.trim();
              }
              if (!data.instructor) {
                data.instructor = cells[3]?.textContent?.trim();
              }
              if (cells.length >= 5 && !data.location) {
                data.location = cells[4]?.textContent?.trim();
              }
              if (cells.length >= 6 && !data.venue) {
                data.venue = cells[5]?.textContent?.trim();
              }
            }
          });
        }

        // Extract course ID from URL
        const idMatch = pageUrl.match(/CourseDetails\/(\d+)/);
        if (idMatch) {
          data.courseId = idMatch[1];
        }

        // Look for price in the page
        const pageText = document.body.innerText;
        const priceMatch = pageText.match(/\$\s*([\d,.]+)/);
        if (priceMatch) {
          data.price = priceMatch[0];
        }

        return data;
      }, courseType, url);

      return activity;
    } catch (error) {
      this.handleError(error, `extractFromDetailPage ${url}`);
      return null;
    }
  }

  /**
   * Extract activities from current page
   * Intelligenz displays activities as panels/cards with a heading and schedule table
   * @param {Object} page - Puppeteer page
   * @param {Object} courseType - Current course type
   * @returns {Promise<Array>} Extracted activities
   */
  async extractActivitiesFromPage(page, courseType) {
    return await page.evaluate((courseTypeInfo) => {
      const activities = [];

      // Intelligenz uses panel/card structure with headers and nested tables
      // IMPORTANT: Use specific selectors first to avoid picking up non-activity panels
      const panelSelectors = [
        '.panel.course-results',  // Pitt Meadows specific - must be first!
        '.course-results',
        '.course-panel',
        '.activity-panel',
        '.result-panel',
        '.card.course',
        '.card.activity'
      ];

      let panels = [];
      for (const selector of panelSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          panels = Array.from(elements);
          break;
        }
      }

      // Fallback: generic .panel but filter out non-course panels
      if (panels.length === 0) {
        const allPanels = document.querySelectorAll('.panel');
        panels = Array.from(allPanels).filter(panel => {
          // Must have a course link or course info to be an activity panel
          return panel.querySelector('a[href*="CourseTypes"], a[href*="booking"], .course-info, .badge-primary');
        });
      }

      // If no panels found, look for headings followed by tables
      if (panels.length === 0) {
        // Look for h3/h4 elements that might be activity titles
        const headings = document.querySelectorAll('h3, h4, .panel-title');
        headings.forEach(heading => {
          const text = heading.textContent?.trim() || '';
          // Skip non-activity headings
          if (text.length > 3 && !text.toLowerCase().includes('results') &&
              !text.toLowerCase().includes('search') && !text.toLowerCase().includes('filter')) {
            // Get parent container
            const panel = heading.closest('.panel, .card, div');
            if (panel && !panels.includes(panel)) {
              panels.push(panel);
            }
          }
        });
      }

      // Process each panel/card
      panels.forEach((panel, index) => {
        try {
          const text = panel.textContent || '';

          // Get activity name from heading
          const heading = panel.querySelector('h3, h4, .panel-title, .panel-heading a, a.course-title');
          let name = heading?.textContent?.trim() || '';

          // Skip if no meaningful name
          if (!name || name.length < 3) return;

          let activity = {
            courseType: courseTypeInfo.name,
            name: name,
            rawText: text.substring(0, 500),
            index: index
          };

          // Extract age range from badges or text
          const ageBadges = panel.querySelectorAll('.badge, .label, [class*="age"]');
          ageBadges.forEach(badge => {
            const badgeText = badge.textContent || '';
            const ageMatch = badgeText.match(/(\d+)\s*[-–to]+\s*(\d+)/);
            if (ageMatch) {
              activity.ageMin = parseInt(ageMatch[1]);
              activity.ageMax = parseInt(ageMatch[2]);
            }
          });

          // Extract description
          const descEl = panel.querySelector('.description, .course-description, p');
          if (descEl) {
            activity.description = descEl.textContent?.trim().substring(0, 500);
          }

          // Extract schedule from nested table
          const scheduleTable = panel.querySelector('table');
          if (scheduleTable) {
            const rows = scheduleTable.querySelectorAll('tr');
            rows.forEach(row => {
              const cells = row.querySelectorAll('td');
              if (cells.length >= 4) {
                // Day, Start, End, Instructor, Location
                if (!activity.daysOfWeek) activity.daysOfWeek = [];
                const day = cells[0]?.textContent?.trim();
                if (day && !activity.daysOfWeek.includes(day)) {
                  activity.daysOfWeek.push(day);
                }

                if (!activity.startTime) {
                  activity.startTime = cells[1]?.textContent?.trim();
                }
                if (!activity.endTime) {
                  activity.endTime = cells[2]?.textContent?.trim();
                }
                if (!activity.instructor) {
                  activity.instructor = cells[3]?.textContent?.trim();
                }
                if (cells.length >= 5 && !activity.venue) {
                  activity.venue = cells[4]?.textContent?.trim();
                }
              }
            });
          }

          // Extract course ID - look in ID badge first, then in text
          const idBadge = panel.querySelector('.badge-primary, .badge.badge-primary');
          if (idBadge) {
            const badgeText = idBadge.textContent?.trim();
            if (badgeText && /^\d+$/.test(badgeText)) {
              activity.courseId = badgeText;
            }
          }
          // Fallback: look for ID: followed by number, or # followed by number
          if (!activity.courseId) {
            const idMatch = text.match(/ID:\s*(\d+)|#(\d{4,})/);
            if (idMatch) {
              activity.courseId = idMatch[1] || idMatch[2];
            }
          }

          // Extract registration URL - Pitt Meadows uses CourseTypes links
          const regLink = panel.querySelector('a[href*="CourseTypes"], a[href*="booking"], a[href*="register"], a[href*="enroll"], a[href*="Offering"]');
          if (regLink) {
            activity.registrationUrl = regLink.href;
          }

          // Extract price
          const priceMatch = text.match(/\$\s*([\d,.]+)/);
          if (priceMatch) {
            activity.price = priceMatch[0];
          }

          // Extract availability
          const availText = text.toLowerCase();
          if (availText.includes('full') || availText.includes('sold out') || availText.includes('waitlist')) {
            activity.availability = 'Full';
          } else if (availText.includes('register') || availText.includes('book') || availText.includes('join')) {
            activity.availability = 'Open';
          } else if (availText.includes('closed') || availText.includes('cancelled')) {
            activity.availability = 'Closed';
          }

          // Extract dates
          const dateMatch = text.match(/(\w+\s+\d{1,2},?\s*\d{4})/);
          if (dateMatch) {
            activity.dates = dateMatch[1];
          }

          // Only add if we have a valid name
          if (activity.name && activity.name.length > 3) {
            activities.push(activity);
          }

        } catch (error) {
          console.error('Error extracting activity:', error);
        }
      });

      return activities;
    }, courseType);
  }

  /**
   * Navigate to next page if pagination exists
   * Intelligenz uses ul.pagination with a[data-page="X"] links
   * @param {Object} page - Puppeteer page
   * @returns {Promise<Boolean>} True if navigated to next page
   */
  async navigateToNextPage(page) {
    try {
      // Get current page number and check for next page
      const nextPageInfo = await page.evaluate(() => {
        // Intelligenz pagination structure: ul.pagination with li elements
        const pagination = document.querySelector('ul.pagination');
        if (!pagination) return { hasNext: false };

        // Find current active page
        const activeItem = pagination.querySelector('li.active, li.current');
        if (!activeItem) return { hasNext: false };

        const currentPageLink = activeItem.querySelector('a[data-page]');
        const currentPage = currentPageLink ? parseInt(currentPageLink.getAttribute('data-page')) : 1;

        // Look for next page link (current + 1) or forward arrow
        const nextPageLink = pagination.querySelector(`a[data-page="${currentPage + 1}"]`);
        if (nextPageLink) {
          nextPageLink.click();
          return { hasNext: true, nextPage: currentPage + 1 };
        }

        // Try forward arrow/chevron
        const forwardLink = pagination.querySelector('li:has(.glyphicon-forward) a, li:has(.glyphicon-chevron-right) a, a[aria-label="Next"]');
        if (forwardLink && !forwardLink.closest('li.disabled')) {
          forwardLink.click();
          return { hasNext: true };
        }

        return { hasNext: false };
      });

      if (nextPageInfo.hasNext) {
        await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for page to load
        return true;
      }

      // Fallback to generic selectors
      const genericSelectors = [
        '.next:not(.disabled) a',
        'a[rel="next"]',
        '[aria-label="Next"]:not([disabled])'
      ];

      for (const selector of genericSelectors) {
        const hasNext = await page.evaluate((sel) => {
          const nextBtn = document.querySelector(sel);
          if (nextBtn && !nextBtn.disabled && !nextBtn.classList.contains('disabled')) {
            nextBtn.click();
            return true;
          }
          return false;
        }, selector);

        if (hasNext) {
          await new Promise(resolve => setTimeout(resolve, 3000));
          return true;
        }
      }

      return false;
    } catch (error) {
      this.logProgress(`Pagination error: ${error.message}`);
      return false;
    }
  }

  /**
   * Normalize Intelligenz activities using the base normalizer
   * @param {Array} rawActivities - Raw activities from extraction
   * @returns {Promise<Array>} Normalized activities
   */
  async normalizeActivities(rawActivities) {
    const fieldMapping = this.getIntelligenzFieldMapping();
    const normalized = [];

    for (const rawActivity of rawActivities) {
      try {
        // Parse age range from activity name or text
        const ageRange = this.extractAgeRange(rawActivity);
        rawActivity.ageRange = ageRange;

        const normalizedActivity = DataNormalizer.normalizeActivity(
          rawActivity,
          fieldMapping,
          this.config
        );

        // Validate the normalized data
        const validation = this.validateActivityData(normalizedActivity);
        if (validation.isValid) {
          normalized.push(normalizedActivity);
        } else if (validation.warnings.length > 0) {
          // Log warnings but still include the activity
          this.logProgress(`Warnings for ${rawActivity.name}: ${validation.warnings.join(', ')}`);
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
   * Extract age range from activity data
   * @param {Object} rawActivity - Raw activity data
   * @returns {Object} Age range {min, max}
   */
  extractAgeRange(rawActivity) {
    const text = `${rawActivity.name || ''} ${rawActivity.rawText || ''}`;

    // Patterns for age ranges
    const patterns = [
      /(\d+)\s*-\s*(\d+)\s*(?:years?|yrs?|y)/i,
      /ages?\s*(\d+)\s*(?:to|-)\s*(\d+)/i,
      /\((\d+)-(\d+)\)/,
      /(\d+)\s*(?:to|through)\s*(\d+)/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return {
          min: parseInt(match[1]),
          max: parseInt(match[2])
        };
      }
    }

    return { min: null, max: null };
  }

  /**
   * Get field mapping configuration for Intelligenz platform
   * @returns {Object} Field mapping configuration
   */
  getIntelligenzFieldMapping() {
    return {
      name: 'name',
      externalId: { path: 'courseId', transform: (val, raw) => {
        if (val) return val;
        // Stable fallback: use name + location hash instead of Date.now()
        const key = ((raw.name || '') + '-' + (raw.location || '')).toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 24);
        return `intelligenz-${key || 'unknown'}`;
      }},
      category: 'courseType',
      subcategory: 'name',
      description: 'description',
      fullDescription: 'description',
      schedule: 'schedule',
      cost: { path: 'price', transform: (val) => {
        if (!val) return 0;
        const match = String(val).match(/\$?\s*([\d,.]+)/);
        return match ? parseFloat(match[1].replace(',', '')) : 0;
      }},
      registrationUrl: 'registrationUrl',
      locationName: { path: 'location', transform: (val, raw) => val || raw.venue || null },
      dates: 'dates',
      dateStart: 'startDate',
      dateEnd: 'endDate',
      startTime: 'startTime',
      endTime: 'endTime',
      dayOfWeek: { path: 'daysOfWeek', transform: (val) => {
        if (!val || !Array.isArray(val)) return [];
        // Normalize day names to abbreviated form
        const dayMap = {
          'monday': 'Mon', 'mon': 'Mon',
          'tuesday': 'Tue', 'tue': 'Tue',
          'wednesday': 'Wed', 'wed': 'Wed',
          'thursday': 'Thu', 'thu': 'Thu',
          'friday': 'Fri', 'fri': 'Fri',
          'saturday': 'Sat', 'sat': 'Sat',
          'sunday': 'Sun', 'sun': 'Sun'
        };
        return val.map(d => dayMap[d.toLowerCase()] || d).filter(Boolean);
      }},
      ageMin: { path: 'ageMin', transform: (val, raw) => val ?? raw.ageRange?.min ?? null },
      ageMax: { path: 'ageMax', transform: (val, raw) => val ?? raw.ageRange?.max ?? null },
      registrationStatus: { path: 'availability', transform: (val) => {
        if (!val) return 'Unknown';
        const lower = String(val).toLowerCase();
        if (lower.includes('full') || lower === '0') return 'Full';
        if (lower.includes('waitlist')) return 'Waitlist';
        if (lower.includes('open') || lower.includes('available')) return 'Open';
        if (lower.includes('closed')) return 'Closed';
        return 'Unknown';
      }},
      instructor: 'instructor',
      spotsAvailable: { path: 'spacesLeft', transform: (val) => {
        if (!val) return null;
        const num = parseInt(val);
        return isNaN(num) ? null : num;
      }}
    };
  }

  /**
   * Fetch description and additional info from a detail page
   * @param {Object} page - Puppeteer page
   * @param {string} url - Detail page URL
   * @returns {Promise<Object>} Enrichment data
   */
  async fetchDescriptionFromDetailPage(page, url) {
    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise(r => setTimeout(r, 1000));

      return await page.evaluate(() => {
        const result = {};

        // Look for description - usually in a paragraph after the title
        const paragraphs = document.querySelectorAll('p');
        for (const p of paragraphs) {
          const text = p.textContent.trim();
          // Skip short text, browser warnings, and footer content
          if (text.length > 30 &&
              !text.includes('browser is unsupported') &&
              !text.includes('@kelowna.ca') &&
              !text.includes('©') &&
              !text.includes('ID:') &&
              !text.includes('Price:')) {
            result.description = text.substring(0, 500);
            break;
          }
        }

        // Also check for panel body content
        if (!result.description) {
          const panelBodies = document.querySelectorAll('.panel-body, .card-body');
          for (const panel of panelBodies) {
            const text = panel.textContent.trim();
            if (text.length > 50 &&
                !text.includes('browser is unsupported') &&
                !text.includes('Information:')) {
              result.description = text.substring(0, 500);
              break;
            }
          }
        }

        // Try to get age info from the page if visible
        const pageText = document.body.innerText;
        const ageMatch = pageText.match(/Ages?\s*[:\s]*(\d+)\s*[-–]\s*(\d+(?:\.\d+)?)/i);
        if (ageMatch) {
          result.ageMin = parseInt(ageMatch[1]);
          result.ageMax = Math.ceil(parseFloat(ageMatch[2]));
        }

        // Extract dates from table rows (label: value format)
        const rows = document.querySelectorAll('table.table tr, table tr');
        rows.forEach(row => {
          const cells = row.querySelectorAll('td');
          if (cells.length >= 2) {
            const labelCell = cells[0];
            const valueCell = cells[cells.length - 1];
            const label = labelCell.querySelector('label');
            const labelText = (label ? label.textContent : labelCell.textContent).trim().toLowerCase();
            const value = valueCell.textContent.trim();

            if (labelText.includes('start date') || labelText === 'from') {
              result.startDate = value;
            } else if (labelText.includes('end date') || labelText === 'to') {
              result.endDate = value;
            }
          }
        });

        return result;
      });
    } catch (err) {
      return {};
    }
  }

  /**
   * Extract category code from a URL path
   * @param {string} urlOrPath - URL or path containing category code
   * @returns {string|null} Category code or null
   */
  extractCategoryCode(urlOrPath) {
    // Look for /browse/CODE pattern
    const browseMatch = urlOrPath.match(/\/browse\/([A-Za-z0-9]+)/);
    if (browseMatch) {
      return browseMatch[1];
    }
    // Look for /category/CODE pattern
    const categoryMatch = urlOrPath.match(/\/category\/([A-Za-z0-9]+)/);
    if (categoryMatch) {
      return categoryMatch[1];
    }
    return null;
  }

  /**
   * Get or create provider record
   * @returns {Promise<Object>} Provider record
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

module.exports = IntelligenzScraper;
