const ProviderExtension = require('../../base/ProviderExtension');

/**
 * Oshawa-specific extension for Intelligenz scraper.
 *
 * Oshawa uses activeOshawa Online (Intelligenz Solutions platform).
 * The site organizes activities by main categories:
 * - Swimming
 * - Camp
 * - Family & Parented
 * - Preschool, Child, Youth
 * - Aquatic Leadership & First Aid
 *
 * Each category may have subcategories that need to be explored.
 */
class OshawaExtension extends ProviderExtension {
  constructor(config) {
    super(config);

    // Oshawa kids category patterns (from main category page)
    this.kidsCategoryPatterns = [
      /swimming/i,
      /camp/i,
      /family.*parented/i,
      /preschool/i,
      /child/i,
      /youth/i,
      /aquatic.*leadership/i
    ];

    // Adult patterns to exclude
    this.adultPatterns = [
      /^adult$/i,
      /adult\s*only/i,
      /55\+/i,
      /seniors?$/i,
      /staff\s*training/i
    ];

    // Course type patterns to include
    this.includeCourseTypes = [
      'Swimming',
      'Camp',
      'Family & Parented',
      'Preschool, Child, Youth',
      'Aquatic Leadership & First Aid'
    ];
  }

  /**
   * Filter course types to only include kids-related ones
   * @param {Array} courseTypes - All course types from dropdown
   * @returns {Array} - Filtered course types
   */
  filterCourseTypes(courseTypes) {
    return courseTypes.filter(ct => {
      const name = ct.name.toLowerCase();

      // Exclude adult-only patterns
      if (this.adultPatterns.some(p => p.test(name))) {
        this.log(`Excluding adult category: ${ct.name}`);
        return false;
      }

      // Include if matches kids patterns or is a general category
      const isKidsCategory = this.kidsCategoryPatterns.some(p => p.test(name));
      if (isKidsCategory) {
        return true;
      }

      // Include general categories that may contain kids activities
      // Age filtering will handle the rest
      return true;
    });
  }

  /**
   * Check if an activity should be included based on age
   * @param {Object} activity - Activity data
   * @returns {boolean}
   */
  isKidsActivity(activity) {
    // If no age info, include it (will be manually reviewed)
    if (activity.ageMin === null && activity.ageMax === null) {
      return true;
    }

    const ageMin = activity.ageMin || 0;
    const ageMax = activity.ageMax || 99;

    // Include if age range overlaps with 0-18
    return ageMin <= 18 && ageMax >= 0;
  }

  getWaitTime() {
    return 5000;
  }

  getTimeout() {
    return 90000;
  }

  /**
   * Get custom selectors for Oshawa's Intelligenz layout
   */
  getSelectors() {
    return {
      courseTypeDropdown: '#CourseTypes',
      searchButton: 'input[type="submit"][value*="Search"], button[type="submit"]',
      activityPanel: '.panel.course-results, .course-panel, .panel',
      activityTitle: 'h3, h4, .panel-title, .panel-heading a',
      scheduleTable: 'table.table-striped, table',
      detailLink: 'a[href*="CourseDetails"]',
      pagination: 'ul.pagination',
      nextPage: 'a[data-page], .pagination .next a'
    };
  }
}

module.exports = OshawaExtension;
