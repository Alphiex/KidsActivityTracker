const CategoryBoxExtension = require('./CategoryBoxExtension');

/**
 * Maple Ridge-specific extension for PerfectMind scraper.
 *
 * Maple Ridge uses a category box layout. This extension handles
 * their specific structure and kids-related categories.
 */
class MapleridgeExtension extends CategoryBoxExtension {
  constructor(config) {
    super(config);

    // Maple Ridge specific kids sections - will be discovered dynamically
    this.kidsSectionPatterns = [
      /^children$/i,
      /^youth$/i,
      /^early years$/i,
      /^preschool$/i,
      /^toddler/i,
      /^family$/i,
      /^all ages/i,
      /^aquatics$/i, // Swimming lessons
      /^skating$/i,  // Ice skating
      /^sports$/i,   // Often has youth programs
      /^camps$/i,    // Day camps
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

module.exports = MapleridgeExtension;
