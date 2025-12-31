const BaseScraper = require('../base/BaseScraper');
const DataNormalizer = require('../base/DataNormalizer');
const puppeteer = require('puppeteer');
const { generateExternalId, extractNativeId } = require('../utils/stableIdGenerator');

/**
 * Generate a stable ID for PerfectMind activities.
 * Priority: courseId from page > courseId from URL > stable hash (name + location only)
 *
 * @param {Object} activity - Activity object
 * @returns {String} Stable external ID
 */
function generateStableActivityId(activity) {
  // Use the centralized ID generator with PerfectMind-specific options
  return generateExternalId(activity, {
    platform: 'perfectmind',
    providerCode: 'pm',
    hashPrefix: 'pm'
  });
}

/**
 * Platform scraper for PerfectMind-based recreation websites
 * Handles various page structures by clicking activity links and extracting results
 */
class PerfectMindScraper extends BaseScraper {
  constructor(config) {
    super(config);
    this.platformName = 'PerfectMind';
    this.extension = null; // Will be set by ScraperFactory if extension exists

    // Activity type patterns - common across all PerfectMind sites
    // These patterns identify links that lead to activity listings
    this.activityPatterns = [
      /aquatic/i, /arts/i, /dance/i, /music/i, /fitness/i, /martial/i,
      /racquet/i, /sports/i, /skating/i, /gymnastics/i, /cooking/i,
      /science/i, /nature/i, /computer/i, /language/i, /swimming/i,
      /arena/i, /birthday/i, /general interest/i, /heritage/i,
      /health/i, /wellness/i, /first aid/i, /events/i, /digital/i,
      /learn\s*&?\s*discover/i, /after\s*school/i, /active\s*play/i,
      /outdoor/i, /crafts/i, /lifeguard/i, /skill\s*development/i,
      // Additional patterns for common PerfectMind categories
      /program/i, /class/i, /lesson/i, /club/i, /camp/i,
      /playschool/i, /childminding/i, /drop-in/i, /fencing/i,
      /ice\s*sport/i, /specialized/i, /private/i, /weight\s*room/i,
      /try\s*it/i, /volunteer/i, /educational/i, /cultural/i,
      // Age-specific program categories
      /just\s*for\s*kids/i, /grown-?up/i, /early\s*years/i, /early\s*learners/i,
      /parent.*tot/i, /tot.*time/i, /toddler/i, /preschool/i,
      // Abbotsford/generic recreation categories
      /swim/i, /skate/i, /pool/i, /rink/i, /gymnasium/i,
      /party/i, /parties/i, /exploration/i, /hobbies/i,
      /certif/i, /leadership/i, /safety/i, /community/i,
      /magic/i, /external/i, /centre/i, /center/i,
      /adventure/i, /ballet/i, /hockey/i, /soccer/i, /basketball/i
    ];

    // Kids age section patterns - broader matching for various site structures
    this.kidsSectionPatterns = [
      /preschool/i, /children/i, /^child$/i, /\bchild\b/i, /youth/i, /teen/i,
      /family/i, /camps?/i, /early years/i, /0-5/i, /6-12/i, /13-18/i,
      /adult\s*&\s*child/i, /school\s*age/i, /pro\s*d\s*day/i, /spring\s*break/i,
      /summer/i, /winter\s*break/i, /after\s*school/i, /childminding/i,
      /just\s*for\s*kids/i, /grown-?up/i, /specialized\s*programs/i,
      // Age range patterns like "4 Months - 5 Years", "6 - 12 Years", "13+ Years"
      /\d+\s*months?\s*[-–to]+\s*\d+/i,  // "4 Months - 5 Years"
      /\d+\s*[-–to]+\s*\d+\s*years?/i,   // "6 - 12 Years"
      /\d+\s*[-–to]+\s*\d+\s*yrs?/i,     // "6 - 12 yrs"
      /\b[0-9]+-[0-9]+\b/,               // Generic age range like "6-12"
      // Swimming lesson patterns (all ages, will filter by age during extraction)
      /swim\s*lesson/i, /swimming\s*lesson/i, /low\s*ratio/i,
      /private.*lesson/i, /semi.*private/i, /strokes/i,
      /swimmer/i, /beginner/i, /intermediate/i, /advanced/i,
      // Parent/tot patterns
      /parent\s*[&+]?\s*tot/i, /tot\s*time/i, /mommy\s*[&+]?\s*me/i,
      /daddy\s*[&+]?\s*me/i, /caregiver/i
    ];

    // Exclude patterns - things we don't want to click on
    this.excludePatterns = [
      /^adult$/i, /19\+/i, /55\+/i, /senior/i, /plant/i,
      /login/i, /skip/i, /show more/i, /advanced search/i, /reset/i
    ];
  }

  async scrape() {
    const startTime = Date.now();
    this.logProgress('Starting PerfectMind scraper');

    try {
      this.validateConfig();
      const provider = await this.getOrCreateProvider();

      // Check if incremental save is enabled (for large datasets that might crash)
      const incrementalSave = this.config.scraperConfig.incrementalSave === true;

      if (incrementalSave) {
        // Pass provider to enable saving after each batch
        this.currentProviderId = provider.id;
        this.totalStats = { created: 0, updated: 0, unchanged: 0, errors: 0 };
      }

      const rawActivities = await this.extractPerfectMindActivities();

      // Enhance activities with location data from detail pages
      const enhancedActivities = await this.enhanceWithLocationData(rawActivities);

      const normalizedActivities = await this.normalizeActivities(enhancedActivities);

      // For incremental save, activities were already saved during extraction
      let stats;
      if (incrementalSave) {
        stats = this.totalStats;
        this.logProgress(`Incremental save completed: ${stats.created} created, ${stats.updated} updated`);
      } else {
        stats = await this.saveActivitiesToDatabase(normalizedActivities, provider.id);
      }

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
   * Launch browser with retry logic to handle resource exhaustion
   * @param {Number} maxRetries - Maximum retry attempts
   * @returns {Promise<Browser>} Puppeteer browser instance
   */
  async launchBrowserWithRetry(maxRetries = 3) {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const browser = await puppeteer.launch({
          headless: this.config.scraperConfig.headless !== false,
          executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--single-process',  // Reduce resource usage
            '--no-zygote'        // Reduce process count
          ]
        });
        return browser;
      } catch (error) {
        lastError = error;
        this.logProgress(`Browser launch attempt ${attempt}/${maxRetries} failed: ${error.message}`);

        if (attempt < maxRetries) {
          // Exponential backoff: 2s, 4s, 8s
          const delay = Math.pow(2, attempt) * 1000;
          this.logProgress(`Waiting ${delay/1000}s before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  async extractPerfectMindActivities() {
    const activities = [];
    const { entryPoints, maxConcurrency = 10 } = this.config.scraperConfig;

    const entryPoint = entryPoints[0];
    const widgetUrl = entryPoint.startsWith('http')
      ? entryPoint
      : `${this.config.baseUrl}${entryPoint}`;

    this.logProgress(`Starting extraction from widget: ${widgetUrl}`);

    // Discover all clickable links with their positions
    const discoveredLinks = await this.discoverAllLinks(widgetUrl);

    // Filter to activity links under kids sections
    // Skip filtering if extension already handled discovery (returns pre-filtered links)
    const activityLinks = this.extension?.discoverLinks
      ? discoveredLinks  // Extension already filtered
      : this.filterActivityLinks(discoveredLinks);

    this.logProgress(`Found ${activityLinks.length} activity links to process`);

    // Use browser pool for parallelization (multiple browsers with multiple tabs each)
    const browserPoolSize = this.config.scraperConfig.browserPoolSize || 3;
    const pagesPerBrowser = this.config.scraperConfig.pagesPerBrowser || 5; // NEW: parallel tabs per browser
    const batchesPerBrowser = this.config.scraperConfig.batchesPerBrowser || 5;

    this.logProgress(`Using browser pool: ${browserPoolSize} browsers, ${pagesPerBrowser} parallel tabs each`);

    // Process with browser pool using multi-tab parallelization
    const browserPool = [];
    const browserBatchCounts = [];

    // Initialize browser pool
    for (let i = 0; i < browserPoolSize; i++) {
      try {
        const browser = await this.launchBrowserWithRetry();
        browserPool.push(browser);
        browserBatchCounts.push(0);
      } catch (error) {
        this.logProgress(`Failed to launch browser ${i + 1}: ${error.message}`);
      }
    }

    if (browserPool.length === 0) {
      throw new Error('Failed to launch any browsers');
    }

    this.logProgress(`Launched ${browserPool.length} browsers for parallel processing`);

    try {
      // Distribute links across browsers evenly
      const linksPerBrowser = Math.ceil(activityLinks.length / browserPool.length);
      const browserQueues = [];
      for (let i = 0; i < browserPool.length; i++) {
        const start = i * linksPerBrowser;
        const end = Math.min(start + linksPerBrowser, activityLinks.length);
        browserQueues.push(activityLinks.slice(start, end));
      }

      // Process links in parallel across all browsers
      const browserWorkers = browserPool.map(async (browser, browserIndex) => {
        const queue = browserQueues[browserIndex];
        const browserActivities = [];

        if (queue.length === 0) return browserActivities;

        this.logProgress(`Browser ${browserIndex + 1} processing ${queue.length} links`);

        // Process links in parallel using multiple tabs per browser
        const results = await this.processLinksWithPagePool(
          browser,
          browserIndex,
          widgetUrl,
          queue,
          pagesPerBrowser
        );

        browserActivities.push(...results);

        // Incremental save: save activities after processing this browser's queue
        if (this.currentProviderId && browserActivities.length > 0) {
          try {
            const normalized = await this.normalizeActivities(browserActivities);
            const batchStats = await this.saveActivitiesToDatabase(normalized, this.currentProviderId);
            this.totalStats.created += batchStats.created;
            this.totalStats.updated += batchStats.updated;
            this.totalStats.unchanged += batchStats.unchanged;
            this.totalStats.errors += batchStats.errors;
            this.logProgress(`  Browser ${browserIndex + 1} saved: ${batchStats.created} new, ${batchStats.updated} updated`);
          } catch (saveError) {
            this.logProgress(`  Browser ${browserIndex + 1} save failed: ${saveError.message}`);
          }
        }

        return browserActivities;
      });

      // Wait for all browsers to complete
      const allResults = await Promise.all(browserWorkers);
      for (const browserActivities of allResults) {
        activities.push(...browserActivities);
      }
    } finally {
      // Close all browsers in pool
      for (const browser of browserPool) {
        try {
          await browser.close();
        } catch (e) { /* ignore */ }
      }
    }

    this.logProgress(`Total activities extracted: ${activities.length}`);
    return activities;
  }

  /**
   * Process links using a pool of pages (tabs) for parallelization
   * @param {Browser} browser - Puppeteer browser instance
   * @param {Number} browserIndex - Index of this browser in the pool
   * @param {String} widgetUrl - URL of the widget page
   * @param {Array} links - Links to process
   * @param {Number} poolSize - Number of parallel tabs to use
   * @returns {Promise<Array>} - All extracted activities
   */
  async processLinksWithPagePool(browser, browserIndex, widgetUrl, links, poolSize) {
    const activities = [];
    const queue = [...links];
    let processed = 0;
    const total = links.length;

    // Worker function for each page in the pool
    const pageWorker = async () => {
      while (queue.length > 0) {
        const link = queue.shift();
        if (!link) break;

        try {
          const linkActivities = await this.extractActivitiesFromLink(widgetUrl, link, browser);
          if (linkActivities.length > 0) {
            activities.push(...linkActivities);
            this.logProgress(`  B${browserIndex + 1} ✅ ${link.text}: ${linkActivities.length} activities`);
          }
        } catch (error) {
          this.logProgress(`  B${browserIndex + 1} ❌ ${link.text}: ${error.message}`);
        }

        processed++;
        if (processed % 10 === 0 || processed === total) {
          this.logProgress(`  Browser ${browserIndex + 1} progress: ${processed}/${total}`);
        }
      }
    };

    // Start multiple page workers in parallel
    const workers = Array(Math.min(poolSize, queue.length)).fill(null).map(() => pageWorker());
    await Promise.all(workers);

    return activities;
  }

  /**
   * Discover all links on the page with their Y positions and nearby section context
   * Supports provider extensions for custom discovery logic
   */
  async discoverAllLinks(widgetUrl) {
    let browser;

    try {
      browser = await this.launchBrowserWithRetry();

      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

      // Extension hook: beforeNavigate
      if (this.extension) {
        await this.extension.beforeNavigate(page);
      }

      // Get timeout from extension or config
      const pageTimeout = this.extension?.getTimeout() || this.config.scraperConfig.timeout || 90000;
      await page.goto(widgetUrl, { waitUntil: 'networkidle2', timeout: pageTimeout });

      // Extension hook: afterNavigate
      if (this.extension) {
        await this.extension.afterNavigate(page);
      }

      // Wait for specific selector (from extension or config)
      const waitForSelector = this.extension?.getWaitSelector() || this.config.scraperConfig.waitForSelector;
      if (waitForSelector) {
        try {
          await page.waitForSelector(waitForSelector, { timeout: 30000 });
          this.logProgress(`Found selector: ${waitForSelector}`);
        } catch (e) {
          this.logProgress(`Selector ${waitForSelector} not found, continuing...`);
        }
      }

      // Use wait time from extension or config (default 8 seconds)
      const initialWaitTime = this.extension?.getWaitTime() || this.config.scraperConfig.initialWaitTime || 8000;
      await new Promise(resolve => setTimeout(resolve, initialWaitTime));

      // Extension hook: beforeDiscoverLinks
      if (this.extension) {
        await this.extension.beforeDiscoverLinks(page);
      }

      // Try extension's custom link discovery first
      if (this.extension) {
        const customLinks = await this.extension.discoverLinks(page);
        if (customLinks !== null) {
          this.logProgress(`Using extension link discovery: found ${customLinks.length} links`);
          // Extension hook: afterDiscoverLinks
          return await this.extension.afterDiscoverLinks(page, customLinks);
        }
      }

      // Get all links with positions
      const linksData = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a'));
        const results = [];

        links.forEach((link, index) => {
          const text = link.textContent?.trim() || '';
          if (!text || text.length < 3 || text.length > 100) return;

          const rect = link.getBoundingClientRect();

          // Try to find the parent box/container to understand grouping
          let boxHeader = '';
          let parent = link.parentElement;
          for (let i = 0; i < 5 && parent; i++) {
            // Look for a header element within the same container
            const header = parent.querySelector('h2, h3, h4, .header, [class*="header"], [class*="title"]:first-child');
            if (header && header.textContent?.trim()) {
              boxHeader = header.textContent.trim();
              break;
            }
            parent = parent.parentElement;
          }

          results.push({
            index,
            text,
            y: rect.y,
            x: rect.x,
            boxHeader
          });
        });

        return results;
      });

      // Find section headers (age group labels and camp types)
      // These match kids-related category boxes
      const kidsSectionKeywords = [
        /preschool/i, /children/i, /^child$/i, /\bchild\b/i, /youth/i, /teen/i,
        /family/i, /camps?/i, /early\s*years/i, /early\s*learners/i,
        /school\s*age/i, /pro[\s-]*d[\s-]*day/i, /spring\s*break/i,
        /summer/i, /winter\s*break/i, /afterschool|after\s*school/i,
        /childminding/i, /just\s*for\s*kids/i, /grown-?up/i,
        /specialized\s*programs/i, /ice\s*sports?/i, /fencing/i,
        /try\s*it/i, /playschool/i,
        // Age range patterns like "4 Months - 5 Years", "6 - 12 Years"
        /\d+\s*months?\s*[-–to]+\s*\d+/i,
        /\d+\s*[-–to]+\s*\d+\s*years?/i,
        /\d+\s*[-–to]+\s*\d+\s*yrs?/i,
        /\b[0-9]+-[0-9]+\b/
      ];

      // Determine if text matches kids section
      const isKidsSection = (text) => {
        if (!text) return false;
        return kidsSectionKeywords.some(p => p.test(text));
      };

      // For grid layouts: assign section based on the link text itself
      // If the link text contains kids-related keywords, include it
      const linksWithSections = linksData.map(link => {
        // First try the boxHeader if found
        let section = link.boxHeader || '';

        // If link text itself indicates a kids section, use it
        if (isKidsSection(link.text)) {
          section = link.text;
        }

        return { ...link, section };
      });

      // Extension hook: afterDiscoverLinks (for default discovery path)
      if (this.extension) {
        return await this.extension.afterDiscoverLinks(page, linksWithSections);
      }

      return linksWithSections;

    } finally {
      if (browser) await browser.close();
    }
  }

  /**
   * Filter links to activity links that are kids-related
   * For grid layouts, we look at the link text itself to determine if it's kids-related
   * NOTE: We're now MORE INCLUSIVE because recursive navigation will find kids subcategories
   */
  filterActivityLinks(links) {
    const activityPatterns = this.activityPatterns;
    const kidsSectionPatterns = this.kidsSectionPatterns;
    const excludePatterns = this.excludePatterns;

    return links.filter(link => {
      const text = link.text.toLowerCase();
      const section = link.section.toLowerCase();

      // Exclude certain patterns (adult-only, navigation, etc.)
      if (excludePatterns.some(p => p.test(text))) {
        return false;
      }

      // Skip 55+ adult-only programs
      if (/55\+|older\s*adult/i.test(text)) {
        return false;
      }

      // Skip explicitly adult-only programs (but not "adult & child" or family programs)
      if (/^adult$/i.test(text) && !/child|family|parent/i.test(text)) {
        return false;
      }

      // The link text must indicate a kids-related category
      // This works for grid layouts where the link text IS the category
      const textIsKidsRelated = kidsSectionPatterns.some(p => p.test(text));

      // Or it's under a kids section (for hierarchical layouts)
      const sectionIsKidsRelated = section && kidsSectionPatterns.some(p => p.test(section));

      // Check if it matches an activity pattern
      const isActivity = activityPatterns.some(p => p.test(text));

      // CHANGED: Include ALL activity links, even if not explicitly kids-related
      // The recursive navigation (findKidsSubcategories) will discover kids subcategories
      // within top-level categories like "Arts", "Sports", "Swimming", etc.
      // This is necessary because many sites organize by activity type first, then by age
      if (isActivity) {
        return true;
      }

      // Also include explicitly kids-related links even if they don't match activity patterns
      if (textIsKidsRelated || sectionIsKidsRelated) {
        return true;
      }

      return false;
    });
  }

  /**
   * Extract activities by clicking a link at a specific position
   * Handles hierarchical navigation where clicking a category reveals subcategories with "Show" buttons
   * Also handles RECURSIVE navigation when categories have subcategories (e.g., Arts -> Children (Ages 5-12))
   * @param {String} widgetUrl - URL of the widget page
   * @param {Object} linkInfo - Link information (text, section, etc.)
   * @param {Browser} sharedBrowser - Optional shared browser instance to reuse
   * @param {Number} depth - Current recursion depth (default 0, max 3)
   */
  async extractActivitiesFromLink(widgetUrl, linkInfo, sharedBrowser = null, depth = 0) {
    const MAX_DEPTH = 3; // Prevent infinite recursion
    let browser = sharedBrowser;
    let ownsBrowser = false;
    const activities = [];

    if (depth > MAX_DEPTH) {
      this.logProgress(`    Max depth ${MAX_DEPTH} reached, stopping recursion`);
      return activities;
    }

    try {
      // If no shared browser provided, launch our own (backward compatibility)
      if (!browser) {
        browser = await this.launchBrowserWithRetry();
        ownsBrowser = true;
      }

      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

      await page.goto(widgetUrl, { waitUntil: 'networkidle2', timeout: 60000 });
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Click the link by finding it by text content
      // This is more reliable than using index, since discover uses all 'a' but we want specific category links
      const linkText = linkInfo.text;
      const clicked = await page.evaluate((targetText) => {
        // First try the specific PerfectMind category selector
        const categoryLinks = Array.from(document.querySelectorAll('a.bm-category-calendar-link.enabled'));
        for (const link of categoryLinks) {
          if (link.textContent?.trim() === targetText) {
            link.click();
            return true;
          }
        }

        // Fallback to finding any matching link
        const allLinks = Array.from(document.querySelectorAll('a'));
        for (const link of allLinks) {
          if (link.textContent?.trim() === targetText) {
            link.click();
            return true;
          }
        }
        return false;
      }, linkText);

      if (!clicked) {
        await page.close();
        return activities;
      }

      // Wait for page navigation - some sites navigate to a new page after clicking
      await new Promise(resolve => setTimeout(resolve, 6000));

      // CHECK FOR SUBCATEGORIES - if we find kids-related subcategory links, recurse into them
      const subcategoryLinks = await this.findKidsSubcategories(page);

      if (subcategoryLinks.length > 0 && depth < MAX_DEPTH) {
        this.logProgress(`    Found ${subcategoryLinks.length} subcategories in "${linkText}", recursing...`);
        await page.close();

        // Recursively process each subcategory
        for (const subLink of subcategoryLinks) {
          const subActivities = await this.extractActivitiesFromLink(
            widgetUrl,
            { text: subLink, section: linkInfo.text }, // Parent category becomes the section
            browser,
            depth + 1
          );
          activities.push(...subActivities);
        }

        return activities;
      }

      // Check for hierarchical subcategory structure (like Port Moody's category pages)
      // Some sites show subcategory sections after clicking a main category, each with a "Show" button
      const subcategoryExpansion = await this.expandSubcategories(page);

      if (subcategoryExpansion.expanded > 0) {
        this.logProgress(`    Expanded ${subcategoryExpansion.expanded} subcategories`);
      }

      // Also expand any remaining "Show" buttons at the activity level
      // This handles Vernon-style pages where Show is plain text, not .bm-group-expander
      const showButtonsClicked = await page.evaluate(() => {
        let clicked = 0;
        const buttons = Array.from(document.querySelectorAll('a, button, span, div'));
        buttons.filter(el => {
          const t = el.textContent?.trim().toLowerCase() || '';
          return t === 'show' || t === 'show all';
        }).forEach(btn => {
          btn.click();
          clicked++;
        });
        return clicked;
      });

      if (showButtonsClicked > 0) {
        this.logProgress(`    Clicked ${showButtonsClicked} Show buttons`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

      // Click "Load More" button repeatedly until no more activities to load
      await this.loadAllActivities(page);

      // Extract activities
      const pageActivities = await this.extractActivitiesFromPage(page, linkInfo.section, linkInfo.text);
      activities.push(...pageActivities);

      // Close the page when done (important for shared browser to free resources)
      await page.close();

    } catch (error) {
      this.handleError(error, `extractActivitiesFromLink ${linkInfo.text}`);
    } finally {
      // Only close the browser if we own it (not shared)
      if (ownsBrowser && browser) {
        await browser.close();
      }
    }

    return activities;
  }

  /**
   * Find kids-related subcategory links on a page
   * These are links like "Children (Ages 5-12)", "Preschool (Ages 5 and Under)", "Youth (Ages 13-17)"
   * that appear after clicking a top-level category like "Arts" or "Sports"
   * @param {Page} page - Puppeteer page
   * @returns {Array<String>} - Array of subcategory link texts to click
   */
  async findKidsSubcategories(page) {
    const kidsSubcategories = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      const subcategories = [];

      // Patterns that indicate kids-related subcategories
      const kidsPatterns = [
        /children/i,
        /preschool/i,
        /pre-school/i,
        /youth/i,
        /teen/i,
        /toddler/i,
        /infant/i,
        /baby/i,
        /family/i,
        /parent.*tot/i,
        /parent.*child/i,
        /ages?\s*\d+\s*[-–to]+\s*\d+/i,  // "Ages 5-12" or "Age 5 to 12"
        /\(\s*ages?\s*\d+/i,              // "(Ages 5-12)" or "(Age 5 and Under)"
        /\d+\s*[-–to]+\s*\d+\s*(?:yrs?|years?)/i,  // "5-12 yrs" or "5 to 12 years"
        /\d+\s*(?:and\s*)?under/i,        // "5 and Under" or "5 Under"
        /school\s*age/i,
        /all\s*ages/i
      ];

      // Adult patterns to EXCLUDE
      const adultPatterns = [
        /adult\s*\(\s*(?:ages?\s*)?18\+?\s*\)/i,   // "Adult (Ages 18+)" or "Adult (18+)"
        /adult\s*\(\s*18\s*(?:and\s*)?(?:over|up)\s*\)/i,  // "Adult (18 and over)"
        /^adult$/i,
        /55\+/i,
        /senior/i,
        /older\s*adult/i
      ];

      for (const link of links) {
        const text = link.textContent?.trim() || '';
        if (!text || text.length < 3 || text.length > 100) continue;

        // Skip adult-only categories
        if (adultPatterns.some(p => p.test(text))) continue;

        // Check if it's a kids-related subcategory
        if (kidsPatterns.some(p => p.test(text))) {
          // Verify it's a clickable category link (not just any text)
          const href = link.getAttribute('href');
          const isClickable = link.onclick || (href && href !== '#' && href !== 'javascript:void(0)');
          const hasValidSelector = link.classList.contains('bm-category-calendar-link') ||
                                   link.closest('.bm-category-column') ||
                                   link.closest('[class*="category"]');

          if (isClickable || hasValidSelector) {
            subcategories.push(text);
          }
        }
      }

      return [...new Set(subcategories)]; // Dedupe
    });

    return kidsSubcategories;
  }

  /**
   * Expand subcategories on hierarchical PerfectMind pages
   * Port Moody and similar sites show subcategory groups after clicking a main category
   * Each group has a header and a "Show" button that reveals the activities
   *
   * DOM structure discovered:
   * - div.bm-group-expander-container contains the clickable area
   * - div.bm-group-expander is the clickable element
   * - span.bm-group-expander-text contains "Show" or "Hide" text
   */
  async expandSubcategories(page) {
    let totalExpanded = 0;
    const maxIterations = 10; // Safety limit

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      // Find all "Show" expander buttons using the correct PerfectMind selectors
      const showButtonCount = await page.evaluate(() => {
        // Primary selector: .bm-group-expander with "Show" text
        const expanders = document.querySelectorAll('.bm-group-expander');
        let count = 0;

        expanders.forEach(expander => {
          const textEl = expander.querySelector('.bm-group-expander-text');
          const text = textEl?.textContent?.trim().toLowerCase() || '';
          const isVisible = expander.offsetParent !== null;

          if (text === 'show' && isVisible) {
            count++;
          }
        });

        return count;
      });

      if (showButtonCount === 0) {
        break; // No more Show buttons to click
      }

      // Click all Show buttons found
      const clickedCount = await page.evaluate(() => {
        let clicked = 0;

        // Click .bm-group-expander elements where text is "Show"
        const expanders = document.querySelectorAll('.bm-group-expander');

        expanders.forEach(expander => {
          const textEl = expander.querySelector('.bm-group-expander-text');
          const text = textEl?.textContent?.trim().toLowerCase() || '';
          const isVisible = expander.offsetParent !== null;

          if (text === 'show' && isVisible) {
            expander.click();
            clicked++;
          }
        });

        return clicked;
      });

      totalExpanded += clickedCount;

      if (clickedCount === 0) {
        break; // No buttons were clicked
      }

      // Wait for content to load after clicking
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    return { expanded: totalExpanded };
  }

  /**
   * Click "Load More" button repeatedly until all activities are loaded
   * PerfectMind pages often have pagination with a "Load More" button at the bottom
   */
  async loadAllActivities(page) {
    let loadMoreClicks = 0;
    const maxClicks = 50; // Safety limit to prevent infinite loops

    while (loadMoreClicks < maxClicks) {
      // Look for "Load More" button and count current items
      const result = await page.evaluate(() => {
        const currentCount = document.querySelectorAll('.bm-group-item-row').length;

        // Find load more button - various possible selectors
        const loadMoreSelectors = [
          'a.bm-load-more',
          'button.bm-load-more',
          '[class*="load-more"]',
          'a:contains("Load More")',
          'button:contains("Load More")'
        ];

        let loadMoreBtn = null;
        for (const selector of loadMoreSelectors) {
          try {
            loadMoreBtn = document.querySelector(selector);
            if (loadMoreBtn) break;
          } catch (e) {
            // Selector not supported
          }
        }

        // Also try text-based search
        if (!loadMoreBtn) {
          const allButtons = Array.from(document.querySelectorAll('a, button'));
          loadMoreBtn = allButtons.find(el => {
            const text = el.textContent?.trim().toLowerCase() || '';
            return text === 'load more' || text === 'show more' || text === 'load more results';
          });
        }

        if (loadMoreBtn && loadMoreBtn.offsetParent !== null) {
          loadMoreBtn.click();
          return { clicked: true, count: currentCount };
        }

        return { clicked: false, count: currentCount };
      });

      if (!result.clicked) {
        // No more "Load More" button found or it's hidden
        break;
      }

      loadMoreClicks++;
      // Wait for new content to load
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check if count increased (support multiple DOM structures)
      const newCount = await page.evaluate(() => {
        let count = document.querySelectorAll('.bm-group-item-row').length;
        if (count === 0) count = document.querySelectorAll('.bm-group-header').length;
        return count;
      });

      if (newCount === result.count) {
        // Count didn't change after click, stop
        break;
      }
    }

    if (loadMoreClicks > 0) {
      this.logProgress(`    Clicked "Load More" ${loadMoreClicks} times`);
    }
  }

  async extractActivitiesFromPage(page, section, activityType) {
    const providerName = this.config.name;

    const pageActivities = await page.evaluate((section, actType, provider) => {
      const activities = [];
      // Support multiple DOM structures across different PerfectMind implementations
      // .bm-group-item-row: Used by many sites (Vancouver, Ottawa, etc.)
      // .bm-group-header: Used by Milton, Burlington, and other sites
      let itemRows = document.querySelectorAll('.bm-group-item-row');
      if (itemRows.length === 0) {
        itemRows = document.querySelectorAll('.bm-group-header');
      }

      itemRows.forEach(row => {
        try {
          const rawText = row.textContent || '';

          // Must have price or course ID
          if (!rawText.includes('$') && !rawText.includes('#')) {
            return;
          }

          // Extract name
          const nameEl = row.querySelector('.bm-group-item-name, [class*="item-name"], a[href*="courseId"]');
          let name = nameEl?.textContent?.trim() || '';

          // Extract course ID
          const courseIdEl = row.querySelector('.bm-group-item-course-id, [class*="course-id"]');
          let courseId = courseIdEl?.textContent?.trim() || '';

          if (!courseId) {
            const link = row.querySelector('a[href*="courseId"]');
            if (link) {
              // Match both numeric courseId and GUID format (e.g., courseId=e75c6fbf-6aa2-4afc-...)
              const match = link.href.match(/courseId=([a-f0-9-]+|\d+)/i);
              if (match) courseId = match[1];
            }
          }
          courseId = courseId.replace(/[#\s]/g, '');

          // Extract registration URL
          let registrationUrl = '';
          const regLink = row.querySelector('a[href*="BookMe4"], a[href*="courseId"]');
          if (regLink) {
            registrationUrl = regLink.href;
          }

          // Extract price - look for all prices and take the most appropriate
          let cost = 0;
          const allCosts = rawText.match(/\$\s*([\d,]+\.?\d*)/g) || [];
          if (allCosts.length > 0) {
            // Take the first cost (usually the base price)
            const firstCost = allCosts[0].replace(/[$,\s]/g, '');
            cost = parseFloat(firstCost) || 0;
          }
          // Handle "Free" activities
          if (/\bfree\b/i.test(rawText)) {
            cost = 0;
          }

          // Extract spots
          let spotsAvailable = null;
          let totalSpots = null;
          let registrationStatus = 'Unknown';

          const spotsMatch = rawText.match(/(\d+)\s*(?:of|\/)\s*(\d+)/i);
          if (spotsMatch) {
            spotsAvailable = parseInt(spotsMatch[1]);
            totalSpots = parseInt(spotsMatch[2]);
          }

          // IMPORTANT: Check "closed" and "cancelled" BEFORE "register" because
          // "Registration is closed" contains "register"
          if (/registration\s+(is\s+)?closed|cancelled|canceled/i.test(rawText)) {
            registrationStatus = 'Closed';
          } else if (/waitlist/i.test(rawText)) {
            registrationStatus = 'Waitlist';
          } else if (/\bfull\b/i.test(rawText) || spotsAvailable === 0) {
            registrationStatus = 'Full';
          } else if (/\bclosed\b|\bended\b/i.test(rawText)) {
            registrationStatus = 'Closed';
          } else if (/register|available|sign up|enroll/i.test(rawText)) {
            registrationStatus = 'Open';
          }

          // Extract time - comprehensive patterns
          let startTime = null;
          let endTime = null;

          // Pattern 1: "9:30am - 12:00pm" or "9:30 am - 12:00 pm"
          let timeMatch = rawText.match(/(\d{1,2}:\d{2})\s*(am|pm)\s*[-–—to]+\s*(\d{1,2}:\d{2})\s*(am|pm)/i);
          if (timeMatch) {
            startTime = `${timeMatch[1]} ${timeMatch[2].toUpperCase()}`;
            endTime = `${timeMatch[3]} ${timeMatch[4].toUpperCase()}`;
          }

          // Pattern 2: "9:30 - 12:00pm" (period at end only)
          if (!startTime) {
            timeMatch = rawText.match(/(\d{1,2}:\d{2})\s*[-–—]\s*(\d{1,2}:\d{2})\s*(am|pm)/i);
            if (timeMatch) {
              const period = timeMatch[3].toUpperCase();
              startTime = `${timeMatch[1]} ${period}`;
              endTime = `${timeMatch[2]} ${period}`;
            }
          }

          // Pattern 3: "9am - 12pm" (no minutes)
          if (!startTime) {
            timeMatch = rawText.match(/(\d{1,2})\s*(am|pm)\s*[-–—to]+\s*(\d{1,2})\s*(am|pm)/i);
            if (timeMatch) {
              startTime = `${timeMatch[1]}:00 ${timeMatch[2].toUpperCase()}`;
              endTime = `${timeMatch[3]}:00 ${timeMatch[4].toUpperCase()}`;
            }
          }

          // Extract days - comprehensive patterns
          const days = [];
          const dayMap = {
            'monday': 'Mon', 'mon': 'Mon',
            'tuesday': 'Tue', 'tue': 'Tue', 'tues': 'Tue',
            'wednesday': 'Wed', 'wed': 'Wed',
            'thursday': 'Thu', 'thu': 'Thu', 'thur': 'Thu', 'thurs': 'Thu',
            'friday': 'Fri', 'fri': 'Fri',
            'saturday': 'Sat', 'sat': 'Sat',
            'sunday': 'Sun', 'sun': 'Sun'
          };

          const lowerText = rawText.toLowerCase();
          Object.entries(dayMap).forEach(([pattern, abbrev]) => {
            if (lowerText.includes(pattern) && !days.includes(abbrev)) {
              days.push(abbrev);
            }
          });

          // Check for "M/W/F" or "M, W, F" patterns
          const mwfMatch = lowerText.match(/\b([mtwrf])[\s,\/&]+([mtwrf])(?:[\s,\/&]+([mtwrf]))?(?:[\s,\/&]+([mtwrf]))?\b/);
          if (mwfMatch) {
            const letterMap = { 'm': 'Mon', 't': 'Tue', 'w': 'Wed', 'r': 'Thu', 'f': 'Fri' };
            for (let i = 1; i <= 4; i++) {
              if (mwfMatch[i] && letterMap[mwfMatch[i]] && !days.includes(letterMap[mwfMatch[i]])) {
                days.push(letterMap[mwfMatch[i]]);
              }
            }
          }

          // Extract location
          let location = '';
          const locationEl = row.querySelector('[class*="location"], [class*="facility"], [class*="venue"]');
          if (locationEl) {
            location = locationEl.textContent?.trim() || '';
          }
          // Try to extract from text if not found
          if (!location) {
            const locMatch = rawText.match(/(?:at|@)\s+([A-Z][A-Za-z\s]+(?:Centre|Center|Arena|Pool|Rink|Park|Hall))/i);
            if (locMatch) {
              location = locMatch[1].trim();
            }
          }

          // Extract dates
          let dateStartStr = null;
          let dateEndStr = null;

          // Pattern: "Jan 6 - Mar 24" or "January 6 - March 24"
          const dateRangeMatch = rawText.match(/([A-Z][a-z]{2,8})\s+(\d{1,2})(?:st|nd|rd|th)?\s*[-–—to]+\s*([A-Z][a-z]{2,8})\s+(\d{1,2})(?:st|nd|rd|th)?(?:[,\s]+(\d{4}))?/i);
          if (dateRangeMatch) {
            const year = dateRangeMatch[5] || new Date().getFullYear();
            dateStartStr = `${dateRangeMatch[1]} ${dateRangeMatch[2]}, ${year}`;
            dateEndStr = `${dateRangeMatch[3]} ${dateRangeMatch[4]}, ${year}`;
          }

          // Pattern: "06-Jan-2026 - 29-Jan-2026" (DD-Mon-YYYY format used by some PerfectMind sites)
          if (!dateStartStr) {
            const ddMonYYYYMatch = rawText.match(/(\d{1,2})-([A-Z][a-z]{2})-(\d{4})\s*[-–—]\s*(\d{1,2})-([A-Z][a-z]{2})-(\d{4})/i);
            if (ddMonYYYYMatch) {
              dateStartStr = `${ddMonYYYYMatch[2]} ${ddMonYYYYMatch[1]}, ${ddMonYYYYMatch[3]}`;
              dateEndStr = `${ddMonYYYYMatch[5]} ${ddMonYYYYMatch[4]}, ${ddMonYYYYMatch[6]}`;
            }
          }

          // Pattern: "01/06/25 - 03/24/25"
          if (!dateStartStr) {
            const numDateMatch = rawText.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})\s*[-–—]\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/);
            if (numDateMatch) {
              dateStartStr = numDateMatch[1];
              dateEndStr = numDateMatch[2];
            }
          }

          // Extract age - comprehensive patterns
          let ageMin = null;
          let ageMax = null;

          // First check section name for age category
          const sectionLower = (section || '').toLowerCase();
          if (/early\s*years.*parent|parent.*participation|parent\s*&?\s*tot/i.test(sectionLower)) {
            ageMin = 0; ageMax = 5;
          } else if (/early\s*years|preschool|pre-school/i.test(sectionLower)) {
            ageMin = 3; ageMax = 5;
          } else if (/school\s*age|children/i.test(sectionLower)) {
            ageMin = 5; ageMax = 13;
          } else if (/youth|teen/i.test(sectionLower)) {
            ageMin = 13; ageMax = 18;
          } else if (/family|all\s*ages/i.test(sectionLower)) {
            ageMin = 0; ageMax = 99;
          }

          // Try to extract from raw text - various patterns
          if (!ageMin) {
            // "(5-12yrs)" or "(5-12 yrs)" in name
            let ageMatch = rawText.match(/\((\d+)\s*[-–]\s*(\d+)\s*(?:yrs?|years?)?\)/i);
            if (ageMatch) {
              ageMin = parseInt(ageMatch[1]);
              ageMax = parseInt(ageMatch[2]);
            }
          }

          if (!ageMin) {
            // "Ages 5-12" or "Age: 5-12"
            let ageMatch = rawText.match(/ages?\s*:?\s*(\d+)\s*[-–to]+\s*(\d+)/i);
            if (ageMatch) {
              ageMin = parseInt(ageMatch[1]);
              ageMax = parseInt(ageMatch[2]);
            }
          }

          if (!ageMin) {
            // "5 to 12 years" or "5-12 years"
            let ageMatch = rawText.match(/(\d+)\s*(?:to|-)\s*(\d+)\s*(?:yrs?|years?)/i);
            if (ageMatch) {
              ageMin = parseInt(ageMatch[1]);
              ageMax = parseInt(ageMatch[2]);
            }
          }

          // "5yrs & up" or "5+"
          if (!ageMin) {
            let ageMatch = rawText.match(/(\d+)\s*(?:yrs?|years?)?\s*(?:&|and)?\s*(?:up|older|\+)/i);
            if (ageMatch) {
              ageMin = parseInt(ageMatch[1]);
              ageMax = 18;
            }
          }

          // Cap age at 18 for children's activities
          if (ageMax && ageMax > 18) ageMax = 18;

          if (name || courseId) {
            activities.push({
              name: name || actType,
              courseId,
              externalId: courseId,
              section: section || actType,
              activityType: actType,
              category: section || actType,
              subcategory: actType,
              cost,
              spotsAvailable,
              totalSpots,
              registrationStatus,
              registrationUrl,
              startTime,
              endTime,
              daysOfWeek: days.length > 0 ? days : null,
              dayOfWeek: days.length > 0 ? days : [],
              location,
              locationName: location,
              ageMin,
              ageMax,
              dateStartStr,
              dateEndStr,
              rawText,
              provider
            });
          }
        } catch (err) {
          // Skip row
        }
      });

      return activities;
    }, section, activityType, providerName);

    return pageActivities;
  }

  async normalizeActivities(rawActivities) {
    const fieldMapping = this.getPerfectMindFieldMapping();
    const normalized = [];

    for (const rawActivity of rawActivities) {
      try {
        const normalizedActivity = DataNormalizer.normalizeActivity(
          rawActivity,
          fieldMapping,
          this.config
        );

        const validation = this.validateActivityData(normalizedActivity);
        if (validation.isValid) {
          normalized.push(normalizedActivity);
        }
      } catch (error) {
        this.handleError(error, `normalizing activity ${rawActivity.name}`);
      }
    }

    this.logProgress(`Normalized ${normalized.length}/${rawActivities.length} activities`);
    return normalized;
  }

  getPerfectMindFieldMapping() {
    return {
      name: 'name',
      externalId: { path: 'courseId', transform: (val, raw) => val || generateStableActivityId(raw) },
      category: 'section',
      subcategory: 'activityType',
      cost: 'cost',
      spotsAvailable: 'spotsAvailable',
      totalSpots: 'totalSpots',
      registrationStatus: 'registrationStatus',
      registrationUrl: 'registrationUrl',
      locationName: 'location',
      fullAddress: 'fullAddress',
      latitude: 'latitude',
      longitude: 'longitude',
      startTime: 'startTime',
      endTime: 'endTime',
      daysOfWeek: 'daysOfWeek',
      ageMin: 'ageMin',
      ageMax: 'ageMax',
      // Dates - check for pre-parsed Date (from enhancement) or parse from string
      dateStart: {
        paths: ['dateStart', 'dateStartStr'],
        transform: (val) => {
          if (!val) return null;
          if (val instanceof Date) return val;
          try {
            // Handle date formats: MM/DD/YY, MM/DD/YYYY, DD/MM/YYYY
            const slashMatch = String(val).match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
            if (slashMatch) {
              const first = parseInt(slashMatch[1]);
              const second = parseInt(slashMatch[2]);
              let year = parseInt(slashMatch[3]);
              if (year < 100) year += 2000; // Convert 25 to 2025

              // If first number > 12, it must be DD/MM format (European)
              if (first > 12) {
                const day = first;
                const month = second - 1;
                return new Date(year, month, day);
              }
              // Otherwise assume MM/DD format (North American)
              const month = first - 1;
              const day = second;
              return new Date(year, month, day);
            }
            // Handle ISO format YYYY-MM-DD
            const isoMatch = String(val).match(/^(\d{4})-(\d{2})-(\d{2})/);
            if (isoMatch) {
              return new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]));
            }
            // Fallback to standard Date parsing
            const date = new Date(val);
            return isNaN(date.getTime()) ? null : date;
          } catch (e) {
            return null;
          }
        }
      },
      dateEnd: {
        paths: ['dateEnd', 'dateEndStr'],
        transform: (val) => {
          if (!val) return null;
          if (val instanceof Date) return val;
          try {
            // Handle date formats: MM/DD/YY, MM/DD/YYYY, DD/MM/YYYY
            const slashMatch = String(val).match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
            if (slashMatch) {
              const first = parseInt(slashMatch[1]);
              const second = parseInt(slashMatch[2]);
              let year = parseInt(slashMatch[3]);
              if (year < 100) year += 2000; // Convert 25 to 2025

              // If first number > 12, it must be DD/MM format (European)
              if (first > 12) {
                const day = first;
                const month = second - 1;
                return new Date(year, month, day);
              }
              // Otherwise assume MM/DD format (North American)
              const month = first - 1;
              const day = second;
              return new Date(year, month, day);
            }
            // Handle ISO format YYYY-MM-DD
            const isoMatch = String(val).match(/^(\d{4})-(\d{2})-(\d{2})/);
            if (isoMatch) {
              return new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]));
            }
            // Fallback to standard Date parsing
            const date = new Date(val);
            return isNaN(date.getTime()) ? null : date;
          } catch (e) {
            return null;
          }
        }
      },
      dayOfWeek: 'dayOfWeek',
      // Additional fields
      description: 'description',
      fullDescription: 'fullDescription',
      whatToBring: 'whatToBring',
      prerequisites: 'prerequisites',
      hasPrerequisites: 'hasPrerequisites',
      courseDetails: 'courseDetails',
      contactInfo: 'contactInfo',
      instructor: 'instructor',
      sessionCount: 'sessionCount',
      hasMultipleSessions: 'hasMultipleSessions'
    };
  }

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
   * Enhance activities with location data by fetching detail pages
   * Uses browser pool for parallelization when handling 1000+ activities
   * Extracts: latitude, longitude, full address, city, postal code
   * @param {Array} activities - Raw activities
   * @returns {Array} - Activities with complete data
   */
  async enhanceWithLocationData(activities) {
    const fetchDetails = this.config.scraperConfig.fetchDetailPages !== false;

    if (!fetchDetails) {
      this.logProgress('Detail page fetching disabled, skipping enhancement');
      return activities;
    }

    // Skip detail fetching for very large datasets (>5000 activities)
    // These cause browser crashes and timeouts - the extracted data is sufficient
    const maxActivitiesForDetails = this.config.scraperConfig.maxActivitiesForDetails || 5000;
    if (activities.length > maxActivitiesForDetails) {
      this.logProgress(`Skipping detail fetching for ${activities.length} activities (threshold: ${maxActivitiesForDetails})`);
      this.logProgress('Extracted data is sufficient for large datasets');
      return activities;
    }

    // Only fetch details for activities with registration URLs
    const activitiesWithUrls = activities.filter(a => a.registrationUrl);

    if (activitiesWithUrls.length === 0) {
      this.logProgress('No activities with registration URLs to enhance');
      return activities;
    }

    this.logProgress(`Enhancing ${activitiesWithUrls.length} activities with detail page data...`);

    // Use browser pool for large datasets (1000+ activities)
    const browserCount = activitiesWithUrls.length >= 500 ? 3 : 1;
    const batchSize = activitiesWithUrls.length >= 500 ? 15 : 10; // Larger batches for big datasets
    const browserRestartInterval = 50; // Restart browser every N pages to prevent timeouts

    this.logProgress(`  Using ${browserCount} browser(s), batch size ${batchSize}`);

    // Initialize browser pool
    const browsers = [];
    const pageCounters = [];
    try {
      for (let i = 0; i < browserCount; i++) {
        const browser = await this.launchBrowserWithRetry();
        browsers.push(browser);
        pageCounters.push(0);
      }

      let enhanced = 0;
      let withCoords = 0;
      let withDates = 0;
      let withTimes = 0;

      // Create work queue
      const queue = activitiesWithUrls.map((a, i) => ({ activity: a, index: i }));
      const results = new Map();

      // Worker function for each browser
      const processWithBrowser = async (browserIndex) => {
        while (queue.length > 0) {
          // Get next batch of work
          const workBatch = [];
          for (let i = 0; i < Math.ceil(batchSize / browserCount) && queue.length > 0; i++) {
            workBatch.push(queue.shift());
          }
          if (workBatch.length === 0) break;

          // Check if browser needs restart
          if (pageCounters[browserIndex] >= browserRestartInterval) {
            try {
              await browsers[browserIndex].close();
            } catch (e) { /* ignore */ }
            browsers[browserIndex] = await this.launchBrowserWithRetry();
            pageCounters[browserIndex] = 0;
            this.logProgress(`  Browser ${browserIndex + 1} restarted`);
          }

          const browser = browsers[browserIndex];

          // Process batch
          const batchResults = await Promise.all(
            workBatch.map(async ({ activity, index }) => {
              const page = await browser.newPage();
            try {
              await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
              await page.goto(activity.registrationUrl, { waitUntil: 'networkidle2', timeout: 30000 });

              // Wait for page to render (reduced for faster processing)
              await new Promise(r => setTimeout(r, 1500));

              // Extract comprehensive data from the page
              const detailData = await page.evaluate(() => {
                const pageHtml = document.documentElement.outerHTML;
                const pageText = document.body.innerText;
                const data = {};

                // === LOCATION COORDINATES ===
                const latMatch = pageHtml.match(/["']Latitude["']\s*:\s*(-?\d+\.\d+)/i);
                const lngMatch = pageHtml.match(/["']Longitude["']\s*:\s*(-?\d+\.\d+)/i);
                if (latMatch && lngMatch) {
                  data.latitude = parseFloat(latMatch[1]);
                  data.longitude = parseFloat(lngMatch[1]);
                }

                // === LOCATION NAME & ADDRESS ===
                const cityMatch = pageHtml.match(/["']City["']\s*:\s*["']([^"']+)["']/i);
                if (cityMatch && cityMatch[1].trim()) {
                  data.city = cityMatch[1].trim();
                }

                const postalMatch = pageHtml.match(/["']PostalCode["']\s*:\s*["']([A-Z]\d[A-Z]\s?\d[A-Z]\d)[\s"']/i);
                if (postalMatch) {
                  data.postalCode = postalMatch[1].trim().toUpperCase();
                }

                const streetMatch = pageHtml.match(/["']Street["']\s*:\s*["']([^"']+)["']/i);
                if (streetMatch && streetMatch[1].trim()) {
                  data.fullAddress = streetMatch[1].trim();
                }

                const locMatch = pageHtml.match(/["']ActualLocation["']\s*:\s*["']([^"']+)["']/i);
                if (locMatch && locMatch[1].trim()) {
                  data.locationName = locMatch[1].trim();
                }

                // Also try to extract location from visible text (appears before "Show Map")
                if (!data.locationName) {
                  const locTextMatch = pageText.match(/\n([A-Z][A-Za-z\s]+(?:Centre|Center|Arena|Pool|Rink|Hall|Pavilion|Complex|Facility|Park))\s*\n?\s*Show Map/i);
                  if (locTextMatch) {
                    data.locationName = locTextMatch[1].trim();
                  }
                }

                // === DATES ===
                // PerfectMind formats dates as "StartDate":"2025-01-15T00:00:00" or similar
                const startDateMatch = pageHtml.match(/["']StartDate["']\s*:\s*["'](\d{4}-\d{2}-\d{2})/i);
                const endDateMatch = pageHtml.match(/["']EndDate["']\s*:\s*["'](\d{4}-\d{2}-\d{2})/i);
                if (startDateMatch) data.dateStartStr = startDateMatch[1];
                if (endDateMatch) data.dateEndStr = endDateMatch[1];

                // Also look for visible date ranges "Jan 6, 2026 - Mar 24, 2026"
                // IMPORTANT: Run fallback if EITHER dateStartStr OR dateEndStr is missing
                const dateRangeMatch = pageText.match(/([A-Z][a-z]{2}\s+\d{1,2},?\s*\d{4})\s*(?:to|-)\s*([A-Z][a-z]{2}\s+\d{1,2},?\s*\d{4})/i);
                if (dateRangeMatch && (!data.dateStartStr || !data.dateEndStr)) {
                  if (!data.dateStartStr) data.dateStartStr = dateRangeMatch[1];
                  if (!data.dateEndStr) data.dateEndStr = dateRangeMatch[2];
                }

                // DD-Mon-YYYY format (e.g., "06-Jan-2026 - 29-Jan-2026") used by Surrey, etc.
                if (!data.dateStartStr || !data.dateEndStr) {
                  const ddMonYYYYMatch = pageText.match(/(\d{1,2})-([A-Z][a-z]{2})-(\d{4})\s*[-–—]\s*(\d{1,2})-([A-Z][a-z]{2})-(\d{4})/i);
                  if (ddMonYYYYMatch) {
                    if (!data.dateStartStr) data.dateStartStr = `${ddMonYYYYMatch[2]} ${ddMonYYYYMatch[1]}, ${ddMonYYYYMatch[3]}`;
                    if (!data.dateEndStr) data.dateEndStr = `${ddMonYYYYMatch[5]} ${ddMonYYYYMatch[4]}, ${ddMonYYYYMatch[6]}`;
                  }
                }

                // Also try MM/DD/YY format commonly used by PerfectMind (e.g., "11/02/25 - 12/14/25")
                if (!data.dateStartStr || !data.dateEndStr) {
                  const mmddyyMatch = pageText.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})\s*-\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/);
                  if (mmddyyMatch) {
                    if (!data.dateStartStr) data.dateStartStr = mmddyyMatch[1];
                    if (!data.dateEndStr) data.dateEndStr = mmddyyMatch[2];
                  }
                }

                // === TIMES ===
                const startTimeMatch = pageHtml.match(/["']StartTime["']\s*:\s*["']([^"']+)["']/i);
                const endTimeMatch = pageHtml.match(/["']EndTime["']\s*:\s*["']([^"']+)["']/i);
                if (startTimeMatch) data.startTime = startTimeMatch[1];
                if (endTimeMatch) data.endTime = endTimeMatch[1];

                // Also extract from visible text like "9:00 AM - 12:00 PM"
                const timeMatch = pageText.match(/(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))\s*(?:to|-)\s*(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))/i);
                if (timeMatch && !data.startTime) {
                  data.startTime = timeMatch[1];
                  data.endTime = timeMatch[2];
                }

                // === DAY OF WEEK ===
                const daysMatch = pageHtml.match(/["']DayOfWeek["']\s*:\s*["']([^"']+)["']/i) ||
                                  pageHtml.match(/["']Days["']\s*:\s*["']([^"']+)["']/i);
                if (daysMatch) {
                  data.dayOfWeekStr = daysMatch[1];
                }

                // Extract from visible text - handle both full and abbreviated day names
                const fullDayPatterns = pageText.match(/(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)s?/gi);
                if (fullDayPatterns && fullDayPatterns.length > 0) {
                  data.dayOfWeek = [...new Set(fullDayPatterns.map(d => d.replace(/s$/i, '')))];
                }

                // Also check for abbreviated days in Course Dates section (e.g., "Sun\t12/14/25")
                if (!data.dayOfWeek || data.dayOfWeek.length === 0) {
                  const shortDayMap = { 'Mon': 'Monday', 'Tue': 'Tuesday', 'Wed': 'Wednesday', 'Thu': 'Thursday', 'Fri': 'Friday', 'Sat': 'Saturday', 'Sun': 'Sunday' };
                  const shortDayPatterns = pageText.match(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/g);
                  if (shortDayPatterns && shortDayPatterns.length > 0) {
                    data.dayOfWeek = [...new Set(shortDayPatterns.map(d => shortDayMap[d] || d))];
                  }
                }

                // Check for "Every Sun" or "Every Monday" patterns
                const everyDayMatch = pageText.match(/Every\s+(Mon|Tue|Wed|Thu|Fri|Sat|Sun|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/gi);
                if (everyDayMatch && (!data.dayOfWeek || data.dayOfWeek.length === 0)) {
                  const shortDayMap = { 'Mon': 'Monday', 'Tue': 'Tuesday', 'Wed': 'Wednesday', 'Thu': 'Thursday', 'Fri': 'Friday', 'Sat': 'Saturday', 'Sun': 'Sunday' };
                  data.dayOfWeek = everyDayMatch.map(m => {
                    const day = m.replace(/Every\s+/i, '');
                    return shortDayMap[day] || day;
                  });
                }

                // === AGE RANGE ===
                const ageMinMatch = pageHtml.match(/["']MinAge["']\s*:\s*(\d+)/i) ||
                                    pageHtml.match(/["']AgeMin["']\s*:\s*(\d+)/i);
                const ageMaxMatch = pageHtml.match(/["']MaxAge["']\s*:\s*(\d+)/i) ||
                                    pageHtml.match(/["']AgeMax["']\s*:\s*(\d+)/i);
                if (ageMinMatch) data.ageMin = parseInt(ageMinMatch[1]);
                if (ageMaxMatch) data.ageMax = parseInt(ageMaxMatch[1]);

                // Extract from visible text - handle PerfectMind format like "9 to 13 y 11m" or "Age Restriction 9 to 13"
                if (!data.ageMin) {
                  // First try "Age Restriction X to Y" pattern used by PerfectMind
                  const ageRestrictionMatch = pageText.match(/Age\s*Restriction\s*(\d+)\s*(?:to|-)\s*(\d+)/i);
                  if (ageRestrictionMatch) {
                    data.ageMin = parseInt(ageRestrictionMatch[1]);
                    data.ageMax = parseInt(ageRestrictionMatch[2]);
                  } else {
                    // Try general patterns like "Ages 6-12" or "4 to 8 years"
                    const ageRangeMatch = pageText.match(/(?:Ages?\s*)?(\d+)\s*(?:to|-)\s*(\d+)\s*(?:y(?:rs?|ears?)?|months?)?/i);
                    if (ageRangeMatch) {
                      data.ageMin = parseInt(ageRangeMatch[1]);
                      data.ageMax = parseInt(ageRangeMatch[2]);
                    }
                  }
                }

                // === COST ===
                // Check for free activities first
                if (/\bFree\b/i.test(pageText) && !/\bFree\s+(?:parking|wifi|access)/i.test(pageText)) {
                  // Look for "Free" near enrollment/price indicators
                  const freeMatch = pageText.match(/(?:Enroll|Register|Price|Fee|Cost)[^\n]*\bFree\b|\bFree\b[^\n]*(?:Enroll|Register)/i);
                  if (freeMatch || /^\s*Free\s*$/im.test(pageText)) {
                    data.cost = 0;
                  }
                }

                if (data.cost === undefined) {
                  const feeMatch = pageHtml.match(/["']Fee["']\s*:\s*(\d+(?:\.\d{2})?)/i) ||
                                   pageHtml.match(/["']Price["']\s*:\s*(\d+(?:\.\d{2})?)/i);
                  if (feeMatch) data.cost = parseFloat(feeMatch[1]);

                  // Extract from visible "$XX.XX"
                  const costMatch = pageText.match(/\$(\d+(?:,\d{3})*(?:\.\d{2})?)/);
                  if (costMatch && !data.cost) {
                    data.cost = parseFloat(costMatch[1].replace(/,/g, ''));
                  }
                }

                // === DESCRIPTION ===
                const descMatch = pageHtml.match(/["']Description["']\s*:\s*["']([^"]{50,})["']/i);
                if (descMatch) {
                  data.description = descMatch[1].substring(0, 500); // Short description
                  data.fullDescription = descMatch[1].substring(0, 5000); // Full description
                }

                // Also try to get description from visible text
                if (!data.description) {
                  // PerfectMind uses "About this Course" section
                  const descTextMatch = pageText.match(/(?:Description|About this (?:program|class|activity|Course))\s*[:\n]?\s*(.+?)(?=\n\s*(?:[A-Z][A-Za-z\s]+(?:Centre|Center|Arena|Pool|Rink)|Instructor|What to Bring|Prerequisites|Requirements|Registration|Course ID|Show Map|$))/si);
                  if (descTextMatch) {
                    data.description = descTextMatch[1].trim().substring(0, 500);
                    data.fullDescription = descTextMatch[1].trim().substring(0, 5000);
                  }
                }

                // === WHAT TO BRING ===
                const whatToBringMatch = pageHtml.match(/["'](?:WhatToBring|ItemsToBring|EquipmentNeeded)["']\s*:\s*["']([^"]+)["']/i);
                if (whatToBringMatch) {
                  data.whatToBring = whatToBringMatch[1].trim().substring(0, 1000);
                }

                // Also try visible text
                if (!data.whatToBring) {
                  const bringTextMatch = pageText.match(/(?:What to Bring|Bring|Equipment Required|Items to Bring|Please Bring)\s*[:\n]\s*(.+?)(?=\n\s*(?:Description|Instructor|Registration|Prerequisites|$))/si);
                  if (bringTextMatch) {
                    data.whatToBring = bringTextMatch[1].trim().substring(0, 1000);
                  }
                }

                // === PREREQUISITES ===
                const prereqJsonMatch = pageHtml.match(/["'](?:Prerequisites|Requirements)["']\s*:\s*["']([^"]+)["']/i);
                if (prereqJsonMatch) {
                  data.prerequisites = prereqJsonMatch[1].trim().substring(0, 1000);
                  data.hasPrerequisites = true;
                }

                // Also try visible text
                if (!data.prerequisites) {
                  const prereqTextMatch = pageText.match(/(?:Prerequisites?|Requirements?|Required Skills?|Must have)\s*[:\n]\s*(.+?)(?=\n\s*(?:Description|Instructor|Registration|What to Bring|$))/si);
                  if (prereqTextMatch) {
                    data.prerequisites = prereqTextMatch[1].trim().substring(0, 1000);
                    data.hasPrerequisites = true;
                  }
                }

                // === COURSE DETAILS / NOTES ===
                const notesJsonMatch = pageHtml.match(/["'](?:Notes|CourseDetails|AdditionalInfo)["']\s*:\s*["']([^"]+)["']/i);
                if (notesJsonMatch) {
                  data.courseDetails = notesJsonMatch[1].trim().substring(0, 2000);
                }

                // Also try visible text
                if (!data.courseDetails) {
                  const notesTextMatch = pageText.match(/(?:Notes?|Additional Information|Course Details?|Important Information)\s*[:\n]\s*(.+?)(?=\n\s*(?:Description|Instructor|Registration|Prerequisites|What to Bring|$))/si);
                  if (notesTextMatch) {
                    data.courseDetails = notesTextMatch[1].trim().substring(0, 2000);
                  }
                }

                // === CONTACT INFO ===
                const contactJsonMatch = pageHtml.match(/["'](?:ContactInfo|Contact|Email|Phone)["']\s*:\s*["']([^"]+)["']/i);
                if (contactJsonMatch) {
                  data.contactInfo = contactJsonMatch[1].trim().substring(0, 500);
                }

                // Also try to extract email/phone from text
                if (!data.contactInfo) {
                  const emailMatch = pageText.match(/[\w.-]+@[\w.-]+\.\w+/);
                  const phoneMatch = pageText.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
                  if (emailMatch || phoneMatch) {
                    const contactTextMatch = pageText.match(/(?:Contact|Questions\?|For more information)\s*[:\n]?\s*(.+?)(?=\n\s*(?:Description|Instructor|Registration|$))/si);
                    if (contactTextMatch) {
                      data.contactInfo = contactTextMatch[1].trim().substring(0, 500);
                    }
                  }
                }

                // === INSTRUCTOR ===
                const instructorMatch = pageHtml.match(/["']Instructor["']\s*:\s*["']([^"']+)["']/i) ||
                                        pageText.match(/Instructor[:\s]+([^\n]+)/i);
                if (instructorMatch) {
                  data.instructor = instructorMatch[1].trim();
                }

                // === COURSE ID ===
                // Extract numeric course ID from visible text (e.g., "Course ID 00469927")
                const courseIdTextMatch = pageText.match(/Course\s*ID\s*[:\s]*(\d{5,10})/i);
                if (courseIdTextMatch) {
                  data.courseId = courseIdTextMatch[1];
                }

                // === SESSIONS ===
                const sessionsMatch = pageHtml.match(/["']NumberOfSessions["']\s*:\s*(\d+)/i) ||
                                      pageText.match(/(\d+)\s*sessions?/i);
                if (sessionsMatch) {
                  data.sessionCount = parseInt(sessionsMatch[1]);
                }

                // === REGISTRATION STATUS ===
                const spotsMatch = pageHtml.match(/["']SpotsAvailable["']\s*:\s*(\d+)/i) ||
                                   pageHtml.match(/["']AvailableSpots["']\s*:\s*(\d+)/i);
                if (spotsMatch) {
                  data.spotsAvailable = parseInt(spotsMatch[1]);
                }

                // Determine status from visible text
                // IMPORTANT: Check "closed" and "cancelled" BEFORE "register" because
                // "Registration is closed" contains "register"
                // Also check "waitlist" before "full" because "FULL - Waitlist Available" should be Waitlist
                const statusText = pageText.toLowerCase();
                if (statusText.includes('registration is closed') || statusText.includes('registration closed')) {
                  data.registrationStatus = 'Closed';
                } else if (statusText.includes('cancelled') || statusText.includes('canceled')) {
                  data.registrationStatus = 'Closed';
                } else if (statusText.includes('waitlist')) {
                  data.registrationStatus = 'Waitlist';
                } else if (statusText.includes('full') && !statusText.includes('not full')) {
                  data.registrationStatus = 'Full';
                } else if (statusText.includes('closed')) {
                  data.registrationStatus = 'Closed';
                } else if (statusText.includes('register') || statusText.includes('available') || statusText.includes('sign up')) {
                  data.registrationStatus = 'Open';
                }

                return data;
              });

              await page.close();

              // Parse dates - handles ISO format, MM/DD/YY, DD/MM/YY, and text formats
              // useDDMM parameter allows forcing DD/MM format for certain providers
              const parseDate = (dateStr, useDDMM = false) => {
                if (!dateStr) return null;
                try {
                  // Try slash format: could be MM/DD/YY or DD/MM/YY
                  const slashMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
                  if (slashMatch) {
                    const first = parseInt(slashMatch[1]);
                    const second = parseInt(slashMatch[2]);
                    let year = parseInt(slashMatch[3]);
                    if (year < 100) year += 2000; // Convert 25 to 2025

                    // If first > 12, it must be DD/MM (day can't be > 12 if it's month)
                    // Or if useDDMM is true, use DD/MM format
                    if (first > 12 || useDDMM) {
                      return new Date(year, second - 1, first); // DD/MM/YYYY
                    }
                    // Default to MM/DD (North American)
                    return new Date(year, first - 1, second); // MM/DD/YYYY
                  }
                  const date = new Date(dateStr);
                  return isNaN(date.getTime()) ? null : date;
                } catch {
                  return null;
                }
              };

              // Smart date parsing: try MM/DD first, if end < start, try DD/MM
              const parseDatePair = (startStr, endStr) => {
                // Try MM/DD format first
                let start = parseDate(startStr, false);
                let end = parseDate(endStr, false);

                // If end date is before start date, try DD/MM format
                if (start && end && end < start) {
                  const startDDMM = parseDate(startStr, true);
                  const endDDMM = parseDate(endStr, true);
                  if (startDDMM && endDDMM && endDDMM >= startDDMM) {
                    return { start: startDDMM, end: endDDMM };
                  }
                }

                return { start, end };
              };

              // Normalize time
              const normalizeTime = (timeStr) => {
                if (!timeStr) return null;
                return timeStr.toLowerCase().replace(/\s+/g, ' ').trim();
              };

              // Parse dates using smart DD/MM vs MM/DD detection
              const parsedDates = parseDatePair(detailData.dateStartStr, detailData.dateEndStr);

              // Merge data with activity
              return {
                index,
                result: {
                  ...activity,
                  // Course ID (numeric ID from detail page overrides GUID from URL)
                  courseId: detailData.courseId || activity.courseId,
                  // Location
                  latitude: detailData.latitude || activity.latitude,
                  longitude: detailData.longitude || activity.longitude,
                  city: detailData.city || activity.city,
                  postalCode: detailData.postalCode || activity.postalCode,
                  fullAddress: detailData.fullAddress || activity.fullAddress,
                  locationName: detailData.locationName || activity.location || activity.locationName,
                  // Dates (using smart DD/MM detection)
                  dateStart: parsedDates.start || activity.dateStart,
                  dateEnd: parsedDates.end || activity.dateEnd,
                  // Times
                  startTime: normalizeTime(detailData.startTime) || activity.startTime,
                  endTime: normalizeTime(detailData.endTime) || activity.endTime,
                  // Days
                  dayOfWeek: detailData.dayOfWeek || activity.dayOfWeek || [],
                  // Age
                  ageMin: detailData.ageMin ?? activity.ageMin,
                  ageMax: detailData.ageMax ?? activity.ageMax,
                  // Cost
                  cost: detailData.cost ?? activity.cost ?? null,
                  // Description (short and full)
                  description: detailData.description || activity.description,
                  fullDescription: detailData.fullDescription || activity.fullDescription,
                  // What to Bring
                  whatToBring: detailData.whatToBring || activity.whatToBring,
                  // Prerequisites
                  prerequisites: detailData.prerequisites || activity.prerequisites,
                  hasPrerequisites: detailData.hasPrerequisites || activity.hasPrerequisites || false,
                  // Course Details / Notes
                  courseDetails: detailData.courseDetails || activity.courseDetails,
                  // Contact Info
                  contactInfo: detailData.contactInfo || activity.contactInfo,
                  // Instructor
                  instructor: detailData.instructor || activity.instructor,
                  // Sessions
                  sessionCount: detailData.sessionCount || activity.sessionCount || 0,
                  hasMultipleSessions: (detailData.sessionCount || 0) > 1,
                  spotsAvailable: detailData.spotsAvailable ?? activity.spotsAvailable,
                  // Registration
                  registrationStatus: detailData.registrationStatus || activity.registrationStatus || 'Unknown'
                }
              };
            } catch (error) {
              await page.close();
              return { index, result: activity }; // Return original on error
            }
          })
        );

          // Store results and update counters
          for (const { index, result } of batchResults) {
            results.set(index, result);
            enhanced++;
            pageCounters[browserIndex]++;
            if (result.latitude) withCoords++;
            if (result.dateStart) withDates++;
            if (result.startTime) withTimes++;
          }

          // Log progress periodically
          const totalProcessed = results.size;
          if (totalProcessed % 50 === 0 || totalProcessed === activitiesWithUrls.length) {
            const pct = ((totalProcessed / activitiesWithUrls.length) * 100).toFixed(0);
            this.logProgress(`  Progress: ${totalProcessed}/${activitiesWithUrls.length} (${pct}%)`);
          }

          // Small rate limit between batches (reduced from 1000ms)
          await new Promise(r => setTimeout(r, 500));
        }
      };

      // Run workers in parallel (one per browser)
      const workers = Array(browserCount).fill(null).map((_, i) => processWithBrowser(i));
      await Promise.all(workers);

      // Update activities array with results
      for (let i = 0; i < activitiesWithUrls.length; i++) {
        const enhanced = results.get(i);
        if (enhanced) {
          const idx = activities.findIndex(a => a.registrationUrl === activitiesWithUrls[i].registrationUrl);
          if (idx >= 0) {
            activities[idx] = enhanced;
          }
        }
      }

      this.logProgress(`Detail enhancement complete:`);
      this.logProgress(`  - ${enhanced} activities processed`);
      this.logProgress(`  - ${withCoords} with coordinates`);
      this.logProgress(`  - ${withDates} with dates`);
      this.logProgress(`  - ${withTimes} with times`);
    } finally {
      // Close all browsers in the pool
      for (const browser of browsers) {
        try {
          await browser.close();
        } catch (e) { /* ignore */ }
      }
    }

    return activities;
  }
}

module.exports = PerfectMindScraper;
