const CategoryBoxExtension = require('./CategoryBoxExtension');

/**
 * Coquitlam-specific extension for PerfectMind scraper.
 *
 * Coquitlam has a category box layout with these kids-related sections:
 * - Child (After School Programs, Learn & Discover, Performing Arts, etc.)
 * - Early Years (Adult Participation, Arts & Crafts, Learn & Discover, etc.)
 * - Youth (Fitness, Lifelong Learning, Performing Arts, etc.)
 * - Camps (Pro D Day, Spring Break, Winter Break)
 * - Skating (Child, Preschool, Youth sections)
 * - Swimming (Child, Preschool, Youth sections)
 * - Drop In (Pre-registration Recommended) - has *Child, *Youth, *All Ages
 * - Drop In (No Registration Required) - has Youth section
 * - Events (Parties - birthday parties)
 * - Certifications (First Aid for teens)
 */
class CoquitlamExtension extends CategoryBoxExtension {
  constructor(config) {
    super(config);

    // Coquitlam specific kids sections
    this.kidsSectionPatterns = [
      /^child$/i,
      /^early years$/i,
      /^youth$/i,
      /^camps$/i,
      /^skating$/i,
      /^swimming$/i,
      /^events$/i,
      /^outdoors$/i,
      /drop.?in.*pre-?registration/i,
      /drop.?in.*no registration/i,
      /^certifications$/i,
    ];

    // Adult-only patterns to exclude
    this.adultPatterns = [
      /^adult$/i,  // The "Adult" section header
      /55\+/i,
      /older\s*adult/i,
      /seniors?$/i,
      /adult\s*only/i,
      /adult\s*50\+/i,
    ];
  }

  /**
   * Custom link filtering for Coquitlam
   * Include all kids-related categories from various sections
   */
  filterKidsLinks(links) {
    // First, filter out generic "Drop-In" navigation links
    const filteredByDropIn = links.filter(link => {
      const text = link.text.toLowerCase().trim();
      // Skip generic "Drop-In" links
      if (text === 'drop-in' || text === 'drop in') {
        return false;
      }
      return true;
    });

    return filteredByDropIn.filter(link => {
      const text = link.text.toLowerCase();
      const section = link.section.toLowerCase();

      // Exclude adult-only sections and links
      if (this.adultPatterns.some(p => p.test(section))) {
        // But include links that are specifically for kids within adult sections
        // e.g., "Adult & Child" skating
        if (/child|youth|preschool|family/i.test(text)) {
          link.section = 'Children';
          link.boxHeader = 'Children';
          return true;
        }
        return false;
      }

      // Exclude adult-specific links
      if (/^adult$/i.test(text) || /^\*adult$/i.test(text)) {
        return false;
      }

      // Exclude 50+ adult links
      if (/50\+|adult\s*50/i.test(text)) {
        return false;
      }

      // Include kids-specific links from Drop-In sections
      if (/\*child|\*youth|\*all ages|\*childminding|\*early years/i.test(text)) {
        link.section = 'Children';
        link.boxHeader = 'Children';
        return true;
      }

      // Include from known kids sections
      if (this.kidsSectionPatterns.some(p => p.test(section))) {
        link.section = 'Children';
        link.boxHeader = 'Children';
        return true;
      }

      // Include specific kids-related links regardless of section
      if (/child|youth|preschool|early years|teen|family|camps?|parties/i.test(text)) {
        link.section = 'Children';
        link.boxHeader = 'Children';
        return true;
      }

      return false;
    });
  }

  getWaitTime() {
    return 8000;
  }

  getTimeout() {
    return 90000;
  }
}

module.exports = CoquitlamExtension;
