const CategoryBoxExtension = require('./CategoryBoxExtension');

/**
 * White Rock-specific extension for PerfectMind scraper.
 *
 * White Rock uses a category box layout with clear section headers:
 * - Early Years: Aquatics, Arts, Camps, Dance and Music, Skating Lessons, Sports
 * - Youth: Aquatics, Arts & STEM, Birthday Parties, Camps, Dance and Music, etc.
 * - Drop-in Programs: Drop-In Fitness, Drop-In Skating, Drop-In Social Activities
 */
class WhiterockExtension extends CategoryBoxExtension {
  constructor(config) {
    super(config);

    // White Rock specific kids sections
    this.kidsSectionPatterns = [
      /^early years$/i,
      /^youth$/i,
      /^drop-in programs$/i, // Some drop-ins are for kids too
      /^events$/i,          // May have family events
    ];
  }

  /**
   * White Rock-specific filtering - add Kent Street exclusion to base patterns
   */
  filterKidsLinks(links) {
    // Add White Rock-specific adult exclusions
    const whiterockAdultPatterns = [
      ...this.adultPatterns,
      /kent street/i,  // Kent Street Activity Centre (55+)
      /adult\s*18\+?/i
    ];

    return links.filter(link => {
      // Exclude adult-only patterns (including White Rock-specific ones)
      if (whiterockAdultPatterns.some(p => p.test(link.text) || p.test(link.section))) {
        this.log(`Excluding adult category: ${link.text} (section: ${link.section})`);
        return false;
      }

      // Mark all remaining links as Children to pass through filterActivityLinks
      link.section = 'Children';
      link.boxHeader = 'Children';

      return true;
    });
  }

  getWaitTime() {
    return 8000;
  }

  getTimeout() {
    return 90000;
  }
}

module.exports = WhiterockExtension;
