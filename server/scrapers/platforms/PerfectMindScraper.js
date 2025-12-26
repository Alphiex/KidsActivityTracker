const BaseScraper = require('../base/BaseScraper');
const DataNormalizer = require('../base/DataNormalizer');
const puppeteer = require('puppeteer');

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
      /just\s*for\s*kids/i, /grown-?up/i, /specialized\s*programs/i
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

      const rawActivities = await this.extractPerfectMindActivities();

      // Enhance activities with location data from detail pages
      const enhancedActivities = await this.enhanceWithLocationData(rawActivities);

      const normalizedActivities = await this.normalizeActivities(enhancedActivities);
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

  async extractPerfectMindActivities() {
    const activities = [];
    const { entryPoints, maxConcurrency = 5 } = this.config.scraperConfig;

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

    // Process in batches
    const batches = [];
    for (let i = 0; i < activityLinks.length; i += maxConcurrency) {
      batches.push(activityLinks.slice(i, i + maxConcurrency));
    }

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      this.logProgress(`Processing batch ${batchIndex + 1}/${batches.length}`);

      const batchPromises = batch.map(link =>
        this.extractActivitiesFromLink(widgetUrl, link)
      );

      const batchResults = await Promise.allSettled(batchPromises);

      batchResults.forEach((result, idx) => {
        if (result.status === 'fulfilled' && result.value.length > 0) {
          activities.push(...result.value);
          this.logProgress(`  ✅ ${batch[idx].text} (${batch[idx].section}): ${result.value.length} activities`);
        } else if (result.status === 'rejected') {
          this.logProgress(`  ❌ ${batch[idx].text}: ${result.reason}`);
        }
      });
    }

    this.logProgress(`Total activities extracted: ${activities.length}`);
    return activities;
  }

  /**
   * Discover all links on the page with their Y positions and nearby section context
   * Supports provider extensions for custom discovery logic
   */
  async discoverAllLinks(widgetUrl) {
    let browser;

    try {
      browser = await puppeteer.launch({
        headless: this.config.scraperConfig.headless !== false,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
      });

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
        /try\s*it/i, /playschool/i
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

      // The link text must indicate a kids-related category
      // This works for grid layouts where the link text IS the category
      const textIsKidsRelated = kidsSectionPatterns.some(p => p.test(text));

      // Or it's under a kids section (for hierarchical layouts)
      const sectionIsKidsRelated = section && kidsSectionPatterns.some(p => p.test(section));

      // Check if it matches an activity pattern
      const isActivity = activityPatterns.some(p => p.test(text));

      // For grid layout pages (like Abbotsford): if the link matches an activity pattern,
      // include it even if it's not explicitly kids-related. Activities within will be
      // filtered by age during extraction. This is more inclusive to avoid missing categories.
      // Only require kids-related match for hierarchical layouts where section is set.
      if (isActivity) {
        // If we have a section context, require kids-related match
        if (section && !sectionIsKidsRelated && !textIsKidsRelated) {
          return false;
        }
        return true;
      }

      return false;
    });
  }

  /**
   * Extract activities by clicking a link at a specific position
   * Handles hierarchical navigation where clicking a category reveals subcategories with "Show" buttons
   */
  async extractActivitiesFromLink(widgetUrl, linkInfo) {
    let browser;
    const activities = [];

    try {
      browser = await puppeteer.launch({
        headless: this.config.scraperConfig.headless !== false,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
      });

      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

      await page.goto(widgetUrl, { waitUntil: 'networkidle2', timeout: 60000 });
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Click the link at specific index using the same selector that discovered it
      // Use the category-specific selector (a.bm-category-calendar-link.enabled) not all 'a' elements
      const categorySelector = 'a.bm-category-calendar-link.enabled';
      const clicked = await page.evaluate((selector, linkIndex) => {
        const links = Array.from(document.querySelectorAll(selector));
        if (links[linkIndex]) {
          links[linkIndex].click();
          return true;
        }
        return false;
      }, categorySelector, linkInfo.index);

      if (!clicked) {
        return activities;
      }

      await new Promise(resolve => setTimeout(resolve, 4000));

      // Check for hierarchical subcategory structure (like Port Moody's category pages)
      // Some sites show subcategory sections after clicking a main category, each with a "Show" button
      const subcategoryExpansion = await this.expandSubcategories(page);

      if (subcategoryExpansion.expanded > 0) {
        this.logProgress(`    Expanded ${subcategoryExpansion.expanded} subcategories`);
      }

      // Also expand any remaining "Show" buttons at the activity level
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('a, button, span'));
        buttons.filter(el => {
          const t = el.textContent?.trim().toLowerCase() || '';
          return t === 'show' || t === 'show all' || t.includes('show more');
        }).forEach(btn => btn.click());
      });
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Click "Load More" button repeatedly until no more activities to load
      await this.loadAllActivities(page);

      // Extract activities
      const pageActivities = await this.extractActivitiesFromPage(page, linkInfo.section, linkInfo.text);
      activities.push(...pageActivities);

    } catch (error) {
      this.handleError(error, `extractActivitiesFromLink ${linkInfo.text}`);
    } finally {
      if (browser) await browser.close();
    }

    return activities;
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

      // Check if count increased
      const newCount = await page.evaluate(() => {
        return document.querySelectorAll('.bm-group-item-row').length;
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
      const itemRows = document.querySelectorAll('.bm-group-item-row');

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
              const match = link.href.match(/courseId=(\d+)/);
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

          if (/waitlist/i.test(rawText)) {
            registrationStatus = 'Waitlist';
          } else if (/\bfull\b/i.test(rawText) || spotsAvailable === 0) {
            registrationStatus = 'Full';
          } else if (/register|available|sign up|enroll/i.test(rawText)) {
            registrationStatus = 'Open';
          } else if (/closed|ended|cancelled/i.test(rawText)) {
            registrationStatus = 'Closed';
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
      externalId: 'courseId',
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

    // Only fetch details for activities with registration URLs
    const activitiesWithUrls = activities.filter(a => a.registrationUrl);

    if (activitiesWithUrls.length === 0) {
      this.logProgress('No activities with registration URLs to enhance');
      return activities;
    }

    this.logProgress(`Enhancing ${activitiesWithUrls.length} activities with detail page data...`);

    let browser;
    try {
      browser = await puppeteer.launch({
        headless: this.config.scraperConfig.headless !== false,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
      });

      const batchSize = 5;
      let enhanced = 0;
      let withCoords = 0;
      let withDates = 0;
      let withTimes = 0;

      for (let i = 0; i < activitiesWithUrls.length; i += batchSize) {
        const batch = activitiesWithUrls.slice(i, i + batchSize);
        const progress = ((i / activitiesWithUrls.length) * 100).toFixed(0);
        this.logProgress(`  Processing detail batch ${Math.floor(i/batchSize)+1}/${Math.ceil(activitiesWithUrls.length/batchSize)} (${progress}%)`);

        const batchResults = await Promise.all(
          batch.map(async (activity) => {
            const page = await browser.newPage();
            try {
              await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
              await page.goto(activity.registrationUrl, { waitUntil: 'networkidle2', timeout: 30000 });

              // Wait for page to render
              await new Promise(r => setTimeout(r, 2000));

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

                // Also look for visible date ranges
                const dateRangeMatch = pageText.match(/([A-Z][a-z]{2}\s+\d{1,2},?\s*\d{4})\s*(?:to|-)\s*([A-Z][a-z]{2}\s+\d{1,2},?\s*\d{4})/i);
                if (dateRangeMatch && !data.dateStartStr) {
                  data.dateStartStr = dateRangeMatch[1];
                  data.dateEndStr = dateRangeMatch[2];
                }

                // Also try MM/DD/YY format commonly used by PerfectMind (e.g., "11/02/25 - 12/14/25")
                if (!data.dateStartStr) {
                  const mmddyyMatch = pageText.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})\s*-\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/);
                  if (mmddyyMatch) {
                    data.dateStartStr = mmddyyMatch[1];
                    data.dateEndStr = mmddyyMatch[2];
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
                const feeMatch = pageHtml.match(/["']Fee["']\s*:\s*(\d+(?:\.\d{2})?)/i) ||
                                 pageHtml.match(/["']Price["']\s*:\s*(\d+(?:\.\d{2})?)/i);
                if (feeMatch) data.cost = parseFloat(feeMatch[1]);

                // Extract from visible "$XX.XX"
                const costMatch = pageText.match(/\$(\d+(?:,\d{3})*(?:\.\d{2})?)/);
                if (costMatch && !data.cost) {
                  data.cost = parseFloat(costMatch[1].replace(/,/g, ''));
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
                const statusText = pageText.toLowerCase();
                if (statusText.includes('full') && !statusText.includes('not full')) {
                  data.registrationStatus = 'Full';
                } else if (statusText.includes('waitlist')) {
                  data.registrationStatus = 'Waitlist';
                } else if (statusText.includes('register') || statusText.includes('available')) {
                  data.registrationStatus = 'Open';
                } else if (statusText.includes('closed')) {
                  data.registrationStatus = 'Closed';
                }

                return data;
              });

              await page.close();

              // Parse dates - handles ISO format, MM/DD/YY, and text formats
              const parseDate = (dateStr) => {
                if (!dateStr) return null;
                try {
                  // Try MM/DD/YY format first (common in PerfectMind)
                  const mmddyyMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
                  if (mmddyyMatch) {
                    let year = parseInt(mmddyyMatch[3]);
                    if (year < 100) year += 2000; // Convert 25 to 2025
                    return new Date(year, parseInt(mmddyyMatch[1]) - 1, parseInt(mmddyyMatch[2]));
                  }
                  const date = new Date(dateStr);
                  return isNaN(date.getTime()) ? null : date;
                } catch {
                  return null;
                }
              };

              // Normalize time
              const normalizeTime = (timeStr) => {
                if (!timeStr) return null;
                return timeStr.toLowerCase().replace(/\s+/g, ' ').trim();
              };

              // Merge data with activity
              return {
                ...activity,
                // Location
                latitude: detailData.latitude || activity.latitude,
                longitude: detailData.longitude || activity.longitude,
                city: detailData.city || activity.city,
                postalCode: detailData.postalCode || activity.postalCode,
                fullAddress: detailData.fullAddress || activity.fullAddress,
                locationName: detailData.locationName || activity.location || activity.locationName,
                // Dates
                dateStart: parseDate(detailData.dateStartStr) || activity.dateStart,
                dateEnd: parseDate(detailData.dateEndStr) || activity.dateEnd,
                // Times
                startTime: normalizeTime(detailData.startTime) || activity.startTime,
                endTime: normalizeTime(detailData.endTime) || activity.endTime,
                // Days
                dayOfWeek: detailData.dayOfWeek || activity.dayOfWeek || [],
                // Age
                ageMin: detailData.ageMin ?? activity.ageMin,
                ageMax: detailData.ageMax ?? activity.ageMax,
                // Cost
                cost: detailData.cost || activity.cost || 0,
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
              };
            } catch (error) {
              await page.close();
              return activity; // Return original on error
            }
          })
        );

        // Update activities in original array
        batchResults.forEach(result => {
          const idx = activities.findIndex(a => a.registrationUrl === result.registrationUrl);
          if (idx >= 0) {
            activities[idx] = result;
            enhanced++;
            if (result.latitude) withCoords++;
            if (result.dateStart) withDates++;
            if (result.startTime) withTimes++;
          }
        });

        // Rate limit
        await new Promise(r => setTimeout(r, 1000));
      }

      this.logProgress(`Detail enhancement complete:`);
      this.logProgress(`  - ${enhanced} activities processed`);
      this.logProgress(`  - ${withCoords} with coordinates`);
      this.logProgress(`  - ${withDates} with dates`);
      this.logProgress(`  - ${withTimes} with times`);
    } finally {
      if (browser) await browser.close();
    }

    return activities;
  }
}

module.exports = PerfectMindScraper;
