const CategoryBoxExtension = require('./CategoryBoxExtension');

/**
 * Township of Langley-specific extension for PerfectMind scraper.
 *
 * Township of Langley uses a category box layout. This extension handles
 * their specific structure and kids-related categories.
 */
class LangleyExtension extends CategoryBoxExtension {
  constructor(config) {
    super(config);

    // Township of Langley specific kids sections
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
      /^recreation$/i,// General recreation
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

module.exports = LangleyExtension;
