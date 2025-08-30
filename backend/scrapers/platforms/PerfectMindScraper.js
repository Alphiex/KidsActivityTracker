const BaseScraper = require('../base/BaseScraper');
const DataNormalizer = require('../base/DataNormalizer');
const puppeteer = require('puppeteer');

/**
 * Platform scraper for PerfectMind-based recreation websites
 * Handles the widget-based navigation and data extraction patterns
 * common to PerfectMind systems
 */
class PerfectMindScraper extends BaseScraper {
  constructor(config) {
    super(config);
    this.platformName = 'PerfectMind';
  }

  /**
   * Main scraping method for PerfectMind platforms
   * @returns {Promise<{activities: Array, stats: Object, report: String}>}
   */
  async scrape() {
    const startTime = Date.now();
    this.logProgress('Starting PerfectMind scraper');

    try {
      // Validate configuration
      this.validateConfig();
      this.validatePerfectMindConfig();

      // Get provider record
      const provider = await this.getOrCreateProvider();
      
      // Extract activities using PerfectMind-specific methods
      const rawActivities = await this.extractPerfectMindActivities();
      
      // Normalize the data
      const normalizedActivities = await this.normalizeActivities(rawActivities);
      
      // Save to database
      const stats = await this.saveActivitiesToDatabase(normalizedActivities, provider.id);
      
      // Generate report
      const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
      const report = this.generateReport(stats, duration);
      
      this.logProgress(`Scraping completed in ${duration} minutes`);
      
      return {
        activities: normalizedActivities,
        stats: stats,
        report: report
      };

    } catch (error) {
      this.handleError(error, 'scrape');
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Validate PerfectMind-specific configuration
   */
  validatePerfectMindConfig() {
    const scraperConfig = this.config.scraperConfig;
    
    if (!scraperConfig) {
      throw new Error('scraperConfig is required for PerfectMind scraper');
    }

    if (scraperConfig.type !== 'widget') {
      throw new Error('PerfectMind scraper requires scraperConfig.type = "widget"');
    }

    if (!scraperConfig.sections || !Array.isArray(scraperConfig.sections)) {
      throw new Error('PerfectMind scraper requires scraperConfig.sections array');
    }
  }

  /**
   * Extract activities using PerfectMind widget navigation
   * @returns {Promise<Array>} Raw activity data
   */
  async extractPerfectMindActivities() {
    const activities = [];
    const { entryPoints, sections, maxConcurrency = 3 } = this.config.scraperConfig;
    
    if (!entryPoints || entryPoints.length === 0) {
      throw new Error('No entry points configured for PerfectMind scraper');
    }

    const widgetUrl = entryPoints[0]; // Use first entry point as main widget URL
    
    this.logProgress(`Starting extraction from widget: ${widgetUrl}`);

    // First, get all activity links from the main page
    const activityLinks = await this.fetchActivityLinks(widgetUrl, sections);
    
    this.logProgress(`Found ${activityLinks.totalLinks} activity links across ${Object.keys(activityLinks.bySection).length} sections`);
    
    // Process sections in parallel batches
    const sectionNames = Object.keys(activityLinks.bySection);
    const batches = [];
    
    for (let i = 0; i < sectionNames.length; i += maxConcurrency) {
      batches.push(sectionNames.slice(i, i + maxConcurrency));
    }
    
    // Process each batch
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      this.logProgress(`Processing batch ${batchIndex + 1}/${batches.length}: ${batch.join(', ')}`);
      
      const batchPromises = batch.map(section => 
        this.processPerfectMindSection(widgetUrl, section, activityLinks.bySection[section])
      );
      
      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach((result, idx) => {
        if (result.status === 'fulfilled') {
          activities.push(...result.value);
          this.logProgress(`✅ ${batch[idx]}: ${result.value.length} activities`);
        } else {
          this.handleError(new Error(result.reason), `section ${batch[idx]}`);
        }
      });
    }

    this.logProgress(`Total activities extracted: ${activities.length}`);
    return activities;
  }

  /**
   * Fetch activity links from PerfectMind widget page
   * @param {String} widgetUrl - Widget URL
   * @param {Array} targetSections - Sections to extract
   * @returns {Promise<Object>} Activity links organized by section
   */
  async fetchActivityLinks(widgetUrl, targetSections) {
    let browser;
    
    try {
      browser = await puppeteer.launch({
        headless: this.config.scraperConfig.headless !== false,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
      });

      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
      
      await page.goto(widgetUrl, { waitUntil: 'networkidle0', timeout: 60000 });
      await page.waitForSelector('body', { timeout: 30000 });
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Extract activity links organized by section
      const activityLinks = await page.evaluate((sections) => {
        const result = {
          bySection: {},
          totalLinks: 0
        };
        
        sections.forEach(sectionName => {
          const links = [];
          const allElements = Array.from(document.querySelectorAll('*'));
          
          // Find the section header
          let sectionElement = null;
          for (const el of allElements) {
            if (el.textContent?.trim() === sectionName) {
              sectionElement = el;
              break;
            }
          }
          
          if (!sectionElement) return;
          
          // Find container with links
          let currentElement = sectionElement;
          let container = null;
          
          while (currentElement && !container) {
            const nextSibling = currentElement.nextElementSibling;
            if (nextSibling && nextSibling.querySelectorAll('a').length > 0) {
              container = nextSibling;
              break;
            }
            currentElement = currentElement.parentElement;
            if (currentElement && currentElement.nextElementSibling && 
                currentElement.nextElementSibling.querySelectorAll('a').length > 0) {
              container = currentElement.nextElementSibling;
              break;
            }
          }
          
          if (container) {
            const containerLinks = Array.from(container.querySelectorAll('a'));
            
            for (const link of containerLinks) {
              const text = link.textContent?.trim() || '';
              
              // Stop if we hit another section
              if (sections.includes(text) && text !== sectionName) {
                break;
              }
              
              // Activity links have patterns like "Arts Dance (0-6yrs)"
              if (text.includes('(') && text.includes(')') && 
                  !text.includes('Drop-In') && 
                  !text.includes('Book') &&
                  text.length > 5) {
                links.push({
                  text: text,
                  href: link.href
                });
              }
            }
          }
          
          if (links.length > 0) {
            result.bySection[sectionName] = links;
            result.totalLinks += links.length;
          }
        });
        
        return result;
      }, targetSections);
      
      return activityLinks;
      
    } finally {
      if (browser) await browser.close();
    }
  }

  /**
   * Process a single PerfectMind section
   * @param {String} widgetUrl - Main widget URL
   * @param {String} sectionName - Section name
   * @param {Array} sectionLinks - Links for this section
   * @returns {Promise<Array>} Activities from this section
   */
  async processPerfectMindSection(widgetUrl, sectionName, sectionLinks) {
    let browser;
    const sectionActivities = [];
    
    try {
      browser = await puppeteer.launch({
        headless: this.config.scraperConfig.headless !== false,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
      });

      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
      
      this.logProgress(`Processing ${sectionName}: ${sectionLinks.length} activity types`);
      
      for (const linkInfo of sectionLinks) {
        try {
          // Navigate to main page
          await page.goto(widgetUrl, { waitUntil: 'networkidle0', timeout: 60000 });
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Click the activity link
          const clicked = await page.evaluate((linkText) => {
            const links = Array.from(document.querySelectorAll('a'));
            const targetLink = links.find(l => l.textContent?.trim() === linkText);
            if (targetLink) {
              targetLink.click();
              return true;
            }
            return false;
          }, linkInfo.text);
          
          if (clicked) {
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Extract activities from this page
            const pageActivities = await this.extractActivitiesFromPerfectMindPage(page, sectionName, linkInfo.text);
            sectionActivities.push(...pageActivities);
            
            this.logProgress(`  ✅ ${linkInfo.text}: ${pageActivities.length} activities`);
          } else {
            this.logProgress(`  ⚠️  Could not click: ${linkInfo.text}`);
          }
          
        } catch (error) {
          this.handleError(error, `processing ${linkInfo.text} in ${sectionName}`);
        }
      }
      
      return sectionActivities;
      
    } finally {
      if (browser) await browser.close();
    }
  }

  /**
   * Extract activities from PerfectMind activity page
   * @param {Object} page - Puppeteer page
   * @param {String} sectionName - Section name
   * @param {String} activityType - Activity type
   * @returns {Promise<Array>} Extracted activities
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

    // Extract activities using PerfectMind-specific selectors
    const pageActivities = await page.evaluate((section, actType) => {
      const activities = [];
      const groupItems = document.querySelectorAll('.bm-group-item-row');
      const groupTitles = document.querySelectorAll('.bm-group-title-row');
      
      // Create a map of positions to titles
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
          
          // Look for any activity indicator
          const hasPrice = itemText.includes('$');
          const hasCourseId = itemText.includes('#');
          const hasLink = itemRow.querySelector('a[href*="courseId"], a[href*="BookMe4"]');
          
          if (!hasPrice && !hasCourseId && !hasLink) {
            return;
          }
          
          // Extract activity details using PerfectMind-specific patterns
          const nameElement = itemRow.querySelector('.bm-group-item-name');
          const courseIdElement = itemRow.querySelector('.bm-group-item-course-id');
          
          const activity = {
            // Basic info
            name: nameElement?.textContent?.trim() || '',
            courseId: courseIdElement?.textContent?.trim() || '',
            section: section,
            activityType: actType,
            
            // Extracted data (will be normalized later)
            rawText: itemText,
            rawElement: itemRow.innerHTML
          };
          
          // Add common PerfectMind extractions here
          // (dates, times, costs, availability, etc.)
          // This will be handled by the normalizer
          
          if (activity.name || activity.courseId) {
            activities.push(activity);
          }
          
        } catch (error) {
          console.error('Error extracting activity:', error);
        }
      });
      
      return activities;
    }, sectionName, activityType);

    return pageActivities;
  }

  /**
   * Normalize PerfectMind activities using the base normalizer
   * @param {Array} rawActivities - Raw activities from extraction
   * @returns {Promise<Array>} Normalized activities
   */
  async normalizeActivities(rawActivities) {
    const fieldMapping = this.getPerfectMindFieldMapping();
    const normalized = [];

    for (const rawActivity of rawActivities) {
      try {
        const normalizedActivity = DataNormalizer.normalizeActivity(
          rawActivity,
          fieldMapping,
          this.config
        );
        
        // Validate the normalized data
        const validation = this.validateActivityData(normalizedActivity);
        if (validation.isValid) {
          normalized.push(normalizedActivity);
        } else {
          this.logProgress(`Invalid activity data for ${rawActivity.name}: ${validation.errors.join(', ')}`);
        }
      } catch (error) {
        this.handleError(error, `normalizing activity ${rawActivity.name}`);
      }
    }

    this.logProgress(`Normalized ${normalized.length}/${rawActivities.length} activities`);
    return normalized;
  }

  /**
   * Get field mapping configuration for PerfectMind platform
   * @returns {Object} Field mapping configuration
   */
  getPerfectMindFieldMapping() {
    return {
      name: 'name',
      externalId: 'courseId',
      category: 'section',
      subcategory: 'activityType',
      description: 'description',
      fullDescription: 'fullDescription',
      schedule: 'schedule',
      cost: 'cost',
      spotsAvailable: 'spotsAvailable',
      totalSpots: 'totalSpots',
      registrationStatus: 'availability',
      registrationUrl: 'registrationUrl',
      locationName: 'location',
      instructor: 'instructor',
      startTime: 'startTime',
      endTime: 'endTime',
      daysOfWeek: 'daysOfWeek',
      ageMin: 'ageRange.min',
      ageMax: 'ageRange.max'
    };
  }

  /**
   * Get or create provider record
   * @returns {Promise<Object>} Provider record
   */
  async getOrCreateProvider() {
    let provider = await this.prisma.provider.findFirst({
      where: { name: this.config.name }
    });

    if (!provider) {
      provider = await this.prisma.provider.create({
        data: {
          name: this.config.name,
          website: this.config.baseUrl,
          platform: this.config.platform,
          region: this.config.region,
          scraperConfig: this.config.scraperConfig,
          isActive: true
        }
      });
      this.logProgress(`Created new provider: ${provider.name}`);
    }

    return provider;
  }
}

module.exports = PerfectMindScraper;