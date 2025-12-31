const CategoryBoxExtension = require('./CategoryBoxExtension');

/**
 * Burlington-specific extension for PerfectMind scraper.
 *
 * Burlington uses a category box layout with "Youth 0-18" section.
 * The widget has extensive facility/location data and filter options.
 */
class BurlingtonExtension extends CategoryBoxExtension {
  constructor(config) {
    super(config);

    // Burlington specific kids sections - based on their category structure
    this.kidsSectionPatterns = [
      /^children$/i,
      /^youth$/i,
      /youth.*0.*18/i,
      /^early years$/i,
      /^preschool$/i,
      /^toddler/i,
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
      /^martial arts$/i,
      /summer/i,
      /spring break/i,
      /pa day/i,
      /march break/i
    ];

    // Burlington-specific adult patterns to exclude
    this.adultPatterns = [
      /55\+/i,
      /older\s*adult/i,
      /seniors?$/i,
      /adult\s*only/i,
      /adult\s*and\s*senior/i,
      /19\+/i
    ];
  }

  // Uses base class filterKidsLinks - includes all non-adult categories
  // Age filtering during extraction handles the rest

  getWaitTime() {
    return 15000;  // Increased from 10000 for better widget loading
  }

  getTimeout() {
    return 90000;
  }
}

module.exports = BurlingtonExtension;
