const CategoryBoxExtension = require('./CategoryBoxExtension');

/**
 * Abbotsford-specific extension for PerfectMind scraper.
 *
 * Abbotsford uses a category box layout. This extension handles
 * their specific structure and kids-related categories.
 */
class AbbotsfordExtension extends CategoryBoxExtension {
  constructor(config) {
    super(config);

    // Abbotsford specific kids sections
    this.kidsSectionPatterns = [
      /^children$/i,
      /^youth$/i,
      /^early years$/i,
      /^preschool$/i,
      /^toddler/i,
      /^family$/i,
      /^all ages/i,
      /^aquatics$/i,  // Swimming lessons
      /^skating$/i,   // Ice skating
      /^camps$/i,     // Day camps
      /^sports$/i,    // Often has youth programs
      /^arts$/i,      // Arts programs
      /^music$/i,     // Music programs
    ];
  }

  // Uses base class filterKidsLinks - includes all non-adult categories
  // Age filtering during extraction handles the rest

  getWaitTime() {
    return 10000;
  }

  getTimeout() {
    return 90000;
  }
}

module.exports = AbbotsfordExtension;
