const CategoryBoxExtension = require('./CategoryBoxExtension');

/**
 * Greater Sudbury-specific extension for PerfectMind scraper.
 *
 * Greater Sudbury has 100+ facilities across the regional municipality.
 * The widget uses standard PerfectMind category box layout.
 */
class GreaterSudburyExtension extends CategoryBoxExtension {
  constructor(config) {
    super(config);

    // Greater Sudbury specific kids sections
    this.kidsSectionPatterns = [
      /^children$/i,
      /^youth$/i,
      /^early years$/i,
      /^preschool$/i,
      /^toddler/i,
      /^family$/i,
      /^all ages/i,
      /^aquatics$/i,
      /^swimming$/i,
      /^learn.*swim/i,
      /^skating$/i,
      /^camps?$/i,
      /^day camp/i,
      /^sports$/i,
      /^arts$/i,
      /^music$/i,
      /^dance$/i,
      /^gymnastics$/i,
      /^hockey$/i,
      /^figure skating$/i,
      /summer/i,
      /spring break/i,
      /march break/i,
      /pa day/i,
      /drop-in/i
    ];

    // Adult patterns to exclude
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
    return 10000;
  }

  getTimeout() {
    return 90000;
  }
}

module.exports = GreaterSudburyExtension;
