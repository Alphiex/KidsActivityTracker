const CategoryBoxExtension = require('./CategoryBoxExtension');

/**
 * London-specific extension for PerfectMind scraper.
 *
 * City of London uses PerfectMind with category box layout.
 * This extension provides site-specific wait times and section patterns.
 */
class LondonExtension extends CategoryBoxExtension {
  constructor(config) {
    super(config);

    // London-specific kids sections based on their category structure
    this.kidsSectionPatterns = [
      /^children$/i,
      /^youth$/i,
      /^preschool$/i,
      /^toddler/i,
      /^early years$/i,
      /^early learners/i,
      /^school age/i,
      /^family$/i,
      /^all ages/i,
      /^aquatics$/i,
      /^swimming$/i,
      /^skating$/i,
      /^camps?$/i,
      /^sports$/i,
      /^arts$/i,
      /^music$/i,
      /^dance$/i,
      /^gymnastics$/i,
      /summer/i,
      /spring break/i,
      /march break/i,
      /pa day/i
    ];

    // London-specific adult patterns to exclude
    this.adultPatterns = [
      /55\+/i,
      /older\s*adult/i,
      /seniors?$/i,
      /adult\s*only/i,
      /adult\s*and\s*senior/i,
      /19\+/i
    ];
  }

  // London widget needs more time to fully load
  getWaitTime() {
    return 15000;
  }

  getTimeout() {
    return 90000;
  }
}

module.exports = LondonExtension;
