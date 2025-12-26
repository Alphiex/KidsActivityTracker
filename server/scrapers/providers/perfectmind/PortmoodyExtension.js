const CategoryBoxExtension = require('./CategoryBoxExtension');

/**
 * Port Moody-specific extension for PerfectMind scraper.
 *
 * Port Moody uses a category box layout similar to Surrey but with different
 * section headers. Kids-related sections include:
 * - Children (Afterschool Club, Children Camps, Children Programs, etc.)
 * - Early Years (Childminding, Drop-in Early Years, Early Years - Just for Kids, etc.)
 * - Youth (Drop-in Youth, Youth Camps, Youth Club, Youth Programs, etc.)
 * - Early Learners Playschool
 * - Ice Sports (skating lessons for all ages including kids)
 * - Fencing (programs for all ages)
 */
class PortmoodyExtension extends CategoryBoxExtension {
  constructor(config) {
    super(config);

    // Port Moody specific kids sections
    this.kidsSectionPatterns = [
      /^children$/i,
      /^early years$/i,
      /^youth$/i,
      /^early learners/i,
      /^ice sports$/i, // Skating lessons for kids
      /^fencing$/i,    // Has kids programs
    ];
  }

  // Uses base class filterKidsLinks - includes all non-adult categories
  // Age filtering during extraction handles the rest

  getWaitTime() {
    return 8000;
  }

  getTimeout() {
    return 90000;
  }
}

module.exports = PortmoodyExtension;
