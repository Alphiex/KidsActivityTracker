const CategoryBoxExtension = require('./CategoryBoxExtension');

/**
 * Guelph-specific extension for PerfectMind scraper.
 *
 * Guelph is a university city with extensive recreation programs.
 * Uses standard PerfectMind widget with "Enroll" calendar marking.
 */
class GuelphExtension extends CategoryBoxExtension {
  constructor(config) {
    super(config);

    // Guelph specific kids sections
    this.kidsSectionPatterns = [
      /^children$/i,
      /^youth$/i,
      /^early years$/i,
      /^preschool$/i,
      /^toddler/i,
      /^infant/i,
      /^baby/i,
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
      /^martial arts$/i,
      /^soccer$/i,
      /^basketball$/i,
      /^hockey$/i,
      /summer/i,
      /spring break/i,
      /march break/i,
      /pa day/i,
      /after.?school/i
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

module.exports = GuelphExtension;
