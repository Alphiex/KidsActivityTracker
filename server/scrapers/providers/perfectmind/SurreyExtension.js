const ProviderExtension = require('../../base/ProviderExtension');

/**
 * Surrey-specific extension for PerfectMind scraper.
 *
 * Surrey's PerfectMind site has unique characteristics:
 * - Large Angular app with 70+ activity categories
 * - Uses JavaScript click handlers instead of href links
 * - Requires longer wait times (15s+) for full render
 * - Category links have class 'bm-category-calendar-link enabled'
 */
class SurreyExtension extends ProviderExtension {
  constructor(config) {
    super(config);
    this.categorySelector = 'a.bm-category-calendar-link.enabled';
    this.activityListSelector = '.bm-activities-list, .bm-schedule-list';
  }

  /**
   * Surrey needs extra time after navigation for Angular to bootstrap
   */
  async afterNavigate(page) {
    this.log('Waiting for Angular app to fully bootstrap...');

    // Wait for RequireJS to finish loading Angular modules
    await page.waitForFunction(() => {
      return window.angular !== undefined;
    }, { timeout: 30000 }).catch(() => {
      this.log('Angular not detected, continuing anyway...');
    });
  }

  /**
   * Custom link discovery for Surrey's JavaScript-based navigation
   */
  async discoverLinks(page) {
    this.log('Discovering category links with custom Surrey logic...');

    // Wait for category links to be rendered
    try {
      await page.waitForSelector(this.categorySelector, { timeout: 20000 });
    } catch (e) {
      this.log('Category selector not found, trying alternative...');
      // Try alternative selector
      await page.waitForSelector('.bm-category-links a', { timeout: 10000 }).catch(() => {});
    }

    // Extra wait for all links to be fully interactive
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Get all category links
    const links = await page.evaluate((selector) => {
      const linkElements = document.querySelectorAll(selector);
      return Array.from(linkElements).map((link, index) => ({
        text: link.textContent.trim(),
        href: link.href || '',
        index: index,
        hasClickHandler: true, // Surrey uses click handlers
        selector: `${selector}:nth-child(${index + 1})`,
        // Mark all as kids-related so filterActivityLinks includes them
        // Surrey's widget already shows kids activities - we'll filter by age during extraction
        section: 'Children', // This ensures it passes the kids section filter
        y: link.getBoundingClientRect().y,
        x: link.getBoundingClientRect().x,
        boxHeader: 'Children'
      }));
    }, this.categorySelector);

    this.log(`Found ${links.length} category links`);

    // Filter out adult-only categories at discovery time
    const adultPatterns = [/55\+/i, /older\s*adult/i, /seniors?$/i, /adult\s*only/i];
    const filteredLinks = links.filter(link => {
      return !adultPatterns.some(p => p.test(link.text));
    });

    this.log(`After adult filter: ${filteredLinks.length} category links`);
    return filteredLinks;
  }

  /**
   * Custom click handler for Surrey's JavaScript navigation
   */
  async handleLinkClick(page, link) {
    this.log(`Clicking category: ${link.text}`);

    // Click using the link's index since hrefs are empty
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
    await new Promise(resolve => setTimeout(resolve, 3000));

    return true;
  }

  /**
   * Surrey activity list uses specific structure
   */
  async afterParseActivity(activity) {
    // Surrey-specific data cleanup
    if (activity.name) {
      // Remove category prefix if present (e.g., "Aquatics: Swimming Lessons" -> "Swimming Lessons")
      activity.name = activity.name.replace(/^[A-Z][a-z]+:\s*/, '');
    }

    // Surrey includes facility in location names
    if (activity.locationName && !activity.facility) {
      const facilityMatch = activity.locationName.match(/^(.+?)\s*-\s*(.+)$/);
      if (facilityMatch) {
        activity.facility = facilityMatch[1].trim();
        activity.locationName = facilityMatch[2].trim();
      }
    }

    return activity;
  }

  /**
   * Surrey-specific wait times
   */
  getWaitTime() {
    // Surrey needs 15 seconds minimum for its large Angular app
    return this.config.scraperConfig?.initialWaitTime || 15000;
  }

  getWaitSelector() {
    return this.config.scraperConfig?.waitForSelector || this.categorySelector;
  }

  getTimeout() {
    // Surrey needs longer timeouts due to slow page loads
    return this.config.scraperConfig?.timeout || 120000;
  }

  /**
   * Surrey-specific selectors
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

module.exports = SurreyExtension;
