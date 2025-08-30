const PerfectMindScraper = require('../platforms/PerfectMindScraper');
const DataNormalizer = require('../base/DataNormalizer');
const { extractComprehensiveDetails } = require('../nvrcComprehensiveDetailScraper');
const puppeteer = require('puppeteer');

/**
 * NVRC-specific scraper that extends the PerfectMind platform scraper
 * This scraper handles the specific patterns and data extraction for NVRC activities
 */
class NVRCScraper extends PerfectMindScraper {
  constructor(config) {
    super(config);
    this.providerName = 'North Vancouver Recreation & Culture';
  }

  /**
   * Enhanced scraping method that includes NVRC-specific features
   * @returns {Promise<{activities: Array, stats: Object, report: String}>}
   */
  async scrape() {
    const startTime = Date.now();
    this.logProgress('Starting NVRC Enhanced Scraper');

    try {
      // Use the base PerfectMind scraper flow but with NVRC enhancements
      const baseResult = await super.scrape();
      
      // Enhance activities with NVRC-specific details if configured
      if (this.config.scraperConfig.enableDetailEnhancement !== false) {
        this.logProgress('Enhancing activities with detailed information...');
        baseResult.activities = await this.enhanceActivitiesWithNVRCDetails(baseResult.activities);
      }

      const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
      this.logProgress(`NVRC scraping completed in ${duration} minutes`);

      return baseResult;

    } catch (error) {
      this.handleError(error, 'NVRC scrape');
      throw error;
    }
  }

  /**
   * Override the PerfectMind activity extraction to handle NVRC-specific patterns
   * @param {Object} page - Puppeteer page
   * @param {String} sectionName - Section name
   * @param {String} activityType - Activity type
   * @returns {Promise<Array>} Enhanced NVRC activities
   */
  async extractActivitiesFromPerfectMindPage(page, sectionName, activityType) {
    // First expand all "Show" buttons
    const showLinks = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a, button, span'));
      const showLinks = links.filter(el => {
        const text = el.textContent?.trim() || '';
        return text.toLowerCase() === 'show' || text.includes('Show');
      });
      
      showLinks.forEach(link => link.click());
      return showLinks.length;
    });

    if (showLinks > 0) {
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    // Extract activities using NVRC-specific patterns
    const pageActivities = await page.evaluate((section, actType) => {
      const activities = [];
      const groupItems = document.querySelectorAll('.bm-group-item-row');
      const groupTitles = document.querySelectorAll('.bm-group-title-row');
      
      // Create a map of positions to titles for NVRC's hierarchical structure
      const titlePositions = [];
      groupTitles.forEach(title => {
        const rect = title.getBoundingClientRect();
        titlePositions.push({
          title: title.textContent?.trim() || '',
          top: rect.top,
          element: title
        });
      });
      
      groupItems.forEach((itemRow, idx) => {
        try {
          const itemText = itemRow.textContent || '';
          
          // NVRC-specific activity detection patterns
          const hasPrice = itemText.includes('$');
          const hasCourseId = itemText.includes('#');
          const hasLink = itemRow.querySelector('a[href*="courseId"], a[href*="BookMe4"]');
          
          if (!hasPrice && !hasCourseId && !hasLink) {
            return;
          }
          
          // Extract activity details using NVRC-specific selectors
          const nameElement = itemRow.querySelector('.bm-group-item-name');
          const courseIdElement = itemRow.querySelector('.bm-group-item-course-id');
          
          let activityName = nameElement?.textContent?.trim() || '';
          const courseId = courseIdElement?.textContent?.trim() || '';
          
          // Find the specific activity section within NVRC's structure
          let activitySection = actType;
          const rowRect = itemRow.getBoundingClientRect();
          for (let i = titlePositions.length - 1; i >= 0; i--) {
            if (titlePositions[i].top < rowRect.top) {
              const titleText = titlePositions[i].title;
              const match = titleText.match(/([A-Za-z\\s&]+(?:Early Years|All Ages)?)/);
              if (match) {
                activitySection = match[1].trim();
              }
              break;
            }
          }
          
          const activity = {
            // Basic identification
            id: `${section}_${idx}_${Date.now()}`,
            section: section,
            activityType: actType,
            activitySection: activitySection,
            name: activityName,
            code: courseId,
            courseId: courseId,
            
            // NVRC-specific data extraction
            dates: itemText.match(/([A-Z][a-z]{2}\\s+\\d{1,2}\\s*-\\s*[A-Z][a-z]{2}\\s+\\d{1,2})/)?.[1],
            daysOfWeek: this.extractNVRCDaysOfWeek(itemText),
            time: itemText.match(/(\\d{1,2}:\\d{2}\\s*[ap]\\.?m\\.?\\s*-\\s*\\d{1,2}:\\d{2}\\s*[ap]\\.?m\\.?)/i)?.[1],
            ageRange: this.extractNVRCAgeRange(itemText),
            location: this.extractNVRCLocation(itemText),
            price: parseFloat(itemText.match(/\\$([0-9,]+(?:\\.\\d{2})?)/)?.[1]?.replace(',', '') || '0'),
            availability: this.extractNVRCAvailability(itemText, itemRow),
            spotsAvailable: this.extractNVRCSpots(itemText),
            registrationUrl: this.extractNVRCRegistrationUrl(itemRow),
            
            // Raw data for debugging and further processing
            rawText: itemText.substring(0, 500),
            rawElement: itemRow.innerHTML
          };
          
          if (activity.name || activity.code) {
            activities.push(activity);
          }
          
        } catch (error) {
          console.error('Error extracting NVRC activity:', error);
        }
      });
      
      return activities;
      
      // Helper functions for NVRC-specific extraction
      function extractNVRCDaysOfWeek(itemText) {
        const days = [];
        const dayMappings = {
          'Monday': 'Mon', 'Mondays': 'Mon', 'MONDAY': 'Mon', 'MONS': 'Mon', 'Mons': 'Mon',
          'Tuesday': 'Tue', 'Tuesdays': 'Tue', 'TUESDAY': 'Tue', 'TUES': 'Tue', 'Tues': 'Tue',
          'Wednesday': 'Wed', 'Wednesdays': 'Wed', 'WEDNESDAY': 'Wed', 'WEDS': 'Wed', 'Weds': 'Wed',
          'Thursday': 'Thu', 'Thursdays': 'Thu', 'THURSDAY': 'Thu', 'THURS': 'Thu', 'Thurs': 'Thu', 'THUR': 'Thu', 'Thur': 'Thu',
          'Friday': 'Fri', 'Fridays': 'Fri', 'FRIDAY': 'Fri', 'FRIS': 'Fri', 'Fris': 'Fri',
          'Saturday': 'Sat', 'Saturdays': 'Sat', 'SATURDAY': 'Sat', 'SATS': 'Sat', 'Sats': 'Sat',
          'Sunday': 'Sun', 'Sundays': 'Sun', 'SUNDAY': 'Sun', 'SUNS': 'Sun', 'Suns': 'Sun',
          'Mon': 'Mon', 'MON': 'Mon',
          'Tue': 'Tue', 'TUE': 'Tue',
          'Wed': 'Wed', 'WED': 'Wed',
          'Thu': 'Thu', 'THU': 'Thu',
          'Fri': 'Fri', 'FRI': 'Fri',
          'Sat': 'Sat', 'SAT': 'Sat',
          'Sun': 'Sun', 'SUN': 'Sun'
        };
        
        Object.entries(dayMappings).forEach(([pattern, abbrev]) => {
          if (itemText.includes(pattern)) {
            days.push(abbrev);
          }
        });
        return [...new Set(days)];
      }
      
      function extractNVRCAgeRange(itemText) {
        const ageMatch = itemText.match(/Age:\\s*(\\d+)\\s*(?:to|-)?\\s*(\\d+)?/i);
        if (ageMatch) {
          return {
            min: parseInt(ageMatch[1]),
            max: ageMatch[2] ? parseInt(ageMatch[2]) : parseInt(ageMatch[1])
          };
        }
        return null;
      }
      
      function extractNVRCLocation(itemText) {
        const locationKeywords = ['Centre', 'Center', 'Park', 'Arena', 'Pool', 'Field', 'Gym', 'Studio', 'Complex'];
        for (const keyword of locationKeywords) {
          const match = itemText.match(new RegExp(`([^,\\\\n]*${keyword}[^,\\\\n]*)`, 'i'));
          if (match) {
            return match[1].trim().replace(/\\s+/g, ' ').substring(0, 100);
          }
        }
        return null;
      }
      
      function extractNVRCAvailability(itemText, itemRow) {
        if (itemText.includes('Closed')) return 'Closed';
        if (itemText.includes('Full')) return 'Full';
        if (itemText.includes('Waitlist')) return 'Waitlist';
        if (itemText.includes('Sign Up')) return 'Open';
        const hasLink = itemRow.querySelector('a[href*="BookMe4"], a[href*="courseId"]');
        if (hasLink) return 'Available';
        return 'Unknown';
      }
      
      function extractNVRCSpots(itemText) {
        const patterns = [
          /Sign Up\\s*\\((\\d+)\\)/i,
          /(\\d+)\\s*spot(?:s)?\\s*(?:left|available)/i,
          /\\((\\d+)\\s*(?:spot|seat)s?\\)/i
        ];
        
        for (const pattern of patterns) {
          const match = itemText.match(pattern);
          if (match) {
            return parseInt(match[1]);
          }
        }
        return 0;
      }
      
      function extractNVRCRegistrationUrl(itemRow) {
        const possibleLinks = itemRow.querySelectorAll('a[href]');
        for (const link of possibleLinks) {
          const href = link.href;
          if (href.includes('BookMe4') || 
              href.includes('courseId') || 
              href.includes('register') ||
              href.includes('enroll')) {
            return href;
          }
        }
        return possibleLinks[0]?.href || null;
      }
      
    }, sectionName, activityType);

    return pageActivities;
  }

  /**
   * Enhance activities with NVRC-specific detailed information
   * @param {Array} activities - Activities to enhance
   * @returns {Promise<Array>} Enhanced activities
   */
  async enhanceActivitiesWithNVRCDetails(activities) {
    this.logProgress(`🔍 Enhancing ${activities.length} NVRC activities with detailed information...`);
    
    let browser;
    const enhanced = [];
    const batchSize = 10;
    
    try {
      browser = await puppeteer.launch({
        headless: this.config.scraperConfig.headless !== false,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--window-size=1920,1080'
        ]
      });
      
      // Process in batches for better performance
      for (let i = 0; i < activities.length; i += batchSize) {
        const batch = activities.slice(i, i + batchSize);
        const batchNum = Math.floor(i/batchSize) + 1;
        const totalBatches = Math.ceil(activities.length / batchSize);
        const progress = ((i / activities.length) * 100).toFixed(1);
        
        this.logProgress(`🔄 Processing NVRC batch ${batchNum}/${totalBatches} (${progress}% complete) - ${batch.length} activities...`);
        
        const batchResults = await Promise.all(
          batch.map(async (activity) => {
            if (!activity.registrationUrl) {
              return activity;
            }
            
            const page = await browser.newPage();
            try {
              await page.goto(activity.registrationUrl, { waitUntil: 'networkidle2', timeout: 30000 });
              
              // Use the existing comprehensive detail extractor
              const details = await extractComprehensiveDetails(page);
              
              await page.close();
              
              // Merge the detailed information with the activity
              return {
                ...activity,
                // Enhanced NVRC-specific data
                courseId: details.courseId || activity.code,
                startDate: details.startDate,
                endDate: details.endDate,
                startTime: details.startTime,
                endTime: details.endTime,
                registrationEndDate: details.registrationEndDate,
                registrationEndTime: details.registrationEndTime,
                cost: details.cost || activity.price,
                costIncludesTax: details.costIncludesTax,
                taxAmount: details.taxAmount,
                spotsAvailable: details.spotsAvailable !== undefined ? details.spotsAvailable : activity.spotsAvailable,
                totalSpots: details.totalSpots,
                registrationStatus: details.registrationStatus || activity.availability,
                location: details.location || activity.location,
                fullAddress: details.fullAddress,
                fullDescription: details.fullDescription,
                instructor: details.instructor,
                whatToBring: details.whatToBring,
                ageRestrictions: details.ageRestrictions,
                prerequisites: details.prerequisites,
                sessions: details.sessions,
                hasMultipleSessions: details.sessions.length > 1,
                sessionCount: details.sessions.length,
                hasPrerequisites: details.prerequisites.length > 0,
                requiredExtras: details.requiredExtras
              };
            } catch (error) {
              this.logProgress(`⚠️ Failed to fetch details for ${activity.name}: ${error.message}`);
              await page.close();
              return activity;
            }
          })
        );
        
        enhanced.push(...batchResults);
      }
    } finally {
      if (browser) await browser.close();
    }
    
    this.logProgress(`✅ Enhanced ${enhanced.length} NVRC activities with detailed information`);
    return enhanced;
  }

  /**
   * Get NVRC-specific field mapping that extends the PerfectMind base mapping
   * @returns {Object} NVRC field mapping configuration
   */
  getPerfectMindFieldMapping() {
    return {
      ...super.getPerfectMindFieldMapping(),
      // NVRC-specific overrides and additions
      name: 'name',
      externalId: 'code',  // Use 'code' field from extracted data
      courseId: 'code',     // Also map to courseId field
      category: 'section',
      subcategory: 'activitySection',
      description: 'fullDescription',
      schedule: { path: 'daysOfWeek', transform: this.formatNVRCSchedule },
      cost: 'cost',
      spotsAvailable: 'spotsAvailable',
      totalSpots: 'totalSpots',
      registrationStatus: 'availability',
      registrationUrl: 'registrationUrl',
      locationName: 'location',
      instructor: 'instructor',
      startTime: 'startTime',
      endTime: 'endTime',
      dateStart: 'startDate',
      dateEnd: 'endDate',
      daysOfWeek: 'daysOfWeek',
      ageMin: 'ageRange.min',
      ageMax: 'ageRange.max',
      fullAddress: 'fullAddress',
      whatToBring: 'whatToBring',
      sessions: 'sessions',
      prerequisites: 'prerequisites'
    };
  }

  /**
   * Format NVRC schedule from days of week and time
   * @param {Array} daysOfWeek - Days of week
   * @param {Object} activity - Full activity object for context
   * @returns {String} Formatted schedule
   */
  formatNVRCSchedule(daysOfWeek, activity) {
    if (!daysOfWeek || daysOfWeek.length === 0) return '';
    
    const days = Array.isArray(daysOfWeek) ? daysOfWeek.join(', ') : daysOfWeek;
    const time = activity?.time || activity?.startTime && activity?.endTime ? 
      `${activity.startTime} - ${activity.endTime}` : '';
    
    return `${days} ${time}`.trim();
  }

  /**
   * Get default NVRC configuration
   * @returns {Object} NVRC configuration
   */
  static getDefaultConfig() {
    return {
      name: 'North Vancouver Recreation & Culture',
      code: 'nvrc',
      platform: 'perfectmind',
      baseUrl: 'https://nvrc.perfectmind.com',
      scraperConfig: {
        type: 'widget',
        entryPoints: [
          'https://nvrc.perfectmind.com/23734/Clients/BookMe4?widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a'
        ],
        sections: [
          'Early Years: Parent Participation',
          'Early Years: On My Own',
          'All Ages & Family',
          'School Age',
          'Youth'
        ],
        maxConcurrency: 5,
        enableDetailEnhancement: true,
        rateLimits: {
          requestsPerMinute: 30,
          concurrentRequests: 5
        },
        timeout: 30000,
        retries: 3
      },
      region: 'North Vancouver',
      isActive: true
    };
  }
}

module.exports = NVRCScraper;