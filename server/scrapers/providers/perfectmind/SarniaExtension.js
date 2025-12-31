const CategoryBoxExtension = require('./CategoryBoxExtension');

/**
 * Sarnia-specific extension for PerfectMind scraper.
 *
 * Sarnia uses a PerfectMind widget for recreation program registration.
 * Kids-related sections include:
 * - Family Skate
 * - Parent-Tot Skate
 * - Children programs
 * - Youth programs
 * - Camps
 * - Swimming/Aquatics
 * - Sports Leagues & Lessons
 * - Arts, Crafts & Hobbies
 * - Music Lessons/Groups
 * - Dancing Classes
 */
class SarniaExtension extends CategoryBoxExtension {
  constructor(config) {
    super(config);

    // Sarnia-specific kids section patterns
    this.kidsSectionPatterns = [
      /^children$/i,
      /^youth$/i,
      /^family/i,
      /^parent.*tot/i,
      /^camps?$/i,
      /swimming/i,
      /aquatics/i,
      /learn to swim/i,
      /sports/i,
      /lessons/i,
      /music/i,
      /dance/i,
      /dancing/i,
      /arts/i,
      /crafts/i,
      /skating/i,
      /hockey/i,
      /basketball/i,
      /volleyball/i,
      /tennis/i,
      /badminton/i,
      /programs?$/i,
    ];
  }

  /**
   * Override wait time - Sarnia's Angular app needs longer load times
   */
  getWaitTime() {
    return 15000;
  }

  /**
   * Override timeout - Sarnia's site can be slow
   */
  getTimeout() {
    return 120000;
  }

  /**
   * Override afterNavigate to handle Sarnia's specific loading patterns
   */
  async afterNavigate(page) {
    this.log('Waiting for Sarnia PerfectMind widget to load...');

    // Wait for the widget container
    try {
      await page.waitForSelector('.bm-widget-container, .bm-categories', { timeout: 20000 });
    } catch (e) {
      this.log('Widget container not found, trying fallback...');
    }

    // Wait for category links to appear
    try {
      await page.waitForSelector(this.categorySelector, { timeout: 30000 });
      this.log('Category links found');
    } catch (e) {
      this.log('Category selector not found, page may not have loaded properly');
    }

    // Additional wait for Angular to fully render
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  /**
   * Override discoverLinks to handle Sarnia's category structure
   */
  async discoverLinks(page) {
    this.log('Discovering category links from Sarnia widget...');

    // Wait for category links to be rendered
    try {
      await page.waitForSelector(this.categorySelector, { timeout: 30000 });
    } catch (e) {
      this.log('Category selector not found, trying alternatives...');
      // Try alternative selectors
      await page.waitForSelector('.bm-category-links a, .bm-categorybox a, a[class*="category"]', { timeout: 15000 }).catch(() => {});
    }

    // Extra wait for all links to be fully interactive
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Get all category links
    const links = await page.evaluate((selector) => {
      const linkElements = document.querySelectorAll(selector);
      const results = [];

      linkElements.forEach((link, index) => {
        // Find the parent category box and its header
        const categoryBox = link.closest('.bm-categorybox, .bm-category-box, [class*="category"]');
        let sectionHeader = '';
        if (categoryBox) {
          const headerEl = categoryBox.querySelector('.bm-category-links-title, .bm-box-title, h3, h4, .category-title');
          sectionHeader = headerEl?.textContent?.trim() || '';
        }

        const text = link.textContent.trim();
        // Skip empty links or navigation-only links
        if (!text || text.toLowerCase() === 'view all' || text.toLowerCase() === 'more') {
          return;
        }

        results.push({
          text: text,
          href: link.href || '',
          index: index,
          hasClickHandler: true,
          selector: `${selector}:nth-child(${index + 1})`,
          section: sectionHeader || 'Programs',
          y: link.getBoundingClientRect().y,
          x: link.getBoundingClientRect().x,
          boxHeader: sectionHeader || 'Programs'
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
}

module.exports = SarniaExtension;
