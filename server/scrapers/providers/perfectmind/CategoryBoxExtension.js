const ProviderExtension = require('../../base/ProviderExtension');

/**
 * Base extension for PerfectMind sites with category box layout.
 *
 * Many PerfectMind sites use a similar structure:
 * - Category boxes with headers and links
 * - Links have class 'bm-category-calendar-link enabled'
 * - JavaScript click handlers instead of href links
 * - Kids categories in specific sections (Children, Early Years, Youth)
 *
 * Extend this class for site-specific customizations.
 */
class CategoryBoxExtension extends ProviderExtension {
  constructor(config) {
    super(config);
    this.categorySelector = 'a.bm-category-calendar-link.enabled';
    this.activityListSelector = '.bm-activities-list, .bm-schedule-list';

    // Kids-related section headers to filter for
    this.kidsSectionPatterns = [
      /^children$/i,
      /^early years$/i,
      /^youth$/i,
      /^early learners/i,
      /^preschool$/i,
      /^school age/i,
      /^toddler/i,
      /^infant/i,
      /^baby/i,
      /^family$/i,
      /^all ages/i,
      /fencing/i, // Often has kids programs
      /ice sports/i, // Skating lessons for kids
      /aquatics/i, // Swimming lessons
    ];

    // Patterns to exclude (adult-only categories)
    this.adultPatterns = [
      /55\+/i,
      /older\s*adult/i,
      /seniors?$/i,
      /adult\s*only/i,
      /adult\s*and\s*senior/i
    ];
  }

  /**
   * Wait for page to fully load after navigation
   */
  async afterNavigate(page) {
    this.log('Waiting for PerfectMind widget to load...');

    // Wait for category links to appear
    try {
      await page.waitForSelector(this.categorySelector, { timeout: 30000 });
    } catch (e) {
      this.log('Category selector not found, page may not have loaded properly');
    }

    // Additional wait for dynamic content
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  /**
   * Discover links from category boxes
   */
  async discoverLinks(page) {
    this.log('Discovering category links from category boxes...');

    // Wait for category links to be rendered
    try {
      await page.waitForSelector(this.categorySelector, { timeout: 20000 });
    } catch (e) {
      this.log('Category selector not found, trying alternatives...');
      await page.waitForSelector('.bm-category-links a, .bm-categorybox a', { timeout: 10000 }).catch(() => {});
    }

    // Extra wait for all links to be fully interactive
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Get all category links with their section headers
    const links = await page.evaluate((selector) => {
      const linkElements = document.querySelectorAll(selector);
      const results = [];

      linkElements.forEach((link, index) => {
        // Find the parent category box and its header
        const categoryBox = link.closest('.bm-categorybox');
        let sectionHeader = '';
        if (categoryBox) {
          const headerEl = categoryBox.querySelector('.bm-category-links-title, .bm-box-title, h3, h4');
          sectionHeader = headerEl?.textContent?.trim() || '';
        }

        results.push({
          text: link.textContent.trim(),
          href: link.href || '',
          index: index,
          hasClickHandler: true,
          selector: `${selector}:nth-child(${index + 1})`,
          section: sectionHeader || 'Children', // Default to Children if no header
          y: link.getBoundingClientRect().y,
          x: link.getBoundingClientRect().x,
          boxHeader: sectionHeader || 'Children'
        });
      });

      return results;
    }, this.categorySelector);

    this.log(`Found ${links.length} total category links`);

    // Filter for kids-related categories
    const filteredLinks = this.filterKidsLinks(links);

    this.log(`After filtering: ${filteredLinks.length} kids category links`);
    return filteredLinks;
  }

  /**
   * Filter links to only include kids-related categories
   * Following Surrey's successful pattern: include ALL links except obvious adult-only ones
   * Let age filtering during extraction handle the rest
   */
  filterKidsLinks(links) {
    // First, filter out generic "Drop-In" navigation links
    // Port Moody and other sites have interleaved "Drop-In" links that are not categories
    const filteredByDropIn = links.filter(link => {
      const text = link.text.toLowerCase().trim();
      // Skip generic "Drop-In" links (but keep specific ones like "Drop-In Fitness")
      if (text === 'drop-in' || text === 'drop in') {
        this.log(`Skipping generic Drop-In link at index ${link.index}`);
        return false;
      }
      return true;
    });

    return filteredByDropIn.filter(link => {
      // Only exclude obvious adult-only patterns
      if (this.adultPatterns.some(p => p.test(link.text) || p.test(link.section))) {
        this.log(`Excluding adult category: ${link.text} (section: ${link.section})`);
        return false;
      }

      // Mark all remaining links as Children to pass through filterActivityLinks
      // This follows Surrey's successful pattern - let age filtering handle specifics
      link.section = 'Children';
      link.boxHeader = 'Children';

      return true;
    });
  }

  /**
   * Handle clicking a category link
   */
  async handleLinkClick(page, link) {
    this.log(`Clicking category: ${link.text}`);

    // Click using the link's index
    const clicked = await page.evaluate((selector, index) => {
      const links = document.querySelectorAll(selector);
      if (links[index]) {
        links[index].click();
        return true;
      }
      return false;
    }, this.categorySelector, link.index);

    if (!clicked) {
      this.log(`Failed to click category at index ${link.index}`);
      return false;
    }

    // Wait for activity list to load after click
    await page.waitForSelector(this.activityListSelector, { timeout: 15000 })
      .catch(() => this.log('Activity list selector not found after click'));

    // Additional wait for activities to populate
    await new Promise(resolve => setTimeout(resolve, 2000));

    return true;
  }

  /**
   * Default wait times - can be overridden by subclasses
   */
  getWaitTime() {
    return this.config.scraperConfig?.initialWaitTime || 10000;
  }

  getWaitSelector() {
    return this.config.scraperConfig?.waitForSelector || this.categorySelector;
  }

  getTimeout() {
    return this.config.scraperConfig?.timeout || 90000;
  }

  /**
   * Get selectors for activity extraction
   */
  getSelectors() {
    return {
      categoryLinks: this.categorySelector,
      activityList: this.activityListSelector,
      activityItem: '.bm-activity-item, .bm-schedule-row',
      activityName: '.bm-activity-name, .activity-title',
      activityDate: '.bm-activity-date, .activity-dates',
      activityTime: '.bm-activity-time, .activity-time',
      activityCost: '.bm-activity-price, .activity-price',
      activitySpots: '.bm-activity-spots, .availability',
      registerButton: '.bm-register-button, .register-btn',
      ...this.config.scraperConfig?.selectors
    };
  }
}

module.exports = CategoryBoxExtension;
