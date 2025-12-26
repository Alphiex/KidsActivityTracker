const ProviderExtension = require('../../base/ProviderExtension');

/**
 * Kelowna-specific extension for Intelligenz scraper.
 *
 * Kelowna uses a card-based layout with rich data displayed as badges:
 * - ID badge with course ID
 * - Price badge with cost
 * - Spaces badge with availability
 * - From/To badges with date range
 * - Schedule table with Day, Start, End, Instructor, Location, Venue
 *
 * The site organizes activities by category with seasonal naming:
 * - Kids 6 + Under (C6UWinter)
 * - Kids 6 + Up (C6UpWinter)
 * - Teens (TEENSWINTER25)
 * - Swimming + Aquatics (AQUAWinter)
 */
class KelownaExtension extends ProviderExtension {
  constructor(config) {
    super(config);

    // Kelowna kids category URL patterns
    this.kidsCategoryPatterns = [
      /C6UWinter/i,
      /C6UpWinter/i,
      /TEENS/i,
      /AQUA/i,
      /EARLYCAMPS/i,
      /PlayschoolPrograms/i
    ];

    // Adult patterns to exclude
    this.adultPatterns = [
      /^AYP/i,  // Adults/Yoga/Pilates
      /ADULT/i,
      /55\+/i,
      /SENIORS?/i
    ];
  }

  /**
   * Custom activity extraction for Kelowna's card-based layout
   * @param {Page} page - Puppeteer page instance
   * @returns {Promise<Array>} - Array of activities
   */
  async extractActivitiesFromPage(page) {
    return await page.evaluate(() => {
      const activities = [];
      const cards = document.querySelectorAll('.card');

      cards.forEach((card) => {
        const text = card.textContent || '';

        // Only process cards that look like activity listings (have ID and Price)
        if (!text.includes('ID:') || !text.includes('Price:')) {
          return;
        }

        try {
          const activity = {};

          // Extract title
          const titleEl = card.querySelector('h2, h3, .card-title');
          activity.name = titleEl?.textContent?.trim() || '';

          // Extract ID from badge
          const idMatch = text.match(/ID:\s*(\d+)/);
          if (idMatch) {
            activity.courseId = idMatch[1];
            activity.externalId = idMatch[1];
          }

          // Extract price
          const priceMatch = text.match(/Price:\s*\$?([\d,.]+)/);
          if (priceMatch) {
            activity.cost = parseFloat(priceMatch[1].replace(',', ''));
          }

          // Extract spaces (availability)
          const spacesMatch = text.match(/Spaces:\s*(\d+)/);
          if (spacesMatch) {
            activity.spotsAvailable = parseInt(spacesMatch[1]);
            activity.registrationStatus = parseInt(spacesMatch[1]) > 0 ? 'Open' : 'Full';
          }

          // Extract date range
          const fromMatch = text.match(/From:\s*([A-Za-z]+,\s*[A-Za-z]+\s+\d+,\s*\d{4})/);
          const toMatch = text.match(/To:\s*([A-Za-z]+,\s*[A-Za-z]+\s+\d+,\s*\d{4})/);
          if (fromMatch) activity.dateStartStr = fromMatch[1];
          if (toMatch) activity.dateEndStr = toMatch[1];

          // Extract schedule from table
          const table = card.querySelector('table');
          if (table) {
            const rows = table.querySelectorAll('tbody tr, tr:not(:first-child)');
            const schedule = {
              days: [],
              startTimes: [],
              endTimes: [],
              instructors: [],
              locations: [],
              venues: []
            };

            rows.forEach(row => {
              const cells = row.querySelectorAll('td');
              if (cells.length >= 5) {
                const day = cells[0]?.textContent?.trim();
                const startTime = cells[1]?.textContent?.trim();
                const endTime = cells[2]?.textContent?.trim();
                const instructor = cells[3]?.textContent?.trim();
                const location = cells[4]?.textContent?.trim();
                const venue = cells[5]?.textContent?.trim();

                if (day && !schedule.days.includes(day)) schedule.days.push(day);
                if (startTime && !schedule.startTimes.includes(startTime)) schedule.startTimes.push(startTime);
                if (endTime && !schedule.endTimes.includes(endTime)) schedule.endTimes.push(endTime);
                if (instructor && !schedule.instructors.includes(instructor)) schedule.instructors.push(instructor);
                if (location && !schedule.locations.includes(location)) schedule.locations.push(location);
                if (venue && !schedule.venues.includes(venue)) schedule.venues.push(venue);
              }
            });

            // Map to activity fields
            activity.dayOfWeek = schedule.days;
            activity.startTime = schedule.startTimes[0] || null;
            activity.endTime = schedule.endTimes[0] || null;
            activity.instructor = schedule.instructors.join(', ') || null;
            activity.locationName = schedule.locations[0] || schedule.venues[0] || null;
            activity.venue = schedule.venues[0] || null;
          }

          // Get registration URL
          const registerLink = card.querySelector('a[href*="CourseDetails"], a.btn-primary, a[href*="register"]');
          if (registerLink) {
            activity.registrationUrl = registerLink.href;
          }

          // Only add if we have required fields
          if (activity.name && activity.courseId) {
            activities.push(activity);
          }
        } catch (err) {
          console.error('Error parsing activity card:', err);
        }
      });

      return activities;
    });
  }

  /**
   * Discover subcategory links within a category page
   * @param {Page} page - Puppeteer page instance
   * @returns {Promise<Array>} - Array of subcategory links
   */
  async discoverSubcategoryLinks(page) {
    return await page.evaluate(() => {
      const links = [];
      const cards = document.querySelectorAll('.card a[href*="/browse/"]');

      cards.forEach(link => {
        const href = link.href;
        const text = link.textContent?.trim() || link.closest('.card')?.querySelector('h2, h3')?.textContent?.trim();

        if (href && text && !links.find(l => l.url === href)) {
          links.push({
            url: href,
            name: text
          });
        }
      });

      return links;
    });
  }

  /**
   * Check if a category URL is for kids activities
   * @param {string} url - Category URL
   * @returns {boolean}
   */
  isKidsCategory(url) {
    // Check if matches any adult pattern
    if (this.adultPatterns.some(p => p.test(url))) {
      return false;
    }

    // Check if matches kids patterns, or if it's a general category (could contain kids activities)
    return this.kidsCategoryPatterns.some(p => p.test(url)) ||
           url.includes('Winter') ||
           url.includes('Summer');
  }

  getWaitTime() {
    return 5000;
  }

  getTimeout() {
    return 90000;
  }

  /**
   * Get custom selectors for Kelowna
   */
  getSelectors() {
    return {
      activityCard: '.card',
      activityTitle: 'h2, h3, .card-title',
      scheduleTable: 'table',
      registerButton: 'a.btn-primary, a[href*="register"]',
      pagination: '.pagination',
      nextPage: '.pagination .next a, .pagination a[rel="next"]'
    };
  }
}

module.exports = KelownaExtension;
